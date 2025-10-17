const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Bet = require('../models/Bet');
const User = require('../models/User');
const Match = require('../models/Match');
const { auth } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const Odds = require('../models/Odds');
// Removed unused matchDataEnricher import

// Enhanced match data with real team names
const enhancedMatchData = {
  'manchester-united-liverpool-2024': {
    homeTeam: 'Manchester United',
    awayTeam: 'Liverpool',
    competition: 'Premier League'
  },
  'arsenal-chelsea-2024': {
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    competition: 'Premier League'
  },
  'barcelona-real-madrid-2024': {
    homeTeam: 'Barcelona',
    awayTeam: 'Real Madrid',
    competition: 'La Liga'
  },
  'bayern-munich-dortmund-2024': {
    homeTeam: 'Bayern Munich',
    awayTeam: 'Borussia Dortmund',
    competition: 'Bundesliga'
  },
  'psg-marseille-2024': {
    homeTeam: 'Paris Saint-Germain',
    awayTeam: 'Marseille',
    competition: 'Ligue 1'
  },
  'ac-milan-inter-milan-2024': {
    homeTeam: 'AC Milan',
    awayTeam: 'Inter Milan',
    competition: 'Serie A'
  },
  'ajax-feyenoord-2024': {
    homeTeam: 'Ajax',
    awayTeam: 'Feyenoord',
    competition: 'Eredivisie'
  },
  'porto-benfica-2024': {
    homeTeam: 'Porto',
    awayTeam: 'Benfica',
    competition: 'Primeira Liga'
  },
  'celtic-rangers-2024': {
    homeTeam: 'Celtic',
    awayTeam: 'Rangers',
    competition: 'Scottish Premiership'
  },
  'galatasaray-fenerbahce-2024': {
    homeTeam: 'Galatasaray',
    awayTeam: 'Fenerbahce',
    competition: 'Super Lig'
  },
  'olympiacos-panathinaikos-2024': {
    homeTeam: 'Olympiacos',
    awayTeam: 'Panathinaikos',
    competition: 'Super League Greece'
  },
  'test-real-match-verification': {
    homeTeam: 'Liverpool',
    awayTeam: 'Manchester United',
    competition: 'Premier League'
  },
  // Add existing match IDs from bet history
  'manchester-united-city-real': {
    homeTeam: 'Manchester United',
    awayTeam: 'Manchester City',
    competition: 'Premier League'
  },
  'arsenal-chelsea-match-real': {
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    competition: 'Premier League'
  },
  'f37021de21572159764157dbf2e5ae62': {
    homeTeam: 'Bayern Munich',
    awayTeam: 'Borussia Dortmund',
    competition: 'Bundesliga'
  },
  'test-match-manchester-united-real': {
    homeTeam: 'Manchester United',
    awayTeam: 'Liverpool',
    competition: 'Premier League'
  },
  'test-match-arsenal-chelsea-real': {
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    competition: 'Premier League'
  },
  'test-match-manchester-united-liverpool': {
    homeTeam: 'Manchester United',
    awayTeam: 'Liverpool',
    competition: 'Premier League'
  }
};

// Helper functions to get match information
function getHomeTeam(matchId, market, selection) {
  const matchData = enhancedMatchData[matchId];
  if (matchData) {
    return matchData.homeTeam;
  }
  
  // Fallback logic for unknown matches
  if (market.includes('Winner')) {
    if (selection === 'Home Team' || selection === matchData?.homeTeam) {
      return selection;
    }
    return 'Unknown';
  }
  return 'Unknown';
}

function getAwayTeam(matchId, market, selection) {
  const matchData = enhancedMatchData[matchId];
  if (matchData) {
    return matchData.awayTeam;
  }
  
  // Fallback logic for unknown matches
  if (market.includes('Winner')) {
    if (selection === 'Away Team' || selection === matchData?.awayTeam) {
      return selection;
    }
    return 'Unknown';
  }
  return 'Unknown';
}

function getCompetition(matchId) {
  const matchData = enhancedMatchData[matchId];
  return matchData ? matchData.competition : 'Soccer';
}

