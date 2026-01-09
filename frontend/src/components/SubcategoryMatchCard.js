import React, { useState, useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import LockedOdds from './LockedOdds';
import { assessOddsRisk } from '../utils/riskManagement';
import { addBet } from '../store/slices/activeBetSlice';
import apiService from '../services/api';

const SubcategoryMatchCard = ({ subcategory, matches, sport }) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [expanded, setExpanded] = useState(true);

    const prefetched = useRef(new Set());

    useEffect(() => {
        if (!expanded) return;
        if (!Array.isArray(matches) || matches.length === 0) return;
        const valid = matches.filter(m => {
            if (!m || !m.odds) return false;
            const keys = Object.keys(m.odds || {});
            for (let i = 0; i < keys.length; i++) {
                const v = m.odds[keys[i]];
                if (v && v > 0) return true;
            }
            return false;
        }).slice(0, 6);
        let delay = 0;
        valid.forEach(m => {
            const id = m.id || m._id;
            if (!id) return;
            if (prefetched.current.has(id)) return;
            prefetched.current.add(id);
            setTimeout(() => {
                apiService.getMatchMarkets(id).catch(() => {});
            }, delay);
            delay += 150;
        });
    }, [expanded, matches]);

    const addToBetslip = (match, betType, odds) => {
        const bet = {
            matchId: match.id || match._id, // Use id instead of _id for better compatibility
            match: `${match.homeTeam} vs ${match.awayTeam}`,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            league: match.league,
            startTime: match.startTime,
            type: betType,
            marketType: 'winner',
            marketTypeDisplay: 'Winner',
            odds: odds,
            stake: 0,
            sport: sport
        };
        dispatch(addBet(bet));
    };

    const getBestOdds = (match, oddsType) => {
        if (!match.odds) return null;
        const odds = match.odds[oddsType];
        return odds && odds > 0 ? odds : null;
    };

    // Check if match is live
    const isLiveMatch = (match) => {
        return match.status === 'live' || match.isLive;
    };

    // Get live match time display
    const getLiveTimeDisplay = (match) => {
        if (!isLiveMatch(match)) return null;
        
        // If match has liveTime property, use it
        if (match.liveTime) {
            return (
                <div className="live-time-display">
                    <span className="time-icon"></span>
                    <span>{match.liveTime}</span>
                </div>
            );
        }
        
        // If match has startTime, calculate live time
        if (match.startTime) {
            const startTime = new Date(match.startTime);
            const now = new Date();
            const diffMs = now - startTime;
            const diffMins = Math.floor(diffMs / 60000);
            if (diffMins <= 0) {
                return (
                    <div className="live-time-display">
                        <span className="time-icon"></span>
                        <span>LIVE</span>
                    </div>
                );
            }
            const sportKey = (sport || match.sport || '').toLowerCase();
            // Soccer-specific capped display: 90 + up to 10 minutes
            if (sportKey.includes('soccer') || sportKey === 'football') {
                if (diffMins <= 45) {
                    return (
                        <div className="live-time-display">
                            <span className="time-icon"></span>
                            <span>{diffMins}'</span>
                        </div>
                    );
                }
                if (diffMins <= 50) {
                    return (
                        <div className="live-time-display">
                            <span className="time-icon"></span>
                            <span>45+</span>
                        </div>
                    );
                }
                if (diffMins <= 65) {
                    return (
                        <div className="live-time-display">
                            <span className="time-icon"></span>
                            <span>HT</span>
                        </div>
                    );
                }
                const displayed = diffMins - 20;
                if (displayed <= 90) {
                    return (
                        <div className="live-time-display">
                            <span className="time-icon"></span>
                            <span>{displayed}'</span>
                        </div>
                    );
                }
                const stoppage = Math.min(displayed - 90, 10);
                return (
                    <div className="live-time-display">
                        <span className="time-icon"></span>
                        <span>{`90+${stoppage}`}</span>
                    </div>
                );
            }
            // Basketball
            if (sportKey === 'basketball') {
                if (diffMins <= 12) return <div className="live-time-display"><span className="time-icon"></span><span>{`Q1 ${diffMins}'`}</span></div>;
                if (diffMins <= 24) return <div className="live-time-display"><span className="time-icon"></span><span>{`Q2 ${diffMins - 12}'`}</span></div>;
                if (diffMins <= 39) return <div className="live-time-display"><span className="time-icon"></span><span>HT</span></div>;
                if (diffMins <= 51) return <div className="live-time-display"><span className="time-icon"></span><span>{`Q3 ${diffMins - 39}'`}</span></div>;
                if (diffMins <= 63) return <div className="live-time-display"><span className="time-icon"></span><span>{`Q4 ${diffMins - 51}'`}</span></div>;
                return <div className="live-time-display"><span className="time-icon"></span><span>OT</span></div>;
            }
            // American Football
            if (sportKey === 'americanfootball') {
                if (diffMins <= 15) return <div className="live-time-display"><span className="time-icon"></span><span>{`Q1 ${diffMins}'`}</span></div>;
                if (diffMins <= 30) return <div className="live-time-display"><span className="time-icon"></span><span>{`Q2 ${diffMins - 15}'`}</span></div>;
                if (diffMins <= 42) return <div className="live-time-display"><span className="time-icon"></span><span>HT</span></div>;
                if (diffMins <= 57) return <div className="live-time-display"><span className="time-icon"></span><span>{`Q3 ${diffMins - 42}'`}</span></div>;
                if (diffMins <= 72) return <div className="live-time-display"><span className="time-icon"></span><span>{`Q4 ${diffMins - 57}'`}</span></div>;
                return <div className="live-time-display"><span className="time-icon"></span><span>OT</span></div>;
            }
            // Ice Hockey
            if (sportKey === 'icehockey' || sportKey === 'hockey') {
                if (diffMins <= 20) return <div className="live-time-display"><span className="time-icon"></span><span>{`P1 ${diffMins}'`}</span></div>;
                if (diffMins <= 35) return <div className="live-time-display"><span className="time-icon"></span><span>INT</span></div>;
                if (diffMins <= 55) return <div className="live-time-display"><span className="time-icon"></span><span>{`P2 ${diffMins - 35}'`}</span></div>;
                if (diffMins <= 70) return <div className="live-time-display"><span className="time-icon"></span><span>INT</span></div>;
                if (diffMins <= 90) return <div className="live-time-display"><span className="time-icon"></span><span>{`P3 ${diffMins - 70}'`}</span></div>;
                return <div className="live-time-display"><span className="time-icon"></span><span>OT</span></div>;
            }
            // Rugby
            if (sportKey === 'rugby') {
                if (diffMins <= 40) return <div className="live-time-display"><span className="time-icon"></span><span>{`${diffMins}'`}</span></div>;
                if (diffMins <= 55) return <div className="live-time-display"><span className="time-icon"></span><span>HT</span></div>;
                const displayed = diffMins - 15;
                if (displayed <= 80) return <div className="live-time-display"><span className="time-icon"></span><span>{`${displayed}'`}</span></div>;
                const stoppage = Math.min(displayed - 80, 10);
                return <div className="live-time-display"><span className="time-icon"></span><span>{`80+${stoppage}`}</span></div>;
            }
            // Default for other sports
            return (
                <div className="live-time-display">
                    <span className="time-icon"></span>
                    <span>{diffMins}'</span>
                </div>
            );
        }
        
        return (
            <div className="live-time-display">
                <span className="time-icon"></span>
                <span>LIVE</span>
            </div>
        );
    };

    // Get live score display
    const getLiveScoreDisplay = (match) => {
        if (!isLiveMatch(match)) return null;
        
        if (match.score) {
            return (
                <div className="live-score">
                    {match.score}
                </div>
            );
        }
        
        if (match.homeScore !== undefined && match.awayScore !== undefined) {
            return (
                <div className="live-score">
                    {match.homeScore}-{match.awayScore}
                </div>
            );
        }
        
        return null;
    };


    // Get all available odds types for additional markets count
    const getAllBasicOddsTypes = () => {
        if (!matches || matches.length === 0) return [];
        
        const allTypes = new Set();
        matches.forEach(match => {
            if (match.odds) {
                // Handle Map-based odds structure (new structure)
                if (match.odds instanceof Map || (match.odds && typeof match.odds.get === 'function')) {
                    match.odds.forEach((value, key) => {
                        if (value && typeof value === 'number' && value > 0) {
                            allTypes.add(key);
                        }
                    });
                }
                // Handle nested odds structure (from matchesSeed.js)
                else if (match.odds.default && match.odds.default.odds) {
                    Object.keys(match.odds.default.odds).forEach(key => {
                        if (match.odds.default.odds[key] && match.odds.default.odds[key] > 0) {
                            allTypes.add(key);
                        }
                    });
                } else {
                    // Handle flat odds structure (from transformed API data)
                    Object.keys(match.odds).forEach(key => {
                        if (match.odds[key] && match.odds[key] > 0) {
                            allTypes.add(key);
                        }
                    });
                }
            }
        });
        
        return Array.from(allTypes);
    };


    const hasValidOdds = (match) => {
        if (!match.odds) return false;
        return Object.values(match.odds).some(odds => odds && odds > 0);
    };

    const formatMatchDateTime = (startTime) => {
        const date = new Date(startTime);
        const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateString = date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
        return `${dateString} ${timeString}`;
    };

    // Inline MatchRow component
    const MatchRow = ({ match, basicOddsTypes }) => {
        // Calculate additional markets count (all odds minus basic odds)
        const ignoredLineKeys = new Set(['Total','total','handicapLine','handicap_line']);
        const allMatchOddsTypes = Object.keys(match.odds || {}).filter(key => 
            match.odds[key] && match.odds[key] > 0 && !ignoredLineKeys.has(key)
        );
        const additionalMarketsCount = Math.max(0, allMatchOddsTypes.length - basicOddsTypes.length);
        
        const handleAdditionalMarketsClick = (e) => {
            e.stopPropagation();
            
            // Preserve Home data before navigating away
            try {
                const homeMatches = sessionStorage.getItem('home_matches_data');
                const homePopular = sessionStorage.getItem('home_popular_data');
                const homeFiltered = sessionStorage.getItem('home_filtered_data');
                
                if (homeMatches || homePopular || homeFiltered) {
                    console.log('[SUBCATEGORY] Home data already preserved in session storage');
                }
            } catch (e) {
                console.log('[SUBCATEGORY] Session storage not available');
            }
            
            const matchId = match._id || match.id;
            if (matchId) {
                navigate(`/match/${matchId}?from=additional`);
            } else {
                console.error('Invalid match ID format');
            }
        };

        return (
        <div className={`match-row ${isLiveMatch(match) ? 'live-match' : ''}`} onClick={() => {
            // Preserve Home data before navigating away
            try {
                const homeMatches = sessionStorage.getItem('home_matches_data');
                const homePopular = sessionStorage.getItem('home_popular_data');
                const homeFiltered = sessionStorage.getItem('home_filtered_data');
                
                if (homeMatches || homePopular || homeFiltered) {
                    console.log('[SUBCATEGORY] Home data already preserved in session storage');
                }
            } catch (e) {
                console.log('[SUBCATEGORY] Session storage not available');
            }
            
            navigate(`/match/${match._id || match.id}`);
        }}>
            {/* Live status badge */}
            {isLiveMatch(match) && (
                <div className="live-status-badge">LIVE</div>
            )}
            
            <div className="match-teams">
                <div className="match-date-time">
                    {isLiveMatch(match) ? getLiveTimeDisplay(match) : <span>{formatMatchDateTime(match.startTime)}</span>}
                </div>
                <div className="team">
                    {match.homeTeam}
                </div>
                {/* Show live score if available */}
                {isLiveMatch(match) && getLiveScoreDisplay(match)}
                <div className="team">
                    {match.awayTeam}
                </div>
            </div>
                {/* Odds Headers */}
                <div className="odds-headers-container">
                    {basicOddsTypes.map(oddsType => (
                        <div key={oddsType} className="odds-header">
                            {oddsType}
                        </div>
                    ))}
                </div>
                
                {/* Odds Buttons */}
                <div className="odds-buttons-container">
            {/* Show only basic odds (1, X, 2) - maximum 3 */}
                    {basicOddsTypes.map((oddsType) => {
                        const odds = getBestOdds(match, oddsType);
                        
                        if (!odds) {
                            return <div key={oddsType} className="odds-button empty"></div>;
                        }
                        
                        const riskAssessment = assessOddsRisk(match, odds, oddsType);
                        
                        // If odds should be disabled, show locked odds component
                        if (riskAssessment.shouldDisable) {
                            return (
                                <LockedOdds
                                    key={oddsType}
                                    riskAssessment={riskAssessment}
                                    className="odds-button"
                                />
                            );
                        }
                        
                        // Otherwise show normal odds button with only odds value
                        return (
                            <button
                                key={oddsType}
                                className={`odds-button ${isLiveMatch(match) ? 'live-highlight' : ''}`}
                                onClick={e => {
                                    e.stopPropagation();
                                    addToBetslip(match, oddsType, odds);
                                }}
                            >
                                <div className="odds-value">{odds.toFixed(2)}</div>
                            </button>
                        );
                    })}
                </div>
                {/* Show additional markets button if there are more odds types */}
                {additionalMarketsCount > 0 && (
                    <div className="additional-markets-container">
                        <button 
                            className="more-markets-button" 
                            title="View all betting markets"
                            onClick={handleAdditionalMarketsClick}
                        >
                            <span className="more-markets-icon">+</span>
                            <span className="more-markets-count">{additionalMarketsCount}</span>
                        </button>
                    </div>
                )}
        </div>
    );
    };

    // Filter out matches without valid odds
    const validMatches = matches.filter(match => hasValidOdds(match));
    if (validMatches.length === 0) {
        return null;
    }

    // Get all unique basic odds types from all matches
    const basicOddsTypesArray = getAllBasicOddsTypes();

    return (
        <div className="subcategory-match-card">
            {/* Subcategory Header and Basic Odds Headers on the same row */}
            <div className="subcategory-header">
                <div className="subcategory-title" onClick={() => setExpanded((prev) => !prev)} style={{ cursor: 'pointer' }}>
                    <span className="arrow">{expanded ? '▼' : '▶'}</span>
                    {subcategory}
                </div>
                {/* Show only basic odds headers */}
                {basicOddsTypesArray.map(oddsType => (
                    <div key={oddsType} className="odds-header">{oddsType}</div>
                ))}
                <div className="odds-header"></div>
            </div>
            {/* Matches List - only show if expanded */}
            {expanded && (
                <div className="subcategory-matches">
                    {validMatches.map((match, idx) => (
                        <MatchRow
                            key={match.id || match._id || idx}
                            match={match}
                            basicOddsTypes={basicOddsTypesArray}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default SubcategoryMatchCard;
