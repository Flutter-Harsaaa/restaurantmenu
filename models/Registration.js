const mongoose = require("mongoose");

const RegistrationSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  contactNumber: { type: String, required: true },
  restaurantName: { type: String },
  isVerified: { type: Boolean, default: false },
  isActive: { type: Number, enum: [0, 1, 2], default: 1 }, // 0 = inactive, 1 = active, 2 = auto inactive
}, { timestamps: true });

module.exports = mongoose.model("Registration", RegistrationSchema);
