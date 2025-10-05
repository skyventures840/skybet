const { MongoClient } = require('mongodb');
// Logger removed during cleanup - using console for now
const config = require('../config/config');

const MONGODB_URI = config.mongoURI;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is not configured in environment variables');
}
const DB_NAME = process.env.MONGODB_DB_NAME || 'platypus';
const COLLECTION_NAME = 'matches';

async function connectToMongo() {
  const client = new MongoClient(MONGODB_URI, {
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 30000,
    connectTimeoutMS: 30000
  });
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    const collection = client.db(DB_NAME).collection(COLLECTION_NAME);
    return { client, collection }; // Return both client and collection
  } catch (error) {
          console.error('MongoDB connection error:', error);
    throw error;
  }
}

async function saveMatchesToDB(collection, matches) {
  try {
    if (!matches || matches.length === 0) {
      console.log('No matches to save');
      return;
    }

    const bulkOps = matches.map(match => ({
      updateOne: {
        filter: { externalId: match.externalId || match.id }, // Use externalId if available, otherwise fallback to id
        update: { $set: match },
        upsert: true
      }
    }));

    const result = await collection.bulkWrite(bulkOps, { ordered: false });
          console.log(`Saved ${matches.length} matches to the database. Upserted: ${result.upsertedCount}, Modified: ${result.modifiedCount}`);
  } catch (error) {
          console.error('Error saving matches to database:', error);
    throw error;
  }
}

module.exports = {
  connectToMongo,
  saveMatchesToDB,
};