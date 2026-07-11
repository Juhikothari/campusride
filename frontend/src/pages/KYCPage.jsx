import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import * as api from '../services/api.js';
import './KYCPage.css';

const STEPS = ['Upload ID', 'Selfie Check', 'Review'];
const CLOUD_NAME = "dhkui5t39";
const UPLOAD_PRESET = "kyc_upload";

export default function KYCPage({ navigate }) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ aadhar: null, collegeId: null, license: null, selfie: null });
  const [preview, setPreview] = useState({ aadhar: null, collegeId: null, license: null, selfie: null });
  const [vehicleNumber, setVehicleNumber] = useState('');
  //const [vehicleType, setVehicleType] = useState('');
  const [vehicleNumberError, setVehicleNumberError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingStatus, setFetchingStatus] = useState(true);
  const [error, setError] = useState('');
  const [kycStatus, setKycStatus] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraType, setCameraType] = useState(null);
  const [cameraStream, setCameraStream] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const isProvider = user?.role === 'provider' || user?.role === 'both';

  const getDocUrl = (docType, url) => {
  if (!url) return null;

  if (url.startsWith('http')) return url;

  return null;
};
  // Fetch existing KYC status on load
  useEffect(() => {
    fetchKycStatus();
  }, []);

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

  const fetchKycStatus = async () => {
  setFetchingStatus(true);
  try {
    const status = await api.getKycStatus();
    console.log('Full KYC Status:', JSON.stringify(status, null, 2));
    console.log('User from auth:', user);

    // IMPROVED: Check for ANY document content (base64, URL, or filename)
    const hasDocuments = status?.documents && (
      (status.documents.aadhar && status.documents.aadhar.length > 0 && status.documents.aadhar !== 'null' && status.documents.aadhar !== '') ||
      (status.documents.collegeIdCard && status.documents.collegeIdCard.length > 0 && status.documents.collegeIdCard !== 'null' && status.documents.collegeIdCard !== '')
    );

    // Check if it's a real submission (pending, approved, or rejected WITH documents)
    const isActuallySubmitted = ['pending', 'approved', 'rejected'].includes(status.kycStatus) && hasDocuments;

    if (isActuallySubmitted) {
      setKycStatus(status);
      setSubmitted(true);
      setPreview({
        aadhar: status.documents.aadhar || null,
        collegeId: status.documents.collegeIdCard || null,
        license: status.documents.drivingLicense || null,
        selfie: status.documents.selfie || null,
      });
      if (status.documents.vehicleNumber) setVehicleNumber(status.documents.vehicleNumber);
      if (status.documents.vehicleType) setVehicleType(status.documents.vehicleType);
      setFetchingStatus(false);
      return; // EARLY RETURN - critical!
    }

    // Show upload form for not_submitted or no documents
    setSubmitted(false);
    setKycStatus({
      ...status,
      kycStatus: 'not_submitted'
    });

  } catch (err) {
    console.error('Failed to fetch KYC status:', err);
    setSubmitted(false);
  } finally {
    setFetchingStatus(false);
  }
};

  const handleFile = (key) => async (e) => {
  const file = e.target.files[0];

  if (!file) return;

  if (file.size > 10 * 1024 * 1024) {
    setError('File size must be less than 10MB');
    return;
  }

  if (!file.type.startsWith('image/')) {
    setError('Only image files are allowed');
    return;
  }

  setError('');

  setForm(prev => ({
    ...prev,
    [key]: file,
  }));

  const reader = new FileReader();

  reader.onload = (ev) => {
    setPreview(prev => ({
      ...prev,
      [key]: ev.target.result,
    }));
  };

  reader.readAsDataURL(file);
};

