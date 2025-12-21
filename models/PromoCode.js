const mongoose = require('mongoose');

const promoCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  type: { type: String, enum: ['FIRST_DEPOSIT', 'REFERRAL'], required: true },
  // Percentage bonus for FIRST_DEPOSIT (e.g., 100 for 100%)
  percent: { type: Number, default: 0 },
  // Fixed bonus amount alternative
  fixedAmount: { type: Number, default: 0 },
  // Maximum bonus cap for percentage promos
  maxBonus: { type: Number, default: 0 },
  // Minimum deposit required to activate
  minDeposit: { type: Number, default: 0 },
  // Wagering multiplier applied to awarded bonus (e.g., 5 => 5x)
  wageringMultiplier: { type: Number, default: 5 },
  // Referral bonuses (awarded to both sides as bonus funds)
  referrerBonus: { type: Number, default: 0 },
  refereeBonus: { type: Number, default: 0 },
  // One-time use per user
  oneTimePerUser: { type: Boolean, default: true },
  // Global activation flags and scheduling
  isActive: { type: Boolean, default: true },
  startsAt: { type: Date },
  endsAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

promoCodeSchema.index({ code: 1 });
promoCodeSchema.index({ type: 1, isActive: 1 });

promoCodeSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('PromoCode', promoCodeSchema);

