// backend/tests/security.test.js
// Automated Production-Grade Security Regression Test Suite
// Verifies authorization, IDOR protections, credential security, headers, and input sanitization.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// Ensure environment variables
process.env.NODE_ENV = 'test';
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'campusride_test_jwt_secret_secure_key_12345';
if (!process.env.ADMIN_KEY) process.env.ADMIN_KEY = 'campusride_admin_test_key_secure_9988';

const { server } = require('../server');
const User = require('../users/users.model');
const Ride = require('../rides/rides.model');

let baseUrl;
let testServer;
let normalUser1;
let normalUser2;
let adminUser;
let testRide;
let tokenUser1;
let tokenUser2;
let tokenAdmin;

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
      const port = testServer.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  const timestamp = Date.now();

  // Create test normal user 1
  normalUser1 = await User.create({
    name: 'Security Test User 1',
    email: `sec_test1_${timestamp}@example.com`,
    phone: '9876543210',
    password: '$2a$10$hashedpasswordforsecuritytestingpurposesonly',
    role: 'seeker',
    college: 'RNS Institute of Technology',
    kycStatus: 'approved',
    kycDocuments: {
      collegeIdCard: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      selfie: 'https://res.cloudinary.com/demo/image/upload/sample2.jpg'
    }
  });

  // Create test normal user 2
  normalUser2 = await User.create({
    name: 'Security Test User 2',
    email: `sec_test2_${timestamp}@example.com`,
    phone: '9876543211',
    password: '$2a$10$hashedpasswordforsecuritytestingpurposesonly',
    role: 'seeker',
    college: 'RNS Institute of Technology'
  });

  // Create test admin user
  adminUser = await User.create({
    name: 'Security Test Admin',
    email: `sec_admin_${timestamp}@example.com`,
    phone: '9876543212',
    password: '$2a$10$hashedpasswordforsecuritytestingpurposesonly',
    role: 'admin',
    college: 'CampusRide Admin HQ'
  });

  // Create a test ride owned by normalUser1
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

  tokenUser1 = jwt.sign(
    { userId: normalUser1._id.toString(), email: normalUser1.email, role: 'seeker' },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '1h' }
  );

  tokenUser2 = jwt.sign(
    { userId: normalUser2._id.toString(), email: normalUser2.email, role: 'seeker' },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '1h' }
  );

  tokenAdmin = jwt.sign(
    { userId: adminUser._id.toString(), email: adminUser.email, role: 'admin' },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '1h' }
  );
});

after(async () => {
  // Cleanup test database entries
  try {
    if (normalUser1) await User.deleteOne({ _id: normalUser1._id });
    if (normalUser2) await User.deleteOne({ _id: normalUser2._id });
    if (adminUser) await User.deleteOne({ _id: adminUser._id });
    if (testRide) await Ride.deleteOne({ _id: testRide._id });
  } catch (err) {
    console.error('Test cleanup error:', err.message);
  }

  // Close server
  if (testServer) {
    await new Promise((resolve) => testServer.close(resolve));
  }

  // Disconnect mongoose
  try {
    await mongoose.disconnect();
  } catch (e) {}
});

// =========================================================================
// 1. CRITICAL VULNERABILITY: UNCHECKED PASSWORD RESET REMOVAL
// =========================================================================
test('CRITICAL: /api/auth/reset-password-direct is permanently disabled (returns 404)', async () => {
  const res = await fetch(`${baseUrl}/api/auth/reset-password-direct`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalUser1.email, newPassword: 'AttackerPassword123!' })
  });

  assert.equal(res.status, 404, 'Direct unauthenticated password reset endpoint must not exist');
});

// =========================================================================
// 2. SECURITY HEADERS (HELMET) & CORS
// =========================================================================
test('SECURITY HEADERS: Helmet headers are present on responses', async () => {
  const res = await fetch(`${baseUrl}/socket-test`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'SAMEORIGIN');
});

// =========================================================================
// 3. ADMIN PRIVILEGE ESCALATION & AUTHORIZATION CHECKS
// =========================================================================
test('AUTHORIZATION: Unauthenticated requests to /api/admin/users are rejected with 401', async () => {
  const res = await fetch(`${baseUrl}/api/admin/users`);
  assert.equal(res.status, 401);
});

test('AUTHORIZATION: Non-admin users cannot access /api/admin/users (returns 403)', async () => {
  const res = await fetch(`${baseUrl}/api/admin/users`, {
    headers: { Authorization: `Bearer ${tokenUser1}` }
  });
  assert.equal(res.status, 403);
});

test('AUTHORIZATION: Verified admin can access /api/admin/users', async () => {
  const res = await fetch(`${baseUrl}/api/admin/users`, {
    headers: { Authorization: `Bearer ${tokenAdmin}` }
  });
  assert.equal(res.status, 200);
});

