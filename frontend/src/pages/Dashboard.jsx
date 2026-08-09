import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import './Dashboard.css';

export default function Dashboard({ navigate }) {
  const { user } = useAuth();
  const isProvider = user?.role === 'provider' || user?.role === 'both';
  const isSeeker   = user?.role === 'seeker'   || user?.role === 'both';

  // Main 4 actions on dashboard — everything else is in the menu
  const primary = [
    { key:'search-rides',  icon:'🔍', title:'Find a Ride',      sub:'Match with commuters on your route',         show: isSeeker },
    { key:'create-ride',   icon:'🚗', title:'Offer a Ride',      sub:'Post your route and split the cost',         show: isProvider },
    { key:'community',     icon:'💬', title:'Community',         sub:'Posts, chat, walk together & route match',   show: true },
    { key:'my-bookings',   icon:'📋', title:'My Bookings',       sub:'View upcoming and past commute requests',    show: isSeeker },
    { key:'provider-bookings', icon:'📬', title:'Manage Requests', sub:'Accept or reject booking requests',       show: isProvider },
  ].filter(a => a.show);

  return (
    <div className="dashboard fade-up">

      {/* Simple header — just name and college */}
      <div className="dash-hero" style={{paddingBottom: 8}}>
        <div className="dh-content">
          <h1 className="display dh-name" style={{fontSize: 32}}>
            {user?.name?.split(' ')[0]}
          </h1>
          <p className="text-muted mt-4" style={{fontSize: 13}}>
            {user?.college ? user.college.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : ''}
          </p>
        </div>
        <div className="dh-glow" />
      </div>

      {/* Primary actions */}
      <div className="dash-actions stagger" style={{marginTop: 12}}>
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

    </div>
  );
}
