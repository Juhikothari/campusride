// backend/middleware/auth.js
// FIX: Single-device enforcement — checks that the token's sessionSeed
//      matches the one stored in the DB. When the user logs in on a new
//      device, the seed rotates and all old tokens become invalid.

const jwt  = require('jsonwebtoken');
const User = require('../users/users.model');

module.exports = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ message: 'No token provided' });

  const token = header.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  // ── Single-device check ─────────────────────────────────────────
  // Only do the DB lookup if the token actually carries a sessionSeed.
  // Tokens issued before this feature was added won't have one, so we
  // let them through (graceful rollout) but log a warning.
  if (decoded.sessionSeed) {
    try {
      const user = await User.findById(decoded.userId).select('currentSessionSeed blocked');
      if (!user) return res.status(401).json({ message: 'User not found' });
      if (user.blocked) return res.status(403).json({ message: 'Account is blocked' });

      if (user.currentSessionSeed && user.currentSessionSeed !== decoded.sessionSeed) {
        return res.status(401).json({
          message: 'Session expired. Your account was logged in on another device. Please log in again.',
          code: 'SESSION_REPLACED'
        });
      }
    } catch (dbErr) {
      console.error('Auth middleware DB error:', dbErr.message);
      return res.status(500).json({ message: 'Authentication error' });
    }
  } else {
    console.warn(`⚠️  Token without sessionSeed for user ${decoded.userId} — old token format`);
  }

  req.user = decoded;
  next();
};
