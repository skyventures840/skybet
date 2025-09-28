const axios = require('axios');
// Logger removed during cleanup - using console for now

// Configuration
const ODDS_API_KEY = process.env.ODDS_API_KEY || 'your-api-key-here';
const ODDS_API_BASE_URL = 'https://api.the-odds-api.com/v4';

class ComprehensiveOddsService {
  constructor() {
    this.apiKey = ODDS_API_KEY;
    this.baseUrl = ODDS_API_BASE_URL;
  }

  // Helper function to fetch all sports
  async fetchSports() {
    const url = `${this.baseUrl}/sports?apiKey=${this.apiKey}`;
    try {
      const response = await axios.get(url);
      return response.data.map(sport => sport.key);
    } catch (error) {
      console.error(`Error fetching sports: ${error.message}`);
      throw new Error(`Error fetching sports: ${error.message}`);
    }
  }

  // Helper function to fetch odds for a sport
  async fetchOdds(sport, regions = 'us', markets = 'h2h,totals,spreads', bookmakers = 'fanduel,betmgm') {
    const url = `${this.baseUrl}/sports/${sport}/odds?apiKey=${this.apiKey}&regions=${regions}&markets=${markets}&oddsFormat=decimal&bookmakers=${bookmakers}`;
    try {
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      console.error(`Error fetching odds for ${sport}: ${error.message}`);
      throw new Error(`Error fetching odds for ${sport}: ${error.message}`);
    }
  }

  // Helper function to fetch scores/results for a sport
  async fetchScores(sport, daysFrom = 1) {
    const url = `${this.baseUrl}/sports/${sport}/scores?apiKey=${this.apiKey}&daysFrom=${daysFrom}`;
    try {
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      console.warn(`Error fetching scores for ${sport}: ${error.message}`);
      return []; // Return empty array as fallback
    }
  }

  // Helper function to merge odds and results data
  mergeOddsAndResults(oddsData, scoresData) {
    const resultMap = new Map(scoresData.map(event => [event.id, event]));
    oddsData.forEach(event => {
      const scoreEvent = resultMap.get(event.id);
      if (scoreEvent && scoreEvent.scores) {
        event.scores = scoreEvent.scores;
        event.completed = scoreEvent.completed;
        event.last_update = scoreEvent.last_update;
      }
    });
    return oddsData;
  }

  // Helper function to merge bookmaker data, prioritizing primary bookmaker
  mergeBookmakerData(eventData, primaryBookmaker = 'fanduel', fallbackBookmaker = 'betmgm') {
    eventData.forEach(event => {
      if (!event.bookmakers || event.bookmakers.length === 0) {
        event.bookmakers = [];
        return;
      }
      
      const primary = event.bookmakers.find(b => b.key === primaryBookmaker);
      const fallback = event.bookmakers.find(b => b.key === fallbackBookmaker);
      const mergedMarkets = [];

      const allMarkets = new Set();
      if (primary?.markets) primary.markets.forEach(m => allMarkets.add(m.key));
      if (fallback?.markets) fallback.markets.forEach(m => allMarkets.add(m.key));

      allMarkets.forEach(market => {
        const primaryMarket = primary?.markets.find(m => m.key === market);
        const fallbackMarket = fallback?.markets.find(m => m.key === market);

        if (primaryMarket?.outcomes?.length > 0) {
          mergedMarkets.push({ key: market, outcomes: primaryMarket.outcomes });
        } else if (fallbackMarket?.outcomes?.length > 0) {
          mergedMarkets.push({ key: market, outcomes: fallbackMarket.outcomes });
        }
      });

      event.bookmakers = [{
        key: primary ? primaryBookmaker : (fallback ? fallbackBookmaker : ''),
        title: primary ? primary.title : (fallback ? fallback.title : ''),
        last_update: primary ? primary.last_update : (fallback ? fallback.last_update : ''),
        markets: mergedMarkets
      }];
    });
    return eventData;
  }

