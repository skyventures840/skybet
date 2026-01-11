const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')
const Bet = require('../models/Bet')
const User = require('../models/User')
const Match = require('../models/Match')
const { auth } = require('../middleware/auth')
const { body, validationResult } = require('express-validator')
const Odds = require('../models/Odds')
const Results = require('../models/Results')
const Scores = require('../models/Scores')
const { cache, keyFor, bus } = require('../utils/cache')
const { OddsApiService } = require('../services/oddsApiService')

// Initialize OddsApiService
const oddsApiService = new OddsApiService()

// Helper to trigger match update
const triggerMatchUpdate = async (matchId) => {
  try {
    // Find sport key
    const odd = await Odds.findOne({ gameId: matchId }).select('sport_key').lean()
    if (odd && odd.sport_key) {
      // Fire and forget - don't await to avoid blocking response
      // Use daysFrom=3 to cover recent matches
      oddsApiService.getScores(odd.sport_key, 3, [matchId])
        .then(scores => {
          if (scores && scores.length > 0) {
            console.log(`Triggered update for match ${matchId}, fetched ${scores.length} scores`)
          }
        })
        .catch(err => console.error(`Error triggering match update for ${matchId}:`, err.message))
    }
  } catch (error) {
    console.error('Error in triggerMatchUpdate:', error)
  }
}

// Performance optimization: Create indexes for frequently queried fields
const ensureIndexes = async () => {
  try {
    await Bet.collection.createIndex({ userId: 1, createdAt: -1 })
    await Bet.collection.createIndex({ status: 1, createdAt: -1 })
    await Bet.collection.createIndex({ 'bets.matchId': 1 })
    await Match.collection.createIndex({ startTime: 1, status: 1 })
    await Odds.collection.createIndex({ matchId: 1, type: 1 })
  } catch (error) {
    console.warn('Index creation warning:', error.message)
  }
}

// Initialize indexes
ensureIndexes()

// Cache middleware for user-specific bet queries
const cacheUserBets = (ttl = 60) => {
  return async (req, res, next) => {
    const cacheKey = keyFor('/api/bets/my-bets', {
      userId: req.user.id,
      page: req.query.page || 1,
      limit: req.query.limit || 20,
      status: req.query.status || 'all'
    })

    try {
      const cached = cache.get(cacheKey)
      if (cached) {
        res.set('X-Cache', 'HIT')
        return res.json(cached)
      }

      res.set('X-Cache', 'MISS')
      res.locals.cacheKey = cacheKey
      res.locals.cacheTTL = ttl
      next()
    } catch (error) {
      console.error('Cache middleware error:', error)
      next()
    }
  }
}

// Dedicated cache middleware for user bet statistics
const cacheUserBetStats = (ttl = 300) => {
  return async (req, res, next) => {
    const cacheKey = keyFor('user_bet_stats', {
      userId: req.user.id,
      excludeMarket: req.query.excludeMarket
    })

    try {
      const cached = cache.get(cacheKey)
      if (cached) {
        res.set('X-Cache', 'HIT')
        return res.json(cached)
      }

      res.set('X-Cache', 'MISS')
      res.locals.cacheKey = cacheKey
      res.locals.cacheTTL = ttl
      next()
    } catch (error) {
      console.error('Stats cache middleware error:', error)
      next()
    }
  }
}

