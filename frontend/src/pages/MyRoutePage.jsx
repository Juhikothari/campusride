// frontend/src/pages/MyRoutePage.jsx
// "What's Your Route?" — users post their daily commute route,
// the app finds others from the same college going the same way.
// All matching is done against community-posted routes via the
// existing community/posts backend (type = 'route').

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import LocationSearch from '../components/LocationSearch.jsx';
import { getCommunityPosts, createCommunityPost } from '../services/api.js';
import './MyRoutePage.css';

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const TIMES = ['6:00 AM','6:30 AM','7:00 AM','7:30 AM','8:00 AM','8:30 AM','9:00 AM','9:30 AM','10:00 AM','After 10 AM'];

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function RouteCard({ route, isMe, onDelete }) {
  const days = route.days?.join(', ') || '—';
  return (
    <div style={{
      background: isMe ? 'rgba(245,166,35,0.08)' : '#111318',
      border: `1px solid ${isMe ? 'rgba(245,166,35,0.4)' : '#1f2330'}`,
      borderRadius: 14, padding: '16px 18px', marginBottom: 12,
    }}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
        <div style={{
          width:32,height:32,borderRadius:'50%',
          background: isMe ? '#f5a623' : '#1a1d24',
          color: isMe ? '#000' : '#f5a623',
          display:'flex',alignItems:'center',justifyContent:'center',
          fontWeight:800,fontSize:13,flexShrink:0,
        }}>
          {isMe ? 'Me' : (route.authorName||'?').charAt(0).toUpperCase()}
        </div>
        <div style={{flex:1}}>
          <div style={{color:'#fff',fontWeight:700,fontSize:13}}>
            {isMe ? 'Your route' : (route.authorName || 'Commuter')}
            {isMe && <span style={{marginLeft:8,fontSize:10,color:'#f5a623',background:'rgba(245,166,35,0.12)',border:'1px solid rgba(245,166,35,0.3)',borderRadius:4,padding:'1px 7px'}}>YOU</span>}
          </div>
          <div style={{fontSize:11,color:'#666'}}>{route.college || '—'}</div>
        </div>
        {isMe && (
          <button onClick={onDelete}
            style={{background:'none',border:'none',cursor:'pointer',color:'#e53935',fontSize:16,padding:'4px 6px'}}>
            🗑
          </button>
        )}
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:5}}>
        <div style={{display:'flex',alignItems:'flex-start',gap:8}}>
          <span style={{fontSize:14}}>🏠</span>
          <span style={{fontSize:13,color:'#ccc'}}>{route.fromLabel || '—'}</span>
        </div>
        <div style={{display:'flex',alignItems:'flex-start',gap:8}}>
          <span style={{fontSize:14}}>🏫</span>
          <span style={{fontSize:13,color:'#ccc'}}>{route.toLabel || '—'}</span>
        </div>
      </div>

      <div style={{marginTop:10,display:'flex',gap:8,flexWrap:'wrap'}}>
        {route.days?.map(d => (
          <span key={d} style={{fontSize:11,color:'#f5a623',background:'rgba(245,166,35,0.1)',
            border:'1px solid rgba(245,166,35,0.2)',borderRadius:5,padding:'2px 8px'}}>{d}</span>
        ))}
        {route.time && (
          <span style={{fontSize:11,color:'#888',background:'#1a1d24',borderRadius:5,padding:'2px 8px'}}>
            🕐 {route.time}
          </span>
        )}
        {route.mode && (
          <span style={{fontSize:11,color:'#888',background:'#1a1d24',borderRadius:5,padding:'2px 8px'}}>
            {route.mode === 'ride' ? '🚗 Ride' : route.mode === 'walk' ? '🚶 Walk' : '🚗🚶 Either'}
          </span>
        )}
      </div>

      {route.note && (
        <p style={{marginTop:8,fontSize:12,color:'#666',fontStyle:'italic'}}>"{route.note}"</p>
      )}
    </div>
  );
}

