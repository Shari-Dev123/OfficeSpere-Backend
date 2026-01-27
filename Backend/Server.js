// server.js
// Main server file - OfficeSphere Backend (CORRECTED VERSION)

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
const adminRoutes = require('./routes/adminRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const authRoutes = require('./routes/authRoutes');
const clientRoutes = require('./routes/clientRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const meetingRoutes = require('./routes/meetingRoutes');
const projectRoutes = require('./routes/projectRoutes');
const reportRoutes = require('./routes/reportRoutes');
const taskRoutes = require('./routes/taskRoutes');


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
      projects: '/api/projects',
      tasks: '/api/tasks',
      attendance: '/api/attendance',
      meetings: '/api/meetings',
      reports: '/api/reports',
      upload: '/api/upload',
      health: '/api/health'
    }
  });
});

// Mount routes
app.use('/api/admin', adminRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/employee', employeeRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/upload', uploadRoutes);



// Only mount upload routes if file exists
if (uploadRoutes) {
  app.use('/api/upload', uploadRoutes);
}

// ==========================================
// ERROR HANDLING
// ==========================================

// 404 handler - Route not found
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Global error handler (must be last)
app.use(errorHandler);

// ==========================================
// START SERVER
// ==========================================

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log(`🚀 OfficeSphere Backend Server`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Server running on port ${PORT}`);
  console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
  console.log(`📁 Static files: http://localhost:${PORT}/uploads`);
  console.log(`📊 MongoDB: Connected`);
  console.log('='.repeat(50));
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