# HOGO (CampusRide) — Data Flow & Privacy Architecture

**Document Version:** 2.0  
**Updated:** November 23, 2026  
**Status:** Implemented and Verified  

---

## 1. Data Classification

| Data Category | Examples | Storage Location | Sensitivity | Access Rules |
|---|---|---|---|---|
| **Identity & Authentication** | Email, Hashed Passwords, Session Seeds, Device IDs | MongoDB `users` collection | **CRITICAL** | Passwords hashed via bcrypt (`cost 10`). Never exposed in API responses (`.select('-password -currentSessionSeed')`). |
| **Government & College Identity** | College ID, Driving License, Selfie, Aadhar | Private disk storage (`uploads/kyc_private/`) | **RESTRICTED** | Never publicly accessible. Accessible strictly by document owner or verified Admin. Expiring 15-minute signed links. |
| **Contact Data** | Phone number, Emergency Contacts | MongoDB `users` collection | **CONFIDENTIAL** | Stripped from public user profile. Visible only to account owner and verified Admin. Never leaked to unrelated campus users. |
| **Ride Coordination Data** | Name, College, USN, Gender, Vehicle Model | MongoDB `users` & `rides` | **INTERNAL / RIDE SCOPED** | Co-participants on active rides can view USN and gender for campus verification. Phone number and personal email remain private. |
| **Geo-Location & Live GPS** | Lat/Lng coordinates, Route points | MongoDB `rides` & Socket.IO | **CONFIDENTIAL** | Live GPS coordinates are broadcast strictly to verified ride participants in room `ride-{rideId}`. Non-participants receive 403 Forbidden. |
| **Emergency SOS Data** | SOS alerts, GPS location, Incident notes | MongoDB `sos` collection | **CRITICAL** | Accessible only by ride participants and verified administrators. Emitted to `admins` room. |

---

## 2. Privacy-Preserving User Profiles

### Field-Level Masking Matrix

```
                  ┌───────────────────────────────────────────────┐
                  │                 GET /api/users/:id            │
                  └───────────────────────┬───────────────────────┘
                                          │
            ┌─────────────────────────────┼─────────────────────────────┐
            ▼                             ▼                             ▼
    [ Account Owner ]             [ Co-Participant ]             [ Unrelated User ]
   (or Verified Admin)             (Active Ride)                 (Campus Seeker)
            │                             │                             │
            ▼                             ▼                             ▼
   Full Profile:                 Coordination View:             Minimal Public View:
   - _id                         - _id                          - _id
   - name                        - name                         - name
   - email                       - profilePhoto                 - profilePhoto
   - phone                       - college                      - college
   - usn                         - role                         - role
   - gender                      - usn (for pickup verify)      - kycStatus
   - profilePhoto                - gender                       - createdAt
   - vehicles                    - kycStatus
   - emergencyContact            - isRideParticipant: true      [ Stripped: phone, email,
   - kycStatus                                                    usn, gender, emergency,
   - createdAt                   [ Stripped: phone, email,        vehicles, kycDocs ]
                                   emergency, kycDocs ]
```

---

## 3. Data Ingestion & Sanitization

1. **Input Scrubbing**: `express-mongo-sanitize` scrubs all incoming JSON keys for prohibited MongoDB operator characters (`$`, `.`).
2. **Strict Property Allowlists**: Profile updates (`PUT /api/users/profile`) strictly enforce an allowlist (`['gender', 'emergencyContact', 'usn', 'profilePhoto']`). Any attempt to elevate `role`, set `kycStatus`, or mark `blocked: false` is silently ignored.
3. **Phone Number Change Throttle**: Updates to student phone numbers (`PUT /api/users/profile/phone`) enforce a server-side 90-day cooldown period (`phoneLastUpdatedAt`) to prevent account takeover and burner-number hopping.

---

## 4. Secure Storage & Deletion

- **KYC Documents**: Stored under random UUID filenames (`crypto.randomUUID()`) in private directories with `0o600` permissions. When deleted (`DELETE /api/kyc/document/:userId/:docType`), the physical file is unlinked immediately from disk and the database reference is cleared.
- **Audit Trails**: Every document access, deletion, and review is permanently recorded in `user.kycAuditLogs` with actor ID, IP address, and timestamp.
