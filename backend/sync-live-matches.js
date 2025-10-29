const mongoose = require('mongoose');
const Match = require('./models/Match');
const Odds = require('./models/Odds');
const League = require('./models/League');

// Map odds API sport keys to Match model enum values
const sportMapping = {
  'soccer_epl': 'soccer',
  'soccer_italy_serie_a': 'soccer',
  'soccer_spain_la_liga': 'soccer',
  'soccer_germany_bundesliga': 'soccer',
  'soccer_france_ligue_one': 'soccer',
  'soccer_uefa_champs_league': 'soccer',
  'soccer_uefa_europa_league': 'soccer',
  'americanfootball_nfl': 'football',
  'americanfootball_ncaaf': 'football',
  'basketball_nba': 'basketball',
  'basketball_ncaab': 'basketball',
  'basketball_euroleague': 'basketball',
  'icehockey_nhl': 'hockey',
  'baseball_mlb': 'baseball',
  'tennis_atp': 'tennis',
  'tennis_wta': 'tennis'
};

async function syncLiveMatches() {
  try {
    await mongoose.connect('mongodb://localhost:27017/ween_sports_betting');
    console.log('Connected to MongoDB');
    
    const now = new Date();
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    
    // Find odds that should be live (started within last 3 hours)
    const liveOdds = await Odds.find({
      commence_time: { 
        $lte: now, 
        $gte: threeHoursAgo
      }
    });
    
    console.log(`Found ${liveOdds.length} matches that should be live`);
    
    // Get or create default league for unknown sports
    let defaultLeague = await League.findOne({ name: 'General Sports' });
    if (!defaultLeague) {
      defaultLeague = new League({
        name: 'General Sports',
        leagueId: 'general_sports',
        externalPrefix: 'GEN'
      });
      await defaultLeague.save();
      console.log('Created default league for unknown sports');
    }
    
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const odds of liveOdds) {
      // Map sport key to valid enum value
      const mappedSport = sportMapping[odds.sport_key] || 'soccer';
      
      // Check if match already exists
      const existingMatch = await Match.findOne({
        homeTeam: odds.home_team,
        awayTeam: odds.away_team,
        startTime: odds.commence_time
      });
      
      if (existingMatch) {
        // Update existing match to live status if it's not already
        if (existingMatch.status !== 'live') {
          existingMatch.status = 'live';
          await existingMatch.save();
          updatedCount++;
          console.log(`Updated: ${odds.home_team} vs ${odds.away_team} -> LIVE`);
        }
      } else {
        try {
          // Create new match from odds data
          const newMatch = new Match({
            homeTeam: odds.home_team,
            awayTeam: odds.away_team,
            startTime: odds.commence_time,
            status: 'live',
            sport: mappedSport,
            leagueId: defaultLeague._id,
            odds: extractOddsFromBookmakers(odds.bookmakers),
            externalId: odds.gameId
          });
          
          await newMatch.save();
          createdCount++;
          console.log(`Created: ${odds.home_team} vs ${odds.away_team} -> LIVE (${mappedSport})`);
        } catch (error) {
          console.error(`Failed to create match for ${odds.home_team} vs ${odds.away_team}:`, error.message);
          skippedCount++;
        }
      }
    }
    
    console.log(`\nSynchronization completed:`);
    console.log(`- Created: ${createdCount} new live matches`);
    console.log(`- Updated: ${updatedCount} existing matches to live`);
    console.log(`- Skipped: ${skippedCount} matches due to errors`);
    
    // Verify live matches
    const liveMatches = await Match.find({ status: 'live' });
    console.log(`\nTotal live matches in database: ${liveMatches.length}`);
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error syncing live matches:', err);
    process.exit(1);
  }
}

function extractOddsFromBookmakers(bookmakers) {
  if (!bookmakers || bookmakers.length === 0) return {};
  
  const firstBookmaker = bookmakers[0];
  const odds = {};
  
  if (firstBookmaker.markets) {
    for (const market of firstBookmaker.markets) {
      if (market.key === 'h2h' && market.outcomes) {
        for (const outcome of market.outcomes) {
          // Map team names to 1, X, 2 format
          if (outcome.name === firstBookmaker.home_team || market.outcomes.indexOf(outcome) === 0) {
            odds['1'] = outcome.price;
          } else if (outcome.name === 'Draw') {
            odds['X'] = outcome.price;
          } else {
            odds['2'] = outcome.price;
          }
        }
      }
    }
  }
  
  return odds;
}

syncLiveMatches();