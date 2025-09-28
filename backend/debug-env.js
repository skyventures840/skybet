#!/usr/bin/env node

/**
 * Debug script to check environment variables in Render
 */

require('dotenv').config();

console.log('🔍 Environment Variables Debug:');
console.log('================================');

const envVars = [
  'NODE_ENV',
  'PORT', 
  'MONGODB_URI',
  'MONGODB_EXTERNAL_URI',
  'MONGODB_DB_NAME',
  'JWT_SECRET',
  'FRONTEND_URL',
  'BACKEND_URL'
];

envVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    // Hide sensitive values
    const displayValue = ['JWT_SECRET', 'MONGODB_URI', 'MONGODB_EXTERNAL_URI'].includes(varName)
      ? value.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')
      : value;
    console.log(`✅ ${varName}: ${displayValue}`);
  } else {
    console.log(`❌ ${varName}: NOT SET`);
  }
});

console.log('\n🔧 Process Info:');
console.log(`PID: ${process.pid}`);
console.log(`Platform: ${process.platform}`);
console.log(`Node Version: ${process.version}`);

console.log('\n📁 Current Directory:');
console.log(process.cwd());

console.log('\n🌐 All Environment Variables:');
Object.keys(process.env)
  .filter(key => key.includes('MONGO') || key.includes('NODE') || key.includes('RENDER'))
  .forEach(key => {
    const value = process.env[key];
    const displayValue = key.includes('SECRET') || key.includes('URI')
      ? value.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')
      : value;
    console.log(`${key}: ${displayValue}`);
  });
