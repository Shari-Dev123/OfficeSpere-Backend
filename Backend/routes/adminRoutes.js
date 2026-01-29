// routes/adminRoutes.js
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
  updateSettings
} = require('../controllers/adminController');

// ✅ Import from projectController for CRUD operations
const {
  getProject,
  createProject,
  updateProject,
  deleteProject,
  assignTeam
} = require('../controllers/projectController');

// ✅ Import from taskController
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
// DASHBOARD ROUTES
// ============================================
router.get('/dashboard', getDashboard);

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
// PROJECT ROUTES - ADMIN MANAGES ALL PROJECTS
// ============================================
router.route('/projects')
  .get(getProjects)      // Get all projects (from adminController)
  .post(createProject);  // Create new project (from projectController)

router.route('/projects/:id')
  .get(getProject)       // Get single project (from projectController)
  .put(updateProject)    // ✅ UPDATE PROJECT - This was missing!
  .delete(deleteProject); // Delete project (from projectController)

router.post('/projects/:id/assign', assignTeam); // Assign team to project

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

// ============================================
// SETTINGS ROUTES
// ============================================
router.route('/settings')
  .get(getSettings)
  .put(updateSettings);

module.exports = router;