// backend/chatbot/groqClient.js
// Hardened Groq Chat Completions client:
// - Configurable model via GROQ_MODEL (with current active Groq production fallback models)
// - Dynamic GET /openai/v1/models discovery if configured/fallback models are deprecated/unavailable
// - Request timeouts via AbortController
// - Controlled exponential backoff retries for transient 429/5xx/network errors only
// - Differentiates 400 (bad request / decommissioned model), 401 (bad key), 403 (permission), 404 (model), 429 (rate limit), 5xx/network
// - Never logs API keys or personal user chat text

const DEFAULT_PRIMARY_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const DEFAULT_FALLBACK_MODELS = [
  'llama-3.1-8b-instant',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'meta-llama/llama-4-scout-17b-16e-instruct',
];

const EXCLUDED_MODEL_SUBSTRINGS = ['whisper', 'tts', 'guard', 'playai', 'distil-whisper', 'orpheus'];

function buildModelList() {
  const configured = (process.env.GROQ_MODEL || '').trim();
  const list = configured
    ? [configured, 'llama-3.3-70b-versatile', ...DEFAULT_FALLBACK_MODELS]
    : [DEFAULT_PRIMARY_MODEL, ...DEFAULT_FALLBACK_MODELS];
  return [...new Set(list.filter(Boolean))];
}

function classifyGroqError(status, codeText = '', detailText = '') {
  const lower = `${String(codeText || '')} ${String(detailText || '')}`.toLowerCase();

  // Check decommissioned / missing model BEFORE generic 400, because Groq returns HTTP 400 for model_decommissioned
  if (
    status === 404 ||
    lower.includes('model_not_found') ||
    lower.includes('model_decommissioned') ||
    lower.includes('decommissioned') ||
    (lower.includes('model') && (lower.includes('does not exist') || lower.includes('not found') || lower.includes('unavailable')))
  ) {
    return { statusCode: 503, code: 'AI_MODEL_DEPRECATED', retryable: true, message: 'Configured AI model is unavailable.' };
  }

  if (status === 401 || lower.includes('invalid_api_key')) {
    return { statusCode: 503, code: 'AI_AUTH_ERROR', retryable: false, message: 'AI service authentication error.' };
  }

  if (status === 403) {
    return { statusCode: 503, code: 'AI_PERMISSION_DENIED', retryable: false, message: 'AI model access denied by provider permissions.' };
  }

  if (status === 400) {
    return { statusCode: 502, code: 'AI_INVALID_REQUEST', retryable: false, message: 'AI request was rejected as invalid.' };
  }

  if (status === 429 || lower.includes('rate_limit')) {
    return { statusCode: 429, code: 'AI_RATE_LIMITED', retryable: true, message: 'HOGO AI is temporarily busy. Please wait a moment and retry.' };
  }

  if (status >= 500) {
    return { statusCode: 503, code: 'AI_UPSTREAM_UNAVAILABLE', retryable: true, message: 'AI provider is temporarily unavailable.' };
  }

  return { statusCode: 502, code: 'AI_REQUEST_FAILED', retryable: false, message: 'AI request could not be completed.' };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function discoverAvailableModels(apiKey, fetchImpl = global.fetch, timeoutMs = 8000) {
  if (!apiKey || typeof fetchImpl !== 'function') return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl('https://api.groq.com/openai/v1/models', {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res?.ok) return [];
    const json = await res.json().catch(() => null);
    const items = Array.isArray(json?.data) ? json.data : [];
    return items
      .filter((m) => m && typeof m.id === 'string' && m.active !== false)
      .map((m) => m.id)
      .filter((id) => {
        const lower = id.toLowerCase();
        return !EXCLUDED_MODEL_SUBSTRINGS.some((ex) => lower.includes(ex));
      })
      .sort((a, b) => {
        const score = (id) => {
          const l = id.toLowerCase();
          if (l.includes('llama-3.3')) return 0;
          if (l.includes('llama-3.1')) return 1;
          if (l.includes('llama')) return 2;
          if (l.includes('gpt-oss')) return 3;
          return 4;
        };
        return score(a) - score(b);
      });
  } catch {
    clearTimeout(timer);
    return [];
  }
}

async function tryChatCompletion({ model, apiKey, messages, maxTokens, temperature, timeoutMs, fetchImpl }) {
  let lastError = null;
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
          return { ok: true, result: { reply: content.trim(), model } };
        }

        lastError = Object.assign(new Error('Empty completion from AI provider'), {
          statusCode: 502,
          code: 'AI_EMPTY_RESPONSE',
          retryable: true,
        });
        continue;
      }

      let errCodeText = '';
      let errDetailText = '';
      try {
        const errJson = await response.json();
        errCodeText = errJson?.error?.code || errJson?.error?.type || '';
        errDetailText = errJson?.error?.message || '';
      } catch {}

      const classified = classifyGroqError(response.status, errCodeText, errDetailText);
      // Log diagnostic status and provider code only (never keys, tokens, or chat text)
      console.warn(
        `[GroqClient] model=${model} http=${response.status} providerCode=${errCodeText || 'none'} classified=${classified.code}`
      );
      lastError = Object.assign(new Error(classified.message), classified);

      if (classified.code === 'AI_AUTH_ERROR' || classified.code === 'AI_INVALID_REQUEST') {
        return { ok: false, fatal: true, error: lastError };
      }
      if (classified.code === 'AI_MODEL_DEPRECATED' || classified.code === 'AI_PERMISSION_DENIED') {
        return { ok: false, fatal: false, modelUnavailable: true, error: lastError };
      }
      if (classified.retryable && attempt === 0) {
        await sleep(450);
        continue;
      }
      return { ok: false, fatal: false, error: lastError };
    } catch (networkErr) {
      clearTimeout(timer);
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
  return { ok: false, fatal: false, error: lastError };
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

  const tried = new Set();
  const models = buildModelList();
  let lastError = null;
  let sawModelUnavailable = false;

  for (const model of models) {
    tried.add(model);
    const attemptResult = await tryChatCompletion({ model, apiKey, messages, maxTokens, temperature, timeoutMs, fetchImpl });
    if (attemptResult.ok) return attemptResult.result;
    lastError = attemptResult.error;
    if (attemptResult.fatal) throw lastError;
    if (attemptResult.modelUnavailable) sawModelUnavailable = true;
  }

  // Dynamic model discovery fallback if all statically configured/known models returned unavailable/denied
  if (sawModelUnavailable) {
    const discovered = await discoverAvailableModels(apiKey, fetchImpl);
    for (const model of discovered) {
      if (tried.has(model)) continue;
      tried.add(model);
      const attemptResult = await tryChatCompletion({ model, apiKey, messages, maxTokens, temperature, timeoutMs, fetchImpl });
      if (attemptResult.ok) return attemptResult.result;
      lastError = attemptResult.error;
      if (attemptResult.fatal) throw lastError;
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
  classifyGroqError,
  discoverAvailableModels,
};
