const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  isActive: { type: Number, enum: [0, 1], default: 1 },
  isDefault: { type: Number, enum: [0, 1], default: 0 }
}, { timestamps: true });

module.exports = mongoose.model("Category", categorySchema);
