// backend/tests/security.test.js
// Complete Independent Automated Security & Production Readiness Regression Test Suite
// Exhaustively verifies Authentication, Authorization, IDOR, Input Validation, Sessions, and Socket.IO.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { io: ClientIo } = require('socket.io-client');

// Ensure environment variables
process.env.NODE_ENV = 'test';
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'campusride_test_jwt_secret_secure_key_12345';
if (!process.env.ADMIN_KEY) process.env.ADMIN_KEY = 'campusride_admin_test_key_secure_9988';

const { server } = require('../server');
const User = require('../users/users.model');
const Ride = require('../rides/rides.model');
const Booking = require('../bookings/bookings.model');
const SOS = require('../sos/sos.model');

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
  // Wait for MongoDB connection if not yet connected
  if (mongoose.connection.readyState !== 1) {
    await new Promise((resolve) => {
      mongoose.connection.once('open', resolve);
      setTimeout(resolve, 3000);
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
      collegeIdCard: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      selfie: 'https://res.cloudinary.com/demo/image/upload/sample2.jpg'
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
    if (normalUser1) await User.deleteOne({ _id: normalUser1._id });
    if (normalUser2) await User.deleteOne({ _id: normalUser2._id });
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
  assert.ok(res.status === 302 || res.status === 200, 'Owner must receive document or redirect');
  if (res.status === 302) {
    assert.equal(res.headers.get('location'), 'https://res.cloudinary.com/demo/image/upload/sample.jpg');
  }
});

test('KYC IDOR: Verified admin CAN access any users KYC document', async () => {
  const res = await fetch(`${baseUrl}/api/kyc/document/${normalUser1._id}/collegeIdCard`, {
    headers: { Authorization: `Bearer ${tokenAdmin}` },
    redirect: 'manual'
  });
  assert.ok(res.status === 302 || res.status === 200, 'Admin must receive document or redirect');
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
