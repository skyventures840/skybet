const mongoose = require('mongoose');

const heroSchema = new mongoose.Schema({
  image: { type: String, required: true }, // URL or path to image
  caption1: { type: String, required: true },
  caption2: { type: String, required: true },
  buttonText: { type: String, required: true },
  buttonUrl: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Hero', heroSchema); 