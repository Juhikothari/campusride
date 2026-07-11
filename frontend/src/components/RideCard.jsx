import React, { useState, useEffect } from 'react';
import * as api from '../services/api.js';
import './RideCard.css';

// ══════════════════════════════════════════════════════════════════
//  FALLBACK LOCATIONS DATABASE
// ══════════════════════════════════════════════════════════════════

const FALLBACK_LOCATIONS = [
  // Colleges
  { name: 'rv college of engineering', display: 'RV College of Engineering', coords: [77.4958, 12.9215] },
  { name: 'bms college of engineering', display: 'BMS College of Engineering', coords: [77.5908, 12.9611] },
  { name: 'pes university', display: 'PES University', coords: [77.5366, 12.9345] },
  { name: 'pesit', display: 'PESIT', coords: [77.5366, 12.9345] },
  { name: 'ms ramaiah institute', display: 'MS Ramaiah Institute of Technology', coords: [77.5770, 13.0163] },
  { name: 'ramaiah', display: 'MS Ramaiah Institute of Technology', coords: [77.5770, 13.0163] },
  { name: 'bangalore institute of technology', display: 'Bangalore Institute of Technology', coords: [77.6007, 12.9539] },
  { name: 'bit', display: 'Bangalore Institute of Technology', coords: [77.6007, 12.9539] },
  { name: 'rns institute of technology', display: 'RNS Institute of Technology', coords: [77.4983, 12.9358] },
  { name: 'rnsit', display: 'RNS Institute of Technology', coords: [77.4983, 12.9358] },
  
  // Areas
  { name: 'marathahalli', display: 'Marathahalli', coords: [77.6995, 12.9591] },
  { name: 'marthahalli', display: 'Marathahalli', coords: [77.6995, 12.9591] },
  { name: 'whitefield', display: 'Whitefield', coords: [77.7499, 12.9698] },
  { name: 'electronic city', display: 'Electronic City', coords: [77.6763, 12.8445] },
  { name: 'indiranagar', display: 'Indiranagar', coords: [77.6408, 12.9793] },
  { name: 'koramangala', display: 'Koramangala', coords: [77.6234, 12.9345] },
  { name: 'jayanagar', display: 'Jayanagar', coords: [77.5811, 12.9257] },
  { name: 'basavanagudi', display: 'Basavanagudi', coords: [77.5657, 12.9406] },
  { name: 'malleshwaram', display: 'Malleshwaram', coords: [77.5806, 13.0039] },
  { name: 'rajajinagar', display: 'Rajajinagar', coords: [77.5578, 13.0011] },
  { name: 'yeshwanthpur', display: 'Yeshwanthpur', coords: [77.5510, 13.0167] },
  { name: 'hsr layout', display: 'HSR Layout', coords: [77.6479, 12.9081] },
  { name: 'btm layout', display: 'BTM Layout', coords: [77.6107, 12.9162] },
  { name: 'banashankari', display: 'Banashankari', coords: [77.5439, 12.9317] },
  { name: 'kalyan nagar', display: 'Kalyan Nagar', coords: [77.6408, 13.0163] },
  { name: 'domlur', display: 'Domlur', coords: [77.6408, 12.9611] },
  { name: 'bellandur', display: 'Bellandur', coords: [77.6806, 12.9257] },
  { name: 'sarjapur', display: 'Sarjapur', coords: [77.7833, 12.9187] },
  { name: 'd\'souza layout', display: 'D\'Souza Layout', coords: [77.5946, 12.9716] },
  { name: 'bharath aikya ward', display: 'Bharath Aikya Ward', coords: [77.5946, 12.9716] },
  { name: 'bharathi aikya ward', display: 'Bharath Aikya Ward', coords: [77.5946, 12.9716] },
  
  // Cities
  { name: 'bangalore', display: 'Bangalore', coords: [77.5946, 12.9716] },
  { name: 'bengaluru', display: 'Bengaluru', coords: [77.5946, 12.9716] },
  { name: 'hyderabad', display: 'Hyderabad', coords: [78.4867, 17.3850] },
  { name: 'delhi', display: 'Delhi', coords: [77.2090, 28.6139] },
  { name: 'mumbai', display: 'Mumbai', coords: [72.8777, 19.0760] },
  { name: 'chennai', display: 'Chennai', coords: [80.2707, 13.0827] },
  { name: 'pune', display: 'Pune', coords: [73.8567, 18.5204] },
  { name: 'kolkata', display: 'Kolkata', coords: [88.3639, 22.5726] },
  { name: 'jaipur', display: 'Jaipur', coords: [75.7873, 26.9124] },
  { name: 'lucknow', display: 'Lucknow', coords: [80.9462, 26.8467] },
  { name: 'indore', display: 'Indore', coords: [75.8577, 22.7196] }
];

// Find location name from coordinates using fallback database
function findLocationByCoords(coords) {
  if (!coords || !Array.isArray(coords) || coords.length !== 2) return null;
  
  const [lng, lat] = coords;
  
  // Find closest match within 0.02 degrees (roughly 2km)
  const match = FALLBACK_LOCATIONS.find(loc => {
    const [locLng, locLat] = loc.coords;
    return Math.abs(locLat - lat) < 0.02 && Math.abs(locLng - lng) < 0.02;
  });
  
  return match ? match.display : null;
}

// ══════════════════════════════════════════════════════════════════
//  HOOK
// ══════════════════════════════════════════════════════════════════

