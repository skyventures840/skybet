const Queue = require('bull');
const logger = require('./logger');

// Create a Redis-based queue for cron jobs
const cronQueue = new Queue('cron jobs', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD
  },
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 5,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
});

// Process jobs with concurrency limit
cronQueue.process('fetchOdds', 1, async (job) => {
  const { OddsApiService } = require('../services/oddsApiService');
  const oddsApiService = new OddsApiService();
  
  try {
    logger.info('Processing odds fetch job...');
    // Your existing odds fetching logic here
    await job.progress(100);
    return { success: true };
  } catch (error) {
    logger.error('Error processing odds fetch job:', error);
    throw error;
  }
});

cronQueue.process('updateMatchStatuses', 1, async (job) => {
  try {
    logger.info('Processing match status update job...');
    // Your existing match status update logic here
    await job.progress(100);
    return { success: true };
  } catch (error) {
    logger.error('Error processing match status update job:', error);
    throw error;
  }
});

cronQueue.process('cleanupOldData', 1, async (job) => {
  try {
    logger.info('Processing cleanup job...');
    // Your existing cleanup logic here
    await job.progress(100);
    return { success: true };
  } catch (error) {
    logger.error('Error processing cleanup job:', error);
    throw error;
  }
});

module.exports = cronQueue;
