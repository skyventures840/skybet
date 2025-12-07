import axios from 'axios';
import QuickLRU from 'quick-lru';
import enhancedCache from './enhancedCache';

// Use environment variable for API URL, fallback to localhost for development
const RAW_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const CLEAN_BASE = RAW_BASE.replace(/\/+$/, ''); // remove trailing slashes
const API_BASE_URL = /\/api$/.test(CLEAN_BASE) ? CLEAN_BASE : `${CLEAN_BASE}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 0,
});

// Simple in-memory cache with TTL to speed up initial loads
const lruStore = new QuickLRU({ maxSize: 500 });
const responseCache = {
  get(key) {
    const entry = lruStore.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expireAt) {
      lruStore.delete(key);
      try {
        localStorage.removeItem(`cache:${key}`);
      } catch (err) {
        void err;
      }
      return null;
    }
    return entry.response;
  },
  set(key, response, ttl) {
    lruStore.set(key, { response, expireAt: Date.now() + ttl });
  },
  delete(key) {
    lruStore.delete(key);
    try {
      localStorage.removeItem(`cache:${key}`);
    } catch (err) {
      void err;
    }
  },
  invalidate(prefix) {
    for (const k of lruStore.keys()) {
      if (String(k).startsWith(prefix)) {
        lruStore.delete(k);
      }
    }
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i) || '';
        if (k.startsWith('cache:') && k.slice(6).startsWith(prefix)) {
          localStorage.removeItem(k);
        }
      }
    } catch (err) {
      void err;
    }
  }
};

// Track in-flight network requests to avoid duplicate revalidations
const inflightRequests = new Map();

async function cachedGet(path, ttl = 30000) {
  console.log(`[CACHE DEBUG] cachedGet called for path: ${path} (ttl=${ttl}ms)`);

  // 1) Check fast in-memory cache (short TTL) first
  const memHit = responseCache.get(path);
  if (memHit) {
    console.log(`[CACHE DEBUG] Memory cache hit for ${path}`);
    return memHit;
  }

  // 2) Fallback to durable enhanced cache (localStorage, 30 min)
  const cachedData = enhancedCache.getCachedData(path);
  if (cachedData) {
    console.log(`[CACHE DEBUG] Enhanced cache hit for ${path}`);
    const resp = {
      data: cachedData,
      status: 200,
      headers: {},
      config: { url: path },
      request: null,
    };
    // Warm in-memory cache for faster subsequent reads within ttl
    responseCache.set(path, resp, ttl);
    return resp;
  }

  // 3) Make network request if no valid cache
  console.log(`[ENHANCED API] Fetching fresh data for ${path}`);
  try {
    const response = await getWithRetry(path);
    console.log(`[CACHE DEBUG] Network response for ${path}:`, response);

    // Cache the fresh response
    responseCache.set(path, response, ttl);
    enhancedCache.setCachedData(path, response.data);

    return response;
  } catch (error) {
    console.error(`[CACHE DEBUG] Network error for ${path}:`, error);
    const stale = enhancedCache.getStaleEntry(path);
    if (stale && stale.data) {
      const resp = {
        data: stale.data,
        status: 200,
        headers: {},
        config: { url: path },
        request: null,
      };
      responseCache.set(path, resp, ttl);
      return resp;
    }
    throw error;
  }
}

/**
 * Instant stale-while-revalidate fetch:
 * - Returns cached data immediately if available
 * - Schedules background revalidation using If-None-Match
 * - Dedupes in-flight revalidation per path
 */
async function instantGet(path, ttl = 30000) {
  // 1) Check fast in-memory cache first
  const memHit = responseCache.get(path);
  if (memHit) {
    return memHit;
  }

  // 2) Check durable cache (with etag/timestamp)
  const entry = enhancedCache.getEntry(path);
  if (entry && entry.data) {
    const synthetic = {
      data: entry.data,
      status: 200,
      headers: {},
      config: { url: path },
      request: null,
    };
    // Warm in-memory cache
    responseCache.set(path, synthetic, ttl);

    // Background revalidation (deduped)
    if (!inflightRequests.has(path)) {
      const controller = new AbortController();
      inflightRequests.set(path, controller);
      const etag = entry.etag || null;
      const headers = etag ? { 'If-None-Match': etag } : {};
      api.get(path, { headers, signal: controller.signal, timeout: 0 })
        .then(resp => {
          // 304 Not Modified: only bump timestamp
          if (resp && resp.status === 304) {
            enhancedCache.touch(path);
            return;
          }
          // 200 OK: update caches with new data and etag
          const newEtag = resp.headers && (resp.headers.etag || resp.headers.ETag);
          responseCache.set(path, resp, ttl);
          enhancedCache.setEntry(path, resp.data, newEtag || null);
        })
        .catch(err => {
          if (err && err.response && err.response.status === 304) {
            enhancedCache.touch(path);
          }
        })
        .finally(() => {
          inflightRequests.delete(path);
        });
    }

    return synthetic;
  }

  // 3) No cache: fetch and store
  const resp = await api.get(path);
  const etag = resp.headers && (resp.headers.etag || resp.headers.ETag);
  responseCache.set(path, resp, ttl);
  enhancedCache.setEntry(path, resp.data, etag || null);
  return resp;
}

// Request interceptor to add the auth token to headers
api.interceptors.request.use(
  (config) => {
    const user = JSON.parse(localStorage.getItem('user'));
    const token = user?.token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for global error handling with retry logic
api.interceptors.response.use(
  (response) => {
    // Auto-invalidate caches after mutating requests to keep UI fresh
    const method = (response?.config?.method || 'get').toLowerCase();
    const url = response?.config?.url || '';
  if (method === 'post' || method === 'put' || method === 'delete') {
      if (url.startsWith('/admin/matches') || url.startsWith('/matches')) {
        enhancedCache.invalidateByPrefix('/matches');
        responseCache.invalidate('/matches');
      }
      if (url.startsWith('/admin/hero')) {
        enhancedCache.invalidateByPrefix('/admin/hero');
        responseCache.invalidate('/admin/hero');
      }
      if (url.startsWith('/admin/leagues') || url.startsWith('/sports')) {
        enhancedCache.invalidateByPrefix('/sports');
        enhancedCache.invalidateByPrefix('/admin/leagues');
        responseCache.invalidate('/sports');
        responseCache.invalidate('/admin/leagues');
      }
      if (url.startsWith('/admin/users') || url.startsWith('/users')) {
        enhancedCache.invalidateByPrefix('/admin/users');
        responseCache.invalidate('/admin/users');
      }
      // Invalidate bets caches on mutations to ensure My Bets reflects changes instantly
      if (url.startsWith('/bets') || url.startsWith('/admin/bets')) {
        enhancedCache.invalidateByPrefix('/bets');
        responseCache.invalidate('/bets');
      }
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('API Error - Response Data:', error.response.data);
      console.error('API Error - Status:', error.response.status);
      console.error('API Error - Headers:', error.response.headers);

      if (error.response.status === 401) {
        // Handle unauthorized errors, e.g., redirect to login
        console.log('Unauthorized, redirecting to login...');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
      
      // Handle 429 rate limiting with retry
      if (error.response.status === 429 && !originalRequest._retry) {
        originalRequest._retry = true;
        
        // Calculate retry delay with exponential backoff
        const retryDelay = Math.min(1000 * Math.pow(2, originalRequest._retryCount || 0), 10000);
        originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
        
        console.log(`Rate limited. Retrying in ${retryDelay}ms... (attempt ${originalRequest._retryCount})`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        
        // Retry the request
        return api(originalRequest);
      }
    } else if (error.request) {
      // The request was made but no response was received
      console.error('API Error - No Response:', error.request);
      // Don't throw the error immediately, let the calling component handle it
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('API Error - Message:', error.message);
    }
    return Promise.reject(error);
  }
);

const apiService = {
  // Auth
  login: (credentials) => api.post('/auth/login', credentials),
  signup: (userData) => api.post('/auth/register', userData),
  requestPasswordReset: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: ({ token, email, password }) => api.post('/auth/reset-password', { token, email, password }),
  resetPasswordWithOtp: ({ otp, email, password }) => api.post('/auth/reset-password', { otp, email, password }),

  // Users
  getUserProfile: () => instantGet('/auth/profile', 60000),
  updateUserProfile: (profileData) => api.put('/auth/profile', profileData),
  changePassword: (passwordData) => api.put('/users/change-password', passwordData),
  getTransactions: () => instantGet('/users/transactions', 120000),
  getBalance: () => instantGet('/users/balance', 30000),
  deposit: (depositData) => api.post('/users/deposit', depositData),
  withdraw: (withdrawData) => api.post('/users/withdraw', withdrawData),

  // Matches - Updated to use correct endpoints
  getAllMatches: () => instantGet('/matches/all', 60000),
  searchMatchesAdmin: (params = {}) => api.get('/matches/search', { params }),
  // Odds-based matches for admin search/fetch
  getOddsMatches: () => cachedGet('/odds', 60000),
  updateOddsResult: (eventId, { homeScore, awayScore, completed = true }) =>
    api.put(`/admin/odds/${eventId}/result`, { homeScore, awayScore, completed }),
  // Cache main matches list briefly to avoid spinner and reflows
  getMatches: async () => {
    console.log('[API DEBUG] getMatches called');
    try {
      const result = await instantGet('/matches', 30000);
      console.log('[API DEBUG] getMatches response:', result);
      return result;
    } catch (error) {
      console.error('[API DEBUG] getMatches error:', error);
      throw error;
    }
  },
  // Instant load popular matches with background revalidation
  getPopularMatches: () => instantGet('/matches/popular/trending', 300000),
  getMatchById: (id) => cachedGet(`/matches/${id}`, 15000),
  getLiveMatches: () => instantGet('/matches/live/real-time', 30000),
  addMatch: (matchData) => api.post('/admin/matches', matchData),
  updateMatch: (id, matchData) => api.put(`/admin/matches/${id}`, matchData),
  deleteMatch: (id) => api.delete(`/admin/matches/${id}`),

  // Bets
  placeBet: (betData) => api.post('/bets', betData),
  // Use instantGet to return cached data immediately and revalidate in background
  getUserBets: () => instantGet('/bets/my-bets', 120000),
  getBetStatsSummary: () => instantGet('/bets/stats/summary', 60000),
  
  // Admin Bet Management
  getAdminBets: (params) => api.get(`/admin/bets?${params}`),
  updateBet: (betId, betData) => api.put(`/admin/bets/${betId}`, betData),
  settleBet: (betId, settlementData) => api.put(`/admin/bets/${betId}/status`, settlementData),
  bulkUpdateBets: (bulkData) => api.put('/admin/bets/bulk/status', bulkData),

  // Sports
  getAllSports: () => cachedGet('/sports', 120000),
  getMatchesBySport: (sportId) => cachedGet(`/sports/${sportId}/matches`, 30000),

  // Admin
  getAdminDashboardStats: () => cachedGet('/admin/dashboard-stats', 30000),
  getAdminStatistics: () => cachedGet('/admin/statistics', 60000),
  getAdminUsers: () => cachedGet('/admin/users', 30000),
  updateUserRole: (id, role) => api.put(`/admin/users/${id}/role`, { role }),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  blockUser: (userId) => {
    return api.put(`/users/${userId}/block`);
  },
  unblockUser: (userId) => {
    return api.put(`/users/${userId}/unblock`);
  },
  // Hero Section: instant load with background revalidation
  getHeroSlides: () => instantGet('/admin/hero', 300000),
  createHeroSlide: (data) => api.post('/admin/hero', data),
  updateHeroSlide: (id, data) => api.put(`/admin/hero/${id}`, data),
  deleteHeroSlide: (id) => api.delete(`/admin/hero/${id}`),
  uploadHeroImage: (formData) => api.post('/admin/hero/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  // Match media uploads (Admin)
  uploadMatchVideo: (matchId, formData) => api.post(`/admin/matches/${matchId}/video/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  uploadMatchPoster: (matchId, formData) => api.post(`/admin/matches/${matchId}/poster/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  // Fallback uploads under /matches if /admin path is not reachable in some environments
  uploadMatchVideoFallback: (matchId, formData) => api.post(`/matches/${matchId}/video/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  uploadMatchPosterFallback: (matchId, formData) => api.post(`/matches/${matchId}/poster/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  // Generic uploads (pre-save)
  uploadVideoTemp: (formData) => api.post('/admin/uploads/video', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  uploadPosterTemp: (formData) => api.post('/admin/uploads/poster', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  uploadVideoTempFallback: (formData) => api.post('/matches/uploads/video', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  uploadPosterTempFallback: (formData) => api.post('/matches/uploads/poster', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  // Leagues
  getLeagues: () => cachedGet('/admin/leagues', 600000),
  createLeague: (data) => api.post('/admin/leagues', data),
  // Fetch matches by sport key (public, no auth); cache briefly
  getMatchesByKey: (sportKey) => cachedGet(`/matches/sport/${sportKey}`, 30000),
  getMatchMarkets: (matchId) => instantGet(`/matches/${matchId}/markets`, 120000),
  // Admin: match status updates
  setMatchStatus: (matchId, { status, homeScore, awayScore }) =>
    api.put(`/admin/matches/${matchId}/status`, { status, homeScore, awayScore }),
  // Admin: manual result upsert for settlement
  updateMatchResult: (matchId, { homeScore, awayScore, completed = true }) =>
    api.put(`/admin/matches/${matchId}/result`, { homeScore, awayScore, completed }),
  // Admin: trigger settlement across completed matches
  manualSettleBets: () => api.post('/admin/settle-bets'),
  
  // Add wheel of fortune endpoints
  spinWheel: (spinData) => api.post('/wheel/spin', spinData),
  
  // Payment endpoints
  createPayment: (paymentData) => api.post('/payments/create', paymentData),
  // Cache management
  invalidateCachePrefix: (prefix) => responseCache.invalidate(prefix),
};

export default apiService;
async function getWithRetry(path, maxAttempts = 3) {
  let attempt = 0;
  let lastError = null;
  while (attempt < maxAttempts) {
    try {
      return await api.get(path, { timeout: 0 });
    } catch (err) {
      lastError = err;
      const status = err?.response?.status;
      const isTimeout = err?.code === 'ECONNABORTED';
      const isNetwork = !err?.response;
      const retryable = isTimeout || isNetwork || (status && (status === 408 || status === 429 || status >= 500));
      if (!retryable) break;
      const delay = 500 * Math.pow(2, attempt);
      await new Promise(r => setTimeout(r, delay));
      attempt++;
      continue;
    }
  }
  throw lastError;
}
