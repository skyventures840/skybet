const mongoose = require('mongoose');

const leagueSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  country: {
    type: String,
    required: true
  },
  active: {
    type: Boolean,
    default: true
  }
});

const sportSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  key: {
    type: String,
    required: true,
    unique: true
  },
  icon: {
    type: String,
    default: '⚽'
  },
  active: {
    type: Boolean,
    default: true
  },
  leagues: [leagueSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
sportSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Static method to get all active sports
sportSchema.statics.getAll = function() {
  return this.find({ active: true }).sort({ name: 1 });
};

// Static method to get leagues by sport
sportSchema.statics.getLeagues = function(sportId) {
  return this.findById(sportId).select('leagues');
};

// Static method to add league to sport
sportSchema.statics.addLeague = function(sportId, league) {
  return this.findByIdAndUpdate(
    sportId,
    { $push: { leagues: league } },
    { new: true }
  );
};

// Static method to update league
sportSchema.statics.updateLeague = function(sportId, leagueId, updateData) {
  return this.findOneAndUpdate(
    { _id: sportId, 'leagues.id': leagueId },
    { $set: { 'leagues.$': { ...updateData, id: leagueId } } },
    { new: true }
  );
};

module.exports = mongoose.model('Sport', sportSchema);