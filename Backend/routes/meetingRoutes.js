// routes/meetingRoutes.js
const express = require('express');
const router = express.Router();
const {
  getAllMeetings,
  getMeeting,
  scheduleMeeting,
  updateMeeting,
  deleteMeeting,
  addMeetingMinutes,
  updateParticipantStatus,
  getMyMeetings,
  clientScheduleMeeting,
  clientCancelMeeting
} = require('../controllers/meetingController');
const { protect, authorize } = require('../middleware/auth');

// ============================================
// ADMIN ROUTES - /api/admin/meetings
// ============================================

// @route   GET /api/admin/meetings
// @desc    Get all meetings
// @access  Private/Admin
router.get('/admin', protect, authorize('admin'), getAllMeetings);

// @route   POST /api/admin/meetings
// @desc    Schedule new meeting
// @access  Private/Admin
router.post('/admin', protect, authorize('admin'), scheduleMeeting);

// @route   GET /api/admin/meetings/:id
// @desc    Get single meeting
// @access  Private/Admin
router.get('/admin/:id', protect, authorize('admin'), getMeeting);

// @route   PUT /api/admin/meetings/:id
// @desc    Update meeting
// @access  Private/Admin
router.put('/admin/:id', protect, authorize('admin'), updateMeeting);

// @route   DELETE /api/admin/meetings/:id
// @desc    Delete meeting
// @access  Private/Admin
router.delete('/admin/:id', protect, authorize('admin'), deleteMeeting);

// @route   POST /api/admin/meetings/:id/minutes
// @desc    Add meeting minutes/notes
// @access  Private/Admin
router.post('/admin/:id/minutes', protect, authorize('admin'), addMeetingMinutes);

// ============================================
// EMPLOYEE ROUTES - /api/employee/meetings
// ============================================

// @route   GET /api/employee/meetings
// @desc    Get my meetings
// @access  Private/Employee
router.get('/employee', protect, authorize('employee'), getMyMeetings);

// @route   GET /api/employee/meetings/:id
// @desc    Get single meeting
// @access  Private/Employee
router.get('/employee/:id', protect, authorize('employee'), getMeeting);

// @route   PATCH /api/employee/meetings/:id/status
// @desc    Update participant status (accept/decline)
// @access  Private/Employee
router.patch('/employee/:id/status', protect, authorize('employee'), updateParticipantStatus);

// ============================================
// CLIENT ROUTES - /api/client/meetings
// ============================================

// @route   GET /api/client/meetings
// @desc    Get my meetings
// @access  Private/Client
router.get('/client', protect, authorize('client'), getMyMeetings);

// @route   POST /api/client/meetings
// @desc    Schedule meeting (client)
// @access  Private/Client
router.post('/client', protect, authorize('client'), clientScheduleMeeting);

// @route   GET /api/client/meetings/:id
// @desc    Get single meeting
// @access  Private/Client
router.get('/client/:id', protect, authorize('client'), getMeeting);

// @route   DELETE /api/client/meetings/:id
// @desc    Cancel meeting
// @access  Private/Client
router.delete('/client/:id', protect, authorize('client'), clientCancelMeeting);

// @route   PATCH /api/client/meetings/:id/status
// @desc    Update participant status (accept/decline)
// @access  Private/Client
router.patch('/client/:id/status', protect, authorize('client'), updateParticipantStatus);

module.exports = router;