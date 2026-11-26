// backend/chatbot/emergency.js
// Intent-aware emergency detector using strict word boundaries & contextual disambiguation.
// Prevents substring false positives (e.g. "white" matching "hit") and distinguishes genuine
// active distress from informational FAQ questions ("How does SOS work?", "What happens in an accident?").

// Clear FAQ / informational question patterns about emergency features or policies
const INFORMATIONAL_PATTERNS = [
  /^\s*(how\s+(does|do|to)|what\s+(is|are|happens)|where\s+is|tell\s+me\s+about|explain|describe|does\s+hogo)\b/i,
  /\b(sos\s+feature|sos\s+work|sos\s+button\s+work|safety\s+policy|incident\s+policy|emergency\s+policy|privacy\s+policy)\b/i,
  /\b(which\s+number|what\s+number|in\s+general|policy\s+for)\b/i,
];

// Active distress phrases (strict word-boundary protected)
const ACTIVE_DISTRESS_PATTERNS = [
  // First-person / active crash or collision
  /\b(i|we|my\s+(?:driver|rider|cab|bike|car|friend|buddy)|our\s+(?:ride|car|bike))\s+(?:just\s+)?(?:had|met\s+with|got\s+into|been\s+in|in)\s+(?:a|an)?\s*(?:accident|crash|collision)\b/i,
  /\b(?:just\s+)?(?:crashed|collided|met\s+with\s+an\s+accident|car\s+crashed|bike\s+crashed)\b/i,
  // Being struck/hit or injured (strict \bhit\b so "white" never matches!)
  /\b(?:got|was|been|we\s+got|i\s+am|i'm)\s+(?:badly\s+)?(?:hit|injured|hurt|bleeding|unconscious|trapped)\b/i,
  /\b(?:someone|driver|passenger|stranger|guy)\s+(?:is\s+)?(?:hitting|attacking|chasing|threatening|harassing|following|assaulting)\s+(?:me|us)\b/i,
  // Urgent medical / immediate distress requests
  /\b(?:send|call|need)\s+(?:an?\s+)?(?:ambulance|police|emergency\s+help)\s*(?:now|immediately|fast|quick|asap)?\b/i,
  /\b(?:bleeding\s+(?:a\s+lot|heavily|badly)|need\s+medical\s+help\s+now|medical\s+emergency\s+right\s+now)\b/i,
  /\b(?:i\s+am|i'm|we\s+are|we're)\s+in\s+(?:danger|trouble|an\s+emergency)\b/i,
  /\bhelp\s+me\b(?:\s+please|\s+now|\s+im|\s+i'm|\s+quick|\s*!|$)/i,
  /\b(?:sos\s+now|trigger\s+sos\s+now|unsafe\s+right\s+now|feeling\s+unsafe\s+in\s+(?:my|this)\s+ride)\b/i,
];

function detectEmergencyIntent(message) {
  const text = String(message || '').trim();
  if (!text) return { isEmergency: false, reason: null };

  // Never treat ordinary short feature questions or safety policy queries as active emergencies
  // UNLESS there is explicit immediate first-person danger/bleeding/attack/crash distress.
  const hasExplicitUrgency = /\b(bleeding|unconscious|chasing\s+me|attacking\s+me|threatening\s+me|met\s+with\s+an\s+accident|just\s+crashed|send\s+(?:an\s+)?ambulance|in\s+danger|help\s+me\s*!)\b/i.test(text);

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

function buildImmediateEmergencyReply() {
  return (
    'IMMEDIATE EMERGENCY SAFETY GUIDANCE:\n\n' +
    '1. Move to a Safe Location: If you are able and in traffic, move away from moving vehicles to a populated, well-lit sidewalk or campus checkpoint.\n\n' +
    '2. Call 112 Immediately: Dial 112 (India National Emergency Helpline for Police/Ambulance/Fire) or 108 (Ambulance) right away if anyone is injured or in danger.\n\n' +
    '3. Use HOGO SOS Button on Active Ride: If you are in an active ride, open Live Tracking and tap the red SOS button. Tapping SOS triggers HOGO safety alerts, prompts GPS SMS/calling to your emergency contact, and alerts online campus admins (Note: typing in chat alone does NOT notify police or contacts).\n\n' +
    '4. Alert Nearby People & Campus Security: Contact people nearby or your college security desk so responders can reach you quickly.'
  );
}

module.exports = {
  detectEmergencyIntent,
  buildImmediateEmergencyReply,
};
