// backend/tests/load_test_runner.js
// Realistic Multi-Endpoint Concurrency & Stress Testing Harness
const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { io: ioClient } = require('socket.io-client');

process.env.NODE_ENV = 'test';
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'campusride_test_jwt_secret_secure_key_12345';

const { server } = require('../server');
const connectDB = require('../config/db');
const User = require('../users/users.model');
const Ride = require('../rides/rides.model');
const Booking = require('../bookings/bookings.model');

async function runBenchmark(concurrency, totalRequests, testToken, port, testRideId) {
  console.log(`\n======================================================`);
  console.log(`🚀 BENCHMARK TIER: Concurrency = ${concurrency}, Total Requests = ${totalRequests}`);
  console.log(`======================================================`);

  const latencies = [];
  let res2xx = 0;
  let res3xx = 0;
  let res4xx = 0;
  let res429 = 0;
  let res5xx = 0;
  let networkErrors = 0;
  let timeouts = 0;
  let inFlight = 0;
  let completed = 0;
  let requestIndex = 0;

  const startCpu = process.cpuUsage();
  const startMem = process.memoryUsage();
  const startTime = Date.now();

  const endpoints = [
    { path: '/api/health/ready', method: 'GET', auth: false, weight: 1 },
    { path: '/api/users/profile', method: 'GET', auth: true, weight: 3 },
    { path: '/api/ride/search?pickupLat=12.9081&pickupLng=77.5218&dropLat=12.9150&dropLng=77.5312', method: 'GET', auth: true, weight: 4 },
    { path: `/api/sos/ride/${testRideId}/active`, method: 'GET', auth: true, weight: 2 },
    { path: '/api/notifications', method: 'GET', auth: true, weight: 2 },
  ];

  // Flatten based on weights for realistic traffic distribution
  const weightedList = [];
  endpoints.forEach(e => {
    for (let w = 0; w < e.weight; w++) weightedList.push(e);
  });

  return new Promise((resolve) => {
    function launchNext() {
      if (requestIndex >= totalRequests) {
        if (inFlight === 0) finish();
        return;
      }

      requestIndex++;
      inFlight++;

      const endpoint = weightedList[requestIndex % weightedList.length];
      const headers = { 'Connection': 'keep-alive' };
      if (endpoint.auth) headers['Authorization'] = `Bearer ${testToken}`;

      let timedOut = false;
      const reqStart = Date.now();
      const req = http.request({
        hostname: '127.0.0.1',
        port: port,
        path: endpoint.path,
        method: endpoint.method,
        headers: headers
      }, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          if (timedOut) return;
          const latency = Date.now() - reqStart;
          latencies.push(latency);

          if (res.statusCode >= 200 && res.statusCode < 300) {
            res2xx++;
          } else if (res.statusCode >= 300 && res.statusCode < 400) {
            res3xx++;
          } else if (res.statusCode === 429) {
            res429++;
          } else if (res.statusCode >= 400 && res.statusCode < 500) {
            res4xx++;
          } else if (res.statusCode >= 500) {
            res5xx++;
          }

          inFlight--;
          completed++;
          launchNext();
        });
      });

      req.on('error', (err) => {
        if (timedOut) return;
        networkErrors++;
        inFlight--;
        completed++;
        launchNext();
      });

      req.setTimeout(8000, () => {
        timedOut = true;
        timeouts++;
        req.destroy();
        inFlight--;
        completed++;
        launchNext();
      });

      req.end();
    }

    function finish() {
      const totalTimeMs = Date.now() - startTime;
      const totalTimeSec = totalTimeMs / 1000;
      const throughput2xx = (res2xx / totalTimeSec).toFixed(2);
      const totalThroughput = (completed / totalTimeSec).toFixed(2);
      latencies.sort((a, b) => a - b);

      const p50 = latencies[Math.floor(latencies.length * 0.50)] || 0;
      const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
      const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
      const serverErrRate = completed > 0 ? (((res5xx + networkErrors + timeouts) / completed) * 100).toFixed(2) : '0.00';
      const rateLimitRate = completed > 0 ? ((res429 / completed) * 100).toFixed(2) : '0.00';
      const clientErrRate = completed > 0 ? ((res4xx / completed) * 100).toFixed(2) : '0.00';
      
      const endMem = process.memoryUsage();
      const rssMB = (endMem.rss / (1024 * 1024)).toFixed(1);
      const cpuUsed = process.cpuUsage(startCpu);
      const cpuSec = ((cpuUsed.user + cpuUsed.system) / 1000000).toFixed(2);

      console.log(`⏱️  Duration: ${totalTimeSec.toFixed(2)}s | CPU: ${cpuSec}s | RSS: ${rssMB} MB`);
      console.log(`📊 Completed Requests: ${completed}`);
      console.log(`   - 2xx (Success):       ${res2xx}`);
      console.log(`   - 3xx (Redirect):      ${res3xx}`);
      console.log(`   - 4xx (Client Error):  ${res4xx} (${clientErrRate}%)`);
      console.log(`   - 429 (Rate Limited):  ${res429} (${rateLimitRate}%)`);
      console.log(`   - 5xx (Server Error):  ${res5xx}`);
      console.log(`   - Network Errors:      ${networkErrors}`);
      console.log(`   - Timeouts (>8s):      ${timeouts}`);
      console.log(`⚡ 2xx Application Throughput: ${throughput2xx} req/sec`);
      console.log(`⚡ Total Pipeline Throughput:  ${totalThroughput} req/sec`);
      console.log(`📈 Latency P50: ${p50}ms | P95: ${p95}ms | P99: ${p99}ms`);
      console.log(`❌ Server/Network Error Rate: ${serverErrRate}%`);

      resolve({
        concurrency,
        requests: totalRequests,
        completed,
        res2xx,
        res3xx,
        res4xx,
        res429,
        res5xx,
        networkErrors,
        timeouts,
        throughput2xx: parseFloat(throughput2xx),
        totalThroughput: parseFloat(totalThroughput),
        p50,
        p95,
        p99,
        serverErrRate: `${serverErrRate}%`,
        rateLimitRate: `${rateLimitRate}%`,
        clientErrRate: `${clientErrRate}%`,
        durationSec: parseFloat(totalTimeSec.toFixed(2)),
        rssMB: parseFloat(rssMB)
      });
    }

    // Spawn initial pool matching concurrency
    const initialWorkers = Math.min(concurrency, totalRequests);
    for (let i = 0; i < initialWorkers; i++) {
      launchNext();
    }
  });
}

