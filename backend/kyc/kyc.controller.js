const { notifyAdmins } = require('../notifications/notifications.helper');
const User = require('../users/users.model');
const path = require('path');
const fs = require('fs');
//const cloudinary = require('../config/cloudinary'); // ✅ ADDED

// ✅ ADDED: helper function
/*const uploadToCloudinary = async (base64) => {
  const result = await cloudinary.uploader.upload(base64, {
    folder: 'kyc_documents',
  });
  return result.secure_url;
};*/

// Submit KYC (Providers: aadhar + drivingLicense + collegeIdCard, Seekers: aadhar + collegeIdCard)
exports.submitKyc = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { aadharUrl, drivingLicenseUrl, collegeIdCardUrl, selfieUrl, vehiclePhotoUrl, vehicleNumber } = req.body;

    // Enhanced validation with specific error messages
    if (!collegeIdCardUrl) {
      return res.status(400).json({ message: "College ID document is required" });
    }
    if (!selfieUrl) {
      return res.status(400).json({ message: "Live selfie verification photo is mandatory" });
    }

    // Strictly validate image format: data URI with image MIME or HTTPS Cloudinary / image URL
    const isValidImageUrl = (url) => {
      if (!url || typeof url !== 'string') return false;
      if (url.startsWith('data:image/')) {
        return /^data:image\/(jpeg|png|webp|jpg);base64,([A-Za-z0-9+/=]+)$/.test(url);
      }
      if (url.startsWith('https://res.cloudinary.com/')) {
        return true;
      }
      if (url.startsWith('https://') || url.startsWith('http://')) {
        return /\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(url);
      }
      return false;
    };

    if (aadharUrl && !isValidImageUrl(aadharUrl)) {
      return res.status(400).json({ message: "Aadhar must be a valid image" });
    }
    if (!isValidImageUrl(collegeIdCardUrl)) {
      return res.status(400).json({ message: "College ID must be a valid image" });
    }

    // Validate based on role
    const isProvider = ['provider', 'both'].includes(user.role);
    if (drivingLicenseUrl && !isValidImageUrl(drivingLicenseUrl)) {
      return res.status(400).json({ message: "Driving License must be a valid image" });
    }

    const cleanVNum = vehicleNumber ? vehicleNumber.toUpperCase().replace(/[\s-]/g, '') : null;
    if (cleanVNum && !/^[A-Z]{2}[0-9]{1,2}[A-Z]{0,4}[0-9]{3,5}$/.test(cleanVNum)) {
      return res.status(400).json({ message: "Enter a valid vehicle registration number" });
    }

    // ✅ NEW: Upload to Cloudinary
    /*const uploadedAadhar = await uploadToCloudinary(aadharUrl);
    const uploadedCollege = await uploadToCloudinary(collegeIdCardUrl);
    const uploadedLicense = isProvider && drivingLicenseUrl ? await uploadToCloudinary(drivingLicenseUrl) : null;
    const uploadedSelfie = selfieUrl ? await uploadToCloudinary(selfieUrl) : null;*/


    const vNum = isProvider && vehicleNumber ? vehicleNumber.toUpperCase().trim() : null;
    const vName = isProvider && req.body.vehicleName ? req.body.vehicleName.trim() : 'Vehicle';
    const vType = isProvider && req.body.vehicleType ? req.body.vehicleType : 'car';

    user.kycDocuments = {
      aadhar: aadharUrl,
      drivingLicense: isProvider ? drivingLicenseUrl : null,
      collegeIdCard: collegeIdCardUrl,
      selfie: selfieUrl || null,
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
      documents: user.kycDocuments
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

    const user = await User.findById(userId);
    if (!user || !user.kycDocuments || !user.kycDocuments[docType]) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const fileData = user.kycDocuments[docType];

    // Redirect trusted external URLs (Cloudinary or valid image asset)
    if (fileData.startsWith('https://res.cloudinary.com/') || /^https:\/\/[a-zA-Z0-9.-]+\/.*\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(fileData)) {
      return res.redirect(fileData);
    }

    // Serve base64 data URI directly
    if (fileData.startsWith('data:image/')) {
      const matches = fileData.match(/^data:image\/([A-Za-z-+]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const contentType = `image/${matches[1]}`;
        const buffer = Buffer.from(matches[2], 'base64');
        res.set('Content-Type', contentType);
        res.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        return res.send(buffer);
      }
    }

    return res.status(400).json({ message: 'Invalid file format' });

  } catch (error) {
    console.error('Error serving document:', error);
    res.status(500).json({ error: error.message });
  }
};