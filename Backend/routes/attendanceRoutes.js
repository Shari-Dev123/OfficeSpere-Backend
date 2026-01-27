// routes/attendanceRoutes.js
// Attendance routes for both admin and employee

const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { protect, authorize } = require('../middleware/auth');

// ==========================================
// ADMIN ROUTES - /api/admin/attendance
// ==========================================

// @route   GET /api/admin/attendance
// @desc    Get all attendance records with filters
// @access  Admin
router.get(
  '/admin/attendance',
  protect,
  authorize('admin'),
  attendanceController.getAllAttendance
);

// @route   GET /api/admin/attendance/daily
// @desc    Get daily attendance report
// @access  Admin
router.get(
  '/admin/attendance/daily',
  protect,
  authorize('admin'),
  attendanceController.getDailyAttendance
);

// @route   GET /api/admin/attendance/monthly
// @desc    Get monthly attendance report
// @access  Admin
router.get(
  '/admin/attendance/monthly',
  protect,
  authorize('admin'),
  attendanceController.getMonthlyAttendance
);

// @route   GET /api/admin/attendance/report
// @desc    Generate attendance report with statistics
// @access  Admin
router.get(
  '/admin/attendance/report',
  protect,
  authorize('admin'),
  attendanceController.getAttendanceReport
);

// @route   GET /api/admin/attendance/late-arrivals
// @desc    Get late arrival records
// @access  Admin
router.get(
  '/admin/attendance/late-arrivals',
  protect,
  authorize('admin'),
  attendanceController.getLateArrivals
);

// @route   GET /api/admin/attendance/employee/:employeeId
// @desc    Get specific employee's attendance history
// @access  Admin
router.get(
  '/admin/attendance/employee/:employeeId',
  protect,
  authorize('admin'),
  attendanceController.getEmployeeAttendance
);

// @route   GET /api/admin/attendance/corrections/pending
// @desc    Get pending correction requests
// @access  Admin
router.get(
  '/admin/attendance/corrections/pending',
  protect,
  authorize('admin'),
  attendanceController.getPendingCorrections
);

// @route   PUT /api/admin/attendance/correction/:id/approve
// @desc    Approve attendance correction request
// @access  Admin
router.put(
  '/admin/attendance/correction/:id/approve',
  protect,
  authorize('admin'),
  attendanceController.approveCorrection
);

// @route   PUT /api/admin/attendance/correction/:id/reject
// @desc    Reject attendance correction request
// @access  Admin
router.put(
  '/admin/attendance/correction/:id/reject',
  protect,
  authorize('admin'),
  attendanceController.rejectCorrection
);

// @route   DELETE /api/admin/attendance/:id
// @desc    Delete attendance record (admin only)
// @access  Admin
router.delete(
  '/admin/attendance/:id',
  protect,
  authorize('admin'),
  attendanceController.deleteAttendance
);

// @route   GET /api/admin/attendance/export
// @desc    Export attendance data to CSV/Excel
// @access  Admin
router.get(
  '/admin/attendance/export',
  protect,
  authorize('admin'),
  attendanceController.exportAttendance
);

// ==========================================
// EMPLOYEE ROUTES - /api/employee/attendance
// ==========================================

// @route   POST /api/employee/attendance/checkin
// @desc    Employee check-in (auto-attendance)
// @access  Employee
router.post(
  '/employee/attendance/checkin',
  protect,
  authorize('employee'),
  attendanceController.checkIn
);

// @route   POST /api/employee/attendance/checkout
// @desc    Employee check-out
// @access  Employee
router.post(
  '/employee/attendance/checkout',
  protect,
  authorize('employee'),
  attendanceController.checkOut
);

// @route   GET /api/employee/attendance
// @desc    Get my attendance records
// @access  Employee
router.get(
  '/employee/attendance',
  protect,
  authorize('employee'),
  attendanceController.getMyAttendance
);

// @route   GET /api/employee/attendance/status
// @desc    Get current attendance status (checked in or not)
// @access  Employee
router.get(
  '/employee/attendance/status',
  protect,
  authorize('employee'),
  attendanceController.getAttendanceStatus
);

// @route   GET /api/employee/attendance/summary
// @desc    Get attendance summary (present, absent, late days)
// @access  Employee
router.get(
  '/employee/attendance/summary',
  protect,
  authorize('employee'),
  attendanceController.getAttendanceSummary
);

// @route   POST /api/employee/attendance/correction
// @desc    Request attendance correction
// @access  Employee
router.post(
  '/employee/attendance/correction',
  protect,
  authorize('employee'),
  attendanceController.requestCorrection
);

// @route   GET /api/employee/attendance/corrections
// @desc    Get my correction requests history
// @access  Employee
router.get(
  '/employee/attendance/corrections',
  protect,
  authorize('employee'),
  attendanceController.getMyCorrections
);

// @route   POST /api/employee/attendance/leave
// @desc    Request leave
// @access  Employee
router.post(
  '/employee/attendance/leave',
  protect,
  authorize('employee'),
  attendanceController.requestLeave
);

// @route   GET /api/employee/attendance/leaves
// @desc    Get my leave requests
// @access  Employee
router.get(
  '/employee/attendance/leaves',
  protect,
  authorize('employee'),
  attendanceController.getMyLeaves
);

// @route   GET /api/employee/attendance/today
// @desc    Get today's attendance record
// @access  Employee
router.get(
  '/employee/attendance/today',
  protect,
  authorize('employee'),
  attendanceController.getTodayAttendance
);

module.exports = router;