#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🚀 Platypus Sports Betting - Environment Setup\n');

// Check if .env already exists
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  console.log('⚠️  .env file already exists!');
  rl.question('Do you want to overwrite it? (y/N): ', (answer) => {
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      createEnvFile();
    } else {
      console.log('Setup cancelled.');
      rl.close();
    }
  });
} else {
  createEnvFile();
}

function createEnvFile() {
  console.log('\n📝 Creating .env file...\n');
  
  const envContent = `# Server Configuration
PORT=5000
NODE_ENV=development
LOG_LEVEL=info

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/ween_sports_betting

# JWT Configuration
JWT_SECRET=${generateRandomString(32)}

# Frontend Configuration
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:5000

# Odds API Configuration
ODDS_API_KEY=your-odds-api-key-here
ODDS_API_BASE_URL=https://api.the-odds-api.com/v4
ODDS_API_TIMEOUT=10000

# NowPayments Configuration
NOWPAYMENTS_API_URL=https://api.nowpayments.io
NOWPAYMENTS_SANDBOX_API_URL=https://api.sandbox.nowpayments.io
NOWPAYMENTS_API_KEY=your-nowpayments-api-key-here
NOWPAYMENTS_SANDBOX_API_KEY=your-nowpayments-sandbox-api-key-here
NOWPAYMENTS_IPN_SECRET=${generateRandomString(32)}
NOWPAYMENTS_CALLBACK_URL=http://localhost:5000/api/payments/callback

# Feature Flags
USE_MOCK_PAYMENTS=false

# Cron Job Configuration
CRON_ENABLED=true
CRON_ODDS_FETCH_INTERVAL=*/15 * * * *
CRON_CLEANUP_INTERVAL=0 2 * * *

# CORS Configuration (comma-separated for multiple origins)
# FRONTEND_URL=http://localhost:3000,https://yourdomain.com

# Additional Configuration
# Uncomment and set these if you need custom values
# SESSION_SECRET=${generateRandomString(32)}
# COOKIE_SECRET=${generateRandomString(32)}
`;

  try {
    fs.writeFileSync(envPath, envContent);
    console.log('✅ .env file created successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Edit the .env file with your actual API keys');
    console.log('2. Get your Odds API key from: https://the-odds-api.com');
    console.log('3. Get your NowPayments keys from: https://nowpayments.io');
    console.log('4. Update MongoDB URI if using a different database');
    console.log('\n📖 See ENVIRONMENT_SETUP.md for detailed instructions');
  } catch (error) {
    console.error('❌ Error creating .env file:', error.message);
  }
  
  rl.close();
}

function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