// Enhanced match data with real team names
const enhancedMatchData = {
  'manchester-united-liverpool-2024': {
    homeTeam: 'Manchester United',
    awayTeam: 'Liverpool',
    competition: 'Premier League'
  },
  'arsenal-chelsea-2024': {
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    competition: 'Premier League'
  },
  'barcelona-real-madrid-2024': {
    homeTeam: 'Barcelona',
    awayTeam: 'Real Madrid',
    competition: 'La Liga'
  },
  'bayern-munich-dortmund-2024': {
    homeTeam: 'Bayern Munich',
    awayTeam: 'Borussia Dortmund',
    competition: 'Bundesliga'
  },
  'psg-marseille-2024': {
    homeTeam: 'Paris Saint-Germain',
    awayTeam: 'Marseille',
    competition: 'Ligue 1'
  },
  'ac-milan-inter-milan-2024': {
    homeTeam: 'AC Milan',
    awayTeam: 'Inter Milan',
    competition: 'Serie A'
  },
  'ajax-feyenoord-2024': {
    homeTeam: 'Ajax',
    awayTeam: 'Feyenoord',
    competition: 'Eredivisie'
  },
  'porto-benfica-2024': {
    homeTeam: 'Porto',
    awayTeam: 'Benfica',
    competition: 'Primeira Liga'
  },
  'celtic-rangers-2024': {
    homeTeam: 'Celtic',
    awayTeam: 'Rangers',
    competition: 'Scottish Premiership'
  },
  'galatasaray-fenerbahce-2024': {
    homeTeam: 'Galatasaray',
    awayTeam: 'Fenerbahce',
    competition: 'Super Lig'
  },
  'olympiacos-panathinaikos-2024': {
    homeTeam: 'Olympiacos',
    awayTeam: 'Panathinaikos',
    competition: 'Super League Greece'
  },
  'test-real-match-verification': {
    homeTeam: 'Liverpool',
    awayTeam: 'Manchester United',
    competition: 'Premier League'
  },
  // Add existing match IDs from bet history
  'manchester-united-city-real': {
    homeTeam: 'Manchester United',
    awayTeam: 'Manchester City',
    competition: 'Premier League'
  },
  'arsenal-chelsea-match-real': {
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    competition: 'Premier League'
  },
  f37021de21572159764157dbf2e5ae62: {
    homeTeam: 'Bayern Munich',
    awayTeam: 'Borussia Dortmund',
    competition: 'Bundesliga'
  },
  'test-match-manchester-united-real': {
    homeTeam: 'Manchester United',
    awayTeam: 'Liverpool',
    competition: 'Premier League'
  },
  'test-match-arsenal-chelsea-real': {
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    competition: 'Premier League'
  },
  'test-match-manchester-united-liverpool': {
    homeTeam: 'Manchester United',
    awayTeam: 'Liverpool',
    competition: 'Premier League'
  }
}

// Helper functions to get match information
function getHomeTeam (matchId, market, selection) {
  const matchData = enhancedMatchData[matchId]
  if (matchData) {
    return matchData.homeTeam
  }

  // Fallback logic for unknown matches
  if (market.includes('Winner')) {
    if (selection === 'Home Team' || selection === matchData?.homeTeam) {
      return selection
    }
    return 'Unknown'
  }
  return 'Unknown'
}

function getAwayTeam (matchId, market, selection) {
  const matchData = enhancedMatchData[matchId]
  if (matchData) {
    return matchData.awayTeam
  }

  // Fallback logic for unknown matches
  if (market.includes('Winner')) {
    if (selection === 'Away Team' || selection === matchData?.awayTeam) {
      return selection
    }
    return 'Unknown'
  }
  return 'Unknown'
}

function getCompetition (matchId) {
  const matchData = enhancedMatchData[matchId]
  return matchData ? matchData.competition : 'Soccer'
}

