// const logger = require('./logger'); // Temporarily commented out

/**
 * Retry utility for MongoDB operations with exponential backoff
 */
class MongoRetryUtil {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000; // 1 second
    this.maxDelay = options.maxDelay || 30000; // 30 seconds
    this.retryableErrors = [
      'MongoNetworkError',
      'MongoNetworkTimeoutError',
      'MongoServerSelectionError',
      'MongoTimeoutError',
      'MongoWriteConcernError'
    ];
  }

  /**
   * Check if an error is retryable
   */
  isRetryableError(error) {
    if (!error) return false;
    
    // Check error name
    if (this.retryableErrors.includes(error.name)) {
      return true;
    }
    
    // Check error code for specific MongoDB errors
    const retryableCodes = [
      11000, // Duplicate key (in some cases)
      16500, // Shard config stale
      13435, // Not master
      13436, // Not master or secondary
      189,   // Primary stepped down
      91,    // Shutdown in progress
      7,     // HostUnreachable
      6,     // HostNotFound
      89,    // NetworkTimeout
      9001,  // SocketException
    ];
    
    if (error.code && retryableCodes.includes(error.code)) {
      return true;
    }
    
    // Check for timeout-related messages
    const timeoutMessages = [
      'connection timed out',
      'socket timeout',
      'server selection timeout',
      'network timeout',
      'connection closed'
    ];
    
    const errorMessage = (error.message || '').toLowerCase();
    return timeoutMessages.some(msg => errorMessage.includes(msg));
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  calculateDelay(attempt) {
    const exponentialDelay = this.baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
    return Math.min(exponentialDelay + jitter, this.maxDelay);
  }

  /**
   * Execute a MongoDB operation with retry logic
   */
  async executeWithRetry(operation, operationName = 'MongoDB operation') {
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await operation();
        
        if (attempt > 1) {
          console.log(`${operationName} succeeded on attempt ${attempt}`);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        if (!this.isRetryableError(error)) {
          console.error(`${operationName} failed with non-retryable error:`, error.message);
          throw error;
        }
        
        if (attempt === this.maxRetries) {
          console.error(`${operationName} failed after ${this.maxRetries} attempts:`, error.message);
          throw error;
        }
        
        const delay = this.calculateDelay(attempt);
        console.warn(`${operationName} failed on attempt ${attempt}, retrying in ${delay}ms:`, error.message);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  /**
   * Wrap a MongoDB model method with retry logic
   */
  wrapModelMethod(model, methodName) {
    const originalMethod = model[methodName];
    
    model[methodName] = async function(...args) {
      const retryUtil = new MongoRetryUtil();
      return retryUtil.executeWithRetry(
        () => originalMethod.apply(this, args),
        `${model.modelName}.${methodName}`
      );
    };
  }
}

/**
 * Global retry utility instance
 */
const mongoRetry = new MongoRetryUtil();

/**
 * Convenience function for retrying MongoDB operations
 */
async function retryMongoOperation(operation, operationName) {
  return mongoRetry.executeWithRetry(operation, operationName);
}

/**
 * Enhanced error handler for MongoDB operations
 */
function handleMongoError(error, context = 'MongoDB operation') {
  console.error(`${context} error:`, {
    name: error.name,
    message: error.message,
    code: error.code,
    stack: error.stack
  });
  
  // Add user-friendly error messages
  if (error.name === 'MongoNetworkTimeoutError') {
    throw new Error('Database connection timeout. Please try again.');
  } else if (error.name === 'MongoServerSelectionError') {
    throw new Error('Unable to connect to database. Please check your connection.');
  } else if (error.code === 11000) {
    throw new Error('Duplicate entry found. Please check your data.');
  } else {
    throw new Error('Database operation failed. Please try again.');
  }
}

module.exports = {
  MongoRetryUtil,
  mongoRetry,
  retryMongoOperation,
  handleMongoError
};