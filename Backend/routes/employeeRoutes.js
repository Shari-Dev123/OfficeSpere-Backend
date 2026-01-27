// routes/employeeRoutes.js
// All Employee Routes - Dashboard, Profile, Tasks, Projects, Reports, Attendance, Meetings

const express = require('express');
const router = express.Router();

// Import controllers
const employeeController = require('../controllers/employeeController');
const attendanceController = require('../controllers/attendanceController');

// Import middleware
const { protect } = require('../middleware/auth');
const { roleCheck } = require('../middleware/roleCheck');

// All routes are protected and require employee role
router.use(protect);
router.use(roleCheck('employee'));

// ==================== DASHBOARD ====================

// @route   GET /api/employee/dashboard
// @desc    Get employee dashboard with stats
// @access  Private (Employee)
router.get('/dashboard', employeeController.getEmployeeDashboard);

// ==================== PROFILE ====================

// @route   GET /api/employee/profile
// @desc    Get employee profile
// @access  Private (Employee)
router.get('/profile', employeeController.getProfile);

// @route   PUT /api/employee/profile
// @desc    Update employee profile
// @access  Private (Employee)
router.put('/profile', employeeController.updateProfile);

// @route   POST /api/employee/profile/change-password
// @desc    Change password
// @access  Private (Employee)
router.post('/profile/change-password', employeeController.changePassword);

// @route   GET /api/employee/profile/activity
// @desc    Get activity log
// @access  Private (Employee)
router.get('/profile/activity', employeeController.getActivityLog);

// ==================== ATTENDANCE ====================

// @route   POST /api/employee/attendance/checkin
// @desc    Check in (Clock in)
// @access  Private (Employee)
router.post('/attendance/checkin', attendanceController.checkIn);

// @route   POST /api/employee/attendance/checkout
// @desc    Check out (Clock out)
// @access  Private (Employee)
router.post('/attendance/checkout', attendanceController.checkOut);

// @route   GET /api/employee/attendance
// @desc    Get my attendance records
// @access  Private (Employee)
router.get('/attendance', attendanceController.getMyAttendance);

// @route   GET /api/employee/attendance/status
// @desc    Get current attendance status (checked in/out)
// @access  Private (Employee)
router.get('/attendance/status', attendanceController.getAttendanceStatus);

// @route   GET /api/employee/attendance/summary
// @desc    Get attendance summary (monthly)
// @access  Private (Employee)
router.get('/attendance/summary', attendanceController.getAttendanceSummary);

// @route   POST /api/employee/attendance/correction
// @desc    Request attendance correction
// @access  Private (Employee)
router.post('/attendance/correction', attendanceController.requestCorrection);

// @route   POST /api/employee/attendance/leave
// @desc    Request leave
// @access  Private (Employee)
router.post('/attendance/leave', attendanceController.requestLeave);

// ==================== TASKS ====================

// @route   GET /api/employee/tasks
// @desc    Get my tasks
// @access  Private (Employee)
router.get('/tasks', employeeController.getMyTasks);

// @route   GET /api/employee/tasks/:id
// @desc    Get single task
// @access  Private (Employee)
router.get('/tasks/:id', employeeController.getTask);

// @route   PATCH /api/employee/tasks/:id/status
// @desc    Update task status
// @access  Private (Employee)
router.patch('/tasks/:id/status', employeeController.updateTaskStatus);

// @route   POST /api/employee/tasks/:id/comments
// @desc    Add comment to task
// @access  Private (Employee)
router.post('/tasks/:id/comments', employeeController.addTaskComment);

// @route   POST /api/employee/tasks/:id/timer/start
// @desc    Start task timer
// @access  Private (Employee)
router.post('/tasks/:id/timer/start', employeeController.startTaskTimer);

// @route   POST /api/employee/tasks/:id/timer/stop
// @desc    Stop task timer
// @access  Private (Employee)
router.post('/tasks/:id/timer/stop', employeeController.stopTaskTimer);

// @route   GET /api/employee/tasks/:id/timer
// @desc    Get task timer status
// @access  Private (Employee)
router.get('/tasks/:id/timer', employeeController.getTaskTimer);

// ==================== PROJECTS ====================

// @route   GET /api/employee/projects
// @desc    Get my projects
// @access  Private (Employee)
router.get('/projects', employeeController.getMyProjects);

// @route   GET /api/employee/projects/:id
// @desc    Get single project details
// @access  Private (Employee)
router.get('/projects/:id', employeeController.getProject);

// ==================== DAILY REPORTS ====================

// @route   POST /api/employee/reports/daily
// @desc    Submit daily report
// @access  Private (Employee)
router.post('/reports/daily', employeeController.submitDailyReport);

// @route   GET /api/employee/reports
// @desc    Get my daily reports
// @access  Private (Employee)
router.get('/reports', employeeController.getMyReports);

// @route   GET /api/employee/reports/:id
// @desc    Get single daily report
// @access  Private (Employee)
router.get('/reports/:id', employeeController.getReport);

// @route   PUT /api/employee/reports/:id
// @desc    Update daily report
// @access  Private (Employee)
router.put('/reports/:id', employeeController.updateDailyReport);

// ==================== MEETINGS ====================

// @route   GET /api/employee/meetings
// @desc    Get my meetings
// @access  Private (Employee)
router.get('/meetings', employeeController.getMyMeetings);

// @route   GET /api/employee/meetings/:id
// @desc    Get single meeting details
// @access  Private (Employee)
router.get('/meetings/:id', employeeController.getMeeting);

module.exports = router;