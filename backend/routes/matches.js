const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')
const Match = require('../models/Match')
const Sport = require('../models/Sport')
const { auth, adminAuth } = require('../middleware/auth')
const Odds = require('../models/Odds')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { get: cacheGet, set: cacheSet, bus } = require('../utils/cache')
const { computeFullLeagueTitle } = require('../utils/leagueTitle')

// Ensure upload dirs exist (mirror admin route behavior)
const videoUploadDir = path.join(__dirname, '../uploads/videos')
const posterUploadDir = path.join(__dirname, '../uploads/posters');
[videoUploadDir, posterUploadDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
})

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const isVideo = /\.(mp4|webm|ogg)$/i.test(file.originalname)
    const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(file.originalname)
    const folder = isVideo ? 'videos' : isImage ? 'posters' : 'videos'
    cb(null, path.join(__dirname, `../uploads/${folder}`))
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  }
})
const upload = multer({ storage })

// Helper: build a map of leagues -> { sportName, country, leagueName }
let cachedLeagueMetaMap = null
let lastLeagueMetaUpdate = 0
const LEAGUE_META_TTL = 3600 * 1000 // 1 hour

async function buildLeagueMetaMap () {
  try {
    const now = Date.now()
    if (cachedLeagueMetaMap && (now - lastLeagueMetaUpdate < LEAGUE_META_TTL)) {
      return cachedLeagueMetaMap
    }

    const sports = await Sport.find({ active: true }).lean()
    const mapByLeagueName = new Map();
    (sports || []).forEach(s => {
      const sportName = s.name || s.key || '';
      (s.leagues || []).forEach(l => {
        const leagueName = (l.name || '').trim()
        if (!leagueName) return
        mapByLeagueName.set(leagueName.toLowerCase(), {
          sportName,
          country: l.country || '',
          leagueName
        })
      })
    })

    cachedLeagueMetaMap = mapByLeagueName
    lastLeagueMetaUpdate = now
    return mapByLeagueName
  } catch (err) {
    console.warn('Failed to build league meta map:', err.message)
    return cachedLeagueMetaMap || new Map()
  }
}

function titleCase (str = '') {
  return String(str)
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function extractLeagueMeta (metaMap, sportTitle) {
  if (!sportTitle) return null
  const lc = String(sportTitle).toLowerCase()
  if (metaMap.has(lc)) return metaMap.get(lc)
  for (const [key, val] of metaMap.entries()) {
    if (lc.includes(key)) return val
  }
  return null
}

function normalizeSportToken ({ sportDisplay, leagueName, sportKeyOrName }) {
  const s = String(sportDisplay || sportKeyOrName || '').toLowerCase()
  const l = String(leagueName || '').toLowerCase()
  if (l.includes('boxing') || s.includes('boxing')) return 'boxing'
  if (l.includes('mma') || s.includes('mma') || l.includes('ufc')) return 'mma'
  const token = s.split('_')[0] || s.split(' ')[0] || s
  return token || 'other'
}

const crypto = require('crypto')
function computeEtag (obj) {
  try {
    const reduceItem = (item) => {
      if (!item || typeof item !== 'object') return item
      return {
        id: item.id || item._id || null,
        startTime: item.startTime || item.commence_time || null,
        homeTeam: item.homeTeam || item.home_team || null,
        awayTeam: item.awayTeam || item.away_team || null,
        status: item.status || null,
        sport: item.sport || item.sport_key || null
      }
    }
    let summary
    if (Array.isArray(obj)) {
      const cap = Math.min(obj.length, 200)
      summary = { len: obj.length, items: obj.slice(0, cap).map(reduceItem) }
    } else if (obj && typeof obj === 'object') {
      if (Array.isArray(obj.data)) {
        const cap = Math.min(obj.data.length, 200)
        summary = { len: obj.data.length, items: obj.data.slice(0, cap).map(reduceItem) }
      } else {
        summary = Object.keys(obj).slice(0, 50).reduce((acc, k) => { acc[k] = obj[k]; return acc }, {})
      }
    } else {
      summary = obj
    }
    const json = JSON.stringify(summary)
    return 'W/"' + crypto.createHash('sha1').update(json).digest('hex') + '"'
  } catch (e) {
    return null
  }
}

// Enhanced caching middleware with query-specific keys and ETag support
function cacheResponse (ttlSeconds = 300) {
  return (req, res, next) => {
    // Create cache key based on query parameters
    const queryParams = {
      sport: req.query.sport,
      status: req.query.status,
      leagueId: req.query.leagueId,
      page: req.query.page || '1',
      limit: req.query.limit || '50'
    }

    // Remove undefined values
    Object.keys(queryParams).forEach(key => {
      if (queryParams[key] === undefined) delete queryParams[key]
    })

    const cached = cacheGet('/api/matches', queryParams)
    if (cached) {
      const etag = computeEtag(cached)
      res.set('X-Cache', 'HIT')
      res.set('Cache-Control', 'public, max-age=10, stale-while-revalidate=300')
      if (etag) res.set('ETag', etag)
      // Conditional GET handling
      if (etag && req.headers['if-none-match'] === etag) {
        return res.status(304).end()
      }
      return res.json(cached)
    }

    const originalJson = res.json.bind(res)
    res.json = (data) => {
      try {
        const large = Array.isArray(data) ? data.length > 1200 : false
        if (large) {
          res.set('X-Cache', 'SKIP')
          return originalJson(data)
        }
        cacheSet('/api/matches', queryParams, data, ttlSeconds)
        res.set('X-Cache', 'MISS')
        res.set('Cache-Control', 'public, max-age=10, stale-while-revalidate=300')
        const etag = computeEtag(data)
        if (etag) res.set('ETag', etag)
      } catch (e) {
        console.warn('Cache set failed:', e.message)
      }
      return originalJson(data)
    }
    next()
  }
}

const MATCHES_CACHE_TTL_SECONDS = 300
const MATCHES_SNAPSHOT_MAX_AGE_MS = 15 * 60 * 1000
const MATCHES_WARM_INTERVAL_MS = 60 * 1000
const matchesSnapshots = new Map()
const matchesRefreshInflight = new Map()

function normalizedMatchesQueryParams (q = {}) {
  const queryParams = {
    sport: q.sport,
    status: q.status,
    leagueId: q.leagueId,
    page: q.page || '1',
    limit: q.limit || '50'
  }

  Object.keys(queryParams).forEach(key => {
    if (queryParams[key] === undefined) delete queryParams[key]
  })

  return queryParams
}

function snapshotKeyFor (queryParams) {
  return JSON.stringify({
    sport: queryParams.sport,
    status: queryParams.status,
    leagueId: queryParams.leagueId,
    page: queryParams.page,
    limit: queryParams.limit
  })
}

function respondCachedMatches (req, res, payload, cacheStatus) {
  const etag = computeEtag(payload)
  res.set('X-Cache', cacheStatus)
  res.set('Cache-Control', 'public, max-age=10, stale-while-revalidate=300')
  if (etag) res.set('ETag', etag)
  if (etag && req.headers['if-none-match'] === etag) {
    return res.status(304).end()
  }
  return res.json(payload)
}

async function computeMatchesPayload (queryParams) {
  const sport = queryParams.sport
  const status = queryParams.status
  const leagueId = queryParams.leagueId
  const page = parseInt(queryParams.page) || 1
  const limit = Math.min(parseInt(queryParams.limit) || 50, 100)
  const skip = (page - 1) * limit

  const now = new Date()

  const matchQuery = {
    ...(sport && { sport }),
    ...(status && { status }),
    ...(leagueId && { leagueId }),
    $or: [
      { status: 'live' },
      { status: 'upcoming', startTime: { $gte: now } },
      { status: { $nin: ['finished', 'cancelled'] } }
    ]
  }

  const oddsQuery = {
    ...(sport && { sport_key: sport }),
    ...(leagueId && { league: leagueId }),
    commence_time: { $gte: now }
  }

  const [leagueMetaMap, adminMatches, oddsData, totalAdminMatches, totalOddsData] = await Promise.all([
    buildLeagueMetaMap(),
    Match.find(matchQuery)
      .lean()
      .populate('leagueId', 'name', null, { lean: true })
      .sort({ startTime: 1 })
      .skip(skip)
      .limit(limit),
    Odds.find(oddsQuery)
      .select('gameId home_team away_team commence_time sport_key sport_title bookmakers league')
      .lean()
      .sort({ commence_time: 1 })
      .skip(skip)
      .limit(limit),
    Match.countDocuments(matchQuery),
    Odds.countDocuments(oddsQuery)
  ])

  const transformedOddsData = oddsData
    .filter(odds => odds.bookmakers && odds.bookmakers.length > 0)
    .map(odds => {
      const firstBookmaker = odds.bookmakers[0]
      const markets = {}
      let additionalMarketsCount = 0

      const normalizeMarketKey = (key) => {
        const k = (key || '').toLowerCase()
        const noLay = k.replace(/_?lay$/i, '').replace(/\blay\b/gi, '').replace(/\s+/g, ' ').trim().replace(/\s/g, '_')
        if (noLay === 'h2h' || noLay === 'moneyline') return 'h2h'
        if (noLay === 'totals' || noLay === 'over_under' || noLay === 'points_total') return 'totals'
        if (noLay === 'spreads' || noLay === 'handicap' || noLay === 'asian_handicap' || noLay === 'point_spread') return 'spreads'
        return noLay
      }

      if (firstBookmaker.markets) {
        for (const market of firstBookmaker.markets) {
          const mKey = normalizeMarketKey(market.key)

          if (mKey === 'h2h' && market.outcomes) {
            for (const outcome of market.outcomes) {
              if (outcome.name === odds.home_team) markets['1'] = outcome.price
              else if (outcome.name === odds.away_team) markets['2'] = outcome.price
              else if (outcome.name === 'Draw') markets.X = outcome.price
            }
            additionalMarketsCount++
          } else if (mKey === 'totals' && market.outcomes && market.outcomes.length >= 2) {
            const overOutcome = market.outcomes.find(o => /over/i.test(o.name)) || market.outcomes[0]
            const underOutcome = market.outcomes.find(o => /under/i.test(o.name)) || market.outcomes[1]
            const point = overOutcome?.point ?? underOutcome?.point
            if (point != null) markets.Total = point
            if (overOutcome?.price) markets.TM = overOutcome.price
            if (underOutcome?.price) markets.TU = underOutcome.price
            additionalMarketsCount++
          } else if (mKey === 'spreads' && market.outcomes) {
            const home = market.outcomes.find(o => o.name === odds.home_team)
            const away = market.outcomes.find(o => o.name === odds.away_team)
            const line = home?.point ?? away?.point
            if (line != null) markets.handicapLine = line
            if (home?.price) markets.homeHandicap = home.price
            if (away?.price) markets.awayHandicap = away.price
            additionalMarketsCount++
          } else {
            additionalMarketsCount++
          }
        }
      }

      const meta = extractLeagueMeta(leagueMetaMap, odds.sport_title)
      const leagueName = meta?.leagueName || odds.sport_title || 'Match'
      const country = meta?.country || ''
      const sportDisplay = meta?.sportName || odds.sport_key
      const fullLeagueTitle = computeFullLeagueTitle({
        sportKeyOrName: sportDisplay,
        country,
        leagueName,
        fallbackSportTitle: odds.sport_title
      })

      return {
        id: odds.gameId,
        homeTeam: odds.home_team,
        awayTeam: odds.away_team,
        startTime: odds.commence_time,
        sport: odds.sport_key,
        sport_key: odds.sport_key,
        sport_title: odds.sport_title,
        status: 'upcoming',
        odds: markets,
        additionalMarkets: additionalMarketsCount,
        market: firstBookmaker.markets[0]?.key || 'Unknown',
        bookmaker: firstBookmaker.title,
        league: leagueName,
        country,
        fullLeagueTitle
      }
    }).filter(match => match !== null)

  const formattedAdminMatches = adminMatches.map(match => {
    let formattedOdds = match.odds

    if (match.odds instanceof Map) {
      formattedOdds = {}
      for (const [key, value] of match.odds.entries()) {
        formattedOdds[key] = value
      }
    }

    if (formattedOdds && typeof formattedOdds === 'object') {
      Object.keys(formattedOdds).forEach(k => {
        const v = formattedOdds[k]
        if (typeof v === 'string' && v.trim() !== '') {
          const num = Number(v)
          formattedOdds[k] = Number.isFinite(num) ? num : v
        }
      })
      if (formattedOdds['1'] == null && formattedOdds.homeWin != null) {
        formattedOdds['1'] = Number(formattedOdds.homeWin)
      }
      if (formattedOdds['2'] == null && formattedOdds.awayWin != null) {
        formattedOdds['2'] = Number(formattedOdds.awayWin)
      }
      if (formattedOdds.X == null && formattedOdds.draw != null) {
        formattedOdds.X = Number(formattedOdds.draw)
      }
    }

    const leagueName = match.leagueId?.name || 'Match'
    const meta = leagueName ? leagueMetaMap.get(String(leagueName).toLowerCase()) : null
    const country = meta?.country || ''
    const sportDisplay = meta?.sportName || match.sport
    const fullLeagueTitle = computeFullLeagueTitle({
      sportKeyOrName: sportDisplay,
      country,
      leagueName
    })

    return {
      id: match._id,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      startTime: match.startTime,
      sport: match.sport,
      sport_title: leagueName,
      status: match.status,
      odds: formattedOdds,
      additionalMarkets: formattedOdds ? Object.keys(formattedOdds).filter(key => formattedOdds[key] && formattedOdds[key] > 0).length : 0,
      market: 'admin',
      bookmaker: 'Admin',
      videoUrl: match.videoUrl || null,
      videoPosterUrl: match.videoPosterUrl || null,
      league: leagueName,
      country,
      fullLeagueTitle
    }
  })

  const allMatches = [...formattedAdminMatches, ...transformedOddsData]
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))

  const totalMatches = totalAdminMatches + totalOddsData
  const totalPages = Math.ceil(totalMatches / limit)

  return {
    matches: allMatches,
    pagination: {
      page,
      limit,
      total: totalMatches,
      pages: totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    },
    meta: {
      adminMatches: formattedAdminMatches.length,
      oddsMatches: transformedOddsData.length,
      cached: false
    }
  }
}

async function refreshMatchesSnapshotAndCache (queryParams) {
  const payload = await computeMatchesPayload(queryParams)
  cacheSet('/api/matches', queryParams, payload, MATCHES_CACHE_TTL_SECONDS)
  matchesSnapshots.set(snapshotKeyFor(queryParams), { payload, updatedAt: Date.now() })
  return payload
}

function triggerMatchesRefresh (queryParams) {
  const key = snapshotKeyFor(queryParams)
  if (matchesRefreshInflight.has(key)) return
  const p = refreshMatchesSnapshotAndCache(queryParams)
    .catch(() => {})
    .finally(() => {
      matchesRefreshInflight.delete(key)
    })
  matchesRefreshInflight.set(key, p)
}

const DEFAULT_MATCHES_QUERY_PARAMS = normalizedMatchesQueryParams({})
function scheduleDefaultMatchesWarm () {
  const attempt = () => {
    try {
      if (mongoose.connection.readyState !== 1) return
      triggerMatchesRefresh(DEFAULT_MATCHES_QUERY_PARAMS)
    } catch (_) {}
  }

  setTimeout(attempt, 500)
  const intervalId = setInterval(attempt, MATCHES_WARM_INTERVAL_MS)
  try {
    if (intervalId && typeof intervalId.unref === 'function') intervalId.unref()
  } catch (_) {}

  bus.on('matches:changed', attempt)
  bus.on('odds:changed', attempt)
  bus.on('sports:changed', attempt)
}

scheduleDefaultMatchesWarm()

