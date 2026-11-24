// backend/services/sms/sms.service.js
// Pluggable SMS Gateway Provider Abstraction for Emergency SOS & Alerts
const https = require('https');

class BaseSMSProvider {
  async sendSMS({ to, message, idempotencyKey }) {
    throw new Error('sendSMS must be implemented by provider');
  }
}

/**
 * Fallback provider when no SMS credentials are configured on the backend.
 * Explicitly marks status as 'client_action_required' and never pretends delivery occurred.
 */
class UnconfiguredSMSProvider extends BaseSMSProvider {
  constructor(reason = 'Backend SMS gateway credentials not configured.') {
    super();
    this.name = 'NOT_CONFIGURED';
    this.reason = reason;
  }

  async sendSMS({ to, message }) {
    return {
      success: false,
      status: 'client_action_required',
      provider: this.name,
      messageId: null,
      error: this.reason,
      notes: 'No backend SMS gateway configured; native client action required via device SMS composer',
      attempts: 1
    };
  }
}

/**
 * Twilio SMS Provider (REST API)
 */
class TwilioSMSProvider extends BaseSMSProvider {
  constructor(accountSid, authToken, fromNumber) {
    super();
    this.name = 'TWILIO';
    this.accountSid = accountSid;
    this.authToken = authToken;
    this.fromNumber = fromNumber;
  }

  async sendSMS({ to, message }) {
    const postData = new URLSearchParams({
      To: to,
      From: this.fromNumber,
      Body: message
    }).toString();

    const authHeader = 'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');

