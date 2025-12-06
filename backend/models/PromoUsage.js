const mongoose = require('mongoose');

const promoUsageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  promoCodeId: { type: mongoose.Schema.Types.ObjectId, ref: 'PromoCode', required: true, index: true },
  code: { type: String, required: true, uppercase: true, trim: true },
  type: { type: String, enum: ['FIRST_DEPOSIT', 'REFERRAL'], required: true },
  // Optional referral linkage
  referrerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  refereeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  context: { type: String, enum: ['registration', 'deposit'], default: 'deposit' },
  amountAwarded: { type: Number, default: 0 },
  usedAt: { type: Date, default: Date.now },
  metadata: { type: mongoose.Schema.Types.Mixed }
});

promoUsageSchema.index({ userId: 1, code: 1 }, { unique: true });
promoUsageSchema.index({ referrerId: 1 });

module.exports = mongoose.model('PromoUsage', promoUsageSchema);

