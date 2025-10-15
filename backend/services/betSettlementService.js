const mongoose = require('mongoose');
const Bet = require('../models/Bet');
const Results = require('../models/Results');
const Scores = require('../models/Scores');
const Odds = require('../models/Odds');
const logger = require('../utils/logger');
const { bus } = require('../utils/cache');

class BetSettlementService {
  constructor() {
    this.isProcessing = false;
  }

  /**
   * Main function to process bet settlements
   * Checks for completed matches and settles pending bets
   */
  async processSettlements() {
    if (this.isProcessing) {
      logger.warn('Bet settlement already in progress, skipping...');
      return;
    }

    this.isProcessing = true;
    let settledBetsCount = 0;
    let processedMatchesCount = 0;

    try {
      logger.info('Starting automated bet settlement process...');

      // Get all completed matches from Results and Scores
      const completedResults = await Results.find({ completed: true });
      const completedScores = await Scores.find({ completed: true });

      // Combine and deduplicate completed matches
      const completedMatches = this.combineCompletedMatches(completedResults, completedScores);
      
      logger.info(`Found ${completedMatches.length} completed matches to process`);

      for (const match of completedMatches) {
        try {
          const settled = await this.settleMatchBets(match);
          if (settled > 0) {
            settledBetsCount += settled;
            processedMatchesCount++;
          }
        } catch (error) {
          logger.error(`Error settling bets for match ${match.eventId}:`, error);
        }
      }

      logger.info(`Bet settlement completed: ${settledBetsCount} bets settled across ${processedMatchesCount} matches`);
      
      return {
        success: true,
        settledBets: settledBetsCount,
        processedMatches: processedMatchesCount
      };

    } catch (error) {
      logger.error('Error in bet settlement process:', error);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Combine completed matches from Results and Scores, avoiding duplicates
   */
  combineCompletedMatches(results, scores) {
    const matchMap = new Map();

    // Add results
    results.forEach(result => {
      matchMap.set(result.eventId, {
        eventId: result.eventId,
        homeTeam: result.home_team,
        awayTeam: result.away_team,
        scores: result.scores,
        completed: result.completed,
        sport_key: result.sport_key,
        source: 'results'
      });
    });

    // Add scores (will overwrite if same eventId)
    scores.forEach(score => {
      matchMap.set(score.eventId, {
        eventId: score.eventId,
        homeTeam: score.home_team,
        awayTeam: score.away_team,
        scores: score.scores,
        completed: score.completed,
        sport_key: score.sport_key,
        source: 'scores'
      });
    });

    return Array.from(matchMap.values());
  }

  /**
   * Settle bets for a specific completed match
   */
  async settleMatchBets(match) {
    try {
      // Extract scores from the match data
      const { homeScore, awayScore } = this.extractScores(match);
      
      if (homeScore === null || awayScore === null) {
        logger.warn(`Invalid scores for match ${match.eventId}: home=${homeScore}, away=${awayScore}`);
        return 0;
      }

      // Find all pending bets for this match
      // We need to match by eventId or by team names since matchId might be stored differently
      const pendingBets = await this.findMatchingBets(match);

      if (pendingBets.length === 0) {
        logger.debug(`No pending bets found for match ${match.eventId}`);
        return 0;
      }

      logger.info(`Settling ${pendingBets.length} bets for match ${match.eventId} (${match.homeTeam} vs ${match.awayTeam})`);

      let settledCount = 0;
      for (const bet of pendingBets) {
        try {
          const settled = await this.settleSingleBet(bet, homeScore, awayScore, match);
          if (settled) settledCount++;
        } catch (error) {
          logger.error(`Error settling bet ${bet._id}:`, error);
        }
      }

      return settledCount;

    } catch (error) {
      logger.error(`Error settling bets for match ${match.eventId}:`, error);
      return 0;
    }
  }

  /**
   * Extract numeric scores from match data
   */
  extractScores(match) {
    let homeScore = null;
    let awayScore = null;

    if (match.scores && Array.isArray(match.scores)) {
      // Find home and away team scores
      const homeScoreData = match.scores.find(s => s.name === match.homeTeam);
      const awayScoreData = match.scores.find(s => s.name === match.awayTeam);

      if (homeScoreData && awayScoreData) {
        homeScore = parseInt(homeScoreData.score) || 0;
        awayScore = parseInt(awayScoreData.score) || 0;
      } else if (match.scores.length >= 2) {
        // Fallback: assume first score is home, second is away
        homeScore = parseInt(match.scores[0].score) || 0;
        awayScore = parseInt(match.scores[1].score) || 0;
      }
    }

    return { homeScore, awayScore };
  }

  /**
   * Find bets that match the completed match
   */
  async findMatchingBets(match) {
    // Try multiple matching strategies
    const queries = [
      // Direct eventId match
      { matchId: match.eventId, status: 'pending' },
      // Team name matching (case insensitive)
      {
        status: 'pending',
        $and: [
          { homeTeam: { $regex: new RegExp(match.homeTeam, 'i') } },
          { awayTeam: { $regex: new RegExp(match.awayTeam, 'i') } }
        ]
      }
    ];

    let allBets = [];
    for (const query of queries) {
      const bets = await Bet.find(query);
      allBets = allBets.concat(bets);
    }

    // Remove duplicates
    const uniqueBets = allBets.filter((bet, index, self) => 
      index === self.findIndex(b => b._id.toString() === bet._id.toString())
    );

    return uniqueBets;
  }

  /**
   * Settle a single bet based on match outcome
   */
  async settleSingleBet(bet, homeScore, awayScore, match) {
    try {
      let won = false;

      // Determine bet outcome based on market type and selection
      switch (bet.market.toLowerCase()) {
        case 'h2h':
        case 'moneyline':
        case 'match_winner':
        case '1x2': {
          won = this.evaluateMatchWinnerBet(bet.selection, homeScore, awayScore, match);
          break;
        }
        case 'handicap':
        case 'spread': {
          won = this.evaluateHandicapBet(bet.selection, homeScore, awayScore);
          break;
        }
        case 'totals':
        case 'over_under': {
          won = this.evaluateTotalsBet(bet.selection, homeScore, awayScore);
          break;
        }
        default: {
          // Fallback for unknown market types
          logger.warn(`Unknown market type: ${bet.market} for bet ${bet._id}`);
          won = this.evaluateMatchWinnerBet(bet.selection, homeScore, awayScore, match);
        }
      }

      // Update bet status
      const update = {
        status: won ? 'won' : 'lost',
        actualWin: won ? bet.potentialWin : 0,
        settledAt: new Date()
      };

      await Bet.findByIdAndUpdate(bet._id, update);

      // Emit event for real-time updates
      try {
        bus.emit('bets:update', {
          userId: String(bet.userId),
          betId: String(bet._id),
          matchId: bet.matchId,
          status: update.status,
          actualWin: update.actualWin,
          settledAt: update.settledAt,
          homeScore,
          awayScore
        });
      } catch (emitError) {
        logger.warn('Failed to emit bet update event:', emitError);
      }

      logger.info(`Bet ${bet._id} settled as ${won ? 'WON' : 'LOST'} for match ${match.eventId}`);
      return true;

    } catch (error) {
      logger.error(`Error settling bet ${bet._id}:`, error);
      return false;
    }
  }

  /**
   * Evaluate match winner bets (1X2, H2H, etc.)
   */
  evaluateMatchWinnerBet(selection, homeScore, awayScore, match) {
    const sel = selection.toLowerCase();
    
    if (sel.includes('home') || sel === '1') {
      return homeScore > awayScore;
    } else if (sel.includes('away') || sel === '2') {
      return awayScore > homeScore;
    } else if (sel.includes('draw') || sel === 'x') {
      return homeScore === awayScore;
    }
    
    // Fallback: try to match team names
    if (match) {
      const homeTeam = match.homeTeam || match.home_team;
      const awayTeam = match.awayTeam || match.away_team;
      
      if (homeTeam && sel.includes(homeTeam.toLowerCase())) {
        return homeScore > awayScore;
      } else if (awayTeam && sel.includes(awayTeam.toLowerCase())) {
        return awayScore > homeScore;
      }
    }
    
    return false;
  }

  /**
   * Evaluate handicap/spread bets
   */
  evaluateHandicapBet(selection, homeScore, awayScore) {
    try {
      // Extract handicap value from selection (e.g., "Home +1.5" or "Away -2.5")
      const handicapMatch = selection.match(/([-+]?\d+\.?\d*)/);
      if (!handicapMatch) return false;

      const handicap = parseFloat(handicapMatch[1]);
      const sel = selection.toLowerCase();

      if (sel.includes('home')) {
        return (homeScore + handicap) > awayScore;
      } else if (sel.includes('away')) {
        return (awayScore + handicap) > homeScore;
      }

      return false;
    } catch (error) {
      logger.error('Error evaluating handicap bet:', error);
      return false;
    }
  }

  /**
   * Evaluate totals/over-under bets
   */
  evaluateTotalsBet(selection, homeScore, awayScore) {
    try {
      // Extract total value from selection (e.g., "Over 2.5" or "Under 3.5")
      const totalMatch = selection.match(/(\d+\.?\d*)/);
      if (!totalMatch) return false;

      const total = parseFloat(totalMatch[1]);
      const totalScore = homeScore + awayScore;
      const sel = selection.toLowerCase();

      if (sel.includes('over')) {
        return totalScore > total;
      } else if (sel.includes('under')) {
        return totalScore < total;
      }

      return false;
    } catch (error) {
      logger.error('Error evaluating totals bet:', error);
      return false;
    }
  }
}

module.exports = new BetSettlementService();