import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  getCommunityPosts, createCommunityPost,
  toggleCommunityLike, addCommunityReply,
  deleteCommunityPost,                     // ← NEW
  getChatMessages, deleteChatMessage,
} from '../services/api.js';
import { API_BASE } from '../services/api.js';
import { io } from 'socket.io-client';
import './CommunityPage.css';

const CLOUD_NAME    = 'dhkui5t39';
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
  return { url:data.secure_url, type:isImage?'image':'pdf', name:file.name };
}

// ── POSTS TAB ─────────────────────────────────────────────────────
function PostsTab({ user }) {
  const [posts,        setPosts]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [newContent,   setNewContent]   = useState('');
  const [newType,      setNewType]      = useState('tip');
  const [anonymous,    setAnonymous]    = useState(false);
  const [files,        setFiles]        = useState([]);
  const [uploading,    setUploading]    = useState(false);
  const [posting,      setPosting]      = useState(false);
  const [replyText,    setReplyText]    = useState({});
  const [showReply,    setShowReply]    = useState({});
  const [deletingPost, setDeletingPost] = useState(null);   // ← NEW
  const fileInputRef = useRef(null);

  useEffect(() => {
    getCommunityPosts()
      .then(data => setPosts(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files).slice(0, 4);
    setFiles(prev => [...prev, ...selected].slice(0, 4));
  };

  const removeFile = (i) => setFiles(prev => prev.filter((_,idx) => idx !== i));

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
      const post = await createCommunityPost({ content:newContent, type:newType, anonymous, attachments });
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
      setPosts(prev => prev.map(p => p._id === postId ? {...p, likes:(p.likes||0)+1} : p));
    } catch {}
  };

  const handleReply = async (postId) => {
    const text = replyText[postId]?.trim();
    if (!text) return;
    try {
      await addCommunityReply(postId, text);
      setReplyText(prev => ({...prev,[postId]:''}));
      setShowReply(prev => ({...prev,[postId]:false}));
      const updated = await getCommunityPosts();
      setPosts(Array.isArray(updated) ? updated : []);
    } catch {}
  };

  // ── Delete own post ───────────────────────────────────────────
  const handleDeletePost = async (postId, authorId) => {
    const userId = user?._id || user?.id;
    if (authorId !== userId) return;
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    setDeletingPost(postId);
    try {
      await deleteCommunityPost(postId);
      setPosts(prev => prev.filter(p => p._id !== postId));
    } catch (e) {
      alert(e.message || 'Failed to delete post');
    } finally {
      setDeletingPost(null);
    }
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

        <textarea className="comm-post-input"
          placeholder={`Share a ${newType} with your college…`}
          value={newContent} onChange={e => setNewContent(e.target.value)}
          rows={3} maxLength={500} />

        {files.length > 0 && (
          <div className="comm-attachments-preview">
            {files.map((f,i) => (
              <div key={i} className="comm-attachment-chip">
                {f.type?.startsWith('image/')?'🖼️':'📄'} {f.name.slice(0,20)}
                <button type="button" onClick={() => removeFile(i)}>✕</button>
              </div>
            ))}
          </div>
        )}

        <div className="comm-post-actions">
          <button type="button" className="comm-attach-btn"
            onClick={() => fileInputRef.current?.click()} title="Attach image or PDF">
            📎 Attach
          </button>
          <input ref={fileInputRef} type="file" accept="image/*,.pdf" multiple hidden onChange={handleFileChange} />

          <button type="button"
            className={`comm-anon-btn ${anonymous?'active':''}`}
            onClick={() => setAnonymous(a => !a)}>
            {anonymous?'🎭 Anonymous':'👤 Public'}
          </button>

          <span style={{flex:1}}/>
          <span style={{fontSize:11,color:'#555'}}>{newContent.length}/500</span>

          <button type="button" className="comm-post-btn"
            onClick={handlePost}
            disabled={posting||uploading||!newContent.trim()}>
            {uploading?'Uploading…':posting?'Posting…':'Post'}
          </button>
        </div>
      </div>

      {loading && <div className="comm-loading">Loading posts…</div>}
      {!loading && posts.length === 0 && (
        <div className="comm-empty">No posts yet. Share something with your college!</div>
      )}

      {posts.map(post => {
        const postAuthorId = post.author?._id || post.author;
        const myUserId     = user?._id || user?.id;
        const isOwner      = !post.anonymous && postAuthorId === myUserId;

        return (
          <div key={post._id} className="comm-post-card">
            <div className="comm-post-header">
              <span className="comm-post-type-badge">{TYPE_ICONS[post.type]||'💡'} {post.type}</span>
              <span className="comm-post-author">
                {post.anonymous ? '🎭 Anonymous' : (post.author?.name||'Unknown')}
              </span>
              <span className="comm-post-time">{timeAgo(post.createdAt)}</span>
            </div>

            <p className="comm-post-content">{post.content}</p>

            {post.attachments?.length > 0 && (
              <div className="comm-post-attachments">
                {post.attachments.map((a,i) => (
                  a.type==='image' ? (
                    <a key={i} href={a.url} target="_blank" rel="noreferrer">
                      <img src={a.url} alt={a.name} className="comm-post-img"/>
                    </a>
                  ) : (
                    <a key={i} href={a.url} target="_blank" rel="noreferrer" className="comm-pdf-link">
                      📄 {a.name||'View PDF'}
                    </a>
                  )
                ))}
              </div>
            )}

            <div className="comm-post-footer">
              <button className="comm-like-btn" onClick={() => handleLike(post._id)}>
                ❤️ {post.likes||0}
              </button>
              <button className="comm-reply-toggle"
                onClick={() => setShowReply(prev => ({...prev,[post._id]:!prev[post._id]}))}>
                💬 {post.replies?.length||0} {showReply[post._id]?'▲':'▼'}
              </button>

              {/* Delete button — only for own non-anonymous posts */}
              {isOwner && (
                <button
                  onClick={() => handleDeletePost(post._id, postAuthorId)}
                  disabled={deletingPost === post._id}
                  title="Delete post"
                  style={{marginLeft:'auto',background:'none',border:'none',
                    cursor:'pointer',color:'#e53935',fontSize:15,padding:'4px 8px'}}>
                  {deletingPost === post._id ? '…' : '🗑'}
                </button>
              )}
            </div>

            {showReply[post._id] && (
              <div className="comm-replies">
                {post.replies?.map((r,i) => (
                  <div key={i} className="comm-reply">
                    <span className="comm-reply-author">{r.anonymous?'🎭 Anonymous':r.authorName}</span>
                    <span className="comm-reply-text">{r.content}</span>
                    <span className="comm-reply-time">{timeAgo(r.createdAt)}</span>
                  </div>
                ))}
                <div className="comm-reply-input-row">
                  <input className="comm-reply-input" placeholder="Write a reply…"
                    value={replyText[post._id]||''}
                    onChange={e => setReplyText(prev => ({...prev,[post._id]:e.target.value}))}
                    onKeyDown={e => e.key==='Enter' && handleReply(post._id)}
                    maxLength={300} />
                  <button className="comm-reply-btn" onClick={() => handleReply(post._id)}>Send</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
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
  const [anonChat,    setAnonChat]    = useState(false);  // ← anonymous chat toggle
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

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages]);

  const send = useCallback(() => {
    const msg = text.trim();
    if (!msg || !socketReady) return;
    const userId = user?._id || user?.id;
    socketRef.current?.emit('send-community-message', { userId, message:msg, anonymous:anonChat });
    setText('');
    inputRef.current?.focus();
  }, [text, socketReady, user, anonChat]);

  const deleteMsg = async (msg) => {
    const userId = user?._id || user?.id;
    const senderId = msg.senderId || msg.sender?._id || msg.sender;
    if (senderId !== userId) return;
    setDeletingId(msg._id);
    try {
      socketRef.current?.emit('delete-community-message', { userId, messageId:msg._id });
      await deleteChatMessage(msg._id).catch(() => {});
      setMessages(prev => prev.filter(m => m._id !== msg._id));
    } finally { setDeletingId(null); }
  };

  const userId  = user?._id || user?.id;
  const isMyMsg = (msg) => {
    if (msg.anonymous) return false; // anon msgs have no senderId — can't delete
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
          const isAnon = msg.anonymous;
          const name = isAnon ? 'Anonymous' : (msg.senderName || msg.sender?.name || 'Unknown');
          const usn  = isAnon ? '' : (msg.senderUsn  || msg.sender?.usn  || '');
          return (
            <div key={msg._id} className={`comm-msg-row ${mine?'mine':'theirs'}`}>
              {!mine && <div className="comm-msg-avatar">{name.charAt(0).toUpperCase()}</div>}
              <div className={`comm-msg-bubble ${mine?'bubble-mine':'bubble-theirs'}`}>
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
        <div ref={bottomRef}/>
      </div>

      <div style={{padding:'4px 12px 2px',display:'flex',alignItems:'center',gap:6}}>
        <button
          type="button"
          onClick={() => setAnonChat(a => !a)}
          title={anonChat ? 'Sending anonymously — tap to send as yourself' : 'Tap to send anonymously'}
          style={{
            background: anonChat ? 'rgba(245,166,35,0.15)' : 'transparent',
            border: `1px solid ${anonChat ? '#f5a623' : '#333'}`,
            borderRadius: 8, padding: '4px 10px', cursor: 'pointer',
            color: anonChat ? '#f5a623' : '#666', fontSize: 12, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
          }}>
          {anonChat ? '🎭 Anonymous' : '👤 Public'}
        </button>
      </div>
      <div className="comm-chat-input-row">
        <textarea ref={inputRef} className="comm-chat-input"
          placeholder={anonChat ? 'Sending anonymously… (Enter to send)' : 'Type a message… (Enter to send)'}
          value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={1} maxLength={500} disabled={!socketReady} />
        <button className="comm-chat-send" onClick={send} disabled={!text.trim()||!socketReady}>➤</button>
      </div>
    </div>
  );
}



// ── ROUTE MATCH TAB ───────────────────────────────────────────────
// "What's My Route?" — shows other commuters from same college
// who have the same or nearby pickup/drop.
function RouteMatchTab({ user, navigate }) {
  const [pickup,   setPickup]   = React.useState('');
  const [drop,     setDrop]     = React.useState('');
  const [matches,  setMatches]  = React.useState(null);
  const [loading,  setLoading]  = React.useState(false);
  const [searched, setSearched] = React.useState(false);

  const search = async () => {
    if (!pickup.trim() || !drop.trim()) return;
    setLoading(true);
    setSearched(true);
    // Use the existing searchRides API to find rides matching the area
    // We filter by pickup keyword since we don't have exact coords here
    try {
      const { searchRides } = await import('../services/api.js');
      // Geocode pickup from the backend location proxy
      const { searchLocation } = await import('../services/api.js');
      const pickupResults = await searchLocation(pickup);
      const dropResults   = await searchLocation(drop);

      if (!pickupResults?.length) { setMatches([]); setLoading(false); return; }

      const pLat = pickupResults[0].lat;
      const pLng = pickupResults[0].lng;

      const rides = await searchRides({ lat: pLat, lng: pLng, maxDistance: 5000 });
      // Filter rides whose drop address includes the drop keyword
      const dropKey = drop.toLowerCase();
      const filtered = (rides || []).filter(r =>
        r.drop?.address?.toLowerCase().includes(dropKey) ||
        r.drop?.address?.toLowerCase().includes(dropKey.split(' ')[0])
      );
      setMatches(filtered);
    } catch {
      setMatches([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{padding:'16px 12px'}}>
      <div style={{marginBottom:20}}>
        <h3 style={{color:'#fff',fontSize:16,fontWeight:700,margin:'0 0 6px'}}>
          🗺️ What's My Route?
        </h3>
        <p style={{color:'#666',fontSize:13,margin:0}}>
          Find commuters from {user?.college || 'your college'} who travel the same route as you.
        </p>
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:16}}>
        <input
          className="comm-reply-input"
          placeholder="📍 Your pickup area (e.g. Rajarajeshwari Nagar)"
          value={pickup}
          onChange={e => setPickup(e.target.value)}
          style={{width:'100%',padding:'10px 14px',borderRadius:10,
            background:'#111318',border:'1px solid #2a2d35',color:'#fff',fontSize:14}}
        />
        <input
          className="comm-reply-input"
          placeholder="🏁 Your drop area (e.g. RNS Institute of Technology)"
          value={drop}
          onChange={e => setDrop(e.target.value)}
          style={{width:'100%',padding:'10px 14px',borderRadius:10,
            background:'#111318',border:'1px solid #2a2d35',color:'#fff',fontSize:14}}
          onKeyDown={e => e.key === 'Enter' && search()}
        />
        <button
          onClick={search}
          disabled={loading || !pickup.trim() || !drop.trim()}
          style={{background:'#f5a623',color:'#000',border:'none',borderRadius:10,
            padding:'11px',fontWeight:700,fontSize:14,cursor:'pointer'}}
        >
          {loading ? 'Searching…' : '🔍 Find Route Matches'}
        </button>
      </div>

      {searched && !loading && matches !== null && (
        matches.length === 0 ? (
          <div style={{textAlign:'center',padding:'32px 16px',color:'#555'}}>
            <div style={{fontSize:36,marginBottom:8}}>🗺️</div>
            <div style={{fontWeight:600,color:'#888',marginBottom:6}}>No matches found yet</div>
            <div style={{fontSize:12,color:'#555'}}>
              Be the first to post this route! Others looking for the same commute will find you.
            </div>
            <button
              onClick={() => navigate('create-ride')}
              style={{marginTop:16,background:'transparent',border:'1px solid #f5a623',
                color:'#f5a623',borderRadius:10,padding:'8px 18px',fontSize:13,
                fontWeight:600,cursor:'pointer'}}
            >
              + Post This Route
            </button>
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            <div style={{fontSize:13,color:'#888',marginBottom:4}}>
              {matches.length} commuter{matches.length !== 1 ? 's' : ''} found on this route
            </div>
            {matches.map(ride => (
              <div key={ride._id} style={{
                background:'#111318',border:'1px solid #1f2330',borderRadius:12,padding:'14px 16px',
              }}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                  <div>
                    <div style={{color:'#fff',fontWeight:600,fontSize:14}}>
                      👤 {ride.providerId?.name || 'Commuter'}
                    </div>
                    <div style={{color:'#aaa',fontSize:12,marginTop:4}}>
                      📍 {ride.pickup?.address?.split(',')[0]} → {ride.drop?.address?.split(',')[0]}
                    </div>
                    <div style={{color:'#666',fontSize:11,marginTop:3}}>
                      {new Date(ride.date).toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})} · {ride.time} · ₹{ride.costPerSeat}/seat
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('ride-detail', { rideId: ride._id })}
                    style={{background:'#f5a623',color:'#000',border:'none',borderRadius:8,
                      padding:'6px 14px',fontSize:12,fontWeight:700,cursor:'pointer',flexShrink:0}}
                  >
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

// ── WALK TOGETHER TAB ─────────────────────────────────────────────
// Match students walking the same campus route.
// Posts are stored as community posts with type 'walk'.
function WalkTogetherTab({ user }) {
  const [posts,    setPosts]    = React.useState([]);
  const [loading,  setLoading]  = React.useState(true);
  const [from,     setFrom]     = React.useState('');
  const [to,       setTo]       = React.useState('');
  const [time,     setTime]     = React.useState('');
  const [posting,  setPosting]  = React.useState(false);
  const [joined,   setJoined]   = React.useState({});

  React.useEffect(() => {
    import('../services/api.js').then(({ getCommunityPosts }) => {
      getCommunityPosts()
        .then(data => {
          const walkPosts = (Array.isArray(data) ? data : []).filter(p => p.type === 'walk');
          setPosts(walkPosts);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    });
  }, []);

  const postWalk = async () => {
    if (!from.trim() || !to.trim() || !time.trim()) return;
    setPosting(true);
    try {
      const { createCommunityPost } = await import('../services/api.js');
      const content = `🚶 Walking from ${from.trim()} → ${to.trim()} at ${time}. Anyone joining?`;
      const post = await createCommunityPost({ content, type: 'walk', anonymous: false });
      setPosts(prev => [post, ...prev]);
      setFrom(''); setTo(''); setTime('');
    } catch (e) {
      alert(e.message || 'Failed to post');
    } finally {
      setPosting(false);
    }
  };

  const toggleJoin = (postId) => {
    setJoined(j => ({ ...j, [postId]: !j[postId] }));
  };

  const timeAgoStr = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return m + 'm ago';
    return Math.floor(m / 60) + 'h ago';
  };

  return (
    <div style={{padding:'16px 12px'}}>
      <div style={{marginBottom:20}}>
        <h3 style={{color:'#fff',fontSize:16,fontWeight:700,margin:'0 0 6px'}}>
          🚶 Walk Together
        </h3>
        <p style={{color:'#666',fontSize:13,margin:0}}>
          Find a walking companion on campus. Post your route and time — others can join you.
        </p>
      </div>

      {/* Post a walk */}
      <div style={{background:'#111318',border:'1px solid #1f2330',borderRadius:12,padding:16,marginBottom:20}}>
        <div style={{fontSize:13,color:'#888',fontWeight:600,marginBottom:12}}>📢 I'm walking…</div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <input
            placeholder="From (e.g. Gate 1, Main Block, Hostel)"
            value={from}
            onChange={e => setFrom(e.target.value)}
            style={{padding:'9px 12px',borderRadius:8,background:'#0d0f14',
              border:'1px solid #2a2d35',color:'#fff',fontSize:13}}
          />
          <input
            placeholder="To (e.g. Library, Lab Block, Canteen)"
            value={to}
            onChange={e => setTo(e.target.value)}
            style={{padding:'9px 12px',borderRadius:8,background:'#0d0f14',
              border:'1px solid #2a2d35',color:'#fff',fontSize:13}}
          />
          <input
            type="time"
            value={time}
            onChange={e => setTime(e.target.value)}
            style={{padding:'9px 12px',borderRadius:8,background:'#0d0f14',
              border:'1px solid #2a2d35',color:'#fff',fontSize:13}}
          />
          <button
            onClick={postWalk}
            disabled={posting || !from.trim() || !to.trim() || !time.trim()}
            style={{background:'#f5a623',color:'#000',border:'none',borderRadius:8,
              padding:'10px',fontWeight:700,fontSize:13,cursor:'pointer'}}
          >
            {posting ? 'Posting…' : '🚶 Post Walk Request'}
          </button>
        </div>
      </div>

      {/* Walk posts */}
      {loading && <div style={{textAlign:'center',color:'#555',padding:24}}>Loading…</div>}
      {!loading && posts.length === 0 && (
        <div style={{textAlign:'center',padding:'32px 16px',color:'#555'}}>
          <div style={{fontSize:36,marginBottom:8}}>🚶</div>
          <div style={{fontWeight:600,color:'#888'}}>No walk requests yet</div>
          <div style={{fontSize:12,marginTop:6}}>Be the first to post one!</div>
        </div>
      )}
      {posts.map(post => {
        const isJoined = joined[post._id];
        return (
          <div key={post._id} style={{
            background:'#111318',border:'1px solid #1f2330',borderRadius:12,
            padding:'14px 16px',marginBottom:10,
          }}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10}}>
              <div style={{flex:1}}>
                <div style={{color:'#fff',fontSize:14,lineHeight:1.5}}>{post.content}</div>
                <div style={{color:'#555',fontSize:11,marginTop:6}}>
                  {post.anonymous ? '🎭 Anonymous' : (post.author?.name || 'Someone')} · {timeAgoStr(post.createdAt)}
                </div>
              </div>
              <button
                onClick={() => toggleJoin(post._id)}
                style={{
                  background: isJoined ? 'rgba(76,175,80,0.15)' : 'rgba(245,166,35,0.12)',
                  border: `1px solid ${isJoined ? '#4caf50' : '#f5a623'}`,
                  color: isJoined ? '#4caf50' : '#f5a623',
                  borderRadius:8,padding:'6px 12px',fontSize:12,fontWeight:700,
                  cursor:'pointer',flexShrink:0,whiteSpace:'nowrap',
                }}
              >
                {isJoined ? '✅ Joined' : '+ Join'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main CommunityPage ─────────────────────────────────────────────
export default function CommunityPage({ navigate }) {
  const { user } = useAuth();
  const [tab, setTab] = useState('posts');

  return (
    <div className="comm-shell">
      <div className="comm-header">
        <div className="comm-header-title">🏫 {user?.college ? user.college.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') + ' Commuters' : 'Commuter Community'}</div>
        <div className="comm-tabs" style={{display:'flex',gap:4,flexWrap:'wrap'}}>
          <button className={`comm-tab ${tab==='posts'?'active':''}`}  onClick={() => setTab('posts')}>📋 Posts</button>
          <button className={`comm-tab ${tab==='chat'?'active':''}`}   onClick={() => setTab('chat')}>💬 Chat</button>

        </div>
      </div>
      {tab === 'posts' && <PostsTab user={user}/>}
      {tab === 'chat'  && <ChatTab user={user}/>}
    </div>
  );
}
