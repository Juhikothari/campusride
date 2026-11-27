// backend/server.js
// ✅ FIX: Force IPv4 DNS resolution globally — prevents ENETUNREACH on IPv6-only paths
// This must be the VERY FIRST line before any require() that does networking
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const express       = require('express');
const mongoose      = require("mongoose");
const cors          = require('cors');
const helmet        = require('helmet');
const mongoSanitize = require('mongo-sanitize');
const rateLimit     = require('express-rate-limit');
const jwt           = require('jsonwebtoken');
const dotenv        = require('dotenv');
const connectDB     = require('./config/db');
const http          = require("http");
const socketIo      = require("socket.io");

dotenv.config();
// Database connection managed on server startup or on require

const app    = express();
const server = http.createServer(app);

global.io = null;

// ==========================================
// 1. PRODUCTION SECURITY HEADERS (HELMET)
// ==========================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com", "https://*.openstreetmap.org", "https://*.tile.openstreetmap.org", "https://tiles.openfreemap.org"],
      connectSrc: ["'self'", "https://api.brevo.com", "https://api.cloudinary.com", "https://exp.host", "https://*.onrender.com", "https://tiles.openfreemap.org", "https://photon.komoot.io", "https://router.project-osrm.org"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// ==========================================
// 2. CORS
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
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    return callback(new Error('Blocked by CORS security policy'));
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS','PATCH'],
  allowedHeaders: ['Content-Type','Authorization']
}));

// ==========================================
// 3. BODY PARSERS & NOSQL INJECTION PROTECTION
// ==========================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Sanitize all incoming input parameters to strip dangerous MongoDB operators ($where, $ne, etc.)
app.use((req, res, next) => {
  if (req.body) req.body = mongoSanitize(req.body);
  if (req.params) req.params = mongoSanitize(req.params);
  if (req.query) {
    for (const key in req.query) {
      req.query[key] = mongoSanitize(req.query[key]);
    }
  }
  next();
});

// ==========================================
// 4. RATE LIMITING
// ==========================================
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests from this client, please try again after 15 minutes.' }
});
app.use('/api/', globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many authentication attempts, please try again after 15 minutes.' }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/send-otp', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/verify-otp', authLimiter);
app.use('/api/auth/reset-password', authLimiter);

// ==========================================
// 5. REQUEST LOGGING (Sanitized: No credentials or tokens)
// ==========================================
const {
  sanitizeUrlForLogging,
  stripQueryFromUrl,
  sanitizeLogText,
  sanitizeErrorForClient
} = require('./utils/sanitize');

app.use((req, res, next) => {
  const sanitizedUrl = sanitizeUrlForLogging(req.originalUrl || req.url);
  console.log(`[${new Date().toISOString()}] ${req.method} ${sanitizedUrl}`);
  next();
});

// ==========================================
// 6. SOCKET.IO (Authenticated & Room Authorized)
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
  maxHttpBufferSize: 1e6
});

global.io = io;
app.set("io", io);

io.engine.on("connection_error", (err) => {
  console.log('Socket.IO Connection Error:', { code: err.code, message: err.message });
});

const connectedUsers = new Map();

// Helper to forcibly disconnect all active sockets of a user
global.disconnectUserSockets = (userId, reason = 'session_revoked') => {
  try {
    const uIdStr = userId.toString();
    for (const [id, s] of io.of("/").sockets) {
      if (s.userId === uIdStr) {
        s.emit('session_terminated', { reason });
        // Allow Socket.IO frame flush before tearing down underlying transport
        setTimeout(() => {
          try { s.disconnect(true); } catch {}
        }, 25);
        console.log(`🔌 Forcibly disconnected socket ${s.id} for user ${uIdStr} (${reason})`);
      }
    }
    connectedUsers.delete(uIdStr);
  } catch (e) {
    console.error('Error disconnecting user sockets:', e.message);
  }
};

