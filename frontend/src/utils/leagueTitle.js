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
  // Map common sport tokens and names to normalized display names
  const SPORT_DISPLAY_MAP = {
    'soccer': 'Soccer',
    'football': 'American Football',
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