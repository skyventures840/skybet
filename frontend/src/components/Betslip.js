import React, { useMemo, useCallback, memo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { removeBet, updateStake } from '../store/slices/activeBetSlice';
import apiService from '../services/api';
import WheelOfFortune from './WheelOfFortune';
import getMarketTitle, { normalizeMarketKey } from '../utils/marketTitles';

const Betslip = () => {
  const activeBets = useSelector(state => state.activeBets || []);
  const dispatch = useDispatch();
  const [isPlacingBet, setIsPlacingBet] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [successMessage, setSuccessMessage] = React.useState(null);
  const [activeTab, setActiveTab] = React.useState('Ordinary');
  const [expandedMatches, setExpandedMatches] = React.useState({});
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  // Toggle individual match expansion
  const toggleMatchExpansion = (index) => {
    setExpandedMatches(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Toggle all matches collapse/expand
  const toggleCollapseAll = () => {
    setIsCollapsed(!isCollapsed);
    if (!isCollapsed) {
      // Collapse all
      const collapsedState = {};
      activeBets.forEach((_, index) => {
        collapsedState[index] = false;
      });
      setExpandedMatches(collapsedState);
    } else {
      // Expand all
      const expandedState = {};
      activeBets.forEach((_, index) => {
        expandedState[index] = true;
      });
      setExpandedMatches(expandedState);
    }
  };

  const removeBetHandler = useCallback((index) => {
    dispatch(removeBet(index));
  }, [dispatch]);

  const updateStakeHandler = useCallback((index, stake) => {
    dispatch(updateStake({ index, stake }));
  }, [dispatch]);

  const incrementStake = useCallback((index, currentStake) => {
    const newStake = (parseFloat(currentStake) || 0) + 50;
    updateStakeHandler(index, newStake);
  }, [updateStakeHandler]);

  const decrementStake = useCallback((index, currentStake) => {
    const newStake = Math.max(0, (parseFloat(currentStake) || 0) - 50);
    updateStakeHandler(index, newStake);
  }, [updateStakeHandler]);

  const totalOdds = useMemo(() => {
    if (activeTab === 'Express') {
      const combined = activeBets.reduce((prod, bet) => prod * (parseFloat(bet.odds) || 1), 1);
      return combined.toFixed(2);
    }
    // Ordinary: show sum of odds as an indicator
    return activeBets.reduce((total, bet) => total + (parseFloat(bet.odds) || 0), 0).toFixed(2);
  }, [activeBets, activeTab]);

  const potentialWin = useMemo(() => {
    if (activeTab === 'Express') {
      const totalStake = parseFloat(activeBets[0]?.stake || 0);
      const combined = activeBets.reduce((prod, bet) => prod * (parseFloat(bet.odds) || 1), 1);
      return (totalStake * combined).toFixed(2);
    }
    // Ordinary: independent stakes per selection
    return activeBets
      .reduce((total, bet) => total + (parseFloat(bet.stake) || 0) * (parseFloat(bet.odds) || 1), 0)
      .toFixed(2);
  }, [activeBets, activeTab]);

  // Removed derived totals that are no longer displayed in summary

  const validateBets = () => {
    // Check if there are any bets to validate
    if (activeBets.length === 0) {
      return 'No bets selected';
    }

    // Validate each bet
    for (const bet of activeBets) {
      // Prevent placing bets on matches that have started
      const hasStart = !!bet.startTime;
      const startDate = hasStart ? new Date(bet.startTime) : null;
      if (hasStart && startDate <= new Date()) {
        return 'One or more selections have already started. Remove them to proceed.';
      }

      // Check for required fields
      if (!bet.matchId) {
        return 'Invalid match selection';
      }
      if (!bet.type && !bet.market) {
        return 'Invalid bet type';
      }
      
      // Validate stake based on bet type
      if (activeTab === 'Express') {
        // For Express bets, only check the first bet's stake as it applies to all
        if (activeBets[0] && (!activeBets[0].stake || parseFloat(activeBets[0].stake) <= 0)) {
          return 'Please enter a valid stake amount';
        }
        break; // Exit after checking first bet for Express type
      } else {
        // For Ordinary bets, check each bet's stake
        if (!bet.stake || parseFloat(bet.stake) <= 0) {
          return 'Please enter a valid stake amount for all bets';
        }
      }

      // Validate odds
      if (!bet.odds || parseFloat(bet.odds) <= 0) {
        return 'Invalid odds detected';
      }
    }

    // All validations passed
    return null;
  };

  // Check if betslip is valid for current tab
  const isBetslipValid = useMemo(() => {
    if (activeTab === 'Express') {
      return activeBets.length >= 2;
    }
    return activeBets.length >= 1;
  }, [activeBets.length, activeTab]);

  // Get validation message for current tab
  const validationMessage = useMemo(() => {
    if (activeTab === 'Express') {
      if (activeBets.length === 0) {
        return 'Select at least 2 events for Express bet';
      } else if (activeBets.length === 1) {
        return 'Add 1 more event for Express bet';
      }
    } else {
      if (activeBets.length === 0) {
        return 'Select at least 1 event for Ordinary bet';
      }
    }
    return null;
  }, [activeBets.length, activeTab]);

  // Generate bet ID helper function
  const generateBetId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Get the actual selection display (1, X, or 2) for a bet
  const getSelectionDisplay = (bet) => {
    // Check if we have a selection property
    if (bet.selection) {
      // Map common selection names to display values
      const selectionMap = {
        '1': '1',
        'X': 'X', 
        '2': '2',
        'home': '1',
        'away': '2',
        'draw': 'X',
        'home_win': '1',
        'away_win': '2',
        'draw_result': 'X',
        'home_team': '1',
        'away_team': '2',
        'match_result': bet.selection === '1' ? '1' : bet.selection === 'X' ? 'X' : '2'
      };
      
      // Check if selection is a direct key
      if (selectionMap[bet.selection]) {
        return selectionMap[bet.selection];
      }
      
      // Hardened mapping: exact tokens only; avoid misreading points like "2.5"
      const selectionLower = bet.selection.toLowerCase().trim();
      if (selectionLower === '1') return '1';
      if (selectionLower === '2') return '2';
      if (selectionLower === 'x') return 'X';

      // Preserve existing bracketed or numeric labels (e.g., "Over (2.5)" or "+1.5")
      const hasParens = /\(.*\)/.test(bet.selection);
      const hasNumber = /[0-9]/.test(selectionLower);
      if (hasParens || (hasNumber && !selectionLower.match(/^([12x])$/))) {
        return bet.selection;
      }

      // Common synonyms for match result
      if (selectionLower.includes('home')) return '1';
      if (selectionLower.includes('away')) return '2';
      if (selectionLower.includes('draw')) return 'X';

      // Normalize totals selections when no explicit point is present
      if (selectionLower.startsWith('over') || selectionLower === 'ov' || selectionLower === 'o') return 'Over';
      if (selectionLower.startsWith('under') || selectionLower === 'un' || selectionLower === 'u') return 'Under';

      // Fallback to original selection
      return bet.selection;
    }
    
    // Fallback to type if no selection
    if (bet.type) {
      const typeMap = {
        '1': '1',
        'X': 'X',
        '2': '2',
        'home': '1',
        'away': '2',
        'draw': 'X'
      };
      return typeMap[bet.type] || bet.type;
    }
    
    // Final fallback
    return 'Selection';
  };

  // Unified selection label for betslip: include point for Totals/Spreads
  const getSelectionLabel = (bet) => {
    let base = getSelectionDisplay(bet);
    const key = bet.market ? normalizeMarketKey(bet.market) : '';
    const isPointMarket = key && (
      key.startsWith('totals') ||
      key.startsWith('alternate_totals') ||
      key.startsWith('team_totals') ||
      key.startsWith('alternate_team_totals') ||
      key.startsWith('spreads') ||
      key.startsWith('alternate_spreads')
    );
    if (isPointMarket) {
      const alreadyHasParens = /\([^)]*\)/.test(base);
      if ((bet.point || bet.point === 0) && !alreadyHasParens) {
        return `${base} (${bet.point})`;
      }
    }
    return base;
  };

  // Derive market type display from bet info
  const getMarketTypeDisplay = (bet) => {
    if (bet.marketTypeDisplay) return bet.marketTypeDisplay;
    if (bet.marketDisplay) return bet.marketDisplay;
    const sel = (bet.selection || '').toLowerCase();
    if (sel) {
      if (/^\s*\d+\s*-\s*\d+\s*$/.test(sel) && !/goals?/i.test(sel)) return 'Correct Score';
      if (/\b\d+\s*-\s*\d+\s*goals?\b/.test(sel) || /\b\d+\+\b/.test(sel)) return 'Multi Goals';
    }
    const key = bet.market ? normalizeMarketKey(bet.market) : '';
    if (key) {
      if (key === 'winner') return 'Winner';
      if (key.startsWith('totals') || key.startsWith('alternate_totals') || key.startsWith('team_totals') || key.startsWith('alternate_team_totals')) return 'Totals';
      if (key.startsWith('spreads') || key.startsWith('alternate_spreads')) return 'Handicap';
      if (key === 'outrights') return 'Outrights';
      return getMarketTitle(key);
    }
    if (bet.type && ['1','X','2','home','away','draw'].includes(bet.type)) return 'Winner';
    if (sel.includes('over') || sel.includes('under') || typeof bet.point === 'number') return 'Totals';
    if (sel.includes('both teams') || sel.includes('btts')) return 'Both Teams to Score';
    if (sel.includes('corner')) return 'Corners';
    if (sel.includes('card')) return 'Cards';
    if (sel.includes('handicap') || sel.includes('+') || sel.includes('-')) return 'Handicap';
    return 'Winner';
  };

  const placeBet = async () => {
    if (activeBets.length === 0) return;
    
    // Validate bets before submission
    const validationError = validateBets();
    if (validationError) {
      setError(validationError);
      setSuccessMessage(null);
      return;
    }
    
    setIsPlacingBet(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (activeTab === 'Express') {
        // For multibets, submit all matches as a single parlay bet
        const totalStake = parseFloat(activeBets[0]?.stake || 0);
        const combinedOdds = activeBets.reduce((prod, bet) => prod * (parseFloat(bet.odds) || 1), 1);
        const parlayMatchId = `parlay:${activeBets.map(b => b.matchId).join('|')}`;
        const selectionSummary = activeBets
          .map(b => {
            const selection = getSelectionLabel(b);
            const matchName = (b.homeTeam && b.awayTeam)
              ? `${b.homeTeam} vs ${b.awayTeam}`
              : (b.match || 'Match');
            const odds = parseFloat(b.odds).toFixed(2);
            return `${matchName}: ${selection} (${odds})`;
          })
          .join('; ');
        const betData = {
          betId: generateBetId(),
          matchId: parlayMatchId,
          market: 'parlay',
          selection: selectionSummary,
          stake: totalStake,
          odds: parseFloat(combinedOdds.toFixed(2)),
          totalMatches: activeBets.length,
          matches: activeBets.map(bet => {
            const fallbackHome = bet.match && bet.match.includes(' vs ') ? bet.match.split(' vs ')[0] : '';
            const fallbackAway = bet.match && bet.match.includes(' vs ') ? bet.match.split(' vs ')[1] : '';
            return {
              matchId: bet.matchId,
              homeTeam: bet.homeTeam || fallbackHome,
              awayTeam: bet.awayTeam || fallbackAway,
              market: bet.market,
              marketDisplay: bet.marketDisplay || getMarketTitle(bet.market),
              marketTypeDisplay: getMarketTypeDisplay(bet),
              selection: getSelectionLabel(bet),
              odds: parseFloat(bet.odds),
              startTime: bet.startTime
            };
          })
        };
        
        // Validate bet data before submission
        if (isNaN(betData.stake) || betData.stake <= 0) throw new Error('Invalid stake amount');
        if (isNaN(betData.odds) || betData.odds <= 0) throw new Error('Invalid odds');
        if (!betData.matches || betData.matches.length === 0) throw new Error('No matches selected');
        
        // Validate each match in the multibet
        for (let i = 0; i < betData.matches.length; i++) {
          const match = betData.matches[i];
          if (!match.matchId) throw new Error(`Missing match ID for match ${i + 1}`);
          if (!match.homeTeam || !match.awayTeam) throw new Error(`Missing team names for match ${i + 1}`);
          if (!match.selection) throw new Error(`Missing selection for match ${i + 1}`);
          if (isNaN(match.odds) || match.odds <= 0) throw new Error(`Invalid odds for match ${i + 1}`);
        }
        
        console.log('Submitting multibet with data:', betData);
        const response = await apiService.placeBet(betData);
        console.log('Multibet submitted successfully:', response.data);
        
      } else {
        // For Ordinary bets, submit all bets in bulk
        const betsData = activeBets.map((bet, i) => {
          const betData = {
            matchId: bet.matchId,
            market: bet.market || 'Match Result',
            selection: getSelectionLabel(bet),
            stake: parseFloat(bet.stake),
            odds: parseFloat(bet.odds),
            homeTeam: bet.homeTeam,
            awayTeam: bet.awayTeam,
            league: bet.league
          };

           // Validate bet data
           if (!betData.matchId) throw new Error(`Missing matchId for bet ${i + 1}`);
           if (!betData.market) throw new Error(`Missing market for bet ${i + 1}`);
           if (!betData.selection) throw new Error(`Missing selection for bet ${i + 1}`);
           if (isNaN(betData.stake) || betData.stake <= 0) throw new Error(`Invalid stake amount for bet ${i + 1}`);
           if (isNaN(betData.odds) || betData.odds <= 0) throw new Error(`Invalid odds for bet ${i + 1}`);

           return betData;
        });

        console.log('Submitting bulk bets:', betsData);
        const response = await apiService.placeBetsBulk({ bets: betsData });
        console.log('Bulk bets submitted successfully:', response.data);
      }

      // Only clear betslip if ALL bets were successfully submitted
      console.log('All bets submitted successfully, clearing betslip');
      
      // Clear bets in reverse order to avoid index shifting issues
      for (let i = activeBets.length - 1; i >= 0; i--) {
        dispatch(removeBet(i));
      }
      
      // Reset expansion states
      setExpandedMatches({});
      setIsCollapsed(false);

      // Show success message
      const successMessage = activeTab === 'Express' 
        ? `Multibet with ${activeBets.length} matches placed successfully!`
        : `All ${activeBets.length} ordinary bets placed successfully!`;
      setSuccessMessage(successMessage);

      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);

    } catch (err) {
      console.error('Bet submission error:', err);
      let errorMessage = 'Failed to place bet';
      
      if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.response?.data?.errors) {
        errorMessage = err.response.data.errors.map(e => e.msg).join(', ');
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      // Provide more specific error messages based on the error type
      if (errorMessage.includes('Insufficient balance')) {
        errorMessage = 'Insufficient balance. Please deposit more funds to place this bet.';
      } else if (errorMessage.includes('Invalid stake amount')) {
        errorMessage = 'Invalid stake amount. Please enter a valid amount greater than 0.';
      } else if (errorMessage.includes('Invalid odds')) {
        errorMessage = 'Invalid odds detected. Please refresh the page and try again.';
      } else if (errorMessage.includes('No matches selected')) {
        errorMessage = 'No matches selected. Please add matches to your betslip.';
      }
      
      setError(errorMessage);
      setSuccessMessage(null);
      
      // Keep the betslip intact so user can retry or modify
      console.log('Bet submission failed, keeping betslip intact for retry');
    } finally {
      setIsPlacingBet(false);
    }
  };

  return (
    <div className="betslip">
      <div className="betslip-header">
        <div className="betslip-tabs">
          <button className={`betslip-tab ${activeTab === 'Ordinary' ? 'active' : ''}`} onClick={() => setActiveTab('Ordinary')}>Ordinary</button>
          <button className={`betslip-tab ${activeTab === 'Express' ? 'active' : ''}`} onClick={() => setActiveTab('Express')}>Express</button>
        </div>
      </div>

      <div className="betslip-content">
        {activeBets.length === 0 ? (
          <div className="empty-betslip">
            <div className="empty-message">
              <p>{validationMessage}</p>
            </div>
          </div>
        ) : (
          <div className={`betslip-bets ${activeTab === 'Express' ? 'ordinary-compact' : 'express-layout'}`}>
            {/* Events Header for Express bets */}
            {activeTab === 'Express' && activeBets.length > 0 && (
              <div className="events-header">
                <div className="events-title">
                  Events (Odds {totalOdds})
                </div>
                <button 
                  className="toggle-collapse-btn"
                  onClick={toggleCollapseAll}
                >
                  {isCollapsed ? 'Expand All' : 'Collapse All'}
                </button>
              </div>
            )}
            
            {activeBets.map((bet, index) => {
              const isKnown = (t) => t && t !== 'Unknown';
              const split = typeof bet.match === 'string' && bet.match.includes(' vs ') ? bet.match.split(' vs ') : [];
              const home = isKnown(bet.homeTeam) ? bet.homeTeam : (split[0] || bet.homeTeam || '');
              const away = isKnown(bet.awayTeam) ? bet.awayTeam : (split[1] || bet.awayTeam || '');
              const matchTitle = (home || away) ? `${home} vs ${away}` : (bet.match || 'Match');
              
              const selectionDisplay = getSelectionLabel(bet);
              const when = bet.startTime ? new Date(bet.startTime).toLocaleString() : '';
              const isStarted = bet.startTime ? new Date(bet.startTime) <= new Date() : false;
              const isExpanded = expandedMatches[index] && !isCollapsed;
              
              return (
                <div key={index} className={`bet-card bet-line-item ${activeTab === 'Express' ? 'ordinary-bet' : 'express-bet'} ${isStarted ? 'started-bet' : ''}`}>
                  {/* Compact Header - Always Visible */}
                  <div className="bet-line-header" onClick={() => activeTab === 'Express' && toggleMatchExpansion(index)}>
                    <div className="bet-line-title">{matchTitle}</div>
                    <div className="bet-line-odds">{parseFloat(bet.odds)?.toFixed ? parseFloat(bet.odds).toFixed(2) : bet.odds}</div>
                    <button
                      className="remove-bet"
                      title="Remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeBetHandler(index);
                      }}
                    >
                      ×
                    </button>
                  </div>
                  
                  {/* Expandable Details - Only for Express bets */}
                  {activeTab === 'Express' && isExpanded && (
                    <div className="bet-details-expanded">
                      <div className="bet-line-sub">
                        <span className="bet-line-market">Type: {getMarketTypeDisplay(bet)}</span>
                        <span className="bet-line-bullet">•</span>
                        <span className="bet-line-selection">Pick: {selectionDisplay} ({parseFloat(bet.odds).toFixed(2)})</span>
                      </div>
                      
                      {when && (
                        <div className="bet-line-meta">Starts at {when}</div>
                      )}

                      {isStarted && (
                        <div className="bet-line-warning" style={{ color: '#ff4444' }}>
                          Match has started. Remove this selection to proceed.
                        </div>
                      )}
                      
                      <div className="bet-outcome">
                        <span>Outcome</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Ordinary bet details - Always visible */}
                  {activeTab === 'Ordinary' && (
                    <>
                      <div className="bet-line-sub">
                        <span className="bet-line-market">Type: {getMarketTypeDisplay(bet)}</span>
                        <span className="bet-line-bullet">•</span>
                        <span className="bet-line-selection">Pick: {selectionDisplay} ({parseFloat(bet.odds).toFixed(2)})</span>
                      </div>
                      
                      {when && (
                        <div className="bet-line-meta">Starts {when}</div>
                      )}

                      {isStarted && (
                        <div className="bet-line-warning" style={{ color: '#ff4444', marginTop: 6 }}>
                          Started — remove to place bets.
                        </div>
                      )}

                      {/* Ordinary stake input after each selection */}
                      <div className="bet-stake-section">
                        <label htmlFor={`stake-${index}`}>Stake:</label>
                        <div className="stake-input-group">
                          <button className="stake-btn" onClick={() => decrementStake(index, bet.stake)}>-</button>
                          <input
                            id={`stake-${index}`}
                            type="number"
                            placeholder="0"
                            value={bet.stake || ''}
                            onChange={(e) => updateStakeHandler(index, e.target.value)}
                            disabled={isStarted}
                            className="stake-input"
                            min="0.01"
                            step="0.01"
                          />
                          <button className="stake-btn" onClick={() => incrementStake(index, bet.stake)}>+</button>
                        </div>
                      </div>
                    </>
                  )}

                  {activeTab === 'Ordinary' && <div className="bet-divider" />}
                </div>
              );
            })}

            {/* Express stake section after all matches */}
            {activeTab === 'Express' && activeBets.length > 0 && (
              <div className="bet-stake-section">
                <label htmlFor="ordinary-stake">Stake (applies to all bets):</label>
                <div className="stake-input-group">
                  <button className="stake-btn" onClick={() => decrementStake(0, activeBets[0]?.stake)}>-</button>
                  <input
                    id="ordinary-stake"
                    type="number"
                    placeholder="0"
                    value={activeBets[0]?.stake || ''}
                    onChange={(e) => {
                      activeBets.forEach((_, i) => updateStakeHandler(i, e.target.value));
                    }}
                    className="stake-input"
                    min="0.01"
                    step="0.01"
                  />
                  <button className="stake-btn" onClick={() => incrementStake(0, activeBets[0]?.stake)}>+</button>
                </div>
              </div>
            )}
            
            <div className="betslip-summary">
              {/* Simplified summary: retain only Total Odds and Possible Payout */}
              <div className="betslip-details-cards">
                <div className="detail-card">
                  <div className="detail-card-title">Total Odds</div>
                  <div className="detail-card-value">{totalOdds}</div>
                </div>
                <div className="detail-card">
                  <div className="detail-card-title">Possible Payout</div>
                  <div className="detail-card-value">${potentialWin}</div>
                </div>
              </div>

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              {successMessage && (
                <div className="success-message">
                  {successMessage}
                </div>
              )}
              
              <button 
                className="place-bet-btn" 
                onClick={placeBet}
                disabled={isPlacingBet || !isBetslipValid}
              >
                {isPlacingBet ? 'Placing Bet...' : 'Place Bet'}
              </button>
            </div>
          </div>
        )}
      </div>

      <WheelOfFortune />
    </div>
  );
};

export default memo(Betslip);
