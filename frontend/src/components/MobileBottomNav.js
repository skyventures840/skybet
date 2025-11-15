import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { FaHome, FaListAlt, FaUser, FaShoppingCart } from 'react-icons/fa';

const MobileBottomNav = () => {
  const location = useLocation();
  const isLoggedIn = useSelector(state => state.auth?.loggedIn || false);
  // Use the activeBets slice (array) for selected bets count
  const activeBets = useSelector(state => state.activeBets || []);

  const navItems = [
    {
      path: '/',
      icon: FaHome,
      label: 'Home',
      isActive: location.pathname === '/'
    },
    {
      path: '/bets',
      icon: FaListAlt,
      label: 'My Bets',
      isActive: location.pathname === '/bets'
    },
    {
      path: isLoggedIn ? '/account' : '/login',
      icon: FaUser,
      label: 'Profile',
      isActive: location.pathname === '/account' || location.pathname === '/login'
    },
    {
      path: '/betslip',
      icon: FaShoppingCart,
      label: 'Bets Cart',
      isActive: location.pathname === '/betslip',
      badge: activeBets.length > 0 ? activeBets.length : null
    }
  ];

  return (
    <nav className="mobile-bottom-nav">
      {navItems.map((item) => {
        const IconComponent = item.icon;
        const isBetsCart = item.path === '/betslip';
        return (
          <Link
            key={item.path}
            to={isBetsCart ? '#' : item.path}
            className={`bottom-nav-item ${item.isActive ? 'active' : ''}`}
            onClick={(e) => {
              if (isBetsCart) {
                e.preventDefault();
                // Dispatch a global event to open the MobileBetslip modal
                window.dispatchEvent(new CustomEvent('openMobileBetslip'));
              }
            }}
          >
            <div className="bottom-nav-icon-container">
              <IconComponent className="bottom-nav-icon" />
              {isBetsCart && item.badge && (
                <span className="bottom-nav-badge">{item.badge}</span>
              )}
            </div>
            <span className="bottom-nav-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

export default MobileBottomNav;
