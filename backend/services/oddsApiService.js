const config = require('../config/config');
// Logger removed during cleanup - using console for now
const axios = require('axios');
const winston = require('winston');

const Match = require('../models/Match');
const Odds = require('../models/Odds');

const winstonLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

/**
 * @class OddsApiService
 * @description Service for interacting with the-odds-api.com to fetch sports data and odds.
 */
class OddsApiService {
  /**
   * @property {object} client - Axios instance configured for the Odds API.
   */
  constructor() {
    console.log(`Odds API Base URL: ${config.oddsApi.baseUrl}`);
    if (!config.oddsApi.apiKey) {
      console.warn('ODDS_API_KEY is not defined in environment variables. Odds fetching will be disabled.');
      this.isEnabled = false;
      return;
    }
    if (!config.oddsApi.baseUrl) {
      console.warn('ODDS_API_BASE_URL is not defined in environment variables. Odds fetching will be disabled.');
      this.isEnabled = false;
      return;
    }
    
    this.isEnabled = true;

    this.client = axios.create({
      baseURL: config.oddsApi.baseUrl,
      timeout: parseInt(process.env.ODDS_API_TIMEOUT, 10) || 10000, // Default to 10 seconds if not set
      params: {
        api_key: config.oddsApi.apiKey,
        regions: 'us,us2,uk,eu,au', // All available regions
        // markets: 'h2h,spreads,totals,outrights', // All available markets - now dynamically fetched
        oddsFormat: 'decimal', // decimal | american
        dateFormat: 'iso', // iso | unix
      }
    });
  }

  /**
   * @method getSports
   * @description Fetches a list of available sports from the Odds API.
   * @returns {Promise<Array<Object>>} A promise that resolves to an array of sport objects.
 */
  async getSports() {
    if (!this.isEnabled) {
      console.warn('OddsApiService is disabled due to missing configuration');
      return [];
    }
    
    try {
       const response = await this.client.get('/sports', {
        params: {
          all: true, // Include all sports, including those with outrights
        },
      });
      return response.data;
    } catch (error) {
      this.handleApiError(error);
      return null;
    }
  }

  /**
   * @method getMarketsForSport
   * @description Fetches available markets for a specific sport from the Odds API.
   * @param {string} sportKey - The key of the sport to fetch markets for.
   * @returns {Promise<Array<Object>>} A promise that resolves to an array of market objects.
   */


