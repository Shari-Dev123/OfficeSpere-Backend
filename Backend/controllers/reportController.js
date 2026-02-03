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
const {
  notifyDailyReportSubmitted,
  notifyReportGenerated
} = require('../utils/Notificationhelper');


// @desc    Generate custom report
// @route   POST /api/admin/reports/generate
// @access  Private/Admin
exports.generateReport = async (req, res) => {
  try {
    const { reportType, startDate, endDate, filters } = req.body;

    if (!reportType || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Please provide report type, start date, and end date",
      });
    }

    let reportData = {};

    switch (reportType) {
      case "attendance":
        reportData = await generateAttendanceReport(
          startDate,
          endDate,
          filters,
        );
        break;
      case "performance":
        reportData = await generatePerformanceReport(
          startDate,
          endDate,
          filters,
        );
        break;
      case "productivity":
        reportData = await generateProductivityReport(
          startDate,
          endDate,
          filters,
        );
        break;
      case "project":
        reportData = await generateProjectReport(startDate, endDate, filters);
        break;
      case "employee":
        reportData = await generateEmployeeReport(startDate, endDate, filters);
        break;
      case "client":
        reportData = await generateClientReport(startDate, endDate, filters);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: "Invalid report type",
        });
    }

    res.status(200).json({
      success: true,
      reportType,
      period: { startDate, endDate },
      generatedAt: new Date(),
      data: reportData,
    });
  } catch (error) {
    console.error("Generate report error:", error);
    res.status(500).json({
      success: false,
      message: "Error generating report",
      error: error.message,
    });
  }
};

// @desc    Get performance report
// @route   GET /api/admin/reports/performance
// @access  Private/Admin
exports.getPerformanceReport = async (req, res) => {
  try {
    const { startDate, endDate, employee, department } = req.query;

    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    let employeeQuery = {};
    if (employee) employeeQuery._id = employee;
    if (department) employeeQuery.department = department;

    const employees = await Employee.find(employeeQuery).populate(
      "userId",
      "name email",
    );

    const performanceData = await Promise.all(
      employees.map(async (employee) => {
        // Get tasks
        const tasks = await Task.find({
          assignedTo: employee._id,
          createdAt: { $gte: start, $lte: end },
        });

        const completedTasks = tasks.filter((t) => t.status === "completed");
        const onTimeTasks = completedTasks.filter(
          (t) =>
            t.completedDate &&
            t.dueDate &&
            new Date(t.completedDate) <= new Date(t.dueDate),
        );

        // Get attendance
        const attendance = await Attendance.find({
          employee: employee._id,
          date: { $gte: start, $lte: end },
        });

        const presentDays = attendance.filter(
          (a) => a.status === "present" || a.status === "late",
        ).length;
        const lateDays = attendance.filter((a) => a.status === "late").length;

        // Get daily reports
        const dailyReports = await DailyReport.find({
          employee: employee._id,
          date: { $gte: start, $lte: end },
        });

        // Calculate metrics
        const taskCompletionRate =
          tasks.length > 0 ? (completedTasks.length / tasks.length) * 100 : 0;
        const onTimeDeliveryRate =
          completedTasks.length > 0
            ? (onTimeTasks.length / completedTasks.length) * 100
            : 0;
        const attendanceRate =
          attendance.length > 0 ? (presentDays / attendance.length) * 100 : 0;
        const punctualityRate =
          presentDays > 0 ? ((presentDays - lateDays) / presentDays) * 100 : 0;
        const reportSubmissionRate =
          attendance.length > 0
            ? (dailyReports.length / attendance.length) * 100
            : 0;

        // Calculate overall performance score (weighted average)
        const performanceScore = (
          taskCompletionRate * 0.3 +
          onTimeDeliveryRate * 0.25 +
          attendanceRate * 0.2 +
          punctualityRate * 0.15 +
          reportSubmissionRate * 0.1
        ).toFixed(2);

        // Calculate total hours worked
        const totalHoursWorked =
          attendance.reduce((sum, a) => sum + (a.totalWorkMinutes || 0), 0) /
          60;
        const avgHoursPerDay =
          attendance.length > 0 ? totalHoursWorked / attendance.length : 0;

        return {
          employee: employee._id,
          employeeName: employee.user?.name || employee.name || "Unknown",
          email: employee.user?.email || employee.email,
          department: employee.department || "N/A",
          position: employee.position || "N/A",
          metrics: {
            totalTasks: tasks.length,
            completedTasks: completedTasks.length,
            inProgressTasks: tasks.filter((t) => t.status === "in-progress")
              .length,
            onTimeTasks: onTimeTasks.length,
            overdueTasks: tasks.filter(
              (t) =>
                t.dueDate &&
                new Date(t.dueDate) < new Date() &&
                t.status !== "completed",
            ).length,
            taskCompletionRate: taskCompletionRate.toFixed(2),
            onTimeDeliveryRate: onTimeDeliveryRate.toFixed(2),
            totalAttendanceDays: attendance.length,
            presentDays: presentDays,
            absentDays: attendance.filter((a) => a.status === "absent").length,
            lateDays: lateDays,
            attendanceRate: attendanceRate.toFixed(2),
            punctualityRate: punctualityRate.toFixed(2),
            dailyReportsSubmitted: dailyReports.length,
            reportSubmissionRate: reportSubmissionRate.toFixed(2),
            totalHoursWorked: totalHoursWorked.toFixed(2),
            avgHoursPerDay: avgHoursPerDay.toFixed(2),
          },
          performanceScore: performanceScore,
          rating: getPerformanceRating(parseFloat(performanceScore)),
          trend: calculateTrend(employee._id, start, end),
        };
      }),
    );

    // Sort by performance score
    performanceData.sort((a, b) => b.performanceScore - a.performanceScore);

    // Calculate overall statistics
    const avgPerformanceScore =
      performanceData.length > 0
        ? (
            performanceData.reduce(
              (sum, emp) => sum + parseFloat(emp.performanceScore),
              0,
            ) / performanceData.length
          ).toFixed(2)
        : 0;

    const avgTaskCompletionRate =
      performanceData.length > 0
        ? (
            performanceData.reduce(
              (sum, emp) => sum + parseFloat(emp.metrics.taskCompletionRate),
              0,
            ) / performanceData.length
          ).toFixed(2)
        : 0;

    const avgAttendanceRate =
      performanceData.length > 0
        ? (
            performanceData.reduce(
              (sum, emp) => sum + parseFloat(emp.metrics.attendanceRate),
              0,
            ) / performanceData.length
          ).toFixed(2)
        : 0;

    res.status(200).json({
      success: true,
      period: {
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
      },
      summary: {
        totalEmployees: performanceData.length,
        avgPerformanceScore: avgPerformanceScore,
        avgTaskCompletionRate: avgTaskCompletionRate,
        avgAttendanceRate: avgAttendanceRate,
        topPerformers: performanceData.slice(0, 5),
        needsImprovement: performanceData.slice(-5).reverse(),
        excellentCount: performanceData.filter(
          (e) => parseFloat(e.performanceScore) >= 90,
        ).length,
        goodCount: performanceData.filter(
          (e) =>
            parseFloat(e.performanceScore) >= 75 &&
            parseFloat(e.performanceScore) < 90,
        ).length,
        averageCount: performanceData.filter(
          (e) =>
            parseFloat(e.performanceScore) >= 60 &&
            parseFloat(e.performanceScore) < 75,
        ).length,
        poorCount: performanceData.filter(
          (e) => parseFloat(e.performanceScore) < 60,
        ).length,
      },
      data: performanceData,
    });
  } catch (error) {
    console.error("Get performance report error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching performance report",
      error: error.message,
    });
  }
};

// @desc    Get productivity report
// @route   GET /api/admin/reports/productivity
// @access  Private/Admin
exports.getProductivityReport = async (req, res) => {
  try {
    const { startDate, endDate, projectId, employee } = req.query;

    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    let projectQuery = {
      createdAt: { $gte: start, $lte: end },
    };
    if (projectId) projectQuery._id = projectId;

    let taskQuery = {
      createdAt: { $gte: start, $lte: end },
    };
    if (employee) taskQuery.assignedTo = employee;
    if (projectId) taskQuery.project = projectId;

    // Get projects
    const projects = await Project.find(projectQuery)
      .populate("client", "companyName user")
      .populate("team", "name");

    // Get tasks
    const tasks = await Task.find(taskQuery)
      .populate("project", "name")
      .populate("assignedTo", "name");

    // Get daily reports
    const dailyReports = await DailyReport.find({
      date: { $gte: start, $lte: end },
    }).populate("employee", "name");

    // Calculate productivity metrics
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === "completed").length;
    const inProgressTasks = tasks.filter(
      (t) => t.status === "in-progress",
    ).length;
    const pendingTasks = tasks.filter((t) => t.status === "pending").length;
    const overdueTasks = tasks.filter(
      (t) =>
        t.dueDate &&
        new Date(t.dueDate) < new Date() &&
        t.status !== "completed",
    ).length;

    const totalEstimatedHours = tasks.reduce(
      (sum, t) => sum + (t.estimatedHours || 0),
      0,
    );
    const totalActualHours = tasks.reduce(
      (sum, t) => sum + (t.actualHours || 0),
      0,
    );

    const efficiency =
      totalEstimatedHours > 0 && totalActualHours > 0
        ? ((totalEstimatedHours / totalActualHours) * 100).toFixed(2)
        : 0;

    // Project breakdown
    const projectBreakdown = projects.map((project) => {
      const projectTasks = tasks.filter(
        (t) => t.project?._id.toString() === project._id.toString(),
      );
      const completedProjectTasks = projectTasks.filter(
        (t) => t.status === "completed",
      ).length;

      return {
        projectId: project._id,
        projectName: project.name,
        client: project.client?.companyName || "N/A",
        status: project.status,
        progress: project.progress || 0,
        totalTasks: projectTasks.length,
        completedTasks: completedProjectTasks,
        completionRate:
          projectTasks.length > 0
            ? ((completedProjectTasks / projectTasks.length) * 100).toFixed(2)
            : 0,
        estimatedHours: projectTasks.reduce(
          (sum, t) => sum + (t.estimatedHours || 0),
          0,
        ),
        actualHours: projectTasks.reduce(
          (sum, t) => sum + (t.actualHours || 0),
          0,
        ),
        teamSize: project.team?.length || 0,
      };
    });

    // Weekly productivity breakdown
    const weeklyData = getWeeklyBreakdown(tasks, dailyReports, start, end);

    // Employee productivity
    const employeeProductivity = await calculateEmployeeProductivity(
      tasks,
      start,
      end,
    );

    res.status(200).json({
      success: true,
      period: {
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
      },
      summary: {
        totalProjects: projects.length,
        activeProjects: projects.filter((p) => p.status === "in-progress")
          .length,
        completedProjects: projects.filter((p) => p.status === "completed")
          .length,
        totalTasks: totalTasks,
        completedTasks: completedTasks,
        inProgressTasks: inProgressTasks,
        pendingTasks: pendingTasks,
        overdueTasks: overdueTasks,
        taskCompletionRate:
          totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(2) : 0,
        totalEstimatedHours: totalEstimatedHours.toFixed(2),
        totalActualHours: totalActualHours.toFixed(2),
        efficiency: efficiency,
        dailyReportsSubmitted: dailyReports.length,
        avgTasksPerDay:
          weeklyData.length > 0
            ? (completedTasks / weeklyData.length).toFixed(2)
            : 0,
      },
      projectBreakdown: projectBreakdown,
      weeklyProductivity: weeklyData,
      employeeProductivity: employeeProductivity,
      insights: generateProductivityInsights(
        projectBreakdown,
        employeeProductivity,
        efficiency,
      ),
    });
  } catch (error) {
    console.error("Get productivity report error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching productivity report",
      error: error.message,
    });
  }
};

