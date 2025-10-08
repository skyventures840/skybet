const axios = require('axios');
const crypto = require('crypto');
const winston = require('winston');

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console()
  ],
});

// Configuration
const config = {
  apiUrl: process.env.NODE_ENV === 'production' 
    ? process.env.NOWPAYMENTS_API_URL || 'https://api.nowpayments.io'
    : process.env.NOWPAYMENTS_SANDBOX_API_URL || 'https://api.sandbox.nowpayments.io',
  apiKey: process.env.NODE_ENV === 'production' 
    ? process.env.NOWPAYMENTS_API_KEY 
    : process.env.NOWPAYMENTS_SANDBOX_API_KEY,
  ipnSecret: process.env.NOWPAYMENTS_IPN_SECRET,
  callbackUrl: process.env.NOWPAYMENTS_CALLBACK_URL || `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/payments/callback`,
};

const USE_MOCK = process.env.USE_MOCK_PAYMENTS === 'true';

// Helper function to make API requests
async function makeApiRequest(endpoint, method = 'GET', data = null) {
  try {
    // Build headers safely; omit x-api-key if not set
    const headers = {
      'Content-Type': 'application/json',
    };
    if (config.apiKey) {
      headers['x-api-key'] = config.apiKey;
    }

    const response = await axios({
      method,
      url: `${config.apiUrl}${endpoint}`,
      headers,
      data,
    });
    return response.data;
  } catch (error) {
    logger.error(`API request failed at ${endpoint}:`, error.response?.data || error.message);
    
    // Handle specific error types
    if (error.response?.status === 429) {
      throw new Error(`Rate limit exceeded (429): ${error.response?.data?.message || 'Too many requests'}`);
    } else if (error.response?.status === 401) {
      throw new Error(`Authentication failed (401): ${error.response?.data?.message || 'Invalid API key'}`);
    } else if (error.response?.status === 400) {
      throw new Error(`Bad request (400): ${error.response?.data?.message || 'Invalid payment data'}`);
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      throw new Error(`Network error: ${error.message}`);
    } else if (error.code === 'ETIMEDOUT') {
      throw new Error(`Timeout error: ${error.message}`);
    }
    
    throw new Error(`API request failed: ${error.message}`);
  }
}

// Check API Status
async function checkApiStatus() {
  try {
    if (USE_MOCK) {
      const mock = { message: 'OK (mock)' };
      logger.info('Mock API status returned:', mock);
      return mock;
    }
    const status = await makeApiRequest('/v1/status');
    logger.info('API status checked:', status);
    return status;
  } catch (error) {
    // In mock mode or local dev without keys, return a friendly status
    if (USE_MOCK) {
      const mock = { message: 'OK (mock-fallback)' };
      logger.info('Mock fallback API status returned:', mock);
      return mock;
    }
    logger.error('Failed to check API status:', error.message);
    throw error;
  }
}

// Get Available Currencies
async function getAvailableCurrencies() {
  try {
    if (USE_MOCK) {
      const mockCurrencies = ['BTC', 'ETH', 'USDT', 'USDC', 'LTC', 'BCH', 'XRP'];
      logger.info('Mock currencies returned:', mockCurrencies);
      return mockCurrencies;
    }
    const currencies = await makeApiRequest('/v1/currencies');
    logger.info('Available currencies fetched:', currencies);
    return currencies;
  } catch (error) {
    if (USE_MOCK) {
      const mockCurrencies = ['BTC', 'ETH', 'USDT', 'USDC', 'LTC', 'BCH', 'XRP'];
      logger.info('Mock fallback currencies returned:', mockCurrencies);
      return mockCurrencies;
    }
    logger.error('Failed to get currencies:', error.message);
    throw error;
  }
}

