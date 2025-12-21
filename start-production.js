#!/usr/bin/env node

/**
 * Production startup script for Platypus Backend
 * This script handles graceful shutdown and production optimizations
 */

require('dotenv').config();

// Validate environment variables before starting
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  console.error('Please ensure all required environment variables are set in Render.');
  process.exit(1);
}

const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const logger = require('./utils/logger');

// Check if we should run in cluster mode
// Disable clustering on Render to avoid issues with their infrastructure
const shouldCluster = process.env.NODE_ENV === 'production' && process.env.CLUSTER_MODE === 'true' && process.env.RENDER !== 'true';

if (shouldCluster && cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);

  // Fork workers
  const numWorkers = process.env.WORKER_COUNT || Math.min(numCPUs, 4);
  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    logger.error(`Worker ${worker.process.pid} died`, { code, signal });
    console.log(`Worker ${worker.process.pid} died`);
    
    // Restart worker if it died unexpectedly
    if (!worker.exitedAfterDisconnect) {
      console.log('Starting a new worker');
      cluster.fork();
    }
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('Master received SIGTERM, shutting down gracefully');
    for (const id in cluster.workers) {
      cluster.workers[id].kill();
    }
  });

  process.on('SIGINT', () => {
    console.log('Master received SIGINT, shutting down gracefully');
    for (const id in cluster.workers) {
      cluster.workers[id].kill();
    }
  });

} else {
  // Worker process or single process mode
  const app = require('./server');
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    console.error('Uncaught Exception:', error);
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('Worker received SIGTERM, shutting down gracefully');
    console.log('Worker received SIGTERM, shutting down gracefully');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('Worker received SIGINT, shutting down gracefully');
    console.log('Worker received SIGINT, shutting down gracefully');
    process.exit(0);
  });

  // Log startup
  logger.info('Platypus Backend started', {
    pid: process.pid,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime()
  });
}
