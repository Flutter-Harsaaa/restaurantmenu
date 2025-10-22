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
  tags: [{ type: String, trim: true }],
  ingredients: [{ type: String, trim: true }],
  image: [{ type: String, trim: true, required:true}],
  resId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Restaurant", 
    required: true 
  },
  isActive: { type: Number, enum: [0, 1], default: 1 },
}, { timestamps: true });

module.exports = mongoose.model('MenuItem', menuItemSchema);