// @desc    Get attendance report
// @route   GET /api/admin/reports/attendance
// @access  Private/Admin
// @desc    Get attendance report
// @route   GET /api/admin/reports/attendance
// @access  Private/Admin
exports.getAttendanceReport = async (req, res) => {
  try {
    const { startDate, endDate, employeeId, department } = req.query;

    console.log("📊 Generating attendance report:", {
      startDate,
      endDate,
      employeeId,
      department,
    });

    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    // Build query for attendance records
    let query = {
      date: { $gte: start, $lte: end },
    };

    // ✅ FIXED: Use employeeId instead of employee
    if (employeeId) {
      const employee = await Employee.findById(employeeId);
      if (employee) {
        query.employeeId = employee._id;
      }
    }

    console.log("🔍 Attendance query:", query);

    // Get attendance records with populated employee data
    const attendanceRecords = await Attendance.find(query)
      .populate({
        path: "employeeId",
        populate: {
          path: "userId",
          select: "name email",
        },
        select: "employeeId department position designation userId",
      })
      .sort({ date: -1 });

    console.log(`📋 Found ${attendanceRecords.length} attendance records`);

    // Filter by department if provided
    let filteredRecords = attendanceRecords;
    if (department) {
      filteredRecords = attendanceRecords.filter(
        (record) => record.employeeId?.department === department,
      );
      console.log(
        `📋 After department filter: ${filteredRecords.length} records`,
      );
    }

    // Calculate total working days in period
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    // Calculate overall statistics
    const totalRecords = filteredRecords.length;
    const presentCount = filteredRecords.filter(
      (r) => r.status === "present",
    ).length;
    const absentCount = filteredRecords.filter(
      (r) => r.status === "absent",
    ).length;
    const lateCount = filteredRecords.filter(
      (r) => r.status === "late" || r.isLate === true,
    ).length;
    const leaveCount = filteredRecords.filter(
      (r) => r.status === "leave",
    ).length;

    // Employee breakdown
    const employeeMap = {};

    filteredRecords.forEach((record) => {
      if (record.employeeId) {
        const empId = record.employeeId._id.toString();

        if (!employeeMap[empId]) {
          employeeMap[empId] = {
            employeeId: record.employeeId._id,
            employeeName:
              record.employeeId.userId?.name ||
              record.employeeId.name ||
              "Unknown",
            email:
              record.employeeId.userId?.email ||
              record.employeeId.email ||
              "N/A",
            department: record.employeeId.department || "N/A",
            position:
              record.employeeId.position ||
              record.employeeId.designation ||
              "N/A",
            employeeNumber: record.employeeId.employeeId || "N/A",
            totalDays: 0,
            presentDays: 0,
            absentDays: 0,
            lateDays: 0,
            leaveDays: 0,
            attendanceRate: 0,
            punctualityRate: 0,
          };
        }

        const emp = employeeMap[empId];
        emp.totalDays++;

        switch (record.status) {
          case "present":
            emp.presentDays++;
            break;
          case "absent":
            emp.absentDays++;
            break;
          case "late":
            emp.lateDays++;
            emp.presentDays++; // Late is still present
            break;
          case "leave":
            emp.leaveDays++;
            break;
        }
      }
    });

    // Calculate rates for each employee
    const employeeBreakdown = Object.values(employeeMap).map((emp) => {
      const workingDays = emp.presentDays;

      emp.attendanceRate =
        totalDays > 0 ? ((workingDays / totalDays) * 100).toFixed(2) : "0.00";

      emp.punctualityRate =
        workingDays > 0
          ? (((workingDays - emp.lateDays) / workingDays) * 100).toFixed(2)
          : "0.00";

      emp.status =
        parseFloat(emp.attendanceRate) >= 90
          ? "Excellent"
          : parseFloat(emp.attendanceRate) >= 75
            ? "Good"
            : parseFloat(emp.attendanceRate) >= 60
              ? "Average"
              : "Poor";

      return emp;
    });

    // Sort by attendance rate
    employeeBreakdown.sort(
      (a, b) => parseFloat(b.attendanceRate) - parseFloat(a.attendanceRate),
    );

    // Calculate summary
    const avgAttendanceRate =
      employeeBreakdown.length > 0
        ? (
            employeeBreakdown.reduce(
              (sum, emp) => sum + parseFloat(emp.attendanceRate),
              0,
            ) / employeeBreakdown.length
          ).toFixed(2)
        : "0.00";

    const summary = {
      totalRecords,
      totalEmployees: employeeBreakdown.length,
      totalDays,
      presentCount,
      daysPresent: presentCount,
      absentCount,
      daysAbsent: absentCount,
      lateCount,
      daysLate: lateCount,
      leaveCount,
      daysLeave: leaveCount,
      avgAttendanceRate,
      averageAttendance: avgAttendanceRate,
      excellentCount: employeeBreakdown.filter(
        (e) => parseFloat(e.attendanceRate) >= 90,
      ).length,
      goodCount: employeeBreakdown.filter(
        (e) =>
          parseFloat(e.attendanceRate) >= 75 &&
          parseFloat(e.attendanceRate) < 90,
      ).length,
      averageCount: employeeBreakdown.filter(
        (e) =>
          parseFloat(e.attendanceRate) >= 60 &&
          parseFloat(e.attendanceRate) < 75,
      ).length,
      poorCount: employeeBreakdown.filter(
        (e) => parseFloat(e.attendanceRate) < 60,
      ).length,
    };

    // Generate insights
    const insights = [];

    if (parseFloat(avgAttendanceRate) >= 90) {
      insights.push(
        "🎉 Excellent overall attendance rate! Team is very punctual.",
      );
    } else if (parseFloat(avgAttendanceRate) >= 75) {
      insights.push("✅ Good attendance rate. Minor improvements possible.");
    } else {
      insights.push(
        "⚠️ Attendance needs improvement. Consider addressing issues.",
      );
    }

    if (lateCount > presentCount * 0.2) {
      insights.push(
        `⏰ High number of late arrivals (${lateCount}). Review punctuality policies.`,
      );
    }

    const topPerformers = employeeBreakdown
      .filter((e) => parseFloat(e.attendanceRate) >= 95)
      .slice(0, 5);

    if (topPerformers.length > 0) {
      insights.push(
        `⭐ ${topPerformers.length} employee(s) with 95%+ attendance.`,
      );
    }

    console.log("✅ Attendance report generated successfully");

    res.status(200).json({
      success: true,
      period: {
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
      },
      summary,
      employeeBreakdown,
      insights,
      topPerformers,
    });
  } catch (error) {
    console.error("❌ Get attendance report error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching attendance report",
      error: error.message,
    });
  }
};

