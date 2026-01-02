const express = require('express')
const router = express.Router()
const Sport = require('../models/Sport')
const Match = require('../models/Match')
const { auth } = require('../middleware/auth')
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

// Get all sports
router.get('/', auth, async (req, res) => {
  try {
    const cached = cacheGet('/api/sports', {})
    if (cached) {
      const etag = computeEtag(cached)
      res.set('X-Cache', 'HIT')
      res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
      if (etag) res.set('ETag', etag)
      if (etag && req.headers['if-none-match'] === etag) {
        return res.status(304).end()
      }
      return res.json(cached)
    }

    const originalJson = res.json.bind(res)
    res.json = (data) => {
      try {
        cacheSet('/api/sports', {}, data, 300)
        res.set('X-Cache', 'MISS')
        res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
        const etag = computeEtag(data)
        if (etag) res.set('ETag', etag)
      } catch (e) {}
      return originalJson(data)
    }

    const sports = await Sport.find({ active: true }).sort({ name: 1 })
    res.json(sports)
  } catch (error) {
    console.error('Get sports error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Get sport by ID
router.get('/:sportId', auth, async (req, res) => {
  try {
    const sport = await Sport.findById(req.params.sportId)

    if (!sport) {
      return res.status(404).json({ error: 'Sport not found' })
    }

    res.json(sport)
  } catch (error) {
    console.error('Get sport error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Get leagues by sport ID
router.get('/:sportId/leagues', auth, async (req, res) => {
  try {
    const sport = await Sport.findById(req.params.sportId)

    if (!sport) {
      return res.status(404).json({ error: 'Sport not found' })
    }

    // Get current time for filtering past matches
    const now = new Date()

    // Get leagues with match counts
    const leagues = await Promise.all(
      sport.leagues.map(async (league) => {
        const matchCount = await Match.countDocuments({
          leagueId: league.id,
          $or: [
            { status: 'live' },
            { status: 'upcoming', startTime: { $gte: now } },
            { status: { $nin: ['finished', 'cancelled'] } }
          ]
        })

        return {
          ...league.toObject(),
          matchCount
        }
      })
    )

    res.json(leagues)
  } catch (error) {
    console.error('Get sport leagues error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Get matches by sport
router.get('/:sportId/matches', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const status = req.query.status || 'upcoming'

    const keyParams = { sportId: req.params.sportId, page: String(page), limit: String(limit), status }
    const cached = cacheGet('/api/sports/matches', keyParams)
    if (cached) {
      const etag = computeEtag(cached)
      res.set('X-Cache', 'HIT')
      res.set('Cache-Control', 'public, max-age=10, stale-while-revalidate=120')
      if (etag) res.set('ETag', etag)
      if (etag && req.headers['if-none-match'] === etag) {
        return res.status(304).end()
      }
      return res.json(cached)
    }

    const sport = await Sport.findById(req.params.sportId)
    if (!sport) {
      return res.status(404).json({ error: 'Sport not found' })
    }

    const now = new Date()

    const matchQuery = {
      sport: sport.key,
      status,
      $or: [
        { status: 'live' },
        { status: 'upcoming', startTime: { $gte: now } },
        { status: { $nin: ['finished', 'cancelled'] } }
      ]
    }

    const matches = await Match.find(matchQuery)
      .sort({ startTime: 1 })
      .skip((page - 1) * limit)
      .limit(limit)

    const total = await Match.countDocuments(matchQuery)

    const payload = {
      sport: sport.name,
      matches,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }

    const etag = computeEtag(payload)
    try { cacheSet('/api/sports/matches', keyParams, payload, 60) } catch (e) {}
    if (etag) res.set('ETag', etag)
    res.set('X-Cache', 'MISS')
    res.set('Cache-Control', 'public, max-age=10, stale-while-revalidate=120')
    res.json(payload)
  } catch (error) {
    console.error('Get sport matches error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Get sports with match counts
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const cached = cacheGet('/api/sports/stats/overview', {})
    if (cached) {
      const etag = computeEtag(cached)
      res.set('X-Cache', 'HIT')
      res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=180')
      if (etag) res.set('ETag', etag)
      if (etag && req.headers['if-none-match'] === etag) {
        return res.status(304).end()
      }
      return res.json(cached)
    }

    const sports = await Sport.find({ active: true })
    const sportsWithStats = await Promise.all(
      sports.map(async (sport) => {
        const upcomingMatches = await Match.countDocuments({ sport: sport.key, status: 'upcoming' })
        const liveMatches = await Match.countDocuments({ sport: sport.key, status: 'live' })
        const totalLeagues = sport.leagues.length
        return { id: sport._id, name: sport.name, key: sport.key, icon: sport.icon, upcomingMatches, liveMatches, totalLeagues }
      })
    )

    const etag = computeEtag(sportsWithStats)
    try { cacheSet('/api/sports/stats/overview', {}, sportsWithStats, 120) } catch (e) {}
    if (etag) res.set('ETag', etag)
    res.set('X-Cache', 'MISS')
    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=180')
    res.json(sportsWithStats)
  } catch (error) {
    console.error('Get sports stats error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router
