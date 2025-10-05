const mongoose = require('mongoose');

const matchOutcomeSchema = new mongoose.Schema({
  matchId: {
    type: String,
    required: true,
    index: true
  },
  homeTeam: {
    type: String,
    required: true
  },
  awayTeam: {
    type: String,
    required: true
  },
  league: {
    type: String,
    required: true
  },
  startTime: {
    type: Date,
    required: true
  },
  outcome: {
    type: String,
    enum: ['1', 'X', '2'],
    required: true
  },
  odds: {
    type: Number,
    required: true,
    min: 1.01
  },
  status: {
    type: String,
    enum: ['Pending', 'Win', 'Loss', 'Void'],
    default: 'Pending'
  },
  matchStatus: {
    type: String,
    enum: ['Scheduled', 'Live', 'Finished', 'Cancelled'],
    default: 'Scheduled'
  },
  result: {
    homeScore: Number,
    awayScore: Number,
    finalOutcome: String // '1', 'X', '2'
  }
}, { timestamps: true });

const multiBetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  betslipId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  matches: [matchOutcomeSchema],
  combinedOdds: {
    type: Number,
    required: true,
    min: 1.01
  },
  stake: {
    type: Number,
    required: true,
    min: 0.01
  },
  potentialPayout: {
    type: Number,
    required: true,
    min: 0.01
  },
  status: {
    type: String,
    enum: ['Pending', 'Win', 'Loss', 'Void', 'Partial'],
    default: 'Pending'
  },
  totalMatches: {
    type: Number,
    required: true,
    min: 2
  },
  wonMatches: {
    type: Number,
    default: 0
  },
  lostMatches: {
    type: Number,
    default: 0
  },
  voidMatches: {
    type: Number,
    default: 0
  },
  oddsChanged: {
    type: Boolean,
    default: false
  },
  originalOdds: [{
    matchId: String,
    originalOdds: Number,
    currentOdds: Number
  }],
  currency: {
    type: String,
    default: 'USD'
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  settledAt: Date,
  notes: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
multiBetSchema.index({ userId: 1, status: 1 });
multiBetSchema.index({ status: 1, submittedAt: -1 });
multiBetSchema.index({ 'matches.matchId': 1 });

// Virtual for win percentage
multiBetSchema.virtual('winPercentage').get(function() {
  if (this.totalMatches === 0) return 0;
  return (this.wonMatches / this.totalMatches) * 100;
});

// Virtual for settlement status
multiBetSchema.virtual('isSettled').get(function() {
  return this.status !== 'Pending';
});

// Pre-save middleware to generate betslip ID
multiBetSchema.pre('save', function(next) {
  if (!this.betslipId) {
    this.betslipId = `MB${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }
  next();
});

// Method to update match status
multiBetSchema.methods.updateMatchStatus = function(matchId, newStatus, result = null) {
  const match = this.matches.find(m => m.matchId === matchId);
  if (match) {
    match.status = newStatus;
    if (result) {
      match.result = result;
    }
    
    // Update overall bet status
    this.updateOverallStatus();
    return this.save();
  }
  return Promise.reject(new Error('Match not found'));
};

// Method to update overall bet status
multiBetSchema.methods.updateOverallStatus = function() {
  const pendingMatches = this.matches.filter(m => m.status === 'Pending');
  const wonMatches = this.matches.filter(m => m.status === 'Win');
  const lostMatches = this.matches.filter(m => m.status === 'Loss');
  const voidMatches = this.matches.filter(m => m.status === 'Void');
  
  this.wonMatches = wonMatches.length;
  this.lostMatches = lostMatches.length;
  this.voidMatches = voidMatches.length;
  
  // Determine overall status
  if (lostMatches.length > 0) {
    this.status = 'Loss';
    this.settledAt = new Date();
  } else if (pendingMatches.length === 0 && wonMatches.length === this.totalMatches) {
    this.status = 'Win';
    this.settledAt = new Date();
  } else if (voidMatches.length > 0 && pendingMatches.length === 0) {
    this.status = 'Partial';
    this.settledAt = new Date();
  }
  
  return this;
};

// Static method to calculate combined odds
multiBetSchema.statics.calculateCombinedOdds = function(oddsArray) {
  if (!Array.isArray(oddsArray) || oddsArray.length < 2) {
    throw new Error('At least 2 odds are required for a multi-bet');
  }
  
  return oddsArray.reduce((total, odds) => {
    if (typeof odds !== 'number' || odds < 1.01) {
      throw new Error('Invalid odds value');
    }
    return total * odds;
  }, 1);
};

// Static method to calculate potential payout
multiBetSchema.statics.calculatePotentialPayout = function(combinedOdds, stake) {
  if (typeof combinedOdds !== 'number' || combinedOdds < 1.01) {
    throw new Error('Invalid combined odds');
  }
  if (typeof stake !== 'number' || stake <= 0) {
    throw new Error('Invalid stake amount');
  }
  
  return combinedOdds * stake;
};

module.exports = mongoose.model('MultiBet', multiBetSchema);
