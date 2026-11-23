// backend/tests/load_test_runner.js
// Reproducible Benchmark and Concurrency Stress Test Harness

const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'campusride_test_jwt_secret_secure_key_12345';

const { server } = require('../server');
const User = require('../users/users.model');
const Ride = require('../rides/rides.model');

async function runBenchmark(concurrency, totalRequests, testToken, port) {
  console.log(`\n======================================================`);
  console.log(`🚀 RUNNING BENCHMARK: Concurrency = ${concurrency}, Total Requests = ${totalRequests}`);
  console.log(`======================================================`);

  const latencies = [];
  let successful = 0;
  let failed = 0;
  let inFlight = 0;
  let completed = 0;
  let requestIndex = 0;

  const startMem = process.memoryUsage();
  const startTime = Date.now();

  const endpoints = [
    { path: '/socket-test', method: 'GET', auth: false },
    { path: '/api/ride/search?pickupLat=12.9081&pickupLng=77.5218&dropLat=12.9150&dropLng=77.5312', method: 'GET', auth: true },
    { path: '/api/users/profile', method: 'GET', auth: true }
  ];

  return new Promise((resolve) => {
    function launchNext() {
      if (requestIndex >= totalRequests) {
        if (inFlight === 0) finish();
        return;
      }

      requestIndex++;
      inFlight++;

      const endpoint = endpoints[requestIndex % endpoints.length];
      const headers = { 'Connection': 'keep-alive' };
      if (endpoint.auth) headers['Authorization'] = `Bearer ${testToken}`;

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
          const latency = Date.now() - reqStart;
          latencies.push(latency);
          if (res.statusCode >= 200 && res.statusCode < 400) {
            successful++;
          } else {
            failed++;
          }
          inFlight--;
          completed++;
          launchNext();
        });
      });

      req.on('error', (err) => {
        failed++;
        inFlight--;
        completed++;
        launchNext();
      });

      req.setTimeout(10000, () => {
        req.destroy();
      });

      req.end();
    }

    function finish() {
      const totalTimeMs = Date.now() - startTime;
      const totalTimeSec = totalTimeMs / 1000;
      const rps = (completed / totalTimeSec).toFixed(2);
      latencies.sort((a, b) => a - b);

      const p50 = latencies[Math.floor(latencies.length * 0.50)] || 0;
      const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
      const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
      const errorRate = ((failed / completed) * 100).toFixed(3);
      const endMem = process.memoryUsage();
      const rssMB = (endMem.rss / (1024 * 1024)).toFixed(1);

      console.log(`⏱️  Duration: ${totalTimeSec.toFixed(2)}s`);
      console.log(`📊 Completed: ${completed} (Success: ${successful}, Failed: ${failed})`);
      console.log(`⚡ Throughput: ${rps} req/sec`);
      console.log(`📈 Latency P50: ${p50}ms | P95: ${p95}ms | P99: ${p99}ms`);
      console.log(`❌ Error Rate: ${errorRate}%`);
      console.log(`🧠 Memory RSS: ${rssMB} MB`);

      resolve({
        concurrency,
        completed,
        successful,
        failed,
        rps: parseFloat(rps),
        p50,
        p95,
        p99,
        errorRate: parseFloat(errorRate),
        durationSec: totalTimeSec,
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

async function main() {
  if (mongoose.connection.readyState !== 1) {
    await new Promise((resolve) => mongoose.connection.once('open', resolve));
  }

  const testServer = await new Promise((resolve) => {
    const s = server.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = testServer.address().port;

  const timestamp = Date.now();
  const seed = 'load_test_seed_' + timestamp;
  const testUser = await User.create({
    name: 'Load Test Runner',
    email: `load_${timestamp}@example.com`,
    phone: '9900112233',
    password: '$2a$10$hashedpasswordforsecuritytestingpurposesonly',
    role: 'both',
    college: 'RNS Institute of Technology',
    currentSessionSeed: seed
  });

  const testToken = jwt.sign(
    { userId: testUser._id.toString(), sessionSeed: seed },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '2h' }
  );

  const results = [];

  try {
    // Tier 1: 100 Concurrent Users
    results.push(await runBenchmark(100, 1000, testToken, port));

    // Tier 2: 500 Concurrent Users
    results.push(await runBenchmark(500, 2500, testToken, port));

    // Tier 3: 1,000 Concurrent Users
    results.push(await runBenchmark(1000, 4000, testToken, port));
  } catch (err) {
    console.error('Benchmark execution error:', err.message);
  } finally {
    await User.deleteOne({ _id: testUser._id });
    await new Promise(r => testServer.close(r));
    await mongoose.disconnect();
  }

  console.log('\n======================================================');
  console.log('SUMMARY OF REAL BENCHMARK RESULTS');
  console.log('======================================================');
  console.table(results);
}

if (require.main === module) {
  main().catch(console.error);
}
