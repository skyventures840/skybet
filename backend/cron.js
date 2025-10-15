const cron = require('node-cron');
const mongoose = require('mongoose');
const { OddsApiService } = require('./services/oddsApiService');
const betSettlementService = require('./services/betSettlementService');
const logger = require('./utils/logger');
const Match = require('./models/Match');
const League = require('./models/League');
const Odds = require('./models/Odds');
const { updateCronStatus, isServerHealthy } = require('./middleware/healthMonitor');

let oddsApiService;
try {
  oddsApiService = new OddsApiService();
} catch (error) {
  console.error('Failed to initialize OddsApiService:', error.message);
  oddsApiService = null;
}

// Sports list will be fetched dynamically from the Odds API per cron run

// Fetch all supported markets per sport; leave live odds to lightweight h2h

/**
 * @function updateMatchStatuses
 * @description Updates match statuses based on start times
 */
async function updateMatchStatuses() {
  const now = new Date();
  
  try {
    // Update matches that should be live
    await Match.updateMany(
      {
        startTime: { $lte: now },
        status: 'upcoming'
      },
      { $set: { status: 'live' } }
    );

    // Update matches that should be finished (e.g., 3 hours after start time)
    const threeHoursAgo = new Date(now - 3 * 60 * 60 * 1000);
    await Match.updateMany(
      {
        startTime: { $lte: threeHoursAgo },
        status: 'live'
      },
      { $set: { status: 'finished', finishedAt: now } }
    );

    logger.info('Successfully updated match statuses');
  } catch (error) {
    logger.error('Error updating match statuses:', error);
  }
}

/**
 * @function cleanupOldMatches
 * @description Removes matches and odds data older than 30 days
 */
async function cleanupOldMatches() {
  try {
    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Delete matches that finished more than 30 days ago
    const matchDeleteResult = await Match.deleteMany({
      $or: [
        { finishedAt: { $lt: thirtyDaysAgo } },
        { 
          status: 'finished',
          startTime: { $lt: thirtyDaysAgo }
        }
      ]
    });
    
    // Delete odds data older than 30 days
    const oddsDeleteResult = await Odds.deleteMany({
      commence_time: { $lt: thirtyDaysAgo }
    });
    
    logger.info(`Database cleanup completed: Removed ${matchDeleteResult.deletedCount} old matches and ${oddsDeleteResult.deletedCount} old odds records`);
  } catch (error) {
    logger.error('Error during database cleanup:', error);
  }
}

/**
 * @function settleBets
 * @description Automatically settle bets based on completed match results
 */
async function settleBets() {
  try {
    logger.info('Starting automated bet settlement...');
    const result = await betSettlementService.processSettlements();
    
    if (result.success) {
      logger.info(`Bet settlement completed: ${result.settledBets} bets settled across ${result.processedMatches} matches`);
    } else {
      logger.warn('Bet settlement completed with issues');
    }
  } catch (error) {
    logger.error('Error during bet settlement:', error);
  }
}

/**
 * @function fetchOddsForSport
 * @param {string} sportKey - The sport key to fetch odds for
 * @param {string} sportName - The display name of the sport
 * @returns {Promise<void>}
 */
