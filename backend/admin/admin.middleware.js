const User  = require('../users/users.model');
const Admin = require('./admin.model');

/**
 * Server-side verified administrator check.
 * Strictly verifies database records. Rejects blocked or suspended accounts.
 * Hardcoded emails and client-supplied flags are eliminated.
 */
const isAdmin = async (req, res, next) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(401).json({ message: 'Account not found' });

    if (user.blocked || user.isBlocked) {
      return res.status(403).json({ message: 'Account is blocked. Administrative access revoked.' });
    }
    if (user.suspended) {
      return res.status(403).json({ message: 'Account is currently suspended. Administrative access revoked.' });
    }

    // Explicit administrator verification:
    // 1. User has verified role === 'admin'
    // 2. OR user has an explicit Admin collection profile
    let adminRecord = await Admin.findOne({ userId: req.user.userId });

    if (user.role === 'admin') {
      req.adminUser = user;
      req.admin     = adminRecord || { role: 'admin', permissions: ['users', 'rides', 'bookings', 'verifications', 'reports', 'settings'] };
      req.user.role = 'admin';
      return next();
    }

    if (adminRecord) {
      req.adminUser = user;
      req.admin     = adminRecord;
      req.user.role = adminRecord.role || 'admin';
      return next();
    }

    return res.status(403).json({
      message: 'Access denied: Administrator privileges required.',
      yourRole: user.role
    });

  } catch (error) {
    const isProd = process.env.NODE_ENV === 'production';
    res.status(500).json({ message: isProd ? 'Authorization service error' : 'Authorization service verification failed' });
  }
};

const isSuperAdmin = async (req, res, next) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const admin = await Admin.findOne({ userId: req.user.userId });
    if (!admin || admin.role !== 'superadmin') {
      return res.status(403).json({ message: 'Access denied: Super-admin privileges required.' });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { isAdmin, isSuperAdmin };
