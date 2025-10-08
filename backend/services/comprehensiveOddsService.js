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

  // Comprehensive market list to attempt across sports
  COMPREHENSIVE_MARKETS = [
    'h2h','spreads','totals','outrights','h2h_lay','outrights_lay',
    'alternate_spreads','alternate_totals','btts','draw_no_bet','h2h_3_way',
    'team_totals','alternate_team_totals',
    'h2h_q1','h2h_q2','h2h_q3','h2h_q4','h2h_h1','h2h_h2','h2h_p1','h2h_p2','h2h_p3',
    'h2h_3_way_q1','h2h_3_way_q2','h2h_3_way_q3','h2h_3_way_q4','h2h_3_way_h1','h2h_3_way_h2','h2h_3_way_p1','h2h_3_way_p2','h2h_3_way_p3',
    'h2h_1st_1_innings','h2h_1st_3_innings','h2h_1st_5_innings','h2h_1st_7_innings',
    'h2h_3_way_1st_1_innings','h2h_3_way_1st_3_innings','h2h_3_way_1st_5_innings','h2h_3_way_1st_7_innings',
    'spreads_q1','spreads_q2','spreads_q3','spreads_q4','spreads_h1','spreads_h2','spreads_p1','spreads_p2','spreads_p3',
    'spreads_1st_1_innings','spreads_1st_3_innings','spreads_1st_5_innings','spreads_1st_7_innings',
    'alternate_spreads_1st_1_innings','alternate_spreads_1st_3_innings','alternate_spreads_1st_5_innings','alternate_spreads_1st_7_innings',
    'alternate_spreads_q1','alternate_spreads_q2','alternate_spreads_q3','alternate_spreads_q4','alternate_spreads_h1','alternate_spreads_h2','alternate_spreads_p1','alternate_spreads_p2','alternate_spreads_p3',
    'totals_q1','totals_q2','totals_q3','totals_q4','totals_h1','totals_h2','totals_p1','totals_p2','totals_p3',
    'totals_1st_1_innings','totals_1st_3_innings','totals_1st_5_innings','totals_1st_7_innings',
    'alternate_totals_1st_1_innings','alternate_totals_1st_3_innings','alternate_totals_1st_5_innings','alternate_totals_1st_7_innings',
    'alternate_totals_q1','alternate_totals_q2','alternate_totals_q3','alternate_totals_q4','alternate_totals_h1','alternate_totals_h2','alternate_totals_p1','alternate_totals_p2','alternate_totals_p3',
    'team_totals_h1','team_totals_h2','team_totals_q1','team_totals_q2','team_totals_q3','team_totals_q4','team_totals_p1','team_totals_p2','team_totals_p3',
    'alternate_team_totals_h1','alternate_team_totals_h2','alternate_team_totals_q1','alternate_team_totals_q2','alternate_team_totals_q3','alternate_team_totals_q4','alternate_team_totals_p1','alternate_team_totals_p2','alternate_team_totals_p3',
    'player_assists','player_defensive_interceptions','player_field_goals','player_kicking_points','player_pass_attempts','player_pass_completions',
    'player_pass_interceptions','player_pass_longest_completion','player_pass_rush_yds','player_pass_rush_reception_tds','player_pass_rush_reception_yds',
    'player_pass_tds','player_pass_yds','player_pass_yds_q1','player_pats','player_receptions',
    'player_reception_longest_alternate','player_reception_tds_alternate','player_reception_yds_alternate',
    'player_rush_attempts_alternate','player_rush_longest_alternate','player_rush_reception_tds_alternate','player_rush_reception_yds_alternate',
    'player_rush_tds_alternate','player_rush_yds_alternate','player_sacks_alternate','player_solo_tackles_alternate','player_tackles_assists_alternate',
    'player_points','player_points_q1','player_rebounds','player_rebounds_q1','player_assists','player_assists_q1','player_threes','player_blocks','player_steals','player_blocks_steals',
    'player_turnovers','player_points_rebounds_assists','player_points_rebounds','player_points_assists','player_rebounds_assists','player_field_goals',
    'player_frees_made','player_frees_attempts','player_first_basket','player_first_team_basket','player_double_double','player_triple_double','player_method_of_first_basket',
    'player_points_alternate','player_rebounds_alternate','player_assists_alternate','player_blocks_alternate','player_steals_alternate','player_turnovers_alternate','player_threes_alternate',
    'player_points_assists_alternate','player_points_rebounds_alternate','player_rebounds_assists_alternate','player_points_rebounds_assists_alternate',
    'batter_home_runs','batter_first_home_run','batter_hits','batter_total_bases','batter_rbis','batter_runs_scored','batter_hits_runs_rbis','batter_singles','batter_doubles','batter_triples',
    'batter_walks','batter_strikeouts','batter_stolen_bases','pitcher_strikeouts','pitcher_record_a_win','pitcher_hits_allowed','pitcher_walks','pitcher_earned_runs','pitcher_outs',
    'batter_total_bases_alternate','batter_home_runs_alternate','batter_hits_alternate','batter_rbis_alternate','batter_walks_alternate','batter_strikeouts_alternate','batter_runs_scored_alternate',
    'batter_singles_alternate','batter_doubles_alternate','batter_triples_alternate','pitcher_hits_allowed_alternate','pitcher_walks_alternate','pitcher_strikeouts_alternate',
    'player_power_play_points','player_blocked_shots','player_shots_on_goal','player_goals','player_total_saves','player_goal_scorer_first','player_goal_scorer_last','player_goal_scorer_anytime',
    'player_power_play_points_alternate','player_goals_alternate','player_shots_on_goal_alternate','player_blocked_shots_alternate','player_total_saves_alternate',
    'player_disposals','player_disposals_over','player_goals_scored_over','player_marks_over','player_marks_most','player_tackles_over','player_tackles_most',
    'player_afl_fantasy_points','player_afl_fantasy_points_over','player_afl_fantasy_points_most',
    'player_try_scorer_first','player_try_scorer_last','player_try_scorer_anytime','player_try_scorer_over',
    'player_to_receive_card','player_to_receive_red_card','player_shots_on_target','player_shots','player_assists',
    'alternate_spreads_corners','alternate_totals_corners','alternate_spreads_cards','alternate_totals_cards',
    'double_chance'
  ];

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

  // Helper to fetch supported markets for a sport
  async fetchMarketsForSport(sportKey) {
    const url = `${this.baseUrl}/sports/${sportKey}/markets?apiKey=${this.apiKey}`;
    try {
      const response = await axios.get(url);
      return response.data.map(m => m.key);
    } catch (error) {
      console.warn(`Error fetching markets for ${sportKey}: ${error.message}`);
      return [];
    }
  }

  // Merge events across multiple market calls, deduplicating markets by key
  mergeEventsAcrossCalls(existingEvents, newEvents, primaryBookmaker, fallbackBookmaker) {
    const byId = new Map();

    const addList = (list) => {
      const merged = this.mergeBookmakerData(list, primaryBookmaker, fallbackBookmaker);
      for (const ev of merged) {
        const prev = byId.get(ev.id);
        if (!prev) {
          byId.set(ev.id, ev);
        } else {
          const bm = prev.bookmakers && prev.bookmakers[0];
          const nbm = ev.bookmakers && ev.bookmakers[0];
          if (!bm && nbm) {
            prev.bookmakers = [nbm];
            continue;
          }
          if (!bm || !nbm) continue;
          const existingKeys = new Set((bm.markets || []).map(m => m.key));
          for (const mkt of (nbm.markets || [])) {
            if (!existingKeys.has(mkt.key)) bm.markets.push(mkt);
          }
        }
      }
    };

    if (Array.isArray(existingEvents)) addList(existingEvents);
    if (Array.isArray(newEvents)) addList(newEvents);

    return Array.from(byId.values());
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

  // Try primary bookmaker first; only call fallback if primary yields no usable markets
  async fetchOddsWithFallback(sport, regions, market, primaryBookmaker, fallbackBookmaker) {
    // Primary attempt
    let primaryData = [];
    try {
      primaryData = await this.fetchOdds(sport, regions, market, primaryBookmaker);
    } catch (err) {
      primaryData = [];
    }
    const hasPrimaryMarkets = Array.isArray(primaryData) && primaryData.some(ev => Array.isArray(ev.bookmakers) && ev.bookmakers.some(b => b.key === primaryBookmaker && Array.isArray(b.markets) && b.markets.length > 0));
    if (hasPrimaryMarkets) return primaryData;

    // Fallback attempt only if primary had no markets
    let fallbackData = [];
    try {
      fallbackData = await this.fetchOdds(sport, regions, market, fallbackBookmaker);
    } catch (err) {
      fallbackData = [];
    }
    return fallbackData;
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
      markets = 'all', 
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
          // Determine markets to request list
          let marketsList = [];
          if (markets === 'all') {
            const apiM = await this.fetchMarketsForSport(sport);
            const intersection = (apiM || []).filter(m => this.COMPREHENSIVE_MARKETS.includes(m));
            marketsList = (intersection.length > 0 ? intersection : apiM);
          } else {
            marketsList = (markets || '').split(',').filter(Boolean);
          }

          // Fetch odds data per market and merge
          let mergedOddsData = [];
          for (const mkt of marketsList) {
            try {
              const oddsData = await this.fetchOddsWithFallback(sport, regions, mkt, primaryBookmaker, fallbackBookmaker);
              mergedOddsData = this.mergeEventsAcrossCalls(mergedOddsData, oddsData, primaryBookmaker, fallbackBookmaker);
            } catch (err) {
              console.warn(`Fetch failed for ${sport}/${mkt}: ${err.message}`);
            }
          }
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
      markets = 'all', 
      primaryBookmaker = 'fanduel', 
      fallbackBookmaker = 'betmgm', 
      daysFrom = 1 
    } = options;

    try {
      logger.info(`Fetching markets and results for sport: ${sportKey}`);
      
      // Build markets list
      let marketsList = [];
      if (markets === 'all') {
        const apiM = await this.fetchMarketsForSport(sportKey);
        const intersection = (apiM || []).filter(m => this.COMPREHENSIVE_MARKETS.includes(m));
        marketsList = (intersection.length > 0 ? intersection : apiM);
      } else {
        marketsList = (markets || '').split(',').filter(Boolean);
      }

      // Fetch per market and merge
      let mergedOddsData = [];
      for (const mkt of marketsList) {
        try {
          const oddsData = await this.fetchOddsWithFallback(sportKey, regions, mkt, primaryBookmaker, fallbackBookmaker);
          mergedOddsData = this.mergeEventsAcrossCalls(mergedOddsData, oddsData, primaryBookmaker, fallbackBookmaker);
        } catch (err) {
          console.warn(`Fetch failed for ${sportKey}/${mkt}: ${err.message}`);
        }
      }
      
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
      markets = 'all', 
      primaryBookmaker = 'fanduel', 
      fallbackBookmaker = 'betmgm' 
    } = options;

    try {
      logger.info(`Fetching match ${matchId} with markets and results`);
      
      // Try to find match in all sports
      const sports = await this.fetchSports();
      
      for (const sport of sports) {
        try {
          let marketsList = [];
          if (markets === 'all') {
            const apiM = await this.fetchMarketsForSport(sport);
            const intersection = (apiM || []).filter(m => this.COMPREHENSIVE_MARKETS.includes(m));
            marketsList = (intersection.length > 0 ? intersection : apiM);
          } else {
            marketsList = (markets || '').split(',').filter(Boolean);
          }

          let foundMatch = null;
          let mergedForMatch = [];
          for (const mkt of marketsList) {
            try {
              const oddsData = await this.fetchOddsWithFallback(sport, regions, mkt, primaryBookmaker, fallbackBookmaker);
              const match = oddsData.find(event => event.id === matchId);
              if (match) {
                mergedForMatch = this.mergeEventsAcrossCalls(mergedForMatch, [match], primaryBookmaker, fallbackBookmaker);
                foundMatch = mergedForMatch[0];
              }
            } catch (err) {
              console.warn(`Fetch failed for ${sport}/${mkt}: ${err.message}`);
            }
          }
          const match = foundMatch;
          
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