# HOGO (CampusRide) — Environment Configuration & Secrets Management Guide

This guide details all environment variables, security configurations, secret generation commands, and key rotation procedures required to deploy and maintain CampusRide across Development, Staging, and Production.

---

## 1. Environment Variable Reference Matrix

| Variable Name | Required | Default / Format | Description & Security Guidelines |
|---|---|---|---|
| `PORT` | Optional | `5000` | Local port for Express API server. In cloud deployments (Render, AWS), dynamically assigned. |
| `NODE_ENV` | **Mandatory** | `production` / `development` / `test` | In `production`, suppresses stack traces in HTTP error responses and enables strict CORS enforcement. |
| `MONGODB_URI` | **Mandatory** | `mongodb+srv://<user>:<pwd>@cluster.mongodb.net/campusride?retryWrites=true&w=majority` | MongoDB connection string. In production, must use TLS/SSL (`ssl=true`) and dedicated credentials. |
| `JWT_SECRET` | **Mandatory** | Minimum 64-character hex/base64 string | Secret key for signing and verifying HS256 JWT tokens. Must have minimum 256-bit entropy. |
| `ADMIN_KEY` | **Mandatory** | High-entropy alphanumeric string | Secret key required during administrative account registration. Must not use default or fallback keys. |
| `FRONTEND_URL` | Optional | `https://fw-mq8p.onrender.com` | Allowed origin for web clients in CORS configuration. |
| `CLOUDINARY_CLOUD_NAME` | Optional | String | Cloudinary cloud identifier for secure KYC image storage. |
| `CLOUDINARY_API_KEY` | Optional | Alphanumeric string | Cloudinary API access key. |
| `CLOUDINARY_API_SECRET` | Optional | Alphanumeric secret | Cloudinary API secret for uploading and managing private identity documents. |
| `BREVO_API_KEY` | Optional | `xkeysib-...` | Brevo (Sendinblue) API key for sending transactional OTP emails to university email domains. |
| `SENDER_EMAIL` | Optional | `no-reply@campusride.in` | Verified sender email address configured in Brevo transactional settings. |

---

## 2. Generating Cryptographically Secure Secrets

Never use default or dictionary strings for `JWT_SECRET` or `ADMIN_KEY`. Use Node.js crypto CLI or OpenSSL to generate high-entropy secrets:

### Generate 64-byte Hex JWT Secret (512-bit entropy)
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Generate 32-character High-Entropy Admin Key
```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

---

## 3. Environment Templates

### 3.1 Local Development (`backend/.env.development`)
```ini
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/campusride_dev
JWT_SECRET=dev_jwt_secret_change_in_production_min_length_32_bytes_12345
ADMIN_KEY=dev_admin_registration_key_2026
FRONTEND_URL=http://localhost:3000
BREVO_API_KEY=xkeysib-mock-dev-key
SENDER_EMAIL=no-reply@campusride.local
```

### 3.2 Production Deployment (`Render / Kubernetes Secrets`)
```ini
NODE_ENV=production
MONGODB_URI=mongodb+srv://campusride_prod_usr:SECURE_PASSWORD@prod-cluster.mongodb.net/campusride?retryWrites=true&w=majority&ssl=true
JWT_SECRET=f3a8c17b5e8248...64_BYTES_OF_ENTROPY...90c42d
ADMIN_KEY=adm_prod_99xK7_mQ82Lp...
FRONTEND_URL=https://fw-mq8p.onrender.com
CLOUDINARY_CLOUD_NAME=campusride-prod
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=abcdefghijklmnopqrstuvwxyz12
BREVO_API_KEY=xkeysib-prod-api-key
SENDER_EMAIL=no-reply@campusride.in
```

---

## 4. Key Rotation & Revocation Procedures

### 4.1 Rotating `JWT_SECRET`
Rotating `JWT_SECRET` invalidates all existing user access tokens across mobile and web clients:
1. Schedule rotation during off-peak hours (e.g., 03:00 AM).
2. Generate new secret using `crypto.randomBytes(64).toString('hex')`.
3. Update environment secret in cloud dashboard (Render / AWS Secrets Manager).
4. Redeploy backend API nodes.
5. All mobile clients will automatically receive HTTP 401 and redirect users to login using their stored credentials or OTP.

### 4.2 Rotating Database Credentials (`MONGODB_URI`)
1. Create a secondary administrative user in MongoDB Atlas with identical readWrite roles.
2. Update `MONGODB_URI` on staging instances to verify connection.
3. Update `MONGODB_URI` on production backend nodes with zero downtime rolling restart.
4. Drop old user credentials in MongoDB Atlas.
