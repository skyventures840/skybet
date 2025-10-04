const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['deposit', 'withdrawal', 'bet', 'win', 'refund'],
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  method: {
    type: String,
    enum: ['crypto', 'card', 'bank', 'system'],
    required: true
  },
  currency: {
    type: String,
    enum: ['USD', 'BTC', 'ETH', 'LTC', 'USDT', 'BNB'],
    default: 'USD'
  },
  walletAddress: {
    type: String,
    trim: true
  },
  transactionHash: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  description: {
    type: String,
    trim: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  completedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Compound indexes for efficient queries
transactionSchema.index({ userId: 1, type: 1 });
transactionSchema.index({ userId: 1, status: 1 });
transactionSchema.index({ userId: 1, createdAt: -1 });

// Static method to get transactions by user
transactionSchema.statics.getByUser = function(userId, type = null, status = null) {
  const query = { userId };
  if (type) query.type = type;
  if (status) query.status = status;
  
  return this.find(query).sort({ createdAt: -1 });
};

// Static method to create deposit transaction
transactionSchema.statics.createDeposit = function(userId, amount, method, currency, walletAddress) {
  return this.create({
    userId,
    type: 'deposit',
    amount,
    method,
    currency,
    walletAddress,
    description: `Deposit via ${method.toUpperCase()}`
  });
};

// Static method to create withdrawal transaction
transactionSchema.statics.createWithdrawal = function(userId, amount, method, currency, walletAddress) {
  return this.create({
    userId,
    type: 'withdrawal',
    amount,
    method,
    currency,
    walletAddress,
    description: `Withdrawal via ${method.toUpperCase()}`
  });
};

// Static method to complete transaction
transactionSchema.statics.completeTransaction = function(transactionId, transactionHash = null) {
  const updateData = {
    status: 'completed',
    completedAt: new Date()
  };
  
  if (transactionHash) {
    updateData.transactionHash = transactionHash;
  }
  
  return this.findByIdAndUpdate(transactionId, updateData, { new: true });
};

// Static method to fail transaction
transactionSchema.statics.failTransaction = function(transactionId, reason = null) {
  const updateData = {
    status: 'failed',
    completedAt: new Date()
  };
  
  if (reason) {
    updateData.description = reason;
  }
  
  return this.findByIdAndUpdate(transactionId, updateData, { new: true });
};

module.exports = mongoose.model('Transaction', transactionSchema);