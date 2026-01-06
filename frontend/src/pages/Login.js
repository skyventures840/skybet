// Add this import at the top
import { loginStart, loginSuccess, loginFailure } from '../store/slices/authSlice'; // adjust path if needed
import { setUser } from '../store/slices/userSlice';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import apiService from '../services/api';



const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const dispatch = useDispatch();


  // Update the handleSubmit function
  const handleSubmit = async (e) => {
      e.preventDefault();
      setLoading(true);
      dispatch(loginStart());
      
      console.log('[DEBUG] Login attempt with email:', email);
      
      try {
          const response = await apiService.login({ email, password });
          console.log('[DEBUG] Login response:', response.data);
          
          const { token, user } = response.data;
          dispatch(loginSuccess({ token, user }));
          dispatch(setUser(user));
          
          try {
            localStorage.setItem('user', JSON.stringify({ token, user }));
            localStorage.setItem('login_time', String(Date.now()));
          } catch (e) {
            console.warn('Failed to save to localStorage:', e);
            // If quota exceeded, try to clear and save only essential data
            if (e.name === 'QuotaExceededError' || e.message.includes('exceeded the quota')) {
              try {
                // Clear old data that might be clogging up space
                localStorage.clear(); 
                // Try saving again
                localStorage.setItem('user', JSON.stringify({ token, user }));
                localStorage.setItem('login_time', String(Date.now()));
              } catch (retryErr) {
                 // If still failing, save minimal user data
                 console.warn('Retrying with minimal user data');
                 const minimalUser = {
                   id: user.id || user._id,
                   email: user.email,
                   username: user.username,
                   isAdmin: user.isAdmin,
                   balance: user.balance
                 };
                 localStorage.setItem('user', JSON.stringify({ token, user: minimalUser }));
                 localStorage.setItem('login_time', String(Date.now()));
              }
            }
          }

          if (response.data.user && response.data.user.isAdmin) {
            navigate('/admin');
          } else {
            navigate('/');
          }
      } catch (error) {
          console.error('[DEBUG] Login error details:', {
              message: error.message,
              response: error.response?.data,
              status: error.response?.status,
              headers: error.response?.headers
          });
          
          if (error.response) {
              const errorMessage = error.response.data.message || 'Server error occurred';
              dispatch(loginFailure(errorMessage));
              setError(errorMessage);
          } else if (error.request) {
              const errorMessage = 'No response from server. Please check your connection.';
              dispatch(loginFailure(errorMessage));
              setError(errorMessage);
          } else {
              const errorMessage = 'An error occurred. Please try again.';
              dispatch(loginFailure(errorMessage));
              setError(errorMessage);
          }
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="auth-container">
      <div className="auth-form">
        <div className="auth-header">
          <h1 className="auth-title">Log In</h1>
          <p className="auth-subtitle">Welcome back to skybet</p>
        </div>

        {error && <div className="error">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          <button 
            type="submit" 
            className="btn-primary full-width"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Don't have an account?{' '}
            <Link to="/signup" className="auth-link">Sign up here</Link>
          </p>
          <p>
            <Link to="/reset-password" className="auth-link">Forgot your password?</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
