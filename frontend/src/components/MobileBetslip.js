import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { removeBet, updateStake } from '../store/slices/activeBetSlice';
import apiService from '../services/api';

const MobileBetslip = () => {
  const activeBets = useSelector(state => state.activeBets || []);
  const dispatch = useDispatch();
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState('Ordinary');
  const [isPlacingBet, setIsPlacingBet] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

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
    if (activeTab === 'Ordinary') {
      const combined = activeBets.reduce((prod, bet) => prod * (parseFloat(bet.odds) || 1), 1);
      return combined.toFixed(2);
    }
    return activeBets.reduce((total, bet) => total + (parseFloat(bet.odds) || 0), 0).toFixed(2);
  };

  const calculatePotentialWin = () => {
    if (activeTab === 'Ordinary') {
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
      
      const selectionLower = bet.selection.toLowerCase();
      if (selectionLower.includes('home') || selectionLower.includes('1')) return '1';
      if (selectionLower.includes('away') || selectionLower.includes('2')) return '2';
      if (selectionLower.includes('draw') || selectionLower.includes('x')) return 'X';
      
      return bet.selection;
    }
    
    if (bet.type) {
      const typeMap = { '1': '1', 'X': 'X', '2': '2', 'home': '1', 'away': '2', 'draw': 'X' };
      return typeMap[bet.type] || bet.type;
    }
    
    return 'Selection';
  };

  const validateBets = () => {
    if (activeBets.length === 0) return 'No bets selected';

    for (const bet of activeBets) {
      if (!bet.matchId) return 'Invalid match selection';
      if (!bet.type && !bet.market) return 'Invalid bet type';
      
      if (activeTab === 'Ordinary') {
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
    if (activeTab === 'Ordinary') {
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
      if (activeTab === 'Ordinary') {
        const totalStake = parseFloat(activeBets[0]?.stake || 0);
        const combinedOdds = activeBets.reduce((prod, bet) => prod * (parseFloat(bet.odds) || 1), 1);
        const parlayMatchId = `parlay:${activeBets.map(b => b.matchId).join('|')}`;
        const selectionSummary = activeBets
          .map(b => {
            const selection = getSelectionDisplay(b);
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
            selection: getSelectionDisplay(bet),
            odds: parseFloat(bet.odds),
            startTime: bet.startTime
          }))
        };
        
        console.log('Submitting multibet with data:', betData);
        const response = await apiService.placeBet(betData);
        console.log('Multibet submitted successfully:', response.data);
        
      } else {
        const submittedBets = [];
        const failedBets = [];
        
        for (let i = 0; i < activeBets.length; i++) {
          const bet = activeBets[i];
          try {
            const betData = {
              matchId: bet.matchId,
              market: 'Match Result',
              selection: getSelectionDisplay(bet),
              stake: parseFloat(bet.stake),
              odds: parseFloat(bet.odds)
            };
            
            console.log(`Submitting express bet ${i + 1}:`, betData);
            const response = await apiService.placeBet(betData);
            console.log(`Express bet ${i + 1} submitted successfully:`, response.data);
            submittedBets.push(i);
          } catch (error) {
            console.error(`Failed to submit express bet ${i + 1}:`, error);
            failedBets.push({ index: i, error: error.message });
          }
        }
        
        if (failedBets.length > 0) {
          const errorMessage = `Failed to submit ${failedBets.length} out of ${activeBets.length} bets. ${failedBets.map(f => `Bet ${f.index + 1}: ${f.error}`).join('; ')}`;
          throw new Error(errorMessage);
        }
      }

      // Clear bets in reverse order to avoid index shifting issues
      for (let i = activeBets.length - 1; i >= 0; i--) {
        dispatch(removeBet(i));
      }
      
      setShowModal(false);

      const successMessage = activeTab === 'Ordinary' 
        ? `Multibet with ${activeBets.length} matches placed successfully!`
        : `All ${activeBets.length} express bets placed successfully!`;
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
      {/* Mobile betslip count button - only red badge */}
      <div 
        className="mobile-betslip-count"
        onClick={() => setShowModal(true)}
        title="View selected matches"
      >
        {activeBets.length > 0 && (
          <div className="mobile-betslip-count-badge">
            {activeBets.length}
          </div>
        )}
      </div>

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
                const matchTitle = bet.homeTeam && bet.awayTeam
                  ? `${bet.homeTeam} vs ${bet.awayTeam}`
                  : (bet.match || 'Match');
                
                const selectionDisplay = getSelectionDisplay(bet);
                const when = bet.startTime ? new Date(bet.startTime).toLocaleString() : '';
                
                return (
                  <div key={index} className="mobile-bet-card">
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
                        <span className="mobile-bet-market">Match Result</span>
                        <span className="mobile-bet-pick">{selectionDisplay} ({parseFloat(bet.odds).toFixed(2)})</span>
                      </div>
                      
                      {when && (
                        <div className="mobile-bet-time">Starts {when}</div>
                      )}

                      {/* Express stake input */}
                      {activeTab === 'Express' && (
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

              {/* Ordinary stake section */}
              {activeTab === 'Ordinary' && activeBets.length > 0 && (
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
