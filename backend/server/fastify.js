require('dotenv').config({ override: true });

const fastify = require('fastify')({ logger: true, trustProxy: true });
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const sharp = require('sharp');
const { createSocketIOServer } = require('../events/socketioServer');
const WebSocketServer = require('../websocketServer');
const keepAliveService = require('../services/keepAliveService');
const { healthMonitor, isServerHealthy, updateCronStatus, incrementErrorCount } = require('../middleware/healthMonitor');
const startCronJobs = require('../cron');
const { get: cacheGet, set: cacheSet } = require('../utils/cache');
const { bus } = require('../utils/cache');
const fs = require('fs');

const authRoutes = require('../routes/auth');
const usersRoutes = require('../routes/users');
const matchesRoutes = require('../routes/matches');
const betsRoutes = require('../routes/bets');
const multiBetsRoutes = require('../routes/multiBets');
const oddsRoutes = require('../routes/odds');
const sportsRoutes = require('../routes/sports');
const paymentsRoutes = require('../routes/payments');
const adminRoutes = require('../routes/admin');
const wheelRoutes = require('../routes/wheel');

const PORT = process.env.PORT_BACKEND || process.env.PORT || 10000;

try {
  sharp.cache({ files: 0, memory: 0 });
  sharp.concurrency(2);
} catch (_) {}

// Plugins (compression via Fastify, CORS/Helmet via Express middleware for compatibility)
fastify.register(require('@fastify/compress'), {
  global: true,
  encodings: ['br', 'gzip']
});

// Global request logging
fastify.addHook('onRequest', async (req, reply) => {
  fastify.log.info(`${new Date().toISOString()} - ${req.method} ${req.url}`);
});

// WebP conversion endpoint
fastify.get('/uploads/webp/*', async (request, reply) => {
  try {
    const relPath = request.params['*'];
    const absPath = path.join(__dirname, '..', 'uploads', relPath);
    const webpKey = `/uploads/webp/${relPath}`;
    const cached = cacheGet(webpKey, {});
    if (cached) {
      reply.header('Content-Type', 'image/webp');
      return reply.send(cached);
    }
    let sizeOk = true;
    try {
      const stat = fs.statSync(absPath);
      if (stat.size > 10 * 1024 * 1024) sizeOk = false;
    } catch (_) { sizeOk = true; }
    if (!sizeOk) return reply.code(413).send({ error: 'Image too large to convert' });
    try {
      const meta = await sharp(absPath).metadata();
      const pixels = (meta.width || 0) * (meta.height || 0);
      if (pixels > 8000 * 8000) return reply.code(413).send({ error: 'Image dimensions too large to convert' });
    } catch (_) {}
    const buffer = await sharp(absPath).webp({ quality: 75 }).toBuffer();
    cacheSet(webpKey, {}, buffer, 3600);
    reply.header('Content-Type', 'image/webp');
    return reply.send(buffer);
  } catch (_) {
    return reply.code(404).send({ error: 'Image not found' });
  }
});

// Health endpoints
fastify.get('/health', async (request, reply) => {
  const healthy = isServerHealthy();
  const data = {
    status: healthy ? 'OK' : 'UNHEALTHY',
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
    mongodb: {
      connected: mongoose.connection.readyState === 1,
      state: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name
    }
  };
  reply.code(healthy ? 200 : 503).send(data);
});

fastify.get('/ping', async () => ({ pong: true, timestamp: new Date().toISOString(), uptime: Math.floor(process.uptime()) }));

// Mongo connection
async function connectToMongoDB() {
  const mongoUri = process.env.MONGODB_EXTERNAL_URI || process.env.MONGODB_URI;
  if (!mongoUri) return false;
  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 30000,
    connectTimeoutMS: 10000,
    maxPoolSize: 100,
    minPoolSize: 2,
    maxIdleTimeMS: 30000,
    retryWrites: true,
    retryReads: true,
    bufferCommands: false,
    heartbeatFrequencyMS: 10000,
    family: 4
  });
  return true;
}

