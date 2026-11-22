# HOGO (CampusRide) — API Authorization Matrix

This document defines the authoritative access control rules, role requirements, object-level checks, and rate limits for all API endpoints in HOGO (CampusRide).

---

## 1. Role Definitions

- **Public / Anonymous:** Unauthenticated client (mobile app or browser).
- **Seeker:** Authenticated student/faculty member booking rides (`role: 'seeker'`).
- **Provider:** Authenticated student/faculty member offering rides (`role: 'provider'`).
- **Both:** Authenticated user with dual provider/seeker privileges (`role: 'both'`).
- **Administrator:** Server-verified administrative operator (`role: 'admin'`).

---

## 2. API Authorization Matrix

### Authentication Endpoints (`/api/auth`)
| Method | Endpoint | Authentication | Required Role | Object-Level Verification | Rate Limit | Description |
|---|---|---|---|---|---|---|
| `POST` | `/api/auth/register` | None | Public | Valid college domain / USN format | 25 req / 15m | Student / provider registration |
| `POST` | `/api/auth/login` | None | Public | Account unblocked / unsuspended | 25 req / 15m | JWT credential authentication |
| `POST` | `/api/auth/send-otp` | None | Public | 60s cooldown per email | 25 req / 15m | Cryptographically secure OTP dispatch |
| `POST` | `/api/auth/verify-otp` | None | Public | Max 5 failed attempts per OTP | 25 req / 15m | Verify OTP & receive reset token |
| `POST` | `/api/auth/reset-password` | Bearer Token | Public (Reset Token) | Valid reset token + session wipe | 25 req / 15m | Set new password & rotate session |
| `POST` | `/api/auth/logout` | Bearer Token | Any | Clears active session seed | Global | Revoke active mobile session |

### User Profile Endpoints (`/api/users`)
| Method | Endpoint | Authentication | Required Role | Object-Level Verification | Rate Limit | Description |
|---|---|---|---|---|---|---|
| `GET` | `/api/users/profile` | Bearer Token | Any | Returns caller's profile | Global | Fetch authenticated user data |
| `PUT` | `/api/users/profile` | Bearer Token | Any | Explicit allowlist (no escalation) | Global | Update gender, contact, USN, avatar |
| `GET` | `/api/users/:id` | Bearer Token | Any | Strips KYC docs & passwords | Global | View public profile of peer |
| `POST` | `/api/users/fcm-token` | Bearer Token | Any | Caller's user record only | Global | Register mobile push token |

### Ride Management Endpoints (`/api/ride`)
| Method | Endpoint | Authentication | Required Role | Object-Level Verification | Rate Limit | Description |
|---|---|---|---|---|---|---|
| `POST` | `/api/ride/post` | Bearer Token | Provider, Both | Approved KYC & vehicle registered | Global | Publish active/scheduled ride |
| `GET` | `/api/ride/search` | Bearer Token | Any | Geospatial radius filter | Global | Search rides by pickup/drop |
| `GET` | `/api/ride/my-rides` | Bearer Token | Provider, Both | Filters by `providerId === req.user.userId` | Global | View posted ride history |
| `GET` | `/api/ride/:id` | Bearer Token | Any | None | Global | Get public ride details |
| `PUT` | `/api/ride/:id` | Bearer Token | Provider, Both | Caller must be ride `providerId` | Global | Update ride notes, time, seats |
| `POST` | `/api/ride/:id/cancel` | Bearer Token | Provider, Both | Caller must be ride `providerId` | Global | Cancel posted ride |

### Booking Endpoints (`/api/booking`)
| Method | Endpoint | Authentication | Required Role | Object-Level Verification | Rate Limit | Description |
|---|---|---|---|---|---|---|
| `POST` | `/api/booking/book` | Bearer Token | Seeker, Both | Cannot book own ride; valid seats | Global | Request seat on ride |
| `GET` | `/api/booking/my-bookings` | Bearer Token | Any | Caller's bookings only | Global | List seeker booking history |
| `PATCH` | `/api/booking/:id/respond` | Bearer Token | Provider, Both | Caller must own ride | Global | Accept or decline seeker booking |
| `POST` | `/api/booking/:id/cancel` | Bearer Token | Seeker, Both | Caller must own booking | Global | Cancel seeker seat request |

