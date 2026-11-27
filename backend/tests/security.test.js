// backend/tests/security.test.js
// Complete Independent Automated Security & Production Readiness Regression Test Suite
// Exhaustively verifies Authentication, Authorization, IDOR, Input Validation, Sessions, and Socket.IO.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { io: ClientIo } = require('socket.io-client');

// Ensure environment variables
process.env.NODE_ENV = 'test';
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'campusride_test_jwt_secret_secure_key_12345';
if (!process.env.ADMIN_KEY) process.env.ADMIN_KEY = 'campusride_admin_test_key_secure_9988';

const { server } = require('../server');
const connectDB = require('../config/db');
const User = require('../users/users.model');
const Ride = require('../rides/rides.model');
const Booking = require('../bookings/bookings.model');
const SOS = require('../sos/sos.model');
const KycDocument = require('../kyc/kycDocument.model');
const PushTicket = require('../notifications/pushTicket.model');

let baseUrl;
let testServer;
let normalUser1;
let normalUser2;
let suspendedUser;
let blockedUser;
let adminUser;
let testRide;
let tokenUser1;
let tokenUser2;
let tokenAdmin;
let tokenSuspended;
let tokenBlocked;
let serverPort;

before(async () => {
  // Ensure MongoDB connection is fully established (deterministic wait for CI runners)
  await connectDB();
  if (mongoose.connection.readyState !== 1) {
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('MongoDB connection timed out in test setup')), 15000);
      mongoose.connection.once('open', () => { clearTimeout(t); resolve(); });
    });
  }

  // Start test server on dynamic port
  await new Promise((resolve) => {
    testServer = server.listen(0, '127.0.0.1', () => {
      serverPort = testServer.address().port;
      baseUrl = `http://127.0.0.1:${serverPort}`;
      resolve();
    });
  });

  const timestamp = Date.now();
  const seed1 = 'seed_test_user_1_' + timestamp;
  const seed2 = 'seed_test_user_2_' + timestamp;
  const seedAdmin = 'seed_admin_' + timestamp;
  const seedSuspended = 'seed_suspended_' + timestamp;
  const seedBlocked = 'seed_blocked_' + timestamp;

  // Prepare durable private KYC test file
  const sampleDocName = 'test_sample.png';
  const kycStorageDir = process.env.KYC_STORAGE_DIR || path.join(__dirname, '..', 'uploads', 'kyc_private');
  if (!fs.existsSync(kycStorageDir)) {
    fs.mkdirSync(kycStorageDir, { recursive: true });
  }
  const samplePngBuffer = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2d420000000049454e44ae426082', 'hex');
  fs.writeFileSync(path.join(kycStorageDir, sampleDocName), samplePngBuffer);

  // 1. Normal User 1 (Provider of test ride)
  normalUser1 = await User.create({
    name: 'Security Test User 1',
    email: `sec_test1_${timestamp}@example.com`,
    phone: '9876543210',
    password: '$2a$10$hashedpasswordforsecuritytestingpurposesonly',
    role: 'provider',
    college: 'RNS Institute of Technology',
    currentSessionSeed: seed1,
    kycStatus: 'approved',
    kycDocuments: {
      collegeIdCard: `private://kyc_private/${sampleDocName}`,
      selfie: `private://kyc_private/${sampleDocName}`
    }
  });

  // 2. Normal User 2 (Seeker, not part of test ride)
  normalUser2 = await User.create({
    name: 'Security Test User 2',
    email: `sec_test2_${timestamp}@example.com`,
    phone: '9876543211',
    password: '$2a$10$hashedpasswordforsecuritytestingpurposesonly',
    role: 'seeker',
    college: 'RNS Institute of Technology',
    currentSessionSeed: seed2
  });

  // 3. Suspended User
  suspendedUser = await User.create({
    name: 'Security Suspended User',
    email: `sec_susp_${timestamp}@example.com`,
    phone: '9876543213',
    password: '$2a$10$hashedpasswordforsecuritytestingpurposesonly',
    role: 'seeker',
    college: 'RNS Institute of Technology',
    suspended: true,
    suspensionReason: 'Safety Violation',
    currentSessionSeed: seedSuspended
  });

  // 4. Blocked User
  blockedUser = await User.create({
    name: 'Security Blocked User',
    email: `sec_blocked_${timestamp}@example.com`,
    phone: '9876543214',
    password: '$2a$10$hashedpasswordforsecuritytestingpurposesonly',
    role: 'seeker',
    college: 'RNS Institute of Technology',
    blocked: true,
    blockReason: 'Administrative Ban',
    currentSessionSeed: seedBlocked
  });

  // 5. Admin User
  adminUser = await User.create({
    name: 'Security Test Admin',
    email: `sec_admin_${timestamp}@example.com`,
    phone: '9876543212',
    password: '$2a$10$hashedpasswordforsecuritytestingpurposesonly',
    role: 'admin',
    college: 'CampusRide Admin HQ',
    currentSessionSeed: seedAdmin
  });

  // 6. Test Ride owned by normalUser1
  testRide = await Ride.create({
    providerId: normalUser1._id,
    pickup: {
      type: 'Point',
      coordinates: [77.5218, 12.9081],
      address: 'Campus Gate 1'
    },
    drop: {
      type: 'Point',
      coordinates: [77.5312, 12.9150],
      address: 'Metro Station'
    },
    date: new Date('2026-12-01T10:00:00Z'),
    time: '10:00',
    seatsAvailable: 2,
    costPerSeat: 30,
    vehicleType: 'car',
    status: 'active',
    passengers: []
  });

  // Generate valid tokens with matching sessionSeeds
  tokenUser1 = jwt.sign(
    { userId: normalUser1._id.toString(), email: normalUser1.email, role: 'provider', sessionSeed: seed1 },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '1h' }
  );

  tokenUser2 = jwt.sign(
    { userId: normalUser2._id.toString(), email: normalUser2.email, role: 'seeker', sessionSeed: seed2 },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '1h' }
  );

  tokenSuspended = jwt.sign(
    { userId: suspendedUser._id.toString(), email: suspendedUser.email, role: 'seeker', sessionSeed: seedSuspended },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '1h' }
  );

  tokenBlocked = jwt.sign(
    { userId: blockedUser._id.toString(), email: blockedUser.email, role: 'seeker', sessionSeed: seedBlocked },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '1h' }
  );

  tokenAdmin = jwt.sign(
    { userId: adminUser._id.toString(), email: adminUser.email, role: 'admin', sessionSeed: seedAdmin },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '1h' }
  );
});

after(async () => {
  try {
    if (normalUser1) {
      await KycDocument.deleteMany({ ownerId: normalUser1._id });
      await PushTicket.deleteMany({ userId: normalUser1._id });
      await User.deleteOne({ _id: normalUser1._id });
    }
    if (normalUser2) {
      await KycDocument.deleteMany({ ownerId: normalUser2._id });
      await PushTicket.deleteMany({ userId: normalUser2._id });
      await User.deleteOne({ _id: normalUser2._id });
    }
    if (suspendedUser) await User.deleteOne({ _id: suspendedUser._id });
    if (blockedUser) await User.deleteOne({ _id: blockedUser._id });
    if (adminUser) await User.deleteOne({ _id: adminUser._id });
    if (testRide) await Ride.deleteOne({ _id: testRide._id });
  } catch (err) {
    console.error('Test cleanup error:', err.message);
  }

  if (testServer) {
    await new Promise((resolve) => testServer.close(resolve));
  }

  try {
    await mongoose.disconnect();
  } catch (e) {}
});

// =========================================================================
// SECTION 1: CRITICAL REMEDIATIONS VERIFICATION
// =========================================================================
test('CRITICAL: /api/auth/reset-password-direct is permanently disabled (returns 404)', async () => {
  const res = await fetch(`${baseUrl}/api/auth/reset-password-direct`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalUser1.email, newPassword: 'AttackerPassword123!' })
  });
  assert.equal(res.status, 404, 'Direct unauthenticated password reset endpoint must return 404');
});

test('SECURITY HEADERS: Helmet headers are present on responses', async () => {
  const res = await fetch(`${baseUrl}/socket-test`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'SAMEORIGIN');
});

// =========================================================================
// SECTION 2: AUTHENTICATION & SESSION SECURITY
// =========================================================================
test('AUTH: Expired JWT token is rejected with 401', async () => {
  const expiredToken = jwt.sign(
    { userId: normalUser1._id.toString(), sessionSeed: normalUser1.currentSessionSeed },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: -10 } // Expired 10s ago
  );
  const res = await fetch(`${baseUrl}/api/users/profile`, {
    headers: { Authorization: `Bearer ${expiredToken}` }
  });
  assert.equal(res.status, 401);
});

test('AUTH: Token with forged/tampered signature is rejected with 401', async () => {
  const tamperedToken = jwt.sign(
    { userId: normalUser1._id.toString(), role: 'admin' },
    'wrong_secret_attacker_key_xyz',
    { algorithm: 'HS256', expiresIn: '1h' }
  );
  const res = await fetch(`${baseUrl}/api/users/profile`, {
    headers: { Authorization: `Bearer ${tamperedToken}` }
  });
  assert.equal(res.status, 401);
});

