// routes/meetingRoutes.js
// ============================================
// MEETING ROUTES - FULLY ALIGNED WITH FRONTEND
// ============================================

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const meetingController = require('../controllers/meetingController');

// ============================================
// ADMIN MEETING ROUTES
// Frontend calls: /meetings/admin/*
// ============================================

// Frontend: adminAPI.getMeetings() → GET /api/meetings/admin
router.get(
  '/admin',
  protect,
  authorize('admin'),
  meetingController.getAllMeetings
);

// Frontend: adminAPI.scheduleMeeting() → POST /api/meetings/admin
router.post(
  '/admin',
  protect,
  authorize('admin'),
  meetingController.scheduleMeeting
);

// Frontend: adminAPI.getMeeting(id) → GET /api/meetings/admin/:id
router.get(
  '/admin/:id',
  protect,
  authorize('admin'),
  meetingController.getMeeting
);

// Frontend: adminAPI.updateMeeting(id) → PUT /api/meetings/admin/:id
router.put(
  '/admin/:id',
  protect,
  authorize('admin'),
  meetingController.updateMeeting
);

// Frontend: adminAPI.deleteMeeting(id) → DELETE /api/meetings/admin/:id
router.delete(
  '/admin/:id',
  protect,
  authorize('admin'),
  meetingController.deleteMeeting
);

// Frontend: adminAPI.addMeetingMinutes(id) → POST /api/meetings/admin/:id/minutes
router.post(
  '/admin/:id/minutes',
  protect,
  authorize('admin'),
  meetingController.addMeetingMinutes
);

// ============================================
// EMPLOYEE MEETING ROUTES
// Frontend calls: /meetings/employee/*
// ============================================

// Frontend: employeeAPI.getMyMeetings() → GET /api/meetings/employee
router.get(
  '/employee',
  protect,
  authorize('employee'),
  meetingController.getMyMeetings
);

// Frontend: employeeAPI.getMeeting(id) → GET /api/meetings/employee/:id
router.get(
  '/employee/:id',
  protect,
  authorize('employee'),
  meetingController.getMeeting
);

// Frontend: employeeAPI.updateMeetingStatus(id) → PATCH /api/meetings/employee/:id/status
router.patch(
  '/employee/:id/status',
  protect,
  authorize('employee'),
  meetingController.updateParticipantStatus
);

// ============================================
// CLIENT MEETING ROUTES
// Frontend calls: /meetings/client/*
// ============================================

// Frontend: clientAPI.getMyMeetings() → GET /api/meetings/client
router.get(
  '/client',
  protect,
  authorize('client'),
  meetingController.getMyMeetings
);

// Frontend: clientAPI.scheduleMeeting() → POST /api/meetings/client
router.post(
  '/client',
  protect,
  authorize('client'),
  meetingController.clientScheduleMeeting
);

// Frontend: clientAPI.getMeeting(id) → GET /api/meetings/client/:id
router.get(
  '/client/:id',
  protect,
  authorize('client'),
  meetingController.getMeeting
);

// Frontend: clientAPI.cancelMeeting(id) → DELETE /api/meetings/client/:id
router.delete(
  '/client/:id',
  protect,
  authorize('client'),
  meetingController.clientCancelMeeting
);

// Frontend: clientAPI.updateMeetingStatus(id) → PATCH /api/meetings/client/:id/status
router.patch(
  '/client/:id/status',
  protect,
  authorize('client'),
  meetingController.updateParticipantStatus
);

module.exports = router;