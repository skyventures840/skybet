import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { setUser } from '../store/slices/authSlice';
import '../index.css';
import apiService from '../services/api'; 

const WheelOfFortune = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loggedIn } = useSelector(state => state.auth);
  const [betAmount, setBetAmount] = useState('');
  const [selectedMultiplier, setSelectedMultiplier] = useState(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [liveSpins, setLiveSpins] = useState([]);
  const [error, setError] = useState('');
  const wheelRef = useRef(null);
  const containerRef = useRef(null);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  const [windowHeight, setWindowHeight] = useState(typeof window !== 'undefined' ? window.innerHeight : 768);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setWindowHeight(window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const width = windowWidth;
  const height = windowHeight;
  const isMobile = width <= 767;
  
  // Calculate wheel size based on min dimension to prevent skewing
  // On mobile, use 70% of the smaller dimension for perfect fit and roundness
  // On desktop, keep original 40% width capped at 500px
  const wheelSize = isMobile ? Math.min(width, height) * 0.70 : Math.min(width * 0.4, 500);

  const distributeSegments = (array) => {
    // 1. Separate by multiplier
    const ones = array.filter(s => s.multiplier === 1);
    const others = array.filter(s => s.multiplier !== 1);
    
    // Shuffle others to ensure randomness among them
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [others[i], others[j]] = [others[j], others[i]];
    }

    // 2. Create a fixed pattern of 24 slots
    // We have 10 '1x' segments and 14 'others'.
    // To distribute evenly, we can place '1x' at roughly equal intervals.
    // 24 / 10 = 2.4. We can use a step of ~2-3.
    // Fixed positions for 1x to ensure maximum spread:
    // Indices: 0, 2, 5, 7, 10, 12, 14, 17, 19, 22
    const fixedIndices = [0, 2, 5, 7, 10, 12, 14, 17, 19, 22];
    
    const finalSegments = new Array(24).fill(null);
    
    // Place 1x segments
    fixedIndices.forEach((index, i) => {
      if (i < ones.length) {
        finalSegments[index] = ones[i];
      }
    });

    // Fill remaining slots with others
    let otherIndex = 0;
    for (let i = 0; i < 24; i++) {
      if (!finalSegments[i]) {
        if (otherIndex < others.length) {
          finalSegments[i] = others[otherIndex++];
        } else {
          // Should not happen if counts are correct, but fallback to any remaining 1x
          // (though logic above ensures we used exactly 10 1x)
           const remainingOnes = ones.slice(fixedIndices.length);
           if (remainingOnes.length > 0) {
              finalSegments[i] = remainingOnes.shift();
           }
        }
      }
    }
    
    return finalSegments;
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


  // Create randomized wheel segments array
  const [wheelSegments, setWheelSegments] = useState(() => {
    const allSegments = segments.flatMap(({ multiplier, count, color }) =>
      Array(count).fill({ multiplier, color })
    );
    return distributeSegments(allSegments);
  });

  // Randomize segments on page refresh
  useEffect(() => {
    const allSegments = segments.flatMap(({ multiplier, count, color }) =>
      Array(count).fill({ multiplier, color })
    );
    const randomizedSegments = distributeSegments(allSegments);
    setWheelSegments(randomizedSegments);
  }, []);

  // Fake User Generation Helpers
  const generateFakeUser = () => {
    // Realistic name bases
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

    const cryptoNames = ['Satoshi', 'HODL', 'Moon', 'Whale', 'Crypto', 'BTC', 'ETH', 'Doge', 'Chain', 'Block'];

    // 5% chance for a crypto-related name
    const isCrypto = Math.random() < 0.05;
    let baseName;

    if (isCrypto) {
      baseName = cryptoNames[Math.floor(Math.random() * cryptoNames.length)];
    } else {
      // 50/50 split between real names and nicknames
      const list = Math.random() < 0.5 ? realNames : nicknames;
      baseName = list[Math.floor(Math.random() * list.length)];
    }

    // Add random numbers to make it look like a username
    // 70% chance to have 2-4 digits, 30% chance to have just name or year
    const hasNumbers = Math.random() < 0.9;
    let suffix = '';
    
    if (hasNumbers) {
      if (Math.random() < 0.3) {
        // Year style (e.g. 1995, 2002)
        suffix = Math.floor(Math.random() * 40) + 1980;
      } else {
        // Random digits (e.g. 123, 88)
        suffix = Math.floor(Math.random() * 999) + 1;
      }
    }

    // Display Logic: "Name****1" or "Name***"
    // Show full base name, mask most of the suffix
    if (!hasNumbers || suffix === '') {
      return `${baseName}***`;
    }
    
    const suffixStr = String(suffix);
    // Keep last digit visible
    return `${baseName}***${suffixStr.slice(-1)}`;
  };

  const generateFakeSpin = () => {
    const multipliers = [1, 2, 5, 10, 20];
    const weights = [0.45, 0.30, 0.15, 0.08, 0.02]; // Probabilities
    
    // Weighted random selection for multiplier
    let random = Math.random();
    let multiplier = 1;
    for (let i = 0; i < weights.length; i++) {
      if (random < weights[i]) {
        multiplier = multipliers[i];
        break;
      }
      random -= weights[i];
    }

    // Bet amounts between 5 and 10000 with realistic weighting
    const lowBets = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100];
    const midBets = [150, 200, 250, 300, 400, 500, 750];
    const highBets = [1000, 1500, 2000, 2500, 3000, 4000, 5000];
    const extremeBets = [6000, 7500, 8000, 9000, 10000];
    
    let bet;
    const r = Math.random();
    if (r < 0.6) { // 60% chance of low bet
        bet = lowBets[Math.floor(Math.random() * lowBets.length)];
    } else if (r < 0.9) { // 30% chance of mid bet
        bet = midBets[Math.floor(Math.random() * midBets.length)];
    } else if (r < 0.98) { // 8% chance of high bet
        bet = highBets[Math.floor(Math.random() * highBets.length)];
    } else { // 2% chance of extreme bet (Whale)
        bet = extremeBets[Math.floor(Math.random() * extremeBets.length)];
    }
    
    // Simulate win/loss (35% win rate for realism)
    const isWin = Math.random() < 0.35;

    return {
      id: Date.now() + Math.random().toString(36).substr(2, 9),
      user: generateFakeUser(),
      bet: bet,
      multiplier: multiplier,
      winAmount: isWin ? multiplier * bet : 0,
      timestamp: new Date()
    };
  };

  // Live Feed Simulation
  useEffect(() => {
    // Initial population
    const initialSpins = Array.from({ length: 10 }, () => generateFakeSpin());
    setLiveSpins(initialSpins);

    const interval = setInterval(() => {
      setLiveSpins(prev => {
        // Generate a batch of 5-8 random users
        const count = Math.floor(Math.random() * 4) + 5; 
        const newSpins = Array.from({ length: count }, () => generateFakeSpin());
        // Keep last 20 to handle the larger influx
        return [...newSpins, ...prev].slice(0, 20); 
      });
    }, 3000); // Add new spins every 3 seconds

    return () => clearInterval(interval);
  }, []);

  // Trigger extra fake spins when user spins to simulate activity
  useEffect(() => {
    if (isSpinning) {
      // Add a fake spin batch shortly after user starts spinning
      const timeout1 = setTimeout(() => {
        const count = Math.floor(Math.random() * 3) + 3; // 3-5 spins
        const newSpins = Array.from({ length: count }, () => generateFakeSpin());
        setLiveSpins(prev => [...newSpins, ...prev].slice(0, 20));
      }, 800);
      
      // Add another batch near the end
      const timeout2 = setTimeout(() => {
         const count = Math.floor(Math.random() * 3) + 3; // 3-5 spins
         const newSpins = Array.from({ length: count }, () => generateFakeSpin());
         setLiveSpins(prev => [...newSpins, ...prev].slice(0, 20));
      }, 2500);

      return () => {
        clearTimeout(timeout1);
        clearTimeout(timeout2);
      };
    }
  }, [isSpinning]);

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
    const baseRotation = 360 * 10;
    const finalRotation = baseRotation + (randomIndex * segmentAngle);

    // Apply rotation animation with faster speed
    if (wheelRef.current) {
      // Force hardware acceleration and high-priority transform to override any mobile CSS resets
      wheelRef.current.style.setProperty('transition', 'transform 1.6s cubic-bezier(0.22, 0.61, 0.36, 1)', 'important');
      wheelRef.current.style.setProperty('transform', `translate3d(0,0,0) rotate(${finalRotation}deg)`, 'important');
    }

    // Wait for animation to complete with reduced timeout for instant response
    setTimeout(async () => {
      setIsProcessing(true);
      
      const won = selectedSegment.multiplier === selectedMultiplier;
      const winAmount = won ? betAmount * selectedMultiplier : 0;
      const optimisticBalance = originalBalance - parseFloat(betAmount) + winAmount;
      dispatch(setUser({ 
        ...user, 
        balance: optimisticBalance,
        lifetimeWinnings: won ? (user.lifetimeWinnings || 0) + winAmount : user.lifetimeWinnings 
      }));
      
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
    }, 1700);
  };

  const compactParam = new URLSearchParams(location.search).get('compact');
  const isCompact = compactParam === '1';

  return (
    <div className={`wheel-of-fortune${isCompact ? ' compact' : ''}`}>
      <style>{`
        .wheel-container {
          /* box-shadow: 0 0 15px rgba(0,0,0,0.5); */
          /* border: 4px solid #d4af37; */ /* Gold border removed */
          border-radius: 50%;
          overflow: hidden;
          margin: 20px auto;
          position: relative;
          /* background: #333; */ /* Background removed */
        }
        .wheel-pointer {
          position: absolute;
          top: -10px;
          left: 50%;
          transform: translateX(-50%);
          width: 0; 
          height: 0; 
          border-left: 15px solid transparent;
          border-right: 15px solid transparent;
          border-top: 30px solid #ff0000;
          border-bottom: none;
          background-color: transparent;
          z-index: 50;
          filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3));
        }
        .wheel-center-hub {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 15%;
          height: 15%;
          background: radial-gradient(circle, #fff 0%, #ddd 100%);
          border-radius: 50%;
          border: 2px solid #d4af37;
          box-shadow: 0 0 10px rgba(0,0,0,0.5);
          z-index: 20;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .wheel-center-hub::after {
          content: '★';
          color: #d4af37;
          font-size: 1.5rem;
        }
        .betting-controls {
          width: 100%;
          max-width: 500px;
          margin: 0 auto;
          padding: 0 10px;
        }
        .multiplier-buttons {
          display: flex;
          justify-content: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .multiplier-btn {
          flex: 1;
          min-width: 50px;
          padding: 10px;
          font-weight: bold;
          border-radius: 8px;
        }
        .spin-btn {
          width: 100%;
          padding: 15px;
          font-size: 1.2rem;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-top: 15px;
          background: linear-gradient(to bottom, #2ecc71, #27ae60);
          box-shadow: 0 4px 0 #219150;
        }
        .spin-btn:active {
          transform: translateY(4px);
          box-shadow: none;
        }

        /* Default (Desktop) Styles for Live Feed and History */
        .info-panel {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
          justify-content: center;
          margin-top: 30px;
          max-width: 800px;
          margin-left: auto;
          margin-right: auto;
        }
        .history, .live-feed {
          flex: 1;
          min-width: 300px;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 20px;
        }
        .history h3, .live-feed h3 {
          margin-top: 0;
          margin-bottom: 15px;
          font-size: 1.1rem;
          color: var(--text-primary, #fff);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding-bottom: 10px;
        }
        .history ul, .live-feed ul {
          list-style: none;
          padding: 0;
          margin: 0;
          max-height: 300px; /* Scrollable on desktop if long */
          overflow-y: auto;
        }
        .history li, .live-feed li {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          font-size: 0.95rem;
        }
        .history li:last-child, .live-feed li:last-child {
          border-bottom: none;
        }

        /* Mobile overrides to ensure visibility and rotation */
        @media (max-width: 767px) {
          .wheel-container {
            transform: none !important; /* Prevent global translateX resets */
            overflow: visible !important; /* Allow wheel to spin outside if needed, though usually hidden */
            max-width: none !important;
            width: ${wheelSize}px !important;
            height: ${wheelSize}px !important;
            margin: 20px auto 60px auto !important; /* Increased bottom margin */
          }
          
          .wheel {
            transform-style: preserve-3d !important;
            will-change: transform !important;
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            /* Ensure no other transform is locking it */
            transform: translate3d(0,0,0) !important; 
          }

          /* Ensure segments don't get hidden */
          .wheel-segment {
             visibility: visible !important;
             backface-visibility: hidden !important;
          }

          /* History section adjustments for mobile */
          .history {
            min-height: auto !important;
            height: auto !important;
            /* Ensure enough space at bottom so content isn't covered by fixed footer/nav */
            padding-bottom: 30px !important;
            background: var(--card-bg) !important;
            border: 1px solid var(--border-color) !important;
            border-radius: 12px !important;
            padding: 15px !important;
            margin-top: 20px !important;
          }
          .live-feed {
            margin-top: 30px !important;
            background: var(--card-bg) !important;
            border: 1px solid var(--border-color) !important;
            border-radius: 12px !important;
            padding: 15px !important;
            overflow: visible !important;
            height: auto !important;
            min-height: auto !important;
          }
          .info-panel {
             display: block !important;
             height: auto !important;
             padding-bottom: 0 !important;
             margin-bottom: 0 !important;
          }
          .wheel-of-fortune {
             padding-bottom: 120px !important; /* Adjusted padding to be compact with footer */
             min-height: auto !important; /* Let content dictate height, but ensure it's enough */
             height: auto !important;
             overflow-y: visible !important;
          }
          /* Ensure the body/html doesn't lock scroll if that's an issue (global check needed, but here we can try) */
          
          .history ul, .live-feed ul {
            max-height: none !important; /* Allow full expansion */
            overflow-y: visible !important;
            height: auto !important;
            padding: 0 !important;
            list-style: none !important;
          }
          
          /* Compact list items for mobile */
          .history li, .live-feed li {
             padding: 6px 0 !important; /* Reduced padding for compact look */
             font-size: 0.85rem !important; /* Slightly smaller font */
             margin-bottom: 4px !important;
             border-bottom: 1px solid rgba(255,255,255,0.1) !important;
             display: flex !important;
             justify-content: space-between !important;
             align-items: center !important;
          }
        }
      `}</style>

      <div className="wheel-header" style={{ position: 'relative', paddingTop: 56, textAlign: 'center' }}>
        <div
          style={{
            position: 'absolute',
            left: 10,
            top: 10,
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            padding: '6px 10px',
            borderRadius: 12,
            fontWeight: 700,
            fontSize: 14,
            boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
            zIndex: 2
          }}
        >
          Balance: ${user?.balance != null ? Number(user.balance).toFixed(2) : '0.00'}
        </div>
        {isMobile && (
          <button
            onClick={() => navigate('/')}
            aria-label="Close"
            style={{
              position: 'absolute',
              right: 10,
              top: 10,
              background: 'rgba(0,0,0,0.35)',
              border: '1px solid rgba(255,255,255,0.35)',
              color: '#fff',
              fontSize: 28,
              fontWeight: 800,
              lineHeight: '1',
              width: 36,
              height: 36,
              borderRadius: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 2
            }}
          >
            ×
          </button>
        )}
        <h2>Wheel of Fortune</h2>
        <div className="promo-text">Spin the lucky wheel and win easy and big!</div>
        {!loggedIn && (
          <div className="login-prompt">Please log in to play</div>
        )}
      </div>

      <div 
        className="wheel-container" 
        ref={containerRef}
        style={{
          width: wheelSize,
          height: wheelSize,
          // Override CSS max-width/max-height if they conflict
          maxWidth: 'none',
          maxHeight: 'none',
          aspectRatio: '1 / 1'
        }}
      >
        <div className="wheel-pointer"></div>
        <div 
          className="wheel" 
          ref={wheelRef} 
          style={{ 
            willChange: 'transform',
            transform: 'translate3d(0,0,0)' 
          }}
        >
          {wheelSegments.map((segment, index) => {
            // Calculate clip-path for a pie-shaped wedge with no gaps
            const angle = segmentAngle; 
            const rad = (angle * Math.PI) / 180;
            const x1 = 50; // Center x
            const y1 = 50; // Center y
            // Extend well beyond the edge to ensure coverage
            const extend = 100; 
            const x2 = 50 + extend * Math.cos(0);
            const y2 = 50 + extend * Math.sin(0);
            const x3 = 50 + extend * Math.cos(rad);
            const y3 = 50 + extend * Math.sin(rad);

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
                  transformOrigin: '50% 50%',
                  willChange: 'transform, clip-path',
                  backfaceVisibility: 'hidden',
                  zIndex: totalSegments - index // Higher index = lower z-index
                }}
              >
                <span
                  style={{
                    display: 'block',
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: `translate(-50%, -50%) rotate(${angle / 2}deg) translate(${wheelSize * (isMobile ? 0.45 : 0.35)}px)`,
                    transformOrigin: 'center',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: isMobile ? '14px' : '16px', // Slightly larger on mobile for better readability
                    textAlign: 'center',
                    textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                    whiteSpace: 'nowrap', // Prevent text wrapping
                    lineHeight: '1', // Tighten line height for better fit
                    maxWidth: '100%', // Ensure text doesn't overflow segment
                    overflow: 'hidden', // Clip any potential overflow
                    textOverflow: 'ellipsis', // Ellipsis for any overflowing text
                    padding: '0 2px', // Small padding to prevent edge clipping
                    boxSizing: 'border-box', // Include padding in width calculation
                    wordBreak: 'keep-all', // Prevent breaking within words
                    hyphens: 'none', // Disable hyphenation
                    letterSpacing: '-0.5px', // Slight letter spacing adjustment for better fit
                    fontFamily: 'Arial, sans-serif', // Consistent font for better rendering
                    userSelect: 'none', // Prevent text selection
                    pointerEvents: 'none', // Disable pointer events on labels
                    touchAction: 'none', // Disable touch actions
                    WebkitTapHighlightColor: 'transparent', // Disable tap highlight on mobile
                    WebkitFontSmoothing: 'antialiased', // Better font rendering on WebKit
                    MozOsxFontSmoothing: 'grayscale', // Better font rendering on Firefox/Mac
                    fontSmooth: 'antialiased', // General font smoothing
                    textRendering: 'optimizeLegibility', // Optimize text rendering
                    willChange: 'transform', // Hint for better rendering
                    contain: 'layout' // Contain layout changes
                  }}
                >
                  {segment.multiplier}x
                </span>
              </div>
            );
          })}
        </div>
        {/* Center Hub for Casino Look */}
        <div className="wheel-center-hub"></div>
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
            style={{ padding: '10px', fontSize: '16px' }}
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
        <div className={`result-message ${result.won ? 'won' : 'lost'}`} style={{ margin: '10px auto' }}>
          {result.won
            ? `Congratulations! You won $${result.winAmount.toFixed(2)}!`
            : `Better luck next time! Wheel landed on ${result.multiplier}x`}
        </div>
      )}

      <div className="info-panel">
        {/* Your Spins */}
        <div className="history">
          <h3>Your Last 5 Spins</h3>
          <ul>
            {history.length === 0 ? (
               <li style={{ textAlign: 'center', opacity: 0.6 }}>No spins yet</li>
            ) : (
              history.map((spin, index) => (
                <li key={index}>
                  <span>{spin.multiplier}x</span>
                  <span style={{ 
                    fontWeight: 'bold', 
                    color: spin.winAmount > 0 ? '#2ecc71' : '#e74c3c', 
                    fontSize: '0.85em',
                    margin: '0 8px'
                  }}>
                    {spin.winAmount > 0 ? 'WON' : 'LOST'}
                  </span>
                  <span style={{ color: spin.winAmount > 0 ? '#2ecc71' : '#e74c3c' }}>
                    {spin.winAmount > 0 ? `+$${spin.winAmount.toFixed(2)}` : `-$${spin.betAmount.toFixed(2)}`}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* Live Feed */}
        <div className="live-feed">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ 
              display: 'inline-block', 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              backgroundColor: '#2ecc71',
              boxShadow: '0 0 8px #2ecc71',
              animation: 'pulse 1.5s infinite' 
            }}></span>
            Live Spins
          </h3>
          <style>{`
            @keyframes pulse {
              0% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.5; transform: scale(1.2); }
              100% { opacity: 1; transform: scale(1); }
            }
            @keyframes slideDown {
              0% { opacity: 0; transform: translateY(-20px); }
              100% { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          <ul>
            {liveSpins.map((spin, index) => (
              <li key={spin.id || index} style={{ 
                animation: index < 5 ? 'slideDown 0.5s ease-out' : 'none',
                opacity: 1 - (index * 0.05) // Fade out older items slightly
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '0.9em' }}>{spin.user}</span>
                  <span style={{ fontSize: '0.8em', opacity: 0.7 }}>Bet: ${spin.bet}</span>
                </div>
                
                <div style={{ 
                  fontWeight: 'bold', 
                  color: spin.winAmount > 0 ? '#2ecc71' : '#e74c3c',
                  fontSize: '0.85em'
                }}>
                  {spin.winAmount > 0 ? 'WON' : 'LOST'}
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ 
                    display: 'block', 
                    color: spin.multiplier > 1 ? '#f1c40f' : '#ccc', 
                    fontWeight: 'bold' 
                  }}>
                    {spin.multiplier}x
                  </span>
                  {spin.winAmount > 0 && (
                    <span style={{ fontSize: '0.8em', color: '#2ecc71' }}>
                      +${spin.winAmount.toFixed(0)}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default WheelOfFortune;
