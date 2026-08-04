// backend/users/users.routes.js
const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const User    = require('./users.model');

// ── GET /api/users/profile  — view own full profile ───────────────
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select('-password -currentSessionSeed');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const PHONE_COOLDOWN_DAYS = 90;
    let phoneChangeCooldownDaysLeft = 0;
    if (user.phoneLastUpdatedAt) {
      const daysSince = (Date.now() - new Date(user.phoneLastUpdatedAt).getTime()) / (1000 * 60 * 60 * 24);
      phoneChangeCooldownDaysLeft = Math.max(0, Math.ceil(PHONE_COOLDOWN_DAYS - daysSince));
    }

    res.json({
      ...user.toObject(),
      canChangePhone: phoneChangeCooldownDaysLeft === 0,
      phoneChangeCooldownDaysLeft,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/users/profile/phone  — update phone (90-day throttle) ─
router.put('/profile/phone', auth, async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || !/^\d{10}$/.test(phone.replace(/\s/g, ''))) {
      return res.status(400).json({ message: 'Please provide a valid 10-digit phone number.' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const PHONE_COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000;
    if (user.phoneLastUpdatedAt) {
      const elapsed = Date.now() - new Date(user.phoneLastUpdatedAt).getTime();
      if (elapsed < PHONE_COOLDOWN_MS) {
        const daysLeft = Math.ceil((PHONE_COOLDOWN_MS - elapsed) / (1000 * 60 * 60 * 24));
        return res.status(429).json({
          message: `You can only update your phone number once every 90 days. Try again in ${daysLeft} day(s).`,
          daysLeft,
        });
      }
    }

    user.phone = phone.replace(/\s/g, '');
    user.phoneLastUpdatedAt = new Date();
    await user.save();

    res.json({ message: 'Phone number updated successfully.', phone: user.phone });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/users/profile/vehicle  — save vehicle details ────────
// Called by VehicleDetailsGate in CreateRide when provider skipped
// vehicle info at registration. Safe to call multiple times.
router.put('/profile/vehicle', auth, async (req, res) => {
  try {
    const { vehicleNumber, vehicleName, vehicleType } = req.body;

    if (!vehicleNumber?.trim()) {
      return res.status(400).json({ message: 'Vehicle registration number is required' });
    }
    if (!vehicleName?.trim()) {
      return res.status(400).json({ message: 'Vehicle name / model is required' });
    }

    const vnRegex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/;
    const vn = vehicleNumber.trim().toUpperCase();
    if (!vnRegex.test(vn)) {
      return res.status(400).json({
        message: 'Invalid vehicle number format. Use KA01AB1234 (State + District + Series + Number).'
      });
    }

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Merge into existing kycDocuments — don't wipe other KYC fields
    user.kycDocuments = {
      ...(user.kycDocuments || {}),
      vehicleNumber: vn,
      vehicleName:   vehicleName.trim(),
    };

    // Also store vehicleType at the top level if model supports it
    if (vehicleType) user.vehicleType = vehicleType;

    await user.save();
    res.json({
      message: 'Vehicle details saved successfully.',
      vehicleNumber: vn,
      vehicleName: vehicleName.trim(),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/users/:id  — public profile ──────────────────────────
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('name email phone college role gender usn kycStatus profilePhoto createdAt kycDocuments');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
