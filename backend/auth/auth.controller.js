const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const https   = require('https');
const User    = require('../users/users.model');
const { validateCollegeEmail } = require('../config/collegeDomains');

// ── In-memory OTP store ────────────────────────────────────────────
const otpStore = new Map();

// ── Send email via Brevo HTTPS API ────────────────────────────────
// Render blocks all outbound SMTP (ports 587 and 465).
// Brevo's transactional email API uses HTTPS on port 443 which
// Render allows. @getbrevo/brevo is already in package.json.
const sendEmailViaBrevo = async ({ to, toName, subject, html }) => {
  const apiKey = (process.env.BREVO_API_KEY || '').trim();
  if (!apiKey) throw new Error('BREVO_API_KEY is not set in environment variables');

  const senderEmail = (process.env.BREVO_SENDER_EMAIL || process.env.SMTP_USER || '').trim();
  if (!senderEmail) throw new Error('No sender email set (BREVO_SENDER_EMAIL or SMTP_USER required)');

  // Use Buffer to correctly compute byte length for Unicode/emoji content
  const bodyStr = JSON.stringify({
    sender:      { name: 'CampusRide', email: senderEmail },
    to:          [{ email: to, name: toName || to }],
    subject,
    htmlContent: html,
  });
  const bodyBuf = Buffer.from(bodyStr, 'utf8');

  console.log('Brevo: sending to', to, 'from', senderEmail, 'key prefix', apiKey.slice(0, 8) + '...');

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.brevo.com',
        path:     '/v3/smtp/email',
        method:   'POST',
        headers: {
          'api-key':        apiKey,
          'Content-Type':   'application/json',
          'Accept':         'application/json',
          'Content-Length': bodyBuf.length,
        },
      },
      res => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          console.log('Brevo response:', res.statusCode, data.slice(0, 200));
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error('Brevo API error ' + res.statusCode + ': ' + data));
          }
        });
      }
    );
    req.on('error', e => { console.error('Brevo request error:', e.message); reject(e); });
    req.setTimeout(20000, () => { req.destroy(new Error('Brevo API request timed out after 20s')); });
    req.write(bodyBuf);
    req.end();
  });
};

