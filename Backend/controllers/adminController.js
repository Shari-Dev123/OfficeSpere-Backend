// ============================================
// Admin Controller
// Handles all admin-related operations
// ============================================

const User = require('../models/User');
const Employee = require('../models/Employee');
const Client = require('../models/Client');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Attendance = require('../models/Attendance');
const Meeting = require('../models/Meeting');
const DailyReport = require('../models/DailyReport');

// ============================================
// DASHBOARD
// ============================================

// @desc    Get admin dashboard statistics
// @route   GET /api/admin/dashboard
// @access  Private/Admin
exports.getDashboard = async (req, res) => {
  try {
    // Get counts
    const totalEmployees = await Employee.countDocuments({ isActive: true });
    const totalClients = await Client.countDocuments({ isActive: true });
    const totalProjects = await Project.countDocuments();
    const activeProjects = await Project.countDocuments({ status: 'in-progress' });
    const completedProjects = await Project.countDocuments({ status: 'completed' });
    const totalTasks = await Task.countDocuments();
    const pendingTasks = await Task.countDocuments({ status: 'pending' });
    const inProgressTasks = await Task.countDocuments({ status: 'in-progress' });
    const completedTasks = await Task.countDocuments({ status: 'completed' });

    // Get today's attendance
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayAttendance = await Attendance.countDocuments({
      checkIn: { $gte: today, $lt: tomorrow }
    });

    const presentEmployees = todayAttendance;
    const absentEmployees = totalEmployees - presentEmployees;

    // Get recent activities (last 10)
    const recentProjects = await Project.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('client', 'name email')
      .select('name status startDate endDate');

    const recentTasks = await Task.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('assignedTo', 'name email')
      .select('title status priority dueDate');

    // Get upcoming meetings
    const upcomingMeetings = await Meeting.find({
      date: { $gte: new Date() }
    })
      .sort({ date: 1 })
      .limit(5)
      .populate('participants', 'name email')
      .select('title date time location');

    // Get late arrivals today
    const lateArrivals = await Attendance.find({
      checkIn: { $gte: today, $lt: tomorrow },
      isLate: true
    })
      .populate('employee', 'name email')
      .select('employee checkIn');

    res.status(200).json({
      success: true,
      data: {
        stats: {
          employees: {
            total: totalEmployees,
            present: presentEmployees,
            absent: absentEmployees
          },
          clients: {
            total: totalClients
          },
          projects: {
            total: totalProjects,
            active: activeProjects,
            completed: completedProjects
          },
          tasks: {
            total: totalTasks,
            pending: pendingTasks,
            inProgress: inProgressTasks,
            completed: completedTasks
          },
          attendance: {
            present: presentEmployees,
            absent: absentEmployees,
            lateArrivals: lateArrivals.length
          }
        },
        recentActivities: {
          projects: recentProjects,
          tasks: recentTasks
        },
        upcomingMeetings,
        lateArrivals
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard data',
      error: error.message
    });
  }
};

// ============================================
// EMPLOYEE MANAGEMENT
// ============================================

// @desc    Get all employees
// @route   GET /api/admin/employees
// @access  Private/Admin
exports.getEmployees = async (req, res) => {
  try {
    const { search, department, status, page = 1, limit = 10 } = req.query;

    // Build query
    let query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } }
      ];
    }

    if (department && department !== 'all') {
      query.department = department;
    }

    if (status) {
      query.isActive = status === 'active';
    }

    // Pagination
    const skip = (page - 1) * limit;
    const total = await Employee.countDocuments(query);

    const employees = await Employee.find(query)
      .populate('user', 'email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      count: employees.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: employees
    });
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching employees',
      error: error.message
    });
  }
};

// @desc    Get single employee
// @route   GET /api/admin/employees/:id
// @access  Private/Admin
exports.getEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id)
      .populate('user', 'email role createdAt');

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Get employee's projects
    const projects = await Project.find({
      team: employee._id
    }).select('name status startDate endDate');

    // Get employee's tasks
    const tasks = await Task.find({
      assignedTo: employee._id
    }).select('title status priority dueDate');

    // Get recent attendance
    const recentAttendance = await Attendance.find({
      employee: employee._id
    })
      .sort({ checkIn: -1 })
      .limit(30);

    res.status(200).json({
      success: true,
      data: {
        employee,
        projects,
        tasks,
        recentAttendance
      }
    });
  } catch (error) {
    console.error('Get employee error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching employee',
      error: error.message
    });
  }
};

// @desc    Add new employee
// @route   POST /api/admin/employees
// @access  Private/Admin
exports.addEmployee = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      address,
      department,
      designation,
      dateOfJoining,
      salary,
      emergencyContact
    } = req.body;

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Create user account
    const user = await User.create({
      email,
      password,
      role: 'employee'
    });

    // Generate employee ID
    const employeeCount = await Employee.countDocuments();
    const employeeId = `EMP${String(employeeCount + 1).padStart(4, '0')}`;

    // Create employee profile
    const employee = await Employee.create({
      user: user._id,
      name,
      email,
      phone,
      address,
      department,
      designation,
      employeeId,
      dateOfJoining,
      salary,
      emergencyContact
    });

    res.status(201).json({
      success: true,
      message: 'Employee added successfully',
      data: employee
    });
  } catch (error) {
    console.error('Add employee error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding employee',
      error: error.message
    });
  }
};

