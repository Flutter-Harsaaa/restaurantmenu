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
const authMiddleware = require("../middleware/authMiddleware");


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

// @route   GET /api/templates/all-template
// @desc    Get all templates with filtering, search, pagination
// @access  Public
router.get('/all-template',authMiddleware, getAllTemplates);

// @route   GET /api/templates/id/:id
// @desc    Get single template by ID
// @access  Public
router.get('/id/:id', validateObjectId,authMiddleware, getTemplateById);

// @route   POST /api/templates/create
// @desc    Create new template
// @access  Private (Admin only)
router.post('/create',authMiddleware, createTemplate);

// @route   PUT /api/templates/update/:id
// @desc    Update template
// @access  Private (Admin only)
router.put('/update/:id', validateObjectId,authMiddleware, updateTemplate);

// @route   DELETE /api/templates/delete/:id
// @desc    Soft delete template (set isActive to false)
// @access  Private (Admin only)
router.delete('/delete/:id', validateObjectId,authMiddleware, deleteTemplate);

module.exports = router;
