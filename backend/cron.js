const cron = require('node-cron')
const mongoose = require('mongoose')
const { spawn } = require('child_process')
const { OddsApiService } = require('./services/oddsApiService')
const betSettlementService = require('./services/betSettlementService')
const logger = require('./utils/logger')

// Import models
const Odds = require('./models/Odds')
const Match = require('./models/Match')
const Scores = require('./models/Scores')
const Bet = require('./models/Bet')
const MultiBet = require('./models/MultiBet')
const { updateCronStatus, isServerHealthy } = require('./middleware/healthMonitor')

let oddsApiService
try {
  oddsApiService = new OddsApiService()
} catch (error) {
  console.error('Failed to initialize OddsApiService:', error.message)
  oddsApiService = null
}

// Sports list will be fetched dynamically from the Odds API per cron run

// Fetch all supported markets per sport; leave live odds to lightweight h2h

/**
 * @function updateMatchStatuses
 * @description Updates match statuses based on start times
 */
async function updateMatchStatuses () {
  const now = new Date()

  try {
    // Update matches that should be live
    await Match.updateMany(
      {
        startTime: { $lte: now },
        status: 'upcoming'
      },
      { $set: { status: 'live' } }
    )

    // Update matches that should be finished (e.g., 3 hours after start time)
    const threeHoursAgo = new Date(now - 3 * 60 * 60 * 1000)
    const matchesToFinish = await Match.find({
      startTime: { $lte: threeHoursAgo },
      status: 'live'
    })

    for (const match of matchesToFinish) {
      match.status = 'finished'
      match.finishedAt = now

      // Apply predetermined result if exists and valid
      if (match.predeterminedResult && match.predeterminedResult.shouldSettle) {
        if (match.predeterminedResult.homeScore !== null && match.predeterminedResult.homeScore !== undefined) {
          match.homeScore = match.predeterminedResult.homeScore
        }
        if (match.predeterminedResult.awayScore !== null && match.predeterminedResult.awayScore !== undefined) {
          match.awayScore = match.predeterminedResult.awayScore
        }
      }

      await match.save()
    }

    logger.info('Successfully updated match statuses')
  } catch (error) {
    logger.error('Error updating match statuses:', error)
  }
}

/**
 * @function cleanupOldMatches
 * @description Removes matches and odds data older than 30 days
 */
async function cleanupOldMatches () {
  try {
    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Delete matches that finished more than 30 days ago
    const matchDeleteResult = await Match.deleteMany({
      $or: [
        { finishedAt: { $lt: thirtyDaysAgo } },
        {
          status: 'finished',
          startTime: { $lt: thirtyDaysAgo }
        }
      ]
    })

    // Delete odds data older than 30 days
    const oddsDeleteResult = await Odds.deleteMany({
      commence_time: { $lt: thirtyDaysAgo }
    })

    logger.info(`Database cleanup completed: Removed ${matchDeleteResult.deletedCount} old matches and ${oddsDeleteResult.deletedCount} old odds records`)
  } catch (error) {
    logger.error('Error during database cleanup:', error)
  }
}

/**
 * @function settleBets
 * @description Automatically settle bets based on completed match results
 */
async function settleBets () {
  try {
    logger.info('Starting automated bet settlement...')
    const result = await betSettlementService.processSettlements()

    if (result.success) {
      logger.info(`Bet settlement completed: ${result.settledBets} bets settled across ${result.processedMatches} matches`)
    } else {
      logger.warn('Bet settlement completed with issues')
    }
  } catch (error) {
    logger.error('Error during bet settlement:', error)
  }
}

/**
 * @function fetchOddsForSport
 * @param {string} sportKey - The sport key to fetch odds for
 * @param {string} sportName - The display name of the sport
 * @returns {Promise<void>}
 */
/**
 * @function broadcastLiveMatchesUpdate
 * @description Broadcasts live matches update to all WebSocket subscribers
 */
async function broadcastLiveMatchesUpdate () {
  try {
    if (global.websocketServer) {
      await global.websocketServer.broadcastLiveMatchesUpdate()
      logger.info('Successfully broadcasted live matches update to WebSocket subscribers')
    }
  } catch (error) {
    logger.error('Error broadcasting live matches update:', error)
  }
}

/**
 * @function fetchLiveOdds
 * @description Fetches live odds for currently live matches
 */
