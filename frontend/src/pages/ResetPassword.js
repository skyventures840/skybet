import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSendOtp = async () => {
    setError('');
    setSuccess('');
    if (!email) {
      setError('Enter your email to receive a code');
      return;
    }
    setSending(true);
    try {
      await apiService.requestPasswordReset(email);
      setSuccess('verification code has been sent');
      setOtpSent(true);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send code';
      setError(msg);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!email || !otp) {
      setError('Enter your email and the verification code');
      return;
    }
    if (!password || password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await apiService.resetPasswordWithOtp({ otp, email, password });
      setSuccess('Password reset successful');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      const msg = err.response?.data?.message || 'Reset failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-form">
        <div className="auth-header">
          <h1 className="auth-title">Reset Password</h1>
          <p className="auth-subtitle">Enter the code sent to your email</p>
        </div>

        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}

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
              disabled={otpSent}
            />
          </div>

          <div className="form-group">
            <label htmlFor="otp">Verification Code</label>
            <input
              type="text"
              id="otp"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Enter 6-digit code"
              required
            />
          </div>

          <div className="form-group" style={{ marginTop: '8px' }}>
            <button
              type="button"
              className="btn-secondary full-width"
              onClick={handleSendOtp}
              disabled={sending}
              style={{ color: '#fff' }}
            >
              {sending ? 'Sending...' : 'Send code'}
            </button>
          </div>

          <div className="form-group">
            <label htmlFor="password">New Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirm">Confirm Password</label>
            <input
              type="password"
              id="confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              required
            />
          </div>

          <button type="submit" className="btn-primary full-width" disabled={loading}>
            {loading ? 'Submitting...' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
