# HOGO (CampusRide) — Security Architecture & Design Document

**Version:** 2.0 (Hardened Production Baseline)  
**Classification:** Engineering Architecture Reference  

---

## 1. Architectural Overview & System Topology

HOGO (CampusRide) employs a defense-in-depth architecture designed for secure peer-to-peer campus ride sharing. The system integrates mobile endpoints, stateless API gateways, real-time event brokers, distributed document storage, and third-party verified identity systems.

```
+-----------------------------------------------------------------------------------------+
|                                    MOBILE TIER                                          |
|                                                                                         |
|   +------------------------------------+    +---------------------------------------+   |
|   |   React Native / Expo Application  |    |    Hardware-Backed Security Storage   |   |
|   |   - React Navigation               |    |    - expo-secure-store                |   |
|   |   - Socket.IO Client (TLS 1.3)     |    |    - Android KeyStore / iOS Keychain  |   |
|   |   - Expo Location (Active rides)   |    |    - In-Memory Nonce Handshake        |   |
|   +------------------------------------+    +---------------------------------------+   |
+-----------------------------------------------------------------------------------------+
                                           |
                                [HTTPS / WSS TLS 1.3]
                                [Certificate Pinning]
                                           |
+-----------------------------------------------------------------------------------------+
|                                  GATEWAY & EDGE                                         |
|                                                                                         |
|   +-------------------+    +--------------------+    +-------------------------------+  |
|   |  Reverse Proxy    | -> |   Helmet Headers   | -> |    express-rate-limit         |  |
|   |  Cloudflare Edge  |    |   - Strict CSP     |    |    - Global: 600 req/15m      |  |
|   |  DDoS Mitigation  |    |   - X-Frame-Options|    |    - Auth: 25 req/15m         |  |
|   +-------------------+    +--------------------+    +-------------------------------+  |
+-----------------------------------------------------------------------------------------+
                                           |
+-----------------------------------------------------------------------------------------+
|                             APPLICATION & SERVICES TIER                                 |
|                                                                                         |
|   +---------------------------------------------------------------------------------+   |
|   |                             Express 5 Engine                                    |   |
|   |                                                                                 |   |
|   |  [mongo-sanitize Middleware]                                                    |   |
|   |     Strips NoSQL operators ($where, $ne, $gt) from body, query, and params      |   |
|   |                                                                                 |   |
|   |  [auth Middleware (JWT HS256)]                                                  |   |
|   |     - Single-Device Session Seed Validation                                     |   |
|   |     - Real-Time Account Status Check (Blocked/Suspended)                        |   |
|   |                                                                                 |   |
|   |  [isAdmin Authorization Middleware]                                             |   |
|   |     - Server-side DB validation (Strict user.role === 'admin' or Admin record)  |   |
|   |                                                                                 |   |
|   |  [Object-Level Access Controllers]                                              |   |
|   |     - Ride participant authorization on Chat & GPS tracking                     |   |
|   |     - Document ownership check on KYC endpoints                                 |   |
|   |     - Scoped administrative emergency SOS broadcasts                            |   |
|   +---------------------------------------------------------------------------------+   |
|                                           |                                             |
|   +---------------------------------------+-----------------------------------------+   |
|   |                                       |                                         |   |
|   v                                       v                                         v   |
| +---------------------+   +-------------------------------+   +-----------------------+ |
| |   Socket.IO Server  |   |    Cloud & External Services  |   |     MongoDB 9.0+      | |
| | - Authenticated JWT |   |  - Brevo (Transactional Email)|   | - TLS In-Transit      | |
| | - Isolated Rooms:   |   |  - Expo Push Notification     |   | - 2dsphere Indexes    | |
| |     ride:{id}       |   |  - Cloudinary Private Bucket  |   | - Session Storage     | |
| |     admin           |   +-------------------------------+   +-----------------------+ |
| +---------------------+                                                                 |
+-----------------------------------------------------------------------------------------+
```

