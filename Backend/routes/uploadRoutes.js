// routes/uploadRoutes.js
// File upload routes

const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const { protect } = require('../middleware/auth');
const { 
  uploadAvatar, 
  uploadDocument, 
  uploadReport,
  uploadMultipleDocuments 
} = require('../config/multer');

// @route   POST /api/upload/avatar
// @desc    Upload user avatar/profile picture
// @access  Private (All authenticated users)
router.post(
  '/avatar',
  protect,
  uploadAvatar,
  uploadController.uploadAvatar
);

// @route   POST /api/upload/document
// @desc    Upload single document
// @access  Private
router.post(
  '/document',
  protect,
  uploadDocument,
  uploadController.uploadDocument
);

// @route   POST /api/upload/documents
// @desc    Upload multiple documents (max 5)
// @access  Private
router.post(
  '/documents',
  protect,
  uploadMultipleDocuments,
  uploadController.uploadMultipleDocuments
);

// @route   POST /api/upload/report
// @desc    Upload report file
// @access  Private (Admin/Employee)
router.post(
  '/report',
  protect,
  uploadReport,
  uploadController.uploadReport
);

// @route   DELETE /api/upload/:filename
// @desc    Delete uploaded file
// @access  Private
router.delete(
  '/:filename',
  protect,
  uploadController.deleteFile
);

// @route   GET /api/upload/file/:filename
// @desc    Get/download file
// @access  Private
router.get(
  '/file/:filename',
  protect,
  uploadController.getFile
);

// Error handling middleware for multer errors
router.use((error, req, res, next) => {
  if (error) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum file size is 5MB'
      });
    }
    
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum 5 files allowed'
      });
    }

    return res.status(400).json({
      success: false,
      message: error.message || 'File upload failed'
    });
  }
  next();
});

module.exports = router;