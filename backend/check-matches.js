const mongoose = require('mongoose');
const Match = require('./models/Match');

async function checkMatches() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/platypus');
    console.log('Connected to MongoDB');
    
    // Get all matches with their statuses
    const matches = await Match.find({}).select('homeTeam awayTeam startTime status sport createdAt').sort({ startTime: -1 }).limit(20);
    console.log('\n=== Recent Matches ===');
    matches.forEach(match => {
      console.log(`${match.homeTeam} vs ${match.awayTeam} | Status: ${match.status} | Start: ${match.startTime} | Sport: ${match.sport}`);
    });
    
    // Count matches by status
    const statusCounts = await Match.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    console.log('\n=== Match Status Counts ===');
    statusCounts.forEach(status => {
      console.log(`${status._id}: ${status.count}`);
    });
    
    // Check for live matches specifically
    const liveMatches = await Match.find({ status: 'live' }).select('homeTeam awayTeam startTime');
    console.log(`\n=== Live Matches (${liveMatches.length}) ===`);
    liveMatches.forEach(match => {
      console.log(`${match.homeTeam} vs ${match.awayTeam} | Start: ${match.startTime}`);
    });
    
    // Check matches that should be live (started but not finished)
    const now = new Date();
    const shouldBeLive = await Match.find({
      startTime: { $lte: now },
      status: { $in: ['upcoming', 'live'] }
    }).select('homeTeam awayTeam startTime status');
    console.log(`\n=== Matches that should be live (${shouldBeLive.length}) ===`);
    shouldBeLive.forEach(match => {
      console.log(`${match.homeTeam} vs ${match.awayTeam} | Status: ${match.status} | Start: ${match.startTime}`);
    });
    
    await mongoose.disconnect();
    console.log('\nDatabase check completed');
  } catch (err) {
    console.error('Database connection error:', err);
    process.exit(1);
  }
}

checkMatches();