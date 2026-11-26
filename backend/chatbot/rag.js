// backend/chatbot/rag.js
// Lightweight, dependency-free RAG retriever for HOGO Knowledge Base.
// Combines BM25-like TF-IDF scoring, synonym expansion, typo-tolerant trigrams,
// and multi-clause decomposition so compound questions retrieve all relevant sections.

const { KNOWLEDGE_SECTIONS } = require('./knowledgeBase');

const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
  'can', 'could', 'may', 'might', 'must', 'shall', 'i', 'me', 'my', 'we',
  'our', 'you', 'your', 'they', 'them', 'it', 'its', 'this', 'that', 'these',
  'those', 'am', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'from', 'by',
  'about', 'as', 'into', 'like', 'through', 'after', 'over', 'between', 'out',
  'against', 'during', 'without', 'before', 'under', 'around', 'how', 'what',
  'when', 'where', 'why', 'which', 'who', 'whom', 'and', 'or', 'but', 'if',
  'not', 'no', 'so', 'too', 'very', 'just', 'get', 'got', 'app', 'hogo', 'campusride',
  'please', 'tell', 'explain', 'know', 'want', 'need', 'work', 'works', 'use',
]);

// Domain synonyms & common informal phrasing mappings
const SYNONYMS = {
  // Rides & roles
  offer: ['post', 'create', 'share', 'publish', 'need'],
  post: ['offer', 'create', 'publish'],
  find: ['search', 'match', 'browse', 'look'],
  book: ['booking', 'reserve', 'seat', 'request'],
  rider: ['provider', 'driver'],
  driver: ['provider'],
  passenger: ['seeker', 'buddy'],
  seeker: ['passenger'],
  repeat: ['recurring', 'daily', 'weekday', 'weekly', 'everyday'],
  everyday: ['recurring', 'daily', 'schedule'],
  daily: ['recurring', 'schedule'],
  // Payments
  money: ['fare', 'cost', 'payment', 'upi', 'cash'],
  pay: ['payment', 'upi', 'cash', 'fare', 'cost'],
  price: ['fare', 'cost', 'split'],
  rupee: ['fare', 'cost'],
  petrol: ['cost', 'split', 'fare'],
  // Vehicles & Docs
  bike: ['vehicle', 'motorcycle'],
  scooter: ['vehicle', 'bike'],
  car: ['vehicle'],
  plate: ['vehicle', 'registration'],
  rc: ['vehicle', 'registration'],
  license: ['kyc', 'driving'],
  aadhar: ['aadhaar', 'kyc', 'identity'],
  aadhaar: ['kyc', 'identity'],
  document: ['kyc', 'college'],
  selfie: ['kyc', 'photo', 'profile', 'register'],
  // Location & Maps
  pin: ['map', 'pickup', 'drop', 'location'],
  gps: ['tracking', 'location', 'map'],
  track: ['tracking', 'live'],
  route: ['map', 'directions', 'stop', 'osrm'],
  // Safety & Support
  ladies: ['women', 'female'],
  girls: ['women', 'female'],
  female: ['women'],
  panic: ['sos', 'emergency'],
  helpline: ['sos', '112', 'emergency'],
  complaint: ['incident', 'report'],
  harassment: ['incident', 'report'],
  walking: ['walk', 'nadi'],
  nadi: ['walk'],
  lounge: ['community', 'chat'],
  close: ['delete', 'account'],
  remove: ['delete'],
  ban: ['blocked', 'suspended', 'privacy'],
  baned: ['blocked', 'suspended'],
  suspend: ['suspended', 'privacy', 'blocked'],
  unlock: ['revoke', 'suspended'],
  timeout: ['slow', 'error', 'troubleshooting'],
  crash: ['bug', 'error', 'troubleshooting'],
  dark: ['theme', 'settings'],
  light: ['theme', 'settings'],
};

function normalizeToken(tok) {
  let t = String(tok || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!t) return '';
  // Light suffix normalization
  if (t.length > 4 && t.endsWith('ing')) t = t.slice(0, -3);
  else if (t.length > 4 && t.endsWith('ied')) t = t.slice(0, -3) + 'y';
  else if (t.length > 4 && t.endsWith('ies')) t = t.slice(0, -3) + 'y';
  else if (t.length > 3 && t.endsWith('ed')) t = t.slice(0, -2);
  else if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) t = t.slice(0, -1);
  return t;
}

