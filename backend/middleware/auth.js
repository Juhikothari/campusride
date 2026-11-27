// backend/middleware/auth.js
// Production-grade JWT authentication with single-device enforcement,
// algorithm restrictions, purpose isolation, and real-time account status verification.

const jwt = require('jsonwebtoken');
const User = require('../users/users.model');

async function verifySessionAndStatus(decoded, res) {
  if (!decoded || !decoded.userId) {
    res.status(401).json({ message: 'Token payload missing user identity.' });
    return null;
  }

  const user = await User.findById(decoded.userId)
    .select('currentSessionSeed blocked isBlocked blockReason suspended suspendedUntil suspensionReason role');
  if (!user) {
    res.status(401).json({ message: 'Account not found or deactivated.' });
    return null;
  }

  if (user.blocked || user.isBlocked) {
    res.status(403).json({
      code: 'ACCOUNT_BLOCKED',
      blocked: true,
      blockReason: user.blockReason || 'Violation of campus community guidelines.',
      message: 'This account has been blocked by administrators.',
    });
    return null;
  }

  if (user.suspended) {
    res.status(403).json({
      code: 'ACCOUNT_SUSPENDED',
      suspended: true,
      suspensionReason: user.suspensionReason || 'Account suspended by administrators.',
      suspendedUntil: user.suspendedUntil || null,
      message: 'This account is currently suspended from campus rides.',
    });
    return null;
  }

  if (decoded.sessionSeed) {
    if (!user.currentSessionSeed || user.currentSessionSeed !== decoded.sessionSeed) {
      res.status(401).json({
        message: 'Session expired, replaced, or revoked. Please log in again.',
        code: 'SESSION_REPLACED',
      });
      return null;
    }
  }

  return user;
}

// Standard Bearer authentication for all general API endpoints (never accepts query tokens or scoped KYC tokens)
async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  const token = header && header.startsWith('Bearer ') ? header.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ message: 'Authentication required. Bearer token must be provided in Authorization header.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return res.status(401).json({ message: 'Invalid, malformed, or expired authentication token.' });
  }

  // Strictly reject purpose-scoped tokens (e.g. kyc_document_access, kyc_registration_upload) on general routes
  if (decoded && decoded.purpose) {
    return res.status(403).json({
      message: 'Scoped access tokens are not permitted for general API routes.',
      code: 'SCOPED_TOKEN_FORBIDDEN',
    });
  }

  try {
    const user = await verifySessionAndStatus(decoded, res);
    if (!user) return;

    req.user = {
      userId: user._id.toString(),
      role: user.role,
      sessionSeed: decoded.sessionSeed,
      deviceId: decoded.deviceId,
    };
    req.tokenDecoded = decoded;
    next();
  } catch (dbErr) {
    console.error('Auth middleware verification error:', dbErr.message);
    return res.status(500).json({ message: 'Internal authentication service error' });
  }
}

// Exclusive middleware for GET /api/kyc/document/:userId/:docType:
// Accepts full session Bearer OR short-lived query token strictly scoped to targetUserId, docType, and op='read'.
async function kycDocumentAuth(req, res, next) {
  let token = null;
  let viaQuery = false;
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    token = header.split(' ')[1];
  } else if (req.query && typeof req.query.token === 'string' && req.query.token.trim()) {
    token = req.query.token.trim();
    viaQuery = true;
  }

  if (!token) {
    return res.status(401).json({ message: 'Authentication required. No Bearer token or signed document token provided.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return res.status(401).json({ message: 'Invalid, malformed, or expired document access token.' });
  }

  if (viaQuery || decoded?.purpose) {
    if (decoded.purpose !== 'kyc_document_access') {
      return res.status(403).json({
        message: 'Access denied: Invalid or missing signed token purpose',
        code: 'INVALID_TOKEN_PURPOSE',
      });
    }
    if (decoded.op !== 'read') {
      return res.status(403).json({
        message: 'Access denied: Signed token operation must be read',
        code: 'INVALID_TOKEN_OP',
      });
    }
    if (!decoded.exp || !decoded.sessionSeed || !decoded.targetUserId || !decoded.docType) {
      return res.status(403).json({
        message: 'Access denied: Signed document token missing required security bindings',
        code: 'INCOMPLETE_SIGNED_TOKEN',
      });
    }
    if (String(decoded.targetUserId) !== String(req.params.userId)) {
      return res.status(403).json({
        message: 'Access denied: Signed token target user mismatch',
        code: 'TOKEN_TARGET_MISMATCH',
      });
    }
    if (String(decoded.docType) !== String(req.params.docType)) {
      return res.status(403).json({
        message: 'Access denied: Signed token document type mismatch',
        code: 'TOKEN_DOCTYPE_MISMATCH',
      });
    }
  }

  try {
    const user = await verifySessionAndStatus(decoded, res);
    if (!user) return;

    req.user = {
      userId: user._id.toString(),
      role: user.role,
      sessionSeed: decoded.sessionSeed,
      deviceId: decoded.deviceId,
    };
    req.tokenDecoded = decoded;
    req.viaSignedUrl = Boolean(viaQuery || decoded?.purpose === 'kyc_document_access');
    next();
  } catch (dbErr) {
    console.error('KYC document auth error:', dbErr.message);
    return res.status(500).json({ message: 'Internal authentication service error' });
  }
}

authMiddleware.kycDocumentAuth = kycDocumentAuth;
module.exports = authMiddleware;
