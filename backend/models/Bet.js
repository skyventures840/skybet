const mongoose = require('mongoose')
const { bus } = require('../utils/cache')

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
    required: true
  },
  potentialWin: {
    type: Number,
    required: true
  },
  bonusStakeUsed: {
    type: Number,
    default: 0
  },
  realStakeUsed: {
    type: Number,
    default: 0
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
  result: {
    homeScore: Number,
    awayScore: Number,
    finalOutcome: String
  },
  settledAt: {
    type: Date
  },
  // Settlement audit trail for transparency
  settlementLog: [{
    timestamp: { type: Date, default: Date.now },
    market: String,
    selection: String,
    decision: String, // win | loss | void | half_win | half_loss | push
    payoutFactor: Number, // 1, 0.5, 0, etc.
    computedActualWin: Number,
    rule: String // brief description of applied rule (e.g., 'Asian Handicap +0.25 (half win)')
  }],
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
    startTime: Date,
    matchStatus: {
      type: String,
      enum: ['Scheduled', 'Live', 'Finished', 'Cancelled'],
      default: 'Scheduled'
    },
    result: {
      homeScore: Number,
      awayScore: Number,
      finalOutcome: String
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
})

// Compound indexes for efficient queries
betSchema.index({ userId: 1, status: 1 })
betSchema.index({ matchId: 1, status: 1 })
betSchema.index({ userId: 1, createdAt: -1 })
betSchema.index({ status: 1, createdAt: -1 }) // For admin queries
betSchema.index({ userId: 1, status: 1, createdAt: -1 }) // User-specific status queries
betSchema.index({ settledAt: 1 }) // For settlement queries
betSchema.index({ market: 1, status: 1 }) // Market-specific analytics

// Static method to get bets by user
betSchema.statics.getByUser = function (userId, status = null) {
  const query = { userId }
  if (status) {
    query.status = status
  }
  return this.find(query)
    .populate('matchId', 'homeTeam awayTeam startTime homeScore awayScore status')
    .sort({ createdAt: -1 })
}

// Static method to get bets by match
betSchema.statics.getByMatch = function (matchId) {
  return this.find({ matchId })
    .populate('userId', 'username')
    .sort({ createdAt: -1 })
}

// Static method to settle bets for a match
// Consolidated method with balance updates
betSchema.statics.settleBets = async function (matchId, homeScore, awayScore) {
  const User = mongoose.model('User')
  // Ensure matchId is string
  const matchIdStr = matchId.toString()
  const bets = await this.find({ matchId: matchIdStr, status: 'pending' })

  // Calculate match result data
  const finalOutcome = homeScore > awayScore ? '1' : homeScore < awayScore ? '2' : 'X'
  const resultData = {
    homeScore,
    awayScore,
    finalOutcome
  }

  for (const bet of bets) {
    let won = false

    switch (bet.market) {
      case 'moneyline':
      case 'match_winner': {
        if (bet.selection === 'home') {
          won = homeScore > awayScore
        } else if (bet.selection === 'away') {
          won = awayScore > homeScore
        } else if (bet.selection === 'draw') {
          won = homeScore === awayScore
        }
        break
      }
      case 'handicap': {
        // Handle "home_handicap" or "away_handicap" or parsed selection
        let handicapLine = 0
        let isHome = false

        if (bet.selection.includes('(')) {
          const lineStr = bet.selection.split('(')[1] || '0)'
          handicapLine = parseFloat(lineStr)
          isHome = bet.selection.includes('home')
        } else {
          // Fallback if match has odds.handicapLine, though bet should have it frozen
          // For now assume selection contains the line info or we need to look up match
          // Simplest assumption based on existing code:
          isHome = bet.selection.includes('home')
        }

        if (isHome) {
          won = (homeScore + handicapLine) > awayScore
        } else {
          won = (awayScore + handicapLine) > homeScore
        }
        break
      }
      case 'totals':
      case 'total': {
        // Handle "over(2.5)" or similar
        let totalLine = 0
        let isOver = false

        if (bet.selection.includes('(')) {
          const lineStr = bet.selection.split('(')[1] || '0)'
          totalLine = parseFloat(lineStr)
          isOver = bet.selection.includes('over')
        }

        const totalScore = homeScore + awayScore
        if (isOver) {
          won = totalScore > totalLine
        } else {
          won = totalScore < totalLine
        }
        break
      }
      default:
        // Fallback simple winner evaluation
        if (bet.selection === 'home') won = homeScore > awayScore
        if (bet.selection === 'away') won = awayScore > homeScore
        if (bet.selection === 'draw') won = homeScore === awayScore
    }

    const update = {
      status: won ? 'won' : 'lost',
      actualWin: won ? bet.potentialWin : 0,
      settledAt: new Date(),
      result: resultData
    }

    await this.findByIdAndUpdate(bet._id, update)

    // Update user balance if bet won
    if (won) {
      await User.settleBetWin(bet.userId, update.actualWin)

      // Update lifetime winnings
      await User.findByIdAndUpdate(bet.userId, {
        $inc: { lifetimeWinnings: update.actualWin - bet.stake }
      })
    }

    // Emit user-scoped event for realtime UI sync
    try {
      bus.emit('bets:update', {
        userId: String(bet.userId),
        betId: String(bet._id),
        matchId: bet.matchId,
        status: update.status,
        actualWin: update.actualWin,
        settledAt: update.settledAt,
        homeScore,
        awayScore,
        result: resultData
      })

      // Also broadcast via global websocket server if available (matches betSettlementService behavior)
      if (global.websocketServer && typeof global.websocketServer.broadcastBetStatusUpdate === 'function') {
        global.websocketServer.broadcastBetStatusUpdate(
          String(bet._id),
          String(bet.userId),
          update.status,
          bet.matches || [],
          resultData
        )
      }
    } catch (e) {
      // Ignore bus errors
    }
  }

  return bets.length
}

// Static method to get betting statistics
betSchema.statics.getStats = async function (userId = null) {
  const matchCondition = userId ? { userId } : {}

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
  ])

  const result = {
    totalBets: 0,
    totalStaked: 0,
    totalWon: 0,
    pendingBets: 0,
    wonBets: 0,
    lostBets: 0,
    profit: 0,
    winRate: 0
  }

  stats.forEach(stat => {
    result.totalBets += stat.count
    result.totalStaked += stat.totalStake
    result.totalWon += stat.totalWin || 0

    switch (stat._id) {
      case 'pending':
        result.pendingBets = stat.count
        break
      case 'won':
        result.wonBets = stat.count
        break
      case 'lost':
        result.lostBets = stat.count
        break
    }
  })

  result.profit = result.totalWon - result.totalStaked
  const settledBets = result.wonBets + result.lostBets
  result.winRate = settledBets > 0 ? (result.wonBets / settledBets * 100) : 0

  return result
}

module.exports = mongoose.model('Bet', betSchema)
