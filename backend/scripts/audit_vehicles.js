// backend/scripts/audit_vehicles.js
// Audits existing users for duplicate vehicle numbers and reports any conflicts.
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

function normalizeVehicleNumber(raw) {
  if (!raw || typeof raw !== 'string') return '';
  return raw.toUpperCase().replace(/[\s\-_.]/g, '');
}

async function auditVehicles() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/freewheels';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB database');

    const users = await mongoose.connection.collection('users').find({}).toArray();
    console.log(`Auditing ${users.length} user records for vehicle registration numbers...`);

    const vehicleMap = new Map(); // normalizedNumber -> Array of { userId, email, source }
    let totalVehiclesFound = 0;

    for (const u of users) {
      // 1. Check u.vehicles array
      if (Array.isArray(u.vehicles)) {
        for (const v of u.vehicles) {
          if (v && v.vehicleNumber) {
            totalVehiclesFound++;
            const norm = normalizeVehicleNumber(v.vehicleNumber);
            if (!vehicleMap.has(norm)) vehicleMap.set(norm, []);
            vehicleMap.get(norm).push({
              userId: u._id.toString(),
              email: u.email,
              name: u.name,
              source: 'vehicles[]',
              rawNumber: v.vehicleNumber,
              status: v.status
            });
          }
        }
      }

      // 2. Check u.kycDocuments.vehicleNumber
      if (u.kycDocuments && u.kycDocuments.vehicleNumber) {
        totalVehiclesFound++;
        const norm = normalizeVehicleNumber(u.kycDocuments.vehicleNumber);
        // Only record if not already recorded for this user under the same norm
        const existing = vehicleMap.get(norm) || [];
        const alreadyForThisUser = existing.some(e => e.userId === u._id.toString());
        if (!alreadyForThisUser) {
          if (!vehicleMap.has(norm)) vehicleMap.set(norm, []);
          vehicleMap.get(norm).push({
            userId: u._id.toString(),
            email: u.email,
            name: u.name,
            source: 'kycDocuments.vehicleNumber',
            rawNumber: u.kycDocuments.vehicleNumber,
            status: u.kycDocuments.vehicleStatus
          });
        }
      }
    }

    console.log(`\nAudit Statistics:`);
    console.log(`Total vehicle entries scanned: ${totalVehiclesFound}`);
    console.log(`Unique vehicle registrations: ${vehicleMap.size}`);

    let conflictCount = 0;
    for (const [normNumber, owners] of vehicleMap.entries()) {
      if (owners.length > 1) {
        conflictCount++;
        console.warn(`\n⚠️ CONFLICT DETECTED for vehicle "${normNumber}":`);
        owners.forEach((o, idx) => {
          console.warn(`   Owner ${idx + 1}: ${o.name} (${o.email}, ID: ${o.userId}) via ${o.source} [raw: "${o.rawNumber}", status: ${o.status}]`);
        });
      }
    }

    if (conflictCount === 0) {
      console.log(`\n✅ ZERO conflicts detected! Database is clean and ready for unique index.`);
    } else {
      console.warn(`\n⚠️ Found ${conflictCount} vehicle numbers with multiple user accounts.`);
    }

  } catch (err) {
    console.error('Audit failed:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Database disconnected.');
  }
}

if (require.main === module) {
  auditVehicles();
}

module.exports = { auditVehicles, normalizeVehicleNumber };
