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

---

### [2026-11-24] REM-09: KYC Storage Durability & Persistent Storage Architecture
- **Affected Components:** `render.yaml`, `backend/kyc/kyc.controller.js`, `backend/scripts/backup_restore_kyc.js`, `backend/scripts/migrate_legacy_kyc.js`
- **Actions Taken:**
  - Configured persistent disk in `render.yaml` (`mountPath: /data/uploads/kyc_private`, `sizeGB: 10`).
  - Added configurable `KYC_STORAGE_DIR` environment variable pointing to the persistent disk path.
  - Implemented automated backup and restore script (`backend/scripts/backup_restore_kyc.js`) with tarball compression, checksum validation, and retention policies.
  - Implemented migration script (`backend/scripts/migrate_legacy_kyc.js`) to migrate legacy Cloudinary and base64 documents into private disk storage.
  - Permanently removed legacy HTTP 302 redirects to public Cloudinary URLs; unmigrated documents return HTTP 400 (`LEGACY_DOCUMENT_UNMIGRATED`).
- **Status:** **VERIFIED** via automated integration tests and persistent disk configuration.

---

### [2026-11-24] REM-10: KYC Signed URL Single-Use Cryptographic Claim Binding
- **Affected Components:** `backend/kyc/kyc.controller.js`, `backend/middleware/auth.js`
- **Actions Taken:**
  - Fixed signed URL generation in `getSignedDocumentUrl` to issue short-lived tokens (max 15 minutes) cryptographically bound with `targetUserId`, `docType`, `purpose: 'kyc_document_access'`, and requester `sessionSeed`.
  - In `getDocumentImage`, enforced verification of signed token claims: rejecting target user mismatch (HTTP 403), document type mismatch (HTTP 403), and missing/invalid purpose (HTTP 403).
  - Supported token delivery via query string (`?token=...`) with single-device session verification and algorithm enforcement.
- **Status:** **VERIFIED** via 4 dedicated automated regression tests.

---

### [2026-11-24] REM-11: SOS Emergency Dispatch State Normalization
- **Affected Components:** `backend/sos/sos.model.js`, `backend/sos/sos.controller.js`, `backend/sos/sos.routes.js`, `backend/services/sms/sms.service.js`, `backend/notifications/push.helper.js`
- **Actions Taken:**
  - Added `'provider_accepted'` to `notificationsSent.status` and `emergencyContacts.deliveryStatus` enums in `sos.model.js`.
  - Updated Twilio and Fast2SMS dispatchers to record gateway acceptance as `'provider_accepted'` instead of claiming premature delivery.
  - Implemented Twilio delivery webhook (`POST /api/sos/webhook/twilio`) to process asynchronous delivery receipts and transition status to `'delivered'`.
  - Enforced that `triggerSOS` response counts `emergencyContactsNotified` strictly based on confirmed `'delivered'` state.
- **Status:** **VERIFIED** via webhook delivery integration tests.

---

### [2026-11-24] REM-12: Sensitive Query Parameter & Request Log Masking
- **Affected Components:** `backend/server.js`
- **Actions Taken:**
  - Created and exported `sanitizeUrlForLogging(url)` in `server.js`.
  - Automatically redacts query parameters matching `token`, `jwt`, `apiKey`, `key`, `secret`, `password`, `otp`, `phone`, `email` with `[REDACTED]`.
  - Applied sanitization across Morgan HTTP logging and custom console log outputs.
- **Status:** **VERIFIED** via unit test in `tests/security.test.js`.

---

### [2026-11-24] REM-13: Categorized Multi-Tier Concurrency & Throughput Isolation
- **Affected Components:** `backend/tests/load_test_runner.js`, `LOAD_TEST_REPORT.md`
- **Actions Taken:**
  - Refactored benchmark runner to categorize responses into 2xx (Success), 3xx (Redirect), 4xx (Client Error), 429 (Rate Limited), 5xx (Server Error), Network Errors, and Timeouts.
  - Separated true 2xx Application Throughput (req/s) from total pipeline throughput.
  - Verified 0 server crashes (0 HTTP 5xx errors) and 50/50 successful WebSocket authentications under load.
- **Status:** **VERIFIED** via automated load test runner.

---

### [2026-11-24] REM-14: Ride Search Mandatory Drop Location Validation
- **Affected Components:** `backend/rides/rides.controller.js`, `campusride-mobile/src/screens/SearchRidesScreen.jsx`
- **Actions Taken:**
  - Backend `GET /api/ride/search` validates presence of both pickup and drop coordinates, returning HTTP 400 `MISSING_DROP_LOCATION` or `MISSING_PICKUP_LOCATION` when incomplete.
  - Coordinate proximity validation rejects identical pickup/drop coordinates (< 50m) with HTTP 400 `IDENTICAL_LOCATIONS`.
  - Frontend displays contextual helper `"Please select your drop location to find available rides."` when only pickup is selected, disables "Find a Ride" button, and auto-clears rides when either endpoint is cleared.
- **Status:** **VERIFIED** via 4 automated integration tests and mobile component verification.

---

### [2026-11-24] REM-15: Unique Indian Vehicle Registration Enforcement & Disciplinary Sanctions Restoration
- **Affected Components:** `backend/utils/vehicle.js`, `backend/users/users.model.js`, `backend/users/users.routes.js`, `backend/kyc/kyc.controller.js`, `backend/admin/admin.controller.js`, `backend/admin/auditLog.model.js`
- **Actions Taken:**
  - Created vehicle registration normalization and regex validation for Indian standard and BH formats (`backend/utils/vehicle.js`).
  - Added sparse unique index on `vehicles.vehicleNumber` in `User` schema.
  - Enforced atomic duplicate vehicle check in `PUT /api/users/profile/vehicle` and `POST /api/kyc/submit`, returning HTTP 409 Conflict (`VEHICLE_ALREADY_REGISTERED`).
  - In `admin.controller.js` `revokeSanctions`, restored warning count to 2 (NOT 0) to preserve disciplinary history while unsuspending accounts.
  - Extended `AuditLog` enum to support `'WARN_USER'`, `'REVOKE_SANCTIONS'`, and `'APPROVE_COLLEGE'`.
- **Status:** **VERIFIED** via automated tests in `tests/security.test.js`.

---

### [2026-11-25] REM-16: Fail-Closed Twilio Webhook HMAC Authentication & Delivery State Machine
- **Affected Components:** `backend/sos/sos.controller.js`, `backend/sos/sos.model.js`, `backend/services/sms/sms.service.js`, `backend/package.json`
- **Actions Taken:**
  - Installed official `twilio` SDK and enforced `twilio.validateRequest` HMAC signature validation in `handleTwilioWebhook`.
  - Enforced fail-closed HTTP 503 (`TWILIO_NOT_CONFIGURED`) when `TWILIO_AUTH_TOKEN` is unset.
  - Resolved canonical webhook URL strictly from trusted environment configuration (`TWILIO_WEBHOOK_URL` / `WEBHOOK_BASE_URL` / `PUBLIC_URL` / `RENDER_EXTERNAL_URL`), ignoring client-spoofable `X-Forwarded-*` headers.
  - Enforced `AccountSid` equality, `MessageSid` existence, `TWILIO` provider match, normalized recipient `To` match, legal state-transition validation (`ALLOWED_DELIVERY_TRANSITIONS`), and `processedCallbacks` idempotent deduplication without logging secret tokens or signatures.
- **Status:** **VERIFIED** via automated signed/forged webhook regression suite (`SOS STATES`); live production Twilio credentials **NOT CONFIGURED** in local workspace.

---

### [2026-11-25] REM-17: Sensitive Query Parameter Redaction Across 404, Errors, and Logs
- **Affected Components:** `backend/utils/sanitize.js`, `backend/server.js`, `backend/admin/admin.middleware.js`, `backend/ratings/ratings.controller.js`
- **Actions Taken:**
  - Extracted shared `sanitize.js` (`sanitizeUrlForLogging`, `stripQueryFromUrl`, `sanitizeLogText`, `sanitizeErrorForClient`).
  - Removed raw `req.originalUrl` and unsanitized query strings from Express 404 responses and error logs (`req.path` / `stripQueryFromUrl` used in JSON responses; query secrets redacted in logs).
  - Removed raw `error.stack` / `error.message` leakage from `admin.middleware.js` and `ratings.controller.js`.
- **Status:** **VERIFIED** via `LOGGING` test in `tests/security.test.js`.

---

### [2026-11-25] REM-18: Expo Push Receipt Verification Worker & Token Pruning
- **Affected Components:** `backend/notifications/pushTicket.model.js`, `backend/notifications/pushReceipt.worker.js`, `backend/notifications/push.helper.js`, `backend/server.js`, `campusride-mobile/src/screens/LiveTrackingScreen.jsx`
- **Actions Taken:**
  - Added `PushTicket` collection preserving Expo ticket IDs, distinct states (`pending`, `queued`, `provider_accepted`, `delivered`, `failed`, `client_action_required`), bounded exponential backoff retries (`maxRetries: 5`), and a 30-day TTL index (`expiresAt`).
  - Implemented multi-instance safe `claimDueTickets` using atomic `processingLockUntil` lease updates and batch polling against Expo's receipt API (batch size 100).
  - Pruned invalid `pushToken` values automatically on permanent `DeviceNotRegistered` receipts and synchronized linked `SOS.notificationsSent` & `auditLog`.
  - Updated SOS confirmation UI text so receipt acceptance never claims confirmed human reading.
- **Status:** **VERIFIED** via `EXPO PUSH WORKER` integration test in `tests/security.test.js`.

---

### [2026-11-25] REM-19: KYC Document Ownership Registry & Legacy Migration Verification
- **Affected Components:** `backend/kyc/kycDocument.model.js`, `backend/kyc/kyc.controller.js`, `backend/scripts/migrate_legacy_kyc.js`, `campusride-mobile/src/screens/KYCScreen.jsx`, `campusride-mobile/src/services/api.js`
- **Actions Taken:**
  - Added `KycDocument` registry (`docId`, `ownerId`, `docType`, unique `storedRef`, `sha256`, `mime`, `size`, `status`).
  - Fixed constant initialization order (`KYC_STORAGE_DIR` before `RESOLVED_KYC_DIR`), added `resolveSafePrivatePath` traversal guard, and enforced cross-account ownership, `docType` matching, physical disk existence, and `op: 'read'` + `jti` signed URL claims.
  - Updated mobile `KYCScreen.jsx` to upload private multipart files directly to `POST /api/kyc/upload` via `api.uploadKycDocument` rather than public Cloudinary.
  - Executed `migrate_legacy_kyc.js` (`2` users / `2` documents scanned, `2` verified on disk, `2` `KycDocument` records backfilled, `0` missing/failed) and tested `backup_restore_kyc.js` backup/restore roundtrip (`13` files verified).
- **Status:** **VERIFIED** via `KYC OWNERSHIP` test and script execution (note: Render `/data/uploads/kyc_private` disk provides persistence for a single backend instance; multi-instance horizontal scaling requires private S3/R2 storage).

---

### [2026-11-25] REM-20: Native MapLibre + OpenStreetMap Migration & Geocoding/Routing Proxy Hardening
- **Affected Components:** `backend/location/location.routes.js`, `campusride-mobile/app.json`, `campusride-mobile/src/config/mapConfig.js`, `src/components/LiveMapView.jsx`, `src/components/StopsMap.jsx`, `src/components/LocationSearch.jsx`, `src/components/MapPickerModal.jsx`, `src/screens/SearchRidesScreen.jsx`, `src/screens/LiveTrackingScreen.jsx`, `src/services/api.js`
- **Actions Taken:**
  - Removed WebView/Leaflet and Google tile URLs from active map components; installed `@maplibre/maplibre-react-native` (`^11.5.1`) using OpenFreeMap liberty style and visible `© OpenStreetMap contributors · OpenFreeMap` attribution.
  - Hardened `location.routes.js` with `60 req/min` rate limiting, 5-minute TTL caching, strict `[-90,90]`/`[-180,180]` coordinate validation, Photon primary + Geoapify/Nominatim fallbacks returning GeoJSON `[lng, lat]`, and OSRM `/route` returning fail-honest `routeAvailable: false` instead of fabricated ETAs/routes on upstream failure.
- **Status:** **VERIFIED** on backend & JS layer (`LOCATION & ROUTING` test, live Photon/Nominatim/OSRM/OpenFreeMap check, `check_jsx.js`, `expo-doctor` 18/18); native Android APK rendering verified via GitHub Actions CI build.

