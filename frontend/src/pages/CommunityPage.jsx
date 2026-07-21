import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  getCommunityPosts, createCommunityPost,
  toggleCommunityLike, addCommunityReply,
  getChatMessages, deleteChatMessage,
} from '../services/api.js';
import { API_BASE } from '../services/api.js';
import { io } from 'socket.io-client';
import './CommunityPage.css';

const CLOUD_NAME   = 'dhkui5t39';
const UPLOAD_PRESET = 'kyc_upload';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

async function uploadToCloudinary(file) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', UPLOAD_PRESET);
  const isImage = file.type.startsWith('image/');
  const endpoint = isImage
    ? `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`
    : `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/upload`;
  const res  = await fetch(endpoint, { method:'POST', body:fd });
  const data = await res.json();
  if (!data.secure_url) throw new Error('Upload failed');
  return { url: data.secure_url, type: isImage ? 'image' : 'pdf', name: file.name };
}

// ── POSTS TAB ─────────────────────────────────────────────────────
function PostsTab({ user }) {
  const [posts,       setPosts]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [newContent,  setNewContent]  = useState('');
  const [newType,     setNewType]     = useState('tip');
  const [anonymous,   setAnonymous]   = useState(false);
  const [files,       setFiles]       = useState([]);
  const [uploading,   setUploading]   = useState(false);
  const [posting,     setPosting]     = useState(false);
  const [replyText,   setReplyText]   = useState({});
  const [showReply,   setShowReply]   = useState({});
  const fileInputRef  = useRef(null);

  useEffect(() => {
    getCommunityPosts()
      .then(data => setPosts(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files).slice(0, 4); // max 4
    setFiles(prev => [...prev, ...selected].slice(0, 4));
  };

  const removeFile = (i) => setFiles(prev => prev.filter((_, idx) => idx !== i));

  const handlePost = async () => {
    if (!newContent.trim()) return;
    setPosting(true);
    try {
      let attachments = [];
      if (files.length > 0) {
        setUploading(true);
        attachments = await Promise.all(files.map(uploadToCloudinary));
        setUploading(false);
      }
      const post = await createCommunityPost({
        content: newContent, type: newType, anonymous, attachments,
      });
      setPosts(prev => [post, ...prev]);
      setNewContent(''); setFiles([]); setAnonymous(false);
    } catch (e) {
      alert(e.message || 'Failed to post');
    } finally {
      setPosting(false); setUploading(false);
    }
  };

  const handleLike = async (postId) => {
    try {
      await toggleCommunityLike(postId);
      setPosts(prev => prev.map(p =>
        p._id === postId ? { ...p, likes: (p.likes || 0) + 1 } : p
      ));
    } catch {}
  };

  const handleReply = async (postId) => {
    const text = replyText[postId]?.trim();
    if (!text) return;
    try {
      await addCommunityReply(postId, text);
      setReplyText(prev => ({ ...prev, [postId]: '' }));
      setShowReply(prev => ({ ...prev, [postId]: false }));
      const updated = await getCommunityPosts();
      setPosts(Array.isArray(updated) ? updated : []);
    } catch {}
  };

  const TYPE_ICONS = { tip:'💡', landmark:'📍', alert:'⚠️' };

  return (
    <div className="comm-posts-tab">
      {/* New Post Box */}
      <div className="comm-new-post">
        <div className="comm-post-types">
          {['tip','landmark','alert'].map(t => (
            <button key={t} type="button"
              className={`comm-type-btn ${newType===t?'active':''}`}
              onClick={() => setNewType(t)}>
              {TYPE_ICONS[t]} {t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          ))}
        </div>

        <textarea
          className="comm-post-input"
          placeholder={`Share a ${newType} with your college…`}
          value={newContent}
          onChange={e => setNewContent(e.target.value)}
          rows={3}
          maxLength={500}
        />

        {/* Attachment previews */}
        {files.length > 0 && (
          <div className="comm-attachments-preview">
            {files.map((f, i) => (
              <div key={i} className="comm-attachment-chip">
                {f.type?.startsWith('image/') ? '🖼️' : '📄'} {f.name.slice(0,20)}
                <button type="button" onClick={() => removeFile(i)}>✕</button>
              </div>
            ))}
          </div>
        )}

        <div className="comm-post-actions">
          {/* File upload */}
          <button type="button" className="comm-attach-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Attach image or PDF">
            📎 Attach
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            multiple
            hidden
            onChange={handleFileChange}
          />

          {/* Anonymous toggle */}
          <button type="button"
            className={`comm-anon-btn ${anonymous ? 'active' : ''}`}
            onClick={() => setAnonymous(a => !a)}>
            {anonymous ? '🎭 Anonymous' : '👤 Public'}
          </button>

          <span style={{flex:1}} />
          <span style={{fontSize:11,color:'#555'}}>{newContent.length}/500</span>

          <button
            type="button"
            className="comm-post-btn"
            onClick={handlePost}
            disabled={posting || uploading || !newContent.trim()}>
            {uploading ? 'Uploading…' : posting ? 'Posting…' : 'Post'}
          </button>
        </div>
      </div>

      {/* Posts list */}
      {loading && <div className="comm-loading">Loading posts…</div>}
      {!loading && posts.length === 0 && (
        <div className="comm-empty">No posts yet. Share something with your college!</div>
      )}
      {posts.map(post => (
        <div key={post._id} className="comm-post-card">
          <div className="comm-post-header">
            <span className="comm-post-type-badge">{TYPE_ICONS[post.type] || '💡'} {post.type}</span>
            <span className="comm-post-author">
              {post.anonymous ? '🎭 Anonymous' : (post.author?.name || 'Unknown')}
            </span>
            <span className="comm-post-time">{timeAgo(post.createdAt)}</span>
          </div>

          <p className="comm-post-content">{post.content}</p>

          {/* Attachments */}
          {post.attachments?.length > 0 && (
            <div className="comm-post-attachments">
              {post.attachments.map((a, i) => (
                a.type === 'image' ? (
                  <a key={i} href={a.url} target="_blank" rel="noreferrer">
                    <img src={a.url} alt={a.name} className="comm-post-img" />
                  </a>
                ) : (
                  <a key={i} href={a.url} target="_blank" rel="noreferrer" className="comm-pdf-link">
                    📄 {a.name || 'View PDF'}
                  </a>
                )
              ))}
            </div>
          )}

          <div className="comm-post-footer">
            <button className="comm-like-btn" onClick={() => handleLike(post._id)}>
              ❤️ {post.likes || 0}
            </button>
            <button className="comm-reply-toggle"
              onClick={() => setShowReply(prev => ({ ...prev, [post._id]: !prev[post._id] }))}>
              💬 {post.replies?.length || 0} {showReply[post._id] ? '▲' : '▼'}
            </button>
          </div>

          {showReply[post._id] && (
            <div className="comm-replies">
              {post.replies?.map((r, i) => (
                <div key={i} className="comm-reply">
                  <span className="comm-reply-author">
                    {r.anonymous ? '🎭 Anonymous' : r.authorName}
                  </span>
                  <span className="comm-reply-text">{r.content}</span>
                  <span className="comm-reply-time">{timeAgo(r.createdAt)}</span>
                </div>
              ))}
              <div className="comm-reply-input-row">
                <input
                  className="comm-reply-input"
                  placeholder="Write a reply…"
                  value={replyText[post._id] || ''}
                  onChange={e => setReplyText(prev => ({ ...prev, [post._id]: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleReply(post._id)}
                  maxLength={300}
                />
                <button className="comm-reply-btn" onClick={() => handleReply(post._id)}>Send</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── CHAT TAB ──────────────────────────────────────────────────────
function ChatTab({ user }) {
  const [messages,    setMessages]    = useState([]);
  const [text,        setText]        = useState('');
  const [loading,     setLoading]     = useState(true);
  const [socketReady, setSocketReady] = useState(false);
  const [deletingId,  setDeletingId]  = useState(null);
  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    getChatMessages()
      .then(msgs => setMessages(Array.isArray(msgs) ? msgs : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const userId = user?._id || user?.id;
    if (!userId) return;
    const socket = io(API_BASE, { transports:['websocket','polling'] });
    socketRef.current = socket;
    socket.on('connect', () => socket.emit('join-college-chat', { userId }));
    socket.on('college-chat-joined', () => setSocketReady(true));
    socket.on('receive-community-message', msg => {
      setMessages(prev => prev.find(m => m._id === msg._id) ? prev : [...prev, msg]);
    });
    socket.on('community-message-deleted', ({ messageId }) => {
      setMessages(prev => prev.filter(m => m._id !== messageId));
    });
    return () => socket.disconnect();
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:'smooth' });
  }, [messages]);

  const send = useCallback(() => {
    const msg = text.trim();
    if (!msg || !socketReady) return;
    const userId = user?._id || user?.id;
    socketRef.current?.emit('send-community-message', { userId, message: msg });
    setText('');
    inputRef.current?.focus();
  }, [text, socketReady, user]);

  const deleteMsg = async (msg) => {
    const userId = user?._id || user?.id;
    const senderId = msg.senderId || msg.sender?._id || msg.sender;
    if (senderId !== userId) return;
    setDeletingId(msg._id);
    try {
      socketRef.current?.emit('delete-community-message', { userId, messageId: msg._id });
      await deleteChatMessage(msg._id).catch(() => {});
      setMessages(prev => prev.filter(m => m._id !== msg._id));
    } finally { setDeletingId(null); }
  };

  const userId = user?._id || user?.id;
  const isMyMsg = (msg) => {
    const sid = msg.senderId || msg.sender?._id || msg.sender;
    return sid === userId;
  };

  return (
    <div className="comm-chat-shell">
      <div className="comm-chat-status">
        {socketReady ? '🟢 Connected' : '⏳ Connecting…'}
      </div>

      <div className="comm-chat-body">
        {loading && <div className="comm-chat-loading">Loading messages…</div>}
        {!loading && messages.length === 0 && (
          <div className="comm-chat-empty">
            <div style={{fontSize:40,marginBottom:8}}>💬</div>
            No messages yet. Say hi!
          </div>
        )}
        {messages.map(msg => {
          const mine = isMyMsg(msg);
          const name = msg.senderName || msg.sender?.name || 'Unknown';
          const usn  = msg.senderUsn  || msg.sender?.usn  || '';
          return (
            <div key={msg._id} className={`comm-msg-row ${mine ? 'mine' : 'theirs'}`}>
              {!mine && <div className="comm-msg-avatar">{name.charAt(0).toUpperCase()}</div>}
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
                    <button className="comm-msg-delete"
                      onClick={() => deleteMsg(msg)}
                      disabled={deletingId === msg._id}>
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

      <div className="comm-chat-input-row">
        <textarea
          ref={inputRef}
          className="comm-chat-input"
          placeholder="Type a message… (Enter to send)"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={1}
          maxLength={500}
          disabled={!socketReady}
        />
        <button className="comm-chat-send"
          onClick={send}
          disabled={!text.trim() || !socketReady}>
          ➤
        </button>
      </div>
    </div>
  );
}

// ── Main CommunityPage ────────────────────────────────────────────
export default function CommunityPage({ navigate }) {
  const { user } = useAuth();
  const [tab, setTab] = useState('posts'); // 'posts' | 'chat'

  return (
    <div className="comm-shell">
      {/* Header */}
      <div className="comm-header">
        <div className="comm-header-title">
          🏫 {user?.college || 'College'} Community
        </div>
        <div className="comm-tabs">
          <button className={`comm-tab ${tab==='posts'?'active':''}`} onClick={() => setTab('posts')}>
            📋 Posts
          </button>
          <button className={`comm-tab ${tab==='chat'?'active':''}`} onClick={() => setTab('chat')}>
            💬 Chat
          </button>
        </div>
      </div>

      {tab === 'posts' ? <PostsTab user={user} /> : <ChatTab user={user} />}
    </div>
  );
}
