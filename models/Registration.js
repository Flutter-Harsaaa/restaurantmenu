const mongoose = require("mongoose");

const RegistrationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  contactNumber: { type: String, required: true },
  restaurantName: { type: String },
  isVerified: { type: Boolean, default: false },
  isActive: { type: Number, enum: [0, 1, 2], default: 1 }, // 0 = inactive, 1 = active, 2 = auto inactive
  role: { type: String,default:"Admin" },
}, { timestamps: true }); // This automatically adds createdAt and updatedAt

module.exports = mongoose.model("Registration", RegistrationSchema);
