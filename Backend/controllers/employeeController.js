// controllers/employeeController.js
// Employee Dashboard, Profile, Tasks, Projects, Daily Reports Management

const Employee = require('../models/Employee');
const User = require('../models/User');
const Task = require('../models/Task');
const Project = require('../models/Project');
const DailyReport = require('../models/DailyReport');
const Attendance = require('../models/Attendance');
const Meeting = require('../models/Meeting');

// ==================== DASHBOARD ====================

// @desc    Get employee dashboard data
// @route   GET /api/employee/dashboard
// @access  Private (Employee)
exports.getEmployeeDashboard = async (req, res) => {
  try {
    const employeeId = req.user.id;

    // Get employee profile
    const employee = await Employee.findOne({ userId: employeeId })
      .populate('userId', 'name email');

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee profile not found'
      });
    }

    // Get today's attendance status
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayAttendance = await Attendance.findOne({
      employeeId: employee._id,
      date: { $gte: today }
    });

    // Get active tasks count
    const activeTasks = await Task.countDocuments({
      assignedTo: employee._id,
      status: { $in: ['pending', 'in-progress'] }
    });

    // Get completed tasks count (this month)
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const completedTasksThisMonth = await Task.countDocuments({
      assignedTo: employee._id,
      status: 'completed',
      completedAt: { $gte: startOfMonth }
    });

    // Get active projects
    const activeProjects = await Project.countDocuments({
      team: employee._id,
      status: { $in: ['planning', 'in-progress'] }
    });

    // Get upcoming meetings (next 7 days)
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const upcomingMeetings = await Meeting.countDocuments({
      participants: employee._id,
      scheduledAt: {
        $gte: new Date(),
        $lte: nextWeek
      }
    });

    // Get recent tasks (last 5)
    const recentTasks = await Task.find({
      assignedTo: employee._id
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('projectId', 'name')
      .select('title status priority dueDate');

    // Get pending daily reports count
    const pendingReports = await DailyReport.countDocuments({
      employeeId: employee._id,
      status: 'pending'
    });

    // Calculate attendance percentage (this month)
    const workingDays = await Attendance.countDocuments({
      employeeId: employee._id,
      date: { $gte: startOfMonth },
      status: 'present'
    });
    
    const totalDays = new Date().getDate();
    const attendancePercentage = totalDays > 0 
      ? Math.round((workingDays / totalDays) * 100) 
      : 0;

    res.status(200).json({
      success: true,
      data: {
        employee: {
          name: employee.userId.name,
          email: employee.userId.email,
          department: employee.department,
          position: employee.position,
          employeeId: employee.employeeId
        },
        stats: {
          activeTasks,
          completedTasksThisMonth,
          activeProjects,
          upcomingMeetings,
          pendingReports,
          attendancePercentage
        },
        todayAttendance: todayAttendance ? {
          status: todayAttendance.status,
          checkInTime: todayAttendance.checkInTime,
          checkOutTime: todayAttendance.checkOutTime
        } : null,
        recentTasks
      }
    });

  } catch (error) {
    console.error('Get employee dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ==================== PROFILE ====================

// @desc    Get employee profile
// @route   GET /api/employee/profile
// @access  Private (Employee)
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id; // This is the USER ID from JWT token

    console.log('📋 Fetching profile for userId:', userId);

    // First, get user info
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('✅ User found:', user.email);

    // Get employee details using userId
    const employee = await Employee.findOne({ userId: userId })
      .populate('userId', 'name email phone avatar isActive createdAt')
      .populate('reportingTo', 'userId employeeId designation department'); // Fixed: reportingTo instead of managerId

    if (!employee) {
      console.log('❌ Employee profile not found for userId:', userId);
      return res.status(404).json({
        success: false,
        message: 'Employee profile not found. Please contact admin.'
      });
    }

    console.log('✅ Employee found:', employee.employeeId);

    // Prepare manager info if reportingTo exists
    let managerInfo = null;
    if (employee.reportingTo) {
      // Need to populate the userId inside reportingTo
      const reportingManager = await Employee.findById(employee.reportingTo._id)
        .populate('userId', 'name email');
      
      if (reportingManager) {
        managerInfo = {
          name: reportingManager.userId.name,
          email: reportingManager.userId.email,
          employeeId: reportingManager.employeeId,
          designation: reportingManager.designation,
          department: reportingManager.department
        };
      }
    }

    // Combine user and employee data
    const profileData = {
      // User fields
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      role: user.role,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      
      // Employee fields
      employeeId: employee.employeeId,
      employeeProfileId: employee._id, // The Employee document _id
      designation: employee.designation,
      department: employee.department,
      joiningDate: employee.joiningDate,
      salary: employee.salary,
      reportingTo: managerInfo, // Use populated manager info
      skills: employee.skills || [],
      experience: employee.experience || 0,
      address: employee.address || {},
      emergencyContact: employee.emergencyContact || {},
      bankDetails: employee.bankDetails || {},
      documents: employee.documents || [],
      performance: employee.performance || {},
      attendance: employee.attendance || {},
      isActive: employee.isActive,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt
    };

    console.log('📦 Sending profile data for:', profileData.name);

    res.status(200).json({
      success: true,
      data: profileData
    });

  } catch (error) {
    console.error('❌ Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update employee profile
// @route   PUT /api/employee/profile
// @access  Private (Employee)
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      phone,
      address,
      dateOfBirth,
      emergencyContact,
      emergencyPhone, // Get phone separately
      bloodGroup,
      skills,
      bio
    } = req.body;

    console.log('🔄 Updating profile for userId:', userId);

    // 1. Update User document (phone, etc.)
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update user phone if provided
    if (phone) {
      user.phone = phone;
      await user.save();
    }

    // 2. Update Employee document
    const employee = await Employee.findOne({ userId: userId });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee profile not found'
      });
    }

    // Parse address string into object
    if (address) {
      const addressParts = address.split(',').map(part => part.trim());
      employee.address = {
        street: addressParts[0] || '',
        city: addressParts[1] || '',
        state: addressParts[2] || '',
        country: addressParts[3] || '',
        zipCode: addressParts[4] || ''
      };
    }

    if (dateOfBirth) employee.dateOfBirth = dateOfBirth;
    
    // Update emergency contact
    if (emergencyContact || emergencyPhone) {
      employee.emergencyContact = {
        name: emergencyContact || employee.emergencyContact?.name || '',
        relationship: employee.emergencyContact?.relationship || 'Family',
        phone: emergencyPhone || employee.emergencyContact?.phone || ''
      };
    }
    
    if (bloodGroup) employee.bloodGroup = bloodGroup;
    if (skills) employee.skills = Array.isArray(skills) ? skills : skills.split(',').map(s => s.trim());
    if (bio) employee.bio = bio;

    await employee.save();

    console.log('✅ Profile updated for employee:', employee.employeeId);

    // Get updated data
    const updatedUser = await User.findById(userId).select('-password');
    const updatedEmployee = await Employee.findOne({ userId })
      .populate('userId', 'name email');

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: updatedUser,
        employee: updatedEmployee
      }
    });

  } catch (error) {
    console.error('❌ Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Change password
// @route   POST /api/employee/profile/change-password
// @access  Private (Employee)
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password'
      });
    }

    const user = await User.findById(req.user.id).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get activity log
