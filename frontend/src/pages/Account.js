import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import apiService from '../services/api';
import { setUser } from '../store/slices/authSlice';

import NowPaymentsDeposit from '../components/NowPaymentsDeposit';
import '../components/Deposit.css';

const Account = () => {
  const { user } = useSelector(state => state.auth);
  const dispatch = useDispatch();

  const [activeTab, setActiveTab] = useState('profile');
  const [profileData, setProfileData] = useState({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    phoneNumber: '',
    address: '',
    balance: 0,
    lifetimeWinnings: 0,
    createdAt: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Bet history state
  const [betHistory, setBetHistory] = useState([]);
  const [betHistoryLoading, setBetHistoryLoading] = useState(false);
  const [betHistoryError, setBetHistoryError] = useState(null);
  const [betFilter, setBetFilter] = useState('all'); // all | pending | won | lost | void
  const [sortBy, setSortBy] = useState('newest'); // newest | oldest | stake_desc | stake_asc
  const [expandedMap, setExpandedMap] = useState({});
  const [stats, setStats] = useState({
    activeBets: 0,
    totalBets: 0,
    winRate: 0,
    wonBets: 0,
    lostBets: 0
  });


  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [selectedCrypto, setSelectedCrypto] = useState('bitcoin');
  const [walletAddress, setWalletAddress] = useState('');

  useEffect(() => {
    // Hydrate Redux user from localStorage if missing
    const localUser = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null;
    if (!user && localUser && localUser.token && localUser.user) {
      dispatch(setUser(localUser.user));
    }

    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('Fetching user profile...');
        const response = await apiService.getUserProfile();
        console.log('Profile API response:', response);
    
        // Handle different response structures
        let userData;
        if (response.data) {
          userData = response.data.user || response.data;
        } else {
          userData = response;
        }
        
        console.log('Processed user data:', userData);
        
        if (userData) {
          setProfileData({
            username: userData.username || '',
            email: userData.email || '',
            firstName: userData.firstName || '',
            lastName: userData.lastName || '',
            phoneNumber: userData.phoneNumber || '',
            address: userData.address || '',
            balance: userData.balance || 0,
            lifetimeWinnings: userData.lifetimeWinnings || 0,
            createdAt: userData.createdAt || ''
          });
          dispatch(setUser(userData));
        } else {
          throw new Error('No user data received from server');
        }
      } catch (err) {
        console.error('Failed to fetch profile:', err);
        setError(`Failed to load profile data: ${err.response?.data?.error || err.message}`);
      } finally {
        setLoading(false);
      }
    };

    // Only fetch profile if we have a token and haven't loaded profile data yet
    const token = localUser?.token;
    if (token && !profileData.username) {
      fetchProfile();
    }
  }, []); // Remove user and dispatch from dependencies to prevent multiple calls

  // Fetch bet history when history tab is active
  useEffect(() => {
    const fetchBetHistory = async () => {
      if (activeTab === 'bets') {
        try {
          console.log('Fetching bet history...');
          setBetHistoryLoading(true);
          setBetHistoryError(null);
          
          const response = await apiService.getUserBets();
          console.log('Bet history API response:', response);
          
          if (response && response.data) {
            console.log('Bet history data:', response.data);
            setBetHistory(response.data.bets || []);
          } else {
            console.log('No response data received');
            setBetHistory([]);
          }
        } catch (err) {
          console.error('Failed to fetch bet history:', err);
          console.error('Error details:', {
            message: err.message,
            response: err.response?.data,
            status: err.response?.status
          });
          setBetHistoryError('Failed to load bet history.');
          setBetHistory([]);
        } finally {
          setBetHistoryLoading(false);
        }
      }
    };

    fetchBetHistory();
    const fetchBetStats = async () => {
      if (activeTab === 'bets') {
        try {
          console.log('Fetching bet stats summary (Account)...');
          const response = await apiService.getBetStatsSummary();
          if (response && response.data) {
            const summary = response.data;
            const activeBets = summary.pendingBets ?? 0;
            const totalBets = summary.totalBets ?? 0;
            const winRate = summary.winRate != null ? parseFloat(summary.winRate) : 0;
            const wonBets = summary.wonBets ?? 0;
            const lostBets = summary.lostBets ?? 0;
            setStats({ activeBets, totalBets, winRate, wonBets, lostBets });
          } else {
            setStats({ activeBets: 0, totalBets: 0, winRate: 0, wonBets: 0, lostBets: 0 });
          }
        } catch (err) {
          console.error('Failed to fetch bet stats summary (Account):', err);
          setStats({ activeBets: 0, totalBets: 0, winRate: 0, wonBets: 0, lostBets: 0 });
        }
      }
    };

    fetchBetStats();
  }, [activeTab]);

  const cryptoOptions = [
    { value: 'bitcoin', label: 'Bitcoin (BTC)', icon: '₿' },
    { value: 'ethereum', label: 'Ethereum (ETH)', icon: 'Ξ' },
    { value: 'litecoin', label: 'Litecoin (LTC)', icon: 'Ł' },
    { value: 'usdt', label: 'Tether (USDT)', icon: '₮' },
    { value: 'bnb', label: 'Binance Coin (BNB)', icon: 'BNB' }
  ];



  const handleWithdraw = async (e) => {
    e.preventDefault();
    const amount = parseFloat(withdrawAmount);
    
    if (amount && walletAddress && amount <= (user.balance || 0)) {
      try {
        const response = await apiService.withdraw({
          userId: user.id,
          amount,
          currency: selectedCrypto,
          walletAddress
        });
        const updatedUser = { ...user, balance: (user.balance || 0) - amount };
        dispatch(setUser(updatedUser));
        localStorage.setItem('user', JSON.stringify({ ...JSON.parse(localStorage.getItem('user')), user: updatedUser }));
        alert(response.data.message);
        setWithdrawAmount('');
        setWalletAddress('');
      } catch (error) {
        setError(error.response?.data?.message || 'Withdrawal failed');
      }
    } else {
      alert('Insufficient balance or invalid amount');
    }
  };



  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Status and result helpers for modern match rendering
  const normalizeStatus = (s) => {
    if (!s) return 'pending';
    const lower = String(s).toLowerCase();
    if (lower === 'win') return 'won';
    if (lower === 'loss') return 'lost';
    return lower;
  };

  const getMatchType = (match, bet) => {
    const sel = String(match.selection || '').toUpperCase();
    if (['1', 'X', '2'].includes(sel)) return '1x2';
    return bet.market || 'Market';
  };

  const getFtResult = (match) => {
    if (match.result && (match.result.homeScore != null || match.result.awayScore != null)) {
      const hs = match.result.homeScore ?? '-';
      const as = match.result.awayScore ?? '-';
      return `${hs}-${as}`;
    }
    if (match.finalScore) return match.finalScore;
    if (match.outcome && ['1','X','2'].includes(String(match.outcome))) return match.outcome;
    return normalizeStatus(match.status) === 'pending' ? '—' : (match.outcome || match.status || '—');
  };

  const toggleExpanded = (id) => {
    setExpandedMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getCombinedOdds = (bet) => {
    const val = bet?.odds?.combined ?? bet?.odds?.selected ?? 0;
    const num = Number(val);
    return Number.isFinite(num) ? num : 0;
  };

  const formatOdds = (odds) => {
    if (typeof odds === 'number') {
      return odds.toFixed(2);
    } else if (odds && typeof odds?.selected === 'number') {
      return odds.selected.toFixed(2);
    } else if (odds && typeof odds === 'string') {
      return parseFloat(odds).toFixed(2);
    }
    return '0.00';
  };

  const formatAmount = (amount) => {
    if (typeof amount === 'number') {
      return amount.toFixed(2);
    } else if (amount && typeof amount === 'string') {
      return parseFloat(amount).toFixed(2);
    }
    return '0.00';
  };

  const getFilteredSortedBets = () => {
    let items = Array.isArray(betHistory) ? betHistory.slice() : [];
    if (betFilter !== 'all') {
      items = items.filter(b => (b.status || '').toLowerCase() === betFilter);
    }
    switch (sortBy) {
      case 'oldest':
        items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        break;
      case 'stake_desc':
        items.sort((a, b) => (b.stake || 0) - (a.stake || 0));
        break;
      case 'stake_asc':
        items.sort((a, b) => (a.stake || 0) - (b.stake || 0));
        break;
      case 'newest':
      default:
        items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
    }
    return items;
  };

  return (
    <div className="account-page">
      <div className="account-header">
        <h1>My Account</h1>
        <div className="account-balance">
          <span className="balance-label">Balance:</span>
          <span className="balance-amount">${(profileData.balance || 0).toFixed(2)}</span>
        </div>
      </div>

      <div className="account-tabs">
        <button 
          className={`account-tab ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          Profile
        </button>
        <button 
          className={`account-tab ${activeTab === 'deposit' ? 'active' : ''}`}
          onClick={() => setActiveTab('deposit')}
        >
          Deposit
        </button>
        <button 
          className={`account-tab ${activeTab === 'withdraw' ? 'active' : ''}`}
          onClick={() => setActiveTab('withdraw')}
        >
          Withdraw
        </button>
        <button 
          className={`account-tab ${activeTab === 'bets' ? 'active' : ''}`}
          onClick={() => {
            console.log('Bet History tab clicked');
            setActiveTab('bets');
          }}
        >
          Bet History
        </button>
        <button 
          className={`account-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Transaction History
        </button>
      </div>

      <div className="account-content">
        {activeTab === 'profile' && (
          <div className="profile-section">
            <h2>Profile Information</h2>
            {loading ? (
              <p>Loading profile...</p>
            ) : error ? (
              <p className="error-message">{error}</p>
            ) : (
              <div className="profile-form">
                <div className="form-group">
                  <label>Username</label>
                  <input type="text" value={profileData.username || ''} readOnly />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={profileData.email || ''} readOnly />
                </div>
                <div className="form-group">
                  <label>First Name</label>
                  <input type="text" value={profileData.firstName || ''} readOnly />
                </div>
                <div className="form-group">
                  <label>Last Name</label>
                  <input type="text" value={profileData.lastName || ''} readOnly />
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input type="text" value={profileData.phoneNumber || ''} readOnly />
                </div>
                <div className="form-group">
                  <label>Address</label>
                  <input type="text" value={profileData.address || ''} readOnly />
                </div>
                <div className="form-group">
                  <label>Member Since</label>
                  <input type="text" value={profileData.createdAt ? new Date(profileData.createdAt).toLocaleDateString() : ''} readOnly />
                </div>
                <div className="form-group">
                  <label>Lifetime Winnings</label>
                  <input type="text" value={`$${(profileData.lifetimeWinnings || 0).toFixed(2)}`} readOnly />
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'deposit' && (
          <NowPaymentsDeposit />
        )}

        {activeTab === 'withdraw' && (
          <div className="withdraw-section">
            <h2>Withdraw Funds</h2>
            <div className="crypto-withdraw">
              <form onSubmit={handleWithdraw}>
                <div className="form-group">
                  <label>Select Cryptocurrency</label>
                  <select 
                    value={selectedCrypto} 
                    onChange={(e) => setSelectedCrypto(e.target.value)}
                    className="crypto-select"
                  >
                    {cryptoOptions.map(crypto => (
                      <option key={crypto.value} value={crypto.value}>
                        {crypto.icon} {crypto.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Withdrawal Amount (USD)</label>
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="Enter amount"
                    min="20"
                    max={user.balance || 0}
                    step="0.01"
                    required
                  />
                  <small>Available: ${(user.balance || 0).toFixed(2)}</small>
                </div>

                <div className="form-group">
                  <label>Withdrawal Address</label>
                  <input
                    type="text"
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    placeholder="Enter your wallet address"
                    required
                  />
                </div>

                <div className="withdraw-info">
                  <p>⚠️ Minimum withdrawal: $20</p>
                  <p>⚠️ Withdrawals are processed within 24 hours</p>
                  <p>⚠️ Network fees may apply</p>
                </div>

                <button type="submit" className="withdraw-btn">
                  Request Withdrawal
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'bets' && (
          <div className="bets-section account-page">
            <h2>Bet History</h2>
            
            <div className="bet-history">
              {betHistoryLoading ? (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <p>Loading bet history...</p>
                </div>
              ) : betHistoryError ? (
                <div className="error-container">
                  <p className="error-message">{betHistoryError}</p>
                  <button 
                    className="retry-btn"
                    onClick={() => setActiveTab('bets')}
                  >
                    Retry
                  </button>
                </div>
              ) : betHistory.length === 0 ? (
                <div className="no-bets">
                  <div className="no-bets-icon">🎯</div>
                  <h3>No bets placed yet</h3>
                  <p>Start betting on your favorite sports to see your bet history here.</p>
                </div>
              ) : (
                <>
              <div className="bet-history-header">
                <div className="bet-stats">
                      <span>Total: {stats.totalBets}</span>
                      <span>Pending: {stats.activeBets}</span>
                      <span>Won: {stats.wonBets}</span>
                      <span>Lost: {stats.lostBets}</span>
                </div>
                <div className="bet-filters">
                  {['all','pending','won','lost'].map(key => (
                    <button 
                      key={key}
                      className={`filter-pill ${betFilter === key ? 'active' : ''}`}
                      onClick={() => setBetFilter(key)}
                    >
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </button>
                  ))}
                  <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="filter-pill"
                    style={{ paddingRight: '28px' }}
                    aria-label="Sort bets"
                  >
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                    <option value="stake_desc">Stake: High to Low</option>
                    <option value="stake_asc">Stake: Low to High</option>
                  </select>
                </div>
              </div>
              <div className="bet-list">
                    {getFilteredSortedBets().map((bet) => (
                  <div key={bet.id} className="bet-item">
                    <div 
                      className="bet-header"
                      onClick={() => toggleExpanded(bet.id)}
                      aria-expanded={!!expandedMap[bet.id]}
                    >
                      <div className="bet-summary-compact">
                        <span className="bet-id">#{bet.id}</span>
                        <span className="bet-time">{formatDate(bet.createdAt)}</span>
                        <span className="bet-possible-win">${formatAmount(bet.potentialWin)}</span>
                      </div>
                      <div 
                        className={`bet-status status-${(bet.status || '').toLowerCase()}`}
                      >
                        {bet.result?.outcome?.toUpperCase() || bet.status.toUpperCase()}
                      </div>
                      <span className={`expand-arrow ${expandedMap[bet.id] ? 'expanded' : ''}`}>▼</span>
                    </div>
                        
                    {expandedMap[bet.id] && (
                      <div className="bet-details one-column">
                        <div className="bet-summary">
                          <div className="summary-item">
                            <span className="label">Stake</span>
                            <span className="value">${formatAmount(bet.stake)}</span>
                          </div>
                          <div className="summary-item">
                            <span className="label">Combined Odds</span>
                            <span className="value">{getCombinedOdds(bet).toFixed(2)}</span>
                          </div>
                          <div className="summary-item">
                            <span className="label">Possible Payout</span>
                            <span className="value">${formatAmount(bet.potentialWin)}</span>
                          </div>
                        </div>

                        <div className="bet-selections">
                          <div className="selection-item">
                            <strong>{bet.match?.homeTeam} vs {bet.match?.awayTeam}</strong>
                          </div>
                          <div className="selection-item">Market: {bet.market}</div>
                          <div className="selection-item">Selection: {bet.selection}</div>
                        </div>

                        <div className="bet-result">
                          <div className="result-info">
                            <span><strong>Status:</strong> {bet.result?.outcome}</span>
                            <span><strong>Placed:</strong> {formatDate(bet.createdAt)}</span>
                            {bet.settledAt && (
                              <span><strong>Settled:</strong> {formatDate(bet.settledAt)}</span>
                            )}
                          </div>
                        </div>
                        <div className="betslip-match-details">
                          <table className="betslip-match-table">
                            <thead>
                              <tr>
                                <th>Match</th>
                                <th>Type</th>
                                <th>Pick</th>
                                <th>FT Results</th>
                                <th>Outcome</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(bet.matches && bet.matches.length ? bet.matches : [{
                                homeTeam: bet.match?.homeTeam,
                                awayTeam: bet.match?.awayTeam,
                                selection: bet.selection,
                                odds: bet.odds?.selected || bet.odds,
                                status: bet.status,
                                result: bet.result
                              }]).map((match, index) => (
                                <tr key={index}>
                                  <td className="match-name">{match.homeTeam} vs {match.awayTeam}</td>
                                  <td>{getMatchType(match, bet)}</td>
                                  <td className="selection">{match.selection} ({formatOdds(match.odds)})</td>
                                  <td className="odds">{getFtResult(match)}</td>
                                  <td className={`result ${normalizeStatus(match.status) === 'lost' ? 'lost' : ''}`}>
                                    {normalizeStatus(match.status) === 'won' ? 'Won' : normalizeStatus(match.status) === 'lost' ? 'Lost' : normalizeStatus(match.status) === 'void' ? 'Void' : 'Pending'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="history-section">
            <h2>Transaction History</h2>
            <div className="transaction-list">
              <div className="no-transactions">
                <p>No transactions yet</p>
                <p>Your deposit and withdrawal history will appear here</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Account;