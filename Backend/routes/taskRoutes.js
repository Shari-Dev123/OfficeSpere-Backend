// ============================================
// Task Routes
// All routes for task operations
// ============================================

const express = require('express');
const router = express.Router();
const {
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  assignTask,
  getTaskStats,
  bulkUpdateTasks,
  getTasksByProject,
  getTasksByEmployee
} = require('../controllers/taskController');
const { protect, authorize } = require('../middleware/auth');

// Protect all task routes
router.use(protect);
router.use(authorize('admin'));

// ============================================
// TASK CRUD ROUTES
// ============================================
router.route('/')
  .get(getTasks)
  .post(createTask);

router.route('/:id')
  .get(getTask)
  .put(updateTask)
  .delete(deleteTask);

// ============================================
// TASK SPECIFIC ROUTES
// ============================================
router.post('/:id/assign', assignTask);
router.get('/stats', getTaskStats);
router.put('/bulk', bulkUpdateTasks);
router.get('/project/:projectId', getTasksByProject);
router.get('/employee/:employeeId', getTasksByEmployee);

module.exports = router;