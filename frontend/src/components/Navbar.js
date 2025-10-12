import React, { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars } from '@fortawesome/free-solid-svg-icons';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../store/slices/authSlice';

const Navbar = ({ toggleSidebar, isSidebarOpen }) => {
  const isLoggedIn = useSelector(state => state.auth?.loggedIn || false);
  const user = useSelector(state => state.auth.user);
  const username = user?.username;
  const email = user?.email;
  const balance = user?.balance || 0;
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isBalanceHidden, setIsBalanceHidden] = useState(false);
  const profileRef = useRef(null);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <header className="navbar">
      <div className="navbar-container">
        {/* Left side: Logo only */}
        <div className="navbar-left">
          <Link to="/" className="nav-brand">
            <span className="brand-w">SKY</span>
            <span className="brand-e">BET</span>
          </Link>
        </div>

        {/* Right side: Language selector, Auth buttons, and Hamburger Menu */}
        <div className="navbar-right">
          {/* Language Selector */}
          <div className="language-selector">
            <span>🇬🇧</span>
            <span>EN</span>
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
                        My Account
                      </Link>
                      <Link to="/bets" className="profile-action-btn">
                        My Bets
                      </Link>
                      <button onClick={handleLogout} className="profile-logout-btn">
                        Logout
                      </button>
                    </div>
                  </div>
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
                Logout
              </button>
            </div>
          ) : (
            <div className="auth-buttons">
              <Link to="/login" className="login-btn">
                Log In
              </Link>
              <Link to="/signup" className="signup-btn">
                Sign Up
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