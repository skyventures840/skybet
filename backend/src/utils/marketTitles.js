// Shared mapping for market keys to user-friendly titles
// Covers common markets and period/half variants, including alternates

// Normalize raw keys to canonical forms for lookup and dedupe
export const normalizeMarketKey = (keyRaw) => {
  const key = (keyRaw || '').toLowerCase().trim();
  if (!key) return '';
  // Remove trailing exchange/lay suffixes
  const base = key.replace(/_(lay|exchange)$/i, '');
  // Map direct aliases to core keys
  if (['h2h','moneyline','ml','h2h_lay','winner','match_winner','1x2'].includes(base)) return 'winner';
  // Collapse single-side 1x2 variants into one Winner market
  if (['home_win','away_win','draw','draw_result','homewin','awaywin'].includes(base)) return 'winner';
  // Map basic totals aliases to unified totals
  if (['total','total_goals','total_points','over','under'].includes(base)) return 'totals';
  // Map handicap/spread aliases to unified spreads
  if (['handicap','asian_handicap','point_spread','spread','line_spread','homehandicap','awayhandicap','handicapline','handicap_line'].includes(base)) return 'spreads';
  if (base === 'outrights_lay') return 'outrights';
  // Synonyms for goal/try scorer keys
  if (base === 'player_first_goal_scorer') return 'player_goal_scorer_first';
  if (base === 'player_last_goal_scorer') return 'player_goal_scorer_last';
  return base;
};

