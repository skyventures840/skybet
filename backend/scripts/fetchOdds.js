require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
// Logger removed during cleanup - using console for now
const OddsFetcher = require('./OddsFetcher');
const Odds = require('../models/Odds');
const Match = require('../models/Match');
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
  console.log('Cleared existing Odds and Match collections');

  const fetcher = new OddsFetcher();
  const sports = await fetcher.getSports();
  const supportedSports = sports.filter(sport =>
    !sport.key.includes('politics') &&
    !sport.key.includes('entertainment') &&
    sport.key !== 'golf_the_open_championship_winner'
  );

  console.log(`Processing ${supportedSports.length} supported sports`);

  for (const sport of supportedSports) {
    try {
      console.log(`Fetching and merging odds for sport: ${sport.title} (${sport.key})`);
      const matches = await fetcher.fetchAllOddsForSport(sport.key);
      console.log(`Fetched and merged ${matches.length} matches for ${sport.key}`);

      if (matches.length > 0) {
        // Enrich matches with real team names
        const enrichedMatches = matches;
        // Save to Odds collection
        const oddsBulkOps = enrichedMatches.map(match => ({
          updateOne: {
            filter: { gameId: match.id },
            update: {
              $set: {
                gameId: match.id,
                sport_key: match.sport_key,
                sport_title: match.sport_title,
                commence_time: new Date(match.commence_time),
                home_team: match.home_team,
                away_team: match.away_team,
                bookmakers: match.bookmakers,
                lastFetched: new Date()
              }
            },
            upsert: true
          }
        }));
        await Odds.bulkWrite(oddsBulkOps, { ordered: false });
        console.log(`Saved ${enrichedMatches.length} odds records for ${sport.key}`);

        // Save to Match collection (frontend expects this format)
        const matchBulkOps = enrichedMatches.map(match => ({
          updateOne: {
            filter: { _id: match.id },
            update: {
              $set: {
                _id: match.id,
                sport: match.sport_key,
                league: match.sport_title,
                homeTeam: match.home_team,
                awayTeam: match.away_team,
                startTime: new Date(match.commence_time),
                odds: match.bookmakers,
                status: 'upcoming'
              }
            },
            upsert: true
          }
        }));
        await Match.bulkWrite(matchBulkOps, { ordered: false });
        console.log(`Saved ${enrichedMatches.length} match records for ${sport.key}`);
      }
      // Rate limiting between sports
      await fetcher.sleep(2000);
    } catch (error) {
      console.error(`Error processing sport ${sport.key}:`, error.message);
      continue;
    }
  }

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