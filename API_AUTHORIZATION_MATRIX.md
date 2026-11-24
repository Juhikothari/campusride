# HOGO (CampusRide) — Production API Authorization Matrix

**Last Updated:** November 23, 2026  
**Auditor:** Principal Application Security Architect  
**Validation Standard:** Principle of Least Privilege & Zero Trust Verification  

---

## 1. Authentication & Session Verification

| Method | Endpoint | Authentication | Session Seed Check | Role Required | Object-Level Check | Description |
|---|---|---|---|---|---|---|
| `POST` | `/api/auth/register` | None | N/A | None | Email uniqueness | User registration with campus domain check |
| `POST` | `/api/auth/login` | None | Rotates Seed | None | Password hash check | Password login, issues JWT with sessionSeed |
| `POST` | `/api/auth/logout` | Bearer JWT / Query Token | Verified | Any | Current user | Invalidates seed, closes sockets, wipes tokens |
| `GET` | `/api/auth/me` | Bearer JWT / Query Token | Verified | Any | Current user | Returns authenticated user details |
| `POST` | `/api/auth/send-otp` | None | N/A | None | Domain check | Dispatches OTP via Brevo HTTPS API |
| `POST` | `/api/auth/verify-otp` | None | N/A | None | Expiry / Replay check | Verifies 6-digit OTP |
| `POST` | `/api/auth/reset-password` | None | N/A | None | Token / OTP verify | Resets password, invalidates all sessions & sockets |
| `POST` | `/api/auth/reset-password-direct` | **DISABLED (404)** | N/A | N/A | N/A | Permanently disabled for security |

---

## 2. User & Profile Endpoints

| Method | Endpoint | Authentication | Session Seed Check | Role Required | Field-Level / Object-Level Access Control |
|---|---|---|---|---|---|
| `GET` | `/api/users/profile` | Required | Verified | Any | Returns own complete profile with phone cooldown info |
| `PUT` | `/api/users/profile` | Required | Verified | Any | Strict allowlist: `gender`, `emergencyContact`, `usn`, `profilePhoto` |
| `PUT` | `/api/users/profile/phone` | Required | Verified | Any | 90-day cooldown throttle enforced server-side |
| `PUT` | `/api/users/profile/vehicle` | Required | Verified | Provider / Both | Normalizes plate format (Indian standard & BH); enforces global uniqueness across accounts returning HTTP 409 `VEHICLE_ALREADY_REGISTERED`; marks pending admin verification |
| `GET` | `/api/users/profile/vehicles`| Required | Verified | Provider / Both | Returns user's registered vehicles |
| `GET` | `/api/users/:id` | Required | Verified | Any | **Field-level Privacy**: Owner/Admin gets full profile; Ride co-participants get safety fields (`usn`, `gender`); Unrelated users receive strictly minimal public view (phone/email/usn stripped). |

---

## 3. KYC Document Endpoints

| Method | Endpoint | Authentication | Session Seed Check | Role Required | Access Control & Validation |
|---|---|---|---|---|---|
| `POST` | `/api/kyc/upload` | Required | Verified | Any | Multer 5MB limit, JPEG/PNG/WebP magic-byte validation, private disk storage |
| `POST` | `/api/kyc/submit` | Required | Verified | Any | Rejects arbitrary external URLs (SSRF prevention); magic-byte verified base64/private refs; enforces vehicle uniqueness |
| `GET` | `/api/kyc/status` | Required | Verified | Any | Returns own KYC status |
| `GET` | `/api/kyc/document/:userId/:docType` | Required (Bearer or Signed Query Token) | Verified | Owner or Admin | Object-level: Requester must be document owner or verified Admin. Signed query token cryptographically verified for `targetUserId`, `docType`, and `purpose: 'kyc_document_access'`. Legacy Cloudinary redirects permanently removed. Streams private file with `X-Content-Type-Options: nosniff` |
| `GET` | `/api/kyc/document/:userId/:docType/signed-url` | Required | Verified | Owner or Admin | Generates 15-minute short-lived HMAC signed link bound to target user ID and docType |
| `DELETE`| `/api/kyc/document/:userId/:docType` | Required | Verified | Owner or Admin | Securely deletes private file from disk and logs audit record |
| `GET` | `/api/kyc/admin/pending` | Required | Verified | **Admin Only** | Returns all pending KYC submissions |
| `POST` | `/api/kyc/admin/review` | Required | Verified | **Admin Only** | Approves/rejects KYC and logs review audit entry |

---

## 4. Rides, Bookings, Chat & Tracking

