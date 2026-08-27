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

// ── PUT /api/users/profile/vehicle  — save/add vehicle details ────────
// Supports single vehicle update and adds to multi-vehicle list
router.put('/profile/vehicle', auth, async (req, res) => {
  try {
    const { vehicleNumber, vehicleName, vehicleType } = req.body;

    if (!vehicleNumber?.trim()) {
      return res.status(400).json({ message: 'Vehicle registration number is required' });
    }
    if (!vehicleName?.trim()) {
      return res.status(400).json({ message: 'Vehicle name / model is required' });
    }

    const vn = vehicleNumber.trim().toUpperCase();

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Merge into existing kycDocuments
    user.kycDocuments = {
      ...(user.kycDocuments || {}),
      vehicleNumber: vn,
      vehicleName:   vehicleName.trim(),
    };

    if (!user.vehicles) user.vehicles = [];
    const existingIndex = user.vehicles.findIndex(v => v.vehicleNumber === vn);
    if (existingIndex >= 0) {
      user.vehicles[existingIndex].vehicleName = vehicleName.trim();
      if (vehicleType) user.vehicles[existingIndex].vehicleType = vehicleType;
    } else {
      user.vehicles.push({
        vehicleNumber: vn,
        vehicleName: vehicleName.trim(),
        vehicleType: vehicleType || 'car',
        isDefault: user.vehicles.length === 0,
      });
    }

    await user.save();
    res.json({
      message: 'Vehicle details saved successfully.',
      vehicleNumber: vn,
      vehicleName: vehicleName.trim(),
      vehicles: user.vehicles,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/users/profile/vehicles — get user's registered vehicles ──
router.get('/profile/vehicles', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('vehicles kycDocuments');
    if (!user) return res.status(404).json({ message: 'User not found' });

    let list = user.vehicles || [];
    if (list.length === 0 && user.kycDocuments?.vehicleNumber) {
      list = [{
        vehicleNumber: user.kycDocuments.vehicleNumber,
        vehicleName: user.kycDocuments.vehicleName || 'My Vehicle',
        vehicleType: 'car',
        isDefault: true,
      }];
    }

    res.json(list);
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
