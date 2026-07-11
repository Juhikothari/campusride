import React, { useState, useEffect, useRef } from 'react';
import * as api from '../services/api.js';

const searchPlaces = async (query) => {
  if (!query || query.length < 3) return [];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=in`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    return data.map(p => ({ label: p.display_name.split(',').slice(0, 3).join(', '), lat: parseFloat(p.lat), lng: parseFloat(p.lon) }));
  } catch { return []; }
};

function PlaceInput({ placeholder, value, onSelect }) {
  const [query, setQuery]     = useState(value || '');
  const [results, setResults] = useState([]);
  const [open, setOpen]       = useState(false);
  const debounce = useRef(null);
  const wrapRef  = useRef(null);

  useEffect(() => { setQuery(value || ''); }, [value]);
  useEffect(() => {
    const close = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const onChange = (e) => {
    const q = e.target.value; setQuery(q);
    clearTimeout(debounce.current);
    if (q.length < 3) { setResults([]); setOpen(false); return; }
    debounce.current = setTimeout(async () => {
      const r = await searchPlaces(q); setResults(r); setOpen(r.length > 0);
    }, 400);
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div className="input-wrap">
        <span className="input-icon">📍</span>
        <input className="input" placeholder={placeholder} value={query} onChange={onChange}
          onFocus={() => results.length > 0 && setOpen(true)} autoComplete="off" />
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999, background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, maxHeight: 200, overflowY: 'auto', boxShadow: '0 8px 24px #0008' }}>
          {results.map((r, i) => (
            <div key={i} onClick={() => { setQuery(r.label); setOpen(false); onSelect(r); }}
              style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: '#ddd', borderBottom: '1px solid #2a2a3e' }}
              onMouseEnter={e => e.currentTarget.style.background = '#2a2a4e'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              📍 {r.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RouteAlerts({ navigate }) {
  const [tab,     setTab]     = useState('my');
  const [alerts,  setAlerts]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');
  const [busy,    setBusy]    = useState(false);

  // Subscribe form
  const [subPickup, setSubPickup] = useState({ label: '', lat: '', lng: '' });
  const [subDrop,   setSubDrop]   = useState({ label: '', lat: '', lng: '' });
  const [subName,   setSubName]   = useState('');

  // Request form
  const [reqPickup, setReqPickup] = useState({ label: '', lat: '', lng: '' });
  const [reqDrop,   setReqDrop]   = useState({ label: '', lat: '', lng: '' });
  const [reqDate,   setReqDate]   = useState('');

  useEffect(() => {
    api.getMyAlerts()
      .then(d => setAlerts(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSubscribe = async (e) => {
    e.preventDefault(); setError(''); setSuccess('');
    if (!subPickup.lat || !subDrop.lat) { setError('Please select both pickup and drop locations'); return; }
    setBusy(true);
    try {
      const res = await api.createAlert({
        name:   subName || `${subPickup.label.split(',')[0]} → ${subDrop.label.split(',')[0]}`,
        pickup: { coordinates: [parseFloat(subPickup.lng), parseFloat(subPickup.lat)] },
        drop:   { coordinates: [parseFloat(subDrop.lng),   parseFloat(subDrop.lat)] },
        pickupRadius: 5000, dropRadius: 5000,
      });
      setAlerts(a => [res.alert, ...a]);
      setSuccess('Alert created! You will be notified when rides match your route.');
      setSubPickup({ label: '', lat: '', lng: '' });
      setSubDrop({ label: '', lat: '', lng: '' });
      setSubName('');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const handleRequest = async (e) => {
    e.preventDefault(); setError(''); setSuccess('');
    if (!reqPickup.lat || !reqDrop.lat) { setError('Please select both pickup and drop locations'); return; }
    setBusy(true);
    try {
      await api.createAlert({
        name:   `Ride Request: ${reqPickup.label.split(',')[0]} → ${reqDrop.label.split(',')[0]}`,
        pickup: { coordinates: [parseFloat(reqPickup.lng), parseFloat(reqPickup.lat)] },
        drop:   { coordinates: [parseFloat(reqDrop.lng),   parseFloat(reqDrop.lat)] },
        date: reqDate || undefined,
        pickupRadius: 5000, dropRadius: 5000,
      });
      setSuccess('Ride request posted! Providers near your route will be notified.');
      setReqPickup({ label: '', lat: '', lng: '' });
      setReqDrop({ label: '', lat: '', lng: '' });
      setReqDate('');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const deleteAlert = async (id) => {
    try { await api.deleteAlert(id); setAlerts(a => a.filter(x => x._id !== id)); }
    catch (err) { setError(err.message); }
  };

  return (
    <div className="narrow-wrap fade-up">
      <h1 className="heading mb-4" style={{ fontSize: 28 }}>Route Alerts</h1>
      <p className="text-muted mb-24 text-sm">Get notified when rides match your route, or post a ride request.</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[{ k: 'my', l: '🔔 My Alerts' }, { k: 'sub', l: '➕ Subscribe' }, { k: 'req', l: '📢 Post Request' }].map(t => (
          <button key={t.k} onClick={() => { setTab(t.k); setError(''); setSuccess(''); }}
            style={{ padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, background: tab === t.k ? '#6c63ff' : '#1a1a2e', color: tab === t.k ? '#fff' : '#aaa', border: '1px solid ' + (tab === t.k ? '#6c63ff' : '#333') }}>
            {t.l}
          </button>
        ))}
      </div>

      {error   && <div className="alert alert-error mb-16">{error}</div>}
      {success && <div className="alert alert-success mb-16">{success}</div>}

      {/* My Alerts tab */}
      {tab === 'my' && (
        <div>
          {loading ? <p className="text-muted">Loading...</p> : alerts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔔</div>
              <div className="empty-title">No alerts yet</div>
              <div className="empty-sub mt-8">Subscribe to get notified when rides match your route.</div>
              <button className="btn btn-primary mt-24" onClick={() => setTab('sub')}>Create Alert →</button>
            </div>
          ) : (
            <div>
              {alerts.map(a => (
                <div key={a._id} style={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 12, padding: 16, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ color: '#fff', fontWeight: 600, marginBottom: 4 }}>{a.name || 'Route Alert'}</div>
                    <div style={{ color: '#888', fontSize: 12 }}>Pickup radius: {(a.pickupRadius / 1000).toFixed(1)} km · Drop radius: {(a.dropRadius / 1000).toFixed(1)} km</div>
                    {a.matchCount > 0 && <div style={{ color: '#2dd4a0', fontSize: 12, marginTop: 4 }}>✓ {a.matchCount} match{a.matchCount > 1 ? 'es' : ''} found</div>}
                  </div>
                  <button onClick={() => deleteAlert(a._id)}
                    style={{ padding: '6px 12px', borderRadius: 6, background: '#3a1a1a', color: '#f87272', border: '1px solid #5a2a2a', cursor: 'pointer', fontSize: 12 }}>
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Subscribe tab */}
      {tab === 'sub' && (
        <div style={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 12, padding: 20 }}>
          <h3 style={{ color: '#fff', marginBottom: 4, fontSize: 16 }}>Create Route Alert</h3>
          <p style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>We'll notify you when rides are posted on this route.</p>
          <form onSubmit={handleSubscribe}>
            <div className="field">
              <label>Alert Name (optional)</label>
              <input className="input" placeholder="e.g. Home to College" value={subName} onChange={e => setSubName(e.target.value)} />
            </div>
            <div className="field">
              <label>Pickup Location ✶</label>
              <PlaceInput placeholder="Type pickup area..." value={subPickup.label}
                onSelect={p => setSubPickup({ label: p.label, lat: p.lat, lng: p.lng })} />
              {subPickup.lat && <p style={{ fontSize: 11, color: '#2dd4a0', marginTop: 4 }}>✓ {subPickup.label}</p>}
            </div>
            <div className="field">
              <label>Drop Location ✶</label>
              <PlaceInput placeholder="Type drop area..." value={subDrop.label}
                onSelect={p => setSubDrop({ label: p.label, lat: p.lat, lng: p.lng })} />
              {subDrop.lat && <p style={{ fontSize: 11, color: '#2dd4a0', marginTop: 4 }}>✓ {subDrop.label}</p>}
            </div>
            <button type="submit" className="btn btn-primary btn-full" disabled={busy}>
              {busy ? 'Creating...' : '🔔 Create Alert'}
            </button>
          </form>
        </div>
      )}

      {/* Post Request tab */}
      {tab === 'req' && (
        <div style={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 12, padding: 20 }}>
          <h3 style={{ color: '#fff', marginBottom: 4, fontSize: 16 }}>Post a Ride Request</h3>
          <p style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>No rides found? Let providers know your route.</p>
          <form onSubmit={handleRequest}>
            <div className="field">
              <label>Pickup Location ✶</label>
              <PlaceInput placeholder="Type pickup area..." value={reqPickup.label}
                onSelect={p => setReqPickup({ label: p.label, lat: p.lat, lng: p.lng })} />
              {reqPickup.lat && <p style={{ fontSize: 11, color: '#2dd4a0', marginTop: 4 }}>✓ {reqPickup.label}</p>}
            </div>
            <div className="field">
              <label>Drop Location ✶</label>
              <PlaceInput placeholder="Type drop area..." value={reqDrop.label}
                onSelect={p => setReqDrop({ label: p.label, lat: p.lat, lng: p.lng })} />
              {reqDrop.lat && <p style={{ fontSize: 11, color: '#2dd4a0', marginTop: 4 }}>✓ {reqDrop.label}</p>}
            </div>
            <div className="field">
              <label>Preferred Date (optional)</label>
              <input className="input" type="date" min={new Date().toISOString().split('T')[0]}
                value={reqDate} onChange={e => setReqDate(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary btn-full" disabled={busy}>
              {busy ? 'Posting...' : '📢 Post Ride Request'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
