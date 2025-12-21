const mongoose = require('mongoose');

const leagueSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  leagueId: { type: String, required: true, unique: true },
  externalPrefix: { type: String, required: true }
});

module.exports = mongoose.model('League', leagueSchema); 