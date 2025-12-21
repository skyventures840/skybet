#!/usr/bin/env node

/**
 * Environment validation script for deployment
 * This script validates that all required environment variables are set
 */

require('dotenv').config();

// Allow either MONGODB_URI or MONGODB_EXTERNAL_URI to satisfy DB requirement
const requiredEnvVars = [
  'JWT_SECRET'
];

const dbEnvVars = ['MONGODB_URI', 'MONGODB_EXTERNAL_URI'];

const optionalEnvVars = [
  'NODE_ENV',
  'PORT',
  'FRONTEND_URL',
  'BACKEND_URL',
  'ODDS_API_KEY',
  'NOWPAYMENTS_API_KEY',
  'NOWPAYMENTS_SANDBOX_API_KEY',
  'NOWPAYMENTS_IPN_SECRET',
  'NOWPAYMENTS_CALLBACK_URL',
  'LOG_LEVEL',
  'USE_MOCK_PAYMENTS',
  'CRON_ENABLED',
  'MONGODB_DB_NAME'
];

console.log('🔍 Validating environment variables...\n');

let hasErrors = false;

// Check required environment variables
console.log('📋 Required environment variables:');

// DB requirement: at least one of the DB URI vars must be set
const hasMongoPrimary = !!process.env.MONGODB_URI;
const hasMongoExternal = !!process.env.MONGODB_EXTERNAL_URI;
if (!hasMongoPrimary && !hasMongoExternal) {
  console.log('❌ MONGODB_URI or MONGODB_EXTERNAL_URI: NOT SET');
  hasErrors = true;
} else {
  const chosen = hasMongoPrimary ? 'MONGODB_URI' : 'MONGODB_EXTERNAL_URI';
  console.log(`✅ ${chosen}: ***SET***`);
}

// JWT requirement
requiredEnvVars.forEach(varName => {
  const value = process.env[varName];
  if (!value) {
    console.log(`❌ ${varName}: NOT SET`);
    hasErrors = true;
  } else {
    const displayValue = '***SET***';
    console.log(`✅ ${varName}: ${displayValue}`);
  }
});

console.log('\n📋 Optional environment variables:');
optionalEnvVars.forEach(varName => {
  const value = process.env[varName];
  if (!value) {
    console.log(`⚠️  ${varName}: NOT SET (using default)`);
  } else {
    const displayValue = ['NOWPAYMENTS_API_KEY', 'NOWPAYMENTS_SANDBOX_API_KEY', 'NOWPAYMENTS_IPN_SECRET'].includes(varName)
      ? '***SET***'
      : value;
    console.log(`✅ ${varName}: ${displayValue}`);
  }
});

console.log('\n🔧 Environment configuration:');
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`PORT: ${process.env.PORT || '10000'}`);
console.log(`MongoDB URI configured: ${hasMongoPrimary || hasMongoExternal ? 'Yes' : 'No'}`);

if (hasErrors) {
  console.log('\n❌ Environment validation failed!');
  console.log('Please set all required environment variables before starting the application.');
  process.exit(1);
} else {
  console.log('\n✅ Environment validation passed!');
  process.exit(0);
}
