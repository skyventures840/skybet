const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  orderId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  paymentId: { 
    type: String, 
    required: true 
  },
  status: { 
    type: String, 
    required: true,
    enum: ['waiting', 'confirming', 'confirmed', 'sending', 'partially_paid', 'finished', 'failed', 'refunded', 'expired'],
    default: 'waiting'
  },
  amount: { 
    type: Number, 
    required: true 
  },
  currency: { 
    type: String, 
    required: true 
  },
  payAmount: {
    type: Number,
    required: true
  },
  payCurrency: {
    type: String,
    required: true
  },
  payAddress: {
    type: String,
    required: true
  },
  payinExtraId: {
    type: String
  },
  paymentExtraId: {
    type: String
  },
  purchaseId: {
    type: String
  },
  orderDescription: {
    type: String,
    default: 'Betting Payment'
  },
  ipnCallbackUrl: {
    type: String
  },
  successUrl: {
    type: String
  },
  cancelUrl: {
    type: String
  },
  partiallyPaidAmount: {
    type: Number
  },
  partiallyPaidAmountConverted: {
    type: Number
  },
  outcomeAmount: {
    type: Number
  },
  outcomeCurrency: {
    type: String
  },
  outcomeSubtype: {
    type: String
  },
  outcomeNetwork: {
    type: String
  },
  outcomeTxid: {
    type: String
  },
  outcomeAddress: {
    type: String
  },
  outcomeExtraId: {
    type: String
  },
  outcomeAmountConverted: {
    type: Number
  },
  outcomeCurrencyConverted: {
    type: String
  },
  createdAt: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Update the updatedAt field before saving
paymentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to get payments by user
paymentSchema.statics.getByUser = function(userId, status = null) {
  const query = { userId };
  if (status) query.status = status;
  
  return this.find(query).sort({ createdAt: -1 });
};

// Static method to update payment status
paymentSchema.statics.updatePaymentStatus = function(orderId, status, additionalData = {}) {
  const updateData = {
    status,
    updatedAt: new Date(),
    ...additionalData
  };
  
  return this.findOneAndUpdate(
    { orderId },
    updateData,
    { new: true }
  );
};

// Static method to create payment
paymentSchema.statics.createPayment = function(paymentData) {
  return this.create(paymentData);
};

// Static method to get payment by order ID
paymentSchema.statics.getByOrderId = function(orderId) {
  return this.findOne({ orderId });
};

// Static method to get payment by payment ID
paymentSchema.statics.getByPaymentId = function(paymentId) {
  return this.findOne({ paymentId });
};

module.exports = mongoose.model('Payment', paymentSchema); 