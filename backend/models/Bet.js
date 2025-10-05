const mongoose = require('mongoose');

const betSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  matchId: {
    type: String, // Changed from ObjectId to String for external API IDs
    required: true,
    index: true
  },
  homeTeam: {
    type: String,
    required: false,
    trim: true
  },
  awayTeam: {
    type: String,
    required: false,
    trim: true
  },
  league: {
    type: String,
    required: false,
    trim: true
  },
  market: {
    type: String,
    required: true,
    trim: true
  },
  selection: {
    type: String,
    required: true,
    trim: true
  },
  stake: {
    type: Number,
    required: true,
    min: 0.01
  },
  odds: {
    type: Number,
    required: true,
    min: 1.01
  },
  potentialWin: {
    type: Number,
    required: true
  },
  actualWin: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'won', 'lost', 'void', 'cancelled'],
    default: 'pending',
    index: true
  },
  settledAt: {
    type: Date
  },
  // For multibets/parlays - array of individual matches
  matches: [{
    matchId: String,
    homeTeam: String,
    awayTeam: String,
    selection: String,
    odds: Number,
    status: {
      type: String,
      enum: ['pending', 'won', 'lost', 'void'],
      default: 'pending'
    },
    outcome: String,
    startTime: Date
  }],
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Compound indexes for efficient queries
betSchema.index({ userId: 1, status: 1 });
betSchema.index({ matchId: 1, status: 1 });
betSchema.index({ userId: 1, createdAt: -1 });

// Static method to get bets by user
betSchema.statics.getByUser = function(userId, status = null) {
  const query = { userId };
  if (status) {
    query.status = status;
  }
  return this.find(query)
    .populate('matchId', 'homeTeam awayTeam startTime homeScore awayScore status')
    .sort({ createdAt: -1 });
};

// Static method to get bets by match
betSchema.statics.getByMatch = function(matchId) {
  return this.find({ matchId })
    .populate('userId', 'username')
    .sort({ createdAt: -1 });
};

// Static method to settle bets for a match
betSchema.statics.settleBets = async function(matchId, homeScore, awayScore) {
  const Match = mongoose.model('Match');
  const User = mongoose.model('User');
  
  const match = await Match.findById(matchId);
  if (!match) {
    throw new Error('Match not found');
  }

  const bets = await this.find({ matchId, status: 'pending' });
  
  for (const bet of bets) {
    let isWinner = false;
    
    // Determine if bet is a winner based on market and selection
    switch (bet.market) {
      case 'match_winner': {
        if (bet.selection === 'home' && homeScore > awayScore) isWinner = true;
        if (bet.selection === 'away' && awayScore > homeScore) isWinner = true;
        if (bet.selection === 'draw' && homeScore === awayScore) isWinner = true;
        break;
      }
        
      case 'total': {
        const totalScore = homeScore + awayScore;
        if (bet.selection === 'over' && totalScore > match.odds.total) isWinner = true;
        if (bet.selection === 'under' && totalScore < match.odds.total) isWinner = true;
        break;
      }
        
      case 'handicap': {
        const homeWithHandicap = homeScore + match.odds.handicapLine;
        if (bet.selection === 'home_handicap' && homeWithHandicap > awayScore) isWinner = true;
        if (bet.selection === 'away_handicap' && awayScore > homeWithHandicap) isWinner = true;
        break;
      }
    }
    
    // Update bet status and winnings
    bet.status = isWinner ? 'won' : 'lost';
    bet.actualWin = isWinner ? bet.potentialWin : 0;
    bet.settledAt = new Date();
    
    await bet.save();
    
    // Update user balance if bet won
    if (isWinner) {
      await User.updateBalance(bet.userId, bet.actualWin);
      
      // Update lifetime winnings
      await User.findByIdAndUpdate(bet.userId, {
        $inc: { lifetimeWinnings: bet.actualWin - bet.stake }
      });
    }
  }
  
  return bets.length;
};

// Static method to get betting statistics
betSchema.statics.getStats = async function(userId = null) {
  const matchCondition = userId ? { userId } : {};
  
  const stats = await this.aggregate([
    { $match: matchCondition },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalStake: { $sum: '$stake' },
        totalWin: { $sum: '$actualWin' }
      }
    }
  ]);
  
  const result = {
    totalBets: 0,
    totalStaked: 0,
    totalWon: 0,
    pendingBets: 0,
    wonBets: 0,
    lostBets: 0,
    profit: 0,
    winRate: 0
  };
  
  stats.forEach(stat => {
    result.totalBets += stat.count;
    result.totalStaked += stat.totalStake;
    result.totalWon += stat.totalWin || 0;
    
    switch (stat._id) {
      case 'pending':
        result.pendingBets = stat.count;
        break;
      case 'won':
        result.wonBets = stat.count;
        break;
      case 'lost':
        result.lostBets = stat.count;
        break;
    }
  });
  
  result.profit = result.totalWon - result.totalStaked;
  const settledBets = result.wonBets + result.lostBets;
  result.winRate = settledBets > 0 ? (result.wonBets / settledBets * 100) : 0;
  
  return result;
};

betSchema.statics.settleBets = async function(matchId, homeScore, awayScore) {
  const bets = await this.find({ matchId, status: 'pending' });
  
  for (const bet of bets) {
    let won = false;
    
    switch (bet.market) {
      case 'moneyline': {
        if (bet.selection === 'home') {
          won = homeScore > awayScore;
        } else if (bet.selection === 'away') {
          won = awayScore > homeScore;
        }
        break;
      }
      case 'handicap': {
        const handicapLine = parseFloat(bet.selection.split('(')[1]);
        if (bet.selection.includes('home')) {
          won = (homeScore + handicapLine) > awayScore;
        } else {
          won = (awayScore + handicapLine) > homeScore;
        }
        break;
      }
      case 'totals': {
        const totalLine = parseFloat(bet.selection.split('(')[1]);
        const totalScore = homeScore + awayScore;
        if (bet.selection.includes('over')) {
          won = totalScore > totalLine;
        } else {
          won = totalScore < totalLine;
        }
        break;
      }
    }
    
    await this.findByIdAndUpdate(bet._id, {
      status: won ? 'won' : 'lost',
      actualWin: won ? bet.potentialWin : 0,
      settledAt: new Date()
    });
  }
};

module.exports = mongoose.model('Bet', betSchema);