import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getChatMessages, deleteChatMessage } from '../services/api.js';
import { API_BASE } from '../services/api.js';
import { io } from 'socket.io-client';
import './CommunityPage.css';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function CommunityPage({ navigate }) {
  const { user }       = useAuth();
  const [messages,     setMessages]     = useState([]);
  const [text,         setText]         = useState('');
  const [loading,      setLoading]      = useState(true);
  const [sending,      setSending]      = useState(false);
  const [error,        setError]        = useState('');
  const [socketReady,  setSocketReady]  = useState(false);
  const [deletingId,   setDeletingId]   = useState(null);

  const socketRef  = useRef(null);
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);

  // ── Load history ───────────────────────────────────────────────
  useEffect(() => {
    getChatMessages()
      .then(msgs => setMessages(Array.isArray(msgs) ? msgs : []))
      .catch(() => setError('Could not load messages'))
      .finally(() => setLoading(false));
  }, []);

  // ── Socket.IO ─────────────────────────────────────────────────
  useEffect(() => {
    if (!user?._id && !user?.id) return;
    const userId = user._id || user.id;

    const socket = io(API_BASE, {
      transports: ['websocket', 'polling'],
      auth: { token: localStorage.getItem('cr_token') },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-college-chat', { userId });
    });

    socket.on('college-chat-joined', () => setSocketReady(true));

    socket.on('receive-community-message', (msg) => {
      setMessages(prev => {
        if (prev.find(m => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
    });

    socket.on('community-message-deleted', ({ messageId }) => {
      setMessages(prev => prev.filter(m => m._id !== messageId));
    });

    return () => socket.disconnect();
  }, [user]);

  // ── Auto scroll to bottom ─────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Send message ──────────────────────────────────────────────
  const send = useCallback(() => {
    const msg = text.trim();
    if (!msg || sending || !socketReady) return;
    const userId = user?._id || user?.id;
    setSending(true);
    socketRef.current?.emit('send-community-message', { userId, message: msg });
    setText('');
    setSending(false);
    inputRef.current?.focus();
  }, [text, sending, socketReady, user]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // ── Delete message ────────────────────────────────────────────
  const deleteMsg = async (msg) => {
    const userId = user?._id || user?.id;
    if (msg.senderId !== userId && msg.sender?._id !== userId && msg.sender !== userId) return;
    setDeletingId(msg._id);
    try {
      socketRef.current?.emit('delete-community-message', { userId, messageId: msg._id });
      await deleteChatMessage(msg._id).catch(() => {});
      setMessages(prev => prev.filter(m => m._id !== msg._id));
    } finally {
      setDeletingId(null);
    }
  };

  const userId = user?._id || user?.id;
  const isMyMsg = (msg) => msg.senderId === userId || msg.sender?._id === userId || msg.sender === userId;

  return (
    <div className="comm-chat-shell">
      {/* Header */}
      <div className="comm-chat-header">
        <div className="comm-chat-header-left">
          <div className="comm-chat-avatar">💬</div>
          <div>
            <div className="comm-chat-title">College Chat</div>
            <div className="comm-chat-sub">
              {user?.college || 'Your College'} · {socketReady ? '🟢 Live' : '⏳ Connecting…'}
            </div>
          </div>
        </div>
        <div className="comm-chat-count">{messages.length} messages</div>
      </div>

      {/* Messages */}
      <div className="comm-chat-body">
        {loading && (
          <div className="comm-chat-loading">Loading messages…</div>
        )}
        {!loading && messages.length === 0 && (
          <div className="comm-chat-empty">
            <div style={{fontSize:48,marginBottom:12}}>💬</div>
            <div>No messages yet. Be the first to say something!</div>
          </div>
        )}
        {messages.map((msg) => {
          const mine = isMyMsg(msg);
          const name = msg.senderName || msg.sender?.name || 'Unknown';
          const usn  = msg.senderUsn || msg.sender?.usn || '';
          return (
            <div key={msg._id} className={`comm-msg-row ${mine ? 'mine' : 'theirs'}`}>
              {!mine && (
                <div className="comm-msg-avatar">{name.charAt(0).toUpperCase()}</div>
              )}
              <div className={`comm-msg-bubble ${mine ? 'bubble-mine' : 'bubble-theirs'}`}>
                {!mine && (
                  <div className="comm-msg-meta">
                    <span className="comm-msg-name">{name}</span>
                    {usn && <span className="comm-msg-usn">{usn}</span>}
                  </div>
                )}
                <div className="comm-msg-text">{msg.message}</div>
                <div className="comm-msg-time-row">
                  <span className="comm-msg-time">{timeAgo(msg.createdAt)}</span>
                  {mine && (
                    <button
                      className="comm-msg-delete"
                      onClick={() => deleteMsg(msg)}
                      disabled={deletingId === msg._id}
                      title="Delete message">
                      {deletingId === msg._id ? '…' : '🗑'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="comm-chat-input-row">
        <textarea
          ref={inputRef}
          className="comm-chat-input"
          placeholder="Type a message… (Enter to send)"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
          maxLength={500}
          disabled={!socketReady}
        />
        <button
          className="comm-chat-send"
          onClick={send}
          disabled={!text.trim() || sending || !socketReady}>
          ➤
        </button>
      </div>

      {error && <div className="comm-chat-error">{error}</div>}
    </div>
  );
}
