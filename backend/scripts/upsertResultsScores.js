#!/usr/bin/env node
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') })
const mongoose = require('mongoose')
const Results = require('../models/Results')
const Scores = require('../models/Scores')
const Odds = require('../models/Odds')

async function main () {
  const gameId = process.argv[2]
  const homeScoreArg = process.argv[3]
  const awayScoreArg = process.argv[4]
  if (!gameId || homeScoreArg == null || awayScoreArg == null) {
    console.error('Usage: node scripts/upsertResultsScores.js <gameId> <homeScore> <awayScore>')
    process.exit(1)
  }

  const mongoUri = process.env.MONGODB_URI || process.env.MONGODB_EXTERNAL_URI
  if (!mongoUri) {
    console.error('Missing MONGODB_URI or MONGODB_EXTERNAL_URI')
    process.exit(1)
  }

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 })

  try {
    const odds = await Odds.findOne({ gameId }).lean()
    if (!odds) {
      console.error(`No Odds found for gameId ${gameId}`)
      process.exit(2)
    }

    const homeTeam = odds.home_team
    const awayTeam = odds.away_team
    const sportKey = odds.sport_key || 'soccer'
    const sportTitle = odds.sport_title || 'Football'
    const commenceTime = odds.commence_time || new Date()
    const homeScore = String(homeScoreArg)
    const awayScore = String(awayScoreArg)

    const scoresArray = [
      { name: homeTeam, score: homeScore },
      { name: awayTeam, score: awayScore }
    ]

    // Upsert Results
    const resDoc = await Results.findOneAndUpdate(
      { eventId: gameId },
      {
        eventId: gameId,
        sport_key: sportKey,
        sport_title: sportTitle,
        commence_time: commenceTime,
        completed: true,
        home_team: homeTeam,
        away_team: awayTeam,
        scores: scoresArray,
        last_update: new Date()
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    // Upsert Scores
    const scoreDoc = await Scores.findOneAndUpdate(
      { eventId: gameId },
      {
        eventId: gameId,
        sport_key: sportKey,
        sport_title: sportTitle,
        commence_time: commenceTime,
        completed: true,
        home_team: homeTeam,
        away_team: awayTeam,
        scores: scoresArray,
        last_update: new Date(),
        status: 'completed'
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    console.log(JSON.stringify({ success: true, results: resDoc, scores: scoreDoc }, null, 2))
    process.exit(0)
  } catch (error) {
    console.error('Upsert error:', error && error.message ? error.message : error)
    process.exit(1)
  } finally {
    try { await mongoose.disconnect() } catch (_) {}
  }
}

main()
