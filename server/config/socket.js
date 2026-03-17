const { Server } = require('socket.io');

let io;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
    },
  });

  // ─── Global Socket Events ────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    console.log(`🔌 Client connected   → id: ${socket.id}`);

    // Listen for operator manual override for the emergency grid
    socket.on('operator:override', (data) => {
      console.log(`🚨 Operator Override received from ${socket.id} —`, data);
      
      // Optionally broadcast the override update to all other connected dashboards
      io.emit('operator:override:update', data);
    });

    socket.on('disconnect', () => {
      console.log(`❌ Client disconnected → id: ${socket.id}`);
    });
  });

  return io;
};

// Getter method allowing you to broadcast events from other files (like controllers or Redis subscribers)
const getIo = () => {
  if (!io) {
    throw new Error('Socket.io is not initialized!');
  }
  return io;
};

module.exports = { initSocket, getIo };
