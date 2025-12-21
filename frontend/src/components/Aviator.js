import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { updateBalance, updateBalanceBonus } from '../store/slices/userSlice';
import apiService from '../services/api';
import { chatPhrases } from '../data/chatPhrases';
import BettingPanel from './BettingPanel';
import './Aviator.css';

const realNames = [
  'Alex', 'Sarah', 'Mike', 'Emma', 'Chris', 'David', 'James', 'Lisa', 'Tom', 'Ryan', 
  'Kevin', 'Jessica', 'Daniel', 'Emily', 'Jacob', 'Sophie', 'Oliver', 'Lucas', 'Mia', 'Ava',
  'Ethan', 'Noah', 'Liam', 'Mason', 'Logan', 'Elijah', 'Aiden', 'Jackson', 'Caleb', 'Ben',
  'William', 'Michael', 'Alexander', 'Elias', 'Gabriel', 'Carter', 'Jayden', 'Luke', 'Henry',
  'Andrew', 'Joshua', 'Christopher', 'Julian', 'Grayson', 'Leo', 'Mateo', 'Anthony', 'Isaac',
  'Lincoln', 'Jack', 'Nathan', 'Aaron', 'Isaiah', 'Thomas', 'Charles', 'Caleb', 'Josiah',
  'Christian', 'Hunter', 'Eli', 'Jonathan', 'Connor', 'Landon', 'Adrian', 'Asher', 'Cameron',
  'Leo', 'Theodore', 'Jeremiah', 'Hudson', 'Robert', 'Easton', 'Nolan', 'Nicholas', 'Ezra',
  'Colton', 'Angel', 'Brayden', 'Jordan', 'Dominic', 'Austin', 'Ian', 'Adam', 'Elias', 'Jaxson',
  'Greyson', 'Jose', 'Ezekiel', 'Carson', 'Evan', 'Maverick', 'Bryson', 'Jace', 'Cooper',
  'Xavier', 'Parker', 'Roman', 'Jason', 'Santiago', 'Chase', 'Sawyer', 'Gavin', 'Leonardo',
  'Kayden', 'Ayden', 'Jameson', 'Kevin', 'Bentley', 'Zachary', 'Everett', 'Axel', 'Tyler',
  'Micah', 'Vincent', 'Weston', 'Miles', 'Wesley', 'Nathaniel', 'Harrison', 'Brandon', 'Cole',
  'Declan', 'Luis', 'Braxton', 'Damian', 'Silas', 'Tristan', 'Ryder', 'Bennett', 'George',
  'Emmett', 'Justin', 'Kai', 'Max', 'Diego', 'Luca', 'Ryker', 'Carlos', 'Maxwell', 'Kingston',
  'Ivan', 'Maddox', 'Juan', 'Ashton', 'Jayce', 'Rowan', 'Kaiden', 'Giovanni', 'Eric', 'Jesus',
  'Calvin', 'Abel', 'King', 'Camden', 'Amir', 'Blake', 'Brody', 'Nathan', 'Lincoln', 'Jude',
  'Olivia', 'Charlotte', 'Amelia', 'Harper', 'Evelyn', 'Abigail', 'Emily', 'Ella', 'Elizabeth',
  'Camila', 'Luna', 'Sofia', 'Avery', 'Mila', 'Aria', 'Scarlett', 'Penelope', 'Layla', 'Chloe',
  'Victoria', 'Madison', 'Eleanor', 'Grace', 'Nora', 'Riley', 'Zoey', 'Hannah', 'Hazel', 'Lily',
  'Ellie', 'Violet', 'Lillian', 'Zoe', 'Stella', 'Aurora', 'Natalie', 'Emilia', 'Everly', 'Leah',
  'Aubrey', 'Willow', 'Addison', 'Lucy', 'Audrey', 'Bella', 'Nova', 'Brooklyn', 'Paisley', 'Savannah',
  'Claire', 'Skylar', 'Isla', 'Genesis', 'Naomi', 'Elena', 'Caroline', 'Eliana', 'Anna', 'Maya',
  'Valentina', 'Ruby', 'Kennedy', 'Ivy', 'Ariana', 'Aaliyah', 'Cora', 'Madelyn', 'Alice', 'Kinsley',
  'Hailey', 'Gabriella', 'Allison', 'Gianna', 'Serenity', 'Samantha', 'Sarah', 'Autumn', 'Quinn',
  'Eva', 'Piper', 'Sophie', 'Sadie', 'Delilah', 'Josephine', 'Nevaeh', 'Adeline', 'Arya', 'Emery',
  'Lydia', 'Clara', 'Vivian', 'Madeline', 'Peyton', 'Julia', 'Rylee', 'Brielle', 'Reagan', 'Natalia',
  'Jade', 'Athena', 'Maria', 'Leilani', 'Everleigh', 'Liliana', 'Melanie', 'Mackenzie', 'Hadley',
  'Raelynn', 'Kaylee', 'Rose', 'Arianna', 'Isabelle', 'Melody', 'Eliza', 'Lyla', 'Katherine',
  'Ashley', 'Alexis', 'Kylie', 'Faith', 'Mary', 'Margaret', 'Ximena', 'Iris', 'Alexandra', 'Jasmine'
];

