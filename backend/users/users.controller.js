const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./users.model');

// Block a user
exports.blockUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        blocked: true,
        blockReason: reason || 'Violation of terms',
        blockedAt: new Date(),
        blockedBy: req.user.userId, // Admin who blocked
        suspended: true // Also suspend while blocked
      },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: `User ${user.name} has been blocked`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        blocked: user.blocked,
        blockReason: user.blockReason,
        blockedAt: user.blockedAt
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Unblock a user
exports.unblockUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        blocked: false,
        blockReason: '',
        blockedAt: null,
        blockedBy: null,
        suspended: false // Unsuspend when unblocking
      },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: `User ${user.name} has been unblocked`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        blocked: user.blocked
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all blocked users
exports.getBlockedUsers = async (req, res) => {
  try {
    const blockedUsers = await User.find({ blocked: true })
      .select('name email phone college blocked blockReason blockedAt createdAt')
      .populate('blockedBy', 'name email')
      .sort({ blockedAt: -1 });

    res.json(blockedUsers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const updates = req.body;
    delete updates.password;
    
    const user = await User.findByIdAndUpdate(req.user.userId, updates, { new: true }).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};