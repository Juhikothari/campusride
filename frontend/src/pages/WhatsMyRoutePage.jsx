import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { searchLocation, searchRides } from '../services/api.js';

export default function WhatsMyRoutePage({ navigate }) {
  const { user } = useAuth();
  const [pickup,   setPickup]   = useState('');
  const [drop,     setDrop]     = useState('');
  const [matches,  setMatches]  = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [searched, setSearched] = useState(false);

  const search = async () => {
    if (!pickup.trim() || !drop.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const pickupResults = await searchLocation(pickup);
      if (!pickupResults?.length) { setMatches([]); setLoading(false); return; }
      const pLat = pickupResults[0].lat;
      const pLng = pickupResults[0].lng;
      const rides = await searchRides({ lat: pLat, lng: pLng, maxDistance: 5000 });
      const dropKey = drop.toLowerCase();
      const filtered = (rides || []).filter(r =>
        r.drop?.address?.toLowerCase().includes(dropKey) ||
        r.drop?.address?.toLowerCase().includes(dropKey.split(' ')[0])
      );
      setMatches(filtered);
    } catch {
      setMatches([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="narrow-wrap fade-up" style={{paddingBottom:40}}>
      <div style={{marginBottom:24}}>
        <h2 style={{color:'#fff',fontSize:24,fontWeight:800,margin:'0 0 6px'}}>🗺️ What's My Route?</h2>
        <p style={{color:'#666',fontSize:13,margin:0}}>
          Find commuters from {user?.college ? user.college.split(' ').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ') : 'your college'} who travel the same route as you.
        </p>
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:20}}>
        <input
          className="input"
          placeholder="📍 Your pickup area (e.g. Rajarajeshwari Nagar)"
          value={pickup} onChange={e => setPickup(e.target.value)}
        />
        <input
          className="input"
          placeholder="🏁 Your drop area (e.g. RNS Institute of Technology)"
          value={drop} onChange={e => setDrop(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
        />
        <button
          onClick={search}
          disabled={loading || !pickup.trim() || !drop.trim()}
          className="btn btn-primary btn-full"
        >
          {loading ? 'Searching…' : '🔍 Find Route Matches'}
        </button>
      </div>

      {searched && !loading && matches !== null && (
        matches.length === 0 ? (
          <div style={{textAlign:'center',padding:'40px 16px',color:'#555'}}>
            <div style={{fontSize:40,marginBottom:10}}>🗺️</div>
            <div style={{fontWeight:600,color:'#888',marginBottom:6}}>No matches found yet</div>
            <div style={{fontSize:12,marginBottom:16}}>
              Be the first to post this route — others looking for the same commute will find you.
            </div>
            <button onClick={() => navigate('create-ride')}
              style={{background:'transparent',border:'1px solid #f5a623',color:'#f5a623',
                borderRadius:10,padding:'8px 20px',fontSize:13,fontWeight:600,cursor:'pointer'}}>
              + Post This Route
            </button>
          </div>
        ) : (
          <div>
            <div style={{fontSize:13,color:'#888',marginBottom:12}}>
              {matches.length} commuter{matches.length !== 1 ? 's' : ''} found on this route
            </div>
            {matches.map(ride => (
              <div key={ride._id} style={{
                background:'#111318',border:'1px solid #1f2330',borderRadius:12,
                padding:'14px 16px',marginBottom:10,
              }}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                  <div>
                    <div style={{color:'#fff',fontWeight:600,fontSize:14}}>
                      👤 {ride.providerId?.name || 'Commuter'}
                    </div>
                    <div style={{color:'#aaa',fontSize:12,marginTop:4}}>
                      📍 {ride.pickup?.address?.split(',')[0]} → {ride.drop?.address?.split(',')[0]}
                    </div>
                    <div style={{color:'#666',fontSize:11,marginTop:3}}>
                      {new Date(ride.date).toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})}
                      {' · '}{ride.time}{' · '}₹{ride.costPerSeat}/seat
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('ride-detail', { rideId: ride._id })}
                    style={{background:'#f5a623',color:'#000',border:'none',borderRadius:8,
                      padding:'6px 14px',fontSize:12,fontWeight:700,cursor:'pointer',flexShrink:0}}>
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