  /**
   * @method getMarketsForSport
   * @description Fetches available markets for a specific sport from the Odds API.
   * @param {string} sportKey - The key of the sport to fetch markets for.
   * @returns {Promise<Array<Object>>} A promise that resolves to an array of market objects.
   */
  async getMarketsForSport(sportKey) {
    if (!this.isEnabled) {
      console.warn('OddsApiService is disabled due to missing configuration');
      return [];
    }
    
    try {
      const response = await this.client.get(`/sports/${sportKey}/markets`);
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.warn(`No markets found for sport ${sportKey}.`, { sportKey });
        return [];
      } else {
        this.handleApiError(error);
        return [];
      }
    }
  }

  /**
   * @method getUpcomingMatches
   * @description Fetches upcoming match odds for a specific sport.
   * Implements a basic rate-limiting delay if the remaining requests are low.
   * @param {string} sportKey - The key of the sport to fetch matches for (e.g., 'soccer_epl').
   * @returns {Promise<Array<Object>>} A promise that resolves to an array of transformed match objects.
   * @throws {Error} If there is an error fetching match data.
   */
  /**
   * @method getUpcomingOdds
   * @description Fetches upcoming match odds for a specific sport.
   * Implements a basic rate-limiting delay if the remaining requests are low.
   * @param {string} sportKey - The key of the sport to fetch matches for (e.g., 'soccer_epl').
   * @param {string} [market] - Optional market to fetch odds for (e.g., 'h2h').
   * @param {number} [retryCount=0] - Internal counter for retry attempts.
   * @returns {Promise<Array<Object>>} A promise that resolves to an array of transformed match objects.
   * @throws {Error} If there is an error fetching match data.
   */
  async getUpcomingOdds(sportKey, market = null, retryCount = 0) {
    if (!this.isEnabled) {
      console.warn('OddsApiService is disabled due to missing configuration');
      return [];
    }
    
    if (!sportKey || typeof sportKey !== 'string') {
      throw new Error('Invalid sportKey provided. sportKey must be a non-empty string.');
    }

    // If a specific market is provided, fetch as before
    if (market) {
      return this._fetchAndSaveOddsForMarket(sportKey, market);
    }

    // Otherwise, fetch all supported markets individually and merge
    // Comprehensive market list requested
    const COMPREHENSIVE_MARKETS = [
      // Core
      'h2h','spreads','totals','outrights','h2h_lay','outrights_lay',
      'alternate_spreads','alternate_totals','btts','draw_no_bet','h2h_3_way',
      'team_totals','alternate_team_totals',
      // Quarters / Halves / Periods
      'h2h_q1','h2h_q2','h2h_q3','h2h_q4','h2h_h1','h2h_h2','h2h_p1','h2h_p2','h2h_p3',
      'h2h_3_way_q1','h2h_3_way_q2','h2h_3_way_q3','h2h_3_way_q4','h2h_3_way_h1','h2h_3_way_h2','h2h_3_way_p1','h2h_3_way_p2','h2h_3_way_p3',
      // Baseball innings
      'h2h_1st_1_innings','h2h_1st_3_innings','h2h_1st_5_innings','h2h_1st_7_innings',
      'h2h_3_way_1st_1_innings','h2h_3_way_1st_3_innings','h2h_3_way_1st_5_innings','h2h_3_way_1st_7_innings',
      // Spreads
      'spreads_q1','spreads_q2','spreads_q3','spreads_q4','spreads_h1','spreads_h2','spreads_p1','spreads_p2','spreads_p3',
      'spreads_1st_1_innings','spreads_1st_3_innings','spreads_1st_5_innings','spreads_1st_7_innings',
      // Alternate spreads
      'alternate_spreads_1st_1_innings','alternate_spreads_1st_3_innings','alternate_spreads_1st_5_innings','alternate_spreads_1st_7_innings',
      'alternate_spreads_q1','alternate_spreads_q2','alternate_spreads_q3','alternate_spreads_q4','alternate_spreads_h1','alternate_spreads_h2','alternate_spreads_p1','alternate_spreads_p2','alternate_spreads_p3',
      // Totals
      'totals_q1','totals_q2','totals_q3','totals_q4','totals_h1','totals_h2','totals_p1','totals_p2','totals_p3',
      'totals_1st_1_innings','totals_1st_3_innings','totals_1st_5_innings','totals_1st_7_innings',
      // Alternate totals
      'alternate_totals_1st_1_innings','alternate_totals_1st_3_innings','alternate_totals_1st_5_innings','alternate_totals_1st_7_innings',
      'alternate_totals_q1','alternate_totals_q2','alternate_totals_q3','alternate_totals_q4','alternate_totals_h1','alternate_totals_h2','alternate_totals_p1','alternate_totals_p2','alternate_totals_p3',
      // Team totals
      'team_totals_h1','team_totals_h2','team_totals_q1','team_totals_q2','team_totals_q3','team_totals_q4','team_totals_p1','team_totals_p2','team_totals_p3',
      // Alternate team totals
      'alternate_team_totals_h1','alternate_team_totals_h2','alternate_team_totals_q1','alternate_team_totals_q2','alternate_team_totals_q3','alternate_team_totals_q4','alternate_team_totals_p1','alternate_team_totals_p2','alternate_team_totals_p3',
      // Player props (NFL-style examples provided)
      'player_assists','player_defensive_interceptions','player_field_goals','player_kicking_points','player_pass_attempts','player_pass_completions',
      'player_pass_interceptions','player_pass_longest_completion','player_pass_rush_yds','player_pass_rush_reception_tds','player_pass_rush_reception_yds',
      'player_pass_tds','player_pass_yds','player_pass_yds_q1','player_pats','player_receptions'
      ,
      // Additional player props and alternates (as requested)
      'player_reception_longest_alternate','player_reception_tds_alternate','player_reception_yds_alternate',
      'player_rush_attempts_alternate','player_rush_longest_alternate','player_rush_reception_tds_alternate','player_rush_reception_yds_alternate',
      'player_rush_tds_alternate','player_rush_yds_alternate','player_sacks_alternate','player_solo_tackles_alternate','player_tackles_assists_alternate',
      'player_points','player_points_q1','player_rebounds','player_rebounds_q1','player_assists','player_assists_q1','player_threes','player_blocks','player_steals','player_blocks_steals',
      'player_turnovers','player_points_rebounds_assists','player_points_rebounds','player_points_assists','player_rebounds_assists','player_field_goals',
      'player_frees_made','player_frees_attempts','player_first_basket','player_first_team_basket','player_double_double','player_triple_double','player_method_of_first_basket',
      'player_points_alternate','player_rebounds_alternate','player_assists_alternate','player_blocks_alternate','player_steals_alternate','player_turnovers_alternate','player_threes_alternate',
      'player_points_assists_alternate','player_points_rebounds_alternate','player_rebounds_assists_alternate','player_points_rebounds_assists_alternate',
      // Baseball batter/pitcher props
      'batter_home_runs','batter_first_home_run','batter_hits','batter_total_bases','batter_rbis','batter_runs_scored','batter_hits_runs_rbis','batter_singles','batter_doubles','batter_triples',
      'batter_walks','batter_strikeouts','batter_stolen_bases','pitcher_strikeouts','pitcher_record_a_win','pitcher_hits_allowed','pitcher_walks','pitcher_earned_runs','pitcher_outs',
      'batter_total_bases_alternate','batter_home_runs_alternate','batter_hits_alternate','batter_rbis_alternate','batter_walks_alternate','batter_strikeouts_alternate','batter_runs_scored_alternate',
      'batter_singles_alternate','batter_doubles_alternate','batter_triples_alternate','pitcher_hits_allowed_alternate','pitcher_walks_alternate','pitcher_strikeouts_alternate',
      // Hockey props
      'player_power_play_points','player_blocked_shots','player_shots_on_goal','player_goals','player_total_saves','player_goal_scorer_first','player_goal_scorer_last','player_goal_scorer_anytime',
      'player_power_play_points_alternate','player_goals_alternate','player_shots_on_goal_alternate','player_blocked_shots_alternate','player_total_saves_alternate',
      // AFL/others
      'player_disposals','player_disposals_over','player_goals_scored_over','player_marks_over','player_marks_most','player_tackles_over','player_tackles_most',
      'player_afl_fantasy_points','player_afl_fantasy_points_over','player_afl_fantasy_points_most',
      // Rugby try scorers
      'player_try_scorer_first','player_try_scorer_last','player_try_scorer_anytime','player_try_scorer_over',
      // Soccer cards/corners and misc
      'player_to_receive_card','player_to_receive_red_card','player_shots_on_target','player_shots','player_assists',
      'alternate_spreads_corners','alternate_totals_corners','alternate_spreads_cards','alternate_totals_cards',
      // Other
      'double_chance'
    ];

    let supportedMarkets = [];
    try {
      const availableMarkets = await this.getMarketsForSport(sportKey);
      // Prefer only API-supported markets to avoid 422 from unsupported keys
      const apiMarkets = availableMarkets.map(mkt => mkt.key || mkt);
      supportedMarkets = apiMarkets.length > 0 ? apiMarkets : COMPREHENSIVE_MARKETS;
    } catch (err) {
      console.error(`Failed to fetch supported markets for ${sportKey}: ${err.message}`);
      supportedMarkets = COMPREHENSIVE_MARKETS; // fallback to comprehensive list
    }
    if (supportedMarkets.length === 0) supportedMarkets = COMPREHENSIVE_MARKETS;

    // Fetch odds for each market separately
    const allOddsById = {};
    // Normalization helper to collapse lay/exchange variants and unify aliases
    const normalizeMarketKey = (key) => {
      const k = (key || '').toLowerCase();
      // Remove generic lay suffixes
      const noLay = k.replace(/_?lay$/i, '');
      // Map common aliases to canonical keys
      if (noLay === 'h2h' || noLay === 'moneyline') return 'h2h';
      if (noLay === 'spreads' || noLay === 'handicap' || noLay === 'asian_handicap' || noLay === 'point_spread') return 'spreads';
      if (noLay === 'totals' || noLay === 'over_under' || noLay === 'points_total') return 'totals';
      if (noLay === 'btts' || noLay === 'both_teams_to_score') return 'both_teams_to_score';
      if (noLay === 'draw_no_bet') return 'draw_no_bet';
      if (noLay === 'outrights' || noLay === 'outright') return 'outrights';
      if (noLay === 'team_totals') return 'team_totals';
      if (noLay === 'alternate_team_totals') return 'alternate_team_totals';
      if (noLay === 'alternate_totals') return 'alternate_totals';
      if (noLay === 'alternate_spreads') return 'alternate_spreads';
      if (noLay === 'h2h_3_way') return 'h2h_3_way';
      if (noLay === 'double_chance') return 'double_chance';
      // Leave period/quarter variants as-is after lay removal
      return noLay;
    };

    for (const marketKey of supportedMarkets) {
      try {
        const oddsForMarket = await this._fetchAndSaveOddsForMarket(sportKey, marketKey);
        for (const match of oddsForMarket) {
          if (!allOddsById[match.gameId]) {
            allOddsById[match.gameId] = match;
          } else {
            // Merge markets for the same match (by bookmaker)
            for (const bm of match.bookmakers) {
              const existingBm = allOddsById[match.gameId].bookmakers.find(b => b.key === bm.key);
              if (existingBm) {
                // Merge markets by key
                for (const mkt of bm.markets) {
                  const normKey = normalizeMarketKey(mkt.key);
                  const hasMarket = existingBm.markets.some(m => normalizeMarketKey(m.key) === normKey);
                  if (!hasMarket) {
                    existingBm.markets.push({ ...mkt, key: normKey });
                  }
                }
              } else {
                allOddsById[match.gameId].bookmakers.push(bm);
              }
            }
          }
        }
      } catch (err) {
        console.warn(`Failed to fetch odds for market ${marketKey} in ${sportKey}: ${err.message}`);
      }
    }
    // Return merged matches as an array
    return Object.values(allOddsById);
  }

  // Helper to fetch odds for a single market and save to DB
  async _fetchAndSaveOddsForMarket(sportKey, market) {
    if (!this.isEnabled) {
      console.warn('OddsApiService is disabled due to missing configuration');
      return [];
    }
    // Skip if market not applicable to this sport
    try {
      const apiMarkets = await this.getMarketsForSport(sportKey);
      const apiMarketKeys = (apiMarkets || []).map(m => m.key || m);
      if (Array.isArray(apiMarketKeys) && apiMarketKeys.length > 0) {
        if (!apiMarketKeys.includes(market)) {
          console.warn(`Skipping market ${market} for sport ${sportKey} (not supported)`);
          return [];
        }
      }
    } catch (err) {
      // If we cannot determine applicability, continue with cautious fallback
    }
    // Try bookmakers sequentially; only proceed to next if no data from the first
    const BOOKMAKER_ORDER = [
      'fanduel','draftkings','betmgm','caesars','pointsbetus','unibet_us',
      'ballybet','betrivers','superbook','foxbet','williamhill_us','twinspires',
      'betonlineag','lowvig','mybookieag'
    ];
    let games = [];
    for (const bm of BOOKMAKER_ORDER) {
      try {
        const response = await this.client.get(`/sports/${sportKey}/odds`, {
          params: { markets: market, bookmakers: bm },
        });
        games = response.data || [];
        if (Array.isArray(games) && games.length > 0) {
          break;
        }
      } catch (err) {
        // Continue to next bookmaker on error
        continue;
      }
    }
    if (!Array.isArray(games)) games = [];
    // Merge-save to DB: update or insert while preserving other markets
    // Helper to normalize market keys consistently
    const normalizeMarketKey = (key) => {
      const k = (key || '').toLowerCase();
      const noLay = k.replace(/_?lay$/i, '').replace(/\blay\b/gi, '').replace(/\s+/g, ' ').trim().replace(/\s/g, '_');
      if (noLay === 'h2h' || noLay === 'moneyline') return 'h2h';
      if (noLay === 'spreads' || noLay === 'handicap' || noLay === 'asian_handicap' || noLay === 'point_spread') return 'spreads';
      if (noLay === 'totals' || noLay === 'over_under' || noLay === 'points_total') return 'totals';
      if (noLay === 'btts' || noLay === 'both_teams_to_score') return 'both_teams_to_score';
      if (noLay === 'draw_no_bet') return 'draw_no_bet';
      if (noLay === 'outrights' || noLay === 'outright') return 'outrights';
      if (noLay === 'team_totals') return 'team_totals';
      if (noLay === 'alternate_team_totals') return 'alternate_team_totals';
      if (noLay === 'alternate_totals') return 'alternate_totals';
      if (noLay === 'alternate_spreads') return 'alternate_spreads';
      if (noLay === 'h2h_3_way') return 'h2h_3_way';
      return noLay;
    };

    // Preload existing odds for these games to merge efficiently
    const gameIds = games.map(g => g.id);
    const existingDocs = await require('../models/Odds').find({ gameId: { $in: gameIds } });
    const existingMap = new Map(existingDocs.map(doc => [doc.gameId, doc]));

    const bulkOps = games.map(game => {
      const existing = existingMap.get(game.id);

      // Build incoming bookmakers with normalized market keys
      const incomingBookmakers = (game.bookmakers || []).map(bm => ({
        key: bm.key,
        title: bm.title,
        last_update: new Date(bm.last_update),
        markets: (bm.markets || []).map(mkt => ({
          key: normalizeMarketKey(mkt.key),
          last_update: new Date(mkt.last_update),
          outcomes: (mkt.outcomes || []).map(outcome => ({
            name: outcome.name,
            price: outcome.price,
            point: outcome.point
          }))
        }))
      }));

      let mergedBookmakers = incomingBookmakers;

      if (existing && Array.isArray(existing.bookmakers)) {
        // Merge with existing bookmakers/markets
        const existingBmMap = new Map(existing.bookmakers.map(b => [b.key, b]));

        mergedBookmakers = incomingBookmakers.map(inBm => {
          const exBm = existingBmMap.get(inBm.key);
          if (!exBm) return inBm;

          const exMarkets = Array.isArray(exBm.markets) ? exBm.markets : [];
          const exMarketMap = new Map(exMarkets.map(m => [normalizeMarketKey(m.key), m]));

          const mergedMarkets = inBm.markets.map(inMkt => {
            const normKey = normalizeMarketKey(inMkt.key);
            const exMkt = exMarketMap.get(normKey);
            if (!exMkt) return inMkt;
            // Prefer incoming market (fresh last_update), but ensure outcomes exist
            return {
              ...inMkt,
              key: normKey,
              outcomes: (inMkt.outcomes && inMkt.outcomes.length > 0) ? inMkt.outcomes : (exMkt.outcomes || [])
            };
          });

          // Add any existing markets not present in incoming set
          for (const [normKey, exMkt] of exMarketMap.entries()) {
            const hasIncoming = mergedMarkets.some(m => normalizeMarketKey(m.key) === normKey);
            if (!hasIncoming) mergedMarkets.push({ ...exMkt, key: normKey });
          }

          return {
            key: inBm.key,
            title: inBm.title,
            last_update: inBm.last_update,
            markets: mergedMarkets
          };
        });

        // Include any existing bookmakers not present in incoming
        for (const [bmKey, exBm] of existingBmMap.entries()) {
          const hasIncoming = mergedBookmakers.some(b => b.key === bmKey);
          if (!hasIncoming) mergedBookmakers.push(exBm);
        }
      }

      return {
        updateOne: {
          filter: { gameId: game.id },
          update: {
            $set: {
              sport_key: game.sport_key,
              sport_title: game.sport_title,
              commence_time: new Date(game.commence_time),
              home_team: game.home_team,
              away_team: game.away_team,
              bookmakers: mergedBookmakers,
              lastFetched: new Date()
            }
          },
          upsert: true
        }
      };
    });
    if (bulkOps.length > 0) {
      try {
        // Process in smaller batches to prevent overwhelming the database
        const batchSize = 50;
        for (let i = 0; i < bulkOps.length; i += batchSize) {
          const batch = bulkOps.slice(i, i + batchSize);
          await Odds.bulkWrite(batch, { 
            ordered: false, 
            writeConcern: { w: 1, wtimeout: 30000 } // Reduced timeout and write concern
          });
          // Small delay between batches
          if (i + batchSize < bulkOps.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      } catch (bulkWriteError) {
        console.error(`MongoDB bulkWrite error for sport ${sportKey} (market ${market}): ${bulkWriteError.message}`);
      }
    }
    return games;
  }

  /**
   * @method handleApiError
   * @description Handles API errors, logs them, and throws a new error.
   * @param {Error} error - The error object caught from an API request.
   * @throws {Error} A new error with a descriptive message.
   */
  handleApiError(error) {
    if (error.response) {
      const { status, data } = error.response;
      let errorMessage = `API Error: ${status} - ${data.message || 'An unexpected error occurred.'}`;

      if (status === 401) {
        errorMessage = `API Error: ${status} - Authentication failed or usage quota has been reached. Please check your API key and usage plan.`;
      }

              console.error(errorMessage, { apiError: data });
      throw new Error(errorMessage);
    } else if (error.request) {
              console.error(`Request Setup Error: API request failed with no response: ${error.message}`, { apiError: error.request });
      throw new Error(`Request Setup Error: API request failed with no response: ${error.message}`);
    } else {
              console.error(`Request Setup Error: API request failed: ${error.message}`, { apiError: error.message });
      throw new Error(`Request Setup Error: API request failed: ${error.message}`);
    }
  }

  // Add this method to the class
  /**
   * @method getLastRateLimitInfo
   * @description Retrieves the last known rate limit information from response headers.
   * @returns {{remaining: number, used: number}} An object containing the remaining and used requests.
   */
  getLastRateLimitInfo() {
    return {
      remaining: parseInt(this.lastResponseHeaders?.['x-requests-remaining'], 10),
      used: parseInt(this.lastResponseHeaders?.['x-requests-used'], 10)
    };
  }
}

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const ODDS_API_BASE_URL = process.env.ODDS_API_BASE_URL || 'https://api.the-odds-api.com/v4';

// Helper function to fetch all sports
async function fetchSports() {
  const url = `${ODDS_API_BASE_URL}/sports?apiKey=${ODDS_API_KEY}`;
  const response = await axios.get(url);
  return response.data.map(sport => sport.key);
}

// Helper function to fetch main markets for a sport
async function fetchMainMarkets(sport, regions, markets, bookmakers) {
  const url = `${ODDS_API_BASE_URL}/sports/${sport}/odds?apiKey=${ODDS_API_KEY}&regions=${regions}&markets=${markets}&oddsFormat=decimal&bookmakers=${bookmakers}`;
  const response = await axios.get(url);
  return response.data;
}

// Helper function to fetch additional markets for an event
async function fetchEventMarkets(eventId, regions, markets, bookmakers) {
  const url = `${ODDS_API_BASE_URL}/events/${eventId}/odds?apiKey=${ODDS_API_KEY}&regions=${regions}&markets=${markets}&oddsFormat=decimal&bookmakers=${bookmakers}`;
  const response = await axios.get(url);
  return response.data;
}

/**
 * Merges bookmaker data for events, prioritizing primary, then fallback, then all others for each market.
 * @param {Array<Object>} eventData - Array of event objects (from Odds API)
 * @param {string} primaryBookmaker - Key of the primary bookmaker
 * @param {string} fallbackBookmaker - Key of the fallback bookmaker
 * @returns {Array<Object>} Array of events with merged markets
 */
function mergeBookmakerData(eventData, primaryBookmaker, fallbackBookmaker) {
  return eventData.map(event => {
    if (!event.bookmakers || event.bookmakers.length === 0) {
      return { ...event, bookmakers: [] };
    }
    // Build a map of all unique market keys across all bookmakers
    const allMarkets = new Set();
    event.bookmakers.forEach(bm => {
      if (bm.markets) bm.markets.forEach(m => allMarkets.add(m.key));
    });
    // Order bookmakers: primary, fallback, then all others
    const orderedBookmakers = [
      ...event.bookmakers.filter(b => b.key === primaryBookmaker),
      ...event.bookmakers.filter(b => b.key === fallbackBookmaker && b.key !== primaryBookmaker),
      ...event.bookmakers.filter(b => b.key !== primaryBookmaker && b.key !== fallbackBookmaker)
    ];
    // For each market, pick the first available from the ordered list
    const mergedMarkets = [];
    allMarkets.forEach(marketKey => {
      for (const bm of orderedBookmakers) {
        const mkt = bm.markets && bm.markets.find(m => m.key === marketKey && m.outcomes && m.outcomes.length > 0);
        if (mkt) {
          mergedMarkets.push({ key: mkt.key, outcomes: mkt.outcomes, last_update: mkt.last_update });
          break;
        }
      }
    });
    // Return a single bookmaker with merged markets for this event
    return {
      ...event,
      bookmakers: [{
        key: primaryBookmaker,
        title: primaryBookmaker,
        last_update: new Date(),
        markets: mergedMarkets
      }]
    };
  });
}

// Fetch supported markets for a specific sport
async function fetchMarketsForSport(sportKey) {
  const ODDS_API_KEY = process.env.ODDS_API_KEY;
  const ODDS_API_BASE_URL = process.env.ODDS_API_BASE_URL || 'https://api.the-odds-api.com/v4';
  const url = `${ODDS_API_BASE_URL}/sports/${sportKey}/markets?apiKey=${ODDS_API_KEY}`;
  const response = await axios.get(url);
  // The API returns an array of market objects; return their keys
  return response.data.map(m => m.key);
}

module.exports = {
  OddsApiService,
  fetchSports,
  fetchMainMarkets,
  fetchEventMarkets,
  mergeBookmakerData,
  fetchMarketsForSport
};

