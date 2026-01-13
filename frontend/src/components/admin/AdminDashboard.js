import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faUsers, faChartLine, faMoneyBillWave, 
  faCog, faFileAlt, faSearch, faFilter, faFutbol
} from '@fortawesome/free-solid-svg-icons';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import React, { useRef, useState, useEffect } from 'react';
import SkeletonLoader from '../SkeletonLoader';
import { useLocation } from 'react-router-dom';
import ManageMatches from './ManageMatches';
import ManageUsers from './ManageUsers';
import apiService from '../../services/api';
import WebSocketService from '../../services/websocketService';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const AdminDashboard = () => {
  const barChartRef = useRef(null);
  const lineChartRef = useRef(null);
  const doughnutChartRef = useRef(null);

  // Main state
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();
  const [chartsEnabled, setChartsEnabled] = useState(false);

  // State for dashboard data
  const [dashboardData, setDashboardData] = useState({
    totalBets: 0,
    totalDeposits: 0,
    activeUsers: 0,
    activeMatches: 0
  });

  // Bet management state
  const [bets, setBets] = useState([]);
  const [betLoading, setBetLoading] = useState(false);
  const [betSearchQuery, setBetSearchQuery] = useState('');
  const [betStatusFilter, setBetStatusFilter] = useState('');
  const [currentBetPage, setCurrentBetPage] = useState(1);
  const [totalBetPages, setTotalBetPages] = useState(1);
  const [selectedBets, setSelectedBets] = useState([]);
  const [allBetsSelected, setAllBetsSelected] = useState(false);
  const [bulkAction, setBulkAction] = useState('');
  const [betEditModal, setBetEditModal] = useState({ open: false, bet: null });
  const [betSettleModal, setBetSettleModal] = useState({ open: false, bet: null });
  const [betResultModal, setBetResultModal] = useState({ open: false, bet: null });
  const [resultHomeScore, setResultHomeScore] = useState(0);
  const [resultAwayScore, setResultAwayScore] = useState(0);
  const [resultCompleted, setResultCompleted] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const [showAllBets, setShowAllBets] = useState(false);
  const [openActionId, setOpenActionId] = useState(null);
  const [aviatorRules, setAviatorRules] = useState([]);
  const [aviatorLoading, setAviatorLoading] = useState(false);
  const [newFloor, setNewFloor] = useState('');
  const [scheduleStart, setScheduleStart] = useState('');
  const [scheduleEnd, setScheduleEnd] = useState('');
  const [scheduleMin, setScheduleMin] = useState('');
  const [scheduleMax, setScheduleMax] = useState('');
  const [schedulePriority, setSchedulePriority] = useState(10);
  const [floorSaving, setFloorSaving] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [ruleActionBusy, setRuleActionBusy] = useState({});

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openActionId && !event.target.closest('.action-dropdown-container')) {
        setOpenActionId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openActionId]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (activeTab === 'bet-management') {
      console.log('[ADMIN DASHBOARD] Connecting to WebSocket for real-time bet updates...');
      
      // Connect to WebSocket
      WebSocketService.connect();
      
      // Listen for bet status updates
      const handleBetStatusUpdate = (data) => {
        console.log('[ADMIN DASHBOARD] Received bet status update:', data);
        
        // Update the specific bet in the current list
        setBets(prevBets => {
          return prevBets.map(bet => {
            if (bet._id === data.betId) {
              return {
                ...bet,
                status: data.status,
                actualWin: data.actualWin || bet.actualWin,
                updatedAt: new Date().toISOString()
              };
            }
            return bet;
          });
        });
        
        // Update last refresh time
        setLastRefresh(new Date());
      };

      // Listen for new bets
      const handleNewBet = (data) => {
        console.log('[ADMIN DASHBOARD] Received new bet:', data);
        
        // Add new bet to the beginning of the list if it matches current filters
        if (shouldIncludeBet(data)) {
          setBets(prevBets => [data, ...prevBets]);
          setLastRefresh(new Date());
        }
      };

      // Listen for bet updates
      const handleBetUpdate = (data) => {
        console.log('[ADMIN DASHBOARD] Received bet update:', data);
        
        // Update the specific bet
        setBets(prevBets => {
          return prevBets.map(bet => {
            if (bet._id === data.betId || bet._id === data._id) {
              return { ...bet, ...data };
            }
            return bet;
          });
        });
        
        setLastRefresh(new Date());
      };

      // Helper function to check if bet should be included based on current filters
      const shouldIncludeBet = (bet) => {
        if (betStatusFilter && bet.status !== betStatusFilter) {
          return false;
        }
        if (betSearchQuery) {
          const searchLower = betSearchQuery.toLowerCase();
          const matchesSearch = 
            bet.userId?.username?.toLowerCase().includes(searchLower) ||
            bet.userId?.email?.toLowerCase().includes(searchLower) ||
            bet.homeTeam?.toLowerCase().includes(searchLower) ||
            bet.awayTeam?.toLowerCase().includes(searchLower) ||
            bet.league?.toLowerCase().includes(searchLower) ||
            bet.market?.toLowerCase().includes(searchLower) ||
            bet.selection?.toLowerCase().includes(searchLower);
          
          if (!matchesSearch) {
            return false;
          }
        }
        return true;
      };

      // Add event listeners
      WebSocketService.on('bet_status_update', handleBetStatusUpdate);
      WebSocketService.on('new_bet', handleNewBet);
      WebSocketService.on('bet_update', handleBetUpdate);

      // Cleanup function
      return () => {
        console.log('[ADMIN DASHBOARD] Cleaning up WebSocket listeners...');
        WebSocketService.off('bet_status_update', handleBetStatusUpdate);
        WebSocketService.off('new_bet', handleNewBet);
        WebSocketService.off('bet_update', handleBetUpdate);
      };
    }
  }, [activeTab, betStatusFilter, betSearchQuery]);

  // Sample chart data
  const bettingActivityData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [{
      label: 'Bets',
      data: [12, 19, 3, 5, 2, 3, 15],
      backgroundColor: '#00ff88'
    }]
  };

  const depositWithdrawalData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Deposits',
        data: [5000, 4000, 6000, 3000, 7000, 6500],
        borderColor: '#00ff88',
        fill: false
      },
      {
        label: 'Withdrawals',
        data: [2000, 3000, 2500, 4000, 3500, 3000],
        borderColor: '#ff4444',
        fill: false
      }
    ]
  };

  const userDistributionData = {
    labels: ['New', 'Active', 'Inactive'],
    datasets: [{
      data: [300, 500, 200],
      backgroundColor: ['#00ff88', '#00cc6a', '#888888']
    }]
  };

  // Removed unused sample data - using real data from API

  // Form states

  const [heroSlides, setHeroSlides] = useState([]);
  const [heroLoading, setHeroLoading] = useState(false);
  const [heroError, setHeroError] = useState(null);
  const [showHeroModal, setShowHeroModal] = useState(false);
  const [editingHero, setEditingHero] = useState(null);
  const [heroForm, setHeroForm] = useState({ image: '', caption1: '', caption2: '', buttonText: '', buttonUrl: '', popupAdvert: false });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [deletingHeroId, setDeletingHeroId] = useState(null);

  // Fetch hero slides
  const fetchHeroSlides = async () => {
    try {
      setHeroLoading(true);
      const res = await apiService.getHeroSlides();
      setHeroSlides(res.data);
    } catch (err) {
      setHeroError('Failed to load hero slides');
    } finally {
      setHeroLoading(false);
    }
  };
  useEffect(() => { if (activeTab === 'hero') fetchHeroSlides(); }, [activeTab]);

  const openHeroModal = (slide = null) => {
    setEditingHero(slide);
    setHeroForm(slide ? { image: slide.image || '', caption1: slide.caption1 || '', caption2: slide.caption2 || '', buttonText: slide.buttonText || '', buttonUrl: slide.buttonUrl || '', popupAdvert: !!(slide.popupAdvert || slide.isAdvert || slide.tag === 'advert') } : { image: '', caption1: '', caption2: '', buttonText: '', buttonUrl: '', popupAdvert: false });
    setShowHeroModal(true);
    setUploadError(null);
  };
  const closeHeroModal = () => { setShowHeroModal(false); setEditingHero(null); };

  const handleHeroFormChange = (e) => {
    const { name, value } = e.target;
    setHeroForm({ ...heroForm, [name]: value });
  };

  const handleHeroImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await apiService.uploadHeroImage(formData);
      setHeroForm({ ...heroForm, image: res.data.imageUrl });
    } catch (err) {
      setUploadError('Image upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleHeroFormSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingHero) {
        await apiService.updateHeroSlide(editingHero._id, heroForm);
      } else {
        await apiService.createHeroSlide(heroForm);
      }
      fetchHeroSlides();
      closeHeroModal();
    } catch (err) {
      setUploadError('Failed to save hero slide');
    }
  };

  const handleDeleteHero = async (id) => {
    if (deletingHeroId) return;
    if (!window.confirm('Delete this hero slide?')) return;
    try {
      const validId = id || null;
      if (!validId) {
        throw new Error('Missing hero slide id');
      }
      setDeletingHeroId(validId);
      await apiService.deleteHeroSlide(validId);
      try { await apiService.invalidateCachePrefix('/admin/hero'); } catch (e) { void e; }
      fetchHeroSlides();
    } catch (err) {
      setHeroError('Failed to delete hero slide');
    } finally {
      setDeletingHeroId(null);
    }
  };

  const renderHeroSection = () => (
    <div className="admin-hero-section">
      <h2>Hero Section Management</h2>
      <button onClick={() => openHeroModal()} className="btn-edit" style={{ marginBottom: 16 }}>Add New Slide</button>
      {heroLoading ? <p>Loading...</p> : heroError ? <p style={{ color: 'red' }}>{heroError}</p> : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>Caption 1</th>
              <th>Caption 2</th>
              <th>Button Text</th>
              <th>Button URL</th>
              <th>Popup Advert</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {heroSlides.map(slide => (
              <tr key={slide._id || slide.id}>
                <td>{slide.image && <img src={slide.image} alt="hero" style={{ width: 80, height: 40, objectFit: 'cover' }} />}</td>
                <td>{slide.caption1}</td>
                <td>{slide.caption2}</td>
                <td>{slide.buttonText}</td>
                <td><a href={slide.buttonUrl} target="_blank" rel="noopener noreferrer">{slide.buttonUrl}</a></td>
                <td>{slide.popupAdvert || slide.isAdvert || slide.tag === 'advert' ? 'Yes' : 'No'}</td>
                <td>
                  <button className="btn-edit" onClick={() => openHeroModal(slide)}>Edit</button>
                  <button 
                    className="btn-delete" 
                    onClick={() => handleDeleteHero(slide._id || slide.id)}
                    disabled={!!deletingHeroId}
                  >
                    {deletingHeroId === (slide._id || slide.id) ? 'Deleting...' : 'Delete'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {showHeroModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{editingHero ? 'Edit Slide' : 'Add Slide'}</h3>
            <form onSubmit={handleHeroFormSubmit}>
              <div className="form-group">
                <label style={{ color: 'black' }}>Image</label>
                {heroForm.image && <img src={heroForm.image} alt="preview" style={{ width: 120, height: 60, objectFit: 'cover', display: 'block', marginBottom: 8 }} />}
                <input type="file" accept="image/*" onChange={handleHeroImageUpload} disabled={uploading} />
                {uploading && <span>Uploading...</span>}
                {uploadError && <span style={{ color: 'red' }}>{uploadError}</span>}
              </div>
              <div className="form-group">
                <label style={{ color: 'black' }}>Caption 1</label>
                <input 
                  type="text" 
                  name="caption1" 
                  value={heroForm.caption1} 
                  onChange={handleHeroFormChange} 
                  required={!heroForm.popupAdvert} 
                />
              </div>
              <div className="form-group">
                <label style={{ color: 'black' }}>Caption 2</label>
                <input 
                  type="text" 
                  name="caption2" 
                  value={heroForm.caption2} 
                  onChange={handleHeroFormChange} 
                  required={!heroForm.popupAdvert} 
                />
              </div>
              <div className="form-group">
                <label style={{ color: 'black' }}>Button Text</label>
                <input 
                  type="text" 
                  name="buttonText" 
                  value={heroForm.buttonText} 
                  onChange={handleHeroFormChange} 
                  required={!heroForm.popupAdvert} 
                />
              </div>
              <div className="form-group">
                <label style={{ color: 'black' }}>Button URL</label>
                <input 
                  type="text" 
                  name="buttonUrl" 
                  value={heroForm.buttonUrl} 
                  onChange={handleHeroFormChange} 
                  required={!heroForm.popupAdvert} 
                />
              </div>
              <div className="form-group">
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    name="popupAdvert"
                    checked={!!heroForm.popupAdvert}
                    onChange={(e) => setHeroForm(prev => ({ ...prev, popupAdvert: e.target.checked }))}
                    style={{ width: 18, height: 18, pointerEvents: 'auto', display: 'inline-block' }}
                  />
                  <span style={{ color: 'black' }}>Show on mobile as popup advert</span>
                </label>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn-edit">{editingHero ? 'Update' : 'Create'}</button>
                <button type="button" className="btn-delete" onClick={closeHeroModal}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  // Fetch real dashboard data
  useEffect(() => {
    const fetchStats = async () => {
      try {
        console.log('[ADMIN DASHBOARD] Fetching statistics...');
        const response = await apiService.getAdminDashboardStats();
        if (response.data.success) {
          const stats = response.data.data;
          console.log('[ADMIN DASHBOARD] Statistics received:', stats);
          setDashboardData({
            totalBets: stats.totalBets || 0,
            totalDeposits: stats.totalDeposits || 0,
            totalWithdrawals: stats.totalWithdrawals || 0,
            activeUsers: stats.activeUsers || 0,
            activeMatches: (stats.liveMatches || 0) + (stats.upcomingMatches || 0),
            totalUsers: stats.totalUsers || 0,
            totalRevenue: stats.totalRevenue || 0,
            netProfit: stats.netProfit || 0,
            betWinRate: stats.betWinRate || 0,
            todayDeposits: stats.todayDeposits || 0,
            todayWithdrawals: stats.todayWithdrawals || 0,
            weekDeposits: stats.weekDeposits || 0,
            weekWithdrawals: stats.weekWithdrawals || 0,
            monthDeposits: stats.monthDeposits || 0,
            monthWithdrawals: stats.monthWithdrawals || 0
          });
        }
      } catch (err) {
        console.error('Error fetching dashboard stats:', err);
        // Keep existing data or show zeros if API fails
      }
    };
    
    fetchStats();
    
    // Set up polling every 5 minutes
    const interval = setInterval(fetchStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    if (activeTab === 'dashboard') {
      let rid = requestAnimationFrame(() => setChartsEnabled(true));
      return () => {
        cancelAnimationFrame(rid);
        setChartsEnabled(false);
      };
    } else {
      setChartsEnabled(false);
    }
  }, [activeTab]);

  // Auto-fetch bets when bet-management tab is active
  useEffect(() => {
    if (activeTab === 'bet-management') {
      fetchBets();
    }
  }, [activeTab]);

  // Render functions for different sections
  const renderDashboard = () => (
    <div className="admin-dashboard-content">
      <div className="kpi-cards">
        <div className="kpi-card">
          <h3>Total Bets</h3>
          <p>{(dashboardData.totalBets || 0).toLocaleString()}</p>
          <small>Win Rate: {dashboardData.betWinRate || 0}%</small>
        </div>
        <div className="kpi-card">
          <h3>Total Deposits</h3>
          <p>${(dashboardData.totalDeposits || 0).toLocaleString()}</p>
          <small>Today: ${(dashboardData.todayDeposits || 0).toLocaleString()}</small>
        </div>
        <div className="kpi-card">
          <h3>Active Users</h3>
          <p>{(dashboardData.activeUsers || 0).toLocaleString()}</p>
          <small>Total: {(dashboardData.totalUsers || 0).toLocaleString()}</small>
        </div>
        <div className="kpi-card">
          <h3>Active Matches</h3>
          <p>{(dashboardData.activeMatches || 0).toLocaleString()}</p>
          <small>Live & Upcoming</small>
        </div>
        <div className="kpi-card">
          <h3>Total Revenue</h3>
          <p>${(dashboardData.totalRevenue || 0).toLocaleString()}</p>
          <small>Net Profit: ${(dashboardData.netProfit || 0).toLocaleString()}</small>
        </div>
        <div className="kpi-card">
          <h3>This Month</h3>
          <p>${(dashboardData.monthDeposits || 0).toLocaleString()}</p>
          <small>Deposits</small>
        </div>
      </div>

      <div className="charts">
        {chartsEnabled && (
          <>
            <div className="chart-container" style={{ maxHeight: '300px' }}>
              <h3>Betting Activity</h3>
              <Bar ref={barChartRef} data={bettingActivityData} options={{ responsive: true, maintainAspectRatio: false }} />
            </div>
            <div className="chart-container" style={{ maxHeight: '300px' }}>
              <h3>Deposits & Withdrawals</h3>
              <Line ref={lineChartRef} data={depositWithdrawalData} options={{ responsive: true, maintainAspectRatio: false }} />
            </div>
            <div className="chart-container" style={{ maxHeight: '300px' }}>
              <h3>User Distribution</h3>
              <Doughnut ref={doughnutChartRef} data={userDistributionData} options={{ responsive: true, maintainAspectRatio: false }} />
            </div>
          </>
        )}
      </div>
    </div>
  );

  const renderUserManagement = () => <ManageUsers />;

  // Bet management functions
  const fetchBets = async () => {
    try {
      setBetLoading(true);
      const params = new URLSearchParams({
        page: showAllBets ? 1 : currentBetPage,
        limit: showAllBets ? 10000 : 50,
        ...(betSearchQuery && { search: betSearchQuery }),
        ...(betStatusFilter && { status: betStatusFilter })
      });

      const response = await apiService.getAdminBets(params);
      setBets(response.data.bets || []);
      setTotalBetPages(showAllBets ? 1 : (response.data.pagination?.pages || 1));
    } catch (error) {
      console.error('Failed to fetch bets:', error);
      setBets([]);
    } finally {
      setBetLoading(false);
    }
  };

  const handleShowAllBets = async () => {
    setShowAllBets(true);
    setCurrentBetPage(1);
    setBetSearchQuery('');
    setBetStatusFilter('');
    await fetchBets();
  };

  const handleSelectBet = (betId, checked) => {
    if (checked) {
      setSelectedBets(prev => [...prev, betId]);
    } else {
      setSelectedBets(prev => prev.filter(id => id !== betId));
      setAllBetsSelected(false);
    }
  };

  const handleSelectAllBets = (checked) => {
    if (checked) {
      setSelectedBets(bets.map(bet => bet._id));
      setAllBetsSelected(true);
    } else {
      setSelectedBets([]);
      setAllBetsSelected(false);
    }
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selectedBets.length === 0) return;

    try {
      const response = await apiService.bulkUpdateBets({
        betIds: selectedBets,
        status: bulkAction
      });

      if (response.data.success) {
        alert(response.data.message);
        setSelectedBets([]);
        setAllBetsSelected(false);
        setBulkAction('');
        fetchBets();
      }
    } catch (error) {
      console.error('Bulk action failed:', error);
      alert('Failed to perform bulk action');
    }
  };

  const handleBetCancel = async (betId) => {
    if (!window.confirm('Are you sure you want to cancel this bet?')) return;

    try {
      const response = await apiService.settleBet(betId, { status: 'cancelled' });

      if (response.data.success) {
        alert('Bet cancelled successfully');
        fetchBets();
      }
    } catch (error) {
      console.error('Failed to cancel bet:', error);
      alert('Failed to cancel bet');
    }
  };

  const openBetEditModal = (bet) => {
    setBetEditModal({ open: true, bet });
  };

  const openBetSettleModal = (bet) => {
    setBetSettleModal({ open: true, bet });
  };

  const openBetResultModal = (bet) => {
    setBetResultModal({ open: true, bet });
    setResultHomeScore(0);
    setResultAwayScore(0);
    setResultCompleted(true);
  };

  const exportBetsToCSV = () => {
    // Check if there are bets to export
    if (!bets || bets.length === 0) {
      alert('No bets available to export');
      return;
    }

    const csvData = bets.map(bet => ({
      'Bet ID': bet._id,
      'User': bet.userId?.username || 'N/A',
      'Email': bet.userId?.email || 'N/A',
      'Match': `${bet.homeTeam} vs ${bet.awayTeam}`,
      'League': bet.league,
      'Market': bet.market,
      'Selection': bet.selection,
      'Stake': bet.stake,
      'Odds': bet.odds,
      'Potential Win': bet.potentialWin,
      'Status': bet.status,
      'Created': new Date(bet.createdAt).toLocaleString()
    }));

    // Double check that csvData has content
    if (csvData.length === 0) {
      alert('No valid bet data to export');
      return;
    }

    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bets-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // useEffect hooks - placed after function definitions
  useEffect(() => {
    return () => {
      const safeDestroy = (ref) => {
        const inst = ref?.current?.chartInstance || ref?.current;
        if (inst && typeof inst.destroy === 'function') {
          try { inst.destroy(); } catch (e) { /* ignore */ }
        }
      };
      safeDestroy(barChartRef);
      safeDestroy(lineChartRef);
      safeDestroy(doughnutChartRef);
    };
  }, []);

  // Allow selecting tab via URL query: /admin?tab=match-management
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab) {
      setActiveTab(tab);
    }
  }, [location.search]);

  // Fetch bets when bet management tab is active or filters change
  useEffect(() => {
    if (activeTab === 'bet-management') {
      fetchBets();
    }
  }, [activeTab, currentBetPage, betSearchQuery, betStatusFilter]);

  // Enhanced real-time polling for bet management
  useEffect(() => {
    let betPollingInterval;
    
    if (activeTab === 'bet-management') {
      // Initial fetch
      setIsAutoRefreshing(true);
      fetchBets().finally(() => setIsAutoRefreshing(false));
      setLastRefresh(new Date());
      
      // Set up more frequent polling for bet data (every 30 seconds)
      betPollingInterval = setInterval(() => {
        console.log('[BET MANAGEMENT] Auto-refreshing bet data...');
        setIsAutoRefreshing(true);
        fetchBets().finally(() => {
          setIsAutoRefreshing(false);
          setLastRefresh(new Date());
        });
      }, 30000); // 30 seconds
    }
    
    return () => {
      if (betPollingInterval) {
        clearInterval(betPollingInterval);
      }
    };
  }, [activeTab]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'bet-management') {
        setCurrentBetPage(1);
        fetchBets();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [betSearchQuery, betStatusFilter]);

  const renderBetManagement = () => (
    <div className="admin-table-container">
      <div className="table-header flex flex-col md:flex-row gap-4 items-start md:items-center">
        <div className="search-filter flex flex-wrap gap-2 w-full md:w-auto">
          <div className="flex items-center bg-gray-700 rounded px-2 py-1 w-full md:w-auto">
            <FontAwesomeIcon icon={faSearch} className="text-gray-400 mr-2" />
            <input 
              type="text" 
              placeholder="Search by match, bet ID..." 
              value={betSearchQuery}
              onChange={(e) => { setBetSearchQuery(e.target.value); setShowAllBets(false); }}
              className="bg-transparent border-none text-white focus:outline-none w-full"
            />
          </div>
          <div className="flex items-center bg-gray-700 rounded px-2 py-1 w-full md:w-auto">
            <FontAwesomeIcon icon={faFilter} className="text-gray-400 mr-2" />
            <select 
              value={betStatusFilter}
              onChange={(e) => { setBetStatusFilter(e.target.value); setShowAllBets(false); }}
              className="bg-transparent border-none text-white focus:outline-none w-full"
              style={{ color: 'white', backgroundColor: '#1f2937' }} // Ensure options are visible on dark background
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
              <option value="cancelled">Cancelled</option>
              <option value="void">Void</option>
            </select>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button 
              className="btn-refresh flex-1 md:flex-none"
              onClick={fetchBets}
              disabled={betLoading}
            >
              {betLoading ? 'Loading...' : 'Refresh'}
            </button>
            <button 
              className="btn-show-all flex-1 md:flex-none"
              onClick={handleShowAllBets}
              disabled={betLoading}
            >
              Show All
            </button>
          </div>
        </div>
        
        {/* Real-time data indicator */}
        <div className="real-time-indicator md:ml-auto">
          <div className="refresh-status">
            {isAutoRefreshing ? (
              <span className="refreshing">
                <span className="spinner"></span>
                Auto-refreshing...
              </span>
            ) : (
              <span className="idle">
                <span className="status-dot"></span>
                Live Data
              </span>
            )}
          </div>
          {lastRefresh && (
            <div className="last-refresh">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>
      
      {betLoading ? (
        <div style={{ padding: '16px 0' }}>
          <SkeletonLoader type="generic" count={6} />
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="overflow-x-auto">
          <table className="admin-table hidden md:table w-full">
            <thead>
              <tr>
                <th>
                  <input 
                    type="checkbox" 
                    checked={allBetsSelected}
                    onChange={handleSelectAllBets}
                  />
                </th>
                <th>Bet ID</th>
                <th>User</th>
                <th>Match</th>
                <th>Market</th>
                <th>Selection</th>
                <th>Stake</th>
                <th>Odds</th>
                <th>Potential Win</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bets.map(bet => (
                <tr key={bet._id} className={selectedBets.includes(bet._id) ? 'selected' : ''}>
                  <td>
                    <input 
                      type="checkbox" 
                      checked={selectedBets.includes(bet._id)}
                      onChange={(e) => handleSelectBet(bet._id, e.target.checked)}
                    />
                  </td>
                  <td>{bet._id.slice(-8)}</td>
                  <td>
                    {bet.userId ? (
                      <div className="user-info max-w-[100px] md:max-w-[150px] lg:max-w-[200px]">
                        <div className="username truncate" title={bet.userId.username}>{bet.userId.username}</div>
                        <div className="email truncate text-xs text-gray-400" title={bet.userId.email}>{bet.userId.email}</div>
                      </div>
                    ) : 'N/A'}
                  </td>
                  <td>
                    <div className="match-info max-w-[120px] md:max-w-[180px] lg:max-w-xs">
                      <div className="teams truncate" title={`${bet.homeTeam} vs ${bet.awayTeam}`}>{bet.homeTeam} vs {bet.awayTeam}</div>
                      <div className="league truncate text-xs text-gray-400" title={bet.league}>{bet.league}</div>
                    </div>
                  </td>
                  <td><div className="max-w-[80px] md:max-w-[120px] truncate" title={bet.market}>{bet.market}</div></td>
                  <td><div className="max-w-[80px] md:max-w-[120px] truncate" title={bet.selection}>{bet.selection}</div></td>
                  <td>${bet.stake?.toFixed(2)}</td>
                  <td>{bet.odds}</td>
                  <td>${bet.potentialWin?.toFixed(2)}</td>
                  <td>
                    <span className={`status-badge ${bet.status}`}>
                      {bet.status}
                    </span>
                  </td>
                  <td>
                    {new Date(bet.createdAt).toLocaleDateString()}
                  </td>
                  <td>
                    <div className="action-buttons relative action-dropdown-container">
                      <button 
                          onClick={() => setOpenActionId(openActionId === bet._id ? null : bet._id)}
                          className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-cyan-400 flex items-center gap-1"
                        >
                          Actions ▼
                        </button>
                        {openActionId === bet._id && (
                          <div className="absolute right-0 mt-1 w-32 bg-gray-800 border border-gray-600 rounded shadow-xl z-50">
                            <button 
                              className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-700 text-gray-200 hover:text-white border-b border-gray-700"
                              onClick={() => { setOpenActionId(null); openBetEditModal(bet); }}
                            >
                              Edit
                            </button>
                            <button 
                              className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-700 text-gray-200 hover:text-white border-b border-gray-700"
                              onClick={() => { setOpenActionId(null); openBetSettleModal(bet); }}
                            >
                              Settle
                            </button>
                            <button 
                              className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-700 text-gray-200 hover:text-white border-b border-gray-700"
                              onClick={() => { setOpenActionId(null); openBetResultModal(bet); }}
                            >
                              Update Result
                            </button>
                            <button 
                              className="block w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-gray-700 hover:text-red-300 disabled:opacity-50"
                              onClick={() => { setOpenActionId(null); handleBetCancel(bet._id); }}
                              disabled={bet.status !== 'pending'}
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {bets.map(bet => (
              <div key={bet._id} className={`bg-gray-800 p-4 rounded-lg shadow border border-gray-700 ${selectedBets.includes(bet._id) ? 'border-blue-500 ring-1 ring-blue-500' : ''}`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      checked={selectedBets.includes(bet._id)}
                      onChange={(e) => handleSelectBet(bet._id, e.target.checked)}
                      className="h-4 w-4"
                    />
                    <span className="text-xs text-gray-400 font-mono">#{bet._id.slice(-8)}</span>
                    <span className={`status-badge ${bet.status} text-xs px-2 py-0.5`}>
                      {bet.status}
                    </span>
                  </div>
                  <div className="text-right text-xs text-gray-400">
                    {new Date(bet.createdAt).toLocaleDateString()}
                  </div>
                </div>

                <div className="mb-3">
                   {bet.userId && (
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-blue-400 font-semibold">{bet.userId.username}</span>
                        <span className="text-gray-500 text-xs">({bet.userId.email})</span>
                      </div>
                   )}
                   <div className="text-white font-medium break-words">{bet.homeTeam} vs {bet.awayTeam}</div>
                   <div className="text-gray-400 text-xs break-words">{bet.league}</div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3 bg-gray-750 p-2 rounded">
                  <div>
                    <div className="text-gray-400 text-xs">Market</div>
                    <div className="text-white text-sm break-words">{bet.market}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">Selection</div>
                    <div className="text-white text-sm break-words">{bet.selection}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">Stake</div>
                    <div className="text-white text-sm">${bet.stake?.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">Pot. Win</div>
                    <div className="text-green-400 text-sm font-bold">${bet.potentialWin?.toFixed(2)}</div>
                  </div>
                </div>

                <div className="flex justify-end mt-3 relative action-dropdown-container">
                  <button 
                    onClick={() => setOpenActionId(openActionId === bet._id ? null : bet._id)}
                    className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm text-cyan-400 flex items-center justify-center gap-2"
                  >
                    Actions ▼
                  </button>
                  {openActionId === bet._id && (
                    <div className="absolute right-0 top-full mt-1 w-full bg-gray-800 border border-gray-600 rounded shadow-xl z-50">
                      <button 
                        className="block w-full text-left px-4 py-3 text-sm hover:bg-gray-700 text-white border-b border-gray-700"
                        onClick={() => { setOpenActionId(null); openBetEditModal(bet); }}
                      >
                        Edit
                      </button>
                      <button 
                        className="block w-full text-left px-4 py-3 text-sm hover:bg-gray-700 text-white border-b border-gray-700"
                        onClick={() => { setOpenActionId(null); openBetSettleModal(bet); }}
                      >
                        Settle
                      </button>
                      <button 
                        className="block w-full text-left px-4 py-3 text-sm hover:bg-gray-700 text-white border-b border-gray-700"
                        onClick={() => { setOpenActionId(null); openBetResultModal(bet); }}
                      >
                        Update Result
                      </button>
                      <button 
                        className="block w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-gray-700 disabled:opacity-50"
                        onClick={() => { setOpenActionId(null); handleBetCancel(bet._id); }}
                        disabled={bet.status !== 'pending'}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {selectedBets.length > 0 && (
            <div className="bulk-actions">
              <span>{selectedBets.length} bets selected</span>
              <select 
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value)}
              >
                <option value="">Bulk Actions</option>
                <option value="won">Mark as Won</option>
                <option value="lost">Mark as Lost</option>
                <option value="void">Mark as Void</option>
                <option value="cancelled">Cancel</option>
              </select>
              <button 
                className="btn-apply-bulk"
                onClick={handleBulkAction}
                disabled={!bulkAction}
              >
                Apply
              </button>
            </div>
          )}
          
          <div className="table-footer">
            <div className="pagination">
              <button 
                onClick={() => setCurrentBetPage(prev => Math.max(1, prev - 1))}
                disabled={currentBetPage === 1}
              >
                Previous
              </button>
              <span>Page {currentBetPage} of {totalBetPages}</span>
              <button 
                onClick={() => setCurrentBetPage(prev => Math.min(totalBetPages, prev + 1))}
                disabled={currentBetPage === totalBetPages}
              >
                Next
              </button>
            </div>
            <button className="btn-export" onClick={exportBetsToCSV}>
              Export to CSV
            </button>
          </div>
        </>
      )}
    </div>
  );



  const renderSettings = () => (
    <div className="admin-settings-container">
      <div className="settings-section">
        <h3>Payment Gateways</h3>
        <div className="toggle-group">
          <label className="text-black font-semibold">
            <input type="checkbox" /> Stripe
          </label>
          <label className="text-black font-semibold">
            <input type="checkbox" /> PayPal
          </label>
          <label className="text-black font-semibold">
            <input type="checkbox" /> Bank Transfer
          </label>
        </div>
      </div>

      <div className="settings-section">
        <h3>Email Templates</h3>
        <div className="template-selector">
          <select>
            <option>Welcome Email</option>
            <option>Deposit Confirmation</option>
            <option>Withdrawal Request</option>
          </select>
          <button className="btn-edit-template">Edit Template</button>
        </div>
      </div>

      <div className="settings-section">
        <h3>System Configuration</h3>
        <div className="form-group">
          <label style={{ color: 'black' }}>Default Currency</label>
          <select>
            <option>USD</option>
            <option>EUR</option>
            <option>GBP</option>
          </select>
        </div>
        <div className="form-group">
          <label className="text-black font-semibold">
            <input type="checkbox" /> Enable GDPR Compliance
          </label>
        </div>
      </div>
    </div>
  );

  const renderAviatorManagement = () => (
    <div className="admin-settings-container aviator-management">
      <div className="settings-section">
        <h3 className="text-white">Aviator Management</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 bg-gray-900 rounded border border-gray-700">
            <div className="mb-3 text-white font-semibold">Global Floor</div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                step="0.01"
                value={newFloor}
                onChange={(e) => setNewFloor(e.target.value)}
                className="shadow border rounded w-full py-2 px-3 text-white bg-gray-800 border-gray-600 placeholder-gray-400"
                placeholder="e.g. 5.5"
              />
              <button
                className={`bg-green-600 ${floorSaving ? 'opacity-60 cursor-not-allowed' : 'hover:bg-green-700'} text-white font-bold py-2 px-4 rounded`}
                disabled={floorSaving}
                aria-busy={floorSaving}
                onClick={async () => {
                  if (!newFloor || floorSaving) return;
                  try {
                    setFloorSaving(true);
                    const resp = await apiService.createAviatorRule({
                      name: `Floor ${newFloor}x`,
                      type: 'global_floor',
                      floorMultiplier: parseFloat(newFloor),
                      active: true,
                      priority: 0
                    });
                    if (resp?.data?.rule) {
                      setAviatorRules(prev => [resp.data.rule, ...prev]);
                    }
                    setNewFloor('');
                    fetchAviatorRules();
                  } catch (e) { alert('Failed to save floor rule'); }
                  finally { setFloorSaving(false); }
                }}
              >
                {floorSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
          <div className="p-4 bg-gray-900 rounded border border-gray-700">
            <div className="mb-3 text-white font-semibold">Scheduled Control Window</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-white text-sm mb-1">Start</label>
                <input
                  type="time"
                  value={scheduleStart}
                  onChange={(e) => setScheduleStart(e.target.value)}
                  className="shadow border rounded w-full py-2 px-3 text-white bg-gray-800 border-gray-600 placeholder-gray-400"
                />
              </div>
              <div>
                <label className="block text-white text-sm mb-1">End</label>
                <input
                  type="time"
                  value={scheduleEnd}
                  onChange={(e) => setScheduleEnd(e.target.value)}
                  className="shadow border rounded w-full py-2 px-3 text-white bg-gray-800 border-gray-600 placeholder-gray-400"
                />
              </div>
              <div>
                <label className="block text-white text-sm mb-1">Min</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={scheduleMin}
                  onChange={(e) => setScheduleMin(e.target.value)}
                  className="shadow border rounded w-full py-2 px-3 text-white bg-gray-800 border-gray-600 placeholder-gray-400"
                  placeholder="10"
                />
              </div>
              <div>
                <label className="block text-white text-sm mb-1">Max</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={scheduleMax}
                  onChange={(e) => setScheduleMax(e.target.value)}
                  className="shadow border rounded w-full py-2 px-3 text-white bg-gray-800 border-gray-600 placeholder-gray-400"
                  placeholder="15"
                />
              </div>
              <div>
                <label className="block text-white text-sm mb-1">Priority</label>
                <input
                  type="number"
                  value={schedulePriority}
                  onChange={(e) => setSchedulePriority(parseInt(e.target.value || '0', 10))}
                  className="shadow border rounded w-full py-2 px-3 text-white bg-gray-800 border-gray-600 placeholder-gray-400"
                />
              </div>
            </div>
            <div className="mt-3">
              <button
                className={`bg-green-600 ${scheduleSaving ? 'opacity-60 cursor-not-allowed' : 'hover:bg-green-700'} text-white font-bold py-2 px-4 rounded`}
                disabled={scheduleSaving}
                aria-busy={scheduleSaving}
                onClick={async () => {
                  if (!scheduleStart || !scheduleEnd || !scheduleMin || !scheduleMax || scheduleSaving) return;
                  try {
                    setScheduleSaving(true);
                    const resp = await apiService.createAviatorRule({
                      name: `Window ${scheduleStart}-${scheduleEnd} ${scheduleMin}-${scheduleMax}x`,
                      type: 'schedule',
                      startTime: scheduleStart,
                      endTime: scheduleEnd,
                      rangeMin: parseFloat(scheduleMin),
                      rangeMax: parseFloat(scheduleMax),
                      active: true,
                      priority: schedulePriority
                    });
                    if (resp?.data?.rule) {
                      setAviatorRules(prev => [resp.data.rule, ...prev]);
                    }
                    setScheduleStart(''); setScheduleEnd(''); setScheduleMin(''); setScheduleMax('');
                    fetchAviatorRules();
                  } catch (e) { alert('Failed to save schedule rule'); }
                  finally { setScheduleSaving(false); }
                }}
              >
                {scheduleSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="settings-section">
        <div className="flex justify-between items-center">
          <h3 className="text-white">Active Rules</h3>
          <button
            className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded"
            onClick={fetchAviatorRules}
          >
            Refresh
          </button>
        </div>
        {aviatorLoading ? (
          <div style={{ padding: '12px 0' }}>
            <SkeletonLoader type="generic" count={3} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table w-full text-white">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Active</th>
                  <th>Details</th>
                  <th>Priority</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {aviatorRules.map(r => (
                  <tr key={r._id}>
                    <td>{r.name}</td>
                    <td>{r.type}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 12,
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            backgroundColor: r.active ? '#065f46' : '#7f1d1d',
                            color: '#fff',
                            minWidth: 64,
                            textAlign: 'center'
                          }}
                        >
                          {r.active ? 'Active' : 'Inactive'}
                        </span>
                        <label className="inline-flex items-center">
                          <input
                            type="checkbox"
                            checked={!!r.active}
                            disabled={!!ruleActionBusy[r._id]}
                            onChange={async (e) => {
                              if (ruleActionBusy[r._id]) return;
                              const nextActive = e.target.checked;
                              const prevActive = !!r.active;
                              setRuleActionBusy(prev => ({ ...prev, [r._id]: 'toggle' }));
                              setAviatorRules(prev => prev.map(x => x._id === r._id ? { ...x, active: nextActive } : x));
                              try {
                                await apiService.updateAviatorRule(r._id, { active: nextActive });
                                setTimeout(() => { fetchAviatorRules(); }, 0);
                              } catch (err) {
                                const msg = err?.response?.data?.error || 'Failed to update active status';
                                alert(msg);
                                setAviatorRules(prev => prev.map(x => x._id === r._id ? { ...x, active: prevActive } : x));
                                setTimeout(() => { fetchAviatorRules(); }, 0);
                              } finally {
                                setRuleActionBusy(prev => {
                                  const rest = { ...prev };
                                  delete rest[r._id];
                                  return rest;
                                });
                              }
                            }}
                          />
                        </label>
                      </div>
                    </td>
                    <td>
                      {r.type === 'global_floor' ? (
                        <span>{r.floorMultiplier}x</span>
                      ) : (
                        <span>{r.startTime}-{r.endTime} • {r.rangeMin}-{r.rangeMax}x</span>
                      )}
                    </td>
                    <td>{r.priority}</td>
                    <td className="space-x-2">
                      <button
                        className={`bg-blue-600 ${ruleActionBusy[r._id] ? 'opacity-60 cursor-not-allowed' : 'hover:bg-blue-700'} text-white py-1 px-3 rounded`}
                        disabled={!!ruleActionBusy[r._id]}
                        aria-busy={!!ruleActionBusy[r._id]}
                        onClick={async () => {
                          if (ruleActionBusy[r._id]) return;
                          setRuleActionBusy(prev => ({ ...prev, [r._id]: 'activate' }));
                          const prevActive = !!r.active;
                          setAviatorRules(prev => prev.map(x => x._id === r._id ? { ...x, active: true } : x));
                          try {
                            await apiService.updateAviatorRule(r._id, { active: true });
                            setTimeout(() => { fetchAviatorRules(); }, 0);
                          } catch (e) {
                            const msg = e?.response?.data?.error || 'Failed to activate';
                            alert(msg);
                            setAviatorRules(prev => prev.map(x => x._id === r._id ? { ...x, active: prevActive } : x));
                            setTimeout(() => { fetchAviatorRules(); }, 0);
                          } 
                          finally {
                            setRuleActionBusy(prev => {
                              const rest = { ...prev };
                              delete rest[r._id];
                              return rest;
                            });
                          }
                        }}
                      >
                        {ruleActionBusy[r._id] === 'activate' ? 'Activating…' : 'Activate'}
                      </button>
                      <button
                        className={`bg-gray-600 ${ruleActionBusy[r._id] ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gray-700'} text-white py-1 px-3 rounded`}
                        disabled={!!ruleActionBusy[r._id]}
                        aria-busy={!!ruleActionBusy[r._id]}
                        onClick={async () => {
                          if (ruleActionBusy[r._id]) return;
                          setRuleActionBusy(prev => ({ ...prev, [r._id]: 'disable' }));
                          const prevActive = !!r.active;
                          setAviatorRules(prev => prev.map(x => x._id === r._id ? { ...x, active: false } : x));
                          try {
                            await apiService.updateAviatorRule(r._id, { active: false });
                            setTimeout(() => { fetchAviatorRules(); }, 0);
                          } catch (e) {
                            const msg = e?.response?.data?.error || 'Failed to disable';
                            alert(msg);
                            setAviatorRules(prev => prev.map(x => x._id === r._id ? { ...x, active: prevActive } : x));
                            setTimeout(() => { fetchAviatorRules(); }, 0);
                          } 
                          finally {
                            setRuleActionBusy(prev => {
                              const rest = { ...prev };
                              delete rest[r._id];
                              return rest;
                            });
                          }
                        }}
                      >
                        {ruleActionBusy[r._id] === 'disable' ? 'Disabling…' : 'Disable'}
                      </button>
                      <button
                        className={`bg-red-600 ${ruleActionBusy[r._id] ? 'opacity-60 cursor-not-allowed' : 'hover:bg-red-700'} text-white py-1 px-3 rounded`}
                        disabled={!!ruleActionBusy[r._id]}
                        aria-busy={!!ruleActionBusy[r._id]}
                        onClick={async () => {
                          if (ruleActionBusy[r._id]) return;
                          setRuleActionBusy(prev => ({ ...prev, [r._id]: 'delete' }));
                          let deletedRule = null;
                          setAviatorRules(prev => {
                            const idx = prev.findIndex(x => x._id === r._id);
                            deletedRule = idx >= 0 ? prev[idx] : null;
                            return prev.filter(x => x._id !== r._id);
                          });
                          try {
                            await apiService.deleteAviatorRule(r._id);
                            setTimeout(() => { fetchAviatorRules(); }, 0);
                          } catch (e) {
                            const msg = e?.response?.data?.error || 'Failed to delete';
                            alert(msg);
                            if (deletedRule) {
                              setAviatorRules(prev => [deletedRule, ...prev]);
                            }
                            setTimeout(() => { fetchAviatorRules(); }, 0);
                          } 
                          finally {
                            setRuleActionBusy(prev => {
                              const rest = { ...prev };
                              delete rest[r._id];
                              return rest;
                            });
                          }
                        }}
                      >
                        {ruleActionBusy[r._id] === 'delete' ? 'Deleting…' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  async function fetchAviatorRules () {
    try {
      setAviatorLoading(true)
      const res = await apiService.getAviatorRules()
      setAviatorRules(res?.data?.rules || [])
    } finally {
      setAviatorLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'aviator-management') {
      fetchAviatorRules()
    }
  }, [activeTab])

  return (
    <div className={`admin-dashboard ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <div className="admin-sidebar">
        <div className="sidebar-header">
          <h2>Admin Panel</h2>
          <button 
            className="collapse-btn"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? '>' : '<'}
          </button>
        </div>
        <nav className="sidebar-nav">
          <ul>
            <li 
              className={activeTab === 'dashboard' ? 'active' : ''}
              onClick={() => setActiveTab('dashboard')}
            >
              <FontAwesomeIcon icon={faChartLine} />
              {!sidebarCollapsed && <span>Dashboard</span>}
            </li>
            <li 
              className={activeTab === 'user-management' ? 'active' : ''}
              onClick={() => setActiveTab('user-management')}
            >
              <FontAwesomeIcon icon={faUsers} />
              {!sidebarCollapsed && <span>User Management</span>}
            </li>
            <li 
              className={activeTab === 'bet-management' ? 'active' : ''}
              onClick={() => setActiveTab('bet-management')}
            >
              <FontAwesomeIcon icon={faMoneyBillWave} />
              {!sidebarCollapsed && <span>Bet Management</span>}
            </li>
            <li 
              className={activeTab === 'match-management' ? 'active' : ''}
              onClick={() => setActiveTab('match-management')}
            >
              <FontAwesomeIcon icon={faFutbol} />
              {!sidebarCollapsed && <span>Match Management</span>}
            </li>
            <li 
              className={activeTab === 'hero' ? 'active' : ''}
              onClick={() => setActiveTab('hero')}
            >
              <FontAwesomeIcon icon={faFileAlt} />
              {!sidebarCollapsed && <span>Hero Section</span>}
            </li>
            <li 
              className={activeTab === 'settings' ? 'active' : ''}
              onClick={() => setActiveTab('settings')}
            >
              <FontAwesomeIcon icon={faCog} />
              {!sidebarCollapsed && <span>Settings</span>}
            </li>
            <li 
              className={activeTab === 'aviator-management' ? 'active' : ''}
              onClick={() => setActiveTab('aviator-management')}
            >
              <FontAwesomeIcon icon={faFutbol} />
              {!sidebarCollapsed && <span>Aviator Management</span>}
            </li>
          </ul>
        </nav>
      </div>

      <div className="admin-main-content">
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'user-management' && renderUserManagement()}
        {activeTab === 'bet-management' && renderBetManagement()}
        {activeTab === 'match-management' && <ManageMatches />}
        {activeTab === 'hero' && renderHeroSection()}
        {activeTab === 'settings' && renderSettings()}
        {activeTab === 'aviator-management' && renderAviatorManagement()}
      </div>

      {/* Bet Edit Modal */}
      {betEditModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-auto flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10 rounded-t-lg">
              <h3 className="text-xl font-bold text-black">Edit Bet</h3>
              <button 
                className="text-gray-600 hover:text-gray-900 text-2xl font-bold"
                onClick={() => setBetEditModal({ open: false, bet: null })}
              >
                ×
              </button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar">
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const stake = parseFloat(formData.get('stake'));
                const odds = parseFloat(formData.get('odds'));
                const selection = formData.get('selection');
                const market = formData.get('market');

                try {
                  const response = await apiService.updateBet(betEditModal.bet._id, {
                    stake,
                    odds,
                    selection,
                    market
                  });

                  if (response.data.success) {
                    alert('Bet updated successfully');
                    setBetEditModal({ open: false, bet: null });
                    fetchBets(); // Refresh the bet list
                  }
                } catch (error) {
                  console.error('Failed to update bet:', error);
                  alert('Failed to update bet: ' + (error.response?.data?.error || error.message));
                }
              }}>
                <div className="mb-4">
                  <label className="block text-black text-sm font-bold mb-2">Stake:</label>
                  <input 
                    name="stake"
                    type="number" 
                    step="0.01" 
                    min="0.01"
                    defaultValue={betEditModal.bet?.stake}
                    required
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-black leading-tight focus:outline-none focus:shadow-outline bg-white border-gray-300"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-black text-sm font-bold mb-2">Odds:</label>
                  <input 
                    name="odds"
                    type="number" 
                    step="0.01" 
                    min="1.01"
                    defaultValue={betEditModal.bet?.odds}
                    required
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-black leading-tight focus:outline-none focus:shadow-outline bg-white border-gray-300"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-black text-sm font-bold mb-2">Selection:</label>
                  <input 
                    name="selection"
                    type="text"
                    defaultValue={betEditModal.bet?.selection}
                    required
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-black leading-tight focus:outline-none focus:shadow-outline bg-white border-gray-300"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-black text-sm font-bold mb-2">Market:</label>
                  <input 
                    name="market"
                    type="text"
                    defaultValue={betEditModal.bet?.market}
                    required
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-black leading-tight focus:outline-none focus:shadow-outline bg-white border-gray-300"
                  />
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button 
                    type="button" 
                    className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                    onClick={() => setBetEditModal({ open: false, bet: null })}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Bet Settle Modal */}
      {betSettleModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-auto flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10 rounded-t-lg">
              <h3 className="text-xl font-bold text-black">Settle Bet</h3>
              <button 
                className="text-gray-600 hover:text-gray-900 text-2xl font-bold"
                onClick={() => setBetSettleModal({ open: false, bet: null })}
              >
                ×
              </button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar">
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const status = formData.get('status');
                const actualWin = parseFloat(formData.get('actualWin')) || 0;

                try {
                  const response = await apiService.settleBet(betSettleModal.bet._id, {
                    status,
                    actualWin: status === 'won' ? actualWin : 0
                  });

                  if (response.data.success) {
                    alert(`Bet ${status} successfully`);
                    setBetSettleModal({ open: false, bet: null });
                    fetchBets(); // Refresh the bet list
                  }
                } catch (error) {
                  console.error('Failed to settle bet:', error);
                  alert('Failed to settle bet: ' + (error.response?.data?.error || error.message));
                }
              }}>
                <div className="mb-4 text-black">
                  <p className="mb-1"><strong>User:</strong> {betSettleModal.bet?.userId?.username}</p>
                  <p className="mb-1"><strong>Match:</strong> {betSettleModal.bet?.homeTeam} vs {betSettleModal.bet?.awayTeam}</p>
                  <p className="mb-1"><strong>Selection:</strong> {betSettleModal.bet?.selection}</p>
                  <p className="mb-1"><strong>Stake:</strong> ${betSettleModal.bet?.stake}</p>
                  <p className="mb-1"><strong>Potential Win:</strong> ${betSettleModal.bet?.potentialWin}</p>
                </div>
                <div className="mb-4">
                  <label className="block text-black text-sm font-bold mb-2">Status:</label>
                  <select 
                    name="status" 
                    required
                    className="shadow border rounded w-full py-2 px-3 text-black leading-tight focus:outline-none focus:shadow-outline bg-white border-gray-300"
                  >
                    <option value="won">Won</option>
                    <option value="lost">Lost</option>
                    <option value="void">Void</option>
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block text-black text-sm font-bold mb-2">Actual Win Amount:</label>
                  <input 
                    name="actualWin"
                    type="number" 
                    step="0.01" 
                    min="0"
                    placeholder="Enter actual win amount"
                    defaultValue={betSettleModal.bet?.potentialWin}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-black leading-tight focus:outline-none focus:shadow-outline bg-white border-gray-300"
                  />
                  <small className="text-gray-600 text-xs mt-1 block">
                    Leave empty or 0 for lost/void bets. For won bets, enter the actual payout amount.
                  </small>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button 
                    type="button" 
                    className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                    onClick={() => setBetSettleModal({ open: false, bet: null })}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                  >
                    Settle Bet
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {betResultModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-auto flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10 rounded-t-lg">
              <h3 className="text-xl font-bold text-black">Update Result</h3>
              <button 
                className="text-gray-600 hover:text-gray-900 text-2xl font-bold"
                onClick={() => setBetResultModal({ open: false, bet: null })}
              >
                ×
              </button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar">
              <form onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const resp = await apiService.updateOddsResult(betResultModal.bet.matchId, {
                    homeScore: Number(resultHomeScore),
                    awayScore: Number(resultAwayScore),
                    completed: Boolean(resultCompleted)
                  });
                  if (resp?.data?.success) {
                    setBetResultModal({ open: false, bet: null });
                    fetchBets();
                  }
                } catch (err) {
                  console.error('Update result failed:', err);
                  alert('Failed to update result: ' + (err?.response?.data?.error || err.message));
                }
              }}>
                <div className="mb-4 text-black">
                  <p className="mb-1"><strong>Match:</strong> {betResultModal.bet?.homeTeam} vs {betResultModal.bet?.awayTeam}</p>
                  <p className="mb-1"><strong>League:</strong> {betResultModal.bet?.league}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="mb-4">
                    <label className="block text-black text-sm font-bold mb-2">Home Score:</label>
                    <input
                      type="number"
                      min="0"
                      value={resultHomeScore}
                      onChange={(e) => setResultHomeScore(e.target.value)}
                      required
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-black leading-tight focus:outline-none focus:shadow-outline bg-white border-gray-300"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-black text-sm font-bold mb-2">Away Score:</label>
                    <input
                      type="number"
                      min="0"
                      value={resultAwayScore}
                      onChange={(e) => setResultAwayScore(e.target.value)}
                      required
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-black leading-tight focus:outline-none focus:shadow-outline bg-white border-gray-300"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-black text-sm font-bold mb-2">Completed:</label>
                    <select
                      value={resultCompleted ? 'true' : 'false'}
                      onChange={(e) => setResultCompleted(e.target.value === 'true')}
                      className="shadow border rounded w-full py-2 px-3 text-black leading-tight focus:outline-none focus:shadow-outline bg-white border-gray-300"
                    >
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button 
                    type="button" 
                    className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                    onClick={() => setBetResultModal({ open: false, bet: null })}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                  >
                    Save Result
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
