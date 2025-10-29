import React, { useState, useEffect } from 'react';
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
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading bet history...</p>
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
                
                // Normalize statuses for counting
                displayMatches = displayMatches.map(m => ({
                  ...m,
                  status: normalizeStatus(m.status),
                  outcome: m.outcome || m.result?.finalOutcome || null
                }));

                const wonCount = displayMatches.filter(m => normalizeStatus(m.status) === 'won').length;
                const lostCount = displayMatches.filter(m => normalizeStatus(m.status) === 'lost').length;
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

                        {/* Match table redesigned to mirror attachment */}
                        <table className="betslip-match-table">
                          <thead>
                            <tr>
                              <th>Match</th>
                              <th>Pick</th>
                              <th>FT Results</th>
                              <th>Outcome</th>
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
                                <td className={`result ${normalizeStatus(match.status) === 'lost' ? 'lost' : ''}`}>
                                  {normalizeStatus(match.status) === 'won' ? 'Won' : normalizeStatus(match.status) === 'lost' ? 'Lost' : normalizeStatus(match.status) === 'void' ? 'Void' : 'Pending'}
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
                
                displayMatches = displayMatches.map(m => ({
                  ...m,
                  status: normalizeStatus(m.status),
                  outcome: m.outcome || m.result?.finalOutcome || null
                }));

                const wonCount = displayMatches.filter(m => normalizeStatus(m.status) === 'won').length;
                const lostCount = displayMatches.filter(m => normalizeStatus(m.status) === 'lost').length;
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
                              <td className={`result ${normalizeStatus(match.status) === 'lost' ? 'lost' : ''}`}>
                                {normalizeStatus(match.status) === 'won' ? 'Won' : normalizeStatus(match.status) === 'lost' ? 'Lost' : normalizeStatus(match.status) === 'void' ? 'Void' : 'Pending'}
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