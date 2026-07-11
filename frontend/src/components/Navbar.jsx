import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import './Navbar.css';

export default function Navbar({ navigate, currentPage }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dropRef = useRef(null);

  const isProvider = user?.role === 'provider' || user?.role === 'both';
  const isSeeker   = user?.role === 'seeker'   || user?.role === 'both';
  const isAdmin    = user?.role === 'admin';

  // ===============================
  // BACK BUTTON LOGIC (FIXED)
  // ===============================
  const hideBackButtonPages = ['login','register','dashboard'];

  const [previousPage, setPreviousPage] = useState(null);

  useEffect(() => {
    const prev = sessionStorage.getItem("previousPage");
    if (prev) setPreviousPage(prev);

    sessionStorage.setItem("previousPage", currentPage);
  }, [currentPage]);

  const handleBack = () => {
    const prev = sessionStorage.getItem("previousPage");

    if (prev && prev !== currentPage) {
      navigate(prev);
    } else {
      navigate('dashboard');
    }
  };
  // ===============================


  const links = [
    { key: 'dashboard',          label: 'Home',            icon: '⊞', show: true },
    { key: 'admin', label: 'Admin Dashboard', icon: '🛠️', show: isAdmin },
    { key: 'search-rides',       label: 'Find a Ride',     icon: '🔍', show: isSeeker },
    { key: 'create-ride',        label: 'Offer Ride',      icon: '＋', show: isProvider },
    { key: 'my-bookings',        label: 'My Bookings',     icon: '📋', show: isSeeker },
    { key: 'provider-bookings',  label: 'Manage Requests', icon: '📬', show: isProvider },
    { key: 'notifications', label: 'Notifications', icon: '🔔', show: true }, 
    //{ key: 'route-alerts',       label: 'Route Alerts',    icon: '🔔', show: true },
    { key: 'incident-report',    label: 'Incidents',       icon: '⚠️', show: isProvider || isSeeker },
    { key: 'admin-settings',     label: 'Admin Settings',  icon: '⚙️', show: isAdmin },
  ].filter(l => l.show);

  /*const links = [
  { key: 'dashboard', label: 'Home', icon: '⊞', show: true },
  { key: 'search-rides', label: 'Find a Ride', icon: '🔍', show: isSeeker },
  { key: 'create-ride', label: 'Offer Ride', icon: '＋', show: isProvider },
  { key: 'my-bookings', label: 'My Bookings', icon: '📋', show: isSeeker },
  { key: 'provider-bookings', label: 'Manage Requests', icon: '📬', show: isProvider },

  { key: 'notifications', label: 'Notifications', icon: '🔔', show: true },  // ✅ ADD THIS

  { key: 'route-alerts', label: 'Route Alerts', icon: '🔔', show: true },
  { key: 'incident-report', label: 'Incidents', icon: '⚠️', show: true },
  { key: 'admin-settings', label: 'Admin Settings', icon: '⚙️', show: isAdmin },
];*/

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

  const handleLogout = () => {
    logout();
    navigate('login');
  };

  return (
    <>
      <nav className="navbar">
        <div className="nav-inner">

          {/* BACK BUTTON */}
          {!hideBackButtonPages.includes(currentPage) && (
            <button className="back-btn" onClick={handleBack}>
              ❮
            </button>
          )}

          <button className="nav-logo" onClick={() => go('dashboard')}>
            Campus<span>Ride</span>
          </button>

          <div className="nav-links">
            {links.map(l => (
              <button
                key={l.key}
                className={`nav-link ${currentPage === l.key ? 'active' : ''}`}
                onClick={() => go(l.key)}
              >
                <span className="nl-icon">{l.icon}</span>
                {l.label}
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

                  <div className="dd-sep" />

                  <button className="dd-item" onClick={handleLogout}>
                    <span>⬡</span> Sign out
                  </button>
                </div>
              )}
            </div>

            <button className="hamburger" onClick={() => setMobileOpen(o => !o)} aria-label="Menu">
              {mobileOpen
                ? <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                : <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect y="4" width="20" height="1.8" rx="0.9" fill="currentColor"/><rect y="9.1" width="20" height="1.8" rx="0.9" fill="currentColor"/><rect y="14.2" width="20" height="1.8" rx="0.9" fill="currentColor"/></svg>
              }
            </button>
          </div>

        </div>
      </nav>

      {mobileOpen && (
        <div className="mobile-menu fade-in">
          {links.map(l => (
            <button
              key={l.key}
              className={`mobile-link ${currentPage === l.key ? 'active' : ''}`}
              onClick={() => go(l.key)}
            >
              <span>{l.icon}</span> {l.label}
            </button>
          ))}

          <div className="dd-sep" style={{margin:'8px 16px'}} />

          <button className="mobile-link" onClick={handleLogout}>
            <span>⬡</span> Sign out
          </button>
        </div>
      )}
    </>
  );
}