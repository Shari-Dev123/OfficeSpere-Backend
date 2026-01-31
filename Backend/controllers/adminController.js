// ============================================
// Admin Controller
// Handles all admin-related operations
// ============================================

const User = require("../models/User");
const Employee = require("../models/Employee");
const Client = require("../models/Client");
const Project = require("../models/Project");
const Task = require("../models/Task");
const Attendance = require("../models/Attendance");
const Meeting = require("../models/Meeting");
const DailyReport = require("../models/DailyReport");
const Admin = require('../models/Admin'); // ✅ ADD THIS
const { getIO } = require('../config/socket');

// ============================================
// DASHBOARD
// ============================================

// @desc    Get admin dashboard statistics
// @route   GET /api/admin/dashboard
// @access  Private/Admin
const getDashboard = async (req, res) => {
  try {
    // Get total employees
    const totalEmployees = await Employee.countDocuments({ isActive: true });

    // Get today's attendance
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayAttendance = await Attendance.find({
      date: { $gte: today, $lt: tomorrow }
    }).populate({
      path: 'employeeId',
      populate: {
        path: 'userId',
        select: 'name email'
      }
    });

    const presentToday = todayAttendance.filter(a =>
      a.status === 'present' || a.status === 'late'
    ).length;

    // Get active projects
    const activeProjects = await Project.countDocuments({
      status: { $in: ['active', 'in-progress', 'in_progress'] }
    });

    // Get pending tasks
    const pendingTasks = await Task.countDocuments({
      status: { $in: ['pending', 'in-progress', 'in_progress'] }
    });

    // Format attendance data for display
    const attendanceData = todayAttendance.map(record => ({
      employeeName: record.employeeId?.userId?.name || 'Unknown',
      email: record.employeeId?.userId?.email || '',
      checkInTime: record.checkInTime
        ? new Date(record.checkInTime).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        })
        : 'Not checked in',
      status: record.status || 'absent',
      isLate: record.isLate || false
    }));

    // Get recent activity
    const recentProjects = await Project.find()
      .sort({ createdAt: -1 })
      .limit(3)
      .populate('client', 'companyName')
      .select('name status createdAt');

    const recentTasks = await Task.find()
      .sort({ createdAt: -1 })
      .limit(2)
      .populate('assignedTo', 'name')
      .select('title status createdAt');

    const recentActivity = [
      ...recentProjects.map(proj => ({
        description: `New project "${proj.name}" created${proj.client ? ` for ${proj.client.companyName}` : ''}`,
        time: formatTimeAgo(proj.createdAt),
        type: 'project'
      })),
      ...recentTasks.map(task => ({
        description: `Task "${task.title}" assigned${task.assignedTo ? ` to ${task.assignedTo.name}` : ''}`,
        time: formatTimeAgo(task.createdAt),
        type: 'task'
      })),
      ...todayAttendance.slice(0, 3).map(att => ({
        description: `${att.employeeId?.userId?.name || 'Someone'} checked ${att.checkOutTime ? 'out' : 'in'}`,
        time: formatTimeAgo(att.checkInTime || att.createdAt),
        type: 'attendance'
      }))
    ].sort((a, b) => {
      const timeA = a.time.includes('ago') ? 0 : 1;
      const timeB = b.time.includes('ago') ? 0 : 1;
      return timeA - timeB;
    }).slice(0, 5);

    res.status(200).json({
      success: true,
      data: {
        totalEmployees,
        presentToday,
        activeProjects,
        pendingTasks,
        attendanceData: attendanceData.sort((a, b) => {
          if (!a.checkInTime) return 1;
          if (!b.checkInTime) return -1;
          return b.checkInTime.localeCompare(a.checkInTime);
        }),
        recentActivity
      }
    });

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error.message
    });
  }
};

// Helper function to format time ago
function formatTimeAgo(date) {
  if (!date) return 'just now';

  const seconds = Math.floor((new Date() - new Date(date)) / 1000);

  if (seconds < 60) return 'just now';

  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years ago";

  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months ago";

  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days ago";

  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours ago";

  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " minutes ago";

  return Math.floor(seconds) + " seconds ago";
}

// ============================================
// EMPLOYEE MANAGEMENT
// ============================================

