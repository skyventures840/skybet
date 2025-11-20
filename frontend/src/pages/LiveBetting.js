import React, { useState, useEffect } from 'react';
import SkeletonLoader from '../components/SkeletonLoader';
import MatchCard from '../components/MatchCard';
import apiService from '../services/api';
import io from 'socket.io-client';
import { useSelector } from 'react-redux';

const LiveBetting = () => {
  const [liveMatches, setLiveMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const { user } = useSelector(state => state.auth);

  // Fetch live matches from API
  const fetchLiveMatches = async () => {
    try {
      setLoading(true);
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

            const transformOddsToLiveMatches = (oddsData) => {
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
                  sport: (m.sport_key || '').split('_')[0] || 'live',
                  allMarkets: markets,
                  status: 'live',
                  isLive: true,
                  liveTime: `LIVE ${diffMins}'`,
                  score: null,
                  homeScore: null,
                  awayScore: null,
                  lastUpdate: new Date().toISOString(),
                  country: '',
                  fullLeagueTitle: undefined
                };
              });
            };

            const transformed = transformOddsToLiveMatches(oddsMatches);
            console.log(`[LIVE BETTING] Fallback produced ${transformed.length} live matches from odds feed`);
            setLiveMatches(transformed);
            setLastUpdate(new Date().toISOString());
          } catch (fallbackErr) {
            console.error('[LIVE BETTING] Fallback odds fetch failed:', fallbackErr);
            setLiveMatches([]);
          }
        } else {
          setLiveMatches(matches);
          setLastUpdate(new Date().toISOString());
        }
      } else {
        throw new Error(response.data.message || 'Failed to fetch live matches');
      }
      
    } catch (err) {
      console.error('[LIVE BETTING] Error fetching live matches:', err);
      setError('Failed to load live matches. Please try again later.');
      setLiveMatches([]);
    } finally {
      setLoading(false);
    }
  };

  // Setup WebSocket connection and subscriptions
  const setupWebSocket = () => {
    const WS_URL = process.env.REACT_APP_WS_URL || null;
    if (!WS_URL) {
      console.warn('[LIVE BETTING] WS_URL not set; skipping Socket.IO');
      return;
    }

    try {
      const socket = io(WS_URL, { withCredentials: true });
      socket.on('connect', () => {
        console.log('[LIVE BETTING] Connected to Socket.IO');
        socket.emit('subscribe:live');
      });

      socket.on('matchUpdate', (updatedMatch) => {
        setLiveMatches(prev => {
          const idx = prev.findIndex(m => (m._id || m.id) === (updatedMatch._id || updatedMatch.id));
          if (idx === -1) return prev;
          const next = [...prev];
          next[idx] = { ...next[idx], ...updatedMatch };
          return next;
        });
        setLastUpdate(new Date().toISOString());
      });

      socket.on('oddsUpdate', (payload) => {
        const matchId = payload?.matchId || payload?._id || payload?.id;
        const odds = payload?.delta || payload?.odds || payload;
        setLiveMatches(prev => prev.map(m => {
          const id = m._id || m.id;
          if (id !== matchId) return m;
          return { ...m, odds: { ...(m.odds || {}), ...(odds || {}) } };
        }));
      });

      socket.on('newMatch', (newMatch) => {
        setLiveMatches(prev => {
          const id = newMatch._id || newMatch.id;
          if (!id) return prev;
          const exists = prev.some(m => (m._id || m.id) === id);
          return exists ? prev : [newMatch, ...prev];
        });
      });

      socket.on('matchDeleted', (matchId) => {
        setLiveMatches(prev => prev.filter(m => (m._id || m.id) !== matchId));
      });

      socket.on('disconnect', () => {
        console.log('[LIVE BETTING] Disconnected from Socket.IO');
      });

      // Cleanup
      return () => socket.disconnect();
    } catch (error) {
      console.error('[LIVE BETTING] Error setting up Socket.IO:', error);
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
    // Initial fetch
    fetchLiveMatches();
    
    // Setup WebSocket
    setupWebSocket();
    
    // Set up polling for live matches (every 30 seconds as fallback)
    const intervalId = setInterval(() => {
      console.log('[LIVE BETTING] Polling for updated live matches...');
      fetchLiveMatches();
    }, 30000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [user]);

  if (loading) {
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

  const groupedMatches = groupMatchesByLeague(liveMatches);

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
                        const sport = first.sport || first.sport_title;
                        const country = first.subcategory || first.country;
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
                    {matches.map((match) => (
                      <MatchCard
                        key={match.id || match._id}
                        match={match}
                        sport={match.sport}
                        league={match.league}
                        subcategory={match.subcategory}
                        showLeagueHeader={false} // Don't show individual league headers
                        showOddsHeaders={false} // Don't show individual odds headers
                      />
                    ))}
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