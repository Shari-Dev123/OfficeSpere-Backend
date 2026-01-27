// utils/generateToken.js
// Generate JWT token for authentication

const jwt = require('jsonwebtoken');

/**
 * Generate JWT Token
 * @param {string} userId - User ID to encode in token
 * @param {string} role - User role (admin, employee, client)
 * @returns {string} - JWT token
 */
const generateToken = (userId, role) => {
  try {
    const payload = {
      id: userId,
      role: role,
      timestamp: Date.now()
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRE || '7d',
        issuer: 'OfficeSphere',
        audience: 'OfficeSphere-Users'
      }
    );

    return token;
  } catch (error) {
    console.error('Error generating token:', error);
    throw new Error('Token generation failed');
  }
};

/**
 * Verify JWT Token
 * @param {string} token - JWT token to verify
 * @returns {object} - Decoded token payload
 */
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET,
      {
        issuer: 'OfficeSphere',
        audience: 'OfficeSphere-Users'
      }
    );
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    } else {
      throw new Error('Token verification failed');
    }
  }
};

/**
 * Decode Token without verification (for debugging)
 * @param {string} token - JWT token to decode
 * @returns {object} - Decoded token payload
 */
const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
};

/**
 * Generate Refresh Token (longer expiry)
 * @param {string} userId - User ID
 * @param {string} role - User role
 * @returns {string} - Refresh token
 */
const generateRefreshToken = (userId, role) => {
  try {
    const payload = {
      id: userId,
      role: role,
      type: 'refresh',
      timestamp: Date.now()
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      {
        expiresIn: '30d', // Refresh tokens last longer
        issuer: 'OfficeSphere',
        audience: 'OfficeSphere-Users'
      }
    );

    return token;
  } catch (error) {
    console.error('Error generating refresh token:', error);
    throw new Error('Refresh token generation failed');
  }
};

/**
 * Generate Password Reset Token (short expiry)
 * @param {string} userId - User ID
 * @param {string} email - User email
 * @returns {string} - Reset token
 */
const generateResetToken = (userId, email) => {
  try {
    const payload = {
      id: userId,
      email: email,
      type: 'reset',
      timestamp: Date.now()
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      {
        expiresIn: '1h', // Reset tokens expire quickly
        issuer: 'OfficeSphere',
        audience: 'OfficeSphere-PasswordReset'
      }
    );

    return token;
  } catch (error) {
    console.error('Error generating reset token:', error);
    throw new Error('Reset token generation failed');
  }
};

/**
 * Verify Reset Token
 * @param {string} token - Reset token to verify
 * @returns {object} - Decoded token payload
 */
const verifyResetToken = (token) => {
  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET,
      {
        issuer: 'OfficeSphere',
        audience: 'OfficeSphere-PasswordReset'
      }
    );
    
    if (decoded.type !== 'reset') {
      throw new Error('Invalid reset token');
    }
    
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Reset token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid reset token');
    } else {
      throw new Error('Reset token verification failed');
    }
  }
};

module.exports = {
  generateToken,
  verifyToken,
  decodeToken,
  generateRefreshToken,
  generateResetToken,
  verifyResetToken
};