const mongoose = require('mongoose');
const Match = require('./models/Match');

async function checkMatch() {
  try {
    await mongoose.connect('mongodb://localhost:27017/ween_sports_betting');
    const matches = await Match.find({}).limit(5);
    matches.forEach(match => {
      console.log('Match ID:', match._id, 'Type:', typeof match._id);
      console.log('External ID:', match.externalId);
    });
    await mongoose.disconnect();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

checkMatch();