// Test Socket.IO concurrency under load
async function testSocketLoad(port, testToken, count = 50) {
  console.log(`\n======================================================`);
  console.log(`📡 SOCKET.IO CONCURRENCY TEST: ${count} Concurrent WebSocket Clients`);
  console.log(`======================================================`);

  const sockets = [];
  let authenticated = 0;
  let connectionErrors = 0;

  for (let i = 0; i < count; i++) {
    const s = ioClient(`http://127.0.0.1:${port}`, {
      transports: ['websocket'],
      reconnection: false
    });

    s.on('connect', () => {
      s.emit('authenticate', { token: testToken });
    });

    s.on('authenticated', (res) => {
      if (res?.success) authenticated++;
    });

    s.on('connect_error', () => {
      connectionErrors++;
    });

    sockets.push(s);
  }

  // Allow connections to settle
  await new Promise(r => setTimeout(r, 2000));

  console.log(`📡 Socket connections attempted: ${count}`);
  console.log(`✅ Authenticated sockets: ${authenticated}`);
  console.log(`❌ Socket connection errors: ${connectionErrors}`);

  // Disconnect all test sockets
  sockets.forEach(s => {
    try { s.disconnect(); } catch (_) {}
  });

  return { attempted: count, authenticated, connectionErrors };
}

async function main() {
  await connectDB();

  const testServer = await new Promise((resolve) => {
    const s = server.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = testServer.address().port;

  const timestamp = Date.now();
  const seed = 'load_seed_' + timestamp;
  const testUser = await User.create({
    name: 'Load Benchmark User',
    email: `load_${timestamp}@example.com`,
    phone: '9876543299',
    password: '$2a$10$hashedpasswordforsecuritytestingpurposesonly',
    role: 'both',
    college: 'RNS Institute of Technology',
    currentSessionSeed: seed
  });

  const testRide = await Ride.create({
    providerId: testUser._id,
    pickup: {
      type: 'Point',
      coordinates: [77.5218, 12.9081],
      address: 'RNSIT Campus Gate'
    },
    drop: {
      type: 'Point',
      coordinates: [77.5312, 12.9150],
      address: 'Kengeri Metro Station'
    },
    date: new Date(Date.now() + 86400000),
    time: '10:00',
    seatsAvailable: 3,
    costPerSeat: 40,
    status: 'active',
    college: 'RNS Institute of Technology'
  });

  const testToken = jwt.sign(
    { userId: testUser._id.toString(), sessionSeed: seed },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '2h' }
  );

  const results = [];

  try {
    // 1. Socket Load Test
    const socketStats = await testSocketLoad(port, testToken, 50);

    // 2. HTTP Tiers
    // Tier 1: 100 Concurrent Users
    results.push(await runBenchmark(100, 1000, testToken, port, testRide._id));

    // Tier 2: 500 Concurrent Users
    results.push(await runBenchmark(500, 2500, testToken, port, testRide._id));

    // Tier 3: 1,000 Concurrent Users
    results.push(await runBenchmark(1000, 5000, testToken, port, testRide._id));

    console.log('\n======================================================');
    console.log('SUMMARY OF REAL BENCHMARK RESULTS');
    console.log('======================================================');
    console.table(results);

    console.log('\n------------------------------------------------------');
    console.log('HIGH CONCURRENCY SCALING DISCLOSURE:');
    console.log('Tier 5,000 & 10,000 Users: NOT EXECUTED ON LOCAL WORKSTATION');
    console.log('Reason: Operating system ephemeral port and socket descriptor limits on a single');
    console.log('developer machine distort high concurrency results.');
    console.log('Production target: Deploy multi-container horizontal autoscaling behind AWS ALB / Cloudflare.');
    console.log('------------------------------------------------------');

  } catch (err) {
    console.error('Benchmark execution error:', err.message);
  } finally {
    await Booking.deleteMany({ rideId: testRide._id });
    await Ride.deleteOne({ _id: testRide._id });
    await User.deleteOne({ _id: testUser._id });
    await new Promise(r => testServer.close(r));
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch(console.error);
}
