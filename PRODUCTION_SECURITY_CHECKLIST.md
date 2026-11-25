# HOGO (CampusRide) — Production Security Pre-Launch Checklist

**Updated:** November 25, 2026  
**Auditor:** Principal Application Security Architect  
**Launch Readiness Status:** Conditional — Limited Beta / Single-Instance Render Deployment Ready (Live Twilio SMS Gateway NOT CONFIGURED in Workspace)  

---

## Pre-Launch Verification Checklist

### 1. Authentication & Session Management
- [x] Legacy insecure direct password reset endpoint is permanently disabled (HTTP 404).
- [x] JWT algorithm restricted to HS256 (no "none" algorithm or asymmetric confusion attacks).
- [x] Passwords hashed using bcrypt with salt rounds >= 10.
- [x] Single-device session seeds (`currentSessionSeed`) verified on every API request.
- [x] Logout rotates session seed and invalidates all previous tokens immediately.
- [x] Blocked and suspended users are rejected with HTTP 403 on all authenticated requests.
- [x] OTP emails sent via Brevo HTTPS API with 6-digit cryptographic codes and 10-minute expiry.

### 2. Real-Time WebSockets (Socket.IO)
- [x] Socket `authenticate` verifies JWT signature and session seed against database.
- [x] Identity switching on active socket connections is prohibited.
- [x] `global.disconnectUserSockets` forcibly severs connections on logout, password reset, or admin suspension.
- [x] Admin rooms (`admin`, `admins`) restricted strictly to server-side verified administrators.
- [x] Ride rooms (`ride-{id}`) restricted strictly to ride providers, accepted seekers, or admins.
- [x] Per-socket rate limiter active (max 30 events/sec per socket).

### 3. Identity Documents (KYC)
- [x] All identity documents stored in private server directory outside public web root.
- [x] Strict magic-byte file signature verification implemented (JPEG, PNG, WebP).
- [x] Maximum 5MB file upload limit enforced.
- [x] Arbitrary external HTTP/HTTPS URLs completely rejected (SSRF prevention).
- [x] `KycDocument` ownership registry enforces uploader `ownerId`, `docType`, SHA-256 hash, and disk existence checks before attachment or streaming.
- [x] Short-lived signed access links (15-minute token expiry, `op: 'read'`, `jti`, target user & `docType` binding) implemented.
- [x] Document deletion endpoints operational and verified.
- [x] Access, replacement, deletion, and review audit trails logged to `user.kycAuditLogs`.
- [x] Single-instance Render persistent disk (`/data/uploads/kyc_private`) and backup/restore scripts verified (note: multi-instance horizontal scaling requires private S3/R2 migration).

### 4. Emergency SOS System
- [x] Notification statuses synchronized between model and controller (`pending`, `queued`, `provider_accepted`, `sent`, `delivered`, `failed`, `client_action_required`).
- [x] Pluggable SMS service returns `NOT_CONFIGURED` / `client_action_required` when unconfigured (live Twilio keys must be populated in production env before enabling automated SMS).
- [x] `POST /api/sos/webhook/twilio` fails closed (`503 TWILIO_NOT_CONFIGURED`) when unconfigured and verifies `twilio.validateRequest` HMAC signatures against trusted URLs, `AccountSid`, `MessageSid`, recipient `To`, legal transitions, and `processedCallbacks` idempotency.
- [x] `emergencyContactsNotified` reports strictly confirmed provider deliveries (`delivered` or `sent`), never contact list size.
- [x] Expo push tickets tracked via `PushTicket` & background `pushReceipt.worker.js` with multi-instance lease locks, exponential backoff retries, 30-day TTL cleanup, and `DeviceNotRegistered` token pruning.
- [x] Duplicate activations prevented via `idempotencyKey`.
- [x] Full SOS lifecycle audit log recorded in database.

### 5. User Privacy & Route Protection
- [x] Field-level profile access control in `GET /api/users/:id` strips phone, email, USN, and gender for unrelated users.
- [x] Active ride co-participants receive coordination fields (`usn`, `gender`) without phone/email exposure.
- [x] Profile updates restricted via strict property allowlists (privilege escalation keys ignored).
- [x] 90-day cooldown enforced on phone number edits.
- [x] Object-level authorization enforced on rides, bookings, chat, and live tracking.

### 6. Infrastructure & Deployment
- [x] Environment variable `MONGODB_URI` standardized across backend and `render.yaml`.
- [x] Fallback to localhost removed in production; missing URI causes immediate process exit (`process.exit(1)`).
- [x] MongoDB URI format validated regex (`^mongodb(\+srv)?:\/\/`).
- [x] Production connection pooling enabled (`maxPoolSize: 50`, `minPoolSize: 5`).
- [x] Database connection awaited before server begins listening.
- [x] Liveness probe (`/api/health/live`) and readiness probe (`/api/health/ready`) implemented.
- [x] Insecure plaintext token fallback to `AsyncStorage` removed from mobile app.
- [x] Query-string tokens/secrets redacted across 404 responses, error handlers, and logs (`backend/utils/sanitize.js`).
- [x] CI/CD workflows enforce failure checks (no `|| true`, `if-no-files-found: error`).
- [x] Native MapLibre + OSM backend proxies rate-limited (`60 req/min`), coordinate-validated, and fail-honest on OSRM outages.
