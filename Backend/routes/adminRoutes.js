// routes/adminRoutes.js
// ============================================
// COMPLETE ADMIN ROUTES - ALL OPERATIONS
// ============================================

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

// Import Admin Controller
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
  getSettings,
  updateSettings
} = require('../controllers/adminController');

// Import Project Controller
const {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject
} = require('../controllers/projectController');

// Import Task Controller
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
// Frontend: adminAPI.getDashboardStats() → GET /api/admin/dashboard
// ============================================
router.get('/dashboard', getDashboard);

// ============================================
// EMPLOYEE ROUTES
// Frontend: adminAPI.getEmployees() → GET /api/admin/employees
// Frontend: adminAPI.addEmployee() → POST /api/admin/employees
// Frontend: adminAPI.getEmployee(id) → GET /api/admin/employees/:id
// Frontend: adminAPI.updateEmployee(id) → PUT /api/admin/employees/:id
// Frontend: adminAPI.deleteEmployee(id) → DELETE /api/admin/employees/:id
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
// Frontend: adminAPI.getClients() → GET /api/admin/clients
// Frontend: adminAPI.addClient() → POST /api/admin/clients
// Frontend: adminAPI.getClient(id) → GET /api/admin/clients/:id
// Frontend: adminAPI.updateClient(id) → PUT /api/admin/clients/:id
// Frontend: adminAPI.deleteClient(id) → DELETE /api/admin/clients/:id
// ============================================
router.route('/clients')
  .get(getClients)
  .post(addClient);

router.route('/clients/:id')
  .get(getClient)
  .put(updateClient)
  .delete(deleteClient);

// ============================================
// PROJECT ROUTES (ADDED - WAS MISSING!)
// Frontend: adminAPI.getProjects() → GET /api/admin/projects
// Frontend: adminAPI.addProject() → POST /api/admin/projects
// Frontend: adminAPI.getProject(id) → GET /api/admin/projects/:id
// Frontend: adminAPI.updateProject(id) → PUT /api/admin/projects/:id
// Frontend: adminAPI.deleteProject(id) → DELETE /api/admin/projects/:id
// ============================================
router.route('/projects')
  .get(getProjects)
  .post(createProject);

router.route('/projects/:id')
  .get(getProject)
  .put(updateProject)
  .delete(deleteProject);

// ============================================
// TASK ROUTES (ADDED - WAS MISSING!)
// Frontend: adminAPI.getTasks() → GET /api/admin/tasks
// Frontend: adminAPI.addTask() → POST /api/admin/tasks
// Frontend: adminAPI.getTask(id) → GET /api/admin/tasks/:id
// Frontend: adminAPI.updateTask(id) → PUT /api/admin/tasks/:id
// Frontend: adminAPI.deleteTask(id) → DELETE /api/admin/tasks/:id
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
// Frontend: adminAPI.getSettings() → GET /api/admin/settings
// Frontend: adminAPI.updateSettings() → PUT /api/admin/settings
// ============================================
router.route('/settings')
  .get(getSettings)
  .put(updateSettings);

module.exports = router;