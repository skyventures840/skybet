const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const MultiBet = require('../models/MultiBet');
const { validateMultiBet } = require('../utils/validation');

// @route   POST /api/multibets
// @desc    Create a new multi-bet
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { matches, stake, currency = 'USD' } = req.body;
    
    // Validate request
    const validation = validateMultiBet(req.body);
    if (!validation.isValid) {
      return res.status(400).json({ 
        success: false, 
        message: validation.errors.join(', ') 
      });
    }
    
    // Check if user has sufficient balance (implement balance check)
    // const userBalance = await getUserBalance(req.user.id);
    // if (userBalance < stake) {
    //   return res.status(400).json({ 
    //     success: false, 
    //     message: 'Insufficient balance' 
    //   });
    // }
    
    // Calculate combined odds
    const oddsArray = matches.map(match => match.odds);
    const combinedOdds = MultiBet.calculateCombinedOdds(oddsArray);
    const potentialPayout = MultiBet.calculatePotentialPayout(combinedOdds, stake);
    
    // Create multi-bet
    const multiBet = new MultiBet({
      userId: req.user.id,
      matches: matches.map(match => ({
        matchId: match.matchId,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        league: match.league,
        startTime: new Date(match.startTime),
        outcome: match.outcome,
        odds: match.odds,
        status: 'Pending'
      })),
      combinedOdds,
      stake,
      potentialPayout,
      totalMatches: matches.length,
      currency
    });
    
    await multiBet.save();
    
    // Deduct stake from user balance (implement balance deduction)
    // await updateUserBalance(req.user.id, -stake);
    
    res.status(201).json({
      success: true,
      data: multiBet,
      message: 'Multi-bet created successfully'
    });
    
  } catch (error) {
    console.error('Multi-bet creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating multi-bet'
    });
  }
});

// @route   GET /api/multibets
// @desc    Get user's multi-bets with filtering and pagination
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { 
      status, 
      page = 1, 
      limit = 10, 
      sortBy = 'submittedAt', 
      sortOrder = 'desc' 
    } = req.query;
    
    // Build query
    const query = { userId: req.user.id };
    if (status && status !== 'all') {
      query.status = status;
    }
    
    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Execute query with pagination
    const skip = (page - 1) * limit;
    const multiBets = await MultiBet.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'username email');
    
    // Get total count for pagination
    const total = await MultiBet.countDocuments(query);
    
    res.json({
      success: true,
      data: multiBets,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
    
  } catch (error) {
    console.error('Multi-bets retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while retrieving multi-bets'
    });
  }
});

// @route   GET /api/multibets/:id
// @desc    Get specific multi-bet by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const multiBet = await MultiBet.findOne({
      _id: req.params.id,
      userId: req.user.id
    }).populate('userId', 'username email');
    
    if (!multiBet) {
      return res.status(404).json({
        success: false,
        message: 'Multi-bet not found'
      });
    }
    
    res.json({
      success: true,
      data: multiBet
    });
    
  } catch (error) {
    console.error('Multi-bet retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while retrieving multi-bet'
    });
  }
});

// @route   PUT /api/multibets/:id/status
// @desc    Update match status (for admin/system use)
// @access  Private (admin only in production)
router.put('/:id/status', auth, async (req, res) => {
  try {
    const { matchId, status, result } = req.body;
    
    const multiBet = await MultiBet.findById(req.params.id);
    if (!multiBet) {
      return res.status(404).json({
        success: false,
        message: 'Multi-bet not found'
      });
    }
    
    // Update match status
    await multiBet.updateMatchStatus(matchId, status, result);
    
    res.json({
      success: true,
      data: multiBet,
      message: 'Match status updated successfully'
    });
    
  } catch (error) {
    console.error('Match status update error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating match status'
    });
  }
});

// @route   DELETE /api/multibets/:id
// @desc    Cancel multi-bet (only if all matches are pending)
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const multiBet = await MultiBet.findOne({
      _id: req.params.id,
      userId: req.user.id
    });
    
    if (!multiBet) {
      return res.status(404).json({
        success: false,
        message: 'Multi-bet not found'
      });
    }
    
    // Check if bet can be cancelled (all matches pending)
    const hasStartedMatches = multiBet.matches.some(match => 
      match.status !== 'Pending'
    );
    
    if (hasStartedMatches) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel multi-bet with started matches'
      });
    }
    
    // Refund stake to user balance (implement balance refund)
    // await updateUserBalance(req.user.id, multiBet.stake);
    
    await multiBet.remove();
    
    res.json({
      success: true,
      message: 'Multi-bet cancelled successfully'
    });
    
  } catch (error) {
    console.error('Multi-bet cancellation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while cancelling multi-bet'
    });
  }
});

// @route   GET /api/multibets/stats/summary
// @desc    Get user's betting statistics
// @access  Private
router.get('/stats/summary', auth, async (req, res) => {
  try {
    const stats = await MultiBet.aggregate([
      { $match: { userId: req.user.id } },
      {
        $group: {
          _id: null,
          totalBets: { $sum: 1 },
          totalStake: { $sum: '$stake' },
          totalPayout: { $sum: '$potentialPayout' },
          wonBets: { $sum: { $cond: [{ $eq: ['$status', 'Win'] }, 1, 0] } },
          lostBets: { $sum: { $cond: [{ $eq: ['$status', 'Loss'] }, 1, 0] } },
          pendingBets: { $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] } },
          totalWinnings: { $sum: { $cond: [{ $eq: ['$status', 'Win'] }, '$potentialPayout', 0] } }
        }
      }
    ]);
    
    const summary = stats[0] || {
      totalBets: 0,
      totalStake: 0,
      totalPayout: 0,
      wonBets: 0,
      lostBets: 0,
      pendingBets: 0,
      totalWinnings: 0
    };
    
    summary.winRate = summary.totalBets > 0 ? 
      (summary.wonBets / summary.totalBets) * 100 : 0;
    summary.profitLoss = summary.totalWinnings - summary.totalStake;
    
    res.json({
      success: true,
      data: summary
    });
    
  } catch (error) {
    console.error('Stats retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while retrieving statistics'
    });
  }
});

module.exports = router;