| Method | Endpoint | Authentication | Session Seed Check | Role Required | Object-Level Authorization Check |
|---|---|---|---|---|---|
| `POST` | `/api/ride` | Required | Verified | Provider / Both | Provider verification and vehicle check |
| `GET` | `/api/ride/search` | Required | Verified | Any | Mandatory pickup and drop coordinates; rejects missing drop (`MISSING_DROP_LOCATION`), missing pickup (`MISSING_PICKUP_LOCATION`), or identical endpoints (`IDENTICAL_LOCATIONS`) |
| `PUT` | `/api/ride/:id` | Required | Verified | Provider | **Ownership Check**: Only the creating provider can edit |
| `POST` | `/api/ride/:id/cancel` | Required | Verified | Provider | **Ownership Check**: Only the ride provider can cancel |
| `POST` | `/api/booking` | Required | Verified | Seeker / Both | Verifies available seats and ride status |
| `POST` | `/api/booking/:id/accept` | Required | Verified | Provider | Only provider of the ride can accept booking |
| `POST` | `/api/booking/:id/cancel` | Required | Verified | Seeker or Provider | Only participants can cancel booking |
| `GET` | `/api/chat/:rideId` | Required | Verified | Participant / Admin | **Participation Check**: Provider, accepted seeker, or admin only |
| `GET` | `/api/tracking/:rideId` | Required | Verified | Participant / Admin | **Participation Check**: Provider, accepted seeker, or admin only |
| `POST` | `/api/tracking/update` | Required | Verified | Provider | **Provider Check**: Only the ride provider can update GPS coordinates |

---

## 5. Emergency SOS System

| Method | Endpoint | Authentication | Session Seed Check | Role Required | Authorization & Delivery Policy |
|---|---|---|---|---|---|
| `POST` | `/api/sos/trigger` | Required | Verified | Ride Participant | Participant only; prevents duplicate active SOS; idempotency key supported; unconfigured SMS returns `client_action_required` and `0` confirmed |
| `GET` | `/api/sos/:sosId` | Required | Verified | Participant / Admin | Participant or Admin only |
| `GET` | `/api/sos/ride/:rideId/active` | Required | Verified | Participant / Admin | Participant or Admin only |
| `POST` | `/api/sos/:sosId/acknowledge` | Required | Verified | Provider or Admin | Only ride provider or verified admin |
| `POST` | `/api/sos/:sosId/resolve` | Required | Verified | Triggerer / Provider / Admin | Only triggerer, provider, or verified admin |
| `POST` | `/api/sos/:sosId/cancel` | Required | Verified | Triggerer / Admin | Only user who triggered or admin |
| `POST` | `/api/sos/webhook/twilio` | Webhook Auth / Signature | N/A | Twilio SMS Gateway | Updates SMS message deliveryStatus to 'delivered' and records delivery timestamp |
| `GET` | `/api/sos/admin/all` | Required | Verified | **Admin Only** | Administrative emergency alert overview |

---

## 6. Admin Control Center

| Method | Endpoint | Authentication | Session Seed Check | Role Required | Authorization Policy |
|---|---|---|---|---|---|
| `GET` | `/api/admin/users` | Required | Verified | **Admin Only** | Server-side verified admin role |
| `GET` | `/api/admin/stats` | Required | Verified | **Admin Only** | Campus performance metrics |
| `POST` | `/api/admin/users/:id/suspend` | Required | Verified | **Admin Only** | Sets suspension and disconnects user sockets |
| `POST` | `/api/admin/users/:id/block` | Required | Verified | **Admin Only** | Sets block and disconnects user sockets |
| `POST` | `/api/admin/warning` | Required | Verified | **Admin Only** | Issues warning (auto-suspends and disconnects on 3rd warning) |
| `POST` | `/api/admin/users/revoke-sanctions` | Required | Verified | **Admin Only** | Revokes suspension, resets warnings to 2 (NOT 0) to preserve disciplinary history |

---

## 7. Health & Infrastructure

| Method | Endpoint | Authentication | Function | Database Dependency |
|---|---|---|---|---|
| `GET` | `/api/health/live` | None | Liveness Probe | Returns 200 alive without database dependency |
| `GET` | `/api/health/ready` | None | Readiness Probe | Returns 200 when `mongoose.connection.readyState === 1`, else 503 |
| `GET` | `/api/health` | None | Backward Compatible Health | Returns 200 if connected, 503 if disconnected |
| `GET` | `/health` | None | Backward Compatible Health | Returns 200 if connected, 503 if disconnected |
| `GET` | `/api/ping` | None | Network Ping | Returns plain text `pong` |
