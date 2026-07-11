const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const controller = require('./users.controller');

router.get('/profile', auth, controller.getProfile);
router.put('/profile', auth, controller.updateProfile);

module.exports = router;