# HOGO (CampusRide) — Data Flow and Privacy Architecture

This document maps all sensitive data flows, PII ingestion points, transit protocols, encryption mechanisms, and privacy minimization controls across the CampusRide platform.

---

## 1. Sensitive Data Taxonomy

| Category | Data Elements | Classification | Storage Location | In-Transit Security | Retention Period |
|---|---|---|---|---|---|
| **Identity & Authentication** | Email, Hashed Password, Phone, USN, Full Name | Confidential | MongoDB (`User` collection) | TLS 1.3 / HTTPS | Account lifetime |
| **Government KYC Records** | Aadhaar Card, Driving License, College ID Card, Selfie | Restricted / Sensitive | Cloudinary (Private) | Signed HTTPS / TLS 1.3 | Verification + 90 days audit window |
| **Telemetry & Geospatial** | Live GPS (lat, lng), Speed, Heading, Timestamp | Confidential Telemetry | Redis / Memory + MongoDB Ride history | TLS 1.3 / WSS | Ride duration + 30 days |
| **Communications** | In-ride chat messages, community posts | Private Communications | MongoDB (`Chat`, `Community`) | TLS 1.3 / WSS | 60 days post-ride |
| **Safety & Emergency** | SOS Alerts, Incident Reports, Emergency Contact Phone | High Priority Safety | MongoDB (`SOS`, `Incident`) | TLS 1.3 / HTTPS | 180 days for legal compliance |

---

## 2. End-to-End Data Flow Sequences

### 2.1 User Registration & KYC Onboarding Flow
```
User (Mobile)            API Gateway (Express)              MongoDB                Cloudinary
     |                            |                            |                       |
     |--- 1. POST /api/kyc/upload (Aadhaar, ID, Selfie) ------>|                       |
     |                            |--- 2. Stream Binary ------------------------------>|
     |                            |<-- 3. Return Secure Asset URL ---------------------|
     |                            |--- 4. Save URL into user.kycDocuments ------------>|
     |                            |       (Masked in all public queries)               |
     |<-- 5. KYC Status: Pending -|                            |                       |
```
**Privacy Safeguard:** KYC document URLs are explicitly stripped from public user profiles. Only the student and verified administrators can view the document via `GET /api/kyc/document/:userId/:docType`.

---

### 2.2 Ride Discovery & Booking Flow
```
Seeker (Mobile)           API Gateway                   MongoDB               Provider (Mobile)
     |                         |                           |                          |
     |-- 1. GET /ride/search ->|                           |                          |
     |   (pickup, drop, dist)  |-- 2. Geospatial Query --->|                          |
     |<-- 3. Filtered Rides ---|                           |                          |
     |                         |                           |                          |
     |-- 4. POST /booking/book |                           |                          |
     |    (rideId, seats) ---->|-- 5. Record Booking ----->|                          |
     |                         |--- 6. Socket Alert (ride_request) ------------------>|
     |                         |                           |                          |
     |                         |<-- 7. PATCH /booking/:id/respond (Accept) -----------|
     |<-- 8. Push: Accepted ---|-- 8. Update DB ---------->|                          |
```
**Privacy Safeguard:** Phone numbers and emergency contacts are masked until a booking is explicitly accepted by the ride provider.

---

### 2.3 Live GPS Tracking Flow
```
Provider (Mobile)          API Gateway (Socket.IO)              Accepted Passengers Only
     |                               |                                    |
     |-- 1. emit('driver-location', -|                                    |
     |      { rideId, lat, lng })    |-- 2. Validate Sender is Provider   |
     |                               |-- 3. Check Active Ride Status      |
     |                               |-- 4. to(`ride:${rideId}`) -------->|
     |                               |      (Non-participants rejected)   |
```
**Privacy Safeguard:** Driver GPS updates are scoped exclusively to the specific `ride:{rideId}` room. Users who are not accepted passengers receive HTTP 403 Forbidden if requesting coordinates via REST.

---

### 2.4 Emergency SOS Activation Flow
```
Rider (Mobile)          API Gateway             MongoDB             Expo Push & SMS        Admins Room
     |                       |                     |                       |                    |
     |-- 1. POST /sos/trigger|                     |                       |                    |
     |   (live GPS coords) ->|-- 2. Save SOS ----->|                       |                    |
     |                       |-- 3. Send SMS to Emergency Contact -------->|                    |
     |                       |-- 4. Dispatch Push Notifications ---------->|                    |
     |                       |-- 5. emit('adminSOSAlert') to room('admin') -------------------->|
     |<-- 6. SOS Ack Code ---|                     |                       |                    |
```
**Privacy Safeguard:** Emergency broadcasts are strictly isolated to verified administrators and emergency contacts. No global socket broadcast occurs.

---

## 3. Privacy Minimization Controls

1. **Least-Privilege Projections:** MongoDB queries for public profiles explicitly omit sensitive data:
   ```javascript
   User.findById(userId).select('-password -kycDocuments -currentSessionSeed -blocked -suspended');
   ```
2. **Short-Lived OTPs:** OTPs expire within 300 seconds and are wiped immediately upon successful verification.
3. **No Credential Logging:** Console logs in all controllers and middleware have been audited to ensure zero logging of passwords, tokens, or OTP codes.
4. **Hardware Storage:** Access tokens stored exclusively in Android Keystore / iOS Keychain.
