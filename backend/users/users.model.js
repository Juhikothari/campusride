const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['provider', 'seeker', 'both', 'admin'],
    required: true
  },
  college: {
    type: String,
    required: function () { return this.role !== 'admin'; }
  },

  // USN — University Seat Number (shown during ride for identity)
  usn: { type: String, default: '' },

  // Gender for safety features
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer_not_to_say'],
    default: 'prefer_not_to_say'
  },

  // Profile photo (Cloudinary URL)
  profilePhoto: { type: String, default: '' },

  suspended: { type: Boolean, default: false },

  // Block user fields
  blocked: { type: Boolean, default: false },
  blockReason: { type: String, default: '' },
  blockedAt: { type: Date },
  blockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // KYC fields
  kycStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'not_submitted', 'not_required'],
    default: 'not_submitted'
  },
  kycDocuments: {
    aadhar: String,
    drivingLicense: String,
    collegeIdCard: String,
    selfie: String,
    vehiclePhoto: String,
    vehicleNumber: String,
    vehicleName: String,
  },
  kycSubmittedAt: { type: Date },
  kycVerifiedAt: { type: Date },
  kycRemarks: { type: String },

  emergencyContact: { type: String, default: '' },

  // ── Single-device login ─────────────────────────────────────────
  // Rotated on every login. The JWT carries this seed; if it doesn't
  // match the stored value the token is rejected (session replaced).
  currentSessionSeed: { type: String, default: '' },

  // ── Phone number edit throttle ──────────────────────────────────
  // Users can only update their phone number once every 90 days.
  phoneLastUpdatedAt: { type: Date, default: null },

}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
