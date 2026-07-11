import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import './AuthPages.css';
import * as api from '../services/api.js';

export default function LoginPage({ navigate }) {
  const { loginUser } = useAuth();
  const [form,        setForm]       = useState({ email: '', password: '' });
  const [error,       setError]      = useState('');
  const [loading,     setLoading]    = useState(false);
  const [showPass,    setShowPass]   = useState(false);
  const [showForgot,  setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail]= useState('');
  const [forgotSent,  setForgotSent] = useState(false);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    setError('');
    if (!form.email || !form.password) { setError('Please fill in all fields'); return; }
    setLoading(true);
    try {
      await loginUser(form.email, form.password);
      navigate('dashboard');
    } catch (err) {
      setError(err.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  /*const handleForgot = async (e) => {
  e.preventDefault();

  /*const response = await fetch(
    "/api/auth/forgot-password",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: forgotEmail
      })
    }
  );
  await api.forgotPassword(forgotEmail);
  setForgotSent(true);

  if(response.ok){
     setForgotSent(true);
  }
};*/

const handleForgot = async (e) => {
  e.preventDefault();

  if (!forgotEmail) {
    alert("Please enter your email");
    return;
  }

  localStorage.setItem(
    "resetEmail",
    forgotEmail
  );

  navigate("reset-password");
};

  // Forgot password screen
  if (showForgot) return (
    <div className="auth-shell">
      <div className="auth-form-panel">
        <form className="auth-form fade-up" onSubmit={handleForgot} noValidate>
          <div className="af-header">
            <button type="button" className="back-btn" onClick={() => { setShowForgot(false); setForgotSent(false); }}>
              ← Back to login
            </button>
            <h2 className="heading mt-16" style={{fontSize:26}}>Forgot Password</h2>
            <p className="text-muted mt-8 text-sm">We'll send a reset link to your inbox</p>
          </div>

          {forgotSent ? (
            <div className="alert alert-success">
              ✓ Reset link sent to <strong>{forgotEmail}</strong>. Check your inbox!
            </div>
          ) : (
            <>
              <div className="field">
                <label>College Email</label>
                <div className="input-wrap">
                  <span className="input-icon">✉</span>
                  <input className="input" type="email" placeholder="you@college.edu"
                    value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} autoFocus />
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-lg btn-full mt-8">
                Continue →
              </button>
            </>
          )}

          <p className="text-center text-muted text-sm mt-16">
            Remembered it?{' '}
            <button type="button" className="link-btn"
              onClick={() => { setShowForgot(false); setForgotSent(false); }}>
              Back to Sign in
            </button>
          </p>
        </form>
      </div>
    </div>
  );

  return (
    <div className="auth-shell">
      <div className="auth-form-panel">
        <form className="auth-form fade-up" onSubmit={submit} noValidate>
          <div className="af-header">
            <div style={{fontFamily:'var(--font-display)',fontSize:22,fontWeight:800,color:'var(--text)',marginBottom:12}}>
              Campus<span style={{color:'var(--accent)'}}>Ride</span>
            </div>
            <h2 className="heading" style={{fontSize:26}}>Welcome back</h2>
            <p className="text-muted mt-8 text-sm">Sign in to your CampusRide account</p>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <div className="field">
            <label>College Email</label>
            <div className="input-wrap">
              <span className="input-icon">✉</span>
              <input className="input" type="email" placeholder="you@college.edu"
                value={form.email} onChange={set('email')} autoFocus />
            </div>
          </div>

          <div className="field">
            <div className="field-label-row">
              <label style={{marginBottom:0}}>Password</label>
              <button type="button" className="link-btn text-xs"
                onClick={() => setShowForgot(true)}>
                Forgot password?
              </button>
            </div>
            <div className="input-wrap mt-8">
              <span className="input-icon">🔒</span>
              <input
                className="input input-with-toggle"
                type={showPass ? 'text' : 'password'}
                placeholder="Your password"
                value={form.password}
                onChange={set('password')}
              />
              <button type="button" className="show-pass-btn"
                onClick={() => setShowPass(s => !s)} tabIndex={-1}
                title={showPass ? 'Hide password' : 'Show password'}>
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button type="submit"
            className={`btn btn-primary btn-lg btn-full mt-8 ${loading ? 'btn-loading' : ''}`}
            disabled={loading}>
            {!loading && 'Sign In →'}
          </button>

          <div className="divider">or</div>

          <p className="text-center text-muted text-sm">
            New here?{' '}
            <button type="button" className="link-btn" onClick={() => navigate('register')}>
              Create account →
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
