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
    lostBets: 0
  });

  useEffect(() => {
    fetchBetHistory();
    fetchBetStats();
  }, []);

  // Listen for real-time bet updates and refresh lists
  useEffect(() => {
    const onBetUpdate = () => {
      fetchBetHistory();
      fetchBetStats();
    };
    window.addEventListener('bet:update', onBetUpdate);
    return () => window.removeEventListener('bet:update', onBetUpdate);
  }, []);

  // Add sample data for testing if no bets exist
  const addSampleBets = () => {
    const sampleBets = [
      {
        id: 'sample-1',
        market: 'parlay',
        selection: 'Chelsea vs Fulham: 1 (2.6); Leeds vs Burnley: 2 (4.0); Aston Villa vs Arsenal: Ov 2.5 (3.40)',
        stake: 59.88,
        odds: 273.70,
        potentialWin: 16389.16,
        status: 'pending',
        createdAt: new Date().toISOString(),
        matches: [
          {
            matchId: 'match-1',
            homeTeam: 'Chelsea',
            awayTeam: 'Fulham',
            selection: '1',
            odds: 2.6,
            status: 'won',
            outcome: '1',
            startTime: new Date().toISOString()
          },
          {
            matchId: 'match-2',
            homeTeam: 'Leeds',
            awayTeam: 'Burnley',
            selection: '2',
            odds: 4.0,
            status: 'won',
            outcome: '2',
            startTime: new Date().toISOString()
          },
          {
            matchId: 'match-3',
            homeTeam: 'Aston Villa',
            awayTeam: 'Arsenal',
            selection: 'Ov 2.5',
            odds: 3.40,
            status: 'pending',
            outcome: null,
            startTime: new Date().toISOString()
          }
        ]
      }
    ];
    
    setBetHistory(prevBets => [...prevBets, ...sampleBets]);
  };

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

  const fetchBetStats = async () => {
    try {
      console.log('Fetching bet stats summary...');
      const response = await apiService.getBetStatsSummary();
      console.log('Bet stats API response:', response);
      if (response && response.data) {
        const summary = response.data;
        const activeBets = summary.pendingBets ?? 0;
        const totalBets = summary.totalBets ?? 0;
        const winRate = summary.winRate != null ? parseFloat(summary.winRate) : 0;
        const wonBets = summary.wonBets ?? 0;
        const lostBets = summary.lostBets ?? 0;
        setStats({ activeBets, totalBets, winRate, wonBets, lostBets });
      } else {
        setStats({ activeBets: 0, totalBets: 0, winRate: 0, wonBets: 0, lostBets: 0 });
      }
    } catch (err) {
      console.error('Failed to fetch bet stats summary:', err);
      setStats({ activeBets: 0, totalBets: 0, winRate: 0, wonBets: 0, lostBets: 0 });
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
          <button onClick={addSampleBets} className="add-sample-btn">
            Add Sample Bet for Testing
          </button>
        </div>
        ) : (
          <div className="bet-history-container">
            <div className="bet-history-header">
              <h2>Bet History</h2>
              <div className="bet-history-stats">
                <span className="stat-item">Total: {stats.totalBets}</span>
                <span className="stat-item">Pending: {stats.activeBets}</span>
                <span className="stat-item">Won: {stats.wonBets}</span>
                <span className="stat-item">Lost: {stats.lostBets}</span>
              </div>
            </div>
            
            <div className="bet-history-list">
              {betHistory.map((bet) => {
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
                          homeTeam: matchName.split(' vs ')[0] || 'Team A',
                          awayTeam: matchName.split(' vs ')[1] || 'Team B',
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
                    homeTeam: bet.match?.homeTeam || 'Team A',
                    awayTeam: bet.match?.awayTeam || 'Team B',
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
                        onClick={() => toggleBetExpansion(bet.id)}
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

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="betslip-match-details">
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
    </div>
  );
};

export default Bets;