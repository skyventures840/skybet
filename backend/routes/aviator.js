const express = require('express')
const router = express.Router()
const AviatorRule = require('../models/AviatorRule')
const { adminAuth } = require('../middleware/auth')
const User = require('../models/User')
const Bet = require('../models/Bet')
const { auth } = require('../middleware/auth')

// Get user balance for Aviator
router.get('/balance', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    // Return user balances exactly as stored in DB
    res.json({
      balance: user.balance,
      balanceBonus: user.balanceBonus
    })
  } catch (error) {
    console.error('Aviator balance error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Place bet
router.post('/bet', auth, async (req, res) => {
  try {
    const { amount, type } = req.body // type: 'real' or 'demo'
    const userId = req.user.id

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' })
    }

    if (type === 'demo') {
      return res.status(400).json({ error: 'Demo mode is disabled' })
    } else {
      // Real/Bonus bet
      try {
        const { bonusUsed, realUsed, user } = await User.placeBet(userId, amount)

        // Create Bet record for history/admin
        const bet = new Bet({
          userId,
          matchId: `aviator-${Date.now()}`, // Pseudo match ID
          market: 'Aviator',
          selection: 'Fly',
          stake: amount,
          odds: 1.00, // Initial odds
          potentialWin: 0, // Unknown yet
          bonusStakeUsed: bonusUsed,
          realStakeUsed: realUsed,
          status: 'pending',
          homeTeam: 'Aviator',
          awayTeam: 'Game'
        })
        await bet.save()

        return res.json({
          success: true,
          balance: user.balance,
          balanceBonus: user.balanceBonus,
          bonusUsed,
          realUsed,
          type: 'real',
          betId: bet._id
        })
      } catch (err) {
        return res.status(400).json({ error: err.message })
      }
    }
  } catch (error) {
    console.error('Aviator bet error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Cash out
router.post('/cashout', auth, async (req, res) => {
  try {
    const { amount, type, multiplier, betId } = req.body
    const userId = req.user.id

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' })
    }

    if (type === 'demo') {
      return res.status(400).json({ error: 'Demo mode is disabled' })
    } else {
      // Real money win
      await User.settleBetWin(userId, amount)
      const updatedUser = await User.findById(userId)

      // Update Bet record if betId is provided
      if (betId) {
        await Bet.findByIdAndUpdate(betId, {
          status: 'won',
          actualWin: amount,
          odds: multiplier,
          settledAt: Date.now()
        })
      }

      return res.json({
        success: true,
        balance: updatedUser.balance,
        balanceBonus: updatedUser.balanceBonus,
        type: 'real'
      })
    }
  } catch (error) {
    console.error('Aviator cashout error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Cancel bet (refund)
router.post('/cancel', auth, async (req, res) => {
  try {
    const { amount, type, betId } = req.body
    const userId = req.user.id

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' })
    }

    if (type === 'demo') {
      return res.status(400).json({ error: 'Demo mode is disabled' })
    } else {
      // Refund to Real balance (simplest approach)
      // NOTE: This does not account for bonus/real split refunding as state is not passed.
      // Potential improvement: pass split info if available.
      await User.refundBet(userId, amount)
      const updatedUser = await User.findById(userId)

      // Update Bet record
      if (betId) {
        await Bet.findByIdAndUpdate(betId, {
          status: 'cancelled',
          settledAt: Date.now()
        })
      }

      return res.json({
        success: true,
        balance: updatedUser.balance,
        balanceBonus: updatedUser.balanceBonus,
        type: 'real'
      })
    }
  } catch (error) {
    console.error('Aviator cancel error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

function toMinutes (hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return null
  const parts = hhmm.split(':')
  if (parts.length < 2) return null
  const h = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return (h * 60) + m
}

function baseCrashRng () {
  const r = Math.random()
  if (r < 0.01) return 1.00
  const crash = 0.99 / (1 - r)
  return Math.max(1.00, Math.round(crash * 100) / 100)
}

async function computeOverrideCrash () {
  const now = new Date()
  const minutesNow = now.getHours() * 60 + now.getMinutes()
  const rules = await AviatorRule.find({ active: true }).sort({ priority: -1, updatedAt: -1 }).lean()
  const base = baseCrashRng()
  // Apply schedule as floor-only to preserve randomness
  for (const r of rules) {
    if (r.type !== 'schedule') continue
    const s = toMinutes(r.startTime)
    const e = toMinutes(r.endTime)
    if (s == null || e == null || r.rangeMin == null) continue
    const inWindow = s <= e ? (minutesNow >= s && minutesNow <= e) : (minutesNow >= s || minutesNow <= e)
    if (inWindow) {
      const min = Math.max(1, Number(r.rangeMin))
      const floored = Math.max(min, base)
      return Math.max(1.00, Math.round(floored * 100) / 100)
    }
  }
  let floorRule = null
  for (const r of rules) {
    if (r.type !== 'global_floor') continue
    if (r.floorMultiplier != null && r.floorMultiplier >= 1) { floorRule = r; break }
  }
  if (floorRule) {
    const floor = Math.max(1, Number(floorRule.floorMultiplier))
    return Math.max(1.00, Math.max(floor, base))
  }
  return Math.max(1.00, base)
}

router.get('/next-crash', auth, async (req, res) => {
  try {
    const v = await computeOverrideCrash()
    res.json({ crashPoint: v })
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/rules', auth, adminAuth, async (req, res) => {
  try {
    const rules = await AviatorRule.find({}).sort({ priority: -1, createdAt: -1 }).lean()
    res.json({ rules })
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/rules', auth, adminAuth, async (req, res) => {
  try {
    const payload = req.body || {}
    const rule = new AviatorRule({
      name: payload.name || 'Rule',
      type: payload.type,
      active: payload.active ?? true,
      floorMultiplier: payload.floorMultiplier ?? null,
      startTime: payload.startTime ?? null,
      endTime: payload.endTime ?? null,
      rangeMin: payload.rangeMin ?? null,
      rangeMax: payload.rangeMax ?? null,
      priority: payload.priority ?? 0,
      createdBy: req.user.id
    })
    await rule.save()
    res.json({ success: true, rule })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

router.put('/rules/:id', auth, adminAuth, async (req, res) => {
  try {
    const updates = req.body || {}
    const rule = await AviatorRule.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    )
    if (!rule) return res.status(404).json({ error: 'Not found' })
    res.json({ success: true, rule })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

router.delete('/rules/:id', auth, adminAuth, async (req, res) => {
  try {
    const rule = await AviatorRule.findByIdAndDelete(req.params.id)
    if (!rule) return res.status(404).json({ error: 'Not found' })
    res.json({ success: true })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

module.exports = router