// Primary titles mapping from provided specification
const MARKET_TITLE_MAP = {
  // Core
  winner: 'Winner',
  spreads: 'Handicap',
  totals: 'Totals',
  outrights: 'Outrights',
  outrights_lay: 'Outrights',

  // Halves/Periods/Quarters (Moneyline)
  h2h_h1: 'Moneyline 1st Half',
  h2h_h2: 'Moneyline 2nd Half',
  h2h_p1: 'Moneyline 1st Period',
  h2h_p2: 'Moneyline 2nd Period',
  h2h_p3: 'Moneyline 3rd Period',
  h2h_3_way_q1: '1st Quarter 3 Way Result',
  h2h_3_way_q2: '2nd Quarter 3 Way Result',
  h2h_3_way_q3: '3rd Quarter 3 Way Result',
  h2h_3_way_q4: '4th Quarter 3 Way Result',
  h2h_3_way_h1: '1st Half 3 Way Result',
  h2h_3_way_h2: '2nd Half 3 Way Result',
  h2h_3_way_p1: '1st Period 3 Way Result',
  h2h_3_way_p2: '2nd Period 3 Way Result',
  h2h_3_way_p3: '3rd Period 3 Way Result',

  // Baseball innings - Moneyline
  h2h_1st_1_innings: 'Moneyline 1st Inning',
  h2h_1st_3_innings: 'Moneyline 1st 3 Innings',
  h2h_1st_5_innings: 'Moneyline 1st 5 Innings',
  h2h_1st_7_innings: 'Moneyline 1st 7 Innings',
  h2h_3_way_1st_1_innings: '3-way Moneyline 1st Inning',
  h2h_3_way_1st_3_innings: '3-way Moneyline 1st 3 Innings',
  h2h_3_way_1st_5_innings: '3-way Moneyline 1st 5 Innings',
  h2h_3_way_1st_7_innings: '3-way Moneyline 1st 7 Innings',

  // Spreads variants
  spreads_q1: 'Spreads 1st Quarter',
  spreads_q2: 'Spreads 2nd Quarter',
  spreads_q3: 'Spreads 3rd Quarter',
  spreads_q4: 'Spreads 4th Quarter',
  spreads_h1: 'Spreads 1st Half',
  spreads_h2: 'Spreads 2nd Half',
  spreads_p1: 'Spreads 1st Period',
  spreads_p2: 'Spreads 2nd Period',
  spreads_p3: 'Spreads 3rd Period',
  spreads_1st_1_innings: 'Spreads 1st Inning',
  spreads_1st_3_innings: 'Spreads 1st 3 Innings',
  spreads_1st_5_innings: 'Spreads 1st 5 Innings',
  spreads_1st_7_innings: 'Spreads 1st 7 Innings',

  alternate_spreads_1st_1_innings: 'Alternate Spreads 1st Inning',
  alternate_spreads_1st_3_innings: 'Alternate Spreads 1st 3 Innings',
  alternate_spreads_1st_5_innings: 'Alternate Spreads 1st 5 Innings',
  alternate_spreads_1st_7_innings: 'Alternate Spreads 1st 7 Innings',
  alternate_spreads_q1: 'Alternate Spreads 1st Quarter',
  alternate_spreads_q2: 'Alternate Spreads 2nd Quarter',
  alternate_spreads_q3: 'Alternate Spreads 3rd Quarter',
  alternate_spreads_q4: 'Alternate Spreads 4th Quarter',
  alternate_spreads_h1: 'Alternate Spreads 1st Half',
  alternate_spreads_h2: 'Alternate Spreads 2nd Half',
  alternate_spreads_p1: 'Alternate Spreads 1st Period',
  alternate_spreads_p2: 'Alternate Spreads 2nd Period',
  alternate_spreads_p3: 'Alternate Spreads 3rd Period',

  // Totals variants
  totals_q1: 'Over/Under 1st Quarter',
  totals_q2: 'Over/Under 2nd Quarter',
  totals_q3: 'Over/Under 3rd Quarter',
  totals_q4: 'Over/Under 4th Quarter',
  totals_h1: 'Over/Under 1st Half',
  totals_h2: 'Over/Under 2nd Half',
  totals_p1: 'Over/Under 1st Period',
  totals_p2: 'Over/Under 2nd Period',
  totals_p3: 'Over/Under 3rd Period',
  totals_1st_1_innings: 'Over/Under 1st Inning',
  totals_1st_3_innings: 'Over/Under 1st 3 Innings',
  totals_1st_5_innings: 'Over/Under 1st 5 Innings',
  totals_1st_7_innings: 'Over/Under 1st 7 Innings',

  alternate_totals_1st_1_innings: 'Alternate Over/Under 1st Inning',
  alternate_totals_1st_3_innings: 'Alternate Over/Under 1st 3 Innings',
  alternate_totals_1st_5_innings: 'Alternate Over/Under 1st 5 Innings',
  alternate_totals_1st_7_innings: 'Alternate Over/Under 1st 7 Innings',
  alternate_totals_q1: 'Alternate Totals 1st Quarter',
  alternate_totals_q2: 'Alternate Totals 2nd Quarter',
  alternate_totals_q3: 'Alternate Totals 3rd Quarter',
  alternate_totals_q4: 'Alternate Totals 4th Quarter',
  alternate_totals_h1: 'Alternate Totals 1st Half',
  alternate_totals_h2: 'Alternate Totals 2nd Half',
  alternate_totals_p1: 'Alternate Totals 1st Period',
  alternate_totals_p2: 'Alternate Totals 2nd Period',
  alternate_totals_p3: 'Alternate Totals 3rd Period',

  // Team totals
  team_totals_h1: 'Team Totals 1st Half',
  team_totals_h2: 'Team Totals 2nd Half',
  team_totals_q1: 'Team Totals 1st Quarter',
  team_totals_q2: 'Team Totals 2nd Quarter',
  team_totals_q3: 'Team Totals 3rd Quarter',
  team_totals_q4: 'Team Totals 4th Quarter',
  team_totals_p1: 'Team Totals 1st Period',
  team_totals_p2: 'Team Totals 2nd Period',
  team_totals_p3: 'Team Totals 3rd Period',

  alternate_team_totals_h1: 'Alternate Team Totals 1st Half',
  alternate_team_totals_h2: 'Alternate Team Totals 2nd Half',
  alternate_team_totals_q1: 'Alternate Team Totals 1st Quarter',
  alternate_team_totals_q2: 'Alternate Team Totals 2nd Quarter',
  alternate_team_totals_q3: 'Alternate Team Totals 3rd Quarter',
  alternate_team_totals_q4: 'Alternate Team Totals 4th Quarter',
  alternate_team_totals_p1: 'Alternate Team Totals 1st Period',
  alternate_team_totals_p2: 'Alternate Team Totals 2nd Period',
  alternate_team_totals_p3: 'Alternate Team Totals 3rd Period',

  // Player props (NFL style and general)
  player_assists: 'Player Assists (Over/Under)',
  player_defensive_interceptions: 'Defensive Interceptions (Over/Under)',
  player_field_goals: 'Field Goals (Over/Under)',
  player_kicking_points: 'Kicking Points (Over/Under)',
  player_pass_attempts: 'Pass Attempts (Over/Under)',
  player_pass_completions: 'Pass Completions (Over/Under)',
  player_pass_interceptions: 'Pass Intercepts (Over/Under)',
  player_pass_longest_completion: 'Longest Pass Completion (Over/Under)',
  player_pass_rush_yds: 'Pass + Rush Yards (Over/Under)',
  player_pass_rush_reception_tds: 'Pass + Rush + Reception Touchdowns (Over/Under)',
  player_pass_rush_reception_yds: 'Pass + Rush + Reception Yards (Over/Under)',
  player_pass_tds: 'Pass Touchdowns (Over/Under)',
  player_pass_yds: 'Pass Yards (Over/Under)',
  player_pass_yds_q1: '1st Quarter Pass Yards (Over/Under)',
  player_pats: 'Points After Touchdown (Over/Under)',
  player_receptions: 'Receptions (Over/Under)',
  player_reception_longest: 'Longest Reception (Over/Under)',
  player_reception_tds: 'Reception Touchdowns (Over/Under)',
  player_reception_yds: 'Reception Yards (Over/Under)',
  player_rush_attempts: 'Rush Attempts (Over/Under)',
  player_rush_longest: 'Longest Rush (Over/Under)',
  player_rush_reception_tds: 'Rush + Reception Touchdowns (Over/Under)',
  player_rush_reception_yds: 'Rush + Reception Yards (Over/Under)',
  player_rush_tds: 'Rush Touchdowns (Over/Under)',
  player_rush_yds: 'Rush Yards (Over/Under)',
  player_sacks: 'Sacks (Over/Under)',
  player_solo_tackles: 'Solo Tackles (Over/Under)',
  player_tackles_assists: 'Tackles + Assists (Over/Under)',
  player_tds_over: 'Touchdowns (Over only)',
  player_1st_td: '1st Touchdown Scorer (Yes/No)',
  player_anytime_td: 'Anytime Touchdown Scorer (Yes/No)',
  player_last_td: 'Last Touchdown Scorer (Yes/No)',
};

