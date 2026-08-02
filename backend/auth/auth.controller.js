const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User   = require('../users/users.model');
const { validateCollegeEmail } = require('../config/collegeDomains');

// ── In-memory OTP store (use Redis in production) ─────────────────
const otpStore = new Map(); // key: email, value: { otp, expiresAt }

// ── Nodemailer transporter ─────────────────────────────────────────
// FIX: createTransporter now verifies the connection before returning,
//      and logs detailed SMTP errors so you can see exactly what's wrong.
const createTransporter = async () => {
  const transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465', // true only for port 465
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    // These timeouts prevent hanging indefinitely
    connectionTimeout: 10000,
    greetingTimeout:   10000,
    socketTimeout:     15000,
  });

  // Verify the connection — throws if SMTP creds are wrong
  try {
    await transporter.verify();
    console.log('✅ SMTP transporter verified');
  } catch (err) {
    console.error('❌ SMTP verification failed:', err.message);
    console.error('   SMTP_HOST:', process.env.SMTP_HOST);
    console.error('   SMTP_PORT:', process.env.SMTP_PORT);
    console.error('   SMTP_USER:', process.env.SMTP_USER ? process.env.SMTP_USER.substring(0,4) + '***' : 'NOT SET');
    console.error('   SMTP_PASS:', process.env.SMTP_PASS ? '***set***' : 'NOT SET');
    throw err;
  }
  return transporter;
};