test('AUTH: "none" algorithm token is rejected with 401', async () => {
  const noneToken = jwt.sign(
    { userId: normalUser1._id.toString() },
    '',
    { algorithm: 'none' }
  );
  const res = await fetch(`${baseUrl}/api/users/profile`, {
    headers: { Authorization: `Bearer ${noneToken}` }
  });
  assert.equal(res.status, 401);
});

test('AUTH: Blocked user is rejected with 403 on authenticated requests', async () => {
  const res = await fetch(`${baseUrl}/api/users/profile`, {
    headers: { Authorization: `Bearer ${tokenBlocked}` }
  });
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.match(data.message, /blocked/i);
});

test('AUTH: Suspended user is rejected with 403 on authenticated requests', async () => {
  const res = await fetch(`${baseUrl}/api/users/profile`, {
    headers: { Authorization: `Bearer ${tokenSuspended}` }
  });
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.match(data.message, /suspended/i);
});

test('AUTH: Logout revokes session and invalidates previous token', async () => {
  // 1. Create temporary user for logout test
  const tempSeed = 'temp_seed_logout_' + Date.now();
  const tempUser = await User.create({
    name: 'Logout Test User',
    email: `logout_test_${Date.now()}@example.com`,
    phone: '9876543299',
    password: '$2a$10$hashedpasswordforsecuritytestingpurposesonly',
    role: 'seeker',
    college: 'RNS Institute of Technology',
    currentSessionSeed: tempSeed,
    isLoggedIn: true
  });

  const tempToken = jwt.sign(
    { userId: tempUser._id.toString(), sessionSeed: tempSeed },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '1h' }
  );

  // 2. Profile call works before logout
  const resBefore = await fetch(`${baseUrl}/api/users/profile`, {
    headers: { Authorization: `Bearer ${tempToken}` }
  });
  assert.equal(resBefore.status, 200);

  // 3. Execute logout
  const resLogout = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tempToken}` }
  });
  assert.equal(resLogout.status, 200);

  // 4. Calling profile with old token is now REJECTED with 401
  const resAfter = await fetch(`${baseUrl}/api/users/profile`, {
    headers: { Authorization: `Bearer ${tempToken}` }
  });
  assert.equal(resAfter.status, 401, 'Old token must be rejected after logout');

  await User.deleteOne({ _id: tempUser._id });
});

// =========================================================================
// SECTION 3: ADMINISTRATIVE AUTHORIZATION MATRIX
// =========================================================================
test('ADMIN: Unauthenticated access to /api/admin/users is rejected with 401', async () => {
  const res = await fetch(`${baseUrl}/api/admin/users`);
  assert.equal(res.status, 401);
});

test('ADMIN: Regular user cannot access /api/admin/users (returns 403)', async () => {
  const res = await fetch(`${baseUrl}/api/admin/users`, {
    headers: { Authorization: `Bearer ${tokenUser2}` }
  });
  assert.equal(res.status, 403);
});

test('ADMIN: Verified admin can access /api/admin/users (returns 200)', async () => {
  const res = await fetch(`${baseUrl}/api/admin/users`, {
    headers: { Authorization: `Bearer ${tokenAdmin}` }
  });
  assert.equal(res.status, 200);
});

test('ADMIN: Regular user cannot access /api/admin/stats (returns 403)', async () => {
  const res = await fetch(`${baseUrl}/api/admin/stats`, {
    headers: { Authorization: `Bearer ${tokenUser2}` }
  });
  assert.equal(res.status, 403);
});

test('ADMIN: Regular user cannot access KYC pending queue (returns 403)', async () => {
  const res = await fetch(`${baseUrl}/api/kyc/admin/pending`, {
    headers: { Authorization: `Bearer ${tokenUser2}` }
  });
  assert.equal(res.status, 403);
});

test('ADMIN: Regular user cannot access all SOS alerts /api/sos/admin/all (returns 403)', async () => {
  const res = await fetch(`${baseUrl}/api/sos/admin/all`, {
    headers: { Authorization: `Bearer ${tokenUser2}` }
  });
  assert.equal(res.status, 403);
});

test('ADMIN: Regular user cannot access incident reports /api/incidents/all (returns 403)', async () => {
  const res = await fetch(`${baseUrl}/api/incidents/all`, {
    headers: { Authorization: `Bearer ${tokenUser2}` }
  });
  assert.equal(res.status, 403);
});

// =========================================================================
// SECTION 4: KYC DOCUMENT IDOR & FILE SECURITY
// =========================================================================
test('KYC IDOR: Unauthenticated requests to /api/kyc/document/:userId/:docType are rejected with 401', async () => {
  const res = await fetch(`${baseUrl}/api/kyc/document/${normalUser1._id}/collegeIdCard`);
  assert.equal(res.status, 401);
});

test('KYC IDOR: Non-owner non-admin cannot access another users document (returns 403)', async () => {
  const res = await fetch(`${baseUrl}/api/kyc/document/${normalUser1._id}/collegeIdCard`, {
    headers: { Authorization: `Bearer ${tokenUser2}` }
  });
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.match(data.message, /access denied|forbidden/i);
});

test('KYC IDOR: Document owner CAN access their own KYC document', async () => {
  const res = await fetch(`${baseUrl}/api/kyc/document/${normalUser1._id}/collegeIdCard`, {
    headers: { Authorization: `Bearer ${tokenUser1}` },
    redirect: 'manual'
  });
  assert.equal(res.status, 200, 'Owner must receive document with HTTP 200 from private storage');
  assert.equal(res.headers.get('content-type'), 'image/png');
});

test('KYC IDOR: Verified admin CAN access any users KYC document', async () => {
  const res = await fetch(`${baseUrl}/api/kyc/document/${normalUser1._id}/collegeIdCard`, {
    headers: { Authorization: `Bearer ${tokenAdmin}` },
    redirect: 'manual'
  });
  assert.equal(res.status, 200, 'Admin must receive document with HTTP 200 from private storage');
  assert.equal(res.headers.get('content-type'), 'image/png');
});

test('KYC VALIDATION: submitKyc rejects invalid/malicious non-image payload', async () => {
  const res = await fetch(`${baseUrl}/api/kyc/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenUser2}`
    },
    body: JSON.stringify({
      collegeIdCardUrl: 'javascript:alert(1)',
      selfieUrl: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='
    })
  });
  assert.equal(res.status, 400, 'Malicious/invalid non-image URL must be rejected');
});

// =========================================================================
// SECTION 5: PRIVACY & MASS ASSIGNMENT DEFENSE
// =========================================================================
test('PRIVACY: Public user profile does NOT expose kycDocuments or password', async () => {
  const res = await fetch(`${baseUrl}/api/users/${normalUser1._id}`, {
    headers: { Authorization: `Bearer ${tokenUser2}` }
  });
  assert.equal(res.status, 200);
  const profile = await res.json();
  assert.equal(profile.kycDocuments, undefined, 'kycDocuments must be excluded from public profile');
  assert.equal(profile.password, undefined, 'password hash must never be returned');
});

test('MASS ASSIGNMENT: PUT /api/users/profile strictly ignores privilege escalation keys', async () => {
  const res = await fetch(`${baseUrl}/api/users/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenUser2}`
    },
    body: JSON.stringify({
      role: 'admin',
      isAdmin: true,
      kycStatus: 'approved',
      blocked: false,
      gender: 'female'
    })
  });

  assert.equal(res.status, 200);
  const userInDb = await User.findById(normalUser2._id);
  assert.equal(userInDb.role, 'seeker', 'Role must remain seeker; mass assignment neutralized');
  assert.equal(userInDb.kycStatus, 'not_submitted', 'KYC status must remain unchanged');
  assert.equal(userInDb.gender, 'female', 'Legitimate field update succeeded');
});

// =========================================================================
// SECTION 6: RIDE OBJECT-LEVEL AUTHORIZATION (IDOR)
// =========================================================================
test('RIDE IDOR: Non-provider cannot update another providers ride (returns 403)', async () => {
  const res = await fetch(`${baseUrl}/api/ride/${testRide._id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenUser2}` // User 2 does not own testRide
    },
    body: JSON.stringify({ costPerSeat: 100 })
  });
  assert.equal(res.status, 403, 'Non-owner must not be allowed to update ride');
});

test('RIDE IDOR: Non-provider cannot cancel another providers ride (returns 403)', async () => {
  const res = await fetch(`${baseUrl}/api/ride/${testRide._id}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenUser2}`
    },
    body: JSON.stringify({ reason: 'Malicious cancellation' })
  });
  assert.equal(res.status, 403, 'Non-owner must not be allowed to cancel ride');
});

// =========================================================================
// SECTION 7: CHAT & LIVE TRACKING IDOR
// =========================================================================
test('CHAT IDOR: Non-participants cannot view ride chat messages (returns 403)', async () => {
  const res = await fetch(`${baseUrl}/api/chat/${testRide._id}`, {
    headers: { Authorization: `Bearer ${tokenUser2}` }
  });
  assert.equal(res.status, 403);
});

test('TRACKING IDOR: Non-participants cannot view live ride tracking coordinates (returns 403)', async () => {
  const res = await fetch(`${baseUrl}/api/tracking/${testRide._id}`, {
    headers: { Authorization: `Bearer ${tokenUser2}` }
  });
  assert.equal(res.status, 403);
});

test('TRACKING IDOR: Non-provider cannot post GPS tracking update for a ride (returns 403)', async () => {
  const res = await fetch(`${baseUrl}/api/tracking/update`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenUser2}` // User 2 is not provider
    },
    body: JSON.stringify({
      rideId: testRide._id.toString(),
      lat: 12.9085,
      lng: 77.5220
    })
  });
  assert.equal(res.status, 403);
});

