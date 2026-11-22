# HOGO (CampusRide) — Enterprise Data Retention & Disposal Policy

**Document Ref:** POL-RET-2026-V1  
**Target:** Production Data Repositories (MongoDB, Cloudinary, Logs)  
**Standard:** Compliance with DPDP Act 2023, ISO 27001 A.8.10, and Campus Safety Guidelines  

---

## 1. Objective and Scope
This policy defines the retention schedules, secure disposal criteria, automated purge routines, and legal hold protocols for all personal, operational, and telemetry data managed by HOGO (CampusRide).

---

## 2. Retention Schedule by Data Classification

| Entity / Collection | Data Categories | Active Period | Post-Active Retention | Final Disposal Method |
|---|---|---|---|---|
| **`User` Records** | Name, USN, college, email, phone, role | Active student tenure | 90 days after account closure | Cryptographic erasure / Soft-delete with PII scrub |
| **`User.kycDocuments`** | Aadhaar, DL, College ID images, selfies | While review pending or active verified account | 90 days following account closure | Direct Cloudinary secure API deletion + DB field wipe |
| **`Ride` Records** | Pickup, drop, date, time, vehicle, cost, seats | Active ride lifecycle | 365 days post-completion | Anonymized for route analytics; PII decoupled |
| **`Tracking` Telemetry** | High-frequency GPS coordinates, breadcrumbs | Active ride duration | 30 days post-ride | Hard deletion via automated MongoDB TTL index |
| **`Chat` Messages** | Private ride messages between rider & driver | Active ride lifecycle | 60 days post-ride | Hard deletion via automated background cron |
| **`SOS` Emergency Records**| SOS trigger time, GPS, contacts notified, responder logs | 180 days | 3 years if associated with formal legal investigation | Cold storage archive / Sharded offline audit vault |
| **`Incident` Reports** | Safety complaints, harassment reports, accidents | 2 years | 5 years for criminal or campus disciplinary matters | Role-restricted archival |
| **Access & Audit Logs** | IP address, timestamp, route, user agent, status codes | 30 days hot storage | 180 days compressed cold storage | Automated log rotation & purge |

---

## 3. Automated Purge Mechanisms

### 3.1 MongoDB TTL (Time-To-Live) Indexes
For transient tracking and ephemeral tokens, MongoDB native TTL indexes automatically remove expired documents:
```javascript
// Automatically delete tracking breadcrumbs after 30 days
trackingSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

// Automatically expire unverified OTP sessions after 5 minutes
otpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 300 });
```

### 3.2 Scheduled Background Cleanup Routine
The backend server runs scheduled jobs to safely cancel stale pending rides (3 hours past departure) and clean expired sessions:
```javascript
// Stale Ride Auto-Cancel (runs every 10 minutes)
setInterval(autoCancelStaleRides, 10 * 60 * 1000);
```

---

## 4. Legal Hold & Incident Preservation
When a formal incident report (e.g., Harassment, Theft, Vehicle Collision) or official law enforcement inquiry is initiated:
1. The incident record and associated ride telemetry are tagged with `legalHold: true`.
2. Automated TTL purging and manual deletion requests are suspended for the tagged records.
3. Access is restricted exclusively to authorized legal counsel and the Chief Security Officer.
4. Once the legal inquiry is formally closed, normal retention and disposal schedules resume.
