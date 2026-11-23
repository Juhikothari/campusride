// backend/kyc/kyc.controller.js
// Production-Grade KYC Architecture with Private Storage, Magic-Byte Validation, and Audit Logging
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { notifyAdmins } = require('../notifications/notifications.helper');
const User = require('../users/users.model');

// Private storage directory outside public web root
const KYC_STORAGE_DIR = path.resolve(__dirname, '../uploads/kyc_private');
if (!fs.existsSync(KYC_STORAGE_DIR)) {
  fs.mkdirSync(KYC_STORAGE_DIR, { recursive: true, mode: 0o700 });
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Validates image buffer using magic bytes (file signature)
 * Returns { valid: boolean, mime: string, ext: string, reason?: string }
 */
function validateImageSignature(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    return { valid: false, reason: 'Missing or invalid file buffer' };
  }
  if (buffer.length < 12) {
    return { valid: false, reason: 'File buffer too small to be a valid image' };
  }
  if (buffer.length > MAX_FILE_SIZE) {
    return { valid: false, reason: `File size exceeds maximum allowed limit of 5MB (${(buffer.length / (1024 * 1024)).toFixed(2)}MB)` };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { valid: true, mime: 'image/jpeg', ext: 'jpg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
    buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A
  ) {
    return { valid: true, mime: 'image/png', ext: 'png' };
  }

  // WebP: RIFF (bytes 0..3) + WEBP (bytes 8..11)
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return { valid: true, mime: 'image/webp', ext: 'webp' };
  }

  return { valid: false, reason: 'Unsupported file type. Only genuine JPEG, PNG, and WebP images are permitted.' };
}

/**
 * Saves validated image buffer to private storage directory
 * Returns stored relative reference string
 */
function savePrivateKycFile(buffer, ext) {
  const filename = `${crypto.randomUUID()}.${ext}`;
  const filePath = path.join(KYC_STORAGE_DIR, filename);
  fs.writeFileSync(filePath, buffer, { mode: 0o600 });
  return `private://kyc_private/${filename}`;
}

/**
 * Safely parse and store base64 data URI to private storage
 */
function processDocumentPayload(dataUriOrKey) {
  if (!dataUriOrKey || typeof dataUriOrKey !== 'string') {
    return { valid: false, reason: 'Document payload is empty or not a string' };
  }

  // Reject arbitrary external URLs to prevent SSRF and unvetted hosting
  if (dataUriOrKey.startsWith('http://') || dataUriOrKey.startsWith('https://')) {
    return { valid: false, reason: 'Arbitrary external URLs are not permitted. Please upload file directly.' };
  }

  // Already stored in private storage
  if (dataUriOrKey.startsWith('private://kyc_private/')) {
    return { valid: true, storedRef: dataUriOrKey };
  }

  // Process data URI
  const matches = dataUriOrKey.match(/^data:image\/(?:jpeg|png|webp|jpg);base64,(.+)$/);
  if (!matches || !matches[1]) {
    return { valid: false, reason: 'Document must be a valid base64 image data URI' };
  }

  const buffer = Buffer.from(matches[1], 'base64');
  const sig = validateImageSignature(buffer);
  if (!sig.valid) {
    return { valid: false, reason: sig.reason };
  }

  const storedRef = savePrivateKycFile(buffer, sig.ext);
  return { valid: true, storedRef, mime: sig.mime };
}

