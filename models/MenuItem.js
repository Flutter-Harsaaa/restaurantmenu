const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  itemName: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  price: { type: Number, required: true },
  discountPrice: { type: Number },
  quantity: { type: String, trim: true },
  itemCategory: { 
    type: String, 
    enum: ["veg", "non-veg"], 
    required: true 
  },
  productCategory:{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Categories", 
    required: true 
  },
  prepTime: { type: String, trim: true },
  calories: { type: Number },
  spicyLevel: {
    type: String,
    enum: ["low", "medium", "high"]
  },
  rating: { type: Number },
  ingredients: [{ type: String, trim: true }],
  image: [{ type: String, trim: true }],
  resId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Restaurant", 
    required: true 
  }
}, { timestamps: true });

module.exports = mongoose.model('MenuItem', menuItemSchema);
