// models/templateModel.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const templateSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Template name is required'],
    trim: true,
    maxlength: [100, 'Template name cannot exceed 100 characters']
  },
  slug: {
    type: String,
    required: [true, 'Template slug is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens']
  },
  description: {
    type: String,
    required: [true, 'Template description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  layoutType: {
    type: String,
    required: [true, 'Layout type is required'],
    enum: ['card', 'grid', 'list', 'masonry', 'carousel','classic','vibrant'],
    lowercase: true
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['modern', 'classic', 'minimal', 'elegant', 'creative', 'professional','traditional','minimalist','casual'],
    lowercase: true
  },
  isFree: {
    type: Boolean,
    default: true
  },
  isActive: {
    type: Boolean,
    default: true  // As requested
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  currency: {
    type: String,
    required: [true, 'Currency is required'],
    enum: ['INR', 'USD', 'EUR', 'GBP'],
    uppercase: true,
    default: 'INR'
  },
  previewImage: {
    type: String,
    required: [true, 'Preview image URL is required'],
    validate: {
      validator: function(url) {
        return /^https?:\/\/.+/.test(url);
      },
      message: 'Preview image must be a valid URL'
    }
  },
  previewMobile: {
    type: String,
    required: [true, 'Mobile preview URL is required']
  },
  demoUrl: {
    type: String,
    required: [true, 'Demo URL is required']
  },
  colorScheme: {
    type: String,
    required: [true, 'Color scheme is required'],
    enum: ['light', 'dark', 'auto','warm','vibrant'],
    lowercase: true,
    default: 'light'
  },
  primaryColor: {
    type: String,
    required: [true, 'Primary color is required'],
    validate: {
      validator: function(color) {
        return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
      },
      message: 'Primary color must be a valid hex color code'
    }
  },
  secondaryColor: {
    type: String,
    required: [true, 'Secondary color is required']
  },
  accentColor: {
    type: String,
    required: [true, 'Accent color is required']
  },
  fontFamily: {
    type: String,
    required: [true, 'Font family is required'],
    trim: true,
    enum: ['Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Source Sans Pro','Georgia','Helvetica']
  },
  tags: [{
    type: String,
    lowercase: true,
    trim: true,
    max: [5, 'Max five tags are allowed'],
  }],
  features: [{
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Feature description cannot exceed 100 characters']
  }],
  bestFor: {
    type: String,
    required: [true, 'Best for description is required'],
    trim: true,
    maxlength: [200, 'Best for description cannot exceed 200 characters']
  },
  industries: [{
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    // enum: ['restaurant', 'cafe', 'bistro', 'fast-food', 'bakery', 'bar', 'hotel', 'catering']
  }],
  rating: {
    type: Number,
    min: [0, 'Rating cannot be less than 0'],
    max: [5, 'Rating cannot be more than 5'],
    default: 0
  },
  downloads: {
    type: Number,
    min: [0, 'Downloads cannot be negative'],
    default: 0
  }
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt
  collection: 'templates'
});

// Indexes for better query performance
templateSchema.index({ slug: 1 }, { unique: true });
templateSchema.index({ category: 1, isActive: 1 });
templateSchema.index({ isPopular: 1, isActive: 1 });
templateSchema.index({ isFree: 1, isActive: 1 });
templateSchema.index({ industries: 1, isActive: 1 });
templateSchema.index({ rating: -1 });
templateSchema.index({ downloads: -1 });

// Transform JSON output
templateSchema.set('toJSON', {
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Template', templateSchema);
