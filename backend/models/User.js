const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  firstName: { type: String },
  lastName: { type: String },
  phoneNumber: { type: String },
  address: { type: String },
  // Real and bonus wallets tracked separately
  balanceReal: { type: Number, default: 0 },
  balanceBonus: { type: Number, default: 0 },
  // Backward-compatible aggregate balance for legacy reads
  balance: { type: Number, default: 0 },
  // Wagering requirement tracking for bonus funds
  wageringRequired: { type: Number, default: 0 },
  wageringProgress: { type: Number, default: 0 },
  // First-deposit flags and timestamps
  hasDeposited: { type: Boolean, default: false },
  firstDepositAt: { type: Date },
  // Referral metadata
  referralCode: { type: String, unique: true, sparse: true },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lifetimeWinnings: { type: Number, default: 0 },
  isBlocked: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  isBanned: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
  lastActivity: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  resetOtp: { type: String },
  resetOtpExpires: { type: Date }
});

// Add indexes for better query performance
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });
userSchema.index({ isAdmin: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ isBlocked: 1 });
userSchema.index({ isBanned: 1 });
userSchema.index({ lastActivity: 1 });
userSchema.index({ createdAt: 1 });
userSchema.index({ referralCode: 1 });

// Compound indexes for common query patterns
userSchema.index({ isActive: 1, isBlocked: 1, isBanned: 1 }); // User status checks
userSchema.index({ isAdmin: 1, isActive: 1 }); // Admin user queries
userSchema.index({ lastActivity: 1, isActive: 1 }); // Active user tracking

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Update timestamp on save
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  // Keep legacy balance in sync
  if (typeof this.balanceReal === 'number' && typeof this.balanceBonus === 'number') {
    this.balance = Number(this.balanceReal) + Number(this.balanceBonus);
  }
  next();
});

// Instance method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Static method to find by username or email
userSchema.statics.findByUsernameOrEmail = function(identifier) {
  return this.findOne({
    $or: [
      { username: identifier },
      { email: identifier }
    ]
  });
};

// Static method to update user balance
// Credit real wallet and keep aggregate balance in sync
userSchema.statics.creditReal = async function(userId, amount) {
  if (amount <= 0) throw new Error('Amount must be positive');
  const user = await this.findById(userId);
  if (!user) throw new Error('User not found');
  const nextReal = Number(user.balanceReal || 0) + Number(amount);
  const nextBonus = Number(user.balanceBonus || 0);
  return this.findByIdAndUpdate(
    userId,
    {
      $set: {
        balanceReal: nextReal,
        balance: nextReal + nextBonus,
        updatedAt: Date.now()
      }
    },
    { new: true }
  );
};

// Credit bonus wallet and set wagering requirement increment if provided
userSchema.statics.creditBonus = async function(userId, amount, wageringIncrement = 0) {
  if (amount <= 0) throw new Error('Amount must be positive');
  const user = await this.findById(userId);
  if (!user) throw new Error('User not found');
  const nextBonus = Number(user.balanceBonus || 0) + Number(amount);
  const nextReal = Number(user.balanceReal || 0);
  const nextWR = Number(user.wageringRequired || 0) + Number(wageringIncrement || 0);
  return this.findByIdAndUpdate(
    userId,
    {
      $set: {
        balanceBonus: nextBonus,
        balance: nextReal + nextBonus,
        wageringRequired: nextWR,
        updatedAt: Date.now()
      }
    },
    { new: true }
  );
};

// Consume stake from bonus first then real; returns {bonusUsed, realUsed}
userSchema.statics.debitForBet = async function(userId, stake) {
  if (stake <= 0) throw new Error('Stake must be positive');
  const user = await this.findById(userId);
  if (!user) throw new Error('User not found');
  const bonusAvailable = Number(user.balanceBonus || 0);
  const realAvailable = Number(user.balanceReal || 0);
  if (bonusAvailable + realAvailable < stake) {
    throw new Error('Insufficient balance');
  }
  const bonusUsed = Math.min(bonusAvailable, stake);
  const realUsed = stake - bonusUsed;
  const nextBonus = bonusAvailable - bonusUsed;
  const nextReal = realAvailable - realUsed;
  const nextProgress = Number(user.wageringProgress || 0) + Number(bonusUsed);
  return this.findByIdAndUpdate(
    userId,
    {
      $set: {
        balanceBonus: nextBonus,
        balanceReal: nextReal,
        balance: nextBonus + nextReal,
        wageringProgress: nextProgress,
        updatedAt: Date.now()
      }
    },
    { new: true }
  ).then(() => ({ bonusUsed, realUsed }));
};

// Legacy method: updateBalance credits real wallet for deposits
userSchema.statics.updateBalance = async function(userId, amount) {
  if (amount === 0) return this.findById(userId);
  if (amount > 0) {
    return this.creditReal(userId, amount);
  }
  // Negative amounts: debit real wallet (used for withdrawals)
  const user = await this.findById(userId);
  if (!user) throw new Error('User not found');
  const realAvailable = Number(user.balanceReal || 0);
  const debit = Math.min(realAvailable, Math.abs(amount));
  const nextReal = realAvailable - debit;
  return this.findByIdAndUpdate(
    userId,
    {
      $set: {
        balanceReal: nextReal,
        balance: nextReal + Number(user.balanceBonus || 0),
        updatedAt: Date.now()
      }
    },
    { new: true }
  );
};

// Generate unique referral code on signup
userSchema.statics.generateReferralCode = function(base) {
  const seed = (base || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${seed}${suffix}` || `ref${Date.now().toString(36)}`;
};

module.exports = mongoose.model('User', userSchema);
