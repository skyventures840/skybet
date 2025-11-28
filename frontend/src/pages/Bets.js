import React, { useState, useEffect, useRef } from 'react';
import SkeletonLoader from '../components/SkeletonLoader';
import apiService from '../services/api';
import websocketService from '../services/websocketService';
import enhancedCache from '../services/enhancedCache';

const Bets = () => {
  const [betHistory, setBetHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedBets] = useState(new Set());
  const [stats, setStats] = useState({
    activeBets: 0,
    totalBets: 0,
    winRate: 0,
    wonBets: 0,
    lostBets: 0,
    voidBets: 0,
    cancelledBets: 0
  });
  const [filters, setFilters] = useState({
    status: 'all', // all, pending, won, lost, void
    type: 'all'    // all, single, parlay
  });
  const [selectedBet, setSelectedBet] = useState(null);
  const [showFullPageBet, setShowFullPageBet] = useState(false);
  const subscribedMatchIdsRef = useRef(new Set());

  useEffect(() => {
    let hasInstantData = false;

    // 1) Try sessionStorage for instant display
    try {
      const sessionBets = sessionStorage.getItem('bets_history_data');
      const sessionStats = sessionStorage.getItem('bets_stats_data');
      if (sessionBets || sessionStats) {
        const parsedBets = sessionBets ? JSON.parse(sessionBets) : null;
        const parsedStats = sessionStats ? JSON.parse(sessionStats) : null;
        if (parsedBets && Array.isArray(parsedBets)) {
          setBetHistory(parsedBets);
        }
        if (parsedStats && typeof parsedStats === 'object') {
          setStats(prev => ({ ...prev, ...parsedStats }));
        }
        setLoading(false);
        hasInstantData = true;
      }
    } catch (e) {
      // ignore session errors
    }

    // 2) Fallback to enhanced cache (ETag-backed) if no session data
    if (!hasInstantData) {
      const betsEntry = enhancedCache.getEntry('/bets/my-bets');
      const statsEntry = enhancedCache.getEntry('/bets/stats/summary');
      if ((betsEntry && betsEntry.data) || (statsEntry && statsEntry.data)) {
        if (betsEntry && betsEntry.data) {
          const bets = betsEntry.data.bets || betsEntry.data || [];
          setBetHistory(Array.isArray(bets) ? bets : []);
        }
        if (statsEntry && statsEntry.data) {
          const summary = statsEntry.data;
          const statsFromCache = {
            activeBets: summary.activeBets ?? summary.pendingBets ?? 0,
            totalBets: summary.totalBets ?? 0,
            winRate: summary.winRate != null ? parseFloat(summary.winRate) : 0,
            wonBets: summary.wonBets ?? 0,
            lostBets: summary.lostBets ?? 0,
            voidBets: summary.voidBets ?? 0,
            cancelledBets: summary.cancelledBets ?? 0,
            totalStaked: summary.totalStaked ?? 0,
            totalWon: summary.totalWon ?? 0,
            profit: summary.profit ?? 0
          };
          setStats(prev => ({ ...prev, ...statsFromCache }));
        }
        setLoading(false);
        hasInstantData = true;
      }
    }

    // 3) Fetch in background if we had instant data; otherwise show loading during fetch
    const fetchAll = async () => {
      if (hasInstantData) {
        await fetchBetHistory(false);
        await fetchBetStats();
      } else {
        await fetchBetHistory(true);
        await fetchBetStats();
      }
    };
    fetchAll();

    // 4) Poll lightly to keep cache warm without relying solely on WS
    const intervalId = setInterval(() => {
      fetchBetHistory(false);
      fetchBetStats();
    }, 180000); // every 3 minutes

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (betHistory.length > 0) {
      fetchBetStats();
      // Also update local stats for immediate accuracy
      const localStats = calculateLocalStats(betHistory);
      setStats(prevStats => ({
        ...prevStats,
        ...localStats
      }));
    }
  }, [betHistory]);

  // Connect to authenticated WebSocket and stream live FT score updates
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      websocketService.connect(token);
      websocketService.startHeartbeat();
    }

    const onMatchUpdate = (payload) => {
      const { matchId, result } = payload || {};
      if (!matchId) return;

      // Update betHistory matches with incoming FT scores
      setBetHistory(prev => prev.map(bet => {
        const updatedMatches = (bet.matches || []).map(m => {
          const idStr = m.matchId ? String(m.matchId) : null;
          if (idStr && idStr === String(matchId)) {
            const updated = {
              ...m,
              result: {
                ...(m.result || {}),
                homeScore: result?.homeScore,
                awayScore: result?.awayScore
              }
            };
            const derivedOutcome = deriveOutcome(updated);
            const derivedStatus = deriveStatus(updated);
            return { ...updated, derivedOutcome, derivedStatus };
          }
          return m;
        });
        return { ...bet, matches: updatedMatches };
      }));

      // Also update selectedBet if full-page view is open
      setSelectedBet(prev => {
        if (!prev) return prev;
        const updatedMatches = (prev.matches || []).map(m => {
          const idStr = m.matchId ? String(m.matchId) : null;
          if (idStr && idStr === String(matchId)) {
            const updated = {
              ...m,
              result: {
                ...(m.result || {}),
                homeScore: result?.homeScore,
                awayScore: result?.awayScore
              }
            };
            const derivedOutcome = deriveOutcome(updated);
            const derivedStatus = deriveStatus(updated);
            return { ...updated, derivedOutcome, derivedStatus };
          }
          return m;
        });
        return { ...prev, matches: updatedMatches };
      });
    };

    websocketService.on('matchResultUpdate', onMatchUpdate);
    const onBetStatusUpdate = () => {
      fetchBetHistory(false);
      fetchBetStats();
    };
    websocketService.on('betStatusUpdate', onBetStatusUpdate);

    try {
      websocketService.subscribeToUserBets(undefined);
    } catch (e) {
      console.warn('subscribeToUserBets failed', e && e.message ? e.message : e);
    }

    return () => {
      websocketService.off('matchResultUpdate', onMatchUpdate);
      websocketService.off('betStatusUpdate', onBetStatusUpdate);
      websocketService.stopHeartbeat();
      websocketService.disconnect();
    };
  }, []);

  // Subscribe to match streams for expanded bets and full-page bet view
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    // Ensure connection is active
    const status = websocketService.getConnectionStatus?.();
    if (!status || !status.isConnected) {
      websocketService.connect(token);
    }

    const nextSubscribed = new Set();

    // Subscribe to matches in any expanded bet cards
    filteredBets.forEach(bet => {
      if (expandedBets.has(bet.id)) {
        (bet.matches || []).forEach(m => {
          if (m.matchId) nextSubscribed.add(String(m.matchId));
        });
      }
    });

    // Subscribe to matches visible in full-page bet view
    if (showFullPageBet && selectedBet) {
      (selectedBet.matches || []).forEach(m => {
        if (m.matchId) nextSubscribed.add(String(m.matchId));
      });
    }

    // Subscribe new IDs and unsubscribe removed ones
    const prevSubscribed = subscribedMatchIdsRef.current;
    nextSubscribed.forEach(id => {
      if (!prevSubscribed.has(id)) {
        websocketService.subscribeToMatch(id);
      }
    });
    prevSubscribed.forEach(id => {
      if (!nextSubscribed.has(id)) {
        websocketService.unsubscribeFromMatch(id);
      }
    });

    subscribedMatchIdsRef.current = nextSubscribed;
  }, [expandedBets, selectedBet, showFullPageBet, betHistory, filters]);

  // Listen for real-time bet updates and refresh lists
  useEffect(() => {
    const onBetUpdate = () => {
      fetchBetHistory();
      fetchBetStats();
    };
    window.addEventListener('bet:update', onBetUpdate);
    return () => window.removeEventListener('bet:update', onBetUpdate);
  }, []);



  const fetchBetHistory = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      
      console.log('Fetching bet history...');
      const response = await apiService.getUserBets();
      console.log('Bet history API response:', response);
      
      if (response && response.data) {
        console.log('Bet history data:', response.data);
        const bets = response.data.bets || [];
        setBetHistory(bets);
        try {
          sessionStorage.setItem('bets_history_data', JSON.stringify(bets));
        } catch (e) { /* ignore */ }
      } else {
        console.log('No response data received');
        setBetHistory([]);
      }
    } catch (err) {
      console.error('Failed to fetch bet history:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      setError('Failed to load bet history.');
      setBetHistory([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Calculate local statistics from bet data
  const calculateLocalStats = (bets) => {
    const totalBets = bets.length;
    const activeBets = bets.filter(bet => (bet.status || 'pending').toLowerCase() === 'pending').length;
    const wonBets = bets.filter(bet => (bet.status || '').toLowerCase() === 'won').length;
    const lostBets = bets.filter(bet => (bet.status || '').toLowerCase() === 'lost').length;
    const voidBets = bets.filter(bet => (bet.status || '').toLowerCase() === 'void').length;
    const cancelledBets = bets.filter(bet => (bet.status || '').toLowerCase() === 'cancelled').length;
    
    const settledBets = wonBets + lostBets;
    const winRate = settledBets > 0 ? ((wonBets / settledBets) * 100).toFixed(1) : 0;
    
    return {
      totalBets,
      activeBets,
      wonBets,
      lostBets,
      voidBets,
      cancelledBets,
      winRate: parseFloat(winRate)
    };
  };

  const fetchBetStats = async () => {
    try {
      console.log('Fetching bet stats summary from database...');
      const response = await apiService.getBetStatsSummary();
      console.log('Bet stats API response:', response);
      
      if (response && response.data) {
        const summary = response.data;
        console.log('Processing bet stats summary:', summary);
        
        // Use backend data directly (it's more accurate than local calculation)
        const statsFromDB = {
          activeBets: summary.activeBets ?? summary.pendingBets ?? 0,
          totalBets: summary.totalBets ?? 0,
          winRate: summary.winRate != null ? parseFloat(summary.winRate) : 0,
          wonBets: summary.wonBets ?? 0,
          lostBets: summary.lostBets ?? 0,
          voidBets: summary.voidBets ?? 0,
          cancelledBets: summary.cancelledBets ?? 0,
          totalStaked: summary.totalStaked ?? 0,
          totalWon: summary.totalWon ?? 0,
          profit: summary.profit ?? 0
        };
        
        console.log('Setting stats from database:', statsFromDB);
        setStats(statsFromDB);
        try {
          sessionStorage.setItem('bets_stats_data', JSON.stringify(statsFromDB));
        } catch (e) { /* ignore */ }
      } else {
        console.warn('No data received from bet stats API, using local calculation');
        // Fallback to local calculation if API fails
        const localStats = calculateLocalStats(betHistory);
        setStats(localStats);
      }
    } catch (err) {
      console.error('Failed to fetch bet stats summary:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      
      // Fallback to local calculation if API fails
      console.log('Using local calculation as fallback');
      const localStats = calculateLocalStats(betHistory);
      setStats(localStats);
    }
  };

  // Preserve data on navigation hide to enable instant restoration
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        try {
          if (betHistory.length > 0) {
            sessionStorage.setItem('bets_history_data', JSON.stringify(betHistory));
          }
          if (stats && typeof stats === 'object') {
            sessionStorage.setItem('bets_stats_data', JSON.stringify(stats));
          }
        } catch (e) { /* ignore */ }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [betHistory, stats]);

  // Removed legacy status helpers (color/icon) since redesigned UI no longer uses them

  // Parse a pick to identify standardized market type and point
  const parsePick = (selection, point) => {
    const raw = selection ? String(selection).trim() : '';
    const low = raw.toLowerCase();
    let kind = null; // 'totals' | 'winner' | 'handicap' | 'btts'
    let type = null; // 'over' | 'under' | '1' | 'x' | '2' | 'yes' | 'no'
    let side = null; // 'home' | 'away' | 'draw'
    let refPoint = null;

    const parenMatch = raw.match(/\(([-+]?\d+(?:\.\d+)?)\)/);
    const numberMatch = raw.match(/(-?\d+(?:\.\d+)?)/);
    if (point != null && !Number.isNaN(Number(point))) {
      refPoint = Number(point);
    } else if (parenMatch) {
      refPoint = Number(parenMatch[1]);
    } else if (numberMatch && /over|under|ov|und|o\b|u\b/i.test(raw)) {
      refPoint = Number(numberMatch[1]);
    }

    // BTTS (Both Teams To Score)
    if (/btts|both\s*teams\s*to\s*score|gg|ng/i.test(low)) {
      kind = 'btts';
      if (/yes|gg/i.test(low)) type = 'yes';
      else if (/no|ng/i.test(low)) type = 'no';
    }

    // Totals (Over/Under) with flexible labels
    if (/\b(over|ov|o)\b/i.test(low)) { kind = 'totals'; type = 'over'; }
    if (/\b(under|und|u)\b/i.test(low)) { kind = 'totals'; type = 'under'; }

    // Winner (1X2) or named moneyline
    if (['1', 'x', '2'].includes(low)) { kind = 'winner'; type = low; }
    if (/^home\b|home\s*win/i.test(low)) { kind = 'winner'; type = '1'; side = 'home'; }
    if (/^away\b|away\s*win/i.test(low)) { kind = 'winner'; type = '2'; side = 'away'; }
    if (/^draw\b|tie\b/i.test(low)) { kind = 'winner'; type = 'x'; side = 'draw'; }

    // Handicap/Spread: detect side and signed point
    if (/handicap|spread|\b\d\s*\(|home\s*\(|away\s*\(/i.test(low)) {
      const sideHome = /(^|\b)(1|home)\b/i.test(low);
      const sideAway = /(^|\b)(2|away)\b/i.test(low);
      if (sideHome || sideAway) {
        kind = 'handicap';
        side = sideHome ? 'home' : 'away';
        if (refPoint == null && numberMatch) refPoint = Number(numberMatch[1]);
      }
    }

    return { kind, type, side, point: refPoint, raw };
  };

  // Derive outcome text from match result, aligned to the pick context
  const deriveOutcome = (match) => {
    const hs = match?.result?.homeScore;
    const as = match?.result?.awayScore;
    const hasScores = typeof hs === 'number' && typeof as === 'number';

    const pick = parsePick(match?.selection, match?.point);

    if (!hasScores) {
      // If no final scores, we cannot determine outcome yet
      return null;
    }

    // Totals (Over/Under)
    if (pick.kind === 'totals' && (pick.type === 'over' || pick.type === 'under')) {
      const total = hs + as;
      const p = pick.point != null ? pick.point : null;
      if (p == null) {
        // If no point is available, infer closest half-point around total
        const inferred = Math.floor(total) + 0.5;
        return total > inferred ? `Over(${inferred})` : `Under(${inferred})`;
      }
      return total > p ? `Over(${p})` : `Under(${p})`;
    }

    // Winner (1/X/2)
    if (pick.kind === 'winner' && (pick.type === '1' || pick.type === 'x' || pick.type === '2')) {
      if (hs > as) return 'Home Win';
      if (hs < as) return 'Away Win';
      return 'Draw';
    }

    // Handicap: adjusted scores
    if (pick.kind === 'handicap' && pick.point != null && (pick.side === 'home' || pick.side === 'away')) {
      const adjHome = hs + (pick.side === 'home' ? pick.point : 0);
      const adjAway = as + (pick.side === 'away' ? pick.point : 0);
      const labelPoint = pick.point >= 0 ? `+${pick.point}` : `${pick.point}`;
      if (adjHome > adjAway) return `Home(${labelPoint})`;
      if (adjHome < adjAway) return `Away(${labelPoint})`;
      return `Draw(${labelPoint})`;
    }

    // BTTS
    if (pick.kind === 'btts') {
      const bothScored = hs > 0 && as > 0;
      return bothScored ? 'Yes' : 'No';
    }

    // Fallback: general outcome from scores
    if (hs > as) return 'Home Win';
    if (hs < as) return 'Away Win';
    return 'Draw';
  };

  // Derive status from pick vs derived outcome
  const deriveStatus = (match) => {
    const hs = match?.result?.homeScore;
    const as = match?.result?.awayScore;
    const hasScores = typeof hs === 'number' && typeof as === 'number';
    if (!hasScores) return 'pending';

    const pick = parsePick(match?.selection, match?.point);
    const outcomeText = deriveOutcome(match);
    const lowOutcome = (outcomeText || '').toLowerCase().replace(/\s+/g, '');

    // Compare against pick
    if (pick.kind === 'totals' && (pick.type === 'over' || pick.type === 'under')) {
      const p = pick.point != null ? pick.point : null;
      const target = p != null ? `${pick.type}(${p})` : pick.type;
      const lowTarget = target.toLowerCase().replace(/\s+/g, '');
      return lowOutcome === lowTarget ? 'won' : 'lost';
    }
    if (pick.kind === 'winner' && pick.type === '1') {
      return lowOutcome === 'homewin' ? 'won' : 'lost';
    }
    if (pick.kind === 'winner' && pick.type === '2') {
      return lowOutcome === 'awaywin' ? 'won' : 'lost';
    }
    if (pick.kind === 'winner' && pick.type === 'x') {
      return lowOutcome === 'draw' ? 'won' : 'lost';
    }

    if (pick.kind === 'handicap' && pick.point != null && (pick.side === 'home' || pick.side === 'away')) {
      const labelPoint = pick.point >= 0 ? `+${pick.point}` : `${pick.point}`;
      const target = `${pick.side === 'home' ? 'home' : 'away'}(${labelPoint})`;
      const lowTarget = target.toLowerCase().replace(/\s+/g, '');
      return lowOutcome === lowTarget ? 'won' : 'lost';
    }

    if (pick.kind === 'btts' && (pick.type === 'yes' || pick.type === 'no')) {
      const lowTarget = (pick.type).toLowerCase();
      return lowOutcome === lowTarget ? 'won' : 'lost';
    }

    // Unknown pick type: conservatively compare generic outcome to selection text
    const lowPick = (pick.raw || '').toLowerCase().replace(/\s+/g, '');
    return lowOutcome && lowPick && lowOutcome.includes(lowPick) ? 'won' : 'lost';
  };

  

  // Full-page bet view functions
  const openFullPageBet = (bet) => {
    setSelectedBet(bet);
    setShowFullPageBet(true);
  };

  const closeFullPageBet = () => {
    setSelectedBet(null);
    setShowFullPageBet(false);
  };

  const formatOdds = (odds) => {
    if (typeof odds === 'number') {
      return odds.toFixed(2);
    } else if (odds && typeof odds.selected === 'number') {
      return odds.selected.toFixed(2);
    } else if (odds && typeof odds === 'string') {
      return parseFloat(odds).toFixed(2);
    }
    return '0.00';
  };

  const formatAmount = (amount) => {
    if (typeof amount === 'number') {
      return amount.toFixed(2);
    } else if (amount && typeof amount === 'string') {
      return parseFloat(amount).toFixed(2);
    }
    return '0.00';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filter functions
  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const filteredBets = React.useMemo(() => {
    return betHistory.filter(bet => {
      // Status filter
      if (filters.status !== 'all') {
        const betStatus = (bet.status || 'pending').toLowerCase();
        if (filters.status !== betStatus) {
          return false;
        }
      }

      // Type filter
      if (filters.type !== 'all') {
        const isParlay = bet.market === 'parlay' && bet.matches && bet.matches.length > 1;
        if (filters.type === 'parlay' && !isParlay) {
          return false;
        }
        if (filters.type === 'single' && isParlay) {
          return false;
        }
      }

      return true;
    });
  }, [betHistory, filters]);

  // Function to expand multibets into individual match rows

  return (
    <div className="bets-page">
      <div className="bets-header">
        <h1>My Bets</h1>
        <div className="bets-stats">
          <div className="stat-card">
            <span className="stat-label">Active Bets</span>
            <span className="stat-value">{stats.activeBets}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Total Bets</span>
            <span className="stat-value">{stats.totalBets}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Win Rate</span>
            <span className="stat-value">{stats.winRate}%</span>
          </div>
        </div>
      </div>

      <div className="bets-content">
        {(loading && betHistory.length === 0) ? (
          <div style={{ padding: '12px 0' }}>
            <SkeletonLoader type="generic" count={5} />
          </div>
        ) : error ? (
          <div className="error-container">
            <p className="error-message">{error}</p>
            <button onClick={fetchBetHistory} className="retry-btn">
              Retry
            </button>
          </div>
        ) : betHistory.length === 0 ? (
        <div className="no-bets">
          <div className="no-bets-icon">🎯</div>
          <h3>No bets placed yet</h3>
          <p>Start betting on your favorite sports to see your bet history here.</p>
        </div>
        ) : (
          <div className="bet-history-container">
            <div className="bet-history-header">
              <div className="bet-history-title-section">
                <h2>Bet History</h2>
                <div className="bet-history-stats">
                  <span className="stat-item">Total: {stats.totalBets}</span>
                  <span className="stat-item">Pending: {stats.activeBets}</span>
                  <span className="stat-item">Won: {stats.wonBets}</span>
                  <span className="stat-item">Lost: {stats.lostBets}</span>
                </div>
              </div>
              
              <div className="bet-filters">
                <div className="filter-group">
                  <label>Status:</label>
                  <select 
                    value={filters.status} 
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="filter-select"
                  >
                    <option value="all">All</option>
                    <option value="pending">Pending</option>
                    <option value="won">Won</option>
                    <option value="lost">Lost</option>
                    <option value="void">Void</option>
                  </select>
                </div>
                
                <div className="filter-group">
                  <label>Type:</label>
                  <select 
                    value={filters.type} 
                    onChange={(e) => handleFilterChange('type', e.target.value)}
                    className="filter-select"
                  >
                    <option value="all">All</option>
                    <option value="single">Single</option>
                    <option value="parlay">Multibet</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="bet-history-list">
              {filteredBets.map((bet) => {
                const isExpanded = expandedBets.has(bet.id);
                const isMultibet = bet.market === 'parlay' && bet.matches && bet.matches.length > 1;
                
                // For testing - create sample matches if none exist
                let displayMatches = bet.matches || [];
                // Normalize match status casing and shape for consistent rendering
                
                if (isMultibet && displayMatches.length === 0) {
                  // Parse matches from selection string for legacy bets
                  if (bet.selection && bet.selection.includes(';')) {
                    const matchStrings = bet.selection.split(';');
                    displayMatches = matchStrings.map((matchStr, index) => {
                      const parts = matchStr.split(':');
                      if (parts.length >= 2) {
                        const matchName = parts[0].trim();
                        const selectionPart = parts[1].trim();
                        const selectionMatch = selectionPart.match(/(.+?)\s*\(([0-9.]+)\)/);
                        
                        return {
                          matchId: `legacy-${index}`,
                          homeTeam: matchName.split(' vs ')[0] || 'Unknown',
                          awayTeam: matchName.split(' vs ')[1] || 'Unknown',
                          selection: selectionMatch ? selectionMatch[1].trim() : '1',
                          odds: selectionMatch ? parseFloat(selectionMatch[2]) : 1.5,
                          status: index === 0 ? 'won' : index === 1 ? 'won' : 'pending',
                          outcome: index === 0 ? '1' : index === 1 ? '2' : null,
                          startTime: new Date()
                        };
                      }
                      return null;
                    }).filter(Boolean);
                  }
                }
                
                // For single bets, create a single match entry
                if (!isMultibet && displayMatches.length === 0) {
                  displayMatches = [{
                    matchId: bet.matchId,
                    homeTeam: bet.match?.homeTeam || 'Unknown',
                    awayTeam: bet.match?.awayTeam || 'Unknown',
                    selection: bet.selection,
                    odds: bet.odds?.selected || bet.odds,
                    status: bet.status,
                    outcome: bet.result?.outcome || bet.status,
                    startTime: bet.createdAt
                  }];
                }
                
                // Compute derived outcome and status per match
                displayMatches = displayMatches.map(m => {
                  const derivedOutcome = deriveOutcome(m);
                  const derivedStatus = deriveStatus(m);
                  return {
                    ...m,
                    derivedOutcome,
                    derivedStatus
                  };
                });

                

                return (
                  <div key={bet.id} className={`bet-card ${bet.status} ${isExpanded ? 'expanded' : 'collapsed'}`}>
                    {/* Collapsed Summary (hidden when expanded) */}
                    {!isExpanded && (
                      <div 
                        className="bet-summary-collapsed"
                        onClick={() => openFullPageBet(bet)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="bet-summary-info">
                          <div className="bet-summary-title">#{bet.id?.slice(-6) || 'N/A'} • {formatDate(bet.createdAt)}</div>
                        </div>
                        <div className="bet-summary-amounts">
                          <span className="bet-summary-payout">${formatAmount(bet.potentialWin)}</span>
                          <span className={`bet-status status-${(bet.status || 'pending').toLowerCase()}`}>
                            {(() => {
                              const s = (bet.status || 'pending').toLowerCase();
                              return s === 'won' ? 'Won' : s === 'lost' ? 'Lost' : s === 'void' ? 'Void' : 'Pending';
                            })()}
                          </span>
                        </div>
                      </div>
                    )}

                    
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Full-page bet view */}
      {showFullPageBet && selectedBet && (
        <div className="full-page-bet-overlay">
          <div className="full-page-bet-container">
            <div className="full-page-bet-header">
              <h2>Bet Details - #{selectedBet.id?.slice(-6) || 'N/A'}</h2>
              <button 
                className="close-full-page-btn"
                onClick={closeFullPageBet}
                title="Close full page view"
              >
                ✕
              </button>
            </div>
            
            <div className="full-page-bet-content">
              {(() => {
                const bet = selectedBet;
                const isMultibet = bet.market === 'parlay' && bet.matches && bet.matches.length > 1;
                
                // Reuse the same logic for displaying matches
                let displayMatches = bet.matches || [];
                const normalizeStatus = (s) => {
                  if (!s) return 'pending';
                  const lower = String(s).toLowerCase();
                  if (lower === 'win') return 'won';
                  if (lower === 'loss') return 'lost';
                  return lower;
                };
                
                if (isMultibet && displayMatches.length === 0) {
                  if (bet.selection && bet.selection.includes(';')) {
                    const matchStrings = bet.selection.split(';');
                    displayMatches = matchStrings.map((matchStr, index) => {
                      const parts = matchStr.split(':');
                      if (parts.length >= 2) {
                        const matchName = parts[0].trim();
                        const selectionPart = parts[1].trim();
                        const selectionMatch = selectionPart.match(/(.+?)\s*\(([0-9.]+)\)/);
                        
                        return {
                          matchId: `legacy-${index}`,
                          homeTeam: matchName.split(' vs ')[0] || 'Unknown',
                          awayTeam: matchName.split(' vs ')[1] || 'Unknown',
                          selection: selectionMatch ? selectionMatch[1].trim() : '1',
                          odds: selectionMatch ? parseFloat(selectionMatch[2]) : 1.5,
                          status: index === 0 ? 'won' : index === 1 ? 'won' : 'pending',
                          outcome: index === 0 ? '1' : index === 1 ? '2' : null,
                          startTime: new Date()
                        };
                      }
                      return null;
                    }).filter(Boolean);
                  }
                }
                
                if (!isMultibet && displayMatches.length === 0) {
                  displayMatches = [{
                    matchId: bet.matchId,
                    homeTeam: bet.match?.homeTeam || 'Unknown',
                    awayTeam: bet.match?.awayTeam || 'Unknown',
                    selection: bet.selection,
                    odds: bet.odds?.selected || bet.odds,
                    status: bet.status,
                    outcome: bet.result?.outcome || bet.status,
                    startTime: bet.createdAt
                  }];
                }
                
                displayMatches = displayMatches.map(m => {
                  const derivedOutcome = deriveOutcome(m);
                  const derivedStatus = deriveStatus(m);
                  return {
                    ...m,
                    derivedOutcome,
                    derivedStatus
                  };
                });

                const wonCount = displayMatches.filter(m => (m.derivedStatus) === 'won').length;
                const lostCount = displayMatches.filter(m => (m.derivedStatus) === 'lost').length;
                const totalCount = displayMatches.length || 1;

                const getFtResult = (match) => {
                  if (match.result && (match.result.homeScore != null || match.result.awayScore != null)) {
                    const hs = match.result.homeScore ?? '-';
                    const as = match.result.awayScore ?? '-';
                    return `${hs}-${as}`;
                  }
                  if (match.finalScore) return match.finalScore;
                  if (match.outcome && ['1','X','2'].includes(String(match.outcome))) return match.outcome;
                  return normalizeStatus(match.status) === 'pending' ? '—' : (match.outcome || match.status || '—');
                };

                return (
                  <div className="full-page-bet-details">
                    {/* Bet Summary */}
                    <div className="full-page-bet-summary">
                      <div className="summary-cards">
                        <div className="summary-card stat">
                          <div className="summary-item">
                            <span className="label">Amount</span>
                            <span className="value">${formatAmount(bet.stake)}
                              <span className="info-icon" title="Stake amount">
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                  <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
                                  <path d="M12 17v-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                  <circle cx="12" cy="8" r="1.5" fill="currentColor" />
                                </svg>
                              </span>
                            </span>
                          </div>
                        </div>
                        <div className="summary-card stat">
                          <div className="summary-item">
                            <span className="label">Possible Payout</span>
                            <span className="value">${formatAmount(bet.potentialWin)}
                              <span className="info-icon" title="Max payout based on odds">
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                  <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
                                  <path d="M12 17v-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                  <circle cx="12" cy="8" r="1.5" fill="currentColor" />
                                </svg>
                              </span>
                            </span>
                          </div>
                        </div>
                        <div className="summary-card stat">
                          <div className="summary-item">
                            <span className="label">Won/Lost/Total</span>
                            <span className="value">{wonCount}/{lostCount}/{totalCount}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Match Details - Card layout */}
                    <div className="full-page-matches">
                      <h3>Match Details</h3>
                      <div className="matches-card-list">
                        {displayMatches.map((match, index) => {
                          const ft = getFtResult(match);
                          const pick = parsePick(match?.selection, match?.point);
                          const typeLabel = (() => {
                            if (!pick || !pick.kind) return 'Type';
                            if (pick.kind === 'winner') return '1×2';
                            if (pick.kind === 'totals') return 'Over/Under';
                            if (pick.kind === 'handicap') return 'Handicap';
                            return 'Type';
                          })();

                          return (
                            <div className="match-card-row" key={index}>
                              <div className="match-row-header">
                                <span className="team home-team">{match.homeTeam}</span>
                                <span className="vs-separator">vs</span>
                                <span className="team away-team">{match.awayTeam}</span>
                                {match.derivedStatus === 'won' ? (
                                  <span className="status-icon won" aria-label="Won">
                                    <svg viewBox="0 0 24 24" aria-hidden="true">
                                      <path d="M20 6L9 17L4 12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  </span>
                                ) : match.derivedStatus === 'lost' ? (
                                  <span className="status-icon lost" aria-label="Lost">
                                    <svg viewBox="0 0 24 24" aria-hidden="true">
                                      <path d="M6 6L18 18M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                                    </svg>
                                  </span>
                                ) : match.derivedStatus === 'void' ? (
                                  <span className="status-icon void" aria-label="Void">–</span>
                                ) : (
                                  <span className="status-icon pending" aria-label="Pending">•</span>
                                )}
                              </div>
                              <div className="match-row-body">
                                <div className="body-item">
                                  <span className="label">Type</span>
                                  <span className="value">{typeLabel}</span>
                                </div>
                                <div className="body-item">
                                  <span className="label">FT Results</span>
                                  <span className="value">{ft}</span>
                                </div>
                                <div className="body-item">
                                  <span className="label">Pick</span>
                                  <span className="value">{match.selection}{match.odds ? ` (${formatOdds(match.odds)})` : ''}</span>
                                </div>
                                <div className="body-item">
                                  <span className="label">Outcome</span>
                                  <span className="value">{match.derivedOutcome || '—'}</span>
                                </div>
                                {/* Status text removed per request; icon shown in header */}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Bets;
