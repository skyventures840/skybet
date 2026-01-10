require('dotenv').config()
const mongoose = require('mongoose')
const User = require('../models/User')
const Bet = require('../models/Bet')
const MultiBet = require('../models/MultiBet')
const Results = require('../models/Results')
const Scores = require('../models/Scores')
const Odds = require('../models/Odds')
const { OddsApiService } = require('../services/oddsApiService')
const Match = require('../models/Match')
const betSettlementService = require('../services/betSettlementService')

const args = process.argv.slice(2)
const userArgIndex = args.indexOf('--user')
const identifier = userArgIndex !== -1 ? args[userArgIndex + 1] : 'skyventures'
const dryRun = args.includes('--dryRun')
const allMode = args.includes('--all')

function extractScoresFromResult (result) {
  let homeScore = null
  let awayScore = null
  if (result && Array.isArray(result.scores)) {
    const homeScoreData = result.scores.find(s => s.name === result.home_team)
    const awayScoreData = result.scores.find(s => s.name === result.away_team)
    if (homeScoreData && awayScoreData) {
      homeScore = (homeScoreData.score != null && homeScoreData.score !== '') ? parseInt(homeScoreData.score) : null
      awayScore = (awayScoreData.score != null && awayScoreData.score !== '') ? parseInt(awayScoreData.score) : null
    } else if (result.scores.length >= 2) {
      const hs = result.scores[0]?.score
      const as = result.scores[1]?.score
      homeScore = (hs != null && hs !== '') ? parseInt(hs) : null
      awayScore = (as != null && as !== '') ? parseInt(as) : null
    }
  }
  return { homeScore, awayScore }
}

async function findMatchingResult (bet) {
  const byId = await Results.findOne({ eventId: bet.matchId, completed: true })
  if (byId) return byId
  const home = bet.homeTeam ? new RegExp(bet.homeTeam, 'i') : undefined
  const away = bet.awayTeam ? new RegExp(bet.awayTeam, 'i') : undefined
  if (home && away) {
    const byTeams = await Results.findOne({ completed: true, home_team: home, away_team: away })
    if (byTeams) return byTeams
  }
  return null
}

async function ensureResultFetchedForBet (bet) {
  try {
    const oddsDoc = await Odds.findOne({ gameId: bet.matchId })
    if (!oddsDoc || !oddsDoc.sport_key) return false
    const service = new OddsApiService()
    if (!service.isEnabled) return false
    const results = await service.getResults(oddsDoc.sport_key, 7)
    return Array.isArray(results) && results.length > 0
  } catch (e) {
    return false
  }
}

async function findMatchingScore (bet) {
  const byId = await Scores.findOne({ eventId: bet.matchId, completed: true })
  if (byId) return byId
  const home = bet.homeTeam ? new RegExp(bet.homeTeam, 'i') : undefined
  const away = bet.awayTeam ? new RegExp(bet.awayTeam, 'i') : undefined
  if (home && away) {
    const byTeams = await Scores.findOne({ completed: true, home_team: home, away_team: away })
    if (byTeams) return byTeams
  }
  return null
}

async function findDbCustomScores (matchId) {
  try {
    let matchDoc = null
    if (mongoose.isValidObjectId(matchId)) {
      matchDoc = await Match.findById(matchId).lean()
    }
    if (!matchDoc) {
      matchDoc = await Match.findOne({ externalId: matchId }).lean()
    }
    if (!matchDoc) return null
    const pr = matchDoc.predeterminedResult || {}
    const hs = pr.homeScore != null ? pr.homeScore : matchDoc.homeScore
    const as = pr.awayScore != null ? pr.awayScore : matchDoc.awayScore
    if (hs != null && as != null) {
      return {
        homeScore: Number(hs),
        awayScore: Number(as),
        homeTeam: matchDoc.homeTeam,
        awayTeam: matchDoc.awayTeam,
        eventId: matchDoc.externalId || String(matchDoc._id)
      }
    }
    return null
  } catch (e) {
    return null
  }
}

async function pushToBetslip (userId, eventId, homeScore, awayScore) {
  const finalOutcome = homeScore > awayScore ? '1' : homeScore < awayScore ? '2' : 'X'
  if (dryRun) return
  const multiBets = await MultiBet.find({ userId, 'matches.matchId': eventId })
  for (const mb of multiBets) {
    let changed = false
    mb.matches = (mb.matches || []).map(m => {
      if (String(m.matchId) === String(eventId)) {
        const status = m.outcome === finalOutcome ? 'Win' : 'Loss'
        changed = true
        return {
          ...m,
          matchStatus: 'Finished',
          status,
          result: { homeScore, awayScore, finalOutcome }
        }
      }
      return m
    })
    if (changed) {
      mb.updateOverallStatus()
      await mb.save()
    }
  }
  const betsWithLegs = await Bet.find({ userId, 'matches.matchId': eventId })
  for (const b of betsWithLegs) {
    let changed = false
    b.matches = (b.matches || []).map(m => {
      if (String(m.matchId) === String(eventId)) {
        const status = m.selection && m.selection.toLowerCase().includes('home')
          ? (homeScore > awayScore ? 'won' : 'lost')
          : m.selection && m.selection.toLowerCase().includes('away')
            ? (awayScore > homeScore ? 'won' : 'lost')
            : (finalOutcome === 'X' ? 'won' : 'lost')
        changed = true
        return {
          ...m,
          status,
          outcome: finalOutcome
        }
      }
      return m
    })
    if (changed) {
      await b.save()
    }
  }
}

