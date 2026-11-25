// backend/kyc/kyc.controller.js
// Production-Grade KYC Architecture with Private Storage, Magic-Byte Validation, and Audit Logging
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { notifyAdmins } = require('../notifications/notifications.helper');
const { validateVehicleNumber } = require('../utils/vehicle');
const User = require('../users/users.model');
const KycDocument = require('./kycDocument.model');

// Private storage directory outside public web root with persistent mount support
const KYC_STORAGE_DIR = process.env.KYC_STORAGE_DIR
  ? path.resolve(process.env.KYC_STORAGE_DIR)
  : (fs.existsSync('/data/uploads/kyc_private')
      ? '/data/uploads/kyc_private'
      : path.resolve(__dirname, '../uploads/kyc_private'));

if (!fs.existsSync(KYC_STORAGE_DIR)) {
  fs.mkdirSync(KYC_STORAGE_DIR, { recursive: true, mode: 0o700 });
}

const VALID_DOC_TYPES = ['aadhar', 'collegeIdCard', 'drivingLicense', 'selfie', 'vehiclePhoto'];
const RESOLVED_KYC_DIR = path.resolve(KYC_STORAGE_DIR);

/**
 * Strictly parses a private://kyc_private/<filename> reference and guards against path traversal.
 */
function resolveSafePrivatePath(fileRef) {
  if (!fileRef || typeof fileRef !== 'string') {
    return { valid: false, reason: 'Invalid document reference format' };
  }
  if (fileRef.includes('\0') || fileRef.includes('..') || fileRef.includes('\\')) {
    return { valid: false, reason: 'Unsafe document reference rejected (path traversal attempt)' };
  }
  const match = fileRef.match(/^private:\/\/kyc_private\/([A-Za-z0-9._-]+)$/);
  if (!match || !match[1]) {
    return { valid: false, reason: 'Invalid private storage reference format' };
  }
  const filename = match[1];
  const resolved = path.resolve(RESOLVED_KYC_DIR, filename);
  if (!resolved.startsWith(RESOLVED_KYC_DIR + path.sep) && resolved !== RESOLVED_KYC_DIR) {
    return { valid: false, reason: 'Path escapes private KYC storage boundary' };
  }
  return { valid: true, filename, filePath: resolved };
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
 * Saves validated image buffer to private storage directory using a server-controlled identifier
 * and creates an ownership-bound KycDocument registry record.
 */
async function savePrivateKycFile(buffer, sig, ownerId, docType, initialStatus = 'uploaded') {
  const docId = crypto.randomUUID();
  const safeOwner = String(ownerId).replace(/[^a-fA-F0-9]/g, '').slice(0, 24) || 'user';
  const filename = `${safeOwner}_${docType}_${docId}.${sig.ext}`;
  const filePath = path.resolve(RESOLVED_KYC_DIR, filename);
  if (!filePath.startsWith(RESOLVED_KYC_DIR + path.sep)) {
    throw new Error('Invalid destination storage path');
  }

  fs.writeFileSync(filePath, buffer, { mode: 0o600 });
  if (!fs.existsSync(filePath)) {
    throw new Error('Failed to verify persisted KYC file on disk');
  }

  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const storedRef = `private://kyc_private/${filename}`;

  const docRecord = await KycDocument.create({
    docId,
    ownerId,
    docType,
    storedRef,
    filename,
    sha256,
    mime: sig.mime,
    size: buffer.length,
    status: initialStatus,
    attachedAt: initialStatus === 'attached' ? new Date() : null
  });

  return { storedRef, docId: docRecord.docId, sha256, mime: sig.mime };
}

/**
 * Validates and binds an incoming KYC payload (either ownership-verified private ref or base64 data URI).
 * Strictly prevents cross-account document theft, docType swapping, path traversal, and missing files.
 */
async function validateAndBindDocument(dataUriOrKey, ownerId, docType, reqIp) {
  if (!dataUriOrKey || typeof dataUriOrKey !== 'string') {
    return { valid: false, statusCode: 400, code: 'EMPTY_DOCUMENT', reason: 'Document payload is empty or not a string' };
  }

  if (!VALID_DOC_TYPES.includes(docType)) {
    return { valid: false, statusCode: 400, code: 'INVALID_DOC_TYPE', reason: 'Invalid document type specified' };
  }

  // Reject arbitrary external URLs to prevent SSRF and unvetted hosting
  if (dataUriOrKey.startsWith('http://') || dataUriOrKey.startsWith('https://')) {
    return { valid: false, statusCode: 400, code: 'EXTERNAL_URL_DISALLOWED', reason: 'Arbitrary external URLs are not permitted. Please upload file directly.' };
  }

  // Handle reference to already uploaded private file: MUST pass strict ownership, docType, and disk checks
  if (dataUriOrKey.startsWith('private://')) {
    const safeCheck = resolveSafePrivatePath(dataUriOrKey);
    if (!safeCheck.valid) {
      return { valid: false, statusCode: 400, code: 'INVALID_STORAGE_REF', reason: safeCheck.reason };
    }

    // Look up authoritative ownership record
    const docRecord = await KycDocument.findOne({ storedRef: dataUriOrKey });
    if (!docRecord) {
      return {
        valid: false,
        statusCode: 403,
        code: 'UNVERIFIED_DOCUMENT_REFERENCE',
        reason: 'Document reference is not registered to your account.'
      };
    }

    if (docRecord.status === 'deleted') {
      return {
        valid: false,
        statusCode: 404,
        code: 'DOCUMENT_DELETED',
        reason: 'Document reference has been deleted and cannot be attached.'
      };
    }

    if (docRecord.ownerId.toString() !== ownerId.toString()) {
      return {
        valid: false,
        statusCode: 403,
        code: 'DOCUMENT_OWNERSHIP_VIOLATION',
        reason: 'Access denied: Document reference belongs to another account.'
      };
    }

    if (docRecord.docType !== docType) {
      return {
        valid: false,
        statusCode: 403,
        code: 'DOCUMENT_TYPE_MISMATCH',
        reason: `Document was uploaded for '${docRecord.docType}' and cannot be attached as '${docType}'.`
      };
    }

    // Verify no other user already has this ref attached
    const otherUserHolding = await User.exists({
      _id: { $ne: ownerId },
      $or: [
        { 'kycDocuments.collegeIdCard': dataUriOrKey },
        { 'kycDocuments.drivingLicense': dataUriOrKey },
        { 'kycDocuments.aadhar': dataUriOrKey },
        { 'kycDocuments.selfie': dataUriOrKey },
        { 'kycDocuments.vehiclePhoto': dataUriOrKey }
      ]
    });
    if (otherUserHolding) {
      return {
        valid: false,
        statusCode: 403,
        code: 'DOCUMENT_REUSE_FORBIDDEN',
        reason: 'Document reference cannot be reused across accounts.'
      };
    }

    // Verify file physically exists on disk and signature/integrity still hold
    if (!fs.existsSync(safeCheck.filePath)) {
      return {
        valid: false,
        statusCode: 404,
        code: 'DOCUMENT_FILE_MISSING',
        reason: 'Uploaded document file not found in private storage. Please re-upload.'
      };
    }

    const diskBuffer = fs.readFileSync(safeCheck.filePath);
    const sig = validateImageSignature(diskBuffer);
    if (!sig.valid) {
      return { valid: false, statusCode: 400, code: 'CORRUPTED_STORED_FILE', reason: sig.reason };
    }

    // Mark as attached
    if (docRecord.status !== 'attached') {
      docRecord.status = 'attached';
      docRecord.attachedAt = new Date();
      await docRecord.save();
    }

    return { valid: true, storedRef: dataUriOrKey, docId: docRecord.docId };
  }

  // Process inline base64 data URI
  const matches = dataUriOrKey.match(/^data:image\/(?:jpeg|png|webp|jpg);base64,(.+)$/);
  if (!matches || !matches[1]) {
    return { valid: false, statusCode: 400, code: 'INVALID_DATA_URI', reason: 'Document must be a valid base64 image data URI' };
  }

  const buffer = Buffer.from(matches[1], 'base64');
  const sig = validateImageSignature(buffer);
  if (!sig.valid) {
    return { valid: false, statusCode: 400, code: 'INVALID_IMAGE_SIGNATURE', reason: sig.reason };
  }

  const saved = await savePrivateKycFile(buffer, sig, ownerId, docType, 'attached');
  return { valid: true, storedRef: saved.storedRef, docId: saved.docId, mime: saved.mime };
}

// Multer-based multipart file upload for direct private storage (requires authenticated user & valid docType)
exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { docType } = req.body;
    if (!docType || !VALID_DOC_TYPES.includes(docType)) {
      return res.status(400).json({
        message: `Invalid or missing docType. Allowed: ${VALID_DOC_TYPES.join(', ')}`,
        code: 'INVALID_DOC_TYPE'
      });
    }

    const user = await User.findById(userId);
    if (!user || user.blocked || user.suspended) {
      return res.status(403).json({ message: 'Account is restricted or unavailable' });
    }

    const sig = validateImageSignature(req.file.buffer);
    if (!sig.valid) {
      return res.status(400).json({ message: sig.reason });
    }

    const saved = await savePrivateKycFile(req.file.buffer, sig, userId, docType, 'uploaded');

    if (!user.kycAuditLogs) user.kycAuditLogs = [];
    user.kycAuditLogs.push({
      action: 'document_uploaded',
      docType,
      performedBy: userId,
      timestamp: new Date(),
      ip: req.ip,
      notes: `Uploaded ${docType} (${saved.mime}, ${req.file.buffer.length} bytes, docId=${saved.docId})`
    });
    await user.save();

    res.status(201).json({
      message: 'Document uploaded securely to private storage',
      docId: saved.docId,
      docType,
      storedRef: saved.storedRef,
      mime: saved.mime,
      size: req.file.buffer.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to process document upload' });
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

    const recordRejectionAudit = async (docType, proc) => {
      if (proc.statusCode === 403) {
        if (!user.kycAuditLogs) user.kycAuditLogs = [];
        user.kycAuditLogs.push({
          action: 'document_ownership_rejected',
          docType,
          performedBy: user._id,
          timestamp: new Date(),
          ip: req.ip,
          notes: `${proc.code}: ${proc.reason}`
        });
        await user.save().catch(() => {});
      }
    };

    // Process and validate College ID (with strict ownership & type binding)
    const collegeIdProc = await validateAndBindDocument(collegeIdCardUrl, user._id, 'collegeIdCard', req.ip);
    if (!collegeIdProc.valid) {
      await recordRejectionAudit('collegeIdCard', collegeIdProc);
      return res.status(collegeIdProc.statusCode || 400).json({
        message: `College ID rejected: ${collegeIdProc.reason}`,
        code: collegeIdProc.code
      });
    }

    // Process and validate Selfie
    const selfieProc = await validateAndBindDocument(selfieUrl, user._id, 'selfie', req.ip);
    if (!selfieProc.valid) {
      await recordRejectionAudit('selfie', selfieProc);
      return res.status(selfieProc.statusCode || 400).json({
        message: `Selfie photo rejected: ${selfieProc.reason}`,
        code: selfieProc.code
      });
    }

    // Process Aadhar if provided
    let aadharStored = null;
    if (aadharUrl) {
      const aadharProc = await validateAndBindDocument(aadharUrl, user._id, 'aadhar', req.ip);
      if (!aadharProc.valid) {
        await recordRejectionAudit('aadhar', aadharProc);
        return res.status(aadharProc.statusCode || 400).json({
          message: `Aadhar document rejected: ${aadharProc.reason}`,
          code: aadharProc.code
        });
      }
      aadharStored = aadharProc.storedRef;
    }

    // Process Driving License for Providers
    const isProvider = ['provider', 'both'].includes(user.role);
    let licenseStored = null;
    if (drivingLicenseUrl) {
      const licenseProc = await validateAndBindDocument(drivingLicenseUrl, user._id, 'drivingLicense', req.ip);
      if (!licenseProc.valid) {
        await recordRejectionAudit('drivingLicense', licenseProc);
        return res.status(licenseProc.statusCode || 400).json({
          message: `Driving License rejected: ${licenseProc.reason}`,
          code: licenseProc.code
        });
      }
      licenseStored = licenseProc.storedRef;
    } else if (isProvider) {
      return res.status(400).json({ message: "Driving license is mandatory for ride providers" });
    }

    // Audit document replacements and mark superseded KycDocument records as replaced
    const prevDocs = user.kycDocuments || {};
    const newDocRefs = {
      collegeIdCard: collegeIdProc.storedRef,
      selfie: selfieProc.storedRef,
      aadhar: aadharStored,
      drivingLicense: isProvider ? licenseStored : null
    };

    if (!user.kycAuditLogs) user.kycAuditLogs = [];
    for (const dt of ['collegeIdCard', 'selfie', 'aadhar', 'drivingLicense']) {
      const oldRef = prevDocs[dt];
      const newRef = newDocRefs[dt];
      if (oldRef && newRef && oldRef !== newRef) {
        await KycDocument.updateOne(
          { storedRef: oldRef, ownerId: user._id },
          { $set: { status: 'replaced' } }
        ).catch(() => {});
        user.kycAuditLogs.push({
          action: 'document_replaced',
          docType: dt,
          performedBy: user._id,
          timestamp: new Date(),
          ip: req.ip,
          notes: `Replaced ${dt} document during KYC submission`
        });
      }
    }

    let vNum = null;
    if (vehicleNumber) {
      const vVal = validateVehicleNumber(vehicleNumber);
      if (!vVal.valid) {
        return res.status(400).json({ message: vVal.reason });
      }
      vNum = vVal.normalized;

      const conflict = await User.findOne({
        _id: { $ne: req.user.userId },
        $or: [
          { 'vehicles.vehicleNumber': vNum },
          { 'kycDocuments.vehicleNumber': vNum }
        ]
      }).select('_id name email');

      if (conflict) {
        return res.status(409).json({
          message: 'This vehicle number is already registered with another account.',
          code: 'VEHICLE_ALREADY_REGISTERED'
        });
      }
    }

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
    if (error.code === 11000 || (error.message && error.message.includes('duplicate key'))) {
      return res.status(409).json({
        message: 'This vehicle number is already registered with another account.',
        code: 'VEHICLE_ALREADY_REGISTERED'
      });
    }
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

// Generate short-lived signed access link (max 15 mins expiry, scoped to one user & one document type)
exports.getSignedDocumentUrl = async (req, res) => {
  try {
    const { userId, docType } = req.params;
    const requesterId = req.user.userId;

    if (!VALID_DOC_TYPES.includes(docType)) {
      return res.status(400).json({ message: 'Invalid document type' });
    }

    const requester = await User.findById(requesterId).select('role blocked suspended currentSessionSeed');
    if (!requester || requester.blocked || requester.suspended) {
      return res.status(403).json({ message: 'Account is restricted or inactive' });
    }

    const isOwner = requesterId.toString() === userId.toString();
    const isAdmin = requester.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Access denied: You are not authorized to request signed links for this document.' });
    }

    const targetUser = await User.findById(userId).select('kycDocuments');
    if (!targetUser || !targetUser.kycDocuments || !targetUser.kycDocuments[docType]) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Generate 15-minute expiring token bound to targetUserId, docType, operation & sessionSeed
    const token = jwt.sign(
      {
        userId: requester._id.toString(),
        targetUserId: userId.toString(),
        docType,
        op: 'read',
        purpose: 'kyc_document_access',
        sessionSeed: requester.currentSessionSeed,
        jti: crypto.randomUUID()
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
    res.status(500).json({ message: 'Unable to generate signed document link' });
  }
};

// Serve KYC document image (strictly authorized: owner or verified admin)
exports.getDocumentImage = async (req, res) => {
  try {
    const { userId, docType } = req.params;

    if (!VALID_DOC_TYPES.includes(docType)) {
      return res.status(400).json({ message: 'Invalid document type' });
    }

    // Object-level authorization: caller must be document owner OR verified admin
    const requesterId = req.user?.userId || req.user?.id;
    if (!requesterId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // If request arrived via short-lived signed bearer link (?token=...), verify token binding & scope
    if (req.query && req.query.token) {
      const decoded = req.tokenDecoded;
      if (!decoded || decoded.purpose !== 'kyc_document_access') {
        return res.status(403).json({ message: 'Access denied: Invalid or missing signed token purpose' });
      }
      if (decoded.op && decoded.op !== 'read') {
        return res.status(403).json({ message: 'Access denied: Signed token operation mismatch' });
      }
      if (decoded.targetUserId?.toString() !== userId.toString()) {
        return res.status(403).json({ message: 'Access denied: Signed token target user mismatch' });
      }
      if (decoded.docType !== docType) {
        return res.status(403).json({ message: 'Access denied: Signed token document type mismatch' });
      }
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
      notes: `Accessed by ${isReqAdmin ? 'Admin' : 'Owner'} via ${req.query?.token ? 'Signed URL' : 'Bearer Session'}`
    });
    await targetUser.save();

    // Reject legacy Cloudinary references (public redirects permanently removed)
    if (fileRef.startsWith('https://res.cloudinary.com/') || fileRef.startsWith('http://') || fileRef.startsWith('https://')) {
      return res.status(400).json({
        message: 'Document requires migration to private storage. Legacy public URLs are disabled for privacy.',
        code: 'LEGACY_DOCUMENT_UNMIGRATED'
      });
    }

    // Serve from private storage with strict path traversal & ownership registry verification
    if (fileRef.startsWith('private://')) {
      const safeCheck = resolveSafePrivatePath(fileRef);
      if (!safeCheck.valid) {
        return res.status(400).json({
          message: safeCheck.reason,
          code: 'INVALID_STORAGE_REF'
        });
      }

      const docRecord = await KycDocument.findOne({ storedRef: fileRef });
      if (docRecord) {
        if (docRecord.status === 'deleted') {
          return res.status(404).json({ message: 'Document has been deleted' });
        }
        if (docRecord.ownerId.toString() !== userId.toString() || docRecord.docType !== docType) {
          return res.status(403).json({
            message: 'Document ownership or type binding mismatch detected',
            code: 'DOCUMENT_OWNERSHIP_VIOLATION'
          });
        }
      }

      if (!fs.existsSync(safeCheck.filePath)) {
        return res.status(404).json({ message: 'Private document file not found on disk' });
      }

      const buffer = fs.readFileSync(safeCheck.filePath);
      const sig = validateImageSignature(buffer);
      const contentType = sig.valid ? sig.mime : 'application/octet-stream';

      res.set('Content-Type', contentType);
      res.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      res.set('X-Content-Type-Options', 'nosniff');
      res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
      return res.send(buffer);
    }

    // Reject legacy base64 data URI serving (must be migrated)
    if (fileRef.startsWith('data:image/')) {
      return res.status(400).json({
        message: 'Document requires migration to private storage. Legacy inline payloads are disabled.',
        code: 'LEGACY_BASE64_UNMIGRATED'
      });
    }

    return res.status(400).json({ message: 'Invalid or corrupted document format' });

  } catch (error) {
    console.error('Error serving document:', error.message);
    res.status(500).json({ message: 'Unable to retrieve document' });
  }
};

// Secure document deletion
exports.deleteDocument = async (req, res) => {
  try {
    const { userId, docType } = req.params;
    const requesterId = req.user.userId;

    if (!VALID_DOC_TYPES.includes(docType)) {
      return res.status(400).json({ message: 'Invalid document type' });
    }

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
    if (fileRef.startsWith('private://')) {
      const safeCheck = resolveSafePrivatePath(fileRef);
      if (safeCheck.valid && fs.existsSync(safeCheck.filePath)) {
        fs.unlinkSync(safeCheck.filePath);
      }
      await KycDocument.updateOne(
        { storedRef: fileRef },
        { $set: { status: 'deleted', deletedAt: new Date() } }
      ).catch(() => {});
    }

    user.kycDocuments[docType] = null;
    if (!user.kycAuditLogs) user.kycAuditLogs = [];
    user.kycAuditLogs.push({
      action: 'document_deleted',
      docType,
      performedBy: requesterId,
      timestamp: new Date(),
      ip: req.ip,
      notes: `Deleted by ${isAdmin ? 'Admin' : 'Owner'}`
    });
    await user.save();

    res.json({ message: `Document ${docType} deleted securely` });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete document' });
  }
};
