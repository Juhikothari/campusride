const express = require('express');
const router = express.Router();
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/auth');
const { isAdmin } = require('../admin/admin.middleware');
const kycController = require('./kyc.controller');

// Multer memory storage configuration with 5MB strict limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB
  }
});

function handleUploadSingle(req, res, next) {
  upload.single('document')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Invalid file upload', code: err.code || 'UPLOAD_ERROR' });
    }
    next();
  });
}

const registerUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => rateLimit.ipKeyGenerator(req.ip || 'anon'),
  message: { message: 'Too many registration document upload attempts. Please wait a few minutes.', code: 'RATE_LIMITED' }
});

// Pre-registration private KYC document staging upload (profile photos handled separately)
router.post('/register-upload', registerUploadLimiter, handleUploadSingle, kycController.uploadRegistrationDocument);

// User routes
router.post('/upload', auth, handleUploadSingle, kycController.uploadDocument);
router.post('/submit', auth, kycController.submitKyc);
router.get('/status', auth, kycController.getKycStatus);

// Document serving routes - strictly authenticated & authorized (owner or admin)
router.get('/document/:userId/:docType/signed-url', auth, kycController.getSignedDocumentUrl);
router.get('/document/:userId/:docType', auth.kycDocumentAuth, kycController.getDocumentImage);
router.delete('/document/:userId/:docType', auth, kycController.deleteDocument);

// Admin routes - strictly requires admin role
router.get('/admin/pending', auth, isAdmin, kycController.getPendingKyc);
router.post('/admin/review', auth, isAdmin, kycController.reviewKyc);

module.exports = router;
