import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import apiService from '../services/api';

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

    // Helper: normalize market keys to canonical values to dedupe aliases
    const normalizeMarketKey = (keyRaw) => {
        const key = (keyRaw || '').toLowerCase();
        // Collapse lay/exchange variants
        const base = key.replace(/_(lay|exchange)$/i, '');
        // Unify common aliases
        if (base === 'moneyline' || base === 'ml' || base === 'h2h_lay' || base === 'h2h_exchange') return 'h2h';
        if (base === 'over_under' || base === 'o/u' || base === 'totals_lay' || base === 'totals_exchange') return 'totals';
        if (base === 'handicap' || base === 'point_spread' || base === 'spreads_lay' || base === 'spreads_exchange') return 'spreads';
        return base;
    };

    // Helper: title mapping based on normalized keys (sport-agnostic)
    const titleForKey = (normKey) => {
        switch (normKey) {
            case 'h2h': return 'H2H';
            case 'totals': return 'Total Points';
            case 'spreads': return 'Point Spread';
            case 'double_chance': return 'Double Chance';
            default:
                return (normKey || '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
    };

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
                    processedMatchData.markets = matchData.markets;
                } else if (matchData.bookmakers && matchData.bookmakers.length > 0) {
                    console.log('Processing bookmakers data:', matchData.bookmakers);
                    console.log('Number of bookmakers:', matchData.bookmakers.length);
                    
                    const markets = [];
                    const processedMarketKeys = new Set(); // Track processed market keys to avoid duplicates
                    
                    matchData.bookmakers.forEach((bookmaker, bookmakerIndex) => {
                        console.log(`Processing bookmaker ${bookmakerIndex}:`, bookmaker.key, bookmaker.title);
                        console.log(`Bookmaker ${bookmakerIndex} has ${bookmaker.markets.length} markets:`, bookmaker.markets.map(m => m.key));
                        
                        bookmaker.markets.forEach((market, marketIndex) => {
                            console.log(`Processing market ${marketIndex} from bookmaker ${bookmakerIndex}:`, market.key);
                            
                            // Normalize key and skip if already processed
                            const normKey = normalizeMarketKey(market.key);
                            if (processedMarketKeys.has(normKey)) {
                                console.log(`Skipping duplicate market: ${market.key} (already processed)`);
                                return;
                            }
                            
                            processedMarketKeys.add(normKey);
                            console.log(`Adding new market: ${normKey}`);
                            
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
                    
                    console.log('Final processed markets (after deduplication):', markets.map(m => ({ key: m.key, title: m.title })));
                    processedMatchData.markets = markets;
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
            marketDisplay: (marketKey || '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
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
                                        processedMatchData.markets = markets;
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
                    <p className="match-league">{match.league || match.sport_title}</p>
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
