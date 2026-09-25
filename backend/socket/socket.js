// socket.js - Optional helper for socket operations
let io = null;

module.exports = {
  initialize: (server, corsOptions) => {
    const socketIo = require("socket.io");
    io = socketIo(server, { cors: corsOptions });
    
    io.on("connection", (socket) => {
      console.log("Socket connected:", socket.id);
      
      socket.on("authenticate", ({ userId, userType }) => {
        if (!userId) return;
        socket.userId = userId;
        socket.userType = userType;
        socket.join(`user-${userId}`);
        socket.join(`provider-${userId}`);
        socket.join(`seeker-${userId}`);
        if (userType) socket.join(`${userType}s`);
        console.log(`User ${userId} (${userType}) authenticated via helper`);
      });

      // Join ride room
      socket.on("join-ride", (rideId) => {
        socket.join(`ride-${rideId}`);
        console.log(`Socket ${socket.id} joined ride-${rideId}`);
      });
      
      // Join user room for personal notifications
      socket.on("join-user", (userId) => {
        socket.join(`user-${userId}`);
        socket.join(`provider-${userId}`);
        socket.join(`seeker-${userId}`);
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