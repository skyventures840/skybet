const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { auth } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const config = require('../config/config');

// Register new user
router.post('/register', [
  body('username').isLength({ min: 3 }).trim().escape(),
  body('email').isEmail().normalizeEmail(),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).*$/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  body('firstName').optional().trim().escape(),
  body('lastName').optional().trim().escape()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, firstName, lastName, phoneNumber, address, isAdmin } = req.body;
    
    // Check if user exists
    const existingUser = await User.findByUsernameOrEmail(username) || await User.findByUsernameOrEmail(email);
    if (existingUser) {
      return res.status(409).json({ message: 'Username or email already exists.' });
    }

    // Create user
    const user = new User({
      username,
      email,
      password,
      firstName,
      lastName,
      phoneNumber,
      address,
      isAdmin
    });

    await user.save();

    const token = jwt.sign({ id: user._id }, config.jwtSecret, { expiresIn: '30d' });

    res.status(201).json({ 
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        balance: user.balance,
        isAdmin: user.isAdmin,
        firstName: user.firstName,
        lastName: user.lastName
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error.', details: error.message });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Invalid email format.').bail(),
  body('password').notEmpty().withMessage('Password is required.')
], async (req, res) => {
  console.log('[DEBUG] Login attempt received:', {
    email: req.body.email,
    hasPassword: !!req.body.password
  });

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('[DEBUG] Validation errors:', errors.array());
    const messages = errors.array().map(e => e.msg || e.message || `${e.param}: invalid`);
    return res.status(400).json({ message: messages.join(', '), errors: errors.array() });
  }

  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log('[DEBUG] User not found:', email);
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    // Defensive checks to avoid server errors if the stored password is invalid
    if (!user.password || typeof user.password !== 'string') {
      console.log('[DEBUG] Invalid stored password for user:', { userId: user._id, type: typeof user.password });
      return res.status(400).json({ message: 'Account password not set. Please reset your password.' });
    }

    if (!user.password.startsWith('$2')) {
      console.log('[DEBUG] Non-bcrypt password format detected for user:', { userId: user._id });
      return res.status(400).json({ message: 'Password format invalid. Please reset your password.' });
    }

    console.log('[DEBUG] User found, verifying password');
    console.log('[DEBUG] Input password details:', {
      length: password.length,
      value: password,
      type: typeof password
    });
    console.log('[DEBUG] Stored password details:', {
      length: user.password.length,
      prefix: user.password.substring(0, 20),
      type: typeof user.password
    });
    
    let isMatch = false;
    try {
      isMatch = await bcrypt.compare(password, user.password);
      console.log('[DEBUG] bcrypt.compare result:', isMatch);
    } catch (compareErr) {
      console.error('[DEBUG] bcrypt.compare failed:', compareErr);
      return res.status(400).json({ message: 'Invalid credentials.' });
    }
    if (!isMatch) {
      console.log('[DEBUG] Password mismatch for user:', email);
      return res.status(400).json({ message: 'Invalid credentials.' });
    }
    
    console.log('[DEBUG] Login successful for user:', email);
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user._id },
      config.jwtSecret,
      { expiresIn: '30d' }
    );
    
    res.status(200).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        isAdmin: user.isAdmin,
        balance: user.balance,
        firstName: user.firstName,
        lastName: user.lastName
      }
    });
  } catch (err) {
    console.error('[DEBUG] Login error:', err);
    res.status(500).json({ message: 'Server error.', details: err.message });
  }
});

// Get user profile
  router.get('/profile', auth, async (req, res) => {  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.status(200).json({
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      address: user.address,
      balance: user.balance,
      lifetimeWinnings: user.lifetimeWinnings,
      createdAt: user.createdAt
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ message: 'Server error.', details: error.message });
  }
});

// Update user profile
router.put('/profile', auth, [
  body('firstName').optional().trim().escape(),
  body('lastName').optional().trim().escape(),
  body('phoneNumber').optional().trim(),
  body('address').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { firstName, lastName, phoneNumber, address } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { firstName, lastName, phoneNumber, address },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Server error.', details: error.message });
  }
});

module.exports = router;