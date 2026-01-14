require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') })

const mongoose = require('mongoose')
const config = require('../config/config')
const { OddsApiService } = require('../services/oddsApiService')
const Odds = require('../models/Odds') // eslint-disable-line no-unused-vars
const Match = require('../models/Match')
const logger = require('../utils/logger')

const PREFERRED_BOOKMAKERS = {
  soccer_epl: 'pinnacle',
  soccer_spain_la_liga: 'pinnacle',
  soccer_italy_serie_a: 'pinnacle',
  soccer_germany_bundesliga: 'pinnacle',
  soccer_france_ligue_one: 'pinnacle',
  soccer_uefa_champs_league: 'pinnacle',
  soccer_uefa_europa_league: 'pinnacle',
  soccer_uefa_nations_league: 'pinnacle',
  soccer_fifa_world_cup: 'pinnacle',
  soccer_efl_champ: 'pinnacle',
  soccer_england_league1: 'pinnacle',
  soccer_england_league2: 'pinnacle',
  soccer_fa_cup: 'pinnacle',
  soccer_league_cup: 'pinnacle',
  soccer_netherlands_eredivisie: 'pinnacle',
  soccer_belgium_first_div: 'pinnacle',
  soccer_portugal_primeira_liga: 'pinnacle',
  soccer_turkey_super_league: 'pinnacle',
  soccer_greece_super_league: 'pinnacle',
  soccer_denmark_superliga: 'pinnacle',
  soccer_sweden_allsvenskan: 'pinnacle',
  soccer_sweden_superettan: 'pinnacle',
  soccer_norway_eliteserien: 'pinnacle',
  soccer_finland_veikkausliiga: 'pinnacle',
  soccer_poland_ekstraklasa: 'pinnacle',
  soccer_austria_bundesliga: 'pinnacle',
  soccer_switzerland_superleague: 'pinnacle',
  soccer_czech_republic_fnl: 'pinnacle',
  soccer_russia_premier_league: 'pinnacle',
  soccer_ukraine_premier_league: 'pinnacle',
  soccer_croatia_hnl: 'pinnacle',
  soccer_serbia_super_liga: 'pinnacle',
  soccer_usa_mls: 'pinnacle',
  soccer_brazil_campeonato: 'pinnacle',
  soccer_argentina_primera_division: 'pinnacle',
  soccer_mexico_ligamx: 'pinnacle',
  soccer_australia_aleague: 'pinnacle',
  soccer_japan_j_league: 'pinnacle',
  soccer_south_korea_k_league_1: 'pinnacle',
  soccer_china_super_league: 'pinnacle',
  soccer_conmebol_copa_america: 'pinnacle',
  americanfootball_nfl: 'draftkings',
  americanfootball_ncaaf: 'draftkings',
  americanfootball_cfl: 'draftkings',
  americanfootball_ufl: 'draftkings',
  americanfootball_nfl_preseason: 'draftkings',
  aussierules_afl: 'sportsbet',
  baseball_mlb: 'draftkings',
  baseball_mlb_preseason: 'draftkings',
  baseball_milb: 'draftkings',
  baseball_npb: 'draftkings',
  baseball_kbo: 'draftkings',
  baseball_ncaa: 'draftkings',
  basketball_nba: 'fanduel',
  basketball_nba_preseason: 'fanduel',
  basketball_nba_summer_league: 'fanduel',
  basketball_wnba: 'fanduel',
  basketball_ncaab: 'fanduel',
  basketball_wncaab: 'fanduel',
  basketball_euroleague: 'fanduel',
  basketball_nbl: 'fanduel',
  boxing_boxing: 'bet365_au',
  cricket_icc_world_cup: 'sportsbet',
  cricket_international_t20: 'sportsbet',
  cricket_ipl: 'sportsbet',
  cricket_big_bash: 'sportsbet',
  cricket_caribbean_premier_league: 'sportsbet',
  cricket_odi: 'sportsbet',
  cricket_test_match: 'sportsbet',
  golf_pga_championship: 'bet365_au',
  golf_masters_tournament: 'bet365_au',
  golf_us_open: 'bet365_au',
  golf_the_open_championship: 'bet365_au',
  icehockey_nhl: 'draftkings',
  icehockey_nhl_preseason: 'draftkings',
  icehockey_ahl: 'draftkings',
  icehockey_liiga: 'draftkings',
  icehockey_mestis: 'draftkings',
  icehockey_sweden_hockey_league: 'draftkings',
  icehockey_sweden_allsvenskan: 'draftkings',
  mma_mixed_martial_arts: 'bet365_au',
  rugbyleague_nrl: 'sportsbet',
  rugbyunion_world_cup: 'williamhill',
  rugbyunion_six_nations: 'williamhill',
  rugbyunion_premiership: 'williamhill',
  rugbyunion_super_rugby: 'williamhill',
  tennis_atp_aus_open_singles: 'bet365_au',
  tennis_atp_french_open: 'bet365_au',
  tennis_atp_wimbledon: 'bet365_au',
  tennis_atp_us_open: 'bet365_au',
  tennis_wta_aus_open_singles: 'bet365_au',
  tennis_wta_french_open: 'bet365_au',
  tennis_wta_wimbledon: 'bet365_au',
  tennis_wta_us_open: 'bet365_au'
  // Add more as needed, default to 'pinnacle' for unlisted
}