test('AUTHORIZATION: Non-admin users cannot access KYC pending queue /api/kyc/admin/pending', async () => {
  const res = await fetch(`${baseUrl}/api/kyc/admin/pending`, {
    headers: { Authorization: `Bearer ${tokenUser1}` }
  });
  assert.equal(res.status, 403);
});

test('AUTHORIZATION: Non-admin users cannot access all SOS alerts /api/sos/admin/all', async () => {
  const res = await fetch(`${baseUrl}/api/sos/admin/all`, {
    headers: { Authorization: `Bearer ${tokenUser1}` }
  });
  assert.equal(res.status, 403);
});

test('AUTHORIZATION: Non-admin users cannot access incident reports /api/incidents/all', async () => {
  const res = await fetch(`${baseUrl}/api/incidents/all`, {
    headers: { Authorization: `Bearer ${tokenUser1}` }
  });
  assert.equal(res.status, 403);
});

// =========================================================================
// 4. KYC DOCUMENT IDOR PROTECTION
// =========================================================================
test('IDOR: Unauthenticated requests to /api/kyc/document/:userId/:docType are rejected with 401', async () => {
  const res = await fetch(`${baseUrl}/api/kyc/document/${normalUser1._id}/collegeIdCard`);
  assert.equal(res.status, 401);
});

test('IDOR: Another user cannot view user 1 KYC documents (returns 403)', async () => {
  const res = await fetch(`${baseUrl}/api/kyc/document/${normalUser1._id}/collegeIdCard`, {
    headers: { Authorization: `Bearer ${tokenUser2}` }
  });
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.match(data.message, /access denied|forbidden/i);
});

test('IDOR: Document owner CAN access their own KYC documents', async () => {
  const res = await fetch(`${baseUrl}/api/kyc/document/${normalUser1._id}/collegeIdCard`, {
    headers: { Authorization: `Bearer ${tokenUser1}` },
    redirect: 'manual'
  });
  // Expect 302 redirect to Cloudinary URL or 200 if fetched
  assert.ok(res.status === 302 || res.status === 200, 'Owner must be granted access (redirected or served)');
  if (res.status === 302) {
    assert.equal(res.headers.get('location'), 'https://res.cloudinary.com/demo/image/upload/sample.jpg');
  }
});

// =========================================================================
// 5. PUBLIC PROFILE PRIVACY LEAK PREVENTION
// =========================================================================
test('PRIVACY: Public user profile does NOT expose kycDocuments', async () => {
  const res = await fetch(`${baseUrl}/api/users/${normalUser1._id}`, {
    headers: { Authorization: `Bearer ${tokenUser2}` }
  });
  assert.equal(res.status, 200);
  const profile = await res.json();
  assert.equal(profile.kycDocuments, undefined, 'kycDocuments must be excluded from public profile');
  assert.equal(profile.password, undefined, 'password hash must never be returned');
});

// =========================================================================
// 6. MASS ASSIGNMENT DEFENSE
// =========================================================================
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
      gender: 'male'
    })
  });

  assert.equal(res.status, 200);

  // Check database directly to confirm role was NOT modified
  const userInDb = await User.findById(normalUser2._id);
  assert.equal(userInDb.role, 'seeker', 'Role must remain seeker; mass assignment attack was neutralized');
  assert.equal(userInDb.kycStatus, 'not_submitted', 'KYC status must not be modified via profile update');
  assert.equal(userInDb.gender, 'male', 'Legitimate profile field update succeeded');
});

// =========================================================================
// 7. RIDE CHAT & TRACKING IDOR PROTECTION
// =========================================================================
test('IDOR: Non-participants cannot view ride chat messages (returns 403)', async () => {
  const res = await fetch(`${baseUrl}/api/chat/${testRide._id}`, {
    headers: { Authorization: `Bearer ${tokenUser2}` }
  });
  assert.equal(res.status, 403);
});

test('IDOR: Non-participants cannot view live ride tracking coordinates (returns 403)', async () => {
  const res = await fetch(`${baseUrl}/api/tracking/${testRide._id}`, {
    headers: { Authorization: `Bearer ${tokenUser2}` }
  });
  assert.equal(res.status, 403);
});

// =========================================================================
// 8. JWT ALGORITHM RESTRICTION (HS256 ONLY)
// =========================================================================
test('JWT: "none" algorithm token is rejected with 401', async () => {
  // Craft unsigned token
  const noneToken = jwt.sign(
    { userId: normalUser1._id.toString() },
    '',
    { algorithm: 'none' }
  );

  const res = await fetch(`${baseUrl}/api/users/${normalUser1._id}`, {
    headers: { Authorization: `Bearer ${noneToken}` }
  });
  assert.equal(res.status, 401);
});