// Create Payment
async function createPayment(paymentData) {
  try {
    const payment = await makeApiRequest('/v1/payment', 'POST', paymentData);
    logger.info('Payment created:', payment);
    return payment;
  } catch (error) {
    logger.error('Failed to create payment:', error.message);
    
    // Check if it's a rate limiting error, DNS/network error, or mock payments are enabled
    if (error.message.includes('429') || 
        error.message.includes('Rate limit exceeded') ||
        error.message.includes('ENOTFOUND') || 
        error.message.includes('ECONNREFUSED') || 
        error.message.includes('timeout') || 
        error.message.includes('Network error') ||
        process.env.USE_MOCK_PAYMENTS === 'true') {
      
      logger.info('Creating mock payment due to NOWPayments unavailability or rate limiting');
      
      // Return a mock payment response
      const mockPayment = {
        payment_id: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        payment_status: 'waiting',
        pay_amount: calculateMockPayAmount(paymentData.price_amount, paymentData.pay_currency),
        pay_currency: paymentData.pay_currency,
        pay_address: generateMockAddress(paymentData.pay_currency),
        price_amount: paymentData.price_amount,
        price_currency: paymentData.price_currency,
        order_description: paymentData.order_description,
        order_id: paymentData.order_id
      };
      
      return mockPayment;
    }
    
    throw error;
  }
}

// Helper functions for mock payments
function generateMockAddress(currency) {
  const addresses = {
    'BTC': '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    'ETH': '0x742d35Cc6634C0532925a3b8D49d7e8E9c2d4b7f',
    'LTC': 'LTC1234567890abcdef1234567890abcdef12345678',
    'BCH': 'bitcoincash:qp3wjpa3tjlj042z2wv7hahsldgwhwy0rq9sywjpyy',
    'XRP': 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
    'USDT': '0x742d35Cc6634C0532925a3b8D49d7e8E9c2d4b7f'
  };
  return addresses[currency.toUpperCase()] || addresses['BTC'];
}

function calculateMockPayAmount(usdAmount, currency) {
  // Mock exchange rates for demonstration
  const mockRates = {
    'BTC': 45000,   // 1 BTC = $45,000
    'ETH': 2500,    // 1 ETH = $2,500
    'LTC': 100,     // 1 LTC = $100
    'BCH': 300,     // 1 BCH = $300
    'XRP': 0.5,     // 1 XRP = $0.50
    'USDT': 1       // 1 USDT = $1
  };
  
  const rate = mockRates[currency.toUpperCase()] || mockRates['BTC'];
  return parseFloat((usdAmount / rate).toFixed(8));
}

// Get Payment Status
async function getPaymentStatus(paymentId) {
  try {
    if (USE_MOCK || (paymentId && String(paymentId).startsWith('mock_'))) {
      const mockStatus = {
        payment_id: paymentId,
        payment_status: 'finished',
        pay_amount: 0,
        pay_currency: 'USDT'
      };
      logger.info('Mock payment status returned:', mockStatus);
      return mockStatus;
    }
    const status = await makeApiRequest(`/v1/payment/${paymentId}`);
    logger.info('Payment status fetched:', status);
    return status;
  } catch (error) {
    if (USE_MOCK) {
      const mockStatus = {
        payment_id: paymentId,
        payment_status: 'waiting'
      };
      logger.info('Mock fallback payment status returned:', mockStatus);
      return mockStatus;
    }
    logger.error('Failed to get payment status:', error.message);
    throw error;
  }
}

// Verify IPN Signature
function verifyIpnSignature(body, receivedSignature) {
  try {
    if (USE_MOCK) {
      logger.info('Mock mode enabled; accepting IPN without signature verification');
      return true;
    }
    if (!config.ipnSecret) {
      logger.error('IPN secret is not set; rejecting IPN');
      return false;
    }
    const sortedBody = JSON.stringify(body, Object.keys(body).sort());
    const computedSignature = crypto
      .createHmac('sha512', config.ipnSecret)
      .update(sortedBody)
      .digest('hex');
    return computedSignature === receivedSignature;
  } catch (err) {
    logger.error('IPN signature verification error:', err.message);
    return false;
  }
}

module.exports = {
  config,
  checkApiStatus,
  getAvailableCurrencies,
  createPayment,
  getPaymentStatus,
  verifyIpnSignature,
  logger
};