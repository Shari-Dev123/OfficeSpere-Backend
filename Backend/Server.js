
const http = require('http');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const { errorHandler } = require('./middleware/errorHandler');
const path = require('path');
const { initializeSocket } = require('./config/socket');

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();


const app = express();
const server = http.createServer(app);


initializeSocket(server);

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


// Import routes
const adminRoutes = require('./Routes/adminRoutes');
const attendanceRoutes = require('./Routes/attendanceRoutes');
const authRoutes = require('./Routes/authRoutes');
const clientRoutes = require('./Routes/clientRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const meetingRoutes = require('./routes/meetingRoutes');
const reportRoutes = require('./routes/reportRoutes');
const taskRoutes = require('./Routes/taskRoutes');

// Check if uploadRoutes exists
let uploadRoutes;
try {
  uploadRoutes = require('./Routes/uploadRoutes');
} catch (err) {
  console.log('⚠️  uploadRoutes not found, skipping...');
}

// Health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'OfficeSphere API is running',
    socket: io ? 'Connected' : 'Not Connected',
    timestamp: new Date().toISOString()
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to OfficeSphere API',
    version: '1.0.0',
    socket: 'Real-time updates enabled',
    endpoints: {
      auth: '/api/auth',
      admin: '/api/admin',
      employee: '/api/employee',
      client: '/api/client',
      attendance: '/api/attendance',
      meetings: '/api/meetings',
      reports: '/api/reports',
      tasks: '/api/tasks',
      upload: '/api/upload',
      health: '/api/health'
    }
  });
});

// ==========================================
// MOUNT ROUTES
// ==========================================
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/employee', employeeRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/tasks', taskRoutes);

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

server.listen(PORT, () => {
  console.log('==================================================');
  console.log(`🚀 OfficeSphere Backend Server`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Server running on port ${PORT}`);
  console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
  console.log(`📁 Static files: http://localhost:${PORT}/uploads`);
  console.log(`📊 MongoDB: Connected`);
  console.log(`🔌 Socket.IO: Initialized & Ready`);
  console.log('==================================================');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`❌ Unhandled Rejection: ${err.message}`);
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