// ── Register ──────────────────────────────────────────────────────
const register = async (req, res) => {
  try {
    const {
      name, email, password, phone, role, college,
      aadhar, drivingLicense, collegeIdCard,
      vehiclePhoto, vehicleNumber, vehicleName,
      emergencyContact, adminKey, gender, usn
    } = req.body;
    
    const { normalizeCollege } = require('../config/collegeDomains');

    if (role === 'admin') {
      const ADMIN_KEY = process.env.ADMIN_KEY || 'freewheel';
      if (adminKey !== ADMIN_KEY) {
        return res.status(403).json({ message: 'Invalid admin key.' });
      }
    }

    const blockedUser = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') }, blocked: true });
    if (blockedUser) return res.status(403).json({ message: 'This account has been blocked. Contact support.' });

    const blockedPhone = await User.findOne({ phone, blocked: true });
    if (blockedPhone) return res.status(403).json({ message: 'This phone number has been blocked. Contact support.' });

    if (role !== 'admin') {
      const { valid, message } = validateCollegeEmail(email, college, role);
      if (!valid) return res.status(400).json({ message: message || 'Please use your official college email address' });
    }

    const existing = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
    if (existing) return res.status(400).json({ message: 'User already exists' });

    const hasKycDocs = !!(aadhar || collegeIdCard || drivingLicense);
    let kycStatus = 'not_required';
    if (['provider', 'both'].includes(role)) {
      kycStatus = hasKycDocs ? 'pending' : 'not_required';
    } else if (hasKycDocs) {
      kycStatus = 'pending';
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate first session token seed
    const sessionSeed = crypto.randomBytes(16).toString('hex');

    const user = new User({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      phone,
      role,
      college: role === 'admin' ? undefined : normalizeCollege(college),
      gender: gender || 'prefer_not_to_say',
      usn: usn || '',
      kycStatus,
      kycDocuments: {
        aadhar:         aadhar         || null,
        drivingLicense: drivingLicense || null,
        collegeIdCard:  collegeIdCard  || null,
        selfie:         null,
        vehiclePhoto:   vehiclePhoto   || null,
        vehicleNumber:  vehicleNumber  ? vehicleNumber.toUpperCase() : null,
        vehicleName:    vehicleName    || null,
      },
      kycSubmittedAt: hasKycDocs ? new Date() : undefined,
      emergencyContact: emergencyContact || '',
      // Single-device: track the current session seed
      currentSessionSeed: sessionSeed,
    });

    await user.save();

    const token = jwt.sign(
      { userId: user._id, sessionSeed },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id, name: user.name, email: user.email,
        role: user.role, college: user.college, phone: user.phone,
        gender: user.gender, kycStatus: user.kycStatus
      }
    });
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ── Login ─────────────────────────────────────────────────────────
// FIX: On every login, rotate sessionSeed → invalidates all previous tokens
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

    const user = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
    if (!user) return res.status(400).json({ message: 'No account found with this email. Please register first.' });
    if (user.blocked) return res.status(403).json({ message: `Your account has been blocked. Reason: ${user.blockReason}.` });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Incorrect password. Please try again.' });

    // Rotate session seed — this invalidates any existing device's token
    const sessionSeed = crypto.randomBytes(16).toString('hex');
    user.currentSessionSeed = sessionSeed;
    await user.save();

    const token = jwt.sign(
      { userId: user._id, sessionSeed },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id, name: user.name, email: user.email,
        role: user.role, college: user.college, phone: user.phone,
        gender: user.gender, kycStatus: user.kycStatus
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── Get current user ──────────────────────────────────────────────
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── Send OTP for password reset ───────────────────────────────────
// FIX: better error messages, async transporter, detailed logging
const sendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
    if (!user) return res.status(404).json({ message: 'No account found with this email.' });

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    otpStore.set(email.toLowerCase(), { otp, expiresAt, userId: user._id });

    // Check if SMTP env vars are set at all
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error('❌ SMTP_USER or SMTP_PASS is not set in .env');
      if (process.env.NODE_ENV !== 'production') {
        console.log(`🔑 DEV OTP for ${email}: ${otp}`);
        return res.json({ message: 'OTP sent to your email. Valid for 10 minutes.' });
      }
      return res.status(500).json({ message: 'Email service is not configured. Contact support.' });
    }

    // Send OTP via email
    try {
      const transporter = await createTransporter();
      const info = await transporter.sendMail({
        from: `"CampusRide" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'CampusRide — Password Reset OTP',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#07090d;color:#fff;border-radius:12px;padding:32px;">
            <div style="font-size:22px;font-weight:800;margin-bottom:8px;">
              Campus<span style="color:#f5a623;">Ride</span>
            </div>
            <h2 style="color:#f5a623;margin-top:0;">Password Reset OTP</h2>
            <p style="color:#aaa;">Hi ${user.name},</p>
            <p style="color:#aaa;">Your one-time password to reset your CampusRide password is:</p>
            <div style="background:#1a1d24;border:2px solid #f5a623;border-radius:10px;text-align:center;padding:24px;margin:20px 0;">
              <span style="font-size:40px;font-weight:900;letter-spacing:12px;color:#f5a623;">${otp}</span>
            </div>
            <p style="color:#aaa;font-size:13px;">This OTP is valid for <strong style="color:#fff;">10 minutes</strong>. Do not share it with anyone.</p>
            <p style="color:#555;font-size:12px;margin-top:24px;">If you didn't request this, please ignore this email.</p>
          </div>
        `,
      });
      console.log(`✅ OTP sent to ${email} — Message ID: ${info.messageId}`);
    } catch (mailErr) {
      console.error('❌ Email send failed:', mailErr.message);
      // In dev, print OTP to console so testing can proceed
      if (process.env.NODE_ENV !== 'production') {
        console.log(`🔑 DEV OTP for ${email}: ${otp}`);
        // Still return success so frontend doesn't block
        return res.json({ message: 'OTP sent to your email. Valid for 10 minutes.' });
      }
      // In production, surface the real error
      return res.status(500).json({
        message: `Failed to send OTP email: ${mailErr.message}. Please check your email address or try again later.`
      });
    }

    res.json({ message: 'OTP sent to your email. Valid for 10 minutes.' });
  } catch (error) {
    console.error('sendOtp error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ── Verify OTP ────────────────────────────────────────────────────
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required' });

    const record = otpStore.get(email.toLowerCase());
    if (!record) return res.status(400).json({ message: 'No OTP requested for this email. Request a new one.' });
    if (Date.now() > record.expiresAt) {
      otpStore.delete(email.toLowerCase());
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }
    if (record.otp !== otp.toString()) return res.status(400).json({ message: 'Incorrect OTP. Please try again.' });

    // OTP is valid — issue a short-lived reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    otpStore.set(`reset:${resetToken}`, { email: email.toLowerCase(), expiresAt: Date.now() + 15 * 60 * 1000 });
    otpStore.delete(email.toLowerCase());

    res.json({ message: 'OTP verified', resetToken });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── Reset Password with token ─────────────────────────────────────
const resetPasswordWithToken = async (req, res) => {
  try {
    const { resetToken, password } = req.body;
    if (!resetToken || !password) return res.status(400).json({ message: 'Reset token and new password are required' });

    const record = otpStore.get(`reset:${resetToken}`);
    if (!record) return res.status(400).json({ message: 'Invalid or expired reset session. Start over.' });
    if (Date.now() > record.expiresAt) {
      otpStore.delete(`reset:${resetToken}`);
      return res.status(400).json({ message: 'Reset session expired. Please start over.' });
    }

    const user = await User.findOne({ email: record.email });
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // Also rotate session seed so all existing device logins are invalidated
    user.currentSessionSeed = crypto.randomBytes(16).toString('hex');
    await user.save();

    otpStore.delete(`reset:${resetToken}`);
    res.json({ message: 'Password reset successfully.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── Legacy direct reset (keep for backward compat) ────────────────
const resetPasswordDirect = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    await user.save();
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { register, login, getMe, sendOtp, verifyOtp, resetPasswordWithToken, resetPasswordDirect };
