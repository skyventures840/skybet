const cron = require('node-cron');
const { OddsApiService } = require('./services/oddsApiService');
const logger = require('./utils/logger');
const Match = require('./models/Match');
const Odds = require('./models/Odds');
const { updateCronStatus, isServerHealthy } = require('./middleware/healthMonitor');

let oddsApiService;
try {
  oddsApiService = new OddsApiService();
} catch (error) {
  console.error('Failed to initialize OddsApiService:', error.message);
  oddsApiService = null;
}

// Define sports and markets to fetch
const SPORTS_TO_FETCH = [
  { key: 'americanfootball_nfl', name: 'NFL' },
  { key: 'basketball_nba', name: 'NBA' },
  { key: 'soccer_epl', name: 'Premier League' },
  { key: 'baseball_mlb', name: 'MLB' },
  { key: 'icehockey_nhl', name: 'NHL' }
];

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
 * @function fetchOddsForSport
 * @param {string} sportKey - The sport key to fetch odds for
 * @param {string} sportName - The display name of the sport
 * @returns {Promise<void>}
 */
async function fetchOddsForSport(sportKey, sportName) {
  if (!oddsApiService) {
    logger.warn('OddsApiService is not available, skipping odds fetch');
    return;
  }
  
  try {
    logger.info(`Fetching ALL supported markets for ${sportName}...`);
    // Passing null market triggers fetching all available markets and merge-saving to DB
    await oddsApiService.getUpcomingOdds(sportKey, null);
    logger.info(`Successfully fetched and saved all markets for ${sportName}`);
    // Small delay to avoid rate limiting between sports
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (error) {
    logger.error(`Error fetching all markets for ${sportName}:`, error);
  }
}

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
        // Map internal sport names to API sport keys
        const sportKeyMap = {
          'football': 'americanfootball_nfl',
          'basketball': 'basketball_nba',
          'soccer': 'soccer_epl',
          'baseball': 'baseball_mlb',
          'hockey': 'icehockey_nhl'
        };
        
        const apiSportKey = sportKeyMap[sport] || sport;
        
        logger.info(`Fetching live odds for ${sport} (API key: ${apiSportKey})...`);
        await oddsApiService.getUpcomingOdds(apiSportKey, 'h2h');
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
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
const startCronJobs = () => {
  // Add job overlap prevention
  let isOddsFetching = false;
  let isLiveOddsFetching = false;
  let isStatusUpdating = false;
  let isBroadcasting = false;
  let isCleaningUp = false;

  // Fetch upcoming odds every 5 minutes (more frequent)
  cron.schedule('*/5 * * * *', async () => {
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
      logger.info('Starting cron job: Fetching upcoming odds for all sports...');
      
      // Process sports sequentially to reduce load
      for (const sport of SPORTS_TO_FETCH) {
        await fetchOddsForSport(sport.key, sport.name);
        // Add delay between sports to prevent overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      logger.info('Cron job finished: Successfully fetched odds for all sports.');
    } catch (error) {
      logger.error('Error in odds fetching cron job:', error);
    } finally {
      isOddsFetching = false;
      updateCronStatus(false, 'odds-fetch');
    }
  });

  // Fetch live odds every minute (near real-time)
  cron.schedule('*/1 * * * *', async () => {
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