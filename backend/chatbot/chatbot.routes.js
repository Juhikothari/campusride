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
    const reply = data.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";

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

  return `You are RideBot, a friendly and helpful assistant built into CampusRide — a college-exclusive ride-sharing platform in India.

${ctx}

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

Navigation pages: dashboard, search-rides, create-ride, my-bookings, provider-bookings, kyc, ratings, live-tracking, community, route-alerts, notifications, incident-report. Admins also have: admin, admin-settings.

Keep answers concise, friendly, and India-contextual. Use emojis sparingly. If the user asks to navigate somewhere, clearly name which section. Never fabricate account-specific data — if unsure, suggest they check the relevant page directly.`;
}

module.exports = router;
