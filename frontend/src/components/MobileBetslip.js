import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { removeBet, updateStake } from '../store/slices/activeBetSlice';
import apiService from '../services/api';
import getMarketTitle, { normalizeMarketKey } from '../utils/marketTitles';

const MobileBetslip = () => {
  const activeBets = useSelector(state => state.activeBets || []);
  const dispatch = useDispatch();
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState('Ordinary');
  const [isPlacingBet, setIsPlacingBet] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Allow opening the mobile betslip from bottom nav via global event
  useEffect(() => {
    const handleOpen = () => setShowModal(true);
    window.addEventListener('openMobileBetslip', handleOpen);
    return () => window.removeEventListener('openMobileBetslip', handleOpen);
  }, []);

  // Don't render anything if no bets
  if (activeBets.length === 0) {
    return null;
  }

  const removeBetHandler = (index) => {
    dispatch(removeBet(index));
  };

  const updateStakeHandler = (index, stake) => {
    dispatch(updateStake({ index, stake }));
  };

  const incrementStake = (index, currentStake) => {
    const newStake = (parseFloat(currentStake) || 0) + 50;
    updateStakeHandler(index, newStake);
  };

  const decrementStake = (index, currentStake) => {
    const newStake = Math.max(0, (parseFloat(currentStake) || 0) - 50);
    updateStakeHandler(index, newStake);
  };

  const calculateTotalOdds = () => {
    if (activeTab === 'Express') {
      const combined = activeBets.reduce((prod, bet) => prod * (parseFloat(bet.odds) || 1), 1);
      return combined.toFixed(2);
    }
    return activeBets.reduce((total, bet) => total + (parseFloat(bet.odds) || 0), 0).toFixed(2);
  };

  const calculatePotentialWin = () => {
    if (activeTab === 'Express') {
      const totalStake = parseFloat(activeBets[0]?.stake || 0);
      const combined = activeBets.reduce((prod, bet) => prod * (parseFloat(bet.odds) || 1), 1);
      return (totalStake * combined).toFixed(2);
    }
    return activeBets
      .reduce((total, bet) => total + (parseFloat(bet.stake) || 0) * (parseFloat(bet.odds) || 1), 0)
      .toFixed(2);
  };

  const getSelectionDisplay = (bet) => {
    if (bet.selection) {
      const selectionMap = {
        '1': '1', 'X': 'X', '2': '2',
        'home': '1', 'away': '2', 'draw': 'X',
        'home_win': '1', 'away_win': '2', 'draw_result': 'X',
        'home_team': '1', 'away_team': '2'
      };
      
      if (selectionMap[bet.selection]) {
        return selectionMap[bet.selection];
      }
      
      const selectionLower = bet.selection.toLowerCase().trim();
      // Exact numeric tokens only; avoid misreading points like "2.5" as away ("2")
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
      
      return bet.selection;
    }
    
    if (bet.type) {
      const typeMap = { '1': '1', 'X': 'X', '2': '2', 'home': '1', 'away': '2', 'draw': 'X' };
      return typeMap[bet.type] || bet.type;
    }
    
    return 'Selection';
  };

  // Unified selection label including point for Totals/Spreads
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
  const getMarketTypeDisplay = (bet) => {
    if (bet.marketTypeDisplay) return bet.marketTypeDisplay;
    if (bet.marketDisplay) return bet.marketDisplay;
    const key = bet.market ? normalizeMarketKey(bet.market) : '';
    if (key) {
      if (key === 'winner') return 'Winner';
      if (key.startsWith('totals') || key.startsWith('alternate_totals') || key.startsWith('team_totals') || key.startsWith('alternate_team_totals')) return 'Totals';
      if (key.startsWith('spreads') || key.startsWith('alternate_spreads')) return 'Handicap';
      if (key === 'outrights') return 'Outrights';
      return getMarketTitle(key);
    }
    if (bet.type && ['1','X','2','home','away','draw'].includes(bet.type)) return 'Winner';
    const sel = (bet.selection || '').toLowerCase();
    if (sel) {
      if (/\d+\s*-\s*\d+/.test(sel)) return 'Correct Score';
      if (sel.includes('over') || sel.includes('under') || typeof bet.point === 'number') return 'Totals';
      if (sel.includes('both teams') || sel.includes('btts')) return 'Both Teams to Score';
      if (sel.includes('corner')) return 'Corners';
      if (sel.includes('card')) return 'Cards';
      if (/\d+\s*-\s*\d+\s*goals/.test(sel) || /\d+\+/.test(sel)) return 'Multi Goals';
      if (sel.includes('handicap') || sel.includes('+') || sel.includes('-')) return 'Handicap';
    }
    return 'Winner';
  };

  const validateBets = () => {
    if (activeBets.length === 0) return 'No bets selected';

    for (const bet of activeBets) {
      // Disallow started matches
      const hasStart = !!bet.startTime;
      const startDate = hasStart ? new Date(bet.startTime) : null;
      if (hasStart && startDate <= new Date()) {
        return 'One or more selections have already started. Remove them to proceed.';
      }

      if (!bet.matchId) return 'Invalid match selection';
      if (!bet.type && !bet.market) return 'Invalid bet type';
      
      if (activeTab === 'Express') {
        if (activeBets[0] && (!activeBets[0].stake || parseFloat(activeBets[0].stake) <= 0)) {
          return 'Please enter a valid stake amount';
        }
        break;
      } else {
        if (!bet.stake || parseFloat(bet.stake) <= 0) {
          return 'Please enter a valid stake amount for all bets';
        }
      }

      if (!bet.odds || parseFloat(bet.odds) <= 0) {
        return 'Invalid odds detected';
      }
    }

    return null;
  };

  const isBetslipValid = () => {
    if (activeTab === 'Express') {
      return activeBets.length >= 2;
    }
    return activeBets.length >= 1;
  };

  const generateBetId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const placeBet = async () => {
    if (activeBets.length === 0) return;
    
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
        const totalStake = parseFloat(activeBets[0]?.stake || 0);
        const combinedOdds = activeBets.reduce((prod, bet) => prod * (parseFloat(bet.odds) || 1), 1);
        const parlayMatchId = `parlay:${activeBets.map(b => b.matchId).join('|')}`;
        const selectionSummary = activeBets
          .map(b => {
            const selection = getSelectionLabel(b);
            const matchName = `${b.homeTeam} vs ${b.awayTeam}`;
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
          matches: activeBets.map(bet => ({
            matchId: bet.matchId,
            homeTeam: bet.homeTeam,
            awayTeam: bet.awayTeam,
            selection: getSelectionLabel(bet),
            odds: parseFloat(bet.odds),
            startTime: bet.startTime
          }))
        };
        
        console.log('Submitting multibet with data:', betData);
        const response = await apiService.placeBet(betData);
        console.log('Multibet submitted successfully:', response.data);
        
      } else {
        // Prepare bulk bets data
        const betsData = activeBets.map(bet => ({
          matchId: bet.matchId,
          market: bet.market || 'Match Result',
          selection: getSelectionLabel(bet),
          stake: parseFloat(bet.stake),
          odds: parseFloat(bet.odds),
          homeTeam: bet.homeTeam,
          awayTeam: bet.awayTeam,
          league: bet.league
        }));

        // Validate all bets have stakes
        const invalidStakeIndex = betsData.findIndex(b => isNaN(b.stake) || b.stake <= 0);
        if (invalidStakeIndex !== -1) {
            throw new Error(`Invalid stake for bet ${invalidStakeIndex + 1}`);
        }

        console.log('Submitting bulk bets:', betsData);
        const response = await apiService.placeBetsBulk({ bets: betsData });
        console.log('Bulk bets submitted successfully:', response.data);
      }

      // Clear bets in reverse order to avoid index shifting issues
      for (let i = activeBets.length - 1; i >= 0; i--) {
        dispatch(removeBet(i));
      }
      
      setShowModal(false);

      const successMessage = activeTab === 'Express' 
        ? `Multibet with ${activeBets.length} matches placed successfully!`
        : `All ${activeBets.length} ordinary bets placed successfully!`;
      setSuccessMessage(successMessage);

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
      
      setError(errorMessage);
      setSuccessMessage(null);
      
    } finally {
      setIsPlacingBet(false);
    }
  };

  return (
    <>
      {/* Mobile betslip modal */}
      <div className={`mobile-betslip-overlay ${showModal ? 'show' : ''}`}>
        <div className="mobile-betslip-modal">
          <div className="mobile-betslip-header">
            <h3 className="mobile-betslip-title">Selected Matches ({activeBets.length})</h3>
            <button 
              className="mobile-betslip-close"
              onClick={() => setShowModal(false)}
            >
              ×
            </button>
          </div>
          
          <div className="mobile-betslip-content">
            {/* Tabs */}
            <div className="mobile-betslip-tabs">
              <button 
                className={`mobile-betslip-tab ${activeTab === 'Ordinary' ? 'active' : ''}`}
                onClick={() => setActiveTab('Ordinary')}
              >
                Ordinary
              </button>
              <button 
                className={`mobile-betslip-tab ${activeTab === 'Express' ? 'active' : ''}`}
                onClick={() => setActiveTab('Express')}
              >
                Express
              </button>
            </div>

            {/* Bets list */}
            <div className="mobile-bets-list">
              {activeBets.map((bet, index) => {
                const isKnown = (t) => t && t !== 'Unknown';
                const split = typeof bet.match === 'string' && bet.match.includes(' vs ') ? bet.match.split(' vs ') : [];
                const home = isKnown(bet.homeTeam) ? bet.homeTeam : (split[0] || bet.homeTeam || '');
                const away = isKnown(bet.awayTeam) ? bet.awayTeam : (split[1] || bet.awayTeam || '');
                const matchTitle = (home || away) ? `${home} vs ${away}` : (bet.match || 'Match');
                
              const selectionDisplay = getSelectionLabel(bet);
              const when = bet.startTime ? new Date(bet.startTime).toLocaleString() : '';
              const isStarted = bet.startTime ? new Date(bet.startTime) <= new Date() : false;
                
                return (
                  <div key={index} className={`mobile-bet-card ${isStarted ? 'started-bet' : ''}`}>
                    <div className="mobile-bet-header">
                      <div className="mobile-bet-title">{matchTitle}</div>
                      <button
                        className="mobile-remove-bet"
                        onClick={() => removeBetHandler(index)}
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                    
                    <div className="mobile-bet-details">
                      <div className="mobile-bet-selection">
                        <span className="mobile-bet-market">Type: {getMarketTypeDisplay(bet)}</span>
                        <span className="mobile-bet-pick">Pick: {selectionDisplay} ({parseFloat(bet.odds).toFixed(2)})</span>
                      </div>
                      
                      {when && (
                        <div className="mobile-bet-time">Starts {when}</div>
                      )}

                      {isStarted && (
                        <div className="mobile-bet-warning" style={{ color: '#ff4444', marginTop: 6 }}>
                          Started — remove to place bets.
                        </div>
                      )}

                      {/* Ordinary stake input */}
                      {activeTab === 'Ordinary' && (
                        <div className="mobile-stake-section">
                          <label>Stake:</label>
                          <div className="mobile-stake-input-group">
                            <button 
                              className="mobile-stake-btn" 
                              onClick={() => decrementStake(index, bet.stake)}
                            >
                              -
                            </button>
                            <input
                              type="number"
                              placeholder="0"
                              value={bet.stake || ''}
                              onChange={(e) => updateStakeHandler(index, e.target.value)}
                              disabled={isStarted}
                              className="mobile-stake-input"
                              min="0.01"
                              step="0.01"
                            />
                            <button 
                              className="mobile-stake-btn" 
                              onClick={() => incrementStake(index, bet.stake)}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Express stake section */}
              {activeTab === 'Express' && activeBets.length > 0 && (
                <div className="mobile-stake-section">
                  <label>Stake (applies to all bets):</label>
                  <div className="mobile-stake-input-group">
                    <button 
                      className="mobile-stake-btn" 
                      onClick={() => decrementStake(0, activeBets[0]?.stake)}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      placeholder="0"
                      value={activeBets[0]?.stake || ''}
                      onChange={(e) => {
                        activeBets.forEach((_, i) => updateStakeHandler(i, e.target.value));
                      }}
                      className="mobile-stake-input"
                      min="0.01"
                      step="0.01"
                    />
                    <button 
                      className="mobile-stake-btn" 
                      onClick={() => incrementStake(0, activeBets[0]?.stake)}
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="mobile-betslip-summary">
                <div className="mobile-summary-row">
                  <span>Total odds:</span>
                  <span>{calculateTotalOdds()}</span>
                </div>
                
                <div className="mobile-summary-row">
                  <span>Potential win:</span>
                  <span>${calculatePotentialWin()}</span>
                </div>

                {error && (
                  <div className="mobile-error-message">
                    {error}
                  </div>
                )}

                {successMessage && (
                  <div className="mobile-success-message">
                    {successMessage}
                  </div>
                )}
                
                <button 
                  className="mobile-place-bet-btn" 
                  onClick={placeBet}
                  disabled={isPlacingBet || !isBetslipValid()}
                >
                  {isPlacingBet ? 'Placing Bet...' : 'Place Bet'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MobileBetslip;