async function start() {
  try {
    const helmet = require('helmet');
    const cors = require('cors');
    const corsOptions = {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const allowedOrigins = [];
        if (process.env.FRONTEND_URL) {
          const frontendUrls = process.env.FRONTEND_URL.split(',').map(url => url.trim());
          allowedOrigins.push(...frontendUrls);
        }
        allowedOrigins.push('http://localhost:3000', 'https://localhost:3000');
        allowedOrigins.push('https://skybet-frontend.onrender.com');
        if (origin && origin.includes('.onrender.com')) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    };

    // Enable Express-like middlewares and routers
    await fastify.register(require('@fastify/express'));

    // Body parsers for Express routers
    fastify.use(express.json({ limit: '10mb' }));
    fastify.use(express.urlencoded({ extended: true, limit: '10mb' }));
    fastify.use(helmet());
    fastify.use(cors(corsOptions));

    // Health monitor on all routes
    fastify.use((req, res, next) => healthMonitor(req, res, next));

    // Global quick-lru response cache for GET
    const QuickLRU = require('quick-lru').default;
    const responseCache = new QuickLRU({ maxSize: 5000 });
    const prefixMap = new Map();
    fastify.use((req, res, next) => {
      try {
        if (req.method !== 'GET') return next();
        const url = req.originalUrl || req.url || req.path;
        const uid = req.user && req.user.id ? req.user.id : 'anon';
        const key = `${url}|u=${uid}`;
        const prefix = (url || '').split('?')[0].split('/').slice(0,3).join('/');
        const entry = responseCache.get(key);
        if (entry && (!entry.expireAt || Date.now() < entry.expireAt)) {
          res.setHeader('X-Cache', 'HIT');
          if (entry.headers) Object.entries(entry.headers).forEach(([k,v]) => res.setHeader(k, v));
          return res.statusCode = entry.statusCode, res.end(entry.payload);
        }
        const originalJson = res.json.bind(res);
        res.json = (data) => {
          try {
            const payload = Buffer.from(JSON.stringify(data));
            if (payload.length > 1024 * 1024) {
              res.setHeader('X-Cache', 'SKIP');
              return originalJson(data);
            }
            const ttl = 60;
            const headers = { 'Cache-Control': `public, max-age=30, stale-while-revalidate=${ttl}` };
            responseCache.set(key, { payload, headers, statusCode: res.statusCode || 200, expireAt: Date.now() + ttl * 1000 });
            if (!prefixMap.has(prefix)) prefixMap.set(prefix, new Set());
            prefixMap.get(prefix).add(key);
            res.setHeader('X-Cache', 'MISS');
            Object.entries(headers).forEach(([k,v]) => res.setHeader(k, v));
          } catch (_) {}
          return originalJson(data);
        };
        next();
      } catch (e) {
        next();
      }
    });

    function invalidatePrefix(prefix) {
      const set = prefixMap.get(prefix);
      if (!set) return;
      for (const k of set) responseCache.delete(k);
      prefixMap.delete(prefix);
    }
    bus.on('matches:changed', () => invalidatePrefix('/api/matches'));
    bus.on('odds:changed', () => invalidatePrefix('/api/odds'));
    bus.on('sports:changed', () => invalidatePrefix('/api/sports'));
    bus.on('bets:changed', () => invalidatePrefix('/api/bets'));
    bus.on('users:changed', () => invalidatePrefix('/api/users'));

    // API routes via Express routers
    fastify.use('/api/auth', authRoutes);
    fastify.use('/api/users', usersRoutes);
    fastify.use('/api/matches', matchesRoutes);
    fastify.use('/api/bets', betsRoutes);
    fastify.use('/api/multibets', multiBetsRoutes);
    fastify.use('/api/odds', oddsRoutes);
    fastify.use('/api/sports', sportsRoutes);
    fastify.use('/api/payments', paymentsRoutes);
    fastify.use('/api/admin', adminRoutes);
    fastify.use('/api/wheel', wheelRoutes);

    // Static uploads
    fastify.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), {
      maxAge: '1d',
      etag: true,
      lastModified: true,
      setHeaders: (res, p) => {
        if (p.endsWith('.mp4') || p.endsWith('.webm') || p.endsWith('.ogg')) {
          res.setHeader('Content-Type', 'video/mp4');
          res.setHeader('Cache-Control', 'public, max-age=86400');
        } else if (p.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          res.setHeader('Cache-Control', 'public, max-age=86400');
        }
      }
    }));
    const mongoURI = process.env.MONGODB_URI || process.env.MONGODB_EXTERNAL_URI;
    if (mongoURI) {
      await connectToMongoDB();
      startCronJobs();
      updateCronStatus(true);
    }

    await fastify.listen({ port: PORT, host: '0.0.0.0' });

    const io = createSocketIOServer(fastify.server);
    module.exports.io = io;

    global.websocketServer = new WebSocketServer(fastify.server);

    const keepAliveBase = process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    keepAliveService.initialize(keepAliveBase, true);

    process.on('SIGTERM', async () => {
      keepAliveService.stop();
      try { await fastify.close(); } catch (_) {}
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      keepAliveService.stop();
      try { await fastify.close(); } catch (_) {}
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
      process.exit(0);
    });
  } catch (err) {
    incrementErrorCount();
    fastify.log.error(err);
    process.exit(1);
  }
}

start();

module.exports = fastify;
