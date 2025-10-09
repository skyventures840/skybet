const axios = require('axios');
const fs = require('fs');
const path = require('path');
// Logger removed during cleanup - using console for now

// Configuration
const ODDS_API_KEY = process.env.ODDS_API_KEY;
const ODDS_API_BASE_URL = 'https://api.the-odds-api.com/v4';
const REGIONS = ['us', 'us2', 'uk', 'eu', 'au'];
const MARKETS = [
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
const BOOKMAKERS = [
  'fanduel', 'draftkings', 'betmgm', 'caesars', 'pointsbetus',
  'unibet_us', 'ballybet', 'betrivers', 'superbook', 'foxbet',
  'williamhill_us', 'twinspires', 'betonlineag', 'lowvig', 'mybookieag'
];

class OddsFetcher {
  constructor() {
    this.client = axios.create({
      baseURL: ODDS_API_BASE_URL,
      timeout: 30000,
      params: {
        apiKey: ODDS_API_KEY,
        regions: REGIONS.join(','),
        oddsFormat: 'decimal',
        dateFormat: 'iso'
      }
    });
  }

  /**
   * Fetch all available sports
   */
  async getSports() {
    try {
      console.log('Fetching available sports...');
      const response = await this.client.get('/sports');
              console.log(`Found ${response.data.length} sports`);
      return response.data;
    } catch (error) {
      console.error('Error fetching sports:', error.message);
      throw error;
    }
  }

  /**
   * Fetch all markets for a specific sport
   */
  async getMarketsForSport(sportKey) {
    try {
      const response = await this.client.get(`/sports/${sportKey}/markets`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        console.warn(`No markets found for sport ${sportKey}`);
        return [];
      }
      console.error(`Error fetching markets for ${sportKey}:`, error.message);
      return [];
    }
  }

  /**
   * Fetch odds for a specific sport and market
   */
  async getOddsForMarket(sportKey, market, bookmakers = BOOKMAKERS) {
    try {
      const response = await this.client.get(`/sports/${sportKey}/odds`, {
        params: {
          markets: market,
          bookmakers: bookmakers.join(',')
        }
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching odds for ${sportKey}/${market}:`, error.message);
      return [];
    }
  }

  /**
   * Merge odds data ensuring each market has only one bookmaker
   */
  mergeOddsData(allMatches) {
    const mergedMatches = {};

    const normalizeMarketKey = (key) => {
      const k = (key || '').toLowerCase();
      const noLay = k.replace(/_?lay$/i, '');
      if (noLay === 'h2h' || noLay === 'moneyline') return 'h2h';
      if (noLay === 'spreads' || noLay === 'handicap' || noLay === 'asian_handicap' || noLay === 'point_spread') return 'spreads';
      if (noLay === 'totals' || noLay === 'over_under' || noLay === 'points_total') return 'totals';
      if (noLay === 'double_chance') return 'double_chance';
      if (noLay === 'draw_no_bet') return 'draw_no_bet';
      if (noLay === 'both_teams_to_score' || noLay === 'btts') return 'both_teams_to_score';
      return noLay;
    };

    for (const match of allMatches) {
      const matchId = match.id;
      
      if (!mergedMatches[matchId]) {
        mergedMatches[matchId] = {
          ...match,
          bookmakers: []
        };
      }

      // Merge bookmakers for this match
      for (const bookmaker of match.bookmakers) {
        const existingBookmaker = mergedMatches[matchId].bookmakers.find(b => b.key === bookmaker.key);
        
        if (existingBookmaker) {
          // Merge markets for existing bookmaker
          for (const market of bookmaker.markets) {
            const normKey = normalizeMarketKey(market.key);
            const existingMarket = existingBookmaker.markets.find(m => normalizeMarketKey(m.key) === normKey);
            
            if (!existingMarket) {
              // Add new market to existing bookmaker
              existingBookmaker.markets.push({ ...market, key: normKey });
            } else {
              // Update existing market with better odds (lower price = better odds)
              for (const outcome of market.outcomes) {
                const existingOutcome = existingMarket.outcomes.find(o => o.name === outcome.name);
                if (!existingOutcome || outcome.price < existingOutcome.price) {
                  if (existingOutcome) {
                    existingOutcome.price = outcome.price;
                    existingOutcome.point = outcome.point;
                  } else {
                    existingMarket.outcomes.push(outcome);
                  }
                }
              }
            }
          }
        } else {
          // Add new bookmaker
          // Normalize market keys for the new bookmaker as well
          const normalizedBookmaker = {
            ...bookmaker,
            markets: (bookmaker.markets || []).map(m => ({ ...m, key: normalizeMarketKey(m.key) }))
          };
          mergedMatches[matchId].bookmakers.push(normalizedBookmaker);
        }
      }
    }

    return Object.values(mergedMatches);
  }

  /**
   * Fetch all odds for a sport with fallback bookmakers
   */
  async fetchAllOddsForSport(sportKey) {
    console.log(`Fetching all odds for sport: ${sportKey}`);
    
    // Get available markets for this sport
    const availableMarkets = await this.getMarketsForSport(sportKey);
    // Use only API-supported markets when available to avoid 422s
    const marketsToFetch = availableMarkets.length > 0
      ? availableMarkets.map(m => m.key)
      : MARKETS;

    console.log(`Markets to fetch for ${sportKey}: ${marketsToFetch.join(', ')}`);

    const allMatches = [];

    // Try each bookmaker individually until we get data

    for (const market of marketsToFetch) {
      let marketData = [];
      
      // Try each bookmaker sequentially
      for (const bookmaker of BOOKMAKERS) {
        try {
          console.log(`Trying bookmaker ${bookmaker} for ${sportKey}/${market}`);
          marketData = await this.getOddsForMarket(sportKey, market, [bookmaker]);
          
          if (marketData.length > 0) {
            console.log(`Successfully fetched ${marketData.length} matches for ${sportKey}/${market} using ${bookmaker}`);
            break;
          }
        } catch (error) {
          console.warn(`Failed to fetch ${sportKey}/${market} with ${bookmaker}: ${error.message}`);
          continue;
        }
      }

      if (marketData.length > 0) {
        allMatches.push(...marketData);
      } else {
        console.warn(`No data found for ${sportKey}/${market} with any bookmaker group`);
      }

      // Rate limiting - wait between requests
      await this.sleep(1000);
    }

    // Merge all matches ensuring each market has only one bookmaker
    const mergedMatches = this.mergeOddsData(allMatches);
    
    console.log(`Merged ${mergedMatches.length} matches for ${sportKey}`);
    
    return mergedMatches;
  }

  /**
   * Save matches to JSON file
   */
  saveMatchesToFile(sportKey, matches) {
    const fileName = `${sportKey}_matches_${Date.now()}.json`;
    const filePath = path.join(__dirname, '..', fileName);
    
    const enrichedMatches = matches.map(match => ({
      ...match,
      sport_key: sportKey,
      fetched_at: new Date().toISOString()
    }));

    fs.writeFileSync(filePath, JSON.stringify(enrichedMatches, null, 2));
    console.log(`Saved ${enrichedMatches.length} matches for ${sportKey} to ${fileName}`);
    
    return filePath;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = OddsFetcher;