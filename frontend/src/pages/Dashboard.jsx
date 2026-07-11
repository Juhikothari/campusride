import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import './Dashboard.css';

export default function Dashboard({ navigate }) {
  const { user } = useAuth();
  const isProvider = user?.role === 'provider' || user?.role === 'both';
  const isSeeker   = user?.role === 'seeker'   || user?.role === 'both';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const actions = [
    { key:'search-rides',      icon:'🔍', title:'Find a Ride',      sub:'Geo-search rides near your location',    primary: true, show: isSeeker },
    { key:'create-ride',       icon:'🚗', title:'Offer a Ride',     sub:'Post your route and earn from seats',    primary: true, show: isProvider },
    { key:'my-bookings',       icon:'📋', title:'My Bookings',      sub:'View upcoming and past ride requests',   primary: false, show: isSeeker },
    { key:'provider-bookings', icon:'📬', title:'Manage Requests',  sub:'Accept or reject incoming bookings',     primary: false, show: isProvider },
    { key:'kyc',               icon:'🪪', title:'KYC Verification',  sub:'Upload ID and get verified',             primary: false, show: true },
    { key:'ratings',           icon:'⭐', title:'Ratings',           sub:'View and give ride reviews',             primary: false, show: true },
    //{ key:'live-tracking',     icon:'📍', title:'Live Tracking',     sub:'Track ride with emergency SOS',          primary: false, show: true },
    { key:'community',         icon:'💬', title:'Community',         sub:'Tips, landmarks and alerts',             primary: false, show: true },
    { key:'admin',             icon:'⚙️',  title:'Admin Dashboard',   sub:'Manage users, KYC and incidents',        primary: false, show: user?.role === 'admin' },
  ].filter(a => a.show);

  return (
    <div className="dashboard fade-up">

      {/* Hero */}
      <div className="dash-hero">
        <div className="dh-content">
          <p className="eyebrow mb-12">{greeting}</p>
          <h1 className="display dh-name">{user?.name?.split(' ')[0]} <span className="text-accent">👋</span></h1>
          <p className="text-muted mt-8">
            {user?.college} &nbsp;·&nbsp;
            <span className="capitalize" style={{color:'var(--accent)'}}>{user?.role}</span>
          </p>
        </div>
        <div className="dh-glow" />
      </div>

      {/* Quick actions */}
      <div className="dash-actions stagger">
        {actions.map(a => (
          <button key={a.key} className={`da-card fade-up ${a.primary ? 'primary' : ''}`} onClick={() => navigate(a.key)}>
            <div className="da-icon">{a.icon}</div>
            <div className="da-body">
              <div className="da-title">{a.title}</div>
              <div className="da-sub">{a.sub}</div>
            </div>
            <div className="da-arrow">→</div>
          </button>
        ))}
      </div>

      {/* Feature pills */}
      <div className="dash-features stagger">
        {[
          { icon:'🛡️', label:'Verified college IDs' },
          { icon:'📍', label:'Geo-matched rides' },
          { icon:'💰', label:'Transparent pricing' },
          { icon:'🔔', label:'Real-time booking status' },
        ].map(f => (
          <div key={f.label} className="feat-pill fade-up">
            <span>{f.icon}</span> {f.label}
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="dash-how">
        <h2 className="heading mb-24" style={{fontSize:20}}>How CampusRide works</h2>
        <div className="how-grid">
          {[
            { n:'01', t:'Register & verify',     d:'Sign up with your college email and choose your role.' },
            { n:'02', t:'Find or post rides',     d:'Seekers search by location. Providers post their route.' },
            { n:'03', t:'Book & confirm',         d:'Request a seat. Provider accepts — you get notified.' },
            { n:'04', t:'Ride & split the cost',  d:'Meet at pickup. Share the commute, share the bill.' },
          ].map(s => (
            <div key={s.n} className="how-card">
              <div className="how-n">{s.n}</div>
              <div className="how-t">{s.t}</div>
              <div className="how-d">{s.d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
