require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

// Set environment variables for testing
process.env.ODDS_API_KEY = '4d48e30d89d3d26fe946c1ea1aa91421';
const mongoose = require('mongoose');
const { OddsApiService } = require('../services/oddsApiService');
const Odds = require('../models/Odds');

/**
 * Script to demonstrate upserting additional markets for existing events
 * This script shows how to progressively enhance odds data with additional markets
 * 
 * Usage examples:
 * 1. Add player props to existing NBA games
 * 2. Add alternate lines to existing NFL games  
 * 3. Add period markets to existing games
 */

async function main() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const oddsService = new OddsApiService();

    // Example 1: Find existing NBA games and add player props
    console.log('\n=== Example 1: Adding Player Props to NBA Games ===');
    const nbaGames = await Odds.find({ 
      sport_key: 'basketball_nba',
      commence_time: { $gte: new Date() } // Only upcoming games
    }).limit(5);

    if (nbaGames.length > 0) {
      const nbaEventIds = nbaGames.map(game => game.gameId);
      console.log(`Found ${nbaEventIds.length} NBA games to enhance`);

      // Add player props markets
      const playerPropsMarkets = [
        'player_points',
        'player_rebounds', 
        'player_assists',
        'player_threes',
        'player_blocks',
        'player_steals'
      ];

      const nbaResult = await oddsService.upsertAdditionalMarkets(
        'basketball_nba',
        nbaEventIds,
        playerPropsMarkets,
        {
          regions: ['us', 'us2'],
          oddsFormat: 'decimal'
        }
      );

      console.log('NBA Player Props Result:', {
        successful: nbaResult.successful.length,
        failed: nbaResult.failed.length,
        marketsAdded: nbaResult.marketsAdded
      });

      if (nbaResult.failed.length > 0) {
        console.log('Failed events:', nbaResult.failed.slice(0, 3));
      }
    } else {
      console.log('No NBA games found');
    }

    // Example 2: Find existing NFL games and add alternate lines
    console.log('\n=== Example 2: Adding Alternate Lines to NFL Games ===');
    const nflGames = await Odds.find({ 
      sport_key: 'americanfootball_nfl',
      commence_time: { $gte: new Date() }
    }).limit(3);

    if (nflGames.length > 0) {
      const nflEventIds = nflGames.map(game => game.gameId);
      console.log(`Found ${nflEventIds.length} NFL games to enhance`);

      // Add alternate markets
      const alternateMarkets = [
        'alternate_spreads',
        'alternate_totals',
        'alternate_team_totals'
      ];

      const nflResult = await oddsService.upsertAdditionalMarkets(
        'americanfootball_nfl',
        nflEventIds,
        alternateMarkets
      );

      console.log('NFL Alternate Lines Result:', {
        successful: nflResult.successful.length,
        failed: nflResult.failed.length,
        marketsAdded: nflResult.marketsAdded
      });
    } else {
      console.log('No NFL games found');
    }

    // Example 3: Test market support for a specific sport
    console.log('\n=== Example 3: Testing Market Support ===');
    const testMarkets = [
      'h2h', 'spreads', 'totals',
      'alternate_spreads', 'alternate_totals',
      'player_points', 'player_rebounds',
      'h2h_h1', 'h2h_h2'
    ];

    const supportTest = await oddsService.getSupportedMarkets('basketball_nba', testMarkets);
    console.log('NBA Market Support Test:', {
      supported: supportTest.supported,
      unsupported: supportTest.unsupported
    });

    // Example 4: Progressive enhancement - basic first, then additional
    console.log('\n=== Example 4: Progressive Market Enhancement ===');
    
    // First, ensure we have basic markets (this would typically be done by fetchOdds.js)
    console.log('Step 1: Basic markets should already exist from fetchOdds.js');
    
    // Then add additional markets progressively
    const soccerGames = await Odds.find({ 
      sport_key: 'soccer_epl',
      commence_time: { $gte: new Date() }
    }).limit(2);

    if (soccerGames.length > 0) {
      const soccerEventIds = soccerGames.map(game => game.gameId);
      
      // Add soccer-specific markets
      const soccerMarkets = [
        'btts', // Both teams to score
        'draw_no_bet',
        'double_chance',
        'h2h_3_way'
      ];

      const soccerResult = await oddsService.upsertAdditionalMarkets(
        soccerEventIds,
        soccerMarkets
      );

      console.log('Soccer Additional Markets Result:', {
        successful: soccerResult.successful.length,
        failed: soccerResult.failed.length,
        marketsAdded: soccerResult.marketsAdded
      });
    } else {
      console.log('No soccer games found');
    }

    console.log('\n=== Market Upsert Examples Completed ===');

  } catch (error) {
    console.error('Error in market upsert script:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Handle command line arguments for specific operations
const args = process.argv.slice(2);
if (args.length > 0) {
  const operation = args[0];
  const sportKey = args[1];
  const markets = args.slice(2);

  if (operation === 'test-support' && sportKey) {
    // Test market support for specific sport
    mongoose.connect(process.env.MONGODB_URI).then(async () => {
      const oddsService = new OddsApiService();
      const result = await oddsService.getSupportedMarkets(sportKey, markets.length > 0 ? markets : undefined);
      console.log(`Market support for ${sportKey}:`, result);
      await mongoose.disconnect();
    });
  } else if (operation === 'upsert' && sportKey && markets.length > 0) {
    // Upsert specific markets for a sport
    mongoose.connect(process.env.MONGODB_URI).then(async () => {
      const oddsService = new OddsApiService();
      const games = await Odds.find({ 
        sport_key: sportKey,
        commence_time: { $gte: new Date() }
      }).limit(5);
      
      if (games.length > 0) {
        const eventIds = games.map(game => game.gameId);
        const result = await oddsService.upsertAdditionalMarkets(sportKey, eventIds, markets);
        console.log(`Upsert result for ${sportKey}:`, result);
      } else {
        console.log(`No games found for ${sportKey}`);
      }
      
      await mongoose.disconnect();
    });
  } else {
    console.log('Usage:');
    console.log('  node upsertAdditionalMarkets.js                                    # Run all examples');
    console.log('  node upsertAdditionalMarkets.js test-support <sport_key> [markets] # Test market support');
    console.log('  node upsertAdditionalMarkets.js upsert <sport_key> <market1> <market2> ... # Upsert markets');
    console.log('');
    console.log('Examples:');
    console.log('  node upsertAdditionalMarkets.js test-support basketball_nba');
    console.log('  node upsertAdditionalMarkets.js upsert basketball_nba player_points player_rebounds');
  }
} else {
  // Run main examples
  main();
}