const cron = require('node-cron');
const mongoose = require('mongoose');
const { OddsApiService } = require('./services/oddsApiService');
const betSettlementService = require('./services/betSettlementService');
const logger = require('./utils/logger');
const { fetchOddsForSport, fetchOddsForMultipleSports } = require('./scripts/fetchOddsModule');

// Import models
const Odds = require('./models/Odds');
const Match = require('./models/Match');
const Results = require('./models/Results');
const Scores = require('./models/Scores');
const Bet = require('./models/Bet');
const MultiBet = require('./models/MultiBet');
const League = require('./models/League');
const { updateCronStatus, isServerHealthy } = require('./middleware/healthMonitor');

let oddsApiService;
try {
  oddsApiService = new OddsApiService();
} catch (error) {
  console.error('Failed to initialize OddsApiService:', error.message);
  oddsApiService = null;
}

// Sports list will be fetched dynamically from the Odds API per cron run

// Fetch all supported markets per sport; leave live odds to lightweight h2h

/**
 * @function updateMatchStatuses
 * @description Updates match statuses based on start times
 */
async function updateMatchStatuses() {
  const now = new Date();
  
  try {
    // Update matches that should be live
    await Match.updateMany(
      {
        startTime: { $lte: now },
        status: 'upcoming'
      },
      { $set: { status: 'live' } }
    );

    // Update matches that should be finished (e.g., 3 hours after start time)
    const threeHoursAgo = new Date(now - 3 * 60 * 60 * 1000);
    await Match.updateMany(
      {
        startTime: { $lte: threeHoursAgo },
        status: 'live'
      },
      { $set: { status: 'finished', finishedAt: now } }
    );

    logger.info('Successfully updated match statuses');
  } catch (error) {
    logger.error('Error updating match statuses:', error);
  }
}

/**
 * @function cleanupOldMatches
 * @description Removes matches and odds data older than 30 days
 */
async function cleanupOldMatches() {
  try {
    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Delete matches that finished more than 30 days ago
    const matchDeleteResult = await Match.deleteMany({
      $or: [
        { finishedAt: { $lt: thirtyDaysAgo } },
        { 
          status: 'finished',
          startTime: { $lt: thirtyDaysAgo }
        }
      ]
    });
    
    // Delete odds data older than 30 days
    const oddsDeleteResult = await Odds.deleteMany({
      commence_time: { $lt: thirtyDaysAgo }
    });
    
    logger.info(`Database cleanup completed: Removed ${matchDeleteResult.deletedCount} old matches and ${oddsDeleteResult.deletedCount} old odds records`);
  } catch (error) {
    logger.error('Error during database cleanup:', error);
  }
}

/**
 * @function settleBets
 * @description Automatically settle bets based on completed match results
 */
