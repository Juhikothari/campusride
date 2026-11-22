# HOGO (CampusRide) — Production Security Go-Live Checklist

This checklist must be reviewed, signed off, and validated prior to promoting any release candidate to production.

---

## 1. Network & Edge Infrastructure
- [x] **Enforce HTTPS / TLS 1.3:** Port 80 redirects to 443; TLS 1.0 and 1.1 strictly disabled on load balancers.
- [x] **Cloudflare Edge Protection:** DDoS protection enabled with Web Application Firewall (WAF) rules active.
- [x] **CORS Origin Restriction:** Production CORS policy strictly rejects origins outside verified web/mobile domains.
- [x] **Strict Security Headers:** Helmet configured with Content Security Policy (CSP), `X-Content-Type-Options: nosniff`, and `X-Frame-Options: SAMEORIGIN`.

## 2. API Gateway & Express Security
- [x] **NoSQL Injection Sanitization:** `mongo-sanitize` middleware cleanses `req.body`, `req.query`, and `req.params`.
- [x] **Multi-Tier Rate Limiting:** Global limit of 600 req/15m; sensitive auth routes capped at 25 req/15m.
- [x] **Backdoor Endpoints Eliminated:** Unauthenticated `/api/auth/reset-password-direct` permanently purged.
- [x] **Sanitized Error Responses:** Production errors strip stack traces and return generic error descriptions.
- [x] **Safe Body Parsing Limits:** `express.json({ limit: '10mb' })` prevents memory exhaustion attacks.

## 3. Database Security (MongoDB)
- [x] **Encrypted in Transit:** `ssl=true` / `tls=true` enforced on all production connection strings.
- [x] **Principle of Least Privilege:** Production DB user has readWrite permissions only on the application database.
- [x] **Geospatial Indexes:** `2dsphere` indexes built on `pickup` and `drop` coordinates for fast, index-backed lookups.
- [x] **Automated Daily Snapshots:** Retention configured for 90 days with Point-In-Time-Recovery (PITR).

## 4. Authentication, Session & Access Control
- [x] **JWT Algorithm Pinning:** Verification strictly restricted to `algorithms: ['HS256']`. Unsigned tokens (`none`) rejected.
- [x] **Single-Device Enforcement:** `currentSessionSeed` invalidates stale device tokens upon concurrent login or password reset.
- [x] **Cryptographic OTPs:** Generated via `crypto.randomInt(100000, 1000000)` with 5-minute expiry, 60s cooldown, and 5-attempt cap.
- [x] **Server-Side Admin Validation:** `isAdmin` strictly verifies database records; hardcoded emails eliminated.
- [x] **Object-Level Authorization (IDOR):** Verified ride membership on chat, tracking coordinates, and document downloads.

## 5. Mobile Security (React Native / Expo)
- [x] **Hardware Keystore Storage:** Authentication tokens saved in `expo-secure-store` (Android KeyStore / iOS Keychain).
- [x] **Cleartext Traffic Disabled:** `usesCleartextTraffic: false` in Android build configurations.
- [x] **No Sensitive Logging:** Console logs of tokens, passwords, and coordinates removed from production bundles.
- [x] **Permission Minimization:** Fine location requested only during active rides; background tracking isolated.

## 6. Privacy & PII Protection
- [x] **KYC Document Isolation:** Document URLs masked from public profiles; accessed only by owner and authorized admins.
- [x] **Emergency SOS Scoping:** SOS notifications routed directly to `admin` room and emergency contacts; no global socket broadcasts.
- [x] **Mass Assignment Prevention:** `PUT /profile` and ride updates use strict property allowlists.

## 7. Operational Readiness Sign-Off
- [x] Automated Security Regression Suite (`npm test`) passes with 100% success rate (16/16 tests passing).
- [x] Incident Response Plan (`INCIDENT_RESPONSE_PLAN.md`) published and assigned to SecOps leads.
- [x] Disaster Recovery Runbook (`DISASTER_RECOVERY_PLAN.md`) verified with RTO < 60m and RPO < 15m.
