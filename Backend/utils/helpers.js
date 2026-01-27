// utils/helpers.js
// General helper functions used across the application

/**
 * Format Date to readable string
 * @param {Date} date - Date object
 * @returns {string} - Formatted date string
 */
const formatDate = (date) => {
  if (!date) return '';
  
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

/**
 * Format DateTime to readable string
 * @param {Date} date - Date object
 * @returns {string} - Formatted datetime string
 */
const formatDateTime = (date) => {
  if (!date) return '';
  
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

/**
 * Format Time to readable string
 * @param {Date} date - Date object
 * @returns {string} - Formatted time string (HH:MM)
 */
const formatTime = (date) => {
  if (!date) return '';
  
  const d = new Date(date);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  
  return `${hours}:${minutes}`;
};

/**
 * Calculate time difference in hours
 * @param {Date} startTime - Start time
 * @param {Date} endTime - End time
 * @returns {number} - Hours difference
 */
const calculateHoursDifference = (startTime, endTime) => {
  if (!startTime || !endTime) return 0;
  
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffMs = end - start;
  const diffHours = diffMs / (1000 * 60 * 60);
  
  return Math.round(diffHours * 100) / 100; // Round to 2 decimal places
};

/**
 * Calculate working hours for a day
 * @param {Date} checkIn - Check-in time
 * @param {Date} checkOut - Check-out time
 * @returns {object} - { hours, minutes, formatted }
 */
const calculateWorkingHours = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) {
    return { hours: 0, minutes: 0, formatted: '0h 0m' };
  }

  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diffMs = end - start;
  
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  return {
    hours,
    minutes,
    formatted: `${hours}h ${minutes}m`
  };
};

/**
 * Check if date is today
 * @param {Date} date - Date to check
 * @returns {boolean}
 */
const isToday = (date) => {
  if (!date) return false;
  
  const today = new Date();
  const checkDate = new Date(date);
  
  return checkDate.getDate() === today.getDate() &&
         checkDate.getMonth() === today.getMonth() &&
         checkDate.getFullYear() === today.getFullYear();
};

/**
 * Check if date is in current month
 * @param {Date} date - Date to check
 * @returns {boolean}
 */
const isCurrentMonth = (date) => {
  if (!date) return false;
  
  const today = new Date();
  const checkDate = new Date(date);
  
  return checkDate.getMonth() === today.getMonth() &&
         checkDate.getFullYear() === today.getFullYear();
};

/**
 * Get start and end date of current month
 * @returns {object} - { startDate, endDate }
 */
const getCurrentMonthDates = () => {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  return { startDate, endDate };
};

/**
 * Get start and end date of current week
 * @returns {object} - { startDate, endDate }
 */
const getCurrentWeekDates = () => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - dayOfWeek);
  
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  
  return { startDate, endDate };
};

/**
 * Calculate attendance percentage
 * @param {number} presentDays - Number of present days
 * @param {number} totalDays - Total working days
 * @returns {number} - Percentage (0-100)
 */
const calculateAttendancePercentage = (presentDays, totalDays) => {
  if (totalDays === 0) return 0;
  return Math.round((presentDays / totalDays) * 100);
};

/**
 * Generate random string (for IDs, tokens, etc.)
 * @param {number} length - Length of string
 * @returns {string} - Random string
 */
const generateRandomString = (length = 10) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  
  return result;
};

/**
 * Generate employee ID
 * @param {string} prefix - Prefix for ID (e.g., 'EMP')
 * @param {number} number - Employee number
 * @returns {string} - Employee ID (e.g., 'EMP-001')
 */
const generateEmployeeId = (prefix = 'EMP', number) => {
  const paddedNumber = String(number).padStart(3, '0');
  return `${prefix}-${paddedNumber}`;
};

/**
 * Generate client ID
 * @param {string} prefix - Prefix for ID (e.g., 'CLT')
 * @param {number} number - Client number
 * @returns {string} - Client ID (e.g., 'CLT-001')
 */
const generateClientId = (prefix = 'CLT', number) => {
  const paddedNumber = String(number).padStart(3, '0');
  return `${prefix}-${paddedNumber}`;
};

/**
 * Generate project code
 * @param {string} clientName - Client name
 * @param {number} projectNumber - Project number
 * @returns {string} - Project code (e.g., 'ABC-P001')
 */
const generateProjectCode = (clientName, projectNumber) => {
  const prefix = clientName.substring(0, 3).toUpperCase();
  const paddedNumber = String(projectNumber).padStart(3, '0');
  return `${prefix}-P${paddedNumber}`;
};

/**
 * Sanitize string (remove special characters)
 * @param {string} str - String to sanitize
 * @returns {string} - Sanitized string
 */
const sanitizeString = (str) => {
  if (!str) return '';
  return str.replace(/[^a-zA-Z0-9\s]/g, '').trim();
};

/**
 * Capitalize first letter of each word
 * @param {string} str - String to capitalize
 * @returns {string} - Capitalized string
 */
const capitalizeWords = (str) => {
  if (!str) return '';
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
};

