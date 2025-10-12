// Ensure we load the root .env and override any pre-set vars
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), override: true });
const mongoose = require('mongoose');
const startCronJobs = require('./cron');

// Connect to MongoDB
if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI environment variable is required');
  process.exit(1);
}

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('Connected to MongoDB');
  
  // Start cron jobs
  startCronJobs();
  
  console.log('Cron jobs started successfully');
  
  // Keep the process running
  process.on('SIGINT', () => {
    console.log('Shutting down cron jobs...');
    mongoose.connection.close(() => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
  
  process.on('SIGTERM', () => {
    console.log('Shutting down cron jobs...');
    mongoose.connection.close(() => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
})
.catch((err) => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});
