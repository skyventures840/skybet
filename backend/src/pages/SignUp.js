
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import apiService from '../services/api';

const SignUp = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();


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
            password
        });
        
        const { token, user } = response.data;
        localStorage.setItem('user', JSON.stringify({ token, user }));
        navigate('/login');
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