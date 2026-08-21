const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const controller = require('./auth.controller');

router.post('/register', controller.register);
router.post('/login', controller.login);
router.get('/me', auth, controller.getMe);

// OTP-based password reset flow
router.post('/send-otp',            controller.sendOtp);
router.post('/forgot-password',     controller.sendOtp); // alias for mobile
router.post('/verify-otp',          controller.verifyOtp);
router.post('/reset-password-otp',  controller.resetPasswordWithToken);
router.post('/reset-password',      controller.resetPasswordWithToken); // alias for mobile

// Legacy
router.post('/reset-password-direct', controller.resetPasswordDirect);

router.post("/contact-support", controller.contactSupport);

module.exports = router;