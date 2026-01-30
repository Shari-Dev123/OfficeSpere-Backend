// config/socket.js
const socketIO = require('socket.io');

let io;

const initializeSocket = (server) => {
  io = socketIO(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  io.on('connection', (socket) => {
    console.log('✅ User connected:', socket.id);

    // User joins their specific room
    socket.on('join-room', ({ role, userId }) => {
      const roomName = `${role}-${userId}`;
      socket.join(roomName);
      socket.join(role); // Also join general role room (all admins, all employees, etc.)
      
      console.log(`👤 User ${userId} joined rooms: ${roomName}, ${role}`);
    });

    // Leave room
    socket.on('leave-room', ({ role, userId }) => {
      const roomName = `${role}-${userId}`;
      socket.leave(roomName);
      socket.leave(role);
      console.log(`👋 User ${userId} left room: ${roomName}`);
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log('❌ User disconnected:', socket.id);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

module.exports = { initializeSocket, getIO };