const openCamera = async (type = 'selfie') => {

  try {

    setError('');

    const stream =
      await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode:
            type === 'selfie'
              ? 'user'
              : 'environment',
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
      'Unable to access camera. Please allow camera permissions.'
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

    setForm(prev => ({
      ...prev,
      [cameraType]: file,
    }));

    const imageUrl = URL.createObjectURL(blob);

    setPreview(prev => ({
      ...prev,
      [cameraType]: imageUrl,
    }));

    closeCamera();

  }, 'image/jpeg', 0.9);
};
// upload to cloudinary
  const uploadToCloudinary = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  const data = await res.json();

  if (!data.secure_url) {
    throw new Error("Cloudinary upload failed");
  }

  return data.secure_url;
};

  const uploadFiles = async () => {
  const uploads = {};

  for (const [key, file] of Object.entries(form)) {
    if (file && (key !== 'license' || isProvider)) {
      uploads[key] = await uploadToCloudinary(file); // ✅ upload to Cloudinary
    }
  }

  return uploads;
};

  const handleSubmit = async () => {
  setLoading(true);
  setError('');
  
  try {
    const uploads = await uploadFiles();
    
    // Validate uploads exist
    if (!uploads.aadhar || !uploads.collegeId) {
      throw new Error('Please upload all required documents');
    }

    if (isProvider && !vehicleNumber) {
      setVehicleNumberError('Vehicle registration number is required');
      throw new Error('Vehicle registration number is required');
    }
    /*if (isProvider && !vehicleType) {
      throw new Error('Please select vehicle service type (car or bike)');
    }*/
    const vnRegex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/;
    if (isProvider && !vnRegex.test(vehicleNumber)) {
      setVehicleNumberError('Invalid format — use KA01AB1234');
      throw new Error('Invalid vehicle number format');
    }

    // Check base64 size (limit to ~7MB per image to prevent 400 error)
    const checkSize = (base64String) => {
  if (!base64String) return true;
  const sizeInBytes = (base64String.length * 3) / 4;
  return sizeInBytes < 7 * 1024 * 1024; // ✅ 7MB
};

    if (!checkSize(uploads.aadhar) || !checkSize(uploads.collegeId) || !checkSize(uploads.license) || !checkSize(uploads.selfie)) {
      throw new Error('One or more images exceed 7MB. Please compress and re-upload.');
    }

    const payload = {
      aadharUrl: uploads.aadhar,
      collegeIdCardUrl: uploads.collegeId,
      selfieUrl: uploads.selfie || null,
    };
    
    if (isProvider) {
      payload.drivingLicenseUrl = uploads.license;
      //payload.vehicleType = vehicleType;
      payload.vehicleNumber = vehicleNumber;
    }

    console.log('Submitting KYC payload:', payload); // DEBUG

    const result = await api.submitKyc(payload);
    console.log('KYC Submit Success:', result);

    // Update state to show success view
    setKycStatus({
      kycStatus: 'pending',
      documents: {
        aadhar: uploads.aadhar,
        collegeIdCard: uploads.collegeId,
        drivingLicense: uploads.license,
        selfie: uploads.selfie,
        //vehicleType: vehicleType,
        vehicleNumber: vehicleNumber,
      },
    });
    setSubmitted(true);
    
  } catch (err) {
    console.error('KYC Submit Error:', err);
    setError(err.message || 'Failed to submit KYC. Please try again.');
  } finally {
    setLoading(false);
  }
};

  const UploadActions = ({ type, selfie = false }) => (
  <div className="kyc-upload-actions">

    {/* Upload */}
    <label className="kyc-upload-btn">
      📁 Upload

      <input
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        onChange={handleFile(type)}
        hidden
      />
    </label>

    {/* Mobile Camera */}
    {/*<label className="kyc-upload-btn camera">
      {selfie ? '🤳 Selfie' : '📷 Camera'}

      <input
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        capture={selfie ? 'user' : 'environment'}
        onChange={handleFile(type)}
        hidden
      />
    </label>*/}

    {/* Desktop Webcam */}
    <button
      type="button"
      className="kyc-upload-btn webcam"
      onClick={() => openCamera(type)}
    >
      📷 Camera
    </button>
  </div>
);

  // Status badge component
  const StatusBadge = ({ status }) => {
    const colors = {
      not_submitted: '#888',
      pending:       '#ffc107',
      approved:      '#28a745',
      rejected:      '#dc3545',
    };
    return (
      <div className="kyc-status-badge" style={{ background: colors[status] || '#888' }}>
        {status?.replace('_', ' ').toUpperCase()}
      </div>
    );
  };

  // ── Loading state ──────────────────────────────────────
  if (fetchingStatus) {
    return (
      <div className="kyc-wrap fade-up" style={{ textAlign: 'center', paddingTop: 80 }}>
        <div className="skeleton" style={{ width: 80, height: 80, borderRadius: '50%', margin: '0 auto 20px' }} />
        <div className="skeleton skeleton-text" style={{ width: 200, margin: '0 auto 10px' }} />
        <div className="skeleton skeleton-text" style={{ width: 150, margin: '0 auto' }} />
      </div>
    );
  }

  // ── Already submitted: show document viewer + status ───
  if (submitted && kycStatus) {
    return (
      <div className="kyc-wrap fade-up">
        <div className="kyc-success">
          <div className="kyc-success-icon">
            {kycStatus.kycStatus === 'approved' ? '✅' :
             kycStatus.kycStatus === 'rejected' ? '❌' : '⏳'}
          </div>
          <h2 className="heading mt-16">
            {kycStatus.kycStatus === 'approved' ? 'KYC Approved!' :
             kycStatus.kycStatus === 'rejected' ? 'KYC Rejected'  :
             'KYC Under Review'}
          </h2>
          <p className="text-muted mt-8">
            {kycStatus.kycStatus === 'approved'
              ? 'Your documents have been verified. You can now offer rides.'
              : kycStatus.kycStatus === 'rejected'
              ? 'Your documents were rejected. Please resubmit with clearer photos.'
              : 'Your documents are under admin review. You will be notified within 24 hours.'}
          </p>

          <StatusBadge status={kycStatus.kycStatus} />

          {/* Submitted documents */}
{kycStatus.documents && (
  <div className="kyc-submitted-docs mt-24">
    <h4 style={{ marginBottom: 16, color: 'var(--text2)', fontSize: 14, fontWeight: 600 }}>
      Submitted Documents
    </h4>
    <div className="kyc-docs-grid">
      {kycStatus.documents.aadhar && (
  <div className="kyc-doc-item">
    <div className="kyc-doc-label">🪪 Aadhar Card</div>
    <img 
      src={getDocUrl('aadhar', kycStatus.documents.aadhar)} 
      alt="Aadhar" 
      className="kyc-doc-img"
      onError={(e) => {
        // If image fails to load, show filename as fallback
        e.target.style.display = 'none';
        e.target.nextSibling.style.display = 'flex';
      }}
    />
    <div style={{display: 'none', padding: 20, background: '#2a2a2a', borderRadius: 8, textAlign: 'center'}}>
      <div style={{fontSize: 32, marginBottom: 8}}>📄</div>
      <div style={{color: '#888', fontSize: 12, wordBreak: 'break-all'}}>
        {kycStatus.documents.aadhar}
      </div>
    </div>
  </div>
)}
      
      {kycStatus.documents.collegeIdCard && (
  <div className="kyc-doc-item">
    <div className="kyc-doc-label">🎓 College ID</div>
    <img 
      src={getDocUrl('collegeIdCard', kycStatus.documents.collegeIdCard)} 
      alt="College ID" 
      className="kyc-doc-img"
      onError={(e) => {
        e.target.style.display = 'none';
        e.target.nextSibling.style.display = 'flex';
      }}
    />
    <div style={{display: 'none', padding: 20, background: '#2a2a2a', borderRadius: 8, textAlign: 'center'}}>
      <div style={{fontSize: 32, marginBottom: 8}}>📄</div>
      <div style={{color: '#888', fontSize: 12, wordBreak: 'break-all'}}>
        {kycStatus.documents.collegeIdCard}
      </div>
    </div>
  </div>
)}

{isProvider && kycStatus.documents.drivingLicense && (
  <div className="kyc-doc-item">
    <div className="kyc-doc-label">🚗 Driving License</div>
    <img 
      src={getDocUrl('drivingLicense', kycStatus.documents.drivingLicense)} 
      alt="License" 
      className="kyc-doc-img"
      onError={(e) => {
        e.target.style.display = 'none';
        e.target.nextSibling.style.display = 'flex';
      }}
    />
    <div style={{display: 'none', padding: 20, background: '#2a2a2a', borderRadius: 8, textAlign: 'center'}}>
      <div style={{fontSize: 32, marginBottom: 8}}>📄</div>
      <div style={{color: '#888', fontSize: 12, wordBreak: 'break-all'}}>
        {kycStatus.documents.drivingLicense}
      </div>
    </div>
  </div>
)}

{kycStatus.documents.selfie && (
  <div className="kyc-doc-item">
    <div className="kyc-doc-label">🤳 Selfie</div>
    <img 
      src={getDocUrl('selfie', kycStatus.documents.selfie)} 
      alt="Selfie" 
      className="kyc-doc-img"
      onError={(e) => {
        e.target.style.display = 'none';
        e.target.nextSibling.style.display = 'flex';
      }}
    />
    <div style={{display: 'none', padding: 20, background: '#2a2a2a', borderRadius: 8, textAlign: 'center'}}>
      <div style={{fontSize: 32, marginBottom: 8}}>📄</div>
      <div style={{color: '#888', fontSize: 12, wordBreak: 'break-all'}}>
        {kycStatus.documents.selfie}
      </div>
    </div>
  </div>
)}
    </div>
  </div>
)}

          {kycStatus.kycStatus === 'rejected' && (
            <button
              className="btn btn-primary mt-24"
              onClick={() => {
                setSubmitted(false);
                setStep(0);
                setForm({ aadhar: null, collegeId: null, license: null, selfie: null });
                setPreview({ aadhar: null, collegeId: null, license: null, selfie: null });
                setVehicleNumber('');
               // setVehicleType('');
                setVehicleNumberError('');
              }}
            >
              Resubmit KYC
            </button>
          )}

          <button className="btn btn-outline mt-16" onClick={() => navigate('dashboard')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Not yet submitted: show upload form ───────────────
  return (
    <div className="kyc-wrap fade-up">
      <p className="eyebrow mb-8">Verification</p>
      <h1 className="heading mb-4" style={{ fontSize: 28 }}>KYC Verification</h1>
      <p className="text-muted mb-32 text-sm">
        {isProvider
          ? 'Complete verification with Aadhar, College ID, Driving License, and vehicle number to offer rides'
          : 'Complete verification with Aadhar and College ID to book rides'}
      </p>

      {/* If they had a previous not_submitted status, show a friendly banner */}
      {kycStatus?.kycStatus === 'not_submitted' && (
        <div className="alert alert-info mb-24" style={{ fontSize: 13 }}>
          📋 You haven't completed KYC yet. Please upload your documents below to get verified.
        </div>
      )}

      {/* Step indicator */}
      <div className="kyc-steps mb-40">
        {STEPS.map((s, i) => (
          <div key={s} className={`kyc-step ${i === step ? 'active' : i < step ? 'done' : ''}`}>
            <div className="kyc-step-num">{i < step ? '✓' : i + 1}</div>
            <span className="kyc-step-label">{s}</span>
            {i < STEPS.length - 1 && <div className="kyc-step-line" />}
          </div>
        ))}
      </div>

      {error && <div className="alert alert-error mb-16">{error}</div>}

      {/* Step 0 — Upload documents */}
      {step === 0 && (
        <div className="kyc-card fade-up">
          <h3 className="heading mb-4" style={{ fontSize: 20 }}>Upload Documents</h3>
          <p className="text-muted mb-24 text-sm">
            {isProvider
              ? 'Upload your Aadhar, College ID, and Driving License, then add your vehicle number'
              : 'Upload your Aadhar and College ID'}
          </p>

          <div className="kyc-upload-grid">
            {/* Aadhar */}
            <div className="kyc-upload-box">
              <label className="kyc-upload-label" htmlFor="aadhar">
                {preview.aadhar
                  ? <img src={preview.aadhar} alt="Aadhar" className="kyc-preview-img" />
                  : <>
                      <div className="kyc-upload-icon">🆔</div>
                      <div className="kyc-upload-text">Aadhar Card</div>
                      <div className="kyc-upload-sub">Required · JPG, PNG up to 5MB</div>
                    </>
                }
              </label>
              <UploadActions type="aadhar" />
              {preview.aadhar && <div className="kyc-check">✓ Uploaded</div>}
            </div>

            {/* College ID */}
            <div className="kyc-upload-box">
              <label className="kyc-upload-label" htmlFor="collegeId">
                {preview.collegeId
                  ? <img src={preview.collegeId} alt="College ID" className="kyc-preview-img" />
                  : <>
                      <div className="kyc-upload-icon">🎓</div>
                      <div className="kyc-upload-text">College / Student ID</div>
                      <div className="kyc-upload-sub">Required · JPG, PNG up to 5MB</div>
                    </>
                }
              </label>
              <UploadActions type="collegeId" />
              {preview.collegeId && <div className="kyc-check">✓ Uploaded</div>}
            </div>

            {/* Driving License — providers only */}
            {isProvider && (
              <div className="kyc-upload-box">
                <label className="kyc-upload-label" htmlFor="license">
                  {preview.license
                    ? <img src={preview.license} alt="License" className="kyc-preview-img" />
                    : <>
                        <div className="kyc-upload-icon">🚗</div>
                        <div className="kyc-upload-text">Driving License</div>
                        <div className="kyc-upload-sub">Required for providers · JPG, PNG up to 5MB</div>
                      </>
                  }
                </label>
                <UploadActions type="license" />
                {preview.license && <div className="kyc-check">✓ Uploaded</div>}
              </div>
            )}


            {isProvider && (
              <div className="kyc-upload-box" style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '16px' }}>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 500, color: 'var(--text1)' }}>
                  🔢 Vehicle Registration Number <span style={{ color: '#dc3545' }}>*</span>
                </label>
                <input
                  type="text"
                  className="input"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text1)', fontSize: 14 }}
                  placeholder="e.g. KA01AB1234"
                  value={vehicleNumber}
                  maxLength={12}
                  onChange={e => {
                    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                    setVehicleNumber(val);
                    setVehicleNumberError('');
                  }}
                />
                {vehicleNumberError && (
                  <div style={{ color: '#dc3545', fontSize: 12, marginTop: 4 }}>{vehicleNumberError}</div>
                )}
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                  Format: State code + district + series + number (e.g. KA01AB1234)
                </div>
              </div>
            )}
          </div>

          <button
            className="btn btn-primary btn-lg btn-full mt-32"
            disabled={
              !preview.aadhar || !preview.collegeId ||
              (isProvider && (!preview.license || !vehicleNumber))
            }
            onClick={() => setStep(1)}
          >
            Continue
          </button>
        </div>
      )}

      {/* Step 1 — Selfie */}
      {/* Step 1 — Selfie */}
{step === 1 && (
  <div className="kyc-card fade-up">

    <h3
      className="heading mb-4"
      style={{ fontSize: 20 }}
    >
      Selfie Verification
    </h3>

    <p className="text-muted mb-24 text-sm">
      Take a clear selfie to verify your identity
    </p>

    {/* SELFIE PREVIEW */}
    <div className="kyc-selfie-box">

      <div className="kyc-selfie-label">

        {preview.selfie ? (
          <img
            src={preview.selfie}
            alt="Selfie"
            className="kyc-selfie-img"
          />
        ) : (
          <div style={{ textAlign: 'center' }}>

            <div
              className="kyc-upload-icon"
              style={{ fontSize: 40 }}
            >
              📷
            </div>

            <div className="kyc-upload-text">
              Selfie Preview
            </div>

            <div className="kyc-upload-sub">
              Your selfie will appear here
            </div>

          </div>
        )}

      </div>

    </div>

    {/* SELFIE ACTION BUTTONS */}
    <UploadActions
      type="selfie"
      selfie
    />

    {/* TIPS */}
    <div className="kyc-tips mt-24">

      {[
        'Good lighting on your face',
        'No sunglasses or mask',
        'Plain background preferred'
      ].map(t => (
        <div key={t} className="kyc-tip">
          ✓ {t}
        </div>
      ))}

    </div>

    {/* BUTTONS */}
    <div className="flex gap-12 mt-32">

      <button
        className="btn btn-outline btn-lg"
        onClick={() => setStep(0)}
      >
        Back
      </button>

      <button
        className="btn btn-primary btn-lg flex-1"
        disabled={!preview.selfie}
        onClick={() => setStep(2)}
      >
        Continue
      </button>

    </div>

  </div>
)}

