require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Odds = require('../models/Odds');

async function checkRegionsAndMarkets() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check sample odds document
    const sample = await Odds.findOne({}).select('bookmakers sport_key');
    if (sample) {
      console.log('\n📊 Sample odds document:');
      console.log('Sport:', sample.sport_key);
      console.log('Bookmakers found:', sample.bookmakers.map(b => b.key).join(', '));
      console.log('Total bookmakers:', sample.bookmakers.length);
    }

    // Get bookmaker distribution across all odds
    const regionStats = await Odds.aggregate([
      { $unwind: '$bookmakers' },
      { $group: { _id: '$bookmakers.key', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    console.log('\n🌍 Bookmaker distribution across all odds:');
    regionStats.forEach(stat => console.log(`  ${stat._id}: ${stat.count} occurrences`));

    // Check markets available
    const marketStats = await Odds.aggregate([
      { $unwind: '$bookmakers' },
      { $unwind: '$bookmakers.markets' },
      { $group: { _id: '$bookmakers.markets.key', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    console.log('\n📈 Market types distribution:');
    marketStats.forEach(stat => console.log(`  ${stat._id}: ${stat.count} occurrences`));

    // Check sports coverage
    const sportsStats = await Odds.aggregate([
      { $group: { _id: '$sport_key', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    console.log('\n🏈 Sports coverage:');
    sportsStats.forEach(stat => console.log(`  ${stat._id}: ${stat.count} games`));

    // Check if we have comprehensive region coverage
    const uniqueBookmakers = regionStats.map(stat => stat._id);
    const expectedRegions = ['us', 'us2', 'uk', 'au', 'eu'];
    const regionCoverage = expectedRegions.map(region => {
      const hasBookmakers = uniqueBookmakers.some(bm => 
        bm.includes(region) || 
        (region === 'us' && ['draftkings', 'fanduel', 'betmgm', 'caesars'].includes(bm)) ||
        (region === 'uk' && ['bet365', 'williamhill', 'ladbrokes'].includes(bm)) ||
        (region === 'au' && ['sportsbet', 'tab', 'pointsbet'].includes(bm)) ||
        (region === 'eu' && ['betfair', 'pinnacle', 'unibet'].includes(bm))
      );
      return { region, covered: hasBookmakers };
    });

    console.log('\n🗺️  Region coverage analysis:');
    regionCoverage.forEach(({ region, covered }) => 
      console.log(`  ${region}: ${covered ? '✅ Covered' : '❌ Not covered'}`)
    );

    await mongoose.disconnect();
    console.log('\n✅ Analysis complete');

  } catch (error) {
    console.error('Error:', error);
    await mongoose.disconnect();
  }
}

checkRegionsAndMarkets();