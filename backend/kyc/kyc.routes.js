const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { isAdmin } = require('../admin/admin.middleware');
const kycController = require('./kyc.controller');

// User routes
router.post('/submit', auth, kycController.submitKyc);
router.get('/status', auth, kycController.getKycStatus);

// Document serving route - strictly authenticated & authorized (owner or admin)
router.get('/document/:userId/:docType', auth, kycController.getDocumentImage);

// Admin routes - strictly requires admin role
router.get('/admin/pending', auth, isAdmin, kycController.getPendingKyc);
router.post('/admin/review', auth, isAdmin, kycController.reviewKyc);

module.exports = router;