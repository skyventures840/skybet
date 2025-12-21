const mongoose = require('mongoose');

const ScoresSchema = new mongoose.Schema({
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
  // Live game status
  status: {
    type: String,
    enum: ['scheduled', 'live', 'completed', 'postponed', 'cancelled'],
    default: 'scheduled',
    index: true
  },
  // Game time information
  game_time: {
    period: {
      type: String
    },
    clock: {
      type: String
    },
    display_clock: {
      type: String
    }
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
ScoresSchema.index({ sport_key: 1, commence_time: -1 });
ScoresSchema.index({ sport_key: 1, status: 1 });
ScoresSchema.index({ status: 1, last_update: -1 });
ScoresSchema.index({ completed: 1, last_update: -1 });

// TTL index to automatically remove old completed scores after 30 days
ScoresSchema.index({ last_update: 1 }, { expireAfterSeconds: 2592000 }); // 30 days

module.exports = mongoose.model('Scores', ScoresSchema);