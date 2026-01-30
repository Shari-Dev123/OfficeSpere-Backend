// routes/reportRoutes.js
// ============================================
// REPORT ROUTES - FULLY ALIGNED WITH FRONTEND
// ============================================

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const reportController = require('../controllers/reportController');

// ============================================
// ADMIN REPORT ROUTES
// Frontend calls: /reports/admin/*
// ============================================

// Frontend: adminAPI.generateReport() → POST /api/reports/admin/generate
router.post(
  '/admin/generate',
  protect,
  authorize('admin'),
  reportController.generateReport
);

// Frontend: adminAPI.getPerformanceReport() → GET /api/reports/admin/performance
router.get(
  '/admin/performance',
  protect,
  authorize('admin'),
  reportController.getPerformanceReport
);

// Frontend: adminAPI.getProductivityReport() → GET /api/reports/admin/productivity
router.get(
  '/admin/productivity',
  protect,
  authorize('admin'),
  reportController.getProductivityReport
);

router.get(
  '/admin/employee',
  protect,
  authorize('admin'),
  reportController.getProductivityReport
);
// Frontend: adminAPI.getAttendanceReportData() → GET /api/reports/admin/attendance
router.get(
  '/admin/attendance',
  protect,
  authorize('admin'),
  reportController.getAttendanceReport
);

// Frontend: adminAPI.exportReport(type) → GET /api/reports/admin/:reportType/export
router.get(
  '/admin/:reportType/export',
  protect,
  authorize('admin'),
  reportController.exportReport
);

// ============================================
// CLIENT REPORT ROUTES
// Frontend calls: /reports/client/*
// ============================================

// Frontend: clientAPI.getProjectReports(id) → GET /api/reports/client/projects/:projectId
router.get(
  '/client/projects/:projectId',
  protect,
  authorize('client'),
  reportController.getProjectReports
);

// Frontend: clientAPI.getWeeklyReport(id) → GET /api/reports/client/projects/:projectId/weekly
router.get(
  '/client/projects/:projectId/weekly',
  protect,
  authorize('client'),
  reportController.getWeeklyReport
);

// Frontend: clientAPI.downloadReport(id) → GET /api/reports/client/:reportId/download
router.get(
  '/client/:reportId/download',
  protect,
  authorize('client'),
  reportController.downloadReport
);

module.exports = router;