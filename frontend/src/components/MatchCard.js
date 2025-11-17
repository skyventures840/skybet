import React, { useState, useMemo, useCallback, memo } from 'react';
import VideoPlayerScheduled from './VideoPlayerScheduled';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import LockedOdds from './LockedOdds';
import { assessOddsRisk } from '../utils/riskManagement';
import { computeLeagueTitleWithFlag } from '../utils/leagueTitle';
import { addBet } from '../store/slices/activeBetSlice';

const MatchCard = memo(({ match, sport, league, showLeagueHeader = true }) => {
    if (!match) return null;
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [isFavorited, setIsFavorited] = useState(false);

    const [showVideoSection, setShowVideoSection] = useState(false);
    
    // Debug logging for odds data
    console.log('[DEBUG] MatchCard rendered with match:', {
        id: match.id,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        odds: match.odds,
        oddsType: typeof match.odds,
        oddsKeys: match.odds ? Object.keys(match.odds) : 'no odds'
    });

    // Memoized calculations for better performance
    const isLiveMatch = useMemo(() => 
        match.status === 'live' || match.isLive, 
        [match.status, match.isLive]
    );

    // Determine if the match is upcoming (has not started yet)
    const isUpcomingMatch = useMemo(() => {
        try {
            const start = match?.startTime ? new Date(match.startTime) : null;
            return !!start && start >= new Date();
        } catch (e) {
            return false;
        }
    }, [match.startTime]);
    
    // Memoized video display logic
    const canShowVideo = useMemo(() => {
        if (!match.videoUrl) {
            return false;
        }
        
        const now = new Date();
        const startTime = new Date(match.startTime);
        
        switch (match.videoDisplayControl) {
            case 'scheduled': {
                return now >= startTime;
            }
            case 'manual': {
                return true; // Admin controls this
            }
            case 'live_only': {
                return match.status === 'live';
            }
            default: {
                return now >= startTime;
            }
        }
    }, [match.videoUrl, match.startTime, match.videoDisplayControl, match.status]);
    
    // Get live match time display
    const getLiveTimeDisplay = () => {
        if (!isLiveMatch) return null;
        
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
            
            if (diffMins > 0) {
                return (
                    <div className="live-time-display">
                        <span className="time-icon"></span>
                        <span>LIVE {diffMins}'</span>
                    </div>
                );
            }
        }
        
        return (
            <div className="live-time-display">
                <span className="time-icon"></span>
                <span>LIVE</span>
            </div>
        );
    };

    // Get live score display
    const getLiveScoreDisplay = () => {
        if (!isLiveMatch) return null;
        
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

    const addToBetslip = useCallback((matchInfo, betType, odds) => {
        // Prevent adding bets for matches that have already started
        const hasStart = !!matchInfo?.startTime;
        const startDate = hasStart ? new Date(matchInfo.startTime) : null;
        if (hasStart && startDate <= new Date()) {
            return;
        }

        const bet = {
            matchId: matchInfo.id || matchInfo._id,
            match: `${matchInfo.homeTeam} vs ${matchInfo.awayTeam}`,
            homeTeam: matchInfo.homeTeam,
            awayTeam: matchInfo.awayTeam,
            league: matchInfo.league || league,
            startTime: matchInfo.startTime,
            type: betType,
            marketType: 'winner',
            marketTypeDisplay: 'Winner',
            odds: odds,
            stake: 0,
            sport: matchInfo.sport || sport
        };
        
        dispatch(addBet(bet));
    }, [dispatch, league, sport]);

    // Resolve actual odds key for a normalized type ('1', 'X', '2')
    const resolveOddsKeyForType = useCallback((normalizedType) => {
        const staticCandidatesByType = {
            '1': ['1', 'home', 'home_win', 'homeWin', 'winner_home', 'h2h_home', 'moneyline_home'],
            'X': ['X', 'draw', 'draw_result', 'tie', 'h2h_draw', 'moneyline_draw'],
            '2': ['2', 'away', 'away_win', 'awayWin', 'winner_away', 'h2h_away', 'moneyline_away']
        };

        // Include dynamic team-name keys often used by some feeds (e.g., hockey)
        const dynamicCandidatesByType = {
            '1': [
                match.homeTeam,
                match.home_team,
                match.home,
                match?.teams?.home
            ].filter(Boolean),
            'X': ['Draw', 'Tie'],
            '2': [
                match.awayTeam,
                match.away_team,
                match.away,
                match?.teams?.away
            ].filter(Boolean)
        };

        const candidates = [
            ...(staticCandidatesByType[normalizedType] || [normalizedType]),
            ...(dynamicCandidatesByType[normalizedType] || [])
        ];

        // Helper to test a single key against current odds structure
        const getByKey = (key) => {
            if (!match.odds) return null;
            if (match.odds instanceof Map || (match.odds && typeof match.odds.get === 'function')) {
                return match.odds.get ? match.odds.get(key) : match.odds[key];
            }
            if (match.odds.default && match.odds.default.odds) {
                return match.odds.default.odds[key];
            }
            return match.odds[key];
        };

        for (const key of candidates) {
            const val = getByKey(key);
            if (val && typeof val === 'number' && val > 0) {
                return key;
            }
        }
        return null;
    }, [match.odds, match.homeTeam, match.awayTeam]);

    const getBestOdds = useCallback((oddsType) => {
        if (!match.odds) return null;

        // If using normalized basic type, resolve the actual key
        const normalizedBasic = ['1', 'X', '2'];
        const keyToUse = normalizedBasic.includes(oddsType)
            ? resolveOddsKeyForType(oddsType) || oddsType
            : oddsType;

        // Handle Map-based odds structure (new structure)
        if (match.odds instanceof Map || (match.odds && typeof match.odds.get === 'function')) {
            const val = match.odds.get ? match.odds.get(keyToUse) : match.odds[keyToUse];
            return val && typeof val === 'number' && val > 0 ? val : null;
        }
        
        // Handle nested odds structure (from matchesSeed.js)
        if (match.odds.default && match.odds.default.odds) {
            const val = match.odds.default.odds[keyToUse];
            return val && typeof val === 'number' && val > 0 ? val : null;
        }
        
        // Handle flat odds structure (from transformed API data)
        const val = match.odds[keyToUse];
        return val && typeof val === 'number' && val > 0 ? val : null;
    }, [match.odds, resolveOddsKeyForType]);

    // Memoized basic odds types calculation
    const basicOddsTypes = useMemo(() => {
        console.log('🎯 MatchCard basicOddsTypes calculation for match:', match.id);
        console.log('🎯 Match odds:', match.odds);
        console.log('🎯 Match odds type:', typeof match.odds);
        console.log('🎯 Is Map?', match.odds instanceof Map);
        console.log('🎯 Has get method?', match.odds && typeof match.odds.get === 'function');
        
        if (!match.odds) {
            console.log('🎯 No odds found, returning empty array');
            return [];
        }
        
        // Strictly restrict to winner/h2h/1x2 only
        const normalizedCandidates = ['1', 'X', '2'];
        const availableBasicTypes = [];

        normalizedCandidates.forEach(type => {
            const resolvedKey = resolveOddsKeyForType(type);
            console.log(`🎯 Resolved key for ${type}:`, resolvedKey);
            if (resolvedKey) {
                const val = getBestOdds(type);
                console.log(`🎯 Odds value for ${type} via ${resolvedKey}:`, val);
                if (val && typeof val === 'number' && val > 0) {
                    availableBasicTypes.push(type);
                }
            }
        });
        
        console.log('🎯 Available basic types:', availableBasicTypes);
        
        // Do not fallback to other markets; strictly show only 1/X/2
        const result = availableBasicTypes.slice(0, 3);
        console.log('🎯 Final basic odds types:', result);
        return result;
    }, [match.odds, resolveOddsKeyForType]);

    // Get all available odds types for additional markets (function declaration for hoisting)
    function getAllAvailableOddsTypes() {
        if (!match.odds) return [];
        
        // Handle Map-based odds structure (new structure)
        if (match.odds instanceof Map || (match.odds && typeof match.odds.get === 'function')) {
            const allTypes = [];
            match.odds.forEach((value, key) => {
                if (value && typeof value === 'number' && value > 0) {
                    allTypes.push(key);
                }
            });
            return allTypes;
        }
        // Handle nested odds structure (from matchesSeed.js)
        else if (match.odds.default && match.odds.default.odds) {
            const allTypes = Object.keys(match.odds.default.odds).filter(key => 
                match.odds.default.odds[key] && match.odds.default.odds[key] > 0
            );
            return allTypes;
        } else {
            // Handle flat odds structure (from transformed API data)
            const allTypes = Object.keys(match.odds).filter(key => 
                match.odds[key] && match.odds[key] > 0
            );
            return allTypes;
        }
    }

    // Check if we have any valid odds to display
    const hasValidOdds = () => {
        if (!match.odds) return false;
        
        // Handle Map-based odds structure
        if (match.odds instanceof Map || (match.odds && typeof match.odds.get === 'function')) {
            let hasValid = false;
            match.odds.forEach((value) => {
                if (value && typeof value === 'number' && value > 0) {
                    hasValid = true;
                }
            });
            return hasValid;
        }
        
        return Object.values(match.odds).some(odds => odds && odds > 0);
    };

    // If no valid odds, only hide past matches; show current/live and future
    if (!hasValidOdds() && !isLiveMatch && !isUpcomingMatch) {
        return null;
    }

    const toggleFavorite = (e) => {
        e.stopPropagation();
        setIsFavorited(!isFavorited);
    };

    const handleMatchClick = () => {
        // Preserve Home data before navigating away
        try {
            const homeMatches = sessionStorage.getItem('home_matches_data');
            const homePopular = sessionStorage.getItem('home_popular_data');
            const homeFiltered = sessionStorage.getItem('home_filtered_data');
            
            if (homeMatches || homePopular || homeFiltered) {
                console.log('[MATCHCARD] Home data already preserved in session storage');
            }
        } catch (e) {
            console.log('[MATCHCARD] Session storage not available');
        }
        
        const matchId = match._id || match.id;
        if (matchId) {
            navigate(`/match/${matchId}`);
        } else {
            console.error('Invalid match ID format');
        }
    };

    // Removed handler for additional markets navigation as the button was removed

    const handleTeamsClick = (e) => {
        e.stopPropagation();
        
        // Preserve Home data before navigating away
        try {
            const homeMatches = sessionStorage.getItem('home_matches_data');
            const homePopular = sessionStorage.getItem('home_popular_data');
            const homeFiltered = sessionStorage.getItem('home_filtered_data');
            
            if (homeMatches || homePopular || homeFiltered) {
                console.log('[MATCHCARD] Home data already preserved in session storage');
            }
        } catch (e) {
            console.log('[MATCHCARD] Session storage not available');
        }
        
        const matchId = match._id || match.id;
        if (matchId) {
            navigate(`/match/${matchId}/markets`);
        } else {
            console.error('Invalid match ID format');
        }
    };

    // Compute league title using unified backend-like logic (Sport.Country.League)
    const sportName = sport || match.sport || '';
    const sportKeyOrName = match.sport_key || sportName;
    const country = match.country || match.subcategory || '';
    const leagueName = league || match.league || '';
    
    // Get league title with flag
    const leagueTitleWithFlag = computeLeagueTitleWithFlag({
        sportKeyOrName,
        country,
        leagueName,
        fallbackSportTitle: match.sport_title || match.sport || ''
    });

    // Removed unused formatMatchTime helper

    const formatMatchDateTime = (startTime) => {
        const date = new Date(startTime);
        const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateString = date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
        return `${dateString} ${timeString}`;
    };

    // Get all odds types for additional markets count
    const allOddsTypes = getAllAvailableOddsTypes();
    const additionalMarketsTotal = Math.max(0, allOddsTypes.length - basicOddsTypes.length);
    
    // Debug logging for custom matches
    console.log('[DEBUG] MatchCard odds analysis for match:', match._id, {
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        oddsType: typeof match.odds,
        isMap: match.odds instanceof Map,
        basicOddsTypes,
        allOddsTypes,
        additionalMarketsTotal,
        basicCount: basicOddsTypes.length,
        totalCount: allOddsTypes.length
    });
    
    // If this is a custom match with Map odds, log the details
    if (match.odds instanceof Map) {
        console.log('[DEBUG] Custom match Map odds details:');
        match.odds.forEach((value, key) => {
            console.log(`  ${key}: ${value} (${typeof value})`);
        });
    }
    
    return (
        <>
            {/* League Header */}
            {showLeagueHeader && (
                <div className="league-header">
                    <h3 className="league-title">
                        {leagueTitleWithFlag.flag && (
                            <span className="country-flag">{leagueTitleWithFlag.flag}</span>
                        )}
                        <span className="league-text">{leagueTitleWithFlag.displayTitle}</span>
                    </h3>
                    <div className="odds-headers">
                        {basicOddsTypes.map(oddsType => (
                            <div key={oddsType} className="odds-header">
                                {oddsType}
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            <div className={`match-container ${isLiveMatch ? 'live-match' : ''}`} onClick={handleMatchClick}>
                {/* Live status badge */}
                {isLiveMatch && (
                    <div className="live-status-badge">LIVE</div>
                )}
                
                <div className="match-row">
                    <div className="match-actions">
                        <button 
                            className={`favorite-btn ${isFavorited ? 'favorited' : ''}`}
                            onClick={toggleFavorite}
                            title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                        >
                            {isFavorited ? '★' : '☆'}
                        </button>
                        {canShowVideo && (
                          <button
                            className="favorite-btn"
                            title={showVideoSection ? 'Hide video' : 'Show video'}
                            onClick={(e) => { e.stopPropagation(); setShowVideoSection(v => !v); }}
                          >
                            📺
                          </button>
                        )}
                    </div>
                    <div className="match-teams" onClick={handleTeamsClick}>
                        <div className="match-date-time">
                            {isLiveMatch ? getLiveTimeDisplay() : <span>{formatMatchDateTime(match.startTime)}</span>}
                        </div>
                        <div className="team">
                            {match.homeTeam}
                        </div>
                        <div className="team">
                            {match.awayTeam}
                        </div>
                        {/* Show market type only for non-live matches */}
                        {!isLiveMatch && match.market && (
                          <div className="match-market-info" style={{ fontSize: '0.9em', color: '#666', marginTop: 2 }}>
                            {match.market && <span>Market: {match.market}</span>}
                          </div>
                        )}
                    </div>
                    
                    {/* Score and Odds on the same line */}
                    <div className="score-odds-line">
                        {/* Live Score */}
                        {isLiveMatch && (
                            <div className="live-score-container">
                                {getLiveScoreDisplay()}
                            </div>
                        )}
                        
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
                            {console.log('🎯 Rendering odds buttons for match:', match.id, 'basicOddsTypes:', basicOddsTypes)}
                            {basicOddsTypes.map(oddsType => {
                                const odds = getBestOdds(oddsType);
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
                                        className={`odds-button ${isLiveMatch ? 'live-highlight' : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            // Store normalized type for 1x2; otherwise keep raw type
                                            const normalized = ['1', 'X', '2'].includes(oddsType) ? oddsType : oddsType;
                                            addToBetslip(match, normalized, odds);
                                        }}
                                    >
                                        <div className="odds-value">
                                            {typeof odds === 'number' ? odds.toFixed(2) : '-'}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        {/* Removed: Additional markets indicator */}
                    </div>
                    {/* Removed additional markets button and container */}
                </div>
                {canShowVideo && showVideoSection && (
                  <div style={{ marginTop: 8, border: '1px solid #2d2d2d', borderRadius: 8, padding: 8 }} onClick={(e) => e.stopPropagation()}>
                    {/* Video on upper side of the expanded section */}
                    <VideoPlayerScheduled
                      src={match.videoUrl}
                      poster={match.videoPosterUrl || undefined}
                      startTime={match.startTime}
                      videoDisplayControl={match.videoDisplayControl}
                    />
                    {/* Additional match section controls - removed markets count and button */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: 8 }}>
                      <button
                        className="favorite-btn"
                        title="Close"
                        onClick={(e) => { e.stopPropagation(); setShowVideoSection(false); }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}
            </div>
        </>
    );
});

export default MatchCard;
