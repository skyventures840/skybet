import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import apiService from '../services/api';
import getMarketTitle, { normalizeMarketKey } from '../utils/marketTitles';

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
        console.log('MatchMarkets useEffect triggered with matchId:', matchId);
        
        // Check if user came from additional markets button
        // Read query params if needed for future logic
        // const urlParams = new URLSearchParams(location.search);
        // const fromAdditionalMarkets = urlParams.get('from') === 'additional';
        
        // Fetch match data from API
        const fetchMatch = async () => {
            try {
                setLoading(true);
                setError(null);
                
                // Use the markets endpoint for comprehensive data
                const response = await apiService.getMatchMarkets(matchId);
                
                const matchData = response.data;
                console.log('Received match data:', matchData);
                
                // Process bookmakers data to create markets structure
                let processedMatchData = { ...matchData };
                
                // Prefer backend-normalized markets if present
                if (matchData.markets && Array.isArray(matchData.markets) && matchData.markets.length > 0) {
                    console.log('Using backend-normalized markets data:', matchData.markets);
                    // Deduplicate and merge aliases into consistent groups
                    processedMatchData.markets = mergeAndNormalizeMarkets(matchData.markets, matchData);
                } else if (matchData.bookmakers && matchData.bookmakers.length > 0) {
                    console.log('Processing bookmakers data:', matchData.bookmakers);
                    console.log('Number of bookmakers:', matchData.bookmakers.length);
                    
                    const aggregated = new Map(); // key -> { key, title, outcomes: [] }
                    
                    matchData.bookmakers.forEach((bookmaker, bookmakerIndex) => {
                        console.log(`Processing bookmaker ${bookmakerIndex}:`, bookmaker.key, bookmaker.title);
                        console.log(`Bookmaker ${bookmakerIndex} has ${bookmaker.markets.length} markets:`, bookmaker.markets.map(m => m.key));
                        
                        bookmaker.markets.forEach((market, marketIndex) => {
                            console.log(`Processing market ${marketIndex} from bookmaker ${bookmakerIndex}:`, market.key);
                            
                            const normKey = normalizeMarketKey(market.key);
                            const marketTitle = titleForKey(normKey);
                            const existing = aggregated.get(normKey);
                            const incomingOutcomes = (market.outcomes || []).map(outcome => ({
                                name: outcome.name,
                                price: outcome.price,
                                point: outcome.point || null
                            }));
                            if (!existing) {
                                aggregated.set(normKey, {
                                    key: normKey,
                                    title: marketTitle,
                                    outcomes: incomingOutcomes
                                });
                            } else {
                                // Merge outcomes, dedupe by name+point
                                const bySig = new Map();
                                [...existing.outcomes, ...incomingOutcomes].forEach(o => {
                                    const sig = `${(o.name||'').toLowerCase()}|${o.point ?? ''}`;
                                    if (!bySig.has(sig)) bySig.set(sig, o);
                                    else {
                                        // Prefer outcome with valid price
                                        const prev = bySig.get(sig);
                                        if ((!prev.price || prev.price <= 0) && o.price && o.price > 0) {
                                            bySig.set(sig, o);
                                        }
                                    }
                                });
                                existing.outcomes = Array.from(bySig.values());
                            }
                        });
                    });
                    const markets = Array.from(aggregated.values());
                    console.log('Final processed markets (after deduplication):', markets.map(m => ({ key: m.key, title: m.title })));
                    processedMatchData.markets = normalizeOutcomeLabels(markets, matchData);
                    console.log('Processed markets:', markets);
                } else {
                    console.log('No markets or bookmakers data found');
                    processedMatchData.markets = [];
                }
                
                setMatch(processedMatchData);
                setLoading(false);
            } catch (error) {
                console.error('Error fetching match data:', error);
                setError(error.message || 'Failed to load match data');
                setLoading(false);
            }
        };

        if (matchId) {
            fetchMatch();
        } else {
            setError('No match ID provided');
            setLoading(false);
        }
    }, [matchId, location.search]);

    // Merge and normalize markets when backend provides markets array
    const mergeAndNormalizeMarkets = (markets, matchData) => {
        const aggregated = new Map();
        markets.forEach(m => {
            const normKey = normalizeMarketKey(m.key || m.title);
            const title = titleForKey(normKey);
            const incomingOutcomes = (m.outcomes || []).map(o => ({
                name: o.name,
                price: o.price,
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
                // Map common labels to Home/Away/Draw
                m.outcomes = m.outcomes.map(o => {
                    let name = (o.name || '').toLowerCase();
                    if (['home','home win','homewin','1'].includes(name)) return { ...o, name: homeName };
                    if (['away','away win','awaywin','2'].includes(name)) return { ...o, name: awayName };
                    if (['draw','x','tie'].includes(name)) return { ...o, name: 'Draw' };
                    return o;
                });
                // Deduplicate by name
                const byName = new Map();
                m.outcomes.forEach(o => {
                    const key = (o.name || '').toLowerCase();
                    if (!byName.has(key)) byName.set(key, o);
                    else if ((!byName.get(key).price || byName.get(key).price <= 0) && o.price && o.price > 0) byName.set(key, o);
                });
                m.outcomes = Array.from(byName.values());
            }
            if (m.key === 'totals' || (m.key || '').includes('totals')) {
                // Normalize Over/Under labels across all totals variants (incl. alternates, team totals)
                m.outcomes = m.outcomes.map(o => {
                    let name = (o.name || '').toLowerCase();
                    // Replace generic team tokens with actual names for team totals
                    name = name.replace(/\bhome\b/g, homeName.toLowerCase()).replace(/\baway\b/g, awayName.toLowerCase());
                    // Detect Over/Under anywhere in the name
                    const isOver = /(\bover\b|\bov\b|\bo\b)/.test(name);
                    const isUnder = /(\bunder\b|\bun\b|\bu\b)/.test(name);
                    if (isOver) {
                        // Preserve any prefix (e.g., team name), capitalize Over, append point
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
                // Deduplicate by Over/Under plus team context (so Home/Away totals don't merge)
                const bySig = new Map();
                m.outcomes.forEach(o => {
                    const n = (o.name || '').toLowerCase();
                    const teamCtx = n.startsWith(homeName.toLowerCase()) ? 'home' : (n.startsWith(awayName.toLowerCase()) ? 'away' : '');
                    const base = n.includes('over') ? `${teamCtx}over` : (n.includes('under') ? `${teamCtx}under` : n);
                    if (!bySig.has(base)) bySig.set(base, o);
                    else if ((!bySig.get(base).price || bySig.get(base).price <= 0) && o.price && o.price > 0) bySig.set(base, o);
                });
                // Keep only Over/Under outcomes; drop any generic 'Total' lines or others
                m.outcomes = Array.from(bySig.values()).filter(o => {
                    const n = (o.name || '').toLowerCase();
                    return n.includes('over') || n.includes('under');
                });
                // Ensure title for base totals market is 'Totals'
                if (m.key === 'totals') {
                    m.title = 'Totals';
                }
            }
            if (m.key === 'spreads') {
                // Unify Handicap: one market with Home and Away outcomes, show point in brackets
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
                        // Fallback: keep name but move point into brackets
                        const label = signPoint ? `${o.name} (${signPoint})` : (o.name || '');
                        normalized.push({ ...o, name: label, point: null });
                    }
                });
                // Deduplicate to one Home and one Away entry, prefer priced outcomes
                const bySide = new Map();
                normalized.forEach(o => {
                    const lower = (o.name || '').toLowerCase();
                    const key = lower.includes((homeName || '').toLowerCase()) ? 'home' : (lower.includes((awayName || '').toLowerCase()) ? 'away' : lower);
                    if (!bySide.has(key)) bySide.set(key, o);
                    else if ((!bySide.get(key).price || bySide.get(key).price <= 0) && o.price && o.price > 0) bySide.set(key, o);
                });
                m.outcomes = Array.from(bySide.values());
                // Ensure title is correct
                m.title = 'Handicap';
            }
            return m;
        });
    };

    // Initialize expanded state when match data is loaded
    useEffect(() => {
        if (match && match.markets && Array.isArray(match.markets)) {
            // Only initialize once to preserve user toggles
            if (Object.keys(expandedByKey).length === 0) {
                const initial = {};
                match.markets.forEach(m => {
                    // Default expand all markets
                    initial[m.key] = true;
                });
                setExpandedByKey(initial);
            }
        }
    }, [match]);

    const toggleMarket = (key) => {
        setExpandedByKey(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // Transform API data to match the expected format for MatchMarkets
    // transformMatchData not used; keeping logic in fetch

    // Function to add bet to betslip
    const addToBetslip = (marketKey, outcome) => {
        if (!match) {
            console.error('No match data available for betslip');
            return;
        }
        
        // Create bet object with all necessary information
        const bet = {
            matchId: match._id || match.id,
            match: `${match.homeTeam || match.home_team} vs ${match.awayTeam || match.away_team}`,
            homeTeam: match.homeTeam || match.home_team,
            awayTeam: match.awayTeam || match.away_team,
            league: match.league || match.sport_title,
            startTime: match.startTime || match.commence_time,
            market: marketKey,
            marketDisplay: getMarketTitle(marketKey),
            selection: outcome.name,
            odds: outcome.price,
            stake: 0,
            potentialWin: 0
        };
        
        // Add to Redux store betslip
        dispatch({ type: 'activeBets/addBet', payload: bet });
        
        // Show success feedback
        console.log(`Successfully added to betslip: ${outcome.name} @ ${outcome.price.toFixed(2)}`);
    };

    const formatMatchTime = (startTime) => {
        const date = new Date(startTime);
        return date.toLocaleString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getFilteredMarkets = () => {
        // Add null checks to prevent undefined filter errors
        if (!match || !match.markets || !Array.isArray(match.markets)) {
            return [];
        }

        if (selectedMarket === 'all') {
            // Filter out markets with no outcomes or outcomes with invalid odds
            return match.markets.filter(market => 
                market.outcomes && 
                market.outcomes.length > 0 && 
                market.outcomes.some(outcome => outcome.price && outcome.price > 0)
            );
        }
        
        return match.markets.filter(market => 
            market.key === selectedMarket &&
            market.outcomes && 
            market.outcomes.length > 0 && 
            market.outcomes.some(outcome => outcome.price && outcome.price > 0)
        );
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading match markets from database...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="error-container">
                <div className="error-message">
                    <h3>Error Loading Match Markets</h3>
                    <p>{error}</p>
                    <button 
                        className="retry-btn"
                        onClick={() => {
                            setError(null);
                            setLoading(true);
                            // Retry fetching real data by re-running the fetch logic
                            const retryFetch = async () => {
                                try {
                                    setLoading(true);
                                    setError(null);
                                    
                                    const response = await apiService.getMatchMarkets(matchId);
                                    const matchData = response.data;
                                    
                                    // Process bookmakers data to create markets structure
                                    let processedMatchData = { ...matchData };
                                    
                                    if (matchData.markets && Array.isArray(matchData.markets) && matchData.markets.length > 0) {
                                        processedMatchData.markets = matchData.markets;
                                    } else if (matchData.bookmakers && matchData.bookmakers.length > 0) {
                                        const markets = [];
                                        const processedMarketKeys = new Set(); // Track processed market keys to avoid duplicates
                                        
                                        console.log('Retry: Processing bookmakers data:', matchData.bookmakers);
                                        console.log('Retry: Number of bookmakers:', matchData.bookmakers.length);
                                        
                                        matchData.bookmakers.forEach((bookmaker, bookmakerIndex) => {
                                            console.log(`Retry: Processing bookmaker ${bookmakerIndex}:`, bookmaker.key, bookmaker.title);
                                            console.log(`Retry: Bookmaker ${bookmakerIndex} has ${bookmaker.markets.length} markets:`, bookmaker.markets.map(m => m.key));
                                            
                                            bookmaker.markets.forEach((market, marketIndex) => {
                                                console.log(`Retry: Processing market ${marketIndex} from bookmaker ${bookmakerIndex}:`, market.key);
                                                
                                                const normKey = normalizeMarketKey(market.key);
                                                // Skip if we've already processed this market type
                                                if (processedMarketKeys.has(normKey)) {
                                                    console.log(`Retry: Skipping duplicate market: ${market.key} (already processed)`);
                                                    return;
                                                }
                                                
                                                processedMarketKeys.add(normKey);
                                                console.log(`Retry: Adding new market: ${normKey}`);
                                                
                                                // Title based on normalized key
                                                const marketTitle = titleForKey(normKey);
                                                
                                                markets.push({
                                                    key: normKey,
                                                    title: marketTitle,
                                                    // description removed as per requirements
                                                    outcomes: market.outcomes.map(outcome => ({
                                                        name: outcome.name,
                                                        price: outcome.price,
                                                        point: outcome.point || null
                                                    }))
                                                });
                                            });
                                        });
                                        
                                        console.log('Retry: Final processed markets (after deduplication):', markets.map(m => ({ key: m.key, title: m.title })));
                                        // Normalize outcome labels to consolidate markets like winner (1x2), totals, spreads
                                        processedMatchData.markets = normalizeOutcomeLabels(markets, matchData);
                                    } else {
                                        processedMatchData.markets = [];
                                    }
                                    
                                    setMatch(processedMatchData);
                                    setLoading(false);
                                } catch (error) {
                                    console.error('Retry failed:', error);
                                    setError(error.message || 'Failed to load match data');
                                    setLoading(false);
                                }
                            };
                            retryFetch();
                        }}
                    >
                        Retry Loading Real Data
                    </button>
                    <button 
                        className="retry-btn"
                        onClick={() => navigate(-1)}
                        style={{ marginLeft: '10px', backgroundColor: '#6c757d' }}
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    if (!match) {
        return (
            <div className="error">
                Match not found.
                <br />
                <button 
                    onClick={() => navigate(-1)}
                    style={{ 
                        marginTop: '20px', 
                        padding: '10px 20px', 
                        backgroundColor: '#2196F3', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '5px', 
                        cursor: 'pointer' 
                    }}
                >
                    Go Back
                </button>
            </div>
        );
    }

    const filteredMarkets = getFilteredMarkets();

    return (
        <div className="match-markets-page">
            <div className="match-markets-header">
                <button 
                    onClick={() => navigate(-1)}
                    className="back-button"
                >
                    ← Back
                </button>
                <h1>Match Markets</h1>
            </div>

            <div className="match-info-card">
                <div className="match-teams">
                    <h2>{match.homeTeam || match.home_team} vs {match.awayTeam || match.away_team}</h2>
                    <p className="match-league">
                      {(() => {
                        const sport = match.sport || match.sport_title;
                        const country = match.subcategory || match.country;
                        const league = match.league || match.competition || match.tournament;
                        const norm = (s) => (s || '').toString().trim().replace(/[.·]+$/,'');
                        const parts = [norm(sport), norm(country), norm(league)].filter(Boolean);
                        // If league already contains country, skip country to avoid duplication
                        const finalParts = parts.filter((p, idx) => {
                          if (idx === 1 && parts[2] && parts[2].toLowerCase().includes(p.toLowerCase())) return false;
                          return true;
                        });
                        const title = Array.from(new Set(finalParts.map(p => p.toLowerCase())))
                          .map(lower => finalParts.find(p => p.toLowerCase() === lower))
                          .join(' · ');
                        return title;
                      })()}
                    </p>
                    <p className="match-time">{formatMatchTime(match.startTime || match.commence_time)}</p>
                </div>
                
                <div className="market-filter">
                    <label htmlFor="market-select">Filter Markets:</label>
                    <select 
                        id="market-select"
                        value={selectedMarket}
                        onChange={(e) => setSelectedMarket(e.target.value)}
                    >
                        <option value="all">All Markets</option>
                        {match && match.markets && Array.isArray(match.markets) && match.markets.map(market => (
                            <option key={market.key} value={market.key}>
                                {market.title}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="markets-container">
                {Array.isArray(filteredMarkets) && filteredMarkets.map(market => {
                    // Only render markets that have valid outcomes
                    const validOutcomes = market.outcomes && Array.isArray(market.outcomes) 
                        ? market.outcomes.filter(outcome => 
                            outcome.price && outcome.price > 0
                        )
                        : [];
                    
                    if (validOutcomes.length === 0) {
                        return null; // Hide empty markets
                    }
                    
                    return (
                        <div key={market.key} className={`market-card ${expandedByKey[market.key] ? 'expanded' : 'collapsed'}`}>
                            <button
                                className="market-header"
                                onClick={() => toggleMarket(market.key)}
                                aria-expanded={!!expandedByKey[market.key]}
                                aria-controls={`outcomes-${market.key}`}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    width: '100%',
                                    border: 'none',
                                    padding: '8px 0',
                                    cursor: 'pointer'
                                }}
                            >
                                <h3 style={{ margin: 0 }}>{market.title}</h3>
                                <span
                                    className="market-chevron"
                                    style={{
                                        display: 'inline-block',
                                        transition: 'transform 0.2s ease',
                                        transform: expandedByKey[market.key] ? 'rotate(90deg)' : 'rotate(0deg)'
                                    }}
                                >
                                    ▸
                                </span>
                            </button>
                            
                            <div
                                id={`outcomes-${market.key}`}
                                className="market-outcomes"
                                style={{ display: expandedByKey[market.key] ? 'grid' : 'none' }}
                            >
                                {validOutcomes.map((outcome, index) => (
                                    <button
                                        key={index}
                                        className="outcome-button"
                                        onClick={() => addToBetslip(market.key, outcome, outcome.price)}
                                    >
                                        <div className="outcome-name">
                                            {outcome.name}
                                            {outcome.point && <span className="outcome-point">({outcome.point})</span>}
                                        </div>
                                        <div className="outcome-odds">
                                            {outcome.price.toFixed(2)}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {filteredMarkets.length === 0 && (
                <div className="no-markets">
                    <p>No markets available for the selected filter.</p>
                </div>
            )}
        </div>
    );
};

export default MatchMarkets;
