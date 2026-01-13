import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { updateBalance, updateBalanceBonus } from '../store/slices/userSlice';
import apiService from '../services/api';
import { toast } from 'react-toastify';
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

const generateInitialHistory = (count = 14) => {
  const arr = [];
  for (let i = 0; i < count; i++) {
    const r = Math.random();
    let m;
    if (r < 0.6) m = 1.01 + Math.random() * 1.49;
    else if (r < 0.9) m = 2.0 + Math.random() * 3.0;
    else m = 10.0 + Math.random() * 20.0;
    arr.push(m);
  }
  return arr;
};

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
  const [history, setHistory] = useState(() => generateInitialHistory(14));
  const [countdown, setCountdown] = useState(5);
  
  const dispatch = useDispatch();
  const user = useSelector(state => state.user);
  const isLoggedIn = useSelector(state => state.auth?.loggedIn);

  useEffect(() => {
    const hasToken = (() => {
      try {
        const raw = localStorage.getItem('user');
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        return !!parsed?.token;
      } catch { return false; }
    })();
    if (!isLoggedIn && !hasToken) {
      navigate('/login');
    }
  }, [isLoggedIn, navigate]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiService.getAviatorHistory();
        const arr = (res?.data?.history || []).map(h => {
          const v = typeof h === 'number' ? h : (typeof h?.value === 'number' ? h.value : parseFloat(h?.value));
          return Number.isFinite(v) ? v : null;
        }).filter(v => v != null && v >= 1).slice(0, 14);
        if (!cancelled) {
          const minCount = 13;
          const need = Math.max(0, minCount - arr.length);
          const padded = need > 0 ? [...arr, ...generateInitialHistory(need)] : arr;
          setHistory(padded.slice(0, 100));
        }
      } catch (e) {
        if (!cancelled) {
          const seeded = generateInitialHistory(14);
          setHistory(seeded.slice(0, 100));
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // User State
  const [balanceMode] = useState('real');
  const [username, setUsername] = useState('You');
  
  // Hamburger Menu State
  const [showMenu, setShowMenu] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [showBetHistory, setShowBetHistory] = useState(false);
  const [myBetHistory, setMyBetHistory] = useState([]);
  const menuRef = useRef(null);
  const flightAudioRef = useRef(null);
  const flyAwayAudioRef = useRef(null);
  const flightFadeRef = useRef(null);
  const awayFadeRef = useRef(null);
  const FLIGHT_VOL = 0.4;
  const AWAY_VOL = 0.6;
  const [showHowTo, setShowHowTo] = useState(false);
  
  // Derived active balance
  const balance = (user.balance || 0) + (user.balanceBonus || 0);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
        if (menuRef.current && !menuRef.current.contains(event.target)) {
            setShowMenu(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch Bet History
  const fetchMyHistory = useCallback(async () => {
      try {
          const res = await apiService.getUserBets({ market: 'Aviator' });
          if (res.data && res.data.bets) {
              setMyBetHistory(res.data.bets);
          }
      } catch (err) {
          console.error("Failed to fetch bet history", err);
      }
  }, []);

  useEffect(() => {
    if (showBetHistory) {
        fetchMyHistory();
    }
  }, [showBetHistory, fetchMyHistory]);

  useEffect(() => {
    const flight = new Audio('/audio/aviator-loop.mp3');
    flight.loop = true;
    flight.volume = FLIGHT_VOL;
    flightAudioRef.current = flight;
    const away = new Audio('/audio/aviator-away.mp3');
    away.loop = false;
    away.volume = AWAY_VOL;
    flyAwayAudioRef.current = away;
    return () => {
      flight.pause();
      away.pause();
    };
  }, []);

  const fadeAudio = useCallback((audio, from, to, duration, rafRef, onEnd) => {
    if (!audio) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const start = performance.now();
    const clamp = (v) => Math.max(0, Math.min(1, v));
    audio.volume = clamp(from);
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const v = from + (to - from) * t;
      audio.volume = clamp(v);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
        audio.volume = clamp(to);
        if (onEnd) onEnd();
      }
    };
    rafRef.current = requestAnimationFrame(step);
  }, []);

  useEffect(() => {
    const flight = flightAudioRef.current;
    const away = flyAwayAudioRef.current;
    if (!soundEnabled) {
      if (flight) {
        flight.pause();
        flight.currentTime = 0;
      }
      if (away) {
        away.pause();
        away.currentTime = 0;
      }
      return;
    }
    if (gameState === 'FLYING') {
      if (away) {
        if (awayFadeRef.current) cancelAnimationFrame(awayFadeRef.current);
        away.pause();
        away.currentTime = 0;
        away.volume = AWAY_VOL;
      }
      if (flight) {
        if (flightFadeRef.current) cancelAnimationFrame(flightFadeRef.current);
        flight.volume = FLIGHT_VOL;
        flight.currentTime = 0;
        flight.play().catch(() => {});
      }
    } else if (gameState === 'CRASHED') {
      if (flight) {
        fadeAudio(flight, flight.volume, 0, 300, flightFadeRef, () => {
          flight.pause();
          flight.currentTime = 0;
          flight.volume = FLIGHT_VOL;
        });
      }
      if (away) {
        away.pause();
        away.currentTime = 0;
        away.volume = 0;
        away.play().then(() => {
          fadeAudio(away, 0, AWAY_VOL, 300, awayFadeRef);
        }).catch(() => {
          away.play().catch(() => {});
        });
      }
    } else if (gameState === 'WAITING') {
      if (flight) {
        if (flightFadeRef.current) cancelAnimationFrame(flightFadeRef.current);
        flight.pause();
        flight.currentTime = 0;
        flight.volume = FLIGHT_VOL;
      }
      if (away) {
        if (awayFadeRef.current) cancelAnimationFrame(awayFadeRef.current);
        away.pause();
        away.currentTime = 0;
        away.volume = AWAY_VOL;
      }
    }
  }, [gameState, soundEnabled]);

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
      if (errorMessage && errorMessage.toLowerCase().includes('insufficient balance')) {
         toast.error('Insufficient balance to place bet');
      } else {
         setError(errorMessage);
         setTimeout(() => setError(null), 3000);
      }
    }
  };

  // Helper to generate random crash point
  const generateCrashPoint = () => {
    // Simple algorithm: 1 / (random) but with house edge
    // For simulation: heavy weight on low numbers
    const r = (() => {
      try {
        if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
          const arr = new Uint32Array(1);
          window.crypto.getRandomValues(arr);
          return arr[0] / 4294967296;
        }
      } catch (e) { void e; }
      return Math.random();
    })();
    // 1% chance of instant crash at 1.00x
    if (r < 0.01) return 1.00;
    
    // E = 0.99 / (1 - r)
    const crash = 0.99 / (1 - r);
    return Math.max(1.00, Math.round(crash * 100) / 100);
  };
  
  const fetchCrashPoint = async () => {
    try {
      const res = await apiService.nextAviatorCrashPoint();
      const v = res?.data?.crashPoint;
      if (typeof v === 'number' && v >= 1) {
        const m2 = Math.max(1.00, Math.round(v * 100) / 100);
        try {
          const last = typeof window !== 'undefined' ? window.__lastCrash : null;
          if (last != null) {
            const eq2 = Math.round(m2 * 100) === Math.round(Number(last) * 100);
            const eq1 = Math.round(m2 * 10) === Math.round(Number(last) * 10);
            const eq0 = Math.round(m2) === Math.round(Number(last));
            if (eq2 || eq1 || eq0) {
              const dir = Math.random() < 0.5 ? -1 : 1;
              const step = 0.05 + Math.random() * 0.05;
              const jittered = Math.max(1.00, Math.round((m2 + dir * step) * 100) / 100);
              return jittered;
            }
          }
        } catch (e) { void e; }
        return m2;
      }
    } catch (e) { void e; }
    return generateCrashPoint();
  };

  // Start Game Loop
  const startGame = useCallback(() => {
    setGameState('FLYING');
    gameStateRef.current = 'FLYING';
    setMultiplier(1.00);
    startTimeRef.current = Date.now();
    // Decide crash before animation to avoid UI overshoot
    const baseline = generateCrashPoint();
    crashPointRef.current = baseline;
    Promise.race([
      fetchCrashPoint(),
      new Promise(resolve => setTimeout(() => resolve(baseline), 300))
    ])
    .then(v => {
      const num = typeof v === 'number' && v >= 1 ? Math.max(1.00, Math.round(v * 100) / 100) : baseline;
      crashPointRef.current = num;
      try { window.__lastCrash = num; } catch (e) { void e; }
      requestRef.current = requestAnimationFrame(animateGame);
    })
    .catch(() => {
      requestRef.current = requestAnimationFrame(animateGame);
    });
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
      if (r < 0.4) { // 40% early cashout (1.10 - 2.00)
         target = 1.10 + Math.random() * 0.90;
      } else if (r < 0.7) { // 30% mid range (2.00 - 10.00)
         target = 2.00 + Math.random() * 8.00;
      } else if (r < 0.9) { // 20% high range (10.00 - 50.00)
         target = 10.00 + Math.random() * 40.00;
      } else { // 10% HUGE winners (50x - 5000x)
         const power = Math.random();
         if (power < 0.5) target = 50 + Math.random() * 150; // 50x - 200x
         else if (power < 0.8) target = 200 + Math.random() * 800; // 200x - 1000x
         else target = 1000 + Math.random() * 4000; // 1000x - 5000x
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

    // animation starts after crash decided above
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
    const m2 = Math.max(1.00, Math.round(finalMultiplier * 100) / 100);
    setGameState('CRASHED');
    gameStateRef.current = 'CRASHED';
    setMultiplier(m2);
    try { window.__lastCrash = m2; } catch (e) { void e; }
    crashTimeRef.current = Date.now();
    setHistory(prev => [m2, ...prev].slice(0, 100));
    
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
    
    // Instant update history on crash if user had bets
    if (showBetHistory) {
        // Delay slightly to allow backend to process loss if any
        setTimeout(() => fetchMyHistory(), 500);
    }

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

    // Common Variables
    // Smooth auto-scaling
    let timeForScaling = (Date.now() - startTimeRef.current)/1000;
    if (isCrashed) {
        timeForScaling = (crashTimeRef.current - startTimeRef.current)/1000;
    }
    
    const maxTime = Math.max(10, timeForScaling + 4); 
    const maxMult = Math.max(2, currentMult * 1.3);

    // Match CSS breakpoint for mobile/tablet
    const isSmallScreen = width <= 1024;
    // User requested axis closer to border. 
    // If we use 0, it's ON the border. 
    // If we use a small padding like 5, it's close.
    // Let's stick to 0 or very small to maximize space.
    const padding = isSmallScreen ? 0 : 20;
    
    // Axes coordinates
    const axisX = padding;
    const axisY = height - padding;

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
    
    // Adjust axis drawing to be visible even if padding is 0
    // If padding is 0, we draw along the edges (0 and height)
    // But lines have thickness, so we might offset slightly if we want them fully inside
    // For simplicity, we draw exactly on the calculated axis lines
    // If axisY is height, the line might be clipped. 
    // If isSmallScreen, we might skip drawing axes lines if they are just the viewport edges, 
    // or draw them at 1px offset? 
    // Let's draw them anyway.
    
    ctx.moveTo(axisX, axisY);
    ctx.lineTo(width, axisY); // X axis
    ctx.moveTo(axisX, axisY);
    ctx.lineTo(axisX, 0); // Y axis
    ctx.stroke();

    // X Axis: padding left, padding right (if desktop)
    // If mobile, we use full width
    const getX = (t) => axisX + (t / maxTime) * (width - axisX - (isSmallScreen ? 0 : 20));
    // Y Axis: padding top, padding bottom
    const getY = (m) => axisY - ((m - 1) / (maxMult - 1)) * (axisY - (isSmallScreen ? 20 : 20)); // Keep top padding for labels/aircraft

    if (currentGameState === 'WAITING') {
      // Draw static plane at origin
      // Draw Plane at start position (idling)
      // Idle animation for propeller
      const idleTime = Date.now() / 1000;
      // Slight hover effect
      const hoverY = Math.sin(idleTime * 2) * 5;
      
      drawPlane(ctx, axisX, axisY + hoverY, -0.1, 1.0, Date.now());
      return;
    }

    // Calculate Curve
    // X axis: Time (0 to 10s view window, scaling as time goes)
    // Y axis: Multiplier (1 to 2x, 5x, etc)
    
    // Draw Axes Labels
    ctx.fillStyle = '#666';
    ctx.font = '12px Arial';
    
    // X Axis Labels (Time)
    ctx.textAlign = isSmallScreen ? 'left' : 'center';
    ctx.textBaseline = 'bottom'; 
    
    for (let t = 0; t <= Math.floor(maxTime); t += 2) {
        const x = getX(t);
        if (x < width) {
            // On mobile, lift labels up so they are inside the graph
            const yPos = isSmallScreen ? height - 5 : height - 5;
            // Actually if padding is 0, height-5 is inside.
            ctx.fillText(`${t}s`, x + (isSmallScreen ? 5 : 0), yPos);
        }
    }
    
    // Y Axis Labels (Multiplier)
    ctx.textAlign = isSmallScreen ? 'left' : 'right';
    ctx.textBaseline = 'middle';
    // Decide step size based on maxMult
    let stepY = 0.2;
    if (maxMult > 5) stepY = 1;
    if (maxMult > 20) stepY = 5;
    if (maxMult > 100) stepY = 20;

    for (let m = 1; m <= maxMult; m += stepY) {
        const y = getY(m);
        // Ensure y is within bounds
        if (y > 0 && y < axisY) {
            // On mobile, draw labels to the right of the axis (inside)
            const xPos = isSmallScreen ? 5 : 15;
            ctx.fillText(`${m.toFixed(1)}x`, xPos, y);
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
                 
                 // Instant update history if open
                 if (showBetHistory) {
                     fetchMyHistory();
                 }
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
        return Array.from({ length: count }, (_, i) => {
           // Generate realistic but huge multipliers for "Top Winners"
           let multiplier;
           const r = Math.random();
           
           if (r < 0.2) { 
               // 20% "Normal" big wins (10x - 50x)
               multiplier = 10 + Math.random() * 40;
           } else if (r < 0.6) { 
               // 40% Huge wins (50x - 200x)
               multiplier = 50 + Math.random() * 150;
           } else if (r < 0.9) { 
               // 30% Massive wins (200x - 1000x)
               multiplier = 200 + Math.random() * 800;
           } else { 
               // 10% Jackpot wins (1000x - 5000x)
               multiplier = 1000 + Math.random() * 4000;
           }

           const bet = (Math.random() * 100 + 10);
           const win = bet * multiplier;

           return {
              rank: i + 1,
              user: realNames[Math.floor(Math.random() * realNames.length)],
              bet: bet.toFixed(2),
              multiplier: multiplier.toFixed(2),
              win: win.toFixed(2)
           };
        });
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
                <div className="balance-controls">
                    <div className="balance">
                        ${balance.toFixed(2)}
                    </div>
                    {/* Hamburger Menu */}
                    <div className="hamburger-menu-container" ref={menuRef}>
                        <button 
                            className="hamburger-btn"
                            onClick={() => setShowMenu(!showMenu)}
                            aria-label="Menu"
                        >
                            <span className="hamburger-icon">☰</span>
                        </button>
                        {showMenu && (
                            <div className="hamburger-dropdown">
                                <div className="menu-profile">
                                    <div className="menu-profile-icon">
                                        {username.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="menu-profile-name">
                                        {username}
                                    </div>
                                </div>
                                
                                <div 
                                    className={`menu-item ${showBetHistory ? 'active' : ''}`}
                                    onClick={() => setShowBetHistory(!showBetHistory)}
                                >
                                    <span>My Aviator Bet History</span>
                                    <span style={{ fontSize: '0.8rem' }}>{showBetHistory ? '▲' : '▼'}</span>
                                </div>
                                
                                {showBetHistory && (
                                    <div className="bet-history-panel">
                                        <div className="bet-history-item header">
                                            <span>Time</span>
                                            <span>Mult</span>
                                            <span>Result</span>
                                        </div>
                                        {myBetHistory.length > 0 ? (
                                            myBetHistory.map((bet, idx) => {
                                                // Handle data structure differences between immediate fetch and bets.js response
                                                const odds = bet.odds?.selected || bet.odds; // Some endpoints might flatten it
                                                const actualWin = bet.odds?.actualWin !== undefined ? bet.odds.actualWin : (bet.actualWin !== undefined ? bet.actualWin : 0);
                                                const stake = bet.stake || 0;
                                                const isWin = bet.status === 'won' || actualWin > 0;

                                                return (
                                                <div key={idx} className="bet-history-item">
                                                    <span>{new Date(bet.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                    <span>{typeof odds === 'number' ? odds.toFixed(2) + 'x' : '-'}</span>
                                                    <span className={isWin ? 'win' : 'loss'}>
                                                        {isWin ? `+$${Number(actualWin).toFixed(2)}` : `-$${Number(stake).toFixed(2)}`}
                                                    </span>
                                                </div>
                                                );
                                            })
                                        ) : (
                                            <div style={{padding: '10px', textAlign: 'center', color: '#666', fontSize: '0.8rem'}}>
                                                No bets found
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="menu-item" onClick={(e) => e.stopPropagation()}>
                                    <span>Sound</span>
                                    <label className="switch">
                                        <input 
                                            type="checkbox" 
                                            checked={soundEnabled}
                                            onChange={(e) => setSoundEnabled(e.target.checked)}
                                        />
                                        <span className="slider round"></span>
                                    </label>
                                </div>

                                <div className="menu-item" onClick={() => setShowHowTo(true)}>
                                    <span>How to Play</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <button 
                        className="close-game-btn-inline"
                        onClick={() => navigate('/')}
                        aria-label="Close Game"
                    >
                        ×
                    </button>
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

        {showHowTo && (
          <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center'}}>
            <div style={{background:'#111', color:'#ddd', width:'92%', maxWidth:900, maxHeight:'85vh', overflowY:'auto', borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,0.6)'}}>
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid #222'}}>
                <div style={{fontSize:'1.2rem', fontWeight:700}}>How to Play</div>
                <button onClick={() => setShowHowTo(false)} style={{background:'none', border:'none', color:'#ccc', fontSize:'1.6rem', cursor:'pointer'}}>×</button>
              </div>
              <div style={{padding:'16px'}}>
                <div style={{display:'flex', justifyContent:'center', margin:'6px 0 18px 0'}}>
                  <svg viewBox="0 0 128 48" width="160" height="60" style={{fill:'#e91e63'}}>
                    <path d="M6 24 l24 0 6-6 14 0 12-8 16 0 18 10 -18 10 -16 0 -12-8 -14 0 -6-6 -24 0 z"></path>
                  </svg>
                </div>
                <div style={{marginBottom:14}}>
                  <div style={{fontWeight:700, marginBottom:6}}>Game Rules</div>
                  <div style={{lineHeight:1.5}}>
                    Aviator is a new generation of iGaming entertainment. You can win many times more, in seconds. Aviator is built on a provably fair system, which is currently the only real guarantee of honesty in the gambling industry.
                  </div>
                  <a href="https://spribe.co/provably-fair" target="_blank" rel="noopener noreferrer" style={{color:'#ff5252', display:'inline-block', marginTop:6}}>Read more about provably fair system</a>
                </div>
                <div style={{marginBottom:14}}>
                  <div style={{fontWeight:700, marginBottom:6}}>Aviator is as easy as 1‑2‑3</div>
                  <ul style={{margin:0, paddingLeft:18}}>
                    <li>01 — Bet before take‑off.</li>
                    <li>02 — Watch as your Lucky Plane takes off and your winnings increase.</li>
                    <li>03 — Cash Out before the plane disappears and win X times more.</li>
                  </ul>
                  <div style={{marginTop:8, lineHeight:1.5}}>
                    If you didn’t Cash Out before the Lucky Plane flies away, the bet is lost. Risk and win — it’s all in your hands.
                  </div>
                  <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12, marginTop:12}}>
                    <div style={{background:'#0d0d0d', border:'1px solid #222', borderRadius:8, padding:10}}>
                      <div style={{color:'#ccc', fontWeight:700, marginBottom:6}}>01</div>
                      <div style={{aspectRatio:'16/10', borderRadius:8, overflow:'hidden', background:'#111', display:'flex', alignItems:'center', justifyContent:'center'}}>
                        <svg viewBox="0 0 320 200" width="100%" height="100%">
                          <rect x="16" y="28" rx="16" ry="16" width="288" height="144" fill="#161616" stroke="#2a2a2a"/>
                          <rect x="36" y="48" rx="12" ry="12" width="248" height="36" fill="#0f0f0f"/>
                          <circle cx="64" cy="66" r="16" fill="#0a0a0a" stroke="#333"/>
                          <rect x="92" y="54" width="80" height="24" rx="8" fill="#222"/>
                          <rect x="180" y="54" width="80" height="24" rx="8" fill="#222"/>
                          <rect x="60" y="102" rx="14" ry="14" width="110" height="46" fill="#1b5e20"/>
                          <text x="115" y="130" fill="#c8ffc8" fontSize="22" fontWeight="700" textAnchor="middle">Bet</text>
                          <text x="280" y="54" fill="#e91e63" fontSize="18" fontWeight="700">KES</text>
                        </svg>
                      </div>
                      <div style={{color:'#ff5252', marginTop:8}}>Bet before take‑off.</div>
                    </div>
                    <div style={{background:'#0d0d0d', border:'1px solid #222', borderRadius:8, padding:10}}>
                      <div style={{color:'#ccc', fontWeight:700, marginBottom:6}}>02</div>
                      <div style={{aspectRatio:'16/10', borderRadius:8, overflow:'hidden', background:'#111', display:'flex', alignItems:'center', justifyContent:'center', position:'relative'}}>
                        <svg viewBox="0 0 320 200" width="100%" height="100%">
                          <rect x="0" y="0" width="320" height="200" fill="#0f0f0f"/>
                          <g>
                            <rect x="20" y="160" width="280" height="12" fill="#8e0d2c"/>
                            <polygon points="20,160 140,110 240,80 300,60 300,160" fill="#c2185b" opacity="0.35"/>
                          </g>
                          <text x="160" y="104" fill="#ffffff" fontSize="48" fontWeight="700" textAnchor="middle">2.25x</text>
                          <path d="M240 60 l30 -12 18 8 -18 8 -18 6 -12 -10 z" fill="#e91e63"/>
                        </svg>
                      </div>
                      <div style={{color:'#ff5252', marginTop:8}}>Watch as the plane takes off and your winnings increase.</div>
                    </div>
                    <div style={{background:'#0d0d0d', border:'1px solid #222', borderRadius:8, padding:10}}>
                      <div style={{color:'#ccc', fontWeight:700, marginBottom:6}}>03</div>
                      <div style={{aspectRatio:'16/10', borderRadius:8, overflow:'hidden', background:'#111', display:'flex', alignItems:'center', justifyContent:'center'}}>
                        <svg viewBox="0 0 320 200" width="100%" height="100%">
                          <defs>
                            <linearGradient id="g1" x1="0" y1="1" x2="1" y2="0">
                              <stop offset="0%" stopColor="#1b5e20"/>
                              <stop offset="100%" stopColor="#76ff03"/>
                            </linearGradient>
                          </defs>
                          <rect x="0" y="0" width="320" height="200" fill="#0f0f0f"/>
                          <path d="M24 168 C 96 156, 160 128, 208 92 S 280 44, 304 32" stroke="url(#g1)" strokeWidth="8" fill="none"/>
                          <circle cx="208" cy="92" r="6" fill="#76ff03"/>
                          <rect x="150" y="60" rx="10" ry="10" width="120" height="34" fill="#1b5e20" stroke="#2e7d32"/>
                          <text x="210" y="84" fill="#c8ffc8" fontSize="18" fontWeight="700" textAnchor="middle">$25.35 ✓</text>
                          <path d="M264 36 l30 -12 18 8 -18 8 -18 6 -12 -10 z" fill="#e91e63"/>
                        </svg>
                      </div>
                      <div style={{color:'#ff5252', marginTop:8}}>Cash Out before the plane disappears and win X times more.</div>
                    </div>
                  </div>
                </div>
                <div style={{marginBottom:14}}>
                  <div style={{fontWeight:700, marginBottom:6}}>More details</div>
                  <ul style={{margin:0, paddingLeft:18}}>
                    <li>The win multiplier starts at 1x and grows as the plane takes off.</li>
                    <li>Your winnings equal the Cash Out multiplier times your bet.</li>
                    <li>Before each round, the provably fair RNG sets the multiplier at which the plane flies away.</li>
                  </ul>
                </div>
                <div style={{marginBottom:14}}>
                  <div style={{fontWeight:700, marginBottom:6}}>Game functions — Bet & Cash Out</div>
                  <ul style={{margin:0, paddingLeft:18}}>
                    <li>Select an amount and press “Bet”.</li>
                    <li>Cancel the bet if the round hasn’t started.</li>
                    <li>Adjust bet size with “+” and “–”, use presets, or enter a value.</li>
                    <li>Place two bets simultaneously using the second bet panel.</li>
                    <li>Press “Cash Out” to lock winnings; win equals bet × Cash Out multiplier.</li>
                    <li>If you don’t Cash Out in time, the bet is lost.</li>
                  </ul>
                </div>
                <div style={{marginBottom:14}}>
                  <div style={{fontWeight:700, marginBottom:6}}>Auto Play & Auto Cash Out</div>
                  <ul style={{margin:0, paddingLeft:18}}>
                    <li>Choose bet size, then enable Auto Bet from the “Auto” tab.</li>
                    <li>For automatic Cash Out, set “Auto Cash Out” in the “Auto” tab.</li>
                  </ul>
                </div>
                <div style={{marginBottom:14}}>
                  <div style={{fontWeight:700, marginBottom:6}}>Live Bets & Statistics</div>
                  <ul style={{margin:0, paddingLeft:18}}>
                    <li>Live Bets panel shows all bets placed in the current round.</li>
                    <li>Top panel shows stats like biggest round multipliers.</li>
                    <li>Share round results via chat.</li>
                  </ul>
                </div>
                <div style={{marginBottom:14}}>
                  <div style={{fontWeight:700, marginBottom:6}}>Free Bets</div>
                  <ul style={{margin:0, paddingLeft:18}}>
                    <li>Check status in Game Menu › Free Bets. They may be operator or Rain awards.</li>
                  </ul>
                </div>
                <div style={{marginBottom:14}}>
                  <div style={{fontWeight:700, marginBottom:6}}>Rain Feature</div>
                  <ul style={{margin:0, paddingLeft:18}}>
                    <li>Drop Free Bets for others using the “Rain” panel; others claim via “Claim”.</li>
                  </ul>
                </div>
                <div style={{marginBottom:6}}>
                  <div style={{fontWeight:700, marginBottom:6}}>Randomisation</div>
                  <div style={{lineHeight:1.5}}>
                    Each round’s multiplier is generated by a Provably Fair algorithm and is transparent and 100% fair.
                  </div>
                  <a href="https://spribe.co/provably-fair" target="_blank" rel="noopener noreferrer" style={{color:'#ff5252', display:'inline-block', marginTop:6}}>Read more about provably fair system</a>
                </div>
                <div style={{marginBottom:14}}>
                  <div style={{fontWeight:700, marginBottom:6}}>Provably Fair</div>
                  <ul style={{margin:0, paddingLeft:18}}>
                    <li>You can check and modify Provably Fair settings in Game Menu › Provably Fair.</li>
                    <li>Check the fairness of each round by pressing the icon opposite the results in “My Bets” or inside “Top” tabs.</li>
                  </ul>
                </div>
                <div style={{marginBottom:14}}>
                  <div style={{fontWeight:700, marginBottom:6}}>Game Menu</div>
                  <ul style={{margin:0, paddingLeft:18}}>
                    <li>Access the menu from the top right corner.</li>
                    <li>Toggle “Sound” to turn game sounds on or off.</li>
                    <li>Toggle “Music” to turn background music on or off.</li>
                    <li>Toggle “Animation” to turn the airplane animation on or off.</li>
                    <li>Press “Limits” to view minimum/maximum bets and maximum win.</li>
                    <li>Press “My Bets History” to view your bet history.</li>
                    <li>Open “Game Rules” to read detailed rules of the game.</li>
                  </ul>
                </div>
                <div style={{marginBottom:14}}>
                  <div style={{fontWeight:700, marginBottom:6}}>Multi Rooms</div>
                  <ul style={{margin:0, paddingLeft:18}}>
                    <li>At the start of each session, players are randomly assigned to a room until the session ends.</li>
                    <li>Change rooms via Game Menu › Game Room.</li>
                    <li>Each room generates results independently using unique Server and Players Seed settings to guarantee Provably Fair results.</li>
                  </ul>
                </div>
                <div style={{marginBottom:6}}>
                  <div style={{fontWeight:700, marginBottom:6}}>Other</div>
                  <ul style={{margin:0, paddingLeft:18}}>
                    <li>If the internet connection is interrupted while a bet is active, the game auto cashes out with the current multiplier and adds the win to your balance.</li>
                    <li>In case of gaming hardware/software malfunction, all affected game bets and payouts are void, and affected bets are refunded.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
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
