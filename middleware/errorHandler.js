// Logger removed during cleanup - using console for now

const errorHandler = (err, req, res, next) => {
  // Generate unique error ID for tracking
  const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Log the error with context
  console.error('Unhandled error occurred', {
    errorId,
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    body: req.method !== 'GET' ? req.body : undefined,
    query: req.query
  });

  const statusCode = err.statusCode || 500;
  
  // Different error messages for production vs development
  let message;
  if (process.env.NODE_ENV === 'production') {
    // Generic message for production to avoid exposing internals
    message = statusCode >= 500 ? 'Internal server error' : err.message;
  } else {
    message = err.message || 'Something went wrong!';
  }

  const errorResponse = {
    status: 'error',
    statusCode,
    message,
    errorId,
    timestamp: new Date().toISOString()
  };

  // Include stack trace only in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
};

module.exports = errorHandler;