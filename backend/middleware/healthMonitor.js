const logger = require('../utils/logger');

// Track server health metrics
let healthMetrics = {
  requestCount: 0,
  errorCount: 0,
  lastCronJob: null,
  cronJobInProgress: false,
  memoryUsage: 0,
  responseTime: 0
};

// Middleware to monitor server health
const healthMonitor = (req, res, next) => {
  const startTime = Date.now();
  
  // Track request count
  healthMetrics.requestCount++;
  
  // Monitor memory usage
  const memUsage = process.memoryUsage();
  healthMetrics.memoryUsage = Math.round(memUsage.heapUsed / 1024 / 1024); // MB
  
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    healthMetrics.responseTime = responseTime;
    
    // Log slow requests
    if (responseTime > 5000) {
      logger.warn(`Slow request detected: ${req.method} ${req.path} took ${responseTime}ms`);
    }
    
    // Log high memory usage
    if (healthMetrics.memoryUsage > 500) { // 500MB
      logger.warn(`High memory usage detected: ${healthMetrics.memoryUsage}MB`);
    }
  });
  
  next();
};

// Function to check if server is healthy
const isServerHealthy = () => {
  const memUsage = process.memoryUsage();
  const memoryMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  
  // Server is unhealthy if:
  // - Memory usage is too high (> 800MB)
  // - Too many errors recently
  // - Cron job has been running too long (> 10 minutes)
  const isMemoryHigh = memoryMB > 800;
  const isErrorRateHigh = healthMetrics.errorCount > healthMetrics.requestCount * 0.1; // 10% error rate
  const isCronStuck = healthMetrics.cronJobInProgress && 
    healthMetrics.lastCronJob && 
    (Date.now() - healthMetrics.lastCronJob) > 600000; // 10 minutes
  
  return !isMemoryHigh && !isErrorRateHigh && !isCronStuck;
};

// Function to update cron job status
const updateCronStatus = (inProgress, jobName) => {
  healthMetrics.cronJobInProgress = inProgress;
  if (inProgress) {
    healthMetrics.lastCronJob = Date.now();
    logger.info(`Cron job started: ${jobName}`);
  } else {
    logger.info(`Cron job completed: ${jobName}`);
  }
};

// Function to increment error count
const incrementErrorCount = () => {
  healthMetrics.errorCount++;
};

// Function to get health metrics
const getHealthMetrics = () => {
  return {
    ...healthMetrics,
    isHealthy: isServerHealthy(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage()
  };
};

module.exports = {
  healthMonitor,
  isServerHealthy,
  updateCronStatus,
  incrementErrorCount,
  getHealthMetrics
};
