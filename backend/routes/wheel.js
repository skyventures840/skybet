const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { auth } = require('../middleware/auth');
// Logger removed during cleanup - using console for now

// Handle wheel spin with basic validation
router.post('/spin', auth, async (req, res) => {
    const startTime = Date.now();
    const requestId = `wheel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const { betAmount, selectedMultiplier, result } = req.body;
      const userId = req.user.id;
      
      // Basic validation
      if (!betAmount || isNaN(betAmount) || betAmount <= 0) {
        return res.status(400).json({ error: 'Invalid bet amount' });
      }
      
      if (!selectedMultiplier || isNaN(selectedMultiplier)) {
        return res.status(400).json({ error: 'Invalid multiplier' });
      }
      
      if (!result || typeof result !== 'object') {
        return res.status(400).json({ error: 'Invalid result' });
      }
      
      console.log('Wheel spin initiated', {
        requestId,
        userId,
        betAmount,
        selectedMultiplier
      });
    
      // Get user
      const user = await User.findById(userId).select('balance');
      if (!user) {
        console.error('User not found for wheel spin', { requestId, userId });
        return res.status(404).json({ error: 'User not found' });
      }
      
      if (user.balance < betAmount) {
        console.log('Insufficient balance for wheel spin', {
          requestId,
          userId,
          balance: user.balance,
          betAmount
        });
        return res.status(400).json({ 
          error: 'Insufficient balance',
          balance: user.balance,
          required: betAmount
        });
      }
    
      // Process result
      const won = result.won;
      const winAmount = parseFloat(result.winAmount || 0);
      const netChange = won ? winAmount - betAmount : -betAmount;
    
      // Update balance
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { 
          $inc: { balance: netChange },
          $set: { 
            updatedAt: new Date(),
            lastActivity: new Date()
          }
        },
        { new: true, select: 'balance' }
      );
    
      // Create bet transaction
      await Transaction.create({
        userId,
        type: 'bet',
        amount: betAmount,
        method: 'system',
        status: 'completed',
        completedAt: new Date(),
        description: 'Wheel of Fortune bet',
        metadata: {
          game: 'wheel',
          selectedMultiplier,
          requestId
        }
      });
      
      // Create win transaction if applicable
      if (won && winAmount > 0) {
        await Transaction.create({
          userId,
          type: 'win',
          amount: winAmount,
          method: 'system',
          status: 'completed',
          completedAt: new Date(),
          description: 'Wheel of Fortune win',
          metadata: {
            game: 'wheel',
            multiplier: result.multiplier || selectedMultiplier,
            requestId
          }
        });
      }
    
      const processingTime = Date.now() - startTime;
      
      // Log successful wheel spin
      console.log('Wheel spin completed successfully', {
        requestId,
        userId,
        won,
        winAmount,
        netChange,
        finalBalance: updatedUser.balance,
        processingTime
      });
      
      res.json({
        success: true,
        requestId,
        balance: updatedUser.balance,
        won,
        winAmount,
        netChange,
        processingTime: `${processingTime}ms`
      });
    
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      console.error('Wheel spin error', {
        requestId: requestId || 'unknown',
        userId: req.user?.id,
        error: error.message,
        stack: error.stack,
        processingTime,
        ip: req.ip
      });
      
      // Don't expose internal error details in production
      const errorMessage = process.env.NODE_ENV === 'production' 
        ? 'An error occurred while processing your request'
        : error.message;
        
      res.status(500).json({ 
        error: errorMessage,
        requestId: requestId || 'unknown'
      });
    }
  }
);

module.exports = router;