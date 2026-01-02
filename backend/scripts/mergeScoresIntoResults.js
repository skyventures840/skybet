require('dotenv').config()
const mongoose = require('mongoose')
const Scores = require('../models/Scores')
const Results = require('../models/Results')

const dryRun = process.argv.includes('--dryRun')

function normalizeScores (scores) {
  return (scores || [])
    .map(s => `${s.name}:${s.score}`)
    .sort()
    .join('|')
}

function toTime (v) {
  return v ? new Date(v).getTime() : null
}

function docsEqual (a, b) {
  const fields = ['eventId', 'sport_key', 'sport_title', 'completed', 'home_team', 'away_team']
  for (const f of fields) {
    const va = a && a[f] !== undefined ? String(a[f]) : ''
    const vb = b && b[f] !== undefined ? String(b[f]) : ''
    if (va !== vb) return false
  }
  if (toTime(a.commence_time) !== toTime(b.commence_time)) return false
  if (normalizeScores(a.scores) !== normalizeScores(b.scores)) return false
  return true
}

async function run () {
  try {
    await mongoose.connect(process.env.MONGODB_EXTERNAL_URI || process.env.MONGODB_URI)
    let processed = 0
    let merged = 0
    let created = 0
    let skipped = 0

    const cursor = Scores.find({}).cursor()
    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
      processed++
      const scoreDoc = doc.toObject()
      const resDoc = await Results.findOne({ eventId: scoreDoc.eventId })
      if (!resDoc) {
        const payload = {
          eventId: scoreDoc.eventId,
          sport_key: scoreDoc.sport_key,
          sport_title: scoreDoc.sport_title,
          commence_time: scoreDoc.commence_time,
          completed: scoreDoc.completed,
          home_team: scoreDoc.home_team,
          away_team: scoreDoc.away_team,
          scores: scoreDoc.scores,
          last_update: scoreDoc.last_update,
          season: scoreDoc.season,
          week: scoreDoc.week,
          lastFetched: scoreDoc.lastFetched,
          fetchCount: scoreDoc.fetchCount
        }
        if (!dryRun) {
          await Results.create(payload)
          await Scores.deleteOne({ _id: doc._id })
        }
        created++
        continue
      }

      const resObj = resDoc.toObject()
      if (docsEqual(scoreDoc, resObj)) {
        if (!dryRun) {
          const lastUpdate = [scoreDoc.last_update, resObj.last_update]
            .filter(Boolean)
            .map(v => new Date(v).getTime())
          const maxUpdate = lastUpdate.length ? new Date(Math.max(...lastUpdate)) : new Date()
          await Results.updateOne({ _id: resDoc._id }, { $set: { last_update: maxUpdate } })
          await Scores.deleteOne({ _id: doc._id })
        }
        merged++
      } else {
        skipped++
      }
    }

    console.log(`Processed ${processed}`)
    console.log(`Merged ${merged}`)
    console.log(`Created ${created}`)
    console.log(`Skipped ${skipped}`)

    await mongoose.disconnect()
    process.exit(0)
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }
}

run()
