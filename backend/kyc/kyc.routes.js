const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const kycController = require('./kyc.controller');

// User routes
router.post('/submit', auth, kycController.submitKyc);
router.get('/status', auth, kycController.getKycStatus);

// Document serving route - make it public or protected as needed
router.get('/document/:userId/:docType', kycController.getDocumentImage);

// Admin routes
router.get('/admin/pending', auth, kycController.getPendingKyc);
router.post('/admin/review', auth, kycController.reviewKyc);

module.exports = router;