io.on("connection", (socket) => {
  console.log("✅ Socket Connected:", socket.id, "Transport:", socket.conn.transport.name);
  socket.emit('connected', { socketId: socket.id, timestamp: new Date().toISOString() });

  // Rate limit events per socket
  socket.use(([event, ...args], next) => {
    const now = Date.now();
    socket.eventTimestamps = (socket.eventTimestamps || []).filter(t => now - t < 1000);
    if (socket.eventTimestamps.length >= 30) {
      socket.emit('rate_limit_exceeded', { message: 'Too many socket events. Slow down.' });
      return next(new Error('Rate limit exceeded on socket events'));
    }
    socket.eventTimestamps.push(now);
    next();
  });

  // Cryptographically verify identity on authenticate
  socket.on('authenticate', async (data) => {
    try {
      if (!data?.token) {
        return socket.emit('authenticated', { success: false, error: 'Authentication token required' });
      }

      let decoded;
      try {
        decoded = jwt.verify(data.token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      } catch (jwtErr) {
        return socket.emit('authenticated', { success: false, error: 'Invalid or expired token' });
      }

      const verifiedUserId = decoded.userId;
      if (!verifiedUserId) {
        return socket.emit('authenticated', { success: false, error: 'Token missing user identity' });
      }

      const User = require('./users/users.model');
      const Admin = require('./admin/admin.model');
      const user = await User.findById(verifiedUserId).select('role blocked isBlocked suspended college name currentSessionSeed');

      if (!user) {
        return socket.emit('authenticated', { success: false, error: 'User account not found' });
      }

      if (user.blocked || user.isBlocked || user.suspended) {
        return socket.emit('authenticated', { success: false, error: 'Account is restricted or suspended' });
      }

      // Prevent identity switching on an already authenticated socket
      if (socket.userId && socket.userId !== user._id.toString()) {
        return socket.emit('authenticated', {
          success: false,
          error: 'Identity switching on an active socket connection is prohibited'
        });
      }

      // Single-device session verification
      if (decoded.sessionSeed) {
        if (!user.currentSessionSeed || user.currentSessionSeed !== decoded.sessionSeed) {
          return socket.emit('authenticated', {
            success: false,
            error: 'Session expired, replaced, or revoked. Please log in again.',
            code: 'SESSION_REVOKED'
          });
        }
      }

      // Clear previous rooms during legitimate re-authentication
      for (const room of socket.rooms) {
        if (room !== socket.id) socket.leave(room);
      }

      // Check admin status strictly server-side
      const adminRecord = await Admin.findOne({ userId: user._id });
      const isVerifiedAdmin = user.role === 'admin' || !!adminRecord;

      socket.userId   = user._id.toString();
      socket.userRole = isVerifiedAdmin ? 'admin' : user.role;
      socket.userCollege = user.college || '';
      socket.sessionSeed = decoded.sessionSeed;

      connectedUsers.set(socket.userId, { socketId: socket.id, userType: socket.userRole, joinedAt: new Date() });

      // Join personal user rooms
      socket.join(`user-${socket.userId}`);
      socket.join(`seeker-${socket.userId}`);

      if (['provider', 'both'].includes(user.role)) {
        socket.join(`provider-${socket.userId}`);
      }

      // STRICT AUTHORIZATION: Only join admin rooms if server-side verified admin!
      if (isVerifiedAdmin) {
        socket.join('admin');
        socket.join('admins');
        console.log(`🛡️  Verified Admin ${socket.userId} joined administrative rooms`);
      }

      // Auto-join user to verified college room
      if (user.college) {
        const collegeRoom = `college-${user.college.trim().toLowerCase().replace(/\s+/g, '-')}`;
        socket.join(collegeRoom);
        socket.collegeRoom = collegeRoom;
      }

      socket.emit('authenticated', {
        success: true,
        userId: socket.userId,
        userType: socket.userRole,
        college: socket.userCollege
      });
      console.log(`✅ User ${socket.userId} authenticated with role ${socket.userRole}`);
    } catch (error) {
      socket.emit('authenticated', { success: false, error: error.message });
    }
  });

  // Authorized provider room join: only self or verified admin
  socket.on("join-provider", (providerId) => {
    if (!socket.userId) {
      return socket.emit('error', { message: 'Authentication required' });
    }
    if (socket.userId === String(providerId) || socket.userRole === 'admin') {
      socket.join(`provider-${providerId}`);
    } else {
      socket.emit('error', { message: 'Access denied: You cannot join another provider\'s private channel' });
    }
  });

  // Authorized ride room join: only ride provider, accepted passenger, or admin
  socket.on("join-ride", async (rideId) => {
    try {
      if (!socket.userId) {
        return socket.emit('error', { message: 'Authentication required' });
      }
      if (!rideId) return;

      const Ride = require('./rides/rides.model');
      const Booking = require('./bookings/bookings.model');
      const ride = await Ride.findById(rideId).select('providerId');
      if (!ride) return socket.emit('error', { message: 'Ride not found' });

      const isProvider = ride.providerId.toString() === socket.userId;
      const isSeeker = await Booking.exists({
        rideId,
        seekerId: socket.userId,
        status: { $in: ['accepted', 'completed'] }
      });
      const isAdmin = socket.userRole === 'admin';

      if (isProvider || isSeeker || isAdmin) {
        socket.join(`ride-${rideId}`);
        socket.emit('joined-ride', { rideId });
      } else {
        socket.emit('chat-error', { message: 'Unauthorized: You are not an accepted participant in this ride' });
      }
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // ── Community chat: join college room ─────────────────────────
  socket.on("join-college-chat", async () => {
    try {
      if (!socket.userId) {
        return socket.emit('college-chat-error', { message: 'Authentication required' });
      }

      const User = require('./users/users.model');
      const user = await User.findById(socket.userId).select('college');
      if (!user?.college) {
        return socket.emit('college-chat-error', { message: 'College not registered for user' });
      }

      const collegeRoom = `college-${user.college.trim().toLowerCase().replace(/\s+/g, '-')}`;
      socket.join(collegeRoom);
      socket.collegeRoom = collegeRoom;
      socket.userCollege = user.college;
      socket.emit('college-chat-joined', { college: user.college, room: collegeRoom });
    } catch (error) {
      socket.emit('college-chat-error', { message: 'Could not join college community' });
    }
  });

  // ── Community chat: send message (with server-verified sender) ────
  socket.on("send-community-message", async (data) => {
    try {
      if (!socket.userId) return;

      const { message, anonymous, fileAttachment } = data || {};
      if (!message?.trim() && !fileAttachment?.url) return;

      const User    = require('./users/users.model');
      const ChatMsg = require('./community/chatmsg.model');
      const user = await User.findById(socket.userId).select('college name usn blocked suspended');

      if (!user || user.blocked || user.suspended || !user.college) {
        socket.emit('college-chat-error', { message: 'Unauthorized or account restricted' });
        return;
      }

      const collegeRoom = `college-${user.college.trim().toLowerCase().replace(/\s+/g, '-')}`;
      if (!socket.rooms.has(collegeRoom)) {
        socket.join(collegeRoom);
        socket.collegeRoom = collegeRoom;
        socket.userCollege = user.college;
      }

      const isAnon = !!anonymous;

      const saved = await ChatMsg.create({
        college:        user.college.trim().toLowerCase(),
        sender:         socket.userId,
        message:        message ? message.trim() : '',
        anonymous:      isAnon,
        fileAttachment: fileAttachment ? {
          url:      fileAttachment.url,
          name:     fileAttachment.name,
          size:     fileAttachment.size,
          fileType: fileAttachment.fileType || 'pdf',
        } : undefined,
      });

      const payload = {
        _id:            saved._id,
        senderId:       isAnon ? null : socket.userId,
        senderName:     isAnon ? 'Anonymous' : user.name,
        senderUsn:      isAnon ? '' : (user.usn || ''),
        college:        user.college,
        message:        message ? message.trim() : '',
        anonymous:      isAnon,
        fileAttachment: saved.fileAttachment || null,
        createdAt:      saved.createdAt.toISOString(),
      };

      io.to(collegeRoom).emit("receive-community-message", payload);
    } catch (error) {
      console.error("send-community-message error:", error.message);
    }
  });

  // ── Community chat: delete own message ───────────────────────
  socket.on("delete-community-message", async (data) => {
    try {
      if (!socket.userId) return;
      const { messageId } = data || {};
      const ChatMsg = require('./community/chatmsg.model');
      const User    = require('./users/users.model');
      const msg = await ChatMsg.findById(messageId);
      if (!msg) return;

      const isSender = msg.sender.toString() === socket.userId;
      const isAdmin = socket.userRole === 'admin';
      if (!isSender && !isAdmin) return;

      const user = await User.findById(socket.userId).select('college');
      const collegeRoom = `college-${user.college.trim().toLowerCase().replace(/\s+/g, '-')}`;
      await msg.deleteOne();
      io.to(collegeRoom).emit("community-message-deleted", { messageId });
    } catch (err) {
      console.error("delete-community-message error:", err.message);
    }
  });

  // ── Ride chat (Authorized participants only) ──────────────────
  socket.on("send-message", async (data) => {
    try {
      if (!socket.userId) return;
      const Chat = require('./chat/chat.model');
      const User = require('./users/users.model');
      const Ride = require('./rides/rides.model');
      const Booking = require('./bookings/bookings.model');
      const { rideId, message } = data || {};

      if (!rideId || !message?.trim()) return;

      const [user, ride] = await Promise.all([
        User.findById(socket.userId).select('college blocked suspended name'),
        Ride.findById(rideId).select('college providerId')
      ]);

      if (!user || user.blocked || user.suspended || !ride) return;

      const isProvider = ride.providerId.toString() === socket.userId;
      const isSeeker = await Booking.exists({
        rideId,
        seekerId: socket.userId,
        status: { $in: ['accepted', 'completed'] }
      });
      const isAdmin = socket.userRole === 'admin';

      if (!isProvider && !isSeeker && !isAdmin) {
        socket.emit('chat-error', { message: 'You are not an authorized participant in this ride.' });
        return;
      }

      const chat = new Chat({ rideId, sender: socket.userId, message: message.trim() });
      await chat.save();
      io.to(`ride-${rideId}`).emit("receive-message", {
        rideId,
        senderId: socket.userId,
        senderName: user.name,
        message: message.trim(),
        createdAt: chat.createdAt
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
    if (socket.userId) {
      connectedUsers.delete(socket.userId);
    }
  });
});

// ==========================================
// 5. HEALTH ROUTES (LIVENESS & DATABASE-AWARE READINESS)
// ==========================================
app.get('/', (req, res) => res.json({
  message: 'HOGO API is running!',
  timestamp: new Date().toISOString(),
  socketConnections: connectedUsers.size
}));

// Liveness probe: confirms the Node.js process is responsive
app.get('/api/health/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Readiness probe: confirms the database is connected and ready to serve traffic
app.get('/api/health/ready', (req, res) => {
  const dbState = mongoose.connection.readyState;
  if (dbState === 1) {
    return res.status(200).json({
      status: 'ready',
      database: 'connected',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  }
  return res.status(503).json({
    status: 'not_ready',
    database: dbState === 2 ? 'connecting' : 'disconnected',
    error: 'Database is not ready to serve traffic'
  });
});

// Backward-compatible database-aware health endpoints
app.get('/api/health', (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  if (isConnected) {
    return res.status(200).json({ status: 'OK', database: 'connected', uptime: process.uptime() });
  }
  return res.status(503).json({ status: 'DEGRADED', database: 'disconnected', uptime: process.uptime() });
});

app.get('/health', (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  const status = isConnected ? 200 : 503;
  res.status(status).json({
    status: isConnected ? 'OK' : 'DEGRADED',
    database: isConnected ? 'Connected' : 'Disconnected',
    socketConnections: connectedUsers.size
  });
});

app.get('/api/ping', (req, res) => res.send('pong'));

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
app.use('/api/colleges',      require('./colleges/colleges.routes'));

// ==========================================
// 7. ERROR HANDLERS (Sanitized — Never expose query strings, tokens, or stack traces)
// ==========================================
app.use((req, res) => {
  const safeLogUrl = sanitizeUrlForLogging(req.originalUrl || req.url);
  const safePath = stripQueryFromUrl(req.path || req.originalUrl || '/');
  console.log(`❌ 404: ${req.method} ${safeLogUrl}`);
  res.status(404).json({ error: 'Route not found', path: safePath, method: req.method });
});

app.use((err, req, res, next) => {
  console.error('❌ Error:', sanitizeLogText(err?.message || 'Internal Server Error'));
  const status = err.name === 'MulterError' ? 400 : (err.status || 500);
  res.status(status).json({
    error: sanitizeErrorForClient(err),
    code: err.code || (status === 400 ? 'BAD_REQUEST' : 'INTERNAL_ERROR')
  });
});

// ==========================================
// 8. START SERVER & BACKGROUND CLEANUP JOBS
// ==========================================
const PORT = process.env.PORT || 5000;
if (require.main === module) {
  (async () => {
    try {
      await connectDB();
      server.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📡 Socket.IO ready`);
        console.log(`🌐 DNS: IPv4-first (OTP emails will work)`);

        // Periodic 3-hour stale ride auto-cancel job (every 10 minutes)
        try {
          const { autoCancelStaleRides } = require('./rides/rides.controller');
          autoCancelStaleRides();
          setInterval(autoCancelStaleRides, 10 * 60 * 1000);
          console.log('⏰ 3-Hour Ride Auto-Cancel Background Job started (10m interval)');
        } catch (jobErr) {
          console.error('Failed to start auto-cancel job:', jobErr.message);
        }

        // Background worker for Expo Push Notification Receipt Verification (30s interval)
        try {
          const { startPushReceiptWorker } = require('./notifications/pushReceipt.worker');
          startPushReceiptWorker(30 * 1000);
        } catch (workerErr) {
          console.error('Failed to start push receipt worker:', workerErr.message);
        }
      });
    } catch (startErr) {
      console.error('Fatal startup error: Failed to connect to MongoDB', startErr.message);
      process.exit(1);
    }
  })();
} else {
  // When imported (e.g. test runner), initiate DB connection
  connectDB().catch(err => console.warn('Non-main DB connection deferred:', err.message));
}

module.exports = { app, server, sanitizeUrlForLogging };
