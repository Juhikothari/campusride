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
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer_not_to_say'],
    default: 'prefer_not_to_say'
  },
  // Existing fields...
  suspended: { type: Boolean, default: false },
  
  // NEW: Block user fields
  blocked: {
    type: Boolean,
    default: false
  },
  blockReason: {
    type: String,
    default: ''
  },
  blockedAt: {
    type: Date
  },
  blockedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // KYC fields...
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
    /*vehicleType: {
      type: String,
      enum: ['car', 'bike', null],
      default: null
    },*/
    vehicleNumber: String,
  },
  kycSubmittedAt: { type: Date },
  kycVerifiedAt: { type: Date },
  kycRemarks: { type: String },
  
  emergencyContact: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
