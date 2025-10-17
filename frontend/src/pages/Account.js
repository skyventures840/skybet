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