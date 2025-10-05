const config = {
  port: process.env.PORT || 10000,
  mongoURI: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
  oddsApi: {
    baseUrl: process.env.ODDS_API_BASE_URL || 'https://api.the-odds-api.com/v4',
    apiKey: process.env.ODDS_API_KEY,
    apiVersion: 'v2'
  },
  frontendUrl: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : ['http://localhost:3000'],
  env: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info'
};

module.exports = config;
