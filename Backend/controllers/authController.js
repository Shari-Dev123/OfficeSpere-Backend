const User = require('../models/User');
const Employee = require('../models/Employee');
const Client = require('../models/Client');
const Admin = require('../models/Admin');
const { generateToken } = require('../utils/generateToken');
const bcrypt = require('bcryptjs');

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, phone, department, designation, company } = req.body;

    // Validate required fields
    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields (name, email, password, role)'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Validate role
    const validRoles = ['admin', 'employee', 'client'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be admin, employee, or client'
      });
    }

    // Create user object
    const userData = {
      name,
      email,
      password,
      role,
      phone,
      isActive: true
    };

    // For employee registration
    if (role === 'employee') {
      if (!department || !designation) {
        return res.status(400).json({
          success: false,
          message: 'For employee registration, department and designation are required'
        });
      }
      userData.department = department;
      userData.designation = designation;
    }

    // For client registration
    if (role === 'client' && company) {
      userData.company = company;
    }

    // 1. Create User
    const user = await User.create(userData);

    // 2. Create Role-specific Profile
    let roleProfile = null;
    let profileResponse = null;

    if (role === 'employee') {
      // Generate employee ID
      const employeeCount = await Employee.countDocuments();
      const employeeId = `EMP${(employeeCount + 1).toString().padStart(4, '0')}`;
      
      roleProfile = await Employee.create({
        userId: user._id,
        employeeId: employeeId,
        designation: designation,
        department: department,
        joiningDate: new Date(),
        salary: 0, // Default salary, admin can update later
        isActive: true
      });

      profileResponse = {
        employeeId: roleProfile.employeeId,
        designation: roleProfile.designation,
        department: roleProfile.department,
        joiningDate: roleProfile.joiningDate
      };

    } else if (role === 'client') {
      // Generate client ID
      const clientCount = await Client.countDocuments();
      const clientId = `CLI${(clientCount + 1).toString().padStart(4, '0')}`;
      
      roleProfile = await Client.create({
        userId: user._id,
        clientId: clientId,
        companyName: company || `${name}'s Company`,
        companyEmail: email,
        isActive: true
      });

      profileResponse = {
        clientId: roleProfile.clientId,
        companyName: roleProfile.companyName,
        companyEmail: roleProfile.companyEmail
      };

    } else if (role === 'admin') {
      // Only allow admin creation in specific scenarios
      // You might want to restrict this to only be done via seed script
      roleProfile = await Admin.create({
        userId: user._id,
        designation: 'System Administrator',
        permissions: {
          manageEmployees: true,
          manageClients: true,
          manageProjects: true,
          manageTasks: true,
          manageAttendance: true,
          manageMeetings: true,
          viewReports: true,
          manageSettings: true,
        }
      });

      profileResponse = {
        designation: roleProfile.designation,
        permissions: roleProfile.permissions
      };
    }

    // 3. Generate JWT token
    const token = generateToken(user._id);

    // 4. Prepare response
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      department: user.department,
      designation: user.designation,
      isActive: user.isActive,
      createdAt: user.createdAt,
      profile: profileResponse // Include role profile in response
    };

    res.status(201).json({
      success: true,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} registered successfully`,
      token,
      user: userResponse
    });

  } catch (error) {
    console.error('Register error:', error);
    
    // If user was created but role profile failed, delete the user
    if (error.message.includes('E11000')) {
      // Duplicate key error
      return res.status(400).json({
        success: false,
        message: 'Duplicate entry detected. Please try with different details.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: error.message
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // Validate required fields
    if (!email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email, password, and role'
      });
    }

    // Find user by email
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated. Please contact admin.'
      });
    }

    // Check if role matches
    if (user.role !== role) {
      return res.status(401).json({
        success: false,
        message: `Invalid credentials for ${role} login`
      });
    }

    // Verify password
    const isPasswordMatch = await user.comparePassword(password);

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    user.lastLogin = Date.now();
    await user.save();

    // Generate JWT token
    const token = generateToken(user._id);

    // Remove password from response
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      department: user.department,
      designation: user.designation,
      avatar: user.avatar,
      isActive: user.isActive,
      lastLogin: user.lastLogin
    };

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: userResponse
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: error.message
    });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res) => {
  try {
    // In a stateless JWT system, logout is handled on frontend
    // But we can log the logout action here
    
    res.status(200).json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during logout',
      error: error.message
    });
  }
};

// @desc    Verify JWT token
// @route   GET /api/auth/verify
// @access  Private
exports.verifyToken = async (req, res) => {
  try {
    // req.user is set by auth middleware
    const user = await User.findById(req.user.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account deactivated'
      });
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        department: user.department,
        designation: user.designation,
        avatar: user.avatar,
        isActive: user.isActive
      }
    });

  } catch (error) {
    console.error('Verify token error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during token verification',
      error: error.message
    });
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email address'
      });
    }

    // Find user
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found with this email'
      });
    }

    // Generate reset token (you can use crypto or JWT)
    const resetToken = generateToken(user._id, '1h'); // 1 hour expiry

    // Save reset token to user (you may want to add resetPasswordToken field to User model)
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpire = Date.now() + 3600000; // 1 hour
    await user.save();

    // Send email with reset link
    // const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    // await sendEmail({
    //   to: user.email,
    //   subject: 'Password Reset Request',
    //   text: `Click here to reset your password: ${resetUrl}`
    // });

    res.status(200).json({
      success: true,
      message: 'Password reset email sent',
      resetToken // Remove this in production, send via email only
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending password reset email',
      error: error.message
    });
  }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide token and new password'
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Find user with valid reset token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Update password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // Generate new token
    const newToken = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Password reset successful',
      token: newToken
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting password',
      error: error.message
    });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      user
    });

  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update user password
// @route   PUT /api/auth/update-password
// @access  Private
exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password'
      });
    }

    // Get user with password
    const user = await User.findById(req.user.id).select('+password');

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Validate new password
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Generate new token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Password updated successfully',
      token
    });

  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating password',
      error: error.message
    });
  }
};