// ── Register ──────────────────────────────────────────────────────
const register = async (req, res) => {
  try {
    const {
      name, email, password, phone, role, college,
      aadhar, drivingLicense, collegeIdCard,
      vehiclePhoto, vehicleNumber, vehicleName,
      emergencyContact, adminKey, gender, usn,
      profilePhoto, selfie, deviceId
    } = req.body;

    const effectivePhoto = profilePhoto || selfie || '';

    const { normalizeCollege } = require('../config/collegeDomains');

    if (role === 'admin') {
      const ADMIN_KEY = process.env.ADMIN_KEY;
      if (!ADMIN_KEY || adminKey !== ADMIN_KEY)
        return res.status(403).json({ message: 'Administrative registration is disabled or invalid key provided.' });
    }

    const safeEmail = email.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const blockedUser = await User.findOne({ email: { $regex: new RegExp(`^${safeEmail}$`, 'i') }, blocked: true });
    if (blockedUser) return res.status(403).json({ message: 'This account has been blocked. Contact support.' });

    const blockedPhone = await User.findOne({ phone, blocked: true });
    if (blockedPhone) return res.status(403).json({ message: 'This phone number has been blocked. Contact support.' });

    if (role !== 'admin') {
      const { valid, message } = validateCollegeEmail(email, college, role);
      if (!valid) return res.status(400).json({ message: message || 'Please use your official college email address' });

      // Mandatory selfie verification
      if (!effectivePhoto) {
        return res.status(400).json({ message: 'Live selfie capture is mandatory for account creation. Please take a selfie.' });
      }

      if (!collegeIdCard) {
        return res.status(400).json({ message: 'College ID Card is compulsory for campus registration.' });
      }
    }

    const existing = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
    if (existing) return res.status(400).json({ message: 'User already exists' });

    const hasKycDocs = !!(aadhar || collegeIdCard || drivingLicense || vehicleNumber);
    let kycStatus = 'not_required';
    if (['provider', 'both'].includes(role)) {
      kycStatus = hasKycDocs ? 'pending' : 'not_required';
    } else if (hasKycDocs) {
      kycStatus = 'pending';
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const sessionSeed = crypto.randomBytes(16).toString('hex');

    const vNum = vehicleNumber ? vehicleNumber.toUpperCase().trim() : null;
    const vName = vehicleName ? vehicleName.trim() : 'Vehicle';
    const vType = req.body.vehicleType || 'car';

    const user = new User({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      phone,
      role,
      college: role === 'admin' ? undefined : normalizeCollege(college),
      gender: gender || 'prefer_not_to_say',
      usn: usn || '',
      profilePhoto: effectivePhoto,
      kycStatus,
      kycDocuments: {
        aadhar:         aadhar         || null,
        drivingLicense: drivingLicense || null,
        collegeIdCard:  collegeIdCard  || null,
        selfie:         effectivePhoto || null,
        vehiclePhoto:   vehiclePhoto   || null,
        vehicleNumber:  vNum,
        vehicleName:    vNum ? vName : null,
        vehicleType:    vNum ? vType : null,
        vehicleStatus:  vNum ? 'pending' : null,
        vehicleSubmittedAt: vNum ? new Date() : undefined,
      },
      vehicles: vNum ? [{
        vehicleNumber: vNum,
        vehicleName: vName,
        vehicleType: vType,
        status: 'pending',
        isDefault: true,
      }] : [],
      kycSubmittedAt: hasKycDocs ? new Date() : undefined,
      emergencyContact: emergencyContact || '',
      currentSessionSeed: sessionSeed,
      activeDeviceId: deviceId || null,
      isLoggedIn: true,
    });

    await user.save();

    // If the user registered with a custom college name, record it and notify admin
    if (user.college && role !== 'admin') {
      try {
        const College = require('../colleges/colleges.model');
        const Notification = require('../notifications/notifications.model');
        const trimmedCollege = user.college.trim();
        const existingApproved = await College.findOne({
          name: { $regex: new RegExp(`^${trimmedCollege.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
          status: 'approved'
        });

        const isCustom = Boolean(req.body.isCustomCollege);
        if (isCustom || !existingApproved) {
          await College.findOneAndUpdate(
            { name: { $regex: new RegExp(`^${trimmedCollege.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
            {
              $setOnInsert: {
                name: trimmedCollege,
                rawRequestedName: trimmedCollege,
                status: 'pending',
                requestedBy: user._id,
                requestedByName: user.name,
                requestedByEmail: user.email,
              }
            },
            { upsert: true, new: true }
          );

          const adminUsers = await User.find({ role: 'admin' }).select('_id');
          for (const adm of adminUsers) {
            await Notification.create({
              userId: adm._id,
              userType: 'admin',
              type: 'NEW_COLLEGE_REQUEST',
              title: '🏫 New College Added by User',
              message: `${user.name} (${user.email}) registered with custom college: "${trimmedCollege}". Please review, standardize the name, and add it to the directory.`,
              data: {
                collegeName: trimmedCollege,
                userId: user._id,
                userEmail: user.email,
              }
            });
          }
        }
      } catch (colErr) {
        console.error('Error logging new custom college request:', colErr.message);
      }
    }

    const token = jwt.sign(
      { userId: user._id, sessionSeed, deviceId: user.activeDeviceId },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id, name: user.name, email: user.email,
        role: user.role, college: user.college, phone: user.phone,
        emergencyContact: user.emergencyContact || '',
        usn: user.usn || '',
        gender: user.gender, profilePhoto: user.profilePhoto, kycStatus: user.kycStatus,
        activeDeviceId: user.activeDeviceId, isLoggedIn: user.isLoggedIn
      }
    });
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ── Login ─────────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password, deviceId, forceLogout } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required' });

    const user = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
    if (!user) return res.status(400).json({ message: 'No account found with this email. Please register first.' });
    if (user.blocked) return res.status(403).json({ message: `Your account has been blocked. Reason: ${user.blockReason}.` });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Incorrect password. Please try again.' });

    // ── Single-Device Login Enforcement ────────────────────────────
    // If the account is already logged into another device, block login.
    if (user.role !== 'admin' && !forceLogout) {
      if (user.isLoggedIn && user.activeDeviceId && deviceId && user.activeDeviceId !== deviceId) {
        return res.status(403).json({
          code: 'ACTIVE_SESSION_EXISTS',
          message: 'This account is already logged in on another device. Please log out from that device first.'
        });
      }
    }

    const sessionSeed = crypto.randomBytes(16).toString('hex');
    user.currentSessionSeed = sessionSeed;
    user.isLoggedIn = true;
    if (deviceId) {
      user.activeDeviceId = deviceId;
    }
    await user.save();

    const token = jwt.sign(
      { userId: user._id, sessionSeed, deviceId: user.activeDeviceId },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id, name: user.name, email: user.email,
        role: user.role, college: user.college, phone: user.phone,
        emergencyContact: user.emergencyContact || '',
        usn: user.usn || '',
        gender: user.gender, kycStatus: user.kycStatus, profilePhoto: user.profilePhoto,
        activeDeviceId: user.activeDeviceId, isLoggedIn: user.isLoggedIn
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── Logout ────────────────────────────────────────────────────────
const logout = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user) {
      user.isLoggedIn = false;
      user.activeDeviceId = null;
      user.currentSessionSeed = crypto.randomBytes(16).toString('hex');
      user.pushToken = null;
      user.pushPlatform = null;
      await user.save();
    }
    res.json({ success: true, message: 'Logged out successfully' });
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

// ── Send OTP (Cryptographically secure, rate-limited, enumeration-protected) ──
const sendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') return res.status(400).json({ message: 'Valid email is required' });

    const normalizedEmail = email.trim().toLowerCase();
    const safeEmail = normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // ── Resend cooldown: 60 seconds ──────────────────────────────
    const existing = otpStore.get(normalizedEmail);
    if (existing && existing.requestedAt && (Date.now() - existing.requestedAt < 60000)) {
      const remainingSec = Math.ceil((60000 - (Date.now() - existing.requestedAt)) / 1000);
      return res.status(429).json({ message: `Please wait ${remainingSec} second(s) before requesting a new OTP.` });
    }

    const user = await User.findOne({ email: { $regex: new RegExp(`^${safeEmail}$`, 'i') } });
    if (!user) {
      // Generic success response to prevent account enumeration
      return res.json({ message: 'If an account exists with this email, a verification OTP has been sent. Valid for 10 minutes.' });
    }

    // Cryptographically secure 6-digit OTP (100000 to 999999)
    const otp = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    otpStore.set(normalizedEmail, {
      otp,
      expiresAt,
      userId: user._id,
      attempts: 0,
      requestedAt: Date.now()
    });

    try {
      await sendEmailViaBrevo({
        to:      normalizedEmail,
        toName:  user.name,
        subject: 'HOGO — Password Reset Verification Code',
        html: '<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#07090d;color:#fff;border-radius:12px;padding:32px;">' +
              '<div style="font-size:24px;font-weight:900;margin-bottom:8px;letter-spacing:1px;">HO<span style="color:#f5a623;">GO</span></div>' +
              '<h2 style="color:#f5a623;margin-top:0;">Password Reset Verification</h2>' +
              '<p style="color:#aaa;">Hi ' + user.name + ',</p>' +
              '<p style="color:#aaa;">Your single-use verification code to securely reset your HOGO account password is:</p>' +
              '<div style="background:#1a1d24;border:2px solid #f5a623;border-radius:10px;text-align:center;padding:24px;margin:20px 0;">' +
              '<span style="font-size:40px;font-weight:900;letter-spacing:12px;color:#f5a623;">' + otp + '</span>' +
              '</div>' +
              '<p style="color:#aaa;font-size:13px;">Valid for <strong style="color:#fff;">10 minutes</strong>. Never share this code with anyone.</p>' +
              '<p style="color:#555;font-size:12px;margin-top:24px;">If you did not initiate this request, your account remains secure and you can disregard this email.</p>' +
              '</div>',
      });
      res.json({ message: 'Verification OTP sent to your email. Valid for 10 minutes.' });
    } catch (mailErr) {
      console.error('Email delivery error:', mailErr.message);
      return res.status(500).json({
        message: 'Could not send verification email. Please try again later.'
      });
    }
  } catch (error) {
    console.error('sendOtp error:', error.message);
    res.status(500).json({ message: 'Internal server error processing OTP request' });
  }
};

// ── Verify OTP (Brute-force protected: max 5 attempts) ─────────────
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required' });

    const normalizedEmail = email.trim().toLowerCase();
    const record = otpStore.get(normalizedEmail);

    if (!record) {
      return res.status(400).json({ message: 'No active OTP request found for this email. Please request a new one.' });
    }

    if (Date.now() > record.expiresAt) {
      otpStore.delete(normalizedEmail);
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }

    record.attempts = (record.attempts || 0) + 1;

    if (record.attempts > 5) {
      otpStore.delete(normalizedEmail);
      return res.status(429).json({ message: 'Too many incorrect attempts. This OTP has been invalidated. Please request a new code.' });
    }

    if (record.otp !== otp.toString().trim()) {
      const remaining = Math.max(0, 5 - record.attempts);
      return res.status(400).json({ message: `Incorrect OTP. ${remaining} attempt(s) remaining.` });
    }

    // Cryptographically secure single-use reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    otpStore.set(`reset:${resetToken}`, {
      email: normalizedEmail,
      userId: record.userId,
      expiresAt: Date.now() + 15 * 60 * 1000 // 15 mins
    });
    otpStore.delete(normalizedEmail);

    res.json({ message: 'OTP verified successfully', resetToken });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── Reset Password with token or verified OTP ─────────────────────
