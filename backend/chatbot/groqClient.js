// backend/chatbot/groqClient.js
// Hardened Groq Chat Completions client:
// - Configurable model via GROQ_MODEL (with active fallback models)
// - Request timeouts via AbortController
// - Controlled exponential backoff retries for transient 429/5xx/network errors only
// - Never retries invalid credentials (401/403) or malformed prompts (400)
// - Returns structured errors without leaking API keys or personal user chat text

const DEFAULT_PRIMARY_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const DEFAULT_FALLBACK_MODELS = ['llama-3.1-8b-instant'];

function buildModelList() {
  const configured = (process.env.GROQ_MODEL || '').trim();
  const list = configured
    ? [configured, ...DEFAULT_FALLBACK_MODELS]
    : [DEFAULT_PRIMARY_MODEL, ...DEFAULT_FALLBACK_MODELS];
  return [...new Set(list)];
}

function classifyGroqError(status, codeText = '') {
  const lower = String(codeText || '').toLowerCase();
  if (status === 401 || status === 403 || lower.includes('invalid_api_key')) {
    return { statusCode: 503, code: 'AI_AUTH_ERROR', retryable: false, message: 'AI service authentication error.' };
  }
  if (status === 429 || lower.includes('rate_limit')) {
    return { statusCode: 429, code: 'AI_RATE_LIMITED', retryable: true, message: 'HOGO AI is temporarily busy. Please wait a moment and retry.' };
  }
  if (status === 404 || lower.includes('model_not_found') || lower.includes('decommissioned')) {
    return { statusCode: 503, code: 'AI_MODEL_DEPRECATED', retryable: true, message: 'Configured AI model is unavailable.' };
  }
  if (status >= 500) {
    return { statusCode: 503, code: 'AI_UPSTREAM_UNAVAILABLE', retryable: true, message: 'AI provider is temporarily unavailable.' };
  }
  return { statusCode: 502, code: 'AI_REQUEST_FAILED', retryable: false, message: 'AI request could not be completed.' };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function callGroqCompletion({
  messages,
  maxTokens = 700,
  temperature = 0.25,
  timeoutMs = 18000,
  fetchImpl = global.fetch,
}) {
  const apiKey = (process.env.GROQ_API_KEY || '').trim();
  if (!apiKey) {
    const err = new Error('AI assistant is not configured on this server.');
    err.statusCode = 503;
    err.code = 'AI_NOT_CONFIGURED';
    err.retryable = false;
    throw err;
  }

  if (typeof fetchImpl !== 'function') {
    const err = new Error('HTTP client unavailable.');
    err.statusCode = 500;
    err.code = 'AI_CLIENT_MISSING';
    throw err;
  }

  const models = buildModelList();
  let lastError = null;

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetchImpl('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: maxTokens,
            temperature,
          }),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (response.ok) {
          let payload;
          try {
            payload = await response.json();
          } catch {
            lastError = Object.assign(new Error('Malformed JSON from AI provider'), {
              statusCode: 502,
              code: 'AI_MALFORMED_RESPONSE',
              retryable: true,
            });
            continue;
          }

          const content = payload?.choices?.[0]?.message?.content;
          if (typeof content === 'string' && content.trim()) {
            return { reply: content.trim(), model };
          }

          lastError = Object.assign(new Error('Empty completion from AI provider'), {
            statusCode: 502,
            code: 'AI_EMPTY_RESPONSE',
            retryable: true,
          });
          continue;
        }

        // Non-OK status
        let errCodeText = '';
        try {
          const errJson = await response.json();
          errCodeText = errJson?.error?.code || errJson?.error?.type || '';
        } catch {}

        const classified = classifyGroqError(response.status, errCodeText);
        console.warn(`[GroqClient] model=${model} status=${response.status} code=${classified.code}`);
        lastError = Object.assign(new Error(classified.message), classified);

        // Auth/bad key -> stop immediately across all models
        if (classified.code === 'AI_AUTH_ERROR') {
          throw lastError;
        }
        // Deprecated/missing model -> skip retrying same model and try fallback model
        if (classified.code === 'AI_MODEL_DEPRECATED') {
          break;
        }
        // Transient -> backoff before 2nd attempt
        if (classified.retryable && attempt === 0) {
          await sleep(450);
          continue;
        }
        break;
      } catch (networkErr) {
        clearTimeout(timer);
        if (networkErr.code === 'AI_AUTH_ERROR') {
          throw networkErr;
        }
        const isAbort = networkErr?.name === 'AbortError';
        lastError = Object.assign(
          new Error(isAbort ? 'AI service request timed out. Please retry.' : 'AI network request failed.'),
          {
            statusCode: isAbort ? 504 : 503,
            code: isAbort ? 'AI_TIMEOUT' : 'AI_NETWORK_ERROR',
            retryable: true,
          }
        );
        console.warn(`[GroqClient] model=${model} attempt=${attempt + 1} err=${lastError.code}`);
        if (attempt === 0) {
          await sleep(400);
          continue;
        }
      }
    }
  }

  throw lastError || Object.assign(new Error('AI service temporarily unavailable.'), {
    statusCode: 503,
    code: 'AI_UPSTREAM_UNAVAILABLE',
    retryable: true,
  });
}

module.exports = {
  callGroqCompletion,
  DEFAULT_PRIMARY_MODEL,
  buildModelList,
};
