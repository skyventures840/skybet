const { retryMongoOperation, handleMongoError } = require('../services/mongoRetry');

/**
 * Middleware to wrap MongoDB operations with retry logic and error handling
 */
const mongoOperationMiddleware = (operation) => {
  return async (req, res, next) => {
    try {
      // Wrap the operation with retry logic
      const result = await retryMongoOperation(operation, req, res);
      req.mongoResult = result;
      next();
    } catch (error) {
      console.error('MongoDB operation failed after retries:', error);
      handleMongoError(error);
      
      // Send appropriate error response
      if (error.name === 'MongoNetworkTimeoutError') {
        return res.status(503).json({
          error: 'Database temporarily unavailable',
          message: 'Please try again in a moment',
          code: 'DB_TIMEOUT'
        });
      }
      
      if (error.name === 'MongoServerSelectionError') {
        return res.status(503).json({
          error: 'Database connection failed',
          message: 'Service temporarily unavailable',
          code: 'DB_CONNECTION_FAILED'
        });
      }
      
      // Generic database error
      return res.status(500).json({
        error: 'Database operation failed',
        message: 'An unexpected error occurred',
        code: 'DB_ERROR'
      });
    }
  };
};

/**
 * Helper function to create a MongoDB operation wrapper
 */
const createMongoOperation = (modelOperation) => {
  return async (req, res) => {
    return await modelOperation(req, res);
  };
};

/**
 * Middleware specifically for handling MongoDB model operations
 */
const withMongoRetry = (modelMethod, ...args) => {
  return retryMongoOperation(async () => {
    return await modelMethod(...args);
  });
};

module.exports = {
  mongoOperationMiddleware,
  createMongoOperation,
  withMongoRetry
};