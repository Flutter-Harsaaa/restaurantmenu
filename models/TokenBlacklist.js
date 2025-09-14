const mongoose = require("mongoose");

const TokenBlacklistSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    expires: 0 // MongoDB TTL - automatically removes expired documents
  },
  blacklistedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("TokenBlacklist", TokenBlacklistSchema);