const resetPasswordWithToken = async (req, res) => {
  try {
    const resetToken = req.body.resetToken || req.body.token;
    const newPwd     = req.body.password || req.body.newPassword;
    const { email, otp } = req.body;

    if (!newPwd || typeof newPwd !== 'string' || newPwd.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long' });
    }

    let targetEmail = null;

    if (resetToken) {
      const record = otpStore.get(`reset:${resetToken}`);
      if (!record) return res.status(400).json({ message: 'Invalid or expired password reset session. Please start over.' });
      if (Date.now() > record.expiresAt) {
        otpStore.delete(`reset:${resetToken}`);
        return res.status(400).json({ message: 'Password reset session expired. Please start over.' });
      }
      targetEmail = record.email;
      otpStore.delete(`reset:${resetToken}`); // Single-use consumption
    } else if (email && otp) {
      const normalizedEmail = email.trim().toLowerCase();
      const record = otpStore.get(normalizedEmail);
      if (!record) return res.status(400).json({ message: 'No active OTP request found for this email. Please request a new code.' });
      if (Date.now() > record.expiresAt) {
        otpStore.delete(normalizedEmail);
        return res.status(400).json({ message: 'OTP expired. Please request a new one.' });
      }

      record.attempts = (record.attempts || 0) + 1;
      if (record.attempts > 5) {
        otpStore.delete(normalizedEmail);
        return res.status(429).json({ message: 'Too many incorrect attempts. Please request a new OTP.' });
      }

      if (record.otp !== otp.toString().trim()) {
        const remaining = Math.max(0, 5 - record.attempts);
        return res.status(400).json({ message: `Incorrect OTP. ${remaining} attempt(s) remaining.` });
      }
      targetEmail = normalizedEmail;
      otpStore.delete(normalizedEmail); // Single-use consumption
    } else {
      return res.status(400).json({ message: 'Reset token or verified OTP with email is required' });
    }

    const safeTargetEmail = targetEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const user = await User.findOne({ email: { $regex: new RegExp(`^${safeTargetEmail}$`, 'i') } });
    if (!user) return res.status(404).json({ message: 'User account not found.' });

    // Hash password securely
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPwd, salt);

    // Invalidate all existing sessions and refresh tokens
    user.currentSessionSeed = crypto.randomBytes(16).toString('hex');
    user.isLoggedIn = false;
    user.activeDeviceId = null;
    await user.save();

    res.json({ message: 'Password reset successfully. All active sessions have been invalidated. You can now log in.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// ── Contact Support — sends message via Brevo to support email ───
const contactSupport = async (req, res) => {
  try {
    const { fromName, fromEmail, college, role, subject, message } = req.body;
    if (!subject?.trim() || !message?.trim()) {
      return res.status(400).json({ message: 'Subject and message are required' });
    }

    const apiKey = (process.env.BREVO_API_KEY || '').trim();
    const senderEmail = (process.env.BREVO_SENDER_EMAIL || process.env.SMTP_USER || '').trim();
    const supportEmail = process.env.SUPPORT_EMAIL || 'juhiij21@gmail.com';

    if (!apiKey || !senderEmail) {
      return res.status(500).json({ message: 'Email service not configured' });
    }

    const html = '<div style="font-family:Arial,sans-serif;padding:20px;">' +
      '<h2 style="color:#f5a623;">HOGO Support Request</h2>' +
      '<table style="width:100%;border-collapse:collapse;">' +
      '<tr><td style="padding:6px;color:#888;width:120px;">From</td><td style="padding:6px;color:#fff;">' + fromName + ' (' + fromEmail + ')</td></tr>' +
      '<tr><td style="padding:6px;color:#888;">College</td><td style="padding:6px;color:#fff;">' + (college || '—') + '</td></tr>' +
      '<tr><td style="padding:6px;color:#888;">Role</td><td style="padding:6px;color:#fff;">' + (role || '—') + '</td></tr>' +
      '<tr><td style="padding:6px;color:#888;">Subject</td><td style="padding:6px;color:#fff;font-weight:bold;">' + subject + '</td></tr>' +
      '</table>' +
      '<div style="margin-top:16px;padding:16px;background:#1a1d24;border-radius:8px;">' +
      '<p style="color:#aaa;white-space:pre-wrap;">' + message.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</p>' +
      '</div></div>';

    const bodyStr = JSON.stringify({
      sender:      { name: 'HOGO Support', email: senderEmail },
      to:          [{ email: supportEmail, name: 'HOGO Support' }],
      replyTo:     { email: fromEmail, name: fromName },
      subject:     '[HOGO Support] ' + subject,
      htmlContent: html,
    });
    const bodyBuf = Buffer.from(bodyStr, 'utf8');

    const https = require('https');
    await new Promise((resolve, reject) => {
      const req2 = https.request({
        hostname: 'api.brevo.com',
        path:     '/v3/smtp/email',
        method:   'POST',
        headers: {
          'api-key':        apiKey,
          'Content-Type':   'application/json',
          'Accept':         'application/json',
          'Content-Length': bodyBuf.length,
        },
      }, res2 => {
        let data = '';
        res2.on('data', c => { data += c; });
        res2.on('end', () => {
          if (res2.statusCode >= 200 && res2.statusCode < 300) resolve(data);
          else reject(new Error('Brevo error ' + res2.statusCode + ': ' + data));
        });
      });
      req2.on('error', reject);
      req2.setTimeout(15000, () => req2.destroy(new Error('Timeout')));
      req2.write(bodyBuf);
      req2.end();
    });

    console.log('✅ Support message sent from ' + fromEmail);
    res.json({ message: 'Support message sent successfully' });
  } catch (err) {
    console.error('contactSupport error:', err.message);
    res.status(500).json({ message: 'Failed to send: ' + err.message });
  }
};

module.exports = { register, login, logout, getMe, sendOtp, verifyOtp, resetPasswordWithToken, contactSupport };