const nicknames = [
  'Shadow', 'Viper', 'Ghost', 'Neon', 'Cyber', 'Pixel', 'Wolf', 'Hawk', 'Eagle', 'Falcon',
  'Bear', 'Tiger', 'Lion', 'Dragon', 'Phoenix', 'Storm', 'Thunder', 'Blaze', 'Frost', 'Ice',
  'Maverick', 'Ace', 'King', 'Queen', 'Jack', 'Joker', 'Lucky', 'Chance', 'Destiny', 'Fate',
  'Raptor', 'Cobra', 'Venom', 'Slayer', 'Hunter', 'Sniper', 'Ranger', 'Scout', 'Rogue', 'Ninja',
  'Samurai', 'Viking', 'Spartan', 'Titan', 'Giant', 'Beast', 'Savage', 'Demon', 'Angel', 'Saint',
  'Sinner', 'Rebel', 'Outlaw', 'Bandit', 'Pirate', 'Captain', 'Chief', 'Boss', 'Master', 'Legend',
  'Hero', 'Zero', 'One', 'Alpha', 'Omega', 'Delta', 'Echo', 'Foxtrot', 'Tango', 'Sierra',
  'Zulu', 'Yankee', 'Xray', 'Victor', 'Uniform', 'Romeo', 'Quebec', 'Papa', 'Oscar', 'November',
  'Mike', 'Lima', 'Kilo', 'Juliet', 'India', 'Hotel', 'Golf', 'Charlie', 'Bravo', 'Alice',
  'Cosmos', 'Galaxy', 'Star', 'Moon', 'Sun', 'Planet', 'Comet', 'Meteor', 'Asteroid', 'Nebula',
  'Void', 'Abyss', 'Deep', 'High', 'Low', 'Fast', 'Slow', 'Quick', 'Speed', 'Rush',
  'Dash', 'Flash', 'Spark', 'Volt', 'Watt', 'Amp', 'Ohm', 'Hertz', 'Bit', 'Byte',
  'Mega', 'Giga', 'Tera', 'Peta', 'Exa', 'Zetta', 'Yotta', 'Nano', 'Micro', 'Milli',
  'Kilo', 'Hecto', 'Deca', 'Deci', 'Centi', 'Quantum', 'Atomic', 'Nuclear', 'Radio', 'Sonic',
  'Laser', 'Plasma', 'Magma', 'Lava', 'Rock', 'Stone', 'Iron', 'Steel', 'Gold', 'Silver',
  'Bronze', 'Copper', 'Platinum', 'Diamond', 'Ruby', 'Emerald', 'Sapphire', 'Opal', 'Pearl', 'Jade',
  'Onyx', 'Topaz', 'Amber', 'Coral', 'Ivory', 'Ebony', 'Jet', 'Slate', 'Clay', 'Dust',
  'Sand', 'Wind', 'Rain', 'Snow', 'Hail', 'Mist', 'Fog', 'Cloud', 'Sky', 'Sea',
  'Ocean', 'River', 'Lake', 'Pond', 'Stream', 'Creek', 'Brook', 'Spring', 'Well', 'Bay',
  'Gulf', 'Cove', 'Port', 'Dock', 'Pier', 'Ship', 'Boat', 'Sail', 'Mast', 'Helm',
  'Anchor', 'Compass', 'Map', 'Chart', 'Globe', 'World', 'Earth', 'Mars', 'Venus', 'Jupiter',
  'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Mercury', 'Sol', 'Luna', 'Terra', 'Ares', 'Zeus',
  'Hera', 'Poseidon', 'Hades', 'Athena', 'Apollo', 'Artemis', 'Hermes', 'Dionysus', 'Demeter',
  'Hephaestus', 'Aphrodite', 'Eros', 'Pan', 'Gaia', 'Cronus', 'Rhea', 'Oceanus', 'Tethys',
  'Hyperion', 'Theia', 'Coeus', 'Phoebe', 'Crius', 'Mnemosyne', 'Iapetus', 'Themis', 'Atlas',
  'Prometheus', 'Epimetheus', 'Menoetius', 'Styx', 'Nike', 'Kratos', 'Bia', 'Zelus', 'Eos'
];

const generateFakeUser = () => {
  const cryptoNames = ['Satoshi', 'HODL', 'Moon', 'Whale', 'Crypto', 'BTC', 'ETH', 'Doge', 'Chain', 'Block'];
  const isCrypto = Math.random() < 0.05;
  let baseName;

  if (isCrypto) {
    baseName = cryptoNames[Math.floor(Math.random() * cryptoNames.length)];
  } else {
    const list = Math.random() < 0.5 ? realNames : nicknames;
    baseName = list[Math.floor(Math.random() * list.length)];
  }

  const hasNumbers = Math.random() < 0.9;
  let suffix = '';
  
  if (hasNumbers) {
    if (Math.random() < 0.3) {
      suffix = Math.floor(Math.random() * 40) + 1980;
    } else {
      suffix = Math.floor(Math.random() * 999) + 1;
    }
  }

  if (!hasNumbers || suffix === '') {
    return `${baseName}***`;
  }
  
  const suffixStr = String(suffix);
  return `${baseName}***${suffixStr.slice(-1)}`;
};

