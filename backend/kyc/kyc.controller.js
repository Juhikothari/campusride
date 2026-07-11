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
    console.log('KYC Submit Request Body:', req.body); // DEBUG LOG

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { aadharUrl, drivingLicenseUrl, collegeIdCardUrl, selfieUrl, vehiclePhotoUrl, vehicleNumber } = req.body;

    // Enhanced validation with specific error messages
    if (!aadharUrl) {
      return res.status(400).json({ message: "Aadhar document is required" });
    }
    if (!collegeIdCardUrl) {
      return res.status(400).json({ message: "College ID document is required" });
    }

    // Validate image format (must be data URL or http URL)
    const isValidImageUrl = (url) => {
      return url && (
        url.startsWith('data:image') || 
        url.startsWith('http') ||
        url.startsWith('http://') || 
        url.startsWith('https://')
      );
    };

    if (!isValidImageUrl(aadharUrl)) {
      return res.status(400).json({ message: "Aadhar must be a valid image (data URL or http URL)" });
    }
    if (!isValidImageUrl(collegeIdCardUrl)) {
      return res.status(400).json({ message: "College ID must be a valid image" });
    }

    // Validate based on role
    const isProvider = ['provider', 'both'].includes(user.role);
    if (isProvider && !drivingLicenseUrl) {
      return res.status(400).json({ message: "Driving License is required for providers" });
    }
    if (isProvider && drivingLicenseUrl && !isValidImageUrl(drivingLicenseUrl)) {
      return res.status(400).json({ message: "Driving License must be a valid image" });
    }

    if (isProvider && !vehicleNumber) {
      return res.status(400).json({ message: "Vehicle registration number is required for providers" });
    }
    if (isProvider && vehicleNumber && !/^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/.test(vehicleNumber.toUpperCase())) {
      return res.status(400).json({ message: "Enter a valid vehicle number (e.g. KA01AB1234)" });
    }

    // ✅ NEW: Upload to Cloudinary
    /*const uploadedAadhar = await uploadToCloudinary(aadharUrl);
    const uploadedCollege = await uploadToCloudinary(collegeIdCardUrl);
    const uploadedLicense = isProvider && drivingLicenseUrl ? await uploadToCloudinary(drivingLicenseUrl) : null;
    const uploadedSelfie = selfieUrl ? await uploadToCloudinary(selfieUrl) : null;*/


    // Save documents (NOW URLs INSTEAD OF BASE64)
    user.kycDocuments = {
  aadhar: aadharUrl,
  drivingLicense: isProvider ? drivingLicenseUrl : null,
  collegeIdCard: collegeIdCardUrl,
  selfie: selfieUrl || null,
  vehiclePhoto: null,
  vehicleNumber: isProvider ? vehicleNumber.toUpperCase() : null,
};

    user.kycStatus = 'pending';
    user.kycSubmittedAt = new Date();

    await user.save();

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
      kycStatus: 'pending',
      $or: [
        { 'kycDocuments.aadhar': { $ne: null } },
        { 'kycDocuments.collegeIdCard': { $ne: null } }
      ]
    }).select('name email role kycDocuments kycSubmittedAt vehicleNumber');
    
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

// Serve KYC document image
exports.getDocumentImage = async (req, res) => {
  try {
    const { userId, docType } = req.params;

    const validDocTypes = ['aadhar', 'collegeIdCard', 'drivingLicense', 'selfie', 'vehiclePhoto'];
    if (!validDocTypes.includes(docType)) {
      return res.status(400).json({ message: 'Invalid document type' });
    }

    const user = await User.findById(userId);
    if (!user || !user.kycDocuments || !user.kycDocuments[docType]) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const fileData = user.kycDocuments[docType];

    // ✅ UPDATED: only redirect (Cloudinary URL)
    if (fileData.startsWith('http://') || fileData.startsWith('https://')) {
      return res.redirect(fileData);
    }

    return res.status(400).json({ message: 'Invalid file format' });

  } catch (error) {
    console.error('Error serving document:', error);
    res.status(500).json({ error: error.message });
  }
};