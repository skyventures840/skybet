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
    winRate: 0
  });

  useEffect(() => {
    fetchBetHistory();
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
        
        // Calculate stats
        const activeBets = bets.filter(bet => bet.status === 'pending').length;
        const totalBets = bets.length;
        const wonBets = bets.filter(bet => bet.status === 'won').length;
        const winRate = totalBets > 0 ? Math.round((wonBets / totalBets) * 100) : 0;
        
        setStats({
          activeBets,
          totalBets,
          winRate
        });
      } else {
        console.log('No response data received');
        setBetHistory([]);
        setStats({ activeBets: 0, totalBets: 0, winRate: 0 });
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
      setStats({ activeBets: 0, totalBets: 0, winRate: 0 });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'won':
        return '#4caf50';
      case 'lost':
        return '#f44336';
      case 'pending':
        return '#ff9800';
      case 'void':
        return '#9e9e9e';
      default:
        return '#666';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'won':
        return <span className="status-icon won">✓</span>;
      case 'lost':
        return <span className="status-icon lost">✗</span>;
      case 'pending':
        return null; // No icon for pending
      default:
        return null;
    }
  };

  const toggleBetExpansion = (betId) => {
    const newExpandedBets = new Set(expandedBets);
    if (newExpandedBets.has(betId)) {
      newExpandedBets.delete(betId);
    } else {
      newExpandedBets.add(betId);
    }
    setExpandedBets(newExpandedBets);
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
                <span className="stat-item">Total: {betHistory.length}</span>
                <span className="stat-item">Pending: {betHistory.filter(bet => bet.status === 'pending').length}</span>
                <span className="stat-item">Won: {betHistory.filter(bet => bet.status === 'won').length}</span>
                <span className="stat-item">Lost: {betHistory.filter(bet => bet.status === 'lost').length}</span>
              </div>
            </div>
            
            <div className="bet-history-list">
              {betHistory.map((bet) => {
                const isExpanded = expandedBets.has(bet.id);
                const isMultibet = bet.market === 'parlay' && bet.matches && bet.matches.length > 1;
                
                // For testing - create sample matches if none exist
                let displayMatches = bet.matches || [];
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
                
                return (
                  <div key={bet.id} className={`bet-card ${bet.status} ${isExpanded ? 'expanded' : ''}`}>
                    {/* Bet Summary - Always Visible */}
                    <div 
                      className="bet-summary"
                      onClick={() => toggleBetExpansion(bet.id)}
                    >
                      <div className="bet-info-left">
                        <div className="bet-id">#{bet.id?.slice(-6) || 'N/A'}</div>
                        <div className="bet-date">{formatDate(bet.createdAt)}</div>
                        {bet.bonus && <span className="bonus-tag">bonus</span>}
                      </div>
                      
                      <div className="bet-info-right">
                        <div className="bet-amount">${formatAmount(bet.stake)}</div>
                        <div className="bet-status-badge" style={{ color: getStatusColor(bet.status) }}>
                          {bet.status.toUpperCase()}
                        </div>
                      </div>
                      
                      <div className="bet-expand-icon">
                        <span className={`expand-arrow ${isExpanded ? 'expanded' : ''}`}>▼</span>
                      </div>
                    </div>
                    
                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="bet-details">
                        <div className="bet-overview">
                          <div className="bet-summary-info">
                            <div className="bet-stake">
                              <span className="label">Amount:</span>
                              <span className="value">${formatAmount(bet.stake)}</span>
                            </div>
                            <div className="bet-payout">
                              <span className="label">Possible Payout:</span>
                              <span className="value">${formatAmount(bet.potentialWin)}</span>
                            </div>
                            <div className="bet-odds">
                              <span className="label">Combined Odds:</span>
                              <span className="value">{formatOdds(bet.odds)}</span>
                            </div>
                            <div className="bet-results-summary">
                              <span className="label">Won/Lost/Total:</span>
                              <span className="value">
                                {displayMatches.length > 0 ? 
                                  `${displayMatches.filter(m => m.status === 'won').length}/${displayMatches.filter(m => m.status === 'lost').length}/${displayMatches.length}` :
                                  '1/0/1'
                                }
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Individual Match Details Table */}
                        <div className="bet-matches-table">
                          <div className="matches-table-header">
                            <div className="table-col-match">Match</div>
                            <div className="table-col-selection">Selection</div>
                            <div className="table-col-odds">Odds</div>
                            <div className="table-col-result">Result</div>
                          </div>
                          
                          <div className="matches-table-body">
                            {displayMatches.map((match, index) => (
                                <div key={index} className="match-table-row">
                                  <div className="table-col-match">
                                    <div className="match-teams">
                                      {match.homeTeam} vs {match.awayTeam}
                                    </div>
                                  </div>
                                  <div className="table-col-selection">
                                    <span className="selection-value">{match.selection}</span>
                                  </div>
                                  <div className="table-col-odds">
                                    <span className="odds-value">{formatOdds(match.odds)}</span>
                                  </div>
                                  <div className="table-col-result">
                                    <div className="result-container">
                                      {getStatusIcon(match.status)}
                                      <span className="result-value">{match.outcome || match.status}</span>
                                    </div>
                                  </div>
                                </div>
                              ))
                            }
                          </div>
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
    </div>
  );
};

export default Bets;