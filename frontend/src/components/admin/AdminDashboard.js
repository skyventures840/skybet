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
import { useLocation } from 'react-router-dom';
import ManageMatches from './ManageMatches';
import apiService from '../../services/api';

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
  const [users] = useState([]);
  const location = useLocation();

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
  const [heroForm, setHeroForm] = useState({ image: '', caption1: '', caption2: '', buttonText: '', buttonUrl: '' });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

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
    setHeroForm(slide ? { ...slide } : { image: '', caption1: '', caption2: '', buttonText: '', buttonUrl: '' });
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
    if (!window.confirm('Delete this hero slide?')) return;
    try {
      await apiService.deleteHeroSlide(id);
      fetchHeroSlides();
    } catch (err) {
      setHeroError('Failed to delete hero slide');
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
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {heroSlides.map(slide => (
              <tr key={slide._id}>
                <td>{slide.image && <img src={slide.image} alt="hero" style={{ width: 80, height: 40, objectFit: 'cover' }} />}</td>
                <td>{slide.caption1}</td>
                <td>{slide.caption2}</td>
                <td>{slide.buttonText}</td>
                <td><a href={slide.buttonUrl} target="_blank" rel="noopener noreferrer">{slide.buttonUrl}</a></td>
                <td>
                  <button className="btn-edit" onClick={() => openHeroModal(slide)}>Edit</button>
                  <button className="btn-delete" onClick={() => handleDeleteHero(slide._id)}>Delete</button>
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
                <input type="text" name="caption1" value={heroForm.caption1} onChange={handleHeroFormChange} required />
              </div>
              <div className="form-group">
                <label style={{ color: 'black' }}>Caption 2</label>
                <input type="text" name="caption2" value={heroForm.caption2} onChange={handleHeroFormChange} required />
              </div>
              <div className="form-group">
                <label style={{ color: 'black' }}>Button Text</label>
                <input type="text" name="buttonText" value={heroForm.buttonText} onChange={handleHeroFormChange} required />
              </div>
              <div className="form-group">
                <label style={{ color: 'black' }}>Button URL</label>
                <input type="text" name="buttonUrl" value={heroForm.buttonUrl} onChange={handleHeroFormChange} required />
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
      </div>
    </div>
  );

  const renderUserManagement = () => (
    <div className="admin-table-container">
      <div className="table-header">
        <div className="search-filter">
          <FontAwesomeIcon icon={faSearch} />
          <input type="text" placeholder="Search users..." />
          <FontAwesomeIcon icon={faFilter} />
          <select>
            <option>All Status</option>
            <option>Active</option>
            <option>Inactive</option>
          </select>
        </div>
      </div>
      <table className="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Email</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.id}>
              <td>{user.id}</td>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>
                <span className={`status-badge ${user.status}`}>
                  {user.status}
                </span>
              </td>
              <td>
                <button className="btn-edit">Edit</button>
                <button className="btn-delete">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="table-footer">
        <div className="pagination">
          <button>Previous</button>
          <span>Page 1 of 5</span>
          <button>Next</button>
        </div>
        <button className="btn-export">Export to CSV</button>
      </div>
    </div>
  );

  // Bet management functions
  const fetchBets = async () => {
    try {
      setBetLoading(true);
      const params = new URLSearchParams({
        page: currentBetPage,
        limit: 50,
        ...(betSearchQuery && { search: betSearchQuery }),
        ...(betStatusFilter && { status: betStatusFilter })
      });

      const response = await apiService.get(`/admin/bets?${params}`);
      setBets(response.data.bets || []);
      setTotalBetPages(response.data.pagination?.pages || 1);
    } catch (error) {
      console.error('Failed to fetch bets:', error);
      setBets([]);
    } finally {
      setBetLoading(false);
    }
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
      const response = await apiService.put('/admin/bets/bulk/status', {
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
      const response = await apiService.put(`/admin/bets/${betId}/status`, {
        status: 'cancelled'
      });

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

  const exportBetsToCSV = () => {
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
      <div className="table-header">
        <div className="search-filter">
          <FontAwesomeIcon icon={faSearch} />
          <input 
            type="text" 
            placeholder="Search bets..." 
            value={betSearchQuery}
            onChange={(e) => setBetSearchQuery(e.target.value)}
          />
          <FontAwesomeIcon icon={faFilter} />
          <select 
            value={betStatusFilter}
            onChange={(e) => setBetStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
            <option value="cancelled">Cancelled</option>
            <option value="void">Void</option>
          </select>
          <button 
            className="btn-refresh"
            onClick={fetchBets}
            disabled={betLoading}
          >
            {betLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>
      
      {betLoading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading bets...</p>
        </div>
      ) : (
        <>
          <table className="admin-table">
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
                      <div className="user-info">
                        <div className="username">{bet.userId.username}</div>
                        <div className="email">{bet.userId.email}</div>
                      </div>
                    ) : 'N/A'}
                  </td>
                  <td>
                    <div className="match-info">
                      <div className="teams">{bet.homeTeam} vs {bet.awayTeam}</div>
                      <div className="league">{bet.league}</div>
                    </div>
                  </td>
                  <td>{bet.market}</td>
                  <td>{bet.selection}</td>
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
                    <div className="action-buttons">
                      <button 
                        className="btn-edit"
                        onClick={() => openBetEditModal(bet)}
                      >
                        Edit
                      </button>
                      <button 
                        className="btn-settle"
                        onClick={() => openBetSettleModal(bet)}
                      >
                        Settle
                      </button>
                      <button 
                        className="btn-cancel"
                        onClick={() => handleBetCancel(bet._id)}
                        disabled={bet.status !== 'pending'}
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
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
          <label>
            <input type="checkbox" /> Stripe
          </label>
          <label>
            <input type="checkbox" /> PayPal
          </label>
          <label>
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
          <label>
            <input type="checkbox" /> Enable GDPR Compliance
          </label>
        </div>
      </div>
    </div>
  );

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
      </div>

      {/* Bet Edit Modal */}
      {betEditModal.open && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Edit Bet</h3>
              <button 
                className="modal-close"
                onClick={() => setBetEditModal({ open: false, bet: null })}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={(e) => {
                e.preventDefault();
                // Handle bet edit
                setBetEditModal({ open: false, bet: null });
              }}>
                <div className="form-group">
                  <label style={{ color: 'black' }}>Stake:</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0.01"
                    defaultValue={betEditModal.bet?.stake}
                  />
                </div>
                <div className="form-group">
                  <label style={{ color: 'black' }}>Odds:</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="1.01"
                    defaultValue={betEditModal.bet?.odds}
                  />
                </div>
                <div className="form-group">
                  <label style={{ color: 'black' }}>Selection:</label>
                  <input 
                    type="text"
                    defaultValue={betEditModal.bet?.selection}
                  />
                </div>
                <div className="form-actions">
                  <button type="button" onClick={() => setBetEditModal({ open: false, bet: null })}>
                    Cancel
                  </button>
                  <button type="submit">Save Changes</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Bet Settle Modal */}
      {betSettleModal.open && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Settle Bet</h3>
              <button 
                className="modal-close"
                onClick={() => setBetSettleModal({ open: false, bet: null })}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={(e) => {
                e.preventDefault();
                // Handle bet settlement
                setBetSettleModal({ open: false, bet: null });
              }}>
                <div className="bet-info">
                  <p><strong>User:</strong> {betSettleModal.bet?.userId?.username}</p>
                  <p><strong>Match:</strong> {betSettleModal.bet?.homeTeam} vs {betSettleModal.bet?.awayTeam}</p>
                  <p><strong>Selection:</strong> {betSettleModal.bet?.selection}</p>
                  <p><strong>Stake:</strong> ${betSettleModal.bet?.stake}</p>
                  <p><strong>Potential Win:</strong> ${betSettleModal.bet?.potentialWin}</p>
                </div>
                <div className="form-group">
                  <label style={{ color: 'black' }}>Status:</label>
                  <select>
                    <option value="won">Won</option>
                    <option value="lost">Lost</option>
                    <option value="void">Void</option>
                  </select>
                </div>
                <div className="form-group">
                  <label style={{ color: 'black' }}>Actual Win Amount:</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0"
                    placeholder="Enter actual win amount"
                  />
                </div>
                <div className="form-actions">
                  <button type="button" onClick={() => setBetSettleModal({ open: false, bet: null })}>
                    Cancel
                  </button>
                  <button type="submit">Settle Bet</button>
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