const getEmployees = async (req, res) => {
  try {
    const { search, department, status, page = 1, limit = 10 } = req.query;

    let query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { employeeId: { $regex: search, $options: "i" } },
      ];
    }

    if (department && department !== "all") {
      query.department = department;
    }

    if (status) {
      query.isActive = status === "active";
    }

    const skip = (page - 1) * limit;
    const total = await Employee.countDocuments(query);

    const employees = await Employee.find(query)
      .populate("userId", "name email phone avatar isActive createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const transformedEmployees = employees.map((employee) => {
      const userData = employee.userId || {};

      return {
        _id: employee._id,
        name: userData.name || "No Name",
        email: userData.email || employee.email || "No Email",
        phone: userData.phone || employee.phone || "",
        position: employee.designation || "Employee",
        department: employee.department || "General",
        employeeId: employee.employeeId || "N/A",
        status: employee.isActive ? "active" : "inactive",
        joinDate: employee.joiningDate || new Date(),
        salary: employee.salary || 0,
        avatar: userData.avatar,
        address: employee.address || {},
        rawEmployee: employee,
      };
    });

    res.status(200).json({
      success: true,
      count: transformedEmployees.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      employees: transformedEmployees,
    });
  } catch (error) {
    console.error("Get employees error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching employees",
      error: error.message,
    });
  }
};

const addEmployee = async (req, res) => {
  try {
    const {
      name, email, password, phone, position, department,
      salary, joinDate, status, address,
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    if (!position || !department) {
      return res.status(400).json({
        success: false,
        message: "Position and department are required",
      });
    }

    let formattedDepartment = department;
    if (formattedDepartment) {
      formattedDepartment =
        formattedDepartment.charAt(0).toUpperCase() +
        formattedDepartment.slice(1).toLowerCase();

      if (department.toLowerCase() === "hr") {
        formattedDepartment = "HR";
      }
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }

    const user = await User.create({
      name,
      email,
      password,
      phone: phone || "",
      role: "employee",
      isActive: true,
    });

    const employeeCount = await Employee.countDocuments();
    const employeeId = `EMP${String(employeeCount + 1).padStart(4, "0")}`;
    const isActive = status !== "inactive";

    const employeeData = {
      userId: user._id,
      employeeId: employeeId,
      name: name,
      email: email,
      phone: phone || "",
      position: position,
      designation: position,
      department: formattedDepartment,
      joiningDate: joinDate ? new Date(joinDate) : new Date(),
      salary: salary ? parseFloat(salary) : 0,
      isActive: isActive,
      skills: [],
      experience: 0,
      performance: {
        rating: 0,
        totalTasksCompleted: 0,
        onTimeCompletion: 0,
        averageTaskTime: 0,
      },
      attendance: {
        totalPresent: 0,
        totalAbsent: 0,
        totalLate: 0,
        totalLeaves: 0,
      },
    };

    if (address) {
      employeeData.address = { street: address };
    }

    const employee = await Employee.create(employeeData);
    const populatedEmployee = await Employee.findById(employee._id).populate(
      "userId",
      "name email phone",
    );

    const responseData = {
      _id: populatedEmployee._id,
      name: populatedEmployee.userId?.name || name,
      email: populatedEmployee.userId?.email || email,
      phone: populatedEmployee.userId?.phone || phone,
      position: populatedEmployee.designation,
      department: populatedEmployee.department,
      employeeId: populatedEmployee.employeeId,
      status: populatedEmployee.isActive ? "active" : "inactive",
      joinDate: populatedEmployee.joiningDate,
      salary: populatedEmployee.salary,
    };

    res.status(201).json({
      success: true,
      message: "Employee added successfully",
      employee: responseData,
    });
  } catch (error) {
    console.error("Add employee error:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: messages,
        error: error.message,
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duplicate entry detected",
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Error adding employee",
      error: error.message,
    });
  }
};

const getEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id).populate(
      "userId",
      "name email phone avatar isActive createdAt",
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    const employeeData = {
      _id: employee._id,
      name: employee.userId?.name || "No Name",
      email: employee.userId?.email || "No Email",
      phone: employee.userId?.phone || "",
      position: employee.designation || "Employee",
      department: employee.department || "General",
      employeeId: employee.employeeId || "N/A",
      status: employee.isActive ? "active" : "inactive",
      joinDate: employee.joiningDate || new Date(),
      salary: employee.salary || 0,
      avatar: employee.userId?.avatar,
      address: employee.address || {},
      skills: employee.skills || [],
      experience: employee.experience || 0,
      user: employee.userId
        ? {
          email: employee.userId.email,
          role: employee.userId.role,
        }
        : null,
    };

    const projects = await Project.find({
      team: employee._id,
    }).select("name status startDate endDate");

    const tasks = await Task.find({
      assignedTo: employee._id,
    }).select("title status priority dueDate");

    res.status(200).json({
      success: true,
      data: {
        employee: employeeData,
        projects,
        tasks,
      },
    });
  } catch (error) {
    console.error("Get employee error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching employee",
      error: error.message,
    });
  }
};

const updateEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id).populate(
      "userId",
      "name email phone",
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    const allowedFields = [
      "designation",
      "department",
      "salary",
      "isActive",
      "skills",
      "experience",
      "address",
      "emergencyContact",
      "bankDetails",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        employee[field] = req.body[field];
      }
    });

    if (req.body.position !== undefined) {
      employee.designation = req.body.position;
    }

    if (req.body.status !== undefined) {
      employee.isActive = req.body.status === "active";
    }

    await employee.save();

    if (employee.userId) {
      const userUpdate = {};
      if (req.body.name) userUpdate.name = req.body.name;
      if (req.body.email) userUpdate.email = req.body.email;
      if (req.body.phone) userUpdate.phone = req.body.phone;

      if (Object.keys(userUpdate).length > 0) {
        await User.findByIdAndUpdate(employee.userId._id, userUpdate);
      }
    }

    const updatedEmployee = await Employee.findById(employee._id).populate(
      "userId",
      "name email phone",
    );

    res.status(200).json({
      success: true,
      message: "Employee updated successfully",
      employee: {
        _id: updatedEmployee._id,
        name: updatedEmployee.userId?.name,
        email: updatedEmployee.userId?.email,
        phone: updatedEmployee.userId?.phone,
        position: updatedEmployee.designation,
        department: updatedEmployee.department,
        employeeId: updatedEmployee.employeeId,
        status: updatedEmployee.isActive ? "active" : "inactive",
        joinDate: updatedEmployee.joiningDate,
        salary: updatedEmployee.salary,
      },
    });
  } catch (error) {
    console.error("Update employee error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating employee",
      error: error.message,
    });
  }
};

const deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    employee.isActive = false;
    await employee.save();

    await User.findByIdAndUpdate(employee.user, { isActive: false });

    res.status(200).json({
      success: true,
      message: "Employee deleted successfully",
    });
  } catch (error) {
    console.error("Delete employee error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting employee",
      error: error.message,
    });
  }
};

// ============================================
// CLIENT MANAGEMENT
// ============================================

const getClients = async (req, res) => {
  try {
    const { search, status, page = 1, limit = 10 } = req.query;

    let query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { companyName: { $regex: search, $options: "i" } },
      ];
    }

    if (status) {
      query.isActive = status === "active";
    }

    const skip = (page - 1) * limit;
    const total = await Client.countDocuments(query);

    const clients = await Client.find(query)
      .populate("userId", "email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      count: clients.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: clients,
    });
  } catch (error) {
    console.error("Get clients error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching clients",
      error: error.message,
    });
  }
};

const getClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id).populate(
      "userId",
      "email role createdAt",
    );

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    const projects = await Project.find({
      client: client._id,
    }).select("name status startDate endDate budget");

    res.status(200).json({
      success: true,
      data: {
        client,
        projects,
      },
    });
  } catch (error) {
    console.error("Get client error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching client",
      error: error.message,
    });
  }
};

const addClient = async (req, res) => {
  try {
    const {
      name, email, password, phone, address,
      company: companyName, industry, website, status
    } = req.body;

    if (!name || !email || !password || !companyName) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password and company name are required'
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    let formattedIndustry = '';
    if (industry) {
      formattedIndustry = industry.charAt(0).toUpperCase() + industry.slice(1).toLowerCase();

      const validIndustries = [
        'Technology', 'Healthcare', 'Finance', 'Education',
        'Retail', 'Manufacturing', 'Real Estate', 'Other'
      ];

      if (!validIndustries.includes(formattedIndustry)) {
        return res.status(400).json({
          success: false,
          message: `Invalid industry. Must be one of: ${validIndustries.join(', ')}`,
          received: industry
        });
      }
    }

    const user = await User.create({
      name,
      email,
      password,
      phone: phone || '',
      role: 'client',
      isActive: true
    });

    const clientCount = await Client.countDocuments();
    const clientId = `CL${String(clientCount + 1).padStart(4, '0')}`;
    const isActive = status !== 'inactive';

    const clientData = {
      userId: user._id,
      clientId: clientId,
      companyName: companyName,
      companyEmail: email,
      contactPerson: {
        name: name,
        email: email,
        phone: phone || ''
      },
      industry: formattedIndustry || 'Other',
      companyWebsite: website || '',
      isActive: isActive,
      address: {
        street: address || ''
      }
    };

    const client = await Client.create(clientData);
    const populatedClient = await Client.findById(client._id)
      .populate('userId', 'name email phone');

    const responseData = {
      _id: populatedClient._id,
      name: populatedClient.userId?.name || name,
      email: populatedClient.userId?.email || email,
      phone: populatedClient.userId?.phone || phone,
      company: populatedClient.companyName,
      companyName: populatedClient.companyName,
      industry: populatedClient.industry,
      website: populatedClient.companyWebsite,
      clientId: populatedClient.clientId,
      status: populatedClient.isActive ? 'active' : 'inactive',
      address: populatedClient.address?.street || address
    };

    res.status(201).json({
      success: true,
      message: 'Client added successfully',
      client: responseData
    });
  } catch (error) {
    console.error('Add client error:', error);

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages,
        error: error.message
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate entry detected',
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error adding client',
      error: error.message
    });
  }
};

const updateClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    const allowedFields = [
      "name",
      "phone",
      "address",
      "companyName",
      "companyAddress",
      "industry",
      "isActive",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        client[field] = req.body[field];
      }
    });

    await client.save();

    res.status(200).json({
      success: true,
      message: "Client updated successfully",
      data: client,
    });
  } catch (error) {
    console.error("Update client error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating client",
      error: error.message,
    });
  }
};

const deleteClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    client.isActive = false;
    await client.save();

    await User.findByIdAndUpdate(client.user, { isActive: false });

    res.status(200).json({
      success: true,
      message: "Client deleted successfully",
    });
  } catch (error) {
    console.error("Delete client error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting client",
      error: error.message,
    });
  }
};

// ============================================
// SETTINGS MANAGEMENT
// ============================================

const getSettings = async (req, res) => {
  try {
    console.log('====================================');
    console.log('📥 GET Settings called');
    console.log('User ID:', req.user.id);
    console.log('====================================');

    let admin = await Admin.findOne({ userId: req.user.id });

    if (!admin) {
      console.log('⚠️ No admin document found, creating default...');

      admin = await Admin.create({
        userId: req.user.id,
        designation: 'System Administrator',
        department: 'Administration',
      });

      console.log('✅ Default admin created');
    }

    const settings = admin.getFormattedSettings();

    console.log('✅ Settings to send:', settings);
    console.log('====================================');

    res.status(200).json({
      success: true,
      data: settings, // ✅ This is correct
      message: 'Settings fetched successfully'
    });

  } catch (error) {
    console.error('====================================');
    console.error('❌ Error fetching settings:', error);
    console.error('====================================');

    res.status(500).json({
      success: false,
      message: 'Failed to fetch settings',
      error: error.message
    });
  }
};
const updateSettings = async (req, res) => {
  try {
    console.log('====================================');
    console.log('📝 UPDATE Settings called');
    console.log('User ID:', req.user.id);
    console.log('Received data:', JSON.stringify(req.body, null, 2));
    console.log('====================================');

    const { company, work, attendance, email } = req.body;

    // Validate
    if (!company || !work || !attendance || !email) {
      console.log('❌ Missing required sections');
      return res.status(400).json({
        success: false,
        message: 'All settings sections are required'
      });
    }

    // Find or create admin
    let admin = await Admin.findOne({ userId: req.user.id });

    if (!admin) {
      console.log('⚠️ Creating new admin document...');
      admin = new Admin({
        userId: req.user.id,
        designation: 'System Administrator',
        department: 'Administration',
      });
    }

    // Update settings
    admin.companyInfo = {
      companyName: company.companyName,
      email: company.email,
      phone: company.phone,
      address: company.address,
      city: company.city,
      state: company.state,
      zipCode: company.zipCode,
      country: company.country,
      website: company.website,
      logo: company.logo || '',
    };

    admin.workSettings = {
      workingDays: work.workingDays,
      startTime: work.startTime,
      endTime: work.endTime,
      lunchBreak: work.lunchBreak,
      timezone: work.timezone,
      weekendDays: work.weekendDays,
    };

    admin.attendanceSettings = {
      autoCheckout: attendance.autoCheckout,
      lateThreshold: attendance.lateThreshold,
      halfDayHours: attendance.halfDayHours,
      fullDayHours: attendance.fullDayHours,
      overtimeRate: attendance.overtimeRate,
      allowManualCorrection: attendance.allowManualCorrection,
    };

    admin.emailSettings = {
      notifyNewEmployee: email.notifyNewEmployee,
      notifyTaskAssignment: email.notifyTaskAssignment,
      notifyMeetings: email.notifyMeetings,
      dailyReports: email.dailyReports,
      weeklyReports: email.weeklyReports,
      monthlyReports: email.monthlyReports,
    };

    // Save to database
    await admin.save();

    console.log('✅ Settings saved to database successfully!');
    console.log('====================================');

    // Get formatted settings to return
    const updatedSettings = admin.getFormattedSettings();

    res.status(200).json({
      success: true,
      data: updatedSettings,
      message: 'Settings updated successfully'
    });

  } catch (error) {
    console.error('====================================');
    console.error('❌ Error updating settings:', error);
    console.error('Error message:', error.message);
    console.error('====================================');
    
    res.status(500).json({
      success: false,
      message: 'Failed to update settings',
      error: error.message
    });
  }
};
// ============================================
// PROJECTS
// ============================================

