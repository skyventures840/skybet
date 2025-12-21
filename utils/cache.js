const QuickLRU = require('quick-lru').default;
const EventEmitter = require('events');

// quick-lru-based cache with TTL metadata
const MAX_SIZE = parseInt(process.env.CACHE_MAX_SIZE || '', 10);
const store = new QuickLRU({ maxSize: Number.isFinite(MAX_SIZE) && MAX_SIZE > 0 ? MAX_SIZE : 3000 });

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
  const entry = store.get(key);
  if (!entry) {
    stats.misses++;
    return undefined;
  }
  if (entry.expireAt && Date.now() > entry.expireAt) {
    store.delete(key);
    stats.misses++;
    return undefined;
  }
  stats.hits++;
  return entry.value;
}

function set(path, params, value, ttlSeconds = 300) {
  try {
    if (value == null) return false;
    const key = keyFor(path, params);
    store.set(key, { value, expireAt: ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null });
    stats.sets++;
    return true;
  } catch (error) {
    console.warn('Cache set error:', error.message);
    return false;
  }
}

function del(pathPrefix) {
  try {
    const keys = Array.from(store.keys()).filter(k => k.startsWith(pathPrefix));
    for (const k of keys) store.delete(k);
    stats.deletes += keys.length;
    return keys.length;
  } catch (error) {
    console.warn('Cache delete error:', error.message);
    return 0;
  }
}

// Enhanced cache management
function clear() {
  store.clear();
  Object.keys(stats).forEach(key => stats[key] = 0);
}

function getStats() {
  return {
    ...stats,
    keys: store.size,
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
  const keyCount = store.size;
  const limit = Number.isFinite(MAX_SIZE) && MAX_SIZE > 0 ? MAX_SIZE : 3000;
  const warnAt = Math.floor(limit * 0.8);
  if (keyCount > warnAt) {
    console.warn(`Cache approaching limit: ${keyCount}/${limit} entries`);
  }
}, 300000);

// Support legacy cache.get(cacheKey) / cache.set(cacheKey, value, ttl)
function getByKey(key) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expireAt && Date.now() > entry.expireAt) {
    store.delete(key);
    return undefined;
  }
  stats.hits++;
  return entry.value;
}

function setByKey(key, value, ttlSeconds = 300) {
  try {
    if (value == null) return false;
    store.set(key, { value, expireAt: ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null });
    stats.sets++;
    return true;
  } catch (_) {
    return false;
  }
}

const cache = { get: getByKey, set: setByKey };

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
