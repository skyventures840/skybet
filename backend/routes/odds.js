const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Odds = require('../models/Odds');
const Match = require('../models/Match');
const ComprehensiveOddsService = require('../services/comprehensiveOddsService');


// Initialize the comprehensive odds service
const oddsService = new ComprehensiveOddsService();

// GET /api/odds/fetch-all-sports-markets-with-results - Comprehensive odds and results API
router.get('/fetch-all-sports-markets-with-results', async (req, res) => {
const {
    regions = 'all', 
    markets = 'all', 
    primaryBookmaker = 'fanduel', 
    fallbackBookmaker = 'betmgm', 
    daysFrom = 1 
  } = req.query;

  try {
    const result = await oddsService.fetchAllSportsMarketsWithResults({
      regions,
      markets,
      primaryBookmaker,
      fallbackBookmaker,
      daysFrom
    });
    
    res.json(result);
    
  } catch (error) {
          console.error('Error in comprehensive odds fetch:', error);
    res.status(500).json({ 
      success: false, 
      error: `Error processing request: ${error.message}` 
    });
  }
});

// GET /api/odds/sport/:sportKey/markets-with-results - Get markets and results for specific sport
router.get('/sport/:sportKey/markets-with-results', async (req, res) => {
  const { sportKey } = req.params;
  const { 
    regions = 'all', 
    markets = 'all', 
    primaryBookmaker = 'fanduel', 
    fallbackBookmaker = 'betmgm', 
    daysFrom = 1 
  } = req.query;

  try {
    const result = await oddsService.fetchSportMarketsWithResults(sportKey, {
      regions,
      markets,
      primaryBookmaker,
      fallbackBookmaker,
      daysFrom
    });
    
    res.json(result);
    
  } catch (error) {
          console.error(`Error fetching markets and results for ${sportKey}:`, error);
    res.status(500).json({
      success: false,
      error: `Error fetching markets and results for ${sportKey}: ${error.message}`
    });
  }
});

// GET /api/odds/match/:matchId/markets-with-results - Get specific match with markets and results
router.get('/match/:matchId/markets-with-results', async (req, res) => {
  const { matchId } = req.params;
  const { 
    regions = 'all', 
    markets = 'all', 
    primaryBookmaker = 'fanduel', 
    fallbackBookmaker = 'betmgm' 
  } = req.query;

  try {
    // First try to get from database
    if (mongoose.connection.readyState === 1) {
      const oddsData = await Odds.findOne({ gameId: matchId });
      
      if (oddsData) {
        // Transform database format and add results if available
        const match = {
          id: oddsData.gameId,
          sport_key: oddsData.sport_key,
          sport_title: oddsData.sport_title,
          commence_time: oddsData.commence_time,
          home_team: oddsData.home_team,
          away_team: oddsData.away_team,
          bookmakers: oddsData.bookmakers,
          last_update: oddsData.lastFetched
        };
        
        // Try to fetch results for this match
        try {
          const matchResult = await oddsService.fetchMatchWithResults(matchId);
          if (matchResult.success && matchResult.match.scores) {
            match.scores = matchResult.match.scores;
            match.completed = matchResult.match.completed;
          }
        } catch (error) {
          console.warn(`Could not fetch results for match ${matchId}: ${error.message}`);
        }
        
        return res.json({
          success: true,
          match: match,
          source: 'database'
        });
      }
    }
    
    // Fallback to live API fetch
    const result = await oddsService.fetchMatchWithResults(matchId, {
      regions,
      markets,
      primaryBookmaker,
      fallbackBookmaker
    });
    
    if (result.success) {
    res.json(result);
    } else {
      res.status(404).json(result);
    }
    
  } catch (error) {
          console.error(`Error fetching match ${matchId}:`, error);
    res.status(500).json({
      success: false,
      error: `Error fetching match: ${error.message}`
    });
  }
});

