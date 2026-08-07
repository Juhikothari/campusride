import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import LocationSearch from '../components/LocationSearch.jsx';
import CollegeLocationSearch from '../components/CollegeLocationSearch.jsx';
import NearbyMap from '../components/NearbyMap.jsx';
import * as api from '../services/api.js';
import './CreateRide.css';

// ── College presets (corrected coords) ───────────────────────────
const COLLEGE_PRESETS = [
  // RNSIT & RNSFG: Dr. Vishnuvardhana Road, Channasandra, RR Nagar — 12°54′5″N 77°31′4″E
  { label: 'RNS Institute of Technology',        lat: 12.9011, lng: 77.5181, keys: ['rns','rnsit','rns institute','rns institute of technology'] },
  { label: 'RNS First Grade College',            lat: 12.9008, lng: 77.5179, keys: ['rnsfg','rns first grade','rns fg','rns first grade college'] },
  { label: 'Global Academy of Technology',       lat: 12.9449, lng: 77.4768, keys: ['gat','global academy','global academy of technology'] },
  { label: 'Don Bosco Institute of Technology',  lat: 12.9282, lng: 77.5046, keys: ['dbit','don bosco','don bosco institute'] },
  { label: 'RV College of Engineering',          lat: 12.9215, lng: 77.4958, keys: ['rv college','rvce'] },
  { label: 'BMS College of Engineering',         lat: 12.9611, lng: 77.5908, keys: ['bms college','bmsce'] },
  { label: 'BMS Institute of Technology',        lat: 13.0634, lng: 77.5122, keys: ['bmsit','bms institute of technology'] },
  { label: 'PES University',                     lat: 12.9345, lng: 77.5366, keys: ['pes university','pesu','pesit'] },
  { label: 'Dayananda Sagar College of Engg',    lat: 12.9019, lng: 77.5679, keys: ['dayananda sagar','dsce','dscet'] },
  { label: 'SJB Institute of Technology',        lat: 12.8999, lng: 77.5526, keys: ['sjbit','sjb institute'] },
  { label: 'Christ University',                  lat: 12.9360, lng: 77.6115, keys: ['christ university','christ college'] },
  { label: 'MS Ramaiah Institute of Technology', lat: 13.0163, lng: 77.5770, keys: ['ramaiah','msrit','ms ramaiah'] },
  { label: 'CMR Institute of Technology',        lat: 13.1120, lng: 77.6120, keys: ['cmrit','cmr institute'] },
  { label: 'Nitte Meenakshi Institute',          lat: 13.1114, lng: 77.5963, keys: ['nitte','nmit','nitte meenakshi'] },
  { label: 'Sir MVIT (Yelahanka)',               lat: 13.1337, lng: 77.5783, keys: ['mvit','sir mvit'] },
  { label: 'Acharya Institute of Technology',    lat: 13.0633, lng: 77.5122, keys: ['acharya','ait'] },
  { label: 'Bangalore Institute of Technology',  lat: 12.9539, lng: 77.6007, keys: ['bit bangalore','bangalore institute of technology'] },
  { label: 'Jain University',                    lat: 12.9630, lng: 77.5750, keys: ['jain university','jain college'] },
  { label: 'New Horizon College of Engineering', lat: 13.0497, lng: 77.6408, keys: ['nhce','new horizon'] },
  { label: 'REVA University (Yelahanka)',        lat: 13.1167, lng: 77.5942, keys: ['reva','reva university'] },
];

const snapToKnownCollege = (label) => {
  if (!label) return null;
  const n = label.toLowerCase();
  return COLLEGE_PRESETS.find(c =>
    c.keys.some(k => n.includes(k)) || n.includes(c.label.toLowerCase())
  ) || null;
};

const EMPTY = {
  pickupLabel:'', pickupLat:'', pickupLng:'',
  dropLabel:'',   dropLat:'',   dropLng:'',
  date:'', time:'', seatsAvailable:3, costPerSeat:0,
  vehicleType: 'car',
};

const VEHICLE_TYPES = [
  { value: 'motorcycle', label: '🏍 Bike', capacity: 1 },
  { value: 'car',        label: '🚗 Car',  capacity: 3 },
  { value: 'suv',        label: '🚙 SUV',  capacity: 4 },
  { value: 'xuv',        label: '🚐 XUV',  capacity: 6 },
];

// ── Fare calculator ────────────────────────────────────────────────
// base is ALWAYS included. For trips > 1 km: base + per-km.
// Minimum fare: ₹20 no matter what.
const RATES = {
  motorcycle: { base: 20, perKm: 5  },
  car:        { base: 25, perKm: 7  },
  suv:        { base: 30, perKm: 9  },
  xuv:        { base: 35, perKm: 11 },
};
const MINIMUM_FARE = 20;

