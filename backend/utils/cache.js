const NodeCache = require('node-cache');
const EventEmitter = require('events');

// Optimized cache configuration with better memory management
const cache = new NodeCache({ 
  stdTTL: 300, // Increased default TTL to 5 minutes
  checkperiod: 60, // More frequent cleanup
  useClones: false, // Better performance
  maxKeys: 1000, // Prevent memory overflow
  deleteOnExpire: true
});

// Event bus for invalidation and broadcast hooks
const bus = new EventEmitter();
bus.setMaxListeners(50); // Prevent memory leaks

// Cache hit/miss statistics for monitoring
const stats = {
  hits: 0,
  misses: 0,
  sets: 0,
  deletes: 0
};

function keyFor(path, params = {}) {
  // Optimize key generation with sorted params for consistency
  const sortedParams = Object.keys(params).sort().reduce((acc, key) => {
    acc[key] = params[key];
    return acc;
  }, {});
  
  const p = Object.keys(sortedParams).length 
    ? `?${Object.entries(sortedParams).map(([k,v]) => `${k}=${v}`).join('&')}` 
    : '';
  return `${path}${p}`;
}

function get(path, params) {
  const key = keyFor(path, params);
  const value = cache.get(key);
  
  if (value !== undefined) {
    stats.hits++;
    return value;
  }
  
  stats.misses++;
  return undefined;
}

function set(path, params, value, ttlSeconds = 300) {
  try {
    // Don't cache null/undefined values
    if (value == null) return false;
    
    const key = keyFor(path, params);
    const success = cache.set(key, value, ttlSeconds);
    
    if (success) {
      stats.sets++;
    }
    
    return success;
  } catch (error) {
    console.warn('Cache set error:', error.message);
    return false;
  }
}

function del(pathPrefix) {
  try {
    const keys = cache.keys().filter(k => k.startsWith(pathPrefix));
    if (keys.length) {
      cache.del(keys);
      stats.deletes += keys.length;
    }
    return keys.length;
  } catch (error) {
    console.warn('Cache delete error:', error.message);
    return 0;
  }
}

// Enhanced cache management
function clear() {
  cache.flushAll();
  Object.keys(stats).forEach(key => stats[key] = 0);
}

function getStats() {
  return {
    ...stats,
    keys: cache.keys().length,
    hitRate: stats.hits + stats.misses > 0 ? (stats.hits / (stats.hits + stats.misses) * 100).toFixed(2) + '%' : '0%'
  };
}

// Optimized invalidation patterns
const invalidationPatterns = {
  'matches:changed': ['/api/matches', '/api/odds'],
  'sports:changed': ['/api/sports', '/api/matches'],
  'bets:changed': ['/api/bets'],
  'users:changed': ['/api/users'],
  'odds:changed': ['/api/odds', '/api/matches']
};

// Register invalidation listeners
Object.entries(invalidationPatterns).forEach(([event, patterns]) => {
  bus.on(event, () => {
    patterns.forEach(pattern => del(pattern));
  });
});

// Memory monitoring
setInterval(() => {
  const keyCount = cache.keys().length;
  if (keyCount > 800) { // 80% of maxKeys
    console.warn(`Cache approaching limit: ${keyCount}/1000 keys`);
  }
}, 300000); // Check every 5 minutes

module.exports = { 
  cache, 
  bus, 
  get, 
  set, 
  del, 
  keyFor, 
  clear, 
  getStats,
  stats 
};