async function fetchOddsForSport(sportKey, sportName) {
  // Ensure DB is connected before attempting any persistence
  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    logger.warn(`Skipping odds fetch for ${sportName} (${sportKey}) because MongoDB is not connected`);
    return;
  }
  if (!oddsApiService) {
    logger.warn('OddsApiService is not available, skipping odds fetch');
    return;
  }
  
  try {
    // Use the comprehensive getUpcomingOdds method which includes all priority markets
    logger.info(`Fetching comprehensive odds with priority markets for ${sportName} (${sportKey})`);
    const games = await oddsApiService.getUpcomingOdds(sportKey);
    logger.info(`Fetched ${Array.isArray(games) ? games.length : 0} events for ${sportName} (${sportKey})`);
    
    // Helper: map Odds API sport_key to internal sport enum
    const mapSportKeyToInternal = (key) => {
      if (!key) return 'soccer';
      if (key.startsWith('americanfootball')) return 'football';
      if (key.startsWith('basketball')) return 'basketball';
      if (key.startsWith('soccer')) return 'soccer';
      if (key.startsWith('baseball')) return 'baseball';
      if (key.startsWith('icehockey')) return 'hockey';
      if (key.startsWith('tennis')) return 'tennis';
      return 'soccer';
    };

    // Helper: normalize markets to a compact odds map (aligned with OddsApiService)
    const normalizeMarketKey = (key) => {
      const k = (key || '').toLowerCase();
      const noLay = k
        .replace(/_?lay$/i, '')
        .replace(/\blay\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\s/g, '_');
      if (noLay === 'h2h' || noLay === 'moneyline') return 'h2h';
      if (noLay === 'totals' || noLay === 'over_under' || noLay === 'points_total') return 'totals';
      if (noLay === 'spreads' || noLay === 'handicap' || noLay === 'asian_handicap' || noLay === 'point_spread') return 'spreads';
      if (noLay === 'btts' || noLay === 'both_teams_to_score') return 'both_teams_to_score';
      if (noLay === 'draw_no_bet') return 'draw_no_bet';
      if (noLay === 'outrights' || noLay === 'outright') return 'outrights';
      if (noLay === 'team_totals') return 'team_totals';
      if (noLay === 'alternate_team_totals') return 'alternate_team_totals';
      if (noLay === 'alternate_totals') return 'alternate_totals';
      if (noLay === 'alternate_spreads') return 'alternate_spreads';
      if (noLay === 'h2h_3_way') return 'h2h_3_way';
      if (noLay === 'double_chance') return 'double_chance';
      return noLay;
    };

    const buildOddsMapFromBookmakers = (bookmakers, homeTeam, awayTeam) => {
      const marketsMap = {};
      if (!Array.isArray(bookmakers) || bookmakers.length === 0) return marketsMap;
      const firstBookmaker = bookmakers[0];
      if (!firstBookmaker || !Array.isArray(firstBookmaker.markets)) return marketsMap;
      firstBookmaker.markets.forEach(market => {
        const mKey = normalizeMarketKey(market.key);
        if (mKey === 'h2h') {
          market.outcomes.forEach(outcome => {
            if (outcome.name === homeTeam) {
              marketsMap['1'] = outcome.price;
              marketsMap['homeWin'] = outcome.price;
            } else if (outcome.name === awayTeam) {
              marketsMap['2'] = outcome.price;
              marketsMap['awayWin'] = outcome.price;
            } else if (/draw/i.test(outcome.name)) {
              marketsMap['X'] = outcome.price;
              marketsMap['draw'] = outcome.price;
            }
          });
        } else if (mKey === 'totals') {
          if (Array.isArray(market.outcomes) && market.outcomes.length >= 2) {
            const overOutcome = market.outcomes.find(o => /over/i.test(o.name)) || market.outcomes[0];
            const underOutcome = market.outcomes.find(o => /under/i.test(o.name)) || market.outcomes[1];
            const point = overOutcome?.point ?? underOutcome?.point;
            if (point != null) marketsMap['total'] = point;
            if (overOutcome && typeof overOutcome.price === 'number') marketsMap['over'] = overOutcome.price;
            if (underOutcome && typeof underOutcome.price === 'number') marketsMap['under'] = underOutcome.price;
          }
        } else if (mKey === 'spreads') {
          if (Array.isArray(market.outcomes)) {
            const home = market.outcomes.find(o => o.name === homeTeam);
            const away = market.outcomes.find(o => o.name === awayTeam);
            const line = home?.point ?? away?.point;
            if (line != null) marketsMap['handicapLine'] = line;
            if (typeof home?.price === 'number') marketsMap['homeHandicap'] = home.price;
            if (typeof away?.price === 'number') marketsMap['awayHandicap'] = away.price;
          }
        }
      });
      return marketsMap;
    };

    // Ensure a League exists and obtain its ObjectId for reference
    const ensureLeague = async () => {
      try {
        const externalPrefix = sportKey.split('_')[0] || sportKey;
        const existing = await League.findOne({ leagueId: sportKey });
        if (existing) return existing._id;
        const created = await League.create({
          name: sportName || sportKey,
          leagueId: sportKey,
          externalPrefix
        });
        return created._id;
      } catch (err) {
        logger.warn(`League upsert failed for ${sportKey}: ${err?.message || err}`);
        return null;
      }
    };

    const leagueObjectId = await ensureLeague();

    // Persist Match records as well for frontend and live updates
    if (Array.isArray(games) && games.length > 0) {
      const internalSport = mapSportKeyToInternal(sportKey);
      const matchBulkOps = games.map(game => {
        const oddsMap = buildOddsMapFromBookmakers(game.bookmakers, game.home_team, game.away_team);
        return ({
          updateOne: {
            filter: { externalId: game.id },
            update: {
              $set: {
                externalId: game.id,
                leagueId: leagueObjectId,
                sport: internalSport,
                homeTeam: game.home_team,
                awayTeam: game.away_team,
                startTime: new Date(game.commence_time),
                odds: oddsMap,
                status: 'upcoming'
              }
            },
            upsert: true
          }
        });
      });
      await Match.bulkWrite(matchBulkOps, { ordered: false, setDefaultsOnInsert: true });
      logger.info(`Saved ${games.length} match records for ${sportName} (${sportKey})`);
    } else {
      logger.info(`No games returned for ${sportName} (${sportKey}), attempting fallback from saved Odds...`);
      // Fallback: derive matches from saved Odds documents if available
      try {
        const oddsDocs = await Odds.find({ sport_key: sportKey }).limit(250);
        if (Array.isArray(oddsDocs) && oddsDocs.length > 0) {
          const internalSport = mapSportKeyToInternal(sportKey);
          const matchBulkOps = oddsDocs.map(oddsDoc => {
            const oddsMap = buildOddsMapFromBookmakers(oddsDoc.bookmakers, oddsDoc.home_team, oddsDoc.away_team);
            return ({
              updateOne: {
                filter: { externalId: oddsDoc.gameId },
                update: {
                  $set: {
                    externalId: oddsDoc.gameId,
                    leagueId: leagueObjectId,
                    sport: internalSport,
                    homeTeam: oddsDoc.home_team,
                    awayTeam: oddsDoc.away_team,
                    startTime: new Date(oddsDoc.commence_time),
                    odds: oddsMap,
                    status: 'upcoming'
                  }
                },
                upsert: true
              }
            });
          });
          await Match.bulkWrite(matchBulkOps, { ordered: false, setDefaultsOnInsert: true });
          logger.info(`Fallback saved ${oddsDocs.length} match records for ${sportName} (${sportKey})`);
        } else {
          logger.info(`No saved Odds found for fallback for ${sportName} (${sportKey})`);
        }
      } catch (fbErr) {
        logger.error(`Fallback match save failed for ${sportName} (${sportKey}):`, fbErr);
      }
    }

    // Log rate-limit info if available
    if (typeof oddsApiService.getLastRateLimitInfo === 'function') {
      const rateInfo = oddsApiService.getLastRateLimitInfo();
      if (rateInfo) {
        const remaining = typeof rateInfo.remaining === 'number' ? rateInfo.remaining : 'unknown';
        const used = typeof rateInfo.used === 'number' ? rateInfo.used : 'unknown';
        logger.info(`Rate limit info for ${sportName}: remaining=${remaining}, used=${used}`);
      }
    }

    // Log a brief sample summary for observability
    if (Array.isArray(games) && games.length > 0) {
      const sample = games[0];
      const bookmakerCount = Array.isArray(sample.bookmakers) ? sample.bookmakers.length : 0;
      logger.info(`Sample odds saved: gameId=${sample.id}, commence_time=${sample.commence_time}, home_team=${sample.home_team}, away_team=${sample.away_team}, bookmaker_count=${bookmakerCount}`);
    }

    // Verification similar to simpleFetchAndVerify: ensure odds exist for this sport
    try {
      const sportOddsCount = await Odds.countDocuments({ sport_key: sportKey });
      logger.info(`Odds documents saved for ${sportName} (${sportKey}): ${sportOddsCount}`);
    } catch (countErr) {
      logger.warn(`Could not verify odds count for ${sportName} (${sportKey}): ${countErr && countErr.message ? countErr.message : countErr}`);
    }

    logger.info(`Successfully fetched and saved all markets for ${sportName}`);
    // Small delay to avoid rate limiting between sports
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (error) {
    logger.error(`Error fetching all markets for ${sportName}:`, error);
  }
}

