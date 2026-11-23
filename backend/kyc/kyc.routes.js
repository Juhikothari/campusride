const express = require('express');
const router = express.Router();
const multer = require('multer');
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

// User routes
router.post('/upload', auth, upload.single('document'), kycController.uploadDocument);
router.post('/submit', auth, kycController.submitKyc);
router.get('/status', auth, kycController.getKycStatus);

// Document serving routes - strictly authenticated & authorized (owner or admin)
router.get('/document/:userId/:docType/signed-url', auth, kycController.getSignedDocumentUrl);
router.get('/document/:userId/:docType', auth, kycController.getDocumentImage);
router.delete('/document/:userId/:docType', auth, kycController.deleteDocument);

// Admin routes - strictly requires admin role
router.get('/admin/pending', auth, isAdmin, kycController.getPendingKyc);
router.post('/admin/review', auth, isAdmin, kycController.reviewKyc);

module.exports = router;
