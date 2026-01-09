import { transformInternalOddsToMarketsPublic } from '../../utils/oddsTransform';

describe('transformInternalOddsToMarkets - custom arrays', () => {
  test('renders Correct Score and Multi Goals from variant keys', () => {
    const matchData = {
      homeTeam: 'Borussia Dortmund',
      awayTeam: 'Bayern Munich',
      odds: {
        CorrectScore: [
          { score: '1-0', odds: '7.5' },
          { score: '2-1', odds: '8.0' }
        ],
        MultiGoals: [
          { range: '2-3', odds: '2.10' },
          { band: '3-4', odds: '3.50' }
        ]
      }
    };
    const markets = transformInternalOddsToMarketsPublic(matchData);
    const titles = markets.map(m => m.title);
    expect(titles).toContain('Correct Score');
    expect(titles).toContain('Multi Goals');
    const cs = markets.find(m => m.title === 'Correct Score');
    const mg = markets.find(m => m.title === 'Multi Goals');
    expect(cs.outcomes.some(o => o.name === '1-0' && o.price === 7.5)).toBe(true);
    expect(cs.outcomes.some(o => o.name === '2-1' && o.price === 8.0)).toBe(true);
    expect(mg.outcomes.some(o => o.name === '2-3 Goals' && o.price === 2.10)).toBe(true);
    expect(mg.outcomes.some(o => o.name === '3-4 Goals' && o.price === 3.50)).toBe(true);
  });
});
