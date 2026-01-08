const Bet = require('../models/Bet')
const User = require('../models/User')
const Match = require('../models/Match')
const Results = require('../models/Results')
const Scores = require('../models/Scores')
const MultiBet = require('../models/MultiBet')
const logger = require('../utils/logger')
const { bus } = require('../utils/cache')
const { escapeRegex } = require('../utils/regex')

class BetSettlementService {
  constructor () {
    this.isProcessing = false
  }

  /**
   * Main function to process bet settlements
   * Checks for completed matches and settles pending bets
   */
  async processSettlements () {
    if (this.isProcessing) {
      logger.warn('Bet settlement already in progress, skipping...')
      return
    }

    this.isProcessing = true
    let settledBetsCount = 0
    let processedMatchesCount = 0

    try {
      logger.info('Starting automated bet settlement process...')

      const completedResults = await Results.find({ completed: true })
      // Fetch finished matches from DB (including custom matches)
      const completedMatchesDB = await Match.find({ status: 'finished' })

      const completedMatches = this.combineCompletedMatches(completedResults, completedMatchesDB)

      logger.info(`Found ${completedMatches.length} completed matches to process`)

      for (const match of completedMatches) {
        try {
          const settled = await this.settleMatchBets(match)
          if (settled > 0) {
            settledBetsCount += settled
            processedMatchesCount++
          }
        } catch (error) {
          logger.error(`Error settling bets for match ${match.eventId}:`, error)
        }
      }

      // Additionally handle cancelled/postponed matches as void
      try {
        const voidableMatches = await Match.find({ status: { $in: ['cancelled', 'postponed'] } })
        if (voidableMatches && voidableMatches.length > 0) {
          for (const vm of voidableMatches) {
            try {
              const voided = await this.settleVoidedMatchBets(vm)
              if (voided > 0) {
                settledBetsCount += voided
                processedMatchesCount++
              }
            } catch (err) {
              logger.error(`Error void-settling bets for match ${vm._id}`, err)
            }
          }
        }
      } catch (voidErr) {
        logger.error('Error fetching cancelled/postponed matches for void settlement:', voidErr)
      }

      logger.info(`Bet settlement completed: ${settledBetsCount} bets settled across ${processedMatchesCount} matches`)

      return {
        success: true,
        settledBets: settledBetsCount,
        processedMatches: processedMatchesCount
      }
    } catch (error) {
      logger.error('Error in bet settlement process:', error)
      throw error
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Update bets for a live match (update scores without settling)
   * This allows users to see real-time scores on their betslips
   */
  async updateLiveMatchBets (match) {
    try {
      const results = this.extractResults(match)
      
      // If we don't have valid scores yet, skip
      if (results.homeScore === null || results.awayScore === null) return

      const resultData = {
        homeScore: results.homeScore,
        awayScore: results.awayScore,
        // Calculate provisional outcome
        finalOutcome: results.homeScore > results.awayScore ? '1' : results.homeScore < results.awayScore ? '2' : 'X'
      }

      // Update Single Bets
      // We only update the result field, we do NOT change status from 'pending'
      await Bet.updateMany(
        { matchId: match.eventId, status: 'pending' },
        {
          $set: {
            result: resultData
          }
        }
      )

      // Update MultiBets
      await MultiBet.updateMany(
        { 'matches.matchId': match.eventId, status: 'Pending' },
        {
          $set: {
            'matches.$.result': resultData
          }
        }
      )

      // Emit change event so UI updates
      try { bus.emit('bets:changed') } catch (e) {}
      
      // Determine match identifier for broadcasting
      const matchIdStr = match.eventId || (match._id ? match._id.toString() : null)
      
      if (matchIdStr && global.websocketServer && typeof global.websocketServer.broadcastMatchResult === 'function') {
        try {
          global.websocketServer.broadcastMatchResult(matchIdStr, {
            homeScore: results.homeScore,
            awayScore: results.awayScore,
            score: `${results.homeScore}:${results.awayScore}`,
            status: 'live'
          })
        } catch (wsErr) {}
      }

      return true
    } catch (error) {
      logger.error(`Error updating live bets for match ${match.eventId}:`, error)
      return false
    }
  }

  /**
   * Settle all pending bets as VOID for cancelled/postponed matches
   */
  async settleVoidedMatchBets (match) {
    try {
      const eventId = match.externalId || (match._id ? match._id.toString() : null)
      if (!eventId) return 0

      const pendingBets = await Bet.find({ matchId: eventId, status: 'pending' })
      let settledCount = 0

      const resultData = {
        homeScore: match.homeScore ?? null,
        awayScore: match.awayScore ?? null,
        finalOutcome: 'void'
      }

      for (const bet of pendingBets) {
        try {
          const update = {
            status: 'void',
            actualWin: bet.stake, // refund stake
            settledAt: new Date(),
            result: resultData
          }
          await Bet.findByIdAndUpdate(bet._id, update)
          await User.settleBetWin(bet.userId, update.actualWin)

          try {
            bus.emit('bets:update', {
              userId: String(bet.userId),
              betId: String(bet._id),
              matchId: bet.matchId,
              status: update.status,
              actualWin: update.actualWin,
              settledAt: update.settledAt,
              result: resultData
            })
            if (global.websocketServer && typeof global.websocketServer.broadcastBetStatusUpdate === 'function') {
              global.websocketServer.broadcastBetStatusUpdate(
                String(bet._id),
                String(bet.userId),
                update.status,
                bet.matches || [],
                resultData
              )
            }
          } catch (_) {}
          settledCount++
        } catch (err) {
          logger.error(`Error void-settling bet ${bet._id}:`, err)
        }
      }

      // Handle multibets legs: mark leg as Void and let model recalc partials
      const multiBets = await MultiBet.find({ 'matches.matchId': eventId, status: 'Pending' })
      for (const mb of multiBets) {
        try {
          const leg = mb.matches.find(m => m.matchId === eventId)
          if (leg && leg.status === 'Pending') {
            await mb.updateMatchStatus(eventId, 'Void', resultData)
            // If Partial or Win, pay accordingly
            if (mb.status === 'Win' || mb.status === 'Partial') {
              const payout = mb.potentialPayout
              if (payout > 0) {
                await User.settleBetWin(mb.userId, payout)
                await User.findByIdAndUpdate(mb.userId, {
                  $inc: { lifetimeWinnings: payout - mb.stake }
                })
              }
            }
            settledCount++
          }
        } catch (mbErr) {
          logger.error(`Error void-settling multi-bet ${mb._id}:`, mbErr)
        }
      }

      return settledCount
    } catch (error) {
      logger.error(`Error in settleVoidedMatchBets for match ${match._id}:`, error)
      return 0
    }
  }

  /**
   * Combine completed matches from Results and Scores, avoiding duplicates
   */
  combineCompletedMatches (results, matchesDB = [], scores = []) {
    const matchMap = new Map()

    // Process Results from API
    results.forEach(result => {
      matchMap.set(result.eventId, {
        eventId: result.eventId,
        homeTeam: result.home_team,
        awayTeam: result.away_team,
        scores: result.scores,
        completed: result.completed,
        sport_key: result.sport_key,
        source: 'results',
        directResults: {
          homeScoreHT: result.homeScoreHT,
          awayScoreHT: result.awayScoreHT,
          homeCorners: result.homeCorners,
          awayCorners: result.awayCorners,
          homeCards: result.homeCards,
          awayCards: result.awayCards,
          penaltyAwarded: result.penaltyAwarded,
          firstGoalscorer: result.firstGoalscorer,
          anytimeGoalscorers: result.anytimeGoalscorers,
          lastGoalscorer: result.lastGoalscorer
        }
      })
    })

    // Process Scores from API (Targeted fetches)
    scores.forEach(score => {
      if (!matchMap.has(score.eventId)) {
        matchMap.set(score.eventId, {
          eventId: score.eventId,
          homeTeam: score.home_team,
          awayTeam: score.away_team,
          scores: score.scores,
          completed: score.completed,
          sport_key: score.sport_key,
          source: 'scores'
        })
      }
    })

    // Process Matches from DB (Custom/Predetermined)
    matchesDB.forEach(match => {
      // Use _id as eventId if not present (or match.externalId)
      // Prefer externalId if it matches API format, otherwise use _id
      const eventId = match.externalId || match._id.toString()

      // Create direct results object from predeterminedResult or direct fields
      const predetermined = match.predeterminedResult || {}
      const directResults = {
        homeScore: predetermined.homeScore ?? match.homeScore,
        awayScore: predetermined.awayScore ?? match.awayScore,
        homeScoreHT: predetermined.homeScoreHT,
        awayScoreHT: predetermined.awayScoreHT,
        homeCorners: predetermined.homeCorners,
        awayCorners: predetermined.awayCorners,
        homeCards: predetermined.homeCards,
        awayCards: predetermined.awayCards,
        penaltyAwarded: predetermined.penaltyAwarded,
        firstGoalscorer: predetermined.firstGoalscorer,
        anytimeGoalscorers: predetermined.anytimeGoalscorers,
        lastGoalscorer: predetermined.lastGoalscorer
      }

      if (!matchMap.has(eventId)) {
        matchMap.set(eventId, {
          eventId,
          originalId: match._id.toString(),
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          scores: [
            { name: match.homeTeam, score: directResults.homeScore },
            { name: match.awayTeam, score: directResults.awayScore }
          ],
          completed: true,
          sport_key: match.sport,
          source: 'db',
          directResults
        })
      } else {
        // If match exists from API but we have DB override (predeterminedResult), merge/override
        // This is useful if API is missing stats like corners/cards but we have them manually
        const existing = matchMap.get(eventId)
        existing.originalId = match._id.toString()
        existing.directResults = { ...existing.directResults, ...directResults }

        // If we have explicit scores in DB, potentially override API scores (if marked as authoritative)
        // For now, we'll just ensure directResults are available for extended markets
      }
    })

    return Array.from(matchMap.values())
  }

  /**
   * Settle bets for a specific completed match
   */
  async settleMatchBets (match) {
    try {
      // Extract comprehensive results from the match data
      const results = this.extractResults(match)

      if (results.homeScore === null || results.awayScore === null) {
        logger.warn(`Invalid scores for match ${match.eventId}`)
        return 0
      }

      await this.updateBetslipWithResult(match, results)
      const pendingBets = await this.findMatchingBets(match)
      
      // Settle MultiBets
      const settledMultiBetsCount = await this.settleMultiBets(match)

      if (pendingBets.length === 0 && settledMultiBetsCount === 0) {
        logger.debug(`No pending bets found for match ${match.eventId}`)
        return 0
      }

      logger.info(`Settling ${pendingBets.length} single bets and ${settledMultiBetsCount} multi-bets for match ${match.eventId} (${match.homeTeam} vs ${match.awayTeam})`)

      let settledCount = 0
      for (const bet of pendingBets) {
        try {
          const settled = await this.settleSingleBet(bet, results, match)
          if (settled) settledCount++
        } catch (error) {
          logger.error(`Error settling bet ${bet._id}:`, error)
        }
      }

      return settledCount + settledMultiBetsCount
    } catch (error) {
      logger.error(`Error settling bets for match ${match.eventId}:`, error)
      return 0
    }
  }

  async updateBetslipWithResult (match, results) {
    try {
      const { homeScore, awayScore } = results
      const finalOutcome = homeScore > awayScore ? '1' : homeScore < awayScore ? '2' : 'X'
      const resultData = { ...results, finalOutcome }

      const matchIds = [match.eventId]
      if (match.originalId && match.originalId !== match.eventId) {
        matchIds.push(match.originalId)
      }

      await MultiBet.updateMany(
        { 'matches.matchId': { $in: matchIds } },
        {
          $set: {
            'matches.$.matchStatus': 'Finished',
            'matches.$.result': resultData
          }
        }
      )

      // Update Single Bets (Top level result)
      await Bet.updateMany(
        { matchId: { $in: matchIds } },
        {
          $set: {
            result: resultData
          }
        }
      )

      await Bet.updateMany(
        { 'matches.matchId': { $in: matchIds } },
        {
          $set: {
            'matches.$.outcome': finalOutcome,
            'matches.$.result': resultData
          }
        }
      )
      try { bus.emit('bets:changed') } catch (e) {}

      if (global.websocketServer && typeof global.websocketServer.broadcastMatchResult === 'function') {
        try {
          global.websocketServer.broadcastMatchResult(String(match.eventId), {
            homeScore,
            awayScore,
            score: `${homeScore}:${awayScore}`
          })
        } catch (wsErr) {}
      }
    } catch (error) {
      logger.warn('Failed to push result to betslip:', error)
    }
  }

  /**
   * Extract comprehensive results from match data
   */
  extractResults (match) {
    let results = {
      homeScore: null,
      awayScore: null,
      homeScoreHT: null,
      awayScoreHT: null,
      homeCorners: null,
      awayCorners: null,
      homeCards: null,
      awayCards: null,
      penaltyAwarded: false,
      firstGoalscorer: null,
      anytimeGoalscorers: [],
      lastGoalscorer: null
    }

    // 1. Prefer direct results (DB or manually entered)
    if (match.directResults) {
      results = { ...results, ...match.directResults };
      // Ensure numeric types
      ['homeScore', 'awayScore', 'homeScoreHT', 'awayScoreHT', 'homeCorners', 'awayCorners', 'homeCards', 'awayCards'].forEach(key => {
        if (results[key] !== undefined && results[key] !== null) {
          results[key] = parseInt(results[key])
        }
      })
      // Ensure boolean
      if (results.penaltyAwarded !== undefined) results.penaltyAwarded = !!results.penaltyAwarded
    }

    // 2. Fallback for basic scores if still null
    if ((results.homeScore === null || results.awayScore === null) &&
        match.scores && Array.isArray(match.scores)) {
      const homeScoreData = match.scores.find(s => s.name === match.homeTeam)
      const awayScoreData = match.scores.find(s => s.name === match.awayTeam)

      if (homeScoreData && awayScoreData) {
        results.homeScore = parseInt(homeScoreData.score) || 0
        results.awayScore = parseInt(awayScoreData.score) || 0
      } else if (match.scores.length >= 2) {
        results.homeScore = parseInt(match.scores[0].score) || 0
        results.awayScore = parseInt(match.scores[1].score) || 0
      }
    }

    return results
  }

  /**
   * Find bets that match the completed match
   */
  async findMatchingBets (match) {
    const queries = [
      { matchId: match.eventId, status: 'pending' }
    ]

    if (match.originalId && match.originalId !== match.eventId) {
      queries.push({ matchId: match.originalId, status: 'pending' })
    }

    queries.push({
      status: 'pending',
      $and: [
        { homeTeam: { $regex: new RegExp(escapeRegex(match.homeTeam), 'i') } },
        { awayTeam: { $regex: new RegExp(escapeRegex(match.awayTeam), 'i') } }
      ]
    })

    let allBets = []
    for (const query of queries) {
      const bets = await Bet.find(query)
      allBets = allBets.concat(bets)
    }

    const uniqueBets = allBets.filter((bet, index, self) =>
      index === self.findIndex(b => b._id.toString() === bet._id.toString())
    )

    return uniqueBets
  }

  /**
   * Settle a single bet based on match outcome
   */
  async settleSingleBet (bet, results, match) {
    try {
      // outcome can be:
      // - boolean (legacy) true/false
      // - string: 'void'
      // - object: { decision: 'win'|'loss'|'void'|'half_win'|'half_loss'|'push', payoutFactor?: number, rule?: string }
      let outcome = false
      const { homeScore, awayScore } = results

      // Determine bet outcome based on market type
      switch (bet.market.toLowerCase()) {
        case 'h2h':
        case 'moneyline':
        case 'match_winner':
        case 'matchwinner':
        case '1x2':
          outcome = this.evaluateMatchWinnerBet(bet.selection, homeScore, awayScore, match)
          break
        case 'double_chance':
        case 'doublechance':
          outcome = this.evaluateDoubleChanceBet(bet.selection, homeScore, awayScore)
          break
        case 'btts':
        case 'both_teams_to_score':
        case 'bothteamstoscore':
          outcome = this.evaluateBTTSBet(bet.selection, homeScore, awayScore)
          break
        case 'handicap':
        case 'spread':
        case 'spreads':
        case 'alternate_spreads': {
          const asian = this.evaluateAsianHandicapOutcome(bet.selection, homeScore, awayScore)
          if (asian) {
            outcome = asian
          } else {
            outcome = this.evaluateHandicapBet(bet.selection, homeScore, awayScore)
          }
          break
        }
        case 'totals':
        case 'over_under':
        case 'overunder':
        case 'total_goals':
        case 'totalgoals':
        case 'team_totals':
        case 'alternate_totals': {
          const asianTotals = this.evaluateAsianTotalsOutcome(bet.selection, homeScore, awayScore)
          if (asianTotals) {
            outcome = asianTotals
          } else {
            outcome = this.evaluateTotalsBet(bet.selection, homeScore, awayScore)
          }
          break
        }
        case 'correct_score':
        case 'correctscore':
        case 'correct score':
        case 'Correct Score':
          outcome = this.evaluateCorrectScoreBet(bet.selection, homeScore, awayScore)
          break
        case 'ht_ft':
        case 'halftime_fulltime':
        case 'halftimefulltime':
          outcome = this.evaluateHTFTBet(bet.selection, results)
          break
        case 'corners':
        case 'corners_over_under':
        case 'cornersoverunder':
          outcome = this.evaluateCornersBet(bet.selection, results)
          break
        case 'cards':
        case 'cards_over_under':
        case 'cardsoverunder':
          outcome = this.evaluateCardsBet(bet.selection, results)
          break
        case 'goalscorer':
        case 'first_goalscorer':
        case 'firstgoalscorer':
        case 'anytime_goalscorer':
        case 'anytimegoalscorer':
        case 'last_goalscorer':
        case 'lastgoalscorer':
          outcome = this.evaluateGoalscorerBet(bet.selection, bet.market, results)
          break
        case 'odd_even':
        case 'odd_even_goals':
        case 'oddevengoals':
          outcome = this.evaluateOddEvenBet(bet.selection, homeScore, awayScore)
          break
        case 'multi_goals':
        case 'multigoals':
        case 'goal_bands':
        case 'goalbands':
          outcome = this.evaluateMultiGoalsBet(bet.selection, homeScore, awayScore)
          break
        case 'winning_margin':
        case 'winningmargin':
          outcome = this.evaluateWinningMarginBet(bet.selection, homeScore, awayScore, match)
          break
        case 'penalty':
        case 'penalty_awarded':
        case 'penaltyawarded':
          outcome = this.evaluatePenaltyBet(bet.selection, results)
          break
        default:
          logger.warn(`Unknown market type: ${bet.market} for bet ${bet._id}`)
          // Fallback to match winner if possible
          if (['1', 'X', '2'].includes(bet.selection) || bet.selection.includes('Home') || bet.selection.includes('Away')) {
            outcome = this.evaluateMatchWinnerBet(bet.selection, homeScore, awayScore, match)
          }
      }

      // Update bet status (supports partial outcomes)
      const finalOutcome = homeScore > awayScore ? '1' : homeScore < awayScore ? '2' : 'X'
      let status = 'lost'
      let actualWin = 0

      if (outcome === true) {
        status = 'won'
        actualWin = bet.potentialWin
      } else if (outcome === 'void' || (typeof outcome === 'object' && outcome.decision === 'void') || (typeof outcome === 'object' && outcome.decision === 'push')) {
        status = 'void'
        actualWin = bet.stake
      } else if (typeof outcome === 'object') {
        if (outcome.decision === 'win') {
          status = 'won'
          actualWin = bet.potentialWin
        } else if (outcome.decision === 'half_win') {
          status = 'won'
          const factor = outcome.payoutFactor != null ? outcome.payoutFactor : 0.5
          // Half stake wins at odds, half stake refunded (push)
          actualWin = (bet.stake * factor * bet.odds) + (bet.stake * (1 - factor))
        } else if (outcome.decision === 'half_loss') {
          status = 'lost'
          // Half loss means half stake lost, half stake refunded (push)
          actualWin = bet.stake * 0.5
        } else if (outcome.decision === 'loss') {
          status = 'lost'
          actualWin = 0
        }
      }

      const update = {
        status,
        actualWin,
        settledAt: new Date(),
        result: { ...results, finalOutcome }
      }

      // Append settlement audit log entry
      const decision = typeof outcome === 'object' ? outcome.decision : (outcome === true ? 'win' : (outcome === 'void' ? 'void' : 'loss'))
      const ruleNote = typeof outcome === 'object' ? outcome.rule : undefined
      try {
        await Bet.findByIdAndUpdate(bet._id, {
          $set: update,
          $push: {
            settlementLog: {
              timestamp: new Date(),
              market: bet.market,
              selection: bet.selection,
              decision,
              payoutFactor: typeof outcome === 'object' && outcome.payoutFactor != null ? outcome.payoutFactor : undefined,
              computedActualWin: actualWin,
              rule: ruleNote
            }
          }
        })
      } catch (e) {
        await Bet.findByIdAndUpdate(bet._id, update)
      }

      if (status === 'won') {
        await User.settleBetWin(bet.userId, actualWin)
        await User.findByIdAndUpdate(bet.userId, {
          $inc: { lifetimeWinnings: actualWin - bet.stake }
        })
      } else if (status === 'void') {
        await User.settleBetWin(bet.userId, actualWin) // Refund stake
        // Do not update lifetimeWinnings for void bets
      } else if (status === 'lost' && typeof outcome === 'object' && outcome.decision === 'half_loss') {
        // Refund half stake for half-loss scenarios
        await User.settleBetWin(bet.userId, actualWin)
      }

      try { bus.emit('bets:changed') } catch (e) {}

      try {
        bus.emit('bets:update', {
          userId: String(bet.userId),
          betId: String(bet._id),
          matchId: bet.matchId,
          status: update.status,
          actualWin: update.actualWin,
          settledAt: update.settledAt,
          homeScore,
          awayScore
        })
        if (global.websocketServer && typeof global.websocketServer.broadcastBetStatusUpdate === 'function') {
          global.websocketServer.broadcastBetStatusUpdate(
            String(bet._id),
            String(bet.userId),
            update.status,
            bet.matches || [],
            update.result
          )
        }
      } catch (emitError) {}

      logger.info(`Bet ${bet._id} settled as ${status.toUpperCase()} for match ${match.eventId}`)
      return true
    } catch (error) {
      logger.error(`Error settling bet ${bet._id}:`, error)
      return false
    }
  }

  /**
   * Settle multi-bets for a specific completed match
   */
  async settleMultiBets (match) {
    try {
      const results = this.extractResults(match)
      if (results.homeScore === null || results.awayScore === null) return 0

      const matchIds = [match.eventId]
      if (match.originalId && match.originalId !== match.eventId) {
        matchIds.push(match.originalId)
      }

      // Find pending multi-bets containing this match
      const multiBets = await MultiBet.find({
        'matches.matchId': { $in: matchIds },
        status: 'Pending'
      })

      if (multiBets.length === 0) return 0

      let settledCount = 0
      for (const mb of multiBets) {
        try {
          // Find the specific leg
          const leg = mb.matches.find(m => matchIds.includes(m.matchId))
          if (!leg || leg.status !== 'Pending') continue

          // Determine outcome (1, X, 2)
          const finalOutcome = results.homeScore > results.awayScore ? '1' : results.homeScore < results.awayScore ? '2' : 'X'

          // Determine status
          const status = leg.outcome === finalOutcome ? 'Win' : 'Loss'

          // Update the match status in the MultiBet
          // This will trigger updateOverallStatus() and save()
          await mb.updateMatchStatus(leg.matchId, status, {
            homeScore: results.homeScore,
            awayScore: results.awayScore,
            finalOutcome
          })

          // Check if the entire MultiBet is now settled (Win/Partial) and pay out if needed
          if (mb.status === 'Win' || mb.status === 'Partial') {
            const payout = mb.potentialPayout
            if (payout > 0) {
              await User.settleBetWin(mb.userId, payout)
              await User.findByIdAndUpdate(mb.userId, {
                $inc: { lifetimeWinnings: payout - mb.stake }
              })
              logger.info(`MultiBet ${mb._id} settled as ${mb.status} - Payout: ${payout}`)
            }
          }

          settledCount++
        } catch (err) {
          logger.error(`Error settling multi-bet ${mb._id}:`, err)
        }
      }
      return settledCount
    } catch (error) {
      logger.error(`Error settling multi-bets for match ${match.eventId}:`, error)
      return 0
    }
  }

  // --- Evaluation Helper Functions ---

  evaluateMatchWinnerBet (selection, homeScore, awayScore, match) {
    const sel = selection.toLowerCase()
    if (sel.includes('home') || sel === '1') return homeScore > awayScore
    if (sel.includes('away') || sel === '2') return awayScore > homeScore
    if (sel.includes('draw') || sel === 'x') return homeScore === awayScore

    if (match) {
      const homeTeam = match.homeTeam || match.home_team
      const awayTeam = match.awayTeam || match.away_team
      if (homeTeam && sel.includes(homeTeam.toLowerCase())) return homeScore > awayScore
      if (awayTeam && sel.includes(awayTeam.toLowerCase())) return awayScore > homeScore
    }
    return false
  }

  evaluateDoubleChanceBet (selection, homeScore, awayScore) {
    // 1X (Home or Draw), X2 (Draw or Away), 12 (Home or Away)
    const sel = selection.toUpperCase()
    if (sel === '1X' || sel.includes('HOME/DRAW')) return homeScore >= awayScore
    if (sel === 'X2' || sel.includes('DRAW/AWAY')) return awayScore >= homeScore
    if (sel === '12' || sel.includes('HOME/AWAY')) return homeScore !== awayScore
    return false
  }

  evaluateBTTSBet (selection, homeScore, awayScore) {
    const sel = selection.toLowerCase()
    const bothScored = homeScore > 0 && awayScore > 0
    if (sel === 'yes' || sel.includes('yes')) return bothScored
    if (sel === 'no' || sel.includes('no')) return !bothScored
    return false
  }

  evaluateHandicapBet (selection, homeScore, awayScore) {
    const handicapMatch = selection.match(/([+-]?\d*\.?\d+)/)
    if (!handicapMatch) return false
    const handicap = parseFloat(handicapMatch[1])
    const sel = selection.toLowerCase()

    let adjustedHomeScore = homeScore
    let adjustedAwayScore = awayScore

    if (sel.includes('home')) {
      adjustedHomeScore += handicap
    } else if (sel.includes('away')) {
      adjustedAwayScore += handicap
    } else {
      return false
    }

    if (adjustedHomeScore > adjustedAwayScore) return sel.includes('home')
    if (adjustedAwayScore > adjustedHomeScore) return sel.includes('away')

    return 'void'
  }

  // Asian Handicap with quarter-line support: returns rich outcome object
  evaluateAsianHandicapOutcome (selection, homeScore, awayScore) {
    const m = selection.match(/([+-]?\d*\.?\d+)/)
    if (!m) return null
    const h = parseFloat(m[1])
    const sel = selection.toLowerCase()
    const isHome = sel.includes('home')
    const isAway = sel.includes('away')
    if (!isHome && !isAway) return null
    const base = Math.floor(Math.abs(h))
    const frac = Math.abs(h) - base
    const sign = h >= 0 ? 1 : -1
    const signH = sign * (base + frac)

    // Helper to evaluate a single line
    const evalLine = (line) => {
      const adjHome = homeScore + (isHome ? line : 0)
      const adjAway = awayScore + (isAway ? line : 0)
      if (adjHome > adjAway) return 'win'
      if (adjHome < adjAway) return 'loss'
      return 'push'
    }

    if (frac === 0.25 || frac === 0.75) {
      const low = sign * (base + (frac === 0.25 ? 0.0 : 0.5))
      const high = sign * (base + (frac === 0.25 ? 0.5 : 1.0))
      const r1 = evalLine(low)
      const r2 = evalLine(high)
      if (r1 === 'win' && r2 === 'win') return { decision: 'win', payoutFactor: 1, rule: `Asian Handicap ${signH} (full win)` }
      if ((r1 === 'win' && r2 === 'push') || (r1 === 'push' && r2 === 'win')) return { decision: 'half_win', payoutFactor: 0.5, rule: `Asian Handicap ${signH} (half win)` }
      if ((r1 === 'loss' && r2 === 'push') || (r1 === 'push' && r2 === 'loss')) return { decision: 'half_loss', payoutFactor: 0.5, rule: `Asian Handicap ${signH} (half loss)` }
      if (r1 === 'push' && r2 === 'push') return { decision: 'void', payoutFactor: 1, rule: `Asian Handicap ${signH} (push)` }
      return { decision: 'loss', payoutFactor: 0, rule: `Asian Handicap ${signH} (loss)` }
    }

    if (frac === 0.0) {
      const res = evalLine(signH)
      if (res === 'win') return { decision: 'win', payoutFactor: 1, rule: `Asian Handicap ${signH} (win)` }
      if (res === 'loss') return { decision: 'loss', payoutFactor: 0, rule: `Asian Handicap ${signH} (loss)` }
      return { decision: 'void', payoutFactor: 1, rule: `Asian Handicap ${signH} (push)` }
    }

    if (frac === 0.5) {
      const res = evalLine(signH)
      if (res === 'win') return { decision: 'win', payoutFactor: 1, rule: `Asian Handicap ${signH} (win)` }
      return { decision: 'loss', payoutFactor: 0, rule: `Asian Handicap ${signH} (loss)` }
    }

    return null
  }

  // Asian Totals with quarter-line support: returns rich outcome object
  evaluateAsianTotalsOutcome (selection, homeScore, awayScore) {
    const totalMatch = selection.match(/(\d*\.?\d+)/)
    if (!totalMatch) return null
    const point = parseFloat(totalMatch[1])
    const total = homeScore + awayScore
    const sel = selection.toLowerCase()
    const isOver = sel.includes('over')
    const isUnder = sel.includes('under')
    if (!isOver && !isUnder) return null
    const base = Math.floor(point)
    const frac = point - base

    // Split-lines approach for quarter-lines
    if (frac === 0.25 || frac === 0.75) {
      const low = base + (frac === 0.25 ? 0.0 : 0.5)
      const high = base + (frac === 0.25 ? 0.5 : 1.0)
      const evalLine = (line) => {
        if (isOver) {
          if (total > line) return 'win'
          if (total === line) return 'push'
          return 'loss'
        } else {
          if (total < line) return 'win'
          if (total === line) return 'push'
          return 'loss'
        }
      }
      const r1 = evalLine(low)
      const r2 = evalLine(high)
      if (r1 === 'win' && r2 === 'win') return { decision: 'win', payoutFactor: 1, rule: `Asian Totals ${point} (full win)` }
      if ((r1 === 'win' && r2 === 'push') || (r1 === 'push' && r2 === 'win')) return { decision: 'half_win', payoutFactor: 0.5, rule: `Asian Totals ${point} (half win)` }
      if ((r1 === 'loss' && r2 === 'push') || (r1 === 'push' && r2 === 'loss')) return { decision: 'half_loss', payoutFactor: 0.5, rule: `Asian Totals ${point} (half loss)` }
      if (r1 === 'push' && r2 === 'push') return { decision: 'void', payoutFactor: 1, rule: `Asian Totals ${point} (push)` }
      return { decision: 'loss', payoutFactor: 0, rule: `Asian Totals ${point} (loss)` }
    }

    // .0 line (push possible)
    if (frac === 0.0) {
      if (isOver) {
        if (total > point) return { decision: 'win', payoutFactor: 1, rule: `Totals ${point} (win)` }
        if (total === point) return { decision: 'void', payoutFactor: 1, rule: `Totals ${point} (push)` }
        return { decision: 'loss', payoutFactor: 0, rule: `Totals ${point} (loss)` }
      } else {
        if (total < point) return { decision: 'win', payoutFactor: 1, rule: `Totals ${point} (win)` }
        if (total === point) return { decision: 'void', payoutFactor: 1, rule: `Totals ${point} (push)` }
        return { decision: 'loss', payoutFactor: 0, rule: `Totals ${point} (loss)` }
      }
    }

    // .5 line (no push)
    if (frac === 0.5) {
      if (isOver) {
        return total > point ? { decision: 'win', payoutFactor: 1, rule: `Totals ${point} (win)` } : { decision: 'loss', payoutFactor: 0, rule: `Totals ${point} (loss)` }
      } else {
        return total < point ? { decision: 'win', payoutFactor: 1, rule: `Totals ${point} (win)` } : { decision: 'loss', payoutFactor: 0, rule: `Totals ${point} (loss)` }
      }
    }

    return null
  }

  evaluateTotalsBet (selection, homeScore, awayScore) {
    const totalMatch = selection.match(/(\d*\.?\d+)/)
    if (!totalMatch) return false
    const total = parseFloat(totalMatch[1])
    const totalScore = homeScore + awayScore
    const sel = selection.toLowerCase()

    if (totalScore === total) return 'void'

    if (sel.includes('over')) return totalScore > total
    if (sel.includes('under')) return totalScore < total
    return false
  }

  evaluateCorrectScoreBet (selection, homeScore, awayScore) {
    // Expected format "1-0", "2-1", etc.
    // Clean selection to just numbers
    const parts = selection.replace(/[^0-9-:]/g, '').split(/[-:]/)
    if (parts.length !== 2) return false
    const selHome = parseInt(parts[0])
    const selAway = parseInt(parts[1])
    return homeScore === selHome && awayScore === selAway
  }

  evaluateHTFTBet (selection, results) {
    const { homeScore, awayScore, homeScoreHT, awayScoreHT } = results
    if (homeScoreHT === null || awayScoreHT === null) return false // Cannot settle without HT scores

    const getResult = (h, a) => h > a ? '1' : h < a ? '2' : 'X'
    const htResult = getResult(homeScoreHT, awayScoreHT)
    const ftResult = getResult(homeScore, awayScore)

    // Map selection to HT/FT codes (e.g., "1/1", "X/2")
    // Selection might be "Home/Home", "Draw/Away" or "1/1"
    const mapCode = (str) => {
      str = str.toLowerCase()
      if (str.includes('home') || str === '1') return '1'
      if (str.includes('away') || str === '2') return '2'
      if (str.includes('draw') || str === 'x') return 'X'
      return ''
    }

    const parts = selection.split('/')
    if (parts.length !== 2) return false
    const selHT = mapCode(parts[0])
    const selFT = mapCode(parts[1])

    return htResult === selHT && ftResult === selFT
  }

  evaluateCornersBet (selection, results) {
    const { homeCorners, awayCorners } = results
    if (homeCorners === null || awayCorners === null) return false
    const totalCorners = homeCorners + awayCorners

    // Check for Over/Under
    const totalMatch = selection.match(/(\d+\.?\d*)/)
    if (totalMatch) {
      const total = parseFloat(totalMatch[1])
      const sel = selection.toLowerCase()
      if (sel.includes('over')) return totalCorners > total
      if (sel.includes('under')) return totalCorners < total
    }
    return false
  }

  evaluateCardsBet (selection, results) {
    const { homeCards, awayCards } = results
    if (homeCards === null || awayCards === null) return false
    const totalCards = homeCards + awayCards

    const totalMatch = selection.match(/(\d+\.?\d*)/)
    if (totalMatch) {
      const total = parseFloat(totalMatch[1])
      const sel = selection.toLowerCase()
      if (sel.includes('over')) return totalCards > total
      if (sel.includes('under')) return totalCards < total
    }
    return false
  }

  evaluateGoalscorerBet (selection, market, results) {
    const { firstGoalscorer, anytimeGoalscorers, lastGoalscorer } = results
    const sel = selection.toLowerCase()

    if (market.includes('first')) {
      return firstGoalscorer && firstGoalscorer.toLowerCase().includes(sel)
    }
    if (market.includes('last')) {
      return lastGoalscorer && lastGoalscorer.toLowerCase().includes(sel)
    }
    if (market.includes('anytime')) {
      // Check if goalscorer list string contains name, or check first/last as fallback
      const allScorers = (anytimeGoalscorers || '') + ',' + (firstGoalscorer || '') + ',' + (lastGoalscorer || '')
      return allScorers.toLowerCase().includes(sel)
    }
    return false
  }

  evaluateOddEvenBet (selection, homeScore, awayScore) {
    const total = homeScore + awayScore
    const isOdd = total % 2 !== 0
    const sel = selection.toLowerCase()
    if (sel === 'odd') return isOdd
    if (sel === 'even') return !isOdd
    return false
  }

  evaluateMultiGoalsBet (selection, homeScore, awayScore) {
    // Format "1-3 Goals", "4+ Goals"
    const total = homeScore + awayScore
    const rangeMatch = selection.match(/(\d+)-(\d+)/)
    if (rangeMatch) {
      const min = parseInt(rangeMatch[1])
      const max = parseInt(rangeMatch[2])
      return total >= min && total <= max
    }
    if (selection.includes('+')) {
      const minMatch = selection.match(/(\d+)\+/)
      if (minMatch) {
        const min = parseInt(minMatch[1])
        return total >= min
      }
    }
    return false
  }

  evaluateWinningMarginBet (selection, homeScore, awayScore, match) {
    const diff = homeScore - awayScore
    const sel = selection.toLowerCase()

    // Exact margin: "Home by 1", "Away by 2", "Draw" (margin 0)
    if (sel.includes('draw') || sel === '0') return diff === 0

    const marginMatch = selection.match(/(\d+)/)
    if (!marginMatch) return false
    const margin = parseInt(marginMatch[1])

    if (sel.includes('home') || (match && sel.includes(match.homeTeam.toLowerCase()))) {
      return diff === margin
    }
    if (sel.includes('away') || (match && sel.includes(match.awayTeam.toLowerCase()))) {
      return diff === -margin
    }
    return false
  }

  evaluatePenaltyBet (selection, results) {
    const { penaltyAwarded } = results
    const sel = selection.toLowerCase()
    if (sel === 'yes') return penaltyAwarded === true
    if (sel === 'no') return penaltyAwarded === false
    return false
  }
}

module.exports = new BetSettlementService()
