require('dotenv').config()
const mongoose = require('mongoose')
const PromoCode = require('../models/PromoCode')

async function run () {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/platypus'
  await mongoose.connect(uri)
  const promos = [
    { code: 'WELCOME100', type: 'FIRST_DEPOSIT', percent: 100, maxBonus: 500, minDeposit: 10, wageringMultiplier: 5, oneTimePerUser: true, isActive: true },
    { code: 'WELCOME50', type: 'FIRST_DEPOSIT', percent: 50, maxBonus: 300, minDeposit: 10, wageringMultiplier: 5, oneTimePerUser: true, isActive: true },
    { code: 'BOOST25', type: 'FIRST_DEPOSIT', fixedAmount: 25, minDeposit: 20, wageringMultiplier: 3, oneTimePerUser: true, isActive: true },
    { code: 'REF50', type: 'REFERRAL', referrerBonus: 50, refereeBonus: 50, wageringMultiplier: 3, oneTimePerUser: true, isActive: true },
    { code: 'REF25', type: 'REFERRAL', referrerBonus: 25, refereeBonus: 25, wageringMultiplier: 3, oneTimePerUser: true, isActive: true },
    { code: 'HIGHROLLER', type: 'FIRST_DEPOSIT', percent: 100, maxBonus: 1000, minDeposit: 200, wageringMultiplier: 10, oneTimePerUser: true, isActive: true },
    { code: 'BIGFRIEND', type: 'REFERRAL', referrerBonus: 100, refereeBonus: 50, wageringMultiplier: 5, oneTimePerUser: true, isActive: true }
  ]
  for (const p of promos) {
    await PromoCode.updateOne({ code: p.code }, { $set: p }, { upsert: true })
  }
  console.log('Seeded promo codes:', promos.map(p => p.code).join(', '))
  await mongoose.disconnect()
}

run().catch(err => { console.error(err); process.exit(1) })
