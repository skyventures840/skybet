import { normalizeMarketKey } from './marketTitles';

export const transformInternalOddsToMarketsPublic = (matchData) => {
  if (!matchData?.odds) return [];
  const homeName = matchData.homeTeam || matchData.home_team || 'Home';
  const awayName = matchData.awayTeam || matchData.away_team || 'Away';
  const markets = [];
  const oddsData = matchData.odds;
  const arrayMarkets = [
    { key: 'correctScore', altKeys: ['correct_score', 'CorrectScore', 'correctscore', 'correct score'], name: 'Correct Score', processor: (item) => item.score && item.odds ? [{ name: item.score, price: Number(item.odds) }] : [] },
    { key: 'multiGoals', altKeys: ['multi_goals', 'goalBands', 'Multigoals', 'MultiGoals', 'multi goals', 'goalbands'], name: 'Multi Goals', processor: (item) => {
      const rg = item.range || item.band;
      return rg && item.odds ? [{ name: `${rg} Goals`, price: Number(item.odds) }] : [];
    } },
    { key: 'handicaps', altKeys: [], name: 'Handicap', processor: (item) => {
      if (item.line && item.homeOdds && item.awayOdds) {
        const line = parseFloat(item.line);
        const homeLine = line > 0 ? `+${line}` : `${line}`;
        const awayLine = -line > 0 ? `+${-line}` : `${-line}`;
        return [
          { name: `${homeName} (${homeLine})`, price: Number(item.homeOdds) },
          { name: `${awayName} (${awayLine})`, price: Number(item.awayOdds) }
        ];
      }
      return [];
    }}
  ];
  arrayMarkets.forEach(m => {
    const keysToCheck = [m.key, ...(m.altKeys || [])];
    let presentKey = keysToCheck.find(k => Array.isArray(oddsData[k]) && oddsData[k].length > 0);
    if (!presentKey) {
      const structuralMatch = Object.keys(oddsData).find(k => {
        const v = oddsData[k];
        if (!Array.isArray(v) || v.length === 0) return false;
        if (m.key === 'correctScore') return v.some(it => it && typeof it === 'object' && 'score' in it && 'odds' in it);
        if (m.key === 'multiGoals') return v.some(it => it && typeof it === 'object' && ('range' in it || 'band' in it) && 'odds' in it);
        return false;
      });
      presentKey = structuralMatch;
    }
    if (presentKey) {
      const outcomes = [];
      oddsData[presentKey].forEach(item => {
        outcomes.push(...m.processor(item));
      });
      if (outcomes.length > 0) {
        const normalizedArrKey = normalizeMarketKey(m.name);
        markets.push({ key: normalizedArrKey, title: m.name, outcomes });
      }
    }
  });
  return markets;
};

