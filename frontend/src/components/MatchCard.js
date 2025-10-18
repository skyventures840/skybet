import React, { useState, useMemo, useCallback, memo } from 'react';
import VideoPlayerScheduled from './VideoPlayerScheduled';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import LockedOdds from './LockedOdds';
import { assessOddsRisk } from '../utils/riskManagement';
import { computeFullLeagueTitle } from '../utils/leagueTitle';
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
            odds: odds,
            stake: 0,
            sport: matchInfo.sport || sport
        };
        
        dispatch(addBet(bet));
    }, [dispatch, league, sport]);

    const getBestOdds = useCallback((oddsType) => {
        if (!match.odds) return null;
        
        // Handle Map-based odds structure (new structure)
        if (match.odds instanceof Map || (match.odds && typeof match.odds.get === 'function')) {
            return match.odds.get ? match.odds.get(oddsType) : match.odds[oddsType];
        }
        
        // Handle nested odds structure (from matchesSeed.js)
        if (match.odds.default && match.odds.default.odds) {
            const odds = match.odds.default.odds[oddsType];
            return odds && typeof odds === 'number' && odds > 0 ? odds : null;
        }
        
        // Handle flat odds structure (from transformed API data)
        const odds = match.odds[oddsType];
        return odds && typeof odds === 'number' && odds > 0 ? odds : null;
    }, [match.odds]);

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
        
        const basicTypes = ['1', 'X', '2'];
        const availableBasicTypes = [];
        
        // Handle Map-based odds structure (new structure)
        if (match.odds instanceof Map || (match.odds && typeof match.odds.get === 'function')) {
            console.log('🎯 Using Map-based odds structure');
            basicTypes.forEach(type => {
                const odds = match.odds.get ? match.odds.get(type) : match.odds[type];
                console.log(`🎯 Map odds for ${type}:`, odds);
                if (odds && typeof odds === 'number' && odds > 0) {
                    availableBasicTypes.push(type);
                }
            });
        }
        // Handle nested odds structure (from matchesSeed.js)
        else if (match.odds.default && match.odds.default.odds) {
            console.log('🎯 Using nested odds structure');
            basicTypes.forEach(type => {
                const odds = match.odds.default.odds[type];
                console.log(`🎯 Nested odds for ${type}:`, odds);
                if (odds && typeof odds === 'number' && odds > 0) {
                    availableBasicTypes.push(type);
                }
            });
        } else {
            // Handle flat odds structure (from transformed API data)
            console.log('🎯 Using flat odds structure');
            basicTypes.forEach(type => {
                const odds = match.odds[type];
                console.log(`🎯 Flat odds for ${type}:`, odds, typeof odds);
                if (odds && typeof odds === 'number' && odds > 0) {
                    availableBasicTypes.push(type);
                }
            });
        }
        
        console.log('🎯 Available basic types:', availableBasicTypes);
        
        // Return maximum of 3 basic odds types
        const result = availableBasicTypes.slice(0, 3);
        console.log('🎯 Final basic odds types:', result);
        return result;
    }, [match.odds]);

    // Get all available odds types for additional markets
    const getAllAvailableOddsTypes = () => {
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
    };

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

    // If no valid odds, don't render the match card
    if (!hasValidOdds()) {
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
    const computedLeagueTitle = computeFullLeagueTitle({
        sportKeyOrName,
        country,
        leagueName,
        fallbackSportTitle: match.sport_title || match.sport || ''
    });

    const fullLeagueTitle = match.fullLeagueTitle || computedLeagueTitle || leagueName;

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
            {showLeagueHeader && (
                <div className="league-header">
                    <div 
                        className="league-title" 
                        data-sport={sport}
                        style={{ maxWidth: 'calc(100% - 200px)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                        <span className="arrow">▲</span>
                        {fullLeagueTitle}
                    </div>
                    {canShowVideo && (
                      <button
                        className="odds-header"
                        title={showVideoSection ? 'Hide video' : 'Show live video'}
                        onClick={(e) => { e.stopPropagation(); setShowVideoSection(v => !v); }}
                        style={{ cursor: 'pointer' }}
                      >
                        📺
                      </button>
                    )}
                    {/* Show only basic odds headers */}
                    {basicOddsTypes.map(oddsType => (
                        <div key={oddsType} className="odds-header">{oddsType}</div>
                    ))}
                    <div className="odds-header"></div>
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
                            <img className="team-flag" src={match.homeTeamFlag} alt="" />
                            {match.homeTeam}
                        </div>
                        <div className="team">
                            <img className="team-flag" src={match.awayTeamFlag} alt="" />
                            {match.awayTeam}
                        </div>
                        {/* Show market type and bookmaker for non-live matches only */}
                        {!isLiveMatch && (match.market || match.bookmaker) && (
                          <div className="match-market-info" style={{ fontSize: '0.9em', color: '#666', marginTop: 2 }}>
                            {match.market && <span>Market: {match.market}</span>}
                            {match.market && match.bookmaker && <span> | </span>}
                            {match.bookmaker && <span>Bookmaker: {match.bookmaker}</span>}
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
                                            addToBetslip(match, oddsType, odds);
                                        }}
                                    >
                                        <div className="odds-value">
                                            {typeof odds === 'number' ? odds.toFixed(2) : '-'}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
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
