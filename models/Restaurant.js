const mongoose = require("mongoose");

const restaurantSchema = new mongoose.Schema(
  {
    restaurantName: { type: String, required: true },
    restaurantContactNumber: { type: String, required: true, unique: true },
    restaurantAddress: { type: String, required: true, },
    logoUrl: { type: String },
    minOrderTime: { type: Number, required: true },
    maxOrderTime: { type: Number, required: true },
    staffCount: { type: Number, default: 0 },
    cuisine: { type: String, required: true },
    selectedTempId: { type: mongoose.Schema.Types.ObjectId, ref: "Template" },
    // selectedTempId: { type: String, required: true, ref: "Template" },

    isActive: { type: Boolean, default: true },
    restaurantEmail: { type: String , unique: true},
    restaurantGpsAddress: { type: String },
  },
  { timestamps: true }
);

// create compound unique index for extra safety
restaurantSchema.index(
  { restaurantContactNumber: 1, restaurantAddress: 1 },
  { unique: true }
);

module.exports = mongoose.model("Restaurant", restaurantSchema);
