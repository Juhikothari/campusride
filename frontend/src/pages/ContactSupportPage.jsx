import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

const SUPPORT_EMAIL = 'juhiij21@gmail.com';
const API_BASE = import.meta.env.VITE_BACKEND_URL || 'https://campusride-backend-gwgr.onrender.com';

const FAQS = [
  { q: 'How do I reset my password?', a: 'Go to the login page and tap "Forgot Password". Enter your college email and we\'ll send an OTP.' },
  { q: 'My booking is not showing up', a: 'Go to My Bookings and refresh. If still missing, check your internet connection and try again.' },
  { q: 'Why is my KYC pending?', a: 'KYC is reviewed by admins within 24–48 hours. You\'ll get a notification once approved.' },
  { q: 'Can I cancel a booking?', a: 'Yes — go to My Bookings, find the booking and tap Cancel. Allowed until the provider starts the ride.' },
  { q: 'I didn\'t receive my OTP', a: 'Check your spam folder. Make sure you\'re using your college email. Wait 2 minutes and try resend.' },
  { q: 'How do I report a safety issue?', a: 'Go to Report Incident from the menu. For emergencies, use the SOS button on the live tracking screen.' },
  { q: 'Why can\'t I start my ride?', a: 'Accept at least one booking request before starting the ride. Go to Manage Requests first.' },
  { q: 'Why is the fare different from what I expected?', a: 'Fare = Base fare + distance × per-km rate. Short trips under 1km show only the base fare.' },
];

export default function ContactSupportPage({ navigate }) {
  const { user } = useAuth();
  const [openFaq,  setOpenFaq]  = useState(null);
  const [subject,  setSubject]  = useState('');
  const [message,  setMessage]  = useState('');
  const [sending,  setSending]  = useState(false);
  const [sent,     setSent]     = useState(false);
  const [error,    setError]    = useState('');

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) return;
    setSending(true);
    setError('');

    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');

      // Send via Brevo through our backend endpoint
      const res = await fetch(`${API_BASE}/api/auth/contact-support`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          fromName:    user?.name    || 'App User',
          fromEmail:   user?.email   || 'unknown',
          college:     user?.college || '',
          role:        user?.role    || '',
          subject,
          message,
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || 'Failed to send');
      }

      setSent(true);
    } catch (err) {
      setError(err.message || 'Could not send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="narrow-wrap fade-up" style={{paddingBottom:48}}>
      <h2 style={{color:'#fff',fontSize:24,fontWeight:800,margin:'0 0 4px'}}>🛟 Help & Support</h2>
      <p style={{color:'#666',fontSize:13,margin:'0 0 28px'}}>Got a problem? We're here to help.</p>

      {/* Quick actions */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:28}}>
        {[
          { icon:'🚨', label:'Report Incident', action:() => navigate('incident-report') },
          { icon:'⭐', label:'Rate a Ride',     action:() => navigate('ratings') },
          { icon:'🔔', label:'Notifications',   action:() => navigate('notifications') },
          { icon:'🪪', label:'KYC Status',       action:() => navigate('kyc') },
        ].map(a => (
          <button key={a.label} onClick={a.action}
            style={{background:'#111318',border:'1px solid #1f2330',borderRadius:12,
              padding:'14px',cursor:'pointer',textAlign:'center'}}>
            <div style={{fontSize:24,marginBottom:4}}>{a.icon}</div>
            <div style={{color:'#aaa',fontSize:12,fontWeight:600}}>{a.label}</div>
          </button>
        ))}
      </div>

      {/* FAQs */}
      <div style={{marginBottom:28}}>
        <h3 style={{color:'#fff',fontSize:16,fontWeight:700,marginBottom:14}}>Frequently Asked Questions</h3>
        {FAQS.map((faq, i) => (
          <div key={i} style={{background:'#111318',border:'1px solid #1f2330',
            borderRadius:12,marginBottom:8,overflow:'hidden'}}>
            <button type="button" onClick={() => setOpenFaq(openFaq===i ? null : i)}
              style={{width:'100%',padding:'14px 16px',background:'none',border:'none',
                cursor:'pointer',display:'flex',justifyContent:'space-between',
                alignItems:'center',gap:12,textAlign:'left'}}>
              <span style={{color:'#fff',fontSize:13,fontWeight:600}}>{faq.q}</span>
              <span style={{color:'#f5a623',fontSize:16,flexShrink:0}}>{openFaq===i?'▲':'▼'}</span>
            </button>
            {openFaq===i && (
              <div style={{padding:'0 16px 14px',color:'#888',fontSize:13,lineHeight:1.6}}>{faq.a}</div>
            )}
          </div>
        ))}
      </div>

      {/* Contact form */}
      <div style={{background:'#111318',border:'1px solid #1f2330',borderRadius:14,padding:20}}>
        <h3 style={{color:'#fff',fontSize:16,fontWeight:700,margin:'0 0 4px'}}>✉️ Contact Us</h3>
        <p style={{color:'#666',fontSize:12,margin:'0 0 16px'}}>We usually respond within 24 hours.</p>

        {sent ? (
          <div style={{textAlign:'center',padding:'20px 0'}}>
            <div style={{fontSize:40,marginBottom:10}}>✅</div>
            <div style={{color:'#4caf50',fontWeight:700,fontSize:15}}>Message sent!</div>
            <div style={{color:'#666',fontSize:13,marginTop:6}}>
              We'll reply to <strong style={{color:'#aaa'}}>{user?.email}</strong> within 24 hours.
            </div>
            <button onClick={() => { setSent(false); setSubject(''); setMessage(''); }}
              style={{marginTop:16,background:'transparent',border:'1px solid #333',
                color:'#aaa',borderRadius:8,padding:'8px 20px',fontSize:13,cursor:'pointer'}}>
              Send another
            </button>
          </div>
        ) : (
          <>
            {error && (
              <div style={{background:'rgba(239,68,68,0.1)',border:'1px solid #ef4444',
                borderRadius:8,padding:'10px 14px',color:'#ef4444',fontSize:13,marginBottom:12}}>
                {error}
              </div>
            )}
            <input className="input" placeholder="Subject (e.g. Can't login, Booking issue)"
              value={subject} onChange={e => setSubject(e.target.value)}
              style={{marginBottom:10}} />
            <textarea className="input" placeholder="Describe your issue in detail…"
              rows={4} value={message} onChange={e => setMessage(e.target.value)}
              style={{resize:'vertical',marginBottom:14}} />
            <button onClick={handleSend}
              disabled={sending || !subject.trim() || !message.trim()}
              className={`btn btn-primary btn-full ${sending ? 'btn-loading' : ''}`}>
              {!sending && '📨 Send Message'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
