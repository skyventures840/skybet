import React, { useState, useEffect } from 'react';
import MatchCard from '../components/MatchCard';
import apiService from '../services/api';
import websocketService from '../services/websocketService';
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
          console.log('[LIVE BETTING] No live matches found, using sample data for demonstration');
          setLiveMatches(getSampleLiveMatches());
        } else {
          setLiveMatches(matches);
          setLastUpdate(new Date().toISOString());
        }
      } else {
        throw new Error(response.data.message || 'Failed to fetch live matches');
      }
      
    } catch (err) {
      console.error('[LIVE BETTING] Error fetching live matches:', err);
      setError('Failed to load live matches. Using sample data for demonstration.');
      
      // Fallback to sample data
      setLiveMatches(getSampleLiveMatches());
    } finally {
      setLoading(false);
    }
  };

  // Setup WebSocket connection and subscriptions
  const setupWebSocket = () => {
    if (!user?.token) {
      console.log('[LIVE BETTING] No user token, skipping WebSocket setup');
      return;
    }

    try {
      // Connect to WebSocket
      websocketService.connect(user.token);
      
      // Subscribe to live matches updates
      websocketService.subscribeToLiveMatches();
      
      // Listen for live matches updates
      websocketService.on('liveMatchesUpdate', (data) => {
        console.log('[LIVE BETTING] Received live matches update via WebSocket:', data);
        if (data.matches) {
          setLiveMatches(data.matches);
          setLastUpdate(data.timestamp);
        }
      });
      
      // Listen for odds changes
      websocketService.on('oddsChange', (data) => {
        console.log('[LIVE BETTING] Received odds change:', data);
        setLiveMatches(prevMatches => 
          prevMatches.map(match => 
            match.id === data.matchId 
              ? { ...match, odds: data.newOdds, lastUpdate: data.timestamp }
              : match
          )
        );
      });
      
      // Listen for match result updates
      websocketService.on('matchResultUpdate', (data) => {
        console.log('[LIVE BETTING] Received match result update:', data);
        setLiveMatches(prevMatches => 
          prevMatches.map(match => 
            match.id === data.matchId 
              ? { 
                  ...match, 
                  homeScore: data.result.homeScore,
                  awayScore: data.result.awayScore,
                  score: data.result.score,
                  lastUpdate: data.timestamp
                }
              : match
          )
        );
      });
      
      // Start heartbeat
      websocketService.startHeartbeat();
      
      console.log('[LIVE BETTING] WebSocket setup completed');
      
    } catch (error) {
      console.error('[LIVE BETTING] Error setting up WebSocket:', error);
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

  // Sample live matches for demonstration
  const getSampleLiveMatches = () => [
    {
      id: 1,
      league: 'Premier League',
      subcategory: 'Soccer',
      startTime: new Date(),
      homeTeam: 'Chelsea',
      awayTeam: 'Arsenal',
      homeTeamFlag: '🏳️',
      awayTeamFlag: '🏳️',
      odds: {
        '1': 1.65,
        'X': 4.20,
        '2': 4.85
      },
      additionalMarkets: 6,
      sport: 'Soccer',
      status: 'live',
      isLive: true,
      liveTime: 'LIVE 67\'',
      score: '2-1',
      homeScore: 2,
      awayScore: 1,
      lastUpdate: new Date().toISOString()
    },
    {
      id: 2,
      league: 'NBA',
      subcategory: 'Basketball',
      startTime: new Date(),
      homeTeam: 'Golden State Warriors',
      awayTeam: 'Miami Heat',
      homeTeamFlag: '🏳️',
      awayTeamFlag: '🏳️',
      odds: {
        '1': 1.45,
        '2': 2.75
      },
      additionalMarkets: 8,
      sport: 'Basketball',
      status: 'live',
      isLive: true,
      liveTime: 'LIVE Q3 8:45',
      score: '89-76',
      homeScore: 89,
      awayScore: 76,
      lastUpdate: new Date().toISOString()
    },
    {
      id: 3,
      league: 'Premier League',
      subcategory: 'Soccer',
      startTime: new Date(),
      homeTeam: 'Manchester United',
      awayTeam: 'Liverpool',
      homeTeamFlag: '🏳️',
      awayTeamFlag: '🏳️',
      odds: {
        '1': 2.10,
        'X': 3.40,
        '2': 3.20
      },
      additionalMarkets: 5,
      sport: 'Soccer',
      status: 'live',
      isLive: true,
      liveTime: 'LIVE 23\'',
      score: '0-0',
      homeScore: 0,
      awayScore: 0,
      lastUpdate: new Date().toISOString()
    }
  ];

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
      // Cleanup WebSocket
      websocketService.unsubscribeFromLiveMatches();
      websocketService.stopHeartbeat();
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
              <span>Loading...</span>
            </div>
          </div>
          
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading live matches...</p>
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
                        key={match.id}
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