    return new Promise((resolve) => {
      const req = https.request({
        hostname: 'api.twilio.com',
        port: 443,
        path: `/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 8000
      }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              const twilioStatus = parsed.status; // 'queued', 'sending', 'sent', 'delivered'
              const normalizedStatus = (twilioStatus === 'delivered') ? 'delivered' :
                                       (twilioStatus === 'sent') ? 'sent' : 'provider_accepted';
              resolve({
                success: true,
                status: normalizedStatus,
                provider: 'TWILIO',
                messageId: parsed.sid,
                error: null,
                notes: `Twilio initial status: ${twilioStatus} (provider_accepted)`
              });
            } else {
              resolve({
                success: false,
                status: 'failed',
                provider: 'TWILIO',
                messageId: parsed.sid || null,
                error: parsed.message || `Twilio HTTP error ${res.statusCode}`,
                notes: parsed.code ? `Error Code: ${parsed.code}` : null
              });
            }
          } catch (e) {
            resolve({
              success: false,
              status: 'failed',
              provider: 'TWILIO',
              messageId: null,
              error: `Invalid JSON response: ${e.message}`,
              notes: data.substring(0, 100)
            });
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          status: 'failed',
          provider: 'TWILIO',
          messageId: null,
          error: 'Twilio request timed out'
        });
      });

      req.on('error', (err) => {
        resolve({
          success: false,
          status: 'failed',
          provider: 'TWILIO',
          messageId: null,
          error: err.message
        });
      });

      req.write(postData);
      req.end();
    });
  }
}

/**
 * Fast2SMS Provider (Indian SMS Gateway)
 */
class Fast2SMSSMSProvider extends BaseSMSProvider {
  constructor(apiKey, senderId = 'TXTIND') {
    super();
    this.name = 'FAST2SMS';
    this.apiKey = apiKey;
    this.senderId = senderId;
  }

  async sendSMS({ to, message }) {
    // Sanitize phone number (strip +91 if present for Indian numbers)
    const cleanNumber = to.replace(/^\+91/, '').replace(/\D/g, '');
    const postData = JSON.stringify({
      route: 'v3',
      sender_id: this.senderId,
      message: message,
      language: 'english',
      flash: 0,
      numbers: cleanNumber
    });

    return new Promise((resolve) => {
      const req = https.request({
        hostname: 'www.fast2sms.com',
        port: 443,
        path: '/dev/bulkV2',
        method: 'POST',
        headers: {
          'authorization': this.apiKey,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 8000
      }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.return === true) {
              resolve({
                success: true,
                status: 'provider_accepted',
                provider: 'FAST2SMS',
                messageId: parsed.request_id || null,
                error: null,
                notes: (parsed.message || []).join(', ') || 'Fast2SMS gateway accepted request'
              });
            } else {
              resolve({
                success: false,
                status: 'failed',
                provider: 'FAST2SMS',
                messageId: null,
                error: (parsed.message || ['Fast2SMS request failed']).join(', ')
              });
            }
          } catch (e) {
            resolve({
              success: false,
              status: 'failed',
              provider: 'FAST2SMS',
              messageId: null,
              error: `Invalid JSON response: ${e.message}`
            });
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          status: 'failed',
          provider: 'FAST2SMS',
          messageId: null,
          error: 'Fast2SMS request timed out'
        });
      });

      req.on('error', (err) => {
        resolve({
          success: false,
          status: 'failed',
          provider: 'FAST2SMS',
          messageId: null,
          error: err.message
        });
      });

      req.write(postData);
      req.end();
    });
  }
}

/**
 * Mock Provider for Unit/Integration Testing
 */
class MockSMSProvider extends BaseSMSProvider {
  constructor(shouldFail = false, shouldQueue = false) {
    super();
    this.name = 'MOCK';
    this.shouldFail = shouldFail;
    this.shouldQueue = shouldQueue;
    this.sentLog = [];
  }

  async sendSMS({ to, message, idempotencyKey }) {
    const record = {
      to,
      message,
      idempotencyKey,
      timestamp: new Date()
    };
    this.sentLog.push(record);

    if (this.shouldFail) {
      return {
        success: false,
        status: 'failed',
        provider: 'MOCK',
        messageId: null,
        error: 'Simulated SMS provider gateway error',
        notes: 'Mock provider failure simulation'
      };
    }

    return {
      success: true,
      status: this.shouldQueue ? 'queued' : 'sent',
      provider: 'MOCK',
      messageId: `mock-msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      error: null,
      notes: 'Delivered via mock provider'
    };
  }
}

/**
 * Central SMS Service with Retry Logic & Dynamic Provider Selection
 */
class SMSService {
  constructor() {
    this.provider = this._resolveProvider();
  }

  _resolveProvider() {
    const providerName = (process.env.SMS_PROVIDER || '').toLowerCase();
    
    if (providerName === 'mock') {
      return new MockSMSProvider(
        process.env.MOCK_SMS_FAIL === 'true',
        process.env.MOCK_SMS_QUEUE === 'true'
      );
    }

    if (providerName === 'twilio') {
      const sid = process.env.TWILIO_ACCOUNT_SID;
      const token = process.env.TWILIO_AUTH_TOKEN;
      const from = process.env.TWILIO_PHONE_NUMBER;
      if (sid && token && from) {
        return new TwilioSMSProvider(sid, token, from);
      }
      return new UnconfiguredSMSProvider('Twilio provider selected but TWILIO_ACCOUNT_SID/AUTH_TOKEN/PHONE_NUMBER missing.');
    }

    if (providerName === 'fast2sms') {
      const apiKey = process.env.FAST2SMS_API_KEY;
      if (apiKey) {
        return new Fast2SMSSMSProvider(apiKey);
      }
      return new UnconfiguredSMSProvider('Fast2SMS provider selected but FAST2SMS_API_KEY missing.');
    }

    // Default: Unconfigured provider
    return new UnconfiguredSMSProvider('No backend SMS provider configured. Environment SMS_PROVIDER is empty or unsupported.');
  }

  /**
   * Set custom provider (useful for testing)
   */
  setProvider(provider) {
    this.provider = provider;
  }

  /**
   * Send SMS with retry policy and exponential backoff
   * @param {Object} options { to, message, idempotencyKey, maxRetries }
   * @returns {Promise<Object>} Notification result with status, provider, attempts, error
   */
  async sendSMS({ to, message, idempotencyKey, maxRetries = 2 }) {
    let attempts = 0;
    let lastResult = null;

    // Unconfigured provider doesn't need retries
    if (this.provider instanceof UnconfiguredSMSProvider) {
      return await this.provider.sendSMS({ to, message, idempotencyKey });
    }

    while (attempts <= maxRetries) {
      attempts++;
      try {
        lastResult = await this.provider.sendSMS({ to, message, idempotencyKey });
        lastResult.attempts = attempts;
        if (lastResult.success || lastResult.status === 'client_action_required') {
          return lastResult;
        }
      } catch (err) {
        lastResult = {
          success: false,
          status: 'failed',
          provider: this.provider.name,
          messageId: null,
          error: err.message,
          attempts
        };
      }

      if (attempts <= maxRetries) {
        // Exponential backoff: 200ms, 400ms...
        const delay = Math.pow(2, attempts) * 100;
        await new Promise(r => setTimeout(r, delay));
      }
    }

    return lastResult;
  }
}

const smsServiceInstance = new SMSService();

module.exports = {
  smsService: smsServiceInstance,
  SMSService,
  UnconfiguredSMSProvider,
  TwilioSMSProvider,
  Fast2SMSSMSProvider,
  MockSMSProvider
};