// Place a new bet
router.post('/', auth, [
  body('matchId').notEmpty().trim(), // Remove isMongoId() validation for now
  body('market').notEmpty().trim(),
  body('selection').notEmpty().trim(),
  body('stake').isFloat({ min: 0.01 }),
  body('odds').isFloat({ min: 1.01 })
], async (req, res) => {
  try {
    console.log('=== Bet submission request ===');
    console.log('Request body:', req.body);
    console.log('User ID from token:', req.user.id);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { matchId, market, selection, stake, odds } = req.body;
    const userId = req.user.id;

    console.log('Processing bet with data:', { matchId, market, selection, stake, odds, userId });

    // Validate user balance
    console.log('Validating user balance...');
    const user = await User.findById(userId);
    if (!user) {
      console.log('User not found:', userId);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('User found:', { id: user._id, balance: user.balance, stake });

    if (user.balance < stake) {
      console.log('Insufficient balance:', { balance: user.balance, stake });
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // For now, skip match validation since we're using external API data
    // TODO: Implement proper match storage and validation
    /*
    // Validate match exists and is not started
    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    if (match.status !== 'upcoming') {
      return res.status(400).json({ error: 'Betting is closed for this match' });
    }

    if (new Date() >= match.startTime) {
      return res.status(400).json({ error: 'Match has already started' });
    }
    */

    // Create bet - store matchId as string since it's from external API
    // Resolve basic match info; for parlay, use synthetic labels
    let homeTeam = null, awayTeam = null, league = null;
    const isParlay = String(market).toLowerCase() === 'parlay';
    if (isParlay) {
      const legs = typeof selection === 'string' && selection.length > 0
        ? selection.split(';').length
        : 0;
      homeTeam = 'Parlay';
      awayTeam = legs > 0 ? `${legs} selections` : 'Multiple selections';
      league = 'Parlay';
    } else {
      const oddsDoc = await Odds.findOne({ gameId: matchId });
      if (oddsDoc) {
        homeTeam = oddsDoc.home_team;
        awayTeam = oddsDoc.away_team;
        league = oddsDoc.sport_title;
      } else if (enhancedMatchData[matchId]) {
        homeTeam = enhancedMatchData[matchId].homeTeam;
        awayTeam = enhancedMatchData[matchId].awayTeam;
        league = enhancedMatchData[matchId].competition;
      }
    }
    const betData = {
      userId,
      matchId: matchId.toString(),
      homeTeam,
      awayTeam,
      league,
      market,
      selection,
      stake,
      odds,
      potentialWin: stake * odds
    };

    // Add matches array for multibets/parlays
    if (isParlay && req.body.matches && Array.isArray(req.body.matches)) {
      betData.matches = req.body.matches.map(match => ({
        matchId: match.matchId,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        selection: match.selection,
        odds: match.odds,
        status: 'pending',
        outcome: null,
        startTime: match.startTime ? new Date(match.startTime) : new Date()
      }));
    }

    const bet = new Bet(betData);

    console.log('Saving bet to database...');
    await bet.save();
    console.log('Bet saved successfully:', bet._id);

    // Update user balance
    console.log('Updating user balance...');
    await User.updateBalance(userId, -stake);
    console.log('User balance updated');

    // Broadcast new bet via WebSocket
    if (global.websocketServer) {
      const populatedBet = await Bet.findById(bet._id).populate('userId', 'username email');
      
      global.websocketServer.broadcastToAll({
        type: 'new_bet',
        payload: {
          bet: populatedBet,
          betId: bet._id.toString(),
          userId: userId.toString()
        }
      });
    }

    res.status(201).json({ 
      id: bet._id,
      bet: {
        id: bet._id,
        match: isParlay ? `Parlay bet (${selection})` : `${market} bet on ${selection}`,
        market: bet.market,
        selection: bet.selection,
        stake: bet.stake,
        odds: bet.odds,
        potentialWin: bet.potentialWin,
        status: bet.status,
        createdAt: bet.createdAt
      }
    });
  } catch (error) {
    console.error('=== Place bet error ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    
    // Check for specific MongoDB errors
    if (error.name === 'ValidationError') {
      console.error('MongoDB validation error:', error.errors);
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    
    if (error.name === 'CastError') {
      console.error('MongoDB cast error:', error.message);
      return res.status(400).json({ error: 'Invalid data format' });
    }
    
    if (error.code === 11000) {
      console.error('MongoDB duplicate key error');
      return res.status(400).json({ error: 'Duplicate entry' });
    }
    
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Get user's bets
router.get('/my-bets', auth, [
  body('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer.'),
  body('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be an integer between 1 and 100.'),
  body('status').optional().isIn(['pending', 'won', 'lost', 'void']).withMessage('Invalid bet status.')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status; // pending, won, lost, void

    const query = { userId: req.user.id };
    if (status) {
      query.status = status;
    }

    const bets = await Bet.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Bet.countDocuments(query);

    const formattedBets = bets.map(bet => {
      // Prefer actual teams/league from bet document, fallback to enhancedMatchData
      const matchInfo = {
        id: bet.matchId,
        homeTeam: bet.homeTeam || getHomeTeam(bet.matchId, bet.market, bet.selection),
        awayTeam: bet.awayTeam || getAwayTeam(bet.matchId, bet.market, bet.selection),
        competition: bet.league || getCompetition(bet.matchId),
        startTime: bet.createdAt,
        status: bet.status === 'pending' ? 'upcoming' : 'finished'
      };

      // Create detailed odds information
      const oddsInfo = {
        selected: bet.odds,
        potentialWin: bet.potentialWin,
        actualWin: bet.actualWin || 0,
        stake: bet.stake
      };

      // Create result information
      const resultInfo = {
        status: bet.status,
        outcome: bet.status === 'won' ? 'Won' : bet.status === 'lost' ? 'Lost' : bet.status === 'pending' ? 'Pending' : 'Void',
        settledAt: bet.settledAt,
        profit: bet.actualWin ? bet.actualWin - bet.stake : 0
      };

      return {
      id: bet._id,
        match: matchInfo,
      market: bet.market,
      selection: bet.selection,
        odds: oddsInfo,
        result: resultInfo,
        createdAt: bet.createdAt,
      stake: bet.stake,
      potentialWin: bet.potentialWin,
      actualWin: bet.actualWin,
      status: bet.status,
      settledAt: bet.settledAt,
      matchId: bet.matchId,
      matches: bet.matches || []
      };
    });

    res.json({
      bets: formattedBets,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get bets error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get bet by ID
router.get('/:betId', auth, async (req, res) => {
  try {
    const bet = await Bet.findOne({ 
      _id: req.params.betId, 
      userId: req.user.id 
    });

    if (!bet) {
      return res.status(404).json({ error: 'Bet not found' });
    }

    res.json({
      id: bet._id,
      match: `${bet.market} bet on ${bet.selection}`,
      market: bet.market,
      selection: bet.selection,
      stake: bet.stake,
      odds: bet.odds,
      potentialWin: bet.potentialWin,
      actualWin: bet.actualWin,
      status: bet.status,
      createdAt: bet.createdAt,
      settledAt: bet.settledAt,
      matchId: bet.matchId
    });
  } catch (error) {
    console.error('Get bet error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Cancel bet (only if match hasn't started)
router.delete('/:betId', auth, async (req, res) => {
  try {
    const bet = await Bet.findOne({ 
      _id: req.params.betId, 
      userId: req.user.id,
      status: 'pending'
    });

    if (!bet) {
      return res.status(404).json({ error: 'Bet not found or cannot be cancelled' });
    }

    // For now, allow cancellation since we don't have match start time validation
    // TODO: Implement proper match validation when storing match data

    // Update bet status
    bet.status = 'cancelled';
    bet.settledAt = new Date();
    await bet.save();

    // Refund user balance
    await User.updateBalance(req.user.id, bet.stake);

    res.json({ success: true, message: 'Bet cancelled and stake refunded' });
  } catch (error) {
    console.error('Cancel bet error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get betting statistics for user
router.get('/stats/summary', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`Fetching bet stats for user: ${userId}`);

    // Get comprehensive bet statistics using aggregation
    const stats = await Bet.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalStake: { $sum: '$stake' },
          totalWin: { $sum: '$actualWin' },
          totalPotentialWin: { $sum: '$potentialWin' }
        }
      }
    ]);

    console.log('Aggregation results:', stats);

    const summary = {
      totalBets: 0,
      totalStaked: 0,
      totalWon: 0,
      totalPotentialWin: 0,
      pendingBets: 0,
      wonBets: 0,
      lostBets: 0,
      voidBets: 0,
      cancelledBets: 0,
      profit: 0,
      winRate: 0
    };

    // Process aggregation results
    stats.forEach(stat => {
      summary.totalBets += stat.count;
      summary.totalStaked += stat.totalStake || 0;
      summary.totalWon += stat.totalWin || 0;
      summary.totalPotentialWin += stat.totalPotentialWin || 0;

      switch (stat._id) {
        case 'pending':
          summary.pendingBets = stat.count;
          break;
        case 'won':
          summary.wonBets = stat.count;
          break;
        case 'lost':
          summary.lostBets = stat.count;
          break;
        case 'void':
          summary.voidBets = stat.count;
          break;
        case 'cancelled':
          summary.cancelledBets = stat.count;
          break;
      }
    });

    // Calculate derived statistics
    summary.profit = summary.totalWon - summary.totalStaked;
    
    // Calculate win rate based only on settled bets (won + lost), excluding pending, void, and cancelled
    const settledBets = summary.wonBets + summary.lostBets;
    summary.winRate = settledBets > 0 ? parseFloat(((summary.wonBets / settledBets) * 100).toFixed(2)) : 0;

    // Add active bets (alias for pending bets for frontend compatibility)
    summary.activeBets = summary.pendingBets;

    console.log('Final summary:', summary);
    res.json(summary);
  } catch (error) {
    console.error('Get bet stats error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Server error', 
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;