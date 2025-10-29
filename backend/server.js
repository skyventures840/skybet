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

// Import Socket.io server
const { createSocketIOServer } = require('./events/socketioServer');
// Import WebSocket server
const WebSocketServer = require('./websocketServer');
const keepAliveService = require('./services/keepAliveService');
const compression = require('compression');
const sharp = require('sharp');
const { cache, get, set, del } = require('./utils/cache');

// Import cron jobs
const startCronJobs = require('./cron');

// Import health monitoring
const { healthMonitor, isServerHealthy, updateCronStatus, incrementErrorCount } = require('./middleware/healthMonitor');

// Import MongoDB utilities
const { MongoConnectionMonitor, handleMongoError } = require('./services/mongoService');

const app = express();
const PORT = process.env.PORT_BACKEND || process.env.PORT || 10000;

// Global MongoDB connection monitor
let mongoMonitor = null;

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
      connectSrc: ["'self'", "https:", "http:", "wss:", "ws:"],
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
app.use(compression());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Enhanced health check endpoint for hosting platforms
app.get('/health', async (req, res) => {
  const healthy = isServerHealthy();
  const status = healthy ? 'OK' : 'UNHEALTHY';
  
  // Comprehensive health metrics
  const healthData = {
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    healthy,
    system: {
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
      },
      cpu: process.cpuUsage(),
      nodeVersion: process.version,
      platform: process.platform
    },
    services: {
      database: 'unknown',
      websocket: global.websocketServer ? 'active' : 'inactive',
      socketio: 'active'
    },
    mongodb: {
      connected: mongoose.connection.readyState === 1,
      state: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name
    }
  };

  // Check database connection
  try {
    if (mongoose.connection.readyState === 1) {
      healthData.services.database = 'connected';
    } else {
      healthData.services.database = 'disconnected';
    }
  } catch (error) {
    healthData.services.database = 'error';
  }

  // Add MongoDB connection health if monitor is available
  if (mongoMonitor) {
    healthData.mongodb.health = mongoMonitor.getHealthStatus();
  }

  // Add WebSocket connection count if available
  if (global.websocketServer && global.websocketServer.wss) {
    healthData.services.websocketConnections = global.websocketServer.wss.clients.size;
  }

  res.status(healthy ? 200 : 503).json(healthData);
});

// Keep-alive endpoint for external monitoring services
app.get('/ping', (req, res) => {
  res.status(200).json({ 
    pong: true, 
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
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

// On-the-fly WebP conversion for images to reduce payload
app.get('/uploads/webp/*', async (req, res) => {
  try {
    const relPath = req.params[0];
    const absPath = path.join(__dirname, 'uploads', relPath);
    const webpKey = `/uploads/webp/${relPath}`;
    const cached = get(webpKey);
    if (cached) {
      res.setHeader('Content-Type', 'image/webp');
      return res.end(cached);
    }
    const buffer = await sharp(absPath).webp({ quality: 75 }).toBuffer();
    set(webpKey, {}, buffer, 3600);
    res.setHeader('Content-Type', 'image/webp');
    res.end(buffer);
  } catch (e) {
    res.status(404).json({ error: 'Image not found' });
  }
});

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
  const io = createSocketIOServer(server);
  module.exports.io = io;

  // Initialize WebSocket server
  global.websocketServer = new WebSocketServer(server);
  console.log('WebSocket server initialized');

  // Initialize keep-alive service to prevent server sleeping
  keepAliveService.initialize();
  console.log('Keep-alive service initialized');

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    keepAliveService.stop();
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
    keepAliveService.stop();
    
    // Stop MongoDB monitoring
    if (mongoMonitor) {
      mongoMonitor.stopMonitoring();
    }
    
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

// MongoDB connection with enhanced error handling and monitoring
const connectToMongoDB = async () => {
  try {
    console.log('Connecting to MongoDB...');
    
    const mongoUri = process.env.MONGODB_EXTERNAL_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MongoDB URI not found in environment variables');
    }

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 60000,
      socketTimeoutMS: 60000,
      connectTimeoutMS: 60000,
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 30000,
      retryWrites: true,
      retryReads: true,
      bufferCommands: false,
      heartbeatFrequencyMS: 10000,
      family: 4
    });

    console.log('Connected to MongoDB successfully');
    
    // Initialize connection monitor
    mongoMonitor = new MongoConnectionMonitor(mongoose.connection);
    mongoMonitor.startMonitoring();
    
    // Set up connection event handlers
    mongoose.connection.on('error', (error) => {
      console.error('MongoDB connection error:', error);
      handleMongoError(error);
      incrementErrorCount();
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected');
      incrementErrorCount();
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected');
    });

    return true;
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    handleMongoError(error);
    incrementErrorCount();
    throw error;
  }
};

// Connect to MongoDB if configured; otherwise start server in degraded mode
const mongoURI = process.env.MONGODB_URI || process.env.MONGODB_EXTERNAL_URI;

if (mongoURI) {
  console.log('🔗 Attempting to connect to MongoDB...');
  console.log('📍 MongoDB URI configured:', mongoURI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));

  connectToMongoDB()
    .then(async () => {
      console.log('Connected to MongoDB');
      
      // Start cron jobs after successful MongoDB connection
      startCronJobs();
      updateCronStatus(true);
      
      // Start HTTP and WebSocket servers
      startHttpAndWsServers();
    })
    .catch((error) => {
      console.error('MongoDB connection failed:', error);
      incrementErrorCount();
      
      // Start server in degraded mode without MongoDB
      console.log('Starting server in degraded mode without MongoDB...');
      startHttpAndWsServers();
    });
} else {
  console.warn('⚠️ MONGODB_URI not set; starting server without DB connection');
  startHttpAndWsServers();
  // Intentionally do NOT start cron when DB is unavailable to avoid non-persistent writes
}

module.exports = app;
