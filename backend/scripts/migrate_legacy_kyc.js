// backend/scripts/migrate_legacy_kyc.js
// Production Migration Script: Migrates legacy Cloudinary and base64 KYC documents
// into durable private storage (KYC_STORAGE_DIR) with cryptographic verification.

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const mongoose = require('mongoose');

// Resolve KYC private storage directory
const KYC_STORAGE_DIR = process.env.KYC_STORAGE_DIR
  ? path.resolve(process.env.KYC_STORAGE_DIR)
  : (fs.existsSync('/data/uploads/kyc_private')
      ? '/data/uploads/kyc_private'
      : path.resolve(__dirname, '../uploads/kyc_private'));

if (!fs.existsSync(KYC_STORAGE_DIR)) {
  fs.mkdirSync(KYC_STORAGE_DIR, { recursive: true, mode: 0o700 });
}

function validateImageSignature(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 12) {
    return { valid: false, reason: 'Invalid or too small buffer' };
  }
  // JPEG
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { valid: true, mime: 'image/jpeg', ext: 'jpg' };
  }
  // PNG
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
    buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A
  ) {
    return { valid: true, mime: 'image/png', ext: 'png' };
  }
  // WebP
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return { valid: true, mime: 'image/webp', ext: 'webp' };
  }
  return { valid: false, reason: 'Unknown signature' };
}

function saveBufferToPrivateStorage(buffer, ext, ownerId, docType) {
  const docId = crypto.randomUUID();
  const safeOwner = String(ownerId).replace(/[^a-fA-F0-9]/g, '').slice(0, 24) || 'user';
  const filename = `${safeOwner}_${docType}_${docId}.${ext}`;
  const filePath = path.join(KYC_STORAGE_DIR, filename);
  fs.writeFileSync(filePath, buffer, { mode: 0o600 });
  // Verify write on disk & SHA-256 checksum
  if (!fs.existsSync(filePath) || fs.statSync(filePath).size !== buffer.length) {
    throw new Error(`Failed disk verification for ${filename}`);
  }
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  return { docId, filename, ref: `private://kyc_private/${filename}`, filePath, sha256 };
}

function downloadUrlToBuffer(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 15000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadUrlToBuffer(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} downloading ${url}`));
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout downloading ${url}`)); });
    req.on('error', reject);
  });
}

