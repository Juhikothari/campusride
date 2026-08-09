// frontend/src/pages/ProfilePage.jsx
// Read-only profile page. Only phone number is editable, once per 90 days.
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getProfile, updatePhoneNumber } from '../services/api.js';
import './ProfilePage.css';

const ROLE_LABEL = { provider: 'Provider', seeker: 'Seeker', both: 'Provider & Seeker', admin: 'Admin' };
const KYC_COLOR  = { approved: '#2dd4a0', pending: '#f5a623', rejected: '#e53935', not_submitted: '#888', not_required: '#888' };

export default function ProfilePage({ navigate }) {
  const { user: authUser } = useAuth();
  const [profile, setProfile]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error,   setError]       = useState('');

  // Phone edit state
  const [editingPhone, setEditingPhone] = useState(false);
  const [newPhone,     setNewPhone]     = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneMsg,     setPhoneMsg]     = useState('');
  const [phoneError,   setPhoneError]   = useState('');

  useEffect(() => {
    getProfile()
      .then(p => { setProfile(p); setNewPhone(p.phone || ''); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handlePhoneSave = async () => {
    setPhoneError('');
    setPhoneMsg('');
    if (!/^\d{10}$/.test(newPhone.replace(/\s/g, ''))) {
      setPhoneError('Enter a valid 10-digit phone number.');
      return;
    }
    setPhoneLoading(true);
    try {
      const res = await updatePhoneNumber(newPhone.replace(/\s/g, ''));
      setProfile(p => ({ ...p, phone: res.phone, canChangePhone: false, phoneChangeCooldownDaysLeft: 90 }));
      setPhoneMsg('Phone number updated successfully.');
      setEditingPhone(false);
    } catch (e) {
      setPhoneError(e.message || 'Failed to update phone number.');
    } finally {
      setPhoneLoading(false);
    }
  };

  if (loading) return (
    <div className="profile-page fade-up" style={{ paddingTop: 80, textAlign: 'center' }}>
      <div style={{ fontSize: 32 }}>⏳</div>
      <p className="text-muted mt-12">Loading profile…</p>
    </div>
  );

  if (error) return (
    <div className="profile-page fade-up" style={{ paddingTop: 60, textAlign: 'center' }}>
      <p style={{ color: '#e53935' }}>{error}</p>
      <button className="btn btn-primary mt-16" onClick={() => navigate('dashboard')}>Back</button>
    </div>
  );

  const p = profile;
  const initials = (p?.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="profile-page fade-up">
      <div className="profile-hero">
        {/* Avatar */}
        <div className="profile-avatar">
          {p?.profilePhoto
            ? <img src={p.profilePhoto} alt="Profile" className="profile-avatar-img" />
            : <div className="profile-avatar-initials">{initials}</div>
          }
        </div>

        <h1 className="profile-name">{p?.name}</h1>
        {p?.college && <p className="profile-college">🏫 {p.college}</p>}
      </div>

      {/* Details card */}
      <div className="profile-card">
        <h2 className="profile-section-title">Personal Information</h2>
        <p className="profile-readonly-note">ℹ️ Your information is read-only. Contact support to change name or email.</p>

        <div className="profile-field">
          <span className="profile-field-label">Full Name</span>
          <span className="profile-field-value">{p?.name || '—'}</span>
        </div>

        <div className="profile-field">
          <span className="profile-field-label">Email Address</span>
          <span className="profile-field-value">{p?.email || '—'}</span>
        </div>

        <div className="profile-field">
          <span className="profile-field-label">USN / Roll Number</span>
          <span className="profile-field-value">{p?.usn || '—'}</span>
        </div>

        <div className="profile-field">
          <span className="profile-field-label">Gender</span>
          <span className="profile-field-value" style={{ textTransform: 'capitalize' }}>
            {p?.gender?.replace(/_/g, ' ') || '—'}
          </span>
        </div>

        {/* Phone — editable once per 90 days */}
        <div className="profile-field profile-field-phone">
          <span className="profile-field-label">Phone Number</span>
          <div className="profile-phone-wrap">
            {editingPhone ? (
              <>
                <input
                  className="profile-phone-input"
                  type="tel"
                  maxLength={10}
                  value={newPhone}
                  onChange={e => { setNewPhone(e.target.value.replace(/\D/g, '')); setPhoneError(''); }}
                  placeholder="10-digit number"
                  autoFocus
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handlePhoneSave}
                  disabled={phoneLoading}
                >{phoneLoading ? 'Saving…' : 'Save'}</button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setEditingPhone(false); setNewPhone(p.phone); setPhoneError(''); }}
                  disabled={phoneLoading}
                >Cancel</button>
              </>
            ) : (
              <>
                <span className="profile-field-value">{p?.phone || '—'}</span>
                {p?.canChangePhone ? (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setEditingPhone(true)}
                  >Edit</button>
                ) : (
                  <span className="profile-phone-cooldown" title="Phone can be changed once every 90 days">
                    🔒 Editable in {p?.phoneChangeCooldownDaysLeft ?? 90}d
                  </span>
                )}
              </>
            )}
          </div>
          {phoneError && <p className="profile-phone-error">{phoneError}</p>}
          {phoneMsg   && <p className="profile-phone-success">{phoneMsg}</p>}
        </div>

        <div className="profile-field">
          <span className="profile-field-label">Emergency Contact</span>
          <span className="profile-field-value">{p?.emergencyContact || '—'}</span>
        </div>
      </div>

      {/* Verification card */}
      <div className="profile-card">
        <h2 className="profile-section-title">Verification Status</h2>

        <div className="profile-field">
          <span className="profile-field-label">KYC Status</span>
          <span className="profile-field-value" style={{ color: KYC_COLOR[p?.kycStatus] || '#888', fontWeight: 700 }}>
            {p?.kycStatus?.replace(/_/g, ' ') || 'Not submitted'}
          </span>
        </div>

        {p?.kycDocuments?.vehicleNumber && (
          <div className="profile-field">
            <span className="profile-field-label">Vehicle Number</span>
            <span className="profile-field-value" style={{ fontFamily: 'monospace', letterSpacing: 1 }}>
              {p.kycDocuments.vehicleNumber}
            </span>
          </div>
        )}

        {p?.kycDocuments?.vehicleName && (
          <div className="profile-field">
            <span className="profile-field-label">Vehicle</span>
            <span className="profile-field-value">{p.kycDocuments.vehicleName}</span>
          </div>
        )}
      </div>

      {/* Member since */}
      <p className="profile-since">
        Member since {p?.createdAt ? new Date(p.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '—'}
      </p>

      <button className="btn btn-ghost mt-8 mb-32" onClick={() => navigate('dashboard')}>
        ← Back to Dashboard
      </button>
    </div>
  );
}
