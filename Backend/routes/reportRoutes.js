// routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const {
  generateReport,
  getPerformanceReport,
  getProductivityReport,
  getAttendanceReport,
  exportReport,
  getProjectReports,
  getWeeklyReport,
  downloadReport
} = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/auth');

// ============================================
// ADMIN ROUTES - /api/admin/reports
// ============================================

// @route   POST /api/admin/reports/generate
// @desc    Generate custom report
// @access  Private/Admin
router.post('/admin/generate', protect, authorize('admin'), generateReport);

// @route   GET /api/admin/reports/performance
// @desc    Get performance report
// @access  Private/Admin
router.get('/admin/performance', protect, authorize('admin'), getPerformanceReport);

// @route   GET /api/admin/reports/productivity
// @desc    Get productivity report
// @access  Private/Admin
router.get('/admin/productivity', protect, authorize('admin'), getProductivityReport);

// @route   GET /api/admin/reports/attendance
// @desc    Get attendance report
// @access  Private/Admin
router.get('/admin/attendance', protect, authorize('admin'), getAttendanceReport);

// @route   GET /api/admin/reports/:reportType/export
// @desc    Export report (PDF, Excel, CSV)
// @access  Private/Admin
router.get('/admin/:reportType/export', protect, authorize('admin'), exportReport);

// ============================================
// CLIENT ROUTES - /api/client/reports
// ============================================

// @route   GET /api/client/projects/:id/reports
// @desc    Get project reports
// @access  Private/Client
router.get('/client/projects/:id', protect, authorize('client'), getProjectReports);

// @route   GET /api/client/projects/:id/reports/weekly
// @desc    Get weekly report for project
// @access  Private/Client
router.get('/client/projects/:id/weekly', protect, authorize('client'), getWeeklyReport);

// @route   GET /api/client/reports/:id/download
// @desc    Download report (PDF, Excel)
// @access  Private/Client
router.get('/client/:id/download', protect, authorize('client'), downloadReport);

module.exports = router;