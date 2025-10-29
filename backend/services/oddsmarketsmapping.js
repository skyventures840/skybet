const ALL_MARKETS = 'h2h,spreads,totals,outrights,h2h_lay,outrights_lay,alternate_spreads,alternate_totals,btts,draw_no_bet,h2h_3_way,team_totals,alternate_team_totals,h2h_q1,h2h_q2,h2h_q3,h2h_q4,h2h_h1,h2h_h2,h2h_p1,h2h_p2,h2h_p3,h2h_3_way_q1,h2h_3_way_q2,h2h_3_way_q3,h2h_3_way_q4,h2h_3_way_h1,h2h_3_way_h2,h2h_3_way_p1,h2h_3_way_p2,h2h_3_way_p3,h2h_1st_1_innings,h2h_1st_3_innings,h2h_1st_5_innings,h2h_1st_7_innings,h2h_3_way_1st_1_innings,h2h_3_way_1st_3_innings,h2h_3_way_1st_5_innings,h2h_3_way_1st_7_innings,spreads_q1,spreads_q2,spreads_q3,spreads_q4,spreads_h1,spreads_h2,spreads_p1,spreads_p2,spreads_p3,spreads_1st_1_innings,spreads_1st_3_innings,spreads_1st_5_innings,spreads_1st_7_innings,alternate_spreads_1st_1_innings,alternate_spreads_1st_3_innings,alternate_spreads_1st_5_innings,alternate_spreads_1st_7_innings,alternate_spreads_q1,alternate_spreads_q2,alternate_spreads_q3,alternate_spreads_q4,alternate_spreads_h1,alternate_spreads_h2,alternate_spreads_p1,alternate_spreads_p2,alternate_spreads_p3,totals_q1,totals_q2,totals_q3,totals_q4,totals_h1,totals_h2,totals_p1,totals_p2,totals_p3,totals_1st_1_innings,totals_1st_3_innings,totals_1st_5_innings,totals_1st_7_innings,alternate_totals_1st_1_innings,alternate_totals_1st_3_innings,alternate_totals_1st_5_innings,alternate_totals_1st_7_innings,alternate_totals_q1,alternate_totals_q2,alternate_totals_q3,alternate_totals_q4,alternate_totals_h1,alternate_totals_h2,alternate_totals_p1,alternate_totals_p2,alternate_totals_p3,team_totals_h1,team_totals_h2,team_totals_q1,team_totals_q2,team_totals_q3,team_totals_q4,team_totals_p1,team_totals_p2,team_totals_p3,alternate_team_totals_h1,alternate_team_totals_h2,alternate_team_totals_q1,alternate_team_totals_q2,alternate_team_totals_q3,alternate_team_totals_q4,alternate_team_totals_p1,alternate_team_totals_p2,alternate_team_totals_p3,player_assists,player_defensive_interceptions,player_field_goals,player_kicking_points,player_pass_attempts,player_pass_completions,player_pass_interceptions,player_pass_longest_completion,player_pass_rush_yds,player_pass_rush_reception_tds,player_pass_rush_reception_yds,player_pass_tds,player_pass_yds,player_pass_yds_q1,player_pats,player_receptions,player_reception_longest,player_reception_tds,player_reception_yds,player_rush_attempts,player_rush_longest,player_rush_reception_tds,player_rush_reception_yds,player_rush_tds,player_rush_yds,player_sacks,player_solo_tackles,player_tackles_assists,player_tds_over,player_1st_td,player_anytime_td,player_last_td,player_assists_alternate,player_field_goals_alternate,player_kicking_points_alternate,player_pass_attempts_alternate,player_pass_completions_alternate,player_pass_interceptions_alternate,player_pass_longest_completion_alternate,player_pass_rush_yds_alternate,player_pass_rush_reception_tds_alternate,player_pass_rush_reception_yds_alternate,player_pass_tds_alternate,player_pass_yds_alternate,player_pats_alternate,player_receptions_alternate,player_reception_longest_alternate,player_reception_tds_alternate,player_reception_yds_alternate,player_rush_attempts_alternate,player_rush_longest_alternate,player_rush_reception_tds_alternate,player_rush_reception_yds_alternate,player_rush_tds_alternate,player_rush_yds_alternate,player_sacks_alternate,player_solo_tackles_alternate,player_tackles_assists_alternate,player_points,player_points_q1,player_rebounds,player_rebounds_q1,player_assists,player_assists_q1,player_threes,player_blocks,player_steals,player_blocks_steals,player_turnovers,player_points_rebounds_assists,player_points_rebounds,player_points_assists,player_rebounds_assists,player_field_goals,player_frees_made,player_frees_attempts,player_first_basket,player_first_team_basket,player_double_double,player_triple_double,player_method_of_first_basket,player_points_alternate,player_rebounds_alternate,player_assists_alternate,player_blocks_alternate,player_steals_alternate,player_turnovers_alternate,player_threes_alternate,player_points_assists_alternate,player_points_rebounds_alternate,player_rebounds_assists_alternate,player_points_rebounds_assists_alternate,batter_home_runs,batter_first_home_run,batter_hits,batter_total_bases,batter_rbis,batter_runs_scored,batter_hits_runs_rbis,batter_singles,batter_doubles,batter_triples,batter_walks,batter_strikeouts,batter_stolen_bases,pitcher_strikeouts,pitcher_record_a_win,pitcher_hits_allowed,pitcher_walks,pitcher_earned_runs,pitcher_outs,batter_total_bases_alternate,batter_home_runs_alternate,batter_hits_alternate,batter_rbis_alternate,batter_walks_alternate,batter_strikeouts_alternate,batter_runs_scored_alternate,batter_singles_alternate,batter_doubles_alternate,batter_triples_alternate,pitcher_hits_allowed_alternate,pitcher_walks_alternate,pitcher_strikeouts_alternate,player_points,player_power_play_points,player_assists,player_blocked_shots,player_shots_on_goal,player_goals,player_total_saves,player_goal_scorer_first,player_goal_scorer_last,player_goal_scorer_anytime,player_points_alternate,player_assists_alternate,player_power_play_points_alternate,player_goals_alternate,player_shots_on_goal_alternate,player_blocked_shots_alternate,player_total_saves_alternate,player_disposals,player_disposals_over,player_goal_scorer_first,player_goal_scorer_last,player_goal_scorer_anytime,player_goals_scored_over,player_marks_over,player_marks_most,player_tackles_over,player_tackles_most,player_afl_fantasy_points,player_afl_fantasy_points_over,player_afl_fantasy_points_most,player_try_scorer_first,player_try_scorer_last,player_try_scorer_anytime,player_try_scorer_over,player_goal_scorer_anytime,player_first_goal_scorer,player_last_goal_scorer,player_to_receive_card,player_to_receive_red_card,player_shots_on_target,player_shots,player_assists,alternate_spreads_corners,alternate_totals_corners,alternate_spreads_cards,alternate_totals_cards,double_chance';

