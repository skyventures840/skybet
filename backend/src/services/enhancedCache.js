
class EnhancedCacheService {
  constructor() {
    this.memoryCache = new Map();
    this.CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds
    this.SKELETON_DURATION = 4000; // 4 seconds for skeleton loading
    this.firstLoadTimestamp = null;
    this.isFirstLoad = true;
  }

  getCacheKey(endpoint) {
    return `enhanced_cache:${endpoint}`;
  }

  /**
   * Get timestamp key for localStorage
   */
  getTimestampKey(endpoint) {
    return `enhanced_cache_timestamp:${endpoint}`;
  }

  /**
   * Check if cache is valid (within 30 minutes)
   */
  isCacheValid(timestamp) {
    if (!timestamp) return false;
    return (Date.now() - timestamp) < this.CACHE_DURATION;
  }

  /**
   * Get cached data from memory or localStorage
   */
  getCachedData(endpoint) {
    // Check memory cache first (fastest)
    const memoryData = this.memoryCache.get(endpoint);
    if (memoryData && this.isCacheValid(memoryData.timestamp)) {
      console.log(`[ENHANCED CACHE] Memory hit for ${endpoint}`);
      return memoryData.data;
    }

    // Check localStorage cache
    try {
      const cacheKey = this.getCacheKey(endpoint);
      const timestampKey = this.getTimestampKey(endpoint);
      
      const cachedData = localStorage.getItem(cacheKey);
      const timestamp = parseInt(localStorage.getItem(timestampKey));
      
      if (cachedData && this.isCacheValid(timestamp)) {
        const parsedData = JSON.parse(cachedData);
        
        // Warm memory cache for next access
        this.memoryCache.set(endpoint, {
          data: parsedData,
          timestamp: timestamp
        });
        
        console.log(`[ENHANCED CACHE] LocalStorage hit for ${endpoint}`);
        return parsedData;
      }
    } catch (error) {
      console.warn(`[ENHANCED CACHE] Error reading cache for ${endpoint}:`, error);
    }

    return null;
  }

  /**
   * Store data in both memory and localStorage
   */
  setCachedData(endpoint, data) {
    const timestamp = Date.now();
    
    // Store in memory cache
    this.memoryCache.set(endpoint, {
      data: data,
      timestamp: timestamp
    });

    // Store in localStorage
    try {
      const cacheKey = this.getCacheKey(endpoint);
      const timestampKey = this.getTimestampKey(endpoint);
      
      localStorage.setItem(cacheKey, JSON.stringify(data));
      localStorage.setItem(timestampKey, timestamp.toString());
      
      console.log(`[ENHANCED CACHE] Cached data for ${endpoint}`);
    } catch (error) {
      console.warn(`[ENHANCED CACHE] Error storing cache for ${endpoint}:`, error);
    }
  }

  /**
   * Clear cache for specific endpoint
   */
  clearCache(endpoint) {
    this.memoryCache.delete(endpoint);
    
    try {
      localStorage.removeItem(this.getCacheKey(endpoint));
      localStorage.removeItem(this.getTimestampKey(endpoint));
      console.log(`[ENHANCED CACHE] Cleared cache for ${endpoint}`);
    } catch (error) {
      console.warn(`[ENHANCED CACHE] Error clearing cache for ${endpoint}:`, error);
    }
  }

  /**
   * Clear all cached data
   */
  clearAllCache() {
    this.memoryCache.clear();
    
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('enhanced_cache')) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log(`[ENHANCED CACHE] Cleared all cache data`);
    } catch (error) {
      console.warn(`[ENHANCED CACHE] Error clearing all cache:`, error);
    }
  }

  /**
   * Check if skeleton loading should be shown
   * Only shows for first 4 seconds on initial page load
   */
  shouldShowSkeleton() {
    if (!this.isFirstLoad) {
      return false;
    }

    if (!this.firstLoadTimestamp) {
      this.firstLoadTimestamp = Date.now();
      return true;
    }

    const elapsed = Date.now() - this.firstLoadTimestamp;
    if (elapsed >= this.SKELETON_DURATION) {
      this.isFirstLoad = false;
      return false;
    }

    return true;
  }

  /**
   * Mark that initial loading is complete
   */
  markInitialLoadComplete() {
    this.isFirstLoad = false;
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const memorySize = this.memoryCache.size;
    let localStorageSize = 0;
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('enhanced_cache:')) {
          localStorageSize++;
        }
      }
    } catch (error) {
      console.warn('[ENHANCED CACHE] Error getting cache stats:', error);
    }

    return {
      memoryEntries: memorySize,
      localStorageEntries: localStorageSize,
      isFirstLoad: this.isFirstLoad,
      firstLoadTimestamp: this.firstLoadTimestamp
    };
  }

  /**
   * Invalidate cache by prefix (for mutations)
   */
  invalidateByPrefix(prefix) {
    // Clear memory cache entries
    for (const [key] of this.memoryCache) {
      if (key.startsWith(prefix)) {
        this.memoryCache.delete(key);
      }
    }

    // Clear localStorage entries
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`enhanced_cache:${prefix}`)) {
          keysToRemove.push(key);
          keysToRemove.push(key.replace('enhanced_cache:', 'enhanced_cache_timestamp:'));
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log(`[ENHANCED CACHE] Invalidated cache with prefix: ${prefix}`);
    } catch (error) {
      console.warn(`[ENHANCED CACHE] Error invalidating cache with prefix ${prefix}:`, error);
    }
  }
}

// Create singleton instance
const enhancedCache = new EnhancedCacheService();

export default enhancedCache;