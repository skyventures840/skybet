require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const { OddsApiService } = require('../services/oddsApiService');
const Odds = require('../models/Odds');
const Match = require('../models/Match');
const logger = require('../utils/logger');

/**
 * Enhanced Odds Fetching Script
 * 
 * Workflow:
 * 1. Fetch basic odds for a sport (h2h, spreads, totals)
 * 2. Check what additional markets are supported for that sport
 * 3. If additional markets are supported, fetch them using event-specific endpoints
 * 4. Upsert additional markets to the existing basic odds
 * 5. Move to the next sport
 */

class EnhancedOddsFetcher {
  constructor() {
    this.oddsService = new OddsApiService();
    this.basicMarkets = ['h2h', 'spreads', 'totals'];
    
    // Define comprehensive additional markets by sport category based on Odds API documentation
    this.additionalMarketsBySport = {
      // American Football - NFL & College & CFL & UFL
      'americanfootball_nfl': [
        'alternate_spreads', 'alternate_totals', 'team_totals', 'alternate_team_totals',
        'h2h_q1', 'h2h_q2', 'h2h_q3', 'h2h_q4', 'h2h_h1', 'h2h_h2',
        'spreads_q1', 'spreads_q2', 'spreads_q3', 'spreads_q4', 'spreads_h1', 'spreads_h2',
        'alternate_spreads_q1', 'alternate_spreads_q2', 'alternate_spreads_q3', 'alternate_spreads_q4',
        'alternate_spreads_h1', 'alternate_spreads_h2',
        'player_pass_tds', 'player_pass_yds', 'player_rush_yds', 'player_receptions',
        'player_reception_yds', 'player_rush_attempts', 'player_pass_attempts',
        'player_pass_completions', 'player_pass_interceptions', 'player_rush_tds',
        'player_reception_tds', 'player_kicking_points', 'player_field_goals',
        'player_tackles_assists', 'player_1st_td', 'player_last_td', 'player_anytime_td'
      ],
      'americanfootball_ncaaf': [
        'alternate_spreads', 'alternate_totals', 'team_totals', 'alternate_team_totals',
        'h2h_q1', 'h2h_q2', 'h2h_q3', 'h2h_q4', 'h2h_h1', 'h2h_h2',
        'spreads_q1', 'spreads_q2', 'spreads_q3', 'spreads_q4', 'spreads_h1', 'spreads_h2',
        'player_pass_tds', 'player_pass_yds', 'player_rush_yds', 'player_receptions',
        'player_reception_yds', 'player_anytime_td'
      ],
      'americanfootball_cfl': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      'americanfootball_ufl': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      'americanfootball_nfl_preseason': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      
      // Basketball - NBA, College, WNBA, International
      'basketball_nba': [
        'alternate_spreads', 'alternate_totals', 'team_totals', 'alternate_team_totals',
        'h2h_q1', 'h2h_q2', 'h2h_q3', 'h2h_q4', 'h2h_h1', 'h2h_h2',
        'spreads_q1', 'spreads_q2', 'spreads_q3', 'spreads_q4', 'spreads_h1', 'spreads_h2',
        'totals_q1', 'totals_q2', 'totals_q3', 'totals_q4', 'totals_h1', 'totals_h2',
        'player_points', 'player_rebounds', 'player_assists', 'player_threes',
        'player_blocks', 'player_steals', 'player_turnovers', 'player_pra',
        'player_pr', 'player_pa', 'player_ra'
      ],
      'basketball_ncaab': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'h2h_h1', 'h2h_h2', 'spreads_h1', 'spreads_h2', 'totals_h1', 'totals_h2',
        'player_points', 'player_rebounds', 'player_assists'
      ],
      'basketball_wnba': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'h2h_q1', 'h2h_q2', 'h2h_q3', 'h2h_q4', 'h2h_h1', 'h2h_h2',
        'player_points', 'player_rebounds', 'player_assists'
      ],
      'basketball_wncaab': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      'basketball_euroleague': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      'basketball_nbl': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      'basketball_nba_preseason': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      'basketball_nba_summer_league': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      
      // Baseball - MLB & International
      'baseball_mlb': [
        'alternate_spreads', 'alternate_totals', 'team_totals', 'alternate_team_totals',
        'h2h_f5', 'spreads_f5', 'totals_f5',
        'h2h_f7', 'spreads_f7', 'totals_f7',
        'h2h_i1', 'h2h_i2', 'h2h_i3', 'h2h_i4', 'h2h_i5', 'h2h_i6', 'h2h_i7', 'h2h_i8', 'h2h_i9',
        'player_hits', 'player_total_bases', 'player_rbis', 'player_runs_scored',
        'player_home_runs', 'player_stolen_bases', 'player_strikeouts_pitcher',
        'player_walks', 'player_earned_runs', 'player_pitcher_wins',
        'player_strikeouts_batter', 'player_doubles', 'player_singles'
      ],
      'baseball_mlb_preseason': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      'baseball_milb': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      'baseball_npb': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      'baseball_kbo': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      'baseball_ncaa': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      
      // Ice Hockey - NHL & International
      'icehockey_nhl': [
        'alternate_spreads', 'alternate_totals', 'team_totals', 'alternate_team_totals',
        'h2h_p1', 'h2h_p2', 'h2h_p3', 'spreads_p1', 'spreads_p2', 'spreads_p3',
        'totals_p1', 'totals_p2', 'totals_p3',
        'player_shots_on_goal', 'player_blocked_shots', 'player_points',
        'player_assists', 'player_goals', 'player_power_play_points',
        'player_penalty_minutes', 'player_saves', 'player_goalie_wins'
      ],
      'icehockey_nhl_preseason': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      'icehockey_ahl': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      'icehockey_liiga': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      'icehockey_mestis': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      'icehockey_sweden_hockey_league': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      'icehockey_sweden_allsvenskan': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      
      // Soccer - Major Leagues
      'soccer_epl': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'h2h_h1', 'h2h_h2', 'spreads_h1', 'spreads_h2', 'totals_h1', 'totals_h2',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      'soccer_spain_la_liga': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'h2h_h1', 'h2h_h2', 'spreads_h1', 'spreads_h2', 'totals_h1', 'totals_h2',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      'soccer_italy_serie_a': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'h2h_h1', 'h2h_h2', 'spreads_h1', 'spreads_h2', 'totals_h1', 'totals_h2',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      'soccer_germany_bundesliga': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'h2h_h1', 'h2h_h2', 'spreads_h1', 'spreads_h2', 'totals_h1', 'totals_h2',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      'soccer_france_ligue_one': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'h2h_h1', 'h2h_h2', 'spreads_h1', 'spreads_h2', 'totals_h1', 'totals_h2',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      'soccer_uefa_champs_league': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'h2h_h1', 'h2h_h2', 'spreads_h1', 'spreads_h2', 'totals_h1', 'totals_h2',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      'soccer_uefa_europa_league': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      'soccer_uefa_nations_league': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      'soccer_fifa_world_cup': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      'soccer_fifa_world_cup_winner': [
        'outrights'
      ],
      'soccer_efl_champ': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      'soccer_england_league1': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      'soccer_england_league2': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      'soccer_fa_cup': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      'soccer_league_cup': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      'soccer_conmebol_copa_america': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      'soccer_brazil_campeonato': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      'soccer_argentina_primera_division': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      'soccer_mexico_ligamx': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      'soccer_usa_mls': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'h2h_h1', 'h2h_h2', 'spreads_h1', 'spreads_h2', 'totals_h1', 'totals_h2',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      'soccer_netherlands_eredivisie': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      'soccer_belgium_first_div': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      'soccer_portugal_primeira_liga': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      'soccer_turkey_super_league': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      'soccer_greece_super_league': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      'soccer_denmark_superliga': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      'soccer_sweden_allsvenskan': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      'soccer_sweden_superettan': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      'soccer_norway_eliteserien': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      'soccer_finland_veikkausliiga': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      'soccer_poland_ekstraklasa': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      'soccer_austria_bundesliga': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      'soccer_switzerland_superleague': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      'soccer_czech_republic_fnl': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      'soccer_russia_premier_league': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      'soccer_ukraine_premier_league': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      'soccer_croatia_hnl': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      'soccer_serbia_super_liga': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      'soccer_australia_aleague': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      'soccer_japan_j_league': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      'soccer_south_korea_k_league_1': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      'soccer_china_super_league': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      
      // Tennis - Major Tours
      'tennis_atp_aus_open_singles': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      'tennis_atp_french_open': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      'tennis_atp_wimbledon': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      'tennis_atp_us_open': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      'tennis_wta_aus_open_singles': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      'tennis_wta_french_open': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      'tennis_wta_wimbledon': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      'tennis_wta_us_open': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      
      // Golf - Major Tournaments
      'golf_pga_championship': [
        'outrights', 'top_5_finish', 'top_10_finish', 'top_20_finish',
        'make_cut', 'first_round_leader'
      ],
      'golf_masters_tournament': [
        'outrights', 'top_5_finish', 'top_10_finish', 'top_20_finish',
        'make_cut', 'first_round_leader'
      ],
      'golf_us_open': [
        'outrights', 'top_5_finish', 'top_10_finish', 'top_20_finish',
        'make_cut', 'first_round_leader'
      ],
      'golf_the_open_championship': [
        'outrights', 'top_5_finish', 'top_10_finish', 'top_20_finish',
        'make_cut', 'first_round_leader'
      ],
      
