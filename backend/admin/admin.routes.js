// backend/admin/admin.routes.js - Comprehensive Admin Routes
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { isAdmin } = require('./admin.middleware');
const controller = require('./admin.controller');

// All routes require auth + admin role
router.use(auth, isAdmin);

// ── Dashboard Stats ───────────────────────────────────────────────
router.get('/stats', controller.getStats);

// ── KYC Management ────────────────────────────────────────────────
router.get('/kyc',               controller.getKYCSubmissions);
router.post('/kyc/approve',      controller.approveKYC);
router.put('/kyc/:userId/approve', controller.approveKYC);
router.post('/kyc/reject',       controller.rejectKYC);
router.put('/kyc/:userId/reject', controller.rejectKYC);
router.post('/kyc/revoke',       controller.revokeKYC);
router.put('/kyc/:userId/revoke', controller.revokeKYC);
router.put('/kyc/:userId',       controller.reviewKYC);

// ── User Management ───────────────────────────────────────────────
router.get('/users',             controller.getUsers);
router.post('/users/suspend',    controller.suspendUser);
router.put('/users/:id/suspend', controller.suspendUser);
router.post('/users/block',      controller.blockUser);
router.post('/users/:id/block',  controller.blockUser);
router.put('/users/:id/block',   controller.blockUser);
router.post('/users/unblock',    controller.unblockUser);
router.post('/users/:id/unblock',controller.unblockUser);
router.put('/users/:id/unblock', controller.unblockUser);
router.get('/users/blocked',     controller.getBlockedUsers);
router.delete('/users/:userId',  controller.deleteUser);
router.delete('/users/:id',      controller.deleteUser);

// ── Ride Management ───────────────────────────────────────────────
router.get('/rides',             controller.getAllRides);
router.post('/rides/force-cancel', controller.forceCancelRide);
router.delete('/rides/:id',      controller.deleteRide);

// ── Incident Management ───────────────────────────────────────────
router.get('/incidents',         controller.getAllIncidents);
router.put('/incidents/:id/status', controller.updateIncidentStatus);

// ── Broadcast Notifications ───────────────────────────────────────
router.post('/notifications/broadcast', controller.broadcastNotification);

// ── Audit Logs ────────────────────────────────────────────────────
router.get('/audit-logs',        controller.getAuditLogs);

// ── Settings & Export ─────────────────────────────────────────────
router.get('/settings',          controller.getAllSettings);
router.post('/settings',         controller.setSetting);
router.get('/settings/:key',     controller.getSetting);
router.get('/export/:type',      controller.exportData);

module.exports = router;
