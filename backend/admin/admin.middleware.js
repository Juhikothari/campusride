const User  = require('../users/users.model');
const Admin = require('./admin.model');

const ADMIN_EMAILS = [
  'admin@campusride.in',
  'superadmin@campusride.in',
  'support@campusride.in',
  ...(process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',').map(e => e.trim().toLowerCase()) : [])
];

const isAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) return res.status(401).json({ message: 'User not found' });

    // Pass if user role is admin, isAdmin flag is true, or verified admin email
    const isAllowedEmail = user.email && ADMIN_EMAILS.includes(user.email.toLowerCase().trim());
    if (
      user.role === 'admin' ||
      user.isAdmin === true ||
      isAllowedEmail
    ) {
      req.adminUser = user;
      req.user.role = 'admin';
      return next();
    }

    // Also pass if there is an Admin record for this user
    const adminRecord = await Admin.findOne({ userId: req.user.userId });
    if (adminRecord) {
      req.adminUser = user;
      req.admin     = adminRecord;
      req.user.role = 'admin';
      return next();
    }

    return res.status(403).json({
      message:  'Admin access required',
      yourRole: user.role
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const isSuperAdmin = async (req, res, next) => {
  try {
    const admin = await Admin.findOne({ userId: req.user.userId });
    if (!admin || admin.role !== 'superadmin') {
      return res.status(403).json({ message: 'Super admin access required' });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { isAdmin, isSuperAdmin };