const getProjects = async (req, res) => {
  try {
    const { status, priority, page = 1, limit = 10 } = req.query;

    const query = { isActive: true };

    if (status && status !== 'all') {
      query.status = new RegExp(`^${status}$`, 'i');
    }

    if (priority && priority !== 'all') {
      query.priority = new RegExp(`^${priority}$`, 'i');
    }

    const skip = (page - 1) * limit;
    const total = await Project.countDocuments(query);

    const projects = await Project.find(query)
      .populate('client', 'companyName clientId email contactPerson phone')
      .populate('projectManager', 'name email designation')
      .populate('team', 'name email designation')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    res.status(200).json({
      success: true,
      total,
      count: projects.length,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      projects: projects,
      message: projects.length === 0 ? 'No projects found' : 'Projects fetched successfully'
    });

  } catch (error) {
    console.error('Admin get projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching projects',
      error: error.message
    });
  }
};

// ============================================
// ATTENDANCE
// ============================================

// ============================================
// Admin Controller - getDailyAttendance Function
// ===========================================  

// @desc    Get daily attendance for admin dashboard & attendance monitor
// @route   GET /api/admin/attendance
// @access  Private/Admin
// ============================================
// Admin Controller - FIXED getDailyAttendance
// Fixes: Timezone issue + Status matching
// ============================================
// @desc    Get daily attendance for admin dashboard & attendance monitor
// @route   GET /api/admin/attendance
// @access  Private/Admin
const getDailyAttendance = async (req, res) => {
  try {
    console.log('====================================');
    console.log('📥 GET DAILY ATTENDANCE CALLED');
    console.log('Query params:', req.query);
    console.log('====================================');

    const { date } = req.query;

    // ✅ FIX: Handle timezone properly
    let queryDate;
    if (date) {
      // Parse the date string and create a new Date in UTC
      const [year, month, day] = date.split('-').map(Number);
      queryDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    } else {
      // Use today's date in UTC
      const now = new Date();
      queryDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0));
    }

    const nextDay = new Date(queryDate);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    console.log('📅 Query date (UTC):', queryDate.toISOString());
    console.log('📅 Next day (UTC):', nextDay.toISOString());
    console.log('📅 Original date param:', date);

    // ✅ Get ALL active employees
    const allEmployees = await Employee.find({ isActive: true })
      .populate('userId', 'name email')
      .select('name email employeeId designation department');

    console.log('👥 Total active employees:', allEmployees.length);

    // ✅ Get attendance records for this date range
    const attendanceRecords = await Attendance.find({
      date: { $gte: queryDate, $lt: nextDay }
    }).populate({
      path: 'employeeId',
      populate: {
        path: 'userId',
        select: 'name email'
      }
    });

    console.log('✅ Attendance records found:', attendanceRecords.length);
    
    // ✅ DEBUG: Log first attendance record
    if (attendanceRecords.length > 0) {
      console.log('📋 Sample attendance record:', {
        employeeId: attendanceRecords[0].employeeId?._id,
        status: attendanceRecords[0].status,
        checkIn: attendanceRecords[0].checkInTime,
        checkOut: attendanceRecords[0].checkOutTime,
        date: attendanceRecords[0].date
      });
    }

    // ✅ Map all employees with their attendance status
    const attendanceData = allEmployees.map(employee => {
      const record = attendanceRecords.find(
        r => r.employeeId && r.employeeId._id.toString() === employee._id.toString()
      );

      if (record) {
        // ✅ Employee has attendance record
        const checkIn = record.checkInTime;
        const checkOut = record.checkOutTime;
        let workHours = 0;

        if (checkIn && checkOut) {
          const diff = new Date(checkOut) - new Date(checkIn);
          workHours = (diff / (1000 * 60 * 60)).toFixed(1);
        }

        // ✅ FIX: Normalize status to lowercase for comparison
        const normalizedStatus = (record.status || 'present').toLowerCase();
        
        // ✅ Determine final status
        let finalStatus = normalizedStatus;
        if (checkIn && !checkOut) {
          finalStatus = 'present'; // Still checked in
        } else if (!checkIn && !checkOut) {
          finalStatus = 'absent';
        }

        console.log(`✅ Employee ${employee.email}: status="${record.status}" → normalized="${normalizedStatus}" → final="${finalStatus}"`);

        return {
          _id: record._id,
          employeeName: employee.userId?.name || employee.name || 'Unknown',
          email: employee.userId?.email || employee.email || '-',
          employeeId: employee.employeeId,
          designation: employee.designation,
          department: employee.department,
          checkIn: record.checkInTime,
          checkInTime: record.checkInTime,
          checkOut: record.checkOutTime,
          checkOutTime: record.checkOutTime,
          workHours: workHours,
          totalHours: workHours ? `${workHours}h` : '-',
          status: finalStatus, // ✅ Use normalized status
          isLate: record.isLate || false,
          rawStatus: record.status // ✅ Keep original for debugging
        };
      } else {
        // ✅ Employee has NO attendance record
        return {
          _id: null,
          employeeName: employee.userId?.name || employee.name || 'Unknown',
          email: employee.userId?.email || employee.email || '-',
          employeeId: employee.employeeId,
          designation: employee.designation,
          department: employee.department,
          checkIn: null,
          checkInTime: null,
          checkOut: null,
          checkOutTime: null,
          workHours: 0,
          totalHours: '-',
          status: 'absent',
          isLate: false
        };
      }
    });

    // ✅ Calculate statistics (case-insensitive)
    const stats = {
      total: attendanceData.length,
      present: attendanceData.filter(a => 
        a.status && a.status.toLowerCase() === 'present'
      ).length,
      late: attendanceData.filter(a => 
        a.status && a.status.toLowerCase() === 'late'
      ).length,
      absent: attendanceData.filter(a => 
        a.status && a.status.toLowerCase() === 'absent'
      ).length
    };

    console.log('📊 Stats:', stats);
    console.log('📋 Status breakdown:', attendanceData.map(a => ({
      name: a.employeeName,
      status: a.status,
      hasCheckIn: !!a.checkIn
    })));

    // ✅ Sort: Present first, then late, then absent
    const sortedData = attendanceData.sort((a, b) => {
      const statusOrder = { present: 0, late: 1, absent: 2 };
      const aOrder = statusOrder[a.status?.toLowerCase()] ?? 3;
      const bOrder = statusOrder[b.status?.toLowerCase()] ?? 3;
      
      if (aOrder !== bOrder) return aOrder - bOrder;
      
      // Same status - sort by check-in time
      if (!a.checkIn) return 1;
      if (!b.checkIn) return -1;
      return new Date(a.checkIn) - new Date(b.checkIn);
    });

    console.log('====================================');
    console.log('✅ Sending response with', sortedData.length, 'records');
    console.log('====================================');

    // ✅ Send response in multiple formats for compatibility
    res.status(200).json({
      success: true,
      date: queryDate,
      stats,
      data: {
        attendance: sortedData,
        stats: stats
      },
      attendance: sortedData,
      message: 'Attendance data fetched successfully'
    });

  } catch (error) {
    console.error('====================================');
    console.error('❌ GET DAILY ATTENDANCE ERROR');
    console.error('====================================');
    console.error('Error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('====================================');

    res.status(500).json({
      success: false,
      message: 'Error fetching attendance data',
      error: error.message
    });
  }
};



module.exports = {
  getDailyAttendance
};
// ============================================
// EXPORTS
// ============================================
module.exports = {
  getDashboard,
  getEmployees,
  getEmployee,
  addEmployee,
  updateEmployee,
  deleteEmployee,
  getClients,
  getClient,
  addClient,
  updateClient,
  deleteClient,
  getProjects,
  getSettings,
  updateSettings,
  getDailyAttendance
};