const express = require('express');
const router = require('express').Router();
const Match = require('../models/Match');
const User = require('../models/User');
const Bet = require('../models/Bet');
const Hero = require('../models/Hero');
const multer = require('multer');
const path = require('path');
const { adminAuth } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const League = require('../models/League');
const Odds = require('../models/Odds');
const Transaction = require('../models/Transaction'); // Added Transaction import
const betSettlementService = require('../services/betSettlementService');
// Removed unused matchDataEnricher import

// Set up Multer for image uploads with production-ready configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Store videos in uploads/videos and posters in uploads/posters; default to hero for legacy
    const isVideo = /\.(mp4|webm|ogg)$/i.test(file.originalname);
    const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(file.originalname);
    const folder = isVideo ? 'videos' : isImage ? 'posters' : 'hero';
    cb(null, path.join(__dirname, `../uploads/${folder}`));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter for security
const fileFilter = (req, file, cb) => {
  // Allow only specific file types
  const allowedTypes = /\.(jpg|jpeg|png|gif|webp|mp4|webm|ogg)$/i;
  if (allowedTypes.test(file.originalname)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images and videos are allowed.'), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 5 // Maximum 5 files per request
  }
});

// Ensure uploads/hero directory exists
const fs = require('fs');
const heroUploadDir = path.join(__dirname, '../uploads/hero');
const videoUploadDir = path.join(__dirname, '../uploads/videos');
const posterUploadDir = path.join(__dirname, '../uploads/posters');
[heroUploadDir, videoUploadDir, posterUploadDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Add local game
router.post('/matches', adminAuth, [
  body('leagueName').notEmpty().trim(),
  body('teams.home').notEmpty().trim(),
  body('teams.away').notEmpty().trim(),
  body('startTime').isISO8601(),
  // Odds are optional - can be added later
  body('odds.homeWin').optional().isFloat({ gt: 1 }).withMessage('homeWin must be > 1 when provided'),
  body('odds.awayWin').optional().isFloat({ gt: 1 }).withMessage('awayWin must be > 1 when provided'),
  body('odds.draw').optional().isFloat({ gt: 1 }).withMessage('draw must be > 1 when provided'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { leagueName, teams, startTime, odds = {}, sport, videoUrl, videoPosterUrl, videoDisplayControl = 'scheduled' } = req.body;
    // Find or create league
    let league = await League.findOne({ name: leagueName });
    if (!league) {
      const leagueId = leagueName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const externalPrefix = leagueName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 4);
      league = new League({ name: leagueName, leagueId, externalPrefix });
      await league.save();
    }
    // --- Add this check ---
    if (!league || !league.leagueId) {
      return res.status(400).json({ error: 'Invalid or missing league. Please select or add a valid league.' });
    }
    // Find max externalId for this league
    const lastMatch = await Match.findOne({ leagueId: league._id }).sort({ externalId: -1 });
    let nextNum = 1;
    if (lastMatch && lastMatch.externalId) {
      const match = lastMatch.externalId.match(/_(\d+)$/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    const externalId = `${league.externalPrefix}_${String(nextNum).padStart(3, '0')}`;
    // Creates match in Match collection
    // Coerce odds to numeric values (handle possible string inputs and optional odds)
    const homeWin = odds.homeWin !== undefined ? Number(odds.homeWin) : null;
    const draw = odds.draw !== undefined ? Number(odds.draw) : null;
    const awayWin = odds.awayWin !== undefined ? Number(odds.awayWin) : null;

    // Optional totals market inputs
    const totalLine = odds && odds.total !== undefined ? Number(odds.total) : null;
    const overPrice = odds && odds.over !== undefined ? Number(odds.over) : null;
    const underPrice = odds && odds.under !== undefined ? Number(odds.under) : null;

    // Create odds Map with basic and additional markets
    const oddsMap = new Map();
    
    // Basic odds (1, X, 2) - these will be displayed in match cards (only if provided)
    if (homeWin && homeWin > 1) oddsMap.set('1', homeWin);
    if (draw && draw > 1) oddsMap.set('X', draw);
    if (awayWin && awayWin > 1) oddsMap.set('2', awayWin);
    
    // Additional markets - these will be in additional markets interface
    if (totalLine && overPrice && underPrice) {
      oddsMap.set('Total', totalLine);
      oddsMap.set('TM', overPrice); // Total More (Over)
      oddsMap.set('TU', underPrice); // Total Under
    }
    
    // Add any other custom odds
    Object.keys(odds).forEach(key => {
      if (!['homeWin', 'awayWin', 'draw', 'total', 'over', 'under'].includes(key)) {
        const value = Number(odds[key]);
        if (value && value > 1) {
          oddsMap.set(key, value);
        }
      }
    });

    const match = new Match({
      leagueId: league._id,  // Use the MongoDB ObjectId instead of the string leagueId
      externalId,
      homeTeam: teams.home,
      awayTeam: teams.away,
      startTime: new Date(startTime),
      odds: oddsMap,
      sport: sport || 'football',
      status: 'upcoming',
      videoUrl: videoUrl || null,
      videoPosterUrl: videoPosterUrl || null,
      videoDisplayControl: videoDisplayControl,
      createdBy: req.user.id
    });
    await match.save();
    
    // Creates odds entry for frontend visibility only if odds are provided
    if (homeWin || draw || awayWin) {
      let oddsDoc = {
        gameId: externalId,
        sport_key: sport || 'football',
        sport_title: leagueName,
        commence_time: match.startTime,
        home_team: teams.home,
        away_team: teams.away,
        bookmakers: [
          {
            key: 'default',
            title: 'Default',
            last_update: new Date(),
            markets: []
          }
        ],
        lastFetched: new Date(),
      };

      // Only create h2h market if we have valid odds
      if (homeWin || draw || awayWin) {
        const h2hOutcomes = [];
        
        // Add home team outcome if odds provided
        if (homeWin && homeWin > 1) {
          h2hOutcomes.push({ name: teams.home, price: homeWin });
        }
        
        // Add draw if provided
        if (draw && draw > 1) {
          h2hOutcomes.push({ name: 'Draw', price: draw });
        }
        
        // Add away team outcome if odds provided
        if (awayWin && awayWin > 1) {
          h2hOutcomes.push({ name: teams.away, price: awayWin });
        }

        // Only add h2h market if we have at least one valid outcome
        if (h2hOutcomes.length > 0) {
          oddsDoc.bookmakers[0].markets.push({
            key: 'h2h',
            last_update: new Date(),
            outcomes: h2hOutcomes
          });
        }
      }

      // Append totals market if provided
      if (totalLine && overPrice && underPrice) {
        oddsDoc.bookmakers[0].markets.push({
          key: 'totals',
          last_update: new Date(),
          outcomes: [
            { name: `Over ${totalLine}`, price: overPrice, point: totalLine },
            { name: `Under ${totalLine}`, price: underPrice, point: totalLine }
          ]
        });
      }

      // Add any other custom additional markets
      Object.keys(odds).forEach(key => {
        if (!['homeWin', 'awayWin', 'draw', 'total', 'over', 'under'].includes(key)) {
          const value = Number(odds[key]);
          if (value && value > 1) {
            oddsDoc.bookmakers[0].markets.push({
              key: key.toLowerCase(),
              last_update: new Date(),
              outcomes: [
                { name: key, price: value, point: null }
              ]
            });
          }
        }
      });

      // Only save to Odds collection if we have markets
      if (oddsDoc.bookmakers[0].markets.length > 0) {
        await Odds.updateOne(
          { gameId: oddsDoc.gameId },
          { $set: oddsDoc },
          { upsert: true }
        );
      }
    }
    res.status(201).json({ id: match._id });
  } catch (error) {
    console.error('Create match error:', error);
    res.status(500).json({ error: 'Failed to save match: ' + error.message });
}
});

// Update match odds and sync to Odds collection
router.put('/matches/:matchId/odds', adminAuth, [
  body('odds').isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { odds } = req.body;

    // Coerce all odds values to numbers where possible
    const normalizedOdds = Object.keys(odds || {}).reduce((acc, key) => {
      const value = odds[key];
      acc[key] = typeof value === 'string' ? Number(value) : value;
      return acc;
    }, {});
    
    // Create odds Map with proper structure
    const oddsMap = new Map();
    
    // Basic odds (1, X, 2) - these will be displayed in match cards
    if (normalizedOdds['1'] || normalizedOdds['homeWin']) {
      oddsMap.set('1', normalizedOdds['1'] || normalizedOdds['homeWin']);
    }
    if (normalizedOdds['X'] || normalizedOdds['draw']) {
      oddsMap.set('X', normalizedOdds['X'] || normalizedOdds['draw']);
    }
    if (normalizedOdds['2'] || normalizedOdds['awayWin']) {
      oddsMap.set('2', normalizedOdds['2'] || normalizedOdds['awayWin']);
    }
    
    // Additional markets - these will be in additional markets interface
    Object.keys(normalizedOdds).forEach(key => {
      if (!['1', 'X', '2', 'homeWin', 'awayWin', 'draw'].includes(key)) {
        const value = normalizedOdds[key];
        if (value && value > 1) {
          oddsMap.set(key, value);
        }
      }
    });
    
    const match = await Match.findByIdAndUpdate(
      req.params.matchId,
      { 
        odds: oddsMap,
        updatedAt: new Date(),
        updatedBy: req.user.id
      },
      { new: true }
    );

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // If this match has an externalId, sync Odds collection for frontend lists
    if (match.externalId) {
      const markets = [
        {
          key: 'h2h',
          last_update: new Date(),
          outcomes: [
            { name: match.homeTeam, price: oddsMap.get('1') || 0 }
          ]
        }
      ];

      // Add draw if available
      if (oddsMap.has('X')) {
        markets[0].outcomes.splice(1, 0, { name: 'Draw', price: oddsMap.get('X') });
      }
      
      // Add away team
      markets[0].outcomes.push({ name: match.awayTeam, price: oddsMap.get('2') || 0 });

      // Add totals market if available
      if (oddsMap.has('Total') && oddsMap.has('TM') && oddsMap.has('TU')) {
        markets.push({
          key: 'totals',
          last_update: new Date(),
          outcomes: [
            { name: `Over ${oddsMap.get('Total')}`, price: oddsMap.get('TM'), point: oddsMap.get('Total') },
            { name: `Under ${oddsMap.get('Total')}`, price: oddsMap.get('TU'), point: oddsMap.get('Total') }
          ]
        });
      }

      // Add any other additional markets
      const additionalMarkets = [];
      oddsMap.forEach((value, key) => {
        if (!['1', 'X', '2', 'Total', 'TM', 'TU'].includes(key) && value > 0) {
          additionalMarkets.push({ name: key, price: value });
        }
      });

      if (additionalMarkets.length > 0) {
        markets.push({
          key: 'additional',
          last_update: new Date(),
          outcomes: additionalMarkets
        });
      }

      // Also update the Odds collection to keep it in sync
      await Odds.updateOne(
        { gameId: match.externalId },
        { 
          $set: {
            bookmakers: [{ key: 'default', title: 'Default', last_update: new Date(), markets }],
            lastFetched: new Date()
          }
        },
        { upsert: true }
      );
    }

    res.json({ message: 'Odds updated successfully', match });
  } catch (error) {
    console.error('Update odds error:', error);
    res.status(500).json({ error: 'Failed to update odds: ' + error.message });
  }
});

// List all hero slides
router.get('/hero', async (req, res) => {
  try {
    const slides = await Hero.find().sort({ createdAt: -1 });
    res.json(slides);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch hero slides' });
  }
});

// Create a new hero slide
router.post('/hero', adminAuth, async (req, res) => {
  try {
    const { image, caption1, caption2, buttonText, buttonUrl } = req.body;
    const slide = new Hero({ image, caption1, caption2, buttonText, buttonUrl });
    await slide.save();
    res.status(201).json(slide);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create hero slide' });
  }
});

// Update a hero slide
router.put('/hero/:id', adminAuth, async (req, res) => {
  try {
    const { image, caption1, caption2, buttonText, buttonUrl } = req.body;
    const slide = await Hero.findByIdAndUpdate(
      req.params.id,
      { image, caption1, caption2, buttonText, buttonUrl },
      { new: true }
    );
    if (!slide) return res.status(404).json({ error: 'Slide not found' });
    res.json(slide);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update hero slide' });
  }
});

// Delete a hero slide
router.delete('/hero/:id', adminAuth, async (req, res) => {
  try {
    const slide = await Hero.findByIdAndDelete(req.params.id);
    if (!slide) return res.status(404).json({ error: 'Slide not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete hero slide' });
  }
});

// Upload hero image
router.post('/hero/upload', adminAuth, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  // Return the relative path to the uploaded image
  res.json({ imageUrl: `/uploads/hero/${req.file.filename}` });
});