/**
 * Format currency
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (default: USD)
 * @returns {string} - Formatted currency
 */
const formatCurrency = (amount, currency = 'USD') => {
  if (!amount) return `${currency} 0.00`;
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
};

/**
 * Format file size
 * @param {number} bytes - Size in bytes
 * @returns {string} - Formatted size (e.g., '1.5 MB')
 */
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean}
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean}
 */
const isValidPhone = (phone) => {
  const phoneRegex = /^\+?[\d\s-()]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
};

/**
 * Paginate array
 * @param {Array} array - Array to paginate
 * @param {number} page - Page number (1-indexed)
 * @param {number} limit - Items per page
 * @returns {object} - { data, page, totalPages, totalItems }
 */
const paginate = (array, page = 1, limit = 10) => {
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const data = array.slice(startIndex, endIndex);
  
  return {
    data,
    page: parseInt(page),
    limit: parseInt(limit),
    totalPages: Math.ceil(array.length / limit),
    totalItems: array.length
  };
};

/**
 * Sort array of objects
 * @param {Array} array - Array to sort
 * @param {string} key - Key to sort by
 * @param {string} order - 'asc' or 'desc'
 * @returns {Array} - Sorted array
 */
const sortArray = (array, key, order = 'asc') => {
  return array.sort((a, b) => {
    if (order === 'asc') {
      return a[key] > b[key] ? 1 : -1;
    } else {
      return a[key] < b[key] ? 1 : -1;
    }
  });
};

/**
 * Remove duplicates from array
 * @param {Array} array - Array with duplicates
 * @param {string} key - Key to check for duplicates (optional)
 * @returns {Array} - Array without duplicates
 */
const removeDuplicates = (array, key = null) => {
  if (!key) {
    return [...new Set(array)];
  }
  
  return array.filter((item, index, self) =>
    index === self.findIndex((t) => t[key] === item[key])
  );
};

/**
 * Calculate task completion percentage
 * @param {number} completedTasks - Number of completed tasks
 * @param {number} totalTasks - Total number of tasks
 * @returns {number} - Percentage (0-100)
 */
const calculateTaskCompletion = (completedTasks, totalTasks) => {
  if (totalTasks === 0) return 0;
  return Math.round((completedTasks / totalTasks) * 100);
};

/**
 * Calculate project progress
 * @param {Date} startDate - Project start date
 * @param {Date} endDate - Project end date
 * @returns {number} - Progress percentage (0-100)
 */
const calculateProjectProgress = (startDate, endDate) => {
  if (!startDate || !endDate) return 0;
  
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const now = new Date().getTime();
  
  if (now < start) return 0;
  if (now > end) return 100;
  
  const total = end - start;
  const elapsed = now - start;
  
  return Math.round((elapsed / total) * 100);
};

/**
 * Get days until deadline
 * @param {Date} deadline - Deadline date
 * @returns {number} - Days remaining (negative if overdue)
 */
const getDaysUntilDeadline = (deadline) => {
  if (!deadline) return null;
  
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diffTime = deadlineDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};

/**
 * Check if deadline is approaching (within 3 days)
 * @param {Date} deadline - Deadline date
 * @returns {boolean}
 */
const isDeadlineApproaching = (deadline) => {
  const daysRemaining = getDaysUntilDeadline(deadline);
  return daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 3;
};

/**
 * Check if deadline is overdue
 * @param {Date} deadline - Deadline date
 * @returns {boolean}
 */
const isDeadlineOverdue = (deadline) => {
  const daysRemaining = getDaysUntilDeadline(deadline);
  return daysRemaining !== null && daysRemaining < 0;
};

/**
 * Create success response
 * @param {object} data - Response data
 * @param {string} message - Success message
 * @returns {object} - Success response object
 */
const successResponse = (data, message = 'Success') => {
  return {
    success: true,
    message,
    data
  };
};

/**
 * Create error response
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @returns {object} - Error response object
 */
const errorResponse = (message = 'Error', statusCode = 500) => {
  return {
    success: false,
    message,
    statusCode
  };
};

module.exports = {
  // Date & Time
  formatDate,
  formatDateTime,
  formatTime,
  calculateHoursDifference,
  calculateWorkingHours,
  isToday,
  isCurrentMonth,
  getCurrentMonthDates,
  getCurrentWeekDates,
  
  // Attendance & Tasks
  calculateAttendancePercentage,
  calculateTaskCompletion,
  calculateProjectProgress,
  getDaysUntilDeadline,
  isDeadlineApproaching,
  isDeadlineOverdue,
  
  // ID Generation
  generateRandomString,
  generateEmployeeId,
  generateClientId,
  generateProjectCode,
  
  // String Manipulation
  sanitizeString,
  capitalizeWords,
  
  // Formatting
  formatCurrency,
  formatFileSize,
  
  // Validation
  isValidEmail,
  isValidPhone,
  
  // Array Operations
  paginate,
  sortArray,
  removeDuplicates,
  
  // Response Helpers
  successResponse,
  errorResponse
};