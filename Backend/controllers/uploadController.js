// controllers/uploadController.js
// File upload controller for avatars, documents, and reports

const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Employee = require('../models/Employee');
const Client = require('../models/Client');

// @desc    Upload avatar/profile picture
// @route   POST /api/upload/avatar
// @access  Private (All authenticated users)
exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image file'
      });
    }

    const userId = req.user.id;
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    // Update user avatar in database
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Delete old avatar if exists
    if (user.avatar && user.avatar !== '/uploads/avatars/default-avatar.png') {
      const oldAvatarPath = path.join(__dirname, '..', user.avatar);
      if (fs.existsSync(oldAvatarPath)) {
        fs.unlinkSync(oldAvatarPath);
      }
    }

    // Update avatar
    user.avatar = avatarUrl;
    await user.save();

    // Also update in role-specific model
    if (user.role === 'employee') {
      await Employee.findOneAndUpdate(
        { userId: userId },
        { avatar: avatarUrl }
      );
    } else if (user.role === 'client') {
      await Client.findOneAndUpdate(
        { userId: userId },
        { avatar: avatarUrl }
      );
    }

    res.status(200).json({
      success: true,
      message: 'Avatar uploaded successfully',
      data: {
        avatarUrl: avatarUrl,
        filename: req.file.filename
      }
    });

  } catch (error) {
    console.error('Upload avatar error:', error);
    
    // Delete uploaded file if database update fails
    if (req.file) {
      const filePath = req.file.path;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.status(500).json({
      success: false,
      message: 'Error uploading avatar',
      error: error.message
    });
  }
};

// @desc    Upload document
// @route   POST /api/upload/document
// @access  Private
exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a document'
      });
    }

    const documentUrl = `/uploads/documents/${req.file.filename}`;

    res.status(200).json({
      success: true,
      message: 'Document uploaded successfully',
      data: {
        documentUrl: documentUrl,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      }
    });

  } catch (error) {
    console.error('Upload document error:', error);

    // Delete uploaded file if there's an error
    if (req.file) {
      const filePath = req.file.path;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.status(500).json({
      success: false,
      message: 'Error uploading document',
      error: error.message
    });
  }
};

// @desc    Upload multiple documents
// @route   POST /api/upload/documents
// @access  Private
exports.uploadMultipleDocuments = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please upload at least one document'
      });
    }

    const uploadedFiles = req.files.map(file => ({
      documentUrl: `/uploads/documents/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype
    }));

    res.status(200).json({
      success: true,
      message: `${req.files.length} documents uploaded successfully`,
      data: uploadedFiles
    });

  } catch (error) {
    console.error('Upload multiple documents error:', error);

    // Delete uploaded files if there's an error
    if (req.files) {
      req.files.forEach(file => {
        const filePath = file.path;
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error uploading documents',
      error: error.message
    });
  }
};

// @desc    Upload report
// @route   POST /api/upload/report
// @access  Private (Admin/Employee)
exports.uploadReport = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a report file'
      });
    }

    const reportUrl = `/uploads/reports/${req.file.filename}`;

    res.status(200).json({
      success: true,
      message: 'Report uploaded successfully',
      data: {
        reportUrl: reportUrl,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size
      }
    });

  } catch (error) {
    console.error('Upload report error:', error);

    // Delete uploaded file if there's an error
    if (req.file) {
      const filePath = req.file.path;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.status(500).json({
      success: false,
      message: 'Error uploading report',
      error: error.message
    });
  }
};

// @desc    Delete uploaded file
// @route   DELETE /api/upload/:filename
// @access  Private
exports.deleteFile = async (req, res) => {
  try {
    const { filename } = req.params;
    const { fileType } = req.query; // avatar, document, report

    let filePath;
    if (fileType === 'avatar') {
      filePath = path.join(__dirname, '..', 'uploads', 'avatars', filename);
    } else if (fileType === 'report') {
      filePath = path.join(__dirname, '..', 'uploads', 'reports', filename);
    } else {
      filePath = path.join(__dirname, '..', 'uploads', 'documents', filename);
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Delete file
    fs.unlinkSync(filePath);

    res.status(200).json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting file',
      error: error.message
    });
  }
};

// @desc    Get file
// @route   GET /api/upload/file/:filename
// @access  Private
exports.getFile = async (req, res) => {
  try {
    const { filename } = req.params;
    const { fileType } = req.query;

    let filePath;
    if (fileType === 'avatar') {
      filePath = path.join(__dirname, '..', 'uploads', 'avatars', filename);
    } else if (fileType === 'report') {
      filePath = path.join(__dirname, '..', 'uploads', 'reports', filename);
    } else {
      filePath = path.join(__dirname, '..', 'uploads', 'documents', filename);
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Send file
    res.sendFile(filePath);

  } catch (error) {
    console.error('Get file error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving file',
      error: error.message
    });
  }
};