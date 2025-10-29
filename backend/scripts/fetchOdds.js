require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
// Logger removed during cleanup - using console for now
const { OddsApiService } = require('../services/oddsApiService');
const Odds = require('../models/Odds');
const Match = require('../models/Match');
const Results = require('../models/Results');
const Scores = require('../models/Scores');
// Removed unused matchDataEnricher import

/**
 * Get sport-specific markets based on The Odds API documentation and oddsmarketsmapping.js
 * Comprehensive market coverage including player props, alternate lines, and period markets
 * Reference: https://the-odds-api.com/sports-odds-data/betting-markets.html
 */
function getSportSpecificMarkets(sportKey) {
  // Sport-specific market mappings based on The Odds API documentation and oddsmarketsmapping.js
  const sportMarkets = {
    // NFL - Comprehensive markets including all player props and period markets
    'americanfootball_nfl': [
      // Featured markets
      'h2h', 'spreads', 'totals', 'alternate_spreads', 'alternate_totals', 'team_totals', 'alternate_team_totals',
      
      // Period markets - Quarters and Halves
      'h2h_q1', 'h2h_q2', 'h2h_q3', 'h2h_q4', 'h2h_h1', 'h2h_h2',
      'spreads_q1', 'spreads_q2', 'spreads_q3', 'spreads_q4', 'spreads_h1', 'spreads_h2',
      'totals_q1', 'totals_q2', 'totals_q3', 'totals_q4', 'totals_h1', 'totals_h2',
      'team_totals_q1', 'team_totals_q2', 'team_totals_q3', 'team_totals_q4', 'team_totals_h1', 'team_totals_h2',
      'alternate_spreads_q1', 'alternate_spreads_q2', 'alternate_spreads_q3', 'alternate_spreads_q4', 'alternate_spreads_h1', 'alternate_spreads_h2',
      'alternate_totals_q1', 'alternate_totals_q2', 'alternate_totals_q3', 'alternate_totals_q4', 'alternate_totals_h1', 'alternate_totals_h2',
      'alternate_team_totals_q1', 'alternate_team_totals_q2', 'alternate_team_totals_q3', 'alternate_team_totals_q4', 'alternate_team_totals_h1', 'alternate_team_totals_h2',
      
      // Player props - Passing
      'player_pass_tds', 'player_pass_yds', 'player_pass_attempts', 'player_pass_completions', 'player_pass_interceptions', 'player_pass_longest_completion',
      'player_pass_tds_alternate', 'player_pass_yds_alternate', 'player_pass_attempts_alternate', 'player_pass_completions_alternate', 'player_pass_interceptions_alternate', 'player_pass_longest_completion_alternate',
      
      // Player props - Rushing
      'player_rush_yds', 'player_rush_tds', 'player_rush_attempts', 'player_rush_longest',
      'player_rush_yds_alternate', 'player_rush_tds_alternate', 'player_rush_attempts_alternate', 'player_rush_longest_alternate',
      
      // Player props - Receiving
      'player_reception_yds', 'player_reception_tds', 'player_receptions', 'player_reception_longest',
      'player_reception_yds_alternate', 'player_reception_tds_alternate', 'player_receptions_alternate', 'player_reception_longest_alternate',
      
      // Player props - Combined and special
      'player_pass_rush_yds', 'player_pass_rush_reception_tds', 'player_pass_rush_reception_yds', 'player_rush_reception_tds', 'player_rush_reception_yds',
      'player_pass_rush_yds_alternate', 'player_pass_rush_reception_tds_alternate', 'player_pass_rush_reception_yds_alternate', 'player_rush_reception_tds_alternate', 'player_rush_reception_yds_alternate',
      
      // Player props - Touchdowns
      'player_anytime_td', 'player_1st_td', 'player_last_td', 'player_tds_over',
      
      // Player props - Defense and special teams
      'player_sacks', 'player_solo_tackles', 'player_tackles_assists', 'player_defensive_interceptions',
      'player_sacks_alternate', 'player_solo_tackles_alternate', 'player_tackles_assists_alternate',
      
      // Player props - Kicking
      'player_field_goals', 'player_kicking_points', 'player_pats',
      'player_field_goals_alternate', 'player_kicking_points_alternate', 'player_pats_alternate'
    ],
    
    // College Football - Similar to NFL but fewer player props
    'americanfootball_ncaaf': [
      'h2h', 'spreads', 'totals', 'alternate_spreads', 'alternate_totals', 'team_totals',
      'h2h_q1', 'h2h_q2', 'h2h_q3', 'h2h_q4', 'h2h_h1', 'h2h_h2',
      'spreads_q1', 'spreads_q2', 'spreads_q3', 'spreads_q4', 'spreads_h1', 'spreads_h2',
      'totals_q1', 'totals_q2', 'totals_q3', 'totals_q4', 'totals_h1', 'totals_h2',
      'player_pass_tds', 'player_pass_yds', 'player_rush_yds', 'player_reception_yds', 'player_anytime_td'
    ],
    
    // CFL - Enhanced markets
    'americanfootball_cfl': [
      'h2h', 'spreads', 'totals', 'alternate_spreads', 'alternate_totals',
      'h2h_h1', 'h2h_h2', 'spreads_h1', 'spreads_h2', 'totals_h1', 'totals_h2'
    ],
    
    // NBA - Comprehensive markets including all player props and period markets
    'basketball_nba': [
      // Featured markets
      'h2h', 'spreads', 'totals', 'alternate_spreads', 'alternate_totals', 'team_totals', 'alternate_team_totals',
      
      // Period markets - Quarters and Halves
      'h2h_q1', 'h2h_q2', 'h2h_q3', 'h2h_q4', 'h2h_h1', 'h2h_h2',
      'spreads_q1', 'spreads_q2', 'spreads_q3', 'spreads_q4', 'spreads_h1', 'spreads_h2',
      'totals_q1', 'totals_q2', 'totals_q3', 'totals_q4', 'totals_h1', 'totals_h2',
      'team_totals_q1', 'team_totals_q2', 'team_totals_q3', 'team_totals_q4', 'team_totals_h1', 'team_totals_h2',
      'alternate_spreads_q1', 'alternate_spreads_q2', 'alternate_spreads_q3', 'alternate_spreads_q4', 'alternate_spreads_h1', 'alternate_spreads_h2',
      'alternate_totals_q1', 'alternate_totals_q2', 'alternate_totals_q3', 'alternate_totals_q4', 'alternate_totals_h1', 'alternate_totals_h2',
      'alternate_team_totals_q1', 'alternate_team_totals_q2', 'alternate_team_totals_q3', 'alternate_team_totals_q4', 'alternate_team_totals_h1', 'alternate_team_totals_h2',
      
      // Player props - Basic stats
      'player_points', 'player_rebounds', 'player_assists', 'player_threes', 'player_blocks', 'player_steals', 'player_turnovers',
      'player_points_alternate', 'player_rebounds_alternate', 'player_assists_alternate', 'player_threes_alternate', 'player_blocks_alternate', 'player_steals_alternate', 'player_turnovers_alternate',
      
      // Player props - Combined stats
      'player_points_rebounds_assists', 'player_points_rebounds', 'player_points_assists', 'player_rebounds_assists',
      'player_points_rebounds_assists_alternate', 'player_points_rebounds_alternate', 'player_points_assists_alternate', 'player_rebounds_assists_alternate',
      
      // Player props - Special achievements
      'player_double_double', 'player_triple_double', 'player_first_basket', 'player_first_team_basket', 'player_method_of_first_basket',
      
      // Player props - Quarter specific
      'player_points_q1', 'player_rebounds_q1', 'player_assists_q1',
      
      // Player props - Field goals and free throws
      'player_field_goals', 'player_frees_made', 'player_frees_attempts'
    ],
    
    // College Basketball - Similar to NBA but fewer player props
    'basketball_ncaab': [
      'h2h', 'spreads', 'totals', 'alternate_spreads', 'alternate_totals',
      'h2h_h1', 'h2h_h2', 'spreads_h1', 'spreads_h2', 'totals_h1', 'totals_h2',
      'player_points', 'player_rebounds', 'player_assists', 'player_threes'
    ],
    
    // WNBA - Similar to NBA
    'basketball_wnba': [
      'h2h', 'spreads', 'totals', 'alternate_spreads', 'alternate_totals',
      'h2h_h1', 'h2h_h2', 'spreads_h1', 'spreads_h2', 'totals_h1', 'totals_h2',
      'player_points', 'player_rebounds', 'player_assists', 'player_threes', 'player_double_double'
    ],
    
    // Euroleague Basketball - Enhanced markets
    'basketball_euroleague': [
      'h2h', 'spreads', 'totals', 'alternate_spreads', 'alternate_totals',
      'h2h_h1', 'h2h_h2', 'spreads_h1', 'spreads_h2', 'totals_h1', 'totals_h2'
    ],
    
    // MLB - Comprehensive markets including all player props and innings
    'baseball_mlb': [
      // Featured markets
      'h2h', 'spreads', 'totals', 'alternate_spreads', 'alternate_totals', 'team_totals', 'alternate_team_totals',
      
      // Period markets - Innings
      'h2h_1st_1_innings', 'h2h_1st_3_innings', 'h2h_1st_5_innings', 'h2h_1st_7_innings',
      'h2h_3_way_1st_1_innings', 'h2h_3_way_1st_3_innings', 'h2h_3_way_1st_5_innings', 'h2h_3_way_1st_7_innings',
      'spreads_1st_1_innings', 'spreads_1st_3_innings', 'spreads_1st_5_innings', 'spreads_1st_7_innings',
      'totals_1st_1_innings', 'totals_1st_3_innings', 'totals_1st_5_innings', 'totals_1st_7_innings',
      'alternate_spreads_1st_1_innings', 'alternate_spreads_1st_3_innings', 'alternate_spreads_1st_5_innings', 'alternate_spreads_1st_7_innings',
      'alternate_totals_1st_1_innings', 'alternate_totals_1st_3_innings', 'alternate_totals_1st_5_innings', 'alternate_totals_1st_7_innings',
      
      // Batter props
      'batter_home_runs', 'batter_hits', 'batter_total_bases', 'batter_rbis', 'batter_runs_scored', 'batter_walks', 'batter_strikeouts', 'batter_stolen_bases',
      'batter_singles', 'batter_doubles', 'batter_triples', 'batter_hits_runs_rbis', 'batter_first_home_run',
      'batter_home_runs_alternate', 'batter_hits_alternate', 'batter_total_bases_alternate', 'batter_rbis_alternate', 'batter_runs_scored_alternate',
      'batter_walks_alternate', 'batter_strikeouts_alternate', 'batter_singles_alternate', 'batter_doubles_alternate', 'batter_triples_alternate',
      
      // Pitcher props
      'pitcher_strikeouts', 'pitcher_hits_allowed', 'pitcher_walks', 'pitcher_earned_runs', 'pitcher_outs', 'pitcher_record_a_win',
      'pitcher_strikeouts_alternate', 'pitcher_hits_allowed_alternate', 'pitcher_walks_alternate'
    ],
    
    // NHL - Comprehensive markets including all player props and periods
    'icehockey_nhl': [
      // Featured markets
      'h2h', 'spreads', 'totals', 'alternate_spreads', 'alternate_totals', 'team_totals', 'alternate_team_totals',
      
      // Period markets - Periods
      'h2h_p1', 'h2h_p2', 'h2h_p3', 'h2h_3_way_p1', 'h2h_3_way_p2', 'h2h_3_way_p3',
      'spreads_p1', 'spreads_p2', 'spreads_p3', 'totals_p1', 'totals_p2', 'totals_p3',
      'team_totals_p1', 'team_totals_p2', 'team_totals_p3',
      'alternate_spreads_p1', 'alternate_spreads_p2', 'alternate_spreads_p3',
      'alternate_totals_p1', 'alternate_totals_p2', 'alternate_totals_p3',
      'alternate_team_totals_p1', 'alternate_team_totals_p2', 'alternate_team_totals_p3',
      
      // Player props - Scoring
      'player_points', 'player_goals', 'player_assists', 'player_power_play_points',
      'player_points_alternate', 'player_goals_alternate', 'player_assists_alternate', 'player_power_play_points_alternate',
      
      // Player props - Other stats
      'player_shots_on_goal', 'player_blocked_shots', 'player_total_saves',
      'player_shots_on_goal_alternate', 'player_blocked_shots_alternate', 'player_total_saves_alternate',
      
      // Player props - Goal scoring
      'player_goal_scorer_first', 'player_goal_scorer_last', 'player_goal_scorer_anytime'
    ],
    
    // Soccer - Enhanced markets for major leagues with comprehensive player props
    'soccer_epl': [
      'h2h', 'spreads', 'totals', 'h2h_3_way', 'draw_no_bet', 'btts', 'double_chance',
      'h2h_h1', 'h2h_h2', 'h2h_3_way_h1', 'h2h_3_way_h2', 'totals_h1', 'totals_h2',
      'alternate_spreads_corners', 'alternate_totals_corners', 'alternate_spreads_cards', 'alternate_totals_cards',
      'player_shots_on_target', 'player_shots', 'player_assists', 'player_goal_scorer_anytime',
      'player_first_goal_scorer', 'player_last_goal_scorer', 'player_to_receive_card', 'player_to_receive_red_card'
    ],
    'soccer_spain_la_liga': [
      'h2h', 'spreads', 'totals', 'h2h_3_way', 'draw_no_bet', 'btts', 'double_chance',
      'h2h_h1', 'h2h_h2', 'h2h_3_way_h1', 'h2h_3_way_h2', 'totals_h1', 'totals_h2',
      'alternate_spreads_corners', 'alternate_totals_corners', 'alternate_spreads_cards', 'alternate_totals_cards',
      'player_shots_on_target', 'player_shots', 'player_assists', 'player_goal_scorer_anytime',
      'player_first_goal_scorer', 'player_last_goal_scorer', 'player_to_receive_card', 'player_to_receive_red_card'
    ],
    'soccer_germany_bundesliga': [
      'h2h', 'spreads', 'totals', 'h2h_3_way', 'draw_no_bet', 'btts', 'double_chance',
      'h2h_h1', 'h2h_h2', 'h2h_3_way_h1', 'h2h_3_way_h2', 'totals_h1', 'totals_h2',
      'alternate_spreads_corners', 'alternate_totals_corners', 'alternate_spreads_cards', 'alternate_totals_cards',
      'player_shots_on_target', 'player_shots', 'player_assists', 'player_goal_scorer_anytime',
      'player_first_goal_scorer', 'player_last_goal_scorer', 'player_to_receive_card', 'player_to_receive_red_card'
    ],
    'soccer_italy_serie_a': [
      'h2h', 'spreads', 'totals', 'h2h_3_way', 'draw_no_bet', 'btts', 'double_chance',
      'h2h_h1', 'h2h_h2', 'h2h_3_way_h1', 'h2h_3_way_h2', 'totals_h1', 'totals_h2',
      'alternate_spreads_corners', 'alternate_totals_corners', 'alternate_spreads_cards', 'alternate_totals_cards',
      'player_shots_on_target', 'player_shots', 'player_assists', 'player_goal_scorer_anytime',
      'player_first_goal_scorer', 'player_last_goal_scorer', 'player_to_receive_card', 'player_to_receive_red_card'
    ],
    'soccer_france_ligue_one': [
      'h2h', 'spreads', 'totals', 'h2h_3_way', 'draw_no_bet', 'btts', 'double_chance',
      'h2h_h1', 'h2h_h2', 'h2h_3_way_h1', 'h2h_3_way_h2', 'totals_h1', 'totals_h2',
      'alternate_spreads_corners', 'alternate_totals_corners', 'alternate_spreads_cards', 'alternate_totals_cards',
      'player_shots_on_target', 'player_shots', 'player_assists', 'player_goal_scorer_anytime',
      'player_first_goal_scorer', 'player_last_goal_scorer', 'player_to_receive_card', 'player_to_receive_red_card'
    ],
    'soccer_usa_mls': [
      'h2h', 'spreads', 'totals', 'h2h_3_way', 'draw_no_bet', 'btts', 'double_chance',
      'h2h_h1', 'h2h_h2', 'h2h_3_way_h1', 'h2h_3_way_h2', 'totals_h1', 'totals_h2',
      'player_shots_on_target', 'player_shots', 'player_assists', 'player_goal_scorer_anytime',
      'player_first_goal_scorer', 'player_last_goal_scorer', 'player_to_receive_card'
    ],
    'soccer_uefa_champs_league': [
      'h2h', 'spreads', 'totals', 'h2h_3_way', 'draw_no_bet', 'btts', 'double_chance',
      'h2h_h1', 'h2h_h2', 'h2h_3_way_h1', 'h2h_3_way_h2', 'totals_h1', 'totals_h2',
      'player_goal_scorer_anytime', 'player_first_goal_scorer', 'player_last_goal_scorer'
    ],
    
    // AFL - Australian Football League
    'aussierules_afl': [
      'h2h', 'spreads', 'totals',
      'player_disposals', 'player_disposals_over', 'player_goal_scorer_first', 'player_goal_scorer_last',
      'player_goal_scorer_anytime', 'player_goals_scored_over', 'player_marks_over', 'player_marks_most',
      'player_tackles_over', 'player_tackles_most', 'player_afl_fantasy_points', 'player_afl_fantasy_points_over', 'player_afl_fantasy_points_most'
    ],
    
    // Rugby League
    'rugbyleague_nrl': [
      'h2h', 'spreads', 'totals',
      'player_try_scorer_first', 'player_try_scorer_last', 'player_try_scorer_anytime', 'player_try_scorer_over'
    ],
    
    // Tennis markets - h2h only (no spreads/totals typically)
    'tennis_atp': ['h2h'],
    'tennis_wta': ['h2h'],
    'tennis_atp_doubles': ['h2h'],
    'tennis_wta_doubles': ['h2h'],
    
    // Golf markets - outrights only
    'golf_pga': ['outrights'],
    'golf_masters': ['outrights'],
    'golf_the_open_championship': ['outrights'],
    'golf_us_open': ['outrights'],
    'golf_pga_championship': ['outrights'],
    
    // MMA markets - h2h only
    'mma_mixed_martial_arts': ['h2h'],
    
    // Boxing markets - h2h only
    'boxing_heavyweight': ['h2h']
  };
  
  // Check if we have specific markets for this sport
  if (sportMarkets[sportKey]) {
    return sportMarkets[sportKey];
  }
  
  // Enhanced fallback logic for sport categories
  // For soccer sports, use enhanced soccer markets with 3-way betting
  if (sportKey.startsWith('soccer_')) {
    return ['h2h', 'spreads', 'totals', 'h2h_3_way', 'draw_no_bet', 'btts', 'h2h_h1', 'h2h_h2'];
  }
  
  // For American football sports, use enhanced football markets
  if (sportKey.startsWith('americanfootball_')) {
    return ['h2h', 'spreads', 'totals', 'alternate_spreads', 'alternate_totals', 'h2h_h1', 'h2h_h2'];
  }
  
  // For basketball sports, use enhanced basketball markets
  if (sportKey.startsWith('basketball_')) {
    return ['h2h', 'spreads', 'totals', 'alternate_spreads', 'alternate_totals', 'h2h_h1', 'h2h_h2'];
  }
  
  // For baseball sports, use enhanced baseball markets
  if (sportKey.startsWith('baseball_')) {
    return ['h2h', 'spreads', 'totals', 'alternate_spreads', 'alternate_totals'];
  }
  
  // For hockey sports, use enhanced hockey markets
  if (sportKey.startsWith('icehockey_')) {
    return ['h2h', 'spreads', 'totals', 'alternate_spreads', 'alternate_totals'];
  }
  
  // For tennis sports, use h2h only
  if (sportKey.startsWith('tennis_')) {
    return ['h2h'];
  }
  
  // For golf sports, use outrights only
  if (sportKey.startsWith('golf_')) {
    return ['outrights'];
  }
  
  // For MMA/boxing, use h2h only
  if (sportKey.includes('mma') || sportKey.includes('boxing')) {
    return ['h2h'];
  }
  
  // Default to basic markets for unknown sports
  return ['h2h', 'spreads', 'totals'];
}

