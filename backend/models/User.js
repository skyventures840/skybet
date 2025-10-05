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
  balance: { type: Number, default: 0 },
  lifetimeWinnings: { type: Number, default: 0 },
  isBlocked: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  isBanned: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
  lastActivity: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

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

// Static method to update user balance
userSchema.statics.updateBalance = async function(userId, amount) {
  // First, get the current user to check balance type
  const user = await this.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Convert current balance to number if it's a string
  const currentBalance = typeof user.balance === 'string' ? parseFloat(user.balance) || 0 : user.balance;
  const newBalance = currentBalance + amount;

  // Update with the new numeric balance
  return this.findByIdAndUpdate(
    userId,
    { 
      $set: { 
        balance: newBalance,
        updatedAt: Date.now() 
      }
    },
    { new: true }
  );
};

module.exports = mongoose.model('User', userSchema);