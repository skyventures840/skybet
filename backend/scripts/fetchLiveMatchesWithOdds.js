require('dotenv').config();
const mongoose = require('mongoose');
const Odds = require('../models/Odds');

async function fetchLiveMatchesWithOdds() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/platypus');
    console.log('Connected to MongoDB');
    
    const now = new Date();
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    
    console.log(`Fetching live matches with odds (started within last 3 hours)`);
    console.log(`Time range: ${threeHoursAgo.toLocaleString()} to ${now.toLocaleString()}`);
    console.log('='.repeat(100));
    
    // Find odds that should be live (started within last 3 hours)
    const liveOdds = await Odds.find({
      commence_time: { 
        $lte: now, 
        $gte: threeHoursAgo
      },
      'bookmakers.0': { $exists: true } // Only include matches with at least one bookmaker
    }).sort({ commence_time: 1 });
    
    console.log(`\nFound ${liveOdds.length} live matches with odds data:`);
    
    if (liveOdds.length === 0) {
      console.log('No live matches with odds data found.');
      
      // Check if there are any matches without bookmakers
      const matchesWithoutBookmakers = await Odds.find({
        commence_time: { 
          $lte: now, 
          $gte: threeHoursAgo
        },
        bookmakers: { $size: 0 }
      });
      
      if (matchesWithoutBookmakers.length > 0) {
        console.log(`\nFound ${matchesWithoutBookmakers.length} matches without bookmaker data:`);
        matchesWithoutBookmakers.forEach(match => {
          console.log(`- ${match.home_team} vs ${match.away_team} (${match.sport_key})`);
        });
      }
      
      return;
    }
    
    liveOdds.forEach((odds, index) => {
      const matchTime = new Date(odds.commence_time);
      const timeDiff = Math.floor((now - matchTime) / 60000); // minutes
      const hours = Math.floor(timeDiff / 60);
      const minutes = timeDiff % 60;
      
      console.log(`\n${index + 1}. ${odds.home_team} vs ${odds.away_team}`);
      console.log(`   Sport: ${odds.sport_key} (${odds.sport_title})`);
      console.log(`   Start Time: ${matchTime.toLocaleString()}`);
      console.log(`   Time Elapsed: ${hours}h ${minutes}m`);
      console.log(`   Game ID: ${odds.gameId}`);
      console.log(`   Bookmakers: ${odds.bookmakers?.length || 0}`);
      
      // Show detailed odds information
      if (odds.bookmakers && odds.bookmakers.length > 0) {
        console.log(`\n   Odds Details:`);
        console.log(`   ------------`);
        
        odds.bookmakers.forEach((bookmaker, bmIndex) => {
          console.log(`   ${bmIndex + 1}. ${bookmaker.title} (${bookmaker.key})`);
          
          if (bookmaker.markets && bookmaker.markets.length > 0) {
            bookmaker.markets.forEach(market => {
              console.log(`      Market: ${market.key}`);
              
              if (market.outcomes && market.outcomes.length > 0) {
                market.outcomes.forEach(outcome => {
                  const oddsStr = outcome.price ? outcome.price.toFixed(2) : 'N/A';
                  const pointStr = outcome.point ? ` (${outcome.point > 0 ? '+' : ''}${outcome.point})` : '';
                  console.log(`        ${outcome.name}: ${oddsStr}${pointStr}`);
                });
              }
            });
          }
          console.log('');
        });
      }
    });
    
    // Show summary statistics
    const sportsCount = {};
    liveOdds.forEach(odds => {
      sportsCount[odds.sport_key] = (sportsCount[odds.sport_key] || 0) + 1;
    });
    
    console.log('\nSummary by Sport:');
    console.log('='.repeat(30));
    Object.entries(sportsCount).forEach(([sport, count]) => {
      console.log(`${sport}: ${count} matches`);
    });
    
    // Show total bookmakers and markets
    const totalBookmakers = liveOdds.reduce((sum, odds) => sum + (odds.bookmakers?.length || 0), 0);
    const totalMarkets = liveOdds.reduce((sum, odds) => {
      return sum + (odds.bookmakers?.reduce((bmSum, bm) => bmSum + (bm.markets?.length || 0), 0) || 0);
    }, 0);
    
    console.log(`\nTotal Bookmakers: ${totalBookmakers}`);
    console.log(`Total Markets: ${totalMarkets}`);
    
  } catch (error) {
    console.error('Error fetching live matches:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the function if this script is executed directly
if (require.main === module) {
  fetchLiveMatchesWithOdds().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

module.exports = { fetchLiveMatchesWithOdds };