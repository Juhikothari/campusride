import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { API_BASE } from '../services/api.js';

const STATUS_CONFIG = {
  active: {
    label: 'Ride Confirmed',
    sub: 'Your booking is confirmed. Provider will pick you up soon.',
    color: '#a0c4f4', bg: '#1a2a3a', border: '#2a4a6a', icon: '✅'
  },
  'in-progress': {
    label: 'Ride In Progress',
    sub: 'Provider has picked you up. Enjoy your ride!',
    color: '#ffd700', bg: '#2a2a1a', border: '#4a4a2a', icon: '🚗'
  },
  completed: {
    label: 'Ride Successfully Completed!',
    sub: 'You have reached your destination. Thank you for riding with us!',
    color: '#a0f4a0', bg: '#1e3a1e', border: '#2e5a2e', icon: '🎉'
  },
  cancelled: {
    label: 'Ride Cancelled',
    sub: 'This ride was cancelled by the provider.',
    color: '#f4a0a0', bg: '#3a1a1a', border: '#5a2a2a', icon: '❌'
  }
};

function RouteMap({ pickup, drop }) {
  if (!pickup || !drop) return (
    <div style={{background:'#1a1a2e', border:'1px solid #333', borderRadius:12, padding:20, textAlign:'center', color:'#555', marginBottom:16}}>
      Map unavailable — location data not set
    </div>
  );
  const [pLng, pLat] = pickup;
  const [dLng, dLat] = drop;
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${Math.min(pLng,dLng)-0.05},${Math.min(pLat,dLat)-0.05},${Math.max(pLng,dLng)+0.05},${Math.max(pLat,dLat)+0.05}&layer=mapnik&marker=${pLat},${pLng}`;
  return (
    <div style={{borderRadius:12, overflow:'hidden', border:'1px solid #333', marginBottom:16}}>
      <div style={{background:'#1a1a2e', padding:'8px 12px', display:'flex', justifyContent:'space-between', fontSize:12}}>
        <span style={{color:'#6cf'}}>📍 Pickup: {pLat.toFixed(4)}°N, {pLng.toFixed(4)}°E</span>
        <span style={{color:'#f96'}}>🏁 Drop: {dLat.toFixed(4)}°N, {dLng.toFixed(4)}°E</span>
      </div>
      <iframe title="Route Map" src={mapUrl} style={{width:'100%', height:220, border:'none', display:'block'}} loading="lazy" />
      <div style={{background:'#1a1a2e', padding:'6px 12px', fontSize:11, color:'#555', textAlign:'center'}}>
        Map data © OpenStreetMap contributors
      </div>
    </div>
  );
}

export default function RideTracker({ booking, onClose }) {
  const ride = booking.rideId;
  const [rideStatus, setRideStatus] = useState(ride?.status || 'active');
  const socketRef = useRef(null);

  useEffect(() => {
    if (!ride?._id) return;
    //const socket = io('http://localhost:5000', { transports: ['websocket', 'polling'] });

  const socket = io(
  API_BASE.replace(/\/api\/?$/, ''),
  {
    transports: ['websocket', 'polling'],
    withCredentials: true
  }
);
    socketRef.current = socket;
    socket.on('connect', () => { socket.emit('join-ride', ride._id); });
    socket.on('passengerPickedUp', (data) => {
      if (String(data.rideId) === String(ride._id)) setRideStatus('in-progress');
    });
    socket.on('passengerDropped', (data) => {
      if (String(data.rideId) === String(ride._id)) setRideStatus('completed');
    });
    socket.on('rideCompleted', (data) => {
      if (String(data.rideId) === String(ride._id)) setRideStatus('completed');
    });
    socket.on('rideCancelled', (data) => {
      if (String(data.rideId) === String(ride._id)) setRideStatus('cancelled');
    });
    return () => socket.disconnect();
  }, [ride?._id]);

  const config = STATUS_CONFIG[rideStatus] || STATUS_CONFIG['active'];
  const steps = [
    { key: 'active',      label: 'Booking Confirmed',   done: true },
    { key: 'in-progress', label: 'Passenger Picked Up', done: rideStatus === 'in-progress' || rideStatus === 'completed' },
    { key: 'completed',   label: 'Ride Completed',      done: rideStatus === 'completed' },
  ];

  return (
    <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.92)',zIndex:1000,overflowY:'auto',padding:'20px 16px'}}>
      <div style={{maxWidth:520, margin:'0 auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <h2 style={{color:'#fff',fontSize:20,margin:0}}>🗺️ Live Ride Tracker</h2>
          <button onClick={onClose} style={{background:'#333',border:'none',color:'#fff',borderRadius:8,padding:'6px 14px',cursor:'pointer',fontSize:14}}>✕ Close</button>
        </div>

        <div style={{background:config.bg,border:`1px solid ${config.border}`,borderRadius:12,padding:16,marginBottom:16,textAlign:'center'}}>
          <div style={{fontSize:36,marginBottom:8}}>{config.icon}</div>
          <div style={{color:config.color,fontWeight:700,fontSize:18,marginBottom:4}}>{config.label}</div>
          <div style={{color:'#aaa',fontSize:13}}>{config.sub}</div>
        </div>

        <div style={{background:'#1a1a2e',border:'1px solid #333',borderRadius:12,padding:16,marginBottom:16}}>
          <div style={{fontSize:12,color:'#888',marginBottom:12,textTransform:'uppercase',letterSpacing:1}}>Trip Progress</div>
          {steps.map((s, i) => (
            <div key={s.key} style={{display:'flex',alignItems:'center',gap:12,marginBottom:i<steps.length-1?16:0}}>
              <div style={{width:28,height:28,borderRadius:'50%',flexShrink:0,background:s.done?'#6c63ff':'#222',border:`2px solid ${s.done?'#6c63ff':'#444'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,color:'#fff'}}>
                {s.done ? '✓' : (i+1)}
              </div>
              <div>
                <div style={{color:s.done?'#fff':'#555',fontWeight:s.done?600:400,fontSize:14}}>{s.label}</div>
                {s.key === rideStatus && <div style={{color:'#6c63ff',fontSize:11,marginTop:2}}>● Current status</div>}
              </div>
            </div>
          ))}
        </div>

        <RouteMap pickup={ride?.pickup?.coordinates} drop={ride?.drop?.coordinates} />

        <div style={{background:'#1a1a2e',border:'1px solid #333',borderRadius:12,padding:16}}>
          <div style={{fontSize:12,color:'#888',marginBottom:12,textTransform:'uppercase',letterSpacing:1}}>Ride Details</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div><div style={{color:'#555',fontSize:11}}>DATE</div><div style={{color:'#fff',fontWeight:600,marginTop:4}}>{new Date(ride?.date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</div></div>
            <div><div style={{color:'#555',fontSize:11}}>TIME</div><div style={{color:'#fff',fontWeight:600,marginTop:4}}>{ride?.time}</div></div>
            <div><div style={{color:'#555',fontSize:11}}>COST</div><div style={{color:'#f5a623',fontWeight:600,marginTop:4}}>₹{ride?.costPerSeat}/seat</div></div>
            <div><div style={{color:'#555',fontSize:11}}>STATUS</div><div style={{color:config.color,fontWeight:600,marginTop:4,textTransform:'capitalize'}}>{rideStatus}</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