function useLocationName(locationField) {
  const [name, setName] = useState('');
  useEffect(() => {
    if (!locationField) { setName('Unknown location'); return; }
    const storedAddress = locationField.address?.trim();
    if (storedAddress && storedAddress.length > 0 && storedAddress !== 'Unknown Location') {
      setName(storedAddress);
      return;
    }
    const coords = locationField.coordinates;
    if (Array.isArray(coords) && coords.length === 2) {
      const fallbackName = findLocationByCoords(coords);
      if (fallbackName) { setName(fallbackName); return; }
      const [lng, lat] = coords;
      setName(`${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`);
    } else {
      setName('Unknown location');
    }
  }, [locationField]);
  return name;
}

// ══════════════════════════════════════════════════════════════════
//  COMPONENT
// ══════════════════════════════════════════════════════════════════

export default function RideCard({ ride, onView, onBook, bookingStatus, provRating }) {
  const [showSeatDialog, setShowSeatDialog] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState(1);
  // FIXED: Don't render if no seats available
  if ((ride.seatsAvailable ?? 0) === 0) {
    return null;
  }

  const pickupName = useLocationName(ride.pickup);
  const dropName = useLocationName(ride.drop);
  const provider = ride.providerId;
  const provName = typeof provider === 'object' ? (provider?.name || 'Provider') : 'Provider';
  const dateStr = ride.date
    ? new Date(ride.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
  const isLoading = v => !v || v === '…' || v === 'Loading…' || v === 'Loading location...';

  const handleBookClick = () => {
    if (ride.seatsAvailable > 1) {
      // Multi-seat ride: use selectedSeats from inline selector
      onBook?.(ride._id, selectedSeats);
    } else {
      // Single seat ride: book directly
      onBook?.(ride._id, 1);
    }
  };

  const handleSeatConfirm = () => {
    setShowSeatDialog(false);
    onBook?.(ride._id, selectedSeats);
  };

  return (
    <>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="card-body" style={{ padding: '20px 22px' }}>

          {/* Route row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, overflow: 'hidden' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
              <span style={{ 
                fontSize: 14, 
                fontWeight: 600, 
                color: isLoading(pickupName) ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.88)', 
                fontStyle: isLoading(pickupName) ? 'italic' : 'normal', 
                whiteSpace: 'nowrap', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis' 
              }}>
                {pickupName || '…'}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0, fontSize: 16, fontWeight: 'bold' }}>+</span>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
              <span style={{ 
                fontSize: 14, 
                fontWeight: 600, 
                color: isLoading(dropName) ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.88)', 
                fontStyle: isLoading(dropName) ? 'italic' : 'normal', 
                whiteSpace: 'nowrap', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis' 
              }}>
                {dropName || '…'}
              </span>
            </div>
            <span className={`badge badge-${ride.status || 'active'}`} style={{ flexShrink: 0, marginLeft: 12 }}>
              {ride.status || 'active'}
            </span>
            {ride.womenOnly && (
              <span style={{
                flexShrink: 0, marginLeft: 8,
                background: 'rgba(233,30,140,0.18)', color: '#e91e8c',
                border: '1px solid rgba(233,30,140,0.4)',
                borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700,
              }}>♀ Women Only</span>
            )}
          </div>

          {/* Details row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                {dateStr} at {ride.time || '—'}
              </span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                {ride.seatsAvailable} seat{ride.seatsAvailable > 1 ? 's' : ''} left
              </span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                ₹{ride.costPerSeat}/seat
              </span>
            </div>
          </div>

          {/* Provider row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                👤
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)', display:'flex', alignItems:'center', gap:6 }}>
                  {provName}
                  {provider?.gender === 'female' && (
                    <span style={{fontSize:11, background:'rgba(255,106,176,0.15)', color:'#ff6ab0', border:'1px solid rgba(255,106,176,0.3)', borderRadius:4, padding:'1px 6px'}}>♀ Female</span>
                  )}
                </div>
                {provRating > 0 && <div style={{ fontSize: 11, color: '#f59e0b' }}>★ {provRating.toFixed(1)}</div>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Inline Seat Selector */}
              {ride.seatsAvailable > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <button 
                    style={{ 
                      width: '24px', 
                      height: '24px', 
                      border: '1px solid #dee2e6', 
                      background: '#ffffff', 
                      color: '#495057', 
                      borderRadius: '4px', 
                      fontSize: '14px', 
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onClick={() => setSelectedSeats(Math.max(1, selectedSeats - 1))}
                    disabled={selectedSeats <= 1}
                  >
                    −
                  </button>
                  <span style={{ 
                    fontSize: '16px', 
                    fontWeight: '700', 
                    color: '#fbbf24', 
                    minWidth: '24px',
                    textAlign: 'center'
                  }}>{selectedSeats}</span>
                  <button 
                    style={{ 
                      width: '24px', 
                      height: '24px', 
                      border: '1px solid #dee2e6', 
                      background: '#ffffff', 
                      color: '#495057', 
                      borderRadius: '4px', 
                      fontSize: '14px', 
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onClick={() => setSelectedSeats(Math.min(ride.seatsAvailable, selectedSeats + 1))}
                    disabled={selectedSeats >= ride.seatsAvailable}
                  >
                    +
                  </button>
                </div>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => onView?.(ride._id)}>Details</button>
              {bookingStatus === 'pending'
                ? <span className="badge badge-pending" style={{ padding: '6px 12px', fontSize: 12 }}>Requested</span>
                : <button className="btn btn-primary btn-sm" onClick={handleBookClick} disabled={!onBook}>Book Seat →</button>
              }
            </div>
          </div>

        </div>
      </div>
    </>
  );
}