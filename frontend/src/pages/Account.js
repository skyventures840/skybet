import React, { useState, useEffect } from 'react';
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



  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return '#ffa500';
      case 'won':
        return '#4caf50';
      case 'lost':
        return '#f44336';
      case 'void':
        return '#9e9e9e';
      default:
        return '#666';
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
          <div className="bets-section">
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
                      <span>Total Bets: {betHistory.length}</span>
                      <span>Pending: {betHistory.filter(bet => bet.status === 'pending').length}</span>
                      <span>Won: {betHistory.filter(bet => bet.status === 'won').length}</span>
                      <span>Lost: {betHistory.filter(bet => bet.status === 'lost').length}</span>
                </div>
              </div>
              <div className="bet-list">
                    {betHistory.map((bet) => (
                  <div key={bet.id} className="bet-item">
                    <div className="bet-header">
                          <div className="bet-match">
                            <div className="match-teams">
                              {bet.match?.homeTeam} vs {bet.match?.awayTeam}
                            </div>
                            <div className="match-competition">
                              {bet.match?.competition}
                            </div>
                          </div>
                      <div 
                        className="bet-status"
                        style={{ color: getStatusColor(bet.status) }}
                      >
                            {bet.result?.outcome?.toUpperCase() || bet.status.toUpperCase()}
                      </div>
                    </div>
                        
                    <div className="bet-details">
                      <div className="bet-info">
                            <div className="bet-market">
                        <span><strong>Market:</strong> {bet.market}</span>
                        <span><strong>Selection:</strong> {bet.selection}</span>
                            </div>
                            
                            <div className="bet-odds">
                        <span><strong>Stake:</strong> ${bet.stake.toFixed(2)}</span>
                              <span><strong>Odds:</strong> {bet.odds?.selected?.toFixed(2)}</span>
                      </div>
                            
                            <div className="bet-potential">
                        <span><strong>Potential Win:</strong> ${bet.potentialWin.toFixed(2)}</span>
                              {bet.actualWin !== undefined && bet.actualWin > 0 && (
                          <span><strong>Actual Win:</strong> ${bet.actualWin.toFixed(2)}</span>
                        )}
                      </div>
                            
                            {bet.result?.profit !== undefined && (
                              <div className="bet-profit">
                                <span><strong>Profit/Loss:</strong> 
                                  <span style={{ color: bet.result.profit >= 0 ? '#4caf50' : '#f44336' }}>
                                    ${bet.result.profit.toFixed(2)}
                                  </span>
                                </span>
                              </div>
                            )}
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
                    </div>
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