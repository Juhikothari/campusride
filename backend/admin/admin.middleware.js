const User  = require('../users/users.model');
const Admin = require('./admin.model');

const isAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) return res.status(401).json({ message: 'User not found' });

    // Pass if role is admin
    if (user.role === 'admin') {
      req.adminUser = user;
      return next();
    }

    // Also pass if there is an Admin record for this user
    const adminRecord = await Admin.findOne({ userId: req.user.userId });
    if (adminRecord) {
      req.adminUser = user;
      req.admin     = adminRecord;
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
