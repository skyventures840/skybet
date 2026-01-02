require('dotenv').config()
const mongoose = require('mongoose')
const User = require('../models/User')
const Bet = require('../models/Bet')
const Results = require('../models/Results')
const Odds = require('../models/Odds')
const betSettlementService = require('../services/betSettlementService')

const args = process.argv.slice(2)
const idx = args.indexOf('--user')
const identifier = idx !== -1 ? args[idx + 1] : 'skyventures840@gmail.com'

function decideScores (selection, homeTeam, awayTeam) {
  const sel = String(selection || '').toLowerCase()
  if (sel.includes('home') || sel === '1') return [{ name: homeTeam, score: '2' }, { name: awayTeam, score: '1' }]
  if (sel.includes('away') || sel === '2') return [{ name: homeTeam, score: '1' }, { name: awayTeam, score: '2' }]
  return [{ name: homeTeam, score: '1' }, { name: awayTeam, score: '1' }]
}

async function run () {
  try {
    await mongoose.connect(process.env.MONGODB_EXTERNAL_URI || process.env.MONGODB_URI)
    const user = await User.findByUsernameOrEmail(identifier)
    if (!user) {
      console.log('User not found')
      process.exit(1)
    }
    const bet = await Bet.findOne({ userId: user._id, status: 'pending' }).sort({ createdAt: -1 })
    if (!bet) {
      console.log('No pending bet')
      process.exit(0)
    }
    let totalSettled = 0
    if (Array.isArray(bet.matches) && bet.matches.length > 0) {
      for (const leg of bet.matches) {
        const legOdds = await Odds.findOne({ gameId: leg.matchId })
        const legHome = leg.homeTeam || (legOdds ? legOdds.home_team : null) || 'Home'
        const legAway = leg.awayTeam || (legOdds ? legOdds.away_team : null) || 'Away'
        const legSportKey = (legOdds ? legOdds.sport_key : null) || 'soccer_test'
        const legSportTitle = (legOdds ? legOdds.sport_title : null) || 'Soccer'
        const legScores = decideScores(leg.selection || bet.selection, legHome, legAway)
        await Results.updateOne(
          { eventId: leg.matchId },
          {
            $set: {
              eventId: leg.matchId,
              sport_key: legSportKey,
              sport_title: legSportTitle,
              commence_time: new Date(Date.now() - 2 * 60 * 60 * 1000),
              completed: true,
              home_team: legHome,
              away_team: legAway,
              scores: legScores,
              last_update: new Date(),
              lastFetched: new Date()
            }
          },
          { upsert: true }
        )
        const matchObj = {
          eventId: leg.matchId,
          homeTeam: legHome,
          awayTeam: legAway,
          scores: legScores,
          completed: true,
          sport_key: legSportKey
        }
        const settledCount = await betSettlementService.settleMatchBets(matchObj)
        totalSettled += settledCount
      }
    } else {
      let homeTeam = bet.homeTeam || null
      let awayTeam = bet.awayTeam || null
      let sportKey = null
      let sportTitle = null
      const oddsDoc = await Odds.findOne({ gameId: bet.matchId })
      if (oddsDoc) {
        homeTeam = homeTeam || oddsDoc.home_team
        awayTeam = awayTeam || oddsDoc.away_team
        sportKey = oddsDoc.sport_key
        sportTitle = oddsDoc.sport_title
      }
      homeTeam = homeTeam || 'Home'
      awayTeam = awayTeam || 'Away'
      sportKey = sportKey || 'soccer_test'
      sportTitle = sportTitle || 'Soccer'
      const scores = decideScores(bet.selection, homeTeam, awayTeam)
      await Results.updateOne(
        { eventId: bet.matchId },
        {
          $set: {
            eventId: bet.matchId,
            sport_key: sportKey,
            sport_title: sportTitle,
            commence_time: new Date(Date.now() - 2 * 60 * 60 * 1000),
            completed: true,
            home_team: homeTeam,
            away_team: awayTeam,
            scores,
            last_update: new Date(),
            lastFetched: new Date()
          }
        },
        { upsert: true }
      )
      const matchObj = {
        eventId: bet.matchId,
        homeTeam,
        awayTeam,
        scores,
        completed: true,
        sport_key: sportKey
      }
      const settledCount = await betSettlementService.settleMatchBets(matchObj)
      totalSettled += settledCount
    }
    const updatedBet = await Bet.findById(bet._id)
    console.log('SettledCount', totalSettled)
    console.log('BetStatus', updatedBet.status)
    console.log('ActualWin', updatedBet.actualWin)
    const legs = Array.isArray(updatedBet.matches) ? updatedBet.matches : []
    for (const leg of legs) {
      const res = leg.result ? `${leg.result.homeScore}:${leg.result.awayScore}` : 'n/a'
      const oc = leg.outcome || 'n/a'
      const st = leg.status || 'n/a'
      console.log(`Leg ${leg.matchId} -> FT ${res} | outcome ${oc} | status ${st}`)
      try {
        const rdoc = await Results.findOne({ eventId: leg.matchId })
        console.log(`  ResultDoc: ${rdoc ? 'present' : 'missing'}`)
        const mb = await require('../models/MultiBet').findOne({ userId: user._id, 'matches.matchId': leg.matchId })
        if (mb) {
          const m = (mb.matches || []).find(m => String(m.matchId) === String(leg.matchId))
          const mres = m && m.result ? `${m.result.homeScore}:${m.result.awayScore}` : 'n/a'
          console.log(`  MultiBet leg -> FT ${mres} | status ${m ? m.status : 'n/a'}`)
        }
      } catch {}
    }
    await mongoose.disconnect()
    process.exit(0)
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }
}

run()
