const express = require('express')
const router = express.Router()
const AviatorRule = require('../models/AviatorRule')
const { adminAuth } = require('../middleware/auth')
const User = require('../models/User')
const Bet = require('../models/Bet')
const { auth } = require('../middleware/auth')
const crypto = require('crypto')
let lastCrashSample = null
let lastCrashes = []
const MAX_CRASH = 2000
const XM = 1
const pfServerSeed = crypto.randomBytes(32)
const pfCommit = crypto.createHash('sha256').update(pfServerSeed).digest('hex')
let pfNonce = 0
let pfLastNonceUsed = null

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

function fairRandom () {
  const h = crypto.createHmac('sha256', pfServerSeed).update(String(pfNonce)).digest()
  pfLastNonceUsed = pfNonce
  pfNonce += 1
  const u32 = h.readUInt32BE(0)
  return u32 / 4294967296
}

function getRecentBuckets () {
  const arr = lastCrashes.slice(0, 4).map(x => {
    const v = typeof x?.value === 'number' ? x.value : parseFloat(x?.value)
    return Number.isFinite(v) ? v : null
  }).filter(v => v != null)
  const buckets1d = new Set(arr.map(v => Math.round(v * 10)))
  const buckets0 = new Set(arr.map(v => Math.round(v)))
  return { buckets1d, buckets0 }
}

function baseCrashRng () {
  const r = fairRandom()
  if (r < 0.01) return 1.00
  const crash = 0.99 / (1 - r)
  const clamped = Math.max(1.00, Math.min(crash, MAX_CRASH))
  return Math.round(clamped * 100) / 100
}

// Removed deprecated Pareto sampler

async function computeOverrideCrash () {
  const now = new Date()
  const minutesNow = now.getHours() * 60 + now.getMinutes()
  const rules = await AviatorRule.find({ active: true }).sort({ priority: -1, updatedAt: -1 }).lean()
  const base = baseCrashRng()
  const { buckets1d, buckets0 } = getRecentBuckets()
  const isRepeat = (a, b) => {
    if (a == null || b == null) return false
    const eq2 = Math.round(a * 100) === Math.round(b * 100)
    const eq1 = Math.round(a * 10) === Math.round(b * 10)
    const eq0 = Math.round(a) === Math.round(b)
    return eq2 || eq1 || eq0
  }
  for (const r of rules) {
    if (r.type !== 'schedule') continue
    const s = toMinutes(r.startTime)
    const e = toMinutes(r.endTime)
    const hasMin = r.rangeMin != null
    const hasMax = r.rangeMax != null
    if (s == null || e == null || (!hasMin && !hasMax)) continue
    const inWindow = s <= e ? (minutesNow >= s && minutesNow <= e) : (minutesNow >= s || minutesNow <= e)
    if (inWindow) {
      const min = hasMin ? Math.max(XM, Number(r.rangeMin)) : XM
      let max = hasMax ? Math.max(min, Number(r.rangeMax)) : MAX_CRASH
      if (hasMin && hasMax && (max - min) < 0.05) max = min + 0.05
      let val = base
      if (hasMin && hasMax) {
        val = Math.max(min, Math.min(val, max))
      } else if (hasMin) {
        val = Math.max(min, val)
      } else if (hasMax) {
        val = Math.min(max, val)
      }
      const guardRef = lastCrashSample
      for (let i = 0; i < 20; i++) {
        const b1 = Math.round(val * 10)
        const b0 = Math.round(val)
        if (isRepeat(val, guardRef) || buckets1d.has(b1) || buckets0.has(b0)) {
          val = baseCrashRng()
          if (hasMin && hasMax) val = Math.max(min, Math.min(val, max))
          else if (hasMin) val = Math.max(min, val)
          else if (hasMax) val = Math.min(max, val)
        } else {
          break
        }
      }
      {
        const b1f = Math.round(val * 10)
        const b0f = Math.round(val)
        if (isRepeat(val, guardRef) || buckets1d.has(b1f) || buckets0.has(b0f)) {
          const dir = fairRandom() < 0.5 ? -1 : 1
          const step = 0.07 + fairRandom() * 0.13
          val = Math.max(min, Math.min(max, Math.round((val + dir * step) * 100) / 100))
        }
      }
      lastCrashSample = val
      return Math.round(val * 100) / 100
    }
  }
  let floorRule = null
  for (const r of rules) {
    if (r.type !== 'global_floor') continue
    if (r.floorMultiplier != null && r.floorMultiplier >= 1) { floorRule = r; break }
  }
  if (floorRule) {
    const floor = Math.max(XM, Number(floorRule.floorMultiplier))
    let val = Math.max(floor, baseCrashRng())
    const guardRef = lastCrashSample
    for (let i = 0; i < 20; i++) {
      const b1 = Math.round(val * 10)
      const b0 = Math.round(val)
      if (isRepeat(val, guardRef) || buckets1d.has(b1) || buckets0.has(b0)) {
        val = Math.max(floor, baseCrashRng())
      } else {
        break
      }
    }
    {
      const b1f = Math.round(val * 10)
      const b0f = Math.round(val)
      if (isRepeat(val, guardRef) || buckets1d.has(b1f) || buckets0.has(b0f)) {
        const dir = fairRandom() < 0.5 ? -1 : 1
        const step = 0.07 + fairRandom() * 0.13
        val = Math.max(floor, Math.min(MAX_CRASH, Math.round((val + dir * step) * 100) / 100))
      }
    }
    lastCrashSample = val
    return Math.round(val * 100) / 100
  }
  // No rules: use baseline heavy tail, ensure variation
  let val = base
  const guardRef = lastCrashSample
  for (let i = 0; i < 20; i++) {
    const b1 = Math.round(val * 10)
    const b0 = Math.round(val)
    if (isRepeat(val, guardRef) || buckets1d.has(b1) || buckets0.has(b0)) {
      val = baseCrashRng()
    } else {
      break
    }
  }
  {
    const b1f = Math.round(val * 10)
    const b0f = Math.round(val)
    if (isRepeat(val, guardRef) || buckets1d.has(b1f) || buckets0.has(b0f)) {
      const dir = fairRandom() < 0.5 ? -1 : 1
      const step = 0.07 + fairRandom() * 0.13
      val = Math.max(1.00, Math.min(MAX_CRASH, Math.round((val + dir * step) * 100) / 100))
    }
  }
  lastCrashSample = val
  return Math.max(1.00, val)
}

router.get('/next-crash', auth, async (req, res) => {
  try {
    const v = await computeOverrideCrash()
    const m2 = Math.max(1.00, Math.round(v * 100) / 100)
    lastCrashes.unshift({ value: m2, ts: Date.now() })
    if (lastCrashes.length > 100) lastCrashes = lastCrashes.slice(0, 100)
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'Surrogate-Control': 'no-store'
    })
    res.set('X-Provably-Fair-Commit', pfCommit)
    res.set('X-Provably-Fair-Nonce', String(pfLastNonceUsed ?? 0))
    res.json({ crashPoint: m2, pfNonce: pfLastNonceUsed ?? 0 })
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/history', async (req, res) => {
  try {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'Surrogate-Control': 'no-store'
    })
    res.json({ history: lastCrashes })
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