class EnhancedOddsFetcher {
  constructor () {
    this.oddsService = new OddsApiService()
    const apiEnabled = this.oddsService.isEnabled
    const hasApiKey = Boolean(config.oddsApi.apiKey)
    const baseUrl = config.oddsApi.baseUrl
    logger.info(`Odds API enabled: ${apiEnabled} | Base URL: ${baseUrl} | API key present: ${hasApiKey}`)
    this.basicMarkets = ['h2h', 'spreads', 'totals']

    // Define comprehensive additional markets by sport category based on Odds API documentation
    this.additionalMarketsBySport = {
      // American Football - NFL & College & CFL & UFL
      americanfootball_nfl: [
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
      americanfootball_ncaaf: [
        'alternate_spreads', 'alternate_totals', 'team_totals', 'alternate_team_totals',
        'h2h_q1', 'h2h_q2', 'h2h_q3', 'h2h_q4', 'h2h_h1', 'h2h_h2',
        'spreads_q1', 'spreads_q2', 'spreads_q3', 'spreads_q4', 'spreads_h1', 'spreads_h2',
        'player_pass_tds', 'player_pass_yds', 'player_rush_yds', 'player_receptions',
        'player_reception_yds', 'player_anytime_td'
      ],
      americanfootball_cfl: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      americanfootball_ufl: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      americanfootball_nfl_preseason: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],

      // Basketball - NBA, College, WNBA, International
      basketball_nba: [
        'alternate_spreads', 'alternate_totals', 'team_totals', 'alternate_team_totals',
        'h2h_q1', 'h2h_q2', 'h2h_q3', 'h2h_q4', 'h2h_h1', 'h2h_h2',
        'spreads_q1', 'spreads_q2', 'spreads_q3', 'spreads_q4', 'spreads_h1', 'spreads_h2',
        'totals_q1', 'totals_q2', 'totals_q3', 'totals_q4', 'totals_h1', 'totals_h2',
        'player_points', 'player_rebounds', 'player_assists', 'player_threes',
        'player_blocks', 'player_steals', 'player_turnovers'
      ],
      basketball_ncaab: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'h2h_h1', 'h2h_h2', 'spreads_h1', 'spreads_h2', 'totals_h1', 'totals_h2',
        'player_points', 'player_rebounds', 'player_assists'
      ],
      basketball_wnba: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'h2h_q1', 'h2h_q2', 'h2h_q3', 'h2h_q4', 'h2h_h1', 'h2h_h2',
        'player_points', 'player_rebounds', 'player_assists'
      ],
      basketball_wncaab: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      basketball_euroleague: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      basketball_nbl: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      basketball_nba_preseason: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      basketball_nba_summer_league: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],

      // Baseball - MLB & International
      baseball_mlb: [
        'alternate_spreads', 'alternate_totals', 'team_totals', 'alternate_team_totals',
        'h2h_f5', 'spreads_f5', 'totals_f5',
        'h2h_f7', 'spreads_f7', 'totals_f7',
        'h2h_i1', 'h2h_i2', 'h2h_i3', 'h2h_i4', 'h2h_i5', 'h2h_i6', 'h2h_i7', 'h2h_i8', 'h2h_i9',
        'player_hits', 'player_total_bases', 'player_rbis', 'player_runs_scored',
        'player_home_runs', 'player_stolen_bases', 'player_strikeouts_pitcher',
        'player_walks', 'player_earned_runs', 'player_pitcher_wins',
        'player_strikeouts_batter', 'player_doubles', 'player_singles'
      ],
      baseball_mlb_preseason: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      baseball_milb: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      baseball_npb: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      baseball_kbo: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      baseball_ncaa: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],

      // Ice Hockey - NHL & International
      icehockey_nhl: [
        'alternate_spreads', 'alternate_totals', 'team_totals', 'alternate_team_totals',
        'h2h_p1', 'h2h_p2', 'h2h_p3', 'spreads_p1', 'spreads_p2', 'spreads_p3',
        'totals_p1', 'totals_p2', 'totals_p3',
        'player_shots_on_goal', 'player_blocked_shots', 'player_points',
        'player_assists', 'player_goals', 'player_power_play_points',
        'player_penalty_minutes', 'player_saves', 'player_goalie_wins'
      ],
      icehockey_nhl_preseason: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      icehockey_ahl: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      icehockey_liiga: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      icehockey_mestis: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      icehockey_sweden_hockey_league: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      icehockey_sweden_allsvenskan: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],

      // Soccer - Major Leagues
      soccer_epl: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'h2h_h1', 'h2h_h2', 'spreads_h1', 'spreads_h2', 'totals_h1', 'totals_h2',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      soccer_spain_la_liga: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'h2h_h1', 'h2h_h2', 'spreads_h1', 'spreads_h2', 'totals_h1', 'totals_h2',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      soccer_italy_serie_a: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'h2h_h1', 'h2h_h2', 'spreads_h1', 'spreads_h2', 'totals_h1', 'totals_h2',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      soccer_germany_bundesliga: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'h2h_h1', 'h2h_h2', 'spreads_h1', 'spreads_h2', 'totals_h1', 'totals_h2',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      soccer_france_ligue_one: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'h2h_h1', 'h2h_h2', 'spreads_h1', 'spreads_h2', 'totals_h1', 'totals_h2',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      soccer_uefa_champs_league: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'h2h_h1', 'h2h_h2', 'spreads_h1', 'spreads_h2', 'totals_h1', 'totals_h2',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      soccer_uefa_europa_league: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      soccer_uefa_nations_league: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      soccer_fifa_world_cup: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      soccer_fifa_world_cup_winner: [
        'outrights'
      ],
      soccer_efl_champ: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      soccer_england_league1: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      soccer_england_league2: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      soccer_fa_cup: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      soccer_league_cup: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      soccer_conmebol_copa_america: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      soccer_brazil_campeonato: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      soccer_argentina_primera_division: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      soccer_mexico_ligamx: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      soccer_usa_mls: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'h2h_h1', 'h2h_h2', 'spreads_h1', 'spreads_h2', 'totals_h1', 'totals_h2',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      soccer_netherlands_eredivisie: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      soccer_belgium_first_div: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      soccer_portugal_primeira_liga: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      soccer_turkey_super_league: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      soccer_greece_super_league: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      soccer_denmark_superliga: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      soccer_sweden_allsvenskan: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      soccer_sweden_superettan: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      soccer_norway_eliteserien: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      soccer_finland_veikkausliiga: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      soccer_poland_ekstraklasa: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      soccer_austria_bundesliga: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      soccer_switzerland_superleague: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      soccer_czech_republic_fnl: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      soccer_russia_premier_league: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      soccer_ukraine_premier_league: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      soccer_croatia_hnl: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      soccer_serbia_super_liga: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      soccer_australia_aleague: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      soccer_japan_j_league: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      soccer_south_korea_k_league_1: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],
      soccer_china_super_league: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'btts', 'draw_no_bet', 'double_chance'
      ],

      // Tennis - Grand Slams
      tennis_atp_aus_open_singles: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      tennis_atp_french_open: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      tennis_atp_wimbledon: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      tennis_atp_us_open: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      tennis_wta_aus_open_singles: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      tennis_wta_french_open: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      tennis_wta_wimbledon: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      tennis_wta_us_open: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],

      // Golf - Major Tournaments
      golf_pga_championship: [
        'outrights', 'top_5_finish', 'top_10_finish', 'top_20_finish',
        'make_cut', 'first_round_leader'
      ],
      golf_masters_tournament: [
        'outrights', 'top_5_finish', 'top_10_finish', 'top_20_finish',
        'make_cut', 'first_round_leader'
      ],
      golf_us_open: [
        'outrights', 'top_5_finish', 'top_10_finish', 'top_20_finish',
        'make_cut', 'first_round_leader'
      ],
      golf_the_open_championship: [
        'outrights', 'top_5_finish', 'top_10_finish', 'top_20_finish',
        'make_cut', 'first_round_leader'
      ],

      // MMA - Major Promotions
      mma_mixed_martial_arts: [
        'alternate_spreads', 'alternate_totals', 'team_totals',
        'method_of_victory', 'round_betting', 'fight_duration'
      ],

      // Cricket - International & Domestic
      cricket_icc_world_cup: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      cricket_international_t20: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      cricket_odi: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      cricket_test_match: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      cricket_ipl: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      cricket_big_bash: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      cricket_caribbean_premier_league: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],

      // Rugby - International & Domestic
      rugbyleague_nrl: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      rugbyunion_world_cup: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      rugbyunion_six_nations: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      rugbyunion_premiership: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      rugbyunion_super_rugby: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],

      // Aussie Rules
      aussierules_afl: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],

      // Boxing
      boxing_heavyweight: [
        'method_of_victory', 'round_betting', 'fight_duration'
      ],

      // Esports
      esports_lol_worlds: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      esports_valorant_champions: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      esports_dota2_ti: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      esports_csgo_blast_premier: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],
      esports_call_of_duty: [
        'alternate_spreads', 'alternate_totals', 'team_totals'
      ],

      // Default for other sports - basic additional markets
      default: ['alternate_spreads', 'alternate_totals', 'team_totals']
    }
  }

  /**
   * Get markets for sport-level fetch (featured markets only)
   */
  getComprehensiveMarkets (sportKey) {
    // Per The Odds API docs, the /sports/{sport}/odds endpoint
    // should only be used with featured markets (h2h, spreads, totals, outrights).
    // Additional markets must be requested per-event.
    return this.getBasicMarkets(sportKey)
  }

  /**
   * Get additional markets for a specific sport
   */
  getAdditionalMarkets (sportKey) {
    const custom = this.additionalMarketsBySport[sportKey]
    if (Array.isArray(custom) && custom.length > 0) return custom
    if (this.oddsService && typeof this.oddsService.getPriorityMarkets === 'function') {
      try {
        return this.oddsService.getPriorityMarkets()
      } catch (_) {}
    }
    return this.additionalMarketsBySport.default
  }

  /**
   * Get preferred bookmaker for a sport
   */
  getPreferredBookmaker (sportKey) {
    if (!sportKey || typeof sportKey !== 'string') return 'pinnacle'
    return PREFERRED_BOOKMAKERS[sportKey] || 'pinnacle'
  }

  /**
   * Check if additional markets are supported for a sport
   */
  async checkAdditionalMarketSupport (sportKey, additionalMarkets, sampleEventId = null) {
    try {
      logger.info(`Checking additional market support for ${sportKey}...`)

      if (!sampleEventId) {
        logger.warn(`No sample event available for ${sportKey}; skipping additional market support check`)
        return { supported: false, reason: 'No sample event to test markets' }
      }

      // Per docs, additional markets must be accessed per-event
      await this.oddsService.client.get(`/sports/${sportKey}/events/${sampleEventId}/odds`, {
        params: {
          apiKey: config.oddsApi.apiKey,
          regions: 'us,us2,uk,au',
          markets: additionalMarkets.slice(0, 2).join(','),
          oddsFormat: 'decimal',
          dateFormat: 'iso',
          includeLinks: false
        }
      })

      logger.info(`✓ Additional markets supported for ${sportKey}`)
      return { supported: true, markets: additionalMarkets }
    } catch (error) {
      if (error.response?.status === 422) {
        const errorData = error.response.data
        if (errorData.message && errorData.message.includes('Markets not supported')) {
          logger.warn(`✗ Additional markets not supported for ${sportKey}: ${errorData.message}`)
          return { supported: false, reason: errorData.message }
        }
      }

      logger.error(`Error checking market support for ${sportKey}:`, error.message)
      return { supported: false, reason: error.message }
    }
  }

  /**
   * Determine basic markets to fetch per sport, prioritizing winner (h2h, h2h_3_way)
   */
  getBasicMarkets (sportKey) {
    if (typeof sportKey !== 'string') return this.basicMarkets

    // Use only officially supported featured markets per API docs
    if (sportKey.startsWith('soccer_')) {
      return ['h2h', 'spreads', 'totals']
    }

    if (sportKey.startsWith('icehockey_')) {
      return ['h2h', 'spreads', 'totals']
    }

    // Tennis typically only has match winner
    if (sportKey.startsWith('tennis_')) {
      return ['h2h']
    }

    // Default basic markets
    return this.basicMarkets
  }

  /**
   * Fetch comprehensive odds for a sport using sport-specific bookmaker
   */
  async fetchComprehensiveOdds (sportKey, sportTitle) {
    try {
      logger.info(`\n=== Fetching Comprehensive Odds for ${sportTitle} (${sportKey}) ===`)

      const bookmaker = this.getPreferredBookmaker(sportKey)
      logger.info(`Using preferred bookmaker ${bookmaker} for ${sportKey}`)

      const featuredMarkets = this.getComprehensiveMarkets(sportKey)
      logger.info(`Featured markets for ${sportKey}: ${featuredMarkets.join(', ')}`)

      let games = []
      try {
        games = await this.oddsService._fetchAndSaveOddsForMarketsBatch(
          sportKey,
          featuredMarkets,
          bookmaker
        )
      } catch (apiErr) {
        const status = apiErr.response?.status
        const data = apiErr.response?.data
        logger.error(`API error during odds fetch for ${sportKey}: status=${status} message=${apiErr.message} data=${JSON.stringify(data)}`)
        return []
      }

      logger.info(`✓ Fetched ${games.length} games with comprehensive markets for ${sportKey}`)

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
        }))

        await Match.bulkWrite(matchBulkOps, { ordered: false })
        logger.info(`✓ Saved ${games.length} match records for ${sportKey}`)
      }

      return games
    } catch (error) {
      const status = error.response?.status
      const data = error.response?.data
      logger.error(`Error fetching basic odds for ${sportKey}: status=${status} message=${error.message}`)
      if (data) {
        try { logger.error(`Error data: ${JSON.stringify(data)}`) } catch (_) {}
      }
      return []
    }
  }

  /**
   * Fetch additional markets using event-specific endpoints
   */
  async fetchAdditionalMarkets (sportKey, games, additionalMarkets) {
    try {
      logger.info(`\n=== Fetching Additional Markets for ${sportKey} ===`)
      logger.info(`Markets to fetch: ${additionalMarkets.join(', ')}`)

      const eventIds = games.map(game => game.id)

      const result = await this.oddsService.upsertAdditionalMarkets(
        sportKey,
        eventIds,
        additionalMarkets
      )

      logger.info(`✓ Additional markets result for ${sportKey}:`)
      logger.info(`  - Successful: ${result.successful.length}`)
      logger.info(`  - Failed: ${result.failed.length}`)
      logger.info(`  - Total markets added: ${result.marketsAdded}`)

      return result
    } catch (error) {
      logger.error(`Error fetching additional markets for ${sportKey}:`, error.message)
      return { successful: [], failed: [], marketsAdded: 0 }
    }
  }

  /**
   * Process a single sport with the enhanced workflow
   */
  async processSport (sportKey, sportTitle) {
    try {
      logger.info(`\n🏈 Processing Sport: ${sportTitle} (${sportKey})`)

      const result = {
        sportKey,
        sportTitle,
        basicOdds: 0,
        additionalMarkets: 0,
        totalGames: 0,
        marketSupport: null,
        errors: []
      }

      // Step 1: Fetch comprehensive odds (basic + additional markets)
      const games = await this.fetchComprehensiveOdds(sportKey, sportTitle)

      // Validate that fetched games actually have the mandatory basic markets
      const basicMarketsList = this.getBasicMarkets(sportKey)
      const validGames = games.filter(game => {
        const hasBookmakers = Array.isArray(game.bookmakers) && game.bookmakers.length > 0
        if (!hasBookmakers) return false

        // Check if at least one bookmaker has at least one of the basic markets
        // We don't enforce ALL basic markets because some might be missing for specific games (e.g. no spreads yet)
        // But we want to ensure we have *some* odds.
        return game.bookmakers.some(bm =>
          Array.isArray(bm.markets) && bm.markets.some(m => basicMarketsList.includes(m.key))
        )
      })

      if (games.length > 0 && validGames.length < games.length) {
        logger.warn(`⚠️  ${games.length - validGames.length} games fetched without basic markets for ${sportKey}`)
      }

      result.basicOdds = validGames.length
      result.totalGames = games.length // Keep total count of games found

      if (validGames.length === 0) {
        if (games.length > 0) {
          logger.warn(`No games with valid basic markets found for ${sportKey} (found ${games.length} raw games), skipping additional markets`)
        } else {
          logger.warn(`No games found for ${sportKey}, skipping additional markets`)
        }
        return result
      }

      // Use only valid games for additional markets
      const gamesToProcess = validGames

      // Filter out fallback games from additional markets fetch
      const gamesForAdditionalMarkets = gamesToProcess.filter(g => !g.id.toString().startsWith('fallback_'))

      if (gamesForAdditionalMarkets.length < gamesToProcess.length) {
        logger.info(`Skipping additional markets for ${gamesToProcess.length - gamesForAdditionalMarkets.length} fallback games`)
      }

      // Step 2: Check additional market support using a sample event id
      const additionalMarkets = this.getAdditionalMarkets(sportKey)

      // Only check support if we have real games
      if (gamesForAdditionalMarkets.length === 0) {
        logger.info(`No real games available for ${sportKey}, skipping additional markets fetch`)
        result.additionalMarkets = 0
        return result
      }

      const sampleEventId = gamesForAdditionalMarkets[0]?.id || null
      const supportCheck = await this.checkAdditionalMarketSupport(sportKey, additionalMarkets, sampleEventId)
      result.marketSupport = supportCheck

      if (!supportCheck.supported) {
        logger.warn(`Additional market support check failed for ${sportKey}: ${supportCheck.reason}. Proceeding to attempt per-event upsert.`)
      }

      // Step 3: Fetch additional markets using event-specific endpoints
      const additionalResult = await this.fetchAdditionalMarkets(sportKey, gamesForAdditionalMarkets, additionalMarkets)
      result.additionalMarkets = additionalResult.marketsAdded

      // Rate limiting between sports
      await new Promise(resolve => setTimeout(resolve, 2000))

      logger.info(`✅ Completed processing ${sportKey}`)
      return result
    } catch (error) {
      logger.error(`❌ Error processing sport ${sportKey}:`, error.message)
      return {
        sportKey,
        sportTitle,
        basicOdds: 0,
        additionalMarkets: 0,
        totalGames: 0,
        marketSupport: null,
        errors: [error.message]
      }
    }
  }

  /**
   * Process multiple sports with enhanced workflow
   */
  async processMultipleSports (sports) {
    const results = []

    logger.info(`\n🚀 Starting Enhanced Odds Fetching for ${sports.length} sports`)

    for (const sport of sports) {
      const result = await this.processSport(sport.key, sport.title)
      results.push(result)
    }

    // Summary
    const summary = {
      totalSports: sports.length,
      totalGames: results.reduce((sum, r) => sum + r.totalGames, 0),
      totalComprehensiveOdds: results.reduce((sum, r) => sum + r.basicOdds, 0),
      totalAdditionalMarkets: results.reduce((sum, r) => sum + r.additionalMarkets, 0),
      sportsWithAdditionalMarkets: results.filter(r => r.additionalMarkets > 0).length,
      errors: results.filter(r => r.errors.length > 0).length
    }

    logger.info('\n📊 Comprehensive Odds Fetch Summary:')
    logger.info(`  - Sports processed: ${summary.totalSports}`)
    logger.info(`  - Total games: ${summary.totalGames}`)
    logger.info(`  - Comprehensive odds fetched: ${summary.totalComprehensiveOdds}`)
    logger.info(`  - Additional markets added: ${summary.totalAdditionalMarkets}`)
    logger.info(`  - Sports with additional markets: ${summary.sportsWithAdditionalMarkets}`)
    logger.info(`  - Sports with errors: ${summary.errors}`)

    return { results, summary }
  }
}

