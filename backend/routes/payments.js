const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const nowpayments = require('../services/nowpayments');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

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

// Check API Status
router.get('/status', async (req, res) => {
  try {
    const status = await nowpayments.checkApiStatus();
    res.json(status);
  } catch (error) {
    nowpayments.logger.error('API status check failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get Available Currencies
router.get('/currencies', async (req, res) => {
  try {
    const currencies = await nowpayments.getAvailableCurrencies();
    res.json(currencies);
  } catch (error) {
    nowpayments.logger.error('Failed to get currencies:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Create Payment
router.post('/create', auth, [
  body('amount').isFloat({ min: 10 }),
  body('currency').isString().notEmpty(),
  body('description').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, currency, description } = req.body;
    const userId = req.user.id;

    // Generate unique order ID
    const orderId = `order_${Date.now()}_${userId}_${Math.random().toString(36).substr(2, 9)}`;

    const paymentData = {
      price_amount: parseFloat(amount),
      price_currency: 'USD', // Fiat currency for pricing
      pay_currency: currency.toUpperCase(), // Crypto currency for payment
      order_id: orderId,
      order_description: description || 'Betting Payment',
      ipn_callback_url: nowpayments.config.callbackUrl,
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account?tab=deposit&status=success`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account?tab=deposit&status=cancelled`,
    };

    // Log the payment attempt
    nowpayments.logger.info('Attempting to create payment:', {
      orderId,
      amount: paymentData.price_amount,
      currency: paymentData.pay_currency,
      userId
    });

    let payment;
    let paymentRecord;

    try {
      // Try to create payment with NOWPayments
      payment = await nowpayments.createPayment(paymentData);
      
      // Save payment to database
      paymentRecord = await Payment.createPayment({
        userId,
        orderId,
        paymentId: payment.payment_id,
        status: payment.payment_status,
        amount: paymentData.price_amount,
        currency: paymentData.price_currency,
        payAmount: payment.pay_amount,
        payCurrency: payment.pay_currency,
        payAddress: payment.pay_address,
        payinExtraId: payment.payin_extra_id,
        paymentExtraId: payment.payment_extra_id,
        purchaseId: payment.purchase_id,
        orderDescription: paymentData.order_description,
        ipnCallbackUrl: paymentData.ipn_callback_url,
        successUrl: paymentData.success_url,
        cancelUrl: paymentData.cancel_url
      });

    } catch (nowpaymentsError) {
      nowpayments.logger.error('NOWPayments API error:', nowpaymentsError.message);
      
      // Check if this is a rate limiting error (429) or network error
      if (nowpaymentsError.message.includes('429') || 
          nowpaymentsError.message.includes('Too Many Requests') ||
          nowpaymentsError.message.includes('ENOTFOUND') || 
          nowpaymentsError.message.includes('ECONNREFUSED') ||
          nowpaymentsError.message.includes('timeout') ||
          process.env.USE_MOCK_PAYMENTS === 'true') {
        
        // Create a mock payment for testing/fallback
        nowpayments.logger.info('Creating mock payment due to API unavailability or rate limiting');
        
        const mockPayment = {
          payment_id: `mock_${Date.now()}_${userId}_${Math.random().toString(36).substr(2, 9)}`,
          payment_status: 'waiting',
          pay_amount: calculateMockPayAmount(paymentData.price_amount, paymentData.pay_currency),
          pay_currency: paymentData.pay_currency,
          pay_address: generateMockAddress(paymentData.pay_currency),
          price_amount: paymentData.price_amount,
          price_currency: paymentData.price_currency,
          order_description: paymentData.order_description,
          order_id: orderId
        };
        
        payment = mockPayment;
        
        // Save mock payment to database
        paymentRecord = await Payment.createPayment({
          userId,
          orderId,
          paymentId: payment.payment_id,
          status: payment.payment_status,
          amount: paymentData.price_amount,
          currency: paymentData.price_currency,
          payAmount: payment.pay_amount,
          payCurrency: payment.pay_currency,
          payAddress: payment.pay_address,
          orderDescription: paymentData.order_description,
          ipnCallbackUrl: paymentData.ipn_callback_url,
          successUrl: paymentData.success_url,
          cancelUrl: paymentData.cancel_url
        });
        
      } else {
        throw new Error(`Payment service unavailable: ${nowpaymentsError.message}. Please try again later or contact support.`);
      }
    }

    // Create transaction record
    const transaction = new Transaction({
      userId,
      type: 'deposit',
      amount: paymentData.price_amount,
      method: 'crypto',
      currency: payment.pay_currency || paymentData.pay_currency,
      status: 'pending',
      description: `Crypto deposit via ${payment.pay_currency || paymentData.pay_currency}`,
      metadata: {
        paymentId: payment.payment_id,
        orderId: orderId,
        payAddress: payment.pay_address
      }
    });

    await transaction.save();

    nowpayments.logger.info('Payment created successfully:', {
      orderId,
      paymentId: payment.payment_id,
      userId,
      status: payment.payment_status
    });

    res.json({
      success: true,
      payment: {
        paymentId: payment.payment_id,
        orderId: orderId,
        status: payment.payment_status,
        amount: payment.pay_amount,
        currency: payment.pay_currency,
        address: payment.pay_address,
        paymentStatus: payment.payment_status,
        payAddress: payment.pay_address,
        payAmount: payment.pay_amount,
        payCurrency: payment.pay_currency,
        priceAmount: payment.price_amount,
        priceCurrency: payment.price_currency,
        orderDescription: payment.order_description,
        isMockPayment: payment.payment_id && payment.payment_id.startsWith('mock_')
      }
    });
  } catch (error) {
    nowpayments.logger.error('Create payment error:', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      body: req.body
    });
    res.status(500).json({ 
      error: 'Failed to create payment', 
      details: error.message,
      suggestion: 'Please try again or contact support if the issue persists'
    });
  }
});

// Get Payment Status
router.get('/status/:paymentId', auth, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const status = await nowpayments.getPaymentStatus(paymentId);
    res.json(status);
  } catch (error) {
    nowpayments.logger.error('Failed to get payment status:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get User Payments
router.get('/user', auth, async (req, res) => {
  try {
    const { status } = req.query;
    const payments = await Payment.getByUser(req.user.id, status);
    res.json(payments);
  } catch (error) {
    nowpayments.logger.error('Failed to get user payments:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Handle IPN Callbacks
router.post('/callback', async (req, res) => {
  const receivedSignature = req.headers['x-nowpayments-sig'];
  const body = req.body;

  // Verify IPN signature
  if (!nowpayments.verifyIpnSignature(body, receivedSignature)) {
    nowpayments.logger.error('Invalid IPN signature:', { 
      received: receivedSignature, 
      body: body 
    });
    return res.status(401).json({ error: 'Invalid signature' });
  }

  try {
    const { 
      payment_id, 
      payment_status, 
      order_id,
      pay_amount,
      pay_currency,
      pay_address,
      outcome_amount,
      outcome_currency,
      outcome_network,
      outcome_txid,
      outcome_address,
      outcome_extra_id,
      outcome_amount_converted,
      outcome_currency_converted,
      partially_paid_amount,
      partially_paid_amount_converted
    } = body;

    nowpayments.logger.info('IPN received:', { 
      payment_id, 
      payment_status, 
      order_id 
    });

    // Update payment status in database
    const updateData = {
      status: payment_status,
      payAmount: pay_amount,
      payCurrency: pay_currency,
      payAddress: pay_address,
      outcomeAmount: outcome_amount,
      outcomeCurrency: outcome_currency,
      outcomeNetwork: outcome_network,
      outcomeTxid: outcome_txid,
      outcomeAddress: outcome_address,
      outcomeExtraId: outcome_extra_id,
      outcomeAmountConverted: outcome_amount_converted,
      outcomeCurrencyConverted: outcome_currency_converted,
      partiallyPaidAmount: partially_paid_amount,
      partiallyPaidAmountConverted: partially_paid_amount_converted
    };

    const payment = await Payment.updatePaymentStatus(order_id, payment_status, updateData);

    if (payment) {
      // Update transaction status
      const transaction = await Transaction.findOne({ 
        userId: payment.userId, 
        type: 'deposit',
        'metadata.paymentId': payment_id 
      });

      if (transaction) {
        if (payment_status === 'finished' || payment_status === 'confirmed') {
          // Update user balance
          await User.updateBalance(payment.userId, payment.amount);
          
          // Mark transaction as completed
          await Transaction.completeTransaction(transaction._id, outcome_txid);
          
          nowpayments.logger.info('Payment completed and balance updated:', {
            userId: payment.userId,
            amount: payment.amount,
            orderId: order_id
          });
        } else if (payment_status === 'failed' || payment_status === 'expired') {
          // Mark transaction as failed
          await Transaction.failTransaction(transaction._id, `Payment ${payment_status}`);
          
          nowpayments.logger.info('Payment failed:', {
            userId: payment.userId,
            orderId: order_id,
            status: payment_status
          });
        }
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    nowpayments.logger.error('IPN processing failed:', error.message);
    res.status(500).json({ error: 'IPN processing failed' });
  }
});

module.exports = router; 