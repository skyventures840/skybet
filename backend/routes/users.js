const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { auth, adminAuth } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
// Constants for transaction methods and currencies
const TRANSACTION_METHODS = {
  CRYPTO: 'crypto',
  BANK: 'bank',
  CARD: 'card',
  PAYPAL: 'paypal'
};

const CURRENCIES = ['USD', 'EUR', 'BTC', 'ETH', 'USDT', 'USDC'];

// Get user balance
router.get('/balance', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('balance');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
      }

    res.json({ balance: user.balance });
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Deposit funds - Updated for NOWPayments integration
router.post('/deposit', auth, [
  body('amount').isFloat({ min: 10 }),
  body('method').isIn(Object.values(TRANSACTION_METHODS)),
  body('currency').optional().isIn(Object.values(CURRENCIES))
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, method, currency, walletAddress } = req.body;
    const userId = req.user.id;

    // For crypto deposits, use NOWPayments
    if (method === 'crypto') {
      // Redirect to NOWPayments API
      const paymentResponse = await fetch(`${req.protocol}://${req.get('host')}/api/payments/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': req.headers.authorization
        },
        body: JSON.stringify({
          amount,
          currency: currency || 'BTC',
          description: `Crypto deposit via ${currency || 'BTC'}`
        })
      });

      const paymentData = await paymentResponse.json();
      
      if (paymentResponse.ok) {
        res.status(201).json({
          success: true,
          payment: paymentData.payment,
          message: 'Payment created successfully'
        });
      } else {
        res.status(paymentResponse.status).json(paymentData);
      }
    } else {
      // For non-crypto deposits, use the old system
      const transaction = new Transaction({
        userId,
        type: 'deposit',
        amount,
        method,
        currency,
        walletAddress,
        status: 'pending'
      });

      await transaction.save();

      res.status(201).json({
        transactionId: transaction._id,
        status: transaction.status,
        message: 'Deposit pending approval'
      });
    }
  } catch (error) {
    console.error('Deposit error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Withdraw funds
router.post('/withdraw', auth, [
  body('amount').isFloat({ min: 20 }),
  body('method').isIn([TRANSACTION_METHODS.CRYPTO, TRANSACTION_METHODS.BANK]),
  body('walletAddress').notEmpty().trim(),
  body('currency').optional().isIn(Object.values(CURRENCIES))
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, method, walletAddress, currency } = req.body;
    const userId = req.user.id;

    // Check user balance
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Create transaction record
    const transaction = new Transaction({
      userId,
      type: 'withdrawal',
      amount,
      method,
      currency,
      walletAddress,
      status: 'pending'
    });

    await transaction.save();

    // Deduct from user balance immediately
    await User.updateBalance(userId, -amount);

    res.status(201).json({
      transactionId: transaction._id,
      status: transaction.status,
      message: 'Withdrawal request submitted for processing'
    });
  } catch (error) {
    console.error('Withdraw error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get transaction history
router.get('/transactions', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const type = req.query.type; // deposit, withdrawal

    const query = { userId: req.user.id };
    if (type) {
      query.type = type;
    }

    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Transaction.countDocuments(query);

    res.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get transaction by ID
router.get('/transactions/:transactionId', auth, async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.transactionId,
      userId: req.user.id
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json(transaction);
  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user preferences
router.put('/preferences', auth, [
  body('notifications').optional().isObject(),
  body('language').optional().isIn(['en', 'es', 'fr', 'de']),
  body('timezone').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { notifications, language, timezone } = req.body;
    
    const updateData = {};
    if (notifications) updateData.notifications = notifications;
    if (language) updateData.language = language;
    if (timezone) updateData.timezone = timezone;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Preferences updated successfully', user });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user profile details
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password'); // Exclude password
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user profile details
router.put('/profile', auth, [
  body('firstName').optional().trim().notEmpty(),
  body('lastName').optional().trim().notEmpty(),
  body('address').optional().trim().notEmpty(),
  body('city').optional().trim().notEmpty(),
  body('country').optional().trim().notEmpty(),
  body('phone').optional().trim().notEmpty().isMobilePhone('any'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const updates = req.body;
    const user = await User.findByIdAndUpdate(req.user.id, { $set: updates }, { new: true, runValidators: true }).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Profile updated successfully', user });
  } catch (error) {
    console.error('Update user profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// KYC Document Upload (Placeholder)
router.post('/kyc/upload', auth, async (req, res) => {
  try {
    // In a real application, you would integrate with a file upload service (e.g., Multer, Cloudinary)
    // and store document references in the user's KYC profile.
    // For now, this is a placeholder to acknowledge the route.
    res.status(200).json({ message: 'KYC document upload initiated (placeholder)' });
  } catch (error) {
    console.error('KYC upload error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Get all users (for admin dashboard)
router.get('/', auth, adminAuth, async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
    res.json(users);
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Get user by ID (for admin to view specific user profile)
router.get('/:userId', auth, adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Update user details
router.put('/:userId', auth, adminAuth, async (req, res) => {
  try {
    const updates = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User updated successfully', user });
  } catch (error) {
    console.error('Admin update user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Block/Unblock User
router.put('/block/:userId', auth, adminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { isBlocked } = req.body;

    if (typeof isBlocked !== 'boolean') {
      return res.status(400).json({ error: 'isBlocked must be a boolean value' });
    }

    const user = await User.findByIdAndUpdate(userId, { isBlocked }, { new: true });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: `User ${user.username} ${isBlocked ? 'blocked' : 'unblocked'} successfully`, user });
  } catch (error) {
    console.error('Block/unblock user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;