// @desc    Get employee comprehensive report
// @route   GET /api/admin/reports/employee
// @access  Private/Admin
// @desc    Get employee comprehensive report
// @route   GET /api/admin/reports/employee
// @access  Private/Admin
exports.getEmployeeReport = async (req, res) => {
  try {
    const { employee, department } = req.query;

    console.log("📊 Generating Employee Report with filters:", {
      employee,
      department,
    });

    let query = {};
    if (employee) query._id = employee;
    if (department) query.department = department;

    // Get employees with populated user data
    const employees = await Employee.find(query)
      .populate("user", "name email")
      .lean();

    console.log(`Found ${employees.length} employees`);

    if (employees.length === 0) {
      return res.status(200).json({
        success: true,
        totalEmployees: 0,
        data: [],
        message: "No employees found matching the criteria",
      });
    }

    // Build comprehensive report for each employee
    const employeeReports = await Promise.all(
      employees.map(async (employee) => {
        try {
          // Get all related data in parallel
          const [tasks, projects, attendance, dailyReports, meetings] =
            await Promise.all([
              Task.find({ assignedTo: employee._id }).lean(),
              Project.find({ team: employee._id }).lean(),
              Attendance.find({ employee: employee._id })
                .sort({ date: -1 })
                .limit(90)
                .lean(),
              DailyReport.find({ employee: employee._id })
                .sort({ date: -1 })
                .limit(30)
                .lean(),
              Meeting.find({ "participants.employee": employee._id }).lean(),
            ]);

          // Calculate statistics
          const completedTasks = tasks.filter(
            (t) => t.status === "completed",
          ).length;
          const presentDays = attendance.filter(
            (a) => a.status === "present" || a.status === "late",
          ).length;
          const activeProjects = projects.filter(
            (p) => p.status === "in-progress" || p.status === "active",
          ).length;

          // Calculate attendance rate
          const attendanceRate =
            attendance.length > 0
              ? ((presentDays / attendance.length) * 100).toFixed(2)
              : "0.00";

          // Calculate completion rate
          const completionRate =
            tasks.length > 0
              ? ((completedTasks / tasks.length) * 100).toFixed(2)
              : "0.00";

          return {
            employee: employee._id,
            personalInfo: {
              name: employee.user?.name || employee.name || "Unknown",
              email: employee.user?.email || employee.email || "N/A",
              phone: employee.phone || "N/A",
              department: employee.department || "N/A",
              position: employee.position || employee.designation || "N/A",
              joiningDate: employee.joiningDate || employee.createdAt,
              employeeCode: employee.employeeCode || employee.employee || "N/A",
              status: employee.status || "active",
            },
            performance: {
              totalTasks: tasks.length,
              completedTasks: completedTasks,
              inProgressTasks: tasks.filter((t) => t.status === "in-progress")
                .length,
              pendingTasks: tasks.filter((t) => t.status === "pending").length,
              completionRate: completionRate,
              averageRating: calculateAverageRating(tasks),
            },
            projects: {
              total: projects.length,
              active: activeProjects,
              completed: projects.filter((p) => p.status === "completed")
                .length,
              onHold: projects.filter((p) => p.status === "on-hold").length,
              projectsList: projects.slice(0, 5).map((p) => ({
                id: p._id,
                name: p.name,
                status: p.status,
                progress: p.progress || 0,
              })),
            },
            attendance: {
              totalDays: attendance.length,
              presentDays: presentDays,
              absentDays: attendance.filter((a) => a.status === "absent")
                .length,
              lateDays: attendance.filter((a) => a.status === "late").length,
              leaveDays: attendance.filter((a) => a.status === "leave").length,
              attendanceRate: attendanceRate,
              recentAttendance: attendance.slice(0, 7).map((a) => ({
                date: a.date,
                status: a.status,
                checkIn: a.checkIn,
                checkOut: a.checkOut,
                workHours: a.totalWorkMinutes
                  ? (a.totalWorkMinutes / 60).toFixed(2)
                  : "0",
              })),
            },
            dailyReports: {
              total: dailyReports.length,
              submissionRate:
                attendance.length > 0
                  ? ((dailyReports.length / attendance.length) * 100).toFixed(2)
                  : "0.00",
              recent: dailyReports.slice(0, 5).map((r) => ({
                date: r.date,
                hoursWorked: r.totalHoursWorked || r.hoursWorked || 0,
                achievements: r.achievements || r.summary || "N/A",
              })),
            },
            meetings: {
              total: meetings.length,
              upcoming: meetings.filter(
                (m) =>
                  new Date(m.date) > new Date() && m.status !== "cancelled",
              ).length,
              completed: meetings.filter((m) => m.status === "completed")
                .length,
            },
            skills: employee.skills || [],
            certifications: employee.certifications || [],
            overallRating: calculateOverallEmployeeRating(
              parseFloat(completionRate),
              parseFloat(attendanceRate),
              dailyReports.length,
            ),
          };
        } catch (empError) {
          console.error(`Error processing employee ${employee._id}:`, empError);
          return null;
        }
      }),
    );

    // Filter out any null results from errors
    const validReports = employeeReports.filter((r) => r !== null);

    console.log(
      `✅ Successfully generated ${validReports.length} employee reports`,
    );

    res.status(200).json({
      success: true,
      totalEmployees: validReports.length,
      data: validReports,
      summary: {
        totalEmployees: validReports.length,
        avgCompletionRate:
          validReports.length > 0
            ? (
                validReports.reduce(
                  (sum, e) => sum + parseFloat(e.performance.completionRate),
                  0,
                ) / validReports.length
              ).toFixed(2)
            : "0.00",
        avgAttendanceRate:
          validReports.length > 0
            ? (
                validReports.reduce(
                  (sum, e) => sum + parseFloat(e.attendance.attendanceRate),
                  0,
                ) / validReports.length
              ).toFixed(2)
            : "0.00",
      },
    });
  } catch (error) {
    console.error("Get employee report error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching employee report",
      error: error.message,
    });
  }
};