// Upload match video file
router.post('/matches/:matchId/video/upload', adminAuth, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No video file uploaded' });
    const filePath = `/uploads/videos/${req.file.filename}`;
    const match = await Match.findByIdAndUpdate(
      req.params.matchId,
      { videoUrl: filePath, updatedAt: new Date(), updatedBy: req.user.id },
      { new: true }
    );
    if (!match) return res.status(404).json({ error: 'Match not found' });
    res.json({ success: true, videoUrl: filePath, match });
  } catch (error) {
    console.error('Upload match video error:', error);
    res.status(500).json({ error: 'Failed to upload video' });
  }
});

// Upload match poster image
router.post('/matches/:matchId/poster/upload', adminAuth, upload.single('poster'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No poster image uploaded' });
    const filePath = `/uploads/posters/${req.file.filename}`;
    const match = await Match.findByIdAndUpdate(
      req.params.matchId,
      { videoPosterUrl: filePath, updatedAt: new Date(), updatedBy: req.user.id },
      { new: true }
    );
    if (!match) return res.status(404).json({ error: 'Match not found' });
    res.json({ success: true, videoPosterUrl: filePath, match });
  } catch (error) {
    console.error('Upload match poster error:', error);
    res.status(500).json({ error: 'Failed to upload poster' });
  }
});

