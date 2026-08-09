import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import './Navbar.css';

export default function Navbar({ navigate, currentPage }) {
  const { user, logout } = useAuth();
  const [menuOpen,   setMenuOpen]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dropRef = useRef(null);

  const isProvider = user?.role === 'provider' || user?.role === 'both';
  const isSeeker   = user?.role === 'seeker'   || user?.role === 'both';
  const isAdmin    = user?.role === 'admin';

  const hideBackButtonPages = ['login','register','dashboard'];
  const [previousPage, setPreviousPage] = useState(null);

  useEffect(() => {
    const prev = sessionStorage.getItem("previousPage");
    if (prev) setPreviousPage(prev);
    sessionStorage.setItem("previousPage", currentPage);
  }, [currentPage]);

  const handleBack = () => {
    const prev = sessionStorage.getItem("previousPage");
    if (prev && prev !== currentPage) navigate(prev);
    else navigate('dashboard');
  };

  const links = [
    { key: 'dashboard',         label: 'Home',            icon: '⊞',  show: true },
    { key: 'admin',             label: 'Admin Dashboard', icon: '🛠️', show: isAdmin },
    { key: 'search-rides',      label: 'Find a Ride',     icon: '🔍', show: isSeeker },
    { key: 'create-ride',       label: 'Offer Ride',      icon: '＋', show: isProvider },
    { key: 'my-bookings',       label: 'My Bookings',     icon: '📋', show: isSeeker },
    { key: 'provider-bookings', label: 'Manage Requests', icon: '📬', show: isProvider },
    { key: 'notifications',     label: 'Notifications',   icon: '🔔', show: true },
    { key: 'incident-report',   label: 'Incidents',       icon: '⚠️', show: isProvider || isSeeker },
    { key: 'admin-settings',    label: 'Admin Settings',  icon: '⚙️', show: isAdmin },
  ].filter(l => l.show);

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target))
        setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const go = (key) => {
    sessionStorage.setItem("previousPage", currentPage);
    navigate(key);
    setMobileOpen(false);
    setMenuOpen(false);
  };

  const handleLogout = () => { logout(); navigate('login'); };

  return (
    <>
      <nav className="navbar">
        <div className="nav-inner">
          {!hideBackButtonPages.includes(currentPage) && (
            <button className="back-btn" onClick={handleBack}>❮</button>
          )}

          <button className="nav-logo" onClick={() => go('dashboard')}
            style={{display:'flex',flexDirection:'column',alignItems:'flex-start',gap:2,background:'none',border:'none',cursor:'pointer',padding:0}}>
            <span style={{fontFamily:'var(--font-display,Syne,sans-serif)',fontWeight:800,fontSize:20,color:'#fff'}}>
              Campus<span style={{color:'#f5a623'}}>Ride</span>
            </span>
            <span style={{fontSize:8,color:'#444',fontWeight:400,letterSpacing:'.05em',fontStyle:'italic',lineHeight:1}}>
              commute matching platform
            </span>
          </button>

          <div className="nav-links">
            {links.map(l => (
              <button key={l.key}
                className={`nav-link ${currentPage===l.key?'active':''}`}
                onClick={() => go(l.key)}>
                <span className="nl-icon">{l.icon}</span>{l.label}
              </button>
            ))}
          </div>

          <div className="nav-right">
            <div className="user-pill" ref={dropRef} onClick={() => setMenuOpen(o => !o)}>
              <div className="user-ava">{user?.name?.charAt(0)?.toUpperCase()}</div>
              <div className="user-meta hide-mobile">
                <span className="user-name-txt">{user?.name}</span>
                <span className="user-role-txt capitalize">{user?.role}</span>
              </div>
              <svg className="chevron-icon" width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>

              {menuOpen && (
                <div className="user-dropdown fade-in">
                  <div className="dd-header">
                    <div className="dd-name">{user?.name}</div>
                    <div className="text-dim text-xs">{user?.email}</div>
                    <div className="text-dim text-xs mt-4">{user?.college}</div>
                  </div>
                  <div className="dd-sep"/>
                  <button className="dd-item" onClick={() => go('walk-together')}>
                    <span>🚶</span> Walk Together
                  </button>
                  <button className="dd-item" onClick={() => go('whats-my-route')}>
                    <span>🗺️</span> What's My Route?
                  </button>
                  <button className="dd-item" onClick={() => go('community')}>
                    <span>💬</span> Community
                  </button>
                  <div className="dd-sep"/>
                  <button className="dd-item" onClick={() => go('profile')}>
                    <span>👤</span> My Profile
                  </button>
                  <button className="dd-item" onClick={() => go('kyc')}>
                    <span>🪪</span> KYC Verification
                  </button>
                  <button className="dd-item" onClick={() => go('ratings')}>
                    <span>⭐</span> Ratings
                  </button>
                  <button className="dd-item" onClick={() => go('incident-report')}>
                    <span>🚨</span> Report Incident
                  </button>
                  {user?.role === 'admin' && (
                    <>
                      <button className="dd-item" onClick={() => go('admin')}>
                        <span>⚙️</span> Admin Dashboard
                      </button>
                      <button className="dd-item" onClick={() => go('admin-settings')}>
                        <span>🛠️</span> Admin Settings
                      </button>
                    </>
                  )}
                  <div className="dd-sep"/>
                  <button className="dd-item" onClick={handleLogout}>
                    <span>⬡</span> Sign out
                  </button>
                </div>
              )}
            </div>

            {/* Notification bell — between profile and menu */}
            <button
              onClick={() => go('notifications')}
              aria-label="Notifications"
              style={{
                background: currentPage === 'notifications' ? 'rgba(245,166,35,0.15)' : 'transparent',
                border: 'none', cursor: 'pointer',
                padding: '6px 8px', borderRadius: 8,
                position: 'relative', display: 'flex', alignItems: 'center',
              }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={currentPage==='notifications'?'#f5a623':'#888'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </button>

            <button className="hamburger" onClick={() => setMobileOpen(o => !o)} aria-label="Menu">
              {mobileOpen
                ? <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                : <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect y="4" width="20" height="1.8" rx=".9" fill="currentColor"/><rect y="9.1" width="20" height="1.8" rx=".9" fill="currentColor"/><rect y="14.2" width="20" height="1.8" rx=".9" fill="currentColor"/></svg>
              }
            </button>
          </div>
        </div>
      </nav>

      {mobileOpen && (
        <div className="mobile-menu fade-in">
          {links.map(l => (
            <button key={l.key}
              className={`mobile-link ${currentPage===l.key?'active':''}`}
              onClick={() => go(l.key)}>
              <span>{l.icon}</span> {l.label}
            </button>
          ))}
          <div className="dd-sep" style={{margin:'8px 16px'}}/>
          <button className="mobile-link" onClick={() => go('walk-together')}>
            <span>🚶</span> Walk Together
          </button>
          <button className="mobile-link" onClick={() => go('whats-my-route')}>
            <span>🗺️</span> What's My Route?
          </button>
          <button className="mobile-link" onClick={() => go('community')}>
            <span>💬</span> Community
          </button>
          <div className="dd-sep" style={{margin:'8px 16px'}}/>
          <button className="mobile-link" onClick={() => go('profile')}>
            <span>👤</span> My Profile
          </button>
          <button className="mobile-link" onClick={() => go('kyc')}>
            <span>🪪</span> KYC Verification
          </button>
          <button className="mobile-link" onClick={() => go('ratings')}>
            <span>⭐</span> Ratings
          </button>
          <button className="mobile-link" onClick={() => go('incident-report')}>
            <span>🚨</span> Report Incident
          </button>
          {user?.role === 'admin' && (
            <>
              <button className="mobile-link" onClick={() => go('admin')}>
                <span>⚙️</span> Admin Dashboard
              </button>
              <button className="mobile-link" onClick={() => go('admin-settings')}>
                <span>🛠️</span> Admin Settings
              </button>
            </>
          )}
          <div className="dd-sep" style={{margin:'8px 16px'}}/>
          <button className="mobile-link" onClick={handleLogout}>
            <span>⬡</span> Sign out
          </button>
        </div>
      )}
    </>
  );
}
