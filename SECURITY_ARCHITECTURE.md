# HOGO (CampusRide) — Production Security Architecture

**Document Version:** 3.0  
**Updated:** November 25, 2026  
**Status:** Implemented and Verified (Single-Instance Render Storage + Mocked/Simulated External Providers)  

---

## 1. Architectural Principles

1. **Defense in Depth**: Security controls operate across multiple layers—reverse proxy (HTTPS, CORS, Helmet headers), application middleware (JWT authentication, single-device session seed verification, NoSQL sanitization, rate limiting), domain controllers (ownership checks, relation-based access controls), and private storage layers (magic bytes, isolated disk directory, authenticated streaming).
2. **Fail Closed**: In production, absent database credentials or unverified configurations immediately terminate process startup (`process.exit(1)`). Unconfigured emergency delivery mechanisms report `NOT_CONFIGURED` and require native client action rather than falsely asserting success.
3. **Least Privilege & Zero Trust**: No client-supplied role or identity is trusted. Roles and admin privileges are re-verified from MongoDB. Unrelated users receive stripped public profiles that omit email, phone number, and USN.
4. **Session Integrity**: Single-device logins and immediate session revocations are synchronized between REST APIs and real-time Socket.IO WebSockets via `sessionSeed` matching and `global.disconnectUserSockets`.

---

## 2. Component Security Overview

### 2.1 API & Network Boundary
- **TLS/HTTPS Enforcement**: In production on Render/Cloudflare, all traffic is HTTPS-only.
- **Helmet Headers**: Content Security Policy, X-Content-Type-Options (`nosniff`), X-Frame-Options (`DENY`), and Referrer-Policy are applied on all HTTP responses.
- **NoSQL Injection Defense**: `express-mongo-sanitize` scrubs `$`, `.` and operator injections from request bodies, parameters, and query strings.
- **Rate Limiting**: `express-rate-limit` throttles high-volume API requests, while per-socket rate limiters throttle WebSocket messages (max 30 events/sec).

### 2.2 Identity & Access Management (IAM)
- **Token Format**: HS256 JWT tokens containing `userId`, `sessionSeed`, and device metadata with 7-day expiration.
- **Session Seed Invalidation**: Every user record holds `currentSessionSeed`. Logins generate a new random 16-byte hex seed, instantly invalidating previous tokens. Logouts and password resets rotate the seed and forcibly sever active WebSockets.
- **Single-Device Enforcement**: If a user logs into a new device, the old token’s seed fails validation on the next API call or socket event with code `SESSION_REPLACED`.

### 2.3 Private Identity Document (KYC) Architecture
- **Private Storage Directory**: Files are stored in `KYC_STORAGE_DIR` (configured on Render Persistent Disk `/data/uploads/kyc_private`, or local `backend/uploads/kyc_private/` during development) outside the public web root. **Limitation:** Render persistent disk supports persistence across restarts/redeploys for a single backend instance; scaling horizontally across multiple backend nodes requires private S3/R2 object storage.
- **Ownership Registry (`KycDocument`)**: Every uploaded file is registered in MongoDB with `docId`, `ownerId`, `docType`, unique `storedRef`, `sha256`, `mime`, `size`, and `status` (`uploaded`, `attached`, `replaced`, `deleted`). Submission rejects cross-user attachment (`403`), `docType` swaps (`403`), unregistered refs, path traversal, and missing disk files (`404`).
- **File Validation**:
  - Max size: 5MB.
  - Magic-byte validation: Validates genuine JPEG (`FF D8 FF`), PNG (`89 50 4E 47`), and WebP (`RIFF...WEBP`) binary signatures.
  - Rejects arbitrary external HTTP/HTTPS URLs to eliminate SSRF risks.
- **Secure Access**:
  - Only the document owner or a verified administrator can access a document.
  - Supports authenticated direct streaming or 15-minute expiring HMAC signed links bound to `userId`, `targetUserId`, `docType`, `op: 'read'`, and `jti` (`GET /api/kyc/document/:userId/:docType?token=...`).
  - Document access, replacements, deletions, and review actions are recorded in `user.kycAuditLogs`.

### 2.4 Emergency SOS Notification Architecture
- **Pluggable SMS Gateway**: Supports Twilio, Fast2SMS, and local native composer fallbacks. Unconfigured environments explicitly report status `client_action_required` and provider `NOT_CONFIGURED`.
- **Fail-Closed Twilio Delivery Webhook**: `POST /api/sos/webhook/twilio` returns HTTP 503 (`TWILIO_NOT_CONFIGURED`) if `TWILIO_AUTH_TOKEN` is absent; validates `twilio.validateRequest` HMAC signature against trusted canonical server URLs (ignoring client-spoofed `X-Forwarded-*` headers), verifies `AccountSid`, `MessageSid`, `TWILIO` provider match, normalized recipient `To`, legal state transitions (`ALLOWED_DELIVERY_TRANSITIONS`), and `processedCallbacks` idempotency.
- **Delivery Confirmation**: The API counts emergency contacts as notified (`emergencyContactsNotified`) strictly when confirmed (`delivered` or gateway-confirmed `sent`), and UI wording clarifies that delivery receipts do not prove human reading.
- **Expo Push Receipt Worker**: `push.helper.js` records `PushTicket` entries; `pushReceipt.worker.js` polls Expo receipts every 30s in batches of 100 using atomic `processingLockUntil` lease locks, exponential backoff up to 30m (`maxRetries: 5`), 30-day TTL cleanup, and automatic `DeviceNotRegistered` `pushToken` pruning.
- **Idempotency & Audit**: Unique `idempotencyKey` prevents duplicate alerts. Full lifecycle tracking (`triggered`, `acknowledged`, `resolved`, `cancelled`) is persisted in `sos.auditLog`.

### 2.5 Real-Time WebSocket Security (Socket.IO)
- **JWT Authentication**: Requires valid JWT token on `authenticate`. Token `sessionSeed` must match `user.currentSessionSeed`.
- **Room Authorization**:
  - `user-{userId}`: Joined only by the verified user.
  - `admin`, `admins`: Joined only if verified admin in MongoDB.
  - `ride-{rideId}`: Joined only if the caller is the provider, an accepted seeker, or an admin.
  - `college-{college}`: Joined based on verified student college.
- **Forced Disconnect**: Calling `global.disconnectUserSockets(userId)` forcibly closes all open sockets when an account logs out, resets password, is blocked, or is suspended.

### 2.6 Mobile Storage Security (Expo / React Native)
- **Hardware-Backed Keystore**: Native iOS and Android platforms strictly use `expo-secure-store` (Android KeyStore / iOS Keychain).
- **No Plaintext Fallback**: Insecure fallback to `AsyncStorage` has been completely eliminated on native devices. If hardware secure storage is unavailable, login fails safely.
- **Legacy Token Purge**: Automatically migrates and deletes any legacy `'cr_token'` lingering in `AsyncStorage`.
- **Native Mapping Architecture**: Uses native `@maplibre/maplibre-react-native` with OpenFreeMap (`https://tiles.openfreemap.org/styles/liberty`) and visible OpenStreetMap attribution—zero WebView wrappers and zero proprietary Google map tiles.

### 2.7 Logging & Error Redaction (`backend/utils/sanitize.js`)
- Express 404 handlers, global error handlers, Morgan HTTP logging, and controller catch blocks scrub query-string secrets (`token`, `jwt`, `apiKey`, `key`, `secret`, `password`, `otp`, `phone`, `email`), omit raw `req.originalUrl` query parameters from JSON responses, and withhold stack traces outside development/testing.