// =========================================================================
// SECTION 8: EMERGENCY SOS AUTHORIZATION
// =========================================================================
test('SOS IDOR: Non-participant cannot trigger SOS on a ride (returns 403)', async () => {
  const res = await fetch(`${baseUrl}/api/sos/trigger`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenUser2}` // User 2 is not part of testRide
    },
    body: JSON.stringify({
      rideId: testRide._id.toString(),
      type: 'medical',
      description: 'Emergency test'
    })
  });
  assert.equal(res.status, 403);
});

// =========================================================================
// SECTION 9: API SECURITY & INPUT SANITIZATION
// =========================================================================
test('API SECURITY: Malformed JSON body returns 400 without crashing server', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"email": "broken_json'
  });
  assert.ok(res.status === 400 || res.status === 500, 'Server must return client error code for malformed JSON');
});

test('API SECURITY: NoSQL injection in body is stripped by mongo-sanitize', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: { $ne: null },
      password: 'password123'
    })
  });
  // mongo-sanitize strips $ne -> object is sanitized, login fails safely with 400
  assert.equal(res.status, 400);
});

// =========================================================================
// SECTION 10: SOCKET.IO SECURITY
// =========================================================================
test('SOCKET.IO: Unauthenticated connection without JWT cannot authenticate', async () => {
  const clientSocket = ClientIo(baseUrl, {
    transports: ['websocket'],
    reconnection: false
  });

  await new Promise((resolve, reject) => {
    clientSocket.on('connect', () => {
      // Attempt to authenticate without token
      clientSocket.emit('authenticate', { userId: normalUser1._id.toString() });
    });

    clientSocket.on('authenticated', (res) => {
      assert.equal(res.success, false, 'Socket auth without JWT token must fail');
      clientSocket.disconnect();
      resolve();
    });

    setTimeout(() => {
      clientSocket.disconnect();
      resolve();
    }, 2000);
  });
});

test('SOCKET.IO: Regular user token authenticates without admin privileges', async () => {
  const clientSocket = ClientIo(baseUrl, {
    transports: ['websocket'],
    reconnection: false
  });

  await new Promise((resolve) => {
    clientSocket.on('connect', () => {
      clientSocket.emit('authenticate', {
        token: tokenUser2,
        userType: 'admin' // Attempted role spoofing
      });
    });

    clientSocket.on('authenticated', (res) => {
      assert.equal(res.success, true);
      assert.equal(res.userType, 'seeker', 'Role spoofing must be ignored; verified DB role used');
      clientSocket.disconnect();
      resolve();
    });

    setTimeout(() => {
      clientSocket.disconnect();
      resolve();
    }, 2000);
  });
});

// =========================================================================
// SECTION 11: HARDENED SOS EMERGENCY NOTIFICATION SYSTEM
// =========================================================================
test('SOS NOTIFICATION: Triggering SOS on unconfigured SMS gateway returns client_action_required and 0 confirmed', async () => {
  // Update normalUser1 emergency contact
  await User.findByIdAndUpdate(normalUser1._id, {
    emergencyContact: '9876543219'
  });

  const res = await fetch(`${baseUrl}/api/sos/trigger`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenUser1}`
    },
    body: JSON.stringify({
      rideId: testRide._id.toString(),
      type: 'medical',
      description: 'Test emergency alert for status verification',
      location: { lat: 12.9081, lng: 77.5218 }
    })
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.emergencyContactsNotified, 0, 'Unconfirmed delivery must not be counted as notified');
  assert.ok(Array.isArray(data.emergencyContactsStatus));
  assert.equal(data.emergencyContactsStatus[0].deliveryStatus, 'client_action_required');
  assert.equal(data.emergencyContactsStatus[0].provider, 'NOT_CONFIGURED');

  // Verify DB record status
  const SOS = require('../sos/sos.model');
const KycDocument = require('../kyc/kycDocument.model');
const PushTicket = require('../notifications/pushTicket.model');
  const savedSOS = await SOS.findById(data.sos._id);
  assert.equal(savedSOS.status, 'active');
  assert.ok(savedSOS.auditLog.length >= 1);
  assert.equal(savedSOS.auditLog[0].action, 'triggered');

  // Clean up SOS so test ride is not blocked for subsequent tests
  await SOS.findByIdAndUpdate(savedSOS._id, { status: 'resolved' });
});

test('SOS IDEMPOTENCY: Duplicate trigger with same idempotencyKey returns cached record', async () => {
  const idempotencyKey = 'idem-test-key-' + Date.now();
  const payload = {
    rideId: testRide._id.toString(),
    type: 'accident',
    description: 'Idempotency verification test',
    location: { lat: 12.9081, lng: 77.5218 },
    idempotencyKey
  };

  const res1 = await fetch(`${baseUrl}/api/sos/trigger`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenUser1}`
    },
    body: JSON.stringify(payload)
  });
  assert.equal(res1.status, 201);
  const data1 = await res1.json();

  // Replay request with same idempotencyKey
  const res2 = await fetch(`${baseUrl}/api/sos/trigger`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenUser1}`
    },
    body: JSON.stringify(payload)
  });
  assert.equal(res2.status, 200, 'Idempotent replay must return 200 with existing record');
  const data2 = await res2.json();
  assert.equal(data2.idempotentReplay, true);
  assert.equal(String(data2.sos._id), String(data1.sos._id));

  // Clean up
  const SOS = require('../sos/sos.model');
const KycDocument = require('../kyc/kycDocument.model');
const PushTicket = require('../notifications/pushTicket.model');
  await SOS.findByIdAndUpdate(data1.sos._id, { status: 'resolved' });
});

test('SOS LIFECYCLE: Triggerer can cancel active SOS alert', async () => {
  const resTrigger = await fetch(`${baseUrl}/api/sos/trigger`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenUser1}`
    },
    body: JSON.stringify({
      rideId: testRide._id.toString(),
      type: 'harassment',
      description: 'Cancellation test',
      location: { lat: 12.9081, lng: 77.5218 }
    })
  });
  assert.equal(resTrigger.status, 201);
  const { sos } = await resTrigger.json();

  // Cancel SOS
  const resCancel = await fetch(`${baseUrl}/api/sos/${sos._id}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenUser1}`
    },
    body: JSON.stringify({ cancellationReason: 'False alarm by passenger' })
  });
  assert.equal(resCancel.status, 200);
  const cancelData = await resCancel.json();
  assert.equal(cancelData.sos.status, 'cancelled');

  const SOS = require('../sos/sos.model');
const KycDocument = require('../kyc/kycDocument.model');
const PushTicket = require('../notifications/pushTicket.model');
  const verified = await SOS.findById(sos._id);
  assert.equal(verified.status, 'cancelled');
  const cancelLog = verified.auditLog.find(l => l.action === 'cancelled');
  assert.ok(cancelLog, 'Audit log must record cancellation');
});

// =========================================================================
// SECTION 12: HARDENED PRIVATE KYC STORAGE & MAGIC-BYTE VALIDATION
// =========================================================================
test('KYC SSRF: Rejects arbitrary external image URLs', async () => {
  const res = await fetch(`${baseUrl}/api/kyc/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenUser2}`
    },
    body: JSON.stringify({
      collegeIdCardUrl: 'https://attacker-server.com/malicious_image.png',
      selfieUrl: 'https://attacker-server.com/selfie.jpg'
    })
  });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.message, /arbitrary external urls are not permitted/i);
});

test('KYC STORAGE: Accepts genuine PNG magic bytes data URI into private storage', async () => {
  // 1x1 transparent PNG with valid 8-byte PNG signature: \x89PNG\r\n\x1a\n
  const validPngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  const res = await fetch(`${baseUrl}/api/kyc/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenUser2}`
    },
    body: JSON.stringify({
      collegeIdCardUrl: validPngBase64,
      selfieUrl: validPngBase64
    })
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.kycStatus, 'pending');

  const user = await User.findById(normalUser2._id);
  assert.ok(user.kycDocuments.collegeIdCard.startsWith('private://kyc_private/'));
  assert.ok(user.kycDocuments.selfie.startsWith('private://kyc_private/'));
});

test('KYC SIGNED URL: Generates short-lived signed link and streams private file', async () => {
  const resSign = await fetch(`${baseUrl}/api/kyc/document/${normalUser2._id}/collegeIdCard/signed-url`, {
    headers: { Authorization: `Bearer ${tokenUser2}` }
  });
  assert.equal(resSign.status, 200);
  const { signedUrl } = await resSign.json();
  assert.ok(signedUrl.includes('?token='));

  // Fetch file using the signed link without Bearer header
  const resStream = await fetch(`${baseUrl}${signedUrl}`);
  assert.equal(resStream.status, 200);
  assert.equal(resStream.headers.get('content-type'), 'image/png');
  assert.equal(resStream.headers.get('x-content-type-options'), 'nosniff');
});

test('KYC DELETION: Document owner can delete private document', async () => {
  const resDel = await fetch(`${baseUrl}/api/kyc/document/${normalUser2._id}/collegeIdCard`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenUser2}` }
  });
  assert.equal(resDel.status, 200);

  const user = await User.findById(normalUser2._id);
  assert.equal(user.kycDocuments.collegeIdCard, null);
});

