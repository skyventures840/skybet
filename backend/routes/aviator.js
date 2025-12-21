const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Bet = require('../models/Bet');
const { auth } = require('../middleware/auth');

// Get user balance for Aviator
router.get('/balance', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    // Return user balances exactly as stored in DB
    res.json({
      balance: user.balance,
      balanceBonus: user.balanceBonus
    });
  } catch (error) {
    console.error('Aviator balance error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Place bet
router.post('/bet', auth, async (req, res) => {
  try {
    const { amount, type } = req.body; // type: 'real' or 'demo'
    const userId = req.user.id;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    if (type === 'demo') {
      return res.status(400).json({ error: 'Demo mode is disabled' });
    } else {
      // Real/Bonus bet
      try {
        const { bonusUsed, realUsed, user } = await User.placeBet(userId, amount);
        
        // Create Bet record for history/admin
        const bet = new Bet({
          userId,
          matchId: `aviator-${Date.now()}`, // Pseudo match ID
          market: 'Aviator',
          selection: 'Fly',
          stake: amount,
          odds: 1.00, // Initial odds
          potentialWin: 0, // Unknown yet
          bonusStakeUsed: bonusUsed,
          realStakeUsed: realUsed,
          status: 'pending',
          homeTeam: 'Aviator',
          awayTeam: 'Game'
        });
        await bet.save();

        return res.json({ 
          success: true, 
          balance: user.balance,
          balanceBonus: user.balanceBonus,
          bonusUsed,
          realUsed,
          type: 'real',
          betId: bet._id
        });
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }
  } catch (error) {
    console.error('Aviator bet error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Cash out
router.post('/cashout', auth, async (req, res) => {
  try {
    const { amount, type, multiplier, betId } = req.body;
    const userId = req.user.id;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    if (type === 'demo') {
      return res.status(400).json({ error: 'Demo mode is disabled' });
    } else {
      // Real money win
      await User.settleBetWin(userId, amount);
      const updatedUser = await User.findById(userId);

      // Update Bet record if betId is provided
      if (betId) {
        await Bet.findByIdAndUpdate(betId, {
          status: 'won',
          actualWin: amount,
          odds: multiplier,
          settledAt: Date.now()
        });
      }

      return res.json({ 
        success: true, 
        balance: updatedUser.balance,
        balanceBonus: updatedUser.balanceBonus,
        type: 'real'
      });
    }
  } catch (error) {
    console.error('Aviator cashout error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Cancel bet (refund)
router.post('/cancel', auth, async (req, res) => {
  try {
    const { amount, type, betId } = req.body;
    const userId = req.user.id;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    if (type === 'demo') {
      return res.status(400).json({ error: 'Demo mode is disabled' });
    } else {
      // Refund to Real balance (simplest approach)
      // NOTE: This does not account for bonus/real split refunding as state is not passed.
      // Potential improvement: pass split info if available.
      await User.refundBet(userId, amount);
      const updatedUser = await User.findById(userId);

      // Update Bet record
      if (betId) {
        await Bet.findByIdAndUpdate(betId, {
          status: 'cancelled',
          settledAt: Date.now()
        });
      }

      return res.json({ 
        success: true, 
        balance: updatedUser.balance,
        balanceBonus: updatedUser.balanceBonus,
        type: 'real'
      });
    }
  } catch (error) {
    console.error('Aviator cancel error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
