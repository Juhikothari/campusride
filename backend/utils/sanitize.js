// backend/utils/sanitize.js
// Centralized redaction and error sanitization utilities to prevent token, URL, path, and credential leakage.

const SENSITIVE_PARAM_REGEX = /^(token|jwt|auth|secret|password|pwd|otp|code|key|apikey|api_key|phone|email|usn|aadhar|signature|sig|resettoken|refreshtoken|access_token|refresh_token)$/i;
const SENSITIVE_SUBSTR_REGEX = /(token|secret|password|credential|otp|auth|signature|phone|email)/i;

/**
 * Redacts sensitive query parameters from a URL string before logging.
 */
function sanitizeUrlForLogging(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  try {
    const qIndex = rawUrl.indexOf('?');
    if (qIndex === -1) return rawUrl;
    const pathPart = rawUrl.substring(0, qIndex);
    const queryPart = rawUrl.substring(qIndex + 1);
    if (!queryPart) return pathPart;

    const params = new URLSearchParams(queryPart);
    for (const [key, val] of params.entries()) {
      const looksLikeJwt = typeof val === 'string' && /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(val);
      if (SENSITIVE_PARAM_REGEX.test(key) || SENSITIVE_SUBSTR_REGEX.test(key) || looksLikeJwt) {
        params.set(key, '[REDACTED]');
      }
    }
    return `${pathPart}?${params.toString()}`;
  } catch {
    return rawUrl.split('?')[0];
  }
}

/**
 * Strips query string completely from URL/path for safe public error output.
 */
function stripQueryFromUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '/';
  return rawUrl.split('?')[0] || '/';
}

/**
 * Redacts Bearer tokens, JWTs, Mongo URIs, and secret query strings from arbitrary log text.
 */
function sanitizeLogText(text) {
  if (!text) return '';
  let str = String(text);
  str = str.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]');
  str = str.replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/g, '[REDACTED_JWT]');
  str = str.replace(/mongodb(\+srv)?:\/\/[^\s'"]+/gi, 'mongodb://[REDACTED]');
  str = str.replace(/([?&](?:token|jwt|auth|secret|password|otp|key|apiKey|signature|sig|phone|email)=)[^&\s'"]+/gi, '$1[REDACTED]');
  return str;
}

/**
 * Sanitizes errors before returning them in public API HTTP responses.
 * Prevents leaking stack traces, filesystem paths, database internals, or credentials.
 */
function sanitizeErrorForClient(err, fallbackMessage = 'An unexpected error occurred. Please contact support.') {
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    return fallbackMessage;
  }
  const rawMsg = typeof err === 'string' ? err : (err?.message || fallbackMessage);
  let safe = sanitizeLogText(rawMsg);
  // Strip filesystem paths (Windows/Unix)
  safe = safe.replace(/[A-Za-z]:\\[^\s:'"]+/g, '[INTERNAL_PATH]');
  safe = safe.replace(/\/(?:home|var|app|data|usr|etc|tmp)\/[^\s:'"]+/g, '[INTERNAL_PATH]');
  return safe;
}

module.exports = {
  sanitizeUrlForLogging,
  stripQueryFromUrl,
  sanitizeLogText,
  sanitizeErrorForClient
};
