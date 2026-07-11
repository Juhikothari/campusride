import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import './AdminDashboard.css';

// Strip any trailing /api from the env var, then always add /api ourselves
const _rawBase = import.meta.env?.VITE_API_URL || 'http://localhost:5000';
const API_BASE = _rawBase.replace(/\/api\/?$/, '') + '/api';

function getToken() { return localStorage.getItem('cr_token') || ''; }

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}`, ...(opts.headers || {}) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || `Error ${res.status}`);
  return data;
}

/* ─── CSS ───────────────────────────────────────────────────────── */
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap');

  .ad-wrap {
    max-width: 1140px; margin: 0 auto;
    padding: 40px 28px 100px;
    font-family: 'Sora', sans-serif;
    color: rgba(255,255,255,0.88);
  }

  /* ── Header ── */
  .ad-header {
    display: flex; align-items: flex-end; justify-content: space-between;
    margin-bottom: 36px; gap: 20px; flex-wrap: wrap;
  }
  .ad-eyebrow { font-size: 10px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: #f59e0b; margin-bottom: 8px; }
  .ad-title {
    font-family: 'Instrument Serif', serif;
    font-size: 42px; font-weight: 400; margin: 0; line-height: 1;
    color: rgba(255,255,255,0.95);
  }
  .ad-sub { font-size: 13px; color: rgba(255,255,255,0.32); margin-top: 6px; }
  .ad-live-dot {
    display: inline-flex; align-items: center; gap: 7px;
    font-size: 12px; font-weight: 600; color: #22c55e;
    background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.2);
    padding: 6px 14px; border-radius: 20px;
  }
  .ad-live-dot::before {
    content: ''; width: 7px; height: 7px; border-radius: 50%;
    background: #22c55e; box-shadow: 0 0 6px #22c55e;
    animation: pulse 2s infinite;
  }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }

  /* ── KPI row — 4 main cards + 2 alert pills ── */
  .ad-kpi-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px; margin-bottom: 14px;
  }
  .ad-kpi-alerts {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 14px; margin-bottom: 32px;
  }
  .ad-kpi {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 18px; padding: 22px 24px;
    position: relative; overflow: hidden;
    transition: border-color 0.2s, transform 0.15s;
  }
  .ad-kpi:hover { border-color: rgba(255,255,255,0.15); transform: translateY(-1px); }
  .ad-kpi::after {
    content: ''; position: absolute;
    bottom: 0; left: 0; right: 0; height: 3px;
    border-radius: 0 0 18px 18px;
  }
  .ad-kpi-users::after    { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
  .ad-kpi-rides::after    { background: linear-gradient(90deg, #22c55e, #4ade80); }
  .ad-kpi-bookings::after { background: linear-gradient(90deg, #60a5fa, #93c5fd); }
  .ad-kpi-completed::after{ background: linear-gradient(90deg, #2dd4bf, #5eead4); }
  .ad-kpi-icon {
    font-size: 22px; margin-bottom: 14px;
    width: 44px; height: 44px; border-radius: 12px;
    background: rgba(255,255,255,0.06);
    display: flex; align-items: center; justify-content: center;
  }
  .ad-kpi-val {
    font-size: 44px; font-weight: 800; line-height: 1;
    margin-bottom: 5px; letter-spacing: -0.02em;
  }
  .ad-kpi-users    .ad-kpi-val { color: #f59e0b; }
  .ad-kpi-rides    .ad-kpi-val { color: #22c55e; }
  .ad-kpi-bookings .ad-kpi-val { color: #60a5fa; }
  .ad-kpi-completed.ad-kpi-val { color: #2dd4bf; }
  .ad-kpi-label { font-size: 12px; color: rgba(255,255,255,0.4); font-weight: 600; }
  .ad-kpi-sub { font-size: 11px; color: rgba(255,255,255,0.25); margin-top: 3px; }

  /* Alert pills (KYC + Incidents) */
  .ad-alert-pill {
    border-radius: 16px; padding: 18px 22px;
    display: flex; align-items: center; gap: 16px;
    border: 1px solid; cursor: default;
    transition: border-color 0.2s;
  }
  .ad-pill-kyc {
    background: rgba(245,158,11,0.06); border-color: rgba(245,158,11,0.18);
  }
  .ad-pill-inc {
    background: rgba(239,68,68,0.06); border-color: rgba(239,68,68,0.18);
  }
  .ad-pill-icon { font-size: 28px; flex-shrink: 0; }
  .ad-pill-val { font-size: 32px; font-weight: 800; line-height: 1; }
  .ad-pill-kyc .ad-pill-val { color: #fcd34d; }
  .ad-pill-inc .ad-pill-val { color: #fca5a5; }
  .ad-pill-label { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.5); margin-top: 3px; }

  /* ── Tabs ── */
  .ad-tabs {
    display: flex; gap: 2px; margin-bottom: 28px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  .ad-tab {
    padding: 11px 20px; border: none; border-bottom: 2px solid transparent;
    font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all 0.2s;
    background: transparent; color: rgba(255,255,255,0.32);
    white-space: nowrap; margin-bottom: -1px;
  }
  .ad-tab:hover { color: rgba(255,255,255,0.65); }
  .ad-tab.active { color: #f59e0b; border-bottom-color: #f59e0b; }

  /* ── Overview grid ── */
  .ad-ov-grid {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 16px; margin-bottom: 24px;
  }
  .ad-ov-card {
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 16px; padding: 22px 24px;
  }
  .ad-ov-card-title {
    font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
    color: rgba(255,255,255,0.3); margin-bottom: 16px;
    display: flex; align-items: center; gap: 7px;
  }
  .ad-ov-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  .ad-ov-row:last-child { border-bottom: none; }
  .ad-ov-row-label { font-size: 13px; color: rgba(255,255,255,0.55); }
  .ad-ov-row-val { font-size: 14px; font-weight: 700; color: rgba(255,255,255,0.88); }

  /* ── Search ── */
  .ad-search {
    width: 100%; box-sizing: border-box;
    padding: 11px 16px; margin-bottom: 14px;
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px; font-family: 'Sora', sans-serif; font-size: 13px;
    color: rgba(255,255,255,0.88); outline: none; transition: border-color 0.2s;
  }
  .ad-search:focus { border-color: rgba(245,158,11,0.4); }
  .ad-search::placeholder { color: rgba(255,255,255,0.2); }

  /* ── Filter chips ── */
  .ad-filter-row { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
  .ad-filter-btn {
    padding: 5px 14px; border-radius: 20px; font-size: 12px; font-weight: 600;
    cursor: pointer; transition: all 0.15s; border: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.4);
    font-family: 'Sora', sans-serif;
  }
  .ad-filter-btn.active { background: rgba(245,158,11,0.12); border-color: rgba(245,158,11,0.3); color: #f59e0b; }

  /* ── Table ── */
  .ad-table-wrap { overflow-x: auto; border-radius: 14px; border: 1px solid rgba(255,255,255,0.08); }
  .ad-table { width: 100%; border-collapse: collapse; }
  .ad-table th {
    padding: 11px 16px; text-align: left;
    font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
    color: rgba(255,255,255,0.28); background: rgba(255,255,255,0.02);
    border-bottom: 1px solid rgba(255,255,255,0.07); white-space: nowrap;
  }
  .ad-table td {
    padding: 13px 16px; font-size: 13px;
    border-bottom: 1px solid rgba(255,255,255,0.05); vertical-align: middle;
  }
  .ad-table tr:last-child td { border-bottom: none; }
  .ad-table tr:hover td { background: rgba(255,255,255,0.02); }

  /* User cells */
  .ad-user-cell { display: flex; align-items: center; gap: 10px; }
  .ad-avatar {
    width: 34px; height: 34px; border-radius: 50%;
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: #1a0f00; font-weight: 800; font-size: 13px;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .ad-avatar.suspended { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.3); }
  .ad-user-name { font-weight: 600; font-size: 13px; }
  .ad-user-email { font-size: 11px; color: rgba(255,255,255,0.32); margin-top: 1px; }

  /* Badges */
  .ad-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
  .ad-badge-provider { background: rgba(96,165,250,0.1); color: #60a5fa; border: 1px solid rgba(96,165,250,0.2); }
  .ad-badge-seeker   { background: rgba(167,139,250,0.1); color: #a78bfa; border: 1px solid rgba(167,139,250,0.2); }
  .ad-badge-both     { background: rgba(245,158,11,0.1); color: #f59e0b; border: 1px solid rgba(245,158,11,0.2); }
  .ad-badge-active   { background: rgba(34,197,94,0.1); color: #86efac; border: 1px solid rgba(34,197,94,0.2); }
  .ad-badge-suspended{ background: rgba(239,68,68,0.1); color: #fca5a5; border: 1px solid rgba(239,68,68,0.2); }
  .ad-badge-pending  { background: rgba(245,158,11,0.1); color: #fcd34d; border: 1px solid rgba(245,158,11,0.2); }
  .ad-badge-approved { background: rgba(34,197,94,0.1); color: #86efac; border: 1px solid rgba(34,197,94,0.2); }
  .ad-badge-rejected { background: rgba(239,68,68,0.1); color: #fca5a5; border: 1px solid rgba(239,68,68,0.2); }
  .ad-badge-open     { background: rgba(245,158,11,0.1); color: #fcd34d; border: 1px solid rgba(245,158,11,0.2); }
  .ad-badge-exported { background: rgba(34,197,94,0.1); color: #86efac; border: 1px solid rgba(34,197,94,0.2); }
  .ad-badge-high     { background: rgba(239,68,68,0.12); color: #fca5a5; border: 1px solid rgba(239,68,68,0.25); }
  .ad-badge-critical { background: rgba(220,38,38,0.2); color: #f87171; border: 1px solid rgba(220,38,38,0.4); }
  .ad-badge-medium   { background: rgba(245,158,11,0.1); color: #fcd34d; border: 1px solid rgba(245,158,11,0.2); }
  .ad-badge-low      { background: rgba(34,197,94,0.08); color: #86efac; border: 1px solid rgba(34,197,94,0.15); }
  .ad-badge-ride-active    { background: rgba(34,197,94,0.1); color: #86efac; border: 1px solid rgba(34,197,94,0.2); }
  .ad-badge-ride-completed { background: rgba(99,102,241,0.1); color: #a5b4fc; border: 1px solid rgba(99,102,241,0.2); }
  .ad-badge-ride-cancelled { background: rgba(239,68,68,0.1); color: #fca5a5; border: 1px solid rgba(239,68,68,0.2); }
  .ad-badge-ride-progress  { background: rgba(245,158,11,0.1); color: #fcd34d; border: 1px solid rgba(245,158,11,0.2); }

  /* Action buttons */
  .ad-btn-suspend  { padding: 5px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: 'Sora', sans-serif; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); color: #fca5a5; transition: background 0.15s; }
  .ad-btn-suspend:hover  { background: rgba(239,68,68,0.2); }
  .ad-btn-activate { padding: 5px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: 'Sora', sans-serif; background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.2); color: #86efac; transition: background 0.15s; }
  .ad-btn-activate:hover { background: rgba(34,197,94,0.2); }
  .ad-btn-approve  { padding: 5px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: 'Sora', sans-serif; background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.2); color: #86efac; transition: background 0.15s; }
  .ad-btn-approve:hover  { background: rgba(34,197,94,0.2); }
  .ad-btn-reject   { padding: 5px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: 'Sora', sans-serif; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.18); color: #fca5a5; }
  .ad-btn-reject:hover   { background: rgba(239,68,68,0.18); }
  .ad-btn-delete   { padding: 5px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: 'Sora', sans-serif; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.18); color: #fca5a5; }
  .ad-actions { display: flex; gap: 8px; }

  /* KYC docs */
  .ad-doc-link { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: #60a5fa; text-decoration: none; padding: 3px 8px; border-radius: 6px; background: rgba(96,165,250,0.08); border: 1px solid rgba(96,165,250,0.15); }

  /* Misc */
  .ad-empty   { text-align: center; padding: 60px 20px; color: rgba(255,255,255,0.25); font-size: 13px; }
  .ad-loading { text-align: center; padding: 60px 20px; color: rgba(255,255,255,0.25); font-size: 13px; }
  .ad-toast { padding: 12px 16px; border-radius: 10px; font-size: 13px; font-weight: 500; margin-bottom: 20px; animation: fadeIn 0.2s ease; }
  @keyframes fadeIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
  .ad-toast-ok  { background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.2); color: #86efac; }
  .ad-toast-err { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); color: #fca5a5; }
  .ad-route { display: flex; align-items: center; gap: 5px; font-size: 12px; }
  .ad-route-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .ad-pagination { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; align-items: center; }
  .ad-page-btn { padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: 'Sora', sans-serif; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.5); }
  .ad-page-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .ad-page-info { font-size: 12px; color: rgba(255,255,255,0.3); }

  @media (max-width: 900px) { .ad-kpi-row { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 600px) {
    .ad-kpi-row, .ad-kpi-alerts, .ad-ov-grid { grid-template-columns: 1fr; }
    .ad-title { font-size: 32px; }
    .ad-wrap { padding: 24px 16px 80px; }
  }
  .ad-btn-block {
  padding: 5px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  font-family: 'Sora', sans-serif;

  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.18);
  color: #fca5a5;

  transition: background 0.15s;
}

.ad-btn-block:hover {
  background: rgba(239, 68, 68, 0.18);
}
`;

