const config = require('../config/config');
// Logger removed during cleanup - using console for now
const axios = require('axios');
const winston = require('winston');

const Match = require('../models/Match');
const Odds = require('../models/Odds');

const winstonLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

/**
 * @class OddsApiService
 * @description Service for interacting with the-odds-api.com to fetch sports data and odds.
 */
class OddsApiService {
  /**
   * @property {object} client - Axios instance configured for the Odds API.
   */
  constructor() {
    console.log(`Odds API Base URL: ${config.oddsApi.baseUrl}`);
    if (!config.oddsApi.apiKey) {
      console.warn('ODDS_API_KEY is not defined in environment variables. Odds fetching will be disabled.');
      this.isEnabled = false;
      return;
    }
    if (!config.oddsApi.baseUrl) {
      console.warn('ODDS_API_BASE_URL is not defined in environment variables. Odds fetching will be disabled.');
      this.isEnabled = false;
      return;
    }
    
    this.isEnabled = true;

    this.client = axios.create({
      baseURL: config.oddsApi.baseUrl,
      timeout: parseInt(process.env.ODDS_API_TIMEOUT, 10) || 10000, // Default to 10 seconds if not set
      params: {
        api_key: config.oddsApi.apiKey,
        regions: 'us,us2,uk,eu,au', // All available regions
        // markets: 'h2h,spreads,totals,outrights', // All available markets - now dynamically fetched
        oddsFormat: 'decimal', // decimal | american
        dateFormat: 'iso', // iso | unix
      }
    });
  }

  /**
   * @method getSports
   * @description Fetches a list of available sports from the Odds API.
   * @returns {Promise<Array<Object>>} A promise that resolves to an array of sport objects.
 */
  async getSports() {
    if (!this.isEnabled) {
      console.warn('OddsApiService is disabled due to missing configuration');
      return [];
    }
    
    try {
       const response = await this.client.get('/sports', {
        params: {
          all: true, // Include all sports, including those with outrights
        },
      });
      return response.data;
    } catch (error) {
      this.handleApiError(error);
      return null;
    }
  }

  /**
   * @method getMarketsForSport
   * @description Fetches available markets for a specific sport from the Odds API.
   * @param {string} sportKey - The key of the sport to fetch markets for.
   * @returns {Promise<Array<Object>>} A promise that resolves to an array of market objects.
   */


