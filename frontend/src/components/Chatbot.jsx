import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { API_BASE, getToken, getMyBookings, searchRides } from '../services/api.js';
import './Chatbot.css';

// ── Rule-based fast-path responses ───────────────────────────────
// These fire instantly before hitting Claude API, saving latency for common questions
const RULES = [
  {
    match: /how (do i|to) (book|request) a ride/i,
    reply: `To book a ride:\n1. Go to **Find a Ride** 🔍\n2. Enter your pickup location (or use GPS)\n3. Browse available rides and tap one\n4. Hit **Request Booking** — the provider gets notified\n5. Once they accept, you'll see it in **My Bookings** 📋`,
  },
  {
    match: /how (do i|to) (post|offer|create|add) a ride/i,
    reply: `To offer a ride:\n1. Make sure your role is **Provider** or **Both**\n2. Your **KYC must be approved** first 🪪\n3. Go to **Offer a Ride** 🚗\n4. Set pickup, drop, date, time, seats, and cost\n5. Seekers from your college can then book your ride!`,
  },
  {
    match: /kyc|verif/i,
    reply: `KYC (Know Your Customer) lets you prove your identity so others trust you.\n\n📋 **What you need:**\n• Aadhaar card\n• College ID card\n• Driving license (providers)\n• Selfie + vehicle photo (providers)\n\nGo to **KYC Verification** from the dashboard. Admins usually review within 24 hours.`,
  },
  {
    match: /cancel(l?ed?|ling)? (a |my )?(booking|ride)/i,
    reply: `To cancel a booking:\n• Go to **My Bookings** 📋\n• Find the booking and tap **Cancel**\n\nProviders can cancel rides from **Manage Requests** 📬. Note: cancelling affects your reliability score.`,
  },
  {
    match: /\bsos\b|emergency|help me|in danger/i,
    reply: `🚨 **If you're in immediate danger, call 112 (India emergency) right away.**\n\nInside the app, use the **SOS** feature during an active ride — it alerts your emergency contact and flags the ride for admins.\n\nYou can add your emergency contact in your profile settings.`,
  },
  {
    match: /rating|review|stars/i,
    reply: `After a ride completes, both seekers and providers can rate each other.\n\n⭐ Go to **Ratings** from the dashboard to:\n• See your own ratings\n• View ratings you've given\n• Check a provider's reviews before booking`,
  },
  {
    match: /community|chat|college group/i,
    reply: `The **Community** 💬 is a college-scoped group chat — only students from your college can see and send messages.\n\nUse it to:\n• Share local tips & landmarks\n• Post route alerts\n• Coordinate informal pickups`,
  },
  {
    match: /wom[ae]n.only|female.only|safety/i,
    reply: `CampusRide has a **Women-Only** ride filter 🛡️\n\nProviders can mark their ride as women-only when creating it. Seekers can filter for these rides on the Search page.\n\nOnly users who have set their gender to Female can book women-only rides.`,
  },
  {
    match: /recurring|daily|regular|repeat/i,
    reply: `Providers can create **Recurring Rides** 🔁 when offering a ride.\n\nSet frequency to:\n• Daily, Weekdays, Weekends, Weekly, or Custom\n• Choose an end date or number of occurrences\n\nEach occurrence becomes its own bookable ride.`,
  },
  {
    match: /cost|price|fare|payment|money|pay/i,
    reply: `CampusRide uses **transparent pricing** 💰\n\nProviders set the cost-per-seat when creating a ride. Payment is arranged directly between rider and passenger — the app shows the agreed fare so there's no confusion.\n\nNo hidden fees or commissions from the app.`,
  },
  {
    match: /incident|report|complain/i,
    reply: `To report an incident:\n1. Go to **Incidents** ⚠️ from the navbar\n2. Describe what happened\n3. It's sent to admins for review\n\nFor serious safety issues during a ride, use **SOS** first, then file an incident report.`,
  },
  {
    match: /notif(ication)?s?/i,
    reply: `Notifications 🔔 keep you updated on:\n• Booking requests (providers)\n• Booking accepted/rejected (seekers)\n• Ride status changes\n• Admin alerts\n\nCheck the **Notifications** page from the navbar.`,
  },
  {
    match: /role|provider|seeker|both/i,
    reply: `CampusRide has three user roles:\n\n🚗 **Provider** — you own a vehicle and offer rides to others\n🔍 **Seeker** — you're looking for rides to join\n↔️ **Both** — you can do both!\n\nYou set your role during registration. Contact an admin if you need to change it.`,
  },
  {
    match: /college|domain|email/i,
    reply: `CampusRide is **college-scoped** 🏫 — rides and community chats are visible only to students from the same college.\n\nYou register with your college email (e.g. @rvce.edu.in). The app verifies the domain so only real students can join.`,
  },
  {
    match: /\b(hi|hello|hey|sup|hii+)\b/i,
    reply: null, // Let Claude handle greetings naturally
  },
];

function applyRules(text) {
  for (const rule of RULES) {
    if (rule.match.test(text) && rule.reply !== null) {
      return rule.reply;
    }
  }
  return null;
}

// ── Quick reply suggestions shown initially ───────────────────────
const QUICK_REPLIES = [
  'How do I book a ride?',
  'How do I offer a ride?',
  'What is KYC?',
  'How does payment work?',
  'Women-only rides?',
  'Report an incident',
];

