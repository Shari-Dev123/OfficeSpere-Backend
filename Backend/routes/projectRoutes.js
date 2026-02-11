// ============================================
// Admin Project Routes - WITH FILE UPLOAD
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
  getProjectStats,
  uploadProjectFiles
} = require('../controllers/projectController');
const { protect, authorize } = require('../middleware/auth');
const { uploadMultiple } = require('../config/multer');

// Protect all project routes
router.use(protect);
router.use(authorize('admin'));

// ============================================
// PROJECT CRUD ROUTES
// ============================================

// GET all projects, POST create project with file upload
router.route('/')
  .get(getProjects)
  .post(uploadMultiple('files', 10), createProject); // ✅ Allow up to 10 files

// GET single project, PUT update project, DELETE project
router.route('/:id')
  .get(getProject)
  .put(uploadMultiple('files', 10), updateProject) // ✅ Allow file upload on update
  .delete(deleteProject);

// ============================================
// PROJECT SPECIFIC ROUTES
// ============================================

// Assign team to project
router.post('/:id/assign', assignTeam);

// Get project timeline
router.get('/:id/timeline', getProjectTimeline);

// Get project statistics
router.get('/:id/stats', getProjectStats);

// ✅ Upload files to existing project
router.post('/:id/upload', uploadMultiple('files', 10), uploadProjectFiles);

module.exports = router;