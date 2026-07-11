import React, { useState, useEffect } from 'react';
import './LiveTracking.css';

export default function LiveTracking({ navigate }) {
  const [tracking,  setTracking]  = useState(false);
  const [sosSent,   setSosSent]   = useState(false);
  const [sosActive, setSosActive] = useState(false);
  const [elapsed,   setElapsed]   = useState(0);
  const [carPos,    setCarPos]    = useState(0);
  const [contact,   setContact]   = useState('');

  useEffect(() => {
    if (!tracking) return;
    const id = setInterval(() => {
      setElapsed(e => e + 1);
      setCarPos(p => Math.min(p + 1, 60));
    }, 1000);
    return () => clearInterval(id);
  }, [tracking]);

  const fmt = s => String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0');

  const handleSOS = () => {
    setSosActive(true);
    setTimeout(() => { setSosSent(true); setSosActive(false); }, 2000);
  };

  const RIDE = { from:'IIT Bombay', to:'Mumbai Airport T2', driver:'Rohan Gupta', vehicle:'MH 01 AB 1234', eta:'24 min', distance:'18.4 km' };

  return (
    <div className="tracking-wrap fade-up">
      <p className="eyebrow mb-8">Safety</p>
      <h1 className="heading mb-4" style={{fontSize:28}}>Live Tracking</h1>
      <p className="text-muted mb-32 text-sm">Real-time location sharing with emergency SOS</p>

      {sosSent && (
        <div className="alert alert-error mb-24">
          SOS Alert Sent! Emergency contacts and admin have been notified.
        </div>
      )}

      <div className="tracking-map-mock mb-24">
        <div className="map-bg">
          {Array.from({length:16}).map((_,i) => (
            <div key={i} className="map-grid-cell"/>
          ))}
          <div className="map-route-line"/>
          <div className="map-pin-a">A</div>
          <div className="map-pin-b">B</div>
          {tracking && (
            <div className="map-car-dot" style={{left: (20 + carPos*0.6) + '%', top: (60 - carPos*0.3) + '%'}}/>
          )}
        </div>
        <div className="map-eta-badge">
          <div className="map-eta-value">{tracking ? Math.max(0, 24 - Math.floor(elapsed/60)) : 24} min</div>
          <div className="map-eta-label">ETA</div>
        </div>
      </div>

      <div className="tracking-grid mb-24">
        {[
          { label:'FROM',     value: RIDE.from },
          { label:'TO',       value: RIDE.to },
          { label:'DRIVER',   value: RIDE.driver },
          { label:'VEHICLE',  value: RIDE.vehicle },
          { label:'DISTANCE', value: RIDE.distance },
          { label:'ELAPSED',  value: fmt(elapsed), accent: true },
        ].map(item => (
          <div key={item.label} className="tracking-info-card">
            <div className="tracking-info-label">{item.label}</div>
            <div className={'tracking-info-value' + (item.accent ? ' tracking-timer' : '')}>{item.value}</div>
          </div>
        ))}
      </div>

      <div className="tracking-controls mb-24">
        <button className={'btn btn-lg flex-1 ' + (tracking ? 'btn-outline' : 'btn-primary')}
          onClick={() => { setTracking(t => !t); if (tracking) setCarPos(0); }}>
          {tracking ? 'Stop Tracking' : 'Start Tracking'}
        </button>
        <button
          className={'sos-btn btn btn-lg' + (sosActive ? ' btn-loading' : '') + (sosSent ? ' sos-sent' : '')}
          onClick={handleSOS}
          disabled={sosActive || sosSent}>
          {!sosActive && (sosSent ? 'SOS Sent' : 'SOS')}
        </button>
      </div>

      <div className="sos-contact-box mb-24">
        <h3 className="heading mb-8" style={{fontSize:16}}>Emergency Contact</h3>
        <p className="text-muted text-sm mb-12">This person will be alerted if you trigger SOS</p>
        <div className="flex gap-12">
          <input className="input flex-1" placeholder="+91 98765 43210"
            value={contact} onChange={e => setContact(e.target.value)}/>
          <button className="btn btn-outline">Save</button>
        </div>
      </div>

      <div className="privacy-note">
        <span className="privacy-icon">LOCK</span>
        <div>
          <div className="privacy-title">Privacy Protected</div>
          <div className="privacy-sub">Location is shared only during active ride with your consent. Data is deleted after trip ends.</div>
        </div>
      </div>
    </div>
  );
}
