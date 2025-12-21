const axios = require('axios');
const logger = require('../utils/logger');

class KeepAliveService {
  constructor() {
    this.interval = null;
    this.isEnabled = false;
    this.pingInterval = 14 * 60 * 1000; // 14 minutes (Render free tier sleeps after 15 minutes)
    this.maxRetries = 3;
    this.baseUrl = null;
  }

  /**
   * Initialize the keep-alive service
   * @param {string} baseUrl - The base URL of the server (e.g., 'https://your-app.onrender.com')
   * @param {boolean} enabled - Whether to enable the service (default: true in production)
   */
  initialize(baseUrl = null, enabled = process.env.NODE_ENV === 'production') {
    this.baseUrl = baseUrl || process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL;
    this.isEnabled = enabled && !!this.baseUrl;

    if (this.isEnabled) {
      logger.info(`Keep-alive service initialized for ${this.baseUrl}`);
      this.start();
    } else {
      logger.info('Keep-alive service disabled (development mode or no URL configured)');
    }
  }

  /**
   * Start the keep-alive service
   */
  start() {
    if (!this.isEnabled || this.interval) {
      return;
    }

    logger.info(`Starting keep-alive service with ${this.pingInterval / 1000 / 60} minute intervals`);
    
    this.interval = setInterval(() => {
      this.ping();
    }, this.pingInterval);

    // Initial ping after 1 minute
    setTimeout(() => {
      this.ping();
    }, 60000);
  }

  /**
   * Stop the keep-alive service
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info('Keep-alive service stopped');
    }
  }

  /**
   * Perform a keep-alive ping
   */
  async ping() {
    if (!this.isEnabled || !this.baseUrl) {
      return;
    }

    let retries = 0;
    while (retries < this.maxRetries) {
      try {
        const startTime = Date.now();
        const response = await axios.get(`${this.baseUrl}/ping`, {
          timeout: 30000, // 30 second timeout
          headers: {
            'User-Agent': 'KeepAlive-Service/1.0',
            'X-Keep-Alive': 'true'
          }
        });

        const responseTime = Date.now() - startTime;
        
        if (response.status === 200) {
          logger.info(`Keep-alive ping successful (${responseTime}ms) - Server uptime: ${response.data.uptime}s`);
          return;
        } else {
          throw new Error(`Unexpected status code: ${response.status}`);
        }
      } catch (error) {
        retries++;
        const isLastRetry = retries >= this.maxRetries;
        
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          logger.warn(`Keep-alive ping failed (attempt ${retries}/${this.maxRetries}): Connection refused - Server may be sleeping`);
        } else if (error.code === 'ETIMEDOUT') {
          logger.warn(`Keep-alive ping failed (attempt ${retries}/${this.maxRetries}): Timeout - Server may be overloaded`);
        } else {
          logger.warn(`Keep-alive ping failed (attempt ${retries}/${this.maxRetries}): ${error.message}`);
        }

        if (!isLastRetry) {
          // Wait before retry (exponential backoff)
          const waitTime = Math.min(1000 * Math.pow(2, retries - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          logger.error(`Keep-alive ping failed after ${this.maxRetries} attempts`);
        }
      }
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      enabled: this.isEnabled,
      running: !!this.interval,
      baseUrl: this.baseUrl,
      pingInterval: this.pingInterval,
      nextPing: this.interval ? new Date(Date.now() + this.pingInterval).toISOString() : null
    };
  }

  /**
   * Update ping interval
   * @param {number} minutes - Interval in minutes
   */
  setPingInterval(minutes) {
    const newInterval = minutes * 60 * 1000;
    if (newInterval !== this.pingInterval) {
      this.pingInterval = newInterval;
      logger.info(`Keep-alive ping interval updated to ${minutes} minutes`);
      
      // Restart with new interval if currently running
      if (this.interval) {
        this.stop();
        this.start();
      }
    }
  }
}

// Export singleton instance
module.exports = new KeepAliveService();