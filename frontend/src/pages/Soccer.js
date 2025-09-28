import React, { useState, useEffect } from 'react';
import MatchCard from '../components/MatchCard';
import apiService from '../services/api';

const Soccer = () => {
  const [matches, setMatches] = useState([]);
  const [filteredMatches, setFilteredMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

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

    setFilteredMatches(filtered);
  }, [matches, searchTerm, selectedDate]);

  // Transform odds data to match frontend format
  const transformOddsToMatches = (oddsData) => {
    return oddsData
      .filter(odds => odds.sport_key === 'soccer')
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

        // Add draw option for soccer if available
        if (outcomes.length > 2) {
          oddsObj['X'] = outcomes[1]?.price || null;
          oddsObj['2'] = outcomes[2]?.price || null;
        }

        // Add totals market if available and valid
        if (totalsMarket && totalsMarket.outcomes && totalsMarket.outcomes.length >= 2) {
          oddsObj['Total'] = totalsMarket.outcomes[0]?.point || null;
          oddsObj['TM'] = totalsMarket.outcomes[0]?.price || null;
          oddsObj['TU'] = totalsMarket.outcomes[1]?.price || null;
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
          startTime: new Date(odds.commence_time), // <-- add this line
          homeTeam: odds.home_team,
          awayTeam: odds.away_team,
          odds: oddsObj,
          additionalOdds: actualAdditionalMarkets > 0 ? `+${actualAdditionalMarkets}` : null,
          sport: 'Soccer'
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
      const soccerMatches = transformOddsToMatches(oddsData);
      setMatches(soccerMatches);
      
    } catch (err) {
      console.error('Error fetching soccer matches:', err);
      setError('Failed to load soccer matches. Please try again later.');
      
      // Fallback to sample data if API fails
      const sampleMatches = [
        {
          id: 1,
          league: 'Premier League',
          time: '17:30 16.12',
          homeTeam: 'Manchester United',
          awayTeam: 'Liverpool',
          odds: {
            '1': 2.85,
            'X': 3.40,
            '2': 2.45,
            '1X': 1.65,
            '12': 1.45,
            '2X': 1.55,
            'Total': 2.5,
            'TM': 1.75,
            'TU': 2.05
          },
          additionalOdds: '+156'
        },
        {
          id: 2,
          league: 'Champions League',
          time: '21:00 17.12',
          homeTeam: 'Real Madrid',
          awayTeam: 'Barcelona',
          odds: {
            '1': 2.10,
            'X': 3.60,
            '2': 3.20,
            '1X': 1.45,
            '12': 1.35,
            '2X': 1.85,
            'Total': 3.5,
            'TM': 1.95,
            'TU': 1.80
          },
          additionalOdds: '+234'
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

  // Group matches by subcategory
  const groupMatchesBySubcategory = () => {
    const groupedMatches = {};
    
    filteredMatches.forEach(match => {
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
          <h1 className="sport-title">Soccer</h1>
          <p className="sport-subtitle">Bet on Premier League, Champions League and more</p>
        </div>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading soccer matches...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sport-page">
        <div className="sport-header">
          <h1 className="sport-title">Soccer</h1>
          <p className="sport-subtitle">Bet on Premier League, Champions League and more</p>
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
        <h1 className="sport-title">Soccer</h1>
        <p className="sport-subtitle">Bet on Premier League, Champions League and more</p>
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
                  sport="Soccer"
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

export default Soccer;