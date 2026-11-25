# HOGO (CampusRide) — Production Environment Configuration Guide

**Updated:** November 25, 2026  
**Target Platform:** Render Web Service (Single-Instance Persistent Disk) / AWS / Docker  
**Status:** Updated Configuration Guide (Production secrets not stored in repository)  

---

## 1. Required Production Environment Variables

| Variable Name | Required? | Example / Format | Security Notes |
|---|---|---|---|
| `NODE_ENV` | **YES** | `production` | Enforces fail-closed database startup, disables verbose error stack traces. |
| `PORT` | **YES** | `10000` (Render) / `5000` | Port for Express HTTP/WebSocket server. |
| `MONGODB_URI` | **YES** | `mongodb+srv://user:pass@cluster.mongodb.net/hogo?retryWrites=true&w=majority` | Production database connection string. Must start with `mongodb://` or `mongodb+srv://`. If absent in production, server fails closed immediately. |
| `JWT_SECRET` | **YES** | `64-character-hex-or-base64-random-string` | Secret key for HS256 JWT signing and short-lived signed URLs. Minimum 32 bytes of cryptographic entropy. |
| `BREVO_API_KEY` | **YES** | `xkeysib-...` | Required for sending 6-digit campus OTP verification emails via Brevo HTTPS API. |
| `BREVO_SENDER_EMAIL`| **YES** | `noreply@hogoapp.com` | Verified transactional email sender address in Brevo. |
| `KYC_STORAGE_DIR` | **YES (Prod)** | `/data/uploads/kyc_private` | Persistent disk mount path for private KYC files (`render.yaml`). Single-instance durable; multi-instance requires S3/R2. |
| `FRONTEND_URL` | Optional | `https://campusride.app` | Production web application URL for CORS allowlisting. |
| `PHOTON_URL` / `NOMINATIM_URL` / `OSRM_URL` | Optional | `https://photon.komoot.io` / `https://router.project-osrm.org` | Self-hosted or public OpenStreetMap geocoding and routing backends. |
| `GEOAPIFY_API_KEY` | Optional | `your_geoapify_key` | Optional fallback geocoding provider when Photon/Nominatim are degraded. |
| `EXPO_PUBLIC_MAPLIBRE_STYLE_URL` | Optional (Mobile) | `https://tiles.openfreemap.org/styles/liberty` | Vector tile style URL consumed by `@maplibre/maplibre-react-native`. |

---

## 2. Optional Third-Party Service Credentials

### SMS Gateway (Emergency SOS)
By default, if unconfigured, the backend safely returns `status: 'client_action_required'` and provider `NOT_CONFIGURED`, prompting the mobile client to dispatch via native SMS composer.

To enable backend-automated SMS dispatch:

**Option A: Twilio**
```env
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890
# Required canonical base URL or explicit callback URL for strict HMAC validation (do NOT rely on spoofable headers)
TWILIO_WEBHOOK_URL=https://campusride-backend-gwgr.onrender.com/api/sos/webhook/twilio
# Or set WEBHOOK_BASE_URL / PUBLIC_URL / RENDER_EXTERNAL_URL
```
> **Note:** Until `TWILIO_AUTH_TOKEN` is configured, `POST /api/sos/webhook/twilio` fails closed with HTTP 503 `TWILIO_NOT_CONFIGURED`.

**Option B: Fast2SMS (India)**
```env
SMS_PROVIDER=fast2sms
FAST2SMS_API_KEY=your_fast2sms_api_key
```

### Cloudinary (Optional Public Avatars)
Used for non-sensitive public user avatar photos. KYC identity documents are strictly stored in private disk storage (`backend/uploads/kyc_private/`) and never uploaded to public image CDNs.
```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

---

## 3. Deployment Configuration (`render.yaml`)

```yaml
services:
  - type: web
    name: campusride-backend
    runtime: node
    rootDir: backend
    buildCommand: npm install
    startCommand: node server.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
    healthCheckPath: /api/health/ready
```

---

## 4. Secret Management Best Practices
1. **Never commit `.env` files**: `.gitignore` must always include `.env`, `*.key`, and `uploads/kyc_private/`.
2. **Log Sanitization**: Database URIs containing passwords are automatically masked (`//***:***@`) in application logs.
3. **Rotating Secrets**: If `JWT_SECRET` is rotated, all existing sessions and tokens are automatically revoked, requiring users to log in again.