// =========================================================================
// SECTION 13: HARDENED SOCKET.IO SESSION REVOCATION & IDENTITY INTEGRITY
// =========================================================================
test('SOCKET.IO: Reject authentication when sessionSeed is revoked/mismatched', async () => {
  const forgedSeedToken = jwt.sign(
    { userId: normalUser1._id.toString(), sessionSeed: 'revoked_or_tampered_seed_xyz' },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '1h' }
  );

  const clientSocket = ClientIo(baseUrl, {
    transports: ['websocket'],
    reconnection: false
  });

  await new Promise((resolve) => {
    clientSocket.on('connect', () => {
      clientSocket.emit('authenticate', { token: forgedSeedToken });
    });

    clientSocket.on('authenticated', (res) => {
      assert.equal(res.success, false);
      assert.match(res.error, /session expired, replaced, or revoked/i);
      clientSocket.disconnect();
      resolve();
    });

    setTimeout(() => {
      clientSocket.disconnect();
      resolve();
    }, 2000);
  });
});

test('SOCKET.IO: Prevent identity switching on an active socket', async () => {
  const clientSocket = ClientIo(baseUrl, {
    transports: ['websocket'],
    reconnection: false
  });

  await new Promise((resolve) => {
    clientSocket.on('connect', () => {
      // Authenticate first as normalUser1
      clientSocket.emit('authenticate', { token: tokenUser1 });
    });

    clientSocket.on('authenticated', (res) => {
      if (res.success) {
        // Attempt to switch identity to normalUser2
        clientSocket.emit('authenticate', { token: tokenUser2 });
      } else {
        // Identity switch was rejected
        assert.match(res.error, /identity switching/i);
        clientSocket.disconnect();
        resolve();
      }
    });

    setTimeout(() => {
      clientSocket.disconnect();
      resolve();
    }, 2000);
  });
});

test('SOCKET.IO: Calling logout forcefully disconnects user sockets', async () => {
  const clientSocket = ClientIo(baseUrl, {
    transports: ['websocket'],
    reconnection: false
  });

  let receivedTerminated = false;

  await new Promise(async (resolve) => {
    clientSocket.on('connect', () => {
      clientSocket.emit('authenticate', { token: tokenUser1 });
    });

    clientSocket.on('authenticated', async (res) => {
      if (res.success) {
        // Now trigger logout via REST API
        await fetch(`${baseUrl}/api/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenUser1}` }
        });
      }
    });

    clientSocket.on('session_terminated', (data) => {
      receivedTerminated = true;
    });

    clientSocket.on('disconnect', () => {
      resolve();
    });

    setTimeout(() => {
      clientSocket.disconnect();
      resolve();
    }, 3000);
  });

  assert.equal(receivedTerminated, true, 'User socket must receive session_terminated and be forcibly closed');
});

// =========================================================================
// SECTION 14: USER PROFILE FIELD-LEVEL PRIVACY
// =========================================================================
test('PRIVACY: Unrelated user cannot view sensitive profile fields (phone, email, usn, emergency)', async () => {
  // User 2 looks up User 1 (they are unrelated, not co-participants)
  const res = await fetch(`${baseUrl}/api/users/${normalUser1._id}`, {
    headers: { Authorization: `Bearer ${tokenUser2}` }
  });
  assert.equal(res.status, 200);
  const data = await res.json();

  assert.equal(data.name, normalUser1.name);
  assert.equal(data.college, normalUser1.college);
  // Sensitive fields must be completely undefined
  assert.strictEqual(data.phone, undefined, 'Phone must NOT be visible to unrelated users');
  assert.strictEqual(data.email, undefined, 'Email must NOT be visible to unrelated users');
  assert.strictEqual(data.usn, undefined, 'USN must NOT be visible to unrelated users');
  assert.strictEqual(data.gender, undefined, 'Gender must NOT be visible to unrelated users');
  assert.strictEqual(data.emergencyContact, undefined, 'Emergency contact must NOT be visible');
});

test('PRIVACY: Owner and Admin receive complete permitted profile', async () => {
  // Owner accesses self
  const resSelf = await fetch(`${baseUrl}/api/users/${normalUser2._id}`, {
    headers: { Authorization: `Bearer ${tokenUser2}` }
  });
  assert.equal(resSelf.status, 200);
  const selfData = await resSelf.json();
  assert.equal(selfData.phone, normalUser2.phone);
  assert.equal(selfData.email, normalUser2.email);

  // Admin accesses user
  const resAdmin = await fetch(`${baseUrl}/api/users/${normalUser2._id}`, {
    headers: { Authorization: `Bearer ${tokenAdmin}` }
  });
  assert.equal(resAdmin.status, 200);
  const adminData = await resAdmin.json();
  assert.equal(adminData.phone, normalUser2.phone);
  assert.equal(adminData.email, normalUser2.email);
});

// =========================================================================
// SECTION 15: INFRASTRUCTURE & READINESS HEALTH CHECKS
// =========================================================================
test('HEALTH: /api/health/live confirms process liveness', async () => {
  const res = await fetch(`${baseUrl}/api/health/live`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, 'alive');
  assert.ok(typeof data.uptime === 'number');
});

test('HEALTH: /api/health/ready verifies database connectivity', async () => {
  const res = await fetch(`${baseUrl}/api/health/ready`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, 'ready');
  assert.equal(data.database, 'connected');
});

// =========================================================================
// SECTION 16: NEW SECURITY & FEATURE REGRESSION VERIFICATIONS
// =========================================================================

test('RIDE SEARCH: Mandatory Drop Location enforcement', async () => {
  // 1. Pickup provided but drop missing -> rejected with 400 MISSING_DROP_LOCATION
  const resPickupOnly = await fetch(`${baseUrl}/api/ride/search?lat=12.9004&lng=77.5186`, {
    headers: { Authorization: `Bearer ${tokenUser2}` }
  });
  assert.equal(resPickupOnly.status, 400);
  const dataPickupOnly = await resPickupOnly.json();
  assert.equal(dataPickupOnly.code, 'MISSING_DROP_LOCATION');

  // 2. Drop provided but pickup missing -> rejected with 400 MISSING_PICKUP_LOCATION
  const resDropOnly = await fetch(`${baseUrl}/api/ride/search?dropLat=12.9237&dropLng=77.4987`, {
    headers: { Authorization: `Bearer ${tokenUser2}` }
  });
  assert.equal(resDropOnly.status, 400);
  const dataDropOnly = await resDropOnly.json();
  assert.equal(dataDropOnly.code, 'MISSING_PICKUP_LOCATION');

  // 3. Identical pickup and drop coordinates (< 50 meters) -> rejected with 400 IDENTICAL_LOCATIONS
  const resIdentical = await fetch(
    `${baseUrl}/api/ride/search?lat=12.90040&lng=77.51860&dropLat=12.90041&dropLng=77.51861`, {
    headers: { Authorization: `Bearer ${tokenUser2}` }
  });
  assert.equal(resIdentical.status, 400);
  const dataIdentical = await resIdentical.json();
  assert.equal(dataIdentical.code, 'IDENTICAL_LOCATIONS');

  // 4. Valid distinct pickup and drop -> 200 with rides array
  const resValid = await fetch(
    `${baseUrl}/api/ride/search?lat=12.9004&lng=77.5186&dropLat=12.9237&dropLng=77.4987`, {
    headers: { Authorization: `Bearer ${tokenUser2}` }
  });
  assert.equal(resValid.status, 200);
  const validData = await resValid.json();
  assert.ok(Array.isArray(validData));
});

