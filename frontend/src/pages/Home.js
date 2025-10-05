import React, { useState, useEffect } from 'react';
import HeroSlider from '../components/HeroSlider';
import MatchCard from '../components/MatchCard';
import PopularMatches from '../components/PopularMatches';
import apiService from '../services/api';

const Home = () => {
  const [selectedTab, setSelectedTab] = useState('Featured');
  const [matches, setMatches] = useState([]);
  const [filteredMatches, setFilteredMatches] = useState([]);
  const [popularMatches, setPopularMatches] = useState([]);
  // Removed unused expandedSubcategories to satisfy linter
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSidebarFilter, setSelectedSidebarFilter] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');

  const tabs = ['Featured', 'Competitions', 'Outrights', 'Offers', 'Free Games'];

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

  useEffect(() => {
    const handleSidebarFilter = (event) => {
      const filterValue = event.detail.filter;
      console.log(`[SIDEBAR FILTER] Applying filter: ${filterValue}`);
      setSelectedSidebarFilter(filterValue);
    };
    window.addEventListener('sidebarFilter', handleSidebarFilter);
    return () => window.removeEventListener('sidebarFilter', handleSidebarFilter);
  }, []);

  // Add subcategory filter event listener for navigation from MatchMarkets
  useEffect(() => {
    const handleSubcategoryFilter = (event) => {
      const { sport, subcategory } = event.detail;
      console.log(`[FALLBACK] Filtering by subcategory: ${subcategory} in sport: ${sport}`);
      setSelectedSubcategory(subcategory);
      
      // Also set the sport filter to ensure proper filtering
      setSelectedSidebarFilter(sport);
    };
    window.addEventListener('subcategoryFilter', handleSubcategoryFilter);
    return () => window.removeEventListener('subcategoryFilter', handleSubcategoryFilter);
  }, []);



  // Mapping from sidebar names to possible values in the data
  const sidebarToDataMap = {
    'Football / Soccer': ['Soccer', 'Football'],
    'Hockey': ['Hockey', 'NHL', 'KHL', 'AHL', 'SHL', 'Liiga', 'DEL', 'NLA'],
    'NHL': ['NHL'],
    'KHL': ['KHL'],
    'AHL': ['AHL'],
    'SHL': ['SHL'],
    'Liiga': ['Liiga'],
    'DEL': ['DEL'],
    'NLA': ['NLA'],
    'Tennis': ['Tennis', 'ATP', 'Wimbledon', 'US Open', 'French Open'],
    'ATP': ['ATP'],
    'Wimbledon': ['Wimbledon'],
    'US Open': ['US Open'],
    'French Open': ['French Open'],
    'Baseball': ['Baseball', 'MLB'],
    'MLB': ['MLB'],
    // Add more mappings as needed for other sports/leagues
  };

  // Enhanced subcategory mapping for better fallback filtering
  const subcategoryMappings = {
    'EPL': ['Premier League', 'English Premier League', 'EPL', 'England Premier League'],
    'Epl': ['Premier League', 'English Premier League', 'EPL', 'England Premier League'],
    'Serie A': ['Serie A', 'Italian Serie A', 'Italy Serie A'],
    'Bundesliga': ['Bundesliga', 'German Bundesliga', 'Germany Bundesliga'],
    'La Liga': ['La Liga', 'Spanish La Liga', 'Spain La Liga'],
    'Ligue 1': ['Ligue 1', 'French Ligue 1', 'France Ligue One'],
    'Champions League': ['UEFA Champions League', 'Champions League', 'UCL'],
    'Europa League': ['UEFA Europa League', 'Europa League', 'UEL'],
    'MLS': ['Major League Soccer', 'MLS'],
    'NFL': ['National Football League', 'NFL'],
    'NBA': ['National Basketball Association', 'NBA'],
    'MLB': ['Major League Baseball', 'MLB'],
    'NHL': ['National Hockey League', 'NHL']
  };

  // Filter matches based on search term, date, sidebar filter, and subcategory
  useEffect(() => {
    let filtered = matches;

    // Sidebar filter
    if (selectedSidebarFilter) {
      const mappedValues = sidebarToDataMap[selectedSidebarFilter] || [selectedSidebarFilter];
      filtered = filtered.filter(match =>
        mappedValues.some(val =>
          (match.sport && match.sport.toLowerCase().includes(val.toLowerCase())) ||
          (match.league && match.league.toLowerCase().includes(val.toLowerCase())) ||
          (match.subcategory && match.subcategory.toLowerCase().includes(val.toLowerCase()))
        )
      );
    }

    // Subcategory filter - only apply if a subcategory is selected
    if (selectedSubcategory) {
      filtered = filtered.filter(match => {
        // Get possible subcategory variations from mapping
        const subcategoryVariations = subcategoryMappings[selectedSubcategory] || [selectedSubcategory];
        
        // Check if any variation matches in subcategory or league fields
        return subcategoryVariations.some(variation => 
          (match.subcategory && match.subcategory.toLowerCase().includes(variation.toLowerCase())) ||
          (match.league && match.league.toLowerCase().includes(variation.toLowerCase())) ||
          (match.sport_title && match.sport_title.toLowerCase().includes(variation.toLowerCase()))
        );
      });
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(match => {
        return (
          match.homeTeam?.toLowerCase().includes(searchLower) ||
          match.awayTeam?.toLowerCase().includes(searchLower) ||
          match.league?.toLowerCase().includes(searchLower) ||
          match.sport?.toLowerCase().includes(searchLower) ||
          match.subcategory?.toLowerCase().includes(searchLower)
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
  }, [matches, searchTerm, selectedDate, selectedSidebarFilter, selectedSubcategory]);

  // Removed unused toggleSubcategory to satisfy linter

  // Helper function to create a unique key for a match
  const createMatchKey = (match) => {
    if (!match) return null;
    
    // For API data format
    if (match.home_team && match.away_team) {
      return `${match.home_team}_${match.away_team}_${match.commence_time}_${match.sport_key}`;
    }
    
    // For frontend data format
    if (match.homeTeam && match.awayTeam) {
      return `${match.homeTeam}_${match.awayTeam}_${match.startTime}_${match.sport}`;
    }
    
    return null;
  };

  // Helper function to deduplicate matches
  const deduplicateMatches = (matches) => {
    const seen = new Set();
    const uniqueMatches = [];
    
    matches.forEach(match => {
      const key = createMatchKey(match);
      if (key && !seen.has(key)) {
        seen.add(key);
        uniqueMatches.push(match);
      }
    });
    
    console.log(`[DEBUG] Deduplication: ${matches.length} matches -> ${uniqueMatches.length} unique matches`);
    return uniqueMatches;
  };

  // Transform odds data to match frontend format
  const transformOddsToMatches = (oddsData) => {
    const transformedMatches = oddsData.map(match => {
      if (!match) return null;
      
      // Format sport key with fullstops between categories only
      const formatSportKey = (key) => {
        if (!key) return '';
        // Split by underscore to get main parts (sport, league, subcategory)
        const parts = key.split('_');
        // Capitalize each word in each part but keep words together
        const formattedParts = parts.map(part => 
          part.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
        );
        // Join main parts with fullstops
        return formattedParts.join('.');
      };
      
      // Handle backend database format
      return {
        id: match._id || match.id,
        league: match.leagueId ? formatSportKey(match.leagueId) : '',
        subcategory: match.sport ? formatSportKey(match.sport) : '',
        startTime: new Date(match.startTime),
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        homeTeamFlag: '🏳️',
        awayTeamFlag: '🏳️',
        odds: match.odds instanceof Map ? Object.fromEntries(match.odds) : match.odds || {},
        additionalMarkets: (match.markets || []).length,
        sport: match.sport ? match.sport.split('_')[0] : '',
        allMarkets: match.markets || []
      };
    }).filter(match => match !== null);
    
    // Deduplicate the transformed matches
    return deduplicateMatches(transformedMatches);
  };

  // Fetch matches from API
  const fetchMatches = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('[DEBUG] Starting to fetch matches from API...');
      
      const response = await apiService.getMatches();
      console.log('[DEBUG] API response received:', response);
      
      const oddsData = response.data.matches || [];
      console.log('[DEBUG] Raw odds data:', oddsData);
      console.log('[DEBUG] Number of matches in response:', oddsData.length);
      
      // Transform odds data to match frontend format
      const transformedMatches = transformOddsToMatches(oddsData);
      // Debug log: print number of matches and a sample
      console.log(`[DEBUG] Frontend received ${transformedMatches.length} matches`);
      if (transformedMatches.length > 0) {
        console.log('[DEBUG] First match sample:', transformedMatches[0]);
      }
      setMatches(transformedMatches);
      
      // Use the same data for popular matches (ensure no duplicates)
      const popularMatchesData = transformedMatches
        .filter(match => {
          // Count valid odds (greater than 0)
          const validOddsCount = Object.values(match.odds || {}).filter(odd => odd > 0).length;
          return validOddsCount >= 2;
        })
        .slice(0, 6)
        .map(match => ({
          id: match.id || match._id,
          league: match.league || '',  // Ensure league is passed through
          subcategory: match.subcategory || '',  // Ensure subcategory is passed through
          time: new Date(match.startTime).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          odds: match.odds || {},
          sport: match.sport || ''
        }));
      
      // Deduplicate popular matches as well
      const uniquePopularMatches = deduplicateMatches(popularMatchesData);
      setPopularMatches(uniquePopularMatches);
      
    } catch (err) {
      console.error('Error fetching matches:', err);
      setError('Failed to load matches. Please check your connection and try again.');
      
      // Instead of falling back to sample data, try alternative API endpoints
      console.log('[DEBUG] Primary API failed, attempting alternative data sources...');
      
      try {
        // Try fetching from a different endpoint or sport-specific endpoints
        const alternativeResponse = await apiService.getAllMatches();
        if (alternativeResponse.data && alternativeResponse.data.length > 0) {
          console.log('[DEBUG] Successfully fetched from alternative endpoint');
          const transformedMatches = transformOddsToMatches(alternativeResponse.data);
          setMatches(transformedMatches);
          setPopularMatches(transformedMatches.slice(0, 6));
          setError(null); // Clear error if alternative fetch succeeds
          return;
        }
      } catch (alternativeErr) {
        console.log('[DEBUG] Alternative endpoints also failed:', alternativeErr);
      }
      
      // Only use minimal sample data as last resort, with clear indication
      console.log('[DEBUG] All data sources failed, showing connection error');
      setMatches([]);
      setPopularMatches([]);
      setError('Unable to connect to server. The server may be temporarily unavailable. Please try refreshing the page in a few moments.');
    } finally {
      setLoading(false);
    }
  };

  // Add this near the other useEffect hooks, after the existing fetchMatches useEffect
  // Replace this useEffect
  useEffect(() => {
    // Preload cached matches/popular to render instantly
    try {
      const matchesCacheRaw = localStorage.getItem('cache:/matches');
      if (matchesCacheRaw) {
        const matchesCache = JSON.parse(matchesCacheRaw);
        const cachedOddsData = matchesCache?.data?.matches || [];
        const transformed = transformOddsToMatches(cachedOddsData);
        if (transformed && transformed.length > 0) {
          setMatches(transformed);
        }
      }
      const popularCacheRaw = localStorage.getItem('cache:/matches/popular/trending');
      if (popularCacheRaw) {
        const popularCache = JSON.parse(popularCacheRaw);
        const popularData = popularCache?.data?.matches || [];
        const transformedPopular = popularData.map(match => ({
          id: match.id || match._id,
          league: match.league || '',
          subcategory: match.subcategory || '',
          time: new Date(match.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          odds: match.odds || {},
          sport: match.sport || ''
        }));
        const uniquePopular = deduplicateMatches(transformedPopular);
        if (uniquePopular && uniquePopular.length > 0) {
          setPopularMatches(uniquePopular);
        }
      }
    } catch (e) {
      // Ignore cache errors
    }
    fetchMatches();
  }, []);
  
  // Enhanced version that includes polling for regular updates
  useEffect(() => {
    // Initial fetch
    fetchMatches();
    
    // Set up polling interval (every 2 minutes = 120000ms)
    const intervalId = setInterval(() => {
      console.log('[DEBUG] Polling for updated matches data...');
      fetchMatches();
    }, 120000);
    
    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, []); // Empty dependency array means this runs once on mount

  // Add retry logic for failed connections
  useEffect(() => {
    if (error && error.includes('Unable to connect to server')) {
      console.log('[DEBUG] Connection error detected, scheduling retry...');
      const retryTimeout = setTimeout(() => {
        console.log('[DEBUG] Retrying connection...');
        fetchMatches();
      }, 10000); // Retry after 10 seconds
      
      return () => clearTimeout(retryTimeout);
    }
  }, [error]);
  
  // Add a separate polling effect for popular matches
  useEffect(() => {
    // Set up more frequent polling for popular matches (every 1 minute)
    const popularMatchesInterval = setInterval(() => {
      fetchPopularMatches();
    }, 60000);
    
    return () => clearInterval(popularMatchesInterval);
  }, []);
  
  // Add this new function to fetch only popular matches
  const fetchPopularMatches = async () => {
    try {
      console.log('[DEBUG] Fetching popular matches...');
      
      const response = await apiService.getPopularMatches();
      const popularData = response.data.matches || [];
      
      // Transform and deduplicate popular matches
      const transformedPopular = popularData.map(match => ({
        id: match.id || match._id,
        league: match.league || '',
        subcategory: match.subcategory || '',
        time: new Date(match.startTime).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        odds: match.odds || {},
        sport: match.sport || ''
      }));
      
      const uniquePopularMatches = deduplicateMatches(transformedPopular);
      setPopularMatches(uniquePopularMatches);
      
    } catch (err) {
      console.error('Error fetching popular matches:', err);
      // Don't set error state here to avoid disrupting the main UI
    }
  };

  // Group matches by subcategory with deduplication
  const groupMatchesBySubcategory = () => {
    const groupedMatches = {};
    
    // Create a map to track unique matches within each subcategory
    const subcategoryUniqueMatches = {};
    
    filteredMatches.forEach(match => {
      // Use subcategory if available, otherwise try to extract from league name
      let subcategoryKey = match.subcategory;
      
      if (!subcategoryKey || subcategoryKey === match.league) {
        // Try to extract a meaningful subcategory from the league name
        if (match.league && match.league.includes('.')) {
          subcategoryKey = match.league.split('.').pop().trim();
        } else if (match.league) {
          subcategoryKey = match.league;
        } else {
          subcategoryKey = 'Other';
        }
      }
      
      if (!groupedMatches[subcategoryKey]) {
        groupedMatches[subcategoryKey] = [];
        subcategoryUniqueMatches[subcategoryKey] = new Set();
      }
      
      // Create a unique key for this match within the subcategory
      const matchKey = `${match.homeTeam}_${match.awayTeam}_${match.startTime}`;
      
      // Only add if this match hasn't been seen in this subcategory
      if (!subcategoryUniqueMatches[subcategoryKey].has(matchKey)) {
        subcategoryUniqueMatches[subcategoryKey].add(matchKey);
      groupedMatches[subcategoryKey].push(match);
      }
    });
    
    // Log deduplication results
    Object.entries(groupedMatches).forEach(([subcategory, matches]) => {
      console.log(`[DEBUG] Subcategory "${subcategory}": ${matches.length} unique matches`);
    });
    
    return groupedMatches;
  };

  const groupedMatches = groupMatchesBySubcategory();
  
  // Debug: Log the grouped matches to see what subcategories are created
  console.log('Grouped matches:', Object.keys(groupedMatches));
  Object.entries(groupedMatches).forEach(([subcategory, matches]) => {
    console.log(`Subcategory "${subcategory}": ${matches.length} matches`);
  });

  // Do not gate initial render behind loading; show page immediately without loading text

  if (error) {
    return (
      <div className="home-page">
        <HeroSlider />
        <div className="main-content">
          <div className="error-container">
            <p className="error-message">{error}</p>
            <button onClick={fetchMatches} className="retry-btn">Retry</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="home-page">
      <HeroSlider />
      
      {/* Popular Matches section - keep unchanged */}
      <div className="main-content">
        <PopularMatches matches={popularMatches} loading={loading} />
        
        {/* Enhanced Matches Section */}
        <div className="matches-section">
          <div className="section-header">
            <h2>Today's Matches</h2>
            {selectedSubcategory && (
              <div className="active-filter">
                <span>Filtered by: {selectedSubcategory}</span>
                <button 
                  className="clear-filter-btn"
                  onClick={() => setSelectedSubcategory('')}
                >
                  ✕
                </button>
              </div>
            )}
            <div className="tab-navigation">
              {tabs.map(tab => (
                <button
                  key={tab}
                  className={`tab-btn ${selectedTab === tab ? 'active' : ''}`}
                  onClick={() => setSelectedTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="matches-container">
            {Object.entries(groupedMatches).length > 0 ? (
              Object.entries(groupedMatches).map(([subcategory, subcategoryMatches]) => (
                <div key={subcategory} className="competition-group">
                 
                  <div className="matches-list">
                    {subcategoryMatches.map((match, index) => (
                      <MatchCard
                        key={match.id}
                        match={match}
                        sport={match.sport}
                        league={match.league}
                        subcategory={match.subcategory}
                        showLeagueHeader={index === 0}
                      />
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="no-matches">
                <h3>No Matches Found</h3>
                <p>No matches match your current filters. Try adjusting your search criteria.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;