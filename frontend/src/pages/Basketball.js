import React, { useState, useEffect } from 'react';
import MatchCard from '../components/MatchCard';
import apiService from '../services/api';

const Basketball = () => {
  const [matches, setMatches] = useState([]);
  const [filteredMatches, setFilteredMatches] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  const leagues = [
    { id: 'all', name: 'All Leagues', count: 88 },
    { id: 'nba', name: 'NBA', count: 30 },
    { id: 'college', name: 'College Basketball', count: 58 }
  ];

  // Global search functionality
  useEffect(() => {
    const handleGlobalSearch = (event) => {
      const { searchTerm: globalSearchTerm } = event.detail;
      setSearchTerm(globalSearchTerm);
    };

    const handleGlobalDateFilter = (event) => {
      const { selectedDate: globalSelectedDate } = event.detail;
      setSelectedDate(globalSelectedDate);
    };

    // Listen for global search and date filter events
    window.addEventListener('globalSearch', handleGlobalSearch);
    window.addEventListener('globalDateFilter', handleGlobalDateFilter);

    // Check for existing search term and date in localStorage
    const existingSearchTerm = localStorage.getItem('globalSearchTerm');
    const existingSelectedDate = localStorage.getItem('globalSelectedDate');
    
    if (existingSearchTerm) {
      setSearchTerm(existingSearchTerm);
    }
    if (existingSelectedDate) {
      setSelectedDate(existingSelectedDate);
    }

    return () => {
      window.removeEventListener('globalSearch', handleGlobalSearch);
      window.removeEventListener('globalDateFilter', handleGlobalDateFilter);
    };
  }, []);

  // Filter matches based on search term and date
  useEffect(() => {
    let filtered = matches;

    // Filter by search term
    if (searchTerm.trim()) {
      filtered = filtered.filter(match => {
        const searchLower = searchTerm.toLowerCase();
        return (
          match.homeTeam?.toLowerCase().includes(searchLower) ||
          match.awayTeam?.toLowerCase().includes(searchLower) ||
          match.league?.toLowerCase().includes(searchLower) ||
          match.sport?.toLowerCase().includes(searchLower)
        );
      });
    }

    // Filter by date
    if (selectedDate) {
      const selectedDateObj = new Date(selectedDate);
      selectedDateObj.setHours(0, 0, 0, 0);
      const nextDay = new Date(selectedDateObj);
      nextDay.setDate(nextDay.getDate() + 1);

      filtered = filtered.filter(match => {
        const matchDate = new Date(match.startTime);
        return matchDate >= selectedDateObj && matchDate < nextDay;
      });
    }

    // Hide past matches (only show upcoming)
    const now = new Date();
    filtered = filtered.filter(match => new Date(match.startTime) >= now);

    setFilteredMatches(filtered);
  }, [matches, searchTerm, selectedDate]);

  // Transform odds data to match frontend format
  const transformOddsToMatches = (oddsData) => {
    return oddsData
      .filter(odds => odds.sport_key === 'basketball')
      .map(odds => {
        // Get the first bookmaker's markets
        const bookmaker = odds.bookmakers?.[0];
        if (!bookmaker || !bookmaker.markets || bookmaker.markets.length === 0) {
          return null; // Skip matches with no bookmakers or markets
        }

        const h2hMarket = bookmaker.markets.find(market => market.key === 'h2h');
        const totalsMarket = bookmaker.markets.find(market => market.key === 'totals');
        
        // Check if h2h market has valid outcomes
        if (!h2hMarket || !h2hMarket.outcomes || h2hMarket.outcomes.length < 2) {
          return null; // Skip matches with invalid h2h market
        }
        
        const outcomes = h2hMarket.outcomes;
        
        // Create odds object only with valid data
        const oddsObj = {
          '1': outcomes[0]?.price || null,
          '2': outcomes[1]?.price || null
        };

        // Add totals as Over/Under with line in parentheses; do not expose raw 'Total' line
        if (totalsMarket && totalsMarket.outcomes && totalsMarket.outcomes.length >= 2) {
          const overOutcome = totalsMarket.outcomes.find(o => (o.name || '').toLowerCase().startsWith('over')) || totalsMarket.outcomes[0];
          const underOutcome = totalsMarket.outcomes.find(o => (o.name || '').toLowerCase().startsWith('under')) || totalsMarket.outcomes[1] || null;
          const point = (overOutcome && overOutcome.point != null) ? overOutcome.point : (underOutcome && underOutcome.point != null ? underOutcome.point : null);
          if (overOutcome && overOutcome.price) {
            const label = point != null ? `Over (${point})` : 'Over';
            oddsObj[label] = overOutcome.price;
          }
          if (underOutcome && underOutcome.price) {
            const label = point != null ? `Under (${point})` : 'Under';
            oddsObj[label] = underOutcome.price;
          }
        }

        // Only return match if we have at least basic odds
        if (!oddsObj['1'] || !oddsObj['2']) {
          return null;
        }
        // Also count markets that might be available but not displayed in main odds
        const displayedOddsCount = Object.keys(oddsObj).filter(key => oddsObj[key] !== null).length;
        const totalAvailableMarkets = bookmaker.markets.filter(market => 
          market.outcomes && market.outcomes.length > 0 && 
          market.outcomes.some(outcome => outcome.price > 0)
        ).length;

        // Calculate additional markets as total available minus displayed
        const actualAdditionalMarkets = Math.max(0, totalAvailableMarkets - displayedOddsCount);

        return {
          id: odds.gameId,
          league: odds.sport_title,
          time: new Date(odds.commence_time).toLocaleString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit'
          }),
          startTime: new Date(odds.commence_time),
          homeTeam: odds.home_team,
          awayTeam: odds.away_team,
          odds: oddsObj,
          additionalOdds: actualAdditionalMarkets > 0 ? `+${actualAdditionalMarkets}` : null,
          sport: 'Basketball'
        };
      }).filter(match => match !== null); // Remove null matches
  };

  const fetchMatches = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch odds data from API
      const response = await apiService.getMatches();
      const oddsData = response.data.data || [];
      
      // Transform odds data to match frontend format
      const basketballMatches = transformOddsToMatches(oddsData);
      setMatches(basketballMatches);
      
    } catch (err) {
      console.error('Error fetching basketball matches:', err);
      setError('Failed to load basketball matches. Please try again later.');
      
      // Fallback to sample data if API fails
      const sampleMatches = [
        {
          id: 1,
          league: 'NBA - Regular Season',
          time: '21:00 16.12',
          homeTeam: 'Los Angeles Lakers',
          awayTeam: 'Boston Celtics',
          odds: {
            '1': 2.25,
            'X': 15.00,
            '2': 1.65,
            '1X': 1.45,
            '12': 1.22,
            '2X': 1.18,
            'Over (225.5)': 1.88,
            'Under (225.5)': 1.87
          },
          additionalOdds: '+156',
          sport: 'Basketball'
        },
        {
          id: 2,
          league: 'College Basketball - March Madness',
          time: '22:30 16.12',
          homeTeam: 'Duke Blue Devils',
          awayTeam: 'North Carolina Tar Heels',
          odds: {
            '1': 1.95,
            'X': 18.00,
            '2': 1.85,
            '1X': 1.38,
            '12': 1.25,
            '2X': 1.32,
            'Over (145.5)': 1.92,
            'Under (145.5)': 1.83
          },
          additionalOdds: '+78',
          sport: 'Basketball'
        }
      ];
      
      setMatches(sampleMatches);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, []);

  const filteredMatchesByLeague = selectedLeague === 'all' 
    ? filteredMatches 
    : filteredMatches.filter(match => match.league.toLowerCase().includes(selectedLeague));

  // Group matches by subcategory
  const groupMatchesBySubcategory = () => {
    const groupedMatches = {};
    
    filteredMatchesByLeague.forEach(match => {
      const subcategoryKey = match.league || 'Other';
      if (!groupedMatches[subcategoryKey]) {
        groupedMatches[subcategoryKey] = [];
      }
      groupedMatches[subcategoryKey].push(match);
    });
    
    return groupedMatches;
  };

  const groupedMatches = groupMatchesBySubcategory();

  if (loading) {
    return (
      <div className="sport-page">
        <div className="sport-header">
          <h1 className="sport-title">Basketball</h1>
          <p className="sport-subtitle">Bet on NBA, College Basketball and international leagues</p>
        </div>
        <div className="matches-section">
          <div className="section-header">
            <h2 className="section-title">UPCOMING MATCHES</h2>
            <div className="view-all-btn empty" style={{ opacity: 0.5 }}>Loading…</div>
          </div>
          <div className="matches-skeleton-grid">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="skeleton" style={{ padding: 16 }}>
                <div className="skeleton-line" style={{ width: '60%', height: 16, marginBottom: 8 }}></div>
                <div className="skeleton-line" style={{ width: '80%', height: 12, marginBottom: 12 }}></div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div className="skeleton-odds"></div>
                  <div className="skeleton-odds"></div>
                  <div className="skeleton-odds"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sport-page">
        <div className="sport-header">
          <h1 className="sport-title">Basketball</h1>
          <p className="sport-subtitle">Bet on NBA, College Basketball and international leagues</p>
        </div>
        <div className="error-container">
          <p className="error-message">{error}</p>
          <button onClick={fetchMatches} className="retry-btn">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="sport-page">
      <div className="sport-header">
        <h1 className="sport-title">Basketball</h1>
        <p className="sport-subtitle">Bet on NBA, College Basketball and international leagues</p>
      </div>

      <div className="leagues-grid">
        {leagues.map(league => (
          <div 
            key={league.id}
            className={`league-card ${selectedLeague === league.id ? 'active' : ''}`}
            onClick={() => setSelectedLeague(league.id)}
          >
            <div className="league-header">
              <h3 className="league-name">{league.name}</h3>
              <span className="league-matches">{league.count} matches</span>
            </div>
            <p className="league-description">
              {league.id === 'nba' && 'National Basketball Association'}
              {league.id === 'college' && 'NCAA Basketball Championships'}
              {league.id === 'all' && 'All available Basketball matches'}
            </p>
          </div>
        ))}
      </div>

      <div className="matches-section">
        <div className="section-header">
          <h2 className="section-title">UPCOMING MATCHES</h2>
          <button className="view-all-btn">View All</button>
        </div>

        <div className="matches-grid">
          {Object.entries(groupedMatches).map(([subcategory, matches]) => (
            <div key={subcategory} className="subcategory-group">
              <h3 className="subcategory-title">{subcategory}</h3>
              {matches.map(match => (
                <MatchCard 
                  key={match.id} 
                  match={match} 
                  sport={match.sport}
                  league={match.league}
                  subcategory={subcategory}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Basketball;