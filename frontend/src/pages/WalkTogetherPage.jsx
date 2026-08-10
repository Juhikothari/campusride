import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getCommunityPosts, createCommunityPost } from '../services/api.js';

function timeAgoStr(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return m + 'm ago';
  return Math.floor(m / 60) + 'h ago';
}

export default function WalkTogetherPage({ navigate }) {
  const { user } = useAuth();
  const [posts,   setPosts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [from,    setFrom]    = useState('');
  const [to,      setTo]      = useState('');
  const [time,    setTime]    = useState('');
  const [posting,   setPosting]   = useState(false);
  const [womenOnly, setWomenOnly] = useState(false);
  const [joined,  setJoined]  = useState({});

  useEffect(() => {
    getCommunityPosts()
      .then(data => {
        const walkPosts = (Array.isArray(data) ? data : []).filter(p => p.type === 'walk');
        setPosts(walkPosts);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const postWalk = async () => {
    if (!from.trim() || !to.trim() || !time.trim()) return;
    setPosting(true);
    try {
      const womenTag = womenOnly ? ' 👩 Women only.' : '';
      const content = `🚶 Walking from ${from.trim()} → ${to.trim()} at ${time}. Anyone joining?${womenTag}`;
      const post = await createCommunityPost({ content, type: 'walk', anonymous: false });
      setPosts(prev => [post, ...prev]);
      setFrom(''); setTo(''); setTime('');
    } catch (e) {
      alert(e.message || 'Failed to post');
    } finally {
      setPosting(false);
    }
  };

  const toggleJoin = (postId) => setJoined(j => ({ ...j, [postId]: !j[postId] }));

  return (
    <div className="narrow-wrap fade-up" style={{paddingBottom:40}}>
      <div style={{marginBottom:24}}>
        <h2 style={{color:'#fff',fontSize:24,fontWeight:800,margin:'0 0 6px'}}>🚶 Walk Together</h2>
        <p style={{color:'#666',fontSize:13,margin:0}}>
          Find a walking companion on campus. Post your route and time — others can join you.
        </p>
      </div>

      {/* Post form */}
      <div style={{background:'#111318',border:'1px solid #1f2330',borderRadius:14,padding:18,marginBottom:24}}>
        <div style={{fontSize:13,color:'#888',fontWeight:600,marginBottom:14}}>📢 I'm walking…</div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <input
            placeholder="From (e.g. Gate 1, Main Block, Hostel)"
            value={from} onChange={e => setFrom(e.target.value)}
            className="input"
          />
          <input
            placeholder="To (e.g. Library, Lab Block, Canteen)"
            value={to} onChange={e => setTo(e.target.value)}
            className="input"
          />
          <input
            type="time" value={time} onChange={e => setTime(e.target.value)}
            className="input"
          />
          {/* Women-only toggle — visible only to female users */}
          {user?.gender === 'female' && (
            <button
              type="button"
              onClick={() => setWomenOnly(w => !w)}
              style={{
                background: womenOnly ? 'rgba(233,30,140,0.15)' : 'transparent',
                border: `1.5px solid ${womenOnly ? '#e91e8c' : '#333'}`,
                borderRadius: 8, padding: '9px 14px', cursor: 'pointer',
                color: womenOnly ? '#e91e8c' : '#666',
                fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', textAlign: 'left',
              }}
            >
              <span style={{fontSize:18}}>{womenOnly ? '🔒' : '♀'}</span>
              <div>
                <div>{womenOnly ? 'Women Only 🔒' : 'Open to everyone'}</div>
                <div style={{fontSize:11,fontWeight:400,color:womenOnly?'#c2185b':'#555',marginTop:2}}>
                  {womenOnly ? 'Only female commuters will see this walk request' : 'Tap to make this women-only'}
                </div>
              </div>
              {womenOnly && (
                <span style={{marginLeft:'auto',background:'#e91e8c',color:'#fff',
                  borderRadius:6,fontSize:10,padding:'2px 8px',fontWeight:700}}>ON</span>
              )}
            </button>
          )}
          <button
            onClick={postWalk}
            disabled={posting || !from.trim() || !to.trim() || !time.trim()}
            className="btn btn-primary btn-full"
          >
            {posting ? 'Posting…' : '🚶 Post Walk Request'}
          </button>
        </div>
      </div>

      {/* Walk posts */}
      {loading && <div style={{textAlign:'center',color:'#555',padding:24}}>Loading…</div>}
      {!loading && posts.length === 0 && (
        <div style={{textAlign:'center',padding:'40px 16px',color:'#555'}}>
          <div style={{fontSize:40,marginBottom:10}}>🚶</div>
          <div style={{fontWeight:600,color:'#888',marginBottom:6}}>No walk requests yet</div>
          <div style={{fontSize:12}}>Be the first to post one above!</div>
        </div>
      )}
      {posts
        .filter(post => {
          // Hide women-only walk requests from male users
          if (user?.gender === 'male' && post.content?.includes('👩 Women only')) return false;
          return true;
        })
        .map(post => {
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
                  borderRadius:8, padding:'7px 14px', fontSize:12, fontWeight:700,
                  cursor:'pointer', flexShrink:0, whiteSpace:'nowrap',
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