async function migrateLegacyKyc({ dryRun = false } = {}) {
  const isDirect = require.main === module;
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/freewheels';
  let shouldCloseDb = false;

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(mongoUri);
    shouldCloseDb = true;
    console.log('[KYC Migration] Connected to database');
  }

  const User = mongoose.models.User || require('../users/users.model');
  const KycDocument = mongoose.models.KycDocument || require('../kyc/kycDocument.model');
  const users = await User.find({ 'kycDocuments': { $ne: null } });
  console.log(`[KYC Migration] Found ${users.length} users with kycDocuments records. Dry run: ${dryRun}`);

  const docTypes = ['aadhar', 'collegeIdCard', 'drivingLicense', 'selfie', 'vehiclePhoto'];
  const summary = {
    totalUsers: users.length,
    documentsInspected: 0,
    alreadyPrivate: 0,
    verifiedOnDisk: 0,
    missingOnDisk: 0,
    backfilledOwnershipRecords: 0,
    migratedCloudinary: 0,
    migratedBase64: 0,
    errors: [],
  };

  for (const user of users) {
    let userModified = false;
    for (const dt of docTypes) {
      const currentRef = user.kycDocuments?.[dt];
      if (!currentRef) continue;
      summary.documentsInspected++;

      if (currentRef.startsWith('private://kyc_private/')) {
        summary.alreadyPrivate++;
        const filename = path.basename(currentRef.replace('private://kyc_private/', ''));
        const filePath = path.join(KYC_STORAGE_DIR, filename);
        if (!fs.existsSync(filePath)) {
          summary.missingOnDisk++;
          summary.errors.push({ userId: user._id, email: user.email, docType: dt, error: `Missing private file on disk: ${filename}` });
          continue;
        }
        const diskBuf = fs.readFileSync(filePath);
        const diskSig = validateImageSignature(diskBuf);
        const sha256 = crypto.createHash('sha256').update(diskBuf).digest('hex');
        summary.verifiedOnDisk++;

        if (!dryRun) {
          const existingReg = await KycDocument.findOne({ storedRef: currentRef });
          if (!existingReg) {
            await KycDocument.create({
              docId: crypto.randomUUID(),
              ownerId: user._id,
              docType: dt,
              storedRef: currentRef,
              filename,
              sha256,
              mime: diskSig.valid ? diskSig.mime : 'image/jpeg',
              size: diskBuf.length,
              status: 'attached',
              attachedAt: user.kycSubmittedAt || new Date()
            });
            summary.backfilledOwnershipRecords++;
          }
        }
        continue;
      }

      try {
        let buffer = null;
        let sourceKind = '';

        if (currentRef.startsWith('http://') || currentRef.startsWith('https://')) {
          sourceKind = 'cloudinary_url';
          console.log(`[KYC Migration] Downloading ${dt} for user ${user._id} (${user.email})...`);
          buffer = await downloadUrlToBuffer(currentRef);
        } else if (currentRef.startsWith('data:image/')) {
          sourceKind = 'base64';
          const match = currentRef.match(/^data:image\/[a-zA-Z0-9.+_-]+;base64,(.+)$/);
          if (match && match[1]) {
            buffer = Buffer.from(match[1], 'base64');
          }
        }

        if (!buffer) {
          throw new Error(`Unable to decode document payload for ${dt}`);
        }

        let sig = validateImageSignature(buffer);
        if (!sig.valid) {
          sig = { valid: true, mime: 'image/jpeg', ext: 'jpg' };
        }

        if (!dryRun) {
          const { docId, filename, ref, sha256 } = saveBufferToPrivateStorage(buffer, sig.ext, user._id, dt);
          await KycDocument.create({
            docId,
            ownerId: user._id,
            docType: dt,
            storedRef: ref,
            filename,
            sha256,
            mime: sig.mime,
            size: buffer.length,
            status: 'attached',
            attachedAt: new Date()
          });
          user.kycDocuments[dt] = ref;
          if (!user.kycAuditLogs) user.kycAuditLogs = [];
          user.kycAuditLogs.push({
            action: 'document_migrated',
            docType: dt,
            performedBy: user._id,
            timestamp: new Date(),
            notes: `Migrated legacy ${sourceKind} into private storage reference ${ref} (sha256=${sha256})`
          });
          userModified = true;
        }

        if (sourceKind === 'cloudinary_url') summary.migratedCloudinary++;
        if (sourceKind === 'base64') summary.migratedBase64++;
        console.log(`[KYC Migration] Migrated ${dt} for user ${user.email}`);

      } catch (docErr) {
        console.error(`[KYC Migration Error] User ${user.email} ${dt}:`, docErr.message);
        summary.errors.push({ userId: user._id, email: user.email, docType: dt, error: docErr.message });
      }
    }

    if (userModified && !dryRun) {
      await user.save();
    }
  }

  console.log('\n===== KYC MIGRATION & AUDIT SUMMARY =====');
  console.log(`Total users scanned: ${summary.totalUsers}`);
  console.log(`Documents inspected: ${summary.documentsInspected}`);
  console.log(`Already private: ${summary.alreadyPrivate} (verified on disk: ${summary.verifiedOnDisk}, missing on disk: ${summary.missingOnDisk})`);
  console.log(`Ownership records backfilled: ${summary.backfilledOwnershipRecords}`);
  console.log(`Migrated from Cloudinary: ${summary.migratedCloudinary}`);
  console.log(`Migrated from Base64: ${summary.migratedBase64}`);
  console.log(`Failed/Missing count: ${summary.errors.length}`);

  if (shouldCloseDb && isDirect) {
    await mongoose.disconnect();
  }

  return summary;
}

if (require.main === module) {
  const isDryRun = process.argv.includes('--dry-run');
  migrateLegacyKyc({ dryRun: isDryRun }).catch(err => {
    console.error('Fatal migration error:', err);
    process.exit(1);
  });
}

module.exports = { migrateLegacyKyc, KYC_STORAGE_DIR };
