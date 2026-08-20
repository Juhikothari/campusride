// backend/server.js
// ✅ FIX: Force IPv4 DNS resolution globally — prevents ENETUNREACH on IPv6-only paths
// This must be the VERY FIRST line before any require() that does networking
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const express   = require('express');
const mongoose  = require("mongoose");
const cors      = require('cors');
const dotenv    = require('dotenv');
const connectDB = require('./config/db');
const http      = require("http");
const socketIo  = require("socket.io");

dotenv.config();
connectDB();

const app    = express();
const server = http.createServer(app);

global.io = null;

// ==========================================
// 1. CORS
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
    if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
    console.log('⚠️ CORS request from:', origin);
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS','PATCH'],
  allowedHeaders: ['Content-Type','Authorization']
}));

// ==========================================
// 2. BODY PARSERS
// ==========================================
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
// 4. SOCKET.IO
// ==========================================
const io = socketIo(server, {
  cors: {
    origin: allowedOrigins.length > 0 ? allowedOrigins : "*",
    methods: ["GET","POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  allowEIO3: true,
  maxHttpBufferSize: 1e6
});

global.io = io;
app.set("io", io);

io.engine.on("connection_error", (err) => {
  console.log('Socket.IO Connection Error:', { code: err.code, message: err.message });
});

const connectedUsers = new Map();

io.on("connection", (socket) => {
  console.log("✅ Socket Connected:", socket.id, "Transport:", socket.conn.transport.name);
  socket.emit('connected', { socketId: socket.id, timestamp: new Date().toISOString() });

  socket.on('authenticate', (data) => {
    try {
      const { userId, userType } = data;
      if (userId) {
        connectedUsers.set(userId, { socketId: socket.id, userType, joinedAt: new Date() });
        socket.userId   = userId;
        socket.userType = userType;
        socket.join(`user-${userId}`);
        if (userType) socket.join(`${userType}s`);
        console.log(`✅ User ${userId} (${userType}) authenticated`);
        socket.emit('authenticated', { success: true, userId, userType });
      }
    } catch (error) {
      socket.emit('authenticated', { success: false, error: error.message });
    }
  });

  socket.on("join-provider", (providerId) => {
    socket.join(`provider-${providerId}`);
  });

  socket.on("join-ride", (rideId) => {
    socket.join(`ride-${rideId}`);
  });

  // ── Community chat: join college room ─────────────────────────
  socket.on("join-college-chat", async (data) => {
    try {
      const { userId } = data;
      const User = require('./users/users.model');
      const user = await User.findById(userId).select('college');
      if (!user?.college) {
        socket.emit('college-chat-error', { message: 'College not found for user' });
        return;
      }
      const collegeRoom = `college-${user.college.trim().toLowerCase().replace(/\s+/g, '-')}`;
      socket.join(collegeRoom);
      socket.collegeRoom  = collegeRoom;
      socket.userCollege  = user.college;
      socket.emit('college-chat-joined', { college: user.college, room: collegeRoom });
    } catch (error) {
      socket.emit('college-chat-error', { message: 'Could not join college chat' });
    }
  });

  // ── Community chat: send message (with optional anonymous) ────
  socket.on("send-community-message", async (data) => {
    try {
      const { userId, message, anonymous } = data;   // ← anonymous added
      if (!message?.trim()) return;

      const User    = require('./users/users.model');
      const ChatMsg = require('./community/chatmsg.model');
      const user = await User.findById(userId).select('college name usn');
      if (!user?.college) {
        socket.emit('college-chat-error', { message: 'Unauthorized: college not found' });
        return;
      }

      const collegeRoom = `college-${user.college.trim().toLowerCase().replace(/\s+/g, '-')}`;
      if (!socket.rooms.has(collegeRoom)) {
        socket.emit('college-chat-error', { message: 'You are not in this college room' });
        return;
      }

      const isAnon = !!anonymous;

      const saved = await ChatMsg.create({
        college:   user.college.trim().toLowerCase(),
        sender:    userId,
        message:   message.trim(),
        anonymous: isAnon,             // ← saved to DB
      });

      const payload = {
        _id:        saved._id,
        // Hide identity when anonymous
        senderId:   isAnon ? null : userId,
        senderName: isAnon ? 'Anonymous' : user.name,
        senderUsn:  isAnon ? '' : (user.usn || ''),
        college:    user.college,
        message:    message.trim(),
        anonymous:  isAnon,
        createdAt:  saved.createdAt.toISOString(),
      };

      io.to(collegeRoom).emit("receive-community-message", payload);
    } catch (error) {
      console.error("send-community-message error:", error.message);
    }
  });

  // ── Community chat: delete own message ───────────────────────
  socket.on("delete-community-message", async (data) => {
    try {
      const { userId, messageId } = data;
      const ChatMsg = require('./community/chatmsg.model');
      const User    = require('./users/users.model');
      const msg = await ChatMsg.findById(messageId);
      if (!msg) return;
      if (msg.sender.toString() !== userId) return;
      const user = await User.findById(userId).select('college');
      const collegeRoom = `college-${user.college.trim().toLowerCase().replace(/\s+/g, '-')}`;
      await msg.deleteOne();
      io.to(collegeRoom).emit("community-message-deleted", { messageId });
    } catch (err) {
      console.error("delete-community-message error:", err.message);
    }
  });

  // ── Ride chat ─────────────────────────────────────────────────
  socket.on("send-message", async (data) => {
    try {
      const Chat = require('./chat/chat.model');
      const User = require('./users/users.model');
      const Ride = require('./rides/rides.model');
      const { rideId, senderId, message } = data;
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

  socket.conn.on("upgrade", () => {
    console.log(`Socket ${socket.id} upgraded to ${socket.conn.transport.name}`);
  });

  socket.on("disconnect", (reason) => {
    console.log("❌ Socket Disconnected:", socket.id, "Reason:", reason);
    for (const [userId, data] of connectedUsers.entries()) {
      if (data.socketId === socket.id) { connectedUsers.delete(userId); break; }
    }
  });
});

// ==========================================
// 5. HEALTH ROUTES
// ==========================================
app.get('/', (req, res) => res.json({
  message: 'HOGO API is running!',
  timestamp: new Date().toISOString(),
  socketConnections: connectedUsers.size
}));

app.get('/health', (req, res) => res.json({
  status: 'OK',
  database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
  socketConnections: connectedUsers.size
}));

app.get('/socket-test', (req, res) => res.json({
  socketIoVersion: require('socket.io/package.json').version,
  activeConnections: connectedUsers.size,
  transports: ['websocket', 'polling']
}));

// ==========================================
// 6. ROUTES
// ==========================================
app.use('/api/auth',          require('./auth/auth.routes'));
app.use('/api/users',         require('./users/users.routes'));
app.use('/api/location',      require('./location/location.routes'));
app.use('/api/ride',          require('./rides/rides.routes'));
app.use('/api/booking',       require('./bookings/bookings.routes'));
app.use('/api/ratings',       require('./ratings/ratings.routes'));
app.use('/api/kyc',           require('./kyc/kyc.routes'));
app.use('/api/tracking',      require('./tracking/tracking.routes'));
app.use('/api/chat',          require('./chat/chat.routes'));
app.use('/api/admin',         require('./admin/admin.routes'));
app.use('/api/alerts',        require('./alerts/alerts.routes'));
app.use('/api/sos',           require('./sos/sos.routes'));
app.use('/api/incidents',     require('./incidents/incidents.routes'));
app.use('/api/notifications', require('./notifications/notifications.routes'));
app.use('/api/community',     require('./community/community.routes'));
app.use('/api/chatbot',       require('./chatbot/chatbot.routes'));

// ==========================================
// 7. ERROR HANDLERS
// ==========================================
app.use((req, res) => {
  console.log(`❌ 404: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: 'Route not found', url: req.originalUrl, method: req.method });
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
  console.log(`📡 Socket.IO ready`);
  console.log(`🌐 DNS: IPv4-first (OTP emails will work)`);
});
