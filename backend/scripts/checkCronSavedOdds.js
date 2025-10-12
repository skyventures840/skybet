require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env'), override: true });
const mongoose = require('mongoose');

const Odds = require('../models/Odds');
const Match = require('../models/Match');

async function main() {
  const mongoURI = process.env.MONGODB_URI;
  if (!mongoURI) {
    throw new Error('MONGODB_URI environment variable is required');
  }

  await mongoose.connect(mongoURI);
  console.log('Connected to MongoDB');

  try {
    const totalOdds = await Odds.countDocuments({});
    console.log('Total Odds documents:', totalOdds);

    const sports = [
      'basketball_nba',
      'soccer_epl',
      'americanfootball_nfl',
      'americanfootball_cfl',
      'baseball_mlb',
      'icehockey_nhl',
    ];
    for (const sk of sports) {
      const c = await Odds.countDocuments({ sport_key: sk });
      console.log(`Odds documents for ${sk}:`, c);
    }

    const upcomingMatches = await Match.countDocuments({ status: 'upcoming' });
    console.log('Upcoming Match documents:', upcomingMatches);

    const sampleOdds = await Odds.findOne({}).lean();
    if (sampleOdds) {
      console.log('Sample Odds:', {
        sport_key: sampleOdds.sport_key,
        gameId: sampleOdds.gameId,
        home_team: sampleOdds.home_team,
        away_team: sampleOdds.away_team,
        bookmaker_count: Array.isArray(sampleOdds.bookmakers) ? sampleOdds.bookmakers.length : 0,
        lastFetched: sampleOdds.lastFetched,
      });
    } else {
      console.log('No sample Odds document found.');
    }
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Check failed:', err?.message || err);
    process.exit(1);
  });
}