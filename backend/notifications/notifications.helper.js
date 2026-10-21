// backend/notifications/notifications.helper.js - Centralized Admin & Push Notification Helper
const User = require('../users/users.model');
const Notification = require('./notifications.model');

/**
 * Dispatch administrative notification to all active campus administrators:
 * 1. Creates persistent Notification records in MongoDB for every admin
 * 2. Emits real-time socket events to 'admin', 'admins', and individual admin user rooms
 * 3. Supports critical alerts like Emergency SOS, KYC Submissions, Incidents, and Vehicle Submissions
 */
async function notifyAdmins({ title, message, type = 'admin_alert', data = {}, priority = 'high' }) {
  try {
    // 1. Locate all admin users in MongoDB
    const admins = await User.find({ role: 'admin' }).select('_id name email phone');
    if (!admins || admins.length === 0) {
      console.log('[notifyAdmins] Note: No admin users registered in database yet.');
    }

    // 2. Persist notification in database for all admin accounts
    const notifDocs = (admins || []).map(admin => ({
      userId: admin._id,
      userType: 'admin',
      type,
      title,
      body: message,
      data,
      priority,
      channels: ['in_app', 'push', 'socket'],
      createdAt: new Date(),
    }));

    if (notifDocs.length > 0) {
      await Notification.insertMany(notifDocs);
    }

    // 3. Emit real-time WebSocket events if Socket.IO is initialized
    if (global.io) {
      const payload = {
        title,
        message,
        body: message,
        type,
        data,
        priority,
        timestamp: new Date().toISOString(),
      };

      // Broadcast to global admin rooms
      global.io.to('admin').emit('admin-notification', payload);
      global.io.to('admins').emit('admin-notification', payload);

      // Dedicated event triggers for specialized screen listeners
      if (type === 'kyc_submission') {
        global.io.to('admin').emit('newKYCSubmission', payload);
        global.io.to('admins').emit('newKYCSubmission', payload);
      } else if (type === 'incident_report') {
        global.io.to('admin').emit('newIncidentReport', payload);
        global.io.to('admins').emit('newIncidentReport', payload);
      } else if (type === 'vehicle_submission') {
        global.io.to('admin').emit('newVehicleSubmission', payload);
        global.io.to('admins').emit('newVehicleSubmission', payload);
      } else if (type === 'emergency_sos' || type === 'sos_alert') {
        global.io.to('admin').emit('adminSOSAlert', payload);
        global.io.to('admins').emit('adminSOSAlert', payload);
      }

      // Also deliver directly to each individual admin's personal channel
      for (const admin of admins) {
        global.io.to(`user-${admin._id}`).emit('admin-notification', payload);
        global.io.to(`user-${admin._id}`).emit('new-notification', payload);
      }
    }

    console.log(`[notifyAdmins] Successfully notified ${admins.length} admin(s): [${type}] ${title}`);
    return true;
  } catch (err) {
    console.error('[notifyAdmins] Error broadcasting admin notification:', err?.message);
    return false;
  }
}

module.exports = { notifyAdmins };