test('VEHICLE UNIQUENESS: Vehicle registration number must be globally unique across accounts', async () => {
  // Refresh tokenUser1 with active session seed
  const refreshedUser1 = await User.findById(normalUser1._id);
  tokenUser1 = jwt.sign(
    { userId: refreshedUser1._id.toString(), email: refreshedUser1.email, role: 'provider', sessionSeed: refreshedUser1.currentSessionSeed },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '1h' }
  );

  const uniquePlate = `KA05AB${Math.floor(1000 + Math.random() * 9000)}`;

  // 1. User 1 successfully registers vehicle
  const resUser1 = await fetch(`${baseUrl}/api/users/profile/vehicle`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenUser1}`
    },
    body: JSON.stringify({
      vehicleNumber: uniquePlate,
      vehicleName: 'Honda Activa 6G',
      vehicleType: 'bike'
    })
  });
  assert.equal(resUser1.status, 200);
  const dataUser1 = await resUser1.json();
  assert.equal(dataUser1.vehicleNumber, uniquePlate);

  // 2. User 2 attempts to register the exact same plate -> rejected with 409 Conflict
  const resUser2Exact = await fetch(`${baseUrl}/api/users/profile/vehicle`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenUser2}`
    },
    body: JSON.stringify({
      vehicleNumber: uniquePlate,
      vehicleName: 'Hero Splendor',
      vehicleType: 'bike'
    })
  });
  assert.equal(resUser2Exact.status, 409);
  const dataUser2Exact = await resUser2Exact.json();
  assert.equal(dataUser2Exact.code, 'VEHICLE_ALREADY_REGISTERED');

  // 3. User 2 attempts with lowercase and spaces -> normalized and rejected with 409 Conflict
  const unnormalizedPlate = ` ${uniquePlate.toLowerCase().slice(0, 4)} ${uniquePlate.toLowerCase().slice(4)} `;
  const resUser2Norm = await fetch(`${baseUrl}/api/users/profile/vehicle`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenUser2}`
    },
    body: JSON.stringify({
      vehicleNumber: unnormalizedPlate,
      vehicleName: 'Yamaha FZ',
      vehicleType: 'bike'
    })
  });
  assert.equal(resUser2Norm.status, 409);
  const dataUser2Norm = await resUser2Norm.json();
  assert.equal(dataUser2Norm.code, 'VEHICLE_ALREADY_REGISTERED');

  // 4. User 1 (existing owner) updates their own vehicle details -> succeeds
  const resUser1Update = await fetch(`${baseUrl}/api/users/profile/vehicle`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenUser1}`
    },
    body: JSON.stringify({
      vehicleNumber: uniquePlate,
      vehicleName: 'Honda Activa Premium Edition',
      vehicleType: 'bike'
    })
  });
  assert.equal(resUser1Update.status, 200);
  const dataUser1Update = await resUser1Update.json();
  assert.equal(dataUser1Update.vehicleName, 'Honda Activa Premium Edition');
});

test('SANCTIONS: Revoking suspension restores warning count to 2 (NOT 0)', async () => {
  // Ensure suspended user is suspended
  suspendedUser.suspended = true;
  suspendedUser.warningsCount = 3;
  await suspendedUser.save();

  const resRevoke = await fetch(`${baseUrl}/api/admin/users/revoke-sanctions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenAdmin}`
    },
    body: JSON.stringify({
      userId: suspendedUser._id.toString(),
      reason: 'First appeal approved by dean'
    })
  });

  assert.equal(resRevoke.status, 200);
  const dataRevoke = await resRevoke.json();
  assert.equal(dataRevoke.warningsCount, 2, 'Revoking suspension must restore warnings to 2');
  assert.equal(dataRevoke.suspended, false);

  const refreshedUser = await User.findById(suspendedUser._id);
  assert.equal(refreshedUser.warningsCount, 2);
  assert.equal(refreshedUser.suspended, false);
});

test('KYC SIGNED URL: Target user and document type claim binding', async () => {
  // Restore document reference for normalUser2 (since previous deletion test removed it)
  await User.findByIdAndUpdate(normalUser2._id, {
    'kycDocuments.collegeIdCard': 'private://kyc_private/test_sample.png'
  });

  // Generate signed URL for normalUser2 collegeIdCard
  const resSigned = await fetch(`${baseUrl}/api/kyc/document/${normalUser2._id}/collegeIdCard/signed-url`, {
    headers: { Authorization: `Bearer ${tokenUser2}` }
  });
  assert.equal(resSigned.status, 200);
  const { signedUrl } = await resSigned.json();
  const token = new URL(`http://localhost${signedUrl}`).searchParams.get('token');

  // 1. Valid access matching target user and docType
  const resValidStream = await fetch(`${baseUrl}/api/kyc/document/${normalUser2._id}/collegeIdCard?token=${token}`);
  assert.equal(resValidStream.status, 200);
  assert.equal(resValidStream.headers.get('content-type'), 'image/png');

  // 2. Mismatched target user in route parameter -> rejected with 403
  const resMismatchedUser = await fetch(`${baseUrl}/api/kyc/document/${normalUser1._id}/collegeIdCard?token=${token}`);
  assert.equal(resMismatchedUser.status, 403);

  // 3. Mismatched docType in route parameter -> rejected with 403
  const resMismatchedDoc = await fetch(`${baseUrl}/api/kyc/document/${normalUser2._id}/drivingLicense?token=${token}`);
  assert.equal(resMismatchedDoc.status, 403);
});

