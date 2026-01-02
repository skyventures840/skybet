require('dotenv').config()
const mongoose = require('mongoose')
const Odds = require('../models/Odds')

async function clearDatabase () {
  try {
    console.log('🗑️ Clearing database...')

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('✅ Connected to MongoDB')

    // Clear odds data
    const result = await Odds.deleteMany({})
    console.log(`✅ Deleted ${result.deletedCount} odds records`)

    // Disconnect
    await mongoose.disconnect()
    console.log('✅ Database cleared successfully')
  } catch (error) {
    console.error('❌ Error clearing database:', error.message)
    process.exit(1)
  }
}

clearDatabase()
