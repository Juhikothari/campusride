// backend/admin/auditLog.model.js
const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    enum: [
      'APPROVE_KYC', 'REJECT_KYC', 'REVOKE_KYC',
      'BLOCK_USER', 'UNBLOCK_USER', 'SUSPEND_USER', 'DELETE_USER',
      'FORCE_CANCEL_RIDE',
      'BROADCAST',
      'LOGIN',
      'RESOLVE_INCIDENT',
    ],
    required: true,
  },
  adminId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId }, // userId, rideId, incidentId
  meta:     { type: Object, default: {} },             // reason, duration, notes, etc.
}, { timestamps: true });

module.exports = mongoose.model('AuditLog', auditLogSchema);