// Place a new bet
router.post('/', auth, [
  body('matchId').notEmpty().trim(), // Remove isMongoId() validation for now
  body('market').notEmpty().trim(),
  body('selection').notEmpty().trim(),
  body('stake').isFloat({ min: 0.01 }),
  body('odds').isFloat({ min: 1.00 })
], async (req, res) => {
  try {
    console.log('=== Bet submission request ===')
    console.log('Request body:', req.body)
    console.log('User ID from token:', req.user.id)

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array())
      return res.status(400).json({ errors: errors.array() })
    }

    const { matchId, market, selection, stake, odds } = req.body
    const userId = req.user.id

    console.log('Processing bet with data:', { matchId, market, selection, stake, odds, userId })

    // Validate user and debit stake using bonus-first logic
    // Optimized: debitForBet handles user lookup and balance validation atomically
    console.log('Validating user and debiting balance...')
    let debit
    try {
      debit = await User.debitForBet(userId, stake)
    } catch (e) {
      console.log('Insufficient balance or debit error:', e.message)
      if (e.message.includes('User not found')) {
        return res.status(404).json({ error: 'User not found' })
      }
      return res.status(400).json({ error: 'Insufficient balance' })
    }

    // Create bet - store matchId as string since it's from external API
    // Resolve basic match info; for parlay, use synthetic labels
    let homeTeam = null; let awayTeam = null; let league = null
    const isParlay = String(market).toLowerCase() === 'parlay'
    if (isParlay) {
      const legs = typeof selection === 'string' && selection.length > 0
        ? selection.split(';').length
        : 0
      homeTeam = 'Parlay'
      awayTeam = legs > 0 ? `${legs} selections` : 'Multiple selections'
      league = 'Parlay'
    } else {
      // 1. Try to find in Odds (external API)
      const oddsDoc = await Odds.findOne({ gameId: matchId }).lean()
      if (oddsDoc) {
        // Validate start time for Odds API matches
        if (new Date() >= new Date(oddsDoc.commence_time)) {
          return res.status(400).json({ error: 'Match has already started' })
        }
        homeTeam = oddsDoc.home_team
        awayTeam = oddsDoc.away_team
        league = oddsDoc.sport_title
      } else if (mongoose.Types.ObjectId.isValid(matchId)) {
        // 2. Try to find in Match (Admin created)
        const matchDoc = await Match.findById(matchId).populate('leagueId').lean()
        if (matchDoc) {
          // Validate start time for Admin matches
          if (new Date() >= new Date(matchDoc.startTime)) {
            return res.status(400).json({ error: 'Match has already started' })
          }
          if (matchDoc.status !== 'upcoming' && matchDoc.status !== 'live') {
            return res.status(400).json({ error: 'Betting is closed for this match' })
          }

          homeTeam = matchDoc.homeTeam
          awayTeam = matchDoc.awayTeam
          league = matchDoc.leagueId ? matchDoc.leagueId.name : 'Unknown League'
        }
      }

      // 3. Fallback to enhancedMatchData
      if (!homeTeam && enhancedMatchData[matchId]) {
        homeTeam = enhancedMatchData[matchId].homeTeam
        awayTeam = enhancedMatchData[matchId].awayTeam
        league = enhancedMatchData[matchId].competition
      }
    }
    const betData = {
      userId,
      matchId: matchId.toString(),
      homeTeam,
      awayTeam,
      league,
      market,
      selection,
      stake,
      odds,
      potentialWin: stake * odds,
      bonusStakeUsed: debit.bonusUsed,
      realStakeUsed: debit.realUsed
    }

    // Add matches array for multibets/parlays
    if (isParlay && req.body.matches && Array.isArray(req.body.matches)) {
      betData.matches = req.body.matches.map(match => ({
        matchId: match.matchId,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        selection: match.selection,
        odds: match.odds,
        status: 'pending',
        outcome: null,
        startTime: match.startTime ? new Date(match.startTime) : new Date()
      }))
    }

    const bet = new Bet(betData)

    // console.log('Saving bet to database...');
    await bet.save()
    // console.log(`Bet saved successfully: ${bet._id} (took ${Date.now() - startTime}ms)`);

    // Trigger match update (Fire and forget)
    triggerMatchUpdate(matchId.toString())

    // Invalidate caches
    bus.emit('bets:changed')
    bus.emit('users:changed')

    // Balance already debited via debitForBet

    // Broadcast new bet via WebSocket (Non-blocking / Fire-and-forget)
    if (global.websocketServer) {
      setImmediate(() => {
        try {
          // Construct payload manually to avoid extra DB query (req.user is already populated by auth middleware)
          const payload = {
            bet: {
              ...bet.toObject(),
              userId: {
                _id: req.user._id,
                username: req.user.username,
                email: req.user.email
              }
            },
            betId: bet._id.toString(),
            userId: userId.toString()
          }

          global.websocketServer.broadcastToAll({
            type: 'new_bet',
            payload
          })
        } catch (wsErr) {
          console.error('WS Broadcast error:', wsErr)
        }
      })
    }

    res.status(201).json({
      id: bet._id,
      bet: {
        id: bet._id,
        match: isParlay ? `Parlay bet (${selection})` : `${market} bet on ${selection}`,
        market: bet.market,
        selection: bet.selection,
        stake: bet.stake,
        odds: bet.odds,
        potentialWin: bet.potentialWin,
        status: bet.status,
        createdAt: bet.createdAt
      }
    })
  } catch (error) {
    console.error('=== Place bet error ===')
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    console.error('Error name:', error.name)

    // Check for specific MongoDB errors
    if (error.name === 'ValidationError') {
      console.error('MongoDB validation error:', error.errors)
      return res.status(400).json({ error: 'Validation error', details: error.errors })
    }

    if (error.name === 'CastError') {
      console.error('MongoDB cast error:', error.message)
      return res.status(400).json({ error: 'Invalid data format' })
    }

    if (error.code === 11000) {
      console.error('MongoDB duplicate key error')
      return res.status(400).json({ error: 'Duplicate entry' })
    }

    res.status(500).json({ error: 'Server error', details: error.message })
  }
})