// GET /api/odds/betslip-status-updates - Get betslip status updates based on results
router.post('/betslip-status-updates', async (req, res) => {
  try {
    const { betMatches } = req.body;
    
    if (!betMatches || !Array.isArray(betMatches)) {
      return res.status(400).json({
        success: false,
        error: 'betMatches array is required'
      });
    }
    
    const updates = await oddsService.getBetslipStatusUpdates(betMatches);
    
    res.json({
      success: true,
      updates: updates,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
          console.error('Error updating betslip status:', error);
    res.status(500).json({
      success: false,
      error: `Error updating betslip status: ${error.message}`
    });
  }
});

// NEW: GET /api/odds/upcoming/odds - Cross-sport upcoming odds
router.get('/upcoming/odds', async (req, res) => {
  try {
    const { regions = 'all', markets = 'all', commenceTimeFrom, commenceTimeTo, oddsFormat = 'decimal', bookmakers = 'fanduel,betmgm' } = req.query;
    const events = markets === 'all'
      ? await oddsService.fetchUpcomingOddsAllMarkets(regions, markets, bookmakers, oddsFormat, commenceTimeFrom, commenceTimeTo)
      : await oddsService.fetchUpcomingOdds(regions, markets, bookmakers, oddsFormat, commenceTimeFrom, commenceTimeTo);
    return res.json(events);
  } catch (error) {
    console.error('Error fetching upcoming odds:', error);
    return res.status(500).json({ success: false, error: `Failed to fetch upcoming odds: ${error.message}` });
  }
});

// NEW: GET /api/odds/sport/:sportKey/odds - Direct odds for a sport
router.get('/sport/:sportKey/odds', async (req, res) => {
  try {
    const { sportKey } = req.params;
    const { regions = 'all', markets = 'all', commenceTimeFrom, commenceTimeTo, oddsFormat = 'decimal', bookmakers = 'fanduel,betmgm' } = req.query;
    const events = markets === 'all'
      ? await oddsService.fetchSportOddsAllMarkets(sportKey, regions, markets, 'fanduel', 'betmgm', bookmakers, oddsFormat, commenceTimeFrom, commenceTimeTo)
      : await oddsService.fetchOdds(sportKey, regions, markets, bookmakers, oddsFormat, commenceTimeFrom, commenceTimeTo);
    return res.json(events);
  } catch (error) {
    console.error(`Error fetching odds for sport ${req.params.sportKey}:`, error);
    return res.status(500).json({ success: false, error: `Failed to fetch sport odds: ${error.message}` });
  }
});

// NEW: GET /api/odds/sport/:sportKey/events/:eventId/odds - Event-specific odds
router.get('/sport/:sportKey/events/:eventId/odds', async (req, res) => {
  try {
    const { sportKey, eventId } = req.params;
    const { regions = 'all', markets = 'all', oddsFormat = 'decimal', bookmakers = 'fanduel,betmgm' } = req.query;
    const event = markets === 'all'
      ? await oddsService.fetchEventOddsAllMarkets(sportKey, eventId, regions, markets, 'fanduel', 'betmgm', bookmakers, oddsFormat)
      : await oddsService.fetchEventOdds(sportKey, eventId, regions, markets, bookmakers, oddsFormat);
    return res.json(event);
  } catch (error) {
    console.error(`Error fetching event odds for ${req.params.sportKey}/${req.params.eventId}:`, error);
    return res.status(500).json({ success: false, error: `Failed to fetch event odds: ${error.message}` });
  }
});

// NEW: GET /api/odds/sport/:sportKey/scores - Results/Scores
router.get('/sport/:sportKey/scores', async (req, res) => {
  try {
    const { sportKey } = req.params;
    const { daysFrom = 1, eventIds } = req.query;
    let eventIdsArr = undefined;
    if (eventIds) {
      eventIdsArr = typeof eventIds === 'string' ? eventIds.split(',').filter(Boolean) : eventIds;
    }
    const events = await oddsService.fetchScores(sportKey, Number(daysFrom), eventIdsArr);
    return res.json(events);
  } catch (error) {
    console.error(`Error fetching scores for sport ${req.params.sportKey}:`, error);
    return res.status(500).json({ success: false, error: `Failed to fetch scores: ${error.message}` });
  }
});

// GET /api/odds - Get all matches with odds (existing endpoint)
router.get('/', async (req, res) => {
  try {
    let matches = [];
    
    // Try to get data from database first
    if (mongoose.connection.readyState === 1) {
      console.log('[DEBUG] Fetching matches from database...');
      
      const oddsData = await Odds.find({}).sort({ commence_time: 1 }).limit(1000);
              console.log(`[DEBUG] Found ${oddsData.length} matches in database`);
      
      if (oddsData.length > 0) {
        // Transform database format to frontend format
        matches = oddsData.map(odds => ({
          id: odds.gameId,
          sport_key: odds.sport_key,
          sport_title: odds.sport_title,
          commence_time: odds.commence_time,
          home_team: odds.home_team,
          away_team: odds.away_team,
          bookmakers: odds.bookmakers,
          last_update: odds.lastFetched
        }));
      }
    }
    
    // If no database data, fallback to JSON files
    if (matches.length === 0) {
              console.log('[DEBUG] No database data, falling back to JSON files...');
      
      const files = fs.readdirSync(path.join(__dirname, '..'))
        .filter(file => file.endsWith('.json') && file.includes('_matches_'));
      
              console.log(`[DEBUG] Found ${files.length} JSON files`);
      
      for (const file of files) {
        try {
          const filePath = path.join(__dirname, '..', file);
          const fileContent = fs.readFileSync(filePath, 'utf8');
          const fileMatches = JSON.parse(fileContent);
          matches.push(...fileMatches);
        } catch (error) {
          console.error(`Error reading file ${file}:`, error.message);
        }
      }
    }
    
    console.log(`[DEBUG] /api/odds returning ${matches.length} matches`);
    
    res.json({
      success: true,
      matches: matches,
      total: matches.length,
      source: mongoose.connection.readyState === 1 ? 'database' : 'json_files'
    });
    
  } catch (error) {
    console.error('Error fetching odds:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch odds data',
      message: error.message
    });
  }
});

// GET /api/odds/sport/:sportKey - Get matches for specific sport (existing endpoint)
router.get('/sport/:sportKey', async (req, res) => {
  try {
    const { sportKey } = req.params;
    let matches = [];
    
    // Try database first
    if (mongoose.connection.readyState === 1) {
      const oddsData = await Odds.find({ sport_key: sportKey }).limit(50);
      
      if (oddsData.length > 0) {
        matches = oddsData.map(odds => ({
          id: odds.gameId,
          sport_key: odds.sport_key,
          sport_title: odds.sport_title,
          commence_time: odds.commence_time,
          home_team: odds.home_team,
          away_team: odds.away_team,
          bookmakers: odds.bookmakers,
          last_update: odds.lastFetched
        }));
      }
    }
    
    // Fallback to JSON files
    if (matches.length === 0) {
      const files = fs.readdirSync(path.join(__dirname, '..'))
        .filter(file => file.endsWith('.json') && file.includes('_matches_'));
      
      for (const file of files) {
        try {
          const filePath = path.join(__dirname, '..', file);
          const fileContent = fs.readFileSync(filePath, 'utf8');
          const fileMatches = JSON.parse(fileContent);
          const sportMatches = fileMatches.filter(match => match.sport_key === sportKey);
          matches.push(...sportMatches);
        } catch (error) {
          console.error(`Error reading file ${file}:`, error.message);
        }
      }
    }
    
    res.json({
      success: true,
      matches: matches,
      total: matches.length,
      sport: sportKey
    });
    
  } catch (error) {
    console.error(`Error fetching odds for sport ${req.params.sportKey}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sport odds',
      message: error.message
    });
  }
});

// GET /api/odds/match/:matchId - Get specific match odds (existing endpoint)
router.get('/match/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    let match = null;
    
    // Try database first
    if (mongoose.connection.readyState === 1) {
      const oddsData = await Odds.findOne({ gameId: matchId });
      
      if (oddsData) {
        match = {
          id: oddsData.gameId,
          sport_key: oddsData.sport_key,
          sport_title: oddsData.sport_title,
          commence_time: oddsData.commence_time,
          home_team: oddsData.home_team,
          away_team: oddsData.away_team,
          bookmakers: oddsData.bookmakers,
          last_update: oddsData.lastFetched
        };
      }
    }
    
    // Fallback to JSON files
    if (!match) {
      const files = fs.readdirSync(path.join(__dirname, '..'))
        .filter(file => file.endsWith('.json') && file.includes('_matches_'));
      
      for (const file of files) {
        try {
          const filePath = path.join(__dirname, '..', file);
          const fileContent = fs.readFileSync(filePath, 'utf8');
          const fileMatches = JSON.parse(fileContent);
          match = fileMatches.find(m => m.id === matchId);
          if (match) break;
        } catch (error) {
          console.error(`Error reading file ${file}:`, error.message);
        }
      }
    }
    
    if (match) {
      res.json({
        success: true,
        match: match
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Match not found'
      });
    }
    
  } catch (error) {
    console.error(`Error fetching match ${req.params.matchId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch match odds',
      message: error.message
    });
  }
});

module.exports = router;