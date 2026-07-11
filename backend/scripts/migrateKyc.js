require('dotenv').config();
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;

// ✅ configure cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ import your User model
const User = require('../users/users.model.js'); // adjust path if needed

// ✅ helper: upload base64
const uploadBase64 = async (base64, label) => {
  try {
    const res = await cloudinary.uploader.upload(base64, {
      folder: 'kyc_documents/migrated',
    });
    console.log(`✔ Uploaded ${label}`);
    return res.secure_url;
  } catch (err) {
    console.error(`❌ Failed ${label}:`, err.message);
    return null;
  }
};

const migrate = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ DB connected");

    const users = await User.find({
      "kycDocuments.aadhar": { $exists: true }
    });

    console.log(`Found ${users.length} users`);

    for (const user of users) {
      const docs = user.kycDocuments;
      if (!docs) continue;

      let updated = false;

      // 🔁 AADHAR
      if (docs.aadhar && docs.aadhar.startsWith('data:image')) {
        const url = await uploadBase64(docs.aadhar, 'aadhar');
        if (url) {
          user.kycDocuments.aadhar = url;
          updated = true;
        }
      }

      // 🔁 COLLEGE ID
      if (docs.collegeIdCard && docs.collegeIdCard.startsWith('data:image')) {
        const url = await uploadBase64(docs.collegeIdCard, 'collegeId');
        if (url) {
          user.kycDocuments.collegeIdCard = url;
          updated = true;
        }
      }

      // 🔁 LICENSE
      if (docs.drivingLicense && docs.drivingLicense.startsWith('data:image')) {
        const url = await uploadBase64(docs.drivingLicense, 'license');
        if (url) {
          user.kycDocuments.drivingLicense = url;
          updated = true;
        }
      }

      // 🔁 SELFIE
      if (docs.selfie && docs.selfie.startsWith('data:image')) {
        const url = await uploadBase64(docs.selfie, 'selfie');
        if (url) {
          user.kycDocuments.selfie = url;
          updated = true;
        }
      }

      if (updated) {
        await user.save();
        console.log(`✅ Updated user: ${user.email}`);
      }
    }

    console.log("🎉 Migration complete");
    process.exit();

  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  }
};
console.log("Cloudinary ENV:", {
  cloud: process.env.CLOUDINARY_CLOUD_NAME,
  key: process.env.CLOUDINARY_API_KEY,
  secret: process.env.CLOUDINARY_API_SECRET ? "OK" : "MISSING"
});

migrate();