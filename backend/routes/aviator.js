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
let crashGenChain = Promise.resolve()

function withCrashGenLock (fn) {
  const p = crashGenChain.then(fn, fn)
  crashGenChain = p.catch(() => {})
  return p
}

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
  const u53 = h.readBigUInt64BE(0) >> 11n
  return Number(u53) / 9007199254740992
}

function getRecentBuckets () {
  const arr = lastCrashes.slice(0, 1).map(x => {
    const v = typeof x?.value === 'number' ? x.value : parseFloat(x?.value)
    return Number.isFinite(v) ? v : null
  }).filter(v => v != null)
  const buckets2d = new Set(arr.map(v => Math.round(v * 100)))
  return { buckets2d }
}

function baseCrashRng () {
  const r = fairRandom()
  if (r < 0.01) return 1.00
  const crash = 0.99 / (1 - r)
  const clamped = Math.max(1.00, Math.min(crash, MAX_CRASH))
  return Math.round(clamped * 100) / 100
}

function sampleCrashHeavyTail (min, max) {
  const minV = Math.max(1.00, Number.isFinite(min) ? min : 1.00)
  const maxVRaw = Number.isFinite(max) ? max : MAX_CRASH
  const maxV = Math.max(minV, Math.min(MAX_CRASH, maxVRaw))

  if (!(maxV > minV)) return Math.round(minV * 100) / 100

  const rMin = minV <= 1.00 ? 0 : 1 - (0.99 / minV)
  const rMax = 1 - (0.99 / maxV)
  const lo = Math.max(0, Math.min(rMin, rMax))
  const hi = Math.max(lo, Math.min(rMax, 0.9999999999999999))

  const r = lo + (hi - lo) * fairRandom()
  const crash = 0.99 / (1 - r)
  const clamped = Math.max(minV, Math.min(maxV, crash))
  return Math.round(clamped * 100) / 100
}

function sampleNonRepeatingCrash (gen, guardRef, buckets2d, minBound, maxBound) {
  let val = gen()
  const guard2 = guardRef == null ? null : Math.round(guardRef * 100)
  for (let i = 0; i < 80; i++) {
    const b2 = Math.round(val * 100)
    if ((guard2 != null && b2 === guard2) || buckets2d.has(b2)) {
      val = gen()
      continue
    }
    return Math.round(val * 100) / 100
  }

  const min2 = Math.round(minBound * 100)
  const max2 = Math.round(maxBound * 100)
  if (guard2 == null || (max2 - min2) < 1) return Math.round(val * 100) / 100

  if ((guard2 + 1) <= max2) return (guard2 + 1) / 100
  if ((guard2 - 1) >= min2) return (guard2 - 1) / 100
  return Math.round(val * 100) / 100
}

// Removed deprecated Pareto sampler

function sampleCrashInWindow (min, max) {
  if (!(min >= 1) || !(max > min)) {
    return Math.max(1.00, Math.min(MAX_CRASH, baseCrashRng()))
  }
  let val = min + (max - min) * fairRandom()
  val = Math.round(val * 100) / 100
  if (val <= min) {
    val = Math.min(max - 0.01, min + 0.01 + (max - min - 0.02) * fairRandom())
    val = Math.round(val * 100) / 100
  }
  if (val >= max) {
    val = Math.max(min + 0.01, max - 0.01 - (max - min - 0.02) * fairRandom())
    val = Math.round(val * 100) / 100
  }
  return Math.max(min, Math.min(max, val))
}

async function computeOverrideCrash () {
  const now = new Date()
  const minutesNow = now.getHours() * 60 + now.getMinutes()
  const rules = await AviatorRule.find({ active: true }).sort({ priority: -1, updatedAt: -1 }).lean()
  const { buckets2d } = getRecentBuckets()
  const guardRef = lastCrashSample
  for (const r of rules) {
    const hasMin = r.rangeMin != null
    const hasMax = r.rangeMax != null
    if (r.type === 'schedule') {
      const s = toMinutes(r.startTime)
      const e = toMinutes(r.endTime)
      if (!hasMin && !hasMax) continue
      if (s == null || e == null) continue
      const inWindow = s <= e ? (minutesNow >= s && minutesNow <= e) : (minutesNow >= s || minutesNow <= e)
      if (inWindow) {
        const min = hasMin ? Math.max(XM, Number(r.rangeMin)) : XM
        let max = hasMax ? Math.max(min, Number(r.rangeMax)) : MAX_CRASH
        if (hasMin && hasMax && (max - min) < 0.05) max = min + 0.05
        const minBound = hasMin ? min : 1.00
        const maxBound = hasMax ? max : MAX_CRASH
        const gen = (hasMin && hasMax)
          ? () => sampleCrashInWindow(min, max)
          : () => sampleCrashHeavyTail(minBound, maxBound)
        const val = sampleNonRepeatingCrash(gen, guardRef, buckets2d, minBound, maxBound)
        lastCrashSample = val
        return Math.round(val * 100) / 100
      }
      continue
    }
    if (r.type === 'global_range') {
      if (!hasMin || !hasMax) continue
      const min = Math.max(XM, Number(r.rangeMin))
      let max = Math.max(min, Number(r.rangeMax))
      if ((max - min) < 0.05) max = min + 0.05
      const minBound = min
      const maxBound = Math.min(MAX_CRASH, max)
      const gen = () => sampleCrashInWindow(minBound, maxBound)
      const val = sampleNonRepeatingCrash(gen, guardRef, buckets2d, minBound, maxBound)
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
    const minBound = floor
    const maxBound = MAX_CRASH
    const gen = () => sampleCrashHeavyTail(minBound, maxBound)
    const val = sampleNonRepeatingCrash(gen, guardRef, buckets2d, minBound, maxBound)
    lastCrashSample = val
    return Math.round(val * 100) / 100
  }
  // No rules: use baseline heavy tail, ensure variation
  const minBound = 1.00
  const maxBound = MAX_CRASH
  const gen = () => baseCrashRng()
  const val = sampleNonRepeatingCrash(gen, guardRef, buckets2d, minBound, maxBound)
  lastCrashSample = val
  return Math.max(1.00, val)
}

router.get('/next-crash', auth, async (req, res) => {
  try {
    const { m2, usedNonce } = await withCrashGenLock(async () => {
      const v = await computeOverrideCrash()
      const m2 = Math.max(1.00, Math.round(v * 100) / 100)
      lastCrashes.unshift({ value: m2, ts: Date.now() })
      if (lastCrashes.length > 100) lastCrashes = lastCrashes.slice(0, 100)
      return { m2, usedNonce: pfLastNonceUsed ?? 0 }
    })
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
      'Surrogate-Control': 'no-store',
      Vary: 'Authorization'
    })
    res.set('X-Provably-Fair-Commit', pfCommit)
    res.set('X-Provably-Fair-Nonce', String(usedNonce))
    res.json({ crashPoint: m2, pfNonce: usedNonce })
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
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
      'Surrogate-Control': 'no-store',
      Vary: 'Authorization'
    })
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
      { new: true, runValidators: true }
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
