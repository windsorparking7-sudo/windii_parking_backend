const { Server } = require('socket.io');

let io = null;

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.SOCKET_CORS_ORIGIN?.split(',') || [
        'http://localhost:3000',
        'http://localhost:3001'
      ],
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Join company-specific room
    socket.on('join-company', (companyId) => {
      socket.join(`company-${companyId}`);
      console.log(`Socket ${socket.id} joined company-${companyId}`);
    });

    // Join admin room
    socket.on('join-admin', () => {
      socket.join('admin-room');
      console.log(`Socket ${socket.id} joined admin-room`);
    });

    // Join manager-specific room
    socket.on('join-manager', (managerId) => {
      socket.join(`manager-${managerId}`);
      console.log(`Socket ${socket.id} joined manager-${managerId}`);
    });

    // Handle car request notification
    socket.on('car-request', (data) => {
      // Notify all managers in the company
      io.to(`company-${data.companyId}`).emit('new-car-request', data);
    });

    // Handle parking session updates
    socket.on('parking-update', (data) => {
      io.to(`company-${data.companyId}`).emit('parking-updated', data);
      io.to('admin-room').emit('parking-updated', data);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
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

// Emit to specific company
const emitToCompany = (companyId, event, data) => {
  if (io) {
    io.to(`company-${companyId}`).emit(event, data);
  }
};

// Emit to admin panel
const emitToAdmin = (event, data) => {
  if (io) {
    io.to('admin-room').emit(event, data);
  }
};

// Emit to specific manager
const emitToManager = (managerId, event, data) => {
  if (io) {
    io.to(`manager-${managerId}`).emit(event, data);
  }
};

module.exports = {
  initializeSocket,
  getIO,
  emitToCompany,
  emitToAdmin,
  emitToManager
};
