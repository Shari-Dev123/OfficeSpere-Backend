// ============================================
// JWT Configuration
// ============================================

const jwt = require('jsonwebtoken');

// JWT Configuration Object
const jwtConfig = {
  secret: process.env.JWT_SECRET || 'default_secret_key',
  expiresIn: process.env.JWT_EXPIRE || '7d',
  algorithm: 'HS256',
};

/**
 * Generate JWT Token
 * @param {Object} payload - Data to encode in token
 * @returns {String} - JWT token
 */
const generateToken = (payload) => {
  return jwt.sign(payload, jwtConfig.secret, {
    expiresIn: jwtConfig.expiresIn,
    algorithm: jwtConfig.algorithm,
  });
};

/**
 * Verify JWT Token
 * @param {String} token - JWT token to verify
 * @returns {Object} - Decoded token payload
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, jwtConfig.secret);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

/**
 * Decode JWT Token (without verification)
 * @param {String} token - JWT token to decode
 * @returns {Object} - Decoded token payload
 */
const decodeToken = (token) => {
  return jwt.decode(token);
};

/**
 * Generate token for user
 * @param {Object} user - User object from database
 * @returns {String} - JWT token
 */
const generateUserToken = (user) => {
  const payload = {
    id: user._id,
    email: user.email,
    role: user.role,
  };

  return generateToken(payload);
};

/**
 * Extract token from request header
 * @param {Object} req - Express request object
 * @returns {String|null} - Token or null
 */
const extractTokenFromHeader = (req) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7); // Remove 'Bearer ' prefix
  }
  
  return null;
};

module.exports = {
  jwtConfig,
  generateToken,
  verifyToken,
  decodeToken,
  generateUserToken,
  extractTokenFromHeader,
};