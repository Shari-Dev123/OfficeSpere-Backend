// controllers/reportController.js
const Employee = require('../models/Employee');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Attendance = require('../models/Attendance');
const DailyReport = require('../models/DailyReport');
const Client = require('../models/Client');
const Meeting = require('../models/Meeting');

// @desc    Generate custom report
// @route   POST /api/admin/reports/generate
// @access  Private/Admin
exports.generateReport = async (req, res) => {
  try {
    const { reportType, startDate, endDate, filters } = req.body;

    if (!reportType || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide report type, start date, and end date'
      });
    }

    let reportData = {};

    switch (reportType) {
      case 'attendance':
        reportData = await generateAttendanceReport(startDate, endDate, filters);
        break;
      case 'performance':
        reportData = await generatePerformanceReport(startDate, endDate, filters);
        break;
      case 'productivity':
        reportData = await generateProductivityReport(startDate, endDate, filters);
        break;
      case 'project':
        reportData = await generateProjectReport(startDate, endDate, filters);
        break;
      case 'employee':
        reportData = await generateEmployeeReport(startDate, endDate, filters);
        break;
      case 'client':
        reportData = await generateClientReport(startDate, endDate, filters);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid report type'
        });
    }

    res.status(200).json({
      success: true,
      reportType,
      period: { startDate, endDate },
      generatedAt: new Date(),
      data: reportData
    });
  } catch (error) {
    console.error('Generate report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating report',
      error: error.message
    });
  }
};

// @desc    Get performance report
// @route   GET /api/admin/reports/performance
// @access  Private/Admin
exports.getPerformanceReport = async (req, res) => {
  try {
    const { startDate, endDate, employeeId } = req.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    let query = {
      createdAt: { $gte: start, $lte: end }
    };

    if (employeeId) {
      query.employee = employeeId;
    }

    // Get tasks completed
    const tasks = await Task.find({
      ...query,
      status: 'completed'
    }).populate('assignedTo', 'name email');

    // Get daily reports
    const dailyReports = await DailyReport.find(query)
      .populate('employee', 'name email');

    // Get attendance records
    const attendance = await Attendance.find(query)
      .populate('employee', 'name email');

    // Calculate performance metrics
    const performanceData = {};

    // Group by employee
    tasks.forEach(task => {
      task.assignedTo.forEach(emp => {
        const empId = emp._id.toString();
        if (!performanceData[empId]) {
          performanceData[empId] = {
            employee: emp,
            tasksCompleted: 0,
            totalTaskHours: 0,
            onTimeCompletions: 0,
            lateCompletions: 0,
            averageRating: 0
          };
        }
        performanceData[empId].tasksCompleted++;
        performanceData[empId].totalTaskHours += task.actualHours || task.estimatedHours || 0;
        
        if (task.completedDate && task.dueDate) {
          if (new Date(task.completedDate) <= new Date(task.dueDate)) {
            performanceData[empId].onTimeCompletions++;
          } else {
            performanceData[empId].lateCompletions++;
          }
        }
      });
    });

    // Add attendance data
    attendance.forEach(record => {
      const empId = record.employee._id.toString();
      if (performanceData[empId]) {
        performanceData[empId].attendanceRecords = (performanceData[empId].attendanceRecords || 0) + 1;
        if (record.status === 'present') {
          performanceData[empId].presentDays = (performanceData[empId].presentDays || 0) + 1;
        }
        if (record.status === 'late') {
          performanceData[empId].lateDays = (performanceData[empId].lateDays || 0) + 1;
        }
      }
    });

    // Calculate performance scores
    Object.keys(performanceData).forEach(empId => {
      const data = performanceData[empId];
      const onTimeRate = data.tasksCompleted > 0 
        ? (data.onTimeCompletions / data.tasksCompleted) * 100 
        : 0;
      const attendanceRate = data.attendanceRecords > 0
        ? (data.presentDays / data.attendanceRecords) * 100
        : 0;
      
      data.performanceScore = ((onTimeRate + attendanceRate) / 2).toFixed(2);
      data.onTimeRate = onTimeRate.toFixed(2);
      data.attendanceRate = attendanceRate.toFixed(2);
    });

    res.status(200).json({
      success: true,
      period: { startDate: start, endDate: end },
      totalEmployees: Object.keys(performanceData).length,
      performanceData: Object.values(performanceData)
    });
  } catch (error) {
    console.error('Get performance report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching performance report',
      error: error.message
    });
  }
};

// @desc    Get productivity report
// @route   GET /api/admin/reports/productivity
// @access  Private/Admin
exports.getProductivityReport = async (req, res) => {
  try {
    const { startDate, endDate, projectId } = req.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    let query = {
      createdAt: { $gte: start, $lte: end }
    };

    if (projectId) {
      query.project = projectId;
    }

    // Get all projects in the period
    const projects = await Project.find({
      createdAt: { $gte: start, $lte: end }
    }).populate('client', 'companyName');

    // Get tasks for these projects
    const tasks = await Task.find(query)
      .populate('project', 'name')
      .populate('assignedTo', 'name');

    // Get daily reports
    const dailyReports = await DailyReport.find(query)
      .populate('employee', 'name');

    // Calculate productivity metrics
    const productivityData = {
      totalProjects: projects.length,
      completedProjects: projects.filter(p => p.status === 'completed').length,
      inProgressProjects: projects.filter(p => p.status === 'in-progress').length,
      totalTasks: tasks.length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      inProgressTasks: tasks.filter(t => t.status === 'in-progress').length,
      totalEstimatedHours: tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0),
      totalActualHours: tasks.reduce((sum, t) => sum + (t.actualHours || 0), 0),
      dailyReportsSubmitted: dailyReports.length,
      projectBreakdown: [],
      weeklyProductivity: []
    };

    // Project breakdown
    const projectMap = {};
    tasks.forEach(task => {
      if (task.project) {
        const projectId = task.project._id.toString();
        if (!projectMap[projectId]) {
          projectMap[projectId] = {
            project: task.project,
            totalTasks: 0,
            completedTasks: 0,
            totalHours: 0
          };
        }
        projectMap[projectId].totalTasks++;
        if (task.status === 'completed') {
          projectMap[projectId].completedTasks++;
        }
        projectMap[projectId].totalHours += task.actualHours || task.estimatedHours || 0;
      }
    });

    productivityData.projectBreakdown = Object.values(projectMap);

    // Calculate weekly productivity
    const weeklyMap = {};
    dailyReports.forEach(report => {
      const week = getWeekNumber(report.date);
      if (!weeklyMap[week]) {
        weeklyMap[week] = {
          week,
          reportsCount: 0,
          totalHours: 0,
          tasksCompleted: 0
        };
      }
      weeklyMap[week].reportsCount++;
      weeklyMap[week].totalHours += report.hoursWorked || 0;
      weeklyMap[week].tasksCompleted += report.tasksCompleted?.length || 0;
    });

    productivityData.weeklyProductivity = Object.values(weeklyMap).sort((a, b) => a.week - b.week);

    // Calculate efficiency
    if (productivityData.totalEstimatedHours > 0) {
      productivityData.efficiency = (
        (productivityData.totalEstimatedHours / productivityData.totalActualHours) * 100
      ).toFixed(2);
    }

    res.status(200).json({
      success: true,
      period: { startDate: start, endDate: end },
      data: productivityData
    });
  } catch (error) {
    console.error('Get productivity report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching productivity report',
      error: error.message
    });
  }
};

// @desc    Get attendance report
// @route   GET /api/admin/reports/attendance
// @access  Private/Admin
exports.getAttendanceReport = async (req, res) => {
  try {
    const { startDate, endDate, employeeId, department } = req.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    let query = {
      date: { $gte: start, $lte: end }
    };

    if (employeeId) {
      query.employee = employeeId;
    }

    const attendanceRecords = await Attendance.find(query)
      .populate('employee', 'name email department');

    // Filter by department if provided
    let filteredRecords = attendanceRecords;
    if (department) {
      filteredRecords = attendanceRecords.filter(
        record => record.employee?.department === department
      );
    }

    // Calculate attendance statistics
    const stats = {
      totalRecords: filteredRecords.length,
      presentCount: filteredRecords.filter(r => r.status === 'present').length,
      absentCount: filteredRecords.filter(r => r.status === 'absent').length,
      lateCount: filteredRecords.filter(r => r.status === 'late').length,
      leaveCount: filteredRecords.filter(r => r.status === 'leave').length,
      halfDayCount: filteredRecords.filter(r => r.status === 'half-day').length,
      averageWorkHours: 0,
      totalWorkHours: 0,
      employeeBreakdown: []
    };

    // Calculate work hours
    const totalMinutes = filteredRecords.reduce((sum, record) => {
      return sum + (record.totalWorkMinutes || 0);
    }, 0);

    stats.totalWorkHours = (totalMinutes / 60).toFixed(2);
    stats.averageWorkHours = filteredRecords.length > 0 
      ? (totalMinutes / 60 / filteredRecords.length).toFixed(2) 
      : 0;

    // Employee breakdown
    const employeeMap = {};
    filteredRecords.forEach(record => {
      if (record.employee) {
        const empId = record.employee._id.toString();
        if (!employeeMap[empId]) {
          employeeMap[empId] = {
            employee: record.employee,
            totalDays: 0,
            presentDays: 0,
            absentDays: 0,
            lateDays: 0,
            leaveDays: 0,
            totalWorkHours: 0,
            attendanceRate: 0
          };
        }
        employeeMap[empId].totalDays++;
        if (record.status === 'present') employeeMap[empId].presentDays++;
        if (record.status === 'absent') employeeMap[empId].absentDays++;
        if (record.status === 'late') employeeMap[empId].lateDays++;
        if (record.status === 'leave') employeeMap[empId].leaveDays++;
        employeeMap[empId].totalWorkHours += (record.totalWorkMinutes || 0) / 60;
      }
    });

    // Calculate attendance rates
    Object.values(employeeMap).forEach(emp => {
      emp.attendanceRate = emp.totalDays > 0 
        ? ((emp.presentDays + emp.lateDays) / emp.totalDays * 100).toFixed(2)
        : 0;
      emp.totalWorkHours = emp.totalWorkHours.toFixed(2);
    });

    stats.employeeBreakdown = Object.values(employeeMap);

    res.status(200).json({
      success: true,
      period: { startDate: start, endDate: end },
      stats
    });
  } catch (error) {
    console.error('Get attendance report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching attendance report',
      error: error.message
    });
  }
};

// @desc    Export report
// @route   GET /api/admin/reports/:id/export
// @access  Private/Admin
exports.exportReport = async (req, res) => {
  try {
    const { format } = req.query; // 'pdf', 'excel', 'csv'
    const { reportType } = req.params;

    // In a real application, you would generate the actual file
    // For now, we'll just return the report data

    res.status(200).json({
      success: true,
      message: `Report export in ${format} format would be generated here`,
      reportType,
      format: format || 'pdf'
    });
  } catch (error) {
    console.error('Export report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting report',
      error: error.message
    });
  }
};

// @desc    Get project reports (Client)
// @route   GET /api/client/projects/:id/reports
// @access  Private/Client
exports.getProjectReports = async (req, res) => {
  try {
    const projectId = req.params.id;

    // Verify client has access to this project
    const project = await Project.findOne({
      _id: projectId,
      client: req.user.id
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    // Get project tasks
    const tasks = await Task.find({ project: projectId })
      .populate('assignedTo', 'name');

    // Get daily reports related to this project
    const dailyReports = await DailyReport.find({
      'tasksWorkedOn.task': { $in: tasks.map(t => t._id) }
    }).populate('employee', 'name');

    // Calculate project statistics
    const stats = {
      totalTasks: tasks.length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      inProgressTasks: tasks.filter(t => t.status === 'in-progress').length,
      pendingTasks: tasks.filter(t => t.status === 'pending').length,
      totalEstimatedHours: tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0),
      totalActualHours: tasks.reduce((sum, t) => sum + (t.actualHours || 0), 0),
      progress: project.progress || 0,
      teamSize: project.team?.length || 0,
      dailyReportsCount: dailyReports.length
    };

    res.status(200).json({
      success: true,
      project: {
        id: project._id,
        name: project.name,
        status: project.status
      },
      stats,
      recentReports: dailyReports.slice(0, 10)
    });
  } catch (error) {
    console.error('Get project reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching project reports',
      error: error.message
    });
  }
};

// @desc    Get weekly report (Client)
// @route   GET /api/client/projects/:id/reports/weekly
// @access  Private/Client
exports.getWeeklyReport = async (req, res) => {
  try {
    const projectId = req.params.id;
    const { week } = req.query; // week number or date

    // Verify access
    const project = await Project.findOne({
      _id: projectId,
      client: req.user.id
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    // Calculate week date range
    const weekStart = week ? new Date(week) : getWeekStart(new Date());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    // Get tasks for this week
    const tasks = await Task.find({
      project: projectId,
      $or: [
        { createdAt: { $gte: weekStart, $lte: weekEnd } },
        { completedDate: { $gte: weekStart, $lte: weekEnd } }
      ]
    }).populate('assignedTo', 'name');

    // Get daily reports for this week
    const dailyReports = await DailyReport.find({
      date: { $gte: weekStart, $lte: weekEnd },
      'tasksWorkedOn.task': { $in: tasks.map(t => t._id) }
    }).populate('employee', 'name');

    const weeklyStats = {
      week: `${weekStart.toISOString().split('T')[0]} to ${weekEnd.toISOString().split('T')[0]}`,
      tasksCreated: tasks.filter(t => t.createdAt >= weekStart && t.createdAt <= weekEnd).length,
      tasksCompleted: tasks.filter(t => t.completedDate && t.completedDate >= weekStart && t.completedDate <= weekEnd).length,
      hoursWorked: dailyReports.reduce((sum, r) => sum + (r.hoursWorked || 0), 0),
      teamActivity: dailyReports.length,
      progress: project.progress || 0
    };

    res.status(200).json({
      success: true,
      weeklyStats,
      dailyReports: dailyReports.slice(0, 20)
    });
  } catch (error) {
    console.error('Get weekly report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching weekly report',
      error: error.message
    });
  }
};

// @desc    Download report (Client)
// @route   GET /api/client/reports/:id/download
// @access  Private/Client
exports.downloadReport = async (req, res) => {
  try {
    const { format } = req.query; // 'pdf', 'excel'

    res.status(200).json({
      success: true,
      message: `Report download in ${format || 'pdf'} format would be generated here`
    });
  } catch (error) {
    console.error('Download report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error downloading report',
      error: error.message
    });
  }
};

// Helper functions
async function generateAttendanceReport(startDate, endDate, filters) {
  const query = {
    date: { $gte: new Date(startDate), $lte: new Date(endDate) }
  };

  if (filters?.employeeId) query.employee = filters.employeeId;
  if (filters?.department) query.department = filters.department;

  const records = await Attendance.find(query).populate('employee', 'name email department');

  return {
    totalRecords: records.length,
    present: records.filter(r => r.status === 'present').length,
    absent: records.filter(r => r.status === 'absent').length,
    late: records.filter(r => r.status === 'late').length,
    records: records.slice(0, 100) // Limit to 100 records
  };
}

async function generatePerformanceReport(startDate, endDate, filters) {
  // Similar to getPerformanceReport but with more customization
  return await exports.getPerformanceReport({ query: { startDate, endDate, ...filters } }, null);
}

async function generateProductivityReport(startDate, endDate, filters) {
  // Similar to getProductivityReport
  return await exports.getProductivityReport({ query: { startDate, endDate, ...filters } }, null);
}

async function generateProjectReport(startDate, endDate, filters) {
  const query = {
    createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
  };

  if (filters?.status) query.status = filters.status;
  if (filters?.clientId) query.client = filters.clientId;

  const projects = await Project.find(query).populate('client', 'companyName');

  return {
    totalProjects: projects.length,
    completed: projects.filter(p => p.status === 'completed').length,
    inProgress: projects.filter(p => p.status === 'in-progress').length,
    projects: projects.slice(0, 50)
  };
}

async function generateEmployeeReport(startDate, endDate, filters) {
  const query = {};
  if (filters?.department) query.department = filters.department;

  const employees = await Employee.find(query).populate('user', 'name email');

  return {
    totalEmployees: employees.length,
    byDepartment: groupByDepartment(employees),
    employees: employees.slice(0, 50)
  };
}

async function generateClientReport(startDate, endDate, filters) {
  const query = {};
  if (filters?.status) query.status = filters.status;

  const clients = await Client.find(query).populate('user', 'name email');

  return {
    totalClients: clients.length,
    activeClients: clients.filter(c => c.status === 'active').length,
    clients: clients.slice(0, 50)
  };
}

function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function groupByDepartment(employees) {
  const grouped = {};
  employees.forEach(emp => {
    const dept = emp.department || 'Unassigned';
    grouped[dept] = (grouped[dept] || 0) + 1;
  });
  return grouped;
}

module.exports = exports;