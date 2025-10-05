import React, { useState } from 'react';

import apiService from '../services/api';
import QRCode from 'qrcode.react';
import './Deposit.css';

const NowPaymentsDeposit = () => {

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  const [amount, setAmount] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('BTC');
  const [description, setDescription] = useState('');
  const [payment, setPayment] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('');
  
  const popularCurrencies = [
    { code: 'BTC', name: 'Bitcoin', icon: '₿' },
    { code: 'ETH', name: 'Ethereum', icon: 'Ξ' },
    { code: 'USDT', name: 'Tether', icon: '₮' },
    { code: 'LTC', name: 'Litecoin', icon: 'Ł' },
    { code: 'BCH', name: 'Bitcoin Cash', icon: '₿' },
    { code: 'XRP', name: 'Ripple', icon: '✕' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!amount || parseFloat(amount) < 10) {
      setError('Minimum deposit amount is $10');
      return;
    }

    setLoading(true);
    setError(null);

    // Retry logic with exponential backoff
    const maxRetries = 3;
    let retryCount = 0;
    
    const attemptPayment = async () => {
      try {
        // Use the direct payment creation endpoint
        const response = await apiService.createPayment({
          amount: parseFloat(amount),
          currency: selectedCurrency,
          description: description || `Crypto deposit via ${selectedCurrency}`
        });
        
        return response;
      } catch (error) {
        // Check if it's a 429 error and we should retry
        if (error.response?.status === 429 && retryCount < maxRetries) {
          retryCount++;
          const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 2s, 4s, 8s
          console.log(`Rate limited, retrying in ${delay}ms (attempt ${retryCount}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return attemptPayment();
        }
        throw error;
      }
    };

    try {
      const response = await attemptPayment();

      console.log('Payment response:', response);
      
      if (response.data && response.data.success && response.data.payment) {
        setPayment(response.data.payment);
        setPaymentStatus(response.data.payment.paymentStatus);
        setSuccess(true);
        
        // Show special message for mock payments or manual processing
        if (response.data.payment.isMockPayment) {
          setError('Demo mode: This is a simulated payment for testing purposes. In production, you would send the exact amount to the provided address.');
        } else if (response.data.payment.isManualProcessing) {
          setError('Payment service temporarily unavailable. Your request has been recorded and will be processed manually. Please contact support for assistance.');
        }
      } else {
        const errorMessage = response.data?.details || response.data?.error || 'Failed to create payment';
        setError(`${errorMessage}${response.data?.suggestion ? ` ${response.data.suggestion}` : ''}`);
      }
    } catch (error) {
      console.error('Payment creation error:', error);
      
      // Check if it's a rate limiting error
      if (error.response?.status === 429) {
        setError('Payment service is temporarily busy. Please wait a moment and try again. The system will automatically retry for you.');
      } else if (error.code === 'ECONNREFUSED' || error.message.includes('Network Error') || !error.response) {
        setError('Unable to connect to payment service. Please check that the server is running and try again.');
      } else {
        const errorMessage = error.response?.data?.details || error.response?.data?.error || error.message || 'Failed to create payment';
        setError(`${errorMessage}${error.response?.data?.suggestion ? ` ${error.response.data.suggestion}` : ''}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'waiting': return '#ffc107';
      case 'confirming': return '#17a2b8';
      case 'confirmed': return '#28a745';
      case 'finished': return '#28a745';
      case 'failed': case 'expired': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'waiting': return 'Waiting for payment';
      case 'confirming': return 'Payment confirming';
      case 'confirmed': return 'Payment confirmed';
      case 'finished': return 'Payment completed';
      case 'failed': return 'Payment failed';
      case 'expired': return 'Payment expired';
      default: return 'Unknown status';
    }
  };

  const copyToClipboard = (text, buttonElement) => {
    navigator.clipboard.writeText(text).then(() => {
      // Add visual feedback
      if (buttonElement) {
        buttonElement.classList.add('copied');
        buttonElement.textContent = '✓ Copied!';
        setTimeout(() => {
          buttonElement.classList.remove('copied');
          buttonElement.textContent = 'Copy';
        }, 2000);
      }
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  };

  if (success && payment) {
    return (
      <div className="deposit-section">
        <div className="payment-success">
          <h2>Payment Request Created</h2>
          
          <div className="payment-details">
            <div className="status-indicator">
              <div className="status-dot" style={{ backgroundColor: getStatusColor(paymentStatus) }}></div>
              <span>{getStatusText(paymentStatus)}</span>
            </div>

            <div className="payment-info">
              <h3>Payment Details</h3>
              <div className="info-grid">
                <div className="info-item">
                  <label>Amount:</label>
                  <span>${payment.priceAmount} USD</span>
                </div>
                <div className="info-item">
                  <label>Crypto Amount:</label>
                  <span>{payment.payAmount} {payment.payCurrency}</span>
                </div>
              </div>
            </div>

            <div className="wallet-section">
              <h3>Send Payment to:</h3>
              <div className="wallet-address-container">
                <input
                  type="text"
                  value={payment.payAddress}
                  readOnly
                  className="wallet-address-input"
                />
                <button onClick={(e) => copyToClipboard(payment.payAddress, e.target)} className="copy-btn">
                  Copy
                </button>
              </div>
              
              {payment.payinExtraId && (
                <div className="extra-id-container">
                  <label>Memo/Tag (Required):</label>
                  <div className="wallet-address-container">
                    <input
                      type="text"
                      value={payment.payinExtraId}
                      readOnly
                      className="wallet-address-input"
                    />
                    <button onClick={(e) => copyToClipboard(payment.payinExtraId, e.target)} className="copy-btn">
                      Copy
                    </button>
                  </div>
                </div>
              )}

              <div className="qr-code-container">
                <QRCode
                  value={`${payment.payCurrency}:${payment.payAddress}${payment.payinExtraId ? `?memo=${payment.payinExtraId}` : ''}`}
                  size={220}
                  level="H"
                  includeMargin={true}
                  renderAs="svg"
                />
                <div className="qr-code-info">
                  <p>Scan QR Code to Pay</p>
                  <p>Send exactly {payment.payAmount} {payment.payCurrency}</p>
                  <div className="qr-code-scan-instruction">
                    Point your crypto wallet camera at this QR code
                  </div>
                </div>
              </div>
            </div>

            <div className="payment-actions">
              <button 
                onClick={() => {
                  setPayment(null);
                  setSuccess(false);
                  setAmount('');
                  setDescription('');
                }}
                className="new-payment-btn"
              >
                Create New Payment
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="deposit-section">
      <h2>Cryptocurrency Deposit</h2>
      
      <form onSubmit={handleSubmit} className="crypto-deposit-form">
        <div className="form-group">
          <label>Select Cryptocurrency</label>
          <select 
            value={selectedCurrency} 
            onChange={(e) => setSelectedCurrency(e.target.value)}
            className="crypto-select"
          >
            {popularCurrencies.map(crypto => (
              <option key={crypto.code} value={crypto.code}>
                {crypto.icon} {crypto.name} ({crypto.code})
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Deposit Amount (USD)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount in USD"
            min="10"
            step="0.01"
            required
            disabled={loading}
          />
          <small>Minimum deposit: $50 USD</small>
        </div>

       

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <button 
          type="submit" 
          className="deposit-btn"
          disabled={loading || !amount || parseFloat(amount) < 10}
        >
          {loading ? 'Creating Payment...' : 'Create Payment'}
        </button>
      </form>

      <div className="deposit-info">
        <h3>How it works:</h3>
        <ul>
          <li>Enter the amount you want to deposit in USD</li>
          <li>Select your preferred cryptocurrency</li>
          <li>payment address will be generated</li>
          <li>Send the exact crypto amount to the provided address</li>
          <li>Your account will be credited once the payment is confirmed</li>
        </ul>
      </div>
    </div>
  );
};

export default NowPaymentsDeposit; 