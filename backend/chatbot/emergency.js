// backend/chatbot/emergency.js
// Intent-aware emergency & critical safety detector with 112 quick-dial support.
// Prevents substring false positives (e.g. "white" matching "hit") while giving immediate 112 dial
// action for emergencies, harassment, stalking, threats, assaults, or unwanted conduct.

// Purely informational FAQ/policy queries (about how the app works)
const INFORMATIONAL_PATTERNS = [
  /^\s*(how\s+(does|do|to)|what\s+(is|are|happens)|where\s+is|tell\s+me\s+about|explain|describe|does\s+hogo)\b/i,
  /\b(sos\s+feature|sos\s+work|sos\s+button\s+work|safety\s+policy|incident\s+policy|emergency\s+policy|privacy\s+policy)\b/i,
  /\b(which\s+number|what\s+number|in\s+general|policy\s+for)\b/i,
];

// Active distress & harassment patterns (strict word-boundary protected)
const ACTIVE_DISTRESS_PATTERNS = [
  /\b(i|we|my\s+(?:driver|rider|cab|bike|car|friend|buddy)|our\s+(?:ride|car|bike))\s+(?:just\s+)?(?:had|met\s+with|got\s+into|been\s+in|in)\s+(?:a|an)?\s*(?:accident|crash|collision)\b/i,
  /\b(?:just\s+)?(?:crashed|collided|met\s+with\s+an\s+accident|car\s+crashed|bike\s+crashed)\b/i,
  /\b(?:got|was|been|we\s+got|i\s+am|i'm)\s+(?:badly\s+)?(?:hit|injured|hurt|bleeding|unconscious|trapped)\b/i,
  /\b(?:someone|driver|rider|passenger|stranger|guy|person)\s+(?:is\s+)?(?:hitting|attacking|chasing|threatening|harassing|stalking|following|molesting|assaulting|abusing)\s+(?:me|us)\b/i,
  /\b(?:being\s+)?(?:harassed|stalked|threatened|molested|followed|abused|locked\s+in)\b/i,
  /\b(?:unwanted\s+(?:touch|behavior|behaviour|advance|advances|contact)|inappropriate(?:ly)?\s+(?:touch|behavior|behaviour)|misbehav(?:ing|ed))\b/i,
  /\b(?:send|call|need)\s+(?:an?\s+)?(?:ambulance|police|emergency\s+help)\s*(?:now|immediately|fast|quick|asap)?\b/i,
  /\b(?:bleeding\s+(?:a\s+lot|heavily|badly)|need\s+medical\s+help\s+now|medical\s+emergency\s+right\s+now)\b/i,
  /\b(?:i\s+am|i'm|we\s+are|we're)\s+in\s+(?:danger|trouble|an\s+emergency)\b/i,
  /\bhelp\s+me\b(?:\s+please|\s+now|\s+im|\s+i'm|\s+quick|\s*!|$)/i,
  /\b(?:sos\s+now|trigger\s+sos\s+now|unsafe\s+right\s+now|feeling\s+unsafe\s+in\s+(?:my|this)\s+ride)\b/i,
];

// Any critical, harassment, assault, threat, or unwanted safety situation where offering Dial 112 helps
const OFFER_112_PATTERNS = [
  /\b(harass(?:ment|ing|ed)?|stalk(?:ing|ed)?|molest(?:ation|ing|ed)?|assault(?:ed|ing)?|threat(?:en(?:ing|ed)?|s)?|kidnap(?:ped|ping)?|robbery|theft|abuse|abusive|unwanted|misbehav(?:e|ed|ing)|inappropriate|unsafe|danger|emergency|accident|crash|collision|bleeding|injured)\b/i,
];

function detectEmergencyIntent(message) {
  const text = String(message || '').trim();
  if (!text) return { isEmergency: false, reason: null };

  const hasExplicitUrgency = /\b(bleeding|unconscious|chasing\s+me|attacking\s+me|threatening\s+me|harassing\s+me|following\s+me|being\s+harassed|stalked|molested|met\s+with\s+an\s+accident|just\s+crashed|send\s+(?:an\s+)?ambulance|in\s+danger|help\s+me\s*!)\b/i.test(text);

  if (!hasExplicitUrgency) {
    for (const infoRe of INFORMATIONAL_PATTERNS) {
      if (infoRe.test(text)) {
        return { isEmergency: false, reason: 'informational_query' };
      }
    }
  }

  for (const pat of ACTIVE_DISTRESS_PATTERNS) {
    if (pat.test(text)) {
      return { isEmergency: true, reason: 'active_emergency_intent' };
    }
  }

  return { isEmergency: false, reason: null };
}

function shouldOfferDial112(message) {
  const text = String(message || '').trim();
  if (!text) return false;
  if (detectEmergencyIntent(text).isEmergency) return true;
  return OFFER_112_PATTERNS.some((re) => re.test(text));
}

function buildImmediateEmergencyReply() {
  return (
    '• Call 112 immediately (Police / Ambulance / Emergency) using the Dial 112 button below.\n' +
    '• Move to a crowded, well-lit spot or campus gate if safe to do so.\n' +
    '• On an active ride, tap the red SOS button in Live Tracking to send GPS alerts to your emergency contact and admins (chat alone does NOT notify police).'
  );
}

module.exports = {
  detectEmergencyIntent,
  shouldOfferDial112,
  buildImmediateEmergencyReply,
};