// @desc    Update employee
// @route   PUT /api/admin/employees/:id
// @access  Private/Admin
exports.updateEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Update fields
    const allowedFields = [
      'name',
      'phone',
      'address',
      'department',
      'designation',
      'salary',
      'emergencyContact',
      'isActive'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        employee[field] = req.body[field];
      }
    });

    await employee.save();

    res.status(200).json({
      success: true,
      message: 'Employee updated successfully',
      data: employee
    });
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating employee',
      error: error.message
    });
  }
};

// @desc    Delete employee
// @route   DELETE /api/admin/employees/:id
// @access  Private/Admin
exports.deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Soft delete - just deactivate
    employee.isActive = false;
    await employee.save();

    // Also deactivate user account
    await User.findByIdAndUpdate(employee.user, { isActive: false });

    res.status(200).json({
      success: true,
      message: 'Employee deleted successfully'
    });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting employee',
      error: error.message
    });
  }
};

// ============================================
// CLIENT MANAGEMENT
// ============================================

// @desc    Get all clients
// @route   GET /api/admin/clients
// @access  Private/Admin
exports.getClients = async (req, res) => {
  try {
    const { search, status, page = 1, limit = 10 } = req.query;

    // Build query
    let query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { companyName: { $regex: search, $options: 'i' } }
      ];
    }

    if (status) {
      query.isActive = status === 'active';
    }

    // Pagination
    const skip = (page - 1) * limit;
    const total = await Client.countDocuments(query);

    const clients = await Client.find(query)
      .populate('user', 'email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      count: clients.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: clients
    });
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching clients',
      error: error.message
    });
  }
};

// @desc    Get single client
// @route   GET /api/admin/clients/:id
// @access  Private/Admin
exports.getClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id)
      .populate('user', 'email role createdAt');

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Get client's projects
    const projects = await Project.find({
      client: client._id
    }).select('name status startDate endDate budget');

    res.status(200).json({
      success: true,
      data: {
        client,
        projects
      }
    });
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching client',
      error: error.message
    });
  }
};

// @desc    Add new client
// @route   POST /api/admin/clients
// @access  Private/Admin
exports.addClient = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      address,
      companyName,
      companyAddress,
      industry
    } = req.body;

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Create user account
    const user = await User.create({
      email,
      password,
      role: 'client'
    });

    // Create client profile
    const client = await Client.create({
      user: user._id,
      name,
      email,
      phone,
      address,
      companyName,
      companyAddress,
      industry
    });

    res.status(201).json({
      success: true,
      message: 'Client added successfully',
      data: client
    });
  } catch (error) {
    console.error('Add client error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding client',
      error: error.message
    });
  }
};

// @desc    Update client
// @route   PUT /api/admin/clients/:id
// @access  Private/Admin
exports.updateClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Update fields
    const allowedFields = [
      'name',
      'phone',
      'address',
      'companyName',
      'companyAddress',
      'industry',
      'isActive'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        client[field] = req.body[field];
      }
    });

    await client.save();

    res.status(200).json({
      success: true,
      message: 'Client updated successfully',
      data: client
    });
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating client',
      error: error.message
    });
  }
};

// @desc    Delete client
// @route   DELETE /api/admin/clients/:id
// @access  Private/Admin
exports.deleteClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Soft delete - just deactivate
    client.isActive = false;
    await client.save();

    // Also deactivate user account
    await User.findByIdAndUpdate(client.user, { isActive: false });

    res.status(200).json({
      success: true,
      message: 'Client deleted successfully'
    });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting client',
      error: error.message
    });
  }
};

// ============================================
// SETTINGS MANAGEMENT
// ============================================

// @desc    Get company settings
// @route   GET /api/admin/settings
// @access  Private/Admin
exports.getSettings = async (req, res) => {
  try {
    // In a real app, you'd have a Settings model
    // For now, returning mock data
    const settings = {
      company: {
        name: 'OfficeSphere',
        email: 'info@officesphere.com',
        phone: '+1234567890',
        address: '123 Business Street, City, Country',
        website: 'https://officesphere.com'
      },
      attendance: {
        workingHours: {
          start: '09:00',
          end: '18:00'
        },
        gracePeriod: 15, // minutes
        autoCheckout: true,
        autoCheckoutTime: '19:00'
      },
      tasks: {
        autoAssign: false,
        reminderBeforeDeadline: 24 // hours
      },
      notifications: {
        email: true,
        push: false
      }
    };

    res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching settings',
      error: error.message
    });
  }
};

// @desc    Update company settings
// @route   PUT /api/admin/settings
// @access  Private/Admin
exports.updateSettings = async (req, res) => {
  try {
    // In a real app, you'd update the Settings model
    const updatedSettings = req.body;

    res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      data: updatedSettings
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating settings',
      error: error.message
    });
  }
};