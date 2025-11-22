import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import apiService from '../services/api';
import enhancedCache from '../services/enhancedCache';
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
  const [transactions, setTransactions] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [historyFilter, setHistoryFilter] = useState('all'); // all | deposit | withdrawal




  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [selectedCrypto, setSelectedCrypto] = useState('BTC');
  const [walletAddress, setWalletAddress] = useState('');

  const fetchProfile = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      const response = await apiService.getUserProfile();
      let userData;
      if (response.data) {
        userData = response.data.user || response.data;
      } else {
        userData = response;
      }
      if (userData) {
        const next = {
          username: userData.username || '',
          email: userData.email || '',
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          phoneNumber: userData.phoneNumber || '',
          address: userData.address || '',
          balance: userData.balance || 0,
          lifetimeWinnings: userData.lifetimeWinnings || 0,
          createdAt: userData.createdAt || ''
        };
        setProfileData(next);
        dispatch(setUser(userData));
        try {
          sessionStorage.setItem('account_profile_data', JSON.stringify(next));
        } catch (e) { void e; }
      } else {
        throw new Error('No user data received from server');
      }
    } catch (err) {
      setError(`Failed to load profile data: ${err.response?.data?.error || err.message}`);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    const localUser = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null;
    if (!user && localUser && localUser.token && localUser.user) {
      dispatch(setUser(localUser.user));
    }

    let hasInstantData = false;
    try {
      const sessionProfile = sessionStorage.getItem('account_profile_data');
      if (sessionProfile) {
        const parsed = JSON.parse(sessionProfile);
        setProfileData(parsed);
        setLoading(false);
        hasInstantData = true;
      }
    } catch (e) { void e; }

    if (!hasInstantData) {
      const entry = enhancedCache.getEntry('/auth/profile');
      if (entry && entry.data) {
        const cached = entry.data.user || entry.data;
        setProfileData({
          username: cached.username || '',
          email: cached.email || '',
          firstName: cached.firstName || '',
          lastName: cached.lastName || '',
          phoneNumber: cached.phoneNumber || '',
          address: cached.address || '',
          balance: cached.balance || 0,
          lifetimeWinnings: cached.lifetimeWinnings || 0,
          createdAt: cached.createdAt || ''
        });
        setLoading(false);
        hasInstantData = true;
      }
    }

    const token = localUser?.token;
    if (token) {
      fetchProfile(!hasInstantData);
    }

    const intervalId = setInterval(() => {
      fetchProfile(false);
    }, 180000);
    return () => clearInterval(intervalId);
  }, []);


  // Reusable transaction fetcher
  const fetchTransactions = async (showLoading = true) => {
    try {
      if (showLoading) setHistoryLoading(true);
      setHistoryError(null);
      const response = await apiService.getTransactions();
      const txns = response?.data?.transactions || response?.data || [];
      setTransactions(Array.isArray(txns) ? txns : []);
      try {
        sessionStorage.setItem('account_transactions_data', JSON.stringify(Array.isArray(txns) ? txns : []));
      } catch (e) { void e; }
    } catch (err) {
      setHistoryError(err.response?.data?.error || err.message || 'Failed to load transactions');
      setTransactions([]);
    } finally {
      if (showLoading) setHistoryLoading(false);
    }
  };

  // Fetch transaction history when History tab becomes active
  useEffect(() => {
    if (activeTab === 'history') {
      let hasInstantHistory = false;
      try {
        const sessionTx = sessionStorage.getItem('account_transactions_data');
        if (sessionTx) {
          const parsed = JSON.parse(sessionTx);
          if (Array.isArray(parsed)) {
            setTransactions(parsed);
            setHistoryLoading(false);
            hasInstantHistory = true;
          }
        }
      } catch (e) { void e; }

      if (!hasInstantHistory) {
        const entry = enhancedCache.getEntry('/users/transactions');
        if (entry && entry.data) {
          const txns = entry.data.transactions || entry.data || [];
          setTransactions(Array.isArray(txns) ? txns : []);
          setHistoryLoading(false);
          hasInstantHistory = true;
        }
      }

      fetchTransactions(!hasInstantHistory);
    }
  }, [activeTab]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        try {
          if (profileData) {
            sessionStorage.setItem('account_profile_data', JSON.stringify(profileData));
          }
          if (transactions && transactions.length > 0) {
            sessionStorage.setItem('account_transactions_data', JSON.stringify(transactions));
          }
        } catch (e) { void e; }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [profileData, transactions]);

  const filteredTransactions = transactions.filter(txn => {
    if (historyFilter === 'deposit') return txn.type === 'deposit';
    if (historyFilter === 'withdrawal') return txn.type === 'withdrawal';
    return txn.type === 'deposit' || txn.type === 'withdrawal';
  });

  const formatAmount = (amount) => {
    if (typeof amount !== 'number') {
      const num = parseFloat(amount);
      return isNaN(num) ? amount : num.toFixed(2);
    }
    return amount.toFixed(2);
  };

  const isCredit = (txn) => txn.type === 'deposit';
  const isDebit = (txn) => txn.type === 'withdrawal';


  // Supported currencies must match backend validation list
  const cryptoOptions = [
    { value: 'BTC', label: 'Bitcoin (BTC)', icon: '₿' },
    { value: 'ETH', label: 'Ethereum (ETH)', icon: 'Ξ' },
    { value: 'USDT', label: 'Tether (USDT)', icon: '₮' },
    { value: 'USDC', label: 'USD Coin (USDC)', icon: '$' }
  ];



  const [withdrawStatusMessage, setWithdrawStatusMessage] = useState('');

  const handleWithdraw = async (e) => {
    e.preventDefault();
    const amount = parseFloat(withdrawAmount);
    
    if (amount && walletAddress && amount <= (user.balance || 0)) {
      try {
        await apiService.withdraw({
          amount,
          method: 'crypto',
          currency: selectedCrypto, // Must be one of: USD, EUR, BTC, ETH, USDT, USDC
          walletAddress
        });
        const updatedUser = { ...user, balance: (user.balance || 0) - amount };
        dispatch(setUser(updatedUser));
        localStorage.setItem('user', JSON.stringify({ ...JSON.parse(localStorage.getItem('user')), user: updatedUser }));
        // Show clear status message, per accounting concept
        setWithdrawStatusMessage('Withdrawal initiated');
        // Optionally still alert if needed using backend message
        // e.g., toast or alert with a standard copy
        setWithdrawAmount('');
        setWalletAddress('');
        // Refresh transactions so the new withdrawal shows up immediately
        fetchTransactions();
      } catch (error) {
        const backendMsg = error.response?.data?.message;
        const validationErrors = error.response?.data?.errors;
        const combined = validationErrors
          ? validationErrors.map(e => e.msg || e.message).join('; ')
          : backendMsg;
        setError(combined || 'Withdrawal failed');
      }
    } else {
      alert('Insufficient balance or invalid amount');
    }
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
              {withdrawStatusMessage && (
                <div className="withdraw-status" role="status" aria-live="polite">
                  {withdrawStatusMessage}
                </div>
              )}
            </div>
          </div>
        )}



        {activeTab === 'history' && (
          <div className="history-section">
            <h2>Transaction History</h2>
            <div className="transaction-filters">
              <button
                className={`filter-btn ${historyFilter === 'all' ? 'active' : ''}`}
                onClick={() => setHistoryFilter('all')}
              >
                All
              </button>
              <button
                className={`filter-btn ${historyFilter === 'deposit' ? 'active' : ''}`}
                onClick={() => setHistoryFilter('deposit')}
              >
                Deposits
              </button>
              <button
                className={`filter-btn ${historyFilter === 'withdrawal' ? 'active' : ''}`}
                onClick={() => setHistoryFilter('withdrawal')}
              >
                Withdrawals
              </button>
            </div>

            {historyLoading ? (
              <p>Loading transactions...</p>
            ) : historyError ? (
              <p className="error-message">{historyError}</p>
            ) : filteredTransactions.length === 0 ? (
              <div className="transaction-list">
                <div className="no-transactions">
                  <p>No transactions yet</p>
                  <p>Your deposit and withdrawal history will appear here</p>
                </div>
              </div>
            ) : (
              <div className="transaction-list">
                <div className="transaction-list-header">
                  <div>Date</div>
                  <div>Type</div>
                  <div>Method</div>
                  <div>Status</div>
                  <div className="amount-col">Amount</div>
                  <div className="drcr-col">Dr/Cr</div>
                </div>
                {filteredTransactions.map(txn => (
                  <div key={txn._id || `${txn.type}-${txn.createdAt}-${txn.amount}`} className="transaction-item">
                    <div className="txn-date">{txn.createdAt ? new Date(txn.createdAt).toLocaleString() : '-'}</div>
                    <div className="txn-type">{txn.type?.charAt(0).toUpperCase() + txn.type?.slice(1)}</div>
                    <div className="txn-method">{(txn.method || txn.metadata?.method || 'Crypto').toString().toUpperCase()}</div>
                    <div className={`txn-status status-${(txn.status || 'pending').toLowerCase()}`}>{(txn.status || 'pending').toString().toUpperCase()}</div>
                    <div className={`txn-amount ${isCredit(txn) ? 'credit' : isDebit(txn) ? 'debit' : ''}`}>
                      {txn.currency ? txn.currency.toUpperCase() : 'USD'} {formatAmount(txn.amount)}
                    </div>
                    <div className="txn-drcr">{isCredit(txn) ? 'Credit' : isDebit(txn) ? 'Debit' : '-'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Account;
