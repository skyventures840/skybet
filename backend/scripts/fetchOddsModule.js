require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const { OddsApiService } = require('../services/oddsApiService');
const Odds = require('../models/Odds');
const Match = require('../models/Match');
const Results = require('../models/Results');
const Scores = require('../models/Scores');
const logger = require('../utils/logger');

/**
 * Fetch odds for a specific sport using the fetchOdds script logic
 * @param {string} sportKey - The sport key to fetch odds for
 * @param {string} sportTitle - The display name of the sport
 * @param {boolean} clearExisting - Whether to clear existing data for this sport
 * @returns {Promise<Object>} - Object containing counts of fetched data
 */
async function fetchOddsForSport(sportKey, sportTitle, clearExisting = false) {
  // Ensure DB is connected
  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    logger.warn(`Skipping odds fetch for ${sportTitle} (${sportKey}) because MongoDB is not connected`);
    return { odds: 0, matches: 0, results: 0, scores: 0 };
  }

  const service = new OddsApiService();
  if (!service.isEnabled) {
    logger.error('OddsApiService is disabled (missing ODDS_API_KEY or base URL).');
    return { odds: 0, matches: 0, results: 0, scores: 0 };
  }

  try {
    // Clear existing data for this sport if requested
    if (clearExisting) {
      await Odds.deleteMany({ sport_key: sportKey });
      await Match.deleteMany({ sport: sportKey });
      await Results.deleteMany({ sport_key: sportKey });
      await Scores.deleteMany({ sport_key: sportKey });
      logger.info(`Cleared existing data for sport: ${sportKey}`);
    }

    logger.info(`Fetching and saving odds for sport: ${sportTitle} (${sportKey})`);

    // Use common markets batch fetch (mirrors fetchOdds.js logic)
    const commonMarkets = (process.env.TEST_MARKETS || 'h2h,spreads,totals').split(',');
    const games = await service._fetchAndSaveOddsForMarketsBatch(sportKey, commonMarkets);

    const rateInfo = service.getLastRateLimitInfo ? service.getLastRateLimitInfo() : null;
    if (rateInfo) {
      logger.info('Rate limit info:', rateInfo);
    }

    logger.info(`Fetched ${games.length} events for ${sportKey}`);

    let matchCount = 0;
    if (games.length > 0) {
      // Save to Match collection (frontend expects this format)
      const matchBulkOps = games.map(game => ({
        updateOne: {
          filter: { _id: game.id },
          update: {
            $set: {
              _id: game.id,
              sport: game.sport_key,
              league: game.sport_title,
              homeTeam: game.home_team,
              awayTeam: game.away_team,
              startTime: new Date(game.commence_time),
              odds: game.bookmakers,
              status: 'upcoming'
            }
          },
          upsert: true
        }
      }));
      await Match.bulkWrite(matchBulkOps, { ordered: false });
      matchCount = games.length;
      logger.info(`Saved ${games.length} match records for ${sportKey}`);
    }

    // Verification: ensure odds were saved for this sport
    const sportOddsCount = await Odds.countDocuments({ sport_key: sportKey });
    logger.info(`Odds documents saved for ${sportKey}: ${sportOddsCount}`);

    // Fetch and store results data (completed games)
    let resultsCount = 0;
    try {
      logger.info(`Fetching results for ${sportKey}...`);
      const results = await service.getResults(sportKey, 7); // Get results from last 7 days
      logger.info(`Fetched ${results.length} results for ${sportKey}`);
      
      // Verify results were stored
      resultsCount = await Results.countDocuments({ sport_key: sportKey });
      logger.info(`Results documents saved for ${sportKey}: ${resultsCount}`);
    } catch (error) {
      logger.error(`Error fetching results for ${sportKey}:`, error.message);
    }

    // Fetch and store scores data (live and recent games)
    let scoresCount = 0;
    try {
      logger.info(`Fetching scores for ${sportKey}...`);
      const scores = await service.getScores(sportKey);
      logger.info(`Fetched ${scores.length} scores for ${sportKey}`);
      
      // Verify scores were stored
      scoresCount = await Scores.countDocuments({ sport_key: sportKey });
      logger.info(`Scores documents saved for ${sportKey}: ${scoresCount}`);
    } catch (error) {
      logger.error(`Error fetching scores for ${sportKey}:`, error.message);
    }

    return {
      odds: sportOddsCount,
      matches: matchCount,
      results: resultsCount,
      scores: scoresCount
    };

  } catch (error) {
    logger.error(`Error processing sport ${sportKey}:`, error.message);
    return { odds: 0, matches: 0, results: 0, scores: 0 };
  }
}

/**
 * Fetch odds for multiple sports using the fetchOdds script logic
 * @param {Array} sports - Array of sport objects with key and title properties
 * @param {boolean} clearExisting - Whether to clear existing data before fetching
 * @returns {Promise<Object>} - Object containing total counts of fetched data
 */
async function fetchOddsForMultipleSports(sports, clearExisting = false) {
  // Ensure DB is connected
  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    logger.warn('Skipping odds fetch because MongoDB is not connected');
    return { totalOdds: 0, totalMatches: 0, totalResults: 0, totalScores: 0 };
  }

  const service = new OddsApiService();
  if (!service.isEnabled) {
    logger.error('OddsApiService is disabled (missing ODDS_API_KEY or base URL).');
    return { totalOdds: 0, totalMatches: 0, totalResults: 0, totalScores: 0 };
  }

  // Filter supported sports (same logic as fetchOdds.js)
  const supportedSports = sports.filter(sport =>
    !sport.key.includes('politics') &&
    !sport.key.includes('entertainment') &&
    sport.key !== 'golf_the_open_championship_winner'
  );

  logger.info(`Processing ${supportedSports.length} supported sports`);

  let totalCounts = { totalOdds: 0, totalMatches: 0, totalResults: 0, totalScores: 0 };

  for (const sport of supportedSports) {
    const counts = await fetchOddsForSport(sport.key, sport.title, clearExisting);
    totalCounts.totalOdds += counts.odds;
    totalCounts.totalMatches += counts.matches;
    totalCounts.totalResults += counts.results;
    totalCounts.totalScores += counts.scores;

    // Rate limiting between sports (same as fetchOdds.js)
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  logger.info('Final collection totals:', totalCounts);
  return totalCounts;
}

module.exports = {
  fetchOddsForSport,
  fetchOddsForMultipleSports
};