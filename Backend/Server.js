// server.js
// Main server file - OfficeSphere Backend (FIXED VERSION)

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const { errorHandler } = require('./middleware/errorHandler');
const path = require('path');

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

// Initialize Express app
const app = express();

// ==========================================
// MIDDLEWARE
// ==========================================

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Serve static files (uploaded files)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Request logging in development
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// ==========================================
// ROUTES
// ==========================================

// Import routes
const adminRoutes = require('./Routes/adminRoutes');
const attendanceRoutes = require('./Routes/attendanceRoutes');
const authRoutes = require('./Routes/authRoutes');
const clientRoutes = require('./Routes/clientRoutes');
const employeeRoutes = require('./Routes/employeeRoutes');
const meetingRoutes = require('./Routes/meetingRoutes');
const reportRoutes = require('./Routes/reportRoutes');
const taskRoutes = require('./Routes/taskRoutes');

// ✅ REMOVED: projectRoutes - Projects handled by admin/client routes
// ❌ OLD: const projectRoutes = require('./Routes/attendanceRoutes'); // THIS WAS WRONG!

// Check if uploadRoutes exists, if not skip it
let uploadRoutes;
try {
  uploadRoutes = require('./routes/uploadRoutes');
} catch (err) {
  console.log('⚠️  uploadRoutes not found, skipping...');
}

// Health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'OfficeSphere API is running',
    timestamp: new Date().toISOString()
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to OfficeSphere API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      admin: '/api/admin',
      employee: '/api/employee',
      client: '/api/client',
      attendance: '/api/attendance',
      meetings: '/api/meetings',
      reports: '/api/reports',
      upload: '/api/upload',
      health: '/api/health'
    }
  });
});

// ==========================================
// MOUNT ROUTES
// ==========================================
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);        // ✅ Admin routes (includes /admin/projects)
app.use('/api/employee', employeeRoutes);
app.use('/api/client', clientRoutes);      // ✅ Client routes (includes /client/projects)
app.use('/api/attendance', attendanceRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/tasks', taskRoutes);

// ✅ REMOVED: app.use('/api/projects', projectRoutes); 
// Projects are now handled within admin and client routes

// Only mount upload routes if file exists
if (uploadRoutes) {
  app.use('/api/upload', uploadRoutes);
}

// ==========================================
// ERROR HANDLING
// ==========================================

// 404 handler - Route not found
app.use((req, res) => {
  console.log('❌ 404 - Route not found:', req.method, req.originalUrl);
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: [
      '/api/auth/*',
      '/api/admin/*',
      '/api/employee/*',
      '/api/client/*',
      '/api/attendance/*',
      '/api/meetings/*',
      '/api/reports/*',
      '/api/tasks/*'
    ]
  });
});

// Global error handler (must be last)
app.use(errorHandler);

// ==========================================
// START SERVER
// ==========================================

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log('==================================================');
  console.log(`🚀 OfficeSphere Backend Server`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Server running on port ${PORT}`);
  console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
  console.log(`📁 Static files: http://localhost:${PORT}/uploads`);
  console.log(`📊 MongoDB: Connected`);
  console.log('==================================================');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`❌ Unhandled Rejection: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.log(`❌ Uncaught Exception: ${err.message}`);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Process terminated');
  });
});

module.exports = app;