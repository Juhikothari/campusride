// ═══════════════════════════════════════════════════════════════════
//  PATCH INSTRUCTIONS FOR frontend/src/pages/CommunityPage.jsx
//  Two fixes:
//    A) Posts disappearing on refresh → backend college-scope bug
//    B) Delete option for own posts
// ═══════════════════════════════════════════════════════════════════

// ── PATCH A — Add deleteCommunityPost import ──────────────────────
// FIND:
import {
  getCommunityPosts, createCommunityPost,
  toggleCommunityLike, addCommunityReply,
  getChatMessages, deleteChatMessage,
} from '../services/api.js';

// REPLACE WITH:
import {
  getCommunityPosts, createCommunityPost,
  toggleCommunityLike, addCommunityReply,
  deleteCommunityPost,
  getChatMessages, deleteChatMessage,
} from '../services/api.js';


// ── PATCH B — In PostsTab, add deletingPost state ─────────────────
// FIND (inside PostsTab function, with the other useState declarations):
  const [replyText,   setReplyText]   = useState({});
  const [showReply,   setShowReply]   = useState({});
  const fileInputRef  = useRef(null);

// REPLACE WITH:
  const [replyText,   setReplyText]   = useState({});
  const [showReply,   setShowReply]   = useState({});
  const [deletingPost, setDeletingPost] = useState(null);
  const fileInputRef  = useRef(null);


// ── PATCH C — Add handleDeletePost handler (after handleReply) ────
// FIND:
  const TYPE_ICONS = { tip:'💡', landmark:'📍', alert:'⚠️' };

// REPLACE WITH:
  const handleDeletePost = async (postId, authorId) => {
    const userId = user?._id || user?.id;
    if (authorId !== userId) return;
    if (!window.confirm('Delete this post?')) return;
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


// ── PATCH D — Add delete button to each post card ─────────────────
// FIND:
          <div className="comm-post-footer">
            <button className="comm-like-btn" onClick={() => handleLike(post._id)}>
              ❤️ {post.likes || 0}
            </button>
            <button className="comm-reply-toggle"
              onClick={() => setShowReply(prev => ({ ...prev, [post._id]: !prev[post._id] }))}>
              💬 {post.replies?.length || 0} {showReply[post._id] ? '▲' : '▼'}
            </button>
          </div>

// REPLACE WITH:
          <div className="comm-post-footer">
            <button className="comm-like-btn" onClick={() => handleLike(post._id)}>
              ❤️ {post.likes || 0}
            </button>
            <button className="comm-reply-toggle"
              onClick={() => setShowReply(prev => ({ ...prev, [post._id]: !prev[post._id] }))}>
              💬 {post.replies?.length || 0} {showReply[post._id] ? '▲' : '▼'}
            </button>
            {/* Show delete only for own (non-anonymous) posts */}
            {!post.anonymous && (post.author?._id || post.author) === (user?._id || user?.id) && (
              <button
                className="comm-msg-delete"
                onClick={() => handleDeletePost(post._id, post.author?._id || post.author)}
                disabled={deletingPost === post._id}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
                         color: '#e53935', fontSize: 15, padding: '4px 8px' }}
                title="Delete post"
              >
                {deletingPost === post._id ? '…' : '🗑'}
              </button>
            )}
          </div>
