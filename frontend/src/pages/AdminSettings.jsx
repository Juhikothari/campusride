import React, { useState, useEffect } from 'react';
import * as api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function AdminSettings({ navigate }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState({});
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (user?.role !== 'admin') return (
    <div className="narrow-wrap fade-up" style={{textAlign:'center', paddingTop:80}}>
      <div style={{fontSize:48}}>🔒</div>
      <h2 className="heading mt-20">Admin Only</h2>
      <p className="text-muted mt-8">You do not have permission to access this page.</p>
    </div>
  );

  useEffect(() => {
    api.getAdminSettings()
      .then(d => setSettings(d || {}))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      await api.setAdminSetting(key, value);
      setSettings(s => ({ ...s, [key]: value }));
      setSuccess(`Setting "${key}" saved.`);
      setKey(''); setValue('');
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="narrow-wrap fade-up">
      <h1 className="heading mb-4" style={{fontSize:28}}>Admin Settings</h1>
      <p className="text-muted mb-24 text-sm">Configure platform-wide settings.</p>

      {error   && <div className="alert alert-error mb-16">{error}</div>}
      {success && <div className="alert alert-success mb-16" style={{background:'#1e3a1e',color:'#a0f4a0',border:'1px solid #2e5a2e',borderRadius:8,padding:12}}>{success}</div>}

      <div style={{background:'#1a1a2e', border:'1px solid #333', borderRadius:12, padding:20, marginBottom:24}}>
        <h3 style={{color:'#fff', marginBottom:16, fontSize:16}}>Set a Setting</h3>
        <form onSubmit={handleSave}>
          <div className="grid-2">
            <div className="field"><label>Key</label>
              <input className="input" placeholder="e.g. allowWalking" value={key} onChange={e => setKey(e.target.value)} required /></div>
            <div className="field"><label>Value</label>
              <input className="input" placeholder="e.g. true" value={value} onChange={e => setValue(e.target.value)} required /></div>
          </div>
          <button type="submit" className="btn btn-primary btn-full">Save Setting</button>
        </form>
      </div>

      <div>
        <h3 style={{color:'#fff', marginBottom:12}}>Current Settings</h3>
        {loading ? <p className="text-muted">Loading...</p> : Object.keys(settings).length === 0 ? (
          <p className="text-muted text-sm">No settings configured yet.</p>
        ) : (
          Object.entries(settings).map(([k, v]) => (
            <div key={k} style={{background:'#1a1a2e', border:'1px solid #333', borderRadius:8, padding:'12px 16px', marginBottom:8, display:'flex', justifyContent:'space-between'}}>
              <span style={{color:'#aaa', fontFamily:'monospace'}}>{k}</span>
              <span style={{color:'#fff', fontWeight:600}}>{String(v)}</span>
            </div>
          ))
        )}

        <div style={{marginTop:20, background:'#1a1a2e', border:'1px solid #6c63ff33', borderRadius:10, padding:16}}>
          <h4 style={{color:'#6c63ff', marginBottom:8, fontSize:14}}>Common Settings</h4>
          <div style={{color:'#888', fontSize:13}}>
            <p style={{marginBottom:4}}><code style={{color:'#aaa'}}>allowWalking</code> — true/false: Allow walking as transport option in search</p>
            <p><code style={{color:'#aaa'}}>maxRideDistance</code> — number: Max km for ride search radius</p>
          </div>
        </div>
      </div>
    </div>
  );
}