async function main() {
  const mongoURI = process.env.MONGODB_URI;
  
  if (!mongoURI) {
    throw new Error('MONGODB_URI environment variable is required');
  }
  await mongoose.connect(mongoURI);
  console.log('Connected to MongoDB');

  // Clear existing data
  await Odds.deleteMany({});
  await Match.deleteMany({});
  await Results.deleteMany({});
  await Scores.deleteMany({});
  console.log('Cleared existing Odds, Match, Results, and Scores collections');

  const service = new OddsApiService();
  if (!service.isEnabled) {
    console.error('OddsApiService is disabled (missing ODDS_API_KEY or base URL).');
    await mongoose.disconnect();
    process.exit(1);
  }
  
  let sports;
  try {
    sports = await service.getSports();
    console.log(`Successfully fetched ${sports.length} sports from API`);
  } catch (error) {
    console.error('Failed to fetch sports from API:', error.message);
    if (error.response) {
      console.error('API Response Status:', error.response.status);
      console.error('API Response Data:', error.response.data);
    }
    await mongoose.disconnect();
    process.exit(1);
  }
  const supportedSports = sports.filter(sport =>
    !sport.key.includes('politics') &&
    !sport.key.includes('entertainment') &&
    sport.key !== 'golf_the_open_championship_winner'
  );

  console.log(`Processing ${supportedSports.length} supported sports`);

  for (const sport of supportedSports) {
    try {
      console.log(`Fetching and saving odds for sport: ${sport.title} (${sport.key})`);

      // Get sport-specific markets to avoid API errors
      const sportSpecificMarkets = getSportSpecificMarkets(sport.key);
      
      console.log(`Fetching ${sportSpecificMarkets.length} sport-specific markets for ${sport.key}: ${sportSpecificMarkets.join(', ')}`);
      const games = await service._fetchAndSaveOddsForMarketsBatch(sport.key, sportSpecificMarkets);

      const rateInfo = service.getLastRateLimitInfo ? service.getLastRateLimitInfo() : null;
      if (rateInfo) {
        console.log('Rate limit info:', rateInfo);
      }

      console.log(`Fetched ${games.length} events for ${sport.key}`);

      if (games.length > 0) {
        // Save to Match collection (frontend expects this format)
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
        console.log(`Saved ${games.length} match records for ${sport.key}`);
      }

      // Wait a moment for async storage to complete before verification
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verification: ensure odds were saved for this sport (from SimpleFetchAndVerify)
      const sportOddsCount = await Odds.countDocuments({ sport_key: sport.key });
      console.log(`Odds documents saved for ${sport.key}: ${sportOddsCount}`);
      const sample = await Odds.findOne({ sport_key: sport.key }).lean();
      if (sample) {
        console.log('Sample saved odds document summary:', {
          gameId: sample.gameId,
          commence_time: sample.commence_time,
          home_team: sample.home_team,
          away_team: sample.away_team,
          bookmaker_count: Array.isArray(sample.bookmakers) ? sample.bookmakers.length : 0,
        });
      } else {
        console.log(`No odds documents found for sport ${sport.key}.`);
      }

      // Fetch and store results data (completed games)
      try {
        console.log(`Fetching results for ${sport.key}...`);
        const results = await service.getResults(sport.key, 7); // Get results from last 7 days
        console.log(`Fetched ${results.length} results for ${sport.key}`);
        
        // Verify results were stored
        const resultsCount = await Results.countDocuments({ sport_key: sport.key });
        console.log(`Results documents saved for ${sport.key}: ${resultsCount}`);
      } catch (error) {
        console.error(`Error fetching results for ${sport.key}:`, error.message);
      }

      // Fetch and store scores data (live and recent games)
      try {
        console.log(`Fetching scores for ${sport.key}...`);
        const scores = await service.getScores(sport.key);
        console.log(`Fetched ${scores.length} scores for ${sport.key}`);
        
        // Verify scores were stored
        const scoresCount = await Scores.countDocuments({ sport_key: sport.key });
        console.log(`Scores documents saved for ${sport.key}: ${scoresCount}`);
      } catch (error) {
        console.error(`Error fetching scores for ${sport.key}:`, error.message);
      }

      // Rate limiting between sports
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Error processing sport ${sport.key}:`, error.message);
      continue;
    }
  }

  // Final totals
  const totalOdds = await Odds.countDocuments({});
  const totalMatches = await Match.countDocuments({});
  const totalResults = await Results.countDocuments({});
  const totalScores = await Scores.countDocuments({});
  console.log('Final collection totals:', { totalOdds, totalMatches, totalResults, totalScores });

  console.log('Odds fetching and DB update completed successfully');
  await mongoose.disconnect();
  console.log('Disconnected from MongoDB');
}

if (require.main === module) {
  main().catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}