async function run () {
  try {
    await mongoose.connect(process.env.MONGODB_EXTERNAL_URI || process.env.MONGODB_URI)
    const user = allMode ? null : await User.findByUsernameOrEmail(identifier)
    if (!allMode && !user) {
      console.log('User not found:', identifier)
      process.exit(1)
    }

    const pendingBets = allMode ? await Bet.find({ status: 'pending' }) : await Bet.find({ userId: user._id, status: 'pending' })
    let checked = 0
    let withResults = 0
    let settled = 0
    let pushedLegs = 0
    let updatedMultibets = 0

    for (const bet of pendingBets) {
      checked++
      const legs = Array.isArray(bet.matches) ? bet.matches : []
      if (legs.length === 0) {
        const result = await findMatchingResult(bet)
        let finalResult = result
        if (!finalResult) {
          const fetched = await ensureResultFetchedForBet(bet)
          if (fetched) {
            finalResult = await findMatchingResult(bet)
          }
        }
        if (!finalResult) {
          const scoreDoc = await findMatchingScore(bet)
          if (!scoreDoc) {
            const dbScores = await findDbCustomScores(bet.matchId)
            if (!dbScores) continue
            await pushToBetslip(bet.userId, dbScores.eventId, dbScores.homeScore, dbScores.awayScore)
            pushedLegs++
            const mbs2a = await MultiBet.find({ userId: bet.userId, 'matches.matchId': dbScores.eventId })
            if (mbs2a.length > 0) updatedMultibets += mbs2a.length
            if (!dryRun) {
              const matchMeta = { eventId: dbScores.eventId, homeTeam: dbScores.homeTeam, awayTeam: dbScores.awayTeam }
              const ok = await betSettlementService.settleSingleBet(bet, { homeScore: dbScores.homeScore, awayScore: dbScores.awayScore }, matchMeta)
              if (ok) settled++
            }
            continue
          }
          const { homeScore, awayScore } = extractScoresFromResult({
            scores: scoreDoc.scores,
            home_team: scoreDoc.home_team,
            away_team: scoreDoc.away_team
          })
          if (homeScore === null || awayScore === null) {
            const dbScores2 = await findDbCustomScores(bet.matchId)
            if (!dbScores2) continue
            await pushToBetslip(bet.userId, dbScores2.eventId, dbScores2.homeScore, dbScores2.awayScore)
            pushedLegs++
            const mbs2b = await MultiBet.find({ userId: bet.userId, 'matches.matchId': dbScores2.eventId })
            if (mbs2b.length > 0) updatedMultibets += mbs2b.length
            if (!dryRun) {
              const matchMeta = { eventId: dbScores2.eventId, homeTeam: dbScores2.homeTeam, awayTeam: dbScores2.awayTeam }
              const ok = await betSettlementService.settleSingleBet(bet, { homeScore: dbScores2.homeScore, awayScore: dbScores2.awayScore }, matchMeta)
              if (ok) settled++
            }
            continue
          }
          await pushToBetslip(bet.userId, scoreDoc.eventId, homeScore, awayScore)
          pushedLegs++
          const mbs2 = await MultiBet.find({ userId: bet.userId, 'matches.matchId': scoreDoc.eventId })
          if (mbs2.length > 0) updatedMultibets += mbs2.length
          if (!dryRun) {
            const matchMeta = { eventId: scoreDoc.eventId, homeTeam: scoreDoc.home_team, awayTeam: scoreDoc.away_team }
            const ok = await betSettlementService.settleSingleBet(bet, { homeScore, awayScore }, matchMeta)
            if (ok) settled++
          }
          continue
        }
        withResults++
        const { homeScore, awayScore } = extractScoresFromResult(finalResult)
        if (homeScore === null || awayScore === null) {
          const dbScores3 = await findDbCustomScores(bet.matchId)
          if (!dbScores3) continue
          await pushToBetslip(bet.userId, dbScores3.eventId, dbScores3.homeScore, dbScores3.awayScore)
          pushedLegs++
          const mbs3a = await MultiBet.find({ userId: bet.userId, 'matches.matchId': dbScores3.eventId })
          if (mbs3a.length > 0) updatedMultibets += mbs3a.length
          if (!dryRun) {
            const matchMeta = { eventId: dbScores3.eventId, homeTeam: dbScores3.homeTeam, awayTeam: dbScores3.awayTeam }
            const ok = await betSettlementService.settleSingleBet(bet, { homeScore: dbScores3.homeScore, awayScore: dbScores3.awayScore }, matchMeta)
            if (ok) settled++
          }
          continue
        }
        await pushToBetslip(bet.userId, finalResult.eventId, homeScore, awayScore)
        pushedLegs++
        const mbs = await MultiBet.find({ userId: bet.userId, 'matches.matchId': finalResult.eventId })
        if (mbs.length > 0) updatedMultibets += mbs.length
        if (!dryRun) {
          const matchMeta = { eventId: finalResult.eventId, homeTeam: finalResult.home_team, awayTeam: finalResult.away_team }
          const ok = await betSettlementService.settleSingleBet(bet, { homeScore, awayScore }, matchMeta)
          if (ok) settled++
        }
      } else {
        for (const leg of legs) {
          const legResult = await Results.findOne({ eventId: leg.matchId, completed: true })
          let finalLegResult = legResult
          if (!finalLegResult) {
            const fetchedLeg = await ensureResultFetchedForBet({ matchId: leg.matchId, homeTeam: leg.homeTeam, awayTeam: leg.awayTeam })
            if (fetchedLeg) {
              finalLegResult = await Results.findOne({ eventId: leg.matchId, completed: true })
            }
          }
          if (!finalLegResult) {
            const scoreDocLeg = await Scores.findOne({ eventId: leg.matchId, completed: true })
            if (!scoreDocLeg) {
              const dbScoresLeg = await findDbCustomScores(leg.matchId)
              if (!dbScoresLeg) continue
              await pushToBetslip(bet.userId, dbScoresLeg.eventId, dbScoresLeg.homeScore, dbScoresLeg.awayScore)
              pushedLegs++
              const mbs3a = await MultiBet.find({ userId: bet.userId, 'matches.matchId': dbScoresLeg.eventId })
              if (mbs3a.length > 0) updatedMultibets += mbs3a.length
            } else {
              const { homeScore, awayScore } = extractScoresFromResult({
                scores: scoreDocLeg.scores,
                home_team: scoreDocLeg.home_team,
                away_team: scoreDocLeg.away_team
              })
              if (homeScore === null || awayScore === null) {
                const dbScoresLeg2 = await findDbCustomScores(leg.matchId)
                if (!dbScoresLeg2) continue
                await pushToBetslip(bet.userId, dbScoresLeg2.eventId, dbScoresLeg2.homeScore, dbScoresLeg2.awayScore)
                pushedLegs++
                const mbs3b = await MultiBet.find({ userId: bet.userId, 'matches.matchId': dbScoresLeg2.eventId })
                if (mbs3b.length > 0) updatedMultibets += mbs3b.length
              } else {
                await pushToBetslip(bet.userId, scoreDocLeg.eventId, homeScore, awayScore)
                pushedLegs++
                const mbs3 = await MultiBet.find({ userId: bet.userId, 'matches.matchId': scoreDocLeg.eventId })
                if (mbs3.length > 0) updatedMultibets += mbs3.length
              }
            }
          } else {
            withResults++
            const { homeScore, awayScore } = extractScoresFromResult(finalLegResult)
            if (homeScore === null || awayScore === null) {
              const dbScoresLeg3 = await findDbCustomScores(leg.matchId)
              if (!dbScoresLeg3) continue
              await pushToBetslip(bet.userId, dbScoresLeg3.eventId, dbScoresLeg3.homeScore, dbScoresLeg3.awayScore)
              pushedLegs++
              const mbs4a = await MultiBet.find({ userId: bet.userId, 'matches.matchId': dbScoresLeg3.eventId })
              if (mbs4a.length > 0) updatedMultibets += mbs4a.length
            } else {
              await pushToBetslip(bet.userId, finalLegResult.eventId, homeScore, awayScore)
              pushedLegs++
              const mbs4 = await MultiBet.find({ userId: bet.userId, 'matches.matchId': finalLegResult.eventId })
              if (mbs4.length > 0) updatedMultibets += mbs4.length
            }
          }
        }
      }
    }

    console.log('Mode', allMode ? 'ALL USERS' : String(user._id))
    console.log('Checked', checked)
    console.log('WithResults', withResults)
    console.log('PushedLegs', pushedLegs)
    console.log('UpdatedMultiBets', updatedMultibets)
    console.log('Settled', settled)
    await mongoose.disconnect()
    process.exit(0)
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }
}

run()
