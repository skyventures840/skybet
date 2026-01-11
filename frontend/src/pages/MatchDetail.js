import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import apiService from '../services/api';
import getMarketTitle, { normalizeMarketKey } from '../utils/marketTitles';
import VideoPlayerScheduled from '../components/VideoPlayerScheduled';
import { assessOddsRisk } from '../utils/riskManagement';
import LockedOdds from '../components/LockedOdds';

const MatchDetail = () => {
    const { matchId } = useParams();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [match, setMatch] = useState(null);
    const [expandedMarkets, setExpandedMarkets] = useState({});
    const [selectedTab, setSelectedTab] = useState('regular');
    const [allMarketsExpanded, setAllMarketsExpanded] = useState(false);

    useEffect(() => {
        // Check if user came from additional markets button
        const urlParams = new URLSearchParams(window.location.search);
        const fromAdditionalMarkets = urlParams.get('from') === 'additional';
        
        if (fromAdditionalMarkets) {
            setAllMarketsExpanded(true);
        }
        
        // Always fetch real match data from API/database - no test mode
        const fetchMatch = async () => {
            try {
                console.log('Fetching comprehensive match data with markets for ID:', matchId);
                const response = await apiService.getMatchMarkets(matchId);
                const matchData = response.data.match || response.data;
                
                console.log('Raw match data received:', matchData);
                
                // Transform odds API data to MatchDetail format
                const transformedMatch = transformOddsToMatchDetail(matchData);
                console.log('Transformed match data:', transformedMatch);
                
                setMatch(transformedMatch);
            } catch (err) {
                console.error('Error fetching match:', err);
                console.error('Error details:', {
                    status: err.response?.status,
                    statusText: err.response?.statusText,
                    data: err.response?.data
                });
                setMatch(null);
            }
        };
        
        if (matchId) {
            fetchMatch();
        } else {
            console.error('No matchId provided');
            setMatch(null);
        }
    }, [matchId]);

    // Transform odds API data to MatchDetail format
    const transformOddsToMatchDetail = (matchData) => {
        console.log('Transforming match data:', matchData);
        
        if (!matchData) {
            console.log('No match data to transform');
            return null;
        }
        
        // Handle internal database format (from /api/matches/:id)
        if (matchData._id && matchData.odds && !matchData.bookmakers) {
            console.log('Processing internal database format');
            
            const markets = {};
            let marketIndex = 0;
            const oddsData = (matchData.odds instanceof Map)
                ? Object.fromEntries(matchData.odds)
                : matchData.odds;
            const consumedKeys = new Set();
            const allKeys = Object.keys(oddsData);
            
            // Helper to mark keys as consumed
            const consume = (...keys) => keys.forEach(k => consumedKeys.add(k));

            // --- 1. Match Winner ---
            if (oddsData.homeWin || oddsData.awayWin || oddsData.draw) {
                const options = [];
                if (oddsData.homeWin) options.push({ name: matchData.homeTeam, odds: Number(oddsData.homeWin) });
                if (oddsData.draw) options.push({ name: 'Draw', odds: Number(oddsData.draw) });
                if (oddsData.awayWin) options.push({ name: matchData.awayTeam, odds: Number(oddsData.awayWin) });
                
                if (options.length > 0) {
                    markets[`market_${marketIndex++}`] = { name: 'Match Winner', options };
                    consume('homeWin', 'draw', 'awayWin');
                }
            }

            // --- 2. Grouped Markets (Double Chance, BTTS, etc.) ---
            const groupedMarkets = [
                {
                    name: 'Double Chance',
                    matcher: k => k.toLowerCase().includes('doublechance'),
                    mapper: (key, val) => {
                        const lower = key.toLowerCase();
                        if (lower.includes('homedraw') || lower.includes('1x')) return { name: 'Home/Draw', odds: Number(val) };
                        if (lower.includes('homeaway') || lower.includes('12')) return { name: 'Home/Away', odds: Number(val) };
                        if (lower.includes('drawaway') || lower.includes('x2')) return { name: 'Draw/Away', odds: Number(val) };
                        return null;
                    }
                },
                {
                    name: 'Both Teams to Score',
                    matcher: k => k.toLowerCase().includes('btts'),
                    mapper: (key, val) => {
                        const lower = key.toLowerCase();
                        if (lower.includes('yes')) return { name: 'Yes', odds: Number(val) };
                        if (lower.includes('no')) return { name: 'No', odds: Number(val) };
                        return null;
                    }
                },
                {
                    name: 'Penalty Awarded',
                    matcher: k => k.toLowerCase().includes('penalty'),
                    mapper: (key, val) => {
                        const lower = key.toLowerCase();
                        if (lower.includes('yes')) return { name: 'Yes', odds: Number(val) };
                        if (lower.includes('no')) return { name: 'No', odds: Number(val) };
                        return null;
                    }
                },
                {
                    name: 'Odd/Even',
                    matcher: k => k.toLowerCase().includes('oddeven'),
                    mapper: (key, val) => {
                        const lower = key.toLowerCase();
                        if (lower.includes('odd')) return { name: 'Odd', odds: Number(val) };
                        if (lower.includes('even')) return { name: 'Even', odds: Number(val) };
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
                        return name ? { name, odds: Number(val) } : null;
                    }
                }
            ];

            groupedMarkets.forEach(group => {
                const keys = allKeys.filter(k => group.matcher(k));
                const options = [];
                keys.forEach(key => {
                    if (consumedKeys.has(key)) return;
                    const val = oddsData[key];
                    if (!val) return;
                    
                    const option = group.mapper(key, val);
                    if (option) {
                        options.push(option);
                    }
                    consume(key); // Always consume matched keys to prevent duplicates
                });
                
                if (options.length > 0) {
                    markets[`market_${marketIndex++}`] = { name: group.name, options };
                }
            });

            // --- 3. Totals (Over/Under) ---
            if (oddsData.over || oddsData.under) {
                const options = [];
                const line = oddsData.total || '2.5';
                if (oddsData.over) options.push({ name: `Over ${line}`, odds: Number(oddsData.over) });
                if (oddsData.under) options.push({ name: `Under ${line}`, odds: Number(oddsData.under) });
                
                if (options.length > 0) {
                    markets[`market_${marketIndex++}`] = { name: 'Totals', options };
                    consume('over', 'under', 'total');
                }
            }

            // --- 5. Corners ---
            const cornerKeys = allKeys.filter(k => k.toLowerCase().includes('corners'));
            if (cornerKeys.length > 0) {
                const options = [];
                const lineKey = cornerKeys.find(k => k.toLowerCase().includes('line'));
                const line = lineKey ? oddsData[lineKey] : null;
                
                cornerKeys.forEach(key => {
                    if (key === lineKey) return; // Skip line key for options
                    const val = oddsData[key];
                    if (!val) return;
                    
                    const lower = key.toLowerCase();
                    let name = 'Unknown';
                    if (lower.includes('over')) name = line ? `Over ${line}` : 'Over';
                    else if (lower.includes('under')) name = line ? `Under ${line}` : 'Under';
                    
                    options.push({ name, odds: Number(val) });
                });
                
                if (options.length > 0) {
                    markets[`market_${marketIndex++}`] = { name: 'Corners', options };
                }
                consume(...cornerKeys);
            }

            // --- 6. Cards ---
            const cardKeys = allKeys.filter(k => k.toLowerCase().includes('cards'));
            if (cardKeys.length > 0) {
                const options = [];
                const lineKey = cardKeys.find(k => k.toLowerCase().includes('line'));
                const line = lineKey ? oddsData[lineKey] : null;
                
                cardKeys.forEach(key => {
                    if (key === lineKey) return;
                    const val = oddsData[key];
                    if (!val) return;
                    
                    const lower = key.toLowerCase();
                    let name = 'Unknown';
                    if (lower.includes('over')) name = line ? `Over ${line}` : 'Over';
                    else if (lower.includes('under')) name = line ? `Under ${line}` : 'Under';
                    
                    options.push({ name, odds: Number(val) });
                });
                
                if (options.length > 0) {
                    markets[`market_${marketIndex++}`] = { name: 'Cards', options };
                }
                consume(...cardKeys);
            }



            // --- 10. Array Markets (Correct Score, etc.) ---
            const arrayMarkets = [
                { key: 'correctScore', altKeys: ['correct_score','CorrectScore','correctscore','correct score'], name: 'Correct Score', processor: (item) => item.score && item.odds ? [{ name: item.score, odds: Number(item.odds) }] : [] },
                { key: 'multiGoals', altKeys: ['multi_goals','goalBands','Multigoals','MultiGoals','multi goals','goalbands'], name: 'Multi Goals', processor: (item) => {
                    const rg = item.range || item.band;
                    return rg && item.odds ? [{ name: `${rg} Goals`, odds: Number(item.odds) }] : [];
                } },
                { key: 'winningMargin', name: 'Winning Margin', processor: (item) => item.margin && item.odds ? [{ name: item.margin, odds: Number(item.odds) }] : [] },
                { key: 'handicaps', name: 'Handicap', processor: (item) => {
                     if (item.line && item.homeOdds && item.awayOdds) {
                        const line = parseFloat(item.line);
                        const homeLine = line > 0 ? `+${line}` : `${line}`;
                        const awayLine = -line > 0 ? `+${-line}` : `${-line}`;
                        return [
                            { name: `${matchData.homeTeam} (${homeLine})`, odds: Number(item.homeOdds) },
                            { name: `${matchData.awayTeam} (${awayLine})`, odds: Number(item.awayOdds) }
                        ];
                    }
                    return [];
                }},
                { key: 'goalScorers', name: 'Goalscorers', processor: null } // Special handling
            ];

            arrayMarkets.forEach(m => {
                // detect present key by primary or alt keys
                const keysToCheck = [m.key, ...(m.altKeys || [])];
                let presentKey = keysToCheck.find(k => Array.isArray(oddsData[k]) && oddsData[k].length > 0);
                // Fallback structural scan
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
                        // Special handling for goalscorers
                         const types = ['First', 'Anytime', 'Last'];
                         types.forEach(type => {
                             const typeOptions = oddsData.goalScorers
                                .filter(item => item.type && item.type.toLowerCase() === type.toLowerCase() && item.player && item.odds)
                                .map(item => ({ name: `${item.player}`, odds: Number(item.odds) }));
                             
                             if (typeOptions.length > 0) {
                                 markets[`market_${marketIndex++}`] = { name: `${type} Goalscorer`, options: typeOptions };
                             }
                         });
                    } else {
                        const options = [];
                        oddsData[presentKey].forEach(item => {
                            options.push(...m.processor(item));
                        });
                        if (options.length > 0) {
                            markets[`market_${marketIndex++}`] = { name: m.name, options };
                        }
                    }
                    consume(presentKey);
                }
            });

            // --- 11. Custom Markets Array (Explicit) ---
            if (Array.isArray(oddsData.customMarkets)) {
                oddsData.customMarkets.forEach(customMarket => {
                    if (customMarket.name && Array.isArray(customMarket.options)) {
                        const validOptions = customMarket.options
                            .filter(opt => opt.name && opt.odds)
                            .map(opt => ({ name: opt.name, odds: Number(opt.odds) }));
                        
                        if (validOptions.length > 0) {
                            markets[`market_${marketIndex++}`] = { name: customMarket.name, options: validOptions };
                        }
                    }
                });
                consume('customMarkets');
            }

            // --- 12. Generic Fallback (The "Catch-All") ---
            // Explicitly exclude known structural keys that shouldn't be markets
            const alwaysExclude = ['_id', 'id', 'createdAt', 'updatedAt', 'matchId'];
            
            allKeys.forEach(key => {
                if (consumedKeys.has(key)) return;
                if (alwaysExclude.includes(key)) return;
                
                const val = oddsData[key];
                if (!val && val !== 0) return; // Skip empty/null
                if (typeof val === 'object') return; // Skip arrays/objects we missed (safety)

                // Formatting logic for leftover keys
                // e.g. "extraMarket_Yes" -> "Extra Market" (Header), "Yes" (Option) ?
                // Or just "Extra Market Yes" -> value
                
                // Strategy: Convert camelCase/underscore key to readable string
                const formattedName = key
                    .replace(/([A-Z])/g, ' $1')
                    .replace(/_/g, ' ')
                    .replace(/^\w/, c => c.toUpperCase())
                    .trim();
                
                // If it's a leftover single value, we create a market for it?
                // Or group it?
                // User requirement: "naming system should not have underscore"
                
                // For a single key-value pair like "weirdKey: 1.5", 
                // we probably want Market: "Weird Key", Option: "Weird Key" -> 1.5?
                // Or just "Weird Key" -> 1.5.
                
                markets[`market_${marketIndex++}`] = {
                    name: formattedName,
                    options: [{ name: formattedName, odds: Number(val) }]
                };
            });

            console.log('Final Markets Generated:', markets);

            return {
                _id: matchData._id,
                id: matchData._id,
                homeTeam: matchData.homeTeam + (matchData.odds?.handicapLine ? ` (${matchData.odds.handicapLine >= 0 ? '+' : ''}${matchData.odds.handicapLine})` : ''),
                awayTeam: matchData.awayTeam + (matchData.odds?.handicapLine ? ` (${-matchData.odds.handicapLine >= 0 ? '+' : ''}${-matchData.odds.handicapLine})` : ''),
                originalHomeTeam: matchData.homeTeam,
                originalAwayTeam: matchData.awayTeam,
                homeTeamFlag: '🏳️',
                awayTeamFlag: '🏳️',
                competition: matchData.league || matchData.sport || 'Unknown League',
                startTime: new Date(matchData.startTime),
                sport: matchData.sport || 'Soccer',
                markets: markets,
                videoUrl: matchData.videoUrl || null,
                videoPosterUrl: matchData.videoPosterUrl || null
            };
        }
        
        // Handle external API format (from odds API)
        if (matchData.bookmakers && matchData.bookmakers.length > 0) {
            // ... existing code ...
            console.log('Processing odds API format with bookmakers');
            console.log('Total bookmakers:', matchData.bookmakers.length);
            
            // Aggregate across bookmakers by normalized key to avoid duplicates
            const aggregated = new Map(); // normKey -> { key: normKey, title, options }
            matchData.bookmakers.forEach((bookmaker, bookmakerIndex) => {
                console.log(`Processing bookmaker ${bookmakerIndex + 1}: ${bookmaker.title}`);
                if (bookmaker.markets) {
                    console.log('Processing markets:', bookmaker.markets);
                    bookmaker.markets.forEach((market) => {
                        const normKey = normalizeMarketKey(market.key);
                        const baseTitle = getMarketTitle(normKey);
                        const title = baseTitle; // Remove bookmaker prefix
                        const incoming = (market.outcomes || []).map(o => ({ name: o.name, odds: o.price, point: o.point ?? null }));
                        const existing = aggregated.get(normKey);
                        if (!existing) {
                            aggregated.set(normKey, { key: normKey, title, options: incoming });
                        } else {
                            existing.options = [...existing.options, ...incoming];
                        }
                    });
                }
            });

            // Normalize and dedupe options per market
            const homeName = matchData.homeTeam || matchData.home_team || 'Home';
            const awayName = matchData.awayTeam || matchData.away_team || 'Away';
            const markets = {};
            let marketIndex = 0;
            Array.from(aggregated.values()).forEach(m => {
                let options = m.options.filter(o => o.odds && o.odds > 0);
                if (m.key === 'winner') {
                    options = options.map(o => {
                        const lower = (o.name || '').toLowerCase();
                        if (['home','home win','homewin','1'].includes(lower)) return { ...o, name: homeName };
                        if (['away','away win','awaywin','2'].includes(lower)) return { ...o, name: awayName };
                        if (['draw','x','tie'].includes(lower)) return { ...o, name: 'Draw' };
                        return o;
                    });
                } else if (m.key === 'totals') {
                    options = options.map(o => {
                        const lower = (o.name || '').toLowerCase();
                        if (['over','ov','o'].includes(lower)) {
                            const label = o.point != null ? `Over (${o.point})` : 'Over';
                            return { ...o, name: label, point: null };
                        }
                        if (['under','un','u'].includes(lower)) {
                            const label = o.point != null ? `Under (${o.point})` : 'Under';
                            return { ...o, name: label, point: null };
                        }
                        return o;
                    });
                } else if (m.key === 'spreads') {
                    options = options.map(o => {
                        const raw = (o.name || '').toLowerCase();
                        const isHome = raw.includes('home') || raw === homeName.toLowerCase();
                        const isAway = raw.includes('away') || raw === awayName.toLowerCase();
                        const signPoint = o.point != null ? (o.point >= 0 ? `+${o.point}` : `${o.point}`) : null;
                        if (isHome) return { ...o, name: signPoint ? `${homeName} (${signPoint})` : homeName, point: null };
                        if (isAway) return { ...o, name: signPoint ? `${awayName} (${signPoint})` : awayName, point: null };
                        return { ...o, name: signPoint ? `${o.name} (${signPoint})` : (o.name || ''), point: null };
                    });
                }
                // Dedupe by name; keep best priced
                const byName = new Map();
                options.forEach(o => {
                    const k = (o.name || '').toLowerCase();
                    if (!byName.has(k)) byName.set(k, o);
                    else if ((!byName.get(k).odds || byName.get(k).odds <= 0) && o.odds && o.odds > 0) byName.set(k, o);
                });
                const finalOptions = Array.from(byName.values());
                if (finalOptions.length > 0) {
                    const marketKey = `market_${marketIndex}`;
                    markets[marketKey] = { name: m.title, options: finalOptions };
                    marketIndex++;
                }
            });
            
            console.log('Final markets object:', markets);
            console.log('Total markets created:', Object.keys(markets).length);
            

            
            const transformedMatch = {
                _id: matchData.id,
                id: matchData.id,
                homeTeam: matchData.home_team,
                awayTeam: matchData.away_team,
                homeTeamFlag: '🏳️',
                awayTeamFlag: '🏳️',
                competition: matchData.sport_title || 'Unknown League',
                startTime: new Date(matchData.commence_time),
                sport: (matchData.sport_key || matchData.sport || '').split('_')[0] || 'Unknown',
                markets: markets,
                videoUrl: matchData.videoUrl || null,
                videoPosterUrl: matchData.videoPosterUrl || null
            };
            
            console.log('Transformed match:', transformedMatch);
            return transformedMatch;
        }
        
        console.log('Using fallback format');
        // Handle old format (fallback)
        return matchData;
    };

  const addToBetslip = (marketName, option) => {
    const normalizedKey = normalizeMarketKey(marketName);
    const marketTypeDisplay = (() => {
        const sel = String(option?.name || '').toLowerCase();
        if (/^\s*\d+\s*-\s*\d+\s*$/.test(sel) && !/goals?/i.test(sel)) return 'Correct Score';
        if (!normalizedKey) return 'Market';
        if (normalizedKey === 'winner') return 'Winner';
        if (normalizedKey.startsWith('totals') || normalizedKey.startsWith('alternate_totals') || normalizedKey.startsWith('team_totals') || normalizedKey.startsWith('alternate_team_totals')) return 'Totals';
        if (normalizedKey.startsWith('spreads') || normalizedKey.startsWith('alternate_spreads')) return 'Handicap';
        if (normalizedKey === 'outrights') return 'Outrights';
        return getMarketTitle(normalizedKey);
    })();

    const bet = {
            matchId: match._id || match.id,
            match: `${match.homeTeam} vs ${match.awayTeam}`,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            league: match.competition,
            market: normalizedKey,
        marketDisplay: marketTypeDisplay,
        selection: option?.name,
        point: option?.point,
        marketType: normalizedKey,
        marketTypeDisplay,
        odds: option?.odds,
            stake: 0,
            sport: match.sport
        };
        dispatch({ type: 'activeBets/addBet', payload: bet });
    };

    const toggleMarket = (marketKey) => {
        setExpandedMarkets(prev => ({
            ...prev,
            [marketKey]: !prev[marketKey]
        }));
    };

    const expandAllMarkets = () => {
        const availableMarketKeys = availableMarkets.map(market => market.key);
        const expandedState = {};
        availableMarketKeys.forEach(marketKey => {
            expandedState[marketKey] = true;
        });
        setExpandedMarkets(expandedState);
        setAllMarketsExpanded(true);
    };

    const collapseAllMarkets = () => {
        setExpandedMarkets({});
        setAllMarketsExpanded(false);
    };

    // Filter markets to only show those with valid options
    const getAvailableMarkets = () => {
        if (!match?.markets) {
            console.log('No match or markets found');
            return [];
        }
        
        console.log('Raw match markets:', match.markets);
        
        // Get all markets first and filter them properly
        const allMarkets = Object.entries(match.markets)
            .map(([marketKey, market]) => {
                // Filter options to only include those with valid odds
                const validOptions = (market.options || []).filter(option => 
                    option.odds && option.odds > 0
                );
                
                return {
                    key: marketKey,
                    ...market,
                    options: validOptions
                };
            })
            // Only include markets that have at least one valid option
            .filter(market => market.options && market.options.length > 0);
        
        console.log('Filtered markets with valid options:', allMarkets);
        
        // Return ALL markets (no limit)
        return allMarkets;
    };

    const availableMarkets = getAvailableMarkets();
    
    // For additional markets, get the rest beyond the first 6
    // Deprecated: getAllMarkets was redundant with getAvailableMarkets returning everything now.
    // Keeping logic consistent: availableMarkets contains EVERYTHING.
    // const allMarkets = availableMarkets; // Removed unused variable
    
    // Since availableMarkets now has everything, additionalMarkets is empty.
    const additionalMarkets = []; 
    
    const hasAdditionalMarkets = false;

    // Initialize all markets as expanded by default
    useEffect(() => {
        if (availableMarkets.length > 0 && Object.keys(expandedMarkets).length === 0 && !allMarketsExpanded) {
            expandAllMarkets();
        }
    }, [availableMarkets.length]);

    // Debug logging for market count verification
    useEffect(() => {
        if (match) {
            console.log(`MatchDetail: ${match.homeTeam} vs ${match.awayTeam}`);
            console.log(`Total markets in match: ${Object.keys(match.markets || {}).length}`);
            console.log(`Available markets (first 6 with valid odds): ${availableMarkets.length}`);
            console.log(`Additional markets (beyond first 6): ${additionalMarkets.length}`);
            
            // Log all market keys
            console.log('All market keys:', Object.keys(match.markets || {}));
            
            if (availableMarkets.length > 0) {
            console.log('Available markets:', availableMarkets.map(market => ({
                    key: market.key,
                    name: market.name,
                    optionsCount: market.options.length,
                    options: market.options.map(opt => ({ name: opt.name, odds: opt.odds }))
                })));
            }
            
            if (additionalMarkets.length > 0) {
                console.log('Additional markets:', additionalMarkets.map(market => ({
                key: market.key,
                name: market.name,
                optionsCount: market.options.length
            })));
        }
            
            // Log all markets for debugging
            console.log('All markets in match:', Object.keys(match.markets || {}));
            console.log('Raw match markets object:', match.markets);
        }
    }, [match, availableMarkets, additionalMarkets]);

    const formatTime = (date) => {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (date) => {
        return date.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    };

    if (!match) {
        return (
            <div className="loading">
                Loading match details...
                <br />
                <button 
                    onClick={() => {
                        // Sample data loader disabled in production build
                        // setMatch(someTransformedSampleMatch);
                    }}
                    style={{ marginTop: '20px', padding: '10px 20px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                >
                    Load Sample EPL Data (Test)
                </button>
            </div>
        );
    }

    // Check if no markets are available
    if (availableMarkets.length === 0) {
        return (
            <div className="match-detail-page">
                <div className="match-header">
                    <button className="back-btn" onClick={() => navigate(-1)}>
                        ← Back
                    </button>
                    <div className="match-info">
                        <div className="competition">{match.competition}</div>
                        <div className="teams">
                            <div className="team">
                                <span className="team-flag">{match.homeTeamFlag}</span>
                                <span className="team-name">{match.homeTeam}</span>
                            </div>
                            <div className="vs">vs</div>
                            <div className="team">
                                <span className="team-name">{match.awayTeam}</span>
                                <span className="team-flag">{match.awayTeamFlag}</span>
                            </div>
                        </div>
                        <div className="match-time">
                            {formatTime(match.startTime)} • {formatDate(match.startTime)}
                        </div>
                    </div>
                </div>
                <div className="no-markets-message">
                    <p>No betting markets are currently available for this match.</p>
                    <p>Please check back later for updated odds and markets.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="match-detail-page">
            <div className="match-header">
                <button className="back-btn" onClick={() => navigate(-1)}>
                    ← Back
                </button>
                <div className="match-info">
                    <div className="competition">{match.competition}</div>
                    <div className="teams">
                        <div className="team">
                            <span className="team-flag">{match.homeTeamFlag}</span>
                            <span className="team-name">{match.homeTeam}</span>
                        </div>
                        <div className="vs">vs</div>
                        <div className="team">
                            <span className="team-name">{match.awayTeam}</span>
                            <span className="team-flag">{match.awayTeamFlag}</span>
                        </div>
                    </div>
                    <div className="match-time">
                        {formatTime(match.startTime)} • {formatDate(match.startTime)}
                    </div>
                </div>
            </div>

            {/* Scheduled Video Player */}
            {match.videoUrl && (
              <div style={{ margin: '16px 0' }}>
                <VideoPlayerScheduled
                  src={match.videoUrl}
                  poster={match.videoPosterUrl || undefined}
                  startTime={match.startTime}
                />
              </div>
            )}

            <div className="betting-tabs">
                <button 
                    className={`tab-btn ${selectedTab === 'regular' ? 'active' : ''}`}
                    onClick={() => setSelectedTab('regular')}
                >
                    Regular Time
                </button>
                <button 
                    className={`tab-btn ${selectedTab === 'totals' ? 'active' : ''}`}
                    onClick={() => setSelectedTab('totals')}
                >
                    Totals
                </button>
                <button 
                    className={`tab-btn ${selectedTab === 'handicap' ? 'active' : ''}`}
                    onClick={() => setSelectedTab('handicap')}
                >
                    Handicap
                </button>
                <button 
                    className={`tab-btn ${selectedTab === 'goals' ? 'active' : ''}`}
                    onClick={() => setSelectedTab('goals')}
                >
                    Goals
                </button>
                <div className="markets-controls">
                    <button 
                        className={`tab-btn ${allMarketsExpanded ? 'active' : ''}`}
                        onClick={allMarketsExpanded ? collapseAllMarkets : expandAllMarkets}
                    >
                        {allMarketsExpanded ? 'Collapse All' : 'Expand All'}
                    </button>
                </div>
            </div>

            <div className="betting-markets two-column-markets">
                {(() => {
                    console.log('RENDERING DEBUG: availableMarkets length:', availableMarkets.length);
                    console.log('RENDERING DEBUG: availableMarkets:', availableMarkets);
                    
                    const half = Math.ceil(availableMarkets.length / 2);
                    const leftMarkets = availableMarkets.slice(0, half);
                    const rightMarkets = availableMarkets.slice(half);
                    
                    console.log('RENDERING DEBUG: leftMarkets:', leftMarkets);
                    console.log('RENDERING DEBUG: rightMarkets:', rightMarkets);
                    
                    return (
                        <div className="markets-grid-2col">
                            <div className="markets-col">
                                {leftMarkets.map((market) => {
                                    console.log('RENDERING DEBUG: Rendering market:', market);
                                    return (
                                    <div key={market.key} className="market-section">
                                        <div 
                                            className="market-header"
                                            onClick={() => toggleMarket(market.key)}
                                        >
                                            <span className="market-name">{market.name}</span>
                                            <span className={`expand-arrow ${expandedMarkets[market.key] ? 'expanded' : ''}`}>
                                                ▼
                                            </span>
                                        </div>
                                        {(expandedMarkets[market.key] || allMarketsExpanded) && (
                                            <div className="market-options">
                                                {market.options.map((option, index) => {
                                                    const riskAssessment = assessOddsRisk(match, option.odds, option.name);
                                                    
                                                    // If odds should be disabled, show locked odds component
                                                    if (riskAssessment.shouldDisable) {
                                                        return (
                                                            <div key={index} className="market-option-btn locked">
                                                                <span className="option-name">{option.name}</span>
                                                                <LockedOdds
                                                                    riskAssessment={riskAssessment}
                                                                    className="option-odds-locked"
                                                                />
                                                            </div>
                                                        );
                                                    }
                                                    
                                                    return (
                                                        <button
                                                            key={index}
                                                            className="market-option-btn"
                                                            onClick={() => addToBetslip(market.name, option)}
                                                        >
                                                            <span className="option-name">{option.name}</span>
                                                            <span className="option-odds">{option.odds.toFixed(2)}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                    );
                                })}
                            </div>
                            <div className="markets-col">
                                {rightMarkets.map((market) => {
                                    console.log('RENDERING DEBUG: Rendering market:', market);
                                    return (
                        <div key={market.key} className="market-section">
                            <div 
                                className="market-header"
                                onClick={() => toggleMarket(market.key)}
                            >
                                <span className="market-name">{market.name}</span>
                                <span className={`expand-arrow ${expandedMarkets[market.key] ? 'expanded' : ''}`}>
                                    ▼
                                </span>
                            </div>
                            {(expandedMarkets[market.key] || allMarketsExpanded) && (
                                <div className="market-options">
                                                {market.options.map((option, index) => {
                                                    const riskAssessment = assessOddsRisk(match, option.odds, option.name);
                                                    
                                                    // If odds should be disabled, show locked odds component
                                                    if (riskAssessment.shouldDisable) {
                                                        return (
                                                            <div key={index} className="market-option-btn locked">
                                                                <span className="option-name">{option.name}</span>
                                                                <LockedOdds
                                                                    riskAssessment={riskAssessment}
                                                                    className="option-odds-locked"
                                                                />
                                                            </div>
                                                        );
                                                    }
                                                    
                                                    return (
                                                        <button
                                                            key={index}
                                                            className="market-option-btn"
                                                            onClick={() => addToBetslip(market.name, option)}
                                                        >
                                                            <span className="option-name">{option.name}</span>
                                                            <span className="option-odds">{option.odds.toFixed(2)}</span>
                                                        </button>
                                                    );
                                                })}
                                </div>
                            )}
                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })()}
                
                {/* Additional Markets Section */}
                {hasAdditionalMarkets && (
                    <div className="additional-markets-section">
                        <div 
                            className="additional-markets-header"
                            onClick={() => toggleMarket('additional')}
                        >
                            <span className="additional-markets-title">
                                Additional Markets ({additionalMarkets.length})
                            </span>
                            <span className={`expand-arrow ${expandedMarkets['additional'] ? 'expanded' : ''}`}>
                                ▼
                            </span>
                        </div>
                        {expandedMarkets['additional'] && (
                            <div className="additional-markets-content">
                                <div className="markets-grid-2col">
                                    <div className="markets-col">
                                        {additionalMarkets.slice(0, Math.ceil(additionalMarkets.length / 2)).map((market) => (
                                            <div key={market.key} className="market-section">
                                                <div 
                                                    className="market-header"
                                                    onClick={() => toggleMarket(market.key)}
                                                >
                                                    <span className="market-name">{market.name}</span>
                                                    <span className={`expand-arrow ${expandedMarkets[market.key] ? 'expanded' : ''}`}>
                                                        ▼
                                                    </span>
                                                </div>
                                                {expandedMarkets[market.key] && (
                                                    <div className="market-options">
                                                        {market.options.map((option, index) => {
                                                            const riskAssessment = assessOddsRisk(match, option.odds, option.name);
                                                            
                                                            // If odds should be disabled, show locked odds component
                                                            if (riskAssessment.shouldDisable) {
                                                                return (
                                                                    <div key={index} className="market-option-btn locked">
                                                                        <span className="option-name">{option.name}</span>
                                                                        <LockedOdds
                                                                            riskAssessment={riskAssessment}
                                                                            className="option-odds-locked"
                                                                        />
                                                                    </div>
                                                                );
                                                            }
                                                            
                                                            return (
                                                                <button
                                                                    key={index}
                                                                    className="market-option-btn"
                                                                    onClick={() => addToBetslip(market.name, option)}
                                                                >
                                                                    <span className="option-name">{option.name}</span>
                                                                    <span className="option-odds">{option.odds.toFixed(2)}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="markets-col">
                                        {additionalMarkets.slice(Math.ceil(additionalMarkets.length / 2)).map((market) => (
                                            <div key={market.key} className="market-section">
                                                <div 
                                                    className="market-header"
                                                    onClick={() => toggleMarket(market.key)}
                                                >
                                                    <span className="market-name">{market.name}</span>
                                                    <span className={`expand-arrow ${expandedMarkets[market.key] ? 'expanded' : ''}`}>
                                                        ▼
                                                    </span>
                                                </div>
                                                {expandedMarkets[market.key] && (
                                                    <div className="market-options">
                                                        {market.options.map((option, index) => {
                                                            const riskAssessment = assessOddsRisk(match, option.odds, option.name);
                                                            
                                                            // If odds should be disabled, show locked odds component
                                                            if (riskAssessment.shouldDisable) {
                                                                return (
                                                                    <div key={index} className="market-option-btn locked">
                                                                        <span className="option-name">{option.name}</span>
                                                                        <LockedOdds
                                                                            riskAssessment={riskAssessment}
                                                                            className="option-odds-locked"
                                                                        />
                                                                    </div>
                                                                );
                                                            }
                                                            
                                                            return (
                                                                <button
                                                                    key={index}
                                                                    className="market-option-btn"
                                                                    onClick={() => addToBetslip(market.name, option.name, option.odds)}
                                                                >
                                                                    <span className="option-name">{option.name}</span>
                                                                    <span className="option-odds">{option.odds.toFixed(2)}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MatchDetail;
