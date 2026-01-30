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
      // Sort by most recent
      const timeA = a.time.includes('ago') ? 0 : 1;
      const timeB = b.time.includes('ago') ? 0 : 1;
      return timeA - timeB;
    }).slice(0, 5);

    // ✅ Return data in the format frontend expects
    res.status(200).json({
      success: true,
      data: {
        totalEmployees,
        presentToday,
        activeProjects,
        pendingTasks,
        attendanceData: attendanceData.sort((a, b) => {
          // Sort by check-in time
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

// @desc    Get all employees
// @route   GET /api/admin/employees
// @access  Private/Admin
const getEmployees = async (req, res) => {
  try {
    const { search, department, status, page = 1, limit = 10 } = req.query;

    // Build query
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

    // Pagination
    const skip = (page - 1) * limit;
    const total = await Employee.countDocuments(query);

    // Fix: Populate 'userId' not 'user'
    const employees = await Employee.find(query)
      .populate("userId", "name email phone avatar isActive createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Transform data to match what frontend expects
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

// @desc    Add new employee
// @route   POST /api/admin/employees
// @access  Private/Admin
const addEmployee = async (req, res) => {
  try {
    console.log("📝 Add employee request body:", req.body);

    const {
      name,
      email,
      password,
      phone,
      position,
      department,
      salary,
      joinDate,
      status,
      address,
    } = req.body;

    console.log("📊 Received data:", {
      name,
      email,
      position,
      department,
      salary,
      joinDate,
      status,
    });

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    if (!position) {
      return res.status(400).json({
        success: false,
        message: "Position is required",
      });
    }

    if (!department) {
      return res.status(400).json({
        success: false,
        message: "Department is required",
      });
    }

    // Format department
    let formattedDepartment = department;
    if (formattedDepartment) {
      formattedDepartment =
        formattedDepartment.charAt(0).toUpperCase() +
        formattedDepartment.slice(1).toLowerCase();

      if (department.toLowerCase() === "hr") {
        formattedDepartment = "HR";
      }
    }

    console.log("🔄 Formatted department:", formattedDepartment);

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }

    // Create User account
    console.log("👤 Creating user account...");
    const user = await User.create({
      name,
      email,
      password,
      phone: phone || "",
      role: "employee",
      isActive: true,
    });

    console.log("✅ User created with ID:", user._id);

    // Generate employee ID
    const employeeCount = await Employee.countDocuments();
    const employeeId = `EMP${String(employeeCount + 1).padStart(4, "0")}`;
    console.log("📇 Generated employee ID:", employeeId);

    // Map status to isActive
    const isActive = status !== "inactive";

    // Create Employee profile
    console.log("👷 Creating employee profile...");
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
    if (phone) {
      employeeData.phone = phone;
    }

    console.log("📋 Employee data to create:", employeeData);

    const employee = await Employee.create(employeeData);
    console.log("✅ Employee created with ID:", employee._id);

    // Get populated employee
    const populatedEmployee = await Employee.findById(employee._id).populate(
      "userId",
      "name email phone",
    );

    // Transform response
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

    console.log("📤 Sending response:", responseData);

    res.status(201).json({
      success: true,
      message: "Employee added successfully",
      employee: responseData,
    });
  } catch (error) {
    console.error("❌ Add employee error details:", {
      name: error.name,
      message: error.message,
      errors: error.errors,
      stack: error.stack,
    });

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

// @desc    Get single employee
// @route   GET /api/admin/employees/:id
// @access  Private/Admin
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

    // Transform to match frontend expectations
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

    // Get employee's projects
    const projects = await Project.find({
      team: employee._id,
    }).select("name status startDate endDate");

    // Get employee's tasks
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

// @desc    Update employee
// @route   PUT /api/admin/employees/:id
// @access  Private/Admin
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

    // Update fields
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

    // Update User if needed
    if (employee.userId) {
      const userUpdate = {};
      if (req.body.name) userUpdate.name = req.body.name;
      if (req.body.email) userUpdate.email = req.body.email;
      if (req.body.phone) userUpdate.phone = req.body.phone;

      if (Object.keys(userUpdate).length > 0) {
        await User.findByIdAndUpdate(employee.userId._id, userUpdate);
      }
    }

    // Get updated employee
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

// @desc    Delete employee
// @route   DELETE /api/admin/employees/:id
// @access  Private/Admin
const deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Soft delete
    employee.isActive = false;
    await employee.save();

    // Deactivate user account
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

// @desc    Get all clients
// @route   GET /api/admin/clients
// @access  Private/Admin
const getClients = async (req, res) => {
  try {
    const { search, status, page = 1, limit = 10 } = req.query;

    // Build query
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

    // Pagination
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

// @desc    Get single client
// @route   GET /api/admin/clients/:id
// @access  Private/Admin
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

    // Get client's projects
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

// @desc    Add new client
// @route   POST /api/admin/clients
// @access  Private/Admin
const addClient = async (req, res) => {
  try {
    console.log('📝 Add client request body:', req.body);

    const {
      name,
      email,
      password,
      phone,
      address,
      company: companyName,
      industry,
      website,
      status
    } = req.body;

    console.log('📊 Received client data:', {
      name,
      email,
      companyName,
      industry,
      website
    });

    // Validate required fields
    if (!name || !email || !password || !companyName) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password and company name are required'
      });
    }

    // Check if email exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Format industry
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

    console.log('🔄 Formatted industry:', formattedIndustry);

    // Create User account
    console.log('👤 Creating user account...');
    const user = await User.create({
      name,
      email,
      password,
      phone: phone || '',
      role: 'client',
      isActive: true
    });

    console.log('✅ User created with ID:', user._id);

    // Generate client ID
    const clientCount = await Client.countDocuments();
    const clientId = `CL${String(clientCount + 1).padStart(4, '0')}`;
    console.log('📇 Generated client ID:', clientId);

    // Map status
    const isActive = status !== 'inactive';

    // Create Client profile
    console.log('🏢 Creating client profile...');
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

    console.log('📋 Client data to create:', clientData);

    const client = await Client.create(clientData);
    console.log('✅ Client created with ID:', client._id);

    // Get populated client
    const populatedClient = await Client.findById(client._id)
      .populate('userId', 'name email phone');

    // Transform response
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

    console.log('📤 Sending response:', responseData);

    res.status(201).json({
      success: true,
      message: 'Client added successfully',
      client: responseData
    });
  } catch (error) {
    console.error('❌ Add client error details:', {
      name: error.name,
      message: error.message,
      errors: error.errors,
      stack: error.stack
    });
    
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

// @desc    Update client
// @route   PUT /api/admin/clients/:id
// @access  Private/Admin
const updateClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    // Update fields
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

// @desc    Delete client
// @route   DELETE /api/admin/clients/:id
// @access  Private/Admin
const deleteClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    // Soft delete
    client.isActive = false;
    await client.save();

    // Deactivate user account
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

// @desc    Get company settings
// @route   GET /api/admin/settings
// @access  Private/Admin
const getSettings = async (req, res) => {
  try {
    const settings = {
      company: {
        name: "OfficeSphere",
        email: "info@officesphere.com",
        phone: "+1234567890",
        address: "123 Business Street, City, Country",
        website: "https://officesphere.com",
      },
      attendance: {
        workingHours: {
          start: "09:00",
          end: "18:00",
        },
        gracePeriod: 15,
        autoCheckout: true,
        autoCheckoutTime: "19:00",
      },
      tasks: {
        autoAssign: false,
        reminderBeforeDeadline: 24,
      },
      notifications: {
        email: true,
        push: false,
      },
    };

    res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error("Get settings error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching settings",
      error: error.message,
    });
  }
};

// @desc    Update company settings
// @route   PUT /api/admin/settings
// @access  Private/Admin
const updateSettings = async (req, res) => {
  try {
    const updatedSettings = req.body;

    res.status(200).json({
      success: true,
      message: "Settings updated successfully",
      data: updatedSettings,
    });
  } catch (error) {
    console.error("Update settings error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating settings",
      error: error.message,
    });
  }
};

// @desc    Get all projects
// @route   GET /api/admin/projects
// @access  Private/Admin
const getProjects = async (req, res) => {
  try {
    console.log('====================================');
    console.log('📊 ADMIN: Fetching projects...');
    console.log('====================================');
    
    const { status, priority, page = 1, limit = 10 } = req.query;
    
    console.log('📥 Query params:', { status, priority, page, limit });
    
    // Build query
    const query = { isActive: true };
    
    if (status && status !== 'all') {
      query.status = new RegExp(`^${status}$`, 'i');
      console.log('🔍 Filtering by status:', status);
    }
    
    if (priority && priority !== 'all') {
      query.priority = new RegExp(`^${priority}$`, 'i');
      console.log('🔍 Filtering by priority:', priority);
    }
    
    console.log('🔍 Final query:', JSON.stringify(query, null, 2));
    
    // Pagination
    const skip = (page - 1) * limit;
    const total = await Project.countDocuments(query);
    
    console.log('📊 Total projects matching query:', total);
    
    // Fetch projects
    const projects = await Project.find(query)
      .populate('client', 'companyName clientId email contactPerson phone')
      .populate('projectManager', 'name email designation')
      .populate('team', 'name email designation')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    console.log('✅ Found projects:', projects.length);
    
    if (projects.length > 0) {
      console.log('📋 Projects list:');
      projects.forEach((p, i) => {
        console.log(`   ${i + 1}. "${p.name}" - ${p.status} - Client: ${p.client?.companyName || 'N/A'}`);
      });
    } else {
      console.log('⚠️ No projects found matching criteria');
    }
    
    console.log('====================================');
    
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
    console.error('====================================');
    console.error('❌ ADMIN GET PROJECTS ERROR');
    console.error('====================================');
    console.error('Error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('====================================');
    
    res.status(500).json({
      success: false,
      message: 'Error fetching projects',
      error: error.message
    });
  }
};

// @desc    Get daily attendance for admin
// @route   GET /api/admin/attendance
// @access  Private/Admin
const getDailyAttendance = async (req, res) => {
  try {
    console.log('====================================');
    console.log('📊 ADMIN: Fetching daily attendance');
    console.log('====================================');
    console.log('📥 Query params:', req.query);
    
    const { date } = req.query;
    
    // Parse the date or use today
    let queryDate;
    if (date) {
      queryDate = new Date(date);
    } else {
      queryDate = new Date();
    }
    
    // Set to start of day
    queryDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(queryDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    console.log('📅 Query date range:', {
      from: queryDate,
      to: nextDay
    });
    
    // Get all employees
    const allEmployees = await Employee.find({ isActive: true })
      .populate('userId', 'name email')
      .select('name email employeeId designation');
    
    console.log('👥 Total active employees:', allEmployees.length);
    
    // Get attendance records for the date
    const attendanceRecords = await Attendance.find({
      date: { $gte: queryDate, $lt: nextDay }
    }).populate({
      path: 'employeeId',
      populate: {
        path: 'userId',
        select: 'name email'
      }
    });
    
    console.log('📋 Attendance records found:', attendanceRecords.length);
    
    // Create attendance data for all employees
    const attendanceData = allEmployees.map(employee => {
      const record = attendanceRecords.find(
        r => r.employeeId?._id?.toString() === employee._id.toString()
      );
      
      if (record) {
        const checkIn = record.checkInTime;
        const checkOut = record.checkOutTime;
        let workHours = 0;
        
        if (checkIn && checkOut) {
          const diff = new Date(checkOut) - new Date(checkIn);
          workHours = (diff / (1000 * 60 * 60)).toFixed(1);
        }
        
        return {
          employeeName: employee.userId?.name || employee.name || 'Unknown',
          email: employee.userId?.email || employee.email || '-',
          employeeId: employee.employeeId,
          designation: employee.designation,
          checkIn: record.checkInTime,
          checkOut: record.checkOutTime,
          workHours: workHours,
          status: record.status,
          isLate: record.isLate || false
        };
      } else {
        return {
          employeeName: employee.userId?.name || employee.name || 'Unknown',
          email: employee.userId?.email || employee.email || '-',
          employeeId: employee.employeeId,
          designation: employee.designation,
          checkIn: null,
          checkOut: null,
          workHours: 0,
          status: 'absent',
          isLate: false
        };
      }
    });
    
    // Calculate stats
    const stats = {
      total: attendanceData.length,
      present: attendanceData.filter(a => a.status === 'present').length,
      late: attendanceData.filter(a => a.status === 'late').length,
      absent: attendanceData.filter(a => a.status === 'absent').length
    };
    
    console.log('📊 Attendance stats:', stats);
    console.log('====================================');
    
    res.status(200).json({
      success: true,
      date: queryDate,
      stats,
      attendance: attendanceData.sort((a, b) => {
        if (a.status === 'absent' && b.status !== 'absent') return 1;
        if (a.status !== 'absent' && b.status === 'absent') return -1;
        if (!a.checkIn) return 1;
        if (!b.checkIn) return -1;
        return new Date(a.checkIn) - new Date(b.checkIn);
      })
    });
    
  } catch (error) {
    console.error('====================================');
    console.error('❌ GET DAILY ATTENDANCE ERROR');
    console.error('====================================');
    console.error('Error:', error);
    console.error('====================================');
    
    res.status(500).json({
      success: false,
      message: 'Error fetching attendance data',
      error: error.message
    });
  }
};

// ============================================
// EXPORTS - MUST BE AT THE VERY END
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