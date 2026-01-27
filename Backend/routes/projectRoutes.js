// ============================================
// Project Routes
// All routes for project operations
// ============================================

const express = require('express');
const router = express.Router();
const {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  assignTeam,
  getProjectTimeline,
  getProjectStats
} = require('../controllers/projectController');
const { protect, authorize } = require('../middleware/auth');

// Protect all project routes
router.use(protect);
router.use(authorize('admin'));

// ============================================
// PROJECT CRUD ROUTES
// ============================================
router.route('/')
  .get(getProjects)
  .post(createProject);

router.route('/:id')
  .get(getProject)
  .put(updateProject)
  .delete(deleteProject);

// ============================================
// PROJECT SPECIFIC ROUTES
// ============================================
router.post('/:id/assign', assignTeam);
router.get('/:id/timeline', getProjectTimeline);
router.get('/:id/stats', getProjectStats);

module.exports = router;