const calculateCostPerSeat = (distanceKm, vehicleType) => {
  if (!distanceKm || distanceKm <= 0) return 0;
  const safeDistance = Math.min(distanceKm, 50);
  const { base, perKm } = RATES[vehicleType] || RATES.car;
  const perKmPortion = safeDistance > 1 ? Math.round(safeDistance * perKm) : 0;
  return Math.max(MINIMUM_FARE, base + perKmPortion);
};

const getLocationConfig = (pickupType) => {
  if (pickupType === 'college') return { pickupIsCollege: true,  dropIsCollege: false, message: 'College pickup: Drop limited to general areas' };
  if (pickupType === 'home')   return { pickupIsCollege: false, dropIsCollege: true,  message: 'Home pickup: Drop limited to colleges' };
  return { pickupIsCollege: false, dropIsCollege: false, message: '' };
};

// ── Main CreateRide ───────────────────────────────────────────────
export default function CreateRide({ navigate }) {
  const { user } = useAuth();
  const [form,           setForm]           = useState(EMPTY);
  const [error,          setError]          = useState('');
  const [loading,        setLoading]        = useState(false);
  const [success,        setSuccess]        = useState(null);
  const [pickupType,     setPickupType]     = useState('');
  const [scheduleType,   setScheduleType]   = useState('');
  const [locationConfig, setLocationConfig] = useState(getLocationConfig(''));
  const [womenOnly,      setWomenOnly]      = useState(false);
  const [roadDistanceKm, setRoadDistanceKm] = useState(0);



  useEffect(() => {
    const { pickupLat, pickupLng, dropLat, dropLng, pickupLabel, dropLabel } = form;
    if (!pickupLat || !pickupLng || !dropLat || !dropLng) { setRoadDistanceKm(0); return; }
    const pickupSnap = snapToKnownCollege(pickupLabel);
    const dropSnap   = snapToKnownCollege(dropLabel);
    const lat1 = parseFloat(pickupSnap ? pickupSnap.lat : pickupLat);
    const lng1 = parseFloat(pickupSnap ? pickupSnap.lng : pickupLng);
    const lat2 = parseFloat(dropSnap   ? dropSnap.lat   : dropLat);
    const lng2 = parseFloat(dropSnap   ? dropSnap.lng   : dropLng);
    const R    = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a    = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
    const dist = parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(2));
    setRoadDistanceKm(dist);
  }, [form.pickupLat, form.pickupLng, form.dropLat, form.dropLng, form.pickupLabel, form.dropLabel]);

  useEffect(() => { setLocationConfig(getLocationConfig(pickupType)); }, [pickupType]);

  useEffect(() => {
    if (scheduleType === 'now') {
      const now  = new Date();
      setForm(f => ({ ...f, date: now.toISOString().split('T')[0], time: now.toTimeString().slice(0,5) }));
    } else if (scheduleType === 'later') {
      setForm(f => ({ ...f, date:'', time:'' }));
    }
  }, [scheduleType]);

  const isProvider = user?.role === 'provider' || user?.role === 'both';

  if (!isProvider) return (
    <div className="narrow-wrap fade-up text-center" style={{ paddingTop:80 }}>
      <div style={{ fontSize:64 }}>🚫</div>
      <h2 className="heading mt-20" style={{ fontSize:28 }}>Access Denied</h2>
      <p className="text-muted mt-8">Only providers can create rides.</p>
      <button className="btn btn-primary btn-lg mt-32" onClick={() => navigate('dashboard')}>Back to Dashboard</button>
    </div>
  );



  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const validate = () => {
        if (!form.pickupLat || !form.pickupLng) return 'Set pickup coordinates';
        if (!form.dropLat   || !form.dropLng)   return 'Set drop coordinates';
        if (form.pickupLat === form.dropLat && form.pickupLng === form.dropLng) return 'Pickup and drop cannot be the same';
        if (!form.date) return 'Date is required';
        if (!form.time) return 'Time is required';
        if (scheduleType === 'later' && new Date(`${form.date}T${form.time}`) < new Date()) return 'Date/time must be in the future';
        if (!pickupType) return 'Please select College or Home pickup type';
        return null;
      };
      const validationError = validate();
      if (validationError) { setError(validationError); setLoading(false); return; }

      const ride = await api.createRide({
        pickup: { coordinates: [parseFloat(form.pickupLng), parseFloat(form.pickupLat)], address: form.pickupLabel },
        drop:   { coordinates: [parseFloat(form.dropLng),   parseFloat(form.dropLat)],   address: form.dropLabel },
        date: new Date(`${form.date}T${form.time}`).toISOString(),
        time: form.time,
        seatsAvailable: form.vehicleType === 'motorcycle' ? 1 : Number(form.seatsAvailable),
        womenOnly: user?.gender === 'female' ? womenOnly : false,
        costPerSeat: calculateCostPerSeat(roadDistanceKm, form.vehicleType),
        vehicleType: form.vehicleType,
      });
      setSuccess(ride);
    } catch (err) {
      setError(err.message || 'Failed to create ride');
    } finally {
      setLoading(false);
    }
  };

  if (success) return (
    <div className="narrow-wrap fade-up text-center" style={{ paddingTop:80 }}>
      <div style={{ fontSize:64 }}>🎉</div>
      <h2 className="heading mt-20" style={{ fontSize:28 }}>Ride Posted!</h2>
      <p className="text-muted mt-8">Your ride is live. Seekers near your pickup can now find and book it.</p>
      <div className="flex-center gap-12 mt-32">
        <button className="btn btn-primary btn-lg" onClick={() => navigate('provider-bookings')}>View Requests</button>
        <button className="btn btn-secondary" onClick={() => { setSuccess(null); setForm(EMPTY); }}>Post Another</button>
      </div>
    </div>
  );

  const calculatedCost = calculateCostPerSeat(roadDistanceKm, form.vehicleType);


  return (
    <div className="narrow-wrap fade-up">
      <p className="eyebrow mb-16">Provider</p>
      <h1 className="heading mb-8" style={{ fontSize:30 }}>Offer a Ride</h1>
      <p className="text-muted mb-28 text-sm">Set your route. Seekers near your pickup will find your ride.</p>

      <form onSubmit={submit}>
        {locationConfig.message && (
          <div className="alert alert-info mb-20">ℹ️ {locationConfig.message}</div>
        )}

        {/* Pickup Type */}
        <div className="field mb-32">
          <label>Where are you picking up from? *</label>
          <div className="pickup-type-grid">
            <button type="button" className={`pickup-type-btn ${pickupType==='college'?'selected':''}`} onClick={() => setPickupType('college')}>
              <span className="icon">🏫</span><span className="text">College</span>
            </button>
            <button type="button" className={`pickup-type-btn ${pickupType==='home'?'selected':''}`} onClick={() => setPickupType('home')}>
              <span className="icon">🏠</span><span className="text">Home</span>
            </button>
          </div>
        </div>

        {/* Pickup */}
        <div className="loc-section">
          <div className="ls-head"><span className="ls-dot green"/><span className="ls-label">Pickup Point</span></div>
          <div className="field">
            <label>Pickup Location *</label>
            {locationConfig.pickupIsCollege ? (
              <CollegeLocationSearch key="pickup-college" value={form.pickupLabel}
                onChange={(label,lat,lng) => setForm(f=>({...f,pickupLabel:label,pickupLat:lat.toString(),pickupLng:lng.toString()}))}
                placeholder="Search for college pickup..." className="mb-12" />
            ) : (
              <LocationSearch key="pickup-location"
                onChange={(label,lat,lng) => setForm(f=>({...f,pickupLabel:label,pickupLat:lat.toString(),pickupLng:lng.toString()}))}
                placeholder="Search for pickup location..." className="mb-12" />
            )}
          </div>
        </div>

        {/* Drop */}
        <div className="loc-section">
          <div className="ls-head"><span className="ls-dot red"/><span className="ls-label">Drop Point</span></div>
          <div className="field">
            <label>Drop Location *</label>
            {locationConfig.dropIsCollege ? (
              <CollegeLocationSearch key="drop-college" value={form.dropLabel}
                onChange={(label,lat,lng) => setForm(f=>({...f,dropLabel:label,dropLat:lat.toString(),dropLng:lng.toString()}))}
                placeholder="Search for college drop..." className="mb-12" />
            ) : (
              <LocationSearch key="drop-location"
                onChange={(label,lat,lng) => setForm(f=>({...f,dropLabel:label,dropLat:lat.toString(),dropLng:lng.toString()}))}
                placeholder="Search for drop location..." className="mb-12" />
            )}
          </div>
        </div>

        {/* Schedule */}
        <div className="field mb-24">
          <label>When is the ride? *</label>
          <div className="pickup-type-grid">
            <button type="button" className={`pickup-type-btn ${scheduleType==='now'?'selected':''}`} onClick={() => setScheduleType('now')}>
              <span className="icon">⚡</span><span className="text">Ride Now</span>
            </button>
            <button type="button" className={`pickup-type-btn ${scheduleType==='later'?'selected':''}`} onClick={() => setScheduleType('later')}>
              <span className="icon">📅</span><span className="text">Schedule Later</span>
            </button>
          </div>
        </div>

        {scheduleType === 'later' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }} className="mb-20">
            <div className="field" style={{ marginBottom:0 }}>
              <label>Date ✶</label>
              <input className="input" type="date" min={new Date().toISOString().split('T')[0]} value={form.date} onChange={set('date')} required />
            </div>
            <div className="field" style={{ marginBottom:0 }}>
              <label>Time ✶</label>
              <input className="input" type="time" value={form.time} onChange={set('time')} required />
            </div>
          </div>
        )}

        {scheduleType === 'now' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }} className="mb-20">
            <div className="field" style={{ marginBottom:0 }}>
              <label>📅 Date</label>
              <div className="input" style={{ background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.5)', cursor:'default' }}>
                {form.date ? new Date(form.date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '—'}
              </div>
            </div>
            <div className="field" style={{ marginBottom:0 }}>
              <label>🕐 Time</label>
              <div className="input" style={{ background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.5)', cursor:'default' }}>
                {form.time || '—'}
              </div>
            </div>
          </div>
        )}

        {/* Vehicle Type */}
        <div className="field mb-20">
          <label>Vehicle Type ✶</label>
          <div className="vehicle-type-grid">
            {VEHICLE_TYPES.map(vehicle => {
              const [icon, ...nameParts] = vehicle.label.split(' ');
              return (
                <div key={vehicle.value}
                  className={`vehicle-type-card ${form.vehicleType===vehicle.value?'selected':''}`}
                  onClick={() => setForm(f=>({...f,vehicleType:vehicle.value,seatsAvailable:vehicle.capacity}))}>
                  <div className="vehicle-icon">{icon}</div>
                  <div className="vehicle-name">{nameParts.join(' ')}</div>
                  <div className="vehicle-capacity">Max {vehicle.capacity} seat{vehicle.capacity>1?'s':''}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cost display */}
        <div className="field mb-20">
          <label>Auto-Calculated Cost per Seat (₹)</label>
          <div className="cost-display">
            <div className="cost-amount">₹{calculatedCost || '—'}</div>
            <div className="cost-info">
              {calculatedCost > 0
                ? <span className="text-muted text-sm">Based on distance and vehicle type</span>
                : <span className="text-muted text-sm">Set pickup and drop to calculate cost</span>}
            </div>
          </div>
        </div>

        {roadDistanceKm > 0 && (
          <div className="earn-card mb-20">
            <div>
              <div className="earn-label">Fare per seat</div>
              {roadDistanceKm > 30 && (
                <div style={{ fontSize:11, color:'#ff9800', marginTop:4 }}>
                  ⚠️ {roadDistanceKm} km seems far — verify with 📍 GPS for accurate fare
                </div>
              )}
            </div>
            <div className="earn-amount">₹{calculatedCost}</div>
          </div>
        )}

        {/* Women-only toggle */}
        {user?.gender === 'female' && (
          <div className="field mb-20">
            <label>Safety Preference</label>
            <button type="button" onClick={() => setWomenOnly(w => !w)}
              style={{ display:'flex', alignItems:'center', gap:10, width:'100%',
                background:womenOnly?'rgba(233,30,140,0.12)':'rgba(255,255,255,0.05)',
                border:`2px solid ${womenOnly?'#e91e8c':'rgba(255,255,255,0.1)'}`,
                borderRadius:12, padding:'14px 16px', cursor:'pointer', transition:'all 0.2s', textAlign:'left' }}>
              <span style={{ fontSize:24 }}>{womenOnly?'🔒':'♀'}</span>
              <div>
                <div style={{ color:womenOnly?'#e91e8c':'#ccc', fontWeight:700, fontSize:14 }}>
                  Women-only ride {womenOnly && <span style={{ background:'#e91e8c', color:'#fff', borderRadius:4, padding:'1px 8px', fontSize:11, marginLeft:4 }}>ON</span>}
                </div>
                <div style={{ color:'#666', fontSize:12, marginTop:2 }}>
                  {womenOnly ? 'Only female seekers can book this ride.' : 'Enable to restrict to female seekers only.'}
                </div>
              </div>
            </button>
          </div>
        )}

        {error && <div className="alert alert-error mb-12">{error}</div>}

        <button type="submit" className={`btn btn-primary btn-lg btn-full ${loading?'btn-loading':''}`} disabled={loading}>
          {!loading && '🚗 Post Ride'}
        </button>
      </form>

      <div style={{ marginTop:28 }}>
        <NearbyMap
          pickupLat={form.pickupLat} pickupLng={form.pickupLng}
          dropLat={form.dropLat}     dropLng={form.dropLng}
          userGender={user?.gender}
        />
      </div>
    </div>
  );
}