function tokenize(text) {
  const raw = String(text || '').toLowerCase().split(/[\s,.;:!?/()[\]{}"'<>+=*&^%$#@~`|\\-]+/);
  const tokens = [];
  for (const r of raw) {
    if (!r) continue;
    const norm = normalizeToken(r);
    if (norm && norm.length >= 2 && !STOPWORDS.has(r) && !STOPWORDS.has(norm)) {
      tokens.push(norm);
    }
  }
  return tokens;
}

function trigrams(word) {
  const w = `_${word}_`;
  const grams = new Set();
  for (let i = 0; i <= w.length - 3; i++) {
    grams.add(w.slice(i, i + 3));
  }
  return grams;
}

function diceSimilarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (Math.abs(a.length - b.length) > 3) return 0;
  const ga = trigrams(a);
  const gb = trigrams(b);
  let overlap = 0;
  for (const g of ga) {
    if (gb.has(g)) overlap++;
  }
  return (2 * overlap) / (ga.size + gb.size);
}

// Pre-index sections once at module load
const INDEXED_SECTIONS = KNOWLEDGE_SECTIONS.map((sec) => {
  const topicTokens = tokenize(sec.topic);
  const kwTokens = sec.keywords.flatMap((k) => tokenize(k));
  const bodyTokens = tokenize(sec.content);
  const allTerms = new Set([...topicTokens, ...kwTokens, ...bodyTokens]);

  const tf = new Map();
  const addWeight = (list, w) => {
    for (const tok of list) {
      tf.set(tok, (tf.get(tok) || 0) + w);
    }
  };
  addWeight(topicTokens, 3.0);
  addWeight(kwTokens, 2.4);
  addWeight(bodyTokens, 1.0);

  return {
    ...sec,
    tf,
    allTerms: [...allTerms],
    keywordsLower: sec.keywords.map((k) => k.toLowerCase()),
    topicLower: sec.topic.toLowerCase(),
  };
});

// Document frequency & IDF
const DOC_COUNT = INDEXED_SECTIONS.length;
const DF = new Map();
for (const doc of INDEXED_SECTIONS) {
  for (const term of doc.allTerms) {
    DF.set(term, (DF.get(term) || 0) + 1);
  }
}
function idf(term) {
  const df = DF.get(term) || 0.5;
  return Math.log(1 + (DOC_COUNT - df + 0.5) / (df + 0.5));
}

function expandQueryTokens(tokens) {
  const weighted = [];
  const seen = new Set();
  for (const tok of tokens) {
    if (!seen.has(tok)) {
      weighted.push({ token: tok, weight: 1.0 });
      seen.add(tok);
    }
    const syns = SYNONYMS[tok];
    if (Array.isArray(syns)) {
      for (const s of syns) {
        const sn = normalizeToken(s);
        if (sn && !seen.has(sn)) {
          weighted.push({ token: sn, weight: 0.72 });
          seen.add(sn);
        }
      }
    }
  }
  return weighted;
}

function scoreClause(clauseText) {
  const lowerClause = String(clauseText || '').toLowerCase();
  const rawTokens = tokenize(lowerClause);
  const expanded = expandQueryTokens(rawTokens);
  if (expanded.length === 0) return new Map();

  const scores = new Map();
  for (const doc of INDEXED_SECTIONS) {
    let score = 0;

    // Exact phrase boosts on keywords / topic
    for (const kw of doc.keywordsLower) {
      if (kw.includes(' ') && lowerClause.includes(kw)) {
        score += 4.5;
      }
    }
    if (lowerClause.includes(doc.topicLower)) {
      score += 5.0;
    }

    // Weighted BM25-like + typo-tolerant fuzzy matching
    for (const { token, weight } of expanded) {
      const exactTf = doc.tf.get(token);
      if (exactTf) {
        score += weight * idf(token) * Math.min(2.6, 1 + Math.log1p(exactTf));
      } else if (token.length >= 4 && weight >= 0.99) {
        // Check typo similarity against indexed terms for original query words
        let bestSim = 0;
        let bestTerm = null;
        for (const cand of doc.allTerms) {
          if (cand.length < 4) continue;
          const sim = diceSimilarity(token, cand);
          if (sim > bestSim) {
            bestSim = sim;
            bestTerm = cand;
          }
        }
        if (bestSim >= 0.68 && bestTerm) {
          score += bestSim * 0.85 * idf(bestTerm);
        }
      }
    }

    if (score > 0) {
      scores.set(doc.id, score);
    }
  }
  return scores;
}

/**
 * Retrieve top relevant HOGO knowledge sections using query + optional recent conversation context.
 * Splits multi-question queries (e.g. "How do I post a ride and what is KYC?") to cover each intent.
 */
function retrieveKnowledge(query, { topK = 4, history = [] } = {}) {
  const text = String(query || '').trim();
  if (!text) return [];

  // Split compound queries on '?' or ' and ' / ' also ' so every sub-question gets represented
  const clauses = text
    .split(/(?:\?+|\band\b|\balso\b|;)/i)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);

  const combinedScores = new Map();
  const addScores = (scoreMap, mult = 1.0) => {
    for (const [id, val] of scoreMap.entries()) {
      combinedScores.set(id, (combinedScores.get(id) || 0) + val * mult);
    }
  };

  // Full query + per-clause scoring
  addScores(scoreClause(text), 1.0);
  if (clauses.length > 1) {
    for (const c of clauses) {
      const cMap = scoreClause(c);
      // Boost top hit of each sub-question so second topic isn't drowned out
      const topEntry = [...cMap.entries()].sort((a, b) => b[1] - a[1])[0];
      if (topEntry) {
        combinedScores.set(topEntry[0], (combinedScores.get(topEntry[0]) || 0) + Math.max(2.5, topEntry[1] * 0.65));
      }
    }
  }

  // Carry lightweight context from last 1-2 user messages when query is short / follow-up (e.g., "Can I do that every day?")
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const isFollowUpLike = wordCount <= 8 || /\b(it|that|this|they|there|how much|same|what about|daily|every day)\b/i.test(text);
  if (isFollowUpLike && Array.isArray(history) && history.length > 0) {
    const prevUsers = history
      .filter((m) => m && m.role === 'user' && m.content && m.content.trim() !== text)
      .slice(-2)
      .map((m) => m.content)
      .join(' ');
    if (prevUsers) {
      addScores(scoreClause(prevUsers), 0.45);
    }
  }

  const MIN_CONFIDENCE = 1.25;
  const ranked = INDEXED_SECTIONS
    .map((sec) => ({
      id: sec.id,
      topic: sec.topic,
      content: sec.content,
      score: Number((combinedScores.get(sec.id) || 0).toFixed(2)),
    }))
    .filter((item) => item.score >= MIN_CONFIDENCE)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return ranked;
}

module.exports = {
  retrieveKnowledge,
  tokenize,
  KNOWLEDGE_SECTIONS,
};
