// middleware/validation.js
// Request Validation Middleware using express-validator

const { body, param, query, validationResult } = require('express-validator');

/**
 * Validation Error Handler Middleware
 * This checks for validation errors and returns them if found
 * Usage: router.post('/login', loginValidation, validate, controller)
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.path || error.param,
        message: error.msg
      }))
    });
  }
  
  next();
};

/**
 * Auth Validation Rules
 */
const validateRegister = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  
  body('role')
    .notEmpty()
    .withMessage('Role is required')
    .isIn(['admin', 'employee', 'client'])
    .withMessage('Role must be admin, employee, or client')
];

const validateLogin = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  body('role')
    .notEmpty()
    .withMessage('Role is required')
    .isIn(['admin', 'employee', 'client'])
    .withMessage('Role must be admin, employee, or client')
];

const validateForgotPassword = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail()
];

const validateResetPassword = [
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  
  body('token')
    .notEmpty()
    .withMessage('Reset token is required')
];

/**
 * Employee Validation Rules
 */
const validateEmployee = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('phone')
    .optional()
    .trim()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  
  body('position')
    .trim()
    .notEmpty()
    .withMessage('Position is required'),
  
  body('department')
    .optional()
    .trim(),
  
  body('salary')
    .optional()
    .isNumeric()
    .withMessage('Salary must be a number'),
  
  body('joiningDate')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date')
];

/**
 * Client Validation Rules
 */
const validateClient = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('company')
    .trim()
    .notEmpty()
    .withMessage('Company name is required'),
  
  body('phone')
    .optional()
    .trim()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  
  body('address')
    .optional()
    .trim()
];

/**
 * Project Validation Rules
 */
const validateProject = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Project name is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Project name must be between 3 and 100 characters'),
  
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required'),
  
  body('clientId')
    .notEmpty()
    .withMessage('Client ID is required')
    .isMongoId()
    .withMessage('Invalid client ID'),
  
  body('startDate')
    .notEmpty()
    .withMessage('Start date is required')
    .isISO8601()
    .withMessage('Please provide a valid start date'),
  
  body('deadline')
    .notEmpty()
    .withMessage('Deadline is required')
    .isISO8601()
    .withMessage('Please provide a valid deadline')
    .custom((deadline, { req }) => {
      if (new Date(deadline) <= new Date(req.body.startDate)) {
        throw new Error('Deadline must be after start date');
      }
      return true;
    }),
  
  body('budget')
    .optional()
    .isNumeric()
    .withMessage('Budget must be a number'),
  
  body('status')
    .optional()
    .isIn(['planning', 'active', 'on-hold', 'completed', 'cancelled'])
    .withMessage('Invalid status')
];

/**
 * Task Validation Rules
 */
const validateTask = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Task title is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Task title must be between 3 and 100 characters'),
  
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required'),
  
  body('projectId')
    .notEmpty()
    .withMessage('Project ID is required')
    .isMongoId()
    .withMessage('Invalid project ID'),
  
  body('assignedTo')
    .optional()
    .isMongoId()
    .withMessage('Invalid employee ID'),
  
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority'),
  
  body('status')
    .optional()
    .isIn(['pending', 'in-progress', 'review', 'completed', 'cancelled'])
    .withMessage('Invalid status'),
  
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid due date')
];

/**
 * Attendance Validation Rules
 */
const validateCheckIn = [
  body('location')
    .optional()
    .trim(),
  
  body('ipAddress')
    .optional()
    .isIP()
    .withMessage('Invalid IP address'),
  
  body('deviceInfo')
    .optional()
    .trim()
];

const validateAttendanceCorrection = [
  body('date')
    .notEmpty()
    .withMessage('Date is required')
    .isISO8601()
    .withMessage('Please provide a valid date'),
  
  body('checkInTime')
    .notEmpty()
    .withMessage('Check-in time is required'),
  
  body('checkOutTime')
    .optional(),
  
  body('reason')
    .trim()
    .notEmpty()
    .withMessage('Reason is required')
    .isLength({ min: 10 })
    .withMessage('Reason must be at least 10 characters')
];

/**
 * Meeting Validation Rules
 */
const validateMeeting = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Meeting title is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Meeting title must be between 3 and 100 characters'),
  
  body('description')
    .trim()
    .optional(),
  
  body('date')
    .notEmpty()
    .withMessage('Meeting date is required')
    .isISO8601()
    .withMessage('Please provide a valid date'),
  
  body('startTime')
    .notEmpty()
    .withMessage('Start time is required'),
  
  body('endTime')
    .notEmpty()
    .withMessage('End time is required'),
  
  body('participants')
    .isArray({ min: 1 })
    .withMessage('At least one participant is required'),
  
  body('participants.*')
    .isMongoId()
    .withMessage('Invalid participant ID')
];

/**
 * Daily Report Validation Rules
 */
const validateDailyReport = [
  body('date')
    .notEmpty()
    .withMessage('Date is required')
    .isISO8601()
    .withMessage('Please provide a valid date'),
  
  body('tasksCompleted')
    .isArray()
    .withMessage('Tasks completed must be an array'),
  
  body('hoursWorked')
    .notEmpty()
    .withMessage('Hours worked is required')
    .isNumeric()
    .withMessage('Hours worked must be a number')
    .custom(hours => {
      if (hours < 0 || hours > 24) {
        throw new Error('Hours worked must be between 0 and 24');
      }
      return true;
    }),
  
  body('summary')
    .trim()
    .notEmpty()
    .withMessage('Summary is required')
    .isLength({ min: 20 })
    .withMessage('Summary must be at least 20 characters'),
  
  body('challenges')
    .optional()
    .trim()
];

/**
 * MongoDB ID Validation
 */
const validateMongoId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format')
];

/**
 * Pagination Validation
 */
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

/**
 * Date Range Validation
 */
const validateDateRange = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid start date'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid end date')
    .custom((endDate, { req }) => {
      if (req.query.startDate && new Date(endDate) < new Date(req.query.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    })
];

module.exports = {
  // Validation Handler (IMPORTANT!)
  validate,
  
  // Auth
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  
  // Users
  validateEmployee,
  validateClient,
  
  // Projects & Tasks
  validateProject,
  validateTask,
  
  // Attendance
  validateCheckIn,
  validateAttendanceCorrection,
  
  // Meetings
  validateMeeting,
  
  // Reports
  validateDailyReport,
  
  // Common
  validateMongoId,
  validatePagination,
  validateDateRange
};