// Create a new match
router.post('/', adminAuth, async (req, res) => {
  try {
    const newMatch = new Match(req.body)
    await newMatch.save()
    bus.emit('matches:new', newMatch)
    res.status(201).json(newMatch)
  } catch (error) {
    console.error('Create match error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Get all matches for admin (no pagination/filtering)
router.get('/all', adminAuth, async (req, res) => {
  try {
    const matches = await Match.find({})
      .select('_id homeTeam awayTeam startTime sport status createdAt leagueId odds videoUrl videoPosterUrl externalId homeScore awayScore')
      .populate('leagueId', 'name')
      .lean()
      .sort({ createdAt: -1 })
    res.json({ matches })
  } catch (error) {
    console.error('Get all matches for admin error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Admin instant search across all matches (includes finished/cancelled)
router.get('/search', adminAuth, async (req, res) => {
  try {
    const { q = '', status, leagueId, sport } = req.query
    const page = Math.max(parseInt(req.query.page) || 1, 1)
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 100, 1), 500)
    const skip = (page - 1) * limit

    const criteria = {
      ...(sport && { sport }),
      ...(status && { status }),
      ...(leagueId && { leagueId })
    }
    const query = String(q || '').trim()
    if (query.length > 0) {
      const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      criteria.$or = [
        { homeTeam: regex },
        { awayTeam: regex },
        { leagueName: regex }
      ]
    }

    const [matches, total] = await Promise.all([
      Match.find(criteria)
        .select('_id homeTeam awayTeam startTime sport status leagueId')
        .lean()
        .sort({ startTime: -1 })
        .skip(skip)
        .limit(limit),
      Match.countDocuments(criteria)
    ])

    res.json({ matches, page, limit, total })
  } catch (error) {
    console.error('Admin matches search error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Get all matches with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const queryParams = normalizedMatchesQueryParams(req.query || {})

    const cached = cacheGet('/api/matches', queryParams)
    if (cached) {
      return respondCachedMatches(req, res, cached, 'HIT')
    }

    const snapKey = snapshotKeyFor(queryParams)
    const snap = matchesSnapshots.get(snapKey)
    if (snap && snap.payload && (Date.now() - snap.updatedAt <= MATCHES_SNAPSHOT_MAX_AGE_MS)) {
      triggerMatchesRefresh(queryParams)
      return respondCachedMatches(req, res, snap.payload, 'STALE')
    }

    const payload = await refreshMatchesSnapshotAndCache(queryParams)
    return respondCachedMatches(req, res, payload, 'MISS')
  } catch (error) {
    console.error('Get matches error:', error)
    try {
      const queryParams = normalizedMatchesQueryParams(req.query || {})
      const snapKey = snapshotKeyFor(queryParams)
      const snap = matchesSnapshots.get(snapKey)
      if (snap && snap.payload) {
        return respondCachedMatches(req, res, snap.payload, 'STALE')
      }
    } catch (_) {}
    res.status(500).json({ error: 'Server error' })
  }
})

// Get matches by league ID with caching
router.get('/league/:leagueId', cacheResponse(600), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = Math.min(parseInt(req.query.limit) || 20, 100)
    const status = req.query.status || 'upcoming'
    const skip = (page - 1) * limit

    // Get current time for filtering past matches
    const now = new Date()

    const query = {
      leagueId: req.params.leagueId,
      status,
      // Only show live and future matches
      $or: [
        { status: 'live' },
        { status: 'upcoming', startTime: { $gte: now } },
        { status: { $nin: ['finished', 'cancelled'] } }
      ]
    }

    // Use Promise.all for parallel execution
    const [matches, total] = await Promise.all([
      Match.find(query)
        .lean()
        .populate('leagueId', 'name', null, { lean: true })
        .sort({ startTime: 1 })
        .skip(skip)
        .limit(limit),
      Match.countDocuments(query)
    ])

    res.json({
      matches,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      },
      meta: {
        leagueId: req.params.leagueId,
        status,
        cached: res.get('X-Cache') === 'HIT'
      }
    })
  } catch (error) {
    console.error('Get league matches error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Get popular matches (most bet on)
router.get('/popular/trending', async (req, res) => {
  try {
    const cached = cacheGet('/api/matches/popular/trending', {})
    if (cached) {
      const etag = computeEtag(cached)
      res.set('X-Cache', 'HIT')
      res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=600')
      if (etag) res.set('ETag', etag)
      if (etag && req.headers['if-none-match'] === etag) {
        return res.status(304).end()
      }
      return res.json(cached)
    }

    const originalJson = res.json.bind(res)
    res.json = (data) => {
      try {
        const large = Array.isArray(data) ? data.length > 1200 : false
        if (large) {
          res.set('X-Cache', 'SKIP')
          return originalJson(data)
        }
        cacheSet('/api/matches/popular/trending', {}, data, 600)
        res.set('X-Cache', 'MISS')
        res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=600')
        const etag = computeEtag(data)
        if (etag) res.set('ETag', etag)
      } catch (e) {}
      return originalJson(data)
    }

    // Get matches from both collections
    const [adminMatches, oddsData] = await Promise.all([
      Match.find({
        status: 'upcoming',
        startTime: { $gte: new Date() }
      })
        .select('_id homeTeam awayTeam startTime sport status odds markets leagueId')
        .lean()
        .populate('leagueId', 'name', null, { lean: true })
        .sort({ startTime: 1 })
        .limit(20),
      Odds.find({
        commence_time: { $gte: new Date() }
      })
        .select('gameId home_team away_team commence_time sport_key sport_title bookmakers')
        .lean()
        .sort({ commence_time: 1 })
        .limit(20)
    ])

    // Transform odds data into match format
    const leagueMetaMap = await buildLeagueMetaMap()
    const transformedOddsData = oddsData.map(odds => {
      const firstBookmaker = odds.bookmakers[0]
      if (!firstBookmaker) return null

      const markets = {}
      let additionalMarketsCount = 0

      firstBookmaker.markets.forEach(market => {
        const key = (market.key || '').toLowerCase()
        if (key === 'h2h' && Array.isArray(market.outcomes)) {
          market.outcomes.forEach(outcome => {
            if (outcome.name === odds.home_team) markets['1'] = outcome.price
            else if (outcome.name === odds.away_team) markets['2'] = outcome.price
            else if (outcome.name === 'Draw') markets.X = outcome.price
          })
        } else if (key === 'totals' && Array.isArray(market.outcomes)) {
          const over = market.outcomes.find(o => /over/i.test(o.name)) || market.outcomes[0]
          const under = market.outcomes.find(o => /under/i.test(o.name)) || market.outcomes[1]
          const total = over?.point ?? under?.point
          if (total != null) markets.Total = total
          if (typeof over?.price === 'number') markets.TM = over.price
          if (typeof under?.price === 'number') markets.TU = under.price
          additionalMarketsCount++
        } else if (key === 'spreads' && Array.isArray(market.outcomes)) {
          const home = market.outcomes.find(o => o.name === odds.home_team)
          const away = market.outcomes.find(o => o.name === odds.away_team)
          const line = home?.point ?? away?.point
          if (line != null) markets.handicapLine = line
          if (typeof home?.price === 'number') markets.homeHandicap = home.price
          if (typeof away?.price === 'number') markets.awayHandicap = away.price
          additionalMarketsCount++
        } else {
          additionalMarketsCount++
        }
      })

      const meta = extractLeagueMeta(leagueMetaMap, odds.sport_title)
      const leagueName = meta?.leagueName || odds.sport_title || 'Match'
      const country = meta?.country || ''
      const sportDisplay = meta?.sportName || odds.sport_key
      const fullLeagueTitle = computeFullLeagueTitle({
        sportKeyOrName: sportDisplay,
        country,
        leagueName,
        fallbackSportTitle: odds.sport_title
      })

      return {
        id: odds.gameId,
        league: leagueName,
        subcategory: `${titleCase(sportDisplay)}${country ? '.' + country : ''}`,
        startTime: odds.commence_time,
        homeTeam: odds.home_team,
        awayTeam: odds.away_team,
        odds: markets,
        additionalMarkets: additionalMarketsCount,
        sport: normalizeSportToken({ sportDisplay, leagueName, sportKeyOrName: odds.sport_key }),
        source: 'odds_api',
        country,
        fullLeagueTitle
      }
    }).filter(match => match !== null)

    // Transform admin matches
    const transformedAdminMatches = adminMatches.map(matchObj => {
      // matchObj is already a plain object due to lean()

      // Convert odds to the expected format if needed
      let formattedOdds = matchObj.odds

      // If odds is a Map (from mongoose), convert to plain object
      if (matchObj.odds instanceof Map) {
        formattedOdds = {}
        for (const [key, value] of matchObj.odds.entries()) {
          formattedOdds[key] = value
        }
      }

      // Ensure mandatory H2H odds exist (1, X, 2) and coerce numbers
      if (formattedOdds && typeof formattedOdds === 'object') {
        Object.keys(formattedOdds).forEach(k => {
          const v = formattedOdds[k]
          if (typeof v === 'string' && v.trim() !== '') {
            const num = Number(v)
            formattedOdds[k] = Number.isFinite(num) ? num : v
          }
        })
        // If missing, attempt fallback from homeWin/awayWin/draw keys
        if (formattedOdds['1'] == null && formattedOdds.homeWin != null) {
          formattedOdds['1'] = Number(formattedOdds.homeWin)
        }
        if (formattedOdds['2'] == null && formattedOdds.awayWin != null) {
          formattedOdds['2'] = Number(formattedOdds.awayWin)
        }
        if (formattedOdds.X == null && formattedOdds.draw != null) {
          formattedOdds.X = Number(formattedOdds.draw)
        }
      }

      const leagueName = matchObj.leagueId ? matchObj.leagueId.name : 'Match'
      const meta = leagueName ? leagueMetaMap.get(String(leagueName).toLowerCase()) : null
      const country = meta?.country || ''
      const sportDisplay = meta?.sportName || matchObj.sport
      const fullLeagueTitle = computeFullLeagueTitle({
        sportKeyOrName: sportDisplay,
        country,
        leagueName
      })

      return {
        id: matchObj._id,
        league: leagueName,
        subcategory: `${titleCase(sportDisplay)}${country ? '.' + country : ''}`,
        startTime: matchObj.startTime,
        homeTeam: matchObj.homeTeam,
        awayTeam: matchObj.awayTeam,
        odds: formattedOdds,
        additionalMarkets: (matchObj.markets || []).length,
        sport: normalizeSportToken({ sportDisplay, leagueName, sportKeyOrName: matchObj.sport }),
        sport_key: matchObj.sport,
        sport_title: leagueName,
        source: 'admin',
        country,
        fullLeagueTitle
      }
    })

    // Combine all matches
    const allMatches = [...transformedAdminMatches, ...transformedOddsData]

    // Filter matches with valid odds (at least 2 valid odds)
    const matchesWithValidOdds = allMatches.filter(match => {
      if (!match.odds) return false
      const validOddsCount = Object.values(match.odds).filter(odd => odd > 0).length
      return validOddsCount >= 2
    })

    // Prioritize soccer matches
    const soccerMatches = matchesWithValidOdds.filter(match =>
      match.sport && (
        match.sport.toLowerCase().includes('soccer') ||
        match.sport.toLowerCase().includes('football') ||
        (match.league && (
          match.league.toLowerCase().includes('premier league') ||
          match.league.toLowerCase().includes('la liga') ||
          match.league.toLowerCase().includes('bundesliga') ||
          match.league.toLowerCase().includes('serie a') ||
          match.league.toLowerCase().includes('ligue 1') ||
          match.league.toLowerCase().includes('champions league') ||
          match.league.toLowerCase().includes('europa league')
        ))
      )
    )

    const otherMatches = matchesWithValidOdds.filter(match =>
      !soccerMatches.some(soccerMatch => soccerMatch.id === match.id)
    )

    // Return soccer matches first, then others, limited to 6
    const prioritizedMatches = [...soccerMatches, ...otherMatches].slice(0, 6)

    // Transform to final format
    const finalMatches = prioritizedMatches.map(match => ({
      id: match.id,
      league: match.league,
      subcategory: match.subcategory,
      startTime: match.startTime,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      odds: match.odds,
      sport: match.sport,
      sport_key: match.sport_key || match.sport,
      sport_title: match.sport_title || match.league,
      source: match.source,
      country: match.country || '',
      fullLeagueTitle: match.fullLeagueTitle || `${titleCase(match.sport || '')}${match.country ? '.' + match.country : ''}${match.league ? '.' + match.league : ''}`
    }))

    res.json({
      success: true,
      matches: finalMatches,
      total: finalMatches.length,
      soccerCount: soccerMatches.length,
      otherCount: otherMatches.length
    })
  } catch (error) {
    console.error('Get popular matches error:', error)
    // Serve stale cache if available to avoid slow loads in production
    try {
      const stale = cacheGet('/api/matches/popular/trending', {})
      if (stale) {
        res.set('X-Cache', 'STALE')
        res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=600')
        return res.json(stale)
      }
    } catch (_) {}
    res.status(500).json({ error: 'Server error' })
  }
})

// Get match by ID with markets and odds
router.get('/:matchId', async (req, res) => {
  try {
    const match = await Match.findById(req.params.matchId)
      .select('_id homeTeam awayTeam sport league startTime status updatedAt odds markets')
      .lean()

    if (!match) {
      return res.status(404).json({ error: 'Match not found' })
    }

    res.json(match)
  } catch (error) {
    console.error('Get match error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Temporary debugging route to check odds structure
router.get('/debug/odds/:matchId', async (req, res) => {
  try {
    const match = await Match.findById(req.params.matchId)
    if (!match) {
      return res.status(404).json({ error: 'Match not found' })
    }

    res.json({
      matchId: match._id,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      odds: match.odds,
      oddsType: typeof match.odds,
      isMap: match.odds instanceof Map,
      hasGetMethod: typeof match.odds.get === 'function',
      oddsKeys: match.odds instanceof Map ? Array.from(match.odds.keys()) : Object.keys(match.odds),
      oddsValues: match.odds instanceof Map ? Array.from(match.odds.values()) : Object.values(match.odds)
    })
  } catch (error) {
    console.error('Debug odds error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Enhanced Get match markets and odds with comprehensive additional markets
router.get('/:matchId/markets', async (req, res) => {
  try {
    const isFull = String(req.query.full || '').toLowerCase() === 'true'
    const cacheKeyPath = `/api/matches/${req.params.matchId}/markets`
    const cached = cacheGet(cacheKeyPath, {})
    if (cached) {
      const etag = computeEtag(cached)
      res.set('X-Cache', 'HIT')
      res.set('Cache-Control', 'public, max-age=10, stale-while-revalidate=300')
      if (etag) res.set('ETag', etag)
      if (etag && req.headers['if-none-match'] === etag) {
        return res.status(304).end()
      }
      return res.json(cached)
    }
    console.log('=== MATCH MARKETS REQUEST ===')
    console.log('Match ID received:', req.params.matchId)

    let match = null

    // First, try to find by MongoDB ObjectId (for admin-created matches)
    if (mongoose.Types.ObjectId.isValid(req.params.matchId)) {
      console.log('Valid ObjectId format, searching in Match collection...')
      match = await Match.findById(req.params.matchId)
        .select('_id homeTeam awayTeam startTime sport league status updatedAt odds')
        .lean()

      if (match) {
        console.log('Match found in Match collection:', {
          id: match._id,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          sport: match.sport,
          hasOdds: !!match.odds
        })
      }
    }

    // If not found, try to find by gameId in Odds collection (for API matches)
    if (!match) {
      console.log('Searching by gameId in Odds collection...')
      const oddsData = await Odds.findOne({ gameId: req.params.matchId })
        .select('gameId home_team away_team sport_key sport_title commence_time bookmakers')
        .lean()

      if (oddsData) {
        console.log('Match found in Odds collection:', {
          gameId: oddsData.gameId,
          homeTeam: oddsData.home_team,
          awayTeam: oddsData.away_team,
          sport: oddsData.sport_key,
          bookmakers: oddsData.bookmakers.length
        })

        // Transform odds data to match format expected by frontend
        match = {
          _id: oddsData.gameId,
          homeTeam: oddsData.home_team,
          awayTeam: oddsData.away_team,
          sport: oddsData.sport_key,
          league: oddsData.sport_title,
          startTime: oddsData.commence_time,
          status: 'upcoming',
          markets: [],
          bookmakers: oddsData.bookmakers
        }

        // Process bookmakers to create markets structure (preview-fast or full)
        if (oddsData.bookmakers && oddsData.bookmakers.length > 0) {
          // Helper to normalize market keys and titles (collapse lay/exchange variants and aliases)
          const normalizeMarketKey = (key) => {
            const k = (key || '').toLowerCase()
            // Remove generic lay suffixes and tokens
            const noLay = k.replace(/_?lay$/i, '').replace(/\blay\b/gi, '').replace(/\s+/g, ' ').trim().replace(/\s/g, '_')
            // Map common aliases to canonical keys
            if (noLay === 'h2h' || noLay === 'moneyline') return 'h2h'
            if (noLay === 'spreads' || noLay === 'handicap' || noLay === 'asian_handicap' || noLay === 'point_spread') return 'spreads'
            if (noLay === 'totals' || noLay === 'over_under' || noLay === 'points_total') return 'totals'
            if (noLay === 'double_chance') return 'double_chance'
            if (noLay === 'draw_no_bet') return 'draw_no_bet'
            if (noLay === 'both_teams_to_score' || noLay === 'btts') return 'both_teams_to_score'
            return noLay
          }

          const normalizeTitleAndDescription = (key) => {
            let title = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
            let description = `Betting market for ${key.replace(/_/g, ' ')}`
            if (key === 'h2h') {
              title = 'H2H'
              description = 'Head to Head - Pick the winner of the match'
            } else if (key === 'totals') {
              title = 'Total Goals'
              description = 'Over/Under total goals in the match'
            } else if (key === 'spreads') {
              title = 'Point Spread'
              description = 'Handicap betting with point spread'
            } else if (key === 'outrights') {
              title = 'Outright Winner'
              description = 'Tournament or competition winner'
            }
            return { title, description }
          }

          const markets = []
          const processedMarkets = new Set()

          if (!isFull) {
            // Fast preview: only first bookmaker and a small set of canonical markets
            const bm = oddsData.bookmakers[0]
            const preferred = ['h2h', 'h2h_3_way', 'totals', 'spreads', 'double_chance'];
            (bm.markets || []).forEach(market => {
              const originalKey = market.key || ''
              const normalizedKey = normalizeMarketKey(originalKey)
              // Only include preferred canonical markets
              if (!preferred.includes(originalKey) && !preferred.includes(normalizedKey)) return
              if (processedMarkets.has(normalizedKey)) return
              processedMarkets.add(normalizedKey)

              const { title: marketTitle, description: marketDescription } = normalizeTitleAndDescription(normalizedKey)
              const outcomes = (market.outcomes || [])
                .slice(0, 3)
                .map(outcome => ({ name: outcome.name, price: outcome.price, point: outcome.point || null }))
              markets.push({ key: normalizedKey, title: marketTitle, description: marketDescription, outcomes })
            })
          } else {
            // Full processing: dedupe across all bookmakers
            oddsData.bookmakers.forEach(bookmaker => {
              (bookmaker.markets || []).forEach(market => {
                const originalKey = market.key || ''
                const normalizedKey = normalizeMarketKey(originalKey)
                if (processedMarkets.has(normalizedKey)) return
                processedMarkets.add(normalizedKey)

                const { title: marketTitle, description: marketDescription } = normalizeTitleAndDescription(normalizedKey)
                markets.push({
                  key: normalizedKey,
                  title: marketTitle,
                  description: marketDescription,
                  outcomes: (market.outcomes || []).map(outcome => ({
                    name: outcome.name,
                    price: outcome.price,
                    point: outcome.point || null
                  }))
                })
              })
            })
          }

          match.markets = markets
          console.log(`Processed ${markets.length} unique markets from ${oddsData.bookmakers.length} bookmakers`)
        }

        // Return the transformed match with comprehensive markets
        console.log('Returning API match with comprehensive markets:', {
          id: match._id,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          marketsCount: match.markets.length,
          sampleMarkets: match.markets.slice(0, 3).map(m => m.title)
        })

        try {
          // Cache under the same key for preview and full; full fetch will overwrite preview
          cacheSet(cacheKeyPath, {}, match, 180)
          res.set('X-Cache', 'MISS')
          res.set('Cache-Control', 'public, max-age=10, stale-while-revalidate=300')
          const etag = computeEtag(match)
          if (etag) res.set('ETag', etag)
        } catch (_) {}
        return res.json(match)
      }
    }

    if (!match) {
      console.log('Match not found in either collection')
      return res.status(404).json({ error: 'Match not found' })
    }

    console.log('Match found:', {
      id: match._id,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      sport: match.sport,
      hasOdds: !!match.odds
    })

    // When a DB match is found and full markets are requested, try to enrich from Odds collection
    if (isFull) {
      try {
        const windowMs = 12 * 60 * 60 * 1000
        const start = match.startTime ? new Date(match.startTime) : null
        const timeFilter = start ? { $gte: new Date(start.getTime() - windowMs), $lte: new Date(start.getTime() + windowMs) } : undefined
        const oddsCandidateQuery = {
          home_team: match.homeTeam,
          away_team: match.awayTeam
        }
        if (timeFilter) oddsCandidateQuery.commence_time = timeFilter
        const oddsData = await Odds.findOne(oddsCandidateQuery)
          .select('gameId home_team away_team sport_key sport_title commence_time bookmakers')
          .lean()
        if (oddsData && Array.isArray(oddsData.bookmakers) && oddsData.bookmakers.length > 0) {
          const normalizeMarketKey = (key) => {
            const k = (key || '').toLowerCase()
            const noLay = k.replace(/_?lay$/i, '').replace(/\blay\b/gi, '').replace(/\s+/g, ' ').trim().replace(/\s/g, '_')
            if (noLay === 'h2h' || noLay === 'moneyline' || noLay === 'h2h_3_way') return 'h2h'
            if (noLay === 'spreads' || noLay === 'handicap' || noLay === 'asian_handicap' || noLay === 'point_spread') return 'spreads'
            if (noLay === 'totals' || noLay === 'over_under' || noLay === 'points_total') return 'totals'
            if (noLay === 'double_chance') return 'double_chance'
            if (noLay === 'draw_no_bet') return 'draw_no_bet'
            if (noLay === 'both_teams_to_score' || noLay === 'btts') return 'both_teams_to_score'
            return noLay
          }
          const normalizeTitleAndDescription = (key) => {
            let title = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
            let description = `Betting market for ${key.replace(/_/g, ' ')}`
            if (key === 'h2h') {
              title = 'H2H'
              description = 'Head to Head - Pick the winner of the match'
            } else if (key === 'totals') {
              title = 'Total Goals'
              description = 'Over/Under total goals in the match'
            } else if (key === 'spreads') {
              title = 'Point Spread'
              description = 'Handicap betting with point spread'
            } else if (key === 'outrights') {
              title = 'Outright Winner'
              description = 'Tournament or competition winner'
            }
            return { title, description }
          }
          const markets = []
          const processed = new Set()
          oddsData.bookmakers.forEach(bookmaker => {
            (bookmaker.markets || []).forEach(market => {
              const normalizedKey = normalizeMarketKey(market.key || '')
              if (processed.has(normalizedKey)) return
              processed.add(normalizedKey)
              const { title, description } = normalizeTitleAndDescription(normalizedKey)
              markets.push({
                key: normalizedKey,
                title,
                description,
                outcomes: (market.outcomes || []).map(o => ({
                  name: o.name,
                  price: o.price,
                  point: o.point || null
                }))
              })
            })
          })
          const responseData = {
            id: match._id,
            sport_key: match.sport || oddsData.sport_key || 'soccer',
            sport_title: match.league || oddsData.sport_title || 'Football',
            commence_time: match.startTime || oddsData.commence_time,
            home_team: match.homeTeam || oddsData.home_team,
            away_team: match.awayTeam || oddsData.away_team,
            league: match.league || oddsData.sport_title,
            status: match.status || 'upcoming',
            last_update: match.updatedAt || new Date().toISOString(),
            bookmakers: [{ key: 'merged', title: 'Merged', last_update: new Date().toISOString(), markets }],
            odds: match.odds || {}
          }
          try {
            cacheSet(cacheKeyPath, {}, responseData, 180)
            res.set('X-Cache', 'MISS')
            res.set('Cache-Control', 'public, max-age=10, stale-while-revalidate=300')
            const etag = computeEtag(responseData)
            if (etag) res.set('ETag', etag)
          } catch (_) {}
          return res.json(responseData)
        }
      } catch (e) {
        // fall back to internal odds handling below
      }
    }

    // Handle the actual odds structure: odds.default.odds.{key}
    let oddsData = null
    if (match.odds) {
      console.log('Raw odds object:', match.odds)
      console.log('Odds type:', typeof match.odds)
      console.log('Is Map:', match.odds instanceof Map)
      console.log('Has forEach:', typeof match.odds.forEach === 'function')

      // Handle Map-based odds structure (new structure for custom matches)
      if (match.odds instanceof Map) {
        console.log('Odds is a Map, converting to object...')
        oddsData = Object.fromEntries(match.odds)
        console.log('Converted Map odds to object:', oddsData)
        console.log('Converted odds keys:', Object.keys(oddsData))
        console.log('Converted odds values:', Object.values(oddsData))
      } else if (match.odds.default && match.odds.default.odds) {
        // Handle nested odds structure (from matchesSeed.js)
        oddsData = match.odds.default.odds
        console.log('Extracted default odds data:', oddsData)
      } else if (typeof match.odds === 'object' && !match.odds.default) {
        // Handle flat odds structure
        oddsData = match.odds
        console.log('Using flat odds structure:', oddsData)
      } else {
        console.log('No recognizable odds structure found:', Object.keys(match.odds))
      }
    } else {
      console.log('No odds found for match')
    }

    if (!oddsData) {
      return res.json({
        id: match._id,
        sport_key: match.sport || 'soccer',
        sport_title: match.league || 'Football',
        commence_time: match.startTime,
        home_team: match.homeTeam,
        away_team: match.awayTeam,
        league: match.league,
        status: match.status || 'upcoming',
        last_update: match.updatedAt || new Date().toISOString(),
        bookmakers: []
      })
    }

    // Create a bookmaker structure similar to the sample data
    const bookmaker = {
      key: 'default',
      title: 'Default',
      last_update: new Date().toISOString(),
      markets: []
    }

    // Match Winner market
    if (oddsData['1'] && oddsData['2']) {
      const outcomes = [
        { name: match.homeTeam, price: parseFloat(oddsData['1']), point: null },
        { name: match.awayTeam, price: parseFloat(oddsData['2']), point: null }
      ]

      if (oddsData.X && oddsData.X > 0 && ['football', 'soccer'].includes(match.sport)) {
        outcomes.splice(1, 0, { name: 'Draw', price: parseFloat(oddsData.X), point: null })
      }

      bookmaker.markets.push({
        key: 'h2h',
        last_update: new Date().toISOString(),
        outcomes
      })
    }

    // Total Goals/Points market
    if (oddsData.TM && oddsData.TU && oddsData.Total) {
      bookmaker.markets.push({
        key: 'totals',
        last_update: new Date().toISOString(),
        outcomes: [
          { name: `Over ${oddsData.Total}`, price: parseFloat(oddsData.TM), point: parseFloat(oddsData.Total) },
          { name: `Under ${oddsData.Total}`, price: parseFloat(oddsData.TU), point: parseFloat(oddsData.Total) }
        ]
      })
    }

    // Double Chance market
    if (oddsData['1X'] || oddsData['12'] || oddsData['2X']) {
      const doubleChanceOutcomes = []

      if (oddsData['1X'] > 0) {
        doubleChanceOutcomes.push({ name: `${match.homeTeam} or Draw`, price: parseFloat(oddsData['1X']), point: null })
      }
      if (oddsData['12'] > 0) {
        doubleChanceOutcomes.push({ name: `${match.homeTeam} or ${match.awayTeam}`, price: parseFloat(oddsData['12']), point: null })
      }
      if (oddsData['2X'] > 0) {
        doubleChanceOutcomes.push({ name: `${match.awayTeam} or Draw`, price: parseFloat(oddsData['2X']), point: null })
      }

      if (doubleChanceOutcomes.length > 0) {
        bookmaker.markets.push({
          key: 'double_chance',
          last_update: new Date().toISOString(),
          outcomes: doubleChanceOutcomes
        })
      }
    }

    // Add any other available markets
    Object.entries(oddsData).forEach(([key, value]) => {
      const lowerKey = String(key || '').toLowerCase()
      // Handle array-based markets (Correct Score, Multi Goals, etc.)
      if (Array.isArray(value)) {
        if (lowerKey === 'correctscore' || lowerKey === 'correct_score' || lowerKey === 'correct score' || lowerKey === 'correctscore_lay') {
          const outcomes = value
            .filter(item => item.score && item.odds)
            .map(item => ({ name: item.score, price: parseFloat(item.odds), point: null }))
          if (outcomes.length > 0) {
            console.log(`Adding array market: ${key} with ${outcomes.length} outcomes`)
            bookmaker.markets.push({
              key: 'correct_score',
              title: 'Correct Score',
              last_update: new Date().toISOString(),
              outcomes
            })
          }
        } else if (lowerKey === 'multigoals' || lowerKey === 'multi_goals' || lowerKey === 'goalbands' || lowerKey === 'multi goals' || lowerKey === 'multigoals_lay' || lowerKey === 'goal_bands') {
          const outcomes = value
            .filter(item => (item.range || item.band) && item.odds)
            .map(item => ({ name: `${(item.range || item.band)} Goals`, price: parseFloat(item.odds), point: null }))
          if (outcomes.length > 0) {
            console.log(`Adding array market: ${key} with ${outcomes.length} outcomes`)
            bookmaker.markets.push({
              key: 'multi_goals',
              title: 'Multi Goals',
              last_update: new Date().toISOString(),
              outcomes
            })
          }
        }
        return
      }

      if (!['1', '2', 'X', 'TM', 'TU', 'Total', '1X', '12', '2X'].includes(key) && value > 0) {
        console.log(`Adding additional market: ${key} = ${value}`)
        bookmaker.markets.push({
          key: key.toLowerCase(),
          last_update: new Date().toISOString(),
          outcomes: [{ name: key, price: parseFloat(value), point: null }]
        })
      } else {
        console.log(`Skipping market (basic or already handled): ${key} = ${value}`)
      }
    })

    console.log('Final bookmaker markets:', bookmaker.markets.map(m => ({ key: m.key, outcomes: m.outcomes.length })))

    // Create response data
    const responseData = {
      id: match._id,
      sport_key: match.sport || 'soccer',
      sport_title: match.league || 'Football',
      commence_time: match.startTime,
      home_team: match.homeTeam,
      away_team: match.awayTeam,
      league: match.league,
      status: match.status || 'upcoming',
      last_update: match.updatedAt || new Date().toISOString(),
      bookmakers: [bookmaker],
      odds: oddsData // Include raw odds for frontend custom grouping
    }

    console.log('Sending response:', {
      matchId: responseData.id,
      marketsCount: bookmaker.markets.length,
      homeTeam: responseData.home_team,
      awayTeam: responseData.away_team
    })
    console.log('=== END MATCH MARKETS REQUEST ===')

    try {
      cacheSet(cacheKeyPath, {}, responseData, 180)
      res.set('X-Cache', 'MISS')
      res.set('Cache-Control', 'public, max-age=10, stale-while-revalidate=300')
      const etag = computeEtag(responseData)
      if (etag) res.set('ETag', etag)
    } catch (_) {}
    res.json(responseData)
  } catch (error) {
    console.error('=== MATCH MARKETS ERROR ===')
    console.error('Error details:', error)
    console.error('Error stack:', error.stack)
    res.status(500).json({ error: 'Server error', details: error.message })
  }
})

// Get live matches
router.get('/live/all', async (req, res) => { // Removed auth middleware
  try {
    const liveMatches = await Match.find({ status: 'live' })
      .select('_id homeTeam awayTeam startTime sport leagueId homeScore awayScore odds markets')
      .lean()
      .populate('leagueId', 'name', null, { lean: true })
      .sort({ startTime: 1 })

    res.json(liveMatches)
  } catch (error) {
    console.error('Get live matches error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Get upcoming matches for today
router.get('/today/upcoming', async (req, res) => { // Removed auth middleware
  try {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date()
    endOfDay.setHours(23, 59, 59, 999)

    const upcomingMatches = await Match.find({
      startTime: { $gte: startOfDay, $lte: endOfDay },
      status: 'upcoming'
    })
      .select('_id homeTeam awayTeam startTime sport status odds markets')
      .lean()
      .sort({ startTime: 1 })

    res.json(upcomingMatches)
  } catch (error) {
    console.error('Get upcoming matches for today error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Get matches for today
router.get('/today', async (req, res) => { // Removed auth middleware
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const matches = await Match.find({
      status: 'upcoming',
      startTime: {
        $gte: today,
        $lt: tomorrow
      }
    })
      .select('_id homeTeam awayTeam startTime sport status odds markets')
      .lean()
      .sort({ startTime: 1 })

    res.json(matches)
  } catch (error) {
    console.error('Get today upcoming matches error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Update match details (score, status)
router.put('/:matchId', adminAuth, async (req, res) => {
  try {
    const { homeScore, awayScore, status } = req.body
    const updateFields = {}

    if (homeScore !== undefined) updateFields.homeScore = homeScore
    if (awayScore !== undefined) updateFields.awayScore = awayScore
    if (status) updateFields.status = status

    const updatedMatch = await Match.findByIdAndUpdate(
      req.params.matchId,
      { $set: updateFields },
      { new: true, runValidators: true }
    )

    if (!updatedMatch) {
      return res.status(404).json({ error: 'Match not found' })
    }

    res.json(updatedMatch)
    bus.emit('matches:update', updatedMatch)
    bus.emit('matches:live:update', updatedMatch)
    bus.emit('matches:changed')

    try {
      if (String(updatedMatch.status).toLowerCase() === 'finished') {
        const eventId = updatedMatch.externalId || updatedMatch._id.toString()
        const homeScore = updatedMatch.homeScore ?? null
        const awayScore = updatedMatch.awayScore ?? null
        if (global.websocketServer && typeof global.websocketServer.broadcastMatchResult === 'function') {
          global.websocketServer.broadcastMatchResult(eventId, {
            homeScore,
            awayScore,
            score: (homeScore != null && awayScore != null) ? `${homeScore}:${awayScore}` : null,
            status: 'finished'
          })
        }
        const betSettlementService = require('../services/betSettlementService')
        const finishMeta = {
          eventId,
          originalId: updatedMatch._id.toString(),
          homeTeam: updatedMatch.homeTeam,
          awayTeam: updatedMatch.awayTeam,
          directResults: {
            homeScore,
            awayScore,
            homeCorners: updatedMatch.predeterminedResult?.homeCorners,
            awayCorners: updatedMatch.predeterminedResult?.awayCorners,
            homeCards: updatedMatch.predeterminedResult?.homeCards,
            awayCards: updatedMatch.predeterminedResult?.awayCards,
            penaltyAwarded: updatedMatch.predeterminedResult?.penaltyAwarded,
            firstGoalscorer: updatedMatch.predeterminedResult?.firstGoalscorer,
            anytimeGoalscorers: updatedMatch.predeterminedResult?.anytimeGoalscorers,
            lastGoalscorer: updatedMatch.predeterminedResult?.lastGoalscorer
          }
        }
        await betSettlementService.settleMatchBets(finishMeta)
      }
    } catch (e) {}
  } catch (error) {
    console.error('Update match error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Update match odds
router.put('/:matchId/odds', adminAuth, async (req, res) => {
  try {
    const { newOdds } = req.body

    if (!newOdds) {
      return res.status(400).json({ error: 'New odds data is required' })
    }

    const updatedMatch = await Match.updateOdds(req.params.matchId, newOdds)

    if (!updatedMatch) {
      return res.status(404).json({ error: 'Match not found' })
    }

    res.json(updatedMatch)
    // Broadcast odds delta via bus and invalidate cached match lists
    bus.emit('odds:update', { matchId: req.params.matchId, delta: newOdds })
    bus.emit('matches:changed')
  } catch (error) {
    console.error('Update match odds error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Delete a match
router.delete('/:matchId', adminAuth, async (req, res) => {
  try {
    const deletedMatch = await Match.findByIdAndDelete(req.params.matchId)

    if (!deletedMatch) {
      return res.status(404).json({ error: 'Match not found' })
    }

    bus.emit('matches:deleted', req.params.matchId)
    bus.emit('matches:changed')
    res.json({ message: 'Match deleted successfully', deletedMatch })
  } catch (error) {
    console.error('Delete match error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Get upcoming matches for today
router.get('/today/upcoming', async (req, res) => {
  try {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date()
    endOfDay.setHours(23, 59, 59, 999)

    const upcomingMatches = await Match.find({
      startTime: { $gte: startOfDay, $lte: endOfDay },
      status: 'upcoming'
    }).sort({ startTime: 1 })

    res.json(upcomingMatches)
  } catch (error) {
    console.error('Get upcoming matches for today error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Get matches for today
router.get('/today', async (req, res) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const matches = await Match.find({
      status: 'upcoming',
      startTime: {
        $gte: today,
        $lt: tomorrow
      }
    })
      .sort({ startTime: 1 })

    res.json(matches)
  } catch (error) {
    console.error('Get today upcoming matches error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Admin: Create a new match
router.post('/', auth, adminAuth, async (req, res) => {
  try {
    const newMatch = new Match(req.body)
    const savedMatch = await newMatch.save()
    res.status(201).json(savedMatch)
  } catch (err) {
    console.error(err)
    res.status(400).json({ message: err.message })
  }
})

// Admin: Update an existing match
router.put('/:matchId', auth, adminAuth, async (req, res) => {
  try {
    const updatedMatch = await Match.findByIdAndUpdate(req.params.matchId, req.body, { new: true })
    if (!updatedMatch) {
      return res.status(404).json({ error: 'Match not found' })
    }
    res.json(updatedMatch)
    bus.emit('matches:update', updatedMatch)
    bus.emit('matches:live:update', updatedMatch)
    bus.emit('matches:changed')
  } catch (error) {
    console.error('Update match error:', error)
    res.status(500).json({ error: 'Server error', details: error.message })
  }
})

// Admin: Delete a match
router.delete('/:matchId', auth, adminAuth, async (req, res) => {
  try {
    const deletedMatch = await Match.findByIdAndDelete(req.params.matchId)
    if (!deletedMatch) {
      return res.status(404).json({ error: 'Match not found' })
    }
    bus.emit('matches:deleted', req.params.matchId)
    bus.emit('matches:changed')
    res.json({ message: 'Match deleted successfully' })
  } catch (error) {
    console.error('Delete match error:', error)
    res.status(500).json({ error: 'Server error', details: error.message })
  }
})

module.exports = router

// Admin media upload fallbacks under /api/matches (in addition to /api/admin endpoints)
router.post('/:matchId/video/upload', adminAuth, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No video file uploaded' })
    const filePath = `/uploads/videos/${req.file.filename}`
    const match = await Match.findByIdAndUpdate(
      req.params.matchId,
      { videoUrl: filePath, updatedAt: new Date(), updatedBy: req.user.id },
      { new: true }
    )
    if (!match) return res.status(404).json({ error: 'Match not found' })
    res.json({ success: true, videoUrl: filePath, match })
  } catch (error) {
    console.error('Upload match video (matches route) error:', error)
    res.status(500).json({ error: 'Failed to upload video' })
  }
})

router.post('/:matchId/poster/upload', adminAuth, upload.single('poster'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No poster image uploaded' })
    const filePath = `/uploads/posters/${req.file.filename}`
    const match = await Match.findByIdAndUpdate(
      req.params.matchId,
      { videoPosterUrl: filePath, updatedAt: new Date(), updatedBy: req.user.id },
      { new: true }
    )
    if (!match) return res.status(404).json({ error: 'Match not found' })
    res.json({ success: true, videoPosterUrl: filePath, match })
  } catch (error) {
    console.error('Upload match poster (matches route) error:', error)
    res.status(500).json({ error: 'Failed to upload poster' })
  }
})

// Generic uploads under /api/matches as a fallback as well
router.post('/uploads/video', adminAuth, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No video file uploaded' })
    const filePath = `/uploads/videos/${req.file.filename}`
    res.json({ success: true, videoUrl: filePath })
  } catch (error) {
    console.error('Generic video upload (matches route) error:', error)
    res.status(500).json({ error: 'Failed to upload video' })
  }
})

router.post('/uploads/poster', adminAuth, upload.single('poster'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No poster image uploaded' })
    const filePath = `/uploads/posters/${req.file.filename}`
    res.json({ success: true, videoPosterUrl: filePath })
  } catch (error) {
    console.error('Generic poster upload (matches route) error:', error)
    res.status(500).json({ error: 'Failed to upload poster' })
  }
})

// Add ObjectId validation
// Remove this line: const mongoose = require('mongoose');

// In your GET /matches/:id route
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    console.log('=== MATCH DETAIL REQUEST ===')
    console.log('Match ID received:', id)

    let match = null

    // First, try to find by MongoDB ObjectId (for admin-created matches)
    if (mongoose.Types.ObjectId.isValid(id)) {
      console.log('Valid ObjectId format, searching in Match collection...')
      match = await Match.findById(id)
        .select('_id homeTeam awayTeam startTime sport status leagueId homeScore awayScore markets odds createdAt updatedAt')
        .lean()

      if (match) {
        console.log('Match found in Match collection')
        return res.json({
          success: true,
          match
        })
      }
    }

    // If not found, try to find by gameId in Odds collection (for API matches)
    console.log('Searching by gameId in Odds collection...')
    const oddsData = await Odds.findOne({ gameId: id })
      .select('gameId home_team away_team commence_time sport_key sport_title bookmakers lastFetched')
      .lean()

    if (oddsData) {
      console.log('Match found in Odds collection')

      // Transform odds data to match format expected by frontend
      const transformedMatch = {
        _id: oddsData.gameId,
        id: oddsData.gameId,
        homeTeam: oddsData.home_team,
        awayTeam: oddsData.away_team,
        sport: oddsData.sport_key,
        league: oddsData.sport_title,
        startTime: oddsData.commence_time,
        status: 'upcoming',
        bookmakers: oddsData.bookmakers,
        markets: {},
        createdAt: oddsData.lastFetched,
        updatedAt: oddsData.lastFetched
      }

      // Process bookmakers to create markets structure for additional markets
      if (oddsData.bookmakers && oddsData.bookmakers.length > 0) {
        const markets = []
        const processedMarkets = new Set()

        const normalizeMarketKey = (key) => {
          const k = (key || '').toLowerCase()
          const noLay = k.replace(/_?lay$/i, '').replace(/\blay\b/gi, '').replace(/\s+/g, ' ').trim().replace(/\s/g, '_')
          if (noLay === 'h2h' || noLay === 'moneyline') return 'h2h'
          if (noLay === 'spreads' || noLay === 'handicap' || noLay === 'asian_handicap' || noLay === 'point_spread') return 'spreads'
          if (noLay === 'totals' || noLay === 'over_under' || noLay === 'points_total') return 'totals'
          if (noLay === 'double_chance') return 'double_chance'
          if (noLay === 'draw_no_bet') return 'draw_no_bet'
          if (noLay === 'both_teams_to_score' || noLay === 'btts') return 'both_teams_to_score'
          return noLay
        }

        const normalizeTitleAndDescription = (key) => {
          let title = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
          let description = `Betting market for ${key.replace(/_/g, ' ')}`
          if (key === 'h2h') {
            title = 'H2H'
            description = 'Head to Head - Pick the winner of the match'
          } else if (key === 'totals') {
            title = 'Total Goals'
            description = 'Over/Under total goals in the match'
          } else if (key === 'spreads') {
            title = 'Point Spread'
            description = 'Handicap betting with point spread'
          }
          return { title, description }
        }

        oddsData.bookmakers.forEach(bookmaker => {
          (bookmaker.markets || []).forEach(market => {
            const normalizedKey = normalizeMarketKey(market.key || '')
            if (processedMarkets.has(normalizedKey)) return
            processedMarkets.add(normalizedKey)

            const { title: marketTitle, description: marketDescription } = normalizeTitleAndDescription(normalizedKey)

            markets.push({
              key: normalizedKey,
              title: marketTitle,
              description: marketDescription,
              outcomes: (market.outcomes || []).map(outcome => ({
                name: outcome.name,
                price: outcome.price,
                point: outcome.point || null
              }))
            })
          })
        })

        transformedMatch.markets = markets
      }

      return res.json({
        success: true,
        match: transformedMatch
      })
    }

    // Not found in either collection
    return res.status(404).json({
      success: false,
      message: 'Match not found'
    })
  } catch (error) {
    console.error('Error fetching match:', error)
    res.status(500).json({
      success: false,
      message: 'Server error'
    })
  }
})

// Temporary route to list available matches (remove after debugging)
router.get('/debug/list', auth, async (req, res) => {
  try {
    const matches = await Match.find({}).limit(10).select('_id homeTeam awayTeam sport odds')
    console.log('Available matches:', matches.map(m => ({
      id: m._id,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      sport: m.sport,
      hasOdds: !!m.odds
    })))
    res.json(matches)
  } catch (error) {
    console.error('Debug list error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /matches/sport/:sportKey - Get matches for specific sport key
router.get('/sport/:sportKey', async (req, res) => {
  try {
    const { sportKey } = req.params
    let matches = []

    // Try database first - check both Match and Odds collections
    if (mongoose.connection.readyState === 1) {
      // Get matches from both collections
      const [adminMatches, oddsData] = await Promise.all([
        Match.find({ sport: sportKey })
          .select('_id homeTeam awayTeam startTime sport status odds markets')
          .lean()
          .sort({ startTime: 1 }),
        Odds.find({ sport_key: sportKey })
          .select('gameId home_team away_team commence_time sport_key sport_title bookmakers')
          .lean()
          .limit(50)
      ])

      // Transform odds data into match format
      const transformedOddsData = oddsData.map(odds => {
        const firstBookmaker = odds.bookmakers[0]
        if (!firstBookmaker) return null

        const markets = {}
        let additionalMarketsCount = 0

        firstBookmaker.markets.forEach(market => {
          if (market.key === 'h2h') {
            market.outcomes.forEach(outcome => {
              if (outcome.name === odds.home_team) markets['1'] = outcome.price
              else if (outcome.name === odds.away_team) markets['2'] = outcome.price
              else if (outcome.name === 'Draw') markets.X = outcome.price
            })
          } else {
            additionalMarketsCount++
          }
        })

        return {
          id: odds.id,
          homeTeam: odds.home_team,
          awayTeam: odds.away_team,
          startTime: odds.commence_time,
          sport: odds.sport_key,
          status: 'upcoming',
          odds: markets,
          additionalMarkets: additionalMarketsCount,
          market: firstBookmaker.markets[0]?.key || 'Unknown',
          bookmaker: firstBookmaker.title
        }
      }).filter(match => match !== null)

      // Combine and format admin matches
      const formattedAdminMatches = adminMatches.map(match => ({
        id: match._id,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        startTime: match.startTime,
        sport: match.sport,
        status: match.status,
        odds: match.odds,
        additionalMarkets: match.markets?.length || 0,
        market: 'admin',
        bookmaker: 'Admin'
      }))

      // Combine both sources
      matches = [...formattedAdminMatches, ...transformedOddsData]
    }

    res.json({
      success: true,
      matches,
      total: matches.length,
      sport: sportKey
    })
  } catch (error) {
    console.error(`Error fetching matches for sport ${req.params.sportKey}:`, error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sport matches',
      message: error.message
    })
  }
})

// Get live matches with real-time odds
router.get('/live/real-time', async (req, res) => {
  try {
    const cached = cacheGet('/api/matches/live/real-time', {})
    if (cached) {
      const etag = computeEtag(cached)
      res.set('X-Cache', 'HIT')
      res.set('Cache-Control', 'public, max-age=5, stale-while-revalidate=60')
      if (etag) res.set('ETag', etag)
      if (etag && req.headers['if-none-match'] === etag) {
        return res.status(304).end()
      }
      return res.json(cached)
    }

    const originalJson = res.json.bind(res)
    res.json = (data) => {
      try {
        const large = Array.isArray(data) ? data.length > 1200 : false
        if (large) {
          res.set('X-Cache', 'SKIP')
          return originalJson(data)
        }
        // Cache for 5 seconds for live data to ensure fast updates
        cacheSet('/api/matches/live/real-time', {}, data, 5)
        res.set('X-Cache', 'MISS')
        res.set('Cache-Control', 'public, max-age=5, stale-while-revalidate=10')
        const etag = computeEtag(data)
        if (etag) res.set('ETag', etag)
      } catch (e) {}
      return originalJson(data)
    }

    console.log('[LIVE MATCHES] Fetching real-time live matches...')

    // Get live matches from database
    const liveMatches = await Match.find({ status: 'live' })
      .select('_id homeTeam awayTeam startTime sport leagueId homeScore awayScore odds markets')
      .lean()
      .sort({ startTime: 1 })

    console.log(`[LIVE MATCHES] Found ${liveMatches.length} live matches in database`)

    // Get live odds data from API
    const liveOddsData = await Odds.find({
      commence_time: { $lte: new Date() }
    })
      .select('gameId home_team away_team commence_time sport_key sport_title bookmakers')
      .lean()
      .sort({ commence_time: -1 })
      .limit(500)

    console.log(`[LIVE MATCHES] Found ${liveOddsData.length} live odds records`)

    // Build league metadata for country and sport display
    const leagueMetaMap = await buildLeagueMetaMap()

    // Transform matches to include live data and real-time odds
    const updates = []
    const transformedLiveMatches = liveMatches.map(match => {
      const matchObj = match

      // Find corresponding odds from API
      const matchOdds = liveOddsData.find(odds =>
        odds.home_team === match.homeTeam &&
        odds.away_team === match.awayTeam
      )

      let oddsStructure = {}
      let additionalMarketsCount = 0

      if (matchOdds && matchOdds.bookmakers && matchOdds.bookmakers.length > 0) {
        const firstBookmaker = matchOdds.bookmakers[0]
        oddsStructure = {
          default: {
            bookmaker: firstBookmaker.title,
            odds: {}
          }
        }

        firstBookmaker.markets.forEach(market => {
          if (market.key === 'h2h') {
            market.outcomes.forEach(outcome => {
              if (outcome.name === matchObj.homeTeam) oddsStructure.default.odds['1'] = outcome.price
              else if (outcome.name === matchObj.awayTeam) oddsStructure.default.odds['2'] = outcome.price
              else if (outcome.name === 'Draw') oddsStructure.default.odds.X = outcome.price
            })
          } else {
            additionalMarketsCount++
          }
        })
      }

      // Calculate live time
      const now = new Date()
      const start = new Date(matchObj.startTime)
      const diffMs = now - start
      const diffMins = Math.floor(diffMs / (1000 * 60))

      const s = String(matchObj.sport || '').toLowerCase()
      let maxWindow = 180
      if (s.includes('soccer') || s.includes('football')) maxWindow = 115
      else if (s.includes('basketball') || s.includes('nba')) maxWindow = 150
      else if (s.includes('tennis')) maxWindow = 180
      else if (s.includes('hockey') || s.includes('nhl')) maxWindow = 150
      else if (s.includes('baseball') || s.includes('mlb')) maxWindow = 180

      const statusComputed = (diffMins >= 0 && diffMins <= maxWindow) ? 'live' : 'finished'
      if (statusComputed === 'finished' && matchObj.status !== 'finished') {
        updates.push({
          id: matchObj._id,
          payload: { status: 'finished', finishedAt: now }
        })
      }

      let liveTime
      if (statusComputed === 'live') {
        if (s.includes('soccer') || s.includes('football')) {
          if (diffMins <= 45) {
            liveTime = `${diffMins}'`
          } else if (diffMins <= 50) {
            liveTime = '45+'
          } else if (diffMins <= 65) {
            liveTime = 'HT'
          } else if (diffMins <= 105) {
            liveTime = `${diffMins - 15}'`
          } else {
            const stoppage = Math.min(diffMins - 105, 10)
            liveTime = `90+${stoppage}`
          }
        } else {
          liveTime = `LIVE ${diffMins}'`
        }
      }

      // Compute league name, country, and full league title
      const leagueName = (matchObj.leagueId && matchObj.leagueId.name)
        ? matchObj.leagueId.name
        : (matchOdds && matchOdds.sport_title ? matchOdds.sport_title : 'Match')
      const meta = leagueName ? leagueMetaMap.get(String(leagueName).toLowerCase()) : null
      const country = meta?.country || ''
      const sportDisplay = meta?.sportName || matchObj.sport
      const fullLeagueTitle = computeFullLeagueTitle({
        sportKeyOrName: sportDisplay,
        country,
        leagueName
      })

      return {
        id: matchObj._id,
        source: 'db',
        league: leagueName,
        subcategory: matchObj.sport || 'Live',
        startTime: matchObj.startTime,
        homeTeam: matchObj.homeTeam,
        awayTeam: matchObj.awayTeam,
        homeTeamFlag: '🏳️',
        awayTeamFlag: '🏳️',
        odds: oddsStructure.default?.odds || matchObj.odds || {},
        additionalMarkets: additionalMarketsCount + (matchObj.markets || []).length,
        sport: normalizeSportToken({ sportDisplay, leagueName, sportKeyOrName: matchObj.sport }),
        allMarkets: matchObj.markets || [],
        status: statusComputed,
        isLive: statusComputed === 'live',
        liveTime,
        score: matchObj.homeScore !== null && matchObj.awayScore !== null
          ? `${matchObj.homeScore}-${matchObj.awayScore}`
          : null,
        homeScore: matchObj.homeScore,
        awayScore: matchObj.awayScore,
        lastUpdate: new Date().toISOString(),
        country,
        fullLeagueTitle
      }
    })

    // Persist status corrections (fire-and-forget)
    try {
      await Promise.all(updates.map(u => Match.updateOne({ _id: u.id }, { $set: u.payload })))
      if (updates.length > 0) bus.emit('matches:changed')
    } catch (_) {}

    console.log(`[LIVE MATCHES] Returning ${transformedLiveMatches.length} transformed live matches`)

    const liveOnly = transformedLiveMatches.filter(m => m.status === 'live')
    res.json({
      success: true,
      matches: liveOnly,
      total: liveOnly.length,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[LIVE MATCHES] Error fetching live matches:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch live matches',
      message: error.message
    })
  }
})

// Update live match odds (for admin use)
router.put('/live/:matchId/odds', adminAuth, async (req, res) => {
  try {
    const { newOdds } = req.body
    const { matchId } = req.params

    if (!newOdds) {
      return res.status(400).json({ error: 'New odds data is required' })
    }

    const updatedMatch = await Match.updateOdds(matchId, newOdds)

    if (!updatedMatch) {
      return res.status(404).json({ error: 'Match not found' })
    }

    // Broadcast odds update via Socket.io + bus and invalidate caches
    bus.emit('odds:update', { matchId, delta: newOdds })
    bus.emit('matches:changed')

    res.json({
      success: true,
      match: updatedMatch,
      message: 'Live odds updated successfully'
    })
  } catch (error) {
    console.error('Error updating live match odds:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Update live match score (for admin use)
router.put('/live/:matchId/score', adminAuth, async (req, res) => {
  try {
    const { homeScore, awayScore } = req.body
    const { matchId } = req.params

    const updateFields = {}
    if (homeScore !== undefined) updateFields.homeScore = homeScore
    if (awayScore !== undefined) updateFields.awayScore = awayScore

    const updatedMatch = await Match.findByIdAndUpdate(
      matchId,
      { $set: updateFields },
      { new: true, runValidators: true }
    )

    if (!updatedMatch) {
      return res.status(404).json({ error: 'Match not found' })
    }

    // Broadcast score update via Socket.io + bus and invalidate caches
    bus.emit('matches:update', updatedMatch)
    bus.emit('matches:live:update', updatedMatch)
    bus.emit('matches:changed')

    res.json({
      success: true,
      match: updatedMatch,
      message: 'Live score updated successfully'
    })
  } catch (error) {
    console.error('Error updating live match score:', error)
    res.status(500).json({ error: 'Server error' })
  }
})
