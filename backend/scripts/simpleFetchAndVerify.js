require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');

const { OddsApiService } = require('../services/oddsApiService');
const Odds = require('../models/Odds');

async function main() {
  const mongoURI = process.env.MONGODB_URI;
  if (!mongoURI) {
    throw new Error('MONGODB_URI environment variable is required');
  }

  await mongoose.connect(mongoURI);
  console.log('Connected to MongoDB');

  const service = new OddsApiService();
  if (!service.isEnabled) {
    console.error('OddsApiService is disabled (missing ODDS_API_KEY or base URL).');
    await mongoose.disconnect();
    process.exit(1);
  }

  const sportKey = process.env.TEST_SPORT_KEY || 'basketball_nba';
  console.log(`Fetching upcoming odds for sport: ${sportKey}`);

  try {
    // Try batch fetch with common markets to avoid reliance on markets discovery
    const commonMarkets = (process.env.TEST_MARKETS || 'h2h,spreads,totals').split(',');
    await service._fetchAndSaveOddsForMarketsBatch(sportKey, commonMarkets);
    const rateInfo = service.getLastRateLimitInfo ? service.getLastRateLimitInfo() : null;
    if (rateInfo) {
      console.log('Rate limit info:', rateInfo);
    }
  } catch (err) {
    console.error('Error fetching odds:', err?.message || err);
  }

  // Verify documents are saved
  const count = await Odds.countDocuments({ sport_key: sportKey });
  console.log(`Odds documents saved for ${sportKey}: ${count}`);

  const sample = await Odds.findOne({ sport_key: sportKey }).lean();
  if (sample) {
    console.log('Sample saved odds document summary:', {
      gameId: sample.gameId,
      commence_time: sample.commence_time,
      home_team: sample.home_team,
      away_team: sample.away_team,
      bookmaker_count: Array.isArray(sample.bookmakers) ? sample.bookmakers.length : 0,
    });
  } else {
    console.log('No odds documents found for this sport.');
  }

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB');
}

if (require.main === module) {
  main().catch(error => {
    console.error('Verification script failed:', error);
    process.exit(1);
  });
}