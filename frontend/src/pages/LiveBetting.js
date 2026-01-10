import React, { useState, useEffect } from 'react';
import SkeletonLoader from '../components/SkeletonLoader';
import MatchCard from '../components/MatchCard';
 
import websocketService from '../services/websocketService';
import { useSelector } from 'react-redux';
import enhancedCache from '../services/enhancedCache';
import { computeFullLeagueTitle } from '../utils/leagueTitle';
import apiService from '../services/api';

const LiveBetting = () => {
  const [liveMatches, setLiveMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const { user } = useSelector(state => state.auth);

  // Helper: determine live status from multiple possible flags/variants
  const isLiveStatus = (status, startTime) => {
    const s = String(status || '').toLowerCase();
    if (['live', 'in_play', 'inplay', 'ongoing', 'running'].includes(s)) return true;
    if (!startTime) return false;
    try {
      const start = new Date(startTime);
      return start <= new Date();
    } catch (_) { return false; }
  };

  // Transform odds feed entries into live-like matches for instant fallback
  const transformOddsToLiveMatches = (oddsData) => {
    const MAX_WINDOWS_MIN = {
      soccer: 120,
      basketball: 150,
      icehockey: 150,
      baseball: 240,
      tennis: 240,
      rugby: 120,
      volleyball: 150,
      handball: 120
    };

    return oddsData.map(m => {
      const bookmakers = Array.isArray(m.bookmakers) ? m.bookmakers : [];
      const firstBm = bookmakers[0] || null;
      const markets = firstBm?.markets || [];
      const h2h = markets.find(x => x.key === 'h2h') || markets.find(x => x.key === 'h2h_3_way');
      const odds = {};
      if (h2h && Array.isArray(h2h.outcomes)) {
        const homeOutcome = h2h.outcomes.find(o => o.name === m.home_team) || h2h.outcomes[0];
        const awayOutcome = h2h.outcomes.find(o => o.name === m.away_team) || h2h.outcomes[1];
        const drawOutcome = h2h.outcomes.find(o => /^(draw|tie)$/i.test(o.name));
        if (homeOutcome?.price) odds['1'] = homeOutcome.price;
        if (awayOutcome?.price) odds['2'] = awayOutcome.price;
        if (drawOutcome?.price) odds['X'] = drawOutcome.price;
      }

      const start = m.commence_time ? new Date(m.commence_time) : new Date();
      const diffMs = Date.now() - start.getTime();
      const diffMins = Math.max(0, Math.floor(diffMs / (1000 * 60)));
      const sportKeyFull = (m.sport_key || '').toString();
      const sportKey = sportKeyFull.split('_')[0] || '';
      const maxWindow = MAX_WINDOWS_MIN[sportKey] || 180;

      const withinWindow = diffMins >= 0 && diffMins <= maxWindow;
      const status = withinWindow ? 'live' : 'finished';

      let liveTime = undefined;
      if (withinWindow) {
        if (sportKey === 'soccer' || sportKey === 'football') {
          if (diffMins <= 45) {
            liveTime = `${diffMins}'`;
          } else if (diffMins <= 60) {
            liveTime = 'HT';
          } else if (diffMins <= 105) {
            liveTime = `${diffMins - 15}'`;
          } else {
            const stoppage = Math.min(diffMins - 105, 10);
            liveTime = `90+${stoppage}`;
          }
        } else {
          liveTime = 'LIVE';
        }
      }

      const fullLeagueTitle = computeFullLeagueTitle({
        sportKeyOrName: sportKeyFull,
        country: '',
        leagueName: '',
        fallbackSportTitle: ''
      });

      return {
        id: m.id || m.gameId,
        league: m.sport_title || m.sport_key || 'Live',
        subcategory: m.sport_key || 'live',
        startTime: start,
        homeTeam: m.home_team,
        awayTeam: m.away_team,
        homeTeamFlag: '🏳️',
        awayTeamFlag: '🏳️',
        odds,
        additionalMarkets: Math.max(0, (markets.length || 0) - (h2h ? 1 : 0)),
        sport: sportKey || 'live',
        sport_key: sportKeyFull,
        allMarkets: markets,
        status,
        isLive: status === 'live',
        liveTime,
        score: null,
        homeScore: null,
        awayScore: null,
        lastUpdate: new Date().toISOString(),
        country: '',
        fullLeagueTitle
      };
    });
  };

  // Fetch live matches from API (instant-friendly: no loading gate)
  const fetchLiveMatches = async (opts = {}) => {
    try {
      const { allowSkeleton = false } = opts;
      if (allowSkeleton) setLoading(true);
      setError(null);
      
      console.log('[LIVE BETTING] Fetching live matches from API...');
      
      const response = await apiService.getLiveMatches();
      
      if (response.data.success) {
        const matches = response.data.matches || [];
        console.log(`[LIVE BETTING] Received ${matches.length} live matches from API`);
        
        if (matches.length === 0) {
          console.log('[LIVE BETTING] No live matches found in DB. Falling back to odds feed...');

          // Fallback: derive live matches from odds feed when DB has none
          try {
            const oddsResp = await apiService.getOddsMatches();
            const oddsMatches = (oddsResp?.data?.matches || []).filter(m => {
              const ct = m.commence_time ? new Date(m.commence_time) : null;
              return ct && ct <= new Date();
            });
            const transformed = transformOddsToLiveMatches(oddsMatches)
              // Only keep truly live matches
              .filter(m => isLiveStatus(m.status, m.startTime));
            console.log(`[LIVE BETTING] Fallback produced ${transformed.length} live matches from odds feed`);
            setLiveMatches(transformed);
            try { sessionStorage.setItem('live_matches_data', JSON.stringify(transformed)); } catch { void 0; }
            setLastUpdate(new Date().toISOString());
          } catch (fallbackErr) {
            console.error('[LIVE BETTING] Fallback odds fetch failed:', fallbackErr);
            setLiveMatches([]);
          }
        } else {
          setLiveMatches(matches);
          try { sessionStorage.setItem('live_matches_data', JSON.stringify(matches)); } catch { void 0; }
          setLastUpdate(new Date().toISOString());
        }
      } else {
        throw new Error(response.data.message || 'Failed to fetch live matches');
      }
      
    } catch (err) {
      console.error('[LIVE BETTING] Error fetching live matches:', err);

      // Last-chance fallback to odds feed even when live endpoint failed
      try {
        const oddsResp = await apiService.getOddsMatches();
        const oddsMatches = (oddsResp?.data?.matches || []).filter(m => {
          const ct = m.commence_time ? new Date(m.commence_time) : null;
          return ct && ct <= new Date();
        });
        const transformed = oddsMatches.map(m => {
          const bookmakers = Array.isArray(m.bookmakers) ? m.bookmakers : [];
          const firstBm = bookmakers[0] || null;
          const markets = firstBm?.markets || [];
          const h2h = markets.find(x => x.key === 'h2h') || markets.find(x => x.key === 'h2h_3_way');
          const odds = {};
          if (h2h && Array.isArray(h2h.outcomes)) {
            const homeOutcome = h2h.outcomes.find(o => o.name === m.home_team) || h2h.outcomes[0];
            const awayOutcome = h2h.outcomes.find(o => o.name === m.away_team) || h2h.outcomes[1];
            const drawOutcome = h2h.outcomes.find(o => /^(draw|tie)$/i.test(o.name));
            if (homeOutcome?.price) odds['1'] = homeOutcome.price;
            if (awayOutcome?.price) odds['2'] = awayOutcome.price;
            if (drawOutcome?.price) odds['X'] = drawOutcome.price;
          }
          const start = m.commence_time ? new Date(m.commence_time) : new Date();
          const sportKeyFull = (m.sport_key || '').toString();
          const sportKey = sportKeyFull.split('_')[0] || '';
          const fullLeagueTitle = computeFullLeagueTitle({
            sportKeyOrName: sportKeyFull,
            country: '',
            leagueName: '',
            fallbackSportTitle: ''
          });
          const status = 'live';
          return {
            id: m.id || m.gameId,
            league: m.sport_title || m.sport_key || 'Live',
            subcategory: m.sport_key || 'live',
            startTime: start,
            homeTeam: m.home_team,
            awayTeam: m.away_team,
            homeTeamFlag: '🏳️',
            awayTeamFlag: '🏳️',
            odds,
            additionalMarkets: Math.max(0, (markets.length || 0) - (h2h ? 1 : 0)),
            sport: sportKey || 'live',
            sport_key: sportKeyFull,
            allMarkets: markets,
            status,
            isLive: true,
            liveTime: undefined,
            score: null,
            homeScore: null,
            awayScore: null,
            lastUpdate: new Date().toISOString(),
            country: '',
            fullLeagueTitle
          };
        }).filter(m => isLiveStatus(m.status, m.startTime));
        setLiveMatches(transformed);
        setError(null);
      } catch (fallbackErr) {
        console.error('[LIVE BETTING] Odds fallback also failed:', fallbackErr);
        setError('Failed to load live matches. Please try again later.');
        setLiveMatches([]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Setup WebSocket service connection and subscriptions
  const setupWebSocketService = () => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('[LIVE BETTING] No auth token; skipping WS connection');
      return;
    }

    try {
      websocketService.connect(token);
      websocketService.startHeartbeat();

      const handleLiveMatchesUpdate = (payload) => {
        const matches = Array.isArray(payload?.matches) ? payload.matches : [];
        setLiveMatches(() => {
          const next = matches.map(m => ({
            ...m,
            isLive: isLiveStatus(m.status, m.startTime)
          }));
          try { sessionStorage.setItem('live_matches_data', JSON.stringify(next)); } catch { void 0; }
          return next;
        });
        setLastUpdate(payload?.timestamp || new Date().toISOString());
      };

      const handleMatchResultUpdate = (payload) => {
        const matchId = payload?.matchId;
        const result = payload?.result || {};
        if (!matchId) return;
        setLiveMatches(prev => {
          const idx = prev.findIndex(m => (m._id || m.id) === matchId);
          if (idx === -1) return prev;
          const prevItem = prev[idx];
          const merged = {
            ...prevItem,
            homeScore: result.homeScore ?? prevItem.homeScore ?? null,
            awayScore: result.awayScore ?? prevItem.awayScore ?? null,
            score: result.score ?? (result.homeScore != null && result.awayScore != null ? `${result.homeScore}-${result.awayScore}` : prevItem.score || null)
          };
          const next = [...prev];
          next[idx] = merged;
          try { sessionStorage.setItem('live_matches_data', JSON.stringify(next)); } catch { void 0; }
          return next;
        });
        setLastUpdate(payload?.timestamp || new Date().toISOString());
      };

      websocketService.on('liveMatchesUpdate', handleLiveMatchesUpdate);
      websocketService.on('matchResultUpdate', handleMatchResultUpdate);
      websocketService.subscribeToLiveMatches();
      websocketService.requestLiveMatches();

      return () => {
        websocketService.unsubscribeFromLiveMatches();
        websocketService.off('liveMatchesUpdate', handleLiveMatchesUpdate);
        websocketService.off('matchResultUpdate', handleMatchResultUpdate);
        websocketService.stopHeartbeat();
      };
    } catch (error) {
      console.error('[LIVE BETTING] Error setting up WebSocket service:', error);
    }
  };

  // Group matches by league
  const groupMatchesByLeague = (matches) => {
    const grouped = {};
    matches.forEach(match => {
      const leagueKey = match.league;
      if (!grouped[leagueKey]) {
        grouped[leagueKey] = [];
      }
      grouped[leagueKey].push(match);
    });
    return grouped;
  };

  // Get common odds types across all matches in a league
  const getCommonOddsTypes = (matches) => {
    if (matches.length === 0) return [];
    
    const allOddsTypes = new Set();
    matches.forEach(match => {
      if (match.odds) {
        Object.keys(match.odds).forEach(key => {
          if (match.odds[key] && match.odds[key] > 0) {
            allOddsTypes.add(key);
          }
        });
      }
    });
    
    // Return most common odds types (max 3)
    const oddsCount = {};
    allOddsTypes.forEach(type => {
      oddsCount[type] = matches.filter(match => 
        match.odds && match.odds[type] && match.odds[type] > 0
      ).length;
    });
    
    return Object.entries(oddsCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([type]) => type);
  };



  useEffect(() => {
    // Instant restore from sessionStorage or durable cache for instant display
    try {
      const sessionRaw = sessionStorage.getItem('live_matches_data');
      const sessionMatches = sessionRaw ? JSON.parse(sessionRaw) : null;
      if (Array.isArray(sessionMatches) && sessionMatches.length > 0) {
        setLiveMatches(sessionMatches);
        setLastUpdate(new Date().toISOString());
        setLoading(false);
        enhancedCache.markInitialLoadComplete();
      } else {
        const cached = enhancedCache.getCachedData('/matches/live/real-time');
        if (cached && Array.isArray(cached.matches)) {
          const matches = cached.matches || [];
          if (cached.success && matches.length > 0) {
            console.log('[LIVE BETTING] Instant restore from cache:', matches.length, 'matches');
            setLiveMatches(matches);
            setLastUpdate(new Date().toISOString());
            setLoading(false);
            enhancedCache.markInitialLoadComplete();
          } else {
            // Try odds cache for instant fallback when live cache empty
            const oddsCached = enhancedCache.getCachedData('/odds');
            const oddsMatches = Array.isArray(oddsCached?.matches) ? oddsCached.matches : [];
            if (oddsMatches.length > 0) {
              const filtered = oddsMatches.filter(m => {
                const ct = m.commence_time ? new Date(m.commence_time) : null;
                return ct && ct <= new Date();
              });
              const transformed = transformOddsToLiveMatches(filtered).filter(m => isLiveStatus(m.status, m.startTime));
              if (transformed.length > 0) {
                console.log('[LIVE BETTING] Instant odds fallback from cache:', transformed.length, 'matches');
                setLiveMatches(transformed);
                setLastUpdate(new Date().toISOString());
                setLoading(false);
                enhancedCache.markInitialLoadComplete();
              } else {
                setLoading(enhancedCache.shouldShowSkeleton());
              }
            } else {
              setLoading(enhancedCache.shouldShowSkeleton());
            }
          }
        } else {
          // No live cache: attempt odds cache
          const oddsCached = enhancedCache.getCachedData('/odds');
          const oddsMatches = Array.isArray(oddsCached?.matches) ? oddsCached.matches : [];
          if (oddsMatches.length > 0) {
            const filtered = oddsMatches.filter(m => {
              const ct = m.commence_time ? new Date(m.commence_time) : null;
              return ct && ct <= new Date();
            });
            const transformed = transformOddsToLiveMatches(filtered).filter(m => isLiveStatus(m.status, m.startTime));
            if (transformed.length > 0) {
              console.log('[LIVE BETTING] Instant odds fallback from cache (no live cache):', transformed.length, 'matches');
              setLiveMatches(transformed);
              setLastUpdate(new Date().toISOString());
              setLoading(false);
              enhancedCache.markInitialLoadComplete();
            } else {
              setLoading(enhancedCache.shouldShowSkeleton());
            }
          } else {
            setLoading(enhancedCache.shouldShowSkeleton());
          }
        }
      }
    } catch (e) {
      setLoading(enhancedCache.shouldShowSkeleton());
    }

    // Initial fetch with background revalidation (do not gate UI)
    fetchLiveMatches();
    
    // Setup WebSocket service
    const cleanupWs = setupWebSocketService();
    
    // Set up polling for live matches (every 30 seconds as fallback)
    const intervalId = setInterval(() => {
      console.log('[LIVE BETTING] Polling for updated live matches...');
      fetchLiveMatches();
    }, 30000);
    
    return () => {
      clearInterval(intervalId);
      if (typeof cleanupWs === 'function') cleanupWs();
    };
  }, [user]);

  // Prefetch additional markets for the first few visible live matches
  useEffect(() => {
    try {
      const topLive = (liveMatches || []).slice(0, 5);
      topLive.forEach(m => {
        const id = m._id || m.id;
        if (id) {
          apiService.getMatchMarkets(id).catch(err => { void err; });
        }
      });
    } catch (e) { void e; }
  }, [liveMatches]);

  if (loading && liveMatches.length === 0) {
    return (
      <div className="sport-page">
        <div className="sport-header">
          <h1 className="sport-title">Live Betting</h1>
          <p className="sport-subtitle">Bet on live matches with real-time odds</p>
        </div>

        <div className="matches-section">
          <div className="section-header">
            <h2 className="section-title">LIVE MATCHES</h2>
            <div className="live-indicator">
              <span className="live-dot"></span>
              <span>Fetching live data...</span>
            </div>
          </div>

          <div className="matches-skeleton-grid">
            <SkeletonLoader type="match-card" count={6} />
          </div>
        </div>
      </div>
    );
  }

  const groupedMatches = groupMatchesByLeague(
    liveMatches.filter(m => String(m.status || '').toLowerCase() === 'live')
  );

  return (
    <div className="sport-page">
      <div className="sport-header">
        <h1 className="sport-title">Live Betting</h1>
        <p className="sport-subtitle">Bet on live matches with real-time odds</p>
      </div>

      <div className="matches-section">
        <div className="section-header">
          <h2 className="section-title">LIVE MATCHES</h2>
          <div className="live-indicator">
            <span className="live-dot"></span>
            <span>{liveMatches.length} Live Now</span>
            {lastUpdate && (
              <span className="last-update">
                Last updated: {new Date(lastUpdate).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="error-message" style={{ 
            background: 'rgba(255, 68, 68, 0.1)', 
            border: '1px solid rgba(255, 68, 68, 0.3)', 
            borderRadius: '8px', 
            padding: '12px', 
            margin: '16px 0',
            color: '#ff6666'
          }}>
            {error}
          </div>
        )}

        {liveMatches.length > 0 ? (
          <div className="live-matches-container">
            {Object.entries(groupedMatches).map(([league, matches]) => {
              const commonOddsTypes = getCommonOddsTypes(matches);
              return (
                <div key={league} className="league-group">
                  {/* League Header with Odds Headers */}
                  <div className="league-header live-league-header">
                    <div className="league-title">
                      <span className="arrow">▲</span>
                      {(() => {
                        const first = matches && matches[0] ? matches[0] : {};
                        const sportKey = first.sport_key || '';
                        const computed = sportKey
                          ? computeFullLeagueTitle({ sportKeyOrName: sportKey, country: '', leagueName: '', fallbackSportTitle: '' })
                          : league;
                        return computed;
                      })()}
                    </div>
                    {/* Odds Headers - Aligned with respective odds */}
                    {commonOddsTypes.map(oddsType => (
                      <div key={oddsType} className="odds-header live-odds-header">
                        {oddsType}
                      </div>
                    ))}
                  </div>
                  
                  {/* Matches in this league */}
                  <div className="league-matches">
                    {matches.map((match) => {
                      const computedLeague = match.fullLeagueTitle || (
                        match.sport_key
                          ? computeFullLeagueTitle({
                              sportKeyOrName: match.sport_key,
                              country: '',
                              leagueName: '',
                              fallbackSportTitle: ''
                            })
                          : match.league
                      );
                      const computedSport = match.sport || (
                        match.sport_key ? String(match.sport_key).split('_')[0] : 'live'
                      );
                      return (
                        <MatchCard
                          key={match.id || match._id}
                          match={match}
                          sport={computedSport}
                          league={computedLeague}
                          subcategory={match.subcategory}
                          showLeagueHeader={false}
                          showOddsHeaders={false}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="no-live-matches">
            <div className="no-live-icon">🔴</div>
            <h3>No Live Matches</h3>
            <p>There are currently no live matches. Check back later for live betting opportunities.</p>
            <div className="live-refresh-info">
              <p>Live matches are automatically refreshed every 30 seconds.</p>
              <button 
                className="refresh-btn"
                onClick={fetchLiveMatches}
                style={{
                  background: '#ff4444',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  marginTop: '12px'
                }}
              >
                Refresh Now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveBetting;
