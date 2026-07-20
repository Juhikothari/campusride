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

  const pickupName = useLocationName(ride?.pickup);
  const dropName   = useLocationName(ride?.drop);

  useEffect(() => {
    if (!rideId) { setError('No ride ID'); setLoading(false); return; }
    api.getRide(rideId)
      .then(data => setRide(data?.ride || data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [rideId]);

  const handleBook = async () => {
    setBooking({ loading:true, status:null, error:'' });
    try {
      await api.requestBooking(rideId, selectedSeats);
      setBooking({ loading:false, status:'pending', error:'' });
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

          {/* Action section */}
          {booking.error && <div className="alert alert-error mb-16">{booking.error}</div>}
          {booking.status === 'pending' && (
            <div className="alert alert-success mb-16">
              Booking request sent! The provider will accept or reject shortly.
            </div>
          )}

          {/* Seeker checklist — shown when booking accepted */}
          {isSeeker && booking.status === 'accepted' && !checklistDone && (
            <div style={{marginBottom:16}}>
              <div className="alert alert-success mb-12">
                ✅ Booking accepted! Complete the safety checklist before your ride.
              </div>
              {!showChecklist ? (
                <button className="btn btn-primary btn-full"
                  onClick={() => setShowChecklist(true)}>
                  📋 Open Safety Checklist
                </button>
              ) : (
                <PreRideChecklist
                  onComplete={() => { setShowChecklist(false); setChecklistDone(true); }}
                  onCancel={() => setShowChecklist(false)}
                />
              )}
            </div>
          )}
          {isSeeker && booking.status === 'accepted' && checklistDone && (
            <div className="alert alert-success mb-16">✅ Safety checklist completed. Have a safe ride!</div>
          )}

          {/* Checklist for seeker after booking accepted */}
          {isSeeker && booking.status === 'accepted' && !checklistDone && (
            <div style={{background:'rgba(76,175,80,0.1)',border:'1px solid rgba(76,175,80,0.3)',borderRadius:12,padding:'14px 16px',marginBottom:16}}>
              <div style={{fontWeight:700,color:'#4caf50',marginBottom:6}}>✅ Booking Accepted!</div>
              <div style={{fontSize:13,color:'#aaa',marginBottom:12}}>Please complete a quick safety checklist before your ride.</div>
              <button className="btn btn-primary btn-sm" onClick={() => setShowChecklist(true)}>
                Complete Safety Checklist →
              </button>
            </div>
          )}
          {isSeeker && booking.status === 'accepted' && checklistDone && (
            <div className="alert alert-success mb-16">
              ✅ Safety checklist done — have a safe ride!
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