// Generic uploads not tied to a match (allows selecting files before saving match)
router.post('/uploads/video', adminAuth, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No video file uploaded' });
    const filePath = `/uploads/videos/${req.file.filename}`;
    res.json({ success: true, videoUrl: filePath });
  } catch (error) {
    console.error('Generic video upload error:', error);
    res.status(500).json({ error: 'Failed to upload video' });
  }
});

router.post('/uploads/poster', adminAuth, upload.single('poster'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No poster image uploaded' });
    const filePath = `/uploads/posters/${req.file.filename}`;
    res.json({ success: true, videoPosterUrl: filePath });
  } catch (error) {
    console.error('Generic poster upload error:', error);
    res.status(500).json({ error: 'Failed to upload poster' });
  }
});

// Get all users with pagination
// Get all users with pagination, search, and filtering
router.get('/users', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search || '';
    const query = {};

    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    const users = await User.find(query, '-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await User.countDocuments(query);
    
    res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Block/unblock user
// Update user status (e.g., block/unblock)
router.put('/users/:userId/status', adminAuth, [
  body('isBlocked').isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { isBlocked } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { isBlocked: isBlocked, updatedAt: new Date() },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, user: { id: user._id, isBlocked: user.isBlocked } });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get admin dashboard stats
router.get('/statistics', adminAuth, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ blocked: false });
    const totalMatches = await Match.countDocuments();
    const totalBets = await Bet.countDocuments();
    
    // Get recent activity
    const recentUsers = await User.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .select('username email createdAt');
    
    const recentBets = await Bet.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('userId', 'username')
      .populate('matchId', 'homeTeam awayTeam');

    res.json({
      stats: {
        totalUsers,
        activeUsers,
        totalMatches,
        totalBets
      },
      recentActivity: {
        users: recentUsers,
        bets: recentBets
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update match status (start, finish, cancel)
router.put('/matches/:matchId/status', adminAuth, [
  body('status').isIn(['upcoming', 'live', 'finished', 'cancelled']),
  body('homeScore').optional().isNumeric(),
  body('awayScore').optional().isNumeric()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, homeScore, awayScore } = req.body;
    
    const updateData = {
      status,
    };

    if (homeScore !== undefined) updateData.homeScore = homeScore;
    if (awayScore !== undefined) updateData.awayScore = awayScore;

    const match = await Match.findByIdAndUpdate(
      req.params.matchId,
      updateData,
      { new: true }
    );

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // If match is finished, update scores and settle bets
    if (status === 'finished') {
      updateData.homeScore = homeScore;
      updateData.awayScore = awayScore;
      updateData.finishedAt = new Date();
      await Bet.settleBets(match._id, homeScore, awayScore);
    }

    res.json({ success: true, match });
  } catch (error) {
    console.error('Update match status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Edit match details
router.put('/matches/:matchId', adminAuth, [
  body('leagueId').optional().notEmpty().trim(),
  body('teams.home').optional().notEmpty().trim(),
  body('teams.away').optional().notEmpty().trim(),
  body('startTime').optional().isISO8601(),
  body('sport').optional().notEmpty().trim(),
  body('videoUrl').optional().isString(),
  body('videoPosterUrl').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { leagueId, teams, startTime, sport, videoUrl, videoPosterUrl } = req.body;
    
    const updateData = {
      updatedAt: new Date(),
      updatedBy: req.user.id
    };

    if (leagueId) updateData.leagueId = leagueId;
    if (teams && teams.home) updateData.homeTeam = teams.home;
    if (teams && teams.away) updateData.awayTeam = teams.away;
    if (startTime) updateData.startTime = new Date(startTime);
    if (sport) updateData.sport = sport;
    if (videoUrl !== undefined) updateData.videoUrl = videoUrl || null;
    if (videoPosterUrl !== undefined) updateData.videoPosterUrl = videoPosterUrl || null;

    const match = await Match.findByIdAndUpdate(
      req.params.matchId,
      updateData,
      { new: true }
    );

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    res.json({ success: true, match });
  } catch (error) {
    console.error('Edit match error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete match
router.delete('/matches/:matchId', adminAuth, async (req, res) => {
  try {
    const match = await Match.findByIdAndDelete(req.params.matchId);
    
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // Also remove from Odds collection if it exists
    await Odds.deleteOne({ gameId: match.externalId });

    res.json({ success: true, message: 'Match deleted successfully' });
  } catch (error) {
    console.error('Delete match error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all leagues
router.get('/leagues', adminAuth, async (req, res) => {
  try {
    const leagues = await League.find().sort({ name: 1 });
    res.json(leagues);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leagues' });
  }
});

// Add a new league
router.post('/leagues', adminAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'League name required' });
    const leagueId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const externalPrefix = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 4);
    const league = new League({ name, leagueId, externalPrefix });
    await league.save();
    res.status(201).json(league);
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ error: 'League already exists' });
    } else {
      res.status(500).json({ error: 'Failed to add league' });
    }
  }
});

// Get all bets with pagination and filtering
router.get('/bets', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    const query = {};

    // Search functionality
    if (search) {
      query.$or = [
        { matchId: { $regex: search, $options: 'i' } },
        { homeTeam: { $regex: search, $options: 'i' } },
        { awayTeam: { $regex: search, $options: 'i' } },
        { market: { $regex: search, $options: 'i' } },
        { selection: { $regex: search, $options: 'i' } }
      ];
    }

    // Status filtering
    if (status) {
      query.status = status;
    }

    const bets = await Bet.find(query)
      .populate('userId', 'username email')
      .sort({ [sortBy]: sortOrder })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Bet.countDocuments(query);

    res.json({
      bets,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get bets error:', error);
    res.status(500).json({ error: 'Failed to fetch bets' });
  }
});

// Update bet status (settle, cancel, void)
router.put('/bets/:betId/status', adminAuth, [
  body('status').isIn(['pending', 'won', 'lost', 'void', 'cancelled']),
  body('actualWin').optional().isFloat({ min: 0 }),
  body('reason').optional().isString().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, actualWin, reason } = req.body;
    const betId = req.params.betId;

    const updateData = {
      status,
      updatedAt: new Date(),
      updatedBy: req.user.id
    };

    if (actualWin !== undefined) {
      updateData.actualWin = actualWin;
    }

    if (status === 'won' || status === 'lost' || status === 'void' || status === 'cancelled') {
      updateData.settledAt = new Date();
    }

    const bet = await Bet.findByIdAndUpdate(betId, updateData, { new: true })
      .populate('userId', 'username email');

    if (!bet) {
      return res.status(404).json({ error: 'Bet not found' });
    }

    // If bet is won or cancelled, update user balance
    if (status === 'won' && actualWin > 0) {
      await User.findByIdAndUpdate(bet.userId, {
        $inc: { balance: actualWin }
      });
    } else if (status === 'cancelled') {
      // Refund the stake
      await User.findByIdAndUpdate(bet.userId, {
        $inc: { balance: bet.stake }
      });
    }

    // Broadcast bet status update via WebSocket
    if (global.websocketServer) {
      global.websocketServer.broadcastBetStatusUpdate(
        bet._id.toString(),
        bet.userId._id.toString(),
        status,
        []
      );
      
      // Also broadcast general bet update for admin dashboard
      global.websocketServer.broadcastToAll({
        type: 'bet_status_update',
        payload: {
          betId: bet._id.toString(),
          status: status,
          actualWin: actualWin,
          updatedAt: bet.updatedAt,
          bet: bet
        }
      });
    }

    res.json({ success: true, bet });
  } catch (error) {
    console.error('Update bet status error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code
    });
    res.status(500).json({ 
      error: 'Failed to update bet status',
      details: error.message,
      stack: error.stack
    });
  }
});

// Edit bet details (stake, odds, selection)
router.put('/bets/:betId', adminAuth, [
  body('stake').optional().isFloat({ min: 0.01 }),
  body('odds').optional().isFloat({ min: 1.01 }),
  body('selection').optional().notEmpty().trim(),
  body('market').optional().notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { stake, odds, selection, market } = req.body;
    const betId = req.params.betId;

    const updateData = {
      updatedAt: new Date(),
      updatedBy: req.user.id
    };

    if (stake !== undefined) updateData.stake = stake;
    if (odds !== undefined) updateData.odds = odds;
    if (selection) updateData.selection = selection;
    if (market) updateData.market = market;

    // Recalculate potential win if stake or odds changed
    if (stake !== undefined || odds !== undefined) {
      const currentStake = stake !== undefined ? stake : updateData.stake;
      const currentOdds = odds !== undefined ? odds : updateData.odds;
      updateData.potentialWin = currentStake * currentOdds;
    }

    const bet = await Bet.findByIdAndUpdate(betId, updateData, { new: true })
      .populate('userId', 'username email');

    if (!bet) {
      return res.status(404).json({ error: 'Bet not found' });
    }

    // Broadcast bet update via WebSocket
    if (global.websocketServer) {
      global.websocketServer.broadcastToAll({
        type: 'bet_update',
        payload: {
          betId: bet._id.toString(),
          bet: bet,
          updatedAt: bet.updatedAt
        }
      });
    }

    res.json({ success: true, bet });
  } catch (error) {
    console.error('Edit bet error:', error);
    res.status(500).json({ error: 'Failed to edit bet' });
  }
});

// Get bet statistics for admin dashboard
router.get('/bets/statistics', adminAuth, async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalBets,
      pendingBets,
      wonBets,
      lostBets,
      cancelledBets,
      voidBets,
      todayBets,
      weekBets,
      monthBets,
      totalStaked,
      totalWon,
      totalLost
    ] = await Promise.all([
      Bet.countDocuments(),
      Bet.countDocuments({ status: 'pending' }),
      Bet.countDocuments({ status: 'won' }),
      Bet.countDocuments({ status: 'lost' }),
      Bet.countDocuments({ status: 'cancelled' }),
      Bet.countDocuments({ status: 'void' }),
      Bet.countDocuments({ createdAt: { $gte: startOfToday } }),
      Bet.countDocuments({ createdAt: { $gte: startOfWeek } }),
      Bet.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Bet.aggregate([
        { $group: { _id: null, total: { $sum: '$stake' } } }
      ]).then(result => result[0]?.total || 0),
      Bet.aggregate([
        { $match: { status: 'won' } },
        { $group: { _id: null, total: { $sum: '$actualWin' } } }
      ]).then(result => result[0]?.total || 0),
      Bet.aggregate([
        { $match: { status: 'lost' } },
        { $group: { _id: null, total: { $sum: '$stake' } } }
      ]).then(result => result[0]?.total || 0)
    ]);

    const netProfit = totalWon - totalLost;
    const winRate = totalBets > 0 ? ((wonBets / (wonBets + lostBets)) * 100).toFixed(2) : 0;

    res.json({
      totalBets,
      pendingBets,
      wonBets,
      lostBets,
      cancelledBets,
      voidBets,
      todayBets,
      weekBets,
      monthBets,
      totalStaked: parseFloat(totalStaked.toFixed(2)),
      totalWon: parseFloat(totalWon.toFixed(2)),
      totalLost: parseFloat(totalLost.toFixed(2)),
      netProfit: parseFloat(netProfit.toFixed(2)),
      winRate: parseFloat(winRate)
    });
  } catch (error) {
    console.error('Get bet statistics error:', error);
    res.status(500).json({ error: 'Failed to fetch bet statistics' });
  }
});

