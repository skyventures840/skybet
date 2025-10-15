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
                console.log('Fetching real match data for ID:', matchId);
                const response = await apiService.getMatchById(matchId);
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
            
            // Convert odds Map to markets
            if (matchData.odds && typeof matchData.odds === 'object') {
                const oddsData = matchData.odds;
                
                // Match Winner market
                if (oddsData.homeWin || oddsData.awayWin || oddsData.draw) {
                    const marketKey = `market_${marketIndex}`;
                    const options = [];
                    
                    if (oddsData.homeWin && oddsData.homeWin > 0) {
                        options.push({ name: matchData.homeTeam, odds: oddsData.homeWin });
                    }
                    if (oddsData.draw && oddsData.draw > 0) {
                        options.push({ name: 'Draw', odds: oddsData.draw });
                    }
                    if (oddsData.awayWin && oddsData.awayWin > 0) {
                        options.push({ name: matchData.awayTeam, odds: oddsData.awayWin });
                    }
                    
                    if (options.length > 0) {
                        markets[marketKey] = {
                            name: 'Match Winner',
                            options: options
                        };
                        marketIndex++;
                    }
                }
                
                // Totals market (Over/Under)
                if (oddsData.over || oddsData.under) {
                    const marketKey = `market_${marketIndex}`;
                    const options = [];
                    
                    if (oddsData.over && oddsData.over > 0) {
                        const totalLine = oddsData.total || '2.5';
                        options.push({ name: `Over (${totalLine})`, odds: oddsData.over });
                    }
                    if (oddsData.under && oddsData.under > 0) {
                        const totalLine = oddsData.total || '2.5';
                        options.push({ name: `Under (${totalLine})`, odds: oddsData.under });
                    }
                    
                    if (options.length > 0) {
                        markets[marketKey] = {
                            name: 'Totals',
                            options: options
                        };
                        marketIndex++;
                    }
                }
                
                // Handicap market
                if (oddsData.homeHandicap || oddsData.awayHandicap) {
                    const marketKey = `market_${marketIndex}`;
                    const options = [];
                    const handicapLine = oddsData.handicapLine || 0;
                    
                    if (oddsData.homeHandicap && oddsData.homeHandicap > 0) {
                        options.push({ 
                            name: `${matchData.homeTeam} (${handicapLine >= 0 ? '+' : ''}${handicapLine})`, 
                            odds: oddsData.homeHandicap 
                        });
                    }
                    if (oddsData.awayHandicap && oddsData.awayHandicap > 0) {
                        options.push({ 
                            name: `${matchData.awayTeam} (${-handicapLine >= 0 ? '+' : ''}${-handicapLine})`, 
                            odds: oddsData.awayHandicap 
                        });
                    }
                    
                    if (options.length > 0) {
                        markets[marketKey] = {
                            name: 'Handicap',
                            options: options
                        };
                        marketIndex++;
                    }
                }
                
                // Add any other odds fields as individual markets
                Object.entries(oddsData).forEach(([key, value]) => {
                    if (!['homeWin', 'awayWin', 'draw', 'over', 'under', 'total', 'homeHandicap', 'awayHandicap', 'handicapLine'].includes(key) && value && value > 0) {
                        const marketKey = `market_${marketIndex}`;
                        markets[marketKey] = {
                            name: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
                            options: [{ name: key, odds: value }]
                        };
                        marketIndex++;
                    }
                });
            }
            
            console.log('Created markets from database format:', markets);
            
            return {
                _id: matchData._id,
                id: matchData._id,
                homeTeam: matchData.homeTeam,
                awayTeam: matchData.awayTeam,
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
                const titlePrefix = bookmakerIndex === 0 ? '' : `${bookmaker.title} - `;
                if (bookmaker.markets) {
                    console.log('Processing markets:', bookmaker.markets);
                    bookmaker.markets.forEach((market) => {
                        const normKey = normalizeMarketKey(market.key);
                        const baseTitle = getMarketTitle(normKey);
                        const title = `${titlePrefix}${baseTitle}`;
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
            
            // TEST: If no markets were created, create dummy markets for testing
            if (Object.keys(markets).length === 0) {
                console.log('TEST: No markets created, adding dummy markets');
                markets['market_0'] = {
                    name: 'Test Market 1',
                    options: [
                        { name: 'Home Win', odds: 2.0 },
                        { name: 'Away Win', odds: 3.0 }
                    ]
                };
                markets['market_1'] = {
                    name: 'Test Market 2',
                    options: [
                        { name: 'Over 2.5', odds: 1.8 },
                        { name: 'Under 2.5', odds: 2.2 }
                    ]
                };
                markets['market_2'] = {
                    name: 'Test Market 3',
                    options: [
                        { name: 'Both Teams Score', odds: 1.5 },
                        { name: 'Clean Sheet', odds: 2.5 }
                    ]
                };
                console.log('TEST: Added dummy markets:', markets);
            }
            
            const transformedMatch = {
                _id: matchData.id,
                id: matchData.id,
                homeTeam: matchData.home_team,
                awayTeam: matchData.away_team,
                homeTeamFlag: '🏳️',
                awayTeamFlag: '🏳️',
                competition: matchData.sport_title || 'Unknown League',
                startTime: new Date(matchData.commence_time),
                sport: matchData.sport_key?.split('_')[0] || 'Soccer',
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

    const addToBetslip = (marketName, optionName, odds) => {
        const bet = {
            matchId: match._id || match.id,
            match: `${match.homeTeam} vs ${match.awayTeam}`,
            market: marketName,
            selection: optionName,
            type: marketName,
            odds: odds,
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
        // Also expand the additional markets section
        if (hasAdditionalMarkets) {
            expandedState['additional'] = true;
        }
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
        console.log('Match object keys:', Object.keys(match));
        
        // Get all markets first and filter them properly
        const allMarkets = Object.entries(match.markets)
            .map(([marketKey, market]) => {
                console.log(`Processing market ${marketKey}:`, market);
                
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
        
        // Return only the first 6 markets for the main display
        return allMarkets.slice(0, 6);
    };

    const availableMarkets = getAvailableMarkets();
    
    // For additional markets, get the rest beyond the first 6
    const getAllMarkets = () => {
        if (!match?.markets) return [];
        
        return Object.entries(match.markets)
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
    };

    const allMarkets = getAllMarkets();
    // Additional markets are those beyond the first 6, already filtered by getAllMarkets()
    const additionalMarkets = allMarkets.slice(6);
    
    const hasAdditionalMarkets = additionalMarkets.length > 0;

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