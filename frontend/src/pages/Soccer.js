import React, { useState, useEffect } from 'react';
import SubcategoryMatchCard from '../components/SubcategoryMatchCard';
import apiService from '../services/api';
import { computeFullLeagueTitle } from '../utils/leagueTitle';

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

  // Transform backend /api/matches response to frontend format
  const transformMatchesResponse = (data) => {
    if (!Array.isArray(data)) return [];

    const now = new Date();
    return data
      .filter(match => {
        // Determine sport from sport_key or sport fields strictly
        const rawKey = (match.sport_key || match.sport || match.sport_title || '').toLowerCase();
        const firstToken = rawKey.split('_')[0] || '';
        const isSoccer = firstToken === 'soccer' || rawKey === 'soccer';
        // Exclude any mis-labeled leagues that clearly belong to other sports
        const leagueLower = String(match.league || match.sport_title || '').toLowerCase();
        // Also guard against truncated or variant labels like "boxi"
        const isClearlyNonSoccer = /\bboxing\b|\bboxi\b|\bmma\b|\bufc\b|\brugby\b/.test(leagueLower);
        // Only pre-match upcoming items
        const start = new Date(match.startTime);
        const isUpcoming = (match.status || 'upcoming') === 'upcoming' && start > now;
        return isSoccer && isUpcoming && !isClearlyNonSoccer;
      })
      .map(match => {
        const oddsObj = match.odds || {};
        const start = new Date(match.startTime);

        // Ensure basic odds are numbers when present
        ['1','2','X','1X','12','2X'].forEach(k => {
          if (oddsObj && oddsObj[k] != null) {
            const num = Number(oddsObj[k]);
            oddsObj[k] = Number.isFinite(num) ? num : oddsObj[k];
          }
        });

        // Only return match if we have at least basic odds for 1 and 2
        if (!(oddsObj['1'] > 0 && oddsObj['2'] > 0)) {
          return null;
        }

        const additionalMarkets = Number(match.additionalMarkets || 0);
        const ignoredLineKeys = ['Total','total','handicapLine','handicap_line'];
        const displayedOddsCount = Object.keys(oddsObj).filter(key => oddsObj[key] && oddsObj[key] > 0 && !ignoredLineKeys.includes(key)).length;
        const additionalOddsCount = Math.max(0, additionalMarkets - displayedOddsCount);

        // Derive country from explicit field or sport_key second token
        const sportKey = String(match.sport_key || '').toLowerCase();
        const tokens = sportKey.split('_').filter(Boolean);
        const derivedCountry = match.country || (tokens.length > 1 ? tokens[1] : '') || '';
        return {
          id: match.id,
          league: match.league || match.competition || match.tournament || 'Other',
          country: derivedCountry,
          sport_key: match.sport_key || '',
          time: start.toLocaleString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit'
          }),
          startTime: start,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          odds: oddsObj,
          additionalOdds: additionalOddsCount > 0 ? `+${additionalOddsCount}` : null,
          sport: 'Soccer'
        };
      })
      .filter(Boolean);
  };

  const fetchMatches = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch matches filtered by sport key from API (server-side filter)
      const response = await apiService.getMatchesByKey('soccer');
      const apiMatches = response.data.matches || [];

      // Transform to frontend format
      const soccerMatches = transformMatchesResponse(apiMatches);
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
            'Over (2.5)': 1.75,
            'Under (2.5)': 2.05
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
            'Over (3.5)': 1.95,
            'Under (3.5)': 1.80
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
    const interval = setInterval(fetchMatches, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  // Canonical mappings for major soccer competitions
  const subcategoryMappings = {
    'EPL': ['Premier League', 'English Premier League', 'EPL', 'England Premier League'],
    'Serie A': ['Serie A', 'Italian Serie A', 'Italy Serie A'],
    'Bundesliga': ['Bundesliga', 'German Bundesliga', 'Germany Bundesliga'],
    'La Liga': ['La Liga', 'Spanish La Liga', 'Spain La Liga'],
    'Ligue 1': ['Ligue 1', 'French Ligue 1', 'France Ligue One'],
    'Champions League': ['UEFA Champions League', 'Champions League', 'UCL'],
    'Europa League': ['UEFA Europa League', 'Europa League', 'UEL'],
    'MLS': ['Major League Soccer', 'MLS']
  };

  // Group matches by canonicalized subcategory
  const groupMatchesBySubcategory = () => {
    const groupedMatches = {};

    const normalize = (s) => String(s || '').toLowerCase().trim().replace(/[_.-]+/g, ' ');
    const computeCanonicalSubcategory = (m) => {
      const leagueNorm = normalize(m.league);
      for (const [canonical, variations] of Object.entries(subcategoryMappings)) {
        for (const v of variations) {
          const vNorm = normalize(v);
          if (vNorm && leagueNorm === vNorm) {
            return canonical;
          }
        }
      }
      return m.league || 'Other';
    };

    filteredMatches.forEach(match => {
      const subcategoryKey = computeCanonicalSubcategory(match);
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
          {Object.entries(groupedMatches).map(([subcategory, matches]) => {
            const first = matches[0] || {};
            const groupTitle = first.fullLeagueTitle || computeFullLeagueTitle({
              sportKeyOrName: first.sport_key || first.sport || 'Soccer',
              country: first.country || subcategory || '',
              leagueName: first.league || subcategory,
              fallbackSportTitle: 'Soccer'
            });
            return (
              <SubcategoryMatchCard
                key={subcategory}
                subcategory={groupTitle}
                matches={matches}
                sport="Soccer"
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Soccer;