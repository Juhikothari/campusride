import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { validateCollegeEmail, getDomainsForCollege } from '../data/collegeDomains.js';
import CollegeSearch from '../components/CollegeSearch.jsx';
import './AuthPages.css';

const CLOUD_NAME = "dhkui5t39";
const UPLOAD_PRESET = "kyc_upload";

const ROLES = [
  { value:'seeker',   icon:'🎒', title:'Seeker',   desc:'I need rides' },
  { value:'provider', icon:'🚗', title:'Provider', desc:'I offer rides' },
  { value:'both',     icon:'🔄', title:'Both',     desc:'Flexible' },
  { value:'admin',    icon:'🛠️', title:'Admin',   desc:'Manage platform' },
];

export default function RegisterPage({ navigate }) {
  const { registerUser } = useAuth();
  const [form,      setForm]    = useState({ name:'', email:'', password:'', phone:'', college:'', role:'seeker' });
  const [error,     setError]   = useState('');
  const [loading,   setLoading] = useState(false);
  const [showPass,  setShowPass]= useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmPass, setConfirmPass] = useState('');
  const [kycDocs,   setKycDocs] = useState({ aadhar: null, license: null, collegeId: null });
  const [vehicleNumber, setVehicleNumber] = useState('');
  //const [vehicleType, setVehicleType] = useState('');
  const [vehicleNumberError, setVehicleNumberError] = useState('');
  const [emergencyContact, setEmergency] = useState('');
  const [role, setRole] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [gender, setGender] = useState('');
  const [usn, setUsn] = useState('');

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraType, setCameraType] = useState(null);
  const [cameraStream, setCameraStream] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const isProvider = form.role === 'provider' || form.role === 'both';

  const uploadToCloudinary = (file) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`);

    xhr.onload = () => {
      const data = JSON.parse(xhr.responseText);
      if (data.secure_url) resolve(data.secure_url);
      else reject("Upload failed");
    };

    xhr.onerror = () => reject("Upload error");

    xhr.send(formData);
  });
};
  // Live email-domain validation (only for non-admin roles)
  const emailValidation = useMemo(() => {
    if (form.role === 'admin') return { valid: true, message: '' };
    if (!form.email || !form.college) return { valid: true, message: '' };
    return validateCollegeEmail(form.email, form.college);
  }, [form.email, form.college, form.role]);

  // Hint text: show expected domain when college is filled
  const domainHint = useMemo(() => {
    if (form.role === 'admin' || !form.college) return null;
    const domains = getDomainsForCollege(form.college);
    return domains.length > 0 ? `Use your @${domains[0]} college email` : 'Use your official college email (not Gmail/Yahoo)';
  }, [form.college, form.role]);

  useEffect(() => {

  if (
    cameraOpen &&
    cameraStream &&
    videoRef.current
  ) {

    videoRef.current.srcObject = cameraStream;

    videoRef.current.onloadedmetadata = async () => {

      try {
        await videoRef.current.play();
      } catch (err) {
        console.error(err);
      }

    };
  }

}, [cameraOpen, cameraStream]);

  const validate = () => {
    if (!form.name.trim())    return 'Name is required';
    if (!form.email.trim())   return 'Email is required';
    if (!/\S+@\S+\.\S+/.test(form.email)) return 'Enter a valid email';
    if (form.role !== 'admin') {
      if (!form.college.trim()) return 'College name is required';
      const { valid, message } = validateCollegeEmail(form.email, form.college);
      if (!valid && message) return message;
    }
    if (form.password.length < 6) return 'Password must be at least 6 characters';
    if (form.password !== confirmPass) return 'Passwords do not match';
    if (!form.phone.trim())   return 'Phone number is required';
    if (form.role === 'admin' && adminKey !== 'freewheel') {
      return 'Invalid admin key';
    }
    /*if (isProvider && !vehicleType) {
      return 'Select vehicle service type (car or bike)';
    }*/
    if (isProvider && vehicleNumber) {
      const vnRegex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/;
      if (!vnRegex.test(vehicleNumber.toUpperCase())) {
        return 'Enter a valid vehicle number (e.g. KA01AB1234)';
      }
    }
    return null;
  };
  const openCamera = async (type) => {

  try {

    const stream =
      await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

    streamRef.current = stream;

    setCameraType(type);

    setCameraStream(stream);

    setCameraOpen(true);

  } catch (err) {

    console.error(err);

    setError(
      'Unable to access camera'
    );
  }
};

const closeCamera = () => {

  if (streamRef.current) {

    streamRef.current
      .getTracks()
      .forEach(track => track.stop());

    streamRef.current = null;
  }

  setCameraStream(null);

  if (videoRef.current) {
    videoRef.current.srcObject = null;
  }

  setCameraOpen(false);
};

const capturePhoto = () => {

  const video = videoRef.current;
  const canvas = canvasRef.current;

  const context = canvas.getContext('2d');

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  context.drawImage(video, 0, 0);

  canvas.toBlob((blob) => {

    const file = new File(
      [blob],
      `${cameraType}.jpg`,
      { type: 'image/jpeg' }
    );

    setKycDocs(prev => ({
      ...prev,
      [cameraType]: file
    }));

    closeCamera();

  }, 'image/jpeg', 0.9);
};
  const submit = async e => {
    e.preventDefault();
    setError('');
    const v = validate();
    if (v) { setError(v); return; }
    setLoading(true);
    try {
      let aadharUrl = null;
      let collegeIdUrl = null;
      let licenseUrl = null;

if (kycDocs.aadhar) {
  aadharUrl = await uploadToCloudinary(kycDocs.aadhar);
}

if (kycDocs.collegeId) {
  collegeIdUrl = await uploadToCloudinary(kycDocs.collegeId);
}

if (kycDocs.license) {
  licenseUrl = await uploadToCloudinary(kycDocs.license);
}
      await registerUser({
        ...form,
        adminKey,
        emergencyContact,
        gender,
        usn,
        aadhar:        aadharUrl,
        collegeIdCard:     collegeIdUrl,
        drivingLicense:       licenseUrl,
        vehicleNumber:  vehicleNumber        ? vehicleNumber.toUpperCase() : '',
      });
      navigate('dashboard');
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };
const UploadActions = ({ type }) => (
  <div className="register-upload-actions">

    {/* Upload */}
    <label className="register-upload-btn">
      📁 Upload

      <input
        type="file"
        accept="image/*,.pdf"
        hidden
        onChange={e =>
          setKycDocs(prev => ({
            ...prev,
            [type]: e.target.files[0]
          }))
        }
      />
    </label>

    {/* Camera */}
    <button
      type="button"
      className="register-upload-btn webcam"
      onClick={() => openCamera(type)}
    >
      📷 Camera
    </button>

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
            <h2 className="heading" style={{fontSize:26}}>Create account</h2>
            <p className="text-muted mt-8 text-sm">Join thousands of campus commuters</p>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <div className="grid-2">
            <div className="field">
              <label>Full Name</label>
              <input className="input" placeholder="Arjun Sharma"
                value={form.name} onChange={set('name')} />
            </div>
            <div className="field">
              <label>Phone</label>
              <input className="input" type="tel" placeholder="+91 9876543210"
                value={form.phone} onChange={set('phone')} />
            </div>
          </div>

          <div className="field">
            <label>College Email</label>
            <input className="input" type="email" placeholder="you@college.edu"
              value={form.email} onChange={set('email')} />
            {domainHint && !form.email && (
              <p className="field-hint-msg">💡 {domainHint}</p>
            )}
            {form.email && form.role !== 'admin' && form.college && (
              emailValidation.valid
                ? <p className="field-success-msg">✓ Valid college email</p>
                : <p className="field-error-msg">⚠ {emailValidation.message}</p>
            )}
          </div>

          <div className="grid-2">
            <div className="field">
              <label>College / University</label>
              <CollegeSearch
                value={form.college}
                onChange={val => setForm(f => ({ ...f, college: val }))}
                placeholder="Search your college or university…"
              />
            </div>
            <div className="field">
              <label>Emergency Contact</label>
              <input className="input" type="tel" placeholder="+91 9876543211"
                value={emergencyContact} onChange={e => setEmergency(e.target.value)} />
            </div>
          </div>

          {/* Gender selector */}
          <div className="field">
            <label>Gender <span style={{color:'#f5a623',fontSize:11}}>(used for safety matching)</span></label>
            <div className="role-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
              {[
                { value:'male',              icon:'♂',  title:'Male' },
                { value:'female',            icon:'♀',  title:'Female' },
                { value:'other',             icon:'⚧',  title:'Other' },
                { value:'prefer_not_to_say', icon:'—',  title:'Prefer not to say' },
              ].map(g => (
                <button key={g.value} type="button"
                  className={`role-card ${gender === g.value ? 'selected' : ''}`}
                  onClick={() => setGender(g.value)}
                  style={{fontSize:12}}>
                  <span className="rc-r-icon">{g.icon}</span>
                  <span className="rc-r-title" style={{fontSize:11}}>{g.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Role selector */}
          <div className="field">
            <label>I want to</label>
            <div className="role-grid">
              {ROLES.map(r => (
                <button key={r.value} type="button"
                  className={`role-card ${form.role === r.value ? 'selected' : ''}`}
                  onClick={() => {
                    setForm(f => ({ ...f, role: r.value }));
                    if (r.value === 'admin') setKycDocs({ aadhar: null, license: null, collegeId: null });
                  }}>
                  <span className="rc-r-icon">{r.icon}</span>
                  <span className="rc-r-title">{r.title}</span>
                  <span className="rc-r-desc">{r.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Admin key */}
          {form.role === 'admin' && (
            <div className="field">
              <label>Admin Key</label>
              <div className="input-wrap">
                <span className="input-icon">🔑</span>
                <input
                  className="input"
                  type="password"
                  placeholder="Enter admin key"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Password */}
          <div className="field">
            <label>Password</label>
            <div className="input-wrap">
              <span className="input-icon">🔒</span>
              <input
                className="input input-with-toggle"
                type={showPass ? 'text' : 'password'}
                placeholder="Min. 6 characters"
                value={form.password} onChange={set('password')}
              />
              <button type="button" className="show-pass-btn"
                onClick={() => setShowPass(s => !s)} tabIndex={-1}
                title={showPass ? 'Hide' : 'Show'}>
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Confirm password */}
          <div className="field">
            <label>Confirm Password</label>
            <div className="input-wrap">
              <span className="input-icon">🔒</span>
              <input
                className="input input-with-toggle"
                type={showConfirm ? 'text' : 'password'}
                placeholder="Re-enter password"
                value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
              />
              <button type="button" className="show-pass-btn"
                onClick={() => setShowConfirm(s => !s)} tabIndex={-1}
                title={showConfirm ? 'Hide' : 'Show'}>
                {showConfirm ? '🙈' : '👁️'}
              </button>
            </div>
            {confirmPass && form.password !== confirmPass && (
              <p className="field-error-msg">Passwords do not match</p>
            )}
            {confirmPass && form.password === confirmPass && confirmPass.length >= 6 && (
              <p className="field-success-msg">✓ Passwords match</p>
            )}
          </div>

          {/* KYC Documents — hidden for admin */}
          {form.role !== 'admin' && (
            <div className="kyc-docs-section">
              <div className="kyc-docs-header">
                <span className="kyc-docs-icon">📋</span>
                <div>
                  <div className="kyc-docs-title">KYC Documents Required</div>
                  <div className="kyc-docs-sub">
                    {isProvider
                      ? 'Upload Aadhar, College ID, Driving License, and your vehicle number'
                      : 'Upload Aadhar and College ID for identity verification'}
                  </div>
                </div>
                <span className="badge badge-pending" style={{marginLeft:'auto',fontSize:11}}>Pending</span>
              </div>

              <div className="kyc-docs-grid">

                {/* Aadhar — all roles */}
                <div className="field">
                  <label>🪪 Aadhar Card *</label>
                  {/*<input type="file" className="input kyc-file-input" accept="image/*,.pdf"
                    onChange={e => setKycDocs(prev => ({ ...prev, aadhar: e.target.files[0] }))} />*/}
                    <UploadActions type="aadhar" />
                  {kycDocs.aadhar && <p className="field-success-msg">✓ {kycDocs.aadhar.name}</p>}
                </div>

                {/* College ID — all roles */}
                <div className="field">
                  <label>🎓 College ID Card *</label>
                    <UploadActions type="collegeId" />
                  {kycDocs.collegeId && <p className="field-success-msg">✓ {kycDocs.collegeId.name}</p>}
                </div>

                {/* USN */}
                <div className="field" style={{ gridColumn: '1 / -1' }}>
                  <label>🔢 USN (University Seat Number)</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. 1RN22AI051"
                    value={usn}
                    onChange={e => setUsn(e.target.value.toUpperCase())}
                  />
                  <p className="field-hint-msg">Shown to your ride partner for identity verification</p>
                </div>

                {/* Driving License — provider & both only */}
                {isProvider && (
                  <div className="field">
                    <label>🚗 Driving License *</label>
                    {/*<input type="file" className="input kyc-file-input" accept="image/*,.pdf"
                      onChange={e => setKycDocs(prev => ({ ...prev, license: e.target.files[0] }))} />*/}
                      <UploadActions type="license" />
                    {kycDocs.license && <p className="field-success-msg">✓ {kycDocs.license.name}</p>}
                    
                  </div>
                )}

                

                {isProvider && (
                  <div className="field" style={{ gridColumn: '1 / -1' }}>
                    <label>🔢 Vehicle Registration Number *</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. KA01AB1234"
                      maxLength={12}
                      value={vehicleNumber}
                      onChange={e => {
                        const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                        setVehicleNumber(val);
                        setVehicleNumberError('');
                      }}
                    />
                    {vehicleNumberError && (
                      <p className="field-error-msg">{vehicleNumberError}</p>
                    )}
                    <p className="field-hint-msg">Format: State + District + Series + Number (e.g. KA01AB1234)</p>
                  </div>
                )}

              </div>
              <p className="kyc-docs-note">
                Your account will be activated once admin approves your documents.
              </p>
            </div>
          )}

          <button type="submit"
            className={`btn btn-primary btn-lg btn-full mt-8 ${loading ? 'btn-loading' : ''}`}
            disabled={loading}>
            {!loading && 'Create Account →'}
          </button>

          <p className="text-center text-muted text-sm mt-16">
            Already have an account?{' '}
            <button type="button" className="link-btn" onClick={() => navigate('login')}>
              Sign in
            </button>
          </p>
        </form>
        {cameraOpen && (
  <div className="camera-modal">

    <div className="camera-box">

      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="camera-video"
      />

      <canvas
        ref={canvasRef}
        style={{ display: 'none' }}
      />

      <div className="camera-actions">

        <button
          type="button"
          className="btn btn-outline"
          onClick={closeCamera}
        >
          Cancel
        </button>

        <button
          type="button"
          className="btn btn-primary"
          onClick={capturePhoto}
        >
          Capture
        </button>

      </div>

    </div>

  </div>
)}
      </div>
    </div>
  );
}