      // MMA - Major Promotions
      'mma_mixed_martial_arts': [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'method_of_victory', 'round_betting', 'fight_duration'
      ],
      
      // Cricket - International & Domestic
      'cricket_icc_world_cup': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      'cricket_international_t20': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      'cricket_odi': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      'cricket_test_match': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      'cricket_ipl': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      'cricket_big_bash': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      'cricket_caribbean_premier_league': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      
      // Rugby - International & Domestic
      'rugbyleague_nrl': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      'rugbyunion_world_cup': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      'rugbyunion_six_nations': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      'rugbyunion_premiership': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      'rugbyunion_super_rugby': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      
      // Aussie Rules
      'aussierules_afl': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      
      // Boxing
      'boxing_heavyweight': [
        'method_of_victory', 'round_betting', 'fight_duration'
      ],
      
      // Esports
      'esports_lol_worlds': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      'esports_valorant_champions': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      'esports_dota2_ti': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      'esports_csgo_blast_premier': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      'esports_call_of_duty': [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      
      // Default for other sports - basic additional markets
      'default': ['alternate_spreads', 'alternate_totals', 'team_totals']
    };
  }

  /**
   * Get additional markets for a specific sport
   */
  getAdditionalMarkets(sportKey) {
    return this.additionalMarketsBySport[sportKey] || this.additionalMarketsBySport['default'];
  }

  /**
   * Check if additional markets are supported for a sport
   */
  async checkAdditionalMarketSupport(sportKey, additionalMarkets) {
    try {
      logger.info(`Checking additional market support for ${sportKey}...`);
      
      // Try to fetch a small sample to test market support
      const response = await this.oddsService.client.get(`/sports/${sportKey}/odds`, {
        params: {
          regions: 'us,us2,uk,au,eu', // All major regions for comprehensive coverage
          markets: additionalMarkets.slice(0, 2).join(','), // Test with first 2 markets
          oddsFormat: 'decimal',
          dateFormat: 'iso'
        }
      });

      logger.info(`✓ Additional markets supported for ${sportKey}`);
      return { supported: true, markets: additionalMarkets };
      
    } catch (error) {
      if (error.response?.status === 422) {
        const errorData = error.response.data;
        if (errorData.message && errorData.message.includes('Markets not supported')) {
          logger.warn(`✗ Additional markets not supported for ${sportKey}: ${errorData.message}`);
          return { supported: false, reason: errorData.message };
        }
      }
      
      logger.error(`Error checking market support for ${sportKey}:`, error.message);
      return { supported: false, reason: error.message };
    }
  }

  /**
   * Fetch basic odds for a sport using sport-specific bookmaker
   */
  async fetchBasicOdds(sportKey, sportTitle) {
    try {
      logger.info(`\n=== Fetching Basic Odds for ${sportTitle} (${sportKey}) ===`);
      
      // Get sport-specific bookmaker from OddsApiService
      const bookmaker = this.oddsService.getSportBookmaker(sportKey);
      if (bookmaker) {
        logger.info(`Using sport-specific bookmaker: ${bookmaker}`);
      } else {
        logger.info(`No specific bookmaker configured for ${sportKey}, using all bookmakers`);
      }
      
      const games = await this.oddsService._fetchAndSaveOddsForMarketsBatch(
        sportKey, 
        this.basicMarkets, 
        bookmaker
      );
      
      logger.info(`✓ Fetched ${games.length} games with basic markets for ${sportKey}`);
      
      // Save to Match collection for frontend
      if (games.length > 0) {
        const matchBulkOps = games.map(game => ({
          updateOne: {
            filter: { _id: game.id },
            update: {
              $set: {
                _id: game.id,
                sport: game.sport_key,
                league: game.sport_title,
                homeTeam: game.home_team,
                awayTeam: game.away_team,
                startTime: new Date(game.commence_time),
                odds: game.bookmakers,
                status: 'upcoming'
              }
            },
            upsert: true
          }
        }));
        
        await Match.bulkWrite(matchBulkOps, { ordered: false });
        logger.info(`✓ Saved ${games.length} match records for ${sportKey}`);
      }

      return games;
      
    } catch (error) {
      logger.error(`Error fetching basic odds for ${sportKey}:`, error.message);
      throw error;
    }
  }

  /**
   * Fetch additional markets using event-specific endpoints
   */
  async fetchAdditionalMarkets(sportKey, games, additionalMarkets) {
    try {
      logger.info(`\n=== Fetching Additional Markets for ${sportKey} ===`);
      logger.info(`Markets to fetch: ${additionalMarkets.join(', ')}`);
      
      const eventIds = games.map(game => game.id);
      
      const result = await this.oddsService.upsertAdditionalMarkets(
        sportKey,
        eventIds,
        additionalMarkets
      );

      logger.info(`✓ Additional markets result for ${sportKey}:`);
      logger.info(`  - Successful: ${result.successful.length}`);
      logger.info(`  - Failed: ${result.failed.length}`);
      logger.info(`  - Total markets added: ${result.marketsAdded}`);

      return result;
      
    } catch (error) {
      logger.error(`Error fetching additional markets for ${sportKey}:`, error.message);
      return { successful: [], failed: [], marketsAdded: 0 };
    }
  }

  /**
   * Process a single sport with the enhanced workflow
   */
  async processSport(sportKey, sportTitle) {
    try {
      logger.info(`\n🏈 Processing Sport: ${sportTitle} (${sportKey})`);
      
      const result = {
        sportKey,
        sportTitle,
        basicOdds: 0,
        additionalMarkets: 0,
        totalGames: 0,
        marketSupport: null,
        errors: []
      };

      // Step 1: Fetch basic odds
      const games = await this.fetchBasicOdds(sportKey, sportTitle);
      result.basicOdds = games.length;
      result.totalGames = games.length;

      if (games.length === 0) {
        logger.warn(`No games found for ${sportKey}, skipping additional markets`);
        return result;
      }

      // Step 2: Check additional market support
      const additionalMarkets = this.getAdditionalMarkets(sportKey);
      const supportCheck = await this.checkAdditionalMarketSupport(sportKey, additionalMarkets);
      result.marketSupport = supportCheck;

      if (!supportCheck.supported) {
        logger.info(`Skipping additional markets for ${sportKey}: ${supportCheck.reason}`);
        return result;
      }

      // Step 3: Fetch additional markets using event-specific endpoints
      const additionalResult = await this.fetchAdditionalMarkets(sportKey, games, additionalMarkets);
      result.additionalMarkets = additionalResult.marketsAdded;

      // Rate limiting between sports
      await new Promise(resolve => setTimeout(resolve, 2000));

      logger.info(`✅ Completed processing ${sportKey}`);
      return result;

    } catch (error) {
      logger.error(`❌ Error processing sport ${sportKey}:`, error.message);
      return {
        sportKey,
        sportTitle,
        basicOdds: 0,
        additionalMarkets: 0,
        totalGames: 0,
        marketSupport: null,
        errors: [error.message]
      };
    }
  }

  /**
   * Process multiple sports with enhanced workflow
   */
  async processMultipleSports(sports) {
    const results = [];
    
    logger.info(`\n🚀 Starting Enhanced Odds Fetching for ${sports.length} sports`);
    
    for (const sport of sports) {
      const result = await this.processSport(sport.key, sport.title);
      results.push(result);
    }

    // Summary
    const summary = {
      totalSports: sports.length,
      totalGames: results.reduce((sum, r) => sum + r.totalGames, 0),
      totalBasicOdds: results.reduce((sum, r) => sum + r.basicOdds, 0),
      totalAdditionalMarkets: results.reduce((sum, r) => sum + r.additionalMarkets, 0),
      sportsWithAdditionalMarkets: results.filter(r => r.additionalMarkets > 0).length,
      errors: results.filter(r => r.errors.length > 0).length
    };

    logger.info(`\n📊 Enhanced Fetch Summary:`);
    logger.info(`  - Sports processed: ${summary.totalSports}`);
    logger.info(`  - Total games: ${summary.totalGames}`);
    logger.info(`  - Basic odds fetched: ${summary.totalBasicOdds}`);
    logger.info(`  - Additional markets added: ${summary.totalAdditionalMarkets}`);
    logger.info(`  - Sports with additional markets: ${summary.sportsWithAdditionalMarkets}`);
    logger.info(`  - Sports with errors: ${summary.errors}`);

    return { results, summary };
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB');

    const fetcher = new EnhancedOddsFetcher();

    // Define sports to process - comprehensive list from Odds API
    const sports = [
      // American Football
      { key: 'americanfootball_nfl', title: 'NFL' },
      { key: 'americanfootball_ncaaf', title: 'NCAAF' },
      { key: 'americanfootball_cfl', title: 'CFL' },
      { key: 'americanfootball_ufl', title: 'UFL' },
      { key: 'americanfootball_nfl_preseason', title: 'NFL Preseason' },
      
      // Basketball
      { key: 'basketball_nba', title: 'NBA' },
      { key: 'basketball_ncaab', title: 'NCAAB' },
      { key: 'basketball_wnba', title: 'WNBA' },
      { key: 'basketball_wncaab', title: 'WNCAAB' },
      { key: 'basketball_euroleague', title: 'Euroleague' },
      { key: 'basketball_nbl', title: 'NBL' },
      { key: 'basketball_nba_preseason', title: 'NBA Preseason' },
      { key: 'basketball_nba_summer_league', title: 'NBA Summer League' },
      
      // Baseball
      { key: 'baseball_mlb', title: 'MLB' },
      { key: 'baseball_mlb_preseason', title: 'MLB Preseason' },
      { key: 'baseball_milb', title: 'MiLB' },
      { key: 'baseball_npb', title: 'NPB' },
      { key: 'baseball_kbo', title: 'KBO' },
      { key: 'baseball_ncaa', title: 'NCAA Baseball' },
      
      // Ice Hockey
      { key: 'icehockey_nhl', title: 'NHL' },
      { key: 'icehockey_nhl_preseason', title: 'NHL Preseason' },
      { key: 'icehockey_ahl', title: 'AHL' },
      { key: 'icehockey_liiga', title: 'Liiga' },
      { key: 'icehockey_mestis', title: 'Mestis' },
      { key: 'icehockey_sweden_hockey_league', title: 'SHL' },
      { key: 'icehockey_sweden_allsvenskan', title: 'Allsvenskan Hockey' },
      
      // Soccer - Major European Leagues
      { key: 'soccer_epl', title: 'English Premier League' },
      { key: 'soccer_spain_la_liga', title: 'La Liga' },
      { key: 'soccer_italy_serie_a', title: 'Serie A' },
      { key: 'soccer_germany_bundesliga', title: 'Bundesliga' },
      { key: 'soccer_france_ligue_one', title: 'Ligue 1' },
      { key: 'soccer_uefa_champs_league', title: 'Champions League' },
      { key: 'soccer_uefa_europa_league', title: 'Europa League' },
      { key: 'soccer_uefa_nations_league', title: 'Nations League' },
      
      // Soccer - International Competitions
      { key: 'soccer_fifa_world_cup', title: 'FIFA World Cup' },
      { key: 'soccer_conmebol_copa_america', title: 'Copa America' },
      
      // Soccer - Other European Leagues
      { key: 'soccer_efl_champ', title: 'EFL Championship' },
      { key: 'soccer_england_league1', title: 'League One' },
      { key: 'soccer_england_league2', title: 'League Two' },
      { key: 'soccer_fa_cup', title: 'FA Cup' },
      { key: 'soccer_league_cup', title: 'League Cup' },
      { key: 'soccer_netherlands_eredivisie', title: 'Eredivisie' },
      { key: 'soccer_belgium_first_div', title: 'Belgian First Division' },
      { key: 'soccer_portugal_primeira_liga', title: 'Primeira Liga' },
      { key: 'soccer_turkey_super_league', title: 'Super Lig' },
      { key: 'soccer_greece_super_league', title: 'Super League Greece' },
      { key: 'soccer_denmark_superliga', title: 'Superliga' },
      { key: 'soccer_sweden_allsvenskan', title: 'Allsvenskan' },
      { key: 'soccer_sweden_superettan', title: 'Superettan' },
      { key: 'soccer_norway_eliteserien', title: 'Eliteserien' },
      { key: 'soccer_finland_veikkausliiga', title: 'Veikkausliiga' },
      { key: 'soccer_poland_ekstraklasa', title: 'Ekstraklasa' },
      { key: 'soccer_austria_bundesliga', title: 'Austrian Bundesliga' },
      { key: 'soccer_switzerland_superleague', title: 'Swiss Super League' },
      { key: 'soccer_czech_republic_fnl', title: 'Czech First League' },
      { key: 'soccer_russia_premier_league', title: 'Russian Premier League' },
      { key: 'soccer_ukraine_premier_league', title: 'Ukrainian Premier League' },
      { key: 'soccer_croatia_hnl', title: 'Croatian First League' },
      { key: 'soccer_serbia_super_liga', title: 'Serbian SuperLiga' },
      
      // Soccer - Americas & Other Regions
      { key: 'soccer_usa_mls', title: 'MLS' },
      { key: 'soccer_brazil_campeonato', title: 'Brasileirão' },
      { key: 'soccer_argentina_primera_division', title: 'Primera División' },
      { key: 'soccer_mexico_ligamx', title: 'Liga MX' },
      { key: 'soccer_australia_aleague', title: 'A-League' },
      { key: 'soccer_japan_j_league', title: 'J-League' },
      { key: 'soccer_south_korea_k_league_1', title: 'K League 1' },
      { key: 'soccer_china_super_league', title: 'Chinese Super League' },
      
      // Tennis - Grand Slams
      { key: 'tennis_atp_aus_open_singles', title: 'Australian Open (ATP)' },
      { key: 'tennis_atp_french_open', title: 'French Open (ATP)' },
      { key: 'tennis_atp_wimbledon', title: 'Wimbledon (ATP)' },
      { key: 'tennis_atp_us_open', title: 'US Open (ATP)' },
      { key: 'tennis_wta_aus_open_singles', title: 'Australian Open (WTA)' },
      { key: 'tennis_wta_french_open', title: 'French Open (WTA)' },
      { key: 'tennis_wta_wimbledon', title: 'Wimbledon (WTA)' },
      { key: 'tennis_wta_us_open', title: 'US Open (WTA)' },
      
      // Golf - Major Championships
      { key: 'golf_pga_championship', title: 'PGA Championship' },
      { key: 'golf_masters_tournament', title: 'Masters Tournament' },
      { key: 'golf_us_open', title: 'US Open Golf' },
      { key: 'golf_the_open_championship', title: 'The Open Championship' },
      
      // MMA & Combat Sports
      { key: 'mma_mixed_martial_arts', title: 'MMA' },
      { key: 'boxing_heavyweight', title: 'Boxing' },
      
      // Cricket
      { key: 'cricket_icc_world_cup', title: 'Cricket World Cup' },
      { key: 'cricket_international_t20', title: 'International T20' },
      { key: 'cricket_odi', title: 'ODI Cricket' },
      { key: 'cricket_test_match', title: 'Test Cricket' },
      { key: 'cricket_ipl', title: 'IPL' },
      { key: 'cricket_big_bash', title: 'Big Bash League' },
      { key: 'cricket_caribbean_premier_league', title: 'CPL' },
      
      // Rugby
      { key: 'rugbyleague_nrl', title: 'NRL' },
      { key: 'rugbyunion_world_cup', title: 'Rugby World Cup' },
      { key: 'rugbyunion_six_nations', title: 'Six Nations' },
      { key: 'rugbyunion_premiership', title: 'Premiership Rugby' },
      { key: 'rugbyunion_super_rugby', title: 'Super Rugby' },
      
      // Australian Rules Football
      { key: 'aussierules_afl', title: 'AFL' },
      
      // Esports
      { key: 'esports_lol_worlds', title: 'LoL Worlds' },
      { key: 'esports_valorant_champions', title: 'Valorant Champions' },
      { key: 'esports_dota2_ti', title: 'Dota 2 TI' },
      { key: 'esports_csgo_blast_premier', title: 'CS:GO BLAST Premier' },
      { key: 'esports_call_of_duty', title: 'Call of Duty League' }
    ];

    // Process all sports with enhanced workflow
    const { results, summary } = await fetcher.processMultipleSports(sports);

    logger.info('\n🎉 Enhanced odds fetching completed successfully!');
    
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');

  } catch (error) {
    logger.error('Fatal error in enhanced odds fetching:', error);
    process.exit(1);
  }
}

// Export for use in other modules
module.exports = {
  EnhancedOddsFetcher,
  main
};

// Run if called directly
if (require.main === module) {
  main();
}