// @route   GET /api/employee/profile/activity
// @access  Private (Employee)
exports.getActivityLog = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const { limit = 20 } = req.query;

    const employee = await Employee.findOne({ userId: employeeId });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Get recent activities from multiple sources
    const recentTasks = await Task.find({
      $or: [
        { assignedTo: employee._id },
        { createdBy: employeeId }
      ]
    })
      .sort({ updatedAt: -1 })
      .limit(parseInt(limit))
      .select('title status updatedAt')
      .lean();

    const recentReports = await DailyReport.find({
      employeeId: employee._id
    })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select('date status createdAt')
      .lean();

    const recentAttendance = await Attendance.find({
      employeeId: employee._id
    })
      .sort({ date: -1 })
      .limit(parseInt(limit))
      .select('date status checkInTime checkOutTime')
      .lean();

    // Combine and format activities
    const activities = [
      ...recentTasks.map(task => ({
        type: 'task',
        title: `Task: ${task.title}`,
        status: task.status,
        timestamp: task.updatedAt
      })),
      ...recentReports.map(report => ({
        type: 'report',
        title: `Daily Report: ${report.date.toISOString().split('T')[0]}`,
        status: report.status,
        timestamp: report.createdAt
      })),
      ...recentAttendance.map(att => ({
        type: 'attendance',
        title: `Attendance: ${att.date.toISOString().split('T')[0]}`,
        status: att.status,
        timestamp: att.checkInTime || att.date
      }))
    ];

    // Sort by timestamp and limit
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const limitedActivities = activities.slice(0, parseInt(limit));

    res.status(200).json({
      success: true,
      data: limitedActivities
    });

  } catch (error) {
    console.error('Get activity log error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ==================== TASKS ====================

// @desc    Get my tasks
// @route   GET /api/employee/tasks
// @access  Private (Employee)
exports.getMyTasks = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const { status, priority, page = 1, limit = 10 } = req.query;

    const employee = await Employee.findOne({ userId: employeeId });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Build query
    const query = { assignedTo: employee._id };
    if (status) query.status = status;
    if (priority) query.priority = priority;

    // Get tasks with pagination
    const tasks = await Task.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('projectId', 'name status')
      .populate('assignedBy', 'name email');

    const count = await Task.countDocuments(query);

    res.status(200).json({
      success: true,
      data: tasks,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('Get my tasks error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get single task
// @route   GET /api/employee/tasks/:id
// @access  Private (Employee)
exports.getTask = async (req, res) => {
  try {
    const { id } = req.params;
    const employeeId = req.user.id;

    const employee = await Employee.findOne({ userId: employeeId });

    const task = await Task.findOne({
      _id: id,
      assignedTo: employee._id
    })
      .populate('projectId', 'name status')
      .populate('assignedBy', 'name email')
      .populate('assignedTo', 'userId');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found or not assigned to you'
      });
    }

    res.status(200).json({
      success: true,
      data: task
    });

  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update task status
// @route   PATCH /api/employee/tasks/:id/status
// @access  Private (Employee)
exports.updateTaskStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const employeeId = req.user.id;

    const employee = await Employee.findOne({ userId: employeeId });

    const task = await Task.findOne({
      _id: id,
      assignedTo: employee._id
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Validate status
    const validStatuses = ['pending', 'in-progress', 'completed', 'on-hold'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    task.status = status;
    if (status === 'completed') {
      task.completedAt = new Date();
    }

    await task.save();

    res.status(200).json({
      success: true,
      message: 'Task status updated successfully',
      data: task
    });

  } catch (error) {
    console.error('Update task status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Add comment to task
// @route   POST /api/employee/tasks/:id/comments
// @access  Private (Employee)
exports.addTaskComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const employeeId = req.user.id;

    if (!comment) {
      return res.status(400).json({
        success: false,
        message: 'Comment is required'
      });
    }

    const employee = await Employee.findOne({ userId: employeeId });

    const task = await Task.findOne({
      _id: id,
      assignedTo: employee._id
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    task.comments.push({
      userId: employeeId,
      comment,
      createdAt: new Date()
    });

    await task.save();

    const updatedTask = await Task.findById(id)
      .populate('comments.userId', 'name email');

    res.status(200).json({
      success: true,
      message: 'Comment added successfully',
      data: updatedTask
    });

  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Start task timer
// @route   POST /api/employee/tasks/:id/timer/start
// @access  Private (Employee)
exports.startTaskTimer = async (req, res) => {
  try {
    const { id } = req.params;
    const employeeId = req.user.id;

    const employee = await Employee.findOne({ userId: employeeId });

    const task = await Task.findOne({
      _id: id,
      assignedTo: employee._id
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    if (task.timer && task.timer.isRunning) {
      return res.status(400).json({
        success: false,
        message: 'Timer is already running'
      });
    }

    task.timer = {
      isRunning: true,
      startTime: new Date()
    };

    // Auto-update status to in-progress if pending
    if (task.status === 'pending') {
      task.status = 'in-progress';
    }

    await task.save();

    res.status(200).json({
      success: true,
      message: 'Timer started successfully',
      data: task
    });

  } catch (error) {
    console.error('Start timer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Stop task timer
// @route   POST /api/employee/tasks/:id/timer/stop
// @access  Private (Employee)
exports.stopTaskTimer = async (req, res) => {
  try {
    const { id } = req.params;
    const employeeId = req.user.id;

    const employee = await Employee.findOne({ userId: employeeId });

    const task = await Task.findOne({
      _id: id,
      assignedTo: employee._id
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    if (!task.timer || !task.timer.isRunning) {
      return res.status(400).json({
        success: false,
        message: 'Timer is not running'
      });
    }

    const endTime = new Date();
    const startTime = task.timer.startTime;
    const duration = Math.floor((endTime - startTime) / 1000); // Duration in seconds

    task.timer = {
      isRunning: false,
      startTime: null,
      totalTime: (task.timer.totalTime || 0) + duration
    };

    await task.save();

    res.status(200).json({
      success: true,
      message: 'Timer stopped successfully',
      data: {
        task,
        sessionDuration: duration,
        totalTime: task.timer.totalTime
      }
    });

  } catch (error) {
    console.error('Stop timer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get task timer status
// @route   GET /api/employee/tasks/:id/timer
// @access  Private (Employee)
exports.getTaskTimer = async (req, res) => {
  try {
    const { id } = req.params;
    const employeeId = req.user.id;

    const employee = await Employee.findOne({ userId: employeeId });

    const task = await Task.findOne({
      _id: id,
      assignedTo: employee._id
    }).select('timer title status');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        title: task.title,
        status: task.status,
        timer: task.timer || {
          isRunning: false,
          startTime: null,
          totalTime: 0
        }
      }
    });

  } catch (error) {
    console.error('Get timer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ==================== PROJECTS ====================

// @desc    Get my projects
// @route   GET /api/employee/projects
// @access  Private (Employee)
exports.getMyProjects = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const { status } = req.query;

    const employee = await Employee.findOne({ userId: employeeId });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Build query
    const query = { team: employee._id };
    if (status) query.status = status;

    const projects = await Project.find(query)
      .sort({ createdAt: -1 })
      .populate('clientId', 'name email company')
      .populate('team', 'userId')
      .populate({
        path: 'team',
        populate: {
          path: 'userId',
          select: 'name email'
        }
      });

    res.status(200).json({
      success: true,
      data: projects
    });

  } catch (error) {
    console.error('Get my projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get single project
// @route   GET /api/employee/projects/:id
// @access  Private (Employee)
exports.getProject = async (req, res) => {
  try {
    const { id } = req.params;
    const employeeId = req.user.id;

    const employee = await Employee.findOne({ userId: employeeId });

    const project = await Project.findOne({
      _id: id,
      team: employee._id
    })
      .populate('clientId', 'name email company phone')
      .populate('team', 'userId department position')
      .populate({
        path: 'team',
        populate: {
          path: 'userId',
          select: 'name email'
        }
      });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or you are not a team member'
      });
    }

    // Get project tasks
    const tasks = await Task.find({
      projectId: project._id,
      assignedTo: employee._id
    })
      .sort({ createdAt: -1 })
      .select('title status priority dueDate');

    res.status(200).json({
      success: true,
      data: {
        project,
        myTasks: tasks
      }
    });

  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ==================== DAILY REPORTS ====================

// @desc    Submit daily report
// @route   POST /api/employee/reports/daily
// @access  Private (Employee)
exports.submitDailyReport = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const {
      date,
      tasksCompleted,
      tasksInProgress,
      blockers,
      achievements,
      nextDayPlan,
      workHours
    } = req.body;

    const employee = await Employee.findOne({ userId: employeeId });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Check if report already exists for this date
    const reportDate = date ? new Date(date) : new Date();
    reportDate.setHours(0, 0, 0, 0);

    const existingReport = await DailyReport.findOne({
      employeeId: employee._id,
      date: reportDate
    });

    if (existingReport) {
      return res.status(400).json({
        success: false,
        message: 'Daily report for this date already exists'
      });
    }

    const dailyReport = await DailyReport.create({
      employeeId: employee._id,
      date: reportDate,
      tasksCompleted: tasksCompleted || [],
      tasksInProgress: tasksInProgress || [],
      blockers: blockers || [],
      achievements: achievements || '',
      nextDayPlan: nextDayPlan || '',
      workHours: workHours || 0,
      status: 'pending'
    });

    res.status(201).json({
      success: true,
      message: 'Daily report submitted successfully',
      data: dailyReport
    });

  } catch (error) {
    console.error('Submit daily report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get my daily reports
// @route   GET /api/employee/reports
// @access  Private (Employee)
exports.getMyReports = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const { page = 1, limit = 10, status } = req.query;

    const employee = await Employee.findOne({ userId: employeeId });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const query = { employeeId: employee._id };
    if (status) query.status = status;

    const reports = await DailyReport.find(query)
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await DailyReport.countDocuments(query);

    res.status(200).json({
      success: true,
      data: reports,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('Get my reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get single daily report
// @route   GET /api/employee/reports/:id
// @access  Private (Employee)
exports.getReport = async (req, res) => {
  try {
    const { id } = req.params;
    const employeeId = req.user.id;

    const employee = await Employee.findOne({ userId: employeeId });

    const report = await DailyReport.findOne({
      _id: id,
      employeeId: employee._id
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    res.status(200).json({
      success: true,
      data: report
    });

  } catch (error) {
    console.error('Get report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update daily report
// @route   PUT /api/employee/reports/:id
// @access  Private (Employee)
exports.updateDailyReport = async (req, res) => {
  try {
    const { id } = req.params;
    const employeeId = req.user.id;
    const {
      tasksCompleted,
      tasksInProgress,
      blockers,
      achievements,
      nextDayPlan,
      workHours
    } = req.body;

    const employee = await Employee.findOne({ userId: employeeId });

    const report = await DailyReport.findOne({
      _id: id,
      employeeId: employee._id
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Only allow updates if report is pending
    if (report.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update approved or rejected reports'
      });
    }

    // Update fields
    if (tasksCompleted) report.tasksCompleted = tasksCompleted;
    if (tasksInProgress) report.tasksInProgress = tasksInProgress;
    if (blockers) report.blockers = blockers;
    if (achievements) report.achievements = achievements;
    if (nextDayPlan) report.nextDayPlan = nextDayPlan;
    if (workHours !== undefined) report.workHours = workHours;

    await report.save();

    res.status(200).json({
      success: true,
      message: 'Report updated successfully',
      data: report
    });

  } catch (error) {
    console.error('Update report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ==================== MEETINGS ====================

// @desc    Get my meetings
// @route   GET /api/employee/meetings
// @access  Private (Employee)
exports.getMyMeetings = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const { upcoming } = req.query;

    const employee = await Employee.findOne({ userId: employeeId });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const query = { participants: employee._id };

    // Filter for upcoming meetings
    if (upcoming === 'true') {
      query.scheduledAt = { $gte: new Date() };
    }

    const meetings = await Meeting.find(query)
      .sort({ scheduledAt: upcoming === 'true' ? 1 : -1 })
      .populate('organizer', 'name email')
      .populate('participants', 'userId')
      .populate({
        path: 'participants',
        populate: {
          path: 'userId',
          select: 'name email'
        }
      });

    res.status(200).json({
      success: true,
      data: meetings
    });

  } catch (error) {
    console.error('Get my meetings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get single meeting
// @route   GET /api/employee/meetings/:id
// @access  Private (Employee)
exports.getMeeting = async (req, res) => {
  try {
    const { id } = req.params;
    const employeeId = req.user.id;

    const employee = await Employee.findOne({ userId: employeeId });

    const meeting = await Meeting.findOne({
      _id: id,
      participants: employee._id
    })
      .populate('organizer', 'name email')
      .populate('participants', 'userId department position')
      .populate({
        path: 'participants',
        populate: {
          path: 'userId',
          select: 'name email'
        }
      });

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found or you are not a participant'
      });
    }

    res.status(200).json({
      success: true,
      data: meeting
    });

  } catch (error) {
    console.error('Get meeting error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

module.exports = exports;