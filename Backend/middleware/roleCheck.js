// middleware/roleCheck.js
// Role-Based Access Control Middleware

/**
 * Check if user has required role
 * Usage: router.get('/admin-only', auth, roleCheck('admin'), controller)
 * 
 * @param {...string} roles - Allowed roles (admin, employee, client)
 */
const roleCheck = (...roles) => {
  return (req, res, next) => {
    // Check if user exists (must use auth middleware first)
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Check if user's role is in allowed roles
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. This route is restricted to ${roles.join(', ')} only.`,
        userRole: req.user.role,
        requiredRoles: roles
      });
    }

    // User has required role
    next();
  };
};

/**
 * Admin only access
 * Usage: router.get('/admin-route', auth, adminOnly, controller)
 */
const adminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.',
      userRole: req.user.role
    });
  }

  next();
};

/**
 * Employee only access
 * Usage: router.get('/employee-route', auth, employeeOnly, controller)
 */
const employeeOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.role !== 'employee') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Employee privileges required.',
      userRole: req.user.role
    });
  }

  next();
};

/**
 * Client only access
 * Usage: router.get('/client-route', auth, clientOnly, controller)
 */
const clientOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.role !== 'client') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Client privileges required.',
      userRole: req.user.role
    });
  }

  next();
};

/**
 * Admin or Employee access
 * Usage: router.get('/internal-route', auth, adminOrEmployee, controller)
 */
const adminOrEmployee = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.role !== 'admin' && req.user.role !== 'employee') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Internal access only (Admin or Employee).',
      userRole: req.user.role
    });
  }

  next();
};

/**
 * Check if user owns the resource
 * Usage: router.get('/profile/:id', auth, ownerOrAdmin, controller)
 */
const ownerOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Admin can access any resource
  if (req.user.role === 'admin') {
    return next();
  }

  // Check if user owns the resource
  const resourceUserId = req.params.id || req.params.userId;
  
  if (req.user._id.toString() !== resourceUserId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You can only access your own resources.',
      userId: req.user._id,
      resourceId: resourceUserId
    });
  }

  next();
};

/**
 * Check if user is accessing their own data or is admin
 * Usage: router.put('/users/:id', auth, selfOrAdmin, controller)
 */
const selfOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  const targetUserId = req.params.id || req.params.userId || req.body.userId;

  // Admin can access any user
  if (req.user.role === 'admin') {
    return next();
  }

  // Check if user is accessing their own data
  if (req.user._id.toString() !== targetUserId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You can only modify your own data.',
      userId: req.user._id,
      targetId: targetUserId
    });
  }

  next();
};

module.exports = {
  roleCheck,
  adminOnly,
  employeeOnly,
  clientOnly,
  adminOrEmployee,
  ownerOrAdmin,
  selfOrAdmin
};