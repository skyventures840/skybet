// Utility to compute unified league title: "Sport.Country.League" or "Sport.League"
// Derives sport from sport_key (first token) and country/league from remaining tokens when available.

function titleCase(str = '') {
  return String(str)
    .replace(/[_.-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function parseSportKey(raw = '') {
  const key = String(raw || '').trim();
  if (!key) return { sport: '', countryFromKey: '', leagueFromKey: '' };
  const tokens = key.split('_').filter(Boolean);
  const sport = tokens[0] || '';
  const countryFromKey = tokens[1] || '';
  const leagueFromKey = tokens.length > 2 ? tokens.slice(2).join(' ') : '';
  return { sport, countryFromKey, leagueFromKey };
}

export function computeFullLeagueTitle({
  sportKeyOrName,
  country,
  leagueName,
  fallbackSportTitle
}) {
  // Canonical mappings for popular leagues from Odds API keys
  const CANONICAL_LEAGUE_MAP = {
    // Soccer
    'soccer_epl': { sport: 'Soccer', country: 'England', league: 'Premier League' },
    'soccer_england_league_1': { sport: 'Soccer', country: 'England', league: 'League One' },
    'soccer_france_ligue_one': { sport: 'Soccer', country: 'France', league: 'Ligue 1' },
    'soccer_spain_la_liga': { sport: 'Soccer', country: 'Spain', league: 'La Liga' },
    'soccer_italy_serie_a': { sport: 'Soccer', country: 'Italy', league: 'Serie A' },
    'soccer_germany_bundesliga': { sport: 'Soccer', country: 'Germany', league: 'Bundesliga' },
    'soccer_netherlands_eredivisie': { sport: 'Soccer', country: 'Netherlands', league: 'Eredivisie' },
    'soccer_portugal_primeira_liga': { sport: 'Soccer', country: 'Portugal', league: 'Primeira Liga' },
    'soccer_belgium_first_div': { sport: 'Soccer', country: 'Belgium', league: 'First Division A' },
    'soccer_uefa_champions_league': { sport: 'Soccer', country: 'Europe', league: 'UEFA Champions League' },
    // Variants provided by API/user
    'soccer_uefa_champs_league': { sport: 'Soccer', country: 'Europe', league: 'UEFA Champions League' },
    'soccer_uefa_champs_league_qualification': { sport: 'Soccer', country: 'Europe', league: 'UEFA Champions League Qualification' },
    'soccer_uefa_champs_league_women': { sport: 'Soccer', country: 'Europe', league: "UEFA Women's Champions League" },
    'soccer_uefa_europa_league': { sport: 'Soccer', country: 'Europe', league: 'UEFA Europa League' },
    'soccer_europe_uefa_europa_league': { sport: 'Soccer', country: 'Europe', league: 'UEFA Europa League' },
    'soccer_uefa_european_championship': { sport: 'Soccer', country: 'Europe', league: 'UEFA Euro 2024' },
    'soccer_uefa_euro_qualification': { sport: 'Soccer', country: 'Europe', league: 'UEFA Euro Qualification' },
    'soccer_uefa_nations_league': { sport: 'Soccer', country: 'Europe', league: 'UEFA Nations League' },
    'soccer_concacaf_gold_cup': { sport: 'Soccer', country: 'CONCACAF', league: 'Gold Cup' },
    'soccer_concacaf_leagues_cup': { sport: 'Soccer', country: 'CONCACAF', league: 'Leagues Cup' },
    'soccer_conmebol_copa_america': { sport: 'Soccer', country: 'CONMEBOL', league: 'Copa América' },
    'soccer_conmebol_copa_libertadores': { sport: 'Soccer', country: 'CONMEBOL', league: 'Copa Libertadores' },
    'soccer_conmebol_copa_sudamericana': { sport: 'Soccer', country: 'CONMEBOL', league: 'Copa Sudamericana' },
    'soccer_usa_mls': { sport: 'Soccer', country: 'USA', league: 'MLS' },
    // Basketball
    'basketball_nba': { sport: 'Basketball', country: 'USA', league: 'NBA' },
    'basketball_euroleague': { sport: 'Basketball', country: 'Europe', league: 'EuroLeague' },
    'basketball_spain_liga_acb': { sport: 'Basketball', country: 'Spain', league: 'Liga ACB' },
    'basketball_france_lnb': { sport: 'Basketball', country: 'France', league: 'LNB Pro A' },
    // American Football
    'americanfootball_nfl': { sport: 'American Football', country: 'USA', league: 'NFL' },
    // Baseball
    'baseball_mlb': { sport: 'Baseball', country: 'USA', league: 'MLB' },
    // Ice Hockey
    'icehockey_nhl': { sport: 'Ice Hockey', country: 'USA', league: 'NHL' },
    'icehockey_sweden_shl': { sport: 'Ice Hockey', country: 'Sweden', league: 'SHL' },
    // Tennis
    'tennis_atp_singles': { sport: 'Tennis', country: '', league: 'ATP' },
    'tennis_wta_singles': { sport: 'Tennis', country: '', league: 'WTA' },
    // ATP tournaments
    'tennis_atp_aus_open_singles': { sport: 'Tennis', country: '', league: 'ATP Australian Open' },
    'tennis_atp_canadian_open': { sport: 'Tennis', country: '', league: 'ATP Canadian Open' },
    'tennis_atp_china_open': { sport: 'Tennis', country: '', league: 'ATP China Open' },
    'tennis_atp_cincinnati_open': { sport: 'Tennis', country: '', league: 'ATP Cincinnati Open' },
    'tennis_atp_dubai': { sport: 'Tennis', country: '', league: 'ATP Dubai Championships' },
    'tennis_atp_french_open': { sport: 'Tennis', country: '', league: 'ATP French Open' },
    'tennis_atp_indian_wells': { sport: 'Tennis', country: '', league: 'ATP Indian Wells' },
    'tennis_atp_italian_open': { sport: 'Tennis', country: '', league: 'ATP Italian Open' },
    'tennis_atp_madrid_open': { sport: 'Tennis', country: '', league: 'ATP Madrid Open' },
    'tennis_atp_miami_open': { sport: 'Tennis', country: '', league: 'ATP Miami Open' },
    'tennis_atp_monte_carlo_masters': { sport: 'Tennis', country: '', league: 'ATP Monte-Carlo Masters' },
    'tennis_atp_paris_masters': { sport: 'Tennis', country: '', league: 'ATP Paris Masters' },
    'tennis_atp_qatar_open': { sport: 'Tennis', country: '', league: 'ATP Qatar Open' },
    'tennis_atp_shanghai_masters': { sport: 'Tennis', country: '', league: 'ATP Shanghai Masters' },
    'tennis_atp_us_open': { sport: 'Tennis', country: '', league: 'ATP US Open' },
    'tennis_atp_wimbledon': { sport: 'Tennis', country: '', league: 'ATP Wimbledon' },
    // WTA tournaments
    'tennis_wta_aus_open_singles': { sport: 'Tennis', country: '', league: 'WTA Australian Open' },
    'tennis_wta_canadian_open': { sport: 'Tennis', country: '', league: 'WTA Canadian Open' },
    'tennis_wta_china_open': { sport: 'Tennis', country: '', league: 'WTA China Open' },
    'tennis_wta_cincinnati_open': { sport: 'Tennis', country: '', league: 'WTA Cincinnati Open' },
    'tennis_wta_dubai': { sport: 'Tennis', country: '', league: 'WTA Dubai Championships' },
    'tennis_wta_french_open': { sport: 'Tennis', country: '', league: 'WTA French Open' },
    'tennis_wta_indian_wells': { sport: 'Tennis', country: '', league: 'WTA Indian Wells' },
    'tennis_wta_italian_open': { sport: 'Tennis', country: '', league: 'WTA Italian Open' },
    'tennis_wta_madrid_open': { sport: 'Tennis', country: '', league: 'WTA Madrid Open' },
    'tennis_wta_miami_open': { sport: 'Tennis', country: '', league: 'WTA Miami Open' },
    'tennis_wta_qatar_open': { sport: 'Tennis', country: '', league: 'WTA Qatar Open' },
    'tennis_wta_us_open': { sport: 'Tennis', country: '', league: 'WTA US Open' },
    'tennis_wta_wimbledon': { sport: 'Tennis', country: '', league: 'WTA Wimbledon' },
    'tennis_wta_wuhan_open': { sport: 'Tennis', country: '', league: 'WTA Wuhan Open' },
  };
  // Map common sport tokens and names to normalized display names
  const SPORT_DISPLAY_MAP = {
    'soccer': 'Soccer',
    'football': 'American Football',
    'americanfootball': 'American Football',
    'basketball': 'Basketball',
    'baseball': 'Baseball',
    'icehockey': 'Ice Hockey',
    'hockey': 'Hockey',
    'cricket': 'Cricket',
    'boxing': 'Boxing',
    'mma': 'MMA',
    'volleyball': 'Volleyball',
    'rugby': 'Rugby',
    'rugbyleague': 'Rugby League',
    'aussierules': 'Aussie Rules',
    'handball': 'Handball',
    'tabletennis': 'Table Tennis'
  };

  // Prefer canonical mapping when available
  const normalizedKey = String(sportKeyOrName || '').toLowerCase();
  if (CANONICAL_LEAGUE_MAP[normalizedKey]) {
    const c = CANONICAL_LEAGUE_MAP[normalizedKey];
    const parts = [c.sport, c.country, c.league].filter(Boolean);
    return parts.join('.');
  }

  const { sport, countryFromKey, leagueFromKey } = parseSportKey(sportKeyOrName);

  // Sport: prefer parsed sport from key, else raw name, else fallback title
  const sportRaw = sport || sportKeyOrName || fallbackSportTitle || '';
  const normalizedSportKey = String(sportRaw).toLowerCase().replace(/\s+/g, '');
  const mappedDisplay = SPORT_DISPLAY_MAP[normalizedSportKey];
  const sportDisplay = mappedDisplay || titleCase(sportRaw);

  // Country: explicit country wins; else derive from sport_key; else empty
  const countryRaw = country || countryFromKey || '';
  let countryDisplay = titleCase(countryRaw);

  // League: explicit league wins; else derive from sport_key remainder; else fallback sport_title
  const leagueRaw = leagueName || leagueFromKey || fallbackSportTitle || '';
  let leagueDisplay = titleCase(leagueRaw);

  // Avoid duplicating country if league already contains it (e.g., "England Premier League")
  if (countryDisplay) {
    const lcLeague = leagueDisplay.toLowerCase();
    const lcCountry = countryDisplay.toLowerCase();
    if (lcLeague.includes(lcCountry)) {
      countryDisplay = '';
    }
  }

  // Remove redundant segments like Sport.Country where Country == Sport, or Sport.League where League == Sport
  if (sportDisplay && countryDisplay && sportDisplay.toLowerCase() === countryDisplay.toLowerCase()) {
    countryDisplay = '';
  }
  if (sportDisplay && leagueDisplay && sportDisplay.toLowerCase() === leagueDisplay.toLowerCase()) {
    leagueDisplay = '';
  }

  // Final de-duplication to handle any remaining case-insensitive duplicates
  const rawParts = [sportDisplay, countryDisplay, leagueDisplay];
  const parts = [];
  for (const p of rawParts) {
    const norm = String(p || '').trim();
    if (!norm) continue;
    if (!parts.some(x => x.toLowerCase() === norm.toLowerCase())) {
      parts.push(norm);
    }
  }
  return parts.join('.');
}

export default computeFullLeagueTitle;