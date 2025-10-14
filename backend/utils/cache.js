const NodeCache = require('node-cache');
const EventEmitter = require('events');

// Global in-memory cache with standard TTL and checkperiod
const cache = new NodeCache({ stdTTL: 60, checkperiod: 120, useClones: false });

// Event bus for invalidation and broadcast hooks
const bus = new EventEmitter();

function keyFor(path, params = {}) {
  const p = Object.keys(params).length ? `?${Object.entries(params).map(([k,v]) => `${k}=${v}`).join('&')}` : '';
  return `${path}${p}`;
}

function get(path, params) {
  return cache.get(keyFor(path, params));
}

function set(path, params, value, ttlSeconds = 60) {
  cache.set(keyFor(path, params), value, ttlSeconds);
}

function del(pathPrefix) {
  const keys = cache.keys().filter(k => k.startsWith(pathPrefix));
  if (keys.length) cache.del(keys);
}

// Invalidate caches when data changes
bus.on('matches:changed', () => del('/api/matches'));
bus.on('sports:changed', () => del('/api/sports'));

module.exports = { cache, bus, get, set, del, keyFor };