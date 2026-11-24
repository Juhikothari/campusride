// backend/middleware/auth.js
// Production-grade JWT authentication with single-device enforcement,
// algorithm restrictions, and real-time account status verification (blocked/suspended).

const jwt  = require('jsonwebtoken');
const User = require('../users/users.model');

module.exports = async (req, res, next) => {
  let token = null;
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    token = header.split(' ')[1];
  } else if (req.query && req.query.token) {
    // Support short-lived signed tokens for private streaming endpoints
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ message: 'Authentication required. No Bearer token or signed token provided.' });
  }

  let decoded;
  try {
    // Strictly restrict to HS256 algorithm to prevent algorithm confusion attacks
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    return res.status(401).json({ message: 'Invalid, malformed, or expired authentication token.' });
  }

  if (!decoded || !decoded.userId) {
    return res.status(401).json({ message: 'Token payload missing user identity.' });
  }

  try {
    const user = await User.findById(decoded.userId).select('currentSessionSeed blocked isBlocked suspended role');
    if (!user) {
      return res.status(401).json({ message: 'Account not found or deactivated.' });
    }

    if (user.blocked || user.isBlocked) {
      return res.status(403).json({ message: 'This account has been blocked by administrators.' });
    }

    if (user.suspended) {
      return res.status(403).json({ message: 'This account is currently suspended from campus rides.' });
    }

    // Single-device session verification
    if (decoded.sessionSeed) {
      if (!user.currentSessionSeed || user.currentSessionSeed !== decoded.sessionSeed) {
        return res.status(401).json({
          message: 'Session expired, replaced, or revoked. Please log in again.',
          code: 'SESSION_REPLACED'
        });
      }
    }

    req.user = {
      userId: user._id.toString(),
      role: user.role,
      sessionSeed: decoded.sessionSeed,
      deviceId: decoded.deviceId
    };
    req.tokenDecoded = decoded;
    next();
  } catch (dbErr) {
    console.error('Auth middleware verification error:', dbErr.message);
    return res.status(500).json({ message: 'Internal authentication service error' });
  }
};
