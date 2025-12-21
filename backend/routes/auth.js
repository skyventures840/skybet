const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { auth } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const config = require('../config/config');
const crypto = require('crypto');

// Register new user
router.post('/register', [
  body('username').isLength({ min: 3 }).trim().escape(),
  body('email').isEmail().normalizeEmail(),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).*$/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  body('firstName').optional().trim().escape(),
  body('lastName').optional().trim().escape(),
  body('promoCode').optional().isString(),
  body('referralCode').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, firstName, lastName, phoneNumber, address, isAdmin, promoCode, referralCode } = req.body;
    
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

    // Generate a unique referral code for the new user
    const generatedRef = User.generateReferralCode(username || email);
    await User.findByIdAndUpdate(user._id, { $set: { referralCode: generatedRef } });

    // Optional referral bonus on registration
    if (referralCode) {
      const PromoCode = require('../models/PromoCode');
      const PromoUsage = require('../models/PromoUsage');
      const referrer = await User.findOne({ referralCode: String(referralCode).trim() });
      if (referrer && String(referrer._id) !== String(user._id)) {
        const codeStr = String(promoCode || 'REF50').toUpperCase().trim();
        const promo = await PromoCode.findOne({ code: codeStr, type: 'REFERRAL', isActive: true });
        const alreadyUsed = await PromoUsage.findOne({ userId: user._id, type: 'REFERRAL' });
        if (promo && !alreadyUsed) {
          const referrerBonus = Number(promo.referrerBonus || 0);
          const refereeBonus = Number(promo.refereeBonus || 0);
          if (refereeBonus > 0) {
            const wrReferee = refereeBonus * (promo.wageringMultiplier || 5);
            await User.creditBonus(user._id, refereeBonus, wrReferee);
          }
          if (referrerBonus > 0) {
            const wrReferrer = referrerBonus * (promo.wageringMultiplier || 5);
            await User.creditBonus(referrer._id, referrerBonus, wrReferrer);
          }
          await new PromoUsage({
            userId: user._id,
            promoCodeId: promo._id,
            code: promo.code,
            type: promo.type,
            context: 'registration',
            amountAwarded: refereeBonus,
            referrerId: referrer._id,
            refereeId: user._id
          }).save();
          await User.findByIdAndUpdate(user._id, { $set: { referredBy: referrer._id } });
        }
      }
    }

    const token = jwt.sign({ id: user._id }, config.jwtSecret, { expiresIn: '30d' });

    res.status(201).json({ 
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        balance: user.balance,
        demoBalance: user.demoBalance,
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
        balanceBonus: user.balanceBonus,
        demoBalance: user.demoBalance,
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
      demoBalance: user.demoBalance,
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

router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'Email not found' });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    user.resetOtp = otpHash;
    user.resetOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    let sent = false;
    try {
      if (process.env.SMTP_HOST) {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: false,
          auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          } : undefined
        });
        await transporter.sendMail({
          from: process.env.SMTP_FROM || 'no-reply@platypus.local',
          to: email,
          subject: 'Your password reset OTP',
          text: `Your OTP is ${otp}. It expires in 10 minutes.`,
        });
        sent = true;
      }
    } catch (mailErr) {
      // fall through, we'll still respond with preview in dev
    }

    return res.status(200).json({ message: 'verification code has been sent' });
  } catch (error) {
    return res.status(500).json({ message: 'Server error.', details: error.message });
  }
});

router.post('/reset-password', [
  body('email').isEmail().normalizeEmail(),
  body('token').optional(),
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>\/?]).*$/)
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, token, password, otp } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token/otp.' });
    }

    if (otp) {
      const otpHash = crypto.createHash('sha256').update(String(otp)).digest('hex');
      if (!user.resetOtp || !user.resetOtpExpires) {
        return res.status(400).json({ message: 'Invalid or expired OTP.' });
      }
      if (user.resetOtp !== otpHash) {
        return res.status(400).json({ message: 'Invalid or expired OTP.' });
      }
      if (user.resetOtpExpires < new Date()) {
        return res.status(400).json({ message: 'Invalid or expired OTP.' });
      }
    } else if (token) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      if (!user.resetPasswordToken || !user.resetPasswordExpires) {
        return res.status(400).json({ message: 'Invalid or expired token.' });
      }
      if (user.resetPasswordToken !== tokenHash) {
        return res.status(400).json({ message: 'Invalid or expired token.' });
      }
      if (user.resetPasswordExpires < new Date()) {
        return res.status(400).json({ message: 'Invalid or expired token.' });
      }
    } else {
      return res.status(400).json({ message: 'OTP or token required.' });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.resetOtp = undefined;
    user.resetOtpExpires = undefined;
    await user.save();

    return res.status(200).json({ message: 'Password has been reset.' });
  } catch (error) {
    return res.status(500).json({ message: 'Server error.', details: error.message });
  }
});

module.exports = router;