/**
 * Main execution function
 */
async function main () {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI)
    logger.info('Connected to MongoDB')

    const fetcher = new EnhancedOddsFetcher()

    // Fetch full sports list from API
    const apiSportsList = await fetcher.oddsService.getSports()
    let sports = (Array.isArray(apiSportsList) ? apiSportsList : [])
      .filter(s => s && s.key && !s.key.includes('politics') && !s.key.includes('entertainment'))
      .map(s => ({ key: s.key, title: s.title || s.group || s.key }))

    // Basic CLI arg parsing for filtering and limiting
    const argv = process.argv.slice(2)
    const getArg = (name) => {
      const idx = argv.findIndex(a => a === `--${name}`)
      if (idx !== -1 && argv[idx + 1]) return argv[idx + 1]
      const inline = argv.find(a => a.startsWith(`--${name}=`))
      return inline ? inline.split('=')[1] : null
    }

    const sportsArg = getArg('sports')
    if (sportsArg) {
      const keys = sportsArg.split(',').map(s => s.trim())
      sports = sports.filter(s => keys.includes(s.key))
      logger.info(`CLI filter applied. Processing ${sports.length} sport(s): ${keys.join(', ')}`)
    }

    const limitArg = getArg('limit')
    if (limitArg) {
      const n = parseInt(limitArg, 10)
      if (!Number.isNaN(n) && n > 0) {
        sports = sports.slice(0, n)
        logger.info(`CLI limit applied. Processing first ${n} sport(s).`)
      }
    }

    // Process all sports with enhanced workflow
    await fetcher.processMultipleSports(sports)

    logger.info('\n🎉 Enhanced odds fetching completed successfully!')

    // Allow pending async database operations to complete (e.g. _storeOddsAsync)
    logger.info('Waiting for pending database operations...')
    await new Promise(resolve => setTimeout(resolve, 5000))

    await mongoose.disconnect()
    logger.info('Disconnected from MongoDB')
  } catch (error) {
    logger.error('Fatal error in enhanced odds fetching:', error)
    process.exit(1)
  }
}

// Export for use in other modules
module.exports = {
  EnhancedOddsFetcher,
  main
}

// Run if called directly
if (require.main === module) {
  main()
}