// Place multiple bets (Bulk)
router.post('/bulk', auth, [
  body('bets').isArray({ min: 1 }).withMessage('Bets must be a non-empty array'),
  body('bets.*.matchId').notEmpty(),
  body('bets.*.market').notEmpty(),
  body('bets.*.selection').notEmpty(),
  body('bets.*.stake').isFloat({ min: 0.01 }),
  body('bets.*.odds').isFloat({ min: 1.00 })
], async (req, res) => {
  try {
    console.log('=== Bulk bet submission request ===')
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { bets } = req.body
    const userId = req.user.id

    // Calculate total stake
    const totalStake = bets.reduce((sum, bet) => sum + parseFloat(bet.stake), 0)
    console.log(`Processing ${bets.length} bets with total stake: ${totalStake}`)

    // Validate user and debit total stake
    let debit
    try {
      debit = await User.debitForBet(userId, totalStake)
    } catch (e) {
      console.log('Insufficient balance or debit error:', e.message)
      if (e.message.includes('User not found')) {
        return res.status(404).json({ error: 'User not found' })
      }
      return res.status(400).json({ error: 'Insufficient balance' })
    }

    // Calculate bonus/real ratio
    const bonusRatio = totalStake > 0 ? debit.bonusUsed / totalStake : 0

    const savedBets = []

    // Create bets
    try {
      for (const betItem of bets) {
        const { matchId, market, selection, stake, odds } = betItem
        const betStake = parseFloat(stake)

        // Distribute bonus/real usage proportionally
        const betBonusUsed = betStake * bonusRatio
        const betRealUsed = betStake - betBonusUsed

        // Resolve match info
        let homeTeam = null; let awayTeam = null; let league = null
        const oddsDoc = await Odds.findOne({ gameId: matchId }).lean()
        if (oddsDoc) {
          homeTeam = oddsDoc.home_team
          awayTeam = oddsDoc.away_team
          league = oddsDoc.sport_title
        } else if (enhancedMatchData[matchId]) {
          homeTeam = enhancedMatchData[matchId].homeTeam
          awayTeam = enhancedMatchData[matchId].awayTeam
          league = enhancedMatchData[matchId].competition
        }

        const betData = {
          userId,
          matchId: matchId.toString(),
          homeTeam,
          awayTeam,
          league,
          market,
          selection,
          stake: betStake,
          odds,
          potentialWin: betStake * odds,
          bonusStakeUsed: betBonusUsed,
          realStakeUsed: betRealUsed,
          status: 'pending'
        }

        const bet = new Bet(betData)
        await bet.save()
        savedBets.push(bet)

        // Broadcast via WS (Non-blocking)
        if (global.websocketServer) {
          setImmediate(() => {
            try {
              const payload = {
                bet: {
                  ...bet.toObject(),
                  userId: {
                    _id: req.user._id,
                    username: req.user.username,
                    email: req.user.email
                  }
                },
                betId: bet._id.toString(),
                userId: userId.toString()
              }

              global.websocketServer.broadcastToAll({
                type: 'new_bet',
                payload
              })
            } catch (wsErr) {
              console.error('WS Broadcast error (bulk):', wsErr)
            }
          })
        }
      }

      // Trigger match updates
      // Use Set to avoid duplicate triggers for same match
      const matchIdsToUpdate = [...new Set(savedBets.map(b => b.matchId))]
      matchIdsToUpdate.forEach(id => triggerMatchUpdate(id))

      // Invalidate caches
      bus.emit('bets:changed')
      bus.emit('users:changed')

      // console.log(`Successfully placed ${savedBets.length} bets`);

      res.status(201).json({
        success: true,
        count: savedBets.length,
        bets: savedBets.map(b => ({
          id: b._id,
          match: `${b.market} bet on ${b.selection}`,
          stake: b.stake,
          potentialWin: b.potentialWin
        }))
      })
    } catch (saveError) {
      console.error('Bulk save error, initiating refund:', saveError)

      // Refund total stake
      // Note: User.refundBet currently refunds to main balance regardless of split.
      // This is a known limitation but prevents funds loss.
      try {
        await User.refundBet(userId, totalStake)
      } catch (refundError) {
        console.error('CRITICAL: Failed to refund user after bet failure:', refundError)
        // This is a severe error requiring manual intervention
      }

      // Delete any bets that were saved in this batch
      if (savedBets.length > 0) {
        try {
          const savedIds = savedBets.map(b => b._id)
          await Bet.deleteMany({ _id: { $in: savedIds } })
        } catch (cleanupError) {
          console.error('Failed to cleanup partial bets:', cleanupError)
        }
      }

      throw saveError
    }
  } catch (error) {
    console.error('=== Bulk place bet error ===', error)
    res.status(500).json({ error: 'Server error', details: error.message })
  }
})

// Get user's bets
router.get('/my-bets', auth, cacheUserBets(60), [
  body('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer.'),
  body('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be an integer between 1 and 100.'),
  body('status').optional().isIn(['pending', 'won', 'lost', 'void']).withMessage('Invalid bet status.')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const status = req.query.status // pending, won, lost, void
    const market = req.query.market
    const excludeMarket = req.query.excludeMarket

    const query = { userId: req.user.id }
    if (status) {
      query.status = status
    }
    if (market) {
      query.market = market
    }
    if (excludeMarket) {
      query.market = { $ne: excludeMarket }
    }

    // Use Promise.all for parallel execution and lean() for better performance
    const [bets, total] = await Promise.all([
      Bet.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Bet.countDocuments(query)
    ])

    const formattedBets = await Promise.all(bets.map(async (bet) => {
      // Prefer actual teams/league from bet document, fallback to enhancedMatchData
      const matchInfo = {
        id: bet.matchId,
        homeTeam: bet.homeTeam || getHomeTeam(bet.matchId, bet.market, bet.selection),
        awayTeam: bet.awayTeam || getAwayTeam(bet.matchId, bet.market, bet.selection),
        competition: bet.league || getCompetition(bet.matchId),
        startTime: bet.createdAt,
        status: bet.status === 'pending' ? 'upcoming' : 'finished'
      }
      // Resolve Unknown team names from authoritative sources (Match or Odds)
      try {
        const isUnknown = (t) => !t || String(t).trim().toLowerCase() === 'unknown'
        if (isUnknown(matchInfo.homeTeam) || isUnknown(matchInfo.awayTeam)) {
          if (mongoose.Types.ObjectId.isValid(bet.matchId)) {
            const matchDoc = await Match.findById(bet.matchId).populate('leagueId', 'name').lean()
            if (matchDoc) {
              if (isUnknown(matchInfo.homeTeam) && matchDoc.homeTeam) matchInfo.homeTeam = matchDoc.homeTeam
              if (isUnknown(matchInfo.awayTeam) && matchDoc.awayTeam) matchInfo.awayTeam = matchDoc.awayTeam
              if (!matchInfo.competition && (matchDoc.league || matchDoc.leagueId?.name)) {
                matchInfo.competition = matchDoc.league || matchDoc.leagueId?.name
              }
            }
          } else {
            const oddsDoc = await Odds.findOne({ gameId: bet.matchId }).lean()
            if (oddsDoc) {
              if (isUnknown(matchInfo.homeTeam) && oddsDoc.home_team) matchInfo.homeTeam = oddsDoc.home_team
              if (isUnknown(matchInfo.awayTeam) && oddsDoc.away_team) matchInfo.awayTeam = oddsDoc.away_team
              if (!matchInfo.competition && oddsDoc.sport_title) {
                matchInfo.competition = oddsDoc.sport_title
              }
            }
          }
        }
      } catch (resolveErr) {}

      // Create detailed odds information
      const oddsInfo = {
        selected: bet.odds,
        potentialWin: bet.potentialWin,
        actualWin: bet.actualWin || 0,
        stake: bet.stake
      }

      // Create result information (include FT data when available) - populated after score resolution below
      // Build matches array and inject FT results if available
      let matches = Array.isArray(bet.matches) ? bet.matches.map(m => ({ ...m })) : []
      if (matches.length === 0) {
        matches = [{
          matchId: bet.matchId,
          homeTeam: matchInfo.homeTeam,
          awayTeam: matchInfo.awayTeam,
          selection: bet.selection,
          odds: bet.odds,
          status: bet.status,
          outcome: null,
          startTime: bet.createdAt
        }]
      }

      // Lookup completed results for this bet's main match
      let homeScore = null; let awayScore = null; let finalOutcome = null

      // First check if result is stored in the bet document itself
      if (bet.result && (bet.result.homeScore != null || bet.result.awayScore != null)) {
        homeScore = bet.result.homeScore
        awayScore = bet.result.awayScore
        finalOutcome = bet.result.finalOutcome
      } else {
        // Fallback to Results collection lookup
        try {
          const resDoc = await Results.findOne({ eventId: bet.matchId, completed: true }).lean()
          if (resDoc && Array.isArray(resDoc.scores)) {
            const hs = resDoc.scores.find(s => s.name === matchInfo.homeTeam) || resDoc.scores[0]
            const as = resDoc.scores.find(s => s.name === matchInfo.awayTeam) || resDoc.scores[1]
            homeScore = hs && hs.score != null && hs.score !== '' ? parseInt(hs.score) : null
            awayScore = as && as.score != null && as.score !== '' ? parseInt(as.score) : null
            if (homeScore != null && awayScore != null) {
              finalOutcome = homeScore > awayScore ? '1' : homeScore < awayScore ? '2' : 'X'
            }
          }
          if (homeScore == null || awayScore == null) {
            let matchDoc = null
            if (mongoose.isValidObjectId(bet.matchId)) {
              matchDoc = await Match.findById(bet.matchId).lean()
            }
            if (!matchDoc) {
              matchDoc = await Match.findOne({ externalId: bet.matchId }).lean()
            }
            if (matchDoc) {
              const pr = matchDoc.predeterminedResult || {}
              const hsDB = pr.homeScore != null ? pr.homeScore : matchDoc.homeScore
              const asDB = pr.awayScore != null ? pr.awayScore : matchDoc.awayScore
              if (hsDB != null && asDB != null) {
                homeScore = Number(hsDB)
                awayScore = Number(asDB)
                finalOutcome = homeScore > awayScore ? '1' : homeScore < awayScore ? '2' : 'X'
              }
            }
          }
        } catch (e) {}
        // Final fallback to Scores collection
        if (homeScore == null || awayScore == null) {
          try {
            const scoreDoc = await Scores.findOne({ eventId: bet.matchId, completed: true }).lean()
            if (scoreDoc && Array.isArray(scoreDoc.scores)) {
              const hs = scoreDoc.scores.find(s => s.name === matchInfo.homeTeam) || scoreDoc.scores[0]
              const as = scoreDoc.scores.find(s => s.name === matchInfo.awayTeam) || scoreDoc.scores[1]
              homeScore = hs && hs.score != null && hs.score !== '' ? parseInt(hs.score) : homeScore
              awayScore = as && as.score != null && as.score !== '' ? parseInt(as.score) : awayScore
              if (homeScore != null && awayScore != null) {
                finalOutcome = homeScore > awayScore ? '1' : homeScore < awayScore ? '2' : 'X'
              } else {
                // Attempt targeted fetch then re-query
                try {
                  const odd = await Odds.findOne({ gameId: bet.matchId }).select('sport_key').lean()
                  if (odd && odd.sport_key && oddsApiService && oddsApiService.isEnabled) {
                    await oddsApiService.getScores(odd.sport_key, 7, [bet.matchId])
                    const scoreDoc2 = await Scores.findOne({ eventId: bet.matchId, completed: true }).lean()
                    if (scoreDoc2 && Array.isArray(scoreDoc2.scores)) {
                      const hs2 = scoreDoc2.scores.find(s => s.name === matchInfo.homeTeam) || scoreDoc2.scores[0]
                      const as2 = scoreDoc2.scores.find(s => s.name === matchInfo.awayTeam) || scoreDoc2.scores[1]
                      const h2 = hs2 && hs2.score != null && hs2.score !== '' ? parseInt(hs2.score) : null
                      const a2 = as2 && as2.score != null && as2.score !== '' ? parseInt(as2.score) : null
                      if (h2 != null && a2 != null) {
                        homeScore = h2
                        awayScore = a2
                        finalOutcome = homeScore > awayScore ? '1' : homeScore < awayScore ? '2' : 'X'
                      }
                    }
                  }
                } catch (_) {}
              }
            }
          } catch (e2) {}
        }
      }

      // Determine final flag
      const isFinal = String(bet.status || '').toLowerCase() !== 'pending' || !!bet.settledAt

      // Build top-level result info with FT fields
      const resultInfo = {
        status: bet.status,
        outcome: bet.status === 'won' ? 'Won' : bet.status === 'lost' ? 'Lost' : bet.status === 'pending' ? 'Pending' : 'Void',
        settledAt: bet.settledAt,
        profit: bet.actualWin ? bet.actualWin - bet.stake : 0,
        isFinal,
        homeScore: homeScore != null ? homeScore : (bet.result && bet.result.homeScore != null ? bet.result.homeScore : null),
        awayScore: awayScore != null ? awayScore : (bet.result && bet.result.awayScore != null ? bet.result.awayScore : null),
        finalOutcome: finalOutcome != null ? finalOutcome : (bet.result && bet.result.finalOutcome != null ? bet.result.finalOutcome : null)
      }

      // Inject result and outcome into matches, with final flags and status
      matches = matches.map(m => {
        const isMain = String(m.matchId) === String(bet.matchId)
        const baseResult = m.result || ((isMain && homeScore != null && awayScore != null) ? { homeScore, awayScore } : null)
        const enrichedResult = baseResult
          ? {
              ...baseResult,
              finalOutcome: (isMain && finalOutcome) ? finalOutcome : baseResult.finalOutcome,
              isFinal
            }
          : (isMain && isFinal && finalOutcome != null
              ? { homeScore, awayScore, finalOutcome, isFinal }
              : null)
        const outcome = m.outcome || ((isMain && finalOutcome) ? finalOutcome : null)
        const matchStatus = isFinal ? 'Finished' : (m.matchStatus || m.status || 'Pending')
        return { ...m, result: enrichedResult, outcome, matchStatus }
      })

      let displayStatus = bet.status
      try {
        const marketKey = String(bet.market || '').toLowerCase()
        const selRaw = String(bet.selection || '').toLowerCase()
        const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
        const contains = (a, b) => a.includes(b) || b.includes(a)
        const homeNorm = norm(matchInfo.homeTeam || '')
        const awayNorm = norm(matchInfo.awayTeam || '')
        const selNorm = norm(selRaw)
        let selCode = null
        const isWinnerMarket = marketKey.includes('winner') || marketKey.includes('h2h') || marketKey.includes('moneyline')
        if (isWinnerMarket || ['1', 'x', '2'].includes(selRaw) || selRaw.includes('home') || selRaw.includes('away') || selRaw.includes('draw') || contains(selNorm, homeNorm) || contains(selNorm, awayNorm)) {
          if (selRaw === '1' || selRaw.includes('home') || contains(selNorm, homeNorm)) selCode = '1'
          else if (selRaw === '2' || selRaw.includes('away') || contains(selNorm, awayNorm)) selCode = '2'
          else if (selRaw === 'x' || selRaw.includes('draw') || selRaw.includes('tie')) selCode = 'X'
        }
        const final = resultInfo.finalOutcome || null
        const isCompleted = isFinal && final != null
        if (isCompleted && selCode) displayStatus = selCode === final ? 'won' : 'lost'

        // Harmonize BTTS (Both Teams To Score) as well, independent of finalOutcome
        const isBTTS = marketKey.includes('both_teams_to_score') || /btts|both\s*teams\s*to\s*score|gg|ng/i.test(selRaw)
        if (isFinal && (resultInfo.homeScore != null && resultInfo.awayScore != null) && isBTTS) {
          const bothScored = Number(resultInfo.homeScore) > 0 && Number(resultInfo.awayScore) > 0
          let wantYes = null
          if (/\bng\b|\bno\b/i.test(selRaw)) wantYes = false
          else if (/\bgg\b|\byes\b/i.test(selRaw)) wantYes = true
          else {
            // Default to YES if selection is generic BTTS without qualifier
            wantYes = true
          }
          displayStatus = (bothScored === wantYes) ? 'won' : 'lost'
        }
      } catch (_) {}

      return {
        id: bet._id,
        match: matchInfo,
        market: bet.market,
        selection: bet.selection,
        odds: oddsInfo,
        result: resultInfo,
        createdAt: bet.createdAt,
        stake: bet.stake,
        potentialWin: bet.potentialWin,
        actualWin: bet.actualWin,
        status: displayStatus,
        settledAt: bet.settledAt,
        matchId: bet.matchId,
        matches
      }
    }))

    const response = {
      bets: formattedBets,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      },
      meta: {
        cached: false,
        timestamp: new Date().toISOString()
      }
    }

    // Cache the response if caching is enabled
    if (res.locals.cacheKey && res.locals.cacheTTL) {
      try {
        cache.set(res.locals.cacheKey, response, res.locals.cacheTTL)
      } catch (error) {
        console.error('Cache set error:', error)
      }
    }

    res.json(response)
  } catch (error) {
    console.error('Get bets error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Get bet by ID
router.get('/:betId', auth, async (req, res) => {
  try {
    // Optimized query with field projection
    const bet = await Bet.findOne({
      _id: req.params.betId,
      userId: req.user.id
    }, {
      market: 1,
      selection: 1,
      stake: 1,
      odds: 1,
      potentialWin: 1,
      actualWin: 1,
      status: 1,
      createdAt: 1,
      settledAt: 1,
      matchId: 1
    }).lean() // Use lean() for better performance

    if (!bet) {
      return res.status(404).json({ error: 'Bet not found' })
    }

    // Cache the response if caching is available
    const response = {
      id: bet._id,
      match: `${bet.market} bet on ${bet.selection}`,
      market: bet.market,
      selection: bet.selection,
      stake: bet.stake,
      odds: bet.odds,
      potentialWin: bet.potentialWin,
      actualWin: bet.actualWin,
      status: bet.status,
      createdAt: bet.createdAt,
      settledAt: bet.settledAt,
      matchId: bet.matchId
    }

    // Cache individual bet for 5 minutes
    if (res.locals.cacheKey) {
      cache.set(res.locals.cacheKey, response, res.locals.cacheTTL || 300)
    }

    res.json(response)
  } catch (error) {
    console.error('Get bet error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Cancel bet (only if match hasn't started)
router.delete('/:betId', auth, async (req, res) => {
  try {
    const bet = await Bet.findOne({
      _id: req.params.betId,
      userId: req.user.id,
      status: 'pending'
    })

    if (!bet) {
      return res.status(404).json({ error: 'Bet not found or cannot be cancelled' })
    }

    // Check match start time to ensure it hasn't started
    let matchStarted = false

    // 1. Try to find in Odds (external API)
    const oddsDoc = await Odds.findOne({ gameId: bet.matchId }).lean()
    if (oddsDoc) {
      if (new Date() >= new Date(oddsDoc.commence_time)) {
        matchStarted = true
      }
    } else if (mongoose.Types.ObjectId.isValid(bet.matchId)) {
      // 2. Try to find in Match (Admin created)
      const matchDoc = await Match.findById(bet.matchId).lean()
      if (matchDoc) {
        if (new Date() >= new Date(matchDoc.startTime)) {
          matchStarted = true
        }
      }
    }

    if (matchStarted) {
      return res.status(400).json({ error: 'Cannot cancel bet: Match has already started' })
    }

    // Update bet status
    bet.status = 'cancelled'
    bet.settledAt = new Date()
    await bet.save()

    // Refund user balance
    await User.updateBalance(req.user.id, bet.stake)

    res.json({ success: true, message: 'Bet cancelled and stake refunded' })
  } catch (error) {
    console.error('Cancel bet error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Get betting statistics for user
router.get('/stats/summary', auth, cacheUserBetStats(300), async (req, res) => {
  try {
    const userId = req.user.id
    const excludeMarket = req.query.excludeMarket
    console.log(`Fetching bet stats for user: ${userId}, excludeMarket: ${excludeMarket}`)

    const matchStage = {
      userId: new mongoose.Types.ObjectId(userId)
    }

    if (excludeMarket) {
      matchStage.market = { $ne: excludeMarket }
    }

    // Optimized aggregation pipeline with better performance
    const stats = await Bet.aggregate([
      {
        $match: matchStage
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalStake: { $sum: { $ifNull: ['$stake', 0] } },
          totalWin: { $sum: { $ifNull: ['$actualWin', 0] } },
          totalPotentialWin: { $sum: { $ifNull: ['$potentialWin', 0] } },
          avgOdds: { $avg: { $ifNull: ['$odds', 1] } }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]).allowDiskUse(true)

    console.log('Aggregation results:', stats)

    const summary = {
      totalBets: 0,
      totalStaked: 0,
      totalWon: 0,
      totalPotentialWin: 0,
      pendingBets: 0,
      wonBets: 0,
      lostBets: 0,
      voidBets: 0,
      cancelledBets: 0,
      profit: 0,
      winRate: 0
    }

    // Process aggregation results
    stats.forEach(stat => {
      summary.totalBets += stat.count
      summary.totalStaked += stat.totalStake || 0
      summary.totalWon += stat.totalWin || 0
      summary.totalPotentialWin += stat.totalPotentialWin || 0

      switch (stat._id) {
        case 'pending':
          summary.pendingBets = stat.count
          break
        case 'won':
          summary.wonBets = stat.count
          break
        case 'lost':
          summary.lostBets = stat.count
          break
        case 'void':
          summary.voidBets = stat.count
          break
        case 'cancelled':
          summary.cancelledBets = stat.count
          break
      }
    })

    // Calculate derived statistics
    summary.profit = summary.totalWon - summary.totalStaked

    // Calculate win rate based only on settled bets (won + lost), excluding pending, void, and cancelled
    const settledBets = summary.wonBets + summary.lostBets
    summary.winRate = settledBets > 0 ? parseFloat(((summary.wonBets / settledBets) * 100).toFixed(2)) : 0

    // Add active bets (alias for pending bets for frontend compatibility)
    summary.activeBets = summary.pendingBets

    console.log('Final summary:', summary)
    // Cache the summary for subsequent requests
    if (res.locals.cacheKey && res.locals.cacheTTL) {
      try {
        cache.set(res.locals.cacheKey, summary, res.locals.cacheTTL)
      } catch (error) {
        console.error('Cache set error (stats):', error)
      }
    }
    res.json(summary)
  } catch (error) {
    console.error('Get bet stats error:', error)
    console.error('Error stack:', error.stack)
    res.status(500).json({
      error: 'Server error',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

module.exports = router
