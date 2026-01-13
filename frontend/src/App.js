import React, { useEffect, useState, useRef, Suspense } from 'react';
import SkeletonLoader from './components/SkeletonLoader';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { loginSuccess } from './store/slices/authSlice';
import { setUser } from './store/slices/userSlice';

import io from 'socket.io-client';
import WheelOfFortune from './components/WheelOfFortune';
import Aviator from './components/Aviator';

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Core components (loaded immediately)
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Betslip from './components/Betslip';
import MobileBetslip from './components/MobileBetslip';
import PrivateRoute from './components/PrivateRoute';
import Footer from './components/Footer';
import MobileBottomNav from './components/MobileBottomNav';

// Lazy-loaded pages for code splitting
import Home from './pages/Home';
const lazyWithRetry = (importer, key) => React.lazy(() => importer().catch(err => {
  const isChunkError = err && (err.name === 'ChunkLoadError' || /Loading chunk/.test(String(err.message || '')));
  if (isChunkError) {
    const flag = `chunk_reload_${key}`;
    const hasReloaded = sessionStorage.getItem(flag);
    if (!hasReloaded) {
      sessionStorage.setItem(flag, '1');
      window.location.reload();
      return new Promise(() => {});
    }
  }
  throw err;
}));
const Login = React.lazy(() => import('./pages/Login'));
const SignUp = React.lazy(() => import('./pages/SignUp'));
const Account = React.lazy(() => import('./pages/Account'));
const Bets = React.lazy(() => import('./pages/Bets'));
const Football = React.lazy(() => import('./pages/Football'));
const Basketball = React.lazy(() => import('./pages/Basketball'));
const Tennis = React.lazy(() => import('./pages/Tennis'));
const Baseball = React.lazy(() => import('./pages/Baseball'));
const Hockey = React.lazy(() => import('./pages/Hockey'));
const IceHockey = React.lazy(() => import('./pages/IceHockey'));
const Soccer = React.lazy(() => import('./pages/Soccer'));
const LiveBetting = React.lazy(() => import('./pages/LiveBetting'));
const OddsPage = React.lazy(() => import('./pages/OddsPage'));
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));
const MatchDetail = React.lazy(() => import('./pages/MatchDetail'));
const MatchMarkets = lazyWithRetry(() => import('./pages/MatchMarkets'), 'MatchMarkets');
const SportFallback = React.lazy(() => import('./components/SportFallback'));
const ResetPassword = React.lazy(() => import('./pages/ResetPassword'));

import useOddsStore from './store/oddsStore';
import apiService from './services/api';

// Loading component for Suspense fallback
const LoadingSpinner = () => (
  <div style={{ padding: '12px 16px' }}>
    <SkeletonLoader type="generic" count={3} />
  </div>
);

function App() {
  const location = useLocation();
  const dispatch = useDispatch();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const sidebarRef = useRef(null);
  const WS_URL = process.env.REACT_APP_WS_URL || null;

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user && user.token && user.user) {
      dispatch(loginSuccess(user));
      dispatch(setUser(user.user));
    }

    // Guard Socket.IO connection when backend URL is missing/unavailable
    if (!WS_URL) {
      console.warn('WS_URL not set; skipping Socket.IO connection.');
      return;
    }

    const { updateMatch, updateOdds, addMatch, deleteMatch } = useOddsStore.getState();
    const socket = io(WS_URL, { withCredentials: true });

    socket.on('connect', () => {
      console.log('Connected to Socket.IO server');
      // Subscribe to user-specific updates if logged in
      const stored = JSON.parse(localStorage.getItem('user'));
      const uid = stored?.user?._id || stored?.user?.id;
      if (uid) socket.emit('subscribe:user', uid);
    });

    socket.on('matchUpdate', (updatedMatch) => {
      console.log('Match updated:', updatedMatch);
      updateMatch(updatedMatch);
    });

    socket.on('oddsUpdate', (updatedMatch) => {
      console.log('Odds updated for match:', updatedMatch);
      const matchId = updatedMatch?._id || updatedMatch?.id;
      const odds = updatedMatch?.odds || updatedMatch;
      if (matchId) updateOdds(matchId, odds);
      else console.warn('oddsUpdate missing match id');
    });

    socket.on('newMatch', (newMatch) => {
      console.log('New match added:', newMatch);
      addMatch(newMatch);
    });

    socket.on('matchDeleted', (matchId) => {
      console.log('Match deleted:', matchId);
      deleteMatch(matchId);
    });

    // Forward bet updates to any listeners (e.g., Bets page)
    socket.on('betUpdate', (payload) => {
      console.log('Bet update received:', payload);
      try {
        window.dispatchEvent(new CustomEvent('bet:update', { detail: payload }));
      } catch (e) {
        // Silently handle event dispatch errors
      }
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from Socket.IO server');
    });

    return () => {
      socket.disconnect();
    };
  }, [dispatch, WS_URL]);

  useEffect(() => {
    const connection = navigator.connection || navigator.webkitConnection || navigator.mozConnection;
    const isSlow = !!connection && (connection.effectiveType === '2g' || connection.saveData === true);
    const ttlFast = isSlow ? 15000 : 30000;
    const ttlLong = isSlow ? 60000 : 120000;
    const tasks = [];
    tasks.push(apiService.getMatches());
    tasks.push(apiService.getPopularMatches());
    tasks.push(apiService.getLiveMatches());
    // Prefetch odds feed to enable instant fallback rendering on /live
    tasks.push(apiService.getOddsMatches());
    if (localStorage.getItem('user')) {
      tasks.push(apiService.getUserBets());
      tasks.push(apiService.getBalance());
      tasks.push(apiService.getTransactions());
    }
    Promise.allSettled(tasks).then(() => {
      void ttlFast;
      void ttlLong;
    });
  }, []);

  const isLoggedInStore = useSelector(state => state.auth?.loggedIn || false);
  const hasToken = (() => {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return !!parsed?.token;
    } catch { return false; }
  })();
  const isLoggedIn = isLoggedInStore || hasToken;
  const isAdmin = useSelector(state => state.auth?.isAdmin || false);
  
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup' || location.pathname === '/reset-password';
  const isAviatorPage = location.pathname === '/aviator';

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

  if (isAviatorPage) {
    return (
      <PrivateRoute auth={{ isLoggedIn }}>
        <div className="app" style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
          <ToastContainer position="top-center" theme="dark" />
          <Aviator />
        </div>
      </PrivateRoute>
    );
  }

  return (
    <div className="app">
      <ToastContainer position="top-right" theme="dark" />
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
            <Suspense fallback={<LoadingSpinner />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/reset-password" element={<ResetPassword />} />
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
                <Route path="/wheel" element={<WheelOfFortune />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </div>
          
          {!isAuthPage && (
            <div className="bet-slip-wrapper">
              <Betslip />
            </div>
          )}
        </div>
        
        {/* Mobile Betslip - Only shows on mobile when there are selected matches */}
        <MobileBetslip />
        <Footer />

        {/* Mobile Bottom Navigation (fixed at viewport bottom; rendered after footer) */}
        <MobileBottomNav />
      </div>
    </div>
  );
}

export default App;
