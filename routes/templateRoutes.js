// routes/templateRoutes.js
const express = require('express');
const router = express.Router();
const {
  getAllTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate
} = require('../controllers/templateController');

// Middleware to validate MongoDB ObjectId
const validateObjectId = (req, res, next) => {
  const { id } = req.params;
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid template ID format'
    });
  }
  next();
};

// @route   GET /api/templates
// @desc    Get all templates with filtering, search, pagination
// @access  Public
router.get('/', getAllTemplates);

// @route   GET /api/templates/:id
// @desc    Get single template by ID
// @access  Public
router.get('/:id', validateObjectId, getTemplateById);

// @route   POST /api/templates
// @desc    Create new template
// @access  Private (Admin only)
router.post('/', createTemplate);

// @route   PUT /api/templates/:id
// @desc    Update template
// @access  Private (Admin only)
router.put('/:id', validateObjectId, updateTemplate);

// @route   DELETE /api/templates/:id
// @desc    Soft delete template (set isActive to false)
// @access  Private (Admin only)
router.delete('/:id', validateObjectId, deleteTemplate);

module.exports = router;
