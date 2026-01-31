// routes/adminRoutes.js
// ✅ FIXED VERSION - Proper route ordering to prevent conflicts

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

// ✅ Import from adminController
const {
  getDashboard,
  getEmployees,
  getEmployee,
  addEmployee,
  updateEmployee,
  deleteEmployee,
  getClients,
  getClient,
  addClient,
  updateClient,
  deleteClient,
  getProjects,
  getSettings,
  updateSettings,
  getDailyAttendance  // ✅ Import attendance function
} = require('../controllers/adminController');

const {
  getAdminNotifications,
  markAsRead,
  markAsUnread,
  markAllRead,
  deleteNotification,
  deleteMany
} = require('../controllers/notificationController.js');

const {
  getProject,
  createProject,
  updateProject,
  deleteProject,
  assignTeam
} = require('../controllers/projectController');

const {
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask
} = require('../controllers/taskController');

// ============================================
// PROTECT ALL ADMIN ROUTES
// ============================================
router.use(protect);
router.use(authorize('admin'));

// ============================================
// ⚠️ CRITICAL: SPECIFIC ROUTES BEFORE PARAMETERIZED ROUTES
// ============================================

// ============================================
// DASHBOARD ROUTES
// ============================================
router.get('/dashboard', getDashboard);

// ============================================
// 🔔 NOTIFICATION ROUTES (Specific routes first)
// ============================================
router.patch('/notifications/mark-all-read', markAllRead);  // ✅ Before :id routes
router.post('/notifications/delete-many', deleteMany);      // ✅ Before :id routes
router.get('/notifications', getAdminNotifications);
router.patch('/notifications/:id/read', markAsRead);
router.patch('/notifications/:id/unread', markAsUnread);
router.delete('/notifications/:id', deleteNotification);

// ============================================
// ✅ ATTENDANCE ROUTE - Place BEFORE employees routes
// This handles: GET /api/admin/attendance?date=2025-01-31
// ============================================
router.get('/attendance', (req, res, next) => {
  console.log('====================================');
  console.log('🎯 ADMIN ATTENDANCE ROUTE HIT!');
  console.log('Full URL:', req.originalUrl);
  console.log('Query params:', req.query);
  console.log('Method:', req.method);
  console.log('====================================');
  getDailyAttendance(req, res, next);
});

// ============================================
// SETTINGS ROUTES (Specific routes before parameterized)
// ============================================
router.route('/settings')
  .get(getSettings)
  .put(updateSettings);

// ============================================
// EMPLOYEE ROUTES
// ============================================
router.route('/employees')
  .get(getEmployees)
  .post(addEmployee);

router.route('/employees/:id')
  .get(getEmployee)
  .put(updateEmployee)
  .delete(deleteEmployee);

// ============================================
// CLIENT ROUTES
// ============================================
router.route('/clients')
  .get(getClients)
  .post(addClient);

router.route('/clients/:id')
  .get(getClient)
  .put(updateClient)
  .delete(deleteClient);

// ============================================
// PROJECT ROUTES
// ============================================
router.route('/projects')
  .get(getProjects)
  .post(createProject);

router.route('/projects/:id')
  .get(getProject)
  .put(updateProject)
  .delete(deleteProject);

router.post('/projects/:id/assign', assignTeam);

// ============================================
// TASK ROUTES
// ============================================
router.route('/tasks')
  .get(getTasks)
  .post(createTask);

router.route('/tasks/:id')
  .get(getTask)
  .put(updateTask)
  .delete(deleteTask);

console.log('✅ Admin routes registered successfully');

module.exports = router;