---

## 2. Core Cryptographic Standards

### 2.1 JSON Web Tokens (JWT)
- **Algorithm:** Explicitly restricted to `HS256` (HMAC with SHA-256) via `{ algorithms: ['HS256'] }`. Any attempts to present unsigned tokens (`none`) or asymmetric keys (`RS256`) are rejected with `401 Unauthorized`.
- **Secret Management:** Minimum 256-bit entropy secret loaded from `process.env.JWT_SECRET`.
- **Payload Composition:**
  ```json
  {
    "userId": "6b0221647c47a3a6ed4a628e",
    "email": "student@rnsit.ac.in",
    "role": "seeker",
    "sessionSeed": "a1b2c3d4e5f6g7h8",
    "iat": 1795321000,
    "exp": 1795324600
  }
  ```

### 2.2 Password Hashing
- **Algorithm:** `bcryptjs` with salt work factor of 10 rounds.
- **Enforcement:** Passwords never stored or logged in plaintext. Automatically excluded from database queries via `select: false` or explicit projection stripping.

### 2.3 One-Time Password (OTP) Generation
- **Source:** Cryptographically secure pseudo-random number generator using Node.js `crypto.randomInt(100000, 1000000)`.
- **Expiry:** Strict 5-minute time-to-live (TTL).
- **Brute-Force Safeguards:** Maximum 5 attempts allowed per OTP. Exceeding 5 attempts immediately invalidates the OTP.
- **Cooldown:** 60-second cooldown per email address enforced in memory and database.

---

## 3. Session Lifecycle & Token Storage

### 3.1 Mobile Secure Storage
- Replaced insecure browser-style `AsyncStorage` with hardware-backed `expo-secure-store`.
- **Android:** Uses Android KeyStore provider with AES-256-GCM encryption backed by hardware Trusted Execution Environment (TEE) or StrongBox Keymaster.
- **iOS:** Uses iOS Keychain with `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`.

### 3.2 Single-Device Session Enforcement
- Each user record maintains a `currentSessionSeed`.
- When a user logs in on a new device, a fresh cryptographic `sessionSeed` is generated and saved to their profile.
- When an existing device makes an API call with an older token, the `auth` middleware detects the mismatched `sessionSeed` and rejects the request with code `SESSION_REPLACED`, forcing a clean logout on the old device.
- On password reset, `currentSessionSeed` is rotated and all active devices are immediately invalidated.

---

## 4. WebSocket & Event Stream Security

### 4.1 Connection & Handshake Authentication
1. Socket connection initiates over WSS (TLS 1.3).
2. Client emits `authenticate` event providing `{ token: "<JWT>" }`.
3. Server verifies token against `process.env.JWT_SECRET` with `HS256`.
4. Server queries MongoDB to confirm the user exists, is active, and is not blocked or suspended.
5. Server binds `socket.userId` and `socket.userRole` to the verified identity.

### 4.2 Room Isolation & Emergency Alert Routing
- **`ride:{rideId}`:** Only the assigned driver and accepted passengers can join.
- **`admin` / `admins`:** Only clients whose database-verified role is `'admin'` can join.
- **SOS Broadcast:** When a rider activates SOS, coordinates are emitted specifically to `io.to('admin')` and the specific `ride:{rideId}` room. Global broadcast (`io.emit`) has been eliminated.

---

## 5. Defense-in-Depth Summary

1. **Edge:** Rate limiting, IP tracking, TLS 1.3 termination.
2. **Gateway:** Helmet security headers, CORS origin validation, NoSQL injection filtering.
3. **Authentication:** Single-device enforcement, HS256 algorithm pinning, secure OTP lifecycle.
4. **Authorization:** Database-verified administrative checks, object-level participant checks on chat and GPS.
5. **Storage:** Cloudinary signed URLs for KYC documents, bcrypt password hashing, field projections.
