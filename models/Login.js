const mongoose = require("mongoose");

const LoginSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isVerified: { type: Boolean, default: false },
  isActive: { type: Number, enum: [0, 1, 2], default: 1 },
}, { timestamps: true });

module.exports = mongoose.model("Login", LoginSchema);
