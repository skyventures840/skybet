import axios from 'axios';

// Use environment variable for API URL, fallback to localhost for development
const RAW_BASE = process.env.REACT_APP_API_URL || 'http://localhost:10000';
const CLEAN_BASE = RAW_BASE.replace(/\/+$/, ''); // remove trailing slashes
const API_BASE_URL = /\/api$/.test(CLEAN_BASE) ? CLEAN_BASE : `${CLEAN_BASE}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // This is important for sending cookies/tokens with requests
  headers: {
    'Content-Type': 'application/json',
  },
});

// Simple in-memory cache with TTL to speed up initial loads
const responseCache = {
  store: new Map(),
  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.store.delete(key);
      return null;
    }
    return entry.response;
  },
  set(key, response, ttl) {
    this.store.set(key, { response, ttl, timestamp: Date.now() });
  },
  delete(key) {
    this.store.delete(key);
    try {
      localStorage.removeItem(`cache:${key}`);
    } catch (err) {
      // Swallow storage errors (quota/unavailable) intentionally
      void err;
    }
  },
  invalidate(prefix) {
    // Remove in-memory entries by prefix
    for (const k of this.store.keys()) {
      if (String(k).startsWith(prefix)) {
        this.store.delete(k);
      }
    }
    // Remove localStorage entries by prefix
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i) || '';
        if (k.startsWith('cache:') && k.slice(6).startsWith(prefix)) {
          localStorage.removeItem(k);
        }
      }
    } catch (err) {
      // Swallow storage errors (quota/unavailable) intentionally
      void err;
    }
  }
};

async function cachedGet(path, ttlMs) {
  // 1) In-memory cache for fast same-session hits
  const cached = responseCache.get(path);
  if (cached) return cached;

  // 2) LocalStorage cache for instant loads across sessions
  const lsKey = `cache:${path}`;
  try {
    const raw = localStorage.getItem(lsKey);
    if (raw) {
      const entry = JSON.parse(raw);
      if (entry && entry.timestamp && (Date.now() - entry.timestamp) < ttlMs) {
        // Minimal axios-like response shape
        const lsResponse = {
          data: entry.data,
          status: 200,
          headers: {},
          config: { url: path },
          request: null,
        };
        // Also warm in-memory cache for subsequent calls in this session
        responseCache.set(path, lsResponse, ttlMs);
        return lsResponse;
      }
    }
  } catch (e) {
    // Ignore JSON/Storage errors and continue to network request
    void e;
  }

  // 3) Network request (and persist result to both caches)
  const response = await api.get(path);
  responseCache.set(path, response, ttlMs);
  try {
    localStorage.setItem(lsKey, JSON.stringify({ timestamp: Date.now(), data: response.data }));
  } catch (e) {
    // Storage might be full or unavailable; safe to ignore
    void e;
  }
  return response;
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
        responseCache.invalidate('/matches');
      }
      if (url.startsWith('/admin/hero')) {
        responseCache.invalidate('/admin/hero');
      }
      if (url.startsWith('/admin/leagues') || url.startsWith('/sports')) {
        responseCache.invalidate('/sports');
        responseCache.invalidate('/admin/leagues');
      }
      if (url.startsWith('/admin/users') || url.startsWith('/users')) {
        responseCache.invalidate('/admin/users');
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

  // Users
  getUserProfile: () => api.get('/auth/profile'),
  updateUserProfile: (profileData) => api.put('/auth/profile', profileData),
  changePassword: (passwordData) => api.put('/users/change-password', passwordData),
  getTransactions: () => api.get('/users/transactions'),
  deposit: (depositData) => api.post('/users/deposit', depositData),
  withdraw: (withdrawData) => api.post('/users/withdraw', withdrawData),

  // Matches - Updated to use correct endpoints
  getAllMatches: () => cachedGet('/matches/all', 60000),
  // Cache main matches list briefly to avoid spinner and reflows
  getMatches: () => cachedGet('/matches', 30000),
  // Cache popular matches briefly
  getPopularMatches: () => cachedGet('/matches/popular/trending', 30000),
  getMatchById: (id) => cachedGet(`/matches/${id}`, 15000),
  getLiveMatches: () => cachedGet('/matches/live/real-time', 5000),
  addMatch: (matchData) => api.post('/admin/matches', matchData),
  updateMatch: (id, matchData) => api.put(`/admin/matches/${id}`, matchData),
  deleteMatch: (id) => api.delete(`/admin/matches/${id}`),

  // Bets
  placeBet: (betData) => api.post('/bets', betData),
  getUserBets: () => api.get('/bets/my-bets'),
  getBetStatsSummary: () => api.get('/bets/stats/summary'),

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
  // Hero Section
  // Cache hero slides longer since they change infrequently
  getHeroSlides: () => cachedGet('/admin/hero', 300000),
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
  getMatchMarkets: (matchId) => cachedGet(`/matches/${matchId}/markets`, 30000),
  // Admin: match status updates
  setMatchStatus: (matchId, { status, homeScore, awayScore }) =>
    api.put(`/admin/matches/${matchId}/status`, { status, homeScore, awayScore }),
  
  // Add wheel of fortune endpoints
  spinWheel: (spinData) => api.post('/wheel/spin', spinData),
  
  // Payment endpoints
  createPayment: (paymentData) => api.post('/payments/create', paymentData),
  // Cache management
  invalidateCachePrefix: (prefix) => responseCache.invalidate(prefix),
};

export default apiService;
