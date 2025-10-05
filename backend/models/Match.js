const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  leagueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'League',
    required: true,
    index: true
  },
  externalId: { type: String, unique: true, sparse: true, index: true },
  sport: {
    type: String,
    required: true,
    enum: ['football', 'basketball', 'tennis', 'baseball', 'hockey', 'soccer'],
    index: true
  },
  homeTeam: {
    type: String,
    required: true,
    trim: true
  },
  awayTeam: {
    type: String,
    required: true,
    trim: true
  },
  startTime: {
    type: Date,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['upcoming', 'live', 'finished', 'cancelled', 'postponed'],
    default: 'upcoming',
    index: true
  },
  homeScore: {
    type: Number,
    default: null
  },
  awayScore: {
    type: Number,
    default: null
  },
  odds: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,  // Allow any value in the map
    default: new Map()  // Default to empty Map
  },
  // New field to control video display
  videoDisplayControl: {
    type: String,
    enum: ['scheduled', 'manual', 'live_only'],
    default: 'scheduled',
    description: 'scheduled: show countdown until start, manual: admin controls, live_only: only when match is live'
  },
  markets: [{
    id: String,
    name: String,
    selections: [{
      id: String,
      name: String,
      odds: Number
    }]
  }],
  liveData: {
    minute: { type: Number },
    period: { type: String },
    events: [{
      type: String,
      minute: Number,
      team: String,
      player: String,
      description: String
    }]
  },
  finishedAt: {
    type: Date
  },
  // Media for scheduled playback
  videoUrl: {
    type: String,
    default: null
  },
  videoPosterUrl: {
    type: String,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
matchSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Static method to get matches by league
matchSchema.statics.getByLeague = function(leagueId, status = 'upcoming') {
  return this.find({ leagueId, status }).sort({ startTime: 1 });
};

// Static method to get live matches
matchSchema.statics.getLiveMatches = function() {
  return this.find({ status: 'live' }).sort({ startTime: 1 });
};

// Static method to get upcoming matches
matchSchema.statics.getUpcomingMatches = function(limit = 20) {
  return this.find({ 
    status: 'upcoming',
    startTime: { $gte: new Date() }
  })
  .sort({ startTime: 1 })
  .limit(limit);
};

// Static method to update odds
matchSchema.statics.updateOdds = function(matchId, newOdds) {
  return this.findByIdAndUpdate(
    matchId,
    { 
      odds: newOdds,
      updatedAt: Date.now()
    },
    { new: true }
  );
};

// Instance method to get basic odds (1, X, 2) for display
matchSchema.methods.getBasicOdds = function() {
  const basicOdds = {};
  
  if (this.odds) {
    // Basic 1X2 odds
    if (this.odds.has('1') || this.odds.has('homeWin')) {
      basicOdds['1'] = this.odds.get('1') || this.odds.get('homeWin');
    }
    if (this.odds.has('X') || this.odds.has('draw')) {
      basicOdds['X'] = this.odds.get('X') || this.odds.get('draw');
    }
    if (this.odds.has('2') || this.odds.has('awayWin')) {
      basicOdds['2'] = this.odds.get('2') || this.odds.get('awayWin');
    }
  }
  
  return basicOdds;
};

// Instance method to get additional markets (non-basic odds)
matchSchema.methods.getAdditionalMarkets = function() {
  const additionalMarkets = {};
  const basicKeys = ['1', 'X', '2', 'homeWin', 'awayWin', 'draw'];
  
  if (this.odds) {
    this.odds.forEach((value, key) => {
      if (!basicKeys.includes(key) && value && typeof value === 'number' && value > 0) {
        additionalMarkets[key] = value;
      }
    });
  }
  
  return additionalMarkets;
};

// Instance method to check if video should be displayed
matchSchema.methods.shouldShowVideo = function() {
  if (!this.videoUrl) return false;
  
  switch (this.videoDisplayControl) {
    case 'scheduled':
      return new Date() >= this.startTime;
    case 'manual':
      return true; // Admin controls this
    case 'live_only':
      return this.status === 'live';
    default:
      return new Date() >= this.startTime;
  }
};

// Instance method to get available markets
matchSchema.methods.getMarkets = function() {
  const markets = [];

  if (this.odds) {
    // Match Winner market
    if (this.odds.homeWin && this.odds.awayWin) {
      const matchWinner = {
        id: 'match_winner',
        name: 'Match Winner',
        selections: [
          { id: 'home', name: this.homeTeam, odds: this.odds.homeWin },
          { id: 'away', name: this.awayTeam, odds: this.odds.awayWin }
        ]
      };

      // Add draw for applicable sports
      if (this.odds.draw && ['football', 'soccer'].includes(this.sport)) {
        matchWinner.selections.splice(1, 0, {
          id: 'draw',
          name: 'Draw',
          odds: this.odds.draw
        });
      }

      markets.push(matchWinner);
    }

    // Total market
    if (this.odds.over && this.odds.under && this.odds.total) {
      markets.push({
        id: 'total',
        name: `Total ${this.sport === 'football' || this.sport === 'soccer' ? 'Goals' : 'Points'}`,
        line: this.odds.total,
        selections: [
          { id: 'over', name: `Over ${this.odds.total}`, odds: this.odds.over },
          { id: 'under', name: `Under ${this.odds.total}`, odds: this.odds.under }
        ]
      });
    }

    // Handicap market
    if (this.odds.homeHandicap && this.odds.awayHandicap && this.odds.handicapLine) {
      markets.push({
        id: 'handicap',
        name: 'Handicap',
        line: this.odds.handicapLine,
        selections: [
          { 
            id: 'home_handicap', 
            name: `${this.homeTeam} (${this.odds.handicapLine > 0 ? '+' : ''}${this.odds.handicapLine})`, 
            odds: this.odds.homeHandicap 
          },
          { 
            id: 'away_handicap', 
            name: `${this.awayTeam} (${this.odds.handicapLine < 0 ? '+' : ''}${-this.odds.handicapLine})`, 
            odds: this.odds.awayHandicap 
          }
        ]
      });
    }
  }

  return markets;
};

module.exports = mongoose.model('Match', matchSchema);