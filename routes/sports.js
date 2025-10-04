const express = require('express');
const router = express.Router();
const Sport = require('../models/Sport');
const Match = require('../models/Match');
const { auth } = require('../middleware/auth');

// Get all sports
router.get('/', auth, async (req, res) => {
  try {
    const sports = await Sport.find({ active: true }).sort({ name: 1 });
    res.json(sports);
  } catch (error) {
    console.error('Get sports error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get sport by ID
router.get('/:sportId', auth, async (req, res) => {
  try {
    const sport = await Sport.findById(req.params.sportId);
    
    if (!sport) {
      return res.status(404).json({ error: 'Sport not found' });
    }

    res.json(sport);
  } catch (error) {
    console.error('Get sport error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get leagues by sport ID
router.get('/:sportId/leagues', auth, async (req, res) => {
  try {
    const sport = await Sport.findById(req.params.sportId);
    
    if (!sport) {
      return res.status(404).json({ error: 'Sport not found' });
    }

    // Get leagues with match counts
    const leagues = await Promise.all(
      sport.leagues.map(async (league) => {
        const matchCount = await Match.countDocuments({
          leagueId: league.id,
          status: { $in: ['upcoming', 'live'] }
        });

        return {
          ...league.toObject(),
          matchCount
        };
      })
    );

    res.json(leagues);
  } catch (error) {
    console.error('Get sport leagues error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get matches by sport
router.get('/:sportId/matches', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status || 'upcoming';

    const sport = await Sport.findById(req.params.sportId);
    if (!sport) {
      return res.status(404).json({ error: 'Sport not found' });
    }

    const matches = await Match.find({
      sport: sport.key,
      status: status
    })
    .sort({ startTime: 1 })
    .skip((page - 1) * limit)
    .limit(limit);

    const total = await Match.countDocuments({
      sport: sport.key,
      status: status
    });

    res.json({
      sport: sport.name,
      matches,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get sport matches error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get sports with match counts
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const sports = await Sport.find({ active: true });
    
    const sportsWithStats = await Promise.all(
      sports.map(async (sport) => {
        const upcomingMatches = await Match.countDocuments({
          sport: sport.key,
          status: 'upcoming'
        });
        
        const liveMatches = await Match.countDocuments({
          sport: sport.key,
          status: 'live'
        });

        const totalLeagues = sport.leagues.length;

        return {
          id: sport._id,
          name: sport.name,
          key: sport.key,
          icon: sport.icon,
          upcomingMatches,
          liveMatches,
          totalLeagues
        };
      })
    );

    res.json(sportsWithStats);
  } catch (error) {
    console.error('Get sports stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


module.exports = router;