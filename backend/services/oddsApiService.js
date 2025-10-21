const config = require('../config/config');
const axios = require('axios');
const winston = require('winston');
const NodeCache = require('node-cache');

const Match = require('../models/Match');
const Odds = require('../models/Odds');
const Results = require('../models/Results');
const Scores = require('../models/Scores');

// Initialize separate cache instances for different data types
const oddsCache = new NodeCache({ stdTTL: 300, checkperiod: 60 }); // 5 minutes TTL
const scoresCache = new NodeCache({ stdTTL: 60, checkperiod: 30 }); // 1 minute TTL for live data
const sportsCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 }); // 1 hour TTL for sports list

const winstonLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

// Optimized bookmaker mapping - one primary bookmaker per sport for efficiency
const SPORT_BOOKMAKERS = {
    // Soccer
  'soccer_africa_cup_of_nations': 'pinnacle',
  'soccer_argentina_primera_division': 'pinnacle',
  'soccer_australia_aleague': 'pinnacle',
  'soccer_austria_bundesliga': 'pinnacle',
  'soccer_belgium_first_div': 'pinnacle',
  'soccer_brazil_campeonato': 'pinnacle',
  'soccer_brazil_serie_b': 'pinnacle',
  'soccer_chile_campeonato': 'pinnacle',
  'soccer_china_superleague': 'pinnacle',
  'soccer_denmark_superliga': 'pinnacle',
  'soccer_efl_champ': 'pinnacle',
  'soccer_england_efl_cup': 'pinnacle',
  'soccer_england_league1': 'pinnacle',
  'soccer_england_league2': 'pinnacle',
  'soccer_epl': 'pinnacle',
  'soccer_fa_cup': 'pinnacle',
  'soccer_fifa_world_cup': 'pinnacle',
  'soccer_fifa_world_cup_qualifiers_europe': 'pinnacle',
  'soccer_fifa_world_cup_qualifiers_south_america': 'pinnacle',
  'soccer_fifa_world_cup_womens': 'pinnacle',
  'soccer_fifa_world_cup_winner': 'pinnacle',
  'soccer_fifa_club_world_cup': 'pinnacle',
  'soccer_finland_veikkausliiga': 'pinnacle',
  'soccer_france_ligue_one': 'pinnacle',
  'soccer_france_ligue_two': 'pinnacle',
  'soccer_germany_bundesliga': 'pinnacle',
  'soccer_germany_bundesliga2': 'pinnacle',
  'soccer_germany_liga3': 'pinnacle',
  'soccer_greece_super_league': 'pinnacle',
  'soccer_italy_serie_a': 'pinnacle',
  'soccer_italy_serie_b': 'pinnacle',
  'soccer_japan_j_league': 'pinnacle',
  'soccer_korea_kleague1': 'pinnacle',
  'soccer_league_of_ireland': 'pinnacle',
  'soccer_mexico_ligamx': 'pinnacle',
  'soccer_netherlands_eredivisie': 'pinnacle',
  'soccer_norway_eliteserien': 'pinnacle',
  'soccer_poland_ekstraklasa': 'pinnacle',
  'soccer_portugal_primeira_liga': 'pinnacle',
  'soccer_spain_la_liga': 'pinnacle',
  'soccer_spain_segunda_division': 'pinnacle',
  'soccer_spl': 'pinnacle',
  'soccer_sweden_allsvenskan': 'pinnacle',
  'soccer_sweden_superettan': 'pinnacle',
  'soccer_switzerland_superleague': 'pinnacle',
  'soccer_turkey_super_league': 'pinnacle',
  'soccer_uefa_europa_conference_league': 'pinnacle',
  'soccer_uefa_champs_league': 'pinnacle',
  'soccer_uefa_champs_league_qualification': 'pinnacle',
  'soccer_uefa_champs_league_women': 'pinnacle',
  'soccer_uefa_europa_league': 'pinnacle',
  'soccer_uefa_european_championship': 'pinnacle',
  'soccer_uefa_euro_qualification': 'pinnacle',
  'soccer_uefa_nations_league': 'pinnacle',
  'soccer_concacaf_gold_cup': 'pinnacle',
  'soccer_concacaf_leagues_cup': 'pinnacle',
  'soccer_conmebol_copa_america': 'pinnacle',
  'soccer_conmebol_copa_libertadores': 'pinnacle',
  'soccer_conmebol_copa_sudamericana': 'pinnacle',
  'soccer_usa_mls': 'pinnacle',
  
  'americanfootball_cfl': 'draftkings',
  'americanfootball_ncaaf': 'draftkings',
  'americanfootball_ncaaf_championship_winner': 'draftkings',
  'americanfootball_nfl': 'draftkings',
  'americanfootball_nfl_preseason': 'draftkings',
  'americanfootball_nfl_super_bowl_winner': 'draftkings',
  'americanfootball_ufl': 'draftkings',

  // Aussie Rules
  'aussierules_afl': 'sportsbet',

  // Baseball
  'baseball_mlb': 'draftkings',
  'baseball_mlb_preseason': 'draftkings',
  'baseball_mlb_world_series_winner': 'draftkings',
  'baseball_milb': 'draftkings',
  'baseball_npb': 'draftkings',
  'baseball_kbo': 'draftkings',
  'baseball_ncaa': 'draftkings',

  // Basketball
  'basketball_euroleague': 'fanduel',
  'basketball_nba': 'fanduel',
  'basketball_nba_preseason': 'fanduel',
  'basketball_nba_summer_league': 'fanduel',
  'basketball_nba_championship_winner': 'fanduel',
  'basketball_wnba': 'fanduel',
  'basketball_ncaab': 'fanduel',
  'basketball_wncaab': 'fanduel',
  'basketball_ncaab_championship_winner': 'fanduel',
  'basketball_nbl': 'fanduel',

  // Boxing
  'boxing_boxing': 'bet365_au',

  // Cricket
  'cricket_asia_cup': 'sportsbet',
  'cricket_big_bash': 'sportsbet',
  'cricket_caribbean_premier_league': 'sportsbet',
  'cricket_icc_trophy': 'sportsbet',
  'cricket_icc_world_cup': 'sportsbet',
  'cricket_icc_world_cup_womens': 'sportsbet',
  'cricket_international_t20': 'sportsbet',
  'cricket_ipl': 'sportsbet',
  'cricket_odi': 'sportsbet',
  'cricket_psl': 'sportsbet',
  'cricket_t20_blast': 'sportsbet',
  'cricket_test_match': 'sportsbet',
  'cricket_the_hundred': 'sportsbet',

  // Golf
  'golf_masters_tournament_winner': 'bet365_au',
  'golf_pga_championship_winner': 'bet365_au',
  'golf_the_open_championship_winner': 'bet365_au',
  'golf_us_open_winner': 'bet365_au',

  // Ice Hockey
  'icehockey_nhl': 'draftkings',
  'icehockey_nhl_preseason': 'draftkings',
  'icehockey_ahl': 'draftkings',
  'icehockey_nhl_championship_winner': 'draftkings',
  'icehockey_liiga': 'draftkings',
  'icehockey_mestis': 'draftkings',
  'icehockey_sweden_hockey_league': 'draftkings',
  'icehockey_sweden_allsvenskan': 'draftkings',

  // Lacrosse
  'lacrosse_pll': 'draftkings',
  'lacrosse_ncaa': 'draftkings',

  // Mixed Martial Arts
  'mma_mixed_martial_arts': 'bet365_au',

    // Rugby League
  'rugbyleague_nrl': 'sportsbet',
  'rugbyleague_nrl_state_of_origin': 'sportsbet',

  // Rugby Union
  'rugbyunion_six_nations': 'williamhill',

  // Tennis
  'tennis_atp_aus_open_singles': 'bet365_au',
  'tennis_atp_canadian_open': 'bet365_au',
  'tennis_atp_china_open': 'bet365_au',
  'tennis_atp_cincinnati_open': 'bet365_au',
  'tennis_atp_dubai': 'bet365_au',
  'tennis_atp_french_open': 'bet365_au',
  'tennis_atp_indian_wells': 'bet365_au',
  'tennis_atp_italian_open': 'bet365_au',
  'tennis_atp_madrid_open': 'bet365_au',
  'tennis_atp_miami_open': 'bet365_au',
  'tennis_atp_monte_carlo_masters': 'bet365_au',
  'tennis_atp_paris_masters': 'bet365_au',
  'tennis_atp_qatar_open': 'bet365_au',
  'tennis_atp_shanghai_masters': 'bet365_au',
  'tennis_atp_us_open': 'bet365_au',
  'tennis_atp_wimbledon': 'bet365_au',
  'tennis_wta_aus_open_singles': 'bet365_au',
  'tennis_wta_canadian_open': 'bet365_au',
  'tennis_wta_china_open': 'bet365_au',
  'tennis_wta_cincinnati_open': 'bet365_au',
  'tennis_wta_dubai': 'bet365_au',
  'tennis_wta_french_open': 'bet365_au',
  'tennis_wta_indian_wells': 'bet365_au',
  'tennis_wta_italian_open': 'bet365_au',
  'tennis_wta_madrid_open': 'bet365_au',
  'tennis_wta_miami_open': 'bet365_au',
  'tennis_wta_qatar_open': 'bet365_au',
  'tennis_wta_us_open': 'bet365_au',
  'tennis_wta_wimbledon': 'bet365_au',
  'tennis_wta_wuhan_open': 'bet365_au'
};

