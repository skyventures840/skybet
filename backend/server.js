require('dotenv').config({ override: true });

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Import routes
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const matchesRoutes = require('./routes/matches');
const betsRoutes = require('./routes/bets');
const multiBetsRoutes = require('./routes/multiBets');
const oddsRoutes = require('./routes/odds');
const sportsRoutes = require('./routes/sports');
const paymentsRoutes = require('./routes/payments');
const adminRoutes = require('./routes/admin');
const wheelRoutes = require('./routes/wheel');

// Import WebSocket server
const WebSocketServer = require('./websocketServer');

// Import cron jobs
const startCronJobs = require('./cron');

// Import health monitoring
const { healthMonitor, isServerHealthy, updateCronStatus, incrementErrorCount } = require('./middleware/healthMonitor');

const app = express();
const PORT = process.env.PORT_BACKEND || process.env.PORT || 10000;

// Avoid buffering writes when MongoDB is not connected
mongoose.set('bufferCommands', false);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "ws:"],
    },
  },
}));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = process.env.FRONTEND_URL 
      ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
      : ['http://localhost:3000', 'https://localhost:3000'];
    
    // Allow Render preview URLs
    if (origin && origin.includes('.onrender.com')) {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// General rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 500 requests per windowMs (increased for development)
  message: 'Too many requests from this IP, please try again later.'
});

// More lenient rate limiting for profile and auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 auth requests per windowMs
  message: 'Too many authentication requests from this IP, please try again later.'
});

// More lenient rate limiting for payment endpoints
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 payment requests per windowMs
  message: 'Too many payment requests from this IP, please try again later.',
  skip: (req) => {
    // Skip rate limiting for mock payments or if USE_MOCK_PAYMENTS is enabled
    return process.env.USE_MOCK_PAYMENTS === 'true';
  }
});

// Apply health monitoring to all routes
app.use(healthMonitor);

// Apply general rate limiting to all API routes
app.use('/api/', generalLimiter);

// Apply specific rate limiting to auth routes
app.use('/api/auth', authLimiter);

// Apply specific rate limiting to payment routes
app.use('/api/payments/create', paymentLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  const healthy = isServerHealthy();
  const status = healthy ? 'OK' : 'UNHEALTHY';
  
  res.status(healthy ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    healthy
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/matches', matchesRoutes);
app.use('/api/bets', betsRoutes);
app.use('/api/multibets', multiBetsRoutes);
app.use('/api/odds', oddsRoutes);
app.use('/api/sports', sportsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/wheel', wheelRoutes);

// Serve static uploads (videos, posters, hero images) with proper headers
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '1d', // Cache for 1 day
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    // Set appropriate headers for different file types
    if (path.endsWith('.mp4') || path.endsWith('.webm') || path.endsWith('.ogg')) {
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
    } else if (path.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
    }
  }
}));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Increment error count for health monitoring
  incrementErrorCount();
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: Object.values(err.errors).map(e => e.message)
    });
  }
  
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }
  
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired'
    });
  }
  
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Helper to start HTTP and WebSocket servers (with or without DB)
function startHttpAndWsServers() {
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  const wsServer = new WebSocketServer(server);
  global.websocketServer = wsServer;
  module.exports.io = wsServer;
  wsServer.startHeartbeat();

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    wsServer.shutdown();
    server.close(() => {
      console.log('HTTP server closed');
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        mongoose.connection.close(() => {
          console.log('MongoDB connection closed');
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    });
  });

  process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    wsServer.shutdown();
    server.close(() => {
      console.log('HTTP server closed');
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        mongoose.connection.close(() => {
          console.log('MongoDB connection closed');
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    });
  });
}

// Connect to MongoDB if configured; otherwise start server in degraded mode
const mongoURI = process.env.MONGODB_URI || process.env.MONGODB_EXTERNAL_URI;

if (mongoURI) {
  console.log('🔗 Attempting to connect to MongoDB...');
  console.log('📍 MongoDB URI configured:', mongoURI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));

  mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 30000,
    connectTimeoutMS: 30000,
  })
  .then(() => {
    console.log('Connected to MongoDB');
    startHttpAndWsServers();
    // Start cron only after a successful DB connection to ensure persistence
    try {
      startCronJobs();
      console.log('Cron jobs started after successful DB connection');
    } catch (cronErr) {
      console.warn('Failed to start cron jobs:', cronErr && cronErr.message ? cronErr.message : cronErr);
    }
  })
  .catch((err) => {
    console.warn('⚠️ Failed to connect to MongoDB, starting server without DB:', err && err.message ? err.message : err);
    startHttpAndWsServers();
    // Intentionally do NOT start cron when DB is unavailable to avoid non-persistent writes
  });
} else {
  console.warn('⚠️ MONGODB_URI not set; starting server without DB connection');
  startHttpAndWsServers();
  // Intentionally do NOT start cron when DB is unavailable to avoid non-persistent writes
}

module.exports = app;