export default function MyRoutePage({ navigate }) {
  const { user } = useAuth();

  const [allRoutes,  setAllRoutes]  = useState([]);
  const [myRoute,    setMyRoute]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [posting,    setPosting]    = useState(false);
  const [error,      setError]      = useState('');
  const [matchDist,  setMatchDist]  = useState(2); // km threshold

  const [form, setForm] = useState({
    fromLabel:'', fromLat:'', fromLng:'',
    toLabel:'',   toLat:'',   toLng:'',
    days: [], time: '', mode: 'ride', note: '',
  });

  // Load all route posts from community (type = 'route')
  useEffect(() => {
    getCommunityPosts()
      .then(posts => {
        const routes = (Array.isArray(posts) ? posts : [])
          .filter(p => p.type === 'route')
          .map(p => {
            try { return { ...p, ...(JSON.parse(p.content || '{}')) }; } catch { return p; }
          });
        setAllRoutes(routes);
        const userId = user?._id || user?.id;
        const mine = routes.find(r => (r.author?._id || r.author) === userId);
        setMyRoute(mine || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleDay = (d) => setForm(f => ({
    ...f,
    days: f.days.includes(d) ? f.days.filter(x => x !== d) : [...f.days, d],
  }));

  const postRoute = async () => {
    if (!form.fromLat || !form.toLat) { setError('Set both your home location and destination'); return; }
    if (!form.days.length)            { setError('Select at least one travel day'); return; }
    setPosting(true); setError('');
    try {
      const payload = JSON.stringify({
        fromLabel: form.fromLabel, fromLat: parseFloat(form.fromLat), fromLng: parseFloat(form.fromLng),
        toLabel:   form.toLabel,   toLat:   parseFloat(form.toLat),   toLng:   parseFloat(form.toLng),
        days: form.days, time: form.time, mode: form.mode, note: form.note,
        authorName: user?.name, college: user?.college,
      });
      const post = await createCommunityPost({ content: payload, type: 'route', anonymous: false });
      const parsed = { ...post, ...(JSON.parse(payload)) };
      setMyRoute(parsed);
      setAllRoutes(prev => [parsed, ...prev.filter(r => (r.author?._id || r.author) !== (user?._id || user?.id))]);
      setShowForm(false);
    } catch (e) {
      setError(e.message || 'Failed to post route');
    } finally {
      setPosting(false);
    }
  };

  // Find routes that overlap with the user's route within matchDist km
  const userId = user?._id || user?.id;
  const matchedRoutes = myRoute
    ? allRoutes.filter(r => {
        if ((r.author?._id || r.author) === userId) return false;
        if (!r.fromLat || !r.toLat) return false;
        const fromMatch = haversineKm(myRoute.fromLat, myRoute.fromLng, r.fromLat, r.fromLng) <= matchDist;
        const toMatch   = haversineKm(myRoute.toLat,   myRoute.toLng,   r.toLat,   r.toLng)   <= matchDist;
        return fromMatch || toMatch;
      })
    : [];

  return (
    <div className="narrow-wrap fade-up" style={{paddingBottom:48}}>
      <p className="eyebrow mb-8">Commute Matching</p>
      <h1 className="heading mb-4" style={{fontSize:26}}>What's Your Route?</h1>
      <p className="text-muted mb-20 text-sm">
        Post your daily commute path. Find other students from your college going the same way — share rides, split costs, or just walk together.
      </p>

      {/* My route section */}
      {myRoute ? (
        <div className="card mb-20" style={{padding:20}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
            <h3 style={{color:'#fff',fontSize:15,margin:0}}>Your Current Route</h3>
            <button className="btn btn-secondary btn-sm"
              onClick={() => { setMyRoute(null); setShowForm(true); }}>
              ✏️ Edit
            </button>
          </div>
          <RouteCard
            route={myRoute}
            isMe
            onDelete={() => { setMyRoute(null); setAllRoutes(prev => prev.filter(r => (r.author?._id||r.author) !== userId)); }}
          />
        </div>
      ) : !showForm ? (
        <div className="card mb-20" style={{padding:24,textAlign:'center',border:'2px dashed #333'}}>
          <div style={{fontSize:40,marginBottom:12}}>🗺️</div>
          <h3 style={{color:'#fff',fontSize:16,margin:'0 0 6px'}}>Post your daily route</h3>
          <p style={{color:'#666',fontSize:13,margin:'0 0 16px'}}>
            Tell other campus commuters where you travel from and to. They'll match with you automatically.
          </p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + Post My Route
          </button>
        </div>
      ) : null}

      {/* Post route form */}
      {showForm && (
        <div className="card mb-20" style={{padding:22}}>
          <h3 style={{color:'#fff',fontSize:15,marginBottom:16}}>📍 Your Daily Route</h3>
          {error && <div className="alert alert-error mb-12">{error}</div>}

          <div className="field mb-14">
            <label style={{fontSize:12,color:'#888',display:'block',marginBottom:6}}>🏠 Home / Pickup Location *</label>
            <LocationSearch
              value={form.fromLabel}
              onChange={(label,lat,lng) => setForm(f=>({...f,fromLabel:label,fromLat:lat.toString(),fromLng:lng.toString()}))}
              placeholder="Where do you commute from?"
            />
          </div>

          <div className="field mb-14">
            <label style={{fontSize:12,color:'#888',display:'block',marginBottom:6}}>🏫 College / Destination *</label>
            <LocationSearch
              value={form.toLabel}
              onChange={(label,lat,lng) => setForm(f=>({...f,toLabel:label,toLat:lat.toString(),toLng:lng.toString()}))}
              placeholder="Where do you go every day?"
            />
          </div>

          <div className="field mb-14">
            <label style={{fontSize:12,color:'#888',display:'block',marginBottom:8}}>📅 Travel Days *</label>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {DAYS.map(d => (
                <button key={d} type="button"
                  onClick={() => toggleDay(d)}
                  style={{
                    padding:'6px 12px',borderRadius:8,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,
                    background:form.days.includes(d)?'#f5a623':'#1a1d24',
                    color:form.days.includes(d)?'#000':'#888',
                  }}>{d}</button>
              ))}
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
            <div className="field" style={{marginBottom:0}}>
              <label style={{fontSize:12,color:'#888',display:'block',marginBottom:6}}>🕐 Usual departure time</label>
              <select className="input" value={form.time} onChange={e=>setForm(f=>({...f,time:e.target.value}))}
                style={{background:'#0d0f14',border:'1px solid #2a2d35',color:'#fff',borderRadius:8,padding:'10px 12px'}}>
                <option value="">Select time</option>
                {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="field" style={{marginBottom:0}}>
              <label style={{fontSize:12,color:'#888',display:'block',marginBottom:6}}>🚗 Commute mode</label>
              <select className="input" value={form.mode} onChange={e=>setForm(f=>({...f,mode:e.target.value}))}
                style={{background:'#0d0f14',border:'1px solid #2a2d35',color:'#fff',borderRadius:8,padding:'10px 12px'}}>
                <option value="ride">🚗 Ride (vehicle)</option>
                <option value="walk">🚶 Walk</option>
                <option value="both">🚗🚶 Either</option>
              </select>
            </div>
          </div>

          <div className="field mb-16">
            <label style={{fontSize:12,color:'#888',display:'block',marginBottom:6}}>💬 Short note (optional)</label>
            <input className="input" placeholder="e.g. I leave by 8am from RR Nagar bus stop"
              value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} maxLength={100}/>
          </div>

          <div style={{display:'flex',gap:10}}>
            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn btn-primary btn-full"
              onClick={postRoute} disabled={posting}>
              {posting ? 'Posting…' : '📍 Post My Route'}
            </button>
          </div>
        </div>
      )}

      {/* Route matches */}
      {myRoute && (
        <div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
            <h2 className="heading" style={{fontSize:16}}>
              🎯 Route Matches
              {matchedRoutes.length > 0 && (
                <span style={{marginLeft:8,fontSize:12,color:'#f5a623',fontWeight:700,
                  background:'rgba(245,166,35,0.1)',border:'1px solid rgba(245,166,35,0.3)',
                  borderRadius:99,padding:'2px 10px'}}>
                  {matchedRoutes.length} found
                </span>
              )}
            </h2>
            <div style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:'#888'}}>
              <span>Within</span>
              <select value={matchDist} onChange={e => setMatchDist(Number(e.target.value))}
                style={{background:'#1a1d24',border:'1px solid #333',color:'#f5a623',borderRadius:6,padding:'3px 8px',fontSize:12}}>
                {[1,2,3,5].map(d => <option key={d} value={d}>{d} km</option>)}
              </select>
            </div>
          </div>

          {loading ? (
            <p style={{color:'#666',fontSize:13}}>Looking for commuters on your route…</p>
          ) : matchedRoutes.length === 0 ? (
            <div style={{background:'#111318',border:'1px solid #1f2330',borderRadius:14,padding:24,textAlign:'center'}}>
              <div style={{fontSize:36,marginBottom:10}}>🤷</div>
              <p style={{color:'#666',fontSize:13}}>No one from your college has posted a matching route yet.</p>
              <p style={{color:'#555',fontSize:12,marginTop:4}}>Share this feature with your classmates!</p>
            </div>
          ) : (
            matchedRoutes.map((r, i) => (
              <RouteCard key={r._id || i} route={r} isMe={false} />
            ))
          )}
        </div>
      )}

      {/* All routes from college */}
      {!myRoute && !showForm && (
        <div>
          <h2 className="heading mb-12" style={{fontSize:16}}>All Routes in {user?.college || 'Your College'}</h2>
          {loading ? (
            <p style={{color:'#666',fontSize:13}}>Loading…</p>
          ) : allRoutes.filter(r => (r.author?._id||r.author) !== userId).length === 0 ? (
            <div style={{background:'#111318',border:'1px dashed #333',borderRadius:14,padding:24,textAlign:'center'}}>
              <p style={{color:'#666',fontSize:13}}>No routes posted yet. Be the first!</p>
            </div>
          ) : (
            allRoutes
              .filter(r => (r.author?._id||r.author) !== userId)
              .map((r, i) => <RouteCard key={r._id||i} route={r} isMe={false} />)
          )}
        </div>
      )}
    </div>
  );
}
