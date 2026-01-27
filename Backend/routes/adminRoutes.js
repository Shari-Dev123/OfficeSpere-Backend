// ============================================
// Admin Routes
// All routes for admin operations
// ============================================

const express = require('express');
const router = express.Router();
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
const { protect, authorize } = require('../middleware/auth');

// Protect all admin routes
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
// SETTINGS ROUTES
// ============================================
router.route('/settings')
  .get(getSettings)
  .put(updateSettings);

module.exports = router;