const jwt = require('jsonwebtoken');
const User = require('../users/users.model');

const auth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader) return res.status(401).json({ message: 'No token, authorization denied' });
    if (!authHeader.startsWith('Bearer ')) return res.status(401).json({ message: 'Token format invalid. Use: Bearer <token>' });

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');
    // AFTER decoding token
    const user = await User.findById(decoded.userId);

    if (!user) {
   return res.status(401).json({ message: 'User not found' });
    }

    // ✅ BLOCK SUSPENDED USERS
    if (user.suspended) {
     return res.status(403).json({ message: 'Your account has been blocked by admin' });
  }

  req.user = decoded;
  next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') return res.status(401).json({ message: 'Token has expired' });
    return res.status(401).json({ message: 'Token is not valid' });
  }
};

module.exports = auth;
