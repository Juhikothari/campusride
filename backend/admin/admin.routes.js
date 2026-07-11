// backend/admin/admin.routes.js - CORRECTED
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { isAdmin } = require('./admin.middleware');
const controller = require('./admin.controller');

// All routes require auth + admin role
router.use(auth, isAdmin);

// Dashboard stats
router.get('/stats', controller.getStats);

// User management
router.get('/users', controller.getUsers);
router.put('/users/:id/suspend', controller.suspendUser);

// Ride management
router.get('/rides', controller.getAllRides);
router.delete('/rides/:id', controller.deleteRide);

// KYC management
router.get('/kyc', controller.getPendingKYC);
router.put('/kyc/:userId', controller.reviewKYC);

// Incident management
router.get('/incidents', controller.getAllIncidents);
router.put('/incidents/:id/status', controller.updateIncidentStatus);

// FIXED: Added settings routes (were only in commented block)
router.get('/settings', controller.getAllSettings);
router.post('/settings', controller.setSetting);
router.get('/settings/:key', controller.getSetting);
// NEW: Block/Unblock routes
router.post('/users/:id/block', controller.blockUser);
router.post('/users/:id/unblock', controller.unblockUser);
router.get('/users/blocked', controller.getBlockedUsers);

router.delete('/users/:id', controller.deleteUser);

module.exports = router;