// Additional alternates and extended props per request
Object.assign(MARKET_TITLE_MAP, {
  // NFL alternates
  player_field_goals_alternate: 'Alternate Field Goals (Over/Under)',
  player_kicking_points_alternate: 'Alternate Kicking Points (Over/Under)',
  player_pass_attempts_alternate: 'Alternate Pass Attempts (Over/Under)',
  player_pass_completions_alternate: 'Alternate Pass Completions (Over/Under)',
  player_pass_interceptions_alternate: 'Alternate Pass Interceptions (Over/Under)',
  player_pass_longest_completion_alternate: 'Alternate Longest Pass Completion (Over/Under)',
  player_pass_rush_yds_alternate: 'Alternate Pass + Rush Yards (Over/Under)',
  player_pass_rush_reception_tds_alternate: 'Alternate Pass + Rush + Reception Touchdowns (Over/Under)',
  player_pass_rush_reception_yds_alternate: 'Alternate Pass + Rush + Reception Yards (Over/Under)',
  player_pass_tds_alternate: 'Alternate Pass Touchdowns (Over/Under)',
  player_pass_yds_alternate: 'Alternate Pass Yards (Over/Under)',
  player_pats_alternate: 'Alternate Points After Touchdown (Over/Under)',
  player_receptions_alternate: 'Alternate Receptions (Over/Under)',
  player_reception_longest_alternate: 'Alternate Longest Reception (Over/Under)',
  player_reception_tds_alternate: 'Alternate Reception Touchdowns (Over/Under)',
  player_reception_yds_alternate: 'Alternate Reception Yards (Over/Under)',
  player_rush_attempts_alternate: 'Alternate Rush Attempts (Over/Under)',
  player_rush_longest_alternate: 'Alternate Longest Rush (Over/Under)',
  player_rush_reception_tds_alternate: 'Alternate Rush + Reception Touchdowns (Over/Under)',
  player_rush_reception_yds_alternate: 'Alternate Rush + Reception Yards (Over/Under)',
  player_rush_tds_alternate: 'Alternate Rush Touchdowns (Over/Under)',
  player_rush_yds_alternate: 'Alternate Rush Yards (Over/Under)',
  player_sacks_alternate: 'Alternate Sacks (Over/Under)',
  player_solo_tackles_alternate: 'Alternate Solo Tackles (Over/Under)',
  player_tackles_assists_alternate: 'Alternate Tackles + Assists (Over/Under)',

  // Basketball core
  player_points: 'Points (Over/Under)',
  player_points_q1: '1st Quarter Points (Over/Under)',
  player_rebounds: 'Rebounds (Over/Under)',
  player_rebounds_q1: '1st Quarter Rebounds (Over/Under)',
  player_assists_q1: '1st Quarter Assists (Over/Under)',
  player_threes: 'Threes (Over/Under)',
  player_blocks: 'Blocks (Over/Under)',
  player_steals: 'Steals (Over/Under)',
  player_blocks_steals: 'Blocks + Steals (Over/Under)',
  player_turnovers: 'Turnovers (Over/Under)',
  player_points_rebounds_assists: 'Points + Rebounds + Assists (Over/Under)',
  player_points_rebounds: 'Points + Rebounds (Over/Under)',
  player_points_assists: 'Points + Assists (Over/Under)',
  player_rebounds_assists: 'Rebounds + Assists (Over/Under)',
  player_field_goals: 'Field Goals (Over/Under)',
  player_frees_made: 'Frees made (Over/Under)',
  player_frees_attempts: 'Frees attempted (Over/Under)',
  player_first_basket: 'First Basket Scorer (Yes/No)',
  player_first_team_basket: 'First Basket Scorer on Team (Yes/No)',
  player_double_double: 'Double Double (Yes/No)',
  player_triple_double: 'Triple Double (Yes/No)',
  player_method_of_first_basket: 'Method of First Basket (Various)',
  // Basketball alternates
  player_points_alternate: 'Alternate Points (Over/Under)',
  player_rebounds_alternate: 'Alternate Rebounds (Over/Under)',
  player_assists_alternate: 'Alternate Assists (Over/Under)',
  player_blocks_alternate: 'Alternate Blocks (Over/Under)',
  player_steals_alternate: 'Alternate Steals (Over/Under)',
  player_turnovers_alternate: 'Alternate Turnovers (Over/Under)',
  player_threes_alternate: 'Alternate Threes (Over/Under)',
  player_points_assists_alternate: 'Alternate Points + Assists (Over/Under)',
  player_points_rebounds_alternate: 'Alternate Points + Rebounds (Over/Under)',
  player_rebounds_assists_alternate: 'Alternate Rebounds + Assists (Over/Under)',
  player_points_rebounds_assists_alternate: 'Alternate Points + Rebounds + Assists (Over/Under)',

  // Baseball batter props
  batter_home_runs: 'Batter home runs (Over/Under)',
  batter_first_home_run: 'Batter first home run (Yes/No)',
  batter_hits: 'Batter hits (Over/Under)',
  batter_total_bases: 'Batter total bases (Over/Under)',
  batter_rbis: 'Batter RBIs (Over/Under)',
  batter_runs_scored: 'Batter runs scored (Over/Under)',
  batter_hits_runs_rbis: 'Batter hits + runs + RBIs (Over/Under)',
  batter_singles: 'Batter singles (Over/Under)',
  batter_doubles: 'Batter doubles (Over/Under)',
  batter_triples: 'Batter triples (Over/Under)',
  batter_walks: 'Batter walks (Over/Under)',
  batter_strikeouts: 'Batter strikeouts (Over/Under)',
  batter_stolen_bases: 'Batter stolen bases (Over/Under)',
  // Baseball pitcher props
  pitcher_strikeouts: 'Pitcher strikeouts (Over/Under)',
  pitcher_record_a_win: 'Pitcher to record a win (Yes/No)',
  pitcher_hits_allowed: 'Pitcher hits allowed (Over/Under)',
  pitcher_walks: 'Pitcher walks (Over/Under)',
  pitcher_earned_runs: 'Pitcher earned runs (Over/Under)',
  pitcher_outs: 'Pitcher outs (Over/Under)',
  // Baseball alternates
  batter_total_bases_alternate: 'Alternate batter total bases (Over/Under)',
  batter_home_runs_alternate: 'Alternate batter home runs (Over/Under)',
  batter_hits_alternate: 'Alternate batter hits (Over/Under)',
  batter_rbis_alternate: 'Alternate batter RBIs (Over/Under)',
  batter_walks_alternate: 'Alternate batter walks (Over/Under)',
  batter_strikeouts_alternate: 'Alternate batter strikeouts (Over/Under)',
  batter_runs_scored_alternate: 'Alternate batter runs scored (Over/Under)',
  batter_singles_alternate: 'Alternate batter singles (Over/Under)',
  batter_doubles_alternate: 'Alternate batter doubles (Over/Under)',
  batter_triples_alternate: 'Alternate batter triples (Over/Under)',
  pitcher_hits_allowed_alternate: 'Alternate pitcher hits allowed (Over/Under)',
  pitcher_walks_alternate: 'Alternate pitcher walks allowed (Over/Under)',
  pitcher_strikeouts_alternate: 'Alternate pitcher strikeouts (Over/Under)',

  // Hockey props
  player_power_play_points: 'Power play points (Over/Under)',
  player_blocked_shots: 'Blocked shots (Over/Under)',
  player_shots_on_goal: 'Shots on goal (Over/Under)',
  player_goals: 'Goals (Over/Under)',
  player_total_saves: 'Total saves (Over/Under)',

  // Hockey goal scorers
  player_goal_scorer_first: 'First Goal Scorer (Yes/No)',
  player_goal_scorer_last: 'Last Goal Scorer (Yes/No)',
  player_goal_scorer_anytime: 'Anytime Goal Scorer (Yes/No)',

  // Hockey alternates
  player_power_play_points_alternate: 'Alternate Power Play Points (Over/Under)',
  player_goals_alternate: 'Alternate Goals (Over/Under)',
  player_shots_on_goal_alternate: 'Alternate Shots on Goal (Over/Under)',
  player_blocked_shots_alternate: 'Alternate Blocked Shots (Over/Under)',
  player_total_saves_alternate: 'Alternate Total Saves (Over/Under)',

  // AFL props
  player_disposals: 'Disposals (Over/Under)',
  player_disposals_over: 'Disposals (Over only)',
  player_goals_scored_over: 'Goals scored (Over only)',
  player_marks_over: 'Marks (Over only)',
  player_marks_most: 'Most Marks (Yes/No)',
  player_tackles_over: 'Tackles (Over only)',
  player_tackles_most: 'Tackles (Yes/No)',
  player_afl_fantasy_points: 'AFL Fantasy Points (Over/Under)',
  player_afl_fantasy_points_over: 'AFL Fantasy Points (Over only)',
  player_afl_fantasy_points_most: 'Most AFL Fantasy Points (Yes/No)',

  // Rugby league/union try scorers
  player_try_scorer_first: 'First Try Scorer (Yes/No)',
  player_try_scorer_last: 'Last Try Scorer (Yes/No)',
  player_try_scorer_anytime: 'Anytime Try Scorer (Yes/No)',
  player_try_scorer_over: 'Tries Scored (Over only)',

  // Soccer player events
  player_to_receive_card: 'Player to receive a card (Yes/No)',
  player_to_receive_red_card: 'Player to receive a red card (Yes/No)',
  player_shots_on_target: 'Player Shots on Target (Over/Under)',
  player_shots: 'Player Shots (Over/Under)',

  // Team corners/cards markets
  alternate_spreads_corners: 'Handicap Corners',
  alternate_totals_corners: 'Total Corners (Over/Under)',
  alternate_spreads_cards: 'Handicap Cards / Bookings',
  alternate_totals_cards: 'Total Cards / Bookings (Over/Under)',

  // Soccer match market
  double_chance: 'Double Chance'
});

const humanize = (key) => (key || '').replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

export const getMarketTitle = (keyRaw) => {
  const norm = normalizeMarketKey(keyRaw);
  if (!norm) return '';
  return MARKET_TITLE_MAP[norm] || humanize(norm);
};

export default getMarketTitle;