/**
 * @class OddsApiService
 * @description Enhanced service for interacting with the-odds-api.com with optimized caching and efficiency.
 */
class OddsApiService {
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
      timeout: parseInt(process.env.ODDS_API_TIMEOUT, 10) || 15000,
      params: {
        apiKey: config.oddsApi.apiKey,
        regions: process.env.ODDS_API_REGIONS || 'us,us2,uk,au,eu',
        oddsFormat: 'decimal',
        dateFormat: 'iso',
      }
    });

    // Request interceptor for rate limiting
    this.client.interceptors.request.use(async (config) => {
      // Add small delay between requests to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
      return config;
    });

    // Response interceptor for caching and error handling
    this.client.interceptors.response.use(
      (response) => {
        this.lastResponseHeaders = response.headers;
        return response;
      },
      (error) => {
        if (error.response?.status === 429) {
          console.warn('Rate limit exceeded, implementing backoff');
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Enhanced method to get sports with caching
   */
  async getSports() {
    if (!this.isEnabled) {
      console.warn('OddsApiService is disabled due to missing configuration');
      return [];
    }

    const cacheKey = 'all_sports';
    const cached = sportsCache.get(cacheKey);
    if (cached) {
      console.log('Returning cached sports data');
      return cached;
    }
    
    try {
      const response = await this.client.get('/sports', {
        params: { all: true }
      });
      this.lastResponseHeaders = response.headers;
      
      const sports = response.data;
      sportsCache.set(cacheKey, sports);
      return sports;
    } catch (error) {
      this.handleApiError(error);
      
      // If it's a 500 error, use fallback data
      if (error.response && error.response.status === 500) {
        winstonLogger.warn('Using fallback sports data due to API 500 error');
        const fs = require('fs');
        const path = require('path');
        try {
          const fallbackPath = path.join(__dirname, '..', 'data', 'fallbackSports.json');
          const fallbackData = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
          return fallbackData;
        } catch (fallbackError) {
          winstonLogger.error('Failed to load fallback sports data:', fallbackError);
          throw error; // Re-throw original error if fallback fails
        }
      }
      
      throw error; // Re-throw the error for other status codes
    }
  }

  /**
   * Enhanced method to get markets for sport with caching
   */
  async getMarketsForSport(sportKey) {
    if (!this.isEnabled) {
      console.warn('OddsApiService is disabled due to missing configuration');
      return [];
    }

    const cacheKey = `markets_${sportKey}`;
    const cached = sportsCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    try {
      const response = await this.client.get(`/sports/${sportKey}/markets`);
      this.lastResponseHeaders = response.headers;
      
      const markets = response.data;
      sportsCache.set(cacheKey, markets);
      return markets;
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
   * Enhanced method to get upcoming odds with optimized caching and single bookmaker per sport
   */
  async getUpcomingOdds(sportKey, market = null, retryCount = 0) {
    if (!this.isEnabled) {
      console.warn('OddsApiService is disabled due to missing configuration');
      return [];
    }
    
    if (!sportKey || typeof sportKey !== 'string') {
      throw new Error('Invalid sportKey provided. sportKey must be a non-empty string.');
    }

    // Use optimized bookmaker for this sport
    const primaryBookmaker = SPORT_BOOKMAKERS[sportKey] || 'draftkings';
    
    // Check cache first
    const cacheKey = `odds_${sportKey}_${market || 'all'}_${primaryBookmaker}`;
    const cached = oddsCache.get(cacheKey);
    if (cached) {
      console.log(`Returning cached odds for ${sportKey}`);
      return cached;
    }

    // If a specific market is provided, fetch it
    if (market) {
      return this._fetchAndSaveOddsForMarket(sportKey, market, primaryBookmaker);
    }

    // Fetch comprehensive markets with optimized approach
    const PRIORITY_MARKETS = [
      'h2h',
      'spreads', 
      'totals',
      'outrights',
      'h2h_lay',
      'outrights_lay',
      'alternate_spreads',
      'alternate_totals',
      'btts',
      'draw_no_bet',
      'h2h_3_way',
      'team_totals',
      'alternate_team_totals',
      'h2h_q1',
      'h2h_q2',
      'h2h_q3',
      'h2h_q4',
      'h2h_h1',
      'h2h_h2',
      'h2h_p1',
      'h2h_p2',
      'h2h_p3',
      'h2h_3_way_q1',
      'h2h_3_way_q2',
      'h2h_3_way_q3',
      'h2h_3_way_q4',
      'h2h_3_way_h1',
      'h2h_3_way_h2',
      'h2h_3_way_p1',
      'h2h_3_way_p2',
      'h2h_3_way_p3',
      'h2h_1st_1_innings',
      'h2h_1st_3_innings',
      'h2h_1st_5_innings',
      'h2h_1st_7_innings',
      'h2h_3_way_1st_1_innings',
      'h2h_3_way_1st_3_innings',
      'h2h_3_way_1st_5_innings',
      'h2h_3_way_1st_7_innings',
      'spreads_q1',
      'spreads_q2',
      'spreads_q3',
      'spreads_q4',
      'spreads_h1',
      'spreads_h2',
      'spreads_p1',
      'spreads_p2',
      'spreads_p3',
      'spreads_1st_1_innings',
      'spreads_1st_3_innings',
      'spreads_1st_5_innings',
      'spreads_1st_7_innings',
      'alternate_spreads_1st_1_innings',
      'alternate_spreads_1st_3_innings',
      'alternate_spreads_1st_5_innings',
      'alternate_spreads_1st_7_innings',
      'alternate_spreads_q1',
      'alternate_spreads_q2',
      'alternate_spreads_q3',
      'alternate_spreads_q4',
      'alternate_spreads_h1',
      'alternate_spreads_h2',
      'alternate_spreads_p1',
      'alternate_spreads_p2',
      'alternate_spreads_p3',
      'totals_q1',
      'totals_q2',
      'totals_q3',
      'totals_q4',
      'totals_h1',
      'totals_h2',
      'totals_p1',
      'totals_p2',
      'totals_p3',
      'totals_1st_1_innings',
      'totals_1st_3_innings',
      'totals_1st_5_innings',
      'totals_1st_7_innings',
      'alternate_totals_1st_1_innings',
      'alternate_totals_1st_3_innings',
      'alternate_totals_1st_5_innings',
      'alternate_totals_1st_7_innings',
      'alternate_totals_q1',
      'alternate_totals_q2',
      'alternate_totals_q3',
      'alternate_totals_q4',
      'alternate_totals_h1',
      'alternate_totals_h2',
      'alternate_totals_p1',
      'alternate_totals_p2',
      'alternate_totals_p3',
      'team_totals_h1',
      'team_totals_h2',
      'team_totals_q1',
      'team_totals_q2',
      'team_totals_q3',
      'team_totals_q4',
      'team_totals_p1',
      'team_totals_p2',
      'team_totals_p3',
      'alternate_team_totals_h1',
      'alternate_team_totals_h2',
      'alternate_team_totals_q1',
      'alternate_team_totals_q2',
      'alternate_team_totals_q3',
      'alternate_team_totals_q4',
      'alternate_team_totals_p1',
      'alternate_team_totals_p2',
      'alternate_team_totals_p3',
      'player_assists',
      'player_defensive_interceptions',
      'player_field_goals',
      'player_kicking_points',
      'player_pass_attempts',
      'player_pass_completions',
      'player_pass_interceptions',
      'player_pass_longest_completion',
      'player_pass_rush_yds',
      'player_pass_rush_reception_tds',
      'player_pass_rush_reception_yds',
      'player_pass_tds',
      'player_pass_yds',
      'player_pass_yds_q1',
      'player_pats',
      'player_receptions',
      'player_reception_longest',
      'player_reception_tds',
      'player_reception_yds',
      'player_rush_attempts',
      'player_rush_longest',
      'player_rush_reception_tds',
      'player_rush_reception_yds',
      'player_rush_tds',
      'player_rush_yds',
      'player_sacks',
      'player_solo_tackles',
      'player_tackles_assists',
      'player_tds_over',
      'player_1st_td',
      'player_anytime_td',
      'player_last_td',
      'player_assists_alternate',
      'player_field_goals_alternate',
      'player_kicking_points_alternate',
      'player_pass_attempts_alternate',
      'player_pass_completions_alternate',
      'player_pass_interceptions_alternate',
      'player_pass_longest_completion_alternate',
      'player_pass_rush_yds_alternate',
      'player_pass_rush_reception_tds_alternate',
      'player_pass_rush_reception_yds_alternate',
      'player_pass_tds_alternate',
      'player_pass_yds_alternate',
      'player_pats_alternate'
    ];

    let supportedMarkets = [];
    try {
      const availableMarkets = await this.getMarketsForSport(sportKey);
      const apiMarkets = availableMarkets.map(mkt => mkt.key || mkt);
      supportedMarkets = apiMarkets.length > 0 ? 
        PRIORITY_MARKETS.filter(m => apiMarkets.includes(m)) : 
        PRIORITY_MARKETS;
    } catch (err) {
      console.error(`Failed to fetch supported markets for ${sportKey}: ${err.message}`);
      supportedMarkets = PRIORITY_MARKETS;
    }

    if (supportedMarkets.length === 0) supportedMarkets = PRIORITY_MARKETS;

    // Fetch odds with single bookmaker for efficiency
    const allOddsById = {};
    const chunkSize = 5; // Smaller chunks for better performance

    for (let i = 0; i < supportedMarkets.length; i += chunkSize) {
      const marketsChunk = supportedMarkets.slice(i, i + chunkSize);
      try {
        const oddsForChunk = await this._fetchAndSaveOddsForMarketsBatch(
          sportKey, 
          marketsChunk, 
          primaryBookmaker
        );
        
        for (const match of oddsForChunk) {
          if (!allOddsById[match.gameId]) {
            allOddsById[match.gameId] = match;
          } else {
            // Merge markets for the same match
            this._mergeMatchMarkets(allOddsById[match.gameId], match);
          }
        }
      } catch (err) {
        console.warn(`Failed to fetch odds for markets chunk in ${sportKey}: ${err.message}`);
      }
      
      // Rate limiting delay
      if (i + chunkSize < supportedMarkets.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    const result = Object.values(allOddsById);
    
    // Cache the result
    oddsCache.set(cacheKey, result);
    
    return result;
  }

  /**
   * Helper method to merge markets from different API calls
   */
  _mergeMatchMarkets(existingMatch, newMatch) {
    for (const newBm of newMatch.bookmakers) {
      const existingBm = existingMatch.bookmakers.find(b => b.key === newBm.key);
      if (existingBm) {
        // Merge markets
        for (const newMarket of newBm.markets) {
          const existingMarket = existingBm.markets.find(m => m.key === newMarket.key);
          if (!existingMarket) {
            existingBm.markets.push(newMarket);
          }
        }
      } else {
        existingMatch.bookmakers.push(newBm);
      }
    }
  }

  /**
   * Enhanced batch fetching with single bookmaker optimization
   */
  async _fetchAndSaveOddsForMarketsBatch(sportKey, marketsArray, bookmaker = null) {
    if (!this.isEnabled) {
      console.warn('OddsApiService is disabled due to missing configuration');
      return [];
    }

    const safeMarketsCsv = Array.isArray(marketsArray)
      ? marketsArray.filter(Boolean).map(m => String(m).trim()).join(',')
      : String(marketsArray || '').trim();

    // Use sport-specific bookmaker if not provided
    const targetBookmaker = bookmaker || SPORT_BOOKMAKERS[sportKey] || 'draftkings';
    
    const params = { 
      markets: safeMarketsCsv,
      bookmakers: targetBookmaker
    };
    
    console.log(`Fetching odds for ${sportKey} with bookmaker: ${targetBookmaker} and markets: ${safeMarketsCsv}`);

    let games = [];
    const maxRetries = 2; // Reduced retries for efficiency
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.get(`/sports/${sportKey}/odds`, { params });
        this.lastResponseHeaders = response.headers;
        games = Array.isArray(response.data) ? response.data : [];
        break;
      } catch (err) {
        console.warn(`Batch odds fetch failed (attempt ${attempt}/${maxRetries}) for ${sportKey}: ${err.message}`);
        if (attempt < maxRetries) {
          const backoffMs = 500 * attempt;
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          continue;
        }
        games = [];
      }
    }

    if (!Array.isArray(games)) games = [];
    if (games.length === 0) {
      console.warn(`No events returned for ${sportKey} with markets: ${safeMarketsCsv}`);
    }

    // Store in database asynchronously for better performance
    this._storeOddsAsync(games);
    
    return games;
  }

  /**
   * Asynchronous storage method to avoid blocking API responses
   */
  async _storeOddsAsync(games) {
    try {
      await this._mergeAndUpsertOddsGames(games);
    } catch (error) {
      console.error('Error storing odds data:', error.message);
    }
  }

  /**
   * Enhanced method to fetch scores with caching
   */
  async getScores(sportKey) {
    if (!this.isEnabled) {
      console.warn('OddsApiService is disabled due to missing configuration');
      return [];
    }

    const cacheKey = `scores_${sportKey}`;
    const cached = scoresCache.get(cacheKey);
    if (cached) {
      console.log(`Returning cached scores for ${sportKey}`);
      return cached;
    }

    try {
      const response = await this.client.get(`/sports/${sportKey}/scores`);
      this.lastResponseHeaders = response.headers;
      
      const scores = response.data || [];
      
      // Store in database asynchronously
      this._storeScoresAsync(scores);
      
      // Cache the result
      scoresCache.set(cacheKey, scores);
      
      return scores;
    } catch (error) {
      console.error(`Error fetching scores for ${sportKey}:`, error.message);
      return [];
    }
  }

  /**
   * Asynchronous scores storage
   */
  async _storeScoresAsync(scores) {
    try {
      const bulkOps = scores.map(score => ({
        updateOne: {
          filter: { eventId: score.id },
          update: {
            $set: {
              eventId: score.id,
              sport_key: score.sport_key,
              sport_title: score.sport_title,
              commence_time: new Date(score.commence_time),
              completed: score.completed || false,
              home_team: score.home_team,
              away_team: score.away_team,
              scores: score.scores || [],
              last_update: new Date(score.last_update || Date.now()),
              status: this._determineGameStatus(score),
              lastFetched: new Date()
            }
          },
          upsert: true
        }
      }));

      if (bulkOps.length > 0) {
        await Scores.bulkWrite(bulkOps, { ordered: false });
      }
    } catch (error) {
      console.error('Error storing scores data:', error.message);
    }
  }

  /**
   * Helper to determine game status from score data
   */
  _determineGameStatus(score) {
    if (score.completed) return 'completed';
    if (score.scores && score.scores.length > 0) return 'live';
    return 'scheduled';
  }

  /**
   * Enhanced method to get results with caching
   */
  async getResults(sportKey, daysBack = 3) {
    if (!this.isEnabled) {
      console.warn('OddsApiService is disabled due to missing configuration');
      return [];
    }

    const cacheKey = `results_${sportKey}_${daysBack}`;
    const cached = oddsCache.get(cacheKey);
    if (cached) {
      console.log(`Returning cached results for ${sportKey}`);
      return cached;
    }

    try {
      const response = await this.client.get(`/sports/${sportKey}/scores`, {
        params: {
          daysFrom: daysBack,
          completed: true
        }
      });
      this.lastResponseHeaders = response.headers;
      
      const results = response.data || [];
      
      // Store in database asynchronously
      this._storeResultsAsync(results);
      
      // Cache the result
      oddsCache.set(cacheKey, results);
      
      return results;
    } catch (error) {
      console.error(`Error fetching results for ${sportKey}:`, error.message);
      return [];
    }
  }

  /**
   * Asynchronous results storage
   */
  async _storeResultsAsync(results) {
    try {
      const bulkOps = results.map(result => ({
        updateOne: {
          filter: { eventId: result.id },
          update: {
            $set: {
              eventId: result.id,
              sport_key: result.sport_key,
              sport_title: result.sport_title,
              commence_time: new Date(result.commence_time),
              completed: result.completed || true,
              home_team: result.home_team,
              away_team: result.away_team,
              scores: result.scores || [],
              last_update: new Date(result.last_update || Date.now()),
              season: result.season,
              week: result.week,
              lastFetched: new Date()
            }
          },
          upsert: true
        }
      }));

      if (bulkOps.length > 0) {
        await Results.bulkWrite(bulkOps, { ordered: false });
      }
    } catch (error) {
      console.error('Error storing results data:', error.message);
    }
  }

  /**
   * Clear cache method for manual cache invalidation
   */
  getPriorityMarkets() {
    // Return the same comprehensive priority markets list used in getUpcomingOdds
    return [
      'h2h',
      'spreads',
      'totals',
      'alternate_spreads',
      'alternate_totals',
      'team_totals',
      'player_points',
      'player_rebounds',
      'player_assists',
      'player_threes',
      'player_blocks',
      'player_steals',
      'player_turnovers',
      'player_points_rebounds_assists',
      'player_points_rebounds',
      'player_points_assists',
      'player_rebounds_assists',
      'player_double_double',
      'player_triple_double',
      'player_first_basket',
      'player_anytime_td',
      'player_pass_tds',
      'player_pass_yds',
      'player_pass_completions',
      'player_pass_attempts',
      'player_pass_interceptions',
      'player_rush_yds',
      'player_rush_attempts',
      'player_rush_tds',
      'player_receptions',
      'player_reception_yds',
      'player_reception_tds',
      'player_kicking_points',
      'player_field_goals',
      'player_tackles_assists',
      'player_1st_td',
      'player_last_td',
      'player_2_plus_td',
      'player_3_plus_td',
      'player_hits',
      'player_runs',
      'player_rbis',
      'player_home_runs',
      'player_stolen_bases',
      'player_strikeouts',
      'player_walks',
      'player_hits_runs_rbis',
      'player_total_bases',
      'player_singles',
      'player_doubles',
      'player_triples',
      'player_pitcher_strikeouts',
      'player_pitcher_hits_allowed',
      'player_pitcher_walks',
      'player_pitcher_earned_runs',
      'player_pitcher_wins',
      'player_goals',
      'player_assists_hockey',
      'player_points_hockey',
      'player_shots_on_goal',
      'player_saves',
      'player_penalty_minutes',
      'player_power_play_points',
      'player_short_handed_points',
      'player_goals_assists',
      'player_anytime_goalscorer',
      'player_shots',
      'player_shots_on_target',
      'player_cards',
      'player_fouls',
      'player_corners',
      'player_offsides',
      'player_passes',
      'player_pass_completions_soccer',
      'player_tackles',
      'player_interceptions_soccer',
      'player_crosses',
      'player_dribbles',
      'player_duels_won',
      'player_clearances',
      'player_saves_soccer',
      'player_clean_sheet',
      'player_first_goalscorer',
      'player_last_goalscorer',
      'player_2_plus_goals',
      'player_3_plus_goals',
      'spreads_q1',
      'spreads_q2',
      'spreads_q3',
      'spreads_q4',
      'spreads_h1',
      'spreads_h2',
      'spreads_p1',
      'spreads_p2',
      'spreads_p3',
      'spreads_1st_1_innings',
      'spreads_1st_3_innings',
      'spreads_1st_5_innings',
      'spreads_1st_7_innings',
      'alternate_spreads_1st_1_innings',
      'alternate_spreads_1st_3_innings',
      'alternate_spreads_1st_5_innings',
      'alternate_spreads_1st_7_innings',
      'alternate_spreads_q1',
      'alternate_spreads_q2',
      'alternate_spreads_q3',
      'alternate_spreads_q4',
      'alternate_spreads_h1',
      'alternate_spreads_h2',
      'alternate_spreads_p1',
      'alternate_spreads_p2',
      'alternate_spreads_p3',
      'totals_q1',
      'totals_q2',
      'totals_q3',
      'totals_q4',
      'totals_h1',
      'totals_h2',
      'totals_p1',
      'totals_p2',
      'totals_p3',
      'totals_1st_1_innings',
      'totals_1st_3_innings',
      'totals_1st_5_innings',
      'totals_1st_7_innings',
      'alternate_totals_1st_1_innings',
      'alternate_totals_1st_3_innings',
      'alternate_totals_1st_5_innings',
      'alternate_totals_1st_7_innings',
      'alternate_totals_q1',
      'alternate_totals_q2',
      'alternate_totals_q3',
      'alternate_totals_q4',
      'alternate_totals_h1',
      'alternate_totals_h2',
      'alternate_totals_p1',
      'alternate_totals_p2',
      'alternate_totals_p3',
      'team_totals_h1',
      'team_totals_h2',
      'team_totals_q1',
      'team_totals_q2',
      'team_totals_q3',
      'team_totals_q4',
      'team_totals_p1',
      'team_totals_p2',
      'team_totals_p3',
      'team_totals_1st_1_innings',
      'team_totals_1st_3_innings',
      'team_totals_1st_5_innings',
      'team_totals_1st_7_innings'
    ];
  }

  clearCache(type = 'all') {
    switch (type) {
      case 'odds':
        oddsCache.flushAll();
        break;
      case 'scores':
        scoresCache.flushAll();
        break;
      case 'sports':
        sportsCache.flushAll();
        break;
      case 'all':
      default:
        oddsCache.flushAll();
        scoresCache.flushAll();
        sportsCache.flushAll();
        break;
    }
    console.log(`Cache cleared: ${type}`);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      odds: {
        keys: oddsCache.keys().length,
        stats: oddsCache.getStats()
      },
      scores: {
        keys: scoresCache.keys().length,
        stats: scoresCache.getStats()
      },
      sports: {
        keys: sportsCache.keys().length,
        stats: sportsCache.getStats()
      }
    };
  }

  /**
   * Enhanced method to merge and upsert odds games with better error handling
   */
  async _mergeAndUpsertOddsGames(games) {
    if (!Array.isArray(games) || games.length === 0) return [];

    // Helper to normalize market keys consistently
    const normalizeMarketKey = (key) => {
      const k = (key || '').toLowerCase();
      const noLay = k.replace(/_?lay$/i, '').replace(/\blay\b/gi, '').replace(/\s+/g, ' ').trim().replace(/\s/g, '_');
      
      // Map common aliases to canonical keys
      const keyMappings = {
        'h2h': 'h2h', 'moneyline': 'h2h',
        'spreads': 'spreads', 'handicap': 'spreads', 'asian_handicap': 'spreads', 'point_spread': 'spreads',
        'totals': 'totals', 'over_under': 'totals', 'points_total': 'totals',
        'btts': 'both_teams_to_score', 'both_teams_to_score': 'both_teams_to_score',
        'draw_no_bet': 'draw_no_bet',
        'outrights': 'outrights', 'outright': 'outrights',
        'team_totals': 'team_totals',
        'alternate_team_totals': 'alternate_team_totals',
        'alternate_totals': 'alternate_totals',
        'alternate_spreads': 'alternate_spreads',
        'h2h_3_way': 'h2h_3_way',
        'double_chance': 'double_chance'
      };
      
      return keyMappings[noLay] || noLay;
    };

    // Preload existing odds for these games to merge efficiently
    const gameIds = games.map(g => g.id);
    const existingDocs = await Odds.find({ gameId: { $in: gameIds } });
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
        const batchSize = 50;
        for (let i = 0; i < bulkOps.length; i += batchSize) {
          const batch = bulkOps.slice(i, i + batchSize);
          await Odds.bulkWrite(batch, { ordered: false, writeConcern: { w: 1, wtimeout: 30000 } });
          if (i + batchSize < bulkOps.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      } catch (bulkWriteError) {
        console.error(`MongoDB bulkWrite error during odds upsert: ${bulkWriteError.message}`);
      }
    }
    return games;
  }

  /**
   * Helper to fetch odds for a single market and save to DB
   */
  async _fetchAndSaveOddsForMarket(sportKey, market, bookmaker = null) {
    if (!this.isEnabled) {
      console.warn('OddsApiService is disabled due to missing configuration');
      return [];
    }

    // Use sport-specific bookmaker if not provided
    const targetBookmaker = bookmaker || SPORT_BOOKMAKERS[sportKey] || 'draftkings';
    
    const params = { 
      markets: market,
      bookmakers: targetBookmaker
    };
    
    console.log(`Fetching odds for ${sportKey} market ${market} with bookmaker: ${targetBookmaker}`);

    let games = [];
    try {
      const response = await this.client.get(`/sports/${sportKey}/odds`, { params });
      this.lastResponseHeaders = response.headers;
      games = response.data || [];
    } catch (err) {
      console.error(`Error fetching odds for ${sportKey} market ${market}:`, err.message);
      
      // If it's a 401 or 500 error, try to use fallback data
      if (err.response && (err.response.status === 401 || err.response.status === 500)) {
        winstonLogger.warn(`Using fallback odds data for ${sportKey} due to API ${err.response.status} error`);
        const fs = require('fs');
        const path = require('path');
        try {
          const fallbackPath = path.join(__dirname, '..', 'data', 'fallbackOdds.json');
          const fallbackData = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
          // Filter fallback data for the specific sport
          games = fallbackData.filter(game => game.sport_key === sportKey);
        } catch (fallbackError) {
          winstonLogger.error('Failed to load fallback odds data:', fallbackError);
        }
      }
      
      if (games.length === 0) {
        return [];
      }
    }

    if (!Array.isArray(games)) games = [];
    
    // Store in database asynchronously
    this._storeOddsAsync(games);
    
    return games;
  }

  /**
   * Enhanced error handling for API errors
   */
  handleApiError(error) {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || error.message;
      
      switch (status) {
        case 401:
          winstonLogger.error('Odds API authentication failed. Check your API key.', { status, message });
          break;
        case 403:
          winstonLogger.error('Odds API access forbidden. Check your subscription.', { status, message });
          break;
        case 422:
          winstonLogger.warn('Odds API request validation failed.', { status, message });
          break;
        case 429:
          winstonLogger.warn('Odds API rate limit exceeded.', { status, message });
          break;
        case 500:
          winstonLogger.error('Odds API server error.', { status, message });
          break;
        default:
          winstonLogger.error('Odds API error.', { status, message });
      }
    } else if (error.request) {
      winstonLogger.error('No response received from Odds API.', { error: error.message });
    } else {
      winstonLogger.error('Error setting up Odds API request.', { error: error.message });
    }
  }

  /**
   * Get rate limit information from last response
   */
  getLastRateLimitInfo() {
    if (!this.lastResponseHeaders) {
      return {
        requestsRemaining: null,
        requestsUsed: null,
        message: 'No previous API response headers available'
      };
    }

    const remaining = this.lastResponseHeaders['x-requests-remaining'];
    const used = this.lastResponseHeaders['x-requests-used'];

    return {
      requestsRemaining: remaining ? parseInt(remaining, 10) : null,
      requestsUsed: used ? parseInt(used, 10) : null,
      message: remaining ? `${remaining} requests remaining` : 'Rate limit info not available'
    };
  }

  /**
   * Enhanced method to get odds by specific event IDs
   */
  async getOddsByEventIds(sportKey, eventIds, markets = null, bookmakers = null) {
    if (!this.isEnabled) {
      console.warn('OddsApiService is disabled due to missing configuration');
      return [];
    }

    if (!Array.isArray(eventIds) || eventIds.length === 0) {
      return [];
    }

    // Use sport-specific bookmaker if not provided
    const targetBookmaker = bookmakers || SPORT_BOOKMAKERS[sportKey] || 'draftkings';

    const params = { eventIds: eventIds.join(',') };
    if (markets) params.markets = Array.isArray(markets) ? markets.join(',') : markets;
    params.bookmakers = Array.isArray(targetBookmaker) ? targetBookmaker.join(',') : targetBookmaker;
    
    console.log(`Fetching odds by event IDs for ${sportKey} with bookmaker: ${params.bookmakers}`);

    try {
      const response = await this.client.get(`/sports/${sportKey}/odds`, { params });
      this.lastResponseHeaders = response.headers;
      
      const games = response.data || [];
      
      // Store in database asynchronously
      this._storeOddsAsync(games);
      
      return games;
    } catch (error) {
      this.handleApiError(error);
      return [];
    }
  }
}

// Legacy helper functions for backward compatibility
const ODDS_API_KEY = process.env.ODDS_API_KEY;
const ODDS_API_BASE_URL = process.env.ODDS_API_BASE_URL || 'https://api.the-odds-api.com/v4';

async function fetchSports() {
  const service = new OddsApiService();
  return service.getSports();
}

async function fetchMainMarkets(sport, regions, markets, bookmakers) {
  const service = new OddsApiService();
  return service.getUpcomingOdds(sport, markets);
}

async function fetchEventMarkets(sport, eventIds, regions, markets, bookmakers) {
  const service = new OddsApiService();
  return service.getOddsByEventIds(sport, eventIds, markets, bookmakers);
}

/**
 * Enhanced bookmaker data merging with fallback support
 */
function mergeBookmakerData(eventData, primaryBookmaker, fallbackBookmaker) {
  if (!eventData || !Array.isArray(eventData.bookmakers)) {
    return eventData;
  }

  const primaryBm = eventData.bookmakers.find(bm => bm.key === primaryBookmaker);
  const fallbackBm = eventData.bookmakers.find(bm => bm.key === fallbackBookmaker);

  if (primaryBm) {
    return {
      ...eventData,
      bookmakers: [primaryBm]
    };
  } else if (fallbackBm) {
    return {
      ...eventData,
      bookmakers: [fallbackBm]
    };
  }

  // Return first available bookmaker if neither primary nor fallback found
  return {
    ...eventData,
    bookmakers: eventData.bookmakers.slice(0, 1)
  };
}

async function fetchMarketsForSport(sportKey) {
  const service = new OddsApiService();
  return service.getMarketsForSport(sportKey);
}

module.exports = {
  OddsApiService,
  fetchSports,
  fetchMainMarkets,
  fetchEventMarkets,
  mergeBookmakerData,
  fetchMarketsForSport
};