{/* CAMERA MODAL */}
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
          className="btn btn-outline"
          onClick={closeCamera}
        >
          Cancel
        </button>

        <button
          className="btn btn-primary"
          onClick={capturePhoto}
        >
          Capture
        </button>

      </div>

    </div>

  </div>
)}

      {/* Step 2 — Review & Submit */}
      {step === 2 && (
        <div className="kyc-card fade-up">
          <h3 className="heading mb-4" style={{ fontSize: 20 }}>Review and Submit</h3>
          <p className="text-muted mb-24 text-sm">Confirm your documents before submitting</p>
          <div className="kyc-review-grid">
            {[
              { label: 'Aadhar Card',    img: preview.aadhar,    required: true },
              { label: 'College ID',     img: preview.collegeId, required: true },
              ...(isProvider ? [
                { label: 'Driving License', img: preview.license, required: true },
              ] : []),
              { label: 'Selfie',         img: preview.selfie,    required: true },
            ].map(item => (
              <div key={item.label} className={`kyc-review-item${!item.img ? ' missing' : ''}`}>
                <div className="kyc-review-label">{item.label} {item.required && '*'}</div>
                {item.img
                  ? <img src={item.img} alt={item.label} className="kyc-review-img" />
                  : <div style={{ width:'100%', height:100, background:'var(--surface2)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)', fontSize:12 }}>Missing</div>
                }
                <div className="kyc-check">{item.img ? '✓ Ready' : '— Missing'}</div>
              </div>
            ))}
          </div>
          <div className="alert alert-info mt-24">
            {isProvider && vehicleNumber && (
              <div style={{ marginBottom: 6 }}>
                Vehicle number: <strong>{vehicleNumber}</strong>
              </div>
            )}
            Documents will be reviewed by admin within 24 hours. Your profile will be activated upon approval.
          </div>
          <div className="flex gap-12 mt-24">
            <button className="btn btn-outline btn-lg" onClick={() => setStep(1)}>Back</button>
            <button
              className={`btn btn-primary btn-lg flex-1${loading ? ' btn-loading' : ''}`}
              disabled={loading}
              onClick={handleSubmit}
            >
              {!loading && 'Submit for Review'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}