// routes/authRoutes.js
// Authentication Routes

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { body } = require('express-validator');
const { validate } = require('../middleware/validation');  // ✅ FIXED: Destructure validate

// Import auth controller functions
const {
  register,
  login,
  logout,
  verifyToken,
  forgotPassword,
  resetPassword,
  getMe,
  updatePassword
} = require('../controllers/authController');

// ============================================
// VALIDATION RULES
// ============================================

const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('role')
    .isIn(['admin', 'employee', 'client'])
    .withMessage('Role must be admin, employee, or client'),
];

const loginValidation = [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required'),
  body('role')
    .isIn(['admin', 'employee', 'client'])
    .withMessage('Role must be admin, employee, or client'),
];

const forgotPasswordValidation = [
  body('email').isEmail().withMessage('Please provide a valid email'),
];

const resetPasswordValidation = [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
];

const updatePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters'),
];

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================

// @route   POST /api/auth/register
// @desc    Register new user
// @access  Public
router.post('/register', registerValidation, validate, register);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', loginValidation, validate, login);

// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
router.post('/forgot-password', forgotPasswordValidation, validate, forgotPassword);

// @route   POST /api/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post('/reset-password', resetPasswordValidation, validate, resetPassword);

// ============================================
// PROTECTED ROUTES (Authentication required)
// ============================================

// @route   POST /api/auth/logout
// @desc    Logout user (client-side token removal)
// @access  Private
router.post('/logout', protect, logout);

// @route   GET /api/auth/verify
// @desc    Verify JWT token and get user data
// @access  Private
router.get('/verify', protect, verifyToken);

// @route   GET /api/auth/me
// @desc    Get current logged in user
// @access  Private
router.get('/me', protect, getMe);

// @route   PUT /api/auth/update-password
// @desc    Update user password
// @access  Private
router.put('/update-password', protect, updatePasswordValidation, validate, updatePassword);

module.exports = router;