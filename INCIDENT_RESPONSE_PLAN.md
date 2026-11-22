# HOGO (CampusRide) — Cyber & Safety Incident Response Plan (IRP)

**Document Ref:** SEC-IRP-2026-V1  
**Classification:** Confidential / Operational Emergency Procedure  

---

## 1. Incident Response Team & Escalation Hierarchy

| Role | Responsibility | Escalation Trigger |
|---|---|---|
| **Incident Commander (IC)** | Leads triage, containment, and executive communications | All High & Critical Incidents |
| **Security Operations Lead (SecOps)** | Investigates attack vectors, isolates malicious traffic, reviews logs | Unauthorized access, data breach, DDoS |
| **Campus Safety Liaison** | Coordinates with college authorities, police, and emergency services | SOS Activation, Physical Threat, Assault |
| **Lead Backend Engineer** | Deploys hotfixes, rotates secrets, isolates compromised infrastructure | API exploit, credential leak, DB corruption |
| **Communications Officer** | Manages user notifications and regulatory disclosures (CERT-In / DPDP) | Confirmed PII breach within 6 hours |

---

## 2. Incident Severity Classification Framework

| Severity Level | Operational Criteria | Examples | Target Response SLA |
|---|---|---|---|
| **CRITICAL (Level 1)** | Immediate threat to physical student safety, active data breach, complete platform outage | Active SOS during ride, kidnap, assault, exposed KYC database, unauthenticated root access | **< 15 minutes** |
| **HIGH (Level 2)** | Targeted account takeover, privilege escalation, severe safety harassment | Admin role compromise, rash driving endangering life, stalking, extortion | **< 1 hour** |
| **MEDIUM (Level 3)** | Fraudulent accounts, fake identity, fare disputes, localized API abuse | Fake college ID upload, seat spoofing, brute-force OTP attempts blocked by rate limiter | **< 4 hours** |
| **LOW (Level 4)** | Non-security application glitches, minor UI bugs | Search filter rendering error, notification delay | **< 24 hours** |

---

## 3. Incident Response Lifecycle Phases

```
+---------------+     +---------------+     +---------------+     +---------------+
| 1. DETECTION  | --> |2. CONTAINMENT | --> |3. ERADICATION | --> | 4. RECOVERY   |
| - WAF Alerts  |     | - Lock Account|     | - Patch Vuln  |     | - Restore DB  |
| - SOS Trigger |     | - Isolate IP  |     | - Rotate Keys |     | - Verify Tests|
+---------------+     +---------------+     +---------------+     +---------------+
                                                                          |
                                                                          v
                                                                  +---------------+
                                                                  | 5. REVIEW     |
                                                                  | - Post-Mortem |
                                                                  | - Policy Upd  |
                                                                  +---------------+
```

---

## 4. Specialized Action Playbooks

### Playbook A: Physical Safety SOS Emergency Trigger
1. **Immediate Ingestion (T+0):** System records SOS event, persists live coordinates to DB, and broadcasts `adminSOSAlert` to administrative operators.
2. **Automated Notification (T+30s):** Automated SMS and high-priority push notifications dispatched to user's registered emergency contact with live tracking link.
3. **Dispatcher Triage (T+2m):** Campus safety operator dials the student and driver immediately.
4. **Law Enforcement Dispatch (T+5m):** If no contact or distress confirmed, alert 112 / campus security with real-time GPS telemetry and vehicle registration.
5. **Resolution & Evidence Lock:** The ride record, chat history, and GPS breadcrumbs are placed under legal hold.

### Playbook B: Data Breach / KYC Exfiltration Attempt
1. **Containment:** Immediately revoke active JWT sessions via database `currentSessionSeed` rotation.
2. **Access Isolation:** Block the attacking IP on Cloudflare WAF and terminate affected Socket.IO connections.
3. **Audit Assessment:** Review access logs for `GET /api/kyc/document/` to identify exact records queried.
4. **Credential Rotation:** Rotate `JWT_SECRET`, MongoDB connection strings, and Cloudinary API secrets.
5. **Regulatory Disclosure:** If student PII was compromised, report incident to CERT-In and affected individuals within prescribed statutory deadlines.

### Playbook C: Account Takeover / Brute-Force Attempt
1. **Automated Defense:** Express rate limiter caps attempts at 25 req/15m. OTP verification invalidates after 5 failures.
2. **Account Freeze:** Flag user account with `suspended: true` if rapid password reset failures occur.
3. **Verification:** Require identity reverification via verified college email and phone OTP before lifting suspension.
