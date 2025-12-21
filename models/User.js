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
  balanceBonus: { type: Number, default: 0 },
  // Main balance (Real Money)
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

/**
 * ATOMIC BALANCE MANAGEMENT
 * Ensures balance is only modified via strictly defined operations.
 */

// Core atomic update method - Internal Use Only
// Returns the updated document or null if condition failed
userSchema.statics._atomicUpdate = async function(userId, queryConditions, updateOperations) {
    const update = {
        ...updateOperations,
        $set: { 
            ...(updateOperations.$set || {}),
            updatedAt: Date.now() 
        }
    };
    
    return this.findOneAndUpdate(
        { _id: userId, ...queryConditions },
        updateOperations,
        { new: true }
    );
};

// 1. DEPOSIT (Increase Balance)
userSchema.statics.deposit = async function(userId, amount) {
    if (amount <= 0) throw new Error('Deposit amount must be positive');
    
    // Increase main balance
    return this._atomicUpdate(userId, {}, {
        $inc: { balance: amount }
    });
};

// 2. WITHDRAWAL (Decrease Balance)
userSchema.statics.withdraw = async function(userId, amount) {
    if (amount <= 0) throw new Error('Withdrawal amount must be positive');
    
    const result = await this._atomicUpdate(userId, {
        balance: { $gte: amount } // Ensure sufficient funds
    }, {
        $inc: { balance: -amount }
    });

    if (!result) throw new Error('Insufficient balance for withdrawal');
    return result;
};

// 3. CREDIT BONUS (Increase Bonus Balance - Optional/Legacy)
userSchema.statics.creditBonus = async function(userId, amount, wageringIncrement = 0) {
    if (amount <= 0) throw new Error('Bonus amount must be positive');
    
    const updateOps = {
        $inc: { balanceBonus: amount }
    };
    if (wageringIncrement > 0) {
        updateOps.$inc.wageringRequired = wageringIncrement;
    }
    
    return this._atomicUpdate(userId, {}, updateOps);
};

// 4. PLACE BET (Decrease Balance - Single Source of Truth)
userSchema.statics.placeBet = async function(userId, stake) {
    if (stake <= 0) throw new Error('Stake must be positive');
    
    // Retry loop for optimistic concurrency control
    // Optimized with $gte checks to reduce retries
    const MAX_RETRIES = 5; // Reduced retries needed with smarter locking
    for (let i = 0; i < MAX_RETRIES; i++) {
        // Use lean() to get actual DB state
        const user = await this.findById(userId).lean();
        if (!user) throw new Error('User not found');

        // Calculate deduction split (Bonus First)
        let bonusUsed = 0;
        let realUsed = 0;
        const currentBonus = user.balanceBonus || 0;
        const currentReal = user.balance || 0;

        if (currentBonus >= stake) {
            bonusUsed = stake;
        } else {
            bonusUsed = currentBonus;
            realUsed = stake - bonusUsed;
        }

        // Check if real balance is sufficient for the remainder
        if (currentReal < realUsed) {
            throw new Error('Insufficient balance');
        }

        // Atomic Update with "Sufficient Funds" Locking
        // Instead of requiring exact balance match, we just require enough funds.
        // This allows concurrent ops (like winning another bet) to happen without failing this one.
        const query = { 
            _id: userId,
            balance: { $gte: realUsed }
        };
        
        // Only add bonus check if we are using bonus or if we want to ensure consistency
        // To be safe and support "Bonus First" strictly, we check if we are draining the bonus
        // or just using part of it.
        if (bonusUsed > 0) {
            query.balanceBonus = { $gte: bonusUsed };
        }

        const result = await this.findOneAndUpdate(
            query,
            {
                $inc: {
                    balance: -realUsed,
                    balanceBonus: -bonusUsed
                },
                $set: { updatedAt: Date.now() }
            },
            { new: true }
        );

        if (result) {
            return { user: result, bonusUsed, realUsed };
        }
        
        // If result is null, it means balance dropped below required amount concurrently
        // We retry to see if we can recalculate split (maybe bonus changed?)
        const delay = Math.floor(Math.random() * 50) + 20;
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    throw new Error('Transaction failed due to high concurrency. Please try again.');
};

// 5. SETTLE BET WIN (Increase Balance)
userSchema.statics.settleBetWin = async function(userId, amount) {
    if (amount < 0) throw new Error('Win amount cannot be negative');
    if (amount === 0) return this.findById(userId); // No change

    return this._atomicUpdate(userId, {}, {
        $inc: { balance: amount }
    });
};

// 6. REFUND BET (Increase Balance)
userSchema.statics.refundBet = async function(userId, amount, split = null) {
    if (amount <= 0) throw new Error('Refund amount must be positive');

    // Ignore split, refund to main balance
    return this._atomicUpdate(userId, {}, {
        $inc: { balance: amount }
    });
};

// Legacy support / Alias - TO BE DEPRECATED
// Maps old calls to new atomic methods
userSchema.statics.creditReal = function(userId, amount) {
    return this.deposit(userId, amount);
};

userSchema.statics.debitForBet = async function(userId, stake) {
    const { bonusUsed, realUsed } = await this.placeBet(userId, stake);
    return { bonusUsed, realUsed };
};

// Generate unique referral code on signup
userSchema.statics.generateReferralCode = function(base) {
  const seed = (base || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${seed}${suffix}` || `ref${Date.now().toString(36)}`;
};

module.exports = mongoose.model('User', userSchema);
