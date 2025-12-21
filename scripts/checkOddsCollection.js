require('dotenv').config();
const mongoose = require('mongoose');
const Odds = require('../models/Odds');
const Match = require('../models/Match');

async function checkOddsCollection() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/platypus');
    console.log('Connected to MongoDB');
    
    // Check Match collection for admin-created matches
    const matches = await Match.find({}).limit(10).sort({createdAt: -1});
    console.log(`\nFound ${matches.length} matches in Match collection:`);
    
    matches.forEach((m, index) => {
      console.log(`${index + 1}. ${m.externalId}: ${m.homeTeam} vs ${m.awayTeam}`);
      console.log(`   Sport: ${m.sport} | Status: ${m.status}`);
      console.log(`   Odds entries: ${m.odds?.size || 0}`);
      console.log('');
    });
    
    const odds = await Odds.find({}).limit(10).sort({lastFetched: -1});
    console.log(`\nFound ${odds.length} odds entries:`);
    
    odds.forEach((o, index) => {
      console.log(`${index + 1}. ${o.gameId}: ${o.home_team} vs ${o.away_team}`);
      console.log(`   Sport: ${o.sport_key} | Bookmakers: ${o.bookmakers?.length || 0}`);
      console.log(`   Last Fetched: ${o.lastFetched}`);
      console.log('');
    });
    
    // Check for admin-created matches (those with default bookmaker)
    const adminMatches = await Odds.find({ 'bookmakers.key': 'default' });
    console.log(`\nAdmin-created matches in Odds collection: ${adminMatches.length}`);
    
    adminMatches.forEach((match, index) => {
      console.log(`${index + 1}. ${match.gameId}: ${match.home_team} vs ${match.away_team}`);
      console.log(`   Markets: ${match.bookmakers[0]?.markets?.length || 0}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkOddsCollection();