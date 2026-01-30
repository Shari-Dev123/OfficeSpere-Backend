// controllers/reportController.js
const Employee = require('../models/Employee');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Attendance = require('../models/Attendance');
const DailyReport = require('../models/DailyReport');
const Client = require('../models/Client');
const Meeting = require('../models/Meeting');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

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
    const { startDate, endDate, employeeId, department } = req.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    let employeeQuery = {};
    if (employeeId) employeeQuery._id = employeeId;
    if (department) employeeQuery.department = department;

    const employees = await Employee.find(employeeQuery).populate('userId', 'name email');

    const performanceData = await Promise.all(
      employees.map(async (employee) => {
        // Get tasks
        const tasks = await Task.find({
          assignedTo: employee._id,
          createdAt: { $gte: start, $lte: end }
        });

        const completedTasks = tasks.filter(t => t.status === 'completed');
        const onTimeTasks = completedTasks.filter(t => 
          t.completedDate && t.dueDate && new Date(t.completedDate) <= new Date(t.dueDate)
        );

        // Get attendance
        const attendance = await Attendance.find({
          employee: employee._id,
          date: { $gte: start, $lte: end }
        });

        const presentDays = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
        const lateDays = attendance.filter(a => a.status === 'late').length;

        // Get daily reports
        const dailyReports = await DailyReport.find({
          employee: employee._id,
          date: { $gte: start, $lte: end }
        });

        // Calculate metrics
        const taskCompletionRate = tasks.length > 0 ? (completedTasks.length / tasks.length) * 100 : 0;
        const onTimeDeliveryRate = completedTasks.length > 0 ? (onTimeTasks.length / completedTasks.length) * 100 : 0;
        const attendanceRate = attendance.length > 0 ? (presentDays / attendance.length) * 100 : 0;
        const punctualityRate = presentDays > 0 ? ((presentDays - lateDays) / presentDays) * 100 : 0;
        const reportSubmissionRate = attendance.length > 0 ? (dailyReports.length / attendance.length) * 100 : 0;

        // Calculate overall performance score (weighted average)
        const performanceScore = (
          taskCompletionRate * 0.30 +
          onTimeDeliveryRate * 0.25 +
          attendanceRate * 0.20 +
          punctualityRate * 0.15 +
          reportSubmissionRate * 0.10
        ).toFixed(2);

        // Calculate total hours worked
        const totalHoursWorked = attendance.reduce((sum, a) => sum + (a.totalWorkMinutes || 0), 0) / 60;
        const avgHoursPerDay = attendance.length > 0 ? totalHoursWorked / attendance.length : 0;

        return {
          employeeId: employee._id,
          employeeName: employee.user?.name || employee.name || 'Unknown',
          email: employee.user?.email || employee.email,
          department: employee.department || 'N/A',
          position: employee.position || 'N/A',
          metrics: {
            totalTasks: tasks.length,
            completedTasks: completedTasks.length,
            inProgressTasks: tasks.filter(t => t.status === 'in-progress').length,
            onTimeTasks: onTimeTasks.length,
            overdueTasks: tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed').length,
            taskCompletionRate: taskCompletionRate.toFixed(2),
            onTimeDeliveryRate: onTimeDeliveryRate.toFixed(2),
            totalAttendanceDays: attendance.length,
            presentDays: presentDays,
            absentDays: attendance.filter(a => a.status === 'absent').length,
            lateDays: lateDays,
            attendanceRate: attendanceRate.toFixed(2),
            punctualityRate: punctualityRate.toFixed(2),
            dailyReportsSubmitted: dailyReports.length,
            reportSubmissionRate: reportSubmissionRate.toFixed(2),
            totalHoursWorked: totalHoursWorked.toFixed(2),
            avgHoursPerDay: avgHoursPerDay.toFixed(2)
          },
          performanceScore: performanceScore,
          rating: getPerformanceRating(parseFloat(performanceScore)),
          trend: calculateTrend(employee._id, start, end)
        };
      })
    );

    // Sort by performance score
    performanceData.sort((a, b) => b.performanceScore - a.performanceScore);

    // Calculate overall statistics
    const avgPerformanceScore = performanceData.length > 0 
      ? (performanceData.reduce((sum, emp) => sum + parseFloat(emp.performanceScore), 0) / performanceData.length).toFixed(2)
      : 0;

    const avgTaskCompletionRate = performanceData.length > 0
      ? (performanceData.reduce((sum, emp) => sum + parseFloat(emp.metrics.taskCompletionRate), 0) / performanceData.length).toFixed(2)
      : 0;

    const avgAttendanceRate = performanceData.length > 0
      ? (performanceData.reduce((sum, emp) => sum + parseFloat(emp.metrics.attendanceRate), 0) / performanceData.length).toFixed(2)
      : 0;

    res.status(200).json({
      success: true,
      period: { 
        startDate: start.toISOString().split('T')[0], 
        endDate: end.toISOString().split('T')[0] 
      },
      summary: {
        totalEmployees: performanceData.length,
        avgPerformanceScore: avgPerformanceScore,
        avgTaskCompletionRate: avgTaskCompletionRate,
        avgAttendanceRate: avgAttendanceRate,
        topPerformers: performanceData.slice(0, 5),
        needsImprovement: performanceData.slice(-5).reverse(),
        excellentCount: performanceData.filter(e => parseFloat(e.performanceScore) >= 90).length,
        goodCount: performanceData.filter(e => parseFloat(e.performanceScore) >= 75 && parseFloat(e.performanceScore) < 90).length,
        averageCount: performanceData.filter(e => parseFloat(e.performanceScore) >= 60 && parseFloat(e.performanceScore) < 75).length,
        poorCount: performanceData.filter(e => parseFloat(e.performanceScore) < 60).length
      },
      data: performanceData
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
    const { startDate, endDate, projectId, employeeId } = req.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    let projectQuery = {
      createdAt: { $gte: start, $lte: end }
    };
    if (projectId) projectQuery._id = projectId;

    let taskQuery = {
      createdAt: { $gte: start, $lte: end }
    };
    if (employeeId) taskQuery.assignedTo = employeeId;
    if (projectId) taskQuery.project = projectId;

    // Get projects
    const projects = await Project.find(projectQuery)
      .populate('client', 'companyName user')
      .populate('team', 'name');

    // Get tasks
    const tasks = await Task.find(taskQuery)
      .populate('project', 'name')
      .populate('assignedTo', 'name');

    // Get daily reports
    const dailyReports = await DailyReport.find({
      date: { $gte: start, $lte: end }
    }).populate('employee', 'name');

    // Calculate productivity metrics
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const inProgressTasks = tasks.filter(t => t.status === 'in-progress').length;
    const pendingTasks = tasks.filter(t => t.status === 'pending').length;
    const overdueTasks = tasks.filter(t => 
      t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed'
    ).length;

    const totalEstimatedHours = tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
    const totalActualHours = tasks.reduce((sum, t) => sum + (t.actualHours || 0), 0);
    
    const efficiency = totalEstimatedHours > 0 && totalActualHours > 0
      ? ((totalEstimatedHours / totalActualHours) * 100).toFixed(2)
      : 0;

    // Project breakdown
    const projectBreakdown = projects.map(project => {
      const projectTasks = tasks.filter(t => t.project?._id.toString() === project._id.toString());
      const completedProjectTasks = projectTasks.filter(t => t.status === 'completed').length;
      
      return {
        projectId: project._id,
        projectName: project.name,
        client: project.client?.companyName || 'N/A',
        status: project.status,
        progress: project.progress || 0,
        totalTasks: projectTasks.length,
        completedTasks: completedProjectTasks,
        completionRate: projectTasks.length > 0 ? ((completedProjectTasks / projectTasks.length) * 100).toFixed(2) : 0,
        estimatedHours: projectTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0),
        actualHours: projectTasks.reduce((sum, t) => sum + (t.actualHours || 0), 0),
        teamSize: project.team?.length || 0
      };
    });

    // Weekly productivity breakdown
    const weeklyData = getWeeklyBreakdown(tasks, dailyReports, start, end);

    // Employee productivity
    const employeeProductivity = await calculateEmployeeProductivity(tasks, start, end);

    res.status(200).json({
      success: true,
      period: { 
        startDate: start.toISOString().split('T')[0], 
        endDate: end.toISOString().split('T')[0] 
      },
      summary: {
        totalProjects: projects.length,
        activeProjects: projects.filter(p => p.status === 'in-progress').length,
        completedProjects: projects.filter(p => p.status === 'completed').length,
        totalTasks: totalTasks,
        completedTasks: completedTasks,
        inProgressTasks: inProgressTasks,
        pendingTasks: pendingTasks,
        overdueTasks: overdueTasks,
        taskCompletionRate: totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(2) : 0,
        totalEstimatedHours: totalEstimatedHours.toFixed(2),
        totalActualHours: totalActualHours.toFixed(2),
        efficiency: efficiency,
        dailyReportsSubmitted: dailyReports.length,
        avgTasksPerDay: weeklyData.length > 0 ? (completedTasks / weeklyData.length).toFixed(2) : 0
      },
      projectBreakdown: projectBreakdown,
      weeklyProductivity: weeklyData,
      employeeProductivity: employeeProductivity,
      insights: generateProductivityInsights(projectBreakdown, employeeProductivity, efficiency)
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
    if (employeeId) query.employee = employeeId;

    const attendanceRecords = await Attendance.find(query)
      .populate('employee', 'name email department position');

    // Filter by department if provided
    let filteredRecords = attendanceRecords;
    if (department) {
      filteredRecords = attendanceRecords.filter(
        record => record.employee?.department === department
      );
    }

    // Calculate overall statistics
    const totalRecords = filteredRecords.length;
    const presentCount = filteredRecords.filter(r => r.status === 'present').length;
    const absentCount = filteredRecords.filter(r => r.status === 'absent').length;
    const lateCount = filteredRecords.filter(r => r.status === 'late').length;
    const leaveCount = filteredRecords.filter(r => r.status === 'leave').length;
    const halfDayCount = filteredRecords.filter(r => r.status === 'half-day').length;

    // Calculate work hours
    const totalMinutes = filteredRecords.reduce((sum, record) => {
      return sum + (record.totalWorkMinutes || 0);
    }, 0);

    const totalWorkHours = (totalMinutes / 60).toFixed(2);
    const averageWorkHours = totalRecords > 0 
      ? (totalMinutes / 60 / totalRecords).toFixed(2) 
      : 0;

    // Employee breakdown
    const employeeMap = {};
    filteredRecords.forEach(record => {
      if (record.employee) {
        const empId = record.employee._id.toString();
        if (!employeeMap[empId]) {
          employeeMap[empId] = {
            employeeId: record.employee._id,
            employeeName: record.employee.name || 'Unknown',
            email: record.employee.email,
            department: record.employee.department || 'N/A',
            position: record.employee.position || 'N/A',
            totalDays: 0,
            presentDays: 0,
            absentDays: 0,
            lateDays: 0,
            leaveDays: 0,
            halfDays: 0,
            totalWorkHours: 0,
            avgWorkHours: 0,
            attendanceRate: 0,
            punctualityRate: 0,
            lateArrivals: []
          };
        }

        const emp = employeeMap[empId];
        emp.totalDays++;

        switch(record.status) {
          case 'present':
            emp.presentDays++;
            break;
          case 'absent':
            emp.absentDays++;
            break;
          case 'late':
            emp.lateDays++;
            emp.lateArrivals.push({
              date: record.date,
              checkIn: record.checkIn,
              minutesLate: record.lateMinutes || 0
            });
            break;
          case 'leave':
            emp.leaveDays++;
            break;
          case 'half-day':
            emp.halfDays++;
            break;
        }

        emp.totalWorkHours += (record.totalWorkMinutes || 0) / 60;
      }
    });

    // Calculate rates and averages for each employee
    const employeeBreakdown = Object.values(employeeMap).map(emp => {
      const workingDays = emp.presentDays + emp.lateDays + emp.halfDays;
      emp.attendanceRate = emp.totalDays > 0 
        ? ((workingDays / emp.totalDays) * 100).toFixed(2)
        : 0;
      emp.punctualityRate = workingDays > 0
        ? (((workingDays - emp.lateDays) / workingDays) * 100).toFixed(2)
        : 0;
      emp.avgWorkHours = workingDays > 0
        ? (emp.totalWorkHours / workingDays).toFixed(2)
        : 0;
      emp.totalWorkHours = emp.totalWorkHours.toFixed(2);
      emp.rating = getAttendanceRating(parseFloat(emp.attendanceRate), parseFloat(emp.punctualityRate));
      
      return emp;
    });

    // Sort by attendance rate
    employeeBreakdown.sort((a, b) => parseFloat(b.attendanceRate) - parseFloat(a.attendanceRate));

    // Daily attendance summary
    const dailySummary = getDailyAttendanceSummary(filteredRecords, start, end);

    // Department-wise breakdown
    const departmentBreakdown = getDepartmentBreakdown(employeeBreakdown);

    res.status(200).json({
      success: true,
      period: { 
        startDate: start.toISOString().split('T')[0], 
        endDate: end.toISOString().split('T')[0] 
      },
      summary: {
        totalRecords: totalRecords,
        totalEmployees: employeeBreakdown.length,
        presentCount: presentCount,
        absentCount: absentCount,
        lateCount: lateCount,
        leaveCount: leaveCount,
        halfDayCount: halfDayCount,
        overallAttendanceRate: totalRecords > 0 
          ? (((presentCount + lateCount) / totalRecords) * 100).toFixed(2)
          : 0,
        overallPunctualityRate: (presentCount + lateCount) > 0
          ? ((presentCount / (presentCount + lateCount)) * 100).toFixed(2)
          : 0,
        totalWorkHours: totalWorkHours,
        averageWorkHours: averageWorkHours,
        excellentAttendance: employeeBreakdown.filter(e => parseFloat(e.attendanceRate) >= 95).length,
        goodAttendance: employeeBreakdown.filter(e => parseFloat(e.attendanceRate) >= 85 && parseFloat(e.attendanceRate) < 95).length,
        poorAttendance: employeeBreakdown.filter(e => parseFloat(e.attendanceRate) < 75).length
      },
      employeeBreakdown: employeeBreakdown,
      dailySummary: dailySummary,
      departmentBreakdown: departmentBreakdown,
      insights: generateAttendanceInsights(employeeBreakdown, dailySummary)
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

// @desc    Get employee comprehensive report
// @route   GET /api/admin/reports/employee
// @access  Private/Admin
exports.getEmployeeReport = async (req, res) => {
  try {
    const { employeeId, department } = req.query;

    let query = {};
    if (employeeId) query._id = employeeId;
    if (department) query.department = department;

    const employees = await Employee.find(query).populate('userId', 'name email');

    const employeeReports = await Promise.all(
      employees.map(async (employee) => {
        // Get all related data
        const [tasks, projects, attendance, dailyReports, meetings] = await Promise.all([
          Task.find({ assignedTo: employee._id }),
          Project.find({ 'team': employee._id }),
          Attendance.find({ employee: employee._id }).sort({ date: -1 }).limit(90),
          DailyReport.find({ employee: employee._id }).sort({ date: -1 }).limit(30),
          Meeting.find({ 'participants.employee': employee._id })
        ]);

        // Calculate statistics
        const completedTasks = tasks.filter(t => t.status === 'completed').length;
        const presentDays = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
        const activeProjects = projects.filter(p => p.status === 'in-progress').length;

        return {
          employeeId: employee._id,
          personalInfo: {
            name: employee.user?.name || employee.name || 'Unknown',
            email: employee.user?.email || employee.email,
            phone: employee.phone || 'N/A',
            department: employee.department || 'N/A',
            position: employee.position || 'N/A',
            joiningDate: employee.joiningDate,
            employeeCode: employee.employeeCode || 'N/A',
            status: employee.status || 'active'
          },
          performance: {
            totalTasks: tasks.length,
            completedTasks: completedTasks,
            inProgressTasks: tasks.filter(t => t.status === 'in-progress').length,
            completionRate: tasks.length > 0 ? ((completedTasks / tasks.length) * 100).toFixed(2) : 0,
            averageTaskRating: calculateAverageRating(tasks)
          },
          projects: {
            total: projects.length,
            active: activeProjects,
            completed: projects.filter(p => p.status === 'completed').length,
            onHold: projects.filter(p => p.status === 'on-hold').length,
            projectsList: projects.map(p => ({
              id: p._id,
              name: p.name,
              status: p.status,
              progress: p.progress || 0
            }))
          },
          attendance: {
            totalDays: attendance.length,
            presentDays: presentDays,
            absentDays: attendance.filter(a => a.status === 'absent').length,
            lateDays: attendance.filter(a => a.status === 'late').length,
            leaveDays: attendance.filter(a => a.status === 'leave').length,
            attendanceRate: attendance.length > 0 
              ? ((presentDays / attendance.length) * 100).toFixed(2)
              : 0,
            recentAttendance: attendance.slice(0, 7).map(a => ({
              date: a.date,
              status: a.status,
              checkIn: a.checkIn,
              checkOut: a.checkOut,
              workHours: a.totalWorkMinutes ? (a.totalWorkMinutes / 60).toFixed(2) : 0
            }))
          },
          dailyReports: {
            total: dailyReports.length,
            submissionRate: attendance.length > 0 
              ? ((dailyReports.length / attendance.length) * 100).toFixed(2)
              : 0,
            recent: dailyReports.slice(0, 5).map(r => ({
              date: r.date,
              tasksCompleted: r.tasksCompleted?.length || 0,
              hoursWorked: r.hoursWorked || 0,
              summary: r.summary
            }))
          },
          meetings: {
            total: meetings.length,
            upcoming: meetings.filter(m => new Date(m.date) > new Date()).length,
            completed: meetings.filter(m => m.status === 'completed').length
          },
          skills: employee.skills || [],
          certifications: employee.certifications || [],
          overallRating: calculateOverallEmployeeRating(
            tasks.length > 0 ? completedTasks / tasks.length : 0,
            attendance.length > 0 ? presentDays / attendance.length : 0,
            dailyReports.length / 30
          )
        };
      })
    );

    res.status(200).json({
      success: true,
      totalEmployees: employeeReports.length,
      data: employeeReports
    });
  } catch (error) {
    console.error('Get employee report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching employee report',
      error: error.message
    });
  }
};

// @desc    Export report
// @route   GET /api/admin/reports/:reportType/export
// @access  Private/Admin
exports.exportReport = async (req, res) => {
  try {
    const { reportType } = req.params;
    const { format, startDate, endDate, employeeId, department } = req.query;

    // Generate report data first
    let reportData;
    const fakeReq = { query: { startDate, endDate, employeeId, department } };
    const fakeRes = {
      status: (code) => ({
        json: (data) => { reportData = data; }
      })
    };

    switch(reportType) {
      case 'performance':
        await exports.getPerformanceReport(fakeReq, fakeRes);
        break;
      case 'attendance':
        await exports.getAttendanceReport(fakeReq, fakeRes);
        break;
      case 'productivity':
        await exports.getProductivityReport(fakeReq, fakeRes);
        break;
      case 'employee':
        await exports.getEmployeeReport(fakeReq, fakeRes);
        break;
      default:
        return res.status(400).json({ success: false, message: 'Invalid report type' });
    }

    if (!reportData || !reportData.success) {
      return res.status(500).json({ success: false, message: 'Failed to generate report data' });
    }

    if (format === 'pdf') {
      await generatePDFReport(res, reportType, reportData);
    } else if (format === 'excel' || format === 'xlsx') {
      await generateExcelReport(res, reportType, reportData);
    } else if (format === 'csv') {
      await generateCSVReport(res, reportType, reportData);
    } else {
      res.status(400).json({ success: false, message: 'Invalid format. Use pdf, excel, or csv' });
    }

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
      client: req.user.clientId
    }).populate('client', 'companyName');

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    // Get project tasks
    const tasks = await Task.find({ project: projectId })
      .populate('assignedTo', 'name')
      .sort({ createdAt: -1 });

    // Get daily reports related to this project
    const dailyReports = await DailyReport.find({
      'tasksWorkedOn.task': { $in: tasks.map(t => t._id) }
    }).populate('employee', 'name').sort({ date: -1 });

    // Get meetings
    const meetings = await Meeting.find({
      project: projectId
    }).sort({ date: -1 });

    // Calculate project statistics
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const totalEstimatedHours = tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
    const totalActualHours = tasks.reduce((sum, t) => sum + (t.actualHours || 0), 0);

    const stats = {
      totalTasks: tasks.length,
      completedTasks: completedTasks,
      inProgressTasks: tasks.filter(t => t.status === 'in-progress').length,
      pendingTasks: tasks.filter(t => t.status === 'pending').length,
      taskCompletionRate: tasks.length > 0 ? ((completedTasks / tasks.length) * 100).toFixed(2) : 0,
      totalEstimatedHours: totalEstimatedHours.toFixed(2),
      totalActualHours: totalActualHours.toFixed(2),
      efficiency: totalEstimatedHours > 0 ? ((totalEstimatedHours / totalActualHours) * 100).toFixed(2) : 0,
      progress: project.progress || 0,
      status: project.status,
      teamSize: project.team?.length || 0,
      dailyReportsCount: dailyReports.length,
      meetingsCount: meetings.length,
      timeline: {
        startDate: project.startDate,
        endDate: project.endDate,
        daysRemaining: project.endDate ? Math.ceil((new Date(project.endDate) - new Date()) / (1000 * 60 * 60 * 24)) : 'N/A'
      }
    };

    res.status(200).json({
      success: true,
      project: {
        id: project._id,
        name: project.name,
        description: project.description,
        status: project.status,
        client: project.client?.companyName
      },
      stats,
      recentTasks: tasks.slice(0, 10),
      recentReports: dailyReports.slice(0, 10),
      upcomingMeetings: meetings.filter(m => new Date(m.date) > new Date()).slice(0, 5)
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
    const { week } = req.query;

    // Verify access
    const project = await Project.findOne({
      _id: projectId,
      client: req.user.clientId
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
      progress: project.progress || 0,
      efficiency: calculateWeeklyEfficiency(tasks, dailyReports)
    };

    res.status(200).json({
      success: true,
      weeklyStats,
      tasks: tasks,
      dailyReports: dailyReports,
      insights: generateWeeklyInsights(weeklyStats, tasks, dailyReports)
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
    const { id } = req.params;
    const { format } = req.query;

    // Generate and send report file
    res.status(200).json({
      success: true,
      message: `Report download in ${format || 'pdf'} format would be generated here`,
      reportId: id
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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Generate PDF report
async function generatePDFReport(res, reportType, reportData) {
  const doc = new PDFDocument({ margin: 50 });
  
  // Set response headers
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${reportType}-report-${Date.now()}.pdf`);
  
  doc.pipe(res);

  // Title
  doc.fontSize(24).text(`${reportType.toUpperCase()} REPORT`, { align: 'center' });
  doc.moveDown();
  
  // Date range
  if (reportData.period) {
    doc.fontSize(12).text(`Period: ${reportData.period.startDate} to ${reportData.period.endDate}`, { align: 'center' });
    doc.moveDown(2);
  }

  // Summary section
  if (reportData.summary) {
    doc.fontSize(16).text('Summary', { underline: true });
    doc.moveDown();
    doc.fontSize(11);
    Object.entries(reportData.summary).forEach(([key, value]) => {
      if (typeof value !== 'object' && !Array.isArray(value)) {
        doc.text(`${formatKey(key)}: ${value}`);
      }
    });
    doc.moveDown(2);
  }

  // Add more content based on report type
  // This is a basic implementation - enhance as needed

  doc.end();
}

// Generate Excel report
async function generateExcelReport(res, reportType, reportData) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(reportType);

  // Add title
  worksheet.addRow([`${reportType.toUpperCase()} REPORT`]);
  worksheet.addRow([]);
  
  if (reportData.period) {
    worksheet.addRow([`Period: ${reportData.period.startDate} to ${reportData.period.endDate}`]);
    worksheet.addRow([]);
  }

  // Add summary
  if (reportData.summary) {
    worksheet.addRow(['SUMMARY']);
    Object.entries(reportData.summary).forEach(([key, value]) => {
      if (typeof value !== 'object' && !Array.isArray(value)) {
        worksheet.addRow([formatKey(key), value]);
      }
    });
    worksheet.addRow([]);
  }

  // Add data based on report type
  if (reportData.data && Array.isArray(reportData.data)) {
    worksheet.addRow(['DETAILED DATA']);
    
    // Add headers
    const headers = Object.keys(reportData.data[0] || {});
    worksheet.addRow(headers.map(formatKey));
    
    // Add data rows
    reportData.data.forEach(row => {
      worksheet.addRow(Object.values(row));
    });
  } else if (reportData.employeeBreakdown && Array.isArray(reportData.employeeBreakdown)) {
    worksheet.addRow(['EMPLOYEE BREAKDOWN']);
    
    const headers = Object.keys(reportData.employeeBreakdown[0] || {});
    worksheet.addRow(headers.map(formatKey));
    
    reportData.employeeBreakdown.forEach(row => {
      worksheet.addRow(Object.values(row));
    });
  }

  // Set response headers
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=${reportType}-report-${Date.now()}.xlsx`);

  await workbook.xlsx.write(res);
  res.end();
}

// Generate CSV report
async function generateCSVReport(res, reportType, reportData) {
  let csvContent = '';

  // Title
  csvContent += `${reportType.toUpperCase()} REPORT\n\n`;
  
  // Period
  if (reportData.period) {
    csvContent += `Period,${reportData.period.startDate} to ${reportData.period.endDate}\n\n`;
  }

  // Summary
  if (reportData.summary) {
    csvContent += 'SUMMARY\n';
    Object.entries(reportData.summary).forEach(([key, value]) => {
      if (typeof value !== 'object' && !Array.isArray(value)) {
        csvContent += `${formatKey(key)},${value}\n`;
      }
    });
    csvContent += '\n';
  }

  // Data
  if (reportData.data && Array.isArray(reportData.data) && reportData.data.length > 0) {
    csvContent += 'DETAILED DATA\n';
    const headers = Object.keys(reportData.data[0]);
    csvContent += headers.map(formatKey).join(',') + '\n';
    
    reportData.data.forEach(row => {
      csvContent += Object.values(row).map(v => `"${v}"`).join(',') + '\n';
    });
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=${reportType}-report-${Date.now()}.csv`);
  res.send(csvContent);
}

// Helper to format object keys
function formatKey(key) {
  return key.replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

// Calculate performance rating
function getPerformanceRating(score) {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Average';
  return 'Needs Improvement';
}

// Calculate attendance rating
function getAttendanceRating(attendanceRate, punctualityRate) {
  const avgRate = (parseFloat(attendanceRate) + parseFloat(punctualityRate)) / 2;
  if (avgRate >= 95) return 'Excellent';
  if (avgRate >= 85) return 'Good';
  if (avgRate >= 75) return 'Average';
  return 'Poor';
}

// Calculate trend (simplified)
function calculateTrend(employeeId, startDate, endDate) {
  // This should compare with previous period
  // Simplified version
  return 'stable'; // Can be 'improving', 'declining', 'stable'
}

// Calculate weekly breakdown
function getWeeklyBreakdown(tasks, dailyReports, startDate, endDate) {
  const weeks = {};
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const weekNum = getWeekNumber(current);
    if (!weeks[weekNum]) {
      weeks[weekNum] = {
        week: weekNum,
        tasksCompleted: 0,
        hoursWorked: 0,
        reportsSubmitted: 0
      };
    }
    current.setDate(current.getDate() + 1);
  }

  tasks.filter(t => t.status === 'completed' && t.completedDate).forEach(task => {
    const weekNum = getWeekNumber(new Date(task.completedDate));
    if (weeks[weekNum]) {
      weeks[weekNum].tasksCompleted++;
    }
  });

  dailyReports.forEach(report => {
    const weekNum = getWeekNumber(new Date(report.date));
    if (weeks[weekNum]) {
      weeks[weekNum].reportsSubmitted++;
      weeks[weekNum].hoursWorked += report.hoursWorked || 0;
    }
  });

  return Object.values(weeks).sort((a, b) => a.week - b.week);
}

// Calculate employee productivity
async function calculateEmployeeProductivity(tasks, startDate, endDate) {
  const employeeMap = {};
  
  tasks.forEach(task => {
    if (task.assignedTo && Array.isArray(task.assignedTo)) {
      task.assignedTo.forEach(emp => {
        const empId = emp._id.toString();
        if (!employeeMap[empId]) {
          employeeMap[empId] = {
            employeeName: emp.name || 'Unknown',
            totalTasks: 0,
            completedTasks: 0,
            hoursSpent: 0
          };
        }
        employeeMap[empId].totalTasks++;
        if (task.status === 'completed') {
          employeeMap[empId].completedTasks++;
        }
        employeeMap[empId].hoursSpent += task.actualHours || 0;
      });
    }
  });

  return Object.values(employeeMap).map(emp => ({
    ...emp,
    completionRate: emp.totalTasks > 0 ? ((emp.completedTasks / emp.totalTasks) * 100).toFixed(2) : 0,
    avgHoursPerTask: emp.completedTasks > 0 ? (emp.hoursSpent / emp.completedTasks).toFixed(2) : 0
  })).sort((a, b) => b.completedTasks - a.completedTasks);
}

// Generate productivity insights
function generateProductivityInsights(projectBreakdown, employeeProductivity, efficiency) {
  const insights = [];
  
  if (parseFloat(efficiency) > 100) {
    insights.push('Overall efficiency is above target - projects are being delivered faster than estimated');
  } else if (parseFloat(efficiency) < 80) {
    insights.push('Overall efficiency is below target - consider reviewing task estimates');
  }
  
  const highPerformers = employeeProductivity.filter(e => parseFloat(e.completionRate) > 90);
  if (highPerformers.length > 0) {
    insights.push(`${highPerformers.length} employee(s) have completion rates above 90%`);
  }
  
  const delayedProjects = projectBreakdown.filter(p => parseFloat(p.completionRate) < 50 && p.status === 'in-progress');
  if (delayedProjects.length > 0) {
    insights.push(`${delayedProjects.length} project(s) may need additional resources or attention`);
  }
  
  return insights;
}

// Generate attendance insights
function generateAttendanceInsights(employeeBreakdown, dailySummary) {
  const insights = [];
  
  const poorAttendance = employeeBreakdown.filter(e => parseFloat(e.attendanceRate) < 75);
  if (poorAttendance.length > 0) {
    insights.push(`${poorAttendance.length} employee(s) have attendance below 75%`);
  }
  
  const chronicLateness = employeeBreakdown.filter(e => e.lateDays > e.presentDays * 0.3);
  if (chronicLateness.length > 0) {
    insights.push(`${chronicLateness.length} employee(s) are frequently late`);
  }
  
  const excellentAttendance = employeeBreakdown.filter(e => parseFloat(e.attendanceRate) >= 95);
  if (excellentAttendance.length > 0) {
    insights.push(`${excellentAttendance.length} employee(s) have excellent attendance (95%+)`);
  }
  
  return insights;
}

// Get daily attendance summary
function getDailyAttendanceSummary(records, startDate, endDate) {
  const dailyMap = {};
  
  records.forEach(record => {
    const dateKey = record.date.toISOString().split('T')[0];
    if (!dailyMap[dateKey]) {
      dailyMap[dateKey] = {
        date: dateKey,
        present: 0,
        absent: 0,
        late: 0,
        leave: 0
      };
    }
    
    switch(record.status) {
      case 'present':
        dailyMap[dateKey].present++;
        break;
      case 'absent':
        dailyMap[dateKey].absent++;
        break;
      case 'late':
        dailyMap[dateKey].late++;
        break;
      case 'leave':
        dailyMap[dateKey].leave++;
        break;
    }
  });
  
  return Object.values(dailyMap).sort((a, b) => new Date(a.date) - new Date(b.date));
}

// Get department breakdown
function getDepartmentBreakdown(employeeBreakdown) {
  const deptMap = {};
  
  employeeBreakdown.forEach(emp => {
    const dept = emp.department || 'N/A';
    if (!deptMap[dept]) {
      deptMap[dept] = {
        department: dept,
        employeeCount: 0,
        avgAttendanceRate: 0,
        avgPunctualityRate: 0,
        totalWorkHours: 0
      };
    }
    
    deptMap[dept].employeeCount++;
    deptMap[dept].avgAttendanceRate += parseFloat(emp.attendanceRate);
    deptMap[dept].avgPunctualityRate += parseFloat(emp.punctualityRate);
    deptMap[dept].totalWorkHours += parseFloat(emp.totalWorkHours);
  });
  
  return Object.values(deptMap).map(dept => ({
    ...dept,
    avgAttendanceRate: (dept.avgAttendanceRate / dept.employeeCount).toFixed(2),
    avgPunctualityRate: (dept.avgPunctualityRate / dept.employeeCount).toFixed(2),
    totalWorkHours: dept.totalWorkHours.toFixed(2)
  }));
}

// Calculate average rating
function calculateAverageRating(tasks) {
  const ratedTasks = tasks.filter(t => t.rating && t.rating > 0);
  if (ratedTasks.length === 0) return 'N/A';
  
  const sum = ratedTasks.reduce((total, task) => total + task.rating, 0);
  return (sum / ratedTasks.length).toFixed(2);
}

// Calculate overall employee rating
function calculateOverallEmployeeRating(taskRate, attendanceRate, reportRate) {
  const score = (taskRate * 40 + attendanceRate * 35 + reportRate * 25) * 100;
  return score.toFixed(2);
}

// Calculate weekly efficiency
function calculateWeeklyEfficiency(tasks, dailyReports) {
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const totalEstimated = completedTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
  const totalActual = completedTasks.reduce((sum, t) => sum + (t.actualHours || 0), 0);
  
  if (totalEstimated === 0 || totalActual === 0) return 'N/A';
  return ((totalEstimated / totalActual) * 100).toFixed(2);
}

// Generate weekly insights
function generateWeeklyInsights(weeklyStats, tasks, dailyReports) {
  const insights = [];
  
  if (weeklyStats.tasksCompleted > weeklyStats.tasksCreated) {
    insights.push('Great progress! More tasks completed than created this week');
  }
  
  if (weeklyStats.hoursWorked > 0) {
    const avgHoursPerDay = weeklyStats.hoursWorked / 7;
    if (avgHoursPerDay > 8) {
      insights.push('Team is working overtime - consider workload distribution');
    }
  }
  
  if (weeklyStats.teamActivity < 5) {
    insights.push('Low team activity - follow up with team members');
  }
  
  return insights;
}

// Get week number
function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Get week start date
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

// Generate attendance report helper
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
    leave: records.filter(r => r.status === 'leave').length,
    records: records.slice(0, 100)
  };
}

// Generate performance report helper
async function generatePerformanceReport(startDate, endDate, filters) {
  const fakeReq = { query: { startDate, endDate, ...filters } };
  let result;
  const fakeRes = {
    status: () => ({ json: (data) => { result = data; } })
  };
  
  await exports.getPerformanceReport(fakeReq, fakeRes);
  return result;
}

// Generate productivity report helper
async function generateProductivityReport(startDate, endDate, filters) {
  const fakeReq = { query: { startDate, endDate, ...filters } };
  let result;
  const fakeRes = {
    status: () => ({ json: (data) => { result = data; } })
  };
  
  await exports.getProductivityReport(fakeReq, fakeRes);
  return result;
}

// Generate project report helper
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
    onHold: projects.filter(p => p.status === 'on-hold').length,
    projects: projects.slice(0, 50)
  };
}

// Generate employee report helper
async function generateEmployeeReport(startDate, endDate, filters) {
  const query = {};
  if (filters?.department) query.department = filters.department;

  const employees = await Employee.find(query).populate('userId', 'name email');

  return {
    totalEmployees: employees.length,
    byDepartment: groupByDepartment(employees),
    employees: employees.slice(0, 50).map(e => ({
      id: e._id,
      name: e.user?.name || e.name,
      email: e.user?.email || e.email,
      department: e.department,
      position: e.position
    }))
  };
}

// Generate client report helper
async function generateClientReport(startDate, endDate, filters) {
  const query = {};
  if (filters?.status) query.status = filters.status;

  const clients = await Client.find(query).populate('userId', 'name email');

  return {
    totalClients: clients.length,
    activeClients: clients.filter(c => c.status === 'active').length,
    inactiveClients: clients.filter(c => c.status === 'inactive').length,
    clients: clients.slice(0, 50).map(c => ({
      id: c._id,
      companyName: c.companyName,
      contactPerson: c.user?.name || c.contactPerson,
      email: c.user?.email || c.email,
      status: c.status
    }))
  };
}

// Group by department
function groupByDepartment(employees) {
  const grouped = {};
  employees.forEach(emp => {
    const dept = emp.department || 'Unassigned';
    grouped[dept] = (grouped[dept] || 0) + 1;
  });
  return grouped;
}

module.exports = exports;