### KYC & Identity Verification Endpoints (`/api/kyc`)
| Method | Endpoint | Authentication | Required Role | Object-Level Verification | Rate Limit | Description |
|---|---|---|---|---|---|---|
| `POST` | `/api/kyc/upload` | Bearer Token | Any | Caller uploads own docs | Global | Upload Aadhaar / License / College ID |
| `GET` | `/api/kyc/status` | Bearer Token | Any | Caller's status only | Global | Check review status |
| `GET` | `/api/kyc/document/:userId/:docType` | Bearer Token | Owner or Admin | Strict: `caller.userId === userId \|\| caller.isAdmin` | Global | Access signed KYC document URL |
| `GET` | `/api/kyc/admin/pending` | Bearer Token | Admin | Database-verified administrator | Global | Queue of unverified submissions |
| `POST` | `/api/kyc/admin/review` | Bearer Token | Admin | Database-verified administrator | Global | Approve or reject submission |

### Chat & Live Tracking Endpoints (`/api/chat`, `/api/tracking`)
| Method | Endpoint | Authentication | Required Role | Object-Level Verification | Rate Limit | Description |
|---|---|---|---|---|---|---|
| `GET` | `/api/chat/:rideId` | Bearer Token | Any | Strict: Provider, passenger, or admin | Global | Read private ride messages |
| `POST` | `/api/chat/:rideId` | Bearer Token | Any | Strict: Provider, passenger, or admin | Global | Post message in ride chat |
| `GET` | `/api/tracking/:rideId` | Bearer Token | Any | Strict: Provider, passenger, or admin | Global | Fetch live driver GPS breadcrumbs |
| `POST` | `/api/tracking/update` | Bearer Token | Provider, Both | Caller must be ride provider | Global | Ingest driver GPS coordinates |

### Emergency SOS & Incidents Endpoints (`/api/sos`, `/api/incidents`)
| Method | Endpoint | Authentication | Required Role | Object-Level Verification | Rate Limit | Description |
|---|---|---|---|---|---|---|
| `POST` | `/api/sos/trigger` | Bearer Token | Any | Inactive rides or valid GPS | Global | Trigger SOS, alert contacts & admin |
| `GET` | `/api/sos/active/:rideId` | Bearer Token | Any | Caller must be participant or admin | Global | Check active SOS state |
| `GET` | `/api/sos/admin/all` | Bearer Token | Admin | Database-verified administrator | Global | Access all emergency alerts |
| `PATCH` | `/api/sos/:id/acknowledge` | Bearer Token | Admin, Provider, Initiator | Authorized handler only | Global | Acknowledge active alert |
| `PATCH` | `/api/sos/:id/resolve` | Bearer Token | Admin, Provider, Initiator | Authorized handler only | Global | Mark emergency resolved |
| `POST` | `/api/incidents/report` | Bearer Token | Any | Caller creates report | Global | File safety incident report |
| `GET` | `/api/incidents/all` | Bearer Token | Admin | Database-verified administrator | Global | View all incident reports |
| `PATCH` | `/api/incidents/:id/status`| Bearer Token | Admin | Database-verified administrator | Global | Update incident status & notes |

### Administration Endpoints (`/api/admin`)
| Method | Endpoint | Authentication | Required Role | Object-Level Verification | Rate Limit | Description |
|---|---|---|---|---|---|---|
| `GET` | `/api/admin/users` | Bearer Token | Admin | Database-verified administrator | Global | List all registered users |
| `PATCH` | `/api/admin/users/:id/block` | Bearer Token | Admin | Database-verified administrator | Global | Suspend or block user account |
| `GET` | `/api/admin/stats` | Bearer Token | Admin | Database-verified administrator | Global | System analytics & KPIs |
| `POST` | `/api/admin/colleges` | Bearer Token | Admin | Database-verified administrator | Global | Add/approve campus college |
| `DELETE` | `/api/admin/colleges/:id` | Bearer Token | Admin | Database-verified administrator | Global | Remove campus college from dropdown |
