// controllers/templateController.js
const Template = require('../models/Template');
const ResponseHelper = require('../utils/responseHelper');
const mongoose = require('mongoose');

// Get all templates with filtering, search, pagination
const getAllTemplates = async (req, res) => {
  try {
    const query = {};
    
    // Build query filters
    if (req.query.category) query.category = req.query.category.toLowerCase();
    if (req.query.layoutType) query.layoutType = req.query.layoutType.toLowerCase();
    if (req.query.isFree !== undefined) query.isFree = req.query.isFree === 'true';
    if (req.query.isActive !== undefined) query.isActive = req.query.isActive === 'true';
    else query.isActive = true; // Default: show only active templates
    
    if (req.query.industries) {
      const industries = req.query.industries.split(',').map(i => i.trim().toLowerCase());
      query.industries = { $in: industries };
    }
    
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search.trim(), 'i');
      query.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { bestFor: searchRegex }
      ];
    }
    
    // Pagination
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 12));
    const skip = (page - 1) * limit;
    
    // Sorting
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const sort = { [sortBy]: sortOrder };
    
    // Execute queries
    const [templates, totalCount] = await Promise.all([
      Template.find(query).sort(sort).skip(skip).limit(limit).lean(),
      Template.countDocuments(query)
    ]);
    
    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);
    
    const responseData = {
      templates,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };

    return ResponseHelper.success(res, responseData, `Found ${templates.length} templates`, 200);
    
  } catch (error) {
    console.error('Error fetching templates:', error);
    return ResponseHelper.error(res, 'Internal server error while fetching templates', 500);
  }
};

// Get single template by ID
const getTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ResponseHelper.error(res, 'Invalid template ID format', 400);
    }
    
    const template = await Template.findById(id).lean();
    
    if (!template) {
      return ResponseHelper.error(res, 'Template not found', 404);
    }
    
    // Check if template is active
    if (!template.isActive && req.query.includeInactive !== 'true') {
      return ResponseHelper.error(res, 'Template not available', 404);
    }
    
    return ResponseHelper.success(res, template, 'Template retrieved successfully', 200);
    
  } catch (error) {
    console.error('Error fetching template:', error);
    return ResponseHelper.error(res, 'Internal server error while fetching template', 500);
  }
};

// Create new template
const createTemplate = async (req, res) => {
  try {
    
    const template = new Template(req.body);
    
    const savedTemplate = await template.save();
    
    return ResponseHelper.success(res, savedTemplate, 'Template created successfully', 201);
    
  } catch (error) {
    console.error('Error creating template - Full error:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message,
        value: err.value
      }));
      
      console.error('Validation errors:', validationErrors);
      
      return ResponseHelper.error(res, 'Validation failed', 400, validationErrors);
    }
    
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyValue)[0];
      return ResponseHelper.error(res, `Template with this ${duplicateField} already exists`, 409);
    }
    
    return ResponseHelper.error(res, 'Internal server error while creating template', 500);
  }
};

// Update template
const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ResponseHelper.error(res, 'Invalid template ID format', 400);
    }
    
    const template = await Template.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!template) {
      return ResponseHelper.error(res, 'Template not found', 404);
    }
    
    return ResponseHelper.success(res, template, 'Template updated successfully', 200);
    
  } catch (error) {
    console.error('Error updating template:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      
      return ResponseHelper.error(res, 'Validation failed', 400, validationErrors);
    }
    
    return ResponseHelper.error(res, 'Internal server error while updating template', 500);
  }
};

// Soft delete template
const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ResponseHelper.error(res, 'Invalid template ID format', 400);
    }
    
    const template = await Template.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );
    
    if (!template) {
      return ResponseHelper.error(res, 'Template not found', 404);
    }
    
    return ResponseHelper.success(res, null, 'Template deactivated successfully', 200);
    
  } catch (error) {
    // console.error('Error deleting template:', error);
    return ResponseHelper.error(res, 'Internal server error while deleting template', 500);
  }
};

module.exports = {
  getAllTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate
};
