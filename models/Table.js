const mongoose = require("mongoose");

const tableSchema = new mongoose.Schema({
  tableNumber: { 
    type: Number, 
    required: true, 
    min: 1,
    validate: {
      validator: Number.isInteger,
      message: 'Table number must be an integer'
    }
  },
  capacity: { 
    type: Number, 
    required: true, 
    min: 1, 
    max: 20,
    validate: {
      validator: Number.isInteger,
      message: 'Capacity must be an integer'
    }
  },
  status: {
    type: String,
    required: true,
    enum: ['available', 'occupied', 'reserved', 'out_of_service'],
    default: 'available'
  },
  location: { 
    type: String, 
    required: true, 
    trim: true,
    minlength: 2,
    maxlength: 100
  },
  isActive: { 
    type: Number, 
    enum: [0, 1], 
    default: 1 
  },
  reservedStatus: { 
    type: Boolean, 
    default: false 
  },
  restaurantId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Restaurant', 
    required: true 
  }
}, { timestamps: true });

// Create compound index to ensure unique table numbers per restaurant
tableSchema.index({ tableNumber: 1, restaurantId: 1 }, { unique: true });

module.exports = mongoose.model("Table", tableSchema);