const MARKET_MAPPING = {
  // Featured Markets
  'h2h': { standardizedHeader: 'Winner', category: 'Featured', supportedSports: 'All' },
  'spreads': { standardizedHeader: 'Handicap', category: 'Featured', supportedSports: 'Mainly US' },
  'totals': { standardizedHeader: 'Total', category: 'Featured', supportedSports: 'Mainly US' },
  'outrights': { standardizedHeader: 'Tournament Winner', category: 'Featured', supportedSports: 'All' },
  'h2h_lay': { standardizedHeader: 'Winner (Lay)', category: 'Featured', supportedSports: 'Exchanges' },
  'outrights_lay': { standardizedHeader: 'Tournament Winner (Lay)', category: 'Featured', supportedSports: 'Exchanges' },

  // Additional Markets
  'alternate_spreads': { standardizedHeader: 'Alternate Handicap', category: 'Additional', supportedSports: 'US sports' },
  'alternate_totals': { standardizedHeader: 'Alternate Total', category: 'Additional', supportedSports: 'US sports' },
  'btts': { standardizedHeader: 'BTTS', category: 'Additional', supportedSports: 'Soccer' },
  'draw_no_bet': { standardizedHeader: 'Draw No Bet', category: 'Additional', supportedSports: 'Soccer' },
  'h2h_3_way': { standardizedHeader: '3-Way Winner (Full Game)', category: 'Additional', supportedSports: 'Soccer, hockey' },
  'team_totals': { standardizedHeader: 'Team Total', category: 'Additional', supportedSports: 'US sports' },
  'alternate_team_totals': { standardizedHeader: 'Alternate Team Total', category: 'Additional', supportedSports: 'US sports' },
  'double_chance': { standardizedHeader: 'Double Chance', category: 'Additional', supportedSports: 'Soccer' },
  'alternate_spreads_corners': { standardizedHeader: 'Alternate Corners Handicap', category: 'Additional', supportedSports: 'Soccer' },
  'alternate_totals_corners': { standardizedHeader: 'Alternate Total Corners', category: 'Additional', supportedSports: 'Soccer' },
  'alternate_spreads_cards': { standardizedHeader: 'Alternate Cards Handicap', category: 'Additional', supportedSports: 'Soccer' },
  'alternate_totals_cards': { standardizedHeader: 'Alternate Total Cards', category: 'Additional', supportedSports: 'Soccer' },

  // Game Period Markets (Quarters/Halves)
  'h2h_q1': { standardizedHeader: 'Winner - 1st Quarter', category: 'Period Breakdown', supportedSports: 'Basketball, NFL' },
  'h2h_q2': { standardizedHeader: 'Winner - 2nd Quarter', category: 'Period Breakdown', supportedSports: 'Basketball, NFL' },
  'h2h_q3': { standardizedHeader: 'Winner - 3rd Quarter', category: 'Period Breakdown', supportedSports: 'Basketball, NFL' },
  'h2h_q4': { standardizedHeader: 'Winner - 4th Quarter', category: 'Period Breakdown', supportedSports: 'Basketball, NFL' },
  'h2h_h1': { standardizedHeader: 'Winner - 1st Half', category: 'Period Breakdown', supportedSports: 'Basketball, NFL' },
  'h2h_h2': { standardizedHeader: 'Winner - 2nd Half', category: 'Period Breakdown', supportedSports: 'Basketball, NFL' },
  'h2h_3_way_q1': { standardizedHeader: '3-Way Winner - 1st Quarter', category: 'Period Breakdown', supportedSports: 'Basketball, NFL' },
  'h2h_3_way_q2': { standardizedHeader: '3-Way Winner - 2nd Quarter', category: 'Period Breakdown', supportedSports: 'Basketball, NFL' },
  'h2h_3_way_q3': { standardizedHeader: '3-Way Winner - 3rd Quarter', category: 'Period Breakdown', supportedSports: 'Basketball, NFL' },
  'h2h_3_way_q4': { standardizedHeader: '3-Way Winner - 4th Quarter', category: 'Period Breakdown', supportedSports: 'Basketball, NFL' },
  'h2h_3_way_h1': { standardizedHeader: '3-Way Winner - 1st Half', category: 'Period Breakdown', supportedSports: 'Basketball, NFL' },
  'h2h_3_way_h2': { standardizedHeader: '3-Way Winner - 2nd Half', category: 'Period Breakdown', supportedSports: 'Basketball, NFL' },
  'spreads_q1': { standardizedHeader: 'Handicap - 1st Quarter', category: 'Period Breakdown', supportedSports: 'Basketball, NFL' },
  'spreads_q2': { standardizedHeader: 'Handicap - 2nd Quarter', category: 'Period Breakdown', supportedSports: 'Basketball, NFL' },
  'spreads_q3': { standardizedHeader: 'Handicap - 3rd Quarter', category: 'Period Breakdown', supportedSports: 'Basketball, NFL' },
  'spreads_q4': { standardizedHeader: 'Handicap - 4th Quarter', category: 'Period Breakdown', supportedSports: 'Basketball, NFL' },
  'spreads_h1': { standardizedHeader: 'Handicap - 1st Half', category: 'Period Breakdown', supportedSports: 'Basketball, NFL' },
  'spreads_h2': { standardizedHeader: 'Handicap - 2nd Half', category: 'Period Breakdown', supportedSports: 'Basketball, NFL' },
  'totals_q1': { standardizedHeader: 'Total - 1st Quarter', category: 'Period Breakdown', supportedSports: 'Basketball, NFL' },
  'totals_q2': { standardizedHeader: 'Total - 2nd Quarter', category: 'Period Breakdown', supportedSports: 'Basketball, NFL' },
  'totals_q3': { standardizedHeader: 'Total - 3rd Quarter', category: 'Period Breakdown', supportedSports: 'Basketball, NFL' },
  'totals_q4': { standardizedHeader: 'Total - 4th Quarter', category: 'Period Breakdown', supportedSports: 'Basketball, NFL' },
  'totals_h1': { standardizedHeader: 'Total - 1st Half', category: 'Period Breakdown', supportedSports: 'Basketball, NFL' },
  'totals_h2': { standardizedHeader: 'Total - 2nd Half', category: 'Period Breakdown', supportedSports: 'Basketball, NFL' },
  'team_totals_q1': { standardizedHeader: 'Team Total - Home 1st Quarter', category: 'Period Breakdown', supportedSports: 'Basketball, NFL' },
  'team_totals_q2': { standardizedHeader: 'Team Total - Home 2nd Quarter', category: 'Period Breakdown', supportedSports: 'Basketball, NFL' },
  'team_totals_q3': { standardizedHeader: 'Team Total - Home 3rd Quarter', category: 'Period Breakdown', supportedSports: 'Basketball, NFL' },
  'team_totals_q4': { standardizedHeader: 'Team Total - Home 4th Quarter', category: 'Period Breakdown', supportedSports: 'Basketball, NFL' },
  'team_totals_h1': { standardizedHeader: 'Team Total - Home 1st Half', category: 'Period Breakdown', supportedSports: 'Basketball, NFL' },
  'team_totals_h2': { standardizedHeader: 'Team Total - Home 2nd Half', category: 'Period Breakdown', supportedSports: 'Basketball, NFL' },

  // Game Period Markets (Periods - Ice Hockey)
  'h2h_p1': { standardizedHeader: 'Winner - 1st Period', category: 'Period Breakdown', supportedSports: 'Ice Hockey' },
  'h2h_p2': { standardizedHeader: 'Winner - 2nd Period', category: 'Period Breakdown', supportedSports: 'Ice Hockey' },
  'h2h_p3': { standardizedHeader: 'Winner - 3rd Period', category: 'Period Breakdown', supportedSports: 'Ice Hockey' },
  'h2h_3_way_p1': { standardizedHeader: '3-Way Winner - 1st Period', category: 'Period Breakdown', supportedSports: 'Ice Hockey' },
  'h2h_3_way_p2': { standardizedHeader: '3-Way Winner - 2nd Period', category: 'Period Breakdown', supportedSports: 'Ice Hockey' },
  'h2h_3_way_p3': { standardizedHeader: '3-Way Winner - 3rd Period', category: 'Period Breakdown', supportedSports: 'Ice Hockey' },
  'spreads_p1': { standardizedHeader: 'Handicap - 1st Period', category: 'Period Breakdown', supportedSports: 'Ice Hockey' },
  'spreads_p2': { standardizedHeader: 'Handicap - 2nd Period', category: 'Period Breakdown', supportedSports: 'Ice Hockey' },
  'spreads_p3': { standardizedHeader: 'Handicap - 3rd Period', category: 'Period Breakdown', supportedSports: 'Ice Hockey' },
  'totals_p1': { standardizedHeader: 'Total - 1st Period', category: 'Period Breakdown', supportedSports: 'Ice Hockey' },
  'totals_p2': { standardizedHeader: 'Total - 2nd Period', category: 'Period Breakdown', supportedSports: 'Ice Hockey' },
  'totals_p3': { standardizedHeader: 'Total - 3rd Period', category: 'Period Breakdown', supportedSports: 'Ice Hockey' },
  'team_totals_p1': { standardizedHeader: 'Team Total - Home 1st Period', category: 'Period Breakdown', supportedSports: 'Ice Hockey' },
  'team_totals_p2': { standardizedHeader: 'Team Total - Home 2nd Period', category: 'Period Breakdown', supportedSports: 'Ice Hockey' },
  'team_totals_p3': { standardizedHeader: 'Team Total - Home 3rd Period', category: 'Period Breakdown', supportedSports: 'Ice Hockey' },

  // Game Period Markets (Innings - Baseball)
  'h2h_1st_1_innings': { standardizedHeader: 'Winner - 1st Inning', category: 'Period Breakdown', supportedSports: 'Baseball' },
  'h2h_1st_3_innings': { standardizedHeader: 'Winner - 1st 3 Innings', category: 'Period Breakdown', supportedSports: 'Baseball' },
  'h2h_1st_5_innings': { standardizedHeader: 'Winner - 1st 5 Innings', category: 'Period Breakdown', supportedSports: 'Baseball' },
  'h2h_1st_7_innings': { standardizedHeader: 'Winner - 1st 7 Innings', category: 'Period Breakdown', supportedSports: 'Baseball' },
  'h2h_3_way_1st_1_innings': { standardizedHeader: '3-Way Winner - 1st Inning', category: 'Period Breakdown', supportedSports: 'Baseball' },
  'h2h_3_way_1st_3_innings': { standardizedHeader: '3-Way Winner - 1st 3 Innings', category: 'Period Breakdown', supportedSports: 'Baseball' },
  'h2h_3_way_1st_5_innings': { standardizedHeader: '3-Way Winner - 1st 5 Innings', category: 'Period Breakdown', supportedSports: 'Baseball' },
  'h2h_3_way_1st_7_innings': { standardizedHeader: '3-Way Winner - 1st 7 Innings', category: 'Period Breakdown', supportedSports: 'Baseball' },
  'spreads_1st_1_innings': { standardizedHeader: 'Handicap - 1st Inning', category: 'Period Breakdown', supportedSports: 'Baseball' },
  'spreads_1st_3_innings': { standardizedHeader: 'Handicap - 1st 3 Innings', category: 'Period Breakdown', supportedSports: 'Baseball' },
  'spreads_1st_5_innings': { standardizedHeader: 'Handicap - 1st 5 Innings', category: 'Period Breakdown', supportedSports: 'Baseball' },
  'spreads_1st_7_innings': { standardizedHeader: 'Handicap - 1st 7 Innings', category: 'Period Breakdown', supportedSports: 'Baseball' },
  'totals_1st_1_innings': { standardizedHeader: 'Total - 1st Inning', category: 'Period Breakdown', supportedSports: 'Baseball' },
  'totals_1st_3_innings': { standardizedHeader: 'Total - 1st 3 Innings', category: 'Period Breakdown', supportedSports: 'Baseball' },
  'totals_1st_5_innings': { standardizedHeader: 'Total - 1st 5 Innings', category: 'Period Breakdown', supportedSports: 'Baseball' },
  'totals_1st_7_innings': { standardizedHeader: 'Total - 1st 7 Innings', category: 'Period Breakdown', supportedSports: 'Baseball' },

  // Alternate Period Variants (e.g., for quarters, periods, innings)
  'alternate_spreads_q1': { standardizedHeader: 'Alternate Handicap - 1st Quarter', category: 'Period Breakdown', supportedSports: 'Basketball, NFL' },
  'alternate_totals_q1': { standardizedHeader: 'Alternate Total - 1st Quarter', category: 'Period Breakdown', supportedSports: 'Basketball, NFL' },
  'alternate_team_totals_q1': { standardizedHeader: 'Alternate Team Total - Home 1st Quarter', category: 'Period Breakdown', supportedSports: 'Basketball, NFL' },
  // ... (similar for q2-q4, h1-h2, p1-p3, 1st_1_innings etc.; add as needed for full coverage)

  // Player Props - American Football
  'player_pass_yds': { standardizedHeader: 'Passing Yards', category: 'Player Props', supportedSports: 'NFL, NCAAF, CFL' },
  'player_pass_tds': { standardizedHeader: 'Passing Touchdowns', category: 'Player Props', supportedSports: 'NFL, NCAAF, CFL' },
  'player_rush_yds': { standardizedHeader: 'Rushing Yards', category: 'Player Props', supportedSports: 'NFL, NCAAF, CFL' },
  'player_receptions': { standardizedHeader: 'Receptions', category: 'Player Props', supportedSports: 'NFL, NCAAF, CFL' },
  'player_anytime_td': { standardizedHeader: 'Anytime TD', category: 'Player Props', supportedSports: 'NFL, NCAAF, CFL' },
  'player_sacks': { standardizedHeader: 'Sacks', category: 'Player Props', supportedSports: 'NFL, NCAAF, CFL' },
  'player_tackles_assists': { standardizedHeader: 'Tackles + Assists', category: 'Player Props', supportedSports: 'NFL, NCAAF, CFL' },
  // Alternates: e.g., 'player_pass_yds_alternate': { standardizedHeader: 'Alternate Passing Yards', category: 'Player Props', supportedSports: 'NFL, NCAAF, CFL' }
  // (Add full alternates similarly; ~30 for NFL)

  // Player Props - Basketball
  'player_points': { standardizedHeader: 'Points', category: 'Player Props', supportedSports: 'NBA, NCAAB, WNBA' },
  'player_rebounds': { standardizedHeader: 'Rebounds', category: 'Player Props', supportedSports: 'NBA, NCAAB, WNBA' },
  'player_assists': { standardizedHeader: 'Assists', category: 'Player Props', supportedSports: 'NBA, NCAAB, WNBA' },
  'player_threes': { standardizedHeader: 'Threes', category: 'Player Props', supportedSports: 'NBA, NCAAB, WNBA' },
  'player_double_double': { standardizedHeader: 'Double Double', category: 'Player Props', supportedSports: 'NBA, NCAAB, WNBA' },
  'player_points_rebounds_assists': { standardizedHeader: 'Points + Rebounds + Assists', category: 'Player Props', supportedSports: 'NBA, NCAAB, WNBA' },
  // Alternates: e.g., 'player_points_alternate': { standardizedHeader: 'Alternate Points', category: 'Player Props', supportedSports: 'NBA, NCAAB, WNBA' }

  // Player Props - Baseball
  'batter_home_runs': { standardizedHeader: 'Home Runs', category: 'Player Props', supportedSports: 'MLB' },
  'batter_hits': { standardizedHeader: 'Hits', category: 'Player Props', supportedSports: 'MLB' },
  'batter_rbis': { standardizedHeader: 'RBIs', category: 'Player Props', supportedSports: 'MLB' },
  'pitcher_strikeouts': { standardizedHeader: 'Strikeouts (Pitcher)', category: 'Player Props', supportedSports: 'MLB' },
  // Alternates: e.g., 'batter_home_runs_alternate': { standardizedHeader: 'Alternate Home Runs', category: 'Player Props', supportedSports: 'MLB' }

  // Player Props - Ice Hockey
  'player_points': { standardizedHeader: 'Points', category: 'Player Props', supportedSports: 'NHL' },  // Note: Overlaps with basketball; context via sport
  'player_goals': { standardizedHeader: 'Goals', category: 'Player Props', supportedSports: 'NHL' },
  'player_shots_on_goal': { standardizedHeader: 'Shots on Goal', category: 'Player Props', supportedSports: 'NHL' },
  'player_goal_scorer_anytime': { standardizedHeader: 'Anytime Goal Scorer', category: 'Player Props', supportedSports: 'NHL' },
  // Alternates: e.g., 'player_points_alternate': { standardizedHeader: 'Alternate Points', category: 'Player Props', supportedSports: 'NHL' }

  // Player Props - Soccer
  'player_goal_scorer_anytime': { standardizedHeader: 'Anytime Goal Scorer', category: 'Player Props', supportedSports: 'Soccer' },
  'player_first_goal_scorer': { standardizedHeader: 'First Goal Scorer', category: 'Player Props', supportedSports: 'Soccer' },
  'player_last_goal_scorer': { standardizedHeader: 'Last Goal Scorer', category: 'Player Props', supportedSports: 'Soccer' },
  'player_to_receive_card': { standardizedHeader: 'Receive Card', category: 'Player Props', supportedSports: 'Soccer' },
  'player_shots_on_target': { standardizedHeader: 'Shots on Target', category: 'Player Props', supportedSports: 'Soccer' },

  // Player Props - Other (AFL, Rugby)
  'player_disposals': { standardizedHeader: 'Disposals', category: 'Player Props', supportedSports: 'AFL' },
  'player_try_scorer_anytime': { standardizedHeader: 'Anytime Try Scorer', category: 'Player Props', supportedSports: 'Rugby League' }
  // (Full alternates and extras omitted for brevity; extend as needed)
};

module.exports = { ALL_MARKETS, MARKET_MAPPING };