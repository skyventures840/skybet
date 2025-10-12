const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Odds = require('../models/Odds');
const Match = require('../models/Match');
const ComprehensiveOddsService = require('../services/comprehensiveOddsService');


// Initialize the comprehensive odds service (kept for non-odds utilities like betslip updates)
const oddsService = new ComprehensiveOddsService();


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