// ── Format time ───────────────────────────────────────────────────
function fmtTime(d) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Strip markdown bold for clean display ────────────────────────
function renderBubble(text) {
  // Convert **bold** to <strong> and bullet points
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const parts = line.split(/\*\*(.*?)\*\*/g);
    return (
      <React.Fragment key={i}>
        {parts.map((p, j) =>
          j % 2 === 1 ? <strong key={j}>{p}</strong> : p
        )}
        {i < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
}

// ── Main Component ────────────────────────────────────────────────
export default function Chatbot({ navigate }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'bot',
      text: `Hey ${user?.name?.split(' ')[0] || 'there'} 👋 I'm RideBot, your CampusRide assistant!\n\nAsk me anything — how to book a ride, KYC, safety features, or just chat.`,
      time: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const [showQuick, setShowQuick] = useState(true);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const msgIdRef = useRef(2);

  const nextId = () => msgIdRef.current++;

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open]);

  const addMsg = (role, text) => {
    const msg = { id: nextId(), role, text, time: new Date() };
    setMessages(prev => [...prev, msg]);
    if (role === 'bot' && !open) setUnread(u => u + 1);
    return msg;
  };

  // ── Build system prompt with live user context ────────────────
  const buildSystemPrompt = useCallback(() => {
    const ctx = user
      ? `The user is ${user.name}, a ${user.role} at ${user.college}. Their email is ${user.email}. KYC status: ${user.kycStatus || 'unknown'}. Gender: ${user.gender || 'not set'}.`
      : 'The user is not logged in.';

    return `You are RideBot, a friendly and helpful assistant built into CampusRide — a college-exclusive ride-sharing platform in India.

${ctx}

CampusRide key features:
- College-scoped rides: only students from the same college can see each other's rides
- Roles: seeker (books rides), provider (offers rides), both, admin
- KYC verification required for providers before posting rides
- Women-only ride filter for safety
- Recurring rides (daily, weekdays, weekly, custom)
- Real-time chat per ride via Socket.IO
- College community group chat
- SOS emergency feature during rides
- Incident reporting
- Ratings after ride completion
- Transparent pricing — providers set cost per seat; payment is direct (no app commission)
- Location-based ride search (geo within 50km)

Navigation pages available: dashboard, search-rides, create-ride, my-bookings, provider-bookings, kyc, ratings, live-tracking, community, route-alerts, notifications, incident-report, admin (admin only), admin-settings (admin only).

Keep answers concise, friendly, and India-contextual. Use relevant emojis sparingly. If the user asks to navigate somewhere, tell them clearly which section to go to. Never make up data — if you don't know something specific about their account, say so and suggest they check the relevant page.`;
  }, [user]);

  // ── Send to Claude API ────────────────────────────────────────
  const callClaude = useCallback(async (history) => {
    const token = getToken();
    const messages = history
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role === 'bot' ? 'assistant' : 'user', content: m.text }));

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: buildSystemPrompt(),
        messages,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error ${res.status}`);
    }

    const data = await res.json();
    return data.content?.[0]?.text || "Sorry, I couldn't get a response.";
  }, [buildSystemPrompt]);

  // ── Send message ──────────────────────────────────────────────
  const send = useCallback(async (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed || loading) return;

    setInput('');
    setShowQuick(false);
    addMsg('user', trimmed);
    setLoading(true);

    try {
      // 1. Check rule-based fast paths first
      const ruleReply = applyRules(trimmed);
      if (ruleReply) {
        await new Promise(r => setTimeout(r, 400)); // brief delay feels natural
        addMsg('bot', ruleReply);
        setLoading(false);
        return;
      }

      // 2. Fall through to Claude API
      const history = [
        ...messages,
        { role: 'user', text: trimmed },
      ];
      const reply = await callClaude(history);
      addMsg('bot', reply);
    } catch (err) {
      addMsg('bot', `Sorry, I'm having trouble connecting right now. You can:\n• Check the relevant page directly\n• Try again in a moment\n\nError: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, callClaude]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const clearChat = () => {
    setMessages([{
      id: nextId(),
      role: 'bot',
      text: `Chat cleared! How can I help you, ${user?.name?.split(' ')[0] || 'there'}? 😊`,
      time: new Date(),
    }]);
    setShowQuick(true);
  };

  return (
    <div className="chatbot-bubble">
      {/* Chat Window */}
      {open && (
        <div className="chatbot-window">
          {/* Header */}
          <div className="chatbot-header">
            <div className="chatbot-avatar">🤖</div>
            <div className="chatbot-header-info">
              <div className="chatbot-header-name">RideBot</div>
              <div className="chatbot-header-status">Online</div>
            </div>
            <button className="chatbot-clear-btn" onClick={clearChat} title="Clear chat">
              Clear
            </button>
          </div>

          {/* Messages */}
          <div className="chatbot-messages">
            {messages.map(msg => (
              <div key={msg.id} className={`chat-msg ${msg.role}`}>
                <div className="chat-bubble">{renderBubble(msg.text)}</div>
                <div className="chat-time">{fmtTime(msg.time)}</div>
              </div>
            ))}

            {loading && (
              <div className="chat-typing">
                <span /><span /><span />
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Quick replies */}
          {showQuick && (
            <div className="chat-quick-replies">
              {QUICK_REPLIES.map(q => (
                <button key={q} className="chat-quick-btn" onClick={() => send(q)}>
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="chatbot-input-area">
            <textarea
              ref={inputRef}
              className="chatbot-input"
              placeholder="Ask me anything…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={loading}
            />
            <button
              className="chatbot-send-btn"
              onClick={() => send()}
              disabled={!input.trim() || loading}
              aria-label="Send"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M14 8L2 2l3 6-3 6 12-6z" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <div style={{ position: 'relative' }}>
        <button
          className={`chatbot-btn ${open ? 'open' : ''}`}
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Close chat' : 'Open RideBot'}
        >
          {open ? '✕' : '💬'}
        </button>
        {!open && unread > 0 && (
          <div className="chatbot-badge">{unread}</div>
        )}
      </div>
    </div>
  );
}
