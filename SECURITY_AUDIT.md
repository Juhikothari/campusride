# HOGO (CampusRide) — Comprehensive Application Security Audit Report

**Date:** November 2026  
**Auditor:** Principal Application Security Architect & DevSecOps Lead  
**Scope:** CampusRide Full-Stack Repository (`backend/` Node.js/Express/MongoDB & `campusride-mobile/` React Native/Expo)  
**Classification:** Internal Confidential / Production Readiness Audit  

---

## 1. Executive Summary

A comprehensive application security and penetration testing audit was performed across the HOGO (CampusRide) mobility ecosystem. The assessment evaluated the mobile client, Express REST APIs, WebSockets (Socket.IO), MongoDB database layer, authentication pipelines, KYC document handling, and emergency SOS services.

The audit revealed multiple critical and high-severity vulnerabilities in the initial state of the codebase, most notably:
1. **Unauthenticated Password Reset Backdoor (`/api/auth/reset-password-direct`)**: Allowed arbitrary account takeover without verifying current passwords, OTPs, or active sessions.
2. **Hardcoded Administrative Privilege Escalation**: Allowed any user who registered with specific email addresses (e.g., `admin@campusride.in`) to automatically receive administrative authorization.
3. **Public Exposure & IDOR on KYC Identity Documents**: KYC document URLs were returned without authentication and in public user profile queries, exposing government IDs (Aadhaar, Driving Licenses, College IDs).
4. **Socket.IO Identity & Administrative Spoofing**: Client-supplied role claims on connection were trusted implicitly, allowing regular users to join the administrative channel and receive real-time SOS alerts.
5. **Horizontal Privilege Escalation (IDOR) on Ride Chat & GPS Tracking**: Any authenticated user could read private chat messages and retrieve live GPS breadcrumbs for rides they were not part of.

**Audit Status:** All identified critical, high, and medium vulnerabilities have been **fully remediated**, tested, and verified using automated test suites.

---

## 2. Threat Model & Target Environment

HOGO (CampusRide) operates as a peer-to-peer campus ride-sharing network connecting verified college students and faculty.

```
       +---------------------------------------------+
       |   React Native Mobile Client (iOS/Android)  |
       |  - expo-secure-store (Hardware Keystore)   |
       |  - TLS 1.3 Pinning & HTTPS                  |
       +---------------------------------------------+
                            |
           [HTTPS / WSS + Helmet + Rate Limiter]
                            |
                            v
       +---------------------------------------------+
       |            Express 5 API Gateway            |
       |  - Helmet CSP / Headers   - Mongo-Sanitize  |
       |  - Single-Device Session  - Role Middleware |
       +---------------------------------------------+
            /              |              \
           v               v               v
    +-------------+ +-------------+ +--------------------+
    | MongoDB 9   | | Socket.IO   | | Cloudinary / Brevo |
    | TLS Storage | | JWT Auth    | | Verified Storage   |
    +-------------+ +-------------+ +--------------------+
```

### Threat Actors Considered:
- **Malicious Students / Internal Seekers**: Seeking free rides, tracking student movements, or spoofing credentials.
- **Rogue Drivers / Attackers**: Exfiltrating student phone numbers, gender data, or college IDs.
- **Network Attackers**: Eavesdropping on unprotected endpoints or spoofing WebSocket channels.
- **Automated Bots**: OTP brute-forcing, spamming ride requests, or scraping user directories.

---

## 3. Vulnerability Findings & Penetration Test Details

### Vulnerability 1: Direct Unauthenticated Password Reset Endpoint (CRITICAL)
- **Identifier:** CR-SEC-001
- **CVSS v3.1:** 9.8 (`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H`)
- **OWASP API 2023:** API2:2023 Broken Authentication
- **Affected Route:** `POST /api/auth/reset-password-direct`
- **Description:** The endpoint accepted an arbitrary `email` and `newPassword` and updated the user's password directly via `bcrypt.hash` without verifying an OTP, security question, or existing authorization token.
- **Exploitation:** Any external actor could iterate over known student emails and reset their accounts instantly.
- **Remediation:** Permanently removed the route, controller method, and references. Password reset now strictly mandates verified OTP tokens with 5-minute expiry.

### Vulnerability 2: Administrative Role Escalation via Email Spoofing (HIGH)
- **Identifier:** CR-SEC-002
- **CVSS v3.1:** 8.8 (`CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H`)
- **OWASP API 2023:** API5:2023 Broken Function Level Authorization
- **Affected File:** `backend/admin/admin.middleware.js`
- **Description:** The administrative middleware checked a client email against a hardcoded array `ADMIN_EMAILS = ['admin@campusride.in', ...]`. Any user signing up with that email was automatically granted full administrator access across users, rides, and logs.
- **Remediation:** Removed the hardcoded list. Middleware now strictly queries the database for `user.role === 'admin'` or an explicit document in the `Admin` collection, rejecting blocked and suspended accounts.

