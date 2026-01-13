import React, { useState, useEffect } from 'react';
import SkeletonLoader from '../components/SkeletonLoader';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import apiService from '../services/api';
import getMarketTitle, { normalizeMarketKey } from '../utils/marketTitles';
import enhancedCache from '../services/enhancedCache';
import LockedOdds from '../components/LockedOdds';
import { assessOddsRisk } from '../utils/riskManagement';

export const transformInternalOddsToMarketsPublic = (matchData) => {
    if (!matchData?.odds) return [];
    const homeName = matchData.homeTeam || matchData.home_team || 'Home';
    const awayName = matchData.awayTeam || matchData.away_team || 'Away';
    const markets = [];
    const oddsData = matchData.odds;
    const consume = () => void 0;
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
            consume(presentKey);
        }
    });
    return markets;
};

const MatchMarkets = () => {
    const { matchId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useDispatch();
    const [match, setMatch] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedMarket, setSelectedMarket] = useState('all');
    // Track expanded/collapsed state per market key
    const [expandedByKey, setExpandedByKey] = useState({});

    // Title helper from shared util
    const titleForKey = (normKey) => getMarketTitle(normKey);

    useEffect(() => {
        // First restore from durable cache/session for instant display
        try {
            const cached = enhancedCache.getCachedData(`/matches/${matchId}/markets`);
            if (cached && (cached.markets || cached.bookmakers)) {
                const matchData = cached;
                let processedMatchData = { ...matchData };
                if (matchData.markets && Array.isArray(matchData.markets) && matchData.markets.length > 0) {
                    processedMatchData.markets = mergeAndNormalizeMarkets(matchData.markets, matchData);
                } else if (matchData.odds) {
                    processedMatchData.markets = transformInternalOddsToMarkets(matchData);
                } else if (matchData.bookmakers && matchData.bookmakers.length > 0) {
                     // Bookmaker processing logic (simplified for restoration)
                     // In real fetch, we have full logic.
                }
                if (processedMatchData.markets) {
                     setMatch(processedMatchData);
                     setLoading(false);
                }
            }
        } catch (restoreErr) { void restoreErr; }

        const fetchMatch = async () => {
            const maxAttempts = 3;
            let lastErr = null;
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                try {
                    if (!match) setLoading(true);
                    setError(null);
                    const response = await apiService.getMatchMarkets(matchId, { full: true });
                    const matchData = response.data;
                    let processedMatchData = { ...matchData };
                    if (matchData.markets && Array.isArray(matchData.markets) && matchData.markets.length > 0) {
                        processedMatchData.markets = mergeAndNormalizeMarkets(matchData.markets, matchData);
                    } else if (matchData.odds) {
                        processedMatchData.markets = transformInternalOddsToMarkets(matchData);
                    } else if (matchData.bookmakers && matchData.bookmakers.length > 0) {
                        const aggregated = new Map();
                        matchData.bookmakers.forEach((bookmaker) => {
                            (bookmaker.markets || []).forEach((market) => {
                                const normKey = normalizeMarketKey(market.key);
                                const marketTitle = titleForKey(normKey);
                                const existing = aggregated.get(normKey);
                                const incomingOutcomes = (market.outcomes || []).map(outcome => ({
                                    name: outcome.name,
                                    price: outcome.price,
                                    point: outcome.point || null
                                }));
                                if (!existing) {
                                    aggregated.set(normKey, { key: normKey, title: marketTitle, outcomes: incomingOutcomes });
                                } else {
                                    const bySig = new Map();
                                    [...existing.outcomes, ...incomingOutcomes].forEach(o => {
                                        const sig = `${(o.name||'').toLowerCase()}|${o.point ?? ''}`;
                                        if (!bySig.has(sig)) bySig.set(sig, o);
                                        else {
                                            const prev = bySig.get(sig);
                                            if ((!prev.price || prev.price <= 0) && o.price && o.price > 0) bySig.set(sig, o);
                                        }
                                    });
                                    existing.outcomes = Array.from(bySig.values());
                                }
                            });
                        });
                        const markets = Array.from(aggregated.values());
                        processedMatchData.markets = normalizeOutcomeLabels(markets, matchData);
                    } else {
                        processedMatchData.markets = [];
                    }
                    setMatch(processedMatchData);
                    try { sessionStorage.setItem(`match_markets_${matchId}`, JSON.stringify(processedMatchData)); } catch { void 0; }
                    setLoading(false);
                    return;
                } catch (error) {
                    lastErr = error;
                    const delays = [500, 1500, 3500];
                    const delay = delays[attempt] || 5000;
                    await new Promise(res => setTimeout(res, delay));
                }
            }
            // Fallback logic could be added here
            setError(lastErr?.message || 'Failed to load match data');
            setLoading(false);
        };

        if (matchId) {
            fetchMatch();
        } else {
            setError('No match ID provided');
            setLoading(false);
        }
    }, [matchId, location.search]);

    // Helper to sort outcomes for specific markets
    const sortOutcomes = (marketName, outcomes) => {
        if (marketName === 'Correct Score') {
            return outcomes.sort((a, b) => {
                const getScore = (name) => {
                    const match = name.match(/(\d+)-(\d+)/);
                    if (!match) return [999, 999];
                    return [parseInt(match[1]), parseInt(match[2])];
                };
                const [h1, a1] = getScore(a.name);
                const [h2, a2] = getScore(b.name);
                if (h1 !== h2) return h1 - h2;
                return a1 - a2;
            });
        }
        if (marketName === 'Multi Goals') {
            return outcomes.sort((a, b) => {
                const getRange = (name) => {
                    const match = name.match(/(\d+)-(\d+)/);
                    if (!match) return [0, 0];
                    return [parseInt(match[1]), parseInt(match[2])];
                };
                const [min1, max1] = getRange(a.name);
                const [min2, max2] = getRange(b.name);
                if (min1 !== min2) return min1 - min2;
                return max1 - max2;
            });
        }
        if (['Corners', 'Cards'].includes(marketName)) {
            // Sort by Over/Under line
            return outcomes.sort((a, b) => {
                const getLine = (name) => {
                    const match = name.match(/(\d+(\.\d+)?)/);
                    return match ? parseFloat(match[0]) : 0;
                };
                const lineA = getLine(a.name);
                const lineB = getLine(b.name);
                
                // Group Overs then Unders, or just by line?
                // Usually sort by line ascending
                if (lineA !== lineB) return lineA - lineB;
                
                // If same line, Over before Under
                if (a.name.includes('Over') && b.name.includes('Under')) return -1;
                if (a.name.includes('Under') && b.name.includes('Over')) return 1;
                return 0;
            });
        }
        return outcomes;
    };

    // Transform internal odds format (custom matches) to markets array
    const transformInternalOddsToMarkets = (matchData) => {
        if (!matchData.odds) return [];
        
        const homeName = matchData.homeTeam || matchData.home_team || 'Home';
        const awayName = matchData.awayTeam || matchData.away_team || 'Away';
        
        const markets = [];
        const oddsData = matchData.odds;
        const consumedKeys = new Set();
        const allKeys = Object.keys(oddsData);
        
        const consume = (...keys) => keys.forEach(k => consumedKeys.add(k));

        // 1. Match Winner
        const win1 = oddsData.homeWin || oddsData['1'];
        const winX = oddsData.draw || oddsData['X'] || oddsData['x'];
        const win2 = oddsData.awayWin || oddsData['2'];

        if (win1 || winX || win2) {
            const outcomes = [];
            if (win1) outcomes.push({ name: homeName, price: Number(win1) });
            if (winX) outcomes.push({ name: 'Draw', price: Number(winX) });
            if (win2) outcomes.push({ name: awayName, price: Number(win2) });
            
            if (outcomes.length > 0) {
                markets.push({ key: 'winner', title: 'Match Winner', outcomes });
                consume('homeWin', 'draw', 'awayWin', '1', 'X', 'x', '2');
            }
        }

        // 2. Grouped Markets
        const groupedMarkets = [
            {
                name: 'Correct Score',
                matcher: k => {
                    const lower = k.toLowerCase();
                    return (lower.includes('correct') && lower.includes('score')) || lower.startsWith('cs');
                },
                mapper: (key, val) => {
                    const match = key.match(/(\d+)[-_:\s]+(\d+)/);
                    if (match) return { name: `${match[1]}-${match[2]}`, price: Number(val) };
                    if (key.toLowerCase().includes('other')) return { name: 'Other', price: Number(val) };
                    return null;
                }
            },
            {
                name: 'Multi Goals',
                matcher: k => {
                    const lower = k.toLowerCase();
                    return (lower.includes('multi') && lower.includes('goal')) || lower.startsWith('mg');
                },
                mapper: (key, val) => {
                    const match = key.match(/(\d+)[-_:\s]+(\d+)/);
                    if (match) return { name: `${match[1]}-${match[2]} Goals`, price: Number(val) };
                    return null;
                }
            },
            {
                name: 'Double Chance',
                matcher: k => {
                    const lower = k.toLowerCase().replace(/_/g, '');
                    return lower.includes('doublechance') || 
                           ['1x', '12', '2x', 'dc1x', 'dc12', 'dc2x'].includes(lower);
                },
                mapper: (key, val) => {
                    const lower = key.toLowerCase().replace(/_/g, '');
                    if (lower.includes('homedraw') || lower.includes('1x')) return { name: 'Home/Draw', price: Number(val) };
                    if (lower.includes('homeaway') || lower.includes('12')) return { name: 'Home/Away', price: Number(val) };
                    if (lower.includes('drawaway') || lower.includes('x2') || lower.includes('2x')) return { name: 'Draw/Away', price: Number(val) };
                    return null;
                }
            },
            {
                name: 'Both Teams to Score',
                matcher: k => {
                    const lower = k.toLowerCase().replace(/_/g, '');
                    return lower.includes('btts') || lower.includes('bothteamstoscore');
                },
                mapper: (key, val) => {
                    const lower = key.toLowerCase();
                    if (lower.includes('yes')) return { name: 'Yes', price: Number(val) };
                    if (lower.includes('no')) return { name: 'No', price: Number(val) };
                    return null;
                }
            },
            {
                name: 'Penalty Awarded',
                matcher: k => k.toLowerCase().includes('penalty'),
                mapper: (key, val) => {
                    const lower = key.toLowerCase();
                    if (lower.includes('yes')) return { name: 'Yes', price: Number(val) };
                    if (lower.includes('no')) return { name: 'No', price: Number(val) };
                    return null;
                }
            },
            {
                name: 'Odd/Even',
                matcher: k => k.toLowerCase().includes('oddeven'),
                mapper: (key, val) => {
                    const lower = key.toLowerCase();
                    const clean = lower.replace(/oddeven/g, '');
                    
                    if (clean.includes('even') || lower.endsWith('even')) return { name: 'Even', price: Number(val) };
                    if (clean.includes('odd') || lower.endsWith('odd')) return { name: 'Odd', price: Number(val) };
                    return null;
                }
            },
            {
                name: 'Half-Time/Full-Time',
                matcher: k => k.toLowerCase().startsWith('htft') || k.toLowerCase().startsWith('ht_ft'),
                mapper: (key, val) => {
                     const mapCode = { 
                        'HH': 'Home/Home', 'HD': 'Home/Draw', 'HA': 'Home/Away', 
                        'DH': 'Draw/Home', 'DD': 'Draw/Draw', 'DA': 'Draw/Away', 
                        'AH': 'Away/Home', 'AD': 'Away/Draw', 'AA': 'Away/Away' 
                    };
                    const upperKey = key.toUpperCase();
                    let name = null;
                    Object.keys(mapCode).forEach(code => {
                        if (upperKey.endsWith(code)) name = mapCode[code];
                    });
                    return name ? { name, price: Number(val) } : null;
                }
            }
        ];

        groupedMarkets.forEach(group => {
            const keys = allKeys.filter(k => group.matcher(k));
            const outcomes = [];
            keys.forEach(key => {
                if (consumedKeys.has(key)) return;
                const val = oddsData[key];
                if (!val) return;
                
                const option = group.mapper(key, val);
                if (option) {
                    outcomes.push(option);
                    consume(key); // Only consume if successfully mapped
                }
            });
            
            if (outcomes.length > 0) {
                const sorted = sortOutcomes(group.name, outcomes);
                markets.push({ key: `grouped_${group.name.replace(/\s+/g, '_')}`, title: group.name, outcomes: sorted });
            }
        });

        // 3. Totals
        const over = oddsData.over || oddsData.TM || oddsData.tm;
        const under = oddsData.under || oddsData.TU || oddsData.tu;
        const line = oddsData.total || oddsData.Total || '2.5';

        if (over || under) {
            const outcomes = [];
            if (over) outcomes.push({ name: `Over (${line})`, price: Number(over) });
            if (under) outcomes.push({ name: `Under (${line})`, price: Number(under) });
            
            if (outcomes.length > 0) {
                markets.push({ key: 'totals', title: 'Totals', outcomes });
                consume('over', 'under', 'total', 'TM', 'TU', 'tm', 'tu', 'Total');
            }
        }

        // 4. Handicap (spreads) from numeric keys
        const homeHandicap = oddsData.homeHandicap;
        const awayHandicap = oddsData.awayHandicap;
        const handicapLine = oddsData.handicapLine;
        if (homeHandicap && awayHandicap) {
            const outcomes = [];
            const formattedLineHome = handicapLine != null ? (handicapLine >= 0 ? `+${handicapLine}` : `${handicapLine}`) : null;
            const formattedLineAway = handicapLine != null ? (handicapLine >= 0 ? `+${handicapLine}` : `${handicapLine}`) : null;
            outcomes.push({ name: formattedLineHome ? `${homeName} (${formattedLineHome})` : homeName, price: Number(homeHandicap) });
            outcomes.push({ name: formattedLineAway ? `${awayName} (${formattedLineAway})` : awayName, price: Number(awayHandicap) });
            markets.push({ key: 'spreads', title: 'Handicap', outcomes });
            consume('homeHandicap', 'awayHandicap', 'handicapLine');
        }

        // 5. Corners
        const cornerKeys = allKeys.filter(k => k.toLowerCase().includes('corners'));
        if (cornerKeys.length > 0) {
            const outcomes = [];
            const usedKeys = [];
            const lineKey = cornerKeys.find(k => k.toLowerCase().includes('line'));
            const globalLine = lineKey ? oddsData[lineKey] : null;
            if (lineKey) usedKeys.push(lineKey);
            
            cornerKeys.forEach(key => {
                if (key === lineKey) return;
                const val = oddsData[key];
                if (!val) return;
                
                const lower = key.toLowerCase();
                let name = 'Unknown';
                
                const keyLineMatch = lower.match(/(?:over|under)[_\s]*(\d+(\.\d+)?)/);
                const currentLine = keyLineMatch ? keyLineMatch[1] : globalLine;

                if (lower.includes('over')) name = currentLine ? `Over (${currentLine})` : 'Over';
                else if (lower.includes('under')) name = currentLine ? `Under (${currentLine})` : 'Under';
                else if ((lower.includes('1') || lower.includes('home')) && !lower.includes('1x') && !lower.includes('12')) name = homeName;
                else if ((lower.includes('2') || lower.includes('away')) && !lower.includes('2x') && !lower.includes('12')) name = awayName;
                else if ((lower.includes('x') || lower.includes('draw')) && !lower.includes('1x') && !lower.includes('2x')) name = 'Draw';
                
                if (name !== 'Unknown') {
                    outcomes.push({ name, price: Number(val) });
                    usedKeys.push(key);
                }
            });
            
            if (outcomes.length > 0) {
                const sorted = sortOutcomes('Corners', outcomes);
                markets.push({ key: 'corners', title: 'Corners', outcomes: sorted });
                consume(...usedKeys);
            }
        }

        // 6. Cards
        const cardKeys = allKeys.filter(k => k.toLowerCase().includes('cards'));
        if (cardKeys.length > 0) {
            const outcomes = [];
            const usedKeys = [];
            const lineKey = cardKeys.find(k => k.toLowerCase().includes('line'));
            const globalLine = lineKey ? oddsData[lineKey] : null;
            if (lineKey) usedKeys.push(lineKey);
            
            cardKeys.forEach(key => {
                if (key === lineKey) return;
                const val = oddsData[key];
                if (!val) return;
                
                const lower = key.toLowerCase();
                let name = 'Unknown';
                
                const keyLineMatch = lower.match(/(?:over|under)[_\s]*(\d+(\.\d+)?)/);
                const currentLine = keyLineMatch ? keyLineMatch[1] : globalLine;

                if (lower.includes('over')) name = currentLine ? `Over (${currentLine})` : 'Over';
                else if (lower.includes('under')) name = currentLine ? `Under (${currentLine})` : 'Under';
                else if ((lower.includes('1') || lower.includes('home'))) name = homeName;
                else if ((lower.includes('2') || lower.includes('away'))) name = awayName;
                else if ((lower.includes('x') || lower.includes('draw'))) name = 'Draw';
                
                if (name !== 'Unknown') {
                    outcomes.push({ name, price: Number(val) });
                    usedKeys.push(key);
                }
            });
            
            if (outcomes.length > 0) {
                const sorted = sortOutcomes('Cards', outcomes);
                markets.push({ key: 'cards', title: 'Cards', outcomes: sorted });
                consume(...usedKeys);
            }
        }

        // 10. Array Markets (For legacy/array data)
        const arrayMarkets = [
            // Support common key variants for correct score and multi goals
            { key: 'correctScore', altKeys: ['correct_score', 'CorrectScore', 'correctscore', 'correct score'], name: 'Correct Score', processor: (item) => item.score && item.odds ? [{ name: item.score, price: Number(item.odds) }] : [] },
            { key: 'multiGoals', altKeys: ['multi_goals', 'goalBands', 'Multigoals', 'MultiGoals', 'multi goals', 'goalbands'], name: 'Multi Goals', processor: (item) => {
                const rg = item.range || item.band;
                return rg && item.odds ? [{ name: `${rg} Goals`, price: Number(item.odds) }] : [];
            } },
            { key: 'winningMargin', altKeys: [], name: 'Winning Margin', processor: (item) => item.margin && item.odds ? [{ name: item.margin, price: Number(item.odds) }] : [] },
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
            }},
            { key: 'goalScorers', name: 'Goalscorers', processor: null }
        ];

        arrayMarkets.forEach(m => {
            const keysToCheck = [m.key, ...(m.altKeys || [])];
            let presentKey = keysToCheck.find(k => Array.isArray(oddsData[k]) && oddsData[k].length > 0);
            // Fallback: scan any array-like key that matches structure
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
                if (m.key === 'goalScorers') {
                     const types = ['First', 'Anytime', 'Last'];
                     types.forEach(type => {
                         const typeOptions = oddsData.goalScorers
                            .filter(item => item.type && item.type.toLowerCase() === type.toLowerCase() && item.player && item.odds)
                            .map(item => ({ name: `${item.player}`, price: Number(item.odds) }));
                         
                         if (typeOptions.length > 0) {
                             markets.push({ key: `goalscorer_${type.toLowerCase()}`, title: `${type} Goalscorer`, outcomes: typeOptions });
                         }
                     });
                } else {
                    const outcomes = [];
                    oddsData[presentKey].forEach(item => {
                        outcomes.push(...m.processor(item));
                    });
                    if (outcomes.length > 0) {
                        const normalizedArrKey = normalizeMarketKey(m.name);
                        markets.push({ key: normalizedArrKey, title: m.name, outcomes });
                    }
                }
                consume(presentKey);
            }
        });

        // 11. Custom Markets Array
        if (Array.isArray(oddsData.customMarkets)) {
            oddsData.customMarkets.forEach((customMarket, idx) => {
                if (customMarket.name && Array.isArray(customMarket.options)) {
                    const validOptions = customMarket.options
                        .filter(opt => opt.name && opt.odds)
                        .map(opt => ({ name: opt.name, price: Number(opt.odds) }));
                    
                    if (validOptions.length > 0) {
                        const canonicalKey = normalizeMarketKey(customMarket.name);
                        const canonicalTitle = getMarketTitle(canonicalKey) || customMarket.name;
                        markets.push({ key: canonicalKey || `custom_${idx}`, title: canonicalTitle, outcomes: validOptions });
                    }
                }
            });
            consume('customMarkets');
        }
        
        // 12. Generic Fallback
        const alwaysExclude = ['_id', 'id', 'createdAt', 'updatedAt', 'matchId'];
        allKeys.forEach(key => {
            if (consumedKeys.has(key)) return;
            if (alwaysExclude.includes(key)) return;
            
            const val = oddsData[key];
            if (!val && val !== 0) return;
            if (typeof val === 'object') return;

            const formattedName = key
                .replace(/([A-Z])/g, ' $1')
                .replace(/_/g, ' ')
                .replace(/^\w/, c => c.toUpperCase())
                .trim();
            
            markets.push({
                key: `generic_${key}`,
                title: formattedName,
                outcomes: [{ name: formattedName, price: Number(val) }]
            });
        });

        return markets;
    };

    // Merge and normalize markets when backend provides markets array
    const mergeAndNormalizeMarkets = (markets, matchData) => {
        const aggregated = new Map();
        markets.forEach(m => {
            const normKey = normalizeMarketKey(m.key || m.title);
            const title = titleForKey(normKey);
            const incomingOutcomes = (m.outcomes || []).map(o => ({
                name: o.name,
                price: Number(o.price),
                point: o.point || null
            }));
            const existing = aggregated.get(normKey);
            if (!existing) {
                aggregated.set(normKey, { key: normKey, title, outcomes: incomingOutcomes });
            } else {
                const bySig = new Map();
                [...existing.outcomes, ...incomingOutcomes].forEach(o => {
                    const sig = `${(o.name||'').toLowerCase()}|${o.point ?? ''}`;
                    if (!bySig.has(sig)) bySig.set(sig, o);
                    else {
                        const prev = bySig.get(sig);
                        if ((!prev.price || prev.price <= 0) && o.price && o.price > 0) bySig.set(sig, o);
                    }
                });
                existing.outcomes = Array.from(bySig.values());
            }
        });
        return normalizeOutcomeLabels(Array.from(aggregated.values()), matchData);
    };

    // Standardize outcome labels inside grouped markets
    const normalizeOutcomeLabels = (markets, matchData) => {
        const homeName = matchData.homeTeam || matchData.home_team || 'Home';
        const awayName = matchData.awayTeam || matchData.away_team || 'Away';
        return markets.map(m => {
            if (m.key === 'winner') {
                m.outcomes = m.outcomes.map(o => {
                    let name = (o.name || '').toLowerCase();
                    if (['home','home win','homewin','1'].includes(name)) return { ...o, name: homeName };
                    if (['away','away win','awaywin','2'].includes(name)) return { ...o, name: awayName };
                    if (['draw','x','tie'].includes(name)) return { ...o, name: 'Draw' };
                    return o;
                });
                const byName = new Map();
                m.outcomes.forEach(o => {
                    const key = (o.name || '').toLowerCase();
                    if (!byName.has(key)) byName.set(key, o);
                    else if ((!byName.get(key).price || byName.get(key).price <= 0) && o.price && o.price > 0) byName.set(key, o);
                });
                m.outcomes = Array.from(byName.values());
            }

            if (m.key === 'both_teams_to_score') {
                m.outcomes = m.outcomes.map(o => {
                    const lower = (o.name || '').toLowerCase().replace(/_/g, '');
                    if (lower.includes('yes')) return { ...o, name: 'Yes' };
                    if (lower.includes('no')) return { ...o, name: 'No' };
                    return o;
                });
            }

            if (m.key === 'double_chance') {
                 m.outcomes = m.outcomes.map(o => {
                    const lower = (o.name || '').toLowerCase().replace(/_/g, '');
                    if (lower.includes('homedraw') || lower.includes('1x') || lower === 'dc1x') return { ...o, name: 'Home/Draw' };
                    if (lower.includes('homeaway') || lower.includes('12') || lower === 'dc12') return { ...o, name: 'Home/Away' };
                    if (lower.includes('drawaway') || lower.includes('x2') || lower.includes('2x') || lower === 'dc2x') return { ...o, name: 'Draw/Away' };
                    return o;
                });
            }

            if (m.key === 'totals' || (m.key || '').includes('totals')) {
                m.outcomes = m.outcomes.map(o => {
                    let name = (o.name || '').toLowerCase();
                    name = name.replace(/\bhome\b/g, homeName.toLowerCase()).replace(/\baway\b/g, awayName.toLowerCase());
                    const isOver = /(\bover\b|\bov\b|\bo\b)/.test(name);
                    const isUnder = /(\bunder\b|\bun\b|\bu\b)/.test(name);
                    if (isOver) {
                        const replaced = name.replace(/\bover\b|\bov\b|\bo\b/i, 'Over');
                        const display = o.point != null && !/\([^)]*\)/.test(replaced) ? `${replaced} (${o.point})` : replaced;
                        return { ...o, name: display.replace(/^\w/, c => c.toUpperCase()), point: null };
                    }
                    if (isUnder) {
                        const replaced = name.replace(/\bunder\b|\bun\b|\bu\b/i, 'Under');
                        const display = o.point != null && !/\([^)]*\)/.test(replaced) ? `${replaced} (${o.point})` : replaced;
                        return { ...o, name: display.replace(/^\w/, c => c.toUpperCase()), point: null };
                    }
                    return o;
                });
                const bySig = new Map();
                m.outcomes.forEach(o => {
                    const n = (o.name || '').toLowerCase();
                    const teamCtx = n.startsWith(homeName.toLowerCase()) ? 'home' : (n.startsWith(awayName.toLowerCase()) ? 'away' : '');
                    const base = n.includes('over') ? `${teamCtx}over` : (n.includes('under') ? `${teamCtx}under` : n);
                    if (!bySig.has(base)) bySig.set(base, o);
                    else if ((!bySig.get(base).price || bySig.get(base).price <= 0) && o.price && o.price > 0) bySig.set(base, o);
                });
                m.outcomes = Array.from(bySig.values()).filter(o => {
                    const n = (o.name || '').toLowerCase();
                    return n.includes('over') || n.includes('under');
                });
                if (m.key === 'totals') {
                    m.title = 'Totals';
                }
            }
            if (m.key === 'spreads') {
                const normalized = [];
                m.outcomes.forEach(o => {
                    const raw = (o.name || '').toLowerCase();
                    const isHome = raw.includes('home') || raw === (homeName || '').toLowerCase();
                    const isAway = raw.includes('away') || raw === (awayName || '').toLowerCase();
                    const signPoint = o.point != null ? (o.point >= 0 ? `+${o.point}` : `${o.point}`) : null;
                    if (isHome) {
                        normalized.push({ ...o, name: signPoint ? `${homeName} (${signPoint})` : `${homeName}`, point: null });
                    } else if (isAway) {
                        normalized.push({ ...o, name: signPoint ? `${awayName} (${signPoint})` : `${awayName}`, point: null });
                    } else {
                        const label = signPoint ? `${o.name} (${signPoint})` : (o.name || '');
                        normalized.push({ ...o, name: label, point: null });
                    }
                });
                const bySide = new Map();
                normalized.forEach(o => {
                    const lower = (o.name || '').toLowerCase();
                    const key = lower.includes((homeName || '').toLowerCase()) ? 'home' : (lower.includes((awayName || '').toLowerCase()) ? 'away' : lower);
                    if (!bySide.has(key)) bySide.set(key, o);
                    else if ((!bySide.get(key).price || bySide.get(key).price <= 0) && o.price && o.price > 0) bySide.set(key, o);
                });
                m.outcomes = Array.from(bySide.values());
                m.title = 'Handicap';
            }
            return m;
        });
    };

    // Render logic remains standard...
    // (Simplified for restoration, but needs to match original for UI)
    
    // ... Copying render from memory/standard pattern ...
    
    // Function to add bet to betslip
  const addToBetslip = (marketKey, outcome, marketTitle) => {
    if (!match) return;
    const isGrouped = String(marketKey || '').toLowerCase().startsWith('grouped_');
    const normalizedKey = isGrouped ? normalizeMarketKey(marketTitle) : normalizeMarketKey(marketKey);
    const marketTypeDisplay = (() => {
        const sel = String(outcome?.name || '').toLowerCase();
        if (/^\s*\d+\s*-\s*\d+\s*$/.test(sel) && !/goals?/i.test(sel)) return 'Correct Score';
        if (!normalizedKey) return 'Market';
        if (normalizedKey === 'winner') return 'Winner';
        if (normalizedKey.startsWith('totals')) return 'Totals';
        if (normalizedKey.startsWith('spreads')) return 'Handicap';
        return getMarketTitle(normalizedKey);
    })();

    const bet = {
            matchId: match._id || match.id,
            match: `${match.homeTeam || match.home_team} vs ${match.awayTeam || match.away_team}`,
            homeTeam: match.homeTeam || match.home_team,
            awayTeam: match.awayTeam || match.away_team,
            league: match.league || match.sport_title,
            startTime: match.startTime || match.commence_time,
            market: normalizedKey,
        marketDisplay: marketTypeDisplay,
        marketType: normalizedKey,
        marketTypeDisplay,
        selection: outcome.name,
        point: outcome.point,
        odds: outcome.price,
            stake: 0,
            potentialWin: 0
        };
        dispatch({ type: 'activeBets/addBet', payload: bet });
    };

    const formatMatchTime = (startTime) => {
        const date = new Date(startTime);
        return date.toLocaleString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    const getFilteredMarkets = () => {
        if (!match || !match.markets || !Array.isArray(match.markets)) return [];
        if (selectedMarket === 'all') {
            return match.markets.filter(market => market.outcomes && market.outcomes.length > 0);
        }
        return match.markets.filter(market => market.key === selectedMarket && market.outcomes && market.outcomes.length > 0);
    };

    const toggleMarket = (key) => {
        setExpandedByKey(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // Initialize expanded state
    useEffect(() => {
        if (match && match.markets) {
            if (Object.keys(expandedByKey).length === 0) {
                const initial = {};
                match.markets.forEach(m => initial[m.key] = true);
                setExpandedByKey(initial);
            }
        }
    }, [match]);

    if (loading && !match) return <SkeletonLoader type="match-card" count={6} />;
    if (error && !match) return <div className="error">{error}</div>;
    if (!match) return <div className="error">Match not found</div>;

    const filteredMarkets = getFilteredMarkets();

    return (
        <div className="match-markets-page">
            <div className="match-markets-header">
                <button onClick={() => navigate(-1)} className="back-button">← Back</button>
                <h1>Match Markets</h1>
            </div>
            <div className="match-info-card">
                <div className="match-teams">
                    <h2>{match.homeTeam || match.home_team} vs {match.awayTeam || match.away_team}</h2>
                    <p className="match-league">{match.league || match.sport_title}</p>
                    <p className="match-time">{formatMatchTime(match.startTime || match.commence_time)}</p>
                </div>
                <div className="market-filter">
                    <label>Filter Markets:</label>
                    <select value={selectedMarket} onChange={(e) => setSelectedMarket(e.target.value)}>
                        <option value="all">All Markets</option>
                        {match.markets.map(market => (
                            <option key={market.key} value={market.key}>{market.title}</option>
                        ))}
                    </select>
                </div>
            </div>
            <div className="markets-container">
                {filteredMarkets.map(market => (
                    <div key={market.key} className={`market-card ${expandedByKey[market.key] ? 'expanded' : 'collapsed'}`}>
                        <button className="market-header" onClick={() => toggleMarket(market.key)}>
                            <h3>{market.title}</h3>
                            <span className="market-chevron">▼</span>
                        </button>
                        <div className="market-outcomes">
                            {market.outcomes.map((outcome, index) => {
                                const riskAssessment = assessOddsRisk(match, Number(outcome.price), outcome.name);
                                if (riskAssessment.shouldDisable) {
                                    return (
                                        <LockedOdds
                                            key={index}
                                            riskAssessment={riskAssessment}
                                            className="outcome-button"
                                        />
                                    );
                                }
                                return (
                                    <button key={index} className="outcome-button" onClick={() => addToBetslip(market.key, outcome, market.title)}>
                                        <div className="outcome-name">{outcome.name} {outcome.point && `(${outcome.point})`}</div>
                                        <div className="outcome-odds">{outcome.price ? Number(outcome.price).toFixed(2) : '-'}</div>
                                    </button>
                                );
                            })}
                        </div>
                        </div>
                    ))}
                </div>
            </div>
    );
};

export default MatchMarkets;
