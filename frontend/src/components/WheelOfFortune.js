import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setUser } from '../store/slices/authSlice';
import '../index.css';
import apiService from '../services/api'; 

const WheelOfFortune = () => {
  const dispatch = useDispatch();
  const { user, loggedIn } = useSelector(state => state.auth);
  const [betAmount, setBetAmount] = useState('');
  const [selectedMultiplier, setSelectedMultiplier] = useState(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const wheelRef = useRef(null);

  // Shuffling algorithm to favor consecutive multipliers based on count,
  // prevent consecutive 20x, ensure no more than 2 consecutive same multipliers,
  // and maintain even distribution
  const shuffleSegments = (array) => {
    const shuffled = [];
    const availableSegments = [...array];
    const counts = {};
    array.forEach(s => counts[s.multiplier] = (counts[s.multiplier] || 0) + 1);

    // Calculate ideal frequency for even distribution
    const totalSegments = availableSegments.length;
    const multipliers = Object.keys(counts).map(Number);
    const idealFrequency = {};
    multipliers.forEach(m => idealFrequency[m] = totalSegments / counts[m]);

    // Track last two multipliers and first multiplier for consecutive and circular adjacency rules
    let lastTwoMultipliers = [null, null];
    let firstMultiplier = null;

    while (availableSegments.length > 0) {
      const availableMultipliers = multipliers.filter(m => counts[m] > 0);
      if (availableMultipliers.length === 0) break;

      // Score multipliers based on frequency
      const placedCount = {};
      multipliers.forEach(m => placedCount[m] = shuffled.filter(s => s.multiplier === m).length);
      const frequencyScore = availableMultipliers.map(m => ({
        multiplier: m,
        score: placedCount[m] / idealFrequency[m]
      }));

      // Adjust scores to favor consecutive placements based on count
      frequencyScore.forEach(item => {
        const m = item.multiplier;
        if (m === 20 && lastTwoMultipliers[0] === 20) {
          item.score += 1000; // Prevent consecutive 20x
        } else if (
          m !== 20 &&
          lastTwoMultipliers[0] === m &&
          lastTwoMultipliers[1] === m
        ) {
          item.score += 1000; // Prevent third consecutive for other multipliers
        } else if (m !== 20 && lastTwoMultipliers[0] === m) {
          // Penalty inversely proportional to count for consecutive placements
          item.score += 100 / counts[m]; // e.g., 1x (count: 10): +10, 2x (count: 6): +16.67
        }
        // Prevent 20x at both start and end when only one segment remains
        if (m === 20 && availableSegments.length === 1 && firstMultiplier === 20) {
          item.score += 1000;
        }
      });
      frequencyScore.sort((a, b) => a.score - b.score);

      let selectedSegment = null;
      for (const { multiplier } of frequencyScore) {
        const segmentIndex = availableSegments.findIndex(s => s.multiplier === multiplier);
        if (segmentIndex !== -1) {
          selectedSegment = availableSegments[segmentIndex];
          availableSegments.splice(segmentIndex, 1);
          counts[multiplier]--;
          break;
        }
      }

      // Fallback: Pick first available segment if constraints are too tight
      if (!selectedSegment && availableSegments.length > 0) {
        selectedSegment = availableSegments[0];
        availableSegments.splice(0, 1);
        counts[selectedSegment.multiplier]--;
      }

      if (selectedSegment) {
        shuffled.push(selectedSegment);
        lastTwoMultipliers = [selectedSegment.multiplier, lastTwoMultipliers[0]];
        if (shuffled.length === 1) firstMultiplier = selectedSegment.multiplier;
      }
    }

    // Log the shuffled sequence for debugging
    console.log('Shuffled segments:', shuffled.map(s => s.multiplier));
    return shuffled;
  };

  // Wheel configuration with specified counts
  const segments = [
    { multiplier: 1, count: 10, color: '#3498db' },  // Blue
    { multiplier: 2, count: 6, color: '#2ecc71' },    // Green
    { multiplier: 5, count: 4, color: '#f1c40f' },    // Yellow
    { multiplier: 10, count: 3, color: '#e67e22' },   // Orange
    { multiplier: 20, count: 1, color: '#e74c3c' }    // Red
  ];

  // Calculate total segments dynamically
  const totalSegments = segments.reduce((sum, segment) => sum + segment.count, 0);
  const segmentAngle = 360 / totalSegments;
  const wheelRadius = 150; // Updated to match new wheel size (300px / 2)

  // Create randomized wheel segments array
  const [wheelSegments, setWheelSegments] = useState(() => {
    const allSegments = segments.flatMap(({ multiplier, count, color }) =>
      Array(count).fill({ multiplier, color })
    );
    return shuffleSegments(allSegments);
  });

  // Randomize segments on page refresh
  useEffect(() => {
    const allSegments = segments.flatMap(({ multiplier, count, color }) =>
      Array(count).fill({ multiplier, color })
    );
    const randomizedSegments = shuffleSegments(allSegments);
    setWheelSegments(randomizedSegments);
  }, []);

  const validateBet = () => {
    if (!loggedIn) {
      setError('Please log in to play');
      return false;
    }
    if (!betAmount || isNaN(betAmount) || betAmount <= 0) {
      setError('Please enter a valid bet amount');
      return false;
    }
    if (betAmount > user.balance) {
      setError('Insufficient balance');
      return false;
    }
    if (!selectedMultiplier) {
      setError('Please select a multiplier');
      return false;
    }
    setError('');
    return true;
  };

  const handleSpin = async () => {
    if (!validateBet()) return;

    setIsSpinning(true);
    setResult(null);
    setError('');

    // Store original balance for potential rollback
    const originalBalance = user.balance;
    
    // Deduct bet amount immediately in UI for instant responsiveness
    const updatedUser = { ...user, balance: user.balance - parseFloat(betAmount) };
    dispatch(setUser(updatedUser));

    // Random segment selection based on probability
    const randomIndex = Math.floor(Math.random() * totalSegments);
    const selectedSegment = wheelSegments[randomIndex];

    // Calculate rotation angle with more rotations for dramatic effect
    const baseRotation = 360 * 8; // Increased from 5 to 8 rotations for more excitement
    const finalRotation = baseRotation + (randomIndex * segmentAngle);

    // Apply rotation animation with faster speed
    if (wheelRef.current) {
      wheelRef.current.style.transition = 'transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      wheelRef.current.style.transform = `rotate(${finalRotation}deg)`;
    }

    // Wait for animation to complete with reduced timeout for instant response
    setTimeout(async () => {
      setIsProcessing(true); // Show balance update is processing
      
      // Calculate winnings
      const won = selectedSegment.multiplier === selectedMultiplier;
      const winAmount = won ? betAmount * selectedMultiplier : 0;
      
      const result = {
        won,
        multiplier: selectedSegment.multiplier,
        winAmount
      };
      
      try {
        // Call backend API to update balance and record transaction
        const response = await apiService.spinWheel({
          betAmount: parseFloat(betAmount),
          selectedMultiplier,
          result
        });
        
        // Update user with exact balance from backend immediately
        dispatch(setUser({ 
          ...user, 
          balance: response.data.balance,
          lifetimeWinnings: won ? (user.lifetimeWinnings || 0) + winAmount : user.lifetimeWinnings 
        }));
        
        setIsSpinning(false);
        setIsProcessing(false);
        setResult(result);
        setHistory(prev => [{
          multiplier: selectedSegment.multiplier,
          betAmount: parseFloat(betAmount),
          winAmount
        }, ...prev].slice(0, 5));
        
        // Show success message
        if (won) {
          console.log(`🎉 Won $${winAmount.toFixed(2)}! New balance: $${response.data.balance.toFixed(2)} (Processed in ${response.data.processingTime})`);
        } else {
          console.log(`💸 Lost $${betAmount}. New balance: $${response.data.balance.toFixed(2)} (Processed in ${response.data.processingTime})`);
        }
        
      } catch (error) {
        console.error('Error processing wheel spin:', error);
        setError(error.response?.data?.error || 'Failed to process spin. Please try again.');
        setIsSpinning(false);
        setIsProcessing(false);
        
        // Revert balance to original on error
        dispatch(setUser({ ...user, balance: originalBalance }));
      }
    }, 1000);
  };

  return (
    <div className="wheel-of-fortune">
      <div className="wheel-header">
        <h2>Wheel of Fortune</h2>
        <div className="promo-text">Spin the lucky wheel and win easy and big!</div>
        {!loggedIn && (
          <div className="login-prompt">Please log in to play</div>
        )}
      </div>

      <div className="wheel-container">
        <div className="wheel-pointer"></div>
        <div className="wheel" ref={wheelRef}>
          {wheelSegments.map((segment, index) => {
            // Calculate clip-path for a pie-shaped wedge with no gaps
            const angle = segmentAngle; // 15 degrees for 24 segments
            const rad = (angle * Math.PI) / 180;
            const x1 = 50; // Center x
            const y1 = 50; // Center y
            // Extend beyond 50% to ensure no gaps between segments
            // Using 75% instead of 50% to create maximum overlap and eliminate gaps
            const x2 = 50 + 75 * Math.cos(0); // Right edge at 0 degrees, extended
            const y2 = 50 + 75 * Math.sin(0);
            const x3 = 50 + 75 * Math.cos(rad); // Edge at segmentAngle, extended
            const y3 = 50 + 75 * Math.sin(rad);

            return (
              <div
                key={index}
                className="wheel-segment"
                style={{
                  transform: `rotate(${index * angle}deg)`,
                  backgroundColor: segment.color,
                  clipPath: `polygon(${x1}% ${y1}%, ${x2}% ${y2}%, ${x3}% ${y3}%)`,
                  width: '100%',
                  height: '100%',
                  position: 'absolute',
                  transformOrigin: 'center',
                  zIndex: totalSegments - index // Higher index = lower z-index
                }}
              >
                <span
                  style={{
                    display: 'block',
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: `translate(-50%, -50%) rotate(${angle / 2}deg) translateY(-${wheelRadius * 0.6}px)`,
                    transformOrigin: 'center',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '16px', // Reduced for better fit
                    textAlign: 'center'
                  }}
                >
                  {segment.multiplier}x
                </span>
              </div>
            );
          })}
        </div>
      </div>
      
      <div className="betting-controls">
        <div className="bet-amount">
          <label>Bet Amount:</label>
          <input
            type="number"
            value={betAmount}
            onChange={(e) => setBetAmount(e.target.value)}
            disabled={isSpinning || !loggedIn}
            min="1"
            step="1"
          />
        </div>

        <div className="multiplier-buttons">
          {segments.map(({ multiplier }) => (
            <button
              key={multiplier}
              className={`multiplier-btn ${selectedMultiplier === multiplier ? 'selected' : ''}`}
              onClick={() => setSelectedMultiplier(multiplier)}
              disabled={isSpinning || !loggedIn}
            >
              {multiplier}x
            </button>
          ))}
        </div>

        <button
          className="spin-btn"
          onClick={handleSpin}
          disabled={isSpinning || isProcessing || !loggedIn || (user && user.balance <= 0)}
        >
          {isSpinning ? 'SPINNING...' : isProcessing ? 'UPDATING BALANCE...' : 'SPIN'}
        </button>
        
        {isProcessing && (
          <div className="processing-indicator" style={{
            marginTop: '10px',
            padding: '8px 16px',
            backgroundColor: '#007bff',
            color: 'white',
            borderRadius: '4px',
            fontSize: '14px',
            textAlign: 'center'
          }}>
            ⚡ Updating balance...
          </div>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      {result && (
        <div className={`result-message ${result.won ? 'won' : 'lost'}`}>
          {result.won
            ? `Congratulations! You won $${result.winAmount.toFixed(2)}!`
            : `Better luck next time! Wheel landed on ${result.multiplier}x`}
        </div>
      )}

      <div className="info-panel">
        <div className="history">
          <h3>Last 5 Spins</h3>
          <ul>
            {history.map((spin, index) => (
              <li key={index}>
                Bet ${spin.betAmount.toFixed(2)} - Landed on {spin.multiplier}x
                {spin.winAmount > 0 && ` - Won $${spin.winAmount.toFixed(2)}`}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default WheelOfFortune;