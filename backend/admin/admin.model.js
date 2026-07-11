const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true,
    unique: true
  },
  email: { type: String, required: true, unique: true },
  role: { 
    type: String, 
    enum: ['admin', 'superadmin'], 
    default: 'admin' 
  },
  permissions: [{
    type: String,
    enum: ['users', 'rides', 'bookings', 'verifications', 'reports', 'settings']
  }],
  lastLogin: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Admin', adminSchema);