const Aviator = () => {
  const navigate = useNavigate();
  // Game State
  const [gameState, setGameState] = useState('WAITING'); // WAITING, FLYING, CRASHED
  const gameStateRef = useRef('WAITING');
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  const [multiplier, setMultiplier] = useState(1.00);
  const [history, setHistory] = useState([]);
  const [countdown, setCountdown] = useState(5);
  
  const dispatch = useDispatch();
  const user = useSelector(state => state.user);

  // User State
  const [balanceMode] = useState('real');
  const [username, setUsername] = useState('You');
  
  // Derived active balance
  const balance = (user.balance || 0) + (user.balanceBonus || 0);

  // Fetch balance and profile on mount
  useEffect(() => {
    const initData = async () => {
      try {
        const [balRes, profileRes] = await Promise.all([
            apiService.getAviatorBalance(),
            apiService.getUserProfile()
        ]);
        
        if (balRes.data.balance !== undefined) {
             dispatch(updateBalance(balRes.data.balance));
             dispatch(updateBalanceBonus(balRes.data.balanceBonus));
        }
        
        if (profileRes.data && profileRes.data.username) {
            setUsername(profileRes.data.username);
        }
      } catch (err) {
        console.error('Failed to fetch initial data', err);
      }
    };
    initData();
  }, [dispatch]);
  
  // Sync balance when game state changes to WAITING (end of round) to ensure consistency
  useEffect(() => {
    if (gameState === 'WAITING') {
        const fetchBalance = async () => {
            try {
                const res = await apiService.getAviatorBalance();
                if (res.data.balance !== undefined) {
                    dispatch(updateBalance(res.data.balance));
                    dispatch(updateBalanceBonus(res.data.balanceBonus));
                }
            } catch (err) {
                console.error('Failed to sync balance', err);
            }
        };
        fetchBalance();
    }
  }, [gameState, dispatch]);

  // Dual Betting State
  // Status: 'NO_BET' | 'BETTING_NEXT' | 'BET_ACTIVE' | 'CASHED_OUT'
  const [userBets, setUserBets] = useState({
      1: { status: 'NO_BET', amount: 0, cashOutMult: null, winAmount: 0 },
      2: { status: 'NO_BET', amount: 0, cashOutMult: null, winAmount: 0 }
  });

  const userBetsRef = useRef(userBets);
  const cashingOutRef = useRef({ 1: false, 2: false });

  useEffect(() => {
      userBetsRef.current = userBets;
  }, [userBets]);

  // Live Bets (Mock)
  const [liveBets, setLiveBets] = useState([]);
  
  // Chat (Mock)
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [error, setError] = useState(null);

  // Initial Chat Generator
  useEffect(() => {
    // Generate some initial chat history
    const initialMessages = Array(3).fill(0).map(() => ({
        user: generateFakeUser(),
        text: chatPhrases[Math.floor(Math.random() * chatPhrases.length)]
    }));
    setChatMessages(initialMessages);
  }, []);

  // Random Chat Generator
  useEffect(() => {
    const interval = setInterval(() => {
        if (Math.random() > 0.6) { // 40% chance every 1.5 seconds
            // Use generateFakeUser for consistent name formatting (e.g. Alex***1985)
            const randomUser = generateFakeUser();
            
            // Pick random phrase from global pool
            const randomText = chatPhrases[Math.floor(Math.random() * chatPhrases.length)];
            
            setChatMessages(prev => {
                const newMsg = { user: randomUser, text: randomText };
                const updated = [...prev, newMsg];
                if (updated.length > 50) return updated.slice(updated.length - 50); // Keep last 50
                return updated;
            });
        }
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  // Chat Auto-scroll
  const chatContainerRef = useRef(null);
  
  useEffect(() => {
    // Only auto-scroll if we are on a large screen OR if the chat is already near bottom
    // But for mobile "stay at graph", we simply don't use scrollIntoView on the page level
    if (chatContainerRef.current) {
        const { scrollHeight, clientHeight } = chatContainerRef.current;
        chatContainerRef.current.scrollTop = scrollHeight - clientHeight;
    }
  }, [chatMessages]);

  // Canvas Refs
  const canvasRef = useRef(null);
  const requestRef = useRef();
  const startTimeRef = useRef();
  const crashPointRef = useRef(0);
  const crashTimeRef = useRef(0);
  const trailRef = useRef([]);

  // Constants
  const MIN_BET = 1;
  const MAX_BET = 10000;

  // Handlers
  const handlePlaceBet = async (panelId, amount, autoOptions = null) => {
    setError(null);
    if (amount < MIN_BET || amount > MAX_BET) {
        setError(`Bet must be between $${MIN_BET} and $${MAX_BET}`);
        setTimeout(() => setError(null), 3000);
        return;
    }
    
    try {
      const res = await apiService.placeAviatorBet({ amount, type: balanceMode });
      if (res.data.success) {
          if (res.data.balance !== undefined) {
              dispatch(updateBalance(res.data.balance));
              dispatch(updateBalanceBonus(res.data.balanceBonus));
          }
          
          setUserBets(prev => ({
              ...prev,
              [panelId]: {
                  ...prev[panelId],
                  status: gameState === 'WAITING' ? 'BET_ACTIVE' : 'BETTING_NEXT',
                  amount: amount,
                  betId: res.data.betId,
                  targetMultiplier: autoOptions?.targetMultiplier ? parseFloat(autoOptions.targetMultiplier) : null
              }
          }));

          // Add to live bets if game is waiting
          if (gameState === 'WAITING') {
              setLiveBets(prev => [{
                  id: `user-${panelId}`,
                  user: username,
                  amount: amount,
                  cashedOut: false,
                  multiplier: null,
                  isUser: true
              }, ...prev]);
          }
      }
    } catch (err) {
      console.error(err);
      const errorMessage = err.response?.data?.error || "Failed to place bet";
      if (errorMessage === 'Insufficient balance') {
         setError('Insufficient balance to place bet');
      } else {
         setError(errorMessage);
      }
      setTimeout(() => setError(null), 3000);
    }
  };

  // Helper to generate random crash point
  const generateCrashPoint = () => {
    // Simple algorithm: 1 / (random) but with house edge
    // For simulation: heavy weight on low numbers
    const r = Math.random();
    // 1% chance of instant crash at 1.00x
    if (r < 0.01) return 1.00;
    
    // E = 0.99 / (1 - r)
    const crash = 0.99 / (1 - r);
    return Math.max(1.00, Math.floor(crash * 100) / 100);
  };

  // Start Game Loop
  const startGame = useCallback(() => {
    setGameState('FLYING');
    gameStateRef.current = 'FLYING';
    setMultiplier(1.00);
    startTimeRef.current = Date.now();
    crashPointRef.current = generateCrashPoint();
    trailRef.current = [];
    cashingOutRef.current = { 1: false, 2: false };
    
    // Process User Bets for New Round
    let activeUserBets = [];
    setUserBets(prev => {
        const newBets = { ...prev };
        [1, 2].forEach(id => {
            // If bet was queued for next round, make it active
            if (newBets[id].status === 'BETTING_NEXT') {
                newBets[id] = { ...newBets[id], status: 'BET_ACTIVE', cashOutMult: null, winAmount: 0 };
                activeUserBets.push({
                    id: `user-${id}`,
                    user: username,
                    amount: newBets[id].amount,
                    cashedOut: false,
                    multiplier: null,
                    isUser: true
                });
            } 
            // If it was CASHED_OUT from previous round, reset to NO_BET
            else if (newBets[id].status === 'CASHED_OUT') {
                newBets[id] = { ...newBets[id], status: 'NO_BET', cashOutMult: null, winAmount: 0, betId: null };
            }
            // If it was already active (placed during waiting), add to list if not already there?
            // Actually, handlePlaceBet adds it immediately if WAITING.
            // But we reset liveBets below, so we need to re-add them.
            else if (newBets[id].status === 'BET_ACTIVE') {
                 activeUserBets.push({
                    id: `user-${id}`,
                    user: username,
                    amount: newBets[id].amount,
                    cashedOut: false,
                    multiplier: null,
                    isUser: true
                });
            }
        });
        return newBets;
    });

    // Generate fake bets for this round
    const fakeBets = Array(30).fill(0).map((_, i) => {
      // Logic for target multiplier
      let target;
      const r = Math.random();
      
      // More random distribution for "winnings should be random"
      if (r < 0.5) { // 50% early cashout (1.10 - 2.00)
         target = 1.10 + Math.random() * 0.90;
      } else if (r < 0.8) { // 30% mid range (2.00 - 10.00)
         target = 2.00 + Math.random() * 8.00;
      } else { // 20% moon shots (10.00 - 100.00+)
         // Exponential distribution for high multipliers
         target = 10.00 + Math.exp(Math.random() * 4); 
      }

      // Randomize bet amounts more
      let amount;
      const rAmount = Math.random();
      if (rAmount < 0.7) amount = Math.floor(Math.random() * 50 + 5); // Small bets
      else if (rAmount < 0.95) amount = Math.floor(Math.random() * 500 + 50); // Medium bets
      else amount = Math.floor(Math.random() * 5000 + 500); // High rollers

      return {
        id: i,
        user: generateFakeUser(),
        amount: amount,
        cashedOut: false,
        lost: false,
        multiplier: null,
        targetMultiplier: target
      };
    });
    setLiveBets([...activeUserBets, ...fakeBets]);

    requestRef.current = requestAnimationFrame(animateGame);
  }, []);

  // Animation Loop
  const animateGame = () => {
    const now = Date.now();
    const elapsed = (now - startTimeRef.current) / 1000;
    
    if (gameStateRef.current === 'CRASHED') {
        // Continue animating fly away
        drawGame(crashPointRef.current, true);
        
        // Stop animation after 2 seconds of fly away
        if (now - crashTimeRef.current < 2000) {
            requestRef.current = requestAnimationFrame(animateGame);
        }
        return;
    }
    
    // Growth function: k * e^(r*t)
    // Adjust 'r' to control speed. 0.06 is slow, 0.1 is faster.
    
    // Using a simpler exponential curve for Aviator feel
    // growth = e^(0.06 * t)
    const growth = Math.exp(0.06 * elapsed);
    
    if (growth >= crashPointRef.current) {
      // Check for missed auto-cashouts due to frame skip
      [1, 2].forEach(id => {
          const bet = userBetsRef.current[id];
          if (bet.status === 'BET_ACTIVE' && 
              !cashingOutRef.current[id] && 
              bet.targetMultiplier && 
              bet.targetMultiplier <= crashPointRef.current) {
              
              // It should have cashed out
              cashingOutRef.current[id] = true;
              handleCashOut(id, bet.targetMultiplier);
          }
      });

      handleCrash(crashPointRef.current);
      // Continue loop for fly away frame
      requestRef.current = requestAnimationFrame(animateGame);
    } else {
      setMultiplier(growth);
      
      // Update fake bets (cash out if they reached their target)
      setLiveBets(prev => prev.map(bet => {
        if (!bet.cashedOut && !bet.lost && growth >= bet.targetMultiplier) {
          return { ...bet, cashedOut: true, multiplier: bet.targetMultiplier.toFixed(2) };
        }
        return bet;
      }));

      // Auto Cashout Check for User
      [1, 2].forEach(id => {
          const bet = userBetsRef.current[id];
          if (bet.status === 'BET_ACTIVE' && 
              !cashingOutRef.current[id] && 
              bet.targetMultiplier && 
              growth >= bet.targetMultiplier) {
              
              cashingOutRef.current[id] = true;
              handleCashOut(id, bet.targetMultiplier);
          }
      });

      drawGame(growth, false);
      requestRef.current = requestAnimationFrame(animateGame);
    }
  };

  const handleCrash = (finalMultiplier) => {
    setGameState('CRASHED');
    gameStateRef.current = 'CRASHED';
    setMultiplier(finalMultiplier);
    crashTimeRef.current = Date.now();
    setHistory(prev => [finalMultiplier, ...prev].slice(0, 100));
    
    // Mark all active live bets as lost (losses blend)
    setLiveBets(prev => prev.map(bet => {
        if (!bet.cashedOut) {
            return { ...bet, lost: true };
        }
        return bet;
    }));
    
    // Resolve Active Bets as Lost
    setUserBets(prev => {
        const newBets = { ...prev };
        [1, 2].forEach(id => {
            if (newBets[id].status === 'BET_ACTIVE' && !cashingOutRef.current[id]) {
                // Lost
                newBets[id] = { ...newBets[id], status: 'NO_BET', amount: 0 };
            }
        });
        return newBets;
    });

    // Start countdown for next round
    let count = 5;
    setCountdown(count);
    const interval = setInterval(() => {
      count -= 1;
      setCountdown(count);
      if (count <= 0) {
        clearInterval(interval);
        setGameState('WAITING');
        // Auto-bet logic would go here
        startGame();
      }
    }, 1000);
  };

  // Drawing Logic
  const drawGame = (currentMult, isCrashed) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    
    const currentGameState = gameStateRef.current;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Draw Grid/Background lines
    // We want a subtle grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Vertical lines
    for (let i = 0; i < width; i += 100) {
        ctx.moveTo(i, 0); ctx.lineTo(i, height);
    }
    // Horizontal lines
    for (let i = 0; i < height; i += 100) {
        ctx.moveTo(0, i); ctx.lineTo(width, i);
    }
    ctx.stroke();

    // Axes
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(20, height - 20);
    ctx.lineTo(width, height - 20); // X axis
    ctx.moveTo(20, height - 20);
    ctx.lineTo(20, 0); // Y axis
    ctx.stroke();

    // Common Variables
    // Smooth auto-scaling
    let timeForScaling = (Date.now() - startTimeRef.current)/1000;
    if (isCrashed) {
        timeForScaling = (crashTimeRef.current - startTimeRef.current)/1000;
    }
    
    const maxTime = Math.max(10, timeForScaling + 4); 
    const maxMult = Math.max(2, currentMult * 1.3);

    // X Axis: 20px left padding, 20px right padding
    const getX = (t) => 20 + (t / maxTime) * (width - 40);
    // Y Axis: 20px top padding, 20px bottom padding
    const getY = (m) => (height - 20) - ((m - 1) / (maxMult - 1)) * (height - 40);

    if (currentGameState === 'WAITING') {
      // Draw static plane at origin
      // Draw Plane at start position (idling)
      // Idle animation for propeller
      const idleTime = Date.now() / 1000;
      // Slight hover effect
      const hoverY = Math.sin(idleTime * 2) * 5;
      
      drawPlane(ctx, 20, height - 20 + hoverY, -0.1, 1.0, Date.now());
      return;
    }

    // Calculate Curve
    // X axis: Time (0 to 10s view window, scaling as time goes)
    // Y axis: Multiplier (1 to 2x, 5x, etc)
    
    // Draw Axes Labels
    ctx.fillStyle = '#666';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom'; // Ensure baseline is consistent (reset from 'middle' used later)
    
    // X Axis Labels (Time)
    for (let t = 0; t <= Math.floor(maxTime); t += 2) {
        const x = getX(t);
        if (x < width) {
            ctx.fillText(`${t}s`, x, height - 5);
        }
    }
    
    // Y Axis Labels (Multiplier)
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    // Decide step size based on maxMult
    let stepY = 0.2;
    if (maxMult > 5) stepY = 1;
    if (maxMult > 20) stepY = 5;
    if (maxMult > 100) stepY = 20;

    for (let m = 1; m <= maxMult; m += stepY) {
        const y = getY(m);
        if (y > 0 && y < height - 20) {
            ctx.fillText(`${m.toFixed(1)}x`, 15, y);
        }
    }

    // Calculate Curve Vars
    const step = 0.05; 
    let curveEndTime = (Date.now() - startTimeRef.current) / 1000;
    if (isCrashed) {
        curveEndTime = (crashTimeRef.current - startTimeRef.current) / 1000;
    }
    const tipMult = Math.exp(0.06 * curveEndTime);

    // Draw Curve (only if not crashed)
    if (!isCrashed) {
        const ctxCurve = canvas.getContext('2d');
        
        // Gradient fill under curve
        const strokeGradient = ctxCurve.createLinearGradient(0, height, 0, 0);
        strokeGradient.addColorStop(0, 'rgba(255, 100, 100, 0.1)');
        strokeGradient.addColorStop(0.5, 'rgba(255, 50, 50, 0.6)');
        strokeGradient.addColorStop(1, 'rgba(255, 0, 0, 1)');
        
        const fillGradient = ctxCurve.createLinearGradient(0, 0, 0, height);
        fillGradient.addColorStop(0, 'rgba(225, 31, 65, 0.2)'); // Top red (more transparent)
        fillGradient.addColorStop(1, 'rgba(225, 31, 65, 0.0)'); // Bottom transparent
        
        ctx.beginPath();
        ctx.strokeStyle = strokeGradient; // Use the glowing gradient
        ctx.lineWidth = 8; // Thicker line
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = '#ff4444';
        ctx.shadowBlur = 20; // Glow effect
        
        ctx.moveTo(getX(0), getY(1));
        
        for (let t = 0; t <= curveEndTime; t += step) {
            const m = Math.exp(0.06 * t);
            ctx.lineTo(getX(t), getY(m));
        }
        ctx.lineTo(getX(curveEndTime), getY(tipMult));
        
        ctx.stroke();
        
        // Reset shadow for other elements
        ctx.shadowBlur = 0;

        // Fill under curve
        ctx.save();
        ctx.lineTo(getX(curveEndTime), height); // Go down to bottom
        ctx.lineTo(getX(0), height); // Go left to start
        ctx.closePath();
        ctx.fillStyle = fillGradient;
        ctx.fill();
        ctx.restore();
    }

    // Draw Plane
      // Calculate tip of the curve (where the line ends)
      const tipX = getX(curveEndTime);
      const tipY = getY(tipMult);
      
      // Calculate angle based on derivative for the curve tip
      const prevT = Math.max(0, curveEndTime - 0.1);
      const prevX = getX(prevT);
      const prevY = getY(Math.exp(0.06 * prevT));
      const curveAngle = Math.atan2(tipY - prevY, tipX - prevX);
      
      let planeX, planeY, planeAngle;
      
      if (!isCrashed) {
          planeX = tipX;
          planeY = tipY;
          planeAngle = curveAngle;
      } else {
          // Fly Away Animation
          const timeSinceCrash = (Date.now() - crashTimeRef.current) / 1000;
          const speed = 600; // pixels per second
          const flyAngle = curveAngle - 0.5; // Pitch up 30 degrees roughly
          
          planeX = tipX + Math.cos(flyAngle) * speed * timeSinceCrash;
          planeY = tipY + Math.sin(flyAngle) * speed * timeSinceCrash;
          planeAngle = curveAngle - 0.2 * timeSinceCrash;
      }
      
      // Scale logic - Increased scale for visibility
      let dynamicScale = Math.max(0.6, 1.0 - (curveEndTime / 20) * 0.4); 
      if (isCrashed) {
           const timeSinceCrash = (Date.now() - crashTimeRef.current) / 1000;
           // Shrink slightly as it flies away
           dynamicScale *= Math.max(0, 1 - timeSinceCrash * 0.3);
      }
      const planeScale = dynamicScale;

      // Trail Logic
      // Only record trail if NOT crashed
      if (currentGameState === 'FLYING' && !isCrashed) {
          trailRef.current.push({ x: planeX, y: planeY, time: Date.now() });
      }
      
      // Clean old trail
      const now = Date.now();
      trailRef.current = trailRef.current.filter(p => now - p.time < 1500);

      // Draw Trail (Red Line Behind)
      // Note: The curve itself is red and glowing. The trailRef adds a tail.
      // We keep it as requested.
      if (!isCrashed && trailRef.current.length > 1) {
          ctx.save();
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          
          ctx.beginPath();
          const startP = trailRef.current[0];
          ctx.moveTo(startP.x, startP.y);
          
          for (let i = 1; i < trailRef.current.length; i++) {
              const p = trailRef.current[i];
              ctx.lineTo(p.x, p.y);
          }
          
          ctx.strokeStyle = '#f44336'; // Bright Red
          ctx.lineWidth = 4;
          ctx.shadowColor = '#d32f2f';
          ctx.shadowBlur = 10;
          ctx.stroke();
          ctx.restore();
      }

      if (planeScale > 0.01) {
        // Draw a glow behind the plane
        ctx.save();
        ctx.translate(planeX, planeY);
        ctx.beginPath();
        ctx.arc(0, 0, 40 * planeScale, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 68, 68, 0.2)';
        ctx.fill();
        ctx.restore();
        
        drawPlane(ctx, planeX, planeY, planeAngle, planeScale, Date.now());
      }
    };

    const drawPlane = (ctx, x, y, angle, scale, time) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle); 
      // Base scale adjustment
      const s = scale * 0.9;
      ctx.scale(s, s);

      // Shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 5;
      ctx.shadowOffsetY = 5;

      // --- REALISTIC SPRIBE-LIKE CESSNA ---
      
      const redPrimary = '#d32f2f'; // Classic Aviator Red
      const redDark = '#b71c1c';
      const redLight = '#ef5350';
      
      // 1. Far Wing (Behind Fuselage)
      ctx.fillStyle = redDark;
      ctx.beginPath();
      ctx.moveTo(10, -5);
      ctx.lineTo(-15, -45); // Swept back top wing
      ctx.lineTo(5, -45);
      ctx.lineTo(35, -5);
      ctx.fill();

      // 2. Propeller (Spinning Blur)
      ctx.save();
      ctx.translate(65, 5); // Nose position
      const propAngle = (time / 15) % (Math.PI * 2); 
      ctx.rotate(propAngle);
      
      // Propeller Blur Disc
      ctx.beginPath();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.fill();
      
      // Propeller Blades (Motion blurred)
      ctx.fillStyle = 'rgba(50, 50, 50, 0.6)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 3, 32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, 0, 32, 3, 0, 0, Math.PI * 2); // Cross blade
      ctx.fill();
      ctx.restore();

      // 3. Fuselage (Body)
      const bodyGrad = ctx.createLinearGradient(0, -20, 0, 20);
      bodyGrad.addColorStop(0, redLight);
      bodyGrad.addColorStop(0.5, redPrimary);
      bodyGrad.addColorStop(1, redDark);

      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      // Nose
      ctx.moveTo(70, 5);
      ctx.quadraticCurveTo(70, -5, 60, -8);
      // Hood to Windshield
      ctx.lineTo(35, -10);
      // Windshield
      ctx.lineTo(20, -22);
      // Roof
      ctx.lineTo(-10, -22);
      // Rear Window slope
      ctx.lineTo(-30, -15);
      // Tail cone top
      ctx.lineTo(-60, -10);
      // Vertical Stabilizer (Tail Fin) - Classic Cessna shape
      ctx.lineTo(-70, -35); // Leading edge of tail
      ctx.lineTo(-85, -35); // Top of tail
      ctx.lineTo(-80, -5);  // Trailing edge
      // Tail cone bottom
      ctx.lineTo(-85, 0);
      ctx.lineTo(-70, 5);
      // Belly
      ctx.quadraticCurveTo(-20, 15, 60, 10);
      ctx.quadraticCurveTo(70, 10, 70, 5);
      ctx.fill();
      
      // Fuselage Shine/Highlight
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(60, -5);
      ctx.lineTo(20, -8);
      ctx.stroke();

      // 4. Cockpit Window (Side View)
      ctx.fillStyle = '#37474f'; // Dark interior
      ctx.beginPath();
      ctx.moveTo(35, -10);
      ctx.lineTo(20, -22); // A-pillar
      ctx.lineTo(-5, -22); // Roof line
      ctx.lineTo(-5, -12); // B-pillar
      ctx.lineTo(35, -10); // Bottom sill
      ctx.fill();
      
      // Glass Reflection
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.moveTo(22, -20);
      ctx.lineTo(15, -14);
      ctx.lineTo(28, -12);
      ctx.fill();

      // 5. Near Wing (Foreground)
      const wingGrad = ctx.createLinearGradient(0, 0, 0, 40);
      wingGrad.addColorStop(0, '#ff5252');
      wingGrad.addColorStop(1, '#b71c1c');
      
      ctx.fillStyle = wingGrad;
      ctx.beginPath();
      ctx.moveTo(25, -5); // Wing root leading edge
      ctx.lineTo(5, 45);  // Wing tip leading edge
      ctx.lineTo(25, 45); // Wing tip trailing edge
      ctx.lineTo(45, -5); // Wing root trailing edge
      ctx.fill();
      
      // Wing Strut (Classic Cessna detail)
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(15, 30); // Mid-wing
      ctx.lineTo(25, 10); // Fuselage connection
      ctx.stroke();

      // 6. Landing Gear (Main)
      ctx.save();
      ctx.translate(20, 20); // Gear position
      // Strut
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(-5, 10);
      ctx.stroke();
      // Wheel pants (Streamlined cover)
      ctx.fillStyle = redDark;
      ctx.beginPath();
      ctx.ellipse(-5, 12, 10, 6, 0.1, 0, Math.PI * 2);
      ctx.fill();
      // Tire
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.ellipse(-5, 15, 8, 3, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      
      // 7. Engine Cowling Details
      ctx.fillStyle = '#212121'; // Air intake
      ctx.beginPath();
      ctx.ellipse(65, 2, 2, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

  // Setup Canvas size
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const parent = canvasRef.current.parentElement;
        canvasRef.current.width = parent.clientWidth;
        canvasRef.current.height = parent.clientHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    
    // Initial start
    const timer = setTimeout(() => {
        if (gameState === 'WAITING') startGame();
    }, 1000);

    return () => {
        window.removeEventListener('resize', handleResize);
        cancelAnimationFrame(requestRef.current);
        clearTimeout(timer);
    };
  }, [startGame]); // gameState dependency removed to avoid restart loops

  // Handlers (duplicate removed)


  const handleCashOut = async (panelId, specificMultiplier = null) => {
      const bet = userBetsRef.current[panelId];
      
      // If manual cashout (no specific multiplier), check and set lock
      if (!specificMultiplier) {
          if (cashingOutRef.current[panelId]) return;
          cashingOutRef.current[panelId] = true;
      }
      // Note: If called from animateGame (specificMultiplier set), we assume lock was set there

      const currentMult = specificMultiplier || multiplier;

      if (bet.status === 'BET_ACTIVE' && gameStateRef.current === 'FLYING') {
          const win = bet.amount * currentMult;

          // Optimistic Update: Add winnings immediately
          const previousBalance = user.balance;
          const previousBonus = user.balanceBonus;

          // Simple optimistic addition (Server is source of truth)
          dispatch(updateBalance((previousBalance || 0) + win));
          
          try {
             const res = await apiService.cashOutAviator({ 
                 amount: win, 
                 type: balanceMode, 
                 multiplier: currentMult,
                 betId: bet.betId
             });
             
             if (res.data.success) {
                 if (res.data.balance !== undefined) {
                     dispatch(updateBalance(res.data.balance));
                     dispatch(updateBalanceBonus(res.data.balanceBonus));
                 }
                 
                 setUserBets(prev => ({
                    ...prev,
                    [panelId]: {
                        ...prev[panelId],
                        status: 'CASHED_OUT',
                        cashOutMult: currentMult,
                        winAmount: win
                    }
                 }));
                 
                 // Update live bets
                 setLiveBets(prev => prev.map(b => 
                     b.id === `user-${panelId}` ? { ...b, cashedOut: true, multiplier: currentMult.toFixed(2) } : b
                 ));
             }
          } catch (err) {
             console.error("Cashout failed", err);
             // Rollback on error
             dispatch(updateBalance(previousBalance));
             dispatch(updateBalanceBonus(previousBonus));
             
             const errorMessage = err.response?.data?.error || "Cashout failed";
             setError(errorMessage);
             setTimeout(() => setError(null), 3000);
          }
      }
  };

  // State for Top Winners
  const [showTopWinners, setShowTopWinners] = useState(false);
  const [topWinnersFilter, setTopWinnersFilter] = useState('day');
  const [topWinnersData, setTopWinnersData] = useState([]);

  // Generate mock top winners data
  useEffect(() => {
    if (showTopWinners) {
      const generateWinners = (count) => {
        return Array.from({ length: count }, (_, i) => ({
          rank: i + 1,
          user: realNames[Math.floor(Math.random() * realNames.length)],
          bet: (Math.random() * 100 + 10).toFixed(2),
          multiplier: (Math.random() * 10 + 1.5).toFixed(2),
          win: (Math.random() * 500 + 50).toFixed(2)
        }));
      };
      setTopWinnersData(generateWinners(10)); // Generate 10 mock winners
    }
  }, [showTopWinners, topWinnersFilter]);

  const handleCancel = async (panelId) => {
      const bet = userBets[panelId];
      // Can cancel if waiting or betting_next
      if (bet.status === 'BETTING_NEXT' || (bet.status === 'BET_ACTIVE' && gameState === 'WAITING')) {
          try {
             const res = await apiService.cancelAviatorBet({ 
                 amount: bet.amount, 
                 type: balanceMode,
                 betId: bet.betId
             });
             if (res.data.success) {
                 if (res.data.balance !== undefined) {
                     dispatch(updateBalance(res.data.balance));
                     dispatch(updateBalanceBonus(res.data.balanceBonus));
                 }
                 
                 setUserBets(prev => ({
                     ...prev,
                     [panelId]: {
                         ...prev[panelId],
                         status: 'NO_BET',
                         amount: 0,
                         betId: null
                     }
                 }));
             }
          } catch (err) {
              console.error("Cancel failed", err);
              const errorMessage = err.response?.data?.error || "Failed to cancel bet";
              setError(errorMessage);
              setTimeout(() => setError(null), 3000);
          }
      }
  };

  const handleChatSubmit = (e) => {
    e.preventDefault();
    if (chatInput.trim()) {
      setChatMessages(prev => [...prev, { user: 'You', text: chatInput }]);
      setChatInput('');
    }
  };

  return (
    <div className="aviator-container">
      {error && (
        <div className="aviator-error-toast">
          {error}
        </div>
      )}
      <button 
        className="close-game-btn"
        onClick={() => navigate('/')}
        aria-label="Close Game"
      >
        ×
      </button>
      {/* Left Panel: Live Bets */}
      <div className="left-panel">
        <div className="panel-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '20px' }}>
          <button
            onClick={() => setShowTopWinners(false)}
            style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: !showTopWinners ? '#fff' : '#888',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                padding: 0,
                textTransform: 'uppercase',
                borderBottom: !showTopWinners ? '2px solid #e91e63' : '2px solid transparent',
                paddingBottom: '4px'
            }}
          >
            All Bets
          </button>
          
          <button 
            onClick={() => setShowTopWinners(true)}
            title="Top Winners"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: showTopWinners ? '#fff' : '#888',
              fontSize: '0.9rem',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: 0,
              textTransform: 'uppercase',
              borderBottom: showTopWinners ? '2px solid #e91e63' : '2px solid transparent',
              paddingBottom: '4px'
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>🏆</span>
            Top Winners
          </button>
        </div>

        {showTopWinners ? (
            <div className="top-winners-panel">
                <div className="filter-tabs" style={{ display: 'flex', gap: '5px', padding: '10px', background: '#0f0f0f' }}>
                    {['day', 'week', 'month'].map(filter => (
                        <button
                            key={filter}
                            onClick={() => setTopWinnersFilter(filter)}
                            style={{
                                flex: 1,
                                padding: '4px',
                                background: topWinnersFilter === filter ? '#e91e63' : '#333',
                                border: 'none',
                                borderRadius: '4px',
                                color: 'white',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                textTransform: 'capitalize'
                            }}
                        >
                            {filter}
                        </button>
                    ))}
                </div>
                <div className="live-bets-list">
                    <div className="bet-row header">
                        <span className="col-user" style={{width: '10%'}}>#</span>
                        <span className="col-user" style={{width: '40%'}}>Player</span>
                        <span className="col-mult">Mult</span>
                        <span className="col-win">Win</span>
                    </div>
                    {topWinnersData.map((winner, idx) => (
                        <div key={idx} className="bet-row" style={{ background: idx < 3 ? 'rgba(255, 215, 0, 0.05)' : 'transparent' }}>
                            <span className="col-user" style={{width: '10%', color: idx === 0 ? '#FFD700' : idx === 1 ? '#C0C0C0' : idx === 2 ? '#CD7F32' : '#666'}}>{winner.rank}</span>
                            <span className="col-user" style={{width: '40%'}}>{winner.user}</span>
                            <span className="col-mult" style={{color: '#e91e63'}}>{winner.multiplier}x</span>
                            <span className="col-win">${winner.win}</span>
                        </div>
                    ))}
                </div>
            </div>
        ) : (
        <div className="live-bets-list">
          <div className="bet-row header">
            <span className="col-user">Player</span>
            <span className="col-bet">Bet</span>
            <span className="col-mult">x</span>
            <span className="col-win">Win</span>
          </div>
          {liveBets.map((bet, idx) => (
            <div key={idx} className={`bet-row ${bet.cashedOut ? 'cashed-out' : ''} ${bet.lost ? 'lost' : ''}`}>
              <span className="col-user">{bet.user}</span>
              <span className="col-bet">${bet.amount}</span>
              <span className="col-mult">
                {bet.cashedOut ? `${bet.multiplier}x` : '-'}
              </span>
              <span className="col-win">
                {bet.cashedOut ? `$${(parseFloat(bet.amount) * parseFloat(bet.multiplier)).toFixed(2)}` : '-'}
              </span>
            </div>
          ))}
        </div>
        )}
      </div>

      {/* Center: Game Area */}
      <div className="game-area">
        <div className="top-bar">
            <div className="top-bar-header">
                <div className="logo">AVIATOR</div>
                <div className="balance-controls" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div className="balance" style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#4caf50' }}>
                        ${balance.toFixed(2)}
                    </div>
                </div>
            </div>
            <div className="history-strip">
                {history.map((mult, idx) => (
                    <div key={idx} className={`history-item ${mult >= 10 ? 'high' : mult < 2 ? 'crash' : ''}`}>
                        {mult.toFixed(2)}x
                    </div>
                ))}
            </div>
        </div>

        <div className="game-stage">
            <canvas ref={canvasRef} className="game-canvas" />
            
            {gameState === 'FLYING' && (
                <div className="multiplier-display">
                    {multiplier.toFixed(2)}x
                </div>
            )}
            
            {gameState === 'CRASHED' && (
                <>
                    <div className="multiplier-display crashed">
                        <span className="flew-away-text">FLEW AWAY!</span>
                        <span className="crashed-multiplier">{multiplier.toFixed(2)}x</span>
                    </div>
                    
                    <div className="next-round-overlay">
                        <div className="next-round-text">Next round in {countdown}s</div>
                        <div className="progress-bar-bg">
                            <div className="progress-bar-fill" />
                        </div>
                    </div>
                </>
            )}

            {((userBets[1].status === 'CASHED_OUT' && userBets[1].winAmount > 0) || 
              (userBets[2].status === 'CASHED_OUT' && userBets[2].winAmount > 0)) && (
                <div className="win-popup" style={{
                    position: 'absolute', 
                    top: '20%', 
                    left: '50%', 
                    transform: 'translate(-50%, -50%)',
                    backgroundColor: 'rgba(0, 230, 118, 0.9)',
                    padding: '10px 20px',
                    borderRadius: '20px',
                    color: '#003300',
                    fontWeight: 'bold',
                    zIndex: 20
                }}>
                    YOU WON ${((userBets[1].status === 'CASHED_OUT' ? userBets[1].winAmount : 0) + 
                               (userBets[2].status === 'CASHED_OUT' ? userBets[2].winAmount : 0)).toFixed(2)}
                </div>
            )}
        </div>

        {/* Dual Betting Controls */}
        <div className="bet-controls">
            <BettingPanel 
                id={1}
                balance={balance}
                gameState={gameState}
                currentMultiplier={multiplier}
                onPlaceBet={handlePlaceBet}
                onCashOut={handleCashOut}
                onCancel={handleCancel}
                betStatus={userBets[1].status}
                cashOutMult={userBets[1].cashOutMult}
                winnings={userBets[1].winAmount}
            />
            <BettingPanel 
                id={2}
                balance={balance}
                gameState={gameState}
                currentMultiplier={multiplier}
                onPlaceBet={handlePlaceBet}
                onCashOut={handleCashOut}
                onCancel={handleCancel}
                betStatus={userBets[2].status}
                cashOutMult={userBets[2].cashOutMult}
                winnings={userBets[2].winAmount}
            />
        </div>
      </div>

      {/* Right Panel: Chat */}
      <div className="right-panel">
         <div className="panel-header">
             <span>Chat</span>
         </div>
         <div className="chat-messages" ref={chatContainerRef}>
             {chatMessages.map((msg, idx) => (
                 <div key={idx} className="chat-msg">
                     <span className="chat-user">{msg.user}:</span>
                     <span className="chat-text">{msg.text}</span>
                 </div>
             ))}
         </div>
         <form className="chat-input-area" onSubmit={handleChatSubmit}>
             <input 
                type="text" 
                className="chat-input" 
                placeholder="Say something..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
             />
             <button type="submit" className="send-btn">Send</button>
         </form>
      </div>
    </div>
  );
};

export default Aviator;
