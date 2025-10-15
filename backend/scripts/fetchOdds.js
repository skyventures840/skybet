require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
// Logger removed during cleanup - using console for now
const { OddsApiService } = require('../services/oddsApiService');
const Odds = require('../models/Odds');
const Match = require('../models/Match');
const Results = require('../models/Results');
const Scores = require('../models/Scores');
// Removed unused matchDataEnricher import

async function main() {
  const mongoURI = process.env.MONGODB_URI;
  
  if (!mongoURI) {
    throw new Error('MONGODB_URI environment variable is required');
  }
  await mongoose.connect(mongoURI);
  console.log('Connected to MongoDB');

  // Clear existing data
  await Odds.deleteMany({});
  await Match.deleteMany({});
  await Results.deleteMany({});
  await Scores.deleteMany({});
  console.log('Cleared existing Odds, Match, Results, and Scores collections');

  const service = new OddsApiService();
  if (!service.isEnabled) {
    console.error('OddsApiService is disabled (missing ODDS_API_KEY or base URL).');
    await mongoose.disconnect();
    process.exit(1);
  }
  const sports = await service.getSports();
  const supportedSports = sports.filter(sport =>
    !sport.key.includes('politics') &&
    !sport.key.includes('entertainment') &&
    sport.key !== 'golf_the_open_championship_winner'
  );

  console.log(`Processing ${supportedSports.length} supported sports`);

  for (const sport of supportedSports) {
    try {
      console.log(`Fetching and saving odds for sport: ${sport.title} (${sport.key})`);

      // Use common markets batch fetch (mirrors simpleFetchAndVerify)
      const commonMarkets = (process.env.TEST_MARKETS || 'h2h,spreads,totals').split(',');
      const games = await service._fetchAndSaveOddsForMarketsBatch(sport.key, commonMarkets);

      const rateInfo = service.getLastRateLimitInfo ? service.getLastRateLimitInfo() : null;
      if (rateInfo) {
        console.log('Rate limit info:', rateInfo);
      }

      console.log(`Fetched ${games.length} events for ${sport.key}`);

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
        console.log(`Saved ${games.length} match records for ${sport.key}`);
      }

      // Verification: ensure odds were saved for this sport (from SimpleFetchAndVerify)
      const sportOddsCount = await Odds.countDocuments({ sport_key: sport.key });
      console.log(`Odds documents saved for ${sport.key}: ${sportOddsCount}`);
      const sample = await Odds.findOne({ sport_key: sport.key }).lean();
      if (sample) {
        console.log('Sample saved odds document summary:', {
          gameId: sample.gameId,
          commence_time: sample.commence_time,
          home_team: sample.home_team,
          away_team: sample.away_team,
          bookmaker_count: Array.isArray(sample.bookmakers) ? sample.bookmakers.length : 0,
        });
      } else {
        console.log(`No odds documents found for sport ${sport.key}.`);
      }

      // Fetch and store results data (completed games)
      try {
        console.log(`Fetching results for ${sport.key}...`);
        const results = await service.getResults(sport.key, 7); // Get results from last 7 days
        console.log(`Fetched ${results.length} results for ${sport.key}`);
        
        // Verify results were stored
        const resultsCount = await Results.countDocuments({ sport_key: sport.key });
        console.log(`Results documents saved for ${sport.key}: ${resultsCount}`);
      } catch (error) {
        console.error(`Error fetching results for ${sport.key}:`, error.message);
      }

      // Fetch and store scores data (live and recent games)
      try {
        console.log(`Fetching scores for ${sport.key}...`);
        const scores = await service.getScores(sport.key);
        console.log(`Fetched ${scores.length} scores for ${sport.key}`);
        
        // Verify scores were stored
        const scoresCount = await Scores.countDocuments({ sport_key: sport.key });
        console.log(`Scores documents saved for ${sport.key}: ${scoresCount}`);
      } catch (error) {
        console.error(`Error fetching scores for ${sport.key}:`, error.message);
      }

      // Rate limiting between sports
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Error processing sport ${sport.key}:`, error.message);
      continue;
    }
  }

  // Final totals
  const totalOdds = await Odds.countDocuments({});
  const totalMatches = await Match.countDocuments({});
  const totalResults = await Results.countDocuments({});
  const totalScores = await Scores.countDocuments({});
  console.log('Final collection totals:', { totalOdds, totalMatches, totalResults, totalScores });

  console.log('Odds fetching and DB update completed successfully');
  await mongoose.disconnect();
  console.log('Disconnected from MongoDB');
}

if (require.main === module) {
  main().catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}