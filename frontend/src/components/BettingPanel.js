import React, { useState } from 'react';
import { toast } from 'react-toastify';
import './Aviator.css'; // We'll share the CSS or add new specific CSS

const BettingPanel = ({ 
  id, 
  balance, 
  gameState, 
  currentMultiplier, 
  onPlaceBet, 
  onCashOut, 
  onCancel,
  betStatus, // 'NO_BET' | 'BETTING_NEXT' | 'BET_ACTIVE' | 'CASHED_OUT'
  cashOutMult,
  winnings
}) => {
  const [betAmount, setBetAmount] = useState(10.00);
  const [activeTab, setActiveTab] = useState('bet'); // 'bet' or 'auto'
  const [autoCashOutEnabled, setAutoCashOutEnabled] = useState(false);
  const [targetMultiplier, setTargetMultiplier] = useState(2.00);

  const adjustBet = (amount) => {
    setBetAmount(prev => Math.max(1, prev + amount));
  };

  const handleQuickBet = (amount) => {
    setBetAmount(amount);
  };

  const handleMainButton = () => {
    if (betStatus === 'NO_BET') {
      // Place bet logic
      // If we are flying or crashed, it's for next round
      if (balance >= betAmount) {
         // Pass auto cashout settings if enabled
         const autoOptions = autoCashOutEnabled ? { targetMultiplier } : null;
         onPlaceBet(id, betAmount, autoOptions);
      } else {
         toast.error("Insufficient balance!");
      }
    } else if (betStatus === 'BET_ACTIVE') {
        if (gameState === 'FLYING') {
             onCashOut(id);
        } else if (gameState === 'WAITING') {
            // Cancel bet
            onCancel(id);
        }
    } else if (betStatus === 'BETTING_NEXT') {
        // Cancel bet for next round
        onCancel(id);
    }
  };


  // Determine Button Content and Style
  let btnText = '';
  let btnSubText = '';
  let btnClass = 'bet-button'; // Base class

  if (betStatus === 'NO_BET') {
    btnText = 'BET';
    btnSubText = `${betAmount.toFixed(2)} USD`;
    btnClass += ' place-bet';
  } else if (betStatus === 'BETTING_NEXT') {
    btnText = 'WAITING...';
    btnSubText = 'CANCEL';
    btnClass += ' waiting'; // Red/Orange style
  } else if (betStatus === 'BET_ACTIVE') {
    if (gameState === 'FLYING') {
      btnText = 'CASH OUT';
      // Calculate current win potential
      const currentWin = (betAmount * currentMultiplier).toFixed(2);
      btnSubText = `${currentWin} USD`;
      btnClass += ' cash-out';
    } else {
      // WAITING phase, bet is active/locked
      btnText = 'BET PLACED';
      btnSubText = 'CANCEL';
      btnClass += ' waiting';
    }
  } else if (betStatus === 'CASHED_OUT') {
    // Round is still flying or crashed, but user is done
    // Show stats or allow betting for next round?
    // Usually Aviator lets you bet for NEXT round immediately after cashing out
    // But for this simplified version, let's say they can bet for next round
    // We need to distinguish if we are showing the "Result" or "Ready to bet next"
    // Actually, if cashed out, the button usually turns back to "BET" (for next round)
    // but maybe disabled or labeled "NEXT ROUND" until user clicks it?
    // Let's make it "BET" for next round immediately.
    // BUT we need to handle the display of "You Won!" somewhere.
    // For now, let's treat CASHED_OUT as a state where we can place a bet for NEXT round.
    // So effectively, the button resets to "BET" (Next Round).
    // However, the parent needs to know we are in "CASHED_OUT" to show the history/win on side?
    // Let's rely on parent passing the correct status.
    // If the parent says 'CASHED_OUT', it implies we are done for this round.
    // We can show "BET" which triggers onPlaceBet (resulting in BETTING_NEXT).
    btnText = 'BET';
    btnSubText = `${betAmount.toFixed(2)} USD`;
    btnClass += ' place-bet';
  }

  // Override for Crashed state if Active
  if (gameState === 'CRASHED' && betStatus === 'BET_ACTIVE') {
      // User lost
      btnText = 'BET';
      btnSubText = `${betAmount.toFixed(2)} USD`;
      btnClass += ' place-bet'; // Reset to bet again
  }

  return (
    <div className="bet-control-panel">
        <div className="bet-tabs">
            <button 
                className={activeTab === 'bet' ? 'active' : ''} 
                onClick={() => setActiveTab('bet')}
            >
                Bet
            </button>
            <button 
                className={activeTab === 'auto' ? 'active' : ''} 
                onClick={() => setActiveTab('auto')}
            >
                Auto
            </button>
        </div>

        <div className="bet-interface">
            <div className="bet-adjustment">
                <div className="spinner">
                    <button onClick={() => adjustBet(-1)} className="minus">−</button>
                    <input 
                        type="number" 
                        value={betAmount} 
                        onChange={(e) => setBetAmount(Number(e.target.value))}
                        className="bet-amount-input"
                    />
                    <button onClick={() => adjustBet(1)} className="plus">+</button>
                </div>
                <div className="quick-presets">
                    <button onClick={() => handleQuickBet(100)}>100</button>
                    <button onClick={() => handleQuickBet(250)}>250</button>
                    <button onClick={() => handleQuickBet(1000)}>1000</button>
                    <button onClick={() => handleQuickBet(5000)}>5000</button>
                </div>

                {activeTab === 'auto' && (
                    <div className="auto-controls" style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.05)', padding: '5px', borderRadius: '5px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <label className="switch">
                                <input 
                                    type="checkbox" 
                                    checked={autoCashOutEnabled}
                                    onChange={(e) => setAutoCashOutEnabled(e.target.checked)}
                                />
                                <span className="slider round"></span>
                            </label>
                            <span style={{ fontSize: '0.8rem', color: '#ccc' }}>Auto Cashout</span>
                        </div>
                        {autoCashOutEnabled && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    min="1.01"
                                    value={targetMultiplier}
                                    onChange={(e) => setTargetMultiplier(parseFloat(e.target.value))}
                                    style={{ width: '60px', background: '#333', border: '1px solid #555', color: '#fff', padding: '2px 5px', borderRadius: '3px' }}
                                />
                                <span style={{ fontSize: '0.8rem', color: '#e91e63' }}>x</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="bet-action-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '110px' }}>
                {betStatus === 'CASHED_OUT' && (
                    <div className="last-win-info" style={{ color: '#00E676', fontSize: '0.8rem', marginBottom: '4px', fontWeight: 'bold' }}>
                        WON ${Number(winnings).toFixed(2)} ({cashOutMult}x)
                    </div>
                )}
                <button className={btnClass} onClick={handleMainButton}>
                    <div className="btn-label">{btnText}</div>
                    <div className="btn-value">{btnSubText}</div>
                </button>
            </div>
        </div>
    </div>
  );
};

export default BettingPanel;
