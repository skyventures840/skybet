const mongoose = require('mongoose');

const OutcomeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  point: { type: Number }, // For spreads/totals
});

const MarketSchema = new mongoose.Schema({
  key: { type: String, required: true },
  last_update: { type: Date, required: true },
  outcomes: [OutcomeSchema],
});

const BookmakerSchema = new mongoose.Schema({
  key: { type: String, required: true },
  title: { type: String, required: true },
  last_update: { type: Date, required: true },
  markets: [MarketSchema],
});

const OddsSchema = new mongoose.Schema({
  gameId: { type: String, required: true, unique: true },
  sport_key: { type: String, required: true },
  sport_title: { type: String, required: true },
  commence_time: { type: Date, required: true },
  home_team: { type: String, required: true },
  away_team: { type: String, required: true },
  bookmakers: [BookmakerSchema],
  lastFetched: { type: Date, default: Date.now },
});

// Add indexes for faster queries
OddsSchema.index({ gameId: 1 });
OddsSchema.index({ sport_key: 1 });
OddsSchema.index({ commence_time: 1 });
OddsSchema.index({ lastFetched: 1 });

// Compound indexes for common query patterns
OddsSchema.index({ sport_key: 1, commence_time: 1 }); // Sport-specific queries with time sorting
OddsSchema.index({ commence_time: 1, sport_key: 1 }); // Time-based queries with sport filter
OddsSchema.index({ sport_key: 1, lastFetched: 1 }); // For data freshness checks
OddsSchema.index({ home_team: 1, away_team: 1, commence_time: 1 }); // Team-specific queries

module.exports = mongoose.model('Odds', OddsSchema);