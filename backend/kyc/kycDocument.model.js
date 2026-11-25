// backend/kyc/kycDocument.model.js
// Authoritative server-side ownership, type binding, and integrity registry for private KYC documents.
const mongoose = require('mongoose');

const kycDocumentSchema = new mongoose.Schema({
  docId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  docType: {
    type: String,
    enum: ['collegeIdCard', 'drivingLicense', 'aadhar', 'selfie', 'vehiclePhoto'],
    required: true
  },
  storedRef: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  filename: {
    type: String,
    required: true
  },
  sha256: {
    type: String,
    required: true
  },
  mime: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['uploaded', 'attached', 'replaced', 'deleted'],
    default: 'uploaded'
  },
  attachedAt: {
    type: Date,
    default: null
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

kycDocumentSchema.index({ ownerId: 1, docType: 1, status: 1 });

module.exports = mongoose.model('KycDocument', kycDocumentSchema);
