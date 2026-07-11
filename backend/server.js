// backend/server.js - SOCKET.IO FIX
const express = require('express');
const mongoose = require("mongoose");
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const http = require("http");
const socketIo = require("socket.io");

const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '.env') });
connectDB();

const app = express();
const server = http.createServer(app);

// Make io globally available for controllers
global.io = null;

// ==========================================
// 1. CORS - Enhanced for Socket.IO
// ==========================================
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://fw-mq8p.onrender.com',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    console.log('⚠️ CORS request from:', origin);
    return callback(null, true); // Allow all for now
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS','PATCH'],
  allowedHeaders: ['Content-Type','Authorization']
}));

// ==========================================
// 2. BODY PARSERS
// ==========================================
/*app.use(express.json());
app.use(express.urlencoded({ extended: true }));*/
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ==========================================
// 3. REQUEST LOGGING
// ==========================================
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// ==========================================
// 4. SOCKET.IO - FIXED CONFIGURATION
// ==========================================
const io = socketIo(server, {
  cors: { 
    origin: allowedOrigins.length > 0 ? allowedOrigins : "*", 
    methods: ["GET","POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'], // Allow both, prefer websocket
  pingTimeout: 60000,
  pingInterval: 25000,
  allowEIO3: true, // Allow Engine.IO v3 clients (backward compatibility)
  maxHttpBufferSize: 1e6
});

global.io = io;
app.set("io", io);

// Debug: Log all connection errors
io.engine.on("connection_error", (err) => {
  console.log('Socket.IO Connection Error:', {
    code: err.code,
    message: err.message,
    context: err.context
  });
});

// Track connected users
const connectedUsers = new Map();

io.on("connection", (socket) => {
  console.log("✅ Socket Connected:", socket.id, "Transport:", socket.conn.transport.name);

  // Send immediate confirmation
  socket.emit('connected', { socketId: socket.id, timestamp: new Date().toISOString() });

  // User authentication and room joining
  socket.on('authenticate', (data) => {
    try {
      const { userId, userType } = data;
      if (userId) {
        connectedUsers.set(userId, {
          socketId: socket.id,
          userType,
          joinedAt: new Date()
        });
        socket.userId = userId;
        socket.userType = userType;
        
        // Join personal room
        socket.join(`user-${userId}`);
        
        // Join role-based room
        if (userType) {
          socket.join(`${userType}s`); // 'seekers' or 'providers'
        }
        
        console.log(`✅ User ${userId} (${userType}) authenticated`);
        socket.emit('authenticated', { success: true, userId, userType });
      }
    } catch (error) {
      console.error('Socket authentication error:', error);
      socket.emit('authenticated', { success: false, error: error.message });
    }
  });

  // Provider joins their provider room
  socket.on("join-provider", (providerId) => {
    socket.join(`provider-${providerId}`);
    console.log(`Provider ${providerId} joined their room`);
  });

  // Join ride room for chat/updates
  socket.on("join-ride", (rideId) => {
    socket.join(`ride-${rideId}`);
    console.log(`Socket ${socket.id} joined ride-${rideId}`);
  });

  // ── Community chat: join college-scoped room ──────────────────
  socket.on("join-college-chat", async (data) => {
    try {
      const { userId } = data;
      const User = require('./users/users.model');
      const user = await User.findById(userId).select('college');
      if (!user || !user.college) {
        socket.emit('college-chat-error', { message: 'College not found for user' });
        return;
      }
      // Normalise college name into a safe room key
      const collegeRoom = `college-${user.college.trim().toLowerCase().replace(/\s+/g, '-')}`;
      socket.join(collegeRoom);
      socket.collegeRoom = collegeRoom;
      socket.userCollege = user.college;
      console.log(`✅ Socket ${socket.id} joined community room: ${collegeRoom}`);
      socket.emit('college-chat-joined', { college: user.college, room: collegeRoom });
    } catch (error) {
      console.error('join-college-chat error:', error.message);
      socket.emit('college-chat-error', { message: 'Could not join college chat' });
    }
  });

  // ── Community chat: broadcast only to same college ────────────
  socket.on("send-community-message", async (data) => {
    try {
      const { userId, message } = data;
      if (!message?.trim()) return;

      const User = require('./users/users.model');
      const user = await User.findById(userId).select('college name');
      if (!user || !user.college) {
        socket.emit('college-chat-error', { message: 'Unauthorized: college not found' });
        return;
      }

      const collegeRoom = `college-${user.college.trim().toLowerCase().replace(/\s+/g, '-')}`;

      // Ensure socket is in the correct college room
      if (!socket.rooms.has(collegeRoom)) {
        socket.emit('college-chat-error', { message: 'You are not in this college room' });
        return;
      }

      const payload = {
        senderId:   userId,
        senderName: user.name,
        college:    user.college,
        message:    message.trim(),
        createdAt:  new Date().toISOString(),
      };

      io.to(collegeRoom).emit("receive-community-message", payload);
      console.log(`💬 Community msg in ${collegeRoom} from ${user.name}`);
    } catch (error) {
      console.error("send-community-message error:", error.message);
    }
  });

  socket.on("send-message", async (data) => {
    try {
      const Chat = require('./chat/chat.model');
      const User = require('./users/users.model');
      const Ride = require('./rides/rides.model');
      const { rideId, senderId, message } = data;

      // Verify sender and ride belong to the same college
      const [sender, ride] = await Promise.all([
        User.findById(senderId).select('college'),
        Ride.findById(rideId).select('college')
      ]);

      if (sender && ride && sender.college && ride.college) {
        if (sender.college.trim().toLowerCase() !== ride.college.trim().toLowerCase()) {
          socket.emit('chat-error', { message: 'You can only chat within your college rides' });
          return;
        }
      }

      const chat = new Chat({ rideId, sender: senderId, message });
      await chat.save();
      io.to(`ride-${rideId}`).emit("receive-message", {
        rideId, senderId, message, createdAt: chat.createdAt
      });
    } catch (error) {
      console.error("Chat error:", error.message);
    }
  });

  // Handle transport upgrade
  socket.conn.on("upgrade", () => {
    console.log(`Socket ${socket.id} upgraded to ${socket.conn.transport.name}`);
  });

  socket.on("disconnect", (reason) => {
    console.log("❌ Socket Disconnected:", socket.id, "Reason:", reason);
    // Remove from connected users
    for (const [userId, data] of connectedUsers.entries()) {
      if (data.socketId === socket.id) {
        connectedUsers.delete(userId);
        break;
      }
    }
  });
});

// ==========================================
// 5. HEALTH ROUTES
// ==========================================
app.get('/', (req, res) => {
  res.json({
    message: 'FreeWheels API is running!',
    timestamp: new Date().toISOString(),
    socketConnections: connectedUsers.size
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    socketConnections: connectedUsers.size
  });
});

// Socket.IO test endpoint
app.get('/socket-test', (req, res) => {
  res.json({
    socketIoVersion: require('socket.io/package.json').version,
    activeConnections: connectedUsers.size,
    transports: ['websocket', 'polling']
  });
});

// ==========================================
// 6. ROUTES
// ==========================================
const authRoutes = require('./auth/auth.routes');
app.use('/api/auth', authRoutes);

const usersRoutes = require('./users/users.routes');
app.use('/api/users', usersRoutes);

const ridesRoutes = require('./rides/rides.routes');
const bookingsRoutes = require('./bookings/bookings.routes');
const ratingsRoutes = require('./ratings/ratings.routes');
const kycRoutes = require('./kyc/kyc.routes');
const trackingRoutes = require('./tracking/tracking.routes');
const chatRoutes = require('./chat/chat.routes');
const adminRoutes = require('./admin/admin.routes');
const alertsRoutes = require('./alerts/alerts.routes');
const sosRoutes = require('./sos/sos.routes');
const incidentsRoutes = require('./incidents/incidents.routes');
const locationRoutes = require('./location/location.routes');
const notificationsRoutes = require('./notifications/notifications.routes');
const communityRoutes = require('./community/community.routes');

app.use('/api/location', locationRoutes);
app.use('/api/ride', ridesRoutes);
app.use('/api/booking', bookingsRoutes);
app.use('/api/ratings', ratingsRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/incidents', incidentsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/community', communityRoutes);

// ==========================================
// 7. ERROR HANDLERS
// ==========================================
app.use((req, res) => {
  console.log(`❌ 404 - Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: 'Route not found',
    url: req.originalUrl,
    method: req.method
  });
});

app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(500).json({ error: err.message });
});

// ==========================================
// 8. START SERVER
// ==========================================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.IO ready with transports: websocket, polling`);
});