const express = require('express')
const router = express.Router()
const User = require('../models/User')
const Transaction = require('../models/Transaction')
const PromoCode = require('../models/PromoCode')
const PromoUsage = require('../models/PromoUsage')
const { auth, adminAuth } = require('../middleware/auth')
const { get: cacheGet, set: cacheSet } = require('../utils/cache')
const crypto = require('crypto')

function computeEtag (obj) {
  try {
    const json = JSON.stringify(obj)
    return 'W/"' + crypto.createHash('sha1').update(json).digest('hex') + '"'
  } catch (e) {
    return null
  }
}
const { body, validationResult } = require('express-validator')
// Constants for transaction methods and currencies
const TRANSACTION_METHODS = {
  CRYPTO: 'crypto',
  BANK: 'bank',
  CARD: 'card',
  PAYPAL: 'paypal'
}

const CURRENCIES = ['USD', 'EUR', 'BTC', 'ETH', 'USDT', 'USDC']

// Get user balance
router.get('/balance', auth, async (req, res) => {
  try {
    const keyParams = { userId: String(req.user.id) }
    const cached = cacheGet('/api/users/balance', keyParams)
    if (cached) {
      const etag = computeEtag(cached)
      res.set('X-Cache', 'HIT')
      res.set('Cache-Control', 'private, max-age=10, stale-while-revalidate=60')
      if (etag) res.set('ETag', etag)
      if (etag && req.headers['if-none-match'] === etag) {
        return res.status(304).end()
      }
      return res.json(cached)
    }

    const user = await User.findById(req.user.id).select('balance balanceBonus wageringRequired wageringProgress')
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const payload = {
      balance: user.balance,
      balanceBonus: user.balanceBonus,
      wageringRequired: user.wageringRequired,
      wageringProgress: user.wageringProgress
    }
    const etag = computeEtag(payload)
    try { cacheSet('/api/users/balance', keyParams, payload, 30) } catch (e) {}
    if (etag) res.set('ETag', etag)
    res.set('X-Cache', 'MISS')
    res.set('Cache-Control', 'private, max-age=10, stale-while-revalidate=60')
    res.json(payload)
  } catch (error) {
    console.error('Get balance error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Deposit funds - Updated for NOWPayments integration
router.post('/deposit', auth, [
  body('amount').isFloat({ min: 10 }),
  body('method').isIn(Object.values(TRANSACTION_METHODS)),
  body('currency').optional().isIn(Object.values(CURRENCIES))
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { amount, method, currency, walletAddress, promoCode, referralCode } = req.body
    const userId = req.user.id

    // For crypto deposits, use NOWPayments
    if (method === 'crypto') {
      // Redirect to NOWPayments API
      const paymentResponse = await fetch(`${req.protocol}://${req.get('host')}/api/payments/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: req.headers.authorization
        },
        body: JSON.stringify({
          amount,
          currency: currency || 'BTC',
          description: `Crypto deposit via ${currency || 'BTC'}`,
          promoCode: promoCode || null,
          referralCode: referralCode || null
        })
      })

      const paymentData = await paymentResponse.json()

      if (paymentResponse.ok) {
        res.status(201).json({
          success: true,
          payment: paymentData.payment,
          message: 'Payment created successfully'
        })
      } else {
        res.status(paymentResponse.status).json(paymentData)
      }
    } else {
      // Non-crypto deposits: immediately credit real wallet and apply promos
      const user = await User.findById(userId)
      if (!user) {
        return res.status(404).json({ error: 'User not found' })
      }

      if (user.isBanned || user.isBlocked === true) {
        return res.status(403).json({ error: 'Account is blocked or banned' })
      }

      const transaction = new Transaction({
        userId,
        type: 'deposit',
        amount,
        method,
        currency,
        walletAddress,
        status: 'completed',
        description: 'Instant deposit'
      })
      await transaction.save()

      await User.deposit(userId, amount)

      const now = new Date()
      const isFirstDeposit = !user.hasDeposited
      if (isFirstDeposit) {
        await User.findByIdAndUpdate(userId, { $set: { hasDeposited: true, firstDepositAt: now } })
      }

      const awardedBonuses = []

      if (isFirstDeposit) {
        const autoWelcomeBonusPercent = 100
        const bonusAmount = Math.floor(amount * autoWelcomeBonusPercent) / 100
        if (bonusAmount > 0) {
          const wageringMultiplier = 5
          const wageringIncrement = bonusAmount * wageringMultiplier
          await User.creditBonus(userId, bonusAmount, wageringIncrement)
          awardedBonuses.push({ code: 'WELCOME100_AUTO', amount: bonusAmount, wagering: wageringIncrement })
        }
      }

      if (promoCode) {
        const codeStr = String(promoCode).toUpperCase().trim()
        const promo = await PromoCode.findOne({ code: codeStr, isActive: true })
        if (!promo) {
          return res.status(400).json({ error: 'Invalid or inactive promo code' })
        }
        if (promo.startsAt && now < promo.startsAt) {
          return res.status(400).json({ error: 'Promo not yet active' })
        }
        if (promo.endsAt && now > promo.endsAt) {
          return res.status(400).json({ error: 'Promo has expired' })
        }
        const alreadyUsed = await PromoUsage.findOne({ userId, code: promo.code })
        if (promo.oneTimePerUser && alreadyUsed) {
          return res.status(400).json({ error: 'Promo code already used' })
        }

        if (promo.type === 'FIRST_DEPOSIT') {
          if (!isFirstDeposit) {
            return res.status(400).json({ error: 'Promo valid only on first deposit' })
          }
          if (promo.minDeposit && amount < promo.minDeposit) {
            return res.status(400).json({ error: `Minimum deposit for promo is ${promo.minDeposit}` })
          }
          let bonus = 0
          if (promo.percent && promo.percent > 0) {
            bonus = (amount * promo.percent) / 100
            if (promo.maxBonus && bonus > promo.maxBonus) {
              bonus = promo.maxBonus
            }
          } else if (promo.fixedAmount && promo.fixedAmount > 0) {
            bonus = promo.fixedAmount
          }
          if (bonus > 0) {
            const wageringInc = bonus * (promo.wageringMultiplier || 5)
            await User.creditBonus(userId, bonus, wageringInc)
            await new PromoUsage({
              userId,
              promoCodeId: promo._id,
              code: promo.code,
              type: promo.type,
              context: 'deposit',
              amountAwarded: bonus,
              metadata: { depositAmount: amount }
            }).save()
            awardedBonuses.push({ code: promo.code, amount: bonus, wagering: wageringInc })
          }
        } else if (promo.type === 'REFERRAL') {
          if (!referralCode) {
            return res.status(400).json({ error: 'Referral promo requires referral code' })
          }
          const referrer = await User.findOne({ referralCode: referralCode.trim() })
          if (!referrer) {
            return res.status(400).json({ error: 'Invalid referral code' })
          }
          if (String(referrer._id) === String(userId)) {
            return res.status(400).json({ error: 'Self-referral not allowed' })
          }
          const alreadyReferred = await PromoUsage.findOne({ userId, type: 'REFERRAL' })
          if (alreadyReferred) {
            return res.status(400).json({ error: 'Referral promo already used' })
          }
          const referrerBonus = Number(promo.referrerBonus || 0)
          const refereeBonus = Number(promo.refereeBonus || 0)
          if (refereeBonus > 0) {
            const wrReferee = refereeBonus * (promo.wageringMultiplier || 5)
            await User.creditBonus(userId, refereeBonus, wrReferee)
            awardedBonuses.push({ code: promo.code, amount: refereeBonus, wagering: wrReferee })
          }
          if (referrerBonus > 0) {
            const wrReferrer = referrerBonus * (promo.wageringMultiplier || 5)
            await User.creditBonus(referrer._id, referrerBonus, wrReferrer)
          }
          await new PromoUsage({
            userId,
            promoCodeId: promo._id,
            code: promo.code,
            type: promo.type,
            context: 'deposit',
            amountAwarded: refereeBonus,
            referrerId: referrer._id,
            refereeId: userId,
            metadata: { depositAmount: amount }
          }).save()
        }
      }

      res.status(201).json({
        success: true,
        transactionId: transaction._id,
        status: transaction.status,
        awardedBonuses,
        message: 'Deposit completed'
      })
    }
  } catch (error) {
    console.error('Deposit error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Withdraw funds
router.post('/withdraw', auth, [
  body('amount').isFloat({ min: 20 }),
  body('method').isIn([TRANSACTION_METHODS.CRYPTO, TRANSACTION_METHODS.BANK]),
  body('walletAddress').notEmpty().trim(),
  body('currency').optional().isIn(Object.values(CURRENCIES))
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { amount, method, walletAddress, currency } = req.body
    const userId = req.user.id

    // Check user balance and wagering requirements
    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    const wageringComplete = Number(user.wageringProgress || 0) >= Number(user.wageringRequired || 0)
    if (!wageringComplete && Number(user.wageringRequired || 0) > 0) {
      return res.status(400).json({ error: 'Withdrawals blocked until wagering requirements are met' })
    }

    // Check balance before creating transaction to fail fast
    if (Number(user.balance || 0) < amount) {
      return res.status(400).json({ error: 'Insufficient withdrawable balance' })
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
    })

    await transaction.save()

    // Deduct from real wallet immediately using atomic withdraw
    try {
      await User.withdraw(userId, amount)
    } catch (err) {
      // If atomic withdrawal fails (e.g. race condition), fail the transaction
      transaction.status = 'failed'
      transaction.description = 'Insufficient balance during processing'
      await transaction.save()
      return res.status(400).json({ error: 'Insufficient withdrawable balance' })
    }

    res.status(201).json({
      transactionId: transaction._id,
      status: transaction.status,
      message: 'Withdrawal request submitted for processing'
    })
  } catch (error) {
    console.error('Withdraw error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Get transaction history
router.get('/transactions', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const type = req.query.type
    const keyParams = { userId: String(req.user.id), page: String(page), limit: String(limit), type: type || '' }
    const cached = cacheGet('/api/users/transactions', keyParams)
    if (cached) {
      const etag = computeEtag(cached)
      res.set('X-Cache', 'HIT')
      res.set('Cache-Control', 'private, max-age=20, stale-while-revalidate=120')
      if (etag) res.set('ETag', etag)
      if (etag && req.headers['if-none-match'] === etag) {
        return res.status(304).end()
      }
      return res.json(cached)
    }

    const query = { userId: req.user.id }
    if (type) {
      query.type = type
    }

    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)

    const total = await Transaction.countDocuments(query)

    const payload = {
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
    const etag = computeEtag(payload)
    try { cacheSet('/api/users/transactions', keyParams, payload, 60) } catch (e) {}
    if (etag) res.set('ETag', etag)
    res.set('X-Cache', 'MISS')
    res.set('Cache-Control', 'private, max-age=10, stale-while-revalidate=120')
    res.json(payload)
  } catch (error) {
    console.error('Get transactions error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Get transaction by ID
router.get('/transactions/:transactionId', auth, async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.transactionId,
      userId: req.user.id
    })

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' })
    }

    res.json(transaction)
  } catch (error) {
    console.error('Get transaction error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Update user preferences
router.put('/preferences', auth, [
  body('notifications').optional().isObject(),
  body('language').optional().isIn(['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'sv', 'no', 'da', 'fi', 'pl', 'cs', 'sk', 'sl', 'hu', 'ro', 'bg', 'el', 'tr', 'uk', 'ru', 'sr', 'hr', 'ar', 'fa']),
  body('timezone').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { notifications, language, timezone } = req.body

    const updateData = {}
    if (notifications) updateData.notifications = notifications
    if (language) updateData.language = language
    if (timezone) updateData.timezone = timezone

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password')

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({ message: 'Preferences updated successfully', user })
  } catch (error) {
    console.error('Update preferences error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Get user profile details
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password') // Exclude password
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    res.json(user)
  } catch (error) {
    console.error('Get user profile error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Update user profile details
router.put('/profile', auth, [
  body('firstName').optional().trim().notEmpty(),
  body('lastName').optional().trim().notEmpty(),
  body('address').optional().trim().notEmpty(),
  body('city').optional().trim().notEmpty(),
  body('country').optional().trim().notEmpty(),
  body('phone').optional().trim().notEmpty().isMobilePhone('any')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const updates = req.body
    const user = await User.findByIdAndUpdate(req.user.id, { $set: updates }, { new: true, runValidators: true }).select('-password')

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({ message: 'Profile updated successfully', user })
  } catch (error) {
    console.error('Update user profile error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// KYC Document Upload (Placeholder)
router.post('/kyc/upload', auth, async (req, res) => {
  try {
    // In a real application, you would integrate with a file upload service (e.g., Multer, Cloudinary)
    // and store document references in the user's KYC profile.
    // For now, this is a placeholder to acknowledge the route.
    res.status(200).json({ message: 'KYC document upload initiated (placeholder)' })
  } catch (error) {
    console.error('KYC upload error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Admin: Get all users (for admin dashboard)
router.get('/', auth, adminAuth, async (req, res) => {
  try {
    const users = await User.find({}).select('-password')
    res.json(users)
  } catch (error) {
    console.error('Get all users error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Admin: Get user by ID (for admin to view specific user profile)
router.get('/:userId', auth, adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password')
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    res.json(user)
  } catch (error) {
    console.error('Get user by ID error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Admin: Update user details
router.put('/:userId', auth, adminAuth, async (req, res) => {
  try {
    const updates = req.body
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password')
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    res.json({ message: 'User updated successfully', user })
  } catch (error) {
    console.error('Admin update user error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Admin: Block/Unblock User
router.put('/block/:userId', auth, adminAuth, async (req, res) => {
  try {
    const { userId } = req.params
    const { isBlocked } = req.body

    if (typeof isBlocked !== 'boolean') {
      return res.status(400).json({ error: 'isBlocked must be a boolean value' })
    }

    const user = await User.findByIdAndUpdate(userId, { isBlocked }, { new: true })

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({ message: `User ${user.username} ${isBlocked ? 'blocked' : 'unblocked'} successfully`, user })
  } catch (error) {
    console.error('Block/unblock user error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router