/* ─── Main ───────────────────────────────────────────────────────── */
export default function AdminDashboard({ navigate }) {
  const { user } = useAuth();

  if (user?.role !== 'admin') {
    return (
      <div style={{ textAlign:'center', padding:'80px 20px', fontFamily:'Sora,sans-serif', color:'rgba(255,255,255,0.5)' }}>
        <div style={{ fontSize:48 }}>🚫</div>
        <div style={{ marginTop:16, fontSize:18, fontWeight:700 }}>Admin access only</div>
      </div>
    );
  }

  const [tab, setTab]               = useState('overview');
  const [stats, setStats]           = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [toast, setToast]           = useState(null);

  function notify(msg, type = 'ok') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  function refreshStats() {
    apiFetch('/admin/stats').then(setStats).catch(() => {});
  }

  useEffect(() => {
    apiFetch('/admin/stats')
      .then(setStats).catch(() => {}).finally(() => setStatsLoading(false));
  }, []);

  const L = statsLoading;
  const s = stats || {};
  const fmt = v => L ? '…' : (v ?? 0);

  return (
    <>
      <style>{css}</style>
      <div className="ad-wrap">

        {/* Header */}
        <div className="ad-header">
          <div>
            <p className="ad-eyebrow">Admin Panel</p>
            <h1 className="ad-title">Dashboard</h1>
            <p className="ad-sub">CampusRide platform overview</p>
          </div>
          <div className="ad-live-dot">Live</div>
        </div>

        {toast && (
          <div className={`ad-toast ${toast.type === 'ok' ? 'ad-toast-ok' : 'ad-toast-err'}`}>
            {toast.msg}
          </div>
        )}

        {/* KPI row — 4 main metrics */}
        <div className="ad-kpi-row">
          {[
            { cls:'ad-kpi-users',    icon:'👥', val: fmt(s.totalUsers),     label:'Total Users',     sub:`${fmt(s.totalProviders)} providers · ${fmt(s.totalSeekers)} seekers` },
            { cls:'ad-kpi-rides',    icon:'🚗', val: fmt(s.activeRides),    label:'Active Rides',    sub:`${fmt(s.completedRides)} completed all-time` },
            { cls:'ad-kpi-bookings', icon:'🎫', val: fmt(s.totalBookings),  label:'Total Bookings',  sub:'all-time across all rides' },
            { cls:'ad-kpi-completed',icon:'✅', val: fmt(s.completedRides), label:'Completed Rides', sub:'successfully finished trips' },
          ].map(k => (
            <div key={k.label} className={`ad-kpi ${k.cls}`}>
              <div className="ad-kpi-icon">{k.icon}</div>
              <div className="ad-kpi-val">{k.val}</div>
              <div className="ad-kpi-label">{k.label}</div>
              <div className="ad-kpi-sub">{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Alert pills — KYC + Incidents */}
        <div className="ad-kpi-alerts">
          <div className="ad-alert-pill ad-pill-kyc" onClick={() => setTab('kyc')} style={{cursor:'pointer'}}>
            <div className="ad-pill-icon">🪪</div>
            <div>
              <div className="ad-pill-val">{fmt(s.pendingKYC)}</div>
              <div className="ad-pill-label">KYC requests awaiting review</div>
            </div>
          </div>
          <div className="ad-alert-pill ad-pill-inc" onClick={() => setTab('incidents')} style={{cursor:'pointer'}}>
            <div className="ad-pill-icon">⚠️</div>
            <div>
              <div className="ad-pill-val">{fmt(s.openIncidents)}</div>
              <div className="ad-pill-label">Open incidents · {fmt(s.highIncidents)} high/critical</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="ad-tabs">
          {[['overview','📊 Overview'],['users','👥 Users'],['rides','🚗 Rides'],['kyc','🪪 KYC'],['incidents','⚠ Incidents']].map(([k,l]) => (
            <button key={k} className={`ad-tab${tab===k?' active':''}`} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        {tab === 'overview'  && <OverviewTab  stats={s} loading={L} setTab={setTab} />}
        {tab === 'users'     && <UsersTab     notify={notify} />}
        {tab === 'rides'     && <RidesTab     notify={notify} />}
        {tab === 'kyc'       && <KYCTab       notify={notify} onStatRefresh={refreshStats} />}
        {tab === 'incidents' && <IncidentsTab notify={notify} />}
      </div>
    </>
  );
}

/* ─── Overview ───────────────────────────────────────────────────── */
function OverviewTab({ stats: s, loading, setTab }) {
  if (loading) return <div className="ad-loading">Loading…</div>;

  return (
    <div className="ad-ov-grid">
      {/* Users breakdown */}
      <div className="ad-ov-card">
        <div className="ad-ov-card-title">👥 Users</div>
        {[
          ['Total users', s.totalUsers],
          ['Providers (offer rides)', s.totalProviders],
          ['Seekers (book rides)', s.totalSeekers],
          ['Both roles', (s.totalUsers - s.totalProviders - s.totalSeekers + (s.totalProviders > 0 && s.totalSeekers > 0 ? Math.min(s.totalProviders, s.totalSeekers) : 0)) || '—'],
        ].map(([l,v]) => (
          <div key={l} className="ad-ov-row">
            <span className="ad-ov-row-label">{l}</span>
            <span className="ad-ov-row-val">{v ?? 0}</span>
          </div>
        ))}
        <button onClick={() => setTab('users')} style={{marginTop:16,padding:'7px 16px',borderRadius:8,background:'rgba(245,158,11,0.1)',border:'1px solid rgba(245,158,11,0.2)',color:'#f59e0b',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'Sora,sans-serif'}}>
          Manage Users →
        </button>
      </div>

      {/* Rides breakdown */}
      <div className="ad-ov-card">
        <div className="ad-ov-card-title">🚗 Rides</div>
        {[
          ['Active (bookable)',  s.activeRides],
          ['In Progress',       s.totalRides - s.activeRides - s.completedRides < 0 ? 0 : s.totalRides - s.activeRides - s.completedRides],
          ['Completed',         s.completedRides],
          ['Total all-time',    s.totalRides],
        ].map(([l,v]) => (
          <div key={l} className="ad-ov-row">
            <span className="ad-ov-row-label">{l}</span>
            <span className="ad-ov-row-val">{v ?? 0}</span>
          </div>
        ))}
        <button onClick={() => setTab('rides')} style={{marginTop:16,padding:'7px 16px',borderRadius:8,background:'rgba(34,197,94,0.08)',border:'1px solid rgba(34,197,94,0.2)',color:'#86efac',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'Sora,sans-serif'}}>
          View Ride History →
        </button>
      </div>

      {/* KYC status */}
      <div className="ad-ov-card">
        <div className="ad-ov-card-title">🪪 KYC Status</div>
        {[
          ['Pending review', s.pendingKYC],
          ['Total bookings', s.totalBookings],
        ].map(([l,v]) => (
          <div key={l} className="ad-ov-row">
            <span className="ad-ov-row-label">{l}</span>
            <span className="ad-ov-row-val">{v ?? 0}</span>
          </div>
        ))}
        <button onClick={() => setTab('kyc')} style={{marginTop:16,padding:'7px 16px',borderRadius:8,background:'rgba(245,158,11,0.1)',border:'1px solid rgba(245,158,11,0.2)',color:'#f59e0b',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'Sora,sans-serif'}}>
          Review KYC →
        </button>
      </div>

      {/* Safety */}
      <div className="ad-ov-card">
        <div className="ad-ov-card-title">⚠️ Safety</div>
        {[
          ['Open incidents',            s.openIncidents],
          ['High / Critical unresolved',s.highIncidents],
        ].map(([l,v]) => (
          <div key={l} className="ad-ov-row">
            <span className="ad-ov-row-label">{l}</span>
            <span className="ad-ov-row-val" style={{color: v > 0 ? '#fca5a5' : 'rgba(255,255,255,0.88)'}}>{v ?? 0}</span>
          </div>
        ))}
        <button onClick={() => setTab('incidents')} style={{marginTop:16,padding:'7px 16px',borderRadius:8,background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.18)',color:'#fca5a5',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'Sora,sans-serif'}}>
          View Incidents →
        </button>
      </div>
    </div>
  );
}
//__________________Users Tab________________________________
function UsersTab({ notify }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState(''); // NEW: 'active', 'suspended', 'blocked'
  const [acting, setActing] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (search) p.set('search', search);
      if (roleFilter) p.set('role', roleFilter);
      if (statusFilter) p.set('blocked', statusFilter === 'blocked' ? 'true' : 'false');
      const data = await apiFetch(`/admin/users?${p}`);
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) { notify(e.message, 'err'); }
    finally { setLoading(false); }
  }, [search, roleFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function toggleSuspend(id) {
    setActing(a => ({ ...a, [id]: 'suspending' }));
    try {
      const data = await apiFetch(`/admin/users/${id}/suspend`, { method: 'PUT' });
      setUsers(prev => prev.map(u => u._id === id ? data.user : u));
      notify(data.message);
    } catch (e) { notify(e.message, 'err'); }
    finally { setActing(a => ({ ...a, [id]: null })); }
  }

  // NEW: Block user function
  async function blockUser(id) {
    const reason = prompt('Enter block reason:', 'Violation of terms');
    if (!reason) return;

    setActing(a => ({ ...a, [id]: 'blocking' }));
    try {
      const data = await apiFetch(`/admin/users/${id}/block`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
      setUsers(prev => prev.map(u => u._id === id ? { 
        ...u, 
        blocked: true, 
        suspended: true, 
        blockReason: reason,
        blockedAt: new Date()
      } : u));
      notify(data.message);
    } catch (e) { 
      notify(e.message, 'err'); 
    }
    finally { 
      setActing(a => ({ ...a, [id]: null })); 
    }
  }

  // NEW: Unblock user function
  async function unblockUser(id) {
    if (!confirm('Are you sure you want to unblock this user?')) return;

    setActing(a => ({ ...a, [id]: 'unblocking' }));
    try {
      const data = await apiFetch(`/admin/users/${id}/unblock`, { method: 'POST' });
      setUsers(prev => prev.map(u => u._id === id ? { 
        ...u, 
        blocked: false, 
        suspended: false, 
        blockReason: '',
        blockedAt: null
      } : u));
      notify(data.message);
    } catch (e) { 
      notify(e.message, 'err'); 
    }
    finally { 
      setActing(a => ({ ...a, [id]: null })); 
    }
  }

  async function deleteUser(id) {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      await apiFetch(`/admin/users/${id}`, { method: 'DELETE' });
      setUsers(prev => prev.filter(u => u._id !== id));
      notify('User deleted');
    } catch (e) {
      notify(e.message, 'err');
    }
  }

  return (
    <div>
      <input
        className="ad-search"
        placeholder="🔍  Search by name or email…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* Role Filter */}
      <div className="ad-filter-row">
        {[['', 'All'], ['provider', 'Providers'], ['seeker', 'Seekers'], ['both', 'Both']].map(([v, l]) => (
          <button
            key={v}
            className={`ad-filter-btn${roleFilter === v ? ' active' : ''}`}
            onClick={() => setRoleFilter(v)}
          >
            {l}
          </button>
        ))}
      </div>

      {loading ? <div className="ad-loading">Loading users…</div> : (
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>College</th>
                <th>KYC</th>
                <th>Rides</th>
                <th>Joined</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.25)' }}>
                    No users found
                  </td>
                </tr>
              ) : users.map(u => (
                <tr key={u._id}>
                  <td>
                    <div className="ad-user-cell">
                      <div className={`ad-avatar${u.suspended || u.blocked ? ' suspended' : ''}`}>
                        {u.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <div className="ad-user-name">{u.name}</div>
                        <div className="ad-user-email">{u.email}</div>
                      </div>
                    </div>
                  </td>

                  <td>
                    <span className={`ad-badge ad-badge-${u.role}`}>
                      {u.role}
                    </span>
                  </td>

                  <td style={{ fontSize: 12, color: 'rgba(255,255,255,0.42)', maxWidth: 140 }}>
                    {u.college || '—'}
                  </td>

                  <td>
                    <span className={`ad-badge ad-badge-${u.kycStatus === 'not_required' ? 'suspended' : u.kycStatus}`}>
                      {u.kycStatus === 'not_required' ? 'N/A' : u.kycStatus}
                    </span>
                  </td>

                  <td style={{ fontWeight: 600 }}>
                    {u.totalRides || 0}
                  </td>

                  <td style={{ fontSize: 12, color: 'rgba(255,255,255,0.32)' }}>
                    {new Date(u.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>

                  {/* UPDATED: Status column with blocked status */}
                  <td>
                    {u.blocked ? (
                      <span className="ad-badge ad-badge-blocked" title={u.blockReason}>
                        🚫 BLOCKED
                      </span>
                    ) : u.suspended ? (
                      <span className="ad-badge ad-badge-suspended">Suspended</span>
                    ) : (
                      <span className="ad-badge ad-badge-active">Active</span>
                    )}
                  </td>

                  {/* UPDATED: Actions column with block/unblock */}
                  <td>
                    <div className="ad-actions">
                      {/* Suspend/Activate - disabled if blocked */}
                      {!u.blocked && (
                        u.suspended ? (
                          <button
                            className="ad-btn-activate"
                            disabled={acting[u._id]}
                            onClick={() => toggleSuspend(u._id)}
                          >
                            {acting[u._id] === 'suspending' ? '…' : 'Activate'}
                          </button>
                        ) : (
                          <button
                            className="ad-btn-suspend"
                            disabled={acting[u._id]}
                            onClick={() => toggleSuspend(u._id)}
                          >
                            {acting[u._id] === 'suspending' ? '…' : 'Suspend'}
                          </button>
                        )
                      )}

                      {/* NEW: Block/Unblock button */}
                      {!u.blocked ? (
                        <button
                          className="ad-btn-block"
                          disabled={acting[u._id]}
                          onClick={() => blockUser(u._id)}
                          title="Block user permanently"
                        >
                          {acting[u._id] === 'blocking' ? '…' : '🚫 Block'}
                        </button>
                      ) : (
                        <button
                          className="ad-btn-activate"
                          disabled={acting[u._id]}
                          onClick={() => unblockUser(u._id)}
                          title="Unblock user"
                        >
                          {acting[u._id] === 'unblocking' ? '…' : '✓ Unblock'}
                        </button>
                      )}

                      {/* Delete button - disabled if blocked (must unblock first) */}
                      <button
                        className="ad-btn-delete"
                        onClick={() => deleteUser(u._id)}
                        disabled={u.blocked}
                        title={u.blocked ? 'Unblock before deleting' : 'Delete user'}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── Rides ──────────────────────────────────────────────────────── */
function RidesTab({ notify }) {
  const [rides,setRides]=useState([]);
  const [total,setTotal]=useState(0);
  const [pages,setPages]=useState(1);
  const [page,setPage]=useState(1);
  const [loading,setLoading]=useState(true);
  const [sf,setSf]=useState('');
  const [acting,setActing]=useState({});

  const load = useCallback(async()=>{
    setLoading(true);
    try {
      const p = new URLSearchParams({page,limit:15});
      if (sf) p.set('status',sf);
      const data = await apiFetch(`/admin/rides?${p}`);
      setRides(data.rides||[]); setTotal(data.total||0); setPages(data.pages||1);
    } catch(e) { notify(e.message,'err'); }
    finally { setLoading(false); }
  },[page,sf]);

  useEffect(()=>{ load(); },[load]);

  async function del(id) {
    if (!confirm('Delete this ride? All bookings will be cancelled.')) return;
    setActing(a=>({...a,[id]:true}));
    try {
      const data = await apiFetch(`/admin/rides/${id}`,{method:'DELETE'});
      setRides(p=>p.filter(r=>r._id!==id)); setTotal(t=>t-1); notify(data.message);
    } catch(e) { notify(e.message,'err'); }
    finally { setActing(a=>({...a,[id]:false})); }
  }

  const rb = s => ({active:'ride-active',completed:'ride-completed',cancelled:'ride-cancelled','in-progress':'ride-progress'}[s]||'ride-active');

  return (
    <div>
      <div className="ad-filter-row">
        {[['','All'],['active','Active'],['in-progress','In Progress'],['completed','Completed'],['cancelled','Cancelled']].map(([v,l])=>(
          <button key={v} className={`ad-filter-btn${sf===v?' active':''}`} onClick={()=>{setSf(v);setPage(1);}}>{l}</button>
        ))}
      </div>
      {loading ? <div className="ad-loading">Loading rides…</div> : (
        <>
          <div style={{fontSize:12,color:'rgba(255,255,255,0.28)',marginBottom:10}}>{total} ride{total!==1?'s':''}</div>
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead><tr><th>Route</th><th>Provider</th><th>Date</th><th>Time</th><th>Seats</th><th>Cost</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {rides.length===0 ? (
                  <tr><td colSpan={8} style={{textAlign:'center',padding:40,color:'rgba(255,255,255,0.25)'}}>No rides</td></tr>
                ) : rides.map(r=>{
                  const pu = r.pickup?.address || `${r.pickup?.coordinates?.[1]?.toFixed(3)}°N`;
                  const dr = r.drop?.address   || `${r.drop?.coordinates?.[1]?.toFixed(3)}°N`;
                  return (
                    <tr key={r._id}>
                      <td>
                        <div className="ad-route">
                          <span className="ad-route-dot" style={{background:'#22c55e'}} />
                          <span style={{maxWidth:90,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{pu}</span>
                          <span style={{color:'rgba(255,255,255,0.2)'}}>→</span>
                          <span className="ad-route-dot" style={{background:'#ef4444'}} />
                          <span style={{maxWidth:90,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{dr}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{fontSize:13,fontWeight:600}}>{r.providerId?.name||'—'}</div>
                        <div style={{fontSize:11,color:'rgba(255,255,255,0.32)'}}>{r.providerId?.college||r.providerId?.email||''}</div>
                      </td>
                      <td style={{fontSize:12}}>{new Date(r.date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</td>
                      <td style={{fontSize:12}}>{r.time}</td>
                      <td style={{fontWeight:600}}>{r.seatsAvailable}</td>
                      <td style={{color:'#f59e0b',fontWeight:700}}>₹{r.costPerSeat}</td>
                      <td><span className={`ad-badge ad-badge-${rb(r.status)}`}>{r.status}</span></td>
                      <td><button className="ad-btn-delete" disabled={acting[r._id]} onClick={()=>del(r._id)}>{acting[r._id]?'…':'Delete'}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {pages>1 && (
            <div className="ad-pagination">
              <button className="ad-page-btn" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>← Prev</button>
              <span className="ad-page-info">Page {page} of {pages}</span>
              <button className="ad-page-btn" disabled={page>=pages} onClick={()=>setPage(p=>p+1)}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── KYC ────────────────────────────────────────────────────────── */
function KYCTab({ notify, onStatRefresh }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [acting, setActing] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);
const openViewer = (user) => {
  setSelectedUser(user);
};

const closeViewer = () => {
  setSelectedUser(null);
};

  useEffect(() => {
    setLoading(true);
    apiFetch('/admin/users')
      .then(data => {
        const arr = Array.isArray(data) ? data : [];
        
        // FIXED: Show users with KYC status OR actual documents
        const kycUsers = arr.filter(u => {
          const hasKycStatus = ['pending', 'approved', 'rejected'].includes(u.kycStatus);
          const hasDocuments = u.kycDocuments && (
            (u.kycDocuments.aadhar && u.kycDocuments.aadhar.length > 0) ||
            (u.kycDocuments.collegeIdCard && u.kycDocuments.collegeIdCard.length > 0) ||
            (u.kycDocuments.drivingLicense && u.kycDocuments.drivingLicense.length > 0)
          );
          return hasKycStatus || hasDocuments;
        });
        
        console.log('KYC users found:', kycUsers.length, kycUsers.map(u => ({ 
          name: u.name, 
          status: u.kycStatus,
          hasDocs: !!(u.kycDocuments?.aadhar || u.kycDocuments?.collegeIdCard)
        })));
        
        setUsers(kycUsers);
      })
      .catch(e => {
        console.error('Failed to fetch users:', e);
        notify(e.message, 'err');
      })
      .finally(() => setLoading(false));
  }, []);

  async function review(id, status) {
    setActing(a => ({ ...a, [id]: status }));
    try {
      const data = await apiFetch(`/admin/kyc/${id}`, { 
        method: 'PUT', 
        body: JSON.stringify({ status }) 
      });
      setUsers(p => p.map(u => u._id === id ? { ...u, kycStatus: status } : u));
      onStatRefresh?.();
      notify(`KYC ${status} for ${data.user?.name || 'user'}`);
    } catch (e) { 
      notify(e.message, 'err'); 
    } finally { 
      setActing(a => ({ ...a, [id]: null })); 
    }
  }

  const counts = {
    all: users.length,
    pending: users.filter(u => u.kycStatus === 'pending' || !u.kycStatus).length,
    approved: users.filter(u => u.kycStatus === 'approved').length,
    rejected: users.filter(u => u.kycStatus === 'rejected').length,
  };

  useEffect(() => {
  if (selectedUser) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = 'auto';
  }
}, [selectedUser]);

  const filtered = filter === 'all' 
    ? users 
    : users.filter(u => (u.kycStatus || 'pending') === filter);

  if (loading) return <div className="ad-loading">Loading KYC requests…</div>;

  return (
  <>
    {/* MAIN CONTENT */}
    <div>

      {/* FILTER BUTTONS */}
      <div className="ad-filter-row">
        {[
          ['all', `All (${counts.all})`],
          ['pending', `Pending (${counts.pending})`],
          ['approved', `Approved (${counts.approved})`],
          ['rejected', `Rejected (${counts.rejected})`],
        ].map(([v, l]) => (
          <button
            key={v}
            className={`ad-filter-btn${filter === v ? ' active' : ''}`}
            onClick={() => setFilter(v)}
          >
            {l}
          </button>
        ))}
      </div>

      {/* TABLE / EMPTY STATE */}
      {filtered.length === 0 ? (
        <div className="ad-empty">
          <div style={{ fontSize: 36, marginBottom: 10 }}>
            {filter === 'pending' ? '✅' : '📭'}
          </div>
          {filter === 'pending'
            ? 'No pending KYC requests — all clear!'
            : `No ${filter} KYC requests.`}
        </div>
      ) : (
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>College</th>
                <th>Documents</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map(u => (
                <tr key={u._id}>
                  <td>
                    <div className="ad-user-cell">
                      <div className="ad-avatar">
                        {u.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div>
                        <div className="ad-user-name">{u.name}</div>
                        <div className="ad-user-email">{u.email}</div>
                      </div>
                    </div>
                  </td>

                  <td>
                    <span className={`ad-badge ad-badge-${u.role}`}>
                      {u.role}
                    </span>
                  </td>

                  <td style={{ fontSize: 12, color: 'rgba(255,255,255,0.42)' }}>
                    {u.college || '—'}
                  </td>

                  {/* VIEW BUTTON */}
                  <td>
                    <button
                      className="ad-btn-approve"
                      onClick={() => openViewer(u)}
                    >
                      👁 View
                    </button>
                  </td>

                  <td style={{ fontSize: 12, color: 'rgba(255,255,255,0.32)' }}>
                    {u.kycSubmittedAt
                      ? new Date(u.kycSubmittedAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })
                      : new Date(u.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}
                  </td>

                  <td>
                    <span className={`ad-badge ad-badge-${u.kycStatus || 'pending'}`}>
                      {u.kycStatus || 'pending'}
                    </span>
                  </td>

                  <td>
                    <div className="ad-actions">
                      <button
                        className="ad-btn-approve"
                        onClick={() => review(u._id, 'approved')}
                      >
                        ✓ Approve
                      </button>
                      <button
                        className="ad-btn-reject"
                        onClick={() => review(u._id, 'rejected')}
                      >
                        ✕ Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>

    {/* ✅ MODAL OUTSIDE MAIN DIV */}
    {selectedUser && (
      <div className="kyc-modal-overlay" onClick={closeViewer}>
        <div className="kyc-modal" onClick={(e) => e.stopPropagation()}>

          <div className="kyc-modal-header">
            <h3>{selectedUser.name}'s Documents</h3>
            <button onClick={closeViewer}>✕</button>
          </div>

          <div className="kyc-modal-grid">

            {selectedUser.kycDocuments?.aadhar && (
              <div className="kyc-modal-item">
                <p>Aadhar</p>
                <img
                  src={selectedUser.kycDocuments.aadhar}
                  onClick={() => window.open(selectedUser.kycDocuments.aadhar)}
                  style={{ cursor: 'pointer' }}
                />
              </div>
            )}

            {selectedUser.kycDocuments?.collegeIdCard && (
              <div className="kyc-modal-item">
                <p>College ID</p>
                <img
                  src={selectedUser.kycDocuments.collegeIdCard}
                  onClick={() => window.open(selectedUser.kycDocuments.collegeIdCard)}
                  style={{ cursor: 'pointer' }}
                />
              </div>
            )}

            {selectedUser.kycDocuments?.drivingLicense && (
              <div className="kyc-modal-item">
                <p>License</p>
                <img
                  src={selectedUser.kycDocuments.drivingLicense}
                  onClick={() => window.open(selectedUser.kycDocuments.drivingLicense)}
                  style={{ cursor: 'pointer' }}
                />
              </div>
            )}

            {selectedUser.kycDocuments?.selfie && (
              <div className="kyc-modal-item">
                <p>Selfie</p>
                <img
                  src={selectedUser.kycDocuments.selfie}
                  onClick={() => window.open(selectedUser.kycDocuments.selfie)}
                  style={{ cursor: 'pointer' }}
                />
              </div>
            )}

          </div>

        </div>
      </div>
    )}
  </>
);
}
/* ─── Incidents ──────────────────────────────────────────────────── */
function IncidentsTab({ notify }) {
  const [incidents,setIncidents]=useState([]);
  const [loading,setLoading]=useState(true);
  const [sf,setSf]=useState('');
  const [acting,setActing]=useState({});

  useEffect(() => {
    setLoading(true);
    apiFetch('/admin/incidents')
      .then(data => {
        setIncidents(Array.isArray(data) ? data : (data?.incidents || []));
      })
      .catch(e => {
        console.error('Failed to fetch incidents:', e);
        notify(e.message, 'err');
      })
      .finally(() => setLoading(false));
  }, []);

  async function upd(id,status) {
    setActing(a=>({...a,[id]:true}));
    try {
      await apiFetch(`/admin/incidents/${id}/status`,{method:'PUT',body:JSON.stringify({status})});
      setIncidents(p=>p.map(i=>i._id===id?{...i,status}:i)); notify('Status updated');
    } catch(e) { notify(e.message,'err'); }
    finally { setActing(a=>({...a,[id]:false})); }
  }

  const filtered = sf ? incidents.filter(i=>i.status===sf) : incidents;
  if (loading) return <div className="ad-loading">Loading incidents…</div>;

  return (
    <div>
      <div className="ad-filter-row">
        {[['','All'],['open','Open'],['under_review','Under Review'],['resolved','Resolved'],['exported_to_authorities','Exported']].map(([v,l])=>(
          <button key={v} className={`ad-filter-btn${sf===v?' active':''}`} onClick={()=>setSf(v)}>{l}</button>
        ))}
      </div>
      {filtered.length===0 ? <div className="ad-empty"><div style={{fontSize:36,marginBottom:10}}>✅</div>No incidents found.</div> : (
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead><tr><th>Reporter</th><th>Type</th><th>Severity</th><th>Description</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map(inc=>(
                <tr key={inc._id}>
                  <td><div className="ad-user-name">{inc.reportedBy?.name||'—'}</div><div className="ad-user-email">{inc.reportedBy?.email||''}</div></td>
                  <td style={{textTransform:'capitalize',fontSize:13}}>{inc.type?.replace(/_/g,' ')}</td>
                  <td><span className={`ad-badge ad-badge-${inc.severity}`}>{inc.severity}</span></td>
                  <td style={{fontSize:12,color:'rgba(255,255,255,0.45)',maxWidth:200}}><div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{inc.description}</div></td>
                  <td style={{fontSize:12,color:'rgba(255,255,255,0.32)'}}>{new Date(inc.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</td>
                  <td><span className={`ad-badge ad-badge-${inc.status==='exported_to_authorities'?'exported':inc.status}`}>{inc.status?.replace(/_/g,' ')}</span></td>
                  <td>
                    {inc.status==='open' && <button className="ad-btn-approve" disabled={acting[inc._id]} onClick={()=>upd(inc._id,'under_review')}>Review</button>}
                    {inc.status==='under_review' && <div className="ad-actions"><button className="ad-btn-approve" disabled={acting[inc._id]} onClick={()=>upd(inc._id,'resolved')}>Resolve</button><button className="ad-btn-suspend" disabled={acting[inc._id]} onClick={()=>upd(inc._id,'exported_to_authorities')}>Export</button></div>}
                    {(inc.status==='resolved'||inc.status==='exported_to_authorities') && <span style={{fontSize:12,color:'rgba(255,255,255,0.22)'}}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}