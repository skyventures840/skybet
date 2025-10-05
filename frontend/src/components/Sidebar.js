import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { FaRegCalendarAlt } from 'react-icons/fa';
import WheelOfFortune from './WheelOfFortune';

const Sidebar = ({ closeSidebar }) => {
  const location = useLocation();
  const [expandedSports, setExpandedSports] = useState({});
  const [showAllSubcategories, setShowAllSubcategories] = useState({});
  const [matchType, setMatchType] = useState('prematch'); // 'prematch' or 'live'
  const [sportsSectionHidden, setSportsSectionHidden] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [allEventsExpanded, setAllEventsExpanded] = useState(false);
  const navigate = useNavigate();
  const [showDateInput, setShowDateInput] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [showWheelModal, setShowWheelModal] = useState(false);

  // Helper function to close sidebar on mobile
  const handleMobileNavigation = (callback) => {
    // Check if we're on a mobile device (sidebar is overlay)
    const isMobile = window.innerWidth <= 1024;
    
    if (isMobile && closeSidebar) {
      // Close sidebar first, then execute the callback
      closeSidebar();
      // Small delay to ensure sidebar closes before navigation
      setTimeout(callback, 100);
    } else {
      // On desktop, just execute the callback
      callback();
    }
  };

  // Global search functionality
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    // Store search term in localStorage for global access
    localStorage.setItem('globalSearchTerm', value);
    
    // Dispatch a custom event to notify other components
    window.dispatchEvent(new CustomEvent('globalSearch', { 
      detail: { searchTerm: value } 
    }));

    // Close sidebar on mobile after search
    if (value.trim() && window.innerWidth <= 1024 && closeSidebar) {
      setTimeout(() => {
        closeSidebar();
      }, 500); // Small delay to let user see the search results
    }
  };

  // Clear search when component unmounts or search is cleared
  useEffect(() => {
    return () => {
      if (searchTerm === '') {
        localStorage.removeItem('globalSearchTerm');
        window.dispatchEvent(new CustomEvent('globalSearch', { 
          detail: { searchTerm: '' } 
        }));
      }
    };
  }, [searchTerm]);

  // Toggle function to show/hide subcategories only
  const toggleSport = (sportName) => {
    setExpandedSports(prev => {
      // If the clicked sport is already expanded, just close it
      if (prev[sportName]) {
        return {
          ...prev,
          [sportName]: false
        };
      }
      
      // If clicking a different sport, close all others and open the clicked one
      const newState = {};
      Object.keys(prev).forEach(sport => {
        newState[sport] = false;
      });
      newState[sportName] = true;
      return newState;
    });
  };

  const toggleShowAllSubcategories = (sportName) => {
    setShowAllSubcategories(prev => ({
      ...prev,
      [sportName]: !prev[sportName]
    }));
  };

  // Function to toggle the entire sports section
  const toggleSportsSection = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setSportsSectionHidden(!sportsSectionHidden);
  };

  const handleTabSwitch = (type) => {
    setMatchType(type);
    
    const navigationCallback = () => {
      // Check if we're currently on a MatchMarkets page
      const isOnMatchMarketsPage = location.pathname.includes('/match/') && location.pathname.includes('/markets');
      
      if (isOnMatchMarketsPage) {
        // If on MatchMarkets page, navigate back to home and apply match type filter
        navigate('/');
        
        // Apply the match type filter after navigation
        setTimeout(() => {
          // Dispatch match type filter event
          window.dispatchEvent(new CustomEvent('matchTypeFilter', { 
            detail: { matchType: type } 
          }));
        }, 100);
      } else {
        // Normal navigation for other pages
        if (type === 'prematch') {
          navigate('/prematch');
        } else {
          navigate('/live');
        }
      }
    };

    handleMobileNavigation(navigationCallback);
  };

  const toggleAllEvents = () => {
    setAllEventsExpanded(!allEventsExpanded);
  };

  // Global date filter functionality
  const handleDateChange = (e) => {
    const dateValue = e.target.value;
    setSelectedDate(dateValue);
    setShowDateInput(false);
    
    // Store selected date in localStorage for global access
    if (dateValue) {
      localStorage.setItem('globalSelectedDate', dateValue);
    } else {
      localStorage.removeItem('globalSelectedDate');
    }
    
    // Dispatch date filter event
    window.dispatchEvent(new CustomEvent('dateFilter', { 
      detail: { selectedDate: dateValue } 
    }));

    // Close sidebar on mobile after date selection
    if (dateValue && window.innerWidth <= 1024 && closeSidebar) {
      setTimeout(() => {
        closeSidebar();
      }, 300); // Small delay to let user see the date selection
    }
  };

  // Clear date filter when component unmounts or date is cleared
  useEffect(() => {
    return () => {
      if (!selectedDate) {
        localStorage.removeItem('globalSelectedDate');
        window.dispatchEvent(new CustomEvent('globalDateFilter', { 
          detail: { selectedDate: '' } 
        }));
      }
    };
  }, [selectedDate]);

  const handleSidebarFilter = (filter) => {
    window.dispatchEvent(new CustomEvent('sidebarFilter', { detail: { filter } }));
  };

  // Function to handle navigation from sidebar
  const handleSidebarNavigation = (sport, subItem = null) => {
    const navigationCallback = () => {
      // Check if we're currently on a MatchMarkets page
      const isOnMatchMarketsPage = location.pathname.includes('/match/') && location.pathname.includes('/markets');
      
      if (isOnMatchMarketsPage) {
        // If on MatchMarkets page, navigate back to home with filter
        navigate('/');
        
        // Apply the filter after a small delay to ensure home page is loaded
        setTimeout(() => {
          if (subItem) {
            // Filter by subcategory
            handleSidebarFilter(subItem.name);
            window.dispatchEvent(new CustomEvent('subcategoryFilter', { 
              detail: { 
                sport: sport.name,
                subcategory: subItem.name 
              } 
            }));
          } else {
            // Filter by main sport
            handleSidebarFilter(sport.name);
          }
        }, 100);
        
        return true; // Indicates custom navigation was handled
      }
      
      return false; // Let default navigation proceed
    };

    handleMobileNavigation(navigationCallback);
  };

  const sportsData = [
    // Football / Soccer (merged)
    {
      name: 'Football / Soccer',
      icon: '⚽',
      path: '/football',
      count: 1105,
      isExpandable: true,
      subItems: [
        // Football subcategories
        { name: 'EPL', count: 0, path: '/football/epl' },
        { name: 'Serie A', count: 0, path: '/football/serie-a' },
        { name: 'Bundesliga', count: 0, path: '/football/bundesliga' },
        { name: 'La Liga', count: 0, path: '/football/la-liga' },
        { name: 'Ligue 1', count: 0, path: '/football/ligue-1' },
        { name: 'UEFA Champions League', count: 0, path: '/football/uefa-champions-league' },
        { name: 'UEFA Europa League', count: 0, path: '/football/uefa-europa-league' },
        { name: 'MLS', count: 0, path: '/football/mls' },
        { name: 'Copa Libertadores', count: 0, path: '/football/copa-libertadores' },
        { name: 'Copa Sudamericana', count: 0, path: '/football/copa-sudamericana' },
        { name: 'CFL', path: '/football/cfl' },
        { name: 'NCAAF', path: '/football/ncaaf' },
        { name: 'NFL', path: '/football/nfl' },
        { name: 'NFL Preseason', path: '/football/nfl-preseason' },
        // Soccer subcategories
        { name: 'Argentina Primera Division', path: '/soccer/argentina-primera-division' },
        { name: 'Belgium First Division A', path: '/soccer/belgium-first-division-a' },
        { name: 'Brazil Campeonato', path: '/soccer/brazil-campeonato' },
        { name: 'Brazil Serie B', path: '/soccer/brazil-serie-b' },
        { name: 'Chile Campeonato', path: '/soccer/chile-campeonato' },
        { name: 'CONCACAF Gold Cup', path: '/soccer/concacaf-gold-cup' },
        { name: 'CONMEBOL Copa Libertadores', path: '/soccer/conmebol-copa-libertadores' },
        { name: 'CONMEBOL Copa Sudamericana', path: '/soccer/conmebol-copa-sudamericana' },
        { name: 'EFL Championship', path: '/soccer/efl-championship' },
        { name: 'England League 1', path: '/soccer/england-league-1' },
        { name: 'England League 2', path: '/soccer/england-league-2' },
        { name: 'FIFA Club World Cup', path: '/soccer/fifa-club-world-cup' },
        { name: 'Finland Veikkausliiga', path: '/soccer/finland-veikkausliiga' },
        { name: 'France Ligue One', path: '/soccer/france-ligue-one' },
        { name: 'Germany Bundesliga', path: '/soccer/germany-bundesliga' },
        { name: 'Italy Serie A', path: '/soccer/italy-serie-a' },
        { name: 'Japan J League', path: '/soccer/japan-j-league' },
        { name: 'Korea K League 1', path: '/soccer/korea-k-league-1' },
        { name: 'League of Ireland', path: '/soccer/league-of-ireland' },
        { name: 'Mexico Liga MX', path: '/soccer/mexico-liga-mx' },
        { name: 'Netherlands Eredivisie', path: '/soccer/netherlands-eredivisie' },
        { name: 'Norway Eliteserien', path: '/soccer/norway-eliteserien' },
        { name: 'Spain La Liga', path: '/soccer/spain-la-liga' },
        { name: 'SPL', path: '/soccer/spl' },
        { name: 'Sweden Allsvenskan', path: '/soccer/sweden-allsvenskan' },
        { name: 'UEFA Champs League Qualification', path: '/soccer/uefa-champs-league-qualification' },
        { name: 'USA MLS', path: '/soccer/usa-mls' },
      ]
    },
    // Hockey (field hockey)
    {
      name: 'Hockey',
      icon: '🏑',
      path: '/hockey',
      count: 15,
      isExpandable: true,
      subItems: [
        { name: 'Field Hockey', count: 0, path: '/hockey/field' },
      ]
    },
    // Ice Hockey
    {
      name: 'Ice Hockey',
      icon: '🏒',
      path: '/icehockey',
      count: 37,
      isExpandable: true,
      subItems: [
        { name: 'NHL', count: 0, path: '/icehockey/nhl' },
        { name: 'KHL', count: 0, path: '/icehockey/khl' },
        { name: 'AHL', path: '/icehockey/ahl' },
        { name: 'SHL', path: '/icehockey/shl' },
        { name: 'Liiga', path: '/icehockey/liiga' },
        { name: 'DEL', path: '/icehockey/del' },
        { name: 'NLA', path: '/icehockey/nla' },
      ]
    },
    // Tennis (merge all subcategories)
    {
      name: 'Tennis',
      icon: '🎾',
      path: '/tennis',
      count: 143,
      isExpandable: true,
      subItems: [
        { name: 'ATP Halle', count: 0, path: '/tennis/atp-halle' },
        { name: 'Wimbledon', count: 0, path: '/tennis/wimbledon' },
        { name: 'US Open', count: 0, path: '/tennis/us-open' },
        { name: 'French Open', count: 0, path: '/tennis/french-open' },
        { name: 'ATP Wimbledon', path: '/tennis/atp-wimbledon' },
        { name: 'ATP Madrid', path: '/tennis/atp-madrid' },
        { name: 'ATP Miami', path: '/tennis/atp-miami' },
        { name: 'ATP Monte Carlo', path: '/tennis/atp-monte-carlo' },
        { name: 'ATP Rome', path: '/tennis/atp-rome' },
        { name: 'ATP US Open', path: '/tennis/atp-us-open' },
        { name: 'ATP Washington', path: '/tennis/atp-washington' },
      ]
    },
    // Basketball (merge all subcategories)
    {
      name: 'Basketball',
      icon: '🏀',
      path: '/basketball',
      count: 135,
      isExpandable: true,
      subItems: [
        { name: 'NBA', count: 0, path: '/basketball/nba' },
        { name: 'EuroLeague', count: 0, path: '/basketball/euroleague' },
        { name: 'WNBA', count: 0, path: '/basketball/wnba' },
        { name: 'NBA Summer League', path: '/basketball/nba-summer-league' },
        { name: 'NCAAB', path: '/basketball/ncaab' },
        { name: 'NBA Preseason', path: '/basketball/nba-preseason' },
      ]
    },
    // Baseball (merge all subcategories)
    {
      name: 'Baseball',
      icon: '⚾',
      path: '/baseball',
      count: 91,
      isExpandable: true,
      subItems: [
        { name: 'MLB', count: 0, path: '/baseball/mlb' },
        { name: 'NPB', count: 0, path: '/baseball/npb' },
        { name: 'KBO', path: '/baseball/kbo' },
        { name: 'MiLB', path: '/baseball/milb' },
      ]
    },
    // Cricket (merge all subcategories)
    {
      name: 'Cricket',
      icon: '🏏',
      path: '/cricket',
      count: 51,
      isExpandable: true,
      subItems: [
        { name: 'ODI', path: '/cricket/odi' },
        { name: 'T20 Blast', path: '/cricket/t20-blast' },
      ]
    },
    // Boxing (merge all subcategories)
    {
      name: 'Boxing',
      icon: '🥊',
      path: '/boxing',
      count: 67,
      isExpandable: true,
      subItems: [
        { name: 'Boxing', path: '/boxing/boxing' },
      ]
    },
    // Lacrosse (merge all subcategories)
    {
      name: 'Lacrosse',
      icon: '🥍',
      path: '/lacrosse',
      isExpandable: true,
      subItems: [
        { name: 'PLL', path: '/lacrosse/pll' },
      ]
    },
    // MMA (merge all subcategories)
    {
      name: 'MMA',
      icon: '🥋',
      path: '/mma',
      count: 57,
      isExpandable: true,
      subItems: [
        { name: 'Mixed Martial Arts', path: '/mma/mixed-martial-arts' },
      ]
    },
    // Rugby League (merge all subcategories)
    {
      name: 'Rugby League',
      icon: '🏉',
      path: '/rugbyleague',
      isExpandable: true,
      subItems: [
        { name: 'NRL', path: '/rugbyleague/nrl' },
        { name: 'NRL State of Origin', path: '/rugbyleague/nrl-state-of-origin' },
      ]
    },
    // Aussie Rules (merge all subcategories)
    {
      name: 'Aussie Rules',
      icon: '🏉',
      path: '/aussierules',
      isExpandable: true,
      subItems: [
        { name: 'AFL', path: '/aussierules/afl' },
      ]
    },
    { name: 'Volleyball', icon: '🏐', path: '/volleyball', count: 315, isExpandable: true, subItems: [] },
    { name: 'Rugby', icon: '🏉', path: '/rugby', count: 36, isExpandable: true, subItems: [] },
    { name: 'Handball', icon: '🤾', path: '/handball', count: 14, isExpandable: true, subItems: [] },
    { name: 'Table tennis', icon: '🏓', path: '/table-tennis', count: 476, isExpandable: true, subItems: [] },
    { name: 'MMA', icon: '🥋', path: '/mma', count: 57, isExpandable: true, subItems: [] },
    { name: 'Boxing', icon: '🥊', path: '/boxing', count: 67, isExpandable: true, subItems: [] },
    { name: 'Fist fights', icon: '🤼', path: '/fist-fights', count: 17, isExpandable: true, subItems: [] },
    { name: 'Martial arts', icon: '🥋', path: '/martial-arts', count: 25, isExpandable: true, subItems: [] },
    { name: 'Sumo', icon: '🧑‍🦱', path: '/sumo', count: 9, isExpandable: true, subItems: [] },
    { name: 'Auto racing', icon: '🏎️', path: '/auto-racing', count: 30, isExpandable: true, subItems: [] },
    { name: 'Formula 1', icon: '🏁', path: '/formula-1', count: 1, isExpandable: true, subItems: [] },
    { name: 'Motorcycle racing', icon: '🏍️', path: '/motorcycle-racing', count: 2, isExpandable: true, subItems: [] },
    { name: 'Olympiad', icon: '🏅', path: '/olympiad', count: 1, isExpandable: true, subItems: [] },
    { name: 'Water polo', icon: '🤽', path: '/water-polo', count: 25, isExpandable: true, subItems: [] },
    { name: 'Biathlon', icon: '🎿', path: '/biathlon', count: 6, isExpandable: true, subItems: [] },
    { name: 'Skiing', icon: '⛷️', path: '/skiing', count: 1, isExpandable: true, subItems: [] },
    { name: 'Mini football', icon: '🥅', path: '/mini-football', count: 22, isExpandable: true, subItems: [] },
    { name: 'Beach football', icon: '🏖️', path: '/beach-football', count: 9, isExpandable: true, subItems: [] },
    { name: 'American football', icon: '🏈', path: '/american-football', count: 161, isExpandable: true, subItems: [] },
    { name: 'Billiards', icon: '🎱', path: '/billiards', count: 4, isExpandable: true, subItems: [] },
    { name: 'Snooker', icon: '🎱', path: '/snooker', count: 3, isExpandable: true, subItems: [] },
    { name: 'Cycling', icon: '🚴', path: '/cycling', count: 6, isExpandable: true, subItems: [] },
    { name: 'Cricket', icon: '🏏', path: '/cricket', count: 51, isExpandable: true, subItems: [] },
    { name: 'Chess', icon: '♟️', path: '/chess', count: 10, isExpandable: true, subItems: [] },
    { name: 'Darts', icon: '🎯', path: '/darts', count: 75, isExpandable: true, subItems: [] },
    { name: 'Cybersport', icon: '🎮', path: '/cybersport', count: 194, isExpandable: true, subItems: [] },
    { name: 'Australian football', icon: '🏉', path: '/australian-football', count: 12, isExpandable: true, subItems: [] },
  ];

  // Filter sports based on search term
  const filteredSports = sportsData.filter(sport => 
    sport.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sport.subItems?.some(sub => sub.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Deduplicate sports by name to avoid duplicate React keys (e.g., MMA, Boxing, Cricket)
  const uniqueSports = (() => {
    const seen = new Set();
    const result = [];
    for (const s of filteredSports) {
      const key = s.name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(s);
      }
    }
    return result;
  })();

  return (
    <div className="sidebar">
      {/* Navigation Links Section */}
      <div className="sidebar-navigation">
        <div className="prematch-live-switch">
          <button 
            className={`nav-tab ${matchType === 'prematch' ? 'active' : ''}`}
            onClick={() => handleTabSwitch('prematch')}
          >
            Prematch
          </button>
          <button 
            className={`nav-tab ${matchType === 'live' ? 'active' : ''}`}
            onClick={() => handleTabSwitch('live')}
          >
            Live
          </button>
        </div>
        <Link 
          to="/bets" 
          className="sidebar-nav-link"
          onClick={() => {
            handleMobileNavigation(() => {
            });
          }}
        >
          Check Bets
        </Link>
      </div>

      {/* Search Section */}
      <div className="search-section">
        <div className="search-container">
          <input
            type="text"
            placeholder="Search sports or matches..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>
      </div>

      {/* All Events Slider */}
      <div className="all-events-section">
        <div className="all-events-header" onClick={toggleAllEvents}>
          <span>All Events</span>
          <span className={`arrow ${allEventsExpanded ? 'expanded' : ''}`}>▼</span>
        </div>
        {allEventsExpanded && (
          <div className="all-events-content">
            <div className="events-slider">
              <input 
                type="range" 
                min="0" 
                max="100" 
                defaultValue="50"
                className="events-range"
              />
              <div className="events-count">1,234 events</div>
            </div>
            {/* Datepicker for filtering events by date (icon only, input on click) */}
            <div className="events-datepicker" style={{ position: 'relative', marginTop: 8 }}>
              {!showDateInput && (
                <button
                  className="datepicker-icon-btn"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'white', fontSize: 20 }}
                  onClick={() => setShowDateInput(true)}
                  title="Pick a date"
                >
                  <FaRegCalendarAlt />
                </button>
              )}
              {showDateInput && (
                <input
                  type="date"
                  className="datepicker-input"
                  autoFocus
                  value={selectedDate}
                  onChange={handleDateChange}
                  onBlur={() => setShowDateInput(false)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid #333', background: '#232323', color: 'white', fontSize: 13 }}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sports Section */}
      <div className="sports-section">
        <div className="sports-header" onClick={toggleSportsSection}>
          <span>Sports</span>
          <span className={`arrow ${sportsSectionHidden ? 'collapsed' : ''}`}>
            {sportsSectionHidden ? '▶' : '▼'}
          </span>
        </div>
        
        {!sportsSectionHidden && (
          <div className="sports-list">
            {uniqueSports.map((sport, idx) => (
              <div key={`${sport.name}-${idx}`} className="sport-item">
                <div 
                  className="sport-header"
                  onClick={() => {
                    toggleSport(sport.name);
                    
                    // Handle navigation - if on MatchMarkets page, navigate to home with filter
                    const wasHandled = handleSidebarNavigation(sport);
                    
                    // If not handled by custom navigation, apply filter normally
                    if (!wasHandled) {
                      handleSidebarFilter(sport.name);
                    }
                  }}
                >
                  <div className="sport-info">
                    <span className="sport-icon">{sport.icon}</span>
                    <span className="sport-name">{sport.name}</span>
                  </div>
                  {sport.isExpandable && (
                    <span className={`expand-arrow ${expandedSports[sport.name] ? 'expanded' : ''}`}>
                      ▶
                    </span>
                  )}
                </div>
                
                {sport.isExpandable && expandedSports[sport.name] && (
                  <div className="subcategories">
                    {sport.subItems.slice(0, showAllSubcategories[sport.name] ? undefined : 5).map((subItem, subIdx) => (
                      <Link
                        key={`${subItem.name}-${subIdx}`}
                        to={subItem.path}
                        className={`subcategory-item ${location.pathname === subItem.path ? 'active' : ''}`}
                        onClick={(e) => {
                          // Check if we're on MatchMarkets page and handle navigation
                          const wasHandled = handleSidebarNavigation(sport, subItem);
                          
                          if (wasHandled) {
                            // Prevent default Link navigation if we handled it
                            e.preventDefault();
                          } else {
                            // For normal navigation, dispatch filter events
                            handleSidebarFilter(subItem.name);
                            window.dispatchEvent(new CustomEvent('subcategoryFilter', { 
                              detail: { 
                                sport: sport.name,
                                subcategory: subItem.name 
                              } 
                            }));
                          }
                        }}
                      >
                        <span className="subcategory-name">{subItem.name}</span>
                      </Link>
                    ))}
                    
                    {sport.subItems.length > 5 && (
                      <button
                        className="show-more-btn"
                        onClick={() => toggleShowAllSubcategories(sport.name)}
                      >
                        {showAllSubcategories[sport.name] ? 'Show Less' : `Show ${sport.subItems.length - 5} More`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Wheel of Fortune Section - Only visible on small screens */}
      <div className="wheel-section" style={{ display: window.innerWidth <= 1024 ? 'block' : 'none' }}>
        <div className="wheel-header">
          <span>Games</span>
        </div>
        <div className="wheel-list">
          <button
            className="wheel-item"
            onClick={() => {
              setShowWheelModal(true);
              // Close sidebar on mobile when opening wheel
              if (window.innerWidth <= 1024 && closeSidebar) {
                closeSidebar();
              }
            }}
          >
            <div className="wheel-info">
              <span className="wheel-icon">🎰</span>
              <span className="wheel-name">Wheel of Fortune</span>
            </div>
          </button>
        </div>
      </div>

      {/* Wheel of Fortune Modal */}
      {showWheelModal && (
        <div className="wheel-modal-overlay" onClick={() => setShowWheelModal(false)}>
          <div className="wheel-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="wheel-modal-header">
              <h2>Wheel of Fortune</h2>
              <button 
                className="wheel-close-btn"
                onClick={() => setShowWheelModal(false)}
              >
                ×
              </button>
            </div>
            <div className="wheel-modal-body">
              <WheelOfFortune />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
