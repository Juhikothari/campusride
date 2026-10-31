const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const User    = require('../users/users.model');

// POST /api/chatbot/message
// Body: { messages: [{role:'user'|'assistant', content: string}] }
router.post('/message', auth, async (req, res) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: 'messages array is required' });
    }

    // Fetch fresh user data for personalised system prompt
    const userId = req.user?.userId || req.user?.id;
    const user   = await User.findById(userId).select('name email role college gender kycStatus usn');

    // 0. Immediate Accident & Emergency Intercept
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content?.toLowerCase() || '';
    if (lastUserMsg.includes('accident') || lastUserMsg.includes('crash') || lastUserMsg.includes('collision') ||
        lastUserMsg.includes('ambulance') || lastUserMsg.includes('injury') || lastUserMsg.includes('hurt') ||
        lastUserMsg.includes('fell') || lastUserMsg.includes('emergency') || lastUserMsg.includes('hit')) {
      return res.json({
        reply: "🚨 EMERGENCY ACCIDENT RESPONSE PROTOCOL:\n\n" +
          "1. Move to Safety: If you are able to move, step away from active vehicle traffic to a sidewalk or safe zone immediately.\n\n" +
          "2. Tap SOS Button in HOGO: Open your active ride screen or dashboard and tap the red SOS Emergency button. This instantly alerts campus safety and broadcasts your live GPS coordinates to emergency contacts.\n\n" +
          "3. Call Emergency Helpline Numbers:\n" +
          "   • Dial 112 (National Emergency Helpline) immediately.\n" +
          "   • Dial 108 for Ambulance assistance if anyone is hurt.\n\n" +
          "4. Check on Fellow Commuters: Check on your buddy and passengers if safe to do so. Stay calm and remain at the scene until medical staff or police arrive.\n\n" +
          "5. Contact Campus Security: Alert your college security desk so campus first responders can reach you swiftly."
      });
    }

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return res.status(503).json({ message: 'AI assistant is not configured on this server.' });
    }

    // Groq uses OpenAI-compatible format — system prompt as first message
    const groqMessages = [
      { role: 'system', content: buildSystemPrompt(user) },
      ...messages.slice(-20).map(m => ({
        role:    m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
    ];

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model:      'llama-3.1-8b-instant',
        max_tokens: 1000,
        messages:   groqMessages,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('Groq API error:', err);
      return res.status(502).json({ message: err.error?.message || 'AI service error' });
    }

    const data  = await response.json();
    const rawReply = data.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";
    const reply = rawReply.replace(/\*\*/g, '').replace(/^\*\s/gm, '• ').replace(/\*/g, '');

    return res.json({ reply });

  } catch (error) {
    console.error('Chatbot route error:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ── System prompt builder ─────────────────────────────────────────
function buildSystemPrompt(user) {
  const ctx = user
    ? `The user is ${user.name}, a ${user.role} at ${user.college}. Email: ${user.email}. KYC status: ${user.kycStatus || 'unknown'}. Gender: ${user.gender || 'not set'}.${user.usn ? ` USN: ${user.usn}.` : ''}`
    : 'The user is logged in but profile could not be loaded.';

  return `You are RideBot, a friendly and helpful assistant built into HOGO (CampusRide) — a college-exclusive ride-sharing platform in India.

${ctx}

CRITICAL EMERGENCY RULES:
If the user mentions an accident, crash, collision, injury, hurt, fell, bleeding, hit, or emergency:
You MUST immediately provide the 5-step Emergency Response Protocol:
1. Move to Safety: If able, step away from active traffic immediately.
2. Tap SOS Button in HOGO: Open your active ride or dashboard and tap red SOS Emergency button.
3. Call Emergency Helplines: Dial 112 (National Emergency Helpline) or 108 (Ambulance).
4. Check on Fellow Commuters: Check on buddy and passengers safely, remain calm until responders arrive.
5. Alert Campus Security: Notify college security desk so campus first responders can reach you swiftly.
Never give a generic menu when someone asks about an accident or emergency.

Formatting Rules:
- DO NOT use markdown asterisks (never use **bold** or *italic*); use clean plain text with bullet points (•).
- Keep answers concise, helpful, and India-contextual.

CampusRide key features:
- College-scoped rides: only students from the same college can see each other's rides
- Roles: seeker (books rides), provider (offers rides), both, admin
- KYC verification required for providers before posting rides (Aadhaar, college ID, driving license, selfie, vehicle photo)
- Women-only ride filter for safety (providers can flag, only female-gendered seekers can book)
- Recurring rides (daily, weekdays, weekends, weekly, custom frequencies)
- Real-time per-ride chat via Socket.IO
- College community group chat (college-scoped room)
- SOS emergency feature during active rides
- Incident reporting for post-ride issues
- Star ratings after ride completion
- Transparent pricing — providers set cost per seat; payment is direct between rider and passenger, no app commission
- Geo-based ride search (within 50km radius using GPS)
- Pre-ride safety checklist for providers
- Live tracking during rides
- Notifications for booking status changes
- Vehicle Policy: Registered vehicle details (number and model) are locked for campus safety and verification reasons. Users cannot edit vehicle details directly in the app. If a user changes their vehicle, they must contact Campus Support from the app menu with their new vehicle RC and college ID to request an update.

Navigation pages: dashboard, search-rides, create-ride, my-bookings, provider-bookings, kyc, ratings, live-tracking, community, route-alerts, notifications, incident-report. Admins also have: admin, admin-settings.

Keep answers concise, friendly, and India-contextual. Use emojis sparingly. If the user asks to navigate somewhere, clearly name which section. Never fabricate account-specific data — if unsure, suggest they check the relevant page directly.`;
}

module.exports = router;