/**
 * @function broadcastLiveMatchesUpdate
 * @description Broadcasts live matches update to all WebSocket subscribers
 */
async function broadcastLiveMatchesUpdate() {
  try {
    if (global.websocketServer) {
      await global.websocketServer.broadcastLiveMatchesUpdate();
      logger.info('Successfully broadcasted live matches update to WebSocket subscribers');
    }
  } catch (error) {
    logger.error('Error broadcasting live matches update:', error);
  }
}

/**
 * @function fetchLiveOdds
 * @description Fetches live odds for currently live matches
 */
async function fetchLiveOdds() {
  if (!oddsApiService) {
    logger.warn('OddsApiService is not available, skipping live odds fetch');
    return;
  }
  
  try {
    // Get all live matches
    const liveMatches = await Match.find({ status: 'live' });
    
    if (liveMatches.length === 0) {
      logger.info('No live matches found, skipping live odds fetch');
      return;
    }
    
    logger.info(`Found ${liveMatches.length} live matches, fetching live odds...`);
    
    // Fetch live odds for each sport that has live matches
    const sportsWithLiveMatches = [...new Set(liveMatches.map(match => match.sport))];
    
    for (const sport of sportsWithLiveMatches) {
      try {
        // Map internal sport names to a list of API sport keys
        const sportKeyMap = {
          football: ['americanfootball_nfl', 'americanfootball_cfl'],
          basketball: ['basketball_nba'],
          soccer: ['soccer_epl'],
          baseball: ['baseball_mlb'],
          hockey: ['icehockey_nhl'],
        };

        const apiSportKeys = sportKeyMap[sport] || [sport];

        // Use comprehensive priority markets for live odds
        const priorityMarkets = oddsApiService.getPriorityMarkets();

        for (const apiSportKey of apiSportKeys) {
          logger.info(`Fetching live odds for ${sport} (API key: ${apiSportKey}) using ${priorityMarkets.length} priority markets`);
          const games = await oddsApiService._fetchAndSaveOddsForMarketsBatch(apiSportKey, priorityMarkets);
          logger.info(`Live odds fetched: ${Array.isArray(games) ? games.length : 0} events for ${apiSportKey}`);
          // Add delay between league calls to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        logger.error(`Error fetching live odds for ${sport}:`, error);
      }
    }
    
    logger.info('Live odds fetch completed');
    
  } catch (error) {
    logger.error('Error in live odds fetch:', error);
  }
}

/**
 * @function startCronJobs
 * @description Initializes and starts all scheduled cron jobs for the application.
 */
const startCronJobs = () => {
  // Add job overlap prevention
  let isOddsFetching = false;
  let isLiveOddsFetching = false;
  let isStatusUpdating = false;
  let isBroadcasting = false;
  let isCleaningUp = false;
  let isBetSettling = false;

  // Fetch upcoming odds every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    // Skip if DB is not connected to avoid buffered writes that never flush
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      logger.warn('MongoDB not connected; skipping scheduled upcoming odds fetch');
      return;
    }
    if (isOddsFetching) {
      logger.warn('Odds fetching already in progress, skipping...');
      return;
    }
    
    // Check server health before starting
    if (!isServerHealthy()) {
      logger.warn('Server is unhealthy, skipping odds fetch...');
      return;
    }
    
    isOddsFetching = true;
    updateCronStatus(true, 'odds-fetch');
    
  try {
    logger.info('Starting cron job: Fetching upcoming odds for all supported sports...');

      // Dynamically fetch sports from the Odds API
      const sportsList = await oddsApiService.getSports();
      if (!sportsList || sportsList.length === 0) {
        logger.warn('No sports returned by Odds API; skipping odds fetch.');
      } else {
        // Exclude non-sport categories and novelty keys
        const supportedSports = sportsList.filter(sport =>
          sport && sport.key &&
          !sport.key.includes('politics') &&
          !sport.key.includes('entertainment') &&
          sport.key !== 'golf_the_open_championship_winner'
        );

        logger.info(`Processing ${supportedSports.length} supported sports`);

        // Process sports sequentially to reduce load
        for (const sport of supportedSports) {
          const displayName = sport.title || sport.group || sport.name || sport.key;
          await fetchOddsForSport(sport.key, displayName);
          // Add delay between sports to prevent overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }

      logger.info('Cron job finished: Successfully fetched odds for supported sports.');
    } catch (error) {
      logger.error('Error in odds fetching cron job:', error);
    } finally {
      isOddsFetching = false;
      updateCronStatus(false, 'odds-fetch');
    }
  });

  // Fetch live odds every minute (near real-time)
  cron.schedule('*/1 * * * *', async () => {
    // Skip if DB is not connected
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      logger.warn('MongoDB not connected; skipping scheduled live odds fetch');
      return;
    }
    if (isLiveOddsFetching) {
      logger.warn('Live odds fetching already in progress, skipping...');
      return;
    }
    
    isLiveOddsFetching = true;
    try {
      logger.info('Starting cron job: Fetching live odds...');
      await fetchLiveOdds();
      logger.info('Cron job finished: Successfully fetched live odds.');
    } catch (error) {
      logger.error('Error in live odds fetching cron job:', error);
    } finally {
      isLiveOddsFetching = false;
    }
  });

  // Update match statuses every minute (near real-time)
  cron.schedule('*/1 * * * *', async () => {
    if (isStatusUpdating) {
      logger.warn('Status update already in progress, skipping...');
      return;
    }
    
    isStatusUpdating = true;
    try {
      logger.info('Starting cron job: Updating match statuses...');
      await updateMatchStatuses();
      logger.info('Cron job finished: Successfully updated match statuses.');
    } catch (error) {
      logger.error('Error in match status update cron job:', error);
    } finally {
      isStatusUpdating = false;
    }
  });

  // Broadcast live matches update every minute (near real-time)
  cron.schedule('*/1 * * * *', async () => {
    if (isBroadcasting) {
      logger.warn('Broadcast already in progress, skipping...');
      return;
    }
    
    isBroadcasting = true;
    try {
      logger.info('Starting cron job: Broadcasting live matches update...');
      await broadcastLiveMatchesUpdate();
      logger.info('Cron job finished: Successfully broadcasted live matches update.');
    } catch (error) {
      logger.error('Error in live matches broadcast cron job:', error);
    } finally {
      isBroadcasting = false;
    }
  });

  // Settle bets every 2 minutes based on completed match results
  cron.schedule('*/2 * * * *', async () => {
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      logger.warn('MongoDB not connected; skipping scheduled bet settlement');
      return;
    }
    if (isBetSettling) {
      logger.warn('Bet settlement already in progress, skipping...');
      return;
    }
    
    isBetSettling = true;
    try {
      logger.info('Starting cron job: Settling bets...');
      await settleBets();
      logger.info('Cron job finished: Successfully processed bet settlements.');
    } catch (error) {
      logger.error('Error in bet settlement cron job:', error);
    } finally {
      isBetSettling = false;
    }
  });

  // Clean up old matches and odds data daily at 2 AM (less busy time)
  cron.schedule('0 2 * * *', async () => {
    if (isCleaningUp) {
      logger.warn('Cleanup already in progress, skipping...');
      return;
    }
    
    isCleaningUp = true;
    try {
      logger.info('Starting cron job: Cleaning up old matches and odds data...');
      await cleanupOldMatches();
      logger.info('Cron job finished: Successfully cleaned up old data.');
    } catch (error) {
      logger.error('Error in cleanup cron job:', error);
    } finally {
      isCleaningUp = false;
    }
  });

  logger.info('All cron jobs scheduled with overlap prevention.');
};

module.exports = startCronJobs;