async function settleBets() {
  try {
    logger.info('Starting automated bet settlement...');
    const result = await betSettlementService.processSettlements();
    
    if (result.success) {
      logger.info(`Bet settlement completed: ${result.settledBets} bets settled across ${result.processedMatches} matches`);
    } else {
      logger.warn('Bet settlement completed with issues');
    }
  } catch (error) {
    logger.error('Error during bet settlement:', error);
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
async function broadcastLiveMatchesUpdate() {
  try {
    if (global.websocketServer) {
      await global.websocketServer.broadcastLiveMatchesUpdate();
      logger.info('Successfully broadcasted live matches update to WebSocket subscribers');
    }
  } catch (error) {
    logger.error('Error broadcasting live matches update:', error);
  }
}

/**
 * @function fetchLiveOdds
 * @description Fetches live odds for currently live matches
 */
async function fetchLiveOdds() {
  if (!oddsApiService) {
    logger.warn('OddsApiService is not available, skipping live odds fetch');
    return;
  }
  
  try {
    // Get all live matches
    const liveMatches = await Match.find({ status: 'live' });
    
    if (liveMatches.length === 0) {
      logger.info('No live matches found, skipping live odds fetch');
      return;
    }
    
    logger.info(`Found ${liveMatches.length} live matches, fetching live odds...`);
    
    // Fetch live odds for each sport that has live matches
    const sportsWithLiveMatches = [...new Set(liveMatches.map(match => match.sport))];
    
    for (const sport of sportsWithLiveMatches) {
      try {
        // Map internal sport names to a list of API sport keys
        const sportKeyMap = {
          football: ['americanfootball_nfl', 'americanfootball_cfl'],
          basketball: ['basketball_nba'],
          soccer: ['soccer_epl'],
          baseball: ['baseball_mlb'],
          hockey: ['icehockey_nhl'],
        };

        const apiSportKeys = sportKeyMap[sport] || [sport];

        // Use comprehensive priority markets for live odds
        const priorityMarkets = oddsApiService.getPriorityMarkets();

        for (const apiSportKey of apiSportKeys) {
          logger.info(`Fetching live odds for ${sport} (API key: ${apiSportKey}) using ${priorityMarkets.length} priority markets`);
          const games = await oddsApiService._fetchAndSaveOddsForMarketsBatch(apiSportKey, priorityMarkets);
          logger.info(`Live odds fetched: ${Array.isArray(games) ? games.length : 0} events for ${apiSportKey}`);
          // Add delay between league calls to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        logger.error(`Error fetching live odds for ${sport}:`, error);
      }
    }
    
    logger.info('Live odds fetch completed');
    
  } catch (error) {
    logger.error('Error in live odds fetch:', error);
  }
}

/**
 * @function startCronJobs
 * @description Initializes and starts all scheduled cron jobs for the application.
 */
const startCronJobs = async () => {
  // Add job overlap prevention
  let isOddsFetching = false;
  let isLiveOddsFetching = false;
  let isStatusUpdating = false;
  let isBroadcasting = false;
  let isCleaningUp = false;
  let isBetSettling = false;

  // Immediate fetch on startup to populate data
  logger.info('🚀 Starting immediate data fetch on startup...');
  
  try {
    // Check if MongoDB is connected before immediate fetch
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      logger.info('📊 Performing immediate odds, scores, and results fetch...');
      
      // Fetch sports list and use fetchOdds module for immediate fetch
      if (oddsApiService) {
        const sportsList = await oddsApiService.getSports();
        if (sportsList && sportsList.length > 0) {
          const supportedSports = sportsList.filter(sport =>
            sport && sport.key &&
            !sport.key.includes('politics') &&
            !sport.key.includes('entertainment') &&
            sport.key !== 'golf_the_open_championship_winner'
          ).slice(0, 5); // Limit to first 5 sports for immediate fetch to avoid rate limits

          logger.info(`🎯 Immediately fetching data for ${supportedSports.length} priority sports using fetchOdds module...`);
          
          // Use fetchOdds module for consistent data fetching
          const results = await fetchOddsForMultipleSports(supportedSports, false);
          logger.info('✅ Immediate fetch completed:', results);
        } else {
          logger.warn('No sports available for immediate fetch');
        }
      } else {
        logger.warn('OddsApiService not available for immediate fetch');
      }
    } else {
      logger.warn('MongoDB not connected, skipping immediate fetch');
    }
  } catch (error) {
    logger.error('❌ Error during immediate startup fetch:', error);
  }

  // Fetch upcoming odds every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    // Skip if DB is not connected to avoid buffered writes that never flush
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      logger.warn('MongoDB not connected; skipping scheduled upcoming odds fetch');
      return;
    }
    if (isOddsFetching) {
      logger.warn('Odds fetching already in progress, skipping...');
      return;
    }
    
    // Check server health before starting
    if (!isServerHealthy()) {
      logger.warn('Server is unhealthy, skipping odds fetch...');
      return;
    }
    
    isOddsFetching = true;
    updateCronStatus(true, 'odds-fetch');
    
  try {
    logger.info('Starting cron job: Executing fetchOdds.js script for all supported sports...');

    // Execute fetchOdds.js script directly
    const fetchOddsProcess = spawn('node', ['scripts/fetchOdds.js'], {
      cwd: __dirname,
      stdio: 'pipe'
    });

    fetchOddsProcess.stdout.on('data', (data) => {
      logger.info(`fetchOdds.js: ${data.toString().trim()}`);
    });

    fetchOddsProcess.stderr.on('data', (data) => {
      logger.error(`fetchOdds.js error: ${data.toString().trim()}`);
    });

    fetchOddsProcess.on('close', (code) => {
      if (code === 0) {
        logger.info('✅ Scheduled odds fetch completed successfully');
      } else {
        logger.error(`❌ fetchOdds.js exited with code ${code}`);
      }
      isOddsFetching = false;
      updateCronStatus(false, 'odds-fetch');
    });

    logger.info('Cron job finished: Successfully started fetchOdds.js script.');
  } catch (error) {
      logger.error('Error in odds fetching cron job:', error);
      isOddsFetching = false;
      updateCronStatus(false, 'odds-fetch');
    }
  });

  // Fetch live odds every minute (near real-time)
  cron.schedule('*/1 * * * *', async () => {
    // Skip if DB is not connected
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      logger.warn('MongoDB not connected; skipping scheduled live odds fetch');
      return;
    }
    if (isLiveOddsFetching) {
      logger.warn('Live odds fetching already in progress, skipping...');
      return;
    }
    
    isLiveOddsFetching = true;
    try {
      logger.info('Starting cron job: Fetching live odds...');
      await fetchLiveOdds();
      logger.info('Cron job finished: Successfully fetched live odds.');
    } catch (error) {
      logger.error('Error in live odds fetching cron job:', error);
    } finally {
      isLiveOddsFetching = false;
    }
  });

  // Update match statuses every minute (near real-time)
  cron.schedule('*/1 * * * *', async () => {
    if (isStatusUpdating) {
      logger.warn('Status update already in progress, skipping...');
      return;
    }
    
    isStatusUpdating = true;
    try {
      logger.info('Starting cron job: Updating match statuses...');
      await updateMatchStatuses();
      logger.info('Cron job finished: Successfully updated match statuses.');
    } catch (error) {
      logger.error('Error in match status update cron job:', error);
    } finally {
      isStatusUpdating = false;
    }
  });

  // Broadcast live matches update every minute (near real-time)
  cron.schedule('*/1 * * * *', async () => {
    if (isBroadcasting) {
      logger.warn('Broadcast already in progress, skipping...');
      return;
    }
    
    isBroadcasting = true;
    try {
      logger.info('Starting cron job: Broadcasting live matches update...');
      await broadcastLiveMatchesUpdate();
      logger.info('Cron job finished: Successfully broadcasted live matches update.');
    } catch (error) {
      logger.error('Error in live matches broadcast cron job:', error);
    } finally {
      isBroadcasting = false;
    }
  });

  // Settle bets every 2 minutes based on completed match results
  cron.schedule('*/2 * * * *', async () => {
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      logger.warn('MongoDB not connected; skipping scheduled bet settlement');
      return;
    }
    if (isBetSettling) {
      logger.warn('Bet settlement already in progress, skipping...');
      return;
    }
    
    isBetSettling = true;
    try {
      logger.info('Starting cron job: Settling bets...');
      await settleBets();
      logger.info('Cron job finished: Successfully processed bet settlements.');
    } catch (error) {
      logger.error('Error in bet settlement cron job:', error);
    } finally {
      isBetSettling = false;
    }
  });

  // Clean up old matches and odds data daily at 2 AM (less busy time)
  cron.schedule('0 2 * * *', async () => {
    if (isCleaningUp) {
      logger.warn('Cleanup already in progress, skipping...');
      return;
    }
    
    isCleaningUp = true;
    try {
      logger.info('Starting cron job: Cleaning up old matches and odds data...');
      await cleanupOldMatches();
      logger.info('Cron job finished: Successfully cleaned up old data.');
    } catch (error) {
      logger.error('Error in cleanup cron job:', error);
    } finally {
      isCleaningUp = false;
    }
  });

  logger.info('All cron jobs scheduled with overlap prevention.');
};

module.exports = startCronJobs;