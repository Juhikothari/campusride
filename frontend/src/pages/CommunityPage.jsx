import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getCommunityPosts, createCommunityPost, toggleCommunityLike, addCommunityReply } from '../services/api.js';
import { API_BASE } from '../services/api.js';
import { io } from 'socket.io-client';
import './CommunityPage.css';

const TYPE_COLOR = { tip: 'var(--accent)', landmark: 'var(--green)', alert: 'var(--red)' };
const TYPE_LABEL = { tip: 'Tip', landmark: 'Pin', alert: 'Alert' };

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} day ago`;
}

function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [onDone]);
  return <div className="comm-toast">{message}</div>;
}

// ── Single post card ──────────────────────────────────────────────
function PostCard({ post, currentUserId, currentUserName, onLike, onReplyAdded }) {
  const [showReply,    setShowReply]    = useState(false);
  const [replyText,    setReplyText]    = useState('');
  const [replyAnon,    setReplyAnon]    = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [localReplies, setLocalReplies] = useState(post.replies || []);
  const textareaRef = useRef(null);

  useEffect(() => { setLocalReplies(post.replies || []); }, [post.replies]);

  const toggleReply = () => {
    setShowReply(v => !v);
    setReplyText('');
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const submitReply = async () => {
    if (!replyText.trim() || submitting) return;
    setSubmitting(true);
    try {
      const saved = await addCommunityReply(post._id, replyText.trim(), replyAnon);
      const displayName = replyAnon ? 'Anonymous' : currentUserName;
      setLocalReplies(prev => [...prev, {
        ...saved,
        authorName: displayName,
        createdAt: saved.createdAt || new Date().toISOString()
      }]);
      onReplyAdded(post._id, { ...saved, authorName: displayName });
      setReplyText('');
      setReplyAnon(false);
      setShowReply(false);
    } catch (err) {
      console.error('Reply failed:', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Anonymous post shows "Anonymous" as author, never reveals name
  const isAnon     = post.anonymous === true;
  const authorName = isAnon ? 'Anonymous' : (post.author?.name || 'Unknown');
  const authorCollege = post.author?.college || post.college || '';
  // Avatar initial: '?' for anonymous
  const avatar = isAnon ? '?' : authorName.charAt(0).toUpperCase();

  return (
    <div className="comm-post card">
      <div className="card-body">
        <div className="post-top">
          <div className="admin-avatar"
            style={{ width:38, height:38, fontSize:14, flexShrink:0,
              ...(isAnon ? { background:'var(--surface3)', color:'var(--text3)' } : {}) }}>
            {avatar}
          </div>
          <div className="post-meta flex-1">
            <div className="post-name">
              {authorName}
              {!isAnon && <span className="post-college">{authorCollege}</span>}
              {isAnon && <span className="post-college" style={{fontStyle:'italic'}}>posted anonymously</span>}
            </div>
            <div className="post-time">{timeAgo(post.createdAt)}</div>
          </div>
          <div className="post-type-tag"
            style={{ background: TYPE_COLOR[post.type]+'22', color: TYPE_COLOR[post.type] }}>
            {TYPE_LABEL[post.type]}
          </div>
        </div>

        <p className="post-body mt-12">{post.content}</p>

        {/* Like + Reply only — Share removed */}
        <div className="post-foot mt-12">
          <button
            className={'like-pill' + (post._liked ? ' liked' : '')}
            onClick={() => onLike(post._id)}>
            {post._liked ? 'Liked' : 'Like'} {post.likes}
          </button>
          <button className="action-pill" onClick={toggleReply}>
            {showReply ? 'Cancel' : `Reply${localReplies.length ? ` (${localReplies.length})` : ''}`}
          </button>
        </div>

        {/* Existing replies */}
        {localReplies.length > 0 && (
          <div className="replies-thread mt-12">
            {localReplies.map((r, i) => (
              <div key={r._id || i} className="reply-row">
                <div className="reply-ava">
                  {r.anonymous ? '?' : (r.authorName || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="reply-body">
                  <span className="reply-author">
                    {r.anonymous ? 'Anonymous' : (r.authorName || 'User')}
                  </span>
                  <span className="reply-text">{r.content}</span>
                  <span className="reply-time">{timeAgo(r.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Reply input with anonymous toggle */}
        {showReply && (
          <div className="reply-input-wrap mt-12">
            <textarea
              ref={textareaRef}
              className="input reply-input"
              rows={2}
              placeholder="Write a reply…"
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitReply();
              }}
            />
            {/* Anonymous toggle */}
            <label style={{
              display:'flex', alignItems:'center', gap:8, marginTop:10,
              fontSize:13, color:'var(--text2)', cursor:'pointer', userSelect:'none'
            }}>
              <input type="checkbox" checked={replyAnon}
                onChange={e => setReplyAnon(e.target.checked)}
                style={{accentColor:'var(--accent)', width:15, height:15}} />
              Reply anonymously
            </label>
            <div className="reply-actions mt-8">
              <button
                className={`btn btn-primary btn-sm ${submitting ? 'btn-loading' : ''}`}
                disabled={!replyText.trim() || submitting}
                onClick={submitReply}>
                {!submitting && (replyAnon ? 'Reply as Anonymous' : 'Post reply')}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowReply(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function CommunityPage({ navigate }) {
  const { user }    = useAuth();
  const userCollege = user?.college || '';

  const [posts,      setPosts]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [showForm,   setShowForm]   = useState(false);
  const [filter,     setFilter]     = useState('all');
  const [form,       setForm]       = useState({ content: '', type: 'tip' });
  const [anonymous,  setAnonymous]  = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast,      setToast]      = useState('');
  const socketRef = useRef(null);

  const showToast = useCallback((msg) => setToast(msg), []);

  const withLiked = useCallback((rawPosts) =>
    rawPosts.map(p => ({
      ...p,
      _liked: p.likedBy?.some(id =>
        (typeof id === 'string' ? id : id?._id?.toString?.() || id?.toString?.()) === user?._id
      ) || false
    }))
  , [user?._id]);

  // Fetch posts
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getCommunityPosts()
      .then(data => { if (!cancelled) { setPosts(withLiked(data)); setError(''); } })
      .catch(err  => { if (!cancelled) setError(err.message || 'Failed to load posts'); })
      .finally(()  => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line

  // Socket — same-college room only
  useEffect(() => {
    if (!user?._id || !userCollege) return;

    const socket = io(API_BASE.replace(/\/api\/?$/, ''), {
      transports: ['websocket', 'polling'], withCredentials: true
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      // Server validates college from DB — client just sends userId
      socket.emit('join-college-chat', { userId: user._id });
    });

    socket.on('college-chat-error', (err) => {
      console.warn('College chat error:', err.message);
    });

    socket.on('new-community-post', (post) => {
      // Extra client-side guard: only show if same college
      const postCollege = post.college?.trim().toLowerCase();
      const myCollege   = userCollege.trim().toLowerCase();
      if (postCollege && postCollege !== myCollege) return;

      setPosts(prev => {
        if (prev.some(p => p._id === post._id)) return prev;
        return [{ ...post, _liked: false }, ...prev];
      });
    });

    socket.on('new-community-reply', ({ postId, reply }) => {
      setPosts(prev => prev.map(p =>
        p._id === postId
          ? { ...p, replies: [...(p.replies || []).filter(r => r._id !== reply._id), reply] }
          : p
      ));
    });

    return () => { socket.removeAllListeners(); socket.disconnect(); };
  }, [user?._id, userCollege]);

  // Create post
  const handlePost = async () => {
    if (!form.content.trim() || submitting) return;
    setSubmitting(true);
    try {
      const newPost = await createCommunityPost({
        content:   form.content,
        type:      form.type,
        anonymous: anonymous,
      });
      setPosts(prev => [{ ...newPost, _liked: false, replies: [] }, ...prev]);
      setForm({ content: '', type: 'tip' });
      setAnonymous(false);
      setShowForm(false);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to post');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle like
  const handleLike = async (postId) => {
    setPosts(prev => prev.map(p =>
      p._id === postId
        ? { ...p, _liked: !p._liked, likes: p.likes + (p._liked ? -1 : 1) }
        : p
    ));
    try {
      await toggleCommunityLike(postId);
    } catch {
      setPosts(prev => prev.map(p =>
        p._id === postId
          ? { ...p, _liked: !p._liked, likes: p.likes + (p._liked ? -1 : 1) }
          : p
      ));
    }
  };

  const handleReplyAdded = useCallback((postId, reply) => {
    setPosts(prev => prev.map(p =>
      p._id === postId
        ? { ...p, replies: [...(p.replies || []).filter(r => r._id !== reply._id), reply] }
        : p
    ));
  }, []);

  const filtered = filter === 'all' ? posts : posts.filter(p => p.type === filter);

  return (
    <div className="community-wrap fade-up">
      <p className="eyebrow mb-8">Community</p>
      <h1 className="heading mb-4" style={{ fontSize: 28 }}>Community Hub</h1>
      <p className="text-muted mb-32 text-sm">
        {userCollege
          ? <>{`Posts from `}<strong>{userCollege}</strong>{` students only`}</>
          : 'Share tips, landmarks, and alerts with fellow campus commuters'}
      </p>

      {error && <div className="alert alert-error mb-16">{error}</div>}

      <div className="comm-top mb-24">
        <div className="comm-filters">
          {['all', 'tip', 'landmark', 'alert'].map(f => (
            <button key={f}
              className={'filter-pill' + (filter === f ? ' active' : '')}
              onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : TYPE_LABEL[f]}
            </button>
          ))}
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : '+ Post'}
        </button>
      </div>

      {showForm && (
        <div className="comm-form mb-24">
          <h3 className="heading mb-16" style={{ fontSize: 16 }}>Share with your college</h3>

          <div className="field mb-16">
            <label>Post Type</label>
            <div className="type-pills">
              {['tip', 'landmark', 'alert'].map(t => (
                <button key={t} type="button"
                  className={'type-pill' + (form.type === t ? ' active' : '')}
                  style={form.type === t
                    ? { borderColor: TYPE_COLOR[t], background: TYPE_COLOR[t]+'22', color: TYPE_COLOR[t] }
                    : {}}
                  onClick={() => setForm(f => ({ ...f, type: t }))}>
                  {TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Your Message</label>
            <textarea className="input" rows={3}
              placeholder="Share a tip, landmark, or safety alert..."
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))} />
          </div>

          {/* Anonymous toggle */}
          <label style={{
            display:'flex', alignItems:'center', gap:10, marginTop:14,
            fontSize:13, color:'var(--text2)', cursor:'pointer', userSelect:'none'
          }}>
            <input type="checkbox" checked={anonymous}
              onChange={e => setAnonymous(e.target.checked)}
              style={{accentColor:'var(--accent)', width:15, height:15}} />
            <span>
              Post anonymously
              <span style={{color:'var(--text3)', marginLeft:6}}>
                — your name won't be shown
              </span>
            </span>
          </label>

          <button
            className={`btn btn-primary mt-16 ${submitting ? 'btn-loading' : ''}`}
            disabled={!form.content.trim() || submitting}
            onClick={handlePost}>
            {!submitting && (anonymous ? 'Post Anonymously' : 'Post to Community')}
          </button>
        </div>
      )}

      <div className="comm-list">
        {loading && (
          <div className="empty-state">
            <div className="empty-sub">Loading posts…</div>
          </div>
        )}

        {!loading && filtered.map(post => (
          <PostCard
            key={post._id}
            post={post}
            currentUserId={user?._id}
            currentUserName={user?.name || 'You'}
            onLike={handleLike}
            onReplyAdded={handleReplyAdded}
          />
        ))}

        {!loading && filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">💬</div>
            <div className="empty-title">Nothing here yet</div>
            <div className="empty-sub">
              Be the first to post from {userCollege || 'your college'}!
            </div>
          </div>
        )}
      </div>

      {toast && <Toast message={toast} onDone={() => setToast('')} />}
    </div>
  );
}