// Multer-based multipart file upload for direct private storage
exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { docType } = req.body;
    const validDocTypes = ['collegeIdCard', 'drivingLicense', 'aadhar', 'selfie', 'vehiclePhoto'];
    if (docType && !validDocTypes.includes(docType)) {
      return res.status(400).json({ message: 'Invalid docType specified' });
    }

    const sig = validateImageSignature(req.file.buffer);
    if (!sig.valid) {
      return res.status(400).json({ message: sig.reason });
    }

    const storedRef = savePrivateKycFile(req.file.buffer, sig.ext);

    res.status(201).json({
      message: 'Document uploaded securely to private storage',
      storedRef,
      mime: sig.mime,
      size: req.file.buffer.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Submit KYC
exports.submitKyc = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { aadharUrl, drivingLicenseUrl, collegeIdCardUrl, selfieUrl, vehiclePhotoUrl, vehicleNumber } = req.body;

    if (!collegeIdCardUrl) {
      return res.status(400).json({ message: "College ID document is required" });
    }
    if (!selfieUrl) {
      return res.status(400).json({ message: "Live selfie verification photo is mandatory" });
    }

    // Process and validate College ID
    const collegeIdProc = processDocumentPayload(collegeIdCardUrl);
    if (!collegeIdProc.valid) {
      return res.status(400).json({ message: `College ID rejected: ${collegeIdProc.reason}` });
    }

    // Process and validate Selfie
    const selfieProc = processDocumentPayload(selfieUrl);
    if (!selfieProc.valid) {
      return res.status(400).json({ message: `Selfie photo rejected: ${selfieProc.reason}` });
    }

    // Process Aadhar if provided
    let aadharStored = null;
    if (aadharUrl) {
      const aadharProc = processDocumentPayload(aadharUrl);
      if (!aadharProc.valid) {
        return res.status(400).json({ message: `Aadhar document rejected: ${aadharProc.reason}` });
      }
      aadharStored = aadharProc.storedRef;
    }

    // Process Driving License for Providers
    const isProvider = ['provider', 'both'].includes(user.role);
    let licenseStored = null;
    if (drivingLicenseUrl) {
      const licenseProc = processDocumentPayload(drivingLicenseUrl);
      if (!licenseProc.valid) {
        return res.status(400).json({ message: `Driving License rejected: ${licenseProc.reason}` });
      }
      licenseStored = licenseProc.storedRef;
    } else if (isProvider) {
      return res.status(400).json({ message: "Driving license is mandatory for ride providers" });
    }

    const cleanVNum = vehicleNumber ? vehicleNumber.toUpperCase().replace(/[\s-]/g, '') : null;
    if (cleanVNum && !/^[A-Z]{2}[0-9]{1,2}[A-Z]{0,4}[0-9]{3,5}$/.test(cleanVNum)) {
      return res.status(400).json({ message: "Enter a valid vehicle registration number" });
    }

    const vNum = isProvider && vehicleNumber ? vehicleNumber.toUpperCase().trim() : null;
    const vName = isProvider && req.body.vehicleName ? req.body.vehicleName.trim() : 'Vehicle';
    const vType = isProvider && req.body.vehicleType ? req.body.vehicleType : 'car';

    user.kycDocuments = {
      aadhar: aadharStored,
      drivingLicense: isProvider ? licenseStored : null,
      collegeIdCard: collegeIdProc.storedRef,
      selfie: selfieProc.storedRef,
      vehiclePhoto: null,
      vehicleNumber: vNum,
      vehicleName: vName,
      vehicleType: vType,
      vehicleStatus: 'pending',
      vehicleSubmittedAt: new Date(),
    };

    if (vNum) {
      if (!user.vehicles) user.vehicles = [];
      const vIdx = user.vehicles.findIndex(v => v.vehicleNumber === vNum);
      if (vIdx >= 0) {
        user.vehicles[vIdx].vehicleName = vName;
        user.vehicles[vIdx].vehicleType = vType;
      } else {
        user.vehicles.push({
          vehicleNumber: vNum,
          vehicleName: vName,
          vehicleType: vType,
          status: 'pending',
          isDefault: user.vehicles.length === 0,
        });
      }
    }

    user.kycStatus = 'pending';
    user.kycSubmittedAt = new Date();
    
    // Add audit log
    if (!user.kycAuditLogs) user.kycAuditLogs = [];
    user.kycAuditLogs.push({
      action: 'submitted',
      performedBy: user._id,
      timestamp: new Date(),
      ip: req.ip,
      notes: `KYC submitted with documents stored in private repository`
    });

    await user.save();

    // Notify administrators of new KYC submission
    notifyAdmins({
      title: '🛡️ New KYC Document Submission',
      message: `${user.name || 'Student'} (${user.college || 'Campus'}) submitted KYC documents for review.`,
      type: 'kyc_submission',
      data: {
        userId: user._id,
        name: user.name,
        college: user.college,
        role: user.role,
        kycStatus: user.kycStatus,
      },
      priority: 'high',
    }).catch(e => console.log('Admin KYC notif error:', e));

    res.json({
      message: "KYC submitted successfully. Waiting for admin approval.",
      kycStatus: user.kycStatus,
      documents: {
        hasCollegeId: !!user.kycDocuments.collegeIdCard,
        hasSelfie: !!user.kycDocuments.selfie,
        hasDrivingLicense: !!user.kycDocuments.drivingLicense,
        hasAadhar: !!user.kycDocuments.aadhar,
        vehicleNumber: user.kycDocuments.vehicleNumber,
        vehicleType: user.kycDocuments.vehicleType
      }
    });

  } catch (error) {
    console.error('KYC submit error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get KYC Status and Documents
exports.getKycStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select("kycStatus kycDocuments role kycSubmittedAt kycVerifiedAt");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      role: user.role,
      kycStatus: user.kycStatus,
      documents: user.kycDocuments,
      submittedAt: user.kycSubmittedAt,
      verifiedAt: user.kycVerifiedAt
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Admin: Get all pending KYCs
exports.getPendingKyc = async (req, res) => {
  try {
    const pending = await User.find({ 
      $or: [
        { kycStatus: 'pending' },
        { 'kycDocuments.vehicleStatus': 'pending' },
        { 'vehicles.status': 'pending' }
      ]
    }).select('name email role kycDocuments kycSubmittedAt vehicleNumber vehicles phone college usn');
    
    res.json(pending);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Admin: Approve/Reject KYC
exports.reviewKyc = async (req, res) => {
  try {
    const { userId, status, remarks } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.kycStatus = status;
    user.kycRemarks = remarks || '';
    user.kycVerifiedAt = new Date();

    if (status === 'approved') {
      if (user.kycDocuments) user.kycDocuments.vehicleStatus = 'approved';
      if (user.vehicles && Array.isArray(user.vehicles)) {
        user.vehicles.forEach(v => { v.status = 'approved'; });
      }
    } else {
      if (user.kycDocuments) user.kycDocuments.vehicleStatus = 'rejected';
      if (user.vehicles && Array.isArray(user.vehicles)) {
        user.vehicles.forEach(v => { v.status = 'rejected'; });
      }
    }

    if (!user.kycAuditLogs) user.kycAuditLogs = [];
    user.kycAuditLogs.push({
      action: `review_${status}`,
      performedBy: req.user.userId,
      timestamp: new Date(),
      ip: req.ip,
      notes: remarks || `Admin marked KYC as ${status}`
    });

    await user.save();

    res.json({
      message: `KYC ${status}`,
      user: {
        id: user._id,
        name: user.name,
        kycStatus: user.kycStatus
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Generate short-lived signed access link (max 15 mins expiry)
exports.getSignedDocumentUrl = async (req, res) => {
  try {
    const { userId, docType } = req.params;
    const requesterId = req.user.userId;

    const requester = await User.findById(requesterId).select('role blocked suspended currentSessionSeed');
    if (!requester || requester.blocked || requester.suspended) {
      return res.status(403).json({ message: 'Account is restricted or inactive' });
    }

    const isOwner = requesterId.toString() === userId.toString();
    const isAdmin = requester.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Access denied: You are not authorized to request signed links for this document.' });
    }

    // Generate 15-minute expiring token
    const token = jwt.sign(
      {
        userId: requester._id.toString(),
        targetUserId: userId,
        docType,
        purpose: 'kyc_document_access',
        sessionSeed: requester.currentSessionSeed
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m', algorithm: 'HS256' }
    );

    const signedUrl = `/api/kyc/document/${userId}/${docType}?token=${token}`;
    res.json({
      signedUrl,
      expiresInSeconds: 900,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Serve KYC document image (strictly authorized: owner or verified admin)
exports.getDocumentImage = async (req, res) => {
  try {
    const { userId, docType } = req.params;

    const validDocTypes = ['aadhar', 'collegeIdCard', 'drivingLicense', 'selfie', 'vehiclePhoto'];
    if (!validDocTypes.includes(docType)) {
      return res.status(400).json({ message: 'Invalid document type' });
    }

    // Object-level authorization: caller must be document owner OR verified admin
    const requesterId = req.user?.userId || req.user?.id;
    if (!requesterId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const requester = await User.findById(requesterId).select('role blocked suspended');
    if (!requester || requester.blocked || requester.suspended) {
      return res.status(403).json({ message: 'Account is restricted or inactive' });
    }

    const isOwner = requesterId.toString() === userId.toString();
    const isReqAdmin = requester.role === 'admin';

    if (!isOwner && !isReqAdmin) {
      return res.status(403).json({ message: 'Access denied: You are not authorized to access this document.' });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser || !targetUser.kycDocuments || !targetUser.kycDocuments[docType]) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const fileRef = targetUser.kycDocuments[docType];

    // Log document access to audit trail
    if (!targetUser.kycAuditLogs) targetUser.kycAuditLogs = [];
    targetUser.kycAuditLogs.push({
      action: 'document_accessed',
      docType,
      performedBy: requesterId,
      timestamp: new Date(),
      ip: req.ip,
      notes: `Accessed by ${isReqAdmin ? 'Admin' : 'Owner'}`
    });
    await targetUser.save();

    // Support legacy Cloudinary references (redirect)
    if (fileRef.startsWith('https://res.cloudinary.com/')) {
      return res.redirect(302, fileRef);
    }

    // Serve from private storage
    if (fileRef.startsWith('private://kyc_private/')) {
      const relativeName = fileRef.replace('private://kyc_private/', '');
      const safePath = path.resolve(KYC_STORAGE_DIR, path.basename(relativeName));
      
      // Prevent directory traversal
      if (!safePath.startsWith(KYC_STORAGE_DIR) || !fs.existsSync(safePath)) {
        return res.status(404).json({ message: 'Private document file not found on disk' });
      }

      const buffer = fs.readFileSync(safePath);
      const sig = validateImageSignature(buffer);
      const contentType = sig.valid ? sig.mime : 'application/octet-stream';

      res.set('Content-Type', contentType);
      res.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      res.set('X-Content-Type-Options', 'nosniff');
      res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
      return res.send(buffer);
    }

    // Serve base64 data URI directly (backward compatibility for legacy submissions)
    if (fileRef.startsWith('data:image/')) {
      const matches = fileRef.match(/^data:image\/([A-Za-z-+]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const contentType = `image/${matches[1]}`;
        const buffer = Buffer.from(matches[2], 'base64');
        res.set('Content-Type', contentType);
        res.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        res.set('X-Content-Type-Options', 'nosniff');
        res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
        return res.send(buffer);
      }
    }

    return res.status(400).json({ message: 'Invalid or corrupted document format' });

  } catch (error) {
    console.error('Error serving document:', error);
    res.status(500).json({ error: error.message });
  }
};

// Secure document deletion
exports.deleteDocument = async (req, res) => {
  try {
    const { userId, docType } = req.params;
    const requesterId = req.user.userId;

    const requester = await User.findById(requesterId).select('role blocked suspended');
    if (!requester || requester.blocked || requester.suspended) {
      return res.status(403).json({ message: 'Account is restricted' });
    }

    const isOwner = requesterId.toString() === userId.toString();
    const isAdmin = requester.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Access denied: You cannot delete this document.' });
    }

    const user = await User.findById(userId);
    if (!user || !user.kycDocuments || !user.kycDocuments[docType]) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const fileRef = user.kycDocuments[docType];
    if (fileRef.startsWith('private://kyc_private/')) {
      const filename = path.basename(fileRef.replace('private://kyc_private/', ''));
      const filePath = path.join(KYC_STORAGE_DIR, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    user.kycDocuments[docType] = null;
    if (!user.kycAuditLogs) user.kycAuditLogs = [];
    user.kycAuditLogs.push({
      action: 'document_deleted',
      docType,
      performedBy: requesterId,
      timestamp: new Date(),
      ip: req.ip
    });
    await user.save();

    res.json({ message: `Document ${docType} deleted securely` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