exports.getDailyReport = async (req, res) => {
  try {
    const { startDate, endDate, employeeId, department } = req.query;

    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Build query
    let query = {
      date: { $gte: start, $lte: end },
    };

    if (employeeId) {
      query.employee = employeeId;
    }

    // Get daily reports with employee population
    const dailyReports = await DailyReport.find(query)
      .populate("employee", "name email department position")
      .sort({ date: -1 });

    // Filter by department if provided
    let filteredReports = dailyReports;
    if (department) {
      filteredReports = dailyReports.filter(
        (report) => report.employee?.department === department,
      );
    }

    if (filteredReports.length === 0) {
      return res.status(200).json({
        success: true,
        period: {
          startDate: start.toISOString().split("T")[0],
          endDate: end.toISOString().split("T")[0],
        },
        summary: {
          totalReports: 0,
          submittedCount: 0,
          reviewedCount: 0,
          approvedCount: 0,
          avgHoursWorked: "0",
          avgProductivityRating: "0",
        },
        data: [],
        insights: ["No daily reports found for the selected period"],
      });
    }

    // Calculate summary statistics
    const totalReports = filteredReports.length;
    const submittedCount = filteredReports.filter(
      (r) => r.status === "Submitted",
    ).length;
    const reviewedCount = filteredReports.filter(
      (r) => r.status === "Reviewed",
    ).length;
    const approvedCount = filteredReports.filter(
      (r) => r.status === "Approved",
    ).length;

    const totalHours = filteredReports.reduce(
      (sum, r) => sum + (r.totalHoursWorked || 0),
      0,
    );
    const avgHoursWorked =
      totalReports > 0 ? (totalHours / totalReports).toFixed(2) : "0";

    const ratingsWithValue = filteredReports.filter(
      (r) => r.productivityRating,
    );
    const avgProductivityRating =
      ratingsWithValue.length > 0
        ? (
            ratingsWithValue.reduce((sum, r) => sum + r.productivityRating, 0) /
            ratingsWithValue.length
          ).toFixed(2)
        : "0";

    // Format data for frontend
    const formattedData = filteredReports.map((report) => ({
      reportId: report.reportId,
      employee: {
        name: report.employee?.name || "Unknown",
        email: report.employee?.email || "N/A",
        department: report.employee?.department || "N/A",
        position: report.employee?.position || "N/A",
      },
      employeeName: report.employee?.name || "Unknown",
      department: report.employee?.department || "N/A",
      date: report.date,
      totalHoursWorked: report.totalHoursWorked,
      tasksCompleted: report.tasksCompleted?.length || 0,
      tasksInProgress: report.tasksInProgress?.length || 0,
      productivityRating: report.productivityRating,
      mood: report.mood,
      status: report.status,
      achievements: report.achievements,
      challenges: report.challenges,
      submittedAt: report.submittedAt,
    }));

    res.status(200).json({
      success: true,
      period: {
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
      },
      summary: {
        totalReports,
        submittedCount,
        reviewedCount,
        approvedCount,
        avgHoursWorked,
        avgProductivityRating,
        totalHoursLogged: totalHours.toFixed(2),
      },
      data: formattedData,
      insights: generateDailyReportInsights(formattedData),
    });
  } catch (error) {
    console.error("Get daily report error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching daily reports",
      error: error.message,
    });
  }
};

// Helper function for insights
function generateDailyReportInsights(reportData) {
  const insights = [];

  if (reportData.length === 0) {
    return ["No daily reports available for the selected period"];
  }

  // Average hours insight
  const avgHours =
    reportData.reduce((sum, r) => sum + (r.totalHoursWorked || 0), 0) /
    reportData.length;
  if (avgHours > 8) {
    insights.push(
      `Average working hours (${avgHours.toFixed(1)}h) exceed standard 8 hours`,
    );
  } else if (avgHours < 6) {
    insights.push(
      `Average working hours (${avgHours.toFixed(1)}h) are below expected levels`,
    );
  }

  // Mood insights
  const lowMoodCount = reportData.filter(
    (r) => r.mood === "Low" || r.mood === "Stressed",
  ).length;
  if (lowMoodCount > reportData.length * 0.3) {
    insights.push(
      `${lowMoodCount} reports indicate low mood or stress - consider team wellness check`,
    );
  }

  // Productivity rating
  const ratings = reportData
    .filter((r) => r.productivityRating)
    .map((r) => r.productivityRating);
  if (ratings.length > 0) {
    const avgRating = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
    insights.push(`Average productivity rating: ${avgRating.toFixed(1)}/5`);
  }

  return insights.length > 0
    ? insights
    : ["Daily reports analyzed successfully"];
}

// Helper function - Add this if not exists
function calculateAverageRating(tasks) {
  const ratedTasks = tasks.filter((t) => t.rating && t.rating > 0);
  if (ratedTasks.length === 0) return "N/A";

  const sum = ratedTasks.reduce((total, task) => total + task.rating, 0);
  return (sum / ratedTasks.length).toFixed(2);
}

// Helper function - Add this if not exists
function calculateOverallEmployeeRating(
  completionRate,
  attendanceRate,
  reportCount,
) {
  // Simple formula: (completion * 40% + attendance * 40% + reports * 20%)
  const reportScore = Math.min(reportCount * 5, 100); // Max 100, 5 points per report
  const score = completionRate * 0.4 + attendanceRate * 0.4 + reportScore * 0.2;
  return score.toFixed(2);
}

