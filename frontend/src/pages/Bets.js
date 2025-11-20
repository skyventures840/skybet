import React, { useState, useEffect } from 'react';
import SkeletonLoader from '../components/SkeletonLoader';
import apiService from '../services/api';

const Bets = () => {
  const [betHistory, setBetHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedBets, setExpandedBets] = useState(new Set());
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

  useEffect(() => {
    fetchBetHistory();
    fetchBetStats();
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

  // Listen for real-time bet updates and refresh lists
  useEffect(() => {
    const onBetUpdate = () => {
      fetchBetHistory();
      fetchBetStats();
    };
    window.addEventListener('bet:update', onBetUpdate);
    return () => window.removeEventListener('bet:update', onBetUpdate);
  }, []);



  const fetchBetHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching bet history...');
      const response = await apiService.getUserBets();
      console.log('Bet history API response:', response);
      
      if (response && response.data) {
        console.log('Bet history data:', response.data);
        const bets = response.data.bets || [];
        setBetHistory(bets);
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
      setLoading(false);
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

  const toggleBetExpansion = (betId) => {
    // Enforce single-open accordion behavior
    if (expandedBets.has(betId)) {
      // Collapse if the same bet is clicked
      setExpandedBets(new Set());
    } else {
      // Open only the clicked bet, close others
      setExpandedBets(new Set([betId]));
    }
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

  const getFilteredBets = () => {
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
  };

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
        {loading ? (
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
              {getFilteredBets().map((bet) => {
                const isExpanded = expandedBets.has(bet.id);
                const isMultibet = bet.market === 'parlay' && bet.matches && bet.matches.length > 1;
                
                // For testing - create sample matches if none exist
                let displayMatches = bet.matches || [];
                // Normalize match status casing and shape for consistent rendering
                const normalizeStatus = (s) => {
                  if (!s) return 'pending';
                  const lower = String(s).toLowerCase();
                  if (lower === 'win') return 'won';
                  if (lower === 'loss') return 'lost';
                  return lower; // pending, won, lost, void
                };
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

                const wonCount = displayMatches.filter(m => (m.derivedStatus) === 'won').length;
                const lostCount = displayMatches.filter(m => (m.derivedStatus) === 'lost').length;
                const totalCount = displayMatches.length || 1;

                // getMatchType removed since Type column is no longer used

                const getFtResult = (match) => {
                  // Prefer structured result scores if present
                  if (match.result && (match.result.homeScore != null || match.result.awayScore != null)) {
                    const hs = match.result.homeScore ?? '-';
                    const as = match.result.awayScore ?? '-';
                    return `${hs}-${as}`;
                  }
                  // Fallbacks
                  if (match.finalScore) return match.finalScore;
                  if (match.outcome && ['1','X','2'].includes(String(match.outcome))) return match.outcome;
                  return normalizeStatus(match.status) === 'pending' ? '—' : (match.outcome || match.status || '—');
                };

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
                          <button 
                            className="expand-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleBetExpansion(bet.id);
                            }}
                            title="Expand/Collapse bet details"
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div 
                        className="betslip-match-details"
                        onClick={() => openFullPageBet(bet)}
                        style={{ cursor: 'pointer' }}
                      >
                        {/* Header summary like the screenshot */}
                        <div className="betslip-header-expanded">
                          <div className="betslip-header-item">
                            <span className="betslip-header-label">Amount</span>
                            <span className="betslip-header-value">${formatAmount(bet.stake)}</span>
                          </div>
                          <div className="betslip-header-item">
                            <span className="betslip-header-label">Possible Payout</span>
                            <span className="betslip-header-value">${formatAmount(bet.potentialWin)}</span>
                          </div>
                          <div className="betslip-header-item">
                            <span className="betslip-header-label">Won/Lost/Total</span>
                            <span className="betslip-header-value won-lost">{wonCount}/{lostCount}/{totalCount}</span>
                          </div>
                          <button 
                            className="collapse-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleBetExpansion(bet.id);
                            }}
                            title="Collapse bet details"
                          >
                            ▲
                          </button>
                        </div>

                        {/* Match table with derived outcomes and status */}
                        <table className="betslip-match-table">
                          <thead>
                            <tr>
                              <th>Match</th>
                              <th>Pick</th>
                              <th>FT Results</th>
                              <th>Outcome</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {displayMatches.map((match, index) => (
                              <tr key={index}>
                                <td className="match-name">
                                  <div className="match-name-stack">
                                    <span className="home-team">{match.homeTeam}</span>
                                    <span className="vs">vs</span>
                                    <span className="away-team">{match.awayTeam}</span>
                                  </div>
                                </td>
                                <td className="selection">
                                  {match.homeTeam && match.awayTeam ? (
                                    <>
                                      {match.selection} ({formatOdds(match.odds)})
                                    </>
                                  ) : (match.selection)}
                                </td>
                                <td className="odds">{getFtResult(match)}</td>
                                <td className="derived-outcome">{match.derivedOutcome || '—'}</td>
                                <td>
                                  <span className={`bet-status status-${(match.derivedStatus || 'pending')}`}>
                                    {match.derivedStatus === 'won' ? 'Won' : match.derivedStatus === 'lost' ? 'Lost' : 'Pending'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
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
                      <div className="bet-summary-item">
                        <span className="label">Bet ID:</span>
                        <span className="value">#{bet.id?.slice(-6) || 'N/A'}</span>
                      </div>
                      <div className="bet-summary-item">
                        <span className="label">Date:</span>
                        <span className="value">{formatDate(bet.createdAt)}</span>
                      </div>
                      <div className="bet-summary-item">
                        <span className="label">Amount:</span>
                        <span className="value">${formatAmount(bet.stake)}</span>
                      </div>
                      <div className="bet-summary-item">
                        <span className="label">Possible Payout:</span>
                        <span className="value">${formatAmount(bet.potentialWin)}</span>
                      </div>
                      <div className="bet-summary-item">
                        <span className="label">Status:</span>
                        <span className={`value status-${(bet.status || 'pending').toLowerCase()}`}>
                          {(() => {
                            const s = (bet.status || 'pending').toLowerCase();
                            return s === 'won' ? 'Won' : s === 'lost' ? 'Lost' : s === 'void' ? 'Void' : 'Pending';
                          })()}
                        </span>
                      </div>
                      <div className="bet-summary-item">
                        <span className="label">Won/Lost/Total:</span>
                        <span className="value">{wonCount}/{lostCount}/{totalCount}</span>
                      </div>
                    </div>

                    {/* Match Details */}
                    <div className="full-page-matches">
                      <h3>Match Details</h3>
                      <table className="full-page-match-table">
                        <thead>
                          <tr>
                            <th>Match</th>
                            <th>Pick</th>
                            <th>FT Results</th>
                            <th>Outcome</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayMatches.map((match, index) => (
                            <tr key={index}>
                              <td className="match-name">
                                <div className="match-name-stack">
                                  <span className="home-team">{match.homeTeam}</span>
                                  <span className="vs">vs</span>
                                  <span className="away-team">{match.awayTeam}</span>
                                </div>
                              </td>
                              <td className="selection">
                                {match.homeTeam && match.awayTeam ? (
                                  <>
                                    {match.selection} ({formatOdds(match.odds)})
                                  </>
                                ) : (match.selection)}
                              </td>
                              <td className="odds">{getFtResult(match)}</td>
                              <td className="derived-outcome">{match.derivedOutcome || '—'}</td>
                              <td>
                                <span className={`bet-status status-${(match.derivedStatus || 'pending')}`}>
                                  {match.derivedStatus === 'won' ? 'Won' : match.derivedStatus === 'lost' ? 'Lost' : 'Pending'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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