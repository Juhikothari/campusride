import React, { useState } from 'react';
import * as api from '../services/api.js';
import './ResetPassword.css';

// 3-step flow: 1) Enter email → 2) Enter OTP → 3) Set new password
const STEP = { EMAIL: 'email', OTP: 'otp', PASSWORD: 'password', DONE: 'done' };

export default function ResetPassword({ navigate }) {
  const [step,       setStep]       = useState(STEP.EMAIL);
  const [email,      setEmail]      = useState(() => localStorage.getItem('resetEmail') || '');
  const [otp,        setOtp]        = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password,   setPassword]   = useState('');
  const [confirm,    setConfirm]    = useState('');
  const [showPass,   setShowPass]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [resending,  setResending]  = useState(false);

  const clearError = () => setError('');

  // Step 1: send OTP
  const handleSendOtp = async (e) => {
    e.preventDefault();
    clearError();
    if (!email.trim()) return setError('Enter your registered email.');
    setLoading(true);
    try {
      await api.sendOtp(email.trim().toLowerCase());
      localStorage.setItem('resetEmail', email.trim().toLowerCase());
      setStep(STEP.OTP);
    } catch (err) {
      setError(err.message || 'Failed to send OTP. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setResending(true);
    clearError();
    try {
      await api.sendOtp(email.trim().toLowerCase());
      setOtp('');
    } catch (err) {
      setError(err.message || 'Failed to resend OTP.');
    } finally {
      setResending(false);
    }
  };

  // Step 2: verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    clearError();
    if (otp.length !== 6) return setError('Enter the 6-digit OTP sent to your email.');
    setLoading(true);
    try {
      const data = await api.verifyOtp(email, otp);
      setResetToken(data.resetToken);
      setStep(STEP.PASSWORD);
    } catch (err) {
      setError(err.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: set new password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    clearError();
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirm)  return setError('Passwords do not match.');
    setLoading(true);
    try {
      await api.resetPasswordWithOtp(resetToken, password);
      localStorage.removeItem('resetEmail');
      setStep(STEP.DONE);
    } catch (err) {
      setError(err.message || 'Failed to reset password. Start over.');
    } finally {
      setLoading(false);
    }
  };

  if (step === STEP.DONE) return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand"><span className="brand-campus">Campus</span><span className="brand-ride">Ride</span></div>
        <div style={{fontSize:52,textAlign:'center',marginBottom:12}}>🎉</div>
        <h1 className="auth-title">Password Reset!</h1>
        <p className="auth-subtitle">Your password has been updated successfully.</p>
        <button className="auth-submit" onClick={() => navigate('login')}>Go to Login →</button>
      </div>
    </div>
  );

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand"><span className="brand-campus">Campus</span><span className="brand-ride">Ride</span></div>

        {/* Step indicator */}
        <div className="otp-steps">
          {['Email', 'OTP', 'Password'].map((label, i) => {
            const idx = [STEP.EMAIL, STEP.OTP, STEP.PASSWORD].indexOf(step);
            const done = i < idx;
            const active = i === idx;
            return (
              <React.Fragment key={label}>
                <div className={`otp-step ${active ? 'active' : ''} ${done ? 'done' : ''}`}>
                  <span className="otp-step-num">{done ? '✓' : i + 1}</span>
                  <span className="otp-step-label">{label}</span>
                </div>
                {i < 2 && <div className={`otp-step-line ${done ? 'done' : ''}`} />}
              </React.Fragment>
            );
          })}
        </div>

        {error && (
          <div style={{background:'#2b1010',color:'#ff6b6b',padding:'12px',borderRadius:'10px',marginBottom:'16px',textAlign:'center',fontSize:13}}>
            {error}
          </div>
        )}

        {/* ── Step 1: Email ── */}
        {step === STEP.EMAIL && (
          <form onSubmit={handleSendOtp}>
            <h1 className="auth-title" style={{fontSize:22}}>Reset Password</h1>
            <p className="auth-subtitle">Enter your registered email to receive a 6-digit OTP.</p>
            <label className="auth-label">EMAIL ADDRESS</label>
            <input
              className="auth-input"
              type="email"
              placeholder="you@college.edu"
              value={email}
              onChange={e => { setEmail(e.target.value); clearError(); }}
              autoFocus
            />
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? 'Sending OTP…' : 'Send OTP →'}
            </button>
            <div className="auth-footer" style={{marginTop:16}}>
              Remember your password?{' '}
              <button type="button" className="link-btn" onClick={() => navigate('login')}>Sign In</button>
            </div>
          </form>
        )}

        {/* ── Step 2: OTP ── */}
        {step === STEP.OTP && (
          <form onSubmit={handleVerifyOtp}>
            <h1 className="auth-title" style={{fontSize:22}}>Enter OTP</h1>
            <p className="auth-subtitle">
              We sent a 6-digit OTP to <strong style={{color:'#f5a623'}}>{email}</strong>. Valid for 10 minutes.
            </p>
            <label className="auth-label">6-DIGIT OTP</label>
            <input
              className="auth-input otp-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="— — — — — —"
              value={otp}
              onChange={e => { setOtp(e.target.value.replace(/\D/g,'')); clearError(); }}
              autoFocus
            />
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? 'Verifying…' : 'Verify OTP →'}
            </button>
            <div className="auth-footer" style={{marginTop:12}}>
              Didn't receive it?{' '}
              <button type="button" className="link-btn" onClick={handleResendOtp} disabled={resending}>
                {resending ? 'Resending…' : 'Resend OTP'}
              </button>
            </div>
            <div className="auth-footer" style={{marginTop:8}}>
              Wrong email?{' '}
              <button type="button" className="link-btn" onClick={() => { setStep(STEP.EMAIL); setOtp(''); clearError(); }}>
                Change Email
              </button>
            </div>
          </form>
        )}

        {/* ── Step 3: New Password ── */}
        {step === STEP.PASSWORD && (
          <form onSubmit={handleResetPassword}>
            <h1 className="auth-title" style={{fontSize:22}}>New Password</h1>
            <p className="auth-subtitle">Create a strong new password for your account.</p>
            <label className="auth-label">NEW PASSWORD</label>
            <div style={{position:'relative',marginBottom:16}}>
              <input
                className="auth-input"
                type={showPass ? 'text' : 'password'}
                placeholder="Min. 6 characters"
                value={password}
                onChange={e => { setPassword(e.target.value); clearError(); }}
                style={{paddingRight:44}}
                autoFocus
              />
              <button type="button" onClick={() => setShowPass(s=>!s)}
                style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:18,color:'#888'}}>
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
            <label className="auth-label">CONFIRM PASSWORD</label>
            <input
              className="auth-input"
              type={showPass ? 'text' : 'password'}
              placeholder="Re-enter password"
              value={confirm}
              onChange={e => { setConfirm(e.target.value); clearError(); }}
            />
            {confirm && password !== confirm && (
              <p style={{color:'#ff6b6b',fontSize:12,marginTop:-10,marginBottom:8}}>Passwords do not match</p>
            )}
            {confirm && password === confirm && confirm.length >= 6 && (
              <p style={{color:'#4caf50',fontSize:12,marginTop:-10,marginBottom:8}}>✓ Passwords match</p>
            )}
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? 'Updating…' : 'Reset Password →'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