// @desc    Export report
// @route   GET /api/admin/reports/:reportType/export
// @access  Private/Admin
exports.exportReport = async (req, res) => {
  try {
    const { reportType } = req.params;
    const { format, startDate, endDate, employee, department } = req.query;

    // Generate report data first
    let reportData;
    const fakeReq = { query: { startDate, endDate, employee, department } };
    const fakeRes = {
      status: (code) => ({
        json: (data) => {
          reportData = data;
        },
      }),
    };

    switch (reportType) {
      case "performance":
        await exports.getPerformanceReport(fakeReq, fakeRes);
        break;
      case "attendance":
        await exports.getAttendanceReport(fakeReq, fakeRes);
        break;
      case "productivity":
        await exports.getProductivityReport(fakeReq, fakeRes);
        break;
      case "employee":
        await exports.getEmployeeReport(fakeReq, fakeRes);
        break;
      default:
        return res
          .status(400)
          .json({ success: false, message: "Invalid report type" });
    }

    if (!reportData || !reportData.success) {
      return res
        .status(500)
        .json({ success: false, message: "Failed to generate report data" });
    }

    if (format === "pdf") {
      await generatePDFReport(res, reportType, reportData);
    } else if (format === "excel" || format === "xlsx") {
      await generateExcelReport(res, reportType, reportData);
    } else if (format === "csv") {
      await generateCSVReport(res, reportType, reportData);
    } else {
      res.status(400).json({
        success: false,
        message: "Invalid format. Use pdf, excel, or csv",
      });
    }
  } catch (error) {
    console.error("Export report error:", error);
    res.status(500).json({
      success: false,
      message: "Error exporting report",
      error: error.message,
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
      client: req.user.clientId,
    }).populate("client", "companyName");

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found or access denied",
      });
    }

    // Get project tasks
    const tasks = await Task.find({ project: projectId })
      .populate("assignedTo", "name")
      .sort({ createdAt: -1 });

    // Get daily reports related to this project
    const dailyReports = await DailyReport.find({
      "tasksWorkedOn.task": { $in: tasks.map((t) => t._id) },
    })
      .populate("employee", "name")
      .sort({ date: -1 });

    // Get meetings
    const meetings = await Meeting.find({
      project: projectId,
    }).sort({ date: -1 });

    // Calculate project statistics
    const completedTasks = tasks.filter((t) => t.status === "completed").length;
    const totalEstimatedHours = tasks.reduce(
      (sum, t) => sum + (t.estimatedHours || 0),
      0,
    );
    const totalActualHours = tasks.reduce(
      (sum, t) => sum + (t.actualHours || 0),
      0,
    );

    const stats = {
      totalTasks: tasks.length,
      completedTasks: completedTasks,
      inProgressTasks: tasks.filter((t) => t.status === "in-progress").length,
      pendingTasks: tasks.filter((t) => t.status === "pending").length,
      taskCompletionRate:
        tasks.length > 0
          ? ((completedTasks / tasks.length) * 100).toFixed(2)
          : 0,
      totalEstimatedHours: totalEstimatedHours.toFixed(2),
      totalActualHours: totalActualHours.toFixed(2),
      efficiency:
        totalEstimatedHours > 0
          ? ((totalEstimatedHours / totalActualHours) * 100).toFixed(2)
          : 0,
      progress: project.progress || 0,
      status: project.status,
      teamSize: project.team?.length || 0,
      dailyReportsCount: dailyReports.length,
      meetingsCount: meetings.length,
      timeline: {
        startDate: project.startDate,
        endDate: project.endDate,
        daysRemaining: project.endDate
          ? Math.ceil(
              (new Date(project.endDate) - new Date()) / (1000 * 60 * 60 * 24),
            )
          : "N/A",
      },
    };

    res.status(200).json({
      success: true,
      project: {
        id: project._id,
        name: project.name,
        description: project.description,
        status: project.status,
        client: project.client?.companyName,
      },
      stats,
      recentTasks: tasks.slice(0, 10),
      recentReports: dailyReports.slice(0, 10),
      upcomingMeetings: meetings
        .filter((m) => new Date(m.date) > new Date())
        .slice(0, 5),
    });
  } catch (error) {
    console.error("Get project reports error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching project reports",
      error: error.message,
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
      client: req.user.clientId,
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found or access denied",
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
        { completedDate: { $gte: weekStart, $lte: weekEnd } },
      ],
    }).populate("assignedTo", "name");

    // Get daily reports for this week
    const dailyReports = await DailyReport.find({
      date: { $gte: weekStart, $lte: weekEnd },
      "tasksWorkedOn.task": { $in: tasks.map((t) => t._id) },
    }).populate("employee", "name");

    const weeklyStats = {
      week: `${weekStart.toISOString().split("T")[0]} to ${weekEnd.toISOString().split("T")[0]}`,
      tasksCreated: tasks.filter(
        (t) => t.createdAt >= weekStart && t.createdAt <= weekEnd,
      ).length,
      tasksCompleted: tasks.filter(
        (t) =>
          t.completedDate &&
          t.completedDate >= weekStart &&
          t.completedDate <= weekEnd,
      ).length,
      hoursWorked: dailyReports.reduce(
        (sum, r) => sum + (r.hoursWorked || 0),
        0,
      ),
      teamActivity: dailyReports.length,
      progress: project.progress || 0,
      efficiency: calculateWeeklyEfficiency(tasks, dailyReports),
    };

    res.status(200).json({
      success: true,
      weeklyStats,
      tasks: tasks,
      dailyReports: dailyReports,
      insights: generateWeeklyInsights(weeklyStats, tasks, dailyReports),
    });
  } catch (error) {
    console.error("Get weekly report error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching weekly report",
      error: error.message,
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
      message: `Report download in ${format || "pdf"} format would be generated here`,
      reportId: id,
    });
  } catch (error) {
    console.error("Download report error:", error);
    res.status(500).json({
      success: false,
      message: "Error downloading report",
      error: error.message,
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
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=${reportType}-report-${Date.now()}.pdf`,
  );

  doc.pipe(res);

  // Title
  doc
    .fontSize(24)
    .text(`${reportType.toUpperCase()} REPORT`, { align: "center" });
  doc.moveDown();

  // Date range
  if (reportData.period) {
    doc
      .fontSize(12)
      .text(
        `Period: ${reportData.period.startDate} to ${reportData.period.endDate}`,
        { align: "center" },
      );
    doc.moveDown(2);
  }

  // Summary section
  if (reportData.summary) {
    doc.fontSize(16).text("Summary", { underline: true });
    doc.moveDown();
    doc.fontSize(11);
    Object.entries(reportData.summary).forEach(([key, value]) => {
      if (typeof value !== "object" && !Array.isArray(value)) {
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
    worksheet.addRow([
      `Period: ${reportData.period.startDate} to ${reportData.period.endDate}`,
    ]);
    worksheet.addRow([]);
  }

  // Add summary
  if (reportData.summary) {
    worksheet.addRow(["SUMMARY"]);
    Object.entries(reportData.summary).forEach(([key, value]) => {
      if (typeof value !== "object" && !Array.isArray(value)) {
        worksheet.addRow([formatKey(key), value]);
      }
    });
    worksheet.addRow([]);
  }

  // Add data based on report type
  if (reportData.data && Array.isArray(reportData.data)) {
    worksheet.addRow(["DETAILED DATA"]);

    // Add headers
    const headers = Object.keys(reportData.data[0] || {});
    worksheet.addRow(headers.map(formatKey));

    // Add data rows
    reportData.data.forEach((row) => {
      worksheet.addRow(Object.values(row));
    });
  } else if (
    reportData.employeeBreakdown &&
    Array.isArray(reportData.employeeBreakdown)
  ) {
    worksheet.addRow(["EMPLOYEE BREAKDOWN"]);

    const headers = Object.keys(reportData.employeeBreakdown[0] || {});
    worksheet.addRow(headers.map(formatKey));

    reportData.employeeBreakdown.forEach((row) => {
      worksheet.addRow(Object.values(row));
    });
  }

  // Set response headers
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=${reportType}-report-${Date.now()}.xlsx`,
  );

  await workbook.xlsx.write(res);
  res.end();
}

// Generate CSV report
async function generateCSVReport(res, reportType, reportData) {
  let csvContent = "";

  // Title
  csvContent += `${reportType.toUpperCase()} REPORT\n\n`;

  // Period
  if (reportData.period) {
    csvContent += `Period,${reportData.period.startDate} to ${reportData.period.endDate}\n\n`;
  }

  // Summary
  if (reportData.summary) {
    csvContent += "SUMMARY\n";
    Object.entries(reportData.summary).forEach(([key, value]) => {
      if (typeof value !== "object" && !Array.isArray(value)) {
        csvContent += `${formatKey(key)},${value}\n`;
      }
    });
    csvContent += "\n";
  }

  // Data
  if (
    reportData.data &&
    Array.isArray(reportData.data) &&
    reportData.data.length > 0
  ) {
    csvContent += "DETAILED DATA\n";
    const headers = Object.keys(reportData.data[0]);
    csvContent += headers.map(formatKey).join(",") + "\n";

    reportData.data.forEach((row) => {
      csvContent +=
        Object.values(row)
          .map((v) => `"${v}"`)
          .join(",") + "\n";
    });
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=${reportType}-report-${Date.now()}.csv`,
  );
  res.send(csvContent);
}

// Helper to format object keys
function formatKey(key) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

// Calculate performance rating
function getPerformanceRating(score) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Average";
  return "Needs Improvement";
}

// Calculate attendance rating
function getAttendanceRating(attendanceRate, punctualityRate) {
  const avgRate =
    (parseFloat(attendanceRate) + parseFloat(punctualityRate)) / 2;
  if (avgRate >= 95) return "Excellent";
  if (avgRate >= 85) return "Good";
  if (avgRate >= 75) return "Average";
  return "Poor";
}

// Calculate trend (simplified)
function calculateTrend(employee, startDate, endDate) {
  // This should compare with previous period
  // Simplified version
  return "stable"; // Can be 'improving', 'declining', 'stable'
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
        reportsSubmitted: 0,
      };
    }
    current.setDate(current.getDate() + 1);
  }

  tasks
    .filter((t) => t.status === "completed" && t.completedDate)
    .forEach((task) => {
      const weekNum = getWeekNumber(new Date(task.completedDate));
      if (weeks[weekNum]) {
        weeks[weekNum].tasksCompleted++;
      }
    });

  dailyReports.forEach((report) => {
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

  tasks.forEach((task) => {
    if (task.assignedTo && Array.isArray(task.assignedTo)) {
      task.assignedTo.forEach((emp) => {
        const empId = emp._id.toString();
        if (!employeeMap[empId]) {
          employeeMap[empId] = {
            employeeName: emp.name || "Unknown",
            totalTasks: 0,
            completedTasks: 0,
            hoursSpent: 0,
          };
        }
        employeeMap[empId].totalTasks++;
        if (task.status === "completed") {
          employeeMap[empId].completedTasks++;
        }
        employeeMap[empId].hoursSpent += task.actualHours || 0;
      });
    }
  });

  return Object.values(employeeMap)
    .map((emp) => ({
      ...emp,
      completionRate:
        emp.totalTasks > 0
          ? ((emp.completedTasks / emp.totalTasks) * 100).toFixed(2)
          : 0,
      avgHoursPerTask:
        emp.completedTasks > 0
          ? (emp.hoursSpent / emp.completedTasks).toFixed(2)
          : 0,
    }))
    .sort((a, b) => b.completedTasks - a.completedTasks);
}

// Generate productivity insights
function generateProductivityInsights(
  projectBreakdown,
  employeeProductivity,
  efficiency,
) {
  const insights = [];

  if (parseFloat(efficiency) > 100) {
    insights.push(
      "Overall efficiency is above target - projects are being delivered faster than estimated",
    );
  } else if (parseFloat(efficiency) < 80) {
    insights.push(
      "Overall efficiency is below target - consider reviewing task estimates",
    );
  }

  const highPerformers = employeeProductivity.filter(
    (e) => parseFloat(e.completionRate) > 90,
  );
  if (highPerformers.length > 0) {
    insights.push(
      `${highPerformers.length} employee(s) have completion rates above 90%`,
    );
  }

  const delayedProjects = projectBreakdown.filter(
    (p) => parseFloat(p.completionRate) < 50 && p.status === "in-progress",
  );
  if (delayedProjects.length > 0) {
    insights.push(
      `${delayedProjects.length} project(s) may need additional resources or attention`,
    );
  }

  return insights;
}

// Generate attendance insights
function generateAttendanceInsights(employeeBreakdown, dailySummary) {
  const insights = [];

  const poorAttendance = employeeBreakdown.filter(
    (e) => parseFloat(e.attendanceRate) < 75,
  );
  if (poorAttendance.length > 0) {
    insights.push(
      `${poorAttendance.length} employee(s) have attendance below 75%`,
    );
  }

  const chronicLateness = employeeBreakdown.filter(
    (e) => e.lateDays > e.presentDays * 0.3,
  );
  if (chronicLateness.length > 0) {
    insights.push(`${chronicLateness.length} employee(s) are frequently late`);
  }

  const excellentAttendance = employeeBreakdown.filter(
    (e) => parseFloat(e.attendanceRate) >= 95,
  );
  if (excellentAttendance.length > 0) {
    insights.push(
      `${excellentAttendance.length} employee(s) have excellent attendance (95%+)`,
    );
  }

  return insights;
}

// Get daily attendance summary
function getDailyAttendanceSummary(records, startDate, endDate) {
  const dailyMap = {};

  records.forEach((record) => {
    const dateKey = record.date.toISOString().split("T")[0];
    if (!dailyMap[dateKey]) {
      dailyMap[dateKey] = {
        date: dateKey,
        present: 0,
        absent: 0,
        late: 0,
        leave: 0,
      };
    }

    switch (record.status) {
      case "present":
        dailyMap[dateKey].present++;
        break;
      case "absent":
        dailyMap[dateKey].absent++;
        break;
      case "late":
        dailyMap[dateKey].late++;
        break;
      case "leave":
        dailyMap[dateKey].leave++;
        break;
    }
  });

  return Object.values(dailyMap).sort(
    (a, b) => new Date(a.date) - new Date(b.date),
  );
}

// Get department breakdown
function getDepartmentBreakdown(employeeBreakdown) {
  const deptMap = {};

  employeeBreakdown.forEach((emp) => {
    const dept = emp.department || "N/A";
    if (!deptMap[dept]) {
      deptMap[dept] = {
        department: dept,
        employeeCount: 0,
        avgAttendanceRate: 0,
        avgPunctualityRate: 0,
        totalWorkHours: 0,
      };
    }

    deptMap[dept].employeeCount++;
    deptMap[dept].avgAttendanceRate += parseFloat(emp.attendanceRate);
    deptMap[dept].avgPunctualityRate += parseFloat(emp.punctualityRate);
    deptMap[dept].totalWorkHours += parseFloat(emp.totalWorkHours);
  });

  return Object.values(deptMap).map((dept) => ({
    ...dept,
    avgAttendanceRate: (dept.avgAttendanceRate / dept.employeeCount).toFixed(2),
    avgPunctualityRate: (dept.avgPunctualityRate / dept.employeeCount).toFixed(
      2,
    ),
    totalWorkHours: dept.totalWorkHours.toFixed(2),
  }));
}

// Calculate average rating
function calculateAverageRating(tasks) {
  const ratedTasks = tasks.filter((t) => t.rating && t.rating > 0);
  if (ratedTasks.length === 0) return "N/A";

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
  const completedTasks = tasks.filter((t) => t.status === "completed");
  const totalEstimated = completedTasks.reduce(
    (sum, t) => sum + (t.estimatedHours || 0),
    0,
  );
  const totalActual = completedTasks.reduce(
    (sum, t) => sum + (t.actualHours || 0),
    0,
  );

  if (totalEstimated === 0 || totalActual === 0) return "N/A";
  return ((totalEstimated / totalActual) * 100).toFixed(2);
}

// Generate weekly insights
function generateWeeklyInsights(weeklyStats, tasks, dailyReports) {
  const insights = [];

  if (weeklyStats.tasksCompleted > weeklyStats.tasksCreated) {
    insights.push(
      "Great progress! More tasks completed than created this week",
    );
  }

  if (weeklyStats.hoursWorked > 0) {
    const avgHoursPerDay = weeklyStats.hoursWorked / 7;
    if (avgHoursPerDay > 8) {
      insights.push(
        "Team is working overtime - consider workload distribution",
      );
    }
  }

  if (weeklyStats.teamActivity < 5) {
    insights.push("Low team activity - follow up with team members");
  }

  return insights;
}

// Get week number
function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
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
    date: { $gte: new Date(startDate), $lte: new Date(endDate) },
  };

  if (filters?.employee) query.employee = filters.employee;
  if (filters?.department) query.department = filters.department;

  const records = await Attendance.find(query).populate(
    "employee",
    "name email department",
  );

  return {
    totalRecords: records.length,
    present: records.filter((r) => r.status === "present").length,
    absent: records.filter((r) => r.status === "absent").length,
    late: records.filter((r) => r.status === "late").length,
    leave: records.filter((r) => r.status === "leave").length,
    records: records.slice(0, 100),
  };
}

// Generate performance report helper
async function generatePerformanceReport(startDate, endDate, filters) {
  const fakeReq = { query: { startDate, endDate, ...filters } };
  let result;
  const fakeRes = {
    status: () => ({
      json: (data) => {
        result = data;
      },
    }),
  };

  await exports.getPerformanceReport(fakeReq, fakeRes);
  return result;
}

// Generate productivity report helper
async function generateProductivityReport(startDate, endDate, filters) {
  const fakeReq = { query: { startDate, endDate, ...filters } };
  let result;
  const fakeRes = {
    status: () => ({
      json: (data) => {
        result = data;
      },
    }),
  };

  await exports.getProductivityReport(fakeReq, fakeRes);
  return result;
}

// Generate project report helper
async function generateProjectReport(startDate, endDate, filters) {
  const query = {
    createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
  };

  if (filters?.status) query.status = filters.status;
  if (filters?.clientId) query.client = filters.clientId;

  const projects = await Project.find(query).populate("client", "companyName");

  return {
    totalProjects: projects.length,
    completed: projects.filter((p) => p.status === "completed").length,
    inProgress: projects.filter((p) => p.status === "in-progress").length,
    onHold: projects.filter((p) => p.status === "on-hold").length,
    projects: projects.slice(0, 50),
  };
}

// Generate employee report helper
async function generateEmployeeReport(startDate, endDate, filters) {
  const query = {};
  if (filters?.department) query.department = filters.department;

  const employees = await Employee.find(query).populate("userId", "name email");

  return {
    totalEmployees: employees.length,
    byDepartment: groupByDepartment(employees),
    employees: employees.slice(0, 50).map((e) => ({
      id: e._id,
      name: e.user?.name || e.name,
      email: e.user?.email || e.email,
      department: e.department,
      position: e.position,
    })),
  };
}

// Generate client report helper
async function generateClientReport(startDate, endDate, filters) {
  const query = {};
  if (filters?.status) query.status = filters.status;

  const clients = await Client.find(query).populate("userId", "name email");

  return {
    totalClients: clients.length,
    activeClients: clients.filter((c) => c.status === "active").length,
    inactiveClients: clients.filter((c) => c.status === "inactive").length,
    clients: clients.slice(0, 50).map((c) => ({
      id: c._id,
      companyName: c.companyName,
      contactPerson: c.user?.name || c.contactPerson,
      email: c.user?.email || c.email,
      status: c.status,
    })),
  };
}

// Group by department
function groupByDepartment(employees) {
  const grouped = {};
  employees.forEach((emp) => {
    const dept = emp.department || "Unassigned";
    grouped[dept] = (grouped[dept] || 0) + 1;
  });
  return grouped;
}

module.exports = exports;