  /**
   * @method getMarketsForSport
   * @description Fetches available markets for a specific sport from the Odds API.
   * @param {string} sportKey - The key of the sport to fetch markets for.
   * @returns {Promise<Array<Object>>} A promise that resolves to an array of market objects.
   */
  async getMarketsForSport(sportKey) {
    if (!this.isEnabled) {
      console.warn('OddsApiService is disabled due to missing configuration');
      return [];
    }
    
    try {
      const response = await this.client.get(`/sports/${sportKey}/markets`);
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.warn(`No markets found for sport ${sportKey}.`, { sportKey });
        return [];
      } else {
        this.handleApiError(error);
        return [];
      }
    }
  }

  /**
   * @method getUpcomingMatches
   * @description Fetches upcoming match odds for a specific sport.
   * Implements a basic rate-limiting delay if the remaining requests are low.
   * @param {string} sportKey - The key of the sport to fetch matches for (e.g., 'soccer_epl').
   * @returns {Promise<Array<Object>>} A promise that resolves to an array of transformed match objects.
   * @throws {Error} If there is an error fetching match data.
   */
  /**
   * @method getUpcomingOdds
   * @description Fetches upcoming match odds for a specific sport.
   * Implements a basic rate-limiting delay if the remaining requests are low.
   * @param {string} sportKey - The key of the sport to fetch matches for (e.g., 'soccer_epl').
   * @param {string} [market] - Optional market to fetch odds for (e.g., 'h2h').
   * @param {number} [retryCount=0] - Internal counter for retry attempts.
   * @returns {Promise<Array<Object>>} A promise that resolves to an array of transformed match objects.
   * @throws {Error} If there is an error fetching match data.
   */
  async getUpcomingOdds(sportKey, market = null, retryCount = 0) {
    if (!this.isEnabled) {
      console.warn('OddsApiService is disabled due to missing configuration');
      return [];
    }
    
    if (!sportKey || typeof sportKey !== 'string') {
      throw new Error('Invalid sportKey provided. sportKey must be a non-empty string.');
    }

    // If a specific market is provided, fetch as before
    if (market) {
      return this._fetchAndSaveOddsForMarket(sportKey, market);
    }

    // Otherwise, fetch all supported markets individually and merge
    let supportedMarkets = [];
    try {
      const availableMarkets = await this.getMarketsForSport(sportKey);
      supportedMarkets = availableMarkets
        .filter(mkt => !['game_period_markets', 'player_props'].includes(mkt.key || mkt))
        .map(mkt => mkt.key || mkt);
    } catch (err) {
              console.error(`Failed to fetch supported markets for ${sportKey}: ${err.message}`);
      supportedMarkets = ['h2h']; // fallback
    }
    if (supportedMarkets.length === 0) supportedMarkets = ['h2h'];

    // Fetch odds for each market separately
    const allOddsById = {};
    for (const marketKey of supportedMarkets) {
      try {
        const oddsForMarket = await this._fetchAndSaveOddsForMarket(sportKey, marketKey);
        for (const match of oddsForMarket) {
          if (!allOddsById[match.gameId]) {
            allOddsById[match.gameId] = match;
          } else {
            // Merge markets for the same match (by bookmaker)
            for (const bm of match.bookmakers) {
              const existingBm = allOddsById[match.gameId].bookmakers.find(b => b.key === bm.key);
              if (existingBm) {
                // Merge markets by key
                for (const mkt of bm.markets) {
                  if (!existingBm.markets.some(m => m.key === mkt.key)) {
                    existingBm.markets.push(mkt);
                  }
                }
              } else {
                allOddsById[match.gameId].bookmakers.push(bm);
              }
            }
          }
        }
      } catch (err) {
        console.warn(`Failed to fetch odds for market ${marketKey} in ${sportKey}: ${err.message}`);
      }
    }
    // Return merged matches as an array
    return Object.values(allOddsById);
  }

  // Helper to fetch odds for a single market and save to DB
  async _fetchAndSaveOddsForMarket(sportKey, market) {
    if (!this.isEnabled) {
      console.warn('OddsApiService is disabled due to missing configuration');
      return [];
    }
    
    const response = await this.client.get(`/sports/${sportKey}/odds`, {
      params: { markets: market },
    });
    const games = response.data;
    // Save to DB as before
    const bulkOps = games.map(game => {
      const bookmakers = game.bookmakers.map(bm => ({
        key: bm.key,
        title: bm.title,
        last_update: new Date(bm.last_update),
        markets: bm.markets.map(mkt => ({
          key: mkt.key,
          last_update: new Date(mkt.last_update),
          outcomes: mkt.outcomes.map(outcome => ({
            name: outcome.name,
            price: outcome.price,
            point: outcome.point
          }))
        }))
      }));
      return {
        updateOne: {
          filter: { gameId: game.id },
          update: {
            $set: {
              sport_key: game.sport_key,
              sport_title: game.sport_title,
              commence_time: new Date(game.commence_time),
              home_team: game.home_team,
              away_team: game.away_team,
              bookmakers: bookmakers,
              lastFetched: new Date()
            }
          },
          upsert: true
        }
      };
    });
    if (bulkOps.length > 0) {
      try {
        // Process in smaller batches to prevent overwhelming the database
        const batchSize = 50;
        for (let i = 0; i < bulkOps.length; i += batchSize) {
          const batch = bulkOps.slice(i, i + batchSize);
          await Odds.bulkWrite(batch, { 
            ordered: false, 
            writeConcern: { w: 1, wtimeout: 30000 } // Reduced timeout and write concern
          });
          // Small delay between batches
          if (i + batchSize < bulkOps.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      } catch (bulkWriteError) {
        console.error(`MongoDB bulkWrite error for sport ${sportKey} (market ${market}): ${bulkWriteError.message}`);
      }
    }
    return games;
  }

  /**
   * @method handleApiError
   * @description Handles API errors, logs them, and throws a new error.
   * @param {Error} error - The error object caught from an API request.
   * @throws {Error} A new error with a descriptive message.
   */
  handleApiError(error) {
    if (error.response) {
      const { status, data } = error.response;
      let errorMessage = `API Error: ${status} - ${data.message || 'An unexpected error occurred.'}`;

      if (status === 401) {
        errorMessage = `API Error: ${status} - Authentication failed or usage quota has been reached. Please check your API key and usage plan.`;
      }

              console.error(errorMessage, { apiError: data });
      throw new Error(errorMessage);
    } else if (error.request) {
              console.error(`Request Setup Error: API request failed with no response: ${error.message}`, { apiError: error.request });
      throw new Error(`Request Setup Error: API request failed with no response: ${error.message}`);
    } else {
              console.error(`Request Setup Error: API request failed: ${error.message}`, { apiError: error.message });
      throw new Error(`Request Setup Error: API request failed: ${error.message}`);
    }
  }

  // Add this method to the class
  /**
   * @method getLastRateLimitInfo
   * @description Retrieves the last known rate limit information from response headers.
   * @returns {{remaining: number, used: number}} An object containing the remaining and used requests.
   */
  getLastRateLimitInfo() {
    return {
      remaining: parseInt(this.lastResponseHeaders?.['x-requests-remaining'], 10),
      used: parseInt(this.lastResponseHeaders?.['x-requests-used'], 10)
    };
  }
}

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const ODDS_API_BASE_URL = process.env.ODDS_API_BASE_URL || 'https://api.the-odds-api.com/v4';

// Helper function to fetch all sports
async function fetchSports() {
  const url = `${ODDS_API_BASE_URL}/sports?apiKey=${ODDS_API_KEY}`;
  const response = await axios.get(url);
  return response.data.map(sport => sport.key);
}

// Helper function to fetch main markets for a sport
async function fetchMainMarkets(sport, regions, markets, bookmakers) {
  const url = `${ODDS_API_BASE_URL}/sports/${sport}/odds?apiKey=${ODDS_API_KEY}&regions=${regions}&markets=${markets}&oddsFormat=decimal&bookmakers=${bookmakers}`;
  const response = await axios.get(url);
  return response.data;
}

// Helper function to fetch additional markets for an event
async function fetchEventMarkets(eventId, regions, markets, bookmakers) {
  const url = `${ODDS_API_BASE_URL}/events/${eventId}/odds?apiKey=${ODDS_API_KEY}&regions=${regions}&markets=${markets}&oddsFormat=decimal&bookmakers=${bookmakers}`;
  const response = await axios.get(url);
  return response.data;
}

/**
 * Merges bookmaker data for events, prioritizing primary, then fallback, then all others for each market.
 * @param {Array<Object>} eventData - Array of event objects (from Odds API)
 * @param {string} primaryBookmaker - Key of the primary bookmaker
 * @param {string} fallbackBookmaker - Key of the fallback bookmaker
 * @returns {Array<Object>} Array of events with merged markets
 */
function mergeBookmakerData(eventData, primaryBookmaker, fallbackBookmaker) {
  return eventData.map(event => {
    if (!event.bookmakers || event.bookmakers.length === 0) {
      return { ...event, bookmakers: [] };
    }
    // Build a map of all unique market keys across all bookmakers
    const allMarkets = new Set();
    event.bookmakers.forEach(bm => {
      if (bm.markets) bm.markets.forEach(m => allMarkets.add(m.key));
    });
    // Order bookmakers: primary, fallback, then all others
    const orderedBookmakers = [
      ...event.bookmakers.filter(b => b.key === primaryBookmaker),
      ...event.bookmakers.filter(b => b.key === fallbackBookmaker && b.key !== primaryBookmaker),
      ...event.bookmakers.filter(b => b.key !== primaryBookmaker && b.key !== fallbackBookmaker)
    ];
    // For each market, pick the first available from the ordered list
    const mergedMarkets = [];
    allMarkets.forEach(marketKey => {
      for (const bm of orderedBookmakers) {
        const mkt = bm.markets && bm.markets.find(m => m.key === marketKey && m.outcomes && m.outcomes.length > 0);
        if (mkt) {
          mergedMarkets.push({ key: mkt.key, outcomes: mkt.outcomes, last_update: mkt.last_update });
          break;
        }
      }
    });
    // Return a single bookmaker with merged markets for this event
    return {
      ...event,
      bookmakers: [{
        key: primaryBookmaker,
        title: primaryBookmaker,
        last_update: new Date(),
        markets: mergedMarkets
      }]
    };
  });
}

// Fetch supported markets for a specific sport
async function fetchMarketsForSport(sportKey) {
  const ODDS_API_KEY = process.env.ODDS_API_KEY;
  const ODDS_API_BASE_URL = process.env.ODDS_API_BASE_URL || 'https://api.the-odds-api.com/v4';
  const url = `${ODDS_API_BASE_URL}/sports/${sportKey}/markets?apiKey=${ODDS_API_KEY}`;
  const response = await axios.get(url);
  // The API returns an array of market objects; return their keys
  return response.data.map(m => m.key);
}

module.exports = {
  OddsApiService,
  fetchSports,
  fetchMainMarkets,
  fetchEventMarkets,
  mergeBookmakerData,
  fetchMarketsForSport
};

