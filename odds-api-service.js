const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const mongoose = require('mongoose');
const NodeCache = require('node-cache');

const app = express();
const port = 8000;

app.use(bodyParser.json());

const oddsCache = new NodeCache({ stdTTL: 300, checkperiod: 120 }); // 5 min TTL
const scoresCache = new NodeCache({ stdTTL: 120, checkperiod: 60 }); // 2 min TTL

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/odds_api_db';
mongoose.connect(mongoURI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const OddsSchema = new mongoose.Schema({
  data: Object,
  fetchedAt: { type: Date, default: Date.now },
  sport: String
});
const OddsModel = mongoose.model('Odds', OddsSchema);

const ScoresSchema = new mongoose.Schema({
  data: Object,
  fetchedAt: { type: Date, default: Date.now },
  sport: String
});
const ScoresModel = mongoose.model('Scores', ScoresSchema);

// Full supported markets (optimized: comma-separated; API ignores unsupported per sport)
const COMMON_MARKETS = "h2h,spreads,totals,outrights";

// Comprehensive single-bookmaker mapping per sport for efficiency
const SPORT_BOOKMAKERS = {
  // American Football
  'americanfootball_cfl': 'draftkings',
  'americanfootball_ncaaf': 'draftkings',
  'americanfootball_ncaaf_championship_winner': 'draftkings',
  'americanfootball_nfl': 'draftkings',

};

// Base URL for The Odds API
const BASE_URL = "";

// All supported regions for comprehensive coverage
const ALL_REGIONS = "us,us2,uk,au,eu";

app.post('/prematch_live_odds', async (req, res) => {
  const { sport, regions = ALL_REGIONS, markets = COMMON_MARKETS, api_key, bookmakers } = req.body;
  
  if (!api_key) {
    return res.status(400).json({ error: 'api_key is required' });
  }

  let effectiveMarkets = markets;
  if (markets === 'all') {
    effectiveMarkets = COMMON_MARKETS;
  }

  let effectiveBookmakers;
  if (bookmakers) {
    effectiveBookmakers = bookmakers;
  } else {
    effectiveBookmakers = SPORT_BOOKMAKERS[sport];
  }

  // Cache key: sport + markets + bookmakers/regions for specificity
  const effectiveRegions = effectiveBookmakers ? '' : regions;
  const cacheKey = `${sport}_${effectiveMarkets}_${effectiveBookmakers || effectiveRegions}`;

  // Check cache first
  let cachedData = oddsCache.get(cacheKey);
  if (cachedData) {
    console.log(`Cache hit for ${sport}`);
    return res.json(cachedData);
  }

  const params = {
    apiKey: api_key,
    markets: effectiveMarkets,
    oddsFormat: 'decimal'
  };

  if (effectiveBookmakers) {
    params.bookmakers = effectiveBookmakers;
  } else {
    params.regions = regions;  // Now defaults to all regions for comprehensive coverage
  }

  try {
    const response = await axios.get(`${BASE_URL}/sports/${sport}/odds/`, { params });
    const remaining = response.headers['x-requests-remaining'];
    const used = response.headers['x-requests-used'];
    console.log(`Odds Quota: ${used}/${response.headers['x-requests-limit']} used, ${remaining} remaining`);

    const data = response.data;

    // Cache the data (TTL: 5 min)
    oddsCache.set(cacheKey, data);

    // Store in MongoDB (non-blocking)
    OddsModel.create({ data, sport }).catch(err => console.error('DB Insert Error:', err));

    res.json(data);
  } catch (error) {
    if (error.response?.status === 429) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    if (error.response?.status === 400) {
      return res.status(400).json({ error: 'Invalid markets, bookmakers, or sport key—check against API docs' });
    }
    res.status(error.response?.status || 500).json({ error: error.response?.data || error.message });
  }
});

app.post('/scores', async (req, res) => {
  const { sport, days_from = 3, api_key } = req.body;

  if (!api_key) {
    return res.status(400).json({ error: 'api_key is required' });
  }

  // Cache key: sport + days_from
  const cacheKey = `${sport}_${days_from}`;

  // Check cache first
  let cachedData = scoresCache.get(cacheKey);
  if (cachedData) {
    console.log(`Cache hit for ${sport} scores`);
    return res.json(cachedData);
  }

  const params = {
    apiKey: api_key,
    daysFrom: days_from
  };

  try {
    const response = await axios.get(`${BASE_URL}/sports/${sport}/scores/`, { params });
    const data = response.data;

    // Cache the data (TTL: 2 min for live updates)
    scoresCache.set(cacheKey, data);

    // Store in MongoDB (non-blocking)
    ScoresModel.create({ data, sport }).catch(err => console.error('DB Insert Error:', err));

    res.json(data);
  } catch (error) {
    if (error.response?.status === 429) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    res.status(error.response?.status || 500).json({ error: error.response?.data || error.message });
  }
});

app.get('/sports', async (req, res) => {
  const { api_key } = req.query;

  if (!api_key) {
    return res.status(400).json({ error: 'api_key is required' });
  }

  const params = { apiKey: api_key };

  try {
    const response = await axios.get(`${BASE_URL}/sports`, { params });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ error: error.response?.data || error.message });
  }
});

app.listen(port, () => {
  console.log(`Final Optimized Odds API Wrapper with Caching running at http://localhost:${port}`);
  console.log(`Supports ${Object.keys(SPORT_BOOKMAKERS).length} sports with single-bookmaker efficiency, MongoDB storage, in-memory caching, and all regions coverage.`);
});