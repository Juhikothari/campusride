# HOGO (CampusRide) — Security Remediation Log

**Last Updated:** November 23, 2026  
**Auditor:** Principal Application Security Architect  
**Status:** All Critical & High Vulnerabilities Addressed with Implemented & Verified Controls  

---

## Remediation Log Entries

### [2026-11-23] REM-01: SOS Emergency System Architecture & Delivery Transparency
- **Affected Components:** `backend/sos/sos.model.js`, `backend/sos/sos.controller.js`, `backend/services/sms/sms.service.js`, `backend/notifications/push.helper.js`
- **Actions Taken:**
  - Standardized notification statuses to `['pending', 'queued', 'sent', 'delivered', 'failed', 'client_action_required']`.
  - Added notification metadata: `provider`, `messageId`, `attempts`, `error`, `notes`.
  - Implemented pluggable SMS Gateway abstraction (`backend/services/sms/sms.service.js`). When credentials are not configured, provider returns `NOT_CONFIGURED` with `client_action_required`.
  - `emergencyContactsNotified` count strictly increments on confirmed provider acceptance (`sent` or `delivered`), never on contact list size.
  - Implemented push notification response awaiting with Expo push ticket validation and retry backoff.
  - Added `idempotencyKey` tracking and full lifecycle `auditLog`.
- **Status:** **VERIFIED** via 3 dedicated automated integration tests.

---

### [2026-11-23] REM-02: Private KYC Document Storage & Magic-Byte Validation
- **Affected Components:** `backend/kyc/kyc.controller.js`, `backend/kyc/kyc.routes.js`, `backend/users/users.model.js`
- **Actions Taken:**
  - Created isolated private directory `backend/uploads/kyc_private/` outside public web root with restricted filesystem mode.
  - Built magic-byte validator inspecting binary headers for genuine JPEG (`FF D8 FF`), PNG (`89 50 4E 47...`), and WebP (`RIFF...WEBP`).
  - Enforced 5MB size limit across multipart and base64 submissions.
  - Completely rejected arbitrary external HTTP/HTTPS URLs to eliminate SSRF attack vectors.
  - Added short-lived 15-minute signed URL generator (`GET /api/kyc/document/:userId/:docType/signed-url`).
  - Added secure deletion (`DELETE /api/kyc/document/:userId/:docType`) and audit logging (`user.kycAuditLogs`).
- **Status:** **VERIFIED** via 4 dedicated automated integration tests.

---

### [2026-11-23] REM-03: Socket.IO Session Seed Revocation & Real-Time Security
- **Affected Components:** `backend/server.js`, `backend/auth/auth.controller.js`, `backend/admin/admin.controller.js`, `campusride-mobile/src/hooks/useSocket.js`
- **Actions Taken:**
  - Socket.IO `authenticate` listener now verifies `decoded.sessionSeed === user.currentSessionSeed`. Stale/revoked session seeds are rejected immediately.
  - Blocked identity switching on active socket connections.
  - Implemented `global.disconnectUserSockets(userId, reason)` in `server.js`.
  - Wired `disconnectUserSockets` into `auth.controller.js` (`logout`, `resetPasswordWithToken`) and `admin.controller.js` (`suspendUser`, `blockUser`, automatic 3-warning suspension).
  - Added per-socket rate limiting (max 30 events/sec) to defend against WebSocket event flooding.
- **Status:** **VERIFIED** via 3 dedicated automated integration tests.

---

### [2026-11-23] REM-04: MongoDB Fail-Closed Startup & URI Consolidation
- **Affected Components:** `backend/config/db.js`, `backend/server.js`, `render.yaml`
- **Actions Taken:**
  - Standardized on `MONGODB_URI` across application code and deployment descriptors.
  - Removed fallback to localhost in production mode. Process exits immediately (`process.exit(1)`) if URI is missing or malformed.
  - Configured connection pooling: `maxPoolSize: 50`, `minPoolSize: 5`, `serverSelectionTimeoutMS: 5000`.
  - Server startup in `server.js` now strictly awaits `connectDB()` before invoking `server.listen()`.
- **Status:** **VERIFIED** via code inspection and test suite startup.

---

### [2026-11-23] REM-05: Mobile Token Storage Plaintext Fallback Elimination
- **Affected Components:** `campusride-mobile/src/services/api.js`
- **Actions Taken:**
  - Removed `AsyncStorage.setItem('cr_token', t)` fallback on native platforms.
  - If `SecureStore` is unavailable on native devices, authentication throws an error and fails safely.
  - Implemented automatic migration and purging of legacy unencrypted tokens from `AsyncStorage`.
- **Status:** **VERIFIED** via source code audit.

---

### [2026-11-23] REM-06: Field-Level Profile Information Privacy
- **Affected Components:** `backend/users/users.routes.js`
- **Actions Taken:**
  - Implemented relation-aware field masking in `GET /api/users/:id`:
    - Unrelated users receive only public fields: `_id`, `name`, `profilePhoto`, `college`, `role`, `kycStatus`, `createdAt`.
    - Phone number, email, USN, gender, and emergency contacts are stripped for non-participants.
    - Active ride co-participants receive coordination fields (`usn`, `gender`) for pickup safety without exposing personal email or phone numbers.
    - Account owners and verified administrators receive full permitted profile details.
  - Replaced deprecated Mongoose `{ new: true }` with `{ returnDocument: 'after' }`.
- **Status:** **VERIFIED** via 2 dedicated automated integration tests.

---

### [2026-11-23] REM-07: CI/CD Pipeline Build Failure Enforcement
- **Affected Components:** `.github/workflows/build-release.yml`, `.github/workflows/build-apk.yml`
- **Actions Taken:**
  - Removed `|| true` on `npx expo-doctor` and EAS build commands.
  - Set `if-no-files-found: error` on artifact upload steps.
  - Added automated backend regression test job as a required check before mobile build jobs run.
  - Removed debug signing injections from release workflows.
- **Status:** **VERIFIED** via GitHub Actions workflow definitions.

---

### [2026-11-23] REM-08: Database-Aware Health Checks
- **Affected Components:** `backend/server.js`
- **Actions Taken:**
  - Implemented `/api/health/live` (process liveness).
  - Implemented `/api/health/ready` (verifies `mongoose.connection.readyState === 1`, returns 200 or 503).
  - Updated legacy `/api/health` and `/health` to return HTTP 503 when the database is disconnected.
- **Status:** **VERIFIED** via 2 dedicated automated integration tests.