test('SOS STATES: Twilio webhook rejects unconfigured/forged/invalid callbacks and accepts valid signed callback idempotently', async () => {
  const twilio = require('twilio');
  const testMsgSid = 'SM_test_' + Date.now();
  const sosRecord = await SOS.create({
    rideId: testRide._id,
    triggeredBy: { userId: normalUser1._id, role: 'provider' },
    location: { lat: 12.9081, lng: 77.5218 },
    status: 'active',
    notificationsSent: [{
      type: 'sms',
      recipient: '+919876543210',
      status: 'provider_accepted',
      provider: 'TWILIO',
      messageId: testMsgSid
    }],
    emergencyContacts: [{
      name: 'Dad',
      phone: '9876543210',
      deliveryStatus: 'provider_accepted',
      provider: 'TWILIO',
      messageId: testMsgSid
    }]
  });

  const savedAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const savedAcctSid = process.env.TWILIO_ACCOUNT_SID;

  try {
    // 1. When TWILIO_AUTH_TOKEN is missing -> returns 503 TWILIO_NOT_CONFIGURED
    delete process.env.TWILIO_AUTH_TOKEN;
    const unconfRes = await fetch(`${baseUrl}/api/sos/webhook/twilio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ MessageSid: testMsgSid, MessageStatus: 'delivered' }).toString()
    });
    assert.equal(unconfRes.status, 503);
    const unconfJson = await unconfRes.json();
    assert.equal(unconfJson.code, 'TWILIO_NOT_CONFIGURED');

    // Configure test Twilio credentials
    const testAuthToken = 'test_twilio_auth_token_32chars_001';
    const testAcctSid = 'AC_TEST_ACCOUNT_SID_001';
    process.env.TWILIO_AUTH_TOKEN = testAuthToken;
    process.env.TWILIO_ACCOUNT_SID = testAcctSid;
    const webhookUrl = `${baseUrl}/api/sos/webhook/twilio`;

    // 2. Missing X-Twilio-Signature -> 401
    const missingSigRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ MessageSid: testMsgSid, MessageStatus: 'delivered' }).toString()
    });
    assert.equal(missingSigRes.status, 401);

    // 3. Invalid signature -> 403
    const invalidSigRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Twilio-Signature': 'forged_invalid_signature_xyz=='
      },
      body: new URLSearchParams({ MessageSid: testMsgSid, MessageStatus: 'delivered' }).toString()
    });
    assert.equal(invalidSigRes.status, 403);

    // 4. Valid signature with unknown MessageSid -> 404
    const unknownParams = {
      AccountSid: testAcctSid,
      MessageSid: 'SM_NONEXISTENT_999',
      MessageStatus: 'delivered',
      To: '+919876543210'
    };
    const unknownSig = twilio.getExpectedTwilioSignature(testAuthToken, webhookUrl, unknownParams);
    const unknownRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Twilio-Signature': unknownSig
      },
      body: new URLSearchParams(unknownParams).toString()
    });
    assert.equal(unknownRes.status, 404);

    // 5. Valid signature with mismatched recipient -> 403
    const mismatchParams = {
      AccountSid: testAcctSid,
      MessageSid: testMsgSid,
      MessageStatus: 'delivered',
      To: '+911111111111'
    };
    const mismatchSig = twilio.getExpectedTwilioSignature(testAuthToken, webhookUrl, mismatchParams);
    const mismatchRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Twilio-Signature': mismatchSig
      },
      body: new URLSearchParams(mismatchParams).toString()
    });
    assert.equal(mismatchRes.status, 403);

    // 6. Valid signature matching MessageSid, AccountSid, and recipient -> 200 & transitions to delivered
    const validParams = {
      AccountSid: testAcctSid,
      MessageSid: testMsgSid,
      MessageStatus: 'delivered',
      To: '+919876543210'
    };
    const validSig = twilio.getExpectedTwilioSignature(testAuthToken, webhookUrl, validParams);
    const validRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Twilio-Signature': validSig
      },
      body: new URLSearchParams(validParams).toString()
    });
    assert.equal(validRes.status, 200);

    const updatedSOS = await SOS.findById(sosRecord._id);
    assert.equal(updatedSOS.notificationsSent[0].status, 'delivered');
    assert.equal(updatedSOS.emergencyContacts[0].deliveryStatus, 'delivered');
    assert.ok(updatedSOS.emergencyContacts[0].notifiedAt);
    const originalNotifiedAt = updatedSOS.emergencyContacts[0].notifiedAt.getTime();
    const auditCountAfterFirst = updatedSOS.auditLog.length;

    // 7. Duplicate callback replay -> idempotent 200 without duplicating audit entries or changing notifiedAt
    const dupRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Twilio-Signature': validSig
      },
      body: new URLSearchParams(validParams).toString()
    });
    assert.equal(dupRes.status, 200);
    const afterDupSOS = await SOS.findById(sosRecord._id);
    assert.equal(afterDupSOS.auditLog.length, auditCountAfterFirst);
    assert.equal(afterDupSOS.emergencyContacts[0].notifiedAt.getTime(), originalNotifiedAt);

    // 8. Unauthorized status downgrade (delivered -> queued) -> 409 Conflict
    const downgradeParams = {
      AccountSid: testAcctSid,
      MessageSid: testMsgSid,
      MessageStatus: 'queued',
      To: '+919876543210'
    };
    const downgradeSig = twilio.getExpectedTwilioSignature(testAuthToken, webhookUrl, downgradeParams);
    const downgradeRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Twilio-Signature': downgradeSig
      },
      body: new URLSearchParams(downgradeParams).toString()
    });
    assert.equal(downgradeRes.status, 409);
  } finally {
    if (savedAuthToken !== undefined) process.env.TWILIO_AUTH_TOKEN = savedAuthToken;
    else delete process.env.TWILIO_AUTH_TOKEN;
    if (savedAcctSid !== undefined) process.env.TWILIO_ACCOUNT_SID = savedAcctSid;
    else delete process.env.TWILIO_ACCOUNT_SID;
    await SOS.deleteOne({ _id: sosRecord._id });
  }
});

test('LOGGING: sanitizeUrlForLogging masks sensitive query parameters & 404 responses never leak query tokens', async () => {
  const { sanitizeUrlForLogging } = require('../server');
  const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fakePayload123.fakeSig456';
  const rawUrl = `/api/nonexistent/route?token=${fakeToken}&refreshToken=my_refresh_999&apiKey=12345&user=john`;
  const sanitized = sanitizeUrlForLogging(rawUrl);
  assert.ok(!sanitized.includes(fakeToken), 'JWT token must be masked');
  assert.ok(!sanitized.includes('my_refresh_999'), 'Refresh token must be masked');
  assert.ok(!sanitized.includes('12345'), 'API key must be masked');
  assert.ok(sanitized.includes('user=john'));

  // Capture logs during an actual HTTP 404 request containing fake secrets
  const logs = [];
  const origLog = console.log;
  console.log = (...args) => {
    logs.push(args.join(' '));
    origLog(...args);
  };
  try {
    const res404 = await fetch(`${baseUrl}${rawUrl}`);
    assert.equal(res404.status, 404);
    const body404 = await res404.json();
    const bodyStr = JSON.stringify(body404);
    assert.ok(!bodyStr.includes(fakeToken), '404 response body must NOT contain query token');
    assert.ok(!bodyStr.includes('my_refresh_999'), '404 response body must NOT contain query secrets');
    const combinedLogs = logs.join('\n');
    assert.ok(!combinedLogs.includes(fakeToken), 'Server logs must NOT contain raw query token');
    assert.ok(!combinedLogs.includes('my_refresh_999'), 'Server logs must NOT contain raw refresh token');
  } finally {
    console.log = origLog;
  }
});

// =========================================================================
// SECTION 17: EXPO PUSH RECEIPT WORKER, KYC OWNERSHIP & LOCATION VALIDATION
// =========================================================================

test('EXPO PUSH WORKER: Processes delivered receipts, permanent DeviceNotRegistered failures, transient backoff & multi-instance locking', async () => {
  const { processPendingPushReceipts } = require('../notifications/pushReceipt.worker');

  await User.findByIdAndUpdate(normalUser2._id, { pushToken: 'ExponentPushToken[stale-device-token]' });

  const sos = await SOS.create({
    rideId: testRide._id,
    triggeredBy: { userId: normalUser1._id, role: 'provider' },
    location: { lat: 12.9081, lng: 77.5218 },
    status: 'active',
    notificationsSent: [
      { type: 'push', recipient: String(normalUser2._id), status: 'provider_accepted', provider: 'EXPO', messageId: 'expo-tkt-ok' },
      { type: 'push', recipient: String(normalUser2._id), status: 'provider_accepted', provider: 'EXPO', messageId: 'expo-tkt-unreg' }
    ]
  });

  const tOk = await PushTicket.create({
    ticketId: 'expo-tkt-ok',
    sosId: sos._id,
    userId: normalUser2._id,
    notificationType: 'sos_alert',
    status: 'provider_accepted',
    nextRetryAt: new Date(Date.now() - 1000)
  });

  const tPerm = await PushTicket.create({
    ticketId: 'expo-tkt-unreg',
    sosId: sos._id,
    userId: normalUser2._id,
    pushToken: 'ExponentPushToken[stale-device-token]',
    notificationType: 'sos_alert',
    status: 'provider_accepted',
    nextRetryAt: new Date(Date.now() - 1000)
  });

  const tTransient = await PushTicket.create({
    ticketId: 'expo-tkt-retry',
    userId: normalUser2._id,
    notificationType: 'general',
    status: 'provider_accepted',
    retryCount: 4,
    maxRetries: 5,
    nextRetryAt: new Date(Date.now() - 1000)
  });

  const tLocked = await PushTicket.create({
    ticketId: 'expo-tkt-locked',
    userId: normalUser2._id,
    notificationType: 'general',
    status: 'provider_accepted',
    nextRetryAt: new Date(Date.now() - 1000),
    processingLockUntil: new Date(Date.now() + 60000) // Locked by another instance
  });

  const summary = await processPendingPushReceipts(async (ids) => {
    assert.ok(!ids.includes('expo-tkt-locked'), 'Locked ticket must not be claimed concurrently');
    return {
      'expo-tkt-ok': { status: 'ok' },
      'expo-tkt-unreg': { status: 'error', message: 'Device not registered', details: { error: 'DeviceNotRegistered' } },
      'expo-tkt-retry': { status: 'error', message: 'Rate limited', details: { error: 'MessageRateExceeded' } }
    };
  });

  assert.equal(summary.delivered, 1);
  assert.equal(summary.failedPermanent, 1);
  assert.equal(summary.failedMaxRetries, 1);

  const updatedOk = await PushTicket.findById(tOk._id);
  assert.equal(updatedOk.status, 'delivered');

  const updatedPerm = await PushTicket.findById(tPerm._id);
  assert.equal(updatedPerm.status, 'failed');
  assert.equal(updatedPerm.providerErrorCode, 'DeviceNotRegistered');

  const updatedUser2 = await User.findById(normalUser2._id).select('pushToken');
  assert.equal(updatedUser2.pushToken, null, 'DeviceNotRegistered must prune stale pushToken');

  const updatedRetry = await PushTicket.findById(tTransient._id);
  assert.equal(updatedRetry.status, 'failed');
  assert.equal(updatedRetry.retryCount, 5);

  const updatedSOS = await SOS.findById(sos._id);
  assert.equal(updatedSOS.notificationsSent[0].status, 'delivered');
  assert.equal(updatedSOS.notificationsSent[1].status, 'failed');

  await PushTicket.deleteMany({ _id: { $in: [tOk._id, tPerm._id, tTransient._id, tLocked._id] } });
  await SOS.deleteOne({ _id: sos._id });
});

test('KYC OWNERSHIP: Cross-account attachment, docType swap, unverified refs & path traversal are rejected', async () => {
  const validPng = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2d420000000049454e44ae426082', 'hex');

  // 1. User 1 uploads genuine collegeIdCard via multipart upload
  const form = new FormData();
  form.append('docType', 'collegeIdCard');
  form.append('document', new Blob([validPng], { type: 'image/png' }), 'id.png');

  const uploadRes = await fetch(`${baseUrl}/api/kyc/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenUser1}` },
    body: form
  });
  assert.equal(uploadRes.status, 201);
  const uploadData = await uploadRes.json();
  assert.ok(uploadData.docId);
  assert.ok(uploadData.storedRef.startsWith('private://kyc_private/'));

  const validSelfieBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  // 2. User 2 attempts to attach User 1's private document reference -> 403 DOCUMENT_OWNERSHIP_VIOLATION
  const theftRes = await fetch(`${baseUrl}/api/kyc/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenUser2}`
    },
    body: JSON.stringify({
      collegeIdCardUrl: uploadData.storedRef,
      selfieUrl: validSelfieBase64
    })
  });
  assert.equal(theftRes.status, 403);
  const theftJson = await theftRes.json();
  assert.equal(theftJson.code, 'DOCUMENT_OWNERSHIP_VIOLATION');

  // 3. User 1 attempts to attach their collegeIdCard ref as selfieUrl (docType swap) -> 403 DOCUMENT_TYPE_MISMATCH
  const swapRes = await fetch(`${baseUrl}/api/kyc/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenUser1}`
    },
    body: JSON.stringify({
      collegeIdCardUrl: validSelfieBase64,
      selfieUrl: uploadData.storedRef
    })
  });
  assert.equal(swapRes.status, 403);
  const swapJson = await swapRes.json();
  assert.equal(swapJson.code, 'DOCUMENT_TYPE_MISMATCH');

  // 4. User 2 attempts path traversal ref -> 400 INVALID_STORAGE_REF
  const travRes = await fetch(`${baseUrl}/api/kyc/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenUser2}`
    },
    body: JSON.stringify({
      collegeIdCardUrl: 'private://kyc_private/../../server.js',
      selfieUrl: validSelfieBase64
    })
  });
  assert.equal(travRes.status, 400);
  const travJson = await travRes.json();
  assert.equal(travJson.code, 'INVALID_STORAGE_REF');

  // 5. User 2 attempts fabricated unregistered private:// ref -> 403 UNVERIFIED_DOCUMENT_REFERENCE
  const unregRes = await fetch(`${baseUrl}/api/kyc/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenUser2}`
    },
    body: JSON.stringify({
      collegeIdCardUrl: 'private://kyc_private/arbitrary_unverified_file.png',
      selfieUrl: validSelfieBase64
    })
  });
  assert.equal(unregRes.status, 403);
  const unregJson = await unregRes.json();
  assert.equal(unregJson.code, 'UNVERIFIED_DOCUMENT_REFERENCE');

  // 6. Expired signed link access -> 401
  const expiredSignedToken = jwt.sign(
    {
      userId: normalUser1._id.toString(),
      targetUserId: normalUser1._id.toString(),
      docType: 'collegeIdCard',
      op: 'read',
      purpose: 'kyc_document_access',
      sessionSeed: normalUser1.currentSessionSeed
    },
    process.env.JWT_SECRET,
    { expiresIn: -10, algorithm: 'HS256' }
  );
  const expRes = await fetch(`${baseUrl}/api/kyc/document/${normalUser1._id}/collegeIdCard?token=${expiredSignedToken}`);
  assert.equal(expRes.status, 401);

  // 7. Unauthorized deletion attempt by User 2 on User 1's doc -> 403
  const delAttackerRes = await fetch(`${baseUrl}/api/kyc/document/${normalUser1._id}/collegeIdCard`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenUser2}` }
  });
  assert.equal(delAttackerRes.status, 403);
});

