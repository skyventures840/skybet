import React, { useState, useEffect } from 'react';
import MatchCard from '../components/MatchCard';
import apiService from '../services/api';
import { computeFullLeagueTitle } from '../utils/leagueTitle';

const Baseball = () => {
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

    // Hide past matches (only show upcoming)
    const now = new Date();
    filtered = filtered.filter(match => new Date(match.startTime) >= now);

    setFilteredMatches(filtered);
  }, [matches, searchTerm, selectedDate]);

  // Transform odds data to match frontend format for baseball
  const transformOddsToMatches = (oddsData) => {
    return oddsData
      .filter(odds => odds.sport_key === 'baseball_mlb')
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
        
        // Create odds object for baseball (no draw option)
        const oddsObj = {
          '1': outcomes[0]?.price || null,
          '2': outcomes[1]?.price || null,
          'X': 0, // No draw in baseball
          '1X': 0,
          '12': 0,
          '2X': 0
        };

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

        // Count additional markets
        const displayedOddsCount = Object.keys(oddsObj).filter(key => oddsObj[key] !== null && oddsObj[key] !== 0).length;
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
          sport: 'Baseball'
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
      const baseballMatches = transformOddsToMatches(oddsData);
      setMatches(baseballMatches);
      
    } catch (err) {
      console.error('Error fetching baseball matches:', err);
      setError('Failed to load baseball matches. Please try again later.');
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
          <h1 className="sport-title">Baseball</h1>
          <p className="sport-subtitle">Bet on MLB and international baseball leagues</p>
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
          <h1 className="sport-title">Baseball</h1>
          <p className="sport-subtitle">Bet on MLB and international baseball leagues</p>
        </div>
        <div className="error-container">
          <p className="error-message">{error}</p>
          <button onClick={fetchMatches} className="retry-btn">Try Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="sport-page">
      <div className="sport-header">
        <h1 className="sport-title">Baseball</h1>
        <p className="sport-subtitle">Bet on MLB and international baseball leagues</p>
      </div>

      <div className="matches-section">
        <div className="section-header">
          <h2 className="section-title">UPCOMING MATCHES</h2>
          <button className="view-all-btn">View All</button>
        </div>

        {Object.keys(groupedMatches).length === 0 ? (
          <div className="no-matches">
            <p>No baseball matches available at the moment.</p>
          </div>
        ) : (
          Object.entries(groupedMatches).map(([subcategory, subcategoryMatches]) => {
            const first = subcategoryMatches[0] || {};
            const groupTitle = first.fullLeagueTitle || computeFullLeagueTitle({
              sportKeyOrName: first.sport_key || first.sport || 'Baseball',
              country: first.country || subcategory || '',
              leagueName: first.league || subcategory,
              fallbackSportTitle: 'Baseball'
            });
            return (
              <div key={subcategory} className="subcategory-section">
                <h3 className="subcategory-title">{groupTitle}</h3>
                <div className="matches-grid">
                  {subcategoryMatches.map(match => (
                    <MatchCard key={match.id} match={match} />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Baseball;