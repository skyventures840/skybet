import React, { useEffect, useState, useRef } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { loginSuccess } from './store/slices/authSlice';

import io from 'socket.io-client';

// Components
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Betslip from './components/Betslip';
import MobileBetslip from './components/MobileBetslip';
import PrivateRoute from './components/PrivateRoute';
import Footer from './components/Footer';
import MobileBottomNav from './components/MobileBottomNav';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import Account from './pages/Account';
import Bets from './pages/Bets';
import Football from './pages/Football';
import Basketball from './pages/Basketball';
import Tennis from './pages/Tennis';
import Baseball from './pages/Baseball';
import Hockey from './pages/Hockey';
import IceHockey from './pages/IceHockey';
import Soccer from './pages/Soccer';
import LiveBetting from './pages/LiveBetting';
import OddsPage from './pages/OddsPage';
import AdminDashboard from './pages/AdminDashboard';
import MatchDetail from './pages/MatchDetail';
import MatchMarkets from './pages/MatchMarkets';
import SportFallback from './components/SportFallback';

function App() {
  const location = useLocation();
  const dispatch = useDispatch();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const sidebarRef = useRef(null);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user && user.token && user.user) {
      dispatch(loginSuccess(user));
    }

    const socket = io(window.location.origin.replace(/\/$/, '')); // same-origin; dev proxy forwards to backend

    socket.on('connect', () => {
      console.log('Connected to Socket.IO server');
    });

    socket.on('matchUpdate', (updatedMatch) => {
      console.log('Match updated:', updatedMatch);
      // Dispatch an action to update the match in your Redux store
    });

    socket.on('oddsUpdate', (updatedMatch) => {
      console.log('Odds updated for match:', updatedMatch);
      // Dispatch an action to update the odds for the match in your Redux store
    });

    socket.on('newMatch', (newMatch) => {
      console.log('New match added:', newMatch);
      // Dispatch an action to add the new match to your Redux store
    });

    socket.on('matchDeleted', (matchId) => {
      console.log('Match deleted:', matchId);
      // Dispatch an action to remove the deleted match from your Redux store
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from Socket.IO server');
    });

    return () => {
      socket.disconnect();
    };
  }, [dispatch]);

  const isLoggedIn = useSelector(state => state.auth?.loggedIn || false);
  const isAdmin = useSelector(state => state.auth?.isAdmin || false);
  
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';

  const toggleSidebar = () => {
    console.log('toggleSidebar called, current state:', isSidebarOpen);
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Close sidebar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        console.log('Click outside detected, closing sidebar');
        setIsSidebarOpen(false);
      }
    };

    if (isSidebarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSidebarOpen]);

  // Debug logging
  console.log('App isSidebarOpen:', isSidebarOpen);

  return (
    <div className="app">
      <div className="hide-on-mobile">
        <h2></h2>
      </div>
      
      <div className="hide-on-website">
        <div className="page-content">
          <Navbar toggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />

          
          <div className="under-navbar">
            {!isAuthPage && (
              <div 
                ref={sidebarRef}
                className={`side-bar-wrapper ${isSidebarOpen ? 'sidebar-open' : ''}`}
              >
                <Sidebar closeSidebar={() => setIsSidebarOpen(false)} />
              </div>
            )}
            
            <div className="middle">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/account" element={
                  <PrivateRoute auth={{ isLoggedIn }}>
                    <Account />
                  </PrivateRoute>
                } />
                <Route path="/bets" element={
                  <PrivateRoute auth={{ isLoggedIn, isAdmin, isBettingRoute: true }}>
                    <Bets />
                  </PrivateRoute>
                } />
                <Route path="/football" element={<Football />} />
                <Route path="/football/*" element={<SportFallback sport="Football" />} />
                <Route path="/basketball" element={<Basketball />} />
                <Route path="/basketball/*" element={<SportFallback sport="Basketball" />} />
                <Route path="/tennis" element={<Tennis />} />
                <Route path="/tennis/*" element={<SportFallback sport="Tennis" />} />
                <Route path="/baseball" element={<Baseball />} />
                <Route path="/baseball/*" element={<SportFallback sport="Baseball" />} />
                <Route path="/hockey" element={<Hockey />} />
                <Route path="/hockey/*" element={<SportFallback sport="Hockey" />} />
                <Route path="/icehockey" element={<IceHockey />} />
                <Route path="/icehockey/*" element={<SportFallback sport="Ice Hockey" />} />
                <Route path="/soccer" element={<Soccer />} />
                <Route path="/soccer/*" element={<SportFallback sport="Soccer" />} />
                <Route path="/live" element={<LiveBetting />} />
                <Route path="/admin" element={
                  <PrivateRoute auth={{ isLoggedIn, isAdmin, isAdminRoute: true }}>
                    <AdminDashboard />
                  </PrivateRoute>
                } />
                <Route path="/admin/matches" element={
                  <PrivateRoute auth={{ isLoggedIn, isAdmin, isAdminRoute: true }}>
                    <AdminDashboard />
                  </PrivateRoute>
                } />
                <Route path="/odds" element={<OddsPage />} />
                <Route path="/match/:matchId" element={<MatchDetail />} />
                <Route path="/match/:matchId/markets" element={<MatchMarkets />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
            
            {!isAuthPage && (
              <div className="bet-slip-wrapper">
                <Betslip />
              </div>
            )}
          </div>
          
          {/* Mobile Bottom Navigation */}
          <MobileBottomNav />
          
          {/* Mobile Betslip - Only shows on mobile when there are selected matches */}
          <MobileBetslip />
        </div>
        <Footer />
      </div>
    </div>
  );
}

export default App;

