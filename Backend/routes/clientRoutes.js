// routes/clientRoutes.js

const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const notificationController = require('../controllers/notificationController'); // ✅ ADD THIS
const { protect, authorize } = require('../middleware/auth');

// Apply authentication and client role restriction to all routes
router.use(protect);
router.use(authorize('client'));

// Dashboard Routes
router.get('/dashboard', clientController.getDashboard);

// ============ NOTIFICATION ROUTES ============ ✅ ADD THESE
router.get('/notifications', notificationController.getClientNotifications);
router.patch('/notifications/:id/read', notificationController.markAsRead);
router.patch('/notifications/:id/unread', notificationController.markAsUnread);
router.patch('/notifications/mark-all-read', notificationController.markAllRead);
router.delete('/notifications/:id', notificationController.deleteNotification);

// Project Routes
router.get('/projects', clientController.getMyProjects);
router.get('/projects/:id', clientController.getProject);
router.get('/projects/:id/progress', clientController.getProjectProgress);
router.get('/projects/:id/timeline', clientController.getProjectTimeline);
router.get('/projects/:id/milestones', clientController.getProjectMilestones);

// ============ NEW ROUTES ============
router.post('/projects', clientController.createProject);
router.put('/projects/:id', clientController.updateProject);
router.delete('/projects/:id', clientController.deleteProject);
router.post('/projects/send-to-admin', clientController.sendProjectToAdmin);

// Meeting Routes
router.get('/meetings', clientController.getMyMeetings);
router.get('/meetings/:id', clientController.getMeeting);
router.post('/meetings', clientController.scheduleMeeting);
router.delete('/meetings/:id', clientController.cancelMeeting);

// Report Routes
router.get('/projects/:id/reports', clientController.getProjectReports);
router.get('/projects/:id/reports/weekly', clientController.getWeeklyReport);
router.get('/reports/:id/download', clientController.downloadReport);

// Feedback Routes
router.post('/projects/:id/feedback', clientController.submitFeedback);
router.get('/projects/:id/feedback', clientController.getFeedbackHistory);

// Milestone Management Routes
router.post('/projects/:id/milestones/:milestoneId/approve', clientController.approveMilestone);
router.post('/projects/:id/milestones/:milestoneId/changes', clientController.requestChanges);

// Rating Route
router.post('/projects/:id/rating', clientController.rateSatisfaction);

// Profile Routes
router.get('/profile', clientController.getProfile);
router.put('/profile', clientController.updateProfile);
router.put('/profile/company', clientController.updateCompanyInfo);
router.put('/password', clientController.changePassword);

module.exports = router;