async function fetchLiveOdds () {
  if (!oddsApiService) {
    logger.warn('OddsApiService is not available, skipping live odds fetch')
    return
  }

  try {
    // Get all live matches
    const liveMatches = await Match.find({ status: 'live' })

    if (liveMatches.length === 0) {
      logger.info('No live matches found, skipping live odds fetch')
      return
    }

    logger.info(`Found ${liveMatches.length} live matches, fetching live odds...`)

    // Fetch live odds for each sport that has live matches
    const sportsWithLiveMatches = [...new Set(liveMatches.map(match => match.sport))]

    for (const sport of sportsWithLiveMatches) {
      try {
        // Map internal sport names to a list of API sport keys
        const sportKeyMap = {
          football: ['americanfootball_nfl', 'americanfootball_cfl'],
          basketball: ['basketball_nba'],
          soccer: ['soccer_epl'],
          baseball: ['baseball_mlb'],
          hockey: ['icehockey_nhl']
        }

        const apiSportKeys = sportKeyMap[sport] || [sport]

        // Use comprehensive priority markets for live odds
        const priorityMarkets = oddsApiService.getPriorityMarkets()

        for (const apiSportKey of apiSportKeys) {
          logger.info(`Fetching live odds for ${sport} (API key: ${apiSportKey}) using ${priorityMarkets.length} priority markets`)
          const games = await oddsApiService._fetchAndSaveOddsForMarketsBatch(apiSportKey, priorityMarkets)
          logger.info(`Live odds fetched: ${Array.isArray(games) ? games.length : 0} events for ${apiSportKey}`)
          // Add delay between league calls to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      } catch (error) {
        logger.error(`Error fetching live odds for ${sport}:`, error)
      }
    }

    logger.info('Live odds fetch completed')
  } catch (error) {
    logger.error('Error in live odds fetch:', error)
  }
}

/**
 * @function updatePendingBetsScores
 * @description Scans pending bets and fetches targeted scores/results
 */
async function updatePendingBetsScores () {
  if (!oddsApiService) return

  try {
    logger.info('Starting targeted pending bets update...')

    // 1. Get pending bets match IDs
    const pendingBets = await Bet.find({ status: 'pending' }).select('matchId').lean()
    const pendingMultiBets = await MultiBet.find({ status: 'pending' }).select('bets').lean()

    const matchIds = new Set()
    pendingBets.forEach(b => {
      if (b.matchId) matchIds.add(b.matchId)
    })
    pendingMultiBets.forEach(mb => {
      if (Array.isArray(mb.bets)) {
        mb.bets.forEach(b => {
          if (b.status === 'pending' && b.matchId) matchIds.add(b.matchId)
        })
      }
    })

    const uniqueMatchIds = [...matchIds]
    if (uniqueMatchIds.length === 0) {
      logger.info('No pending bets found, skipping targeted fetch')
      return
    }

    logger.info(`Found ${uniqueMatchIds.length} pending matches to update`)

    // 2. Resolve sport keys for these matches
    // Try Odds collection first
    const odds = await Odds.find({ gameId: { $in: uniqueMatchIds } }).select('gameId sport_key').lean()
    const idToSport = {}
    odds.forEach(o => { idToSport[o.gameId] = o.sport_key })

    // Find missing IDs (possibly cleaned up from Odds but exist in Scores or just old)
    const missingIds = uniqueMatchIds.filter(id => !idToSport[id])

    if (missingIds.length > 0) {
      // Try Scores collection
      try {
        const scores = await Scores.find({ eventId: { $in: missingIds } }).select('eventId sport_key').lean()
        scores.forEach(s => { idToSport[s.eventId] = s.sport_key })
      } catch (e) {
        logger.warn('Could not query Scores for missing IDs:', e.message)
      }
    }

    // Group IDs by sport
    const idsBySport = {}
    Object.entries(idToSport).forEach(([id, sportKey]) => {
      if (!sportKey) return
      if (!idsBySport[sportKey]) idsBySport[sportKey] = []
      idsBySport[sportKey].push(id)
    })

    // 3. Fetch updates for each sport group
    const sports = Object.keys(idsBySport)
    if (sports.length === 0) {
      logger.info('Could not resolve sport keys for pending matches')
      return
    }

    logger.info(`Updating pending bets across ${sports.length} sports`)

    for (const sportKey of sports) {
      const ids = idsBySport[sportKey]
      try {
        // Fetch scores (includes live and recent results)
        // Using daysFrom=3 to catch recent finishes
        await oddsApiService.getScores(sportKey, 3, ids)
        logger.info(`Updated scores for ${ids.length} matches in ${sportKey}`)
      } catch (e) {
        logger.error(`Failed to update pending bets for ${sportKey}: ${e.message}`)
      }

      // Rate limit delay
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    logger.info('Targeted pending bets update completed')
  } catch (error) {
    logger.error('Error updating pending bets:', error)
  }
}

/**
 * @function processScheduledEvents
 * @description Processes scheduled events for live matches
 */
async function processScheduledEvents () {
  try {
    const liveMatches = await Match.find({
      status: 'live',
      'scheduledEvents.0': { $exists: true }
    })

    for (const match of liveMatches) {
      const start = new Date(match.startTime).getTime()
      const now = Date.now()
      const currentMinute = Math.floor((now - start) / 60000)

      let updated = false

      for (const event of match.scheduledEvents) {
        if (!event.processed && event.minute <= currentMinute) {
          event.processed = true
          updated = true

          if (event.type === 'goal') {
            if (event.team === 'home') match.homeScore = (match.homeScore || 0) + 1
            if (event.team === 'away') match.awayScore = (match.awayScore || 0) + 1
          }
        }
      }

      if (updated) {
        await match.save()
        logger.info(`Processed scheduled events for match ${match._id}`)
      }
    }
  } catch (error) {
    logger.error('Error processing scheduled events:', error)
  }
}

/**
 * @function startCronJobs
 * @description Initializes and starts all scheduled cron jobs for the application.
 */
const startCronJobs = async () => {
  // Add job overlap prevention
  let isOddsFetching = false
  let isLiveOddsFetching = false
  let isStatusUpdating = false
  let isBroadcasting = false
  let isCleaningUp = false
  let isBetSettling = false
  let isLiveMatchSyncing = false
  let isScoresFetching = false
  // const isResultsFetching = false
  let isEventProcessing = false

  // Immediate fetch on startup to populate data
  logger.info('🚀 Starting immediate data fetch on startup...')

  try {
    // Check if MongoDB is connected before immediate fetch
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      logger.info('📊 Performing immediate enhanced odds and markets fetch (scores and results delayed by 15 minutes)...')

      // Use enhancedFetchOdds.js script for immediate comprehensive fetch
      logger.info('🚀 Starting immediate enhancedFetchOdds.js script for odds and markets...')

      const immediateProcess = spawn('node', ['scripts/enhancedFetchOdds.js'], {
        cwd: __dirname,
        stdio: 'pipe'
      })

      immediateProcess.stdout.on('data', (data) => {
        logger.info(`enhancedFetchOdds (immediate): ${data.toString().trim()}`)
      })

      immediateProcess.stderr.on('data', (data) => {
        logger.error(`enhancedFetchOdds (immediate) error: ${data.toString().trim()}`)
      })

      immediateProcess.on('close', (code) => {
        if (code === 0) {
          logger.info('✅ Immediate enhanced odds and markets fetch completed successfully')
        } else {
          logger.error(`❌ Immediate enhancedFetchOdds.js exited with code ${code}`)
        }
      })
    } else {
      logger.warn('MongoDB not connected, skipping immediate fetch')
    }
  } catch (error) {
    logger.error('❌ Error during immediate startup fetch:', error)
  }

  // Schedule scores and results fetching to start after 15 minutes
  setTimeout(async () => {
    logger.info('🕒 Starting delayed scores and results fetch (15 minutes after startup)...')

    try {
      if (mongoose.connection && mongoose.connection.readyState === 1 && oddsApiService) {
        const sportsList = await oddsApiService.getSports()
        if (sportsList && sportsList.length > 0) {
          const supportedSports = sportsList.filter(sport =>
            sport && sport.key &&
            !sport.key.includes('politics') &&
            !sport.key.includes('entertainment') &&
            sport.key !== 'golf_the_open_championship_winner'
          ).slice(0, 5)

          logger.info(`📊 Fetching scores and results for ${supportedSports.length} sports...`)

          for (const sport of supportedSports) {
            try {
              // Fetch scores
              logger.info(`Fetching scores for ${sport.key}...`)
              const scores = await oddsApiService.getScores(sport.key)
              logger.info(`✅ Fetched ${scores.length} scores for ${sport.key}`)

              // Fetch results
              logger.info(`Fetching results for ${sport.key}...`)
              const results = await oddsApiService.getResults(sport.key)
              logger.info(`✅ Fetched ${results.length} results for ${sport.key}`)
            } catch (error) {
              logger.error(`❌ Error fetching scores/results for ${sport.key}:`, error.message)
            }
          }

          logger.info('✅ Delayed scores and results fetch completed')
        }
      }
    } catch (error) {
      logger.error('❌ Error during delayed scores and results fetch:', error)
    }
  }, 15 * 60 * 1000) // 15 minutes delay

  // Periodic check for pending bets scores/results every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      logger.warn('MongoDB not connected; skipping pending bets update')
      return
    }

    if (isScoresFetching) {
      logger.warn('Pending bets update already in progress, skipping...')
      return
    }

    isScoresFetching = true
    try {
      await updatePendingBetsScores()
    } catch (error) {
      logger.error('Error during pending bets update:', error)
    } finally {
      isScoresFetching = false
    }
  })

  // Fetch upcoming odds daily at midnight
  cron.schedule('0 0 * * *', async () => {
    // Skip if DB is not connected to avoid buffered writes that never flush
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      logger.warn('MongoDB not connected; skipping scheduled upcoming odds fetch')
      return
    }
    if (isOddsFetching) {
      logger.warn('Odds fetching already in progress, skipping...')
      return
    }

    // Check server health before starting
    if (!isServerHealthy()) {
      logger.warn('Server is unhealthy, skipping odds fetch...')
      return
    }

    isOddsFetching = true
    updateCronStatus(true, 'odds-fetch')

    try {
      logger.info('Starting cron job: Executing enhancedFetchOdds.js script for comprehensive sports coverage...')

      // Execute enhancedFetchOdds.js script directly for comprehensive odds fetching
      const fetchOddsProcess = spawn('node', ['scripts/enhancedFetchOdds.js'], {
        cwd: __dirname,
        stdio: 'pipe'
      })

      fetchOddsProcess.stdout.on('data', (data) => {
        logger.info(`enhancedFetchOdds.js: ${data.toString().trim()}`)
      })

      fetchOddsProcess.stderr.on('data', (data) => {
        logger.error(`enhancedFetchOdds.js error: ${data.toString().trim()}`)
      })

      fetchOddsProcess.on('close', (code) => {
        if (code === 0) {
          logger.info('✅ Scheduled enhanced odds fetch completed successfully')
        } else {
          logger.error(`❌ enhancedFetchOdds.js exited with code ${code}`)
        }
        isOddsFetching = false
        updateCronStatus(false, 'odds-fetch')
      })

      logger.info('Cron job finished: Successfully started enhancedFetchOdds.js script.')
    } catch (error) {
      logger.error('Error in enhanced odds fetching cron job:', error)
      isOddsFetching = false
      updateCronStatus(false, 'odds-fetch')
    }
  })

  // Fetch live odds every minute (near real-time)
  cron.schedule('*/1 * * * *', async () => {
    // Skip if DB is not connected
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      logger.warn('MongoDB not connected; skipping scheduled live odds fetch')
      return
    }
    if (isLiveOddsFetching) {
      logger.warn('Live odds fetching already in progress, skipping...')
      return
    }

    isLiveOddsFetching = true
    try {
      logger.info('Starting cron job: Fetching live odds...')
      await fetchLiveOdds()
      logger.info('Cron job finished: Successfully fetched live odds.')
    } catch (error) {
      logger.error('Error in live odds fetching cron job:', error)
    } finally {
      isLiveOddsFetching = false
    }
  })

  // Update match statuses every minute (near real-time)
  cron.schedule('*/1 * * * *', async () => {
    if (isStatusUpdating) {
      logger.warn('Status update already in progress, skipping...')
      return
    }

    isStatusUpdating = true
    try {
      logger.info('Starting cron job: Updating match statuses...')
      await updateMatchStatuses()
      logger.info('Cron job finished: Successfully updated match statuses.')
    } catch (error) {
      logger.error('Error in match status update cron job:', error)
    } finally {
      isStatusUpdating = false
    }
  })

  // Process scheduled events every minute
  cron.schedule('*/1 * * * *', async () => {
    if (isEventProcessing) return
    isEventProcessing = true
    try {
      await processScheduledEvents()
    } catch (error) {
      logger.error('Error in scheduled events cron job:', error)
    } finally {
      isEventProcessing = false
    }
  })

  // Broadcast live matches update every minute (near real-time)
  cron.schedule('*/1 * * * *', async () => {
    if (isBroadcasting) {
      logger.warn('Broadcast already in progress, skipping...')
      return
    }

    isBroadcasting = true
    try {
      logger.info('Starting cron job: Broadcasting live matches update...')
      await broadcastLiveMatchesUpdate()
      logger.info('Cron job finished: Successfully broadcasted live matches update.')
    } catch (error) {
      logger.error('Error in live matches broadcast cron job:', error)
    } finally {
      isBroadcasting = false
    }
  })

  // Sync live matches every 5 minutes using consolidated script
  cron.schedule('*/5 * * * *', async () => {
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      logger.warn('MongoDB not connected; skipping live match sync')
      return
    }

    if (isLiveMatchSyncing) {
      logger.warn('Live match sync already in progress, skipping...')
      return
    }

    isLiveMatchSyncing = true
    updateCronStatus(true, 'live-match-sync')

    try {
      logger.info('Starting cron job: Syncing live matches with consolidated script...')

      // Execute the consolidated syncLiveMatches.js script
      const syncProcess = spawn('node', ['scripts/syncLiveMatches.js'], {
        cwd: __dirname,
        stdio: 'pipe'
      })

      syncProcess.stdout.on('data', (data) => {
        logger.info(`syncLiveMatches.js: ${data.toString().trim()}`)
      })

      syncProcess.stderr.on('data', (data) => {
        logger.error(`syncLiveMatches.js error: ${data.toString().trim()}`)
      })

      syncProcess.on('close', (code) => {
        if (code === 0) {
          logger.info('✅ Live match sync completed successfully')
        } else {
          logger.error(`❌ syncLiveMatches.js exited with code ${code}`)
        }
        isLiveMatchSyncing = false
        updateCronStatus(false, 'live-match-sync')
      })

      logger.info('Cron job finished: Successfully started live match sync script.')
    } catch (error) {
      logger.error('Error in live match sync cron job:', error)
      isLiveMatchSyncing = false
      updateCronStatus(false, 'live-match-sync')
    }
  })

  // Settle bets every 2 minutes based on completed match results
  cron.schedule('*/2 * * * *', async () => {
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      logger.warn('MongoDB not connected; skipping scheduled bet settlement')
      return
    }
    if (isBetSettling) {
      logger.warn('Bet settlement already in progress, skipping...')
      return
    }

    isBetSettling = true
    try {
      logger.info('Starting cron job: Settling bets...')
      await settleBets()
      logger.info('Cron job finished: Successfully processed bet settlements.')
    } catch (error) {
      logger.error('Error in bet settlement cron job:', error)
    } finally {
      isBetSettling = false
    }
  })

  // Clean up old matches and odds data daily at 2 AM (less busy time)
  cron.schedule('0 2 * * *', async () => {
    if (isCleaningUp) {
      logger.warn('Cleanup already in progress, skipping...')
      return
    }

    isCleaningUp = true
    try {
      logger.info('Starting cron job: Cleaning up old matches and odds data...')
      await cleanupOldMatches()
      logger.info('Cron job finished: Successfully cleaned up old data.')
    } catch (error) {
      logger.error('Error in cleanup cron job:', error)
    } finally {
      isCleaningUp = false
    }
  })

  logger.info('All cron jobs scheduled with overlap prevention.')

  // Watchdog: check server health every minute and mitigate pressure
  cron.schedule('*/1 * * * *', async () => {
    try {
      const healthy = isServerHealthy()
      if (!healthy) {
        logger.warn('Watchdog detected UNHEALTHY state; clearing caches and boosting keep-alive')
        try {
          const { bus, clear } = require('./utils/cache')
          clear()
          bus.emit('system:clear-cache')
        } catch (e) {
          logger.warn('Watchdog cache clear failed:', e && e.message ? e.message : e)
        }
        try {
          const keepAliveService = require('./services/keepAliveService')
          keepAliveService.setPingInterval(5)
        } catch (e) {
          logger.warn('Watchdog keep-alive adjust failed:', e && e.message ? e.message : e)
        }
      }
    } catch (e) {
      logger.warn('Watchdog check failed:', e && e.message ? e.message : e)
    }
  })

  // Prewarm caches every minute for instant production loads
  cron.schedule('*/1 * * * *', async () => {
    try {
      const axios = require('axios')
      const base = process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT_BACKEND || process.env.PORT || 10000}`
      await Promise.allSettled([
        axios.get(`${base}/api/matches/popular/trending`, { timeout: 15000 }),
        axios.get(`${base}/api/admin/hero`, { timeout: 15000 })
      ])
      // Prewarm additional markets for upcoming top matches (next 10)
      try {
        const upcoming = await mongoose.model('Match').find({ status: 'upcoming', startTime: { $gte: new Date() } })
          .select('_id')
          .sort({ startTime: 1 })
          .limit(10)
          .lean()
        await Promise.allSettled(upcoming.map(m => axios.get(`${base}/api/matches/${m._id}/markets`, { timeout: 15000 })))
      } catch (e) {}
    } catch (e) {
      logger.warn('Cache prewarm failed:', e && e.message ? e.message : e)
    }
  })
}

module.exports = startCronJobs