// Bulk update bet statuses
router.put('/bets/bulk/status', adminAuth, [
  body('betIds').isArray({ min: 1 }),
  body('status').isIn(['pending', 'won', 'lost', 'void', 'cancelled']),
  body('actualWin').optional().isFloat({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { betIds, status, actualWin } = req.body;

    const updateData = {
      status,
      updatedAt: new Date(),
      updatedBy: req.user.id
    };

    if (actualWin !== undefined) {
      updateData.actualWin = actualWin;
    }

    if (status === 'won' || status === 'lost' || status === 'void' || status === 'cancelled') {
      updateData.settledAt = new Date();
    }

    const result = await Bet.updateMany(
      { _id: { $in: betIds } },
      updateData
    );

    // Broadcast bulk bet status updates via WebSocket
    if (global.websocketServer && result.modifiedCount > 0) {
      // Get the updated bets to broadcast
      const updatedBets = await Bet.find({ _id: { $in: betIds } })
        .populate('userId', 'username email');
      
      // Broadcast each bet update
      updatedBets.forEach(bet => {
        global.websocketServer.broadcastBetStatusUpdate(
          bet._id.toString(),
          bet.userId._id.toString(),
          status,
          []
        );
        
        // Also broadcast general bet update for admin dashboard
        global.websocketServer.broadcastToAll({
          type: 'bet_status_update',
          payload: {
            betId: bet._id.toString(),
            status: status,
            actualWin: actualWin,
            updatedAt: bet.updatedAt,
            bet: bet
          }
        });
      });
    }

    res.json({ 
      success: true, 
      modifiedCount: result.modifiedCount,
      message: `${result.modifiedCount} bets updated successfully`
    });
  } catch (error) {
    console.error('Bulk update bet status error:', error);
    res.status(500).json({ error: 'Failed to bulk update bet statuses' });
  }
});

// Get comprehensive dashboard statistics
router.get('/dashboard-stats', adminAuth, async (req, res) => {
  try {
    console.log('[ADMIN DASHBOARD] Fetching dashboard statistics...');
    
    // Get current date and calculate date ranges
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Fetch all statistics in parallel for better performance
    const [
      totalUsers,
      activeUsers,
      blockedUsers,
      totalMatches,
      liveMatches,
      upcomingMatches,
      totalBets,
      pendingBets,
      wonBets,
      lostBets,
      totalDeposits,
      totalWithdrawals,
      todayDeposits,
      todayWithdrawals,
      weekDeposits,
      weekWithdrawals,
      monthDeposits,
      monthWithdrawals,
      yearDeposits,
      yearWithdrawals,
      userStats,
      betStats,
      transactionStats
    ] = await Promise.all([
      // User statistics
      User.countDocuments(),
      User.countDocuments({ isActive: true, isBlocked: false, isBanned: false }),
      User.countDocuments({ $or: [{ isBlocked: true }, { isBanned: true }] }),
      
      // Match statistics
      Match.countDocuments(),
      Match.countDocuments({ status: 'live' }),
      Match.countDocuments({ 
        status: 'upcoming', 
        startTime: { $gte: startOfToday } 
      }),
      
      // Bet statistics
      Bet.countDocuments(),
      Bet.countDocuments({ status: 'pending' }),
      Bet.countDocuments({ status: 'won' }),
      Bet.countDocuments({ status: 'lost' }),
      
      // Financial statistics - Deposits
      Transaction.aggregate([
        { $match: { type: 'deposit', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).then(result => result[0]?.total || 0),
      
      // Financial statistics - Withdrawals
      Transaction.aggregate([
        { $match: { type: 'withdrawal', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).then(result => result[0]?.total || 0),
      
      // Today's deposits
      Transaction.aggregate([
        { 
          $match: { 
            type: 'deposit', 
            status: 'completed',
            createdAt: { $gte: startOfToday }
          } 
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).then(result => result[0]?.total || 0),
      
      // Today's withdrawals
      Transaction.aggregate([
        { 
          $match: { 
            type: 'withdrawal', 
            status: 'completed',
            createdAt: { $gte: startOfToday }
          } 
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).then(result => result[0]?.total || 0),
      
      // This week's deposits
      Transaction.aggregate([
        { 
          $match: { 
            type: 'deposit', 
            status: 'completed',
            createdAt: { $gte: startOfWeek }
          } 
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).then(result => result[0]?.total || 0),
      
      // This week's withdrawals
      Transaction.aggregate([
        { 
          $match: { 
            type: 'withdrawal', 
            status: 'completed',
            createdAt: { $gte: startOfWeek }
          } 
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).then(result => result[0]?.total || 0),
      
      // This month's deposits
      Transaction.aggregate([
        { 
          $match: { 
            type: 'deposit', 
            status: 'completed',
            createdAt: { $gte: startOfMonth }
          } 
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).then(result => result[0]?.total || 0),
      
      // This month's withdrawals
      Transaction.aggregate([
        { 
          $match: { 
            type: 'withdrawal', 
            status: 'completed',
            createdAt: { $gte: startOfMonth }
          } 
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).then(result => result[0]?.total || 0),
      
      // This year's deposits
      Transaction.aggregate([
        { 
          $match: { 
            type: 'deposit', 
            status: 'completed',
            createdAt: { $gte: startOfYear }
          } 
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).then(result => result[0]?.total || 0),
      
      // This year's withdrawals
      Transaction.aggregate([
        { 
          $match: { 
            type: 'withdrawal', 
            status: 'completed',
            createdAt: { $gte: startOfYear }
          } 
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).then(result => result[0]?.total || 0),
      
      // User activity statistics (last 7 days)
      User.aggregate([
        { $match: { lastActivity: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
        { $group: { _id: null, count: { $sum: 1 } } }
      ]).then(result => result[0]?.count || 0),
      
      // Bet statistics (last 7 days)
      Bet.aggregate([
        { $match: { createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
        { $group: { _id: null, count: { $sum: 1 } } }
      ]).then(result => result[0]?.count || 0),
      
      // Transaction statistics (last 7 days)
      Transaction.aggregate([
        { $match: { createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
        { $group: { _id: null, count: { $sum: 1 } } }
      ]).then(result => result[0]?.count || 0)
    ]);

    // Calculate additional metrics
    const totalRevenue = totalDeposits - totalWithdrawals;
    const netProfit = totalRevenue * 0.05; // Assuming 5% platform fee
    const activeUserPercentage = totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(1) : 0;
    const betWinRate = totalBets > 0 ? ((wonBets / totalBets) * 100).toFixed(1) : 0;

    // Prepare chart data for the last 7 days
    const last7Days = [];
    const dailyDeposits = [];
    const dailyWithdrawals = [];
    const dailyBets = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      last7Days.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
      
      // For now, we'll use placeholder data - in production you'd aggregate actual daily data
      dailyDeposits.push(Math.floor(Math.random() * 1000) + 100);
      dailyWithdrawals.push(Math.floor(Math.random() * 500) + 50);
      dailyBets.push(Math.floor(Math.random() * 50) + 10);
    }

    const dashboardStats = {
      // User Statistics
      totalUsers,
      activeUsers,
      blockedUsers,
      activeUserPercentage,
      
      // Match Statistics
      totalMatches,
      liveMatches,
      upcomingMatches,
      
      // Bet Statistics
      totalBets,
      pendingBets,
      wonBets,
      lostBets,
      betWinRate,
      
      // Financial Statistics
      totalDeposits: parseFloat(totalDeposits.toFixed(2)),
      totalWithdrawals: parseFloat(totalWithdrawals.toFixed(2)),
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      netProfit: parseFloat(netProfit.toFixed(2)),
      
      // Time-based Statistics
      todayDeposits: parseFloat(todayDeposits.toFixed(2)),
      todayWithdrawals: parseFloat(todayWithdrawals.toFixed(2)),
      weekDeposits: parseFloat(weekDeposits.toFixed(2)),
      weekWithdrawals: parseFloat(weekWithdrawals.toFixed(2)),
      monthDeposits: parseFloat(monthDeposits.toFixed(2)),
      monthWithdrawals: parseFloat(monthWithdrawals.toFixed(2)),
      yearDeposits: parseFloat(yearDeposits.toFixed(2)),
      yearWithdrawals: parseFloat(yearWithdrawals.toFixed(2)),
      
      // Activity Statistics
      userStats,
      betStats,
      transactionStats,
      
      // Chart Data
      chartData: {
        dailyDeposits,
        dailyWithdrawals,
        dailyBets,
        last7Days
      },
      
      // Timestamp
      lastUpdated: new Date().toISOString()
    };

    console.log('[ADMIN DASHBOARD] Statistics fetched successfully:', {
      totalUsers,
      activeUsers,
      totalBets,
      totalDeposits: parseFloat(totalDeposits.toFixed(2)),
      totalWithdrawals: parseFloat(totalWithdrawals.toFixed(2))
    });

    res.json({
      success: true,
      data: dashboardStats
    });

  } catch (error) {
    console.error('[ADMIN DASHBOARD] Error fetching statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard statistics',
      message: error.message
    });
  }
});

// Manual bet settlement endpoint for testing
router.post('/settle-bets', adminAuth, async (req, res) => {
  try {
    console.log('[ADMIN] Manual bet settlement triggered');
    
    const result = await betSettlementService.processSettlements();
    
    console.log('[ADMIN] Bet settlement completed:', result);
    
    res.json({
      success: true,
      message: 'Bet settlement completed successfully',
      data: result
    });
  } catch (error) {
    console.error('[ADMIN] Error in manual bet settlement:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to settle bets',
      message: error.message
    });
  }
});

module.exports = router;