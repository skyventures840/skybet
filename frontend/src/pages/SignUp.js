
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { loginSuccess } from '../store/slices/authSlice';

import apiService from '../services/api';

const SignUp = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const navigate = useNavigate();
  const dispatch = useDispatch();


  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
    }
    setLoading(true);
    setError('');

    try {
        const response = await apiService.signup({
            username: email.split('@')[0],
            email,
            password,
            promoCode: promoCode || undefined,
            referralCode: promoCode || undefined
        });
        
        const { token, user } = response.data;
        // Persist user and token for consistency across services
        localStorage.setItem('user', JSON.stringify({ token, user }));
        localStorage.setItem('token', token);
        try { localStorage.setItem('login_time', String(Date.now())); } catch (e) { void e; }

        // Dispatch login to Redux store (auto-login)
        dispatch(loginSuccess({ token, user }));

        // Show success text before navigating automatically
        setSuccess('Account creation successful. You will be automatically logged in.');

        // Navigate after short delay to home (or account)
        setTimeout(() => {
          navigate('/');
        }, 1500);
    } catch (error) {
        console.error('Signup error:', error);
        if (error.response) {
            const data = error.response.data || {};
            if (Array.isArray(data.errors) && data.errors.length) {
                const messages = data.errors
                  .map(e => e.msg || e.message || `${e.param}: invalid`)
                  .filter(Boolean);
                setError(messages.join('\n'));
            } else {
                setError(data.message || 'Server error occurred');
            }
        } else if (error.request) {
            setError('No response from server. Please check your connection.');
        } else {
            setError('An error occurred. Please try again.');
        }
    } finally {
        setLoading(false);
    }
};

  return (
    <div className="auth-container">
      <div className="auth-form">
        <div className="auth-header">
          <h1 className="auth-title">Join skybet</h1>
          <p className="auth-subtitle">Create your account to start betting</p>
        </div>

        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}
{/* End of error message display */}

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
              placeholder="Create a password"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="promoCode">Promo Code (optional)</label>
            <input
              type="text"
              id="promoCode"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder="WELCOME100 or REF50"
            />
          </div>

          

          <button 
            type="submit" 
            className="btn-primary full-width"
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Join Now'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Already have an account?{' '}
            <Link to="/login" className="auth-link">
              Log in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