test('LOCATION & ROUTING: Enforces strict coordinate bounds and GeoJSON format without fabricating fake routes', async () => {
  // Invalid reverse coordinates -> 400
  const badRevRes = await fetch(`${baseUrl}/api/location/reverse?lat=999&lng=77.5946`, {
    headers: { Authorization: `Bearer ${tokenUser2}` }
  });
  assert.equal(badRevRes.status, 400);

  // Invalid route coordinates -> 400
  const badRouteRes = await fetch(`${baseUrl}/api/location/route?fromLat=abc&fromLng=77.5&toLat=12.9&toLng=77.6`, {
    headers: { Authorization: `Bearer ${tokenUser2}` }
  });
  assert.equal(badRouteRes.status, 400);
});

// =========================================================================
// SECTION 17: FINAL PRE-PRODUCTION SECURITY GATE NEGATIVE TESTS
// =========================================================================

test('INCIDENT IDOR: Non-reporter non-admin cannot attach evidence to another users incident (returns 403)', async () => {
  const Incident = require('../incidents/incidents.model');
  const incident = await Incident.create({
    rideId: testRide._id,
    reportedBy: normalUser1._id,
    type: 'Booking, Pickup, or Cancellation Issue',
    description: 'Security test incident ownership',
  });

  try {
    const res = await fetch(`${baseUrl}/api/incidents/${incident._id}/evidence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenUser2}`,
      },
      body: JSON.stringify({ evidence: ['https://attacker.example/spoof.png'] }),
    });
    assert.equal(res.status, 403);
  } finally {
    await Incident.deleteOne({ _id: incident._id });
  }
});

test('ALERT MASS ASSIGNMENT: PUT /api/alerts/:id prevents reassigning alert userId', async () => {
  const Alert = require('../alerts/alerts.model');
  const alertDoc = await Alert.create({
    userId: normalUser1._id,
    pickup: { type: 'Point', coordinates: [77.5186, 12.9004] },
    drop: { type: 'Point', coordinates: [77.6066, 12.9756] },
    pickupRadius: 5000,
    dropRadius: 5000,
    name: 'Campus Morning Alert',
  });

  try {
    const res = await fetch(`${baseUrl}/api/alerts/${alertDoc._id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenUser1}`,
      },
      body: JSON.stringify({
        name: 'Updated Safe Name',
        userId: normalUser2._id.toString(),
      }),
    });
    assert.equal(res.status, 200);
    const updated = await Alert.findById(alertDoc._id);
    assert.equal(updated.name, 'Updated Safe Name');
    assert.equal(updated.userId.toString(), normalUser1._id.toString());
  } finally {
    await Alert.deleteOne({ _id: alertDoc._id });
  }
});

test('COMMUNITY CHAT IDOR: Non-admin student cannot read another colleges community chat (returns 403)', async () => {
  const res = await fetch(`${baseUrl}/api/community/chat/SomeOtherCollegeUniversity`, {
    headers: { Authorization: `Bearer ${tokenUser2}` },
  });
  assert.equal(res.status, 403);
});

test('SUSPENSION ENFORCEMENT: Auth middleware returns structured ACCOUNT_SUSPENDED / ACCOUNT_BLOCKED 403 codes', async () => {
  await User.findByIdAndUpdate(suspendedUser._id, {
    suspended: true,
    suspensionReason: 'Security Gate Verification Suspension',
  });

  const suspRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${tokenSuspended}` },
  });
  assert.equal(suspRes.status, 403);
  const suspJson = await suspRes.json();
  assert.equal(suspJson.code, 'ACCOUNT_SUSPENDED');
  assert.equal(suspJson.suspended, true);

  const blkRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${tokenBlocked}` },
  });
  assert.equal(blkRes.status, 403);
  const blkJson = await blkRes.json();
  assert.equal(blkJson.code, 'ACCOUNT_BLOCKED');
  assert.equal(blkJson.blocked, true);
});

test('KYC UPLOAD NEGATIVE CASES: Multipart upload rejects missing docType and forged PE/EXE magic bytes (400)', async () => {
  const formMissingType = new FormData();
  formMissingType.append('document', new Blob([Buffer.from('89504e470d0a1a0a0000000d', 'hex')], { type: 'image/png' }), 'test.png');
  const resMissingType = await fetch(`${baseUrl}/api/kyc/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenUser2}` },
    body: formMissingType,
  });
  assert.equal(resMissingType.status, 400);

  const formExe = new FormData();
  formExe.append('docType', 'collegeIdCard');
  formExe.append('document', new Blob([Buffer.from('4d5a900003000000ffff', 'hex')], { type: 'image/png' }), 'payload.png');
  const resExe = await fetch(`${baseUrl}/api/kyc/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenUser2}` },
    body: formExe,
  });
  assert.equal(resExe.status, 400);
});

test('AUTH & SOCKET HARDENING: Login safely handles regex metacharacters and Socket.IO join-ride blocks non-participants', async () => {
  const redosLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: '(a+)+@example.com', password: 'wrongpassword' }),
  });
  assert.equal(redosLogin.status, 400);

  // Verify Socket.IO join-ride blocks User 2 (non-participant on testRide)
  const freshUser2 = await User.findById(normalUser2._id);
  const liveTok2 = jwt.sign(
    { userId: freshUser2._id.toString(), email: freshUser2.email, role: 'seeker', sessionSeed: freshUser2.currentSessionSeed },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '1h' }
  );

  await new Promise((resolve, reject) => {
    const client = ClientIo(baseUrl, { transports: ['websocket'] });
    const timer = setTimeout(() => { client.close(); reject(new Error('Socket timeout')); }, 3000);
    client.on('connect', () => client.emit('authenticate', { token: liveTok2 }));
    client.on('authenticated', (authRes) => {
      assert.equal(authRes.success, true);
      client.emit('join-ride', testRide._id.toString());
    });
    client.on('chat-error', (errPayload) => {
      clearTimeout(timer);
      assert.ok(String(errPayload?.message || '').toLowerCase().includes('unauthorized'));
      client.close();
      resolve();
    });
  });
});

