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
    { key:'search-rides',      icon:'🔍', title:'Find a Ride',          sub:'Match with commuters on your route',          primary: true,  show: isSeeker },
    { key:'create-ride',       icon:'🚗', title:'Offer a Ride',          sub:'Post your route and split the commute cost',  primary: true,  show: isProvider },
    { key:'walk-together',     icon:'🚶', title:'Walk Together',          sub:'Find someone walking the same campus route',  primary: true,  show: true },
    { key:'whats-my-route',    icon:'🗺️', title:"What's My Route?",      sub:'Discover who shares your daily commute',      primary: true,  show: true },
    { key:'my-bookings',       icon:'📋', title:'My Bookings',           sub:'View upcoming and past commute requests',     primary: false, show: isSeeker },
    { key:'provider-bookings', icon:'📬', title:'Manage Requests',       sub:'Accept or reject incoming booking requests',  primary: false, show: isProvider },
    { key:'kyc',               icon:'🪪', title:'KYC Verification',       sub:'Upload ID and get verified to ride',          primary: false, show: true },
    { key:'ratings',           icon:'⭐', title:'Ratings',                sub:'View and give commute partner reviews',       primary: false, show: true },
    { key:'community',         icon:'💬', title:'Commuter Community',     sub:'Tips, routes and campus alerts',             primary: false, show: true },
    { key:'incident-report',   icon:'🚨', title:'Report Incident',        sub:'Report a safety concern from a commute',     primary: false, show: isProvider || isSeeker },
    { key:'profile',           icon:'👤', title:'My Profile',             sub:'View your details and verification status',  primary: false, show: true },
    { key:'admin',             icon:'⚙️', title:'Admin Dashboard',        sub:'Manage users, KYC and incidents',            primary: false, show: user?.role === 'admin' },
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
          <p style={{marginTop:14,fontSize:12,color:'#555',fontStyle:'italic',letterSpacing:'.03em'}}>
            The commute matching platform for Indian campuses
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
          { icon:'📍', label:'Route-matched commuters' },
          { icon:'💰', label:'Transparent cost-sharing' },
          { icon:'🔔', label:'Real-time booking status' },
          { icon:'🚶', label:'Walk-together matching' },
          { icon:'📅', label:'Scheduled & instant rides' },
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
            { n:'01', t:'Register & verify',     d:'Sign up with your college email. Upload ID for trust and safety.' },
            { n:'02', t:'Match your commute',    d:'Search by route. Providers post their daily path. Seekers find their match.' },
            { n:'03', t:'Book & confirm',        d:'Request a seat or a walking partner. Get confirmed in real time.' },
            { n:'04', t:'Commute & split',       d:'Meet at pickup. Share the journey and split the cost transparently.' },
          ].map(s => (
            <div key={s.n} className="how-card">
              <div className="how-n">{s.n}</div>
              <div className="how-t">{s.t}</div>
              <div className="how-d">{s.d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Platform identity footer */}
      <div style={{textAlign:'center',padding:'32px 16px',borderTop:'1px solid #1a1d24',marginTop:8}}>
        <div style={{fontSize:11,color:'#444',letterSpacing:'.12em',textTransform:'uppercase',fontWeight:700,marginBottom:6}}>
          CampusRide
        </div>
        <div style={{fontSize:13,color:'#555'}}>
          The operating system for daily commuting in Indian cities
        </div>
      </div>

    </div>
  );
}
