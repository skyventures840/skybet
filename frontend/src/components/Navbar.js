import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars } from '@fortawesome/free-solid-svg-icons';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../store/slices/authSlice';
import lingva from '../services/lingva';

const Navbar = ({ toggleSidebar, isSidebarOpen }) => {
  const isLoggedIn = useSelector(state => state.auth?.loggedIn || false);
  const authUser = useSelector(state => state.auth.user);
  const userSlice = useSelector(state => state.user);
  
  // Prefer userSlice (mutable state) over authUser (session state)
  const username = userSlice?.username || authUser?.username;
  const email = userSlice?.email || authUser?.email;
  const balance = userSlice?.balance !== undefined ? userSlice.balance : (authUser?.balance || 0);
  
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isBalanceHidden, setIsBalanceHidden] = useState(false);
  const profileRef = useRef(null);
  const [lang, setLang] = useState(lingva.getLang());
  const [showLang, setShowLang] = useState(false);
  const [tr, setTr] = useState({});
  const langRef = useRef(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 767);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 767);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const languages = [
    { code: 'en', flag: '🇬🇧', label: 'English' },
    { code: 'pt', flag: '🇧🇷', label: 'Português' },
    { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
    { code: 'fr', flag: '🇫🇷', label: 'Le Français' },
    { code: 'it', flag: '🇮🇹', label: 'Italiano' },
    { code: 'es', flag: '🇪🇸', label: 'Español' },
    { code: 'pl', flag: '🇵🇱', label: 'Polski' },
    { code: 'ro', flag: '🇷🇴', label: 'Română' },
    { code: 'fa', flag: '🇮🇷', label: 'فارسی' },
    { code: 'sl', flag: '🇸🇮', label: 'Slovenčina' },
    { code: 'el', flag: '🇬🇷', label: 'Ελληνικά' },
    { code: 'ar', flag: '🇦🇪', label: 'العربية' },
    { code: 'cs', flag: '🇨🇿', label: 'Čeština' },
    { code: 'nl', flag: '🇳🇱', label: 'Nederlands' },
    { code: 'hu', flag: '🇭🇺', label: 'Magyar' },
    { code: 'hr', flag: '🇭🇷', label: 'Hrvatski' }
  ];

  const handleLogout = () => {
    dispatch(logout());
    localStorage.removeItem('user');
    navigate('/');
  };

  const toggleProfile = () => {
    setIsProfileOpen(!isProfileOpen);
  };

  const toggleBalanceVisibility = () => {
    setIsBalanceHidden(!isBalanceHidden);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      const langDrop = document.querySelector('.language-dropdown');
      const profileDrop = document.querySelector('.profile-dropdown');
      if (profileRef.current && !profileRef.current.contains(event.target) && !(profileDrop && profileDrop.contains(event.target))) {
        setIsProfileOpen(false);
      }
      if (langRef.current && !langRef.current.contains(event.target) && !(langDrop && langDrop.contains(event.target))) {
        setShowLang(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const keys = isLoggedIn ? ['Logout', 'My Account', 'My Bets'] : ['Log In', 'Sign Up'];
    lingva.translateMany(keys, lang).then(setTr);
  }, [lang, isLoggedIn]);

  useEffect(() => {
    const onLang = (e) => setLang(e.detail.lang);
    window.addEventListener('languageChanged', onLang);
    return () => window.removeEventListener('languageChanged', onLang);
  }, []);

  return (
    <header className="navbar">
      <div className="navbar-container">
        {/* Left side: Logo only */}
        <div className="navbar-left">
          <Link to="/" className="nav-brand" data-no-translate>
            <span className="brand-w" data-no-translate>SKY</span>
            <span className="brand-e" data-no-translate>BET</span>
          </Link>
        </div>

        <div className="navbar-right">
          <div className="language-selector" ref={langRef} onClick={() => setShowLang(!showLang)}>
            <span className="language-current">{(languages.find(l => l.code === lang)?.flag) || '🏳️'}</span>
            <span className="language-current-code">{lang.toUpperCase()}</span>
            {showLang && (
              isMobile
                ? createPortal(
                    <div className="language-dropdown language-dropdown-portal">
                      {languages.map(({ code, flag, label }) => (
                        <div
                          key={code}
                          className={`language-option ${code === lang ? 'active' : ''}`}
                          onClick={() => { lingva.setLang(code); setLang(code); setShowLang(false); }}
                        >
                          <span className="language-flag">{flag}</span>
                          <span className="language-label">{label}</span>
                        </div>
                      ))}
                    </div>,
                    document.body
                  )
                : (
                    <div className="language-dropdown">
                      {languages.map(({ code, flag, label }) => (
                        <div
                          key={code}
                          className={`language-option ${code === lang ? 'active' : ''}`}
                          onClick={() => { lingva.setLang(code); setLang(code); setShowLang(false); }}
                        >
                          <span className="language-flag">{flag}</span>
                          <span className="language-label">{label}</span>
                        </div>
                      ))}
                    </div>
                  )
            )}
          </div>
          {isLoggedIn ? (
            <div className="user-section">
              <div className="balance-display" onClick={toggleBalanceVisibility}>
                {isBalanceHidden ? (
                  <span className="balance-hidden">••••••</span>
                ) : (
                  <span className="balance-visible">${balance.toFixed(2)}</span>
                )}
              </div>
              <div className="user-profile" ref={profileRef}>
                <div className="profile-avatar" onClick={toggleProfile}>
                  {username ? username.charAt(0).toUpperCase() : 'U'}
                </div>
                {isProfileOpen && (
                  isMobile
                    ? createPortal(
                        <div className="profile-dropdown profile-dropdown-portal">
                          <div className="profile-header">
                            <div className="profile-avatar-large">
                              {username ? username.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div className="profile-info">
                              <h3>{username}</h3>
                              <p>{email || 'No email provided'}</p>
                            </div>
                          </div>
                          <div className="profile-details">
                            <div className="profile-detail-item">
                              <span className="detail-label">Balance:</span>
                              <span className="detail-value" onClick={toggleBalanceVisibility}>
                                {isBalanceHidden ? (
                                  <span className="balance-hidden">••••••</span>
                                ) : (
                                  <span className="balance-visible">${balance.toFixed(2)}</span>
                                )}
                              </span>
                            </div>
                          </div>
                          <div className="profile-actions">
                            <Link to="/account" className="profile-action-btn">
                              {tr['My Account'] || 'My Account'}
                            </Link>
                            <Link to="/bets" className="profile-action-btn">
                              {tr['My Bets'] || 'My Bets'}
                            </Link>
                            <button onClick={handleLogout} className="profile-logout-btn">
                              {tr['Logout'] || 'Logout'}
                            </button>
                          </div>
                        </div>,
                        document.body
                      )
                    : (
                        <div className="profile-dropdown">
                          <div className="profile-header">
                            <div className="profile-avatar-large">
                              {username ? username.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div className="profile-info">
                              <h3>{username}</h3>
                              <p>{email || 'No email provided'}</p>
                            </div>
                          </div>
                          <div className="profile-details">
                            <div className="profile-detail-item">
                              <span className="detail-label">Balance:</span>
                              <span className="detail-value" onClick={toggleBalanceVisibility}>
                                {isBalanceHidden ? (
                                  <span className="balance-hidden">••••••</span>
                                ) : (
                                  <span className="balance-visible">${balance.toFixed(2)}</span>
                                )}
                              </span>
                            </div>
                          </div>
                          <div className="profile-actions">
                            <Link to="/account" className="profile-action-btn">
                              {tr['My Account'] || 'My Account'}
                            </Link>
                            <Link to="/bets" className="profile-action-btn">
                              {tr['My Bets'] || 'My Bets'}
                            </Link>
                            <button onClick={handleLogout} className="profile-logout-btn">
                              {tr['Logout'] || 'Logout'}
                            </button>
                          </div>
                        </div>
                      )
                )}
                <Link to="/account" className="username-link">
                  {username}
                </Link>
              </div>
              {/* Place hamburger next to the profile section */}
              <button
                className={`hamburger-menu ${isSidebarOpen ? 'active' : ''}`}
                onClick={toggleSidebar}
                aria-label="Toggle sidebar menu"
              >
                <FontAwesomeIcon icon={faBars} aria-hidden="true" />
              </button>
              <button onClick={handleLogout} className="logout-btn">
                {tr['Logout'] || 'Logout'}
              </button>
            </div>
          ) : (
            <div className="auth-buttons">
              <Link to="/login" className="login-btn">
                {tr['Log In'] || 'Log In'}
              </Link>
              <Link to="/signup" className="signup-btn">
                {tr['Sign Up'] || 'Sign Up'}
              </Link>
              {/* Place hamburger next to auth buttons for logged-out state */}
              <button
                className={`hamburger-menu ${isSidebarOpen ? 'active' : ''}`}
                onClick={toggleSidebar}
                aria-label="Toggle sidebar menu"
              >
                <FontAwesomeIcon icon={faBars} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