  // Main function to fetch all sports markets with results
  async fetchAllSportsMarketsWithResults(options = {}) {
    const { 
      regions = 'us', 
      markets = 'h2h,totals,spreads', 
      primaryBookmaker = 'fanduel', 
      fallbackBookmaker = 'betmgm', 
      daysFrom = 1 
    } = options;

    try {
      logger.info('Starting comprehensive odds and results fetch...');
      
      const sports = await this.fetchSports();
      const result = {};

      for (const sport of sports) {
        result[sport] = { markets: [], results: [] };

        try {
          // Fetch odds data
          const oddsData = await this.fetchOdds(sport, regions, markets, `${primaryBookmaker},${fallbackBookmaker}`);
          const mergedOddsData = this.mergeBookmakerData(oddsData, primaryBookmaker, fallbackBookmaker);
          result[sport].markets = mergedOddsData;

          // Fetch and merge scores/results
          const scoresData = await this.fetchScores(sport, daysFrom);
          if (scoresData.length > 0) {
            const combinedData = this.mergeOddsAndResults(mergedOddsData, scoresData);
            result[sport].markets = combinedData;
            result[sport].results = scoresData.filter(event => event.scores);
          }
          
          logger.info(`Processed ${sport}: ${result[sport].markets.length} markets, ${result[sport].results.length} results`);
        } catch (error) {
          logger.error(`Error processing sport ${sport}: ${error.message}`);
          result[sport].error = error.message;
        }
      }

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        total_sports: Object.keys(result).length
      };
      
    } catch (error) {
      logger.error('Error in comprehensive odds fetch:', error);
      throw new Error(`Error processing request: ${error.message}`);
    }
  }

  // Function to fetch markets and results for specific sport
  async fetchSportMarketsWithResults(sportKey, options = {}) {
    const { 
      regions = 'us', 
      markets = 'h2h,totals,spreads', 
      primaryBookmaker = 'fanduel', 
      fallbackBookmaker = 'betmgm', 
      daysFrom = 1 
    } = options;

    try {
      logger.info(`Fetching markets and results for sport: ${sportKey}`);
      
      // Fetch odds data
      const oddsData = await this.fetchOdds(sportKey, regions, markets, `${primaryBookmaker},${fallbackBookmaker}`);
      const mergedOddsData = this.mergeBookmakerData(oddsData, primaryBookmaker, fallbackBookmaker);
      
      // Fetch and merge scores/results
      const scoresData = await this.fetchScores(sportKey, daysFrom);
      let combinedData = mergedOddsData;
      
      if (scoresData.length > 0) {
        combinedData = this.mergeOddsAndResults(mergedOddsData, scoresData);
      }
      
      const results = scoresData.filter(event => event.scores);
      
      return {
        success: true,
        sport: sportKey,
        markets: combinedData,
        results: results,
        total_markets: combinedData.length,
        total_results: results.length,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error(`Error fetching markets and results for ${sportKey}:`, error);
      throw new Error(`Error fetching markets and results for ${sportKey}: ${error.message}`);
    }
  }

  // Function to fetch specific match with markets and results
  async fetchMatchWithResults(matchId, options = {}) {
    const { 
      regions = 'us', 
      markets = 'h2h,totals,spreads', 
      primaryBookmaker = 'fanduel', 
      fallbackBookmaker = 'betmgm' 
    } = options;

    try {
      logger.info(`Fetching match ${matchId} with markets and results`);
      
      // Try to find match in all sports
      const sports = await this.fetchSports();
      
      for (const sport of sports) {
        try {
          const oddsData = await this.fetchOdds(sport, regions, markets, `${primaryBookmaker},${fallbackBookmaker}`);
          const match = oddsData.find(event => event.id === matchId);
          
          if (match) {
            const mergedData = this.mergeBookmakerData([match], primaryBookmaker, fallbackBookmaker);
            const finalMatch = mergedData[0];
            
            // Try to fetch results
            try {
              const scoresData = await this.fetchScores(sport, 7); // Look back 7 days
              const matchResult = scoresData.find(event => event.id === matchId);
              if (matchResult && matchResult.scores) {
                finalMatch.scores = matchResult.scores;
                finalMatch.completed = matchResult.completed;
              }
            } catch (error) {
              logger.warn(`Could not fetch results for match ${matchId}: ${error.message}`);
            }
            
            return {
              success: true,
              match: finalMatch,
              sport: sport,
              source: 'live_api'
            };
          }
        } catch (error) {
          logger.warn(`Error checking sport ${sport} for match ${matchId}: ${error.message}`);
          continue;
        }
      }
      
      return {
        success: false,
        error: 'Match not found'
      };
      
    } catch (error) {
      logger.error(`Error fetching match ${matchId}:`, error);
      throw new Error(`Error fetching match: ${error.message}`);
    }
  }

  // Function to get betslip status updates based on results
  async getBetslipStatusUpdates(betMatches) {
    const updates = [];
    
    for (const bet of betMatches) {
      try {
        const matchResult = await this.fetchMatchWithResults(bet.matchId);
        
        if (matchResult.success && matchResult.match.scores) {
          const scores = matchResult.match.scores;
          const homeScore = scores[0] || 0;
          const awayScore = scores[1] || 0;
          
          let betStatus = 'pending';
          let betOutcome = null;
          
          // Determine bet outcome based on bet type and scores
          if (bet.type === '1' && homeScore > awayScore) {
            betStatus = 'won';
            betOutcome = 'home_win';
          } else if (bet.type === '2' && awayScore > homeScore) {
            betStatus = 'won';
            betOutcome = 'away_win';
          } else if (bet.type === 'X' && homeScore === awayScore) {
            betStatus = 'won';
            betOutcome = 'draw';
          } else if (matchResult.match.completed) {
            betStatus = 'lost';
            betOutcome = homeScore > awayScore ? 'home_win' : (awayScore > homeScore ? 'away_win' : 'draw');
          }
          
          updates.push({
            betId: bet.id,
            matchId: bet.matchId,
            status: betStatus,
            outcome: betOutcome,
            scores: scores,
            completed: matchResult.match.completed,
            lastUpdate: matchResult.match.last_update
          });
        }
      } catch (error) {
        logger.error(`Error updating betslip status for bet ${bet.id}: ${error.message}`);
        updates.push({
          betId: bet.id,
          matchId: bet.matchId,
          status: 'error',
          error: error.message
        });
      }
    }
    
    return updates;
  }
}

module.exports = ComprehensiveOddsService; 