import React, { useState, useEffect } from 'react';

// FIXED: Import API_BASE and all API functions from api.js (single source of truth)
import { 
  API_BASE, 
  getToken, 
  getUser,
  getMyBookings, 
  getRide,
  getRideRatings,
} from '../services/api.js';

/* ─── Inline styles (drop your RatingsPage.css import if you use this) ─── */
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap');

  .rp-wrap {
    max-width: 720px;
    margin: 0 auto;
    padding: 48px 24px 100px;
    font-family: 'Sora', sans-serif;
    color: var(--text, #1a1a2e);
  }

  /* ── Header ── */
  .rp-eyebrow {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #f59e0b;
    margin-bottom: 10px;
  }
  .rp-title {
    font-family: 'Instrument Serif', serif;
    font-size: 38px;
    font-weight: 400;
    line-height: 1.15;
    color: rgba(255,255,255,0.92);
    margin: 0 0 8px;
  }
  .rp-sub {
    font-size: 14px;
    color: rgba(255,255,255,0.4);
    margin-bottom: 40px;
  }

  /* ── Summary card ── */
  .rp-summary {
    display: flex;
    gap: 36px;
    align-items: center;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 24px;
    padding: 32px 36px;
    margin-bottom: 36px;
  }
  .rp-avg-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 110px;
  }
  .rp-big-num {
    font-family: 'Instrument Serif', serif;
    font-size: 64px;
    font-weight: 400;
    color: #f59e0b;
    line-height: 1;
    margin-bottom: 8px;
  }
  .rp-review-count {
    font-size: 12px;
    color: rgba(255,255,255,0.35);
    margin-top: 8px;
  }
  .rp-dist {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 9px;
  }
  .rp-dist-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .rp-dist-label {
    font-size: 12px;
    color: rgba(255,255,255,0.35);
    width: 38px;
    text-align: right;
    flex-shrink: 0;
  }
  .rp-dist-bar {
    flex: 1;
    height: 6px;
    background: rgba(255,255,255,0.07);
    border-radius: 100px;
    overflow: hidden;
  }
  .rp-dist-fill {
    height: 100%;
    background: linear-gradient(90deg, #f59e0b, #fbbf24);
    border-radius: 100px;
    transition: width 0.6s cubic-bezier(0.34,1.56,0.64,1);
  }
  .rp-dist-count {
    font-size: 12px;
    color: rgba(255,255,255,0.3);
    width: 18px;
  }

  /* ── Stars ── */
  .rp-stars {
    display: flex;
    align-items: center;
    gap: 3px;
  }
  .rp-star {
    line-height: 1;
    transition: transform 0.12s;
    color: #d4d4d8;
  }
  .rp-star.filled { color: #f59e0b; }
  .rp-star.clickable { cursor: pointer; }
  .rp-star.clickable:hover { transform: scale(1.2); }

  /* ── Alert ── */
  .rp-alert {
    display: flex;
    align-items: center;
    gap: 10px;
    background: #f0fdf4;
    border: 1.5px solid #86efac;
    color: #166534;
    border-radius: 14px;
    padding: 14px 18px;
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 28px;
  }
  .rp-alert-error {
    background: #fef2f2;
    border-color: #fca5a5;
    color: #991b1b;
  }

  /* ── Write review button ── */
  .rp-btn-write {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--accent, #7c3aed);
    color: #fff;
    border: none;
    border-radius: 14px;
    padding: 14px 26px;
    font-family: 'Sora', sans-serif;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    margin-bottom: 36px;
    transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
    box-shadow: 0 4px 16px rgba(124,58,237,0.25);
  }
  .rp-btn-write:hover {
    background: #6d28d9;
    transform: translateY(-1px);
    box-shadow: 0 8px 24px rgba(124,58,237,0.3);
  }

  /* ── Form ── */
  .rp-form {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 20px;
    padding: 32px;
    margin-bottom: 36px;
    animation: rp-slide-in 0.25s ease;
  }
  @keyframes rp-slide-in {
    from { opacity: 0; transform: translateY(-10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .rp-form-title {
    font-family: 'Instrument Serif', serif;
    font-size: 22px;
    margin: 0 0 24px;
  }
  .rp-field { margin-bottom: 18px; }
  .rp-label {
    display: block;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.4);
    margin-bottom: 8px;
  }
  .rp-input {
    width: 100%;
    box-sizing: border-box;
    padding: 12px 16px;
    border: 1.5px solid var(--border, #3a3a4a);
    border-radius: 12px;
    font-family: 'Sora', sans-serif;
    font-size: 14px;
    color: inherit;
    background: transparent;
    transition: border-color 0.2s, box-shadow 0.2s;
    outline: none;
  }
  .rp-input:focus {
    border-color: var(--accent, #f59e0b);
    box-shadow: 0 0 0 3px rgba(245,158,11,0.15);
    background: rgba(255,255,255,0.04);
  }
  .rp-input::placeholder { color: rgba(255,255,255,0.25); }
  .rp-textarea { resize: vertical; min-height: 90px; }
  .rp-form-actions {
    display: flex;
    gap: 12px;
    margin-top: 20px;
  }
  .rp-btn-cancel {
    padding: 12px 22px;
    border: 1.5px solid var(--border, #e2e8f0);
    border-radius: 12px;
    background: transparent;
    font-family: 'Sora', sans-serif;
    font-size: 14px;
    font-weight: 500;
    color: var(--text2, #64748b);
    cursor: pointer;
    transition: background 0.15s;
  }
  .rp-btn-cancel:hover { background: var(--bg2, #f1f5f9); }
  .rp-btn-submit {
    flex: 1;
    padding: 12px 22px;
    border: none;
    border-radius: 12px;
    background: var(--accent, #7c3aed);
    color: #fff;
    font-family: 'Sora', sans-serif;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s, opacity 0.15s;
  }
  .rp-btn-submit:disabled { opacity: 0.45; cursor: not-allowed; }
  .rp-btn-submit:not(:disabled):hover { background: #6d28d9; }
  .rp-btn-submit.loading { opacity: 0.7; pointer-events: none; }

  /* ── List ── */
  .rp-section-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.3);
    margin-bottom: 16px;
  }
  .rp-list { display: flex; flex-direction: column; gap: 12px; }
  .rp-card {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 16px;
    padding: 20px 22px;
    transition: box-shadow 0.2s, transform 0.15s, border-color 0.2s;
    animation: rp-fade-up 0.35s ease both;
    position: relative;
    overflow: hidden;
  }
  .rp-card::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 3px;
    background: linear-gradient(180deg, #f59e0b, rgba(245,158,11,0.2));
    border-radius: 16px 0 0 16px;
    opacity: 0;
    transition: opacity 0.2s;
  }
  .rp-card:hover {
    border-color: rgba(245,158,11,0.2);
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    transform: translateY(-1px);
  }
  .rp-card:hover::before { opacity: 1; }
  @keyframes rp-fade-up {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .rp-card-new {
    border-color: rgba(245,158,11,0.3) !important;
    background: rgba(245,158,11,0.04) !important;
  }
  .rp-card-new::before { opacity: 1 !important; }

  /* Card header */
  .rp-card-header { display: flex; align-items: center; gap: 14px; }
  .rp-avatar {
    width: 42px; height: 42px;
    border-radius: 50%;
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: #1a1200;
    display: flex; align-items: center; justify-content: center;
    font-size: 15px; font-weight: 800;
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(245,158,11,0.3);
  }
  .rp-card-meta { flex: 1; min-width: 0; }
  .rp-card-name {
    font-size: 14px; font-weight: 700;
    color: rgba(255,255,255,0.92);
    margin-bottom: 3px;
    display: flex; align-items: center; gap: 8px;
  }
  .rp-card-route {
    font-size: 11px;
    color: rgba(255,255,255,0.35);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .rp-card-right {
    display: flex; flex-direction: column; align-items: flex-end;
    gap: 5px; flex-shrink: 0;
  }
  .rp-card-date { font-size: 11px; color: rgba(255,255,255,0.3); }

  /* Comment */
  .rp-comment {
    font-size: 14px;
    color: rgba(255,255,255,0.65);
    line-height: 1.65;
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid rgba(255,255,255,0.06);
  }

  .rp-empty { text-align: center; padding: 60px 20px; color: rgba(255,255,255,0.3); }
  .rp-empty-icon { font-size: 40px; margin-bottom: 12px; opacity: 0.5; }
  .rp-loading { text-align: center; padding: 60px 20px; color: rgba(255,255,255,0.3); font-size: 14px; }

  /* New badge */
  .rp-new-badge {
    display: inline-flex; align-items: center; gap: 3px;
    font-size: 9px; font-weight: 700; letter-spacing: 0.1em;
    text-transform: uppercase; color: #f59e0b;
    background: rgba(245,158,11,0.12);
    border: 1px solid rgba(245,158,11,0.25);
    border-radius: 5px; padding: 2px 7px;
  }

  /* ── Ride picker ── */
  .rp-ride-list { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
  .rp-ride-option {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 16px;
    border: 1.5px solid var(--border, #3a3a4a);
    border-radius: 12px;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }
  .rp-ride-option:hover { border-color: rgba(245,158,11,0.5); background: rgba(245,158,11,0.05); }
  .rp-ride-selected { border-color: #f59e0b !important; background: rgba(245,158,11,0.08) !important; }
  .rp-ride-check {
    width: 20px; height: 20px; border-radius: 50%;
    border: 1.5px solid var(--border, #3a3a4a);
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700; color: #f59e0b; flex-shrink: 0;
    transition: border-color 0.15s;
  }
  .rp-ride-selected .rp-ride-check { border-color: #f59e0b; background: rgba(245,158,11,0.15); }
  .rp-ride-name { font-size: 14px; font-weight: 600; margin-bottom: 2px; }
  .rp-ride-route { font-size: 12px; color: rgba(255,255,255,0.45); }

  @media (max-width: 600px) {
    .rp-summary { flex-direction: column; align-items: flex-start; gap: 24px; }
    .rp-big-num { font-size: 52px; }
    .rp-title { font-size: 30px; }
  }
`;

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function Stars({ value, onChange, size = 20 }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="rp-stars">
      {[1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          className={`rp-star${i <= (hover || value) ? ' filled' : ''}${onChange ? ' clickable' : ''}`}
          style={{ fontSize: size }}
          onMouseEnter={() => onChange && setHover(i)}
          onMouseLeave={() => onChange && setHover(0)}
          onClick={() => onChange && onChange(i)}
        >
          {i <= (hover || value) ? '★' : '☆'}
        </span>
      ))}
    </div>
  );
}

function Avatar({ name }) {
  return (
    <div className="rp-avatar">
      {(name || '?').trim().charAt(0).toUpperCase()}
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ─── Main Component ──────────────────────────────────────────────────────── */
export default function RatingsPage({ userId: userIdProp, preselectedRideId, bookingId: bookingIdProp, viewRideId }) {

  const [ratings, setRatings]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [fetchError, setFetchError] = useState('');

  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState({ rideNote: '', rating: 0, comment: '' });

  const [selectedRide, setSelectedRide] = useState(null);
  const [pastRides, setPastRides]       = useState([]);
  const [ridesLoading, setRidesLoading] = useState(false);
  const [ridesError, setRidesError]     = useState('');

  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [newlyAdded, setNewlyAdded]   = useState(null);
  const [alreadyRated, setAlreadyRated] = useState(false);
  const [checkingRating, setCheckingRating] = useState(false);

  const currentUser = getUser();
  const currentUserId = String(
    currentUser?._id || currentUser?.id || currentUser?.userId || ''
  );

  const reviewedUserId = userIdProp || selectedRide?.providerId;
  const targetUserId   = userIdProp;

  /* ── Fetch this profile's ratings ── */
  useEffect(() => {
    if (viewRideId) {
      // Fetch ratings for a specific ride
      fetchRideRatings(viewRideId);
    } else if (targetUserId) {
      fetchRatings();
    } else {
      setLoading(false);
    }
  }, [targetUserId, viewRideId]);

  /* ── Auto-open form with pre-selected ride when coming from notification ── */
  useEffect(() => {
    if (preselectedRideId) {
      setShowForm(true);
      setSubmitError('');
      loadPastRides(preselectedRideId);
    }
  }, [preselectedRideId]);

  useEffect(() => {
    checkAlreadyRatedForRide();
  }, [selectedRide?.rideId]);

  async function fetchRatings() {
    setLoading(true);
    setFetchError('');
    try {
      const token = getToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_BASE}/api/ratings/${targetUserId}`, { headers });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      setRatings(await res.json());
    } catch (err) {
      setFetchError('Could not load ratings. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function fetchRideRatings(rideId) {
    setLoading(true);
    setFetchError('');
    try {
      const data = await getRideRatings(rideId);
      setRatings(Array.isArray(data) ? data : []);
    } catch (err) {
      setFetchError('Could not load ratings for this ride.');
    } finally {
      setLoading(false);
    }
  }

  async function checkAlreadyRatedForRide() {
    if (!selectedRide?.rideId || !currentUserId) {
      setAlreadyRated(false);
      return;
    }
    setCheckingRating(true);
    try {
      const rideRatings = await getRideRatings(selectedRide.rideId);
      const hasReviewed = (Array.isArray(rideRatings) ? rideRatings : []).some(r => {
        const reviewerId = String(r?.reviewer?._id || r?.reviewer?.id || r?.reviewer || '');
        return reviewerId && reviewerId === currentUserId;
      });
      setAlreadyRated(hasReviewed);
      if (hasReviewed) {
        setSubmitError('You have already rated this ride');
      } else if (submitError === 'You have already rated this ride') {
        setSubmitError('');
      }
    } catch (_) {
      setAlreadyRated(false);
    } finally {
      setCheckingRating(false);
    }
  }

  /* ── Fetch past completed rides when form opens ── */
  async function loadPastRides(targetRideId = null) {
    if (userIdProp || (pastRides.length > 0 && !targetRideId)) return;
    setRidesLoading(true);
    setRidesError('');
    try {
      const data = await getMyBookings();
      const list = Array.isArray(data) ? data : (data.bookings || data.data || []);
      
      const filtered = list.filter(b => b.status !== 'cancelled');

      const enriched = await Promise.all(filtered.map(async (booking) => {
        const ride = booking.rideId;
        if (!ride) return booking;

        const provider = ride.providerId;
        const alreadyHasName = provider && typeof provider === 'object' && provider.name;
        if (alreadyHasName) return booking;

        const rideId = typeof ride === 'object' ? (ride._id || ride.id) : ride;
        if (!rideId) return booking;

        try {
          const rideData = await getRide(rideId);
          const fullRide = rideData.ride || rideData;
          return { ...booking, rideId: fullRide };
        } catch (_) {}
        return booking;
      }));

      setPastRides(enriched);

      // Auto-select if targetRideId was passed (from notification)
      if (targetRideId) {
        const match = enriched.find(b => {
          const ride = b.rideId;
          const rid = typeof ride === 'object' ? (ride._id?.toString() || ride.id?.toString()) : ride?.toString();
          return rid === targetRideId.toString() || b._id?.toString() === bookingIdProp?.toString();
        });
        if (match) {
          const ride     = match.rideId;
          const provider = ride?.providerId;
          let provId   = '';
          let provName = 'Unknown Provider';
          if (provider && typeof provider === 'object') {
            if (provider.name) provName = provider.name;
            const rawId = provider._id || provider.id || provider;
            provId = rawId?.toString ? rawId.toString() : String(rawId);
          } else if (provider) {
            provId = provider.toString ? provider.toString() : String(provider);
          }
          const routeLabel = [ride?.pickup?.address, ride?.drop?.address].filter(Boolean).join(' → ')
            || [ride?.pickup?.label, ride?.drop?.label].filter(Boolean).join(' → ')
            || 'Completed Ride';
          setSelectedRide({
            bookingId: match._id,
            rideId: typeof ride === 'object' ? (ride._id || ride.id) : ride,
            providerId: provId,
            providerName: provName,
            routeLabel,
          });
        }
      }

      if (enriched.length === 0) {
        setRidesError('No past rides found. Complete a booking first to leave a review.');
      }
    } catch (err) {
      setRidesError('Could not load your past rides. Please try again.');
    } finally {
      setRidesLoading(false);
    }
  }

  /* ── Submit ── */
  async function handleSubmit() {
    if (!form.rating || !reviewedUserId || !selectedRide?.rideId) return;

    const token = getToken();
    const payload = {
      rideId:       selectedRide?.rideId,
      reviewedUser: reviewedUserId,
      rating:       form.rating,
      comment:      [
        selectedRide?.routeLabel ? `Route: ${selectedRide.routeLabel}` : '',
        form.comment,
      ].filter(Boolean).join(' — ') || undefined,
    };

    if (!token) { setSubmitError('You must be logged in to submit a review.'); return; }

    setSubmitting(true);
    setSubmitError('');

    const optimistic = {
      _id:        `optimistic-${Date.now()}`,
      reviewer:   { name: selectedRide?.providerName || 'You' },
      rating:     form.rating,
      comment:    payload.comment,
      routeLabel: selectedRide?.routeLabel,
      createdAt:  new Date().toISOString(),
      _optimistic: true,
    };
    setRatings(prev => [optimistic, ...prev]);
    setNewlyAdded(optimistic._id);

    try {
      const res = await fetch(`${API_BASE}/api/ratings/add`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify(payload),
      });

      if (!res.ok) {
        let msg = 'Submission failed';
        try { const e = await res.json(); msg = e.message || e.error || msg; } catch (_) {}
        throw new Error(msg);
      }

      if (targetUserId) await fetchRatings();
      setShowForm(false);
      setForm({ rideNote: '', rating: 0, comment: '' });
      setSelectedRide(null);
    } catch (err) {
      setSubmitError(err.message);
      if ((err.message || '').toLowerCase().includes('already rated')) {
        setAlreadyRated(true);
      }
      setRatings(prev => prev.filter(r => r._id !== optimistic._id));
      setNewlyAdded(null);
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Derived stats ── */
  const avg = ratings.length
    ? (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(1)
    : '—';
  const dist = [5, 4, 3, 2, 1].map(n => ({
    n,
    count: ratings.filter(r => r.rating === n).length,
  }));

  /* ── Render ── */
  return (
    <>
      <style>{css}</style>
      <div className="rp-wrap">

        {/* Header — changes based on context */}
        <p className="rp-eyebrow">Community Trust</p>
        <h1 className="rp-title">
          {viewRideId ? 'Ride Ratings' : 'Ratings & Reviews'}
        </h1>
        <p className="rp-sub">
          {viewRideId
            ? 'Passenger feedback for this specific ride'
            : 'Verified feedback from co-passengers on shared rides'}
        </p>

        {/* Summary */}
        <div className="rp-summary">
          <div className="rp-avg-block">
            <div className="rp-big-num">{avg}</div>
            <Stars value={Math.round(Number(avg)) || 0} size={22} />
            <div className="rp-review-count">{ratings.length} review{ratings.length !== 1 ? 's' : ''}</div>
          </div>
          <div className="rp-dist">
            {dist.map(d => (
              <div key={d.n} className="rp-dist-row">
                <span className="rp-dist-label">{d.n} ★</span>
                <div className="rp-dist-bar">
                  <div
                    className="rp-dist-fill"
                    style={{ width: ratings.length ? (d.count / ratings.length * 100) + '%' : '0%' }}
                  />
                </div>
                <span className="rp-dist-count">{d.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Errors */}
        {fetchError && (
          <div className="rp-alert rp-alert-error" style={{ marginBottom: 24 }}>
            ⚠ {fetchError}
          </div>
        )}

        {/* Write a Review — hidden when viewing ride-specific ratings */}
        {!viewRideId && !showForm && (
          <button className="rp-btn-write" onClick={() => { setShowForm(true); setSubmitError(''); loadPastRides(); }}>
            ✦ Write a Review
          </button>
        )}

        {/* Review form — hidden when in ride-ratings view mode */}
        {!viewRideId && showForm && (
          <div className="rp-form">
            <div className="rp-form-title">Share your experience</div>

            {/* Ride picker — HIDDEN when coming from Rate Now (preselectedRideId set) */}
            {!userIdProp && (
              <div className="rp-field">

                {/* If ride is pre-confirmed from notification — show compact confirmed card, no list */}
                {preselectedRideId && selectedRide ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    background: 'rgba(245,158,11,0.06)',
                    border: '1.5px solid rgba(245,158,11,0.35)',
                    borderRadius: 14, padding: '14px 18px', marginBottom: 4,
                  }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%',
                      background: 'linear-gradient(135deg,#f59e0b,#d97706)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, flexShrink: 0,
                    }}>🚗</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: 14 }}>
                        {selectedRide.providerName}
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 2 }}>
                        {selectedRide.routeLabel}
                      </div>
                    </div>
                    <div style={{
                      fontSize: 11, color: '#f59e0b', fontWeight: 700,
                      background: 'rgba(245,158,11,0.12)', borderRadius: 6,
                      padding: '3px 8px',
                    }}>✓ Selected</div>
                  </div>
                ) : (
                  /* Normal ride picker list — shown when opening from Write a Review */
                  <>
                    <label className="rp-label">Select a past ride <span style={{ color: '#ef4444' }}>*</span></label>
                    {ridesLoading && (
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', padding: '10px 0' }}>Loading your rides…</div>
                    )}
                    {ridesError && !ridesLoading && (
                      <div className="rp-alert rp-alert-error" style={{ marginBottom: 8 }}>⚠ {ridesError}</div>
                    )}
                    {!ridesLoading && pastRides.length > 0 && (
                      <div className="rp-ride-list">
                        {pastRides.map((booking, i) => {
                          const ride     = booking.rideId || booking;
                          const provider = ride.providerId;

                          let provId   = '';
                          let provName = 'Unknown Provider';

                          if (provider && typeof provider === 'object') {
                            if (provider.name) provName = provider.name;
                            const rawId = provider._id || provider.id || provider;
                            provId = rawId?.toString ? rawId.toString() : String(rawId);
                          } else if (provider) {
                            provId = provider.toString ? provider.toString() : String(provider);
                          }

                          if (provName === 'Unknown Provider' && booking.providerName) provName = booking.providerName;
                          if (!provId && booking.providerId) provId = String(booking.providerId);

                          const rideDate   = ride.date || booking.date;
                          const dateStr    = rideDate
                            ? new Date(rideDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                            : '';
                          const routeLabel = [ride.pickup?.address, ride.drop?.address].filter(Boolean).join(' → ')
                            || `Ride on ${dateStr}`;
                          const isSelected = selectedRide?.bookingId === (booking._id || i);

                          return (
                            <div key={booking._id || i}
                              className={`rp-ride-option${isSelected ? ' rp-ride-selected' : ''}`}
                              onClick={() => {
                                setSelectedRide({
                                  bookingId:    booking._id || i,
                                  rideId:       typeof ride === 'object' ? (ride._id || ride.id) : ride,
                                  providerId:   provId,
                                  providerName: provName,
                                  routeLabel,
                                });
                              }}>
                              <div className="rp-ride-check">{isSelected ? '✓' : ''}</div>
                              <div>
                                <div className="rp-ride-name">{provName}</div>
                                <div className="rp-ride-route">{routeLabel}{dateStr ? ` · ${dateStr}` : ''}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="rp-field">
              <label className="rp-label">Your Rating <span style={{ color: '#ef4444' }}>*</span></label>
              <Stars value={form.rating} onChange={v => setForm(f => ({ ...f, rating: v }))} size={34} />
            </div>

            <div className="rp-field">
              <label className="rp-label">Comment (optional)</label>
              <textarea
                className="rp-input rp-textarea"
                placeholder="How was your ride?"
                value={form.comment}
                onChange={e => setForm(f => ({ ...f, comment: e.target.value }))}
              />
            </div>

            {submitError && (
              <div className="rp-alert rp-alert-error" style={{ marginBottom: 16 }}>
                ⚠ {submitError}
              </div>
            )}

            <div className="rp-form-actions">
              <button className="rp-btn-cancel" onClick={() => { setShowForm(false); setSubmitError(''); setSelectedRide(null); }}>
                Cancel
              </button>
              {!alreadyRated && !checkingRating && (
                <button
                  className={`rp-btn-submit${submitting ? ' loading' : ''}`}
                  disabled={!form.rating || submitting || !reviewedUserId || !selectedRide?.rideId}
                  onClick={handleSubmit}
                >
                  {submitting ? 'Submitting…' : 'Submit Review'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* List */}
        <div className="rp-section-title">
          {ratings.length > 0 ? `All reviews (${ratings.length})` : 'Reviews'}
        </div>

        {loading ? (
          <div className="rp-loading">Loading reviews…</div>
        ) : ratings.length === 0 ? (
          <div className="rp-empty">
            <div className="rp-empty-icon">✦</div>
            <div>
              {viewRideId
                ? 'No reviews for this ride yet. Passengers haven\'t submitted feedback.'
                : 'No reviews yet. Be the first to share your experience!'}
            </div>
          </div>
        ) : (
          <div className="rp-list">
            {ratings.map((r, i) => {
              const name = r.reviewer?.name || r.reviewer || 'Anonymous';
              const isNew = r._id === newlyAdded;

              let routeLabel = '';
              let commentText = r.comment || '';
              if (commentText.startsWith('Route:')) {
                const parts = commentText.split(' — ');
                routeLabel = parts[0].replace('Route: ', '').trim();
                commentText = parts.slice(1).join(' — ').trim();
              }

              return (
                <div
                  key={r._id}
                  className={`rp-card${isNew ? ' rp-card-new' : ''}`}
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <div className="rp-card-header">
                    <Avatar name={name} />
                    <div className="rp-card-meta">
                      <div className="rp-card-name">
                        {name}
                        {isNew && <span className="rp-new-badge">✦ New</span>}
                      </div>
                      {routeLabel && (
                        <div className="rp-card-route">📍 {routeLabel}</div>
                      )}
                    </div>
                    <div className="rp-card-right">
                      <Stars value={r.rating} size={14} />
                      <div className="rp-card-date">{formatDate(r.createdAt)}</div>
                    </div>
                  </div>
                  {commentText && <p className="rp-comment">{commentText}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}