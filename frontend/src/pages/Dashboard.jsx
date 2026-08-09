import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import './Dashboard.css';

export default function Dashboard({ navigate }) {
  const { user } = useAuth();
  const isProvider = user?.role === 'provider' || user?.role === 'both';
  const isSeeker   = user?.role === 'seeker'   || user?.role === 'both';

  const primary = [
    { key:'search-rides',  icon:'🔍', title:'Find a Ride',  sub:'Match with commuters on your route',         show: isSeeker },
    { key:'create-ride',   icon:'🚗', title:'Offer a Ride',  sub:'Post your route and split the cost',         show: isProvider },
    { key:'community',     icon:'💬', title:'Community',     sub:'Posts, chat and campus alerts',              show: true },
    { key:'walk-together', icon:'🚶', title:'Walk Together', sub:'Find someone walking the same campus route', show: true },
  ].filter(a => a.show);

  return (
    <div className="dashboard fade-up">

      {/* Hero — just name and college, no tagline here */}
      <div className="dash-hero">
        <div className="dh-content">
          <h1 className="display dh-name" style={{fontSize:32}}>
            {user?.name?.split(' ')[0]}
          </h1>
          <p className="text-muted mt-4" style={{fontSize:13}}>
            {user?.college
              ? user.college.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
              : ''}
          </p>
        </div>
        <div className="dh-glow" />
      </div>

      {/* 4 core action cards */}
      <div className="dash-actions stagger" style={{marginTop:8}}>
        {primary.map(a => (
          <button key={a.key} className="da-card fade-up primary" onClick={() => navigate(a.key)}>
            <div className="da-icon">{a.icon}</div>
            <div className="da-body">
              <div className="da-title">{a.title}</div>
              <div className="da-sub">{a.sub}</div>
            </div>
            <div className="da-arrow">→</div>
          </button>
        ))}
      </div>

      {/* Bottom tagline */}
      <div style={{
        textAlign:'center',
        padding:'40px 16px 32px',
        marginTop:'auto',
      }}>
        <p style={{
          fontSize:12,
          color:'#444',
          fontStyle:'italic',
          letterSpacing:'.04em',
          margin:0,
        }}>
          The operating system for daily commuting in Indian cities
        </p>
      </div>

    </div>
  );
}
