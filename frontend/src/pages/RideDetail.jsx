import React, { useState, useEffect } from 'react';
import * as api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import PreRideChecklist from './PreRideChecklist.jsx';
import './RideDetail.css';

function useLocationName(locationField) {
  const [name, setName] = useState('');
  useEffect(() => {
    if (!locationField) return;
    if (locationField.address?.trim()) {
      setName(locationField.address.trim());
      return;
    }
    if (locationField.coordinates?.length === 2) {
      setName('Loading…');
      const [lng, lat] = locationField.coordinates;
      api.reverseGeocode(lat, lng)
        .then(r => setName(r.label || r.display_name || '…'))
        .catch(() => setName(`${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`));
    }
  }, [locationField]);
  return name;
}

export default function RideDetail({ navigate, rideId }) {
  const { user } = useAuth();
  const [ride,          setRide]         = useState(null);
  const [loading,       setLoading]      = useState(true);
  const [error,         setError]        = useState('');
  const [booking,       setBooking]      = useState({ loading:false, status:null, error:'' });
  const [selectedSeats, setSelectedSeats] = useState(1);
  const [showChecklist, setShowChecklist] = useState(false);
  const [checklistDone, setChecklistDone] = useState(false);
  const [popup,         setPopup]         = useState(null);
  const [acceptedBookings, setAcceptedBookings] = useState([]);

  const pickupName = useLocationName(ride?.pickup);
  const dropName   = useLocationName(ride?.drop);

  useEffect(() => {
    if (!rideId) { setError('No ride ID'); setLoading(false); return; }
    api.getRide(rideId)
      .then(data => setRide(data?.ride || data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [rideId]);

  // Load existing booking status for seeker (so checklist shows even on page refresh)
  useEffect(() => {
    if (!rideId || !user) return;
    const role = user?.role;
    if (role !== 'seeker' && role !== 'both') return;
    api.getMyBookings()
      .then(bookings => {
        const match = (bookings || []).find(b => {
          const bRideId = b.rideId?._id || b.rideId;
          return String(bRideId) === String(rideId);
        });
        if (match) setBooking(prev => ({ ...prev, status: match.status }));
      })
      .catch(() => {});
  }, [rideId, user]);

  // Socket: popup alerts for booking accepted/rejected
  useEffect(() => {
    const userId = user?._id || user?.id;
    if (!userId || !rideId) return;
    let socket;
    try {
      const socketUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
      socket = window.io ? window.io(socketUrl, { transports:['websocket','polling'] }) : null;
      if (!socket) return;
      socket.emit('authenticate', { userId, userType: user?.role });
      socket.on('booking-response', (data) => {
        const st = data?.booking?.status || data?.status;
        if (st === 'accepted') {
          setBooking(b => ({ ...b, status: 'accepted' }));
          setPopup({ type:'success', message:'🎉 Your booking has been accepted! Complete the safety checklist.' });
        } else if (st === 'rejected') {
          setPopup({ type:'error', message:'❌ Your booking was declined by the provider.' });
        }
      });
      socket.on('new-booking', (data) => {
        setPopup({ type:'info', message:`📩 New booking request from ${data?.seekerName || 'a seeker'}!` });
      });
    } catch(e) {}
    return () => { try { socket?.disconnect(); } catch(e) {} };
  }, [user, rideId]);

  // Load accepted bookings for provider to see seeker USN
  useEffect(() => {
    if (!ride) return;
    const isOwnerLocal = ride.providerId?._id === (user?._id || user?.id) || ride.providerId === (user?._id || user?.id);
    if (!isOwnerLocal) return;
    api.getBookingsForRide(rideId)
      .then(data => setAcceptedBookings((data || []).filter(b => b.status === 'accepted')))
      .catch(() => {});
  }, [ride, rideId]);

  const handleBook = async () => {
    setBooking({ loading:true, status:null, error:'' });
    try {
      await api.requestBooking(rideId, selectedSeats);
      setBooking({ loading:false, status:'pending', error:'' });
      setPopup({ type:'info', message:'📤 Booking request sent! Waiting for provider to accept.' });
    } catch (e) {
      setBooking({ loading:false, status:null, error: e.message });
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this ride? This cannot be undone.')) return;
    try {
      await api.deleteRide(rideId);
      navigate('dashboard');
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading) return (
    <div className="narrow-wrap">
      <div className="skeleton" style={{height:300, borderRadius:16}} />
    </div>
  );
  
  if (error) return (
    <div className="narrow-wrap">
      <div className="alert alert-error">{error}</div>
      <button className="btn btn-ghost btn-sm mt-16" onClick={() => navigate('search-rides')}>← Back</button>
    </div>
  );
  
  if (!ride) return null;

  const isOwner  = ride.providerId?._id === user?.id || ride.providerId === user?.id;
  const isSeeker = user?.role === 'seeker' || user?.role === 'both';
  const dateStr  = new Date(ride.date).toLocaleDateString('en-IN',{ weekday:'long', year:'numeric', month:'long', day:'numeric' });

  return (
    <div className="narrow-wrap fade-up">
      <button className="btn btn-ghost btn-sm mb-24" onClick={() => navigate('search-rides')}>
        ← Back to results
      </button>

      {/* Seeker: show checklist banner at TOP so it's always visible */}
      {isSeeker && !isOwner && booking.status === 'accepted' && !checklistDone && (
        <div style={{
          background:'rgba(76,175,80,0.1)', border:'2px solid #4caf50',
          borderRadius:14, padding:'16px', marginBottom:20,
        }}>
          <div style={{fontWeight:800, color:'#4caf50', fontSize:16, marginBottom:4}}>
            ✅ Booking Accepted!
          </div>
          <div style={{fontSize:13, color:'#aaa', marginBottom:12}}>
            Complete the safety checklist before tracking your ride.
          </div>
          <button className="btn btn-primary btn-full"
            onClick={() => setShowChecklist(true)}>
            📋 Complete Safety Checklist
          </button>
        </div>
      )}
      {isSeeker && !isOwner && booking.status === 'accepted' && checklistDone && (
        <div style={{
          background:'rgba(76,175,80,0.1)', border:'2px solid #4caf50',
          borderRadius:14, padding:'16px', marginBottom:20,
        }}>
          <div style={{fontWeight:800, color:'#4caf50', fontSize:16, marginBottom:12}}>
            ✅ Ready to ride!
          </div>
          <button className="btn btn-primary btn-full"
            onClick={() => navigate('live-tracking', {
              rideId: ride._id,
              pickupCoords: ride.pickup?.coordinates?.length >= 2
                ? { lat: ride.pickup.coordinates[1], lng: ride.pickup.coordinates[0] } : null,
              dropCoords: ride.drop?.coordinates?.length >= 2
                ? { lat: ride.drop.coordinates[1], lng: ride.drop.coordinates[0] } : null,
              pickupAddress: ride.pickup?.address || '',
              dropAddress:   ride.drop?.address   || '',
            })}>
            🗺️ Track My Ride Live
          </button>
        </div>
      )}

      {/* Popup alert */}
      {popup && (
        <div style={{
          position:'fixed', top:24, left:'50%', transform:'translateX(-50%)',
          zIndex:9999, minWidth:280, maxWidth:'90vw',
          background: popup.type==='success' ? '#1a3a1a' : popup.type==='error' ? '#3a1a1a' : '#1a2a3a',
          border: `2px solid ${popup.type==='success' ? '#4caf50' : popup.type==='error' ? '#f44336' : '#2196f3'}`,
          borderRadius:14, padding:'16px 20px',
          boxShadow:'0 8px 32px rgba(0,0,0,0.5)',
          display:'flex', alignItems:'flex-start', gap:12,
          animation:'slideDown 0.3s ease',
        }}>
          <div style={{flex:1, fontSize:14, color:'#fff', lineHeight:1.5}}>{popup.message}</div>
          <button onClick={() => setPopup(null)}
            style={{background:'none',border:'none',color:'#aaa',cursor:'pointer',fontSize:18,lineHeight:1,flexShrink:0}}>
            ✕
          </button>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">Ride Details</span>
          <span className={`badge badge-${ride.status || 'active'}`}>{ride.status || 'active'}</span>
        </div>

        <div className="card-body">
          {/* Route */}
          <div className="rd-route mb-24">
            <div className="rd-stop">
              <div className="rd-dot green" />
              <div>
                <div className="text-dim text-xs mb-6">PICKUP</div>
                <div className="rd-loc">{pickupName}</div>
              </div>
            </div>
            <div className="rd-connector" />
            <div className="rd-stop">
              <div className="rd-dot red" />
              <div>
                <div className="text-dim text-xs mb-6">DROP</div>
                <div className="rd-loc">{dropName}</div>
              </div>
            </div>
          </div>

          {/* Info grid */}
          <div className="grid-2 mb-24">
            {[
              { icon:'📅', label:'Date',        val: dateStr },
              { icon:'🕐', label:'Time',        val: ride.time },
              { icon:'💺', label:'Seats Left',  val: `${ride.seatsAvailable} available` },
              { icon:'₹',  label:'Cost / Seat', val: `₹${ride.costPerSeat}`, accent: true },
            ].map(item => (
              <div key={item.label} className="info-box">
                <div className="text-dim text-xs mb-6">{item.icon} {item.label}</div>
                <div className={`info-val ${item.accent ? 'text-accent' : ''}`}>{item.val}</div>
              </div>
            ))}
          </div>

          {/* Provider */}
          {ride.providerId && (
            <div className="provider-box mb-24">
              <div className="prov-ava">{ride.providerId.name?.charAt(0) || 'P'}</div>
              <div>
                <div className="prov-name">{ride.providerId.name}</div>
                {ride.providerId.rating > 0 && <div className="text-muted text-sm mt-4">⭐ {ride.providerId.rating}</div>}
                {/* Show phone, USN, vehicle number only after booking accepted */}
                {booking.status === 'accepted' && (
                  <>
                    {ride.providerId.phone && <div className="text-muted text-sm mt-4">📞 {ride.providerId.phone}</div>}
                    {ride.providerId.usn && <div className="text-muted text-sm mt-4">🪪 USN: {ride.providerId.usn}</div>}
                    {ride.providerId.kycDocuments?.vehicleNumber && (
                      <div style={{marginTop:8,background:'rgba(245,166,35,0.1)',border:'1px solid rgba(245,166,35,0.3)',borderRadius:8,padding:'8px 12px'}}>
                        <div style={{fontSize:11,color:'#888',marginBottom:2}}>VEHICLE NUMBER</div>
                        <div style={{fontSize:18,fontWeight:800,color:'#f5a623',letterSpacing:2}}>
                          {ride.providerId.kycDocuments.vehicleNumber}
                        </div>
                      </div>
                    )}
                  </>
                )}
                {booking.status !== 'accepted' && (
                  <div className="text-muted text-sm mt-4" style={{fontStyle:'italic'}}>
                    Contact & vehicle details shown after booking is accepted
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Provider sees accepted seekers with USN */}
          {isOwner && acceptedBookings.length > 0 && (
            <div style={{marginBottom:24}}>
              <div style={{fontSize:13,color:'#888',marginBottom:10,fontWeight:600}}>ACCEPTED SEEKERS</div>
              {acceptedBookings.map(b => (
                <div key={b._id} style={{
                  background:'rgba(76,175,80,0.08)', border:'1px solid rgba(76,175,80,0.2)',
                  borderRadius:12, padding:'12px 16px', marginBottom:8,
                  display:'flex', alignItems:'center', gap:12,
                }}>
                  <div style={{width:36,height:36,borderRadius:'50%',background:'rgba(76,175,80,0.2)',
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontWeight:700,color:'#4caf50',fontSize:15,flexShrink:0}}>
                    {b.seekerId?.name?.charAt(0) || 'S'}
                  </div>
                  <div>
                    <div style={{fontWeight:600,color:'#fff',fontSize:14}}>{b.seekerId?.name}</div>
                    {b.seekerId?.usn && <div style={{fontSize:12,color:'#888',marginTop:2}}>🪪 {b.seekerId.usn}</div>}
                    {b.seekerId?.phone && <div style={{fontSize:12,color:'#888',marginTop:2}}>📞 {b.seekerId.phone}</div>}
                    {b.seekerId?.gender && <div style={{fontSize:12,color: b.seekerId.gender==='female'?'#ff6ab0':'#888',marginTop:2}}>
                      {b.seekerId.gender==='female'?'♀ Female':'♂ Male'}
                    </div>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {booking.error && <div className="alert alert-error mb-16">{booking.error}</div>}
          {booking.status === 'pending' && (
            <div className="alert alert-success mb-16">
              Booking request sent! Waiting for provider to accept.
            </div>
          )}

          <div className="flex gap-12 flex-wrap">
            {isSeeker && !isOwner && !booking.status && ride.seatsAvailable > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                {ride.seatsAvailable > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-muted, #999)' }}>Seats:</span>
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ width: 32, padding: 0 }}
                      onClick={() => setSelectedSeats(s => Math.max(1, s - 1))}
                      disabled={selectedSeats <= 1}>−</button>
                    <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{selectedSeats}</span>
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ width: 32, padding: 0 }}
                      onClick={() => setSelectedSeats(s => Math.min(ride.seatsAvailable, s + 1))}
                      disabled={selectedSeats >= ride.seatsAvailable}>+</button>
                  </div>
                )}
                <button
                  className={`btn btn-primary btn-lg ${booking.loading ? 'btn-loading' : ''}`}
                  onClick={handleBook} disabled={booking.loading}>
                  {!booking.loading && `🎫 Book ${selectedSeats} Seat${selectedSeats > 1 ? 's' : ''}`}
                </button>
              </div>
            )}
            {ride.seatsAvailable === 0 && !booking.status && (
              <span className="badge badge-rejected" style={{fontSize:13, padding:'8px 14px'}}>No seats available</span>
            )}
            {isOwner && (
              <button className="btn btn-danger" onClick={handleDelete}>Delete Ride</button>
            )}
          </div>
        </div>
      </div>

      {/* Checklist modal */}
      {showChecklist && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{width:'100%',maxWidth:480}}>
            <PreRideChecklist
              onComplete={() => { setChecklistDone(true); setShowChecklist(false); }}
              onCancel={() => setShowChecklist(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}