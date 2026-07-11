import React, { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import LocationSearch from '../components/LocationSearch.jsx';
import NearbyMap from '../components/NearbyMap.jsx';
import * as api from '../services/api.js';
import RideCard from '../components/RideCard.jsx';
import './SearchRides.css';

export default function SearchRides({ navigate }) {
  const { user } = useAuth();
  const isSeeker = user?.role === 'seeker' || user?.role === 'both';

  if (!isSeeker) return (
    <div className="narrow-wrap fade-up text-center" style={{paddingTop:80}}>
      <div style={{fontSize:64}}>🚫</div>
      <h2 className="heading mt-20" style={{fontSize:28}}>Access Denied</h2>
      <p className="text-muted mt-8">Only seekers can search for rides.</p>
      <button className="btn btn-primary btn-lg mt-32" onClick={() => navigate('dashboard')}>Back to Dashboard</button>
    </div>
  );

  const [filters,  setFilters]  = useState({
    pickupLat: '', pickupLng: '', pickupLabel: '',
    dropLat:   '', dropLng:   '', dropLabel:   '',
    date: '', time: '',
  });
  const [womenOnly, setWomenOnly] = useState(false);
  const isFemale = user?.gender === 'female';
  const [scheduleMode, setScheduleMode] = useState('now'); // 'now' | 'later'
  const [rides,        setRides]        = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [geoLoading,   setGeoLoading]   = useState(false);
  const [searched,     setSearched]     = useState(false);
  const [error,        setError]        = useState('');
  const [bookingMap,   setBookingMap]   = useState({});
  const [noMatchSuggestions, setNoMatchSuggestions] = useState(null);

  const set = k => e => setFilters(f => ({ ...f, [k]: e.target.value }));

  // Detect current location → reverse geocode to real address
  const geoLocate = async (field) => {
    if (!navigator.geolocation) { setError('Geolocation not supported'); return; }
    setGeoLoading(field);
    setError('');
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const addr = await api.reverseGeocode(coords.latitude, coords.longitude);
          const label = addr.label || addr.display_name?.split(',').slice(0,2).join(',').trim() || 'Current Location';
          const isPickup = field === 'pickup';
          setFilters(f => ({
            ...f,
            [isPickup ? 'pickupLabel' : 'dropLabel']: label,
            [isPickup ? 'pickupLat'   : 'dropLat']:   coords.latitude.toString(),
            [isPickup ? 'pickupLng'   : 'dropLng']:   coords.longitude.toString(),
          }));
        } catch {
          setError('Could not get address. Try searching manually.');
        } finally {
          setGeoLoading(false);
        }
      },
      () => { setError('Could not detect location. Enter manually.'); setGeoLoading(false); }
    );
  };

  const doSearch = useCallback(async e => {
    e?.preventDefault();
    setError('');
    setNoMatchSuggestions(null);
    if (!filters.pickupLat || !filters.pickupLng) { setError('Enter or detect your pickup location'); return; }
    setLoading(true);
    try {
      const data = await api.searchRides({
        lat:         filters.pickupLat,
        lng:         filters.pickupLng,
        maxDistance: 50000,
        date: scheduleMode === 'later' && filters.date ? filters.date : undefined,
        womenOnly: womenOnly || undefined,
      });
      setRides(data);
      setSearched(true);
      setBookingMap({});
      if (!data || data.length === 0) {
        try {
          const sugg = await api.noMatchSuggest({ lat: filters.pickupLat, lng: filters.pickupLng });
          setNoMatchSuggestions(sugg);
        } catch {}
      }
    } catch (err) {
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [filters, scheduleMode]);

  const book = async (rideId, seats) => {
    setBookingMap(m => ({
        ...m,
        [rideId]: { loading: true }
    }));

    try {
        await api.requestBooking(rideId, seats);

        setBookingMap(m => ({
            ...m,
            [rideId]: { status: "pending" }
        }));
    } catch (err) {
        setBookingMap(m => ({
            ...m,
            [rideId]: { error: err.message }
        }));
    }
};

  const today = new Date().toISOString().split('T')[0];
  const nowTime = new Date().toTimeString().slice(0,5);

  return (
    <div className="page-wrap fade-up">
      <p className="eyebrow mb-16">Seeker</p>
      <h1 className="heading mb-8" style={{fontSize:30}}>Find a Ride</h1>
      <p className="text-muted mb-24 text-sm">Search rides near your location.</p>

      <form className="search-box card" onSubmit={doSearch}>
        <div className="card-header">
          <span className="card-title">Search Filters</span>
        </div>
        <div className="card-body">
          {error && <div className="alert alert-error mb-16">{error}</div>}

          {/* ── Pickup location ── */}
          <div className="field">
            <label>📍 Pickup / Your Location ✶</label>
            <div className="loc-input-row">
              <LocationSearch
                value={filters.pickupLabel}
                onChange={(label, lat, lng) => setFilters(f => ({
                  ...f, pickupLabel: label,
                  pickupLat: lat.toString(), pickupLng: lng.toString()
                }))}
                placeholder="Search area, college, landmark…"
              />
              <button type="button"
                className={'btn btn-outline btn-sm geo-btn' + (geoLoading === 'pickup' ? ' btn-loading' : '')}
                onClick={() => geoLocate('pickup')}
                title="Detect my location">
                {geoLoading !== 'pickup' && '🎯'}
              </button>
            </div>
          </div>

          {/* ── Drop location ── */}
          <div className="field">
            <label>🏁 Drop Location</label>
            <div className="loc-input-row">
              <LocationSearch
                value={filters.dropLabel}
                onChange={(label, lat, lng) => setFilters(f => ({
                  ...f, dropLabel: label,
                  dropLat: lat.toString(), dropLng: lng.toString()
                }))}
                placeholder="Where do you want to go?"
              />
              <button type="button"
                className={'btn btn-outline btn-sm geo-btn' + (geoLoading === 'drop' ? ' btn-loading' : '')}
                onClick={() => geoLocate('drop')}
                title="Detect drop location">
                {geoLoading !== 'drop' && '🎯'}
              </button>
            </div>
          </div>

          {/* ── Schedule toggle ── */}
          <div className="field">
            <label>When do you need a ride?</label>
            <div className="schedule-toggle">
              <button type="button"
                className={'sched-btn' + (scheduleMode === 'now' ? ' active' : '')}
                onClick={() => setScheduleMode('now')}>
                ⚡ Ride Now
              </button>
              <button type="button"
                className={'sched-btn' + (scheduleMode === 'later' ? ' active' : '')}
                onClick={() => setScheduleMode('later')}>
                🗓 Schedule for Later
              </button>
            </div>
          </div>

          {/* ── Date + Time (only when scheduling later) ── */}
          {scheduleMode === 'later' && (
            <div className="grid-2 mb-4">
              <div className="field" style={{marginBottom:0}}>
                <label>Date ✶</label>
                <input className="input" type="date" min={today}
                  value={filters.date} onChange={set('date')} required />
              </div>
              <div className="field" style={{marginBottom:0}}>
                <label>Time ✶</label>
                <input className="input" type="time" min={filters.date === today ? nowTime : undefined}
                  value={filters.time} onChange={set('time')} required />
              </div>
            </div>
          )}

          {/* Women-only filter — visible only to female accounts */}
          {isFemale && (
            <div className="field mb-12" style={{display:'flex',alignItems:'center',gap:10}}>
              <button type="button"
                onClick={() => setWomenOnly(w => !w)}
                style={{
                  display:'flex', alignItems:'center', gap:8,
                  background: womenOnly ? 'rgba(233,30,140,0.15)' : 'rgba(255,255,255,0.05)',
                  border: `2px solid ${womenOnly ? '#e91e8c' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 10, padding: '8px 14px', cursor:'pointer',
                  color: womenOnly ? '#e91e8c' : '#aaa', fontWeight: 600, fontSize: 13,
                  transition: 'all 0.2s',
                }}>
                <span>{womenOnly ? '🔒' : '♀'}</span>
                Women-only rides
                {womenOnly && <span style={{fontSize:11,background:'#e91e8c',color:'#fff',borderRadius:4,padding:'1px 6px'}}>ON</span>}
              </button>
              {womenOnly && <span style={{fontSize:12,color:'#888'}}>Only showing rides where the provider is female</span>}
            </div>
          )}

          <div className="search-actions">
            <button type="submit"
              className={`btn btn-primary ${loading ? 'btn-loading' : ''}`}
              disabled={loading}>
              {!loading && '🔍 Search Rides'}
            </button>
          </div>
        </div>
      </form>

      {/* ── Nearby Map ── */}
      <NearbyMap
        pickupLat={filters.pickupLat}
        pickupLng={filters.pickupLng}
        dropLat={filters.dropLat}
        dropLng={filters.dropLng}
        userGender={user?.gender}
      />

      {/* ── Results ── */}
      {searched && (
        <div className="mt-32">
          <div className="flex-between mb-16">
            <h2 className="heading" style={{fontSize:18}}>
              {rides.length} ride{rides.length !== 1 ? 's' : ''} found
            </h2>
            {filters.pickupLabel && (
              <span className="text-muted text-sm">near {filters.pickupLabel}</span>
            )}
          </div>

          {rides.length === 0 ? (
            <div>
              <div className="empty-state">
                <div className="empty-icon">🚗</div>
                <div className="empty-title">No rides found nearby</div>
                <div className="empty-sub mt-8">No rides available near this location. Try a different area or check back later.</div>
              </div>
              <div style={{background:'var(--surface2,#1a1a2e)',border:'1px solid var(--border)',borderRadius:12,padding:20,marginTop:20}}>
                <h4 style={{color:'var(--accent)',marginBottom:16,fontSize:15}}>💡 What you can do instead:</h4>
                <div style={{display:'flex',flexDirection:'column',gap:12}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',background:'var(--surface3,#222)',borderRadius:8,gap:12}}>
                    <div>
                      <div style={{color:'var(--text)',fontSize:14,fontWeight:600}}>🔔 Get notified when a ride is posted</div>
                      <div style={{color:'var(--text2)',fontSize:12,marginTop:3}}>Subscribe to route alerts for this area</div>
                    </div>
                    <button className="btn btn-primary btn-sm" style={{flexShrink:0}} onClick={() => navigate('route-alerts')}>Subscribe</button>
                  </div>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',background:'var(--surface3,#222)',borderRadius:8,gap:12}}>
                    <div>
                      <div style={{color:'var(--text)',fontSize:14,fontWeight:600}}>📢 Post a ride request</div>
                      <div style={{color:'var(--text2)',fontSize:12,marginTop:3}}>Let providers see you need a ride on this route</div>
                    </div>
                    <button className="btn btn-outline btn-sm" style={{flexShrink:0}} onClick={() => navigate('route-alerts')}>Post Request</button>
                  </div>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',background:'var(--surface3,#222)',borderRadius:8,gap:12}}>
                    <div>
                      <div style={{color:'var(--text)',fontSize:14,fontWeight:600}}>🔍 Try a different location</div>
                      <div style={{color:'var(--text2)',fontSize:12,marginTop:3}}>Search nearby areas or expand your pickup zone</div>
                    </div>
                    <button className="btn btn-outline btn-sm" style={{flexShrink:0}} onClick={() => window.scrollTo({top:0,behavior:'smooth'})}>Search Again</button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rides-stack">
              {rides.map(ride => {
                const bm = bookingMap[ride._id];
                return (
                  <div key={ride._id}>
                    <RideCard
                      ride={ride}
                      onView={id => navigate('ride-detail', { rideId: id })}
                      onBook={bm?.status ? null : book}
                      bookingStatus={bm?.status}
                    />
                    {bm?.error  && <div className="alert alert-error mt-8">{bm.error}</div>}
                    {bm?.status === 'pending' && (
                      <div className="alert alert-success mt-8">Booking request sent! Waiting for provider to accept.</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
