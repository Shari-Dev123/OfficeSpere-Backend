// middleware/auth.js
// JWT Authentication & Authorization Middleware

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect routes - Verify JWT token
 * Usage: router.get('/protected', protect, controller)
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      // Extract token from "Bearer TOKEN"
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route. No token provided.'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Find user by ID from token
      req.user = await User.findById(decoded.id).select('-password');

      // Check if user still exists
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User no longer exists'
        });
      }

      // Check if user is active
      if (!req.user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Your account has been deactivated'
        });
      }

      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route. Invalid token.'
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error in authentication',
      error: error.message
    });
  }
};

/**
 * Authorize specific roles
 * Usage: router.get('/admin', protect, authorize('admin'), controller)
 * Usage: router.get('/admin-employee', protect, authorize('admin', 'employee'), controller)
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized. Please login first.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route`
      });
    }

    next();
  };
};

/**
 * Optional auth - Doesn't fail if no token, but attaches user if token is valid
 * Usage: router.get('/public-or-private', optionalAuth, controller)
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id).select('-password');
      } catch (error) {
        // Token invalid, but continue without user
        req.user = null;
      }
    }

    next();
  } catch (error) {
    next();
  }
};

/**
 * Check if user owns the resource
 * Usage: router.put('/profile/:id', protect, checkOwnership('id'), controller)
 */
const checkOwnership = (paramName = 'id') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized. Please login first.'
      });
    }

    const resourceId = req.params[paramName];
    
    // Admin can access everything
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user owns the resource
    if (req.user._id.toString() !== resourceId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to access this resource'
      });
    }

    next();
  };
};

module.exports = { 
  protect, 
  authorize, 
  optionalAuth, 
  checkOwnership,
  // Aliases for backward compatibility
  auth: protect
};