// controllers/templateController.js
const Template = require('../models/Template');

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
    
    res.status(200).json({
      success: true,
      data: {
        templates,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      },
      message: `Found ${templates.length} templates`
    });
    
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching templates'
    });
  }
};

// Get single template by ID
const getTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const template = await Template.findById(id).lean();
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }
    
    // Check if template is active
    if (!template.isActive && req.query.includeInactive !== 'true') {
      return res.status(404).json({
        success: false,
        message: 'Template not available'
      });
    }
    
    res.status(200).json({
      success: true,
      data: template,
      message: 'Template retrieved successfully'
    });
    
  } catch (error) {
    console.error('Error fetching template:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid template ID format'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching template'
    });
  }
};

// Create new template
const createTemplate = async (req, res) => {
  try {
    const template = new Template(req.body);
    const savedTemplate = await template.save();
    
    res.status(201).json({
      success: true,
      data: savedTemplate,
      message: 'Template created successfully'
    });
    
  } catch (error) {
    console.error('Error creating template:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error while creating template'
    });
  }
};

// Update template
const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    
    const template = await Template.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: template,
      message: 'Template updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while updating template'
    });
  }
};

// Soft delete template
const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    
    const template = await Template.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Template deactivated successfully'
    });
    
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while deleting template'
    });
  }
};

module.exports = {
  getAllTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate
};