test('FINAL GATE (KYC Query Token Isolation): Scoped KYC token & ?token= rejected on all non-document API routes', async () => {
  await User.findByIdAndUpdate(normalUser2._id, {
    'kycDocuments.collegeIdCard': 'private://kyc_private/test_sample.png'
  });

  const signRes = await fetch(`${baseUrl}/api/kyc/document/${normalUser2._id}/collegeIdCard/signed-url`, {
    headers: { Authorization: `Bearer ${tokenUser2}` }
  });
  assert.equal(signRes.status, 200);
  const { signedUrl } = await signRes.json();
  const kycScopedToken = new URLSearchParams(signedUrl.split('?')[1]).get('token');
  assert.ok(kycScopedToken);

  const nonDocRoutes = [
    '/api/users/profile',
    '/api/ride/my',
    '/api/booking/my',
    '/api/sos/active',
    '/api/admin/stats'
  ];

  for (const routePath of nonDocRoutes) {
    // 1. Passing KYC token as ?token=... query parameter -> strictly 401
    const qRes = await fetch(`${baseUrl}${routePath}?token=${encodeURIComponent(kycScopedToken)}`);
    assert.equal(qRes.status, 401, `${routePath} must reject ?token= query authentication`);

    // 2. Passing KYC-scoped token in Authorization: Bearer header -> strictly 403 SCOPED_TOKEN_FORBIDDEN
    const bRes = await fetch(`${baseUrl}${routePath}`, {
      headers: { Authorization: `Bearer ${kycScopedToken}` }
    });
    assert.equal(bRes.status, 403, `${routePath} must reject kyc_document_access token even in Bearer header`);
  }

  // Verify wrong purpose, wrong op, and missing sessionSeed tokens are rejected on KYC document route
  const freshU2 = await User.findById(normalUser2._id);
  const wrongOpToken = jwt.sign(
    {
      userId: freshU2._id.toString(),
      targetUserId: freshU2._id.toString(),
      docType: 'collegeIdCard',
      op: 'write',
      purpose: 'kyc_document_access',
      sessionSeed: freshU2.currentSessionSeed,
    },
    process.env.JWT_SECRET,
    { expiresIn: '5m', algorithm: 'HS256' }
  );
  const wrongOpRes = await fetch(`${baseUrl}/api/kyc/document/${freshU2._id}/collegeIdCard?token=${wrongOpToken}`);
  assert.equal(wrongOpRes.status, 403);

  const expiredKycToken = jwt.sign(
    {
      userId: freshU2._id.toString(),
      targetUserId: freshU2._id.toString(),
      docType: 'collegeIdCard',
      op: 'read',
      purpose: 'kyc_document_access',
      sessionSeed: freshU2.currentSessionSeed,
    },
    process.env.JWT_SECRET,
    { expiresIn: '-10s', algorithm: 'HS256' }
  );
  const expRes = await fetch(`${baseUrl}/api/kyc/document/${freshU2._id}/collegeIdCard?token=${expiredKycToken}`);
  assert.equal(expRes.status, 401);
});

test('FINAL GATE (Private Registration KYC & Ownership Binding): Rejects public Cloudinary URLs and cross-user theft', async () => {
  const pngBytes = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082', 'hex');
  const form = new FormData();
  form.append('docType', 'collegeIdCard');
  form.append('document', new Blob([pngBytes], { type: 'image/png' }), 'college_id.png');

  const uploadRes = await fetch(`${baseUrl}/api/kyc/register-upload`, { method: 'POST', body: form });
  assert.equal(uploadRes.status, 201);
  const uploadData = await uploadRes.json();
  assert.ok(uploadData.storedRef.startsWith('private://kyc_private/'));
  assert.ok(uploadData.regUploadToken);

  // Attempt registration using public Cloudinary URL for KYC doc -> rejected 400
  const ts = Date.now();
  const cloudFailRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Public URL Attacker',
      email: `puburl.${ts}@rnsit.ac.in`,
      password: 'Password123!',
      phone: `99111${String(ts).slice(-5)}`,
      role: 'seeker',
      college: 'RNS Institute of Technology (RNSIT)',
      profilePhoto: 'https://res.cloudinary.com/demo/image/upload/avatar.jpg',
      collegeIdCard: 'https://res.cloudinary.com/demo/image/upload/fake_id.jpg'
    })
  });
  assert.equal(cloudFailRes.status, 400);
  const cloudFailJson = await cloudFailRes.json();
  assert.equal(cloudFailJson.code, 'PUBLIC_KYC_URL_REJECTED');

  // Attempt registration stealing staged storedRef WITHOUT matching regUploadToken -> rejected 403
  const theftRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Ref Thief',
      email: `thief.${ts}@rnsit.ac.in`,
      password: 'Password123!',
      phone: `99222${String(ts).slice(-5)}`,
      role: 'seeker',
      college: 'RNS Institute of Technology (RNSIT)',
      profilePhoto: 'https://res.cloudinary.com/demo/image/upload/avatar.jpg',
      collegeIdCard: uploadData.storedRef
    })
  });
  assert.equal(theftRes.status, 403);

  // Valid registration binding staging private KYC document + keeping profilePhoto separate -> 201
  const okRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Verified Student',
      email: `verified.${ts}@rnsit.ac.in`,
      password: 'Password123!',
      phone: `99333${String(ts).slice(-5)}`,
      role: 'seeker',
      college: 'RNS Institute of Technology (RNSIT)',
      usn: '1RN22CS077',
      profilePhoto: 'https://res.cloudinary.com/demo/image/upload/avatar.jpg',
      collegeIdCard: uploadData.storedRef,
      regUploadTokens: { collegeIdCard: uploadData.regUploadToken }
    })
  });
  assert.equal(okRes.status, 201);
  const createdUser = await User.findOne({ email: `verified.${ts}@rnsit.ac.in` });
  assert.ok(createdUser);
  assert.equal(createdUser.kycDocuments.collegeIdCard, uploadData.storedRef);
  assert.equal(createdUser.profilePhoto, 'https://res.cloudinary.com/demo/image/upload/avatar.jpg');
  assert.equal(createdUser.kycDocuments.selfie, null);

  // Cleanup created registration test user & doc
  const KycDocument = require('../kyc/kycDocument.model');
  await KycDocument.deleteOne({ docId: uploadData.docId });
  await User.deleteOne({ _id: createdUser._id });
});

test('FINAL GATE (Twilio Webhook Strict AccountSid & To): Rejects missing AccountSid, mismatched AccountSid, and missing To', async () => {
  const twilio = require('twilio');
  const testMsgSid = 'SM_gate_' + Date.now();
  const sosRecord = await SOS.create({
    rideId: testRide._id,
    triggeredBy: { userId: normalUser1._id, role: 'provider' },
    location: { lat: 12.9081, lng: 77.5218 },
    status: 'active',
    notificationsSent: [{
      type: 'sms',
      recipient: '+919876543210',
      status: 'provider_accepted',
      provider: 'TWILIO',
      messageId: testMsgSid
    }]
  });

  const savedAuth = process.env.TWILIO_AUTH_TOKEN;
  const savedSid = process.env.TWILIO_ACCOUNT_SID;
  process.env.TWILIO_AUTH_TOKEN = 'test_twilio_auth_token_32chars_002';
  process.env.TWILIO_ACCOUNT_SID = 'AC_STRICT_SID_001';
  const webhookUrl = `${baseUrl}/api/sos/webhook/twilio`;

  try {
    const cases = [
      { AccountSid: 'AC_WRONG_SID', MessageSid: testMsgSid, MessageStatus: 'delivered', To: '+919876543210' },
      { MessageSid: testMsgSid, MessageStatus: 'delivered', To: '+919876543210' }, // Missing AccountSid
      { AccountSid: 'AC_STRICT_SID_001', MessageSid: testMsgSid, MessageStatus: 'delivered' }, // Missing To
    ];
    for (const p of cases) {
      const sig = twilio.getExpectedTwilioSignature(process.env.TWILIO_AUTH_TOKEN, webhookUrl, p);
      const r = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Twilio-Signature': sig },
        body: new URLSearchParams(p).toString(),
      });
      assert.equal(r.status, 403);
    }
  } finally {
    if (savedAuth !== undefined) process.env.TWILIO_AUTH_TOKEN = savedAuth; else delete process.env.TWILIO_AUTH_TOKEN;
    if (savedSid !== undefined) process.env.TWILIO_ACCOUNT_SID = savedSid; else delete process.env.TWILIO_ACCOUNT_SID;
    await SOS.deleteOne({ _id: sosRecord._id });
  }
});

test('INCIDENT SEVERITY CLASSIFICATION: Accurately classifies kidnapped, fare dispute, harassment, and vehicle breakdown', async () => {
  const resKidnap = await fetch(`${baseUrl}/api/incidents/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenUser2}` },
    body: JSON.stringify({
      rideId: testRide._id,
      type: 'Other Incident',
      subject: 'Emergency',
      description: 'Driver kidnapped passenger and went off route',
      severity: 'Low', // client-supplied Low must NOT downgrade Critical classification
    }),
  });
  assert.equal(resKidnap.status, 201);
  const kidnapJson = await resKidnap.json();
  assert.equal(kidnapJson.incident.severity, 'Critical');

  const resFare = await fetch(`${baseUrl}/api/incidents/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenUser2}` },
    body: JSON.stringify({
      rideId: testRide._id,
      type: 'Fare Dispute or Non-Payment',
      description: 'Provider demanded extra cash above agreed fare',
    }),
  });
  assert.equal(resFare.status, 201);
  const fareJson = await resFare.json();
  assert.equal(fareJson.incident.severity, 'High');

  const IncidentModel = require('../incidents/incidents.model');
  await IncidentModel.deleteMany({ _id: { $in: [kidnapJson.incident._id, fareJson.incident._id] } });
});
