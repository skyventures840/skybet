const mongoose = require('mongoose');
// Logger removed during cleanup - using console for now
const config = require('../config/config');
const { retryMongoOperation, handleMongoError } = require('../utils/mongoRetry');

const MONGODB_URI = config.mongoURI;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is not configured in environment variables');
}
const DB_NAME = process.env.MONGODB_DB_NAME || 'platypus';
const COLLECTION_NAME = 'matches';

/**
 * Connect to MongoDB using mongoose (already handled in server.js)
 */
const connectToMongo = async () => {
  // This function is kept for compatibility but actual connection
  // is handled in server.js with enhanced configuration
  return mongoose.connection.readyState === 1;
};

/**
 * Save matches to database with retry logic
 */
const saveMatchesToDB = async (matches) => {
  return await retryMongoOperation(async () => {
    if (!matches || matches.length === 0) {
      console.log('No matches to save');
      return { saved: 0, errors: 0 };
    }

    let saved = 0;
    let errors = 0;

    for (const match of matches) {
      try {
        // Assuming you have a Match model - adjust as needed
        const existingMatch = await mongoose.model('Match').findOne({
          id: match.id,
          sport_key: match.sport_key
        });

        if (!existingMatch) {
          await mongoose.model('Match').create(match);
          saved++;
        }
      } catch (error) {
        console.error('Error saving match:', error.message);
        errors++;
      }
    }

    console.log(`Saved ${saved} matches, ${errors} errors`);
    return { saved, errors };
  });
};

/**
 * Enhanced connection health check using mongoose
 */
const checkConnectionHealth = async () => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return false;
    }
    
    // Ping the database
    await mongoose.connection.db.admin().ping();
    return true;
  } catch (error) {
    console.error('MongoDB health check failed:', error.message);
    return false;
  }
};



/**
 * MongoDB Connection Monitor using Mongoose
 */
class MongoConnectionMonitor {
  constructor(connection) {
    this.connection = connection;
    this.isMonitoring = false;
    this.healthStats = {
      lastCheck: null,
      consecutiveFailures: 0,
      totalChecks: 0,
      totalFailures: 0,
      averageResponseTime: 0,
      responseTimes: []
    };
    this.monitorInterval = null;
  }

  startMonitoring(intervalMs = 30000) {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    console.log('Starting MongoDB connection monitoring...');
    
    this.monitorInterval = setInterval(() => {
      this.checkConnection();
    }, intervalMs);
  }

  stopMonitoring() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    console.log('MongoDB connection monitoring stopped');
  }

  async checkConnection() {
    const startTime = Date.now();
    this.healthStats.totalChecks++;
    this.healthStats.lastCheck = new Date();

    try {
      // Use mongoose admin command to check connection
      await this.connection.db.admin().ping();
      
      const responseTime = Date.now() - startTime;
      this.healthStats.responseTimes.push(responseTime);
      
      // Keep only last 10 response times for average calculation
      if (this.healthStats.responseTimes.length > 10) {
        this.healthStats.responseTimes.shift();
      }
      
      this.healthStats.averageResponseTime = 
        this.healthStats.responseTimes.reduce((a, b) => a + b, 0) / 
        this.healthStats.responseTimes.length;
      
      this.healthStats.consecutiveFailures = 0;
      
      console.log(`MongoDB health check passed (${responseTime}ms)`);
    } catch (error) {
      this.healthStats.totalFailures++;
      this.healthStats.consecutiveFailures++;
      
      console.error('MongoDB health check failed:', error.message);
      
      if (this.healthStats.consecutiveFailures >= 3) {
        console.error('MongoDB connection appears to be unstable - 3 consecutive failures');
      }
    }
  }

  getHealthStatus() {
    return {
      isConnected: this.connection.readyState === 1,
      readyState: this.connection.readyState,
      lastCheck: this.healthStats.lastCheck,
      consecutiveFailures: this.healthStats.consecutiveFailures,
      totalChecks: this.healthStats.totalChecks,
      totalFailures: this.healthStats.totalFailures,
      averageResponseTime: Math.round(this.healthStats.averageResponseTime),
      uptime: this.connection.readyState === 1 ? 'connected' : 'disconnected'
    };
  }
}

module.exports = {
  connectToMongo,
  saveMatchesToDB,
  checkConnectionHealth,
  handleMongoError,
  MongoConnectionMonitor
};