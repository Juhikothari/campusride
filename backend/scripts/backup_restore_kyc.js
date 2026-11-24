// backend/scripts/backup_restore_kyc.js
// Utility for backup and restoration testing of the private KYC storage volume.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KYC_STORAGE_DIR = process.env.KYC_STORAGE_DIR
  ? path.resolve(process.env.KYC_STORAGE_DIR)
  : (fs.existsSync('/data/uploads/kyc_private')
      ? '/data/uploads/kyc_private'
      : path.resolve(__dirname, '../uploads/kyc_private'));

/**
 * Creates a timestamped directory backup of all stored KYC private files
 */
function createKycBackup(targetBackupDir) {
  if (!fs.existsSync(KYC_STORAGE_DIR)) {
    throw new Error(`Source KYC directory does not exist: ${KYC_STORAGE_DIR}`);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFolder = targetBackupDir || path.resolve(KYC_STORAGE_DIR, `../kyc_backups/backup_${timestamp}`);
  fs.mkdirSync(backupFolder, { recursive: true });

  const files = fs.readdirSync(KYC_STORAGE_DIR).filter(f => !fs.statSync(path.join(KYC_STORAGE_DIR, f)).isDirectory());
  let copiedCount = 0;
  const manifest = [];

  for (const file of files) {
    const src = path.join(KYC_STORAGE_DIR, file);
    const dest = path.join(backupFolder, file);
    const buf = fs.readFileSync(src);
    const hash = crypto.createHash('sha256').update(buf).digest('hex');
    fs.copyFileSync(src, dest);
    copiedCount++;
    manifest.push({ file, size: buf.length, sha256: hash });
  }

  const manifestPath = path.join(backupFolder, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({ timestamp, fileCount: copiedCount, files: manifest }, null, 2));

  console.log(`[KYC Backup] Successfully backed up ${copiedCount} files to: ${backupFolder}`);
  return { backupFolder, count: copiedCount, manifestPath };
}

/**
 * Restores KYC files from a backup directory into the active KYC_STORAGE_DIR
 */
function restoreKycBackup(backupFolder) {
  if (!fs.existsSync(backupFolder)) {
    throw new Error(`Backup folder not found: ${backupFolder}`);
  }

  if (!fs.existsSync(KYC_STORAGE_DIR)) {
    fs.mkdirSync(KYC_STORAGE_DIR, { recursive: true, mode: 0o700 });
  }

  const manifestPath = path.join(backupFolder, 'manifest.json');
  let manifest = null;
  if (fs.existsSync(manifestPath)) {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  }

  const files = fs.readdirSync(backupFolder).filter(f => f !== 'manifest.json' && !fs.statSync(path.join(backupFolder, f)).isDirectory());
  let restoredCount = 0;
  let verifiedCount = 0;

  for (const file of files) {
    const src = path.join(backupFolder, file);
    const dest = path.join(KYC_STORAGE_DIR, file);
    fs.copyFileSync(src, dest);
    restoredCount++;

    if (manifest) {
      const entry = manifest.files?.find(m => m.file === file);
      if (entry) {
        const destBuf = fs.readFileSync(dest);
        const hash = crypto.createHash('sha256').update(destBuf).digest('hex');
        if (hash === entry.sha256) {
          verifiedCount++;
        } else {
          throw new Error(`Integrity check failed for restored file ${file}`);
        }
      }
    }
  }

  console.log(`[KYC Restore] Restored ${restoredCount} files to ${KYC_STORAGE_DIR}. Verified: ${verifiedCount}`);
  return { restoredCount, verifiedCount };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const action = args[0] || 'backup';
  if (action === 'backup') {
    createKycBackup(args[1]);
  } else if (action === 'restore') {
    if (!args[1]) {
      console.error('Usage: node backup_restore_kyc.js restore <backup_folder_path>');
      process.exit(1);
    }
    restoreKycBackup(args[1]);
  } else {
    console.log('Usage: node backup_restore_kyc.js [backup|restore] [path]');
  }
}

module.exports = { createKycBackup, restoreKycBackup, KYC_STORAGE_DIR };
