// socket.js - Optional helper for socket operations
let io = null;

module.exports = {
  initialize: (server, corsOptions) => {
    const socketIo = require("socket.io");
    io = socketIo(server, { cors: corsOptions });
    
    io.on("connection", (socket) => {
      console.log("Socket connected:", socket.id);
      
      // Join ride room
      socket.on("join-ride", (rideId) => {
        socket.join(`ride-${rideId}`);
        console.log(`Socket ${socket.id} joined ride-${rideId}`);
      });
      
      // FIXED: Join user room for personal notifications
      socket.on("join-user", (userId) => {
        socket.join(`user-${userId}`);
        console.log(`Socket ${socket.id} joined user-${userId}`);
      });
      
      socket.on("disconnect", () => {
        console.log("Socket disconnected:", socket.id);
      });
    });
    
    return io;
  },
  
  getIo: () => {
    if (!io) {
      throw new Error("Socket.io not initialized");
    }
    return io;
  }
};
socket.on("authenticate", ({ userId, userType }) => {
  socket.join(`user-${userId}`);
  console.log(`User ${userId} (${userType}) authenticated`);
});