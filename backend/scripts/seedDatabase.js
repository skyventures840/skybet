require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
// Logger removed during cleanup - using console for now

// Import models
const Match = require('../models/Match');
const Odds = require('../models/Odds');

class DatabaseSeeder {
  constructor() {
    this.mongoURI = process.env.MONGODB_URI;
    
    if (!this.mongoURI) {
      throw new Error('MONGODB_URI environment variable is required');
    }
  }

  async connect() {
      try {
    await mongoose.connect(this.mongoURI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    throw error;
  }
  }

  async disconnect() {
    try {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB');
    } catch (error) {
      console.error('Error disconnecting from MongoDB:', error.message);
    }
  }

  /**
   * Transform API data to database format
   */
  transformMatchData(apiMatch) {
    // Handle MongoDB document format
    let matchData = apiMatch;
    if (apiMatch._doc) {
      matchData = apiMatch._doc;
    }
    
    return {
      gameId: matchData.gameId || matchData.id,
      sport_key: matchData.sport_key,
      sport_title: matchData.sport_title,
      commence_time: new Date(matchData.commence_time),
      home_team: matchData.home_team,
      away_team: matchData.away_team,
      bookmakers: matchData.bookmakers,
      lastFetched: new Date()
    };
  }

  /**
   * Seed database from JSON files
   */
  async seedFromJsonFiles() {
    try {
      await this.connect();

      // Clear existing data
      await Odds.deleteMany({});
      await Match.deleteMany({});
      logger.info('Cleared existing data');

      // Get all JSON files in the backend directory
      const files = fs.readdirSync(path.join(__dirname, '..'))
        .filter(file => file.endsWith('.json') && file.includes('_matches_'));

      logger.info(`Found ${files.length} match data files`);

      let totalMatches = 0;
      let totalOdds = 0;

      for (const file of files) {
        try {
          const filePath = path.join(__dirname, '..', file);
          const fileContent = fs.readFileSync(filePath, 'utf8');
          const matches = JSON.parse(fileContent);

          logger.info(`Processing ${file} with ${matches.length} matches`);

          // Transform and save matches
          const transformedMatches = matches.map(match => this.transformMatchData(match));

          // Save to Odds collection
          if (transformedMatches.length > 0) {
            const bulkOps = transformedMatches.map(match => ({
              updateOne: {
                filter: { gameId: match.gameId },
                update: { $set: match },
                upsert: true
              }
            }));

            await Odds.bulkWrite(bulkOps, { ordered: false });
            totalOdds += transformedMatches.length;
            logger.info(`Saved ${transformedMatches.length} odds records from ${file}`);
          }

          // Also save to Match collection for compatibility
          const matchData = transformedMatches.map(match => ({
            _id: match.gameId,
            sport: match.sport_key,
            league: match.sport_title,
            homeTeam: match.home_team,
            awayTeam: match.away_team,
            startTime: match.commence_time,
            odds: match.bookmakers,
            status: 'upcoming'
          }));

          if (matchData.length > 0) {
            const matchBulkOps = matchData.map(match => ({
              updateOne: {
                filter: { _id: match._id },
                update: { $set: match },
                upsert: true
              }
            }));

            await Match.bulkWrite(matchBulkOps, { ordered: false });
            totalMatches += matchData.length;
            logger.info(`Saved ${matchData.length} match records from ${file}`);
          }

        } catch (error) {
          logger.error(`Error processing file ${file}:`, error.message);
          continue;
        }
      }

      logger.info(`Database seeding completed. Total odds: ${totalOdds}, Total matches: ${totalMatches}`);

    } catch (error) {
      logger.error('Error seeding database:', error);
      throw error;
    } finally {
      await this.disconnect();
    }
  }

  /**
   * Seed database from live API data
   */
  async seedFromLiveAPI() {
    try {
      await this.connect();

      // Clear existing data
      await Odds.deleteMany({});
      await Match.deleteMany({});
      logger.info('Cleared existing data');

      // Import and use the OddsFetcher
      const OddsFetcher = require('./fetchOdds');
      const fetcher = new OddsFetcher();

      // Get all sports
      const sports = await fetcher.getSports();
      const supportedSports = sports.filter(sport => 
        !sport.key.includes('politics') && 
        !sport.key.includes('entertainment') &&
        sport.key !== 'golf_the_open_championship_winner'
      );

      logger.info(`Processing ${supportedSports.length} sports from live API`);

      let totalMatches = 0;
      let totalOdds = 0;

      for (const sport of supportedSports) {
        try {
          logger.info(`Processing sport: ${sport.title} (${sport.key})`);
          
          const matches = await fetcher.fetchAllOddsForSport(sport.key);
          
          if (matches.length > 0) {
            // Transform and save matches
            const transformedMatches = matches.map(match => this.transformMatchData(match));

            // Save to Odds collection
            const bulkOps = transformedMatches.map(match => ({
              updateOne: {
                filter: { gameId: match.gameId },
                update: { $set: match },
                upsert: true
              }
            }));

            await Odds.bulkWrite(bulkOps, { ordered: false });
            totalOdds += transformedMatches.length;

            // Also save to Match collection
            const matchData = transformedMatches.map(match => ({
              _id: match.gameId,
              sport: match.sport_key,
              league: match.sport_title,
              homeTeam: match.home_team,
              awayTeam: match.away_team,
              startTime: match.commence_time,
              odds: match.bookmakers,
              status: 'upcoming'
            }));

            const matchBulkOps = matchData.map(match => ({
              updateOne: {
                filter: { _id: match._id },
                update: { $set: match },
                upsert: true
              }
            }));

            await Match.bulkWrite(matchBulkOps, { ordered: false });
            totalMatches += matchData.length;

            logger.info(`Saved ${transformedMatches.length} matches for ${sport.title}`);
          }

          // Rate limiting between sports
          await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error) {
          logger.error(`Error processing sport ${sport.key}:`, error.message);
          continue;
        }
      }

      logger.info(`Live API seeding completed. Total odds: ${totalOdds}, Total matches: ${totalMatches}`);

    } catch (error) {
      logger.error('Error seeding from live API:', error);
      throw error;
    } finally {
      await this.disconnect();
    }
  }
}

// Main execution
async function main() {
  const seeder = new DatabaseSeeder();
  
  const args = process.argv.slice(2);
  const mode = args[0] || 'json';

  if (mode === 'live') {
    logger.info('Starting live API seeding...');
    await seeder.seedFromLiveAPI();
  } else {
    logger.info('Starting JSON file seeding...');
    await seeder.seedFromJsonFiles();
  }
}

if (require.main === module) {
  main().catch(error => {
    logger.error('Seeding failed:', error);
    process.exit(1);
  });
}

module.exports = DatabaseSeeder; 