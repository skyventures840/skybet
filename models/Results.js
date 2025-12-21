const mongoose = require('mongoose');

const ResultsSchema = new mongoose.Schema({
  eventId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  sport_key: {
    type: String,
    required: true,
    index: true
  },
  sport_title: {
    type: String,
    required: true
  },
  commence_time: {
    type: Date,
    required: true,
    index: true
  },
  completed: {
    type: Boolean,
    default: false,
    index: true
  },
  home_team: {
    type: String,
    required: true
  },
  away_team: {
    type: String,
    required: true
  },
  scores: [{
    name: {
      type: String,
      required: true
    },
    score: {
      type: String,
      required: true
    }
  }],
  last_update: {
    type: Date,
    default: Date.now
  },
  // Additional metadata
  season: {
    type: String
  },
  week: {
    type: Number
  },
  // Caching metadata
  lastFetched: {
    type: Date,
    default: Date.now
  },
  fetchCount: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
ResultsSchema.index({ sport_key: 1, commence_time: -1 });
ResultsSchema.index({ sport_key: 1, completed: 1 });
ResultsSchema.index({ completed: 1, last_update: -1 });

// TTL index to automatically remove old completed results after 90 days
ResultsSchema.index({ last_update: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

module.exports = mongoose.model('Results', ResultsSchema);