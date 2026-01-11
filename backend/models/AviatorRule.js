const mongoose = require('mongoose')

const aviatorRuleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['global_floor', 'schedule'], required: true },
  active: { type: Boolean, default: true },
  floorMultiplier: { type: Number, min: 1, default: null },
  startTime: { type: String, default: null },
  endTime: { type: String, default: null },
  rangeMin: { type: Number, min: 1, default: null },
  rangeMax: { type: Number, min: 1, default: null },
  priority: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true })

aviatorRuleSchema.index({ active: 1, type: 1, priority: -1 })

module.exports = mongoose.model('AviatorRule', aviatorRuleSchema)