### Vulnerability 3: KYC Identity Document Exposure & IDOR (HIGH)
- **Identifier:** CR-SEC-003
- **CVSS v3.1:** 8.6 (`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N`)
- **OWASP API 2023:** API1:2023 Broken Object Level Authorization
- **Affected Route:** `GET /api/kyc/document/:userId/:docType`
- **Description:** The endpoint lacked authentication middleware and allowed anyone with a `userId` to view Aadhaar cards, college IDs, and selfies. Furthermore, `GET /api/users/:id` returned `kycDocuments` in the JSON response.
- **Remediation:** Added `auth` middleware and object-level authorization: only the document owner or a verified administrator can access the file. Stripped `kycDocuments` and passwords from public user projections.

### Vulnerability 4: Socket.IO Identity Forgery & Broadcast Leaks (HIGH)
- **Identifier:** CR-SEC-004
- **CVSS v3.1:** 8.6 (`CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:C/C:H/I:L/A:N`)
- **OWASP API 2023:** API8:2023 Security Misconfiguration
- **Affected Component:** `backend/server.js` Socket.IO handler
- **Description:** The socket `authenticate` event trusted `{ userId, userType }` sent directly by the client without verifying the JWT. When SOS was triggered, `io.emit('adminSOSAlert')` broadcast emergency coordinates to every connected user.
- **Remediation:** Enforced JWT verification on `authenticate`. Restricted admin socket room joins to verified admins. Targeted SOS alerts strictly to `admin` rooms and verified ride participants.

### Vulnerability 5: IDOR on Ride Chat and Real-Time Tracking (HIGH)
- **Identifier:** CR-SEC-005
- **CVSS v3.1:** 7.5 (`CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N`)
- **OWASP API 2023:** API1:2023 Broken Object Level Authorization
- **Affected Routes:** `GET /api/chat/:rideId`, `GET /api/tracking/:rideId`
- **Description:** Endpoints only checked if the caller had a valid JWT, but did not check if the caller was the ride provider or an accepted passenger.
- **Remediation:** Implemented database lookup verifying that `req.user.userId` matches `ride.providerId` or exists in `ride.passengers` before granting access.

### Vulnerability 6: Mass Assignment in Profile Updates (MEDIUM)
- **Identifier:** CR-SEC-006
- **CVSS v3.1:** 7.3 (`CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:H/A:N`)
- **OWASP API 2023:** API6:2023 Unrestricted Access to Sensitive Business Flows
- **Affected Route:** `PUT /api/users/profile`
- **Description:** The controller accepted arbitrary keys and used `delete updates...` allowlist-by-exclusion, allowing users to modify sensitive internal state.
- **Remediation:** Replaced with an explicit allowlist: only `gender`, `emergencyContact`, `usn`, and `profilePhoto` can be updated.

### Vulnerability 7: Weak OTP Generation & Missing Rate Limiting (HIGH)
- **Identifier:** CR-SEC-007
- **CVSS v3.1:** 7.5 (`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:L/A:N`)
- **OWASP API 2023:** API4:2023 Unrestricted Resource Consumption
- **Affected Route:** `POST /api/auth/send-otp`, `POST /api/auth/verify-otp`
- **Description:** Used pseudo-random `Math.random()` to generate OTPs, lacked cooldowns, and had no attempt limits on verification.
- **Remediation:** Replaced with `crypto.randomInt(100000, 1000000)`, enforced 60s cooldown per email, 5-attempt verification cap, and `express-rate-limit` (25 req/15m).

---

## 4. Regulatory Compliance Assessment

### India Digital Personal Data Protection (DPDP) Act 2023
- **Purpose Limitation:** Location data is strictly captured during active rides and not retained indefinitely.
- **Storage Limitation:** KYC documents are locked to authorized reviewers and masked in all public contexts.
- **Security Safeguards:** Applied encryption at rest (MongoDB TLS/Cloudinary) and in transit (HTTPS/WSS, TLS 1.3). Hardware-backed keystores protect mobile tokens.

### OWASP Top 10 API Security 2023 Compliance
- **API1 Broken Object Level Authorization:** REMEDIATED (Ride Chat, Tracking, KYC Docs, SOS).
- **API2 Broken Authentication:** REMEDIATED (Single device seed, HS256 algorithm enforcement, OTP attempt caps).
- **API3 Broken Object Property Level Authorization:** REMEDIATED (Mass assignment allowlist).
- **API4 Unrestricted Resource Consumption:** REMEDIATED (`express-rate-limit` on all endpoints).
- **API5 Broken Function Level Authorization:** REMEDIATED (Database-backed `isAdmin` middleware).
- **API7 Server-Side Request Forgery:** MITIGATED (Cloudinary and external URLs validated).
- **API8 Security Misconfiguration:** REMEDIATED (Helmet headers, CORS origin validation, sanitized production errors).

---

## 5. Audit Conclusion
The HOGO (CampusRide) backend and mobile client have achieved **Production-Grade Security Baseline** compliance. All identified vulnerabilities have been remediated without regression or functional degradation.
