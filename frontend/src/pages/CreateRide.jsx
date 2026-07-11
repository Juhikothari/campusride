

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import LocationSearch from '../components/LocationSearch.jsx';
import CollegeLocationSearch from '../components/CollegeLocationSearch.jsx';
import NearbyMap from '../components/NearbyMap.jsx';
import * as api from '../services/api.js';
import './CreateRide.css';

const COLLEGE_PRESETS = [
  { label: 'RV College of Engineering', lat: 12.9215, lng: 77.4958 },
  { label: 'BMS College of Engineering', lat: 12.9611, lng: 77.5908 },
  { label: 'PES University', lat: 12.9345, lng: 77.5366 },
  { label: 'MS Ramaiah Institute', lat: 13.0163, lng: 77.5770 },
  { label: 'Bangalore Institute of Technology', lat: 12.9539, lng: 77.6007 }
];

const CITY_PRESETS = [
  { label: 'Bangalore', lat: 12.9716, lng: 77.5946 },
  { label: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
  { label: 'Delhi', lat: 28.6139, lng: 77.2090 },
  { label: 'Mumbai', lat: 19.0760, lng: 72.8777 },
  { label: 'Chennai', lat: 13.0827, lng: 80.2707 },
  { label: 'Kolkata', lat: 22.5726, lng: 88.3639 },
  { label: 'Pune', lat: 18.5204, lng: 73.8567 },
  { label: 'Jaipur', lat: 26.9124, lng: 75.7873 },
  { label: 'Lucknow', lat: 26.8467, lng: 80.9462 },
  { label: 'Indore', lat: 22.7196, lng: 75.8577 }
];

const EMPTY = { 
  pickupLabel:'', 
  pickupLat:'', 
  pickupLng:'', 
  dropLabel:'', 
  dropLat:'', 
  dropLng:'', 
  date:'', 
  time:'', 
  seatsAvailable:3, 
  costPerSeat:0,
  vehicleType: 'car' // Default vehicle type
};

const VEHICLE_TYPES = [
  { value: 'motorcycle', label: '🏍 Bike', capacity: 1 },
  { value: 'car', label: '🚗 Car', capacity: 3 },
  { value: 'suv', label: '🚙 SUV', capacity: 4 },
  { value: 'xuv', label: '🚐 XUV', capacity: 6 }
];

// Auto cost calculator based on vehicle fuel efficiency
const calculateCostPerSeat = (pickupLat, pickupLng, dropLat, dropLng, vehicleType) => {
  if (!pickupLat || !pickupLng || !dropLat || !dropLng) return 0;
  
  // Calculate distance using Haversine formula
  const R = 6371; // Earth's radius in km
  const dLat = (dropLat - pickupLat) * Math.PI / 180;
  const dLng = (dropLng - pickupLng) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(pickupLat * Math.PI / 180) * Math.cos(dropLat * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  // Per km pricing per seat (student-friendly rates)
  const perKmRates = {
    motorcycle: 5,     // Bikes: only base fare, no per km charge
    car: 7,           // Cars: ₹3 per km per seat
    suv: 7,           // SUVs: ₹4 per km per seat
    xuv: 10            // XUVs: ₹5 per km per seat
  };
  
  // Base fares per vehicle type
  const baseFares = {
    motorcycle: 20,     // Bike base fare
    car: 25,          // Car base fare
    suv: 25,          // SUV base fare
    xuv: 25           // XUV base fare
  };
  
  const perKmRate = perKmRates[vehicleType] || perKmRates.car;
  const baseFare = baseFares[vehicleType] || baseFares.car;
  
  // Calculate cost: base fare + (distance × per km rate)
  const calculatedCost = Math.round(baseFare + (distance * perKmRate));
  
  // Minimum fare of ₹30 to stay competitive
  return Math.max(calculatedCost, 20);
};

// Location config based on pickup type selection
const getLocationConfig = (pickupType) => {
  if (pickupType === 'college') {
    return {
      pickupIsCollege: true,
      dropIsCollege: false,
      dropExcludeColleges: true,
      message: "College pickup: Drop locations limited to general areas"
    };
  } else if (pickupType === 'home') {
    return {
      pickupIsCollege: false,
      dropIsCollege: true,
      dropExcludeColleges: false,
      message: "Home pickup: Drop locations limited to colleges"
    };
  }
  
  // Default case
  return {
    pickupIsCollege: false,
    dropIsCollege: false,
    dropExcludeColleges: false,
    message: ""
  };
};

export default function CreateRide({ navigate }) {
  const { user } = useAuth();
  const [form,      setForm]      = useState(EMPTY);
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [success,   setSuccess]   = useState(null);
  const [pickupType, setPickupType] = useState('');
  const [scheduleType, setScheduleType] = useState(''); // 'now' or 'later'
  const [locationConfig, setLocationConfig] = useState(getLocationConfig(''));
  const [womenOnly, setWomenOnly] = useState(false);
  const isFemale = user?.gender === 'female';

  // Update location config when pickup type changes
  useEffect(() => {
    setLocationConfig(getLocationConfig(pickupType));
  }, [pickupType]);

  // When "Book Now" is selected, auto-fill current date and time
  useEffect(() => {
    if (scheduleType === 'now') {
      const now = new Date();
      const date = now.toISOString().split('T')[0];
      const time = now.toTimeString().slice(0, 5); // HH:MM
      setForm(f => ({ ...f, date, time }));
    } else if (scheduleType === 'later') {
      setForm(f => ({ ...f, date: '', time: '' }));
    }
  }, [scheduleType]);

  const isProvider = user?.role === 'provider' || user?.role === 'both';
  if (!isProvider) {
    return (
      <div className="narrow-wrap fade-up text-center" style={{paddingTop:80}}>
        <div style={{fontSize:64}}>¡Ï</div>
        <h2 className="heading mt-20" style={{fontSize:28, marginBottom:4}}>Access Denied</h2>
        <p className="text-muted mt-8">Only providers can create rides.</p>
        <button className="btn btn-primary btn-lg mt-32" onClick={() => navigate('dashboard')}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const applyPreset = (which, p) => {
    if (which === 'pickup') {
      setForm(f => ({ ...f, pickupLabel: p.label, pickupLat: p.lat.toString(), pickupLng: p.lng.toString() }));
    } else {
      setForm(f => ({ ...f, dropLabel: p.label, dropLat: p.lat.toString(), dropLng: p.lng.toString() }));
    }
  };

  const submit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const validate = () => {
        if (!form.pickupLat || !form.pickupLng) return 'Set pickup coordinates';
        if (!form.dropLat   || !form.dropLng)   return 'Set drop coordinates';
        if (form.pickupLat === form.dropLat && form.pickupLng === form.dropLng) return 'Pickup and drop location cannot be the same';
        if (!form.date) return 'Date is required';
        if (!form.time) return 'Time is required';
        // Only check future date for scheduled rides, not "now"
        if (scheduleType === 'later' && new Date(`${form.date}T${form.time}`) < new Date()) return 'Date/time must be in the future';
        if (!pickupType) return 'Please select College or Home pickup type';
        return null;
      };
      const validationError = validate();
      if (validationError) {
        setError(validationError);
        setLoading(false);
        return;
      }
      const ride = await api.createRide({
        pickup: {
          coordinates: [parseFloat(form.pickupLng), parseFloat(form.pickupLat)],
          address:     form.pickupLabel,
        },
        drop: {
          coordinates: [parseFloat(form.dropLng), parseFloat(form.dropLat)],
          address:     form.dropLabel,
        },
        date: new Date(`${form.date}T${form.time}`).toISOString(),
        time: form.time,
        seatsAvailable: form.vehicleType === 'motorcycle' ? 1 : Number(form.seatsAvailable),
        womenOnly: isFemale ? womenOnly : false,
        costPerSeat: calculateCostPerSeat(
          parseFloat(form.pickupLat),
          parseFloat(form.pickupLng),
          parseFloat(form.dropLat),
          parseFloat(form.dropLng),
          form.vehicleType
        ),
      });
      setSuccess(ride);
    } catch (err) {
      setError(err.message || 'Failed to create ride');
    } finally {
      setLoading(false);
    }
  };

  if (success) return (
    <div className="narrow-wrap fade-up text-center" style={{paddingTop:80}}>
      <div style={{fontSize:64}}>🎉</div>
      <h2 className="heading mt-20" style={{fontSize:28}}>Ride Posted!</h2>
      <p className="text-muted mt-8">Your ride is live. Seekers near your pickup can now find and book it.</p>
      <div className="flex-center gap-12 mt-32">
        <button className="btn btn-primary btn-lg" onClick={() => navigate('provider-bookings')}>
          View Requests
        </button>
        <button className="btn btn-secondary" onClick={() => { setSuccess(null); setForm(EMPTY); }}>
          Post Another
        </button>
      </div>
    </div>
  );

  const calculatedCost = calculateCostPerSeat(
    parseFloat(form.pickupLat),
    parseFloat(form.pickupLng),
    parseFloat(form.dropLat),
    parseFloat(form.dropLng),
    form.vehicleType
  );
  const maxEarnings = form.seatsAvailable * calculatedCost;

  return (
    <div className="narrow-wrap fade-up">
      <p className="eyebrow mb-16">Provider</p>
      <h1 className="heading mb-8" style={{fontSize:30}}>Offer a Ride</h1>
      <p className="text-muted mb-28 text-sm">Set your route. Seekers near your pickup will find your ride.</p>

      <form onSubmit={submit}>
        {locationConfig.message && (
          <div className="alert alert-info mb-20">
            ℹ️ {locationConfig.message}
          </div>
        )}

        {/* ── Pickup Type Selection ── */}
        <div className="field mb-32">
          <label>Where are you picking up from? *</label>
          <div className="pickup-type-grid">
            <button
              type="button"
              className={`pickup-type-btn ${pickupType === 'college' ? 'selected' : ''}`}
              onClick={() => setPickupType('college')}
            >
              <span className="icon">🏫</span>
              <span className="text">College</span>
            </button>
            <button
              type="button"
              className={`pickup-type-btn ${pickupType === 'home' ? 'selected' : ''}`}
              onClick={() => setPickupType('home')}
            >
              <span className="icon">🏠</span>
              <span className="text">Home</span>
            </button>
          </div>
        </div>

        {/* ── Pickup ── */}
        <div className="loc-section">
          <div className="ls-head">
            <span className="ls-dot green" /><span className="ls-label">Pickup Point</span>
          </div>
          <div className="field">
            <label>Pickup Location *</label>
            {locationConfig.pickupIsCollege ? (
              <CollegeLocationSearch
                key="pickup-college"
                value={form.pickupLabel}
                onChange={(label, lat, lng) => setForm(f => ({ ...f, pickupLabel: label, pickupLat: lat.toString(), pickupLng: lng.toString() }))}
                placeholder="Search for college pickup..."
                className="mb-12"
              />
            ) : (
              <LocationSearch
                key="pickup-location"
                onChange={(label, lat, lng) => setForm(f => ({ ...f, pickupLabel: label, pickupLat: lat.toString(), pickupLng: lng.toString() }))}
                placeholder="Search for pickup location..."
                className="mb-12"
              />
            )}
          </div>
        </div>

        {/* ── Drop ── */}
        <div className="loc-section">
          <div className="ls-head">
            <span className="ls-dot red" /><span className="ls-label">Drop Point</span>
          </div>
          <div className="field">
            <label>Drop Location *</label>
            {locationConfig.dropIsCollege ? (
              <CollegeLocationSearch
                key="drop-college"
                value={form.dropLabel}
                onChange={(label, lat, lng) => setForm(f => ({ ...f, dropLabel: label, dropLat: lat.toString(), dropLng: lng.toString() }))}
                placeholder="Search for college drop..."
                className="mb-12"
              />
            ) : (
              <LocationSearch
                key="drop-location"
                onChange={(label, lat, lng) => setForm(f => ({ ...f, dropLabel: label, dropLat: lat.toString(), dropLng: lng.toString() }))}
                placeholder="Search for drop location..."
                className="mb-12"
              />
            )}
          </div>
        </div>

        {/* ── Schedule Type ── */}
        <div className="field mb-24">
          <label>When is the ride? *</label>
          <div className="pickup-type-grid">
            <button
              type="button"
              className={`pickup-type-btn ${scheduleType === 'now' ? 'selected' : ''}`}
              onClick={() => setScheduleType('now')}
            >
              <span className="icon">⚡</span>
              <span className="text">Ride Now</span>
            </button>
            <button
              type="button"
              className={`pickup-type-btn ${scheduleType === 'later' ? 'selected' : ''}`}
              onClick={() => setScheduleType('later')}
            >
              <span className="icon">📅</span>
              <span className="text">Schedule Later</span>
            </button>
          </div>
        </div>

        {/* ── Date / Time — only shown for scheduled rides ── */}
        {scheduleType === 'later' && (
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}} className="mb-20">
            <div className="field" style={{marginBottom:0}}>
              <label>Date ✶</label>
              <input className="input" type="date" min={new Date().toISOString().split('T')[0]} value={form.date} onChange={set('date')} required />
            </div>
            <div className="field" style={{marginBottom:0}}>
              <label>Time ✶</label>
              <input className="input" type="time" value={form.time} onChange={set('time')} required />
            </div>
          </div>
        )}

        {/* ── Ride Now: show auto-detected date & time as read-only ── */}
        {scheduleType === 'now' && (
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}} className="mb-20">
            <div className="field" style={{marginBottom:0}}>
              <label>📅 Date</label>
              <div className="input" style={{background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.5)', cursor:'default'}}>
                {form.date ? new Date(form.date).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'}) : '—'}
              </div>
            </div>
            <div className="field" style={{marginBottom:0}}>
              <label>🕐 Time</label>
              <div className="input" style={{background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.5)', cursor:'default'}}>
                {form.time || '—'}
              </div>
            </div>
          </div>
        )}

        {/* ── Vehicle Type ── */}
        <div className="field mb-20">
          <label>Vehicle Type ✶</label>
          <div className="vehicle-type-grid">
            {VEHICLE_TYPES.map(vehicle => {
              const labelParts = vehicle.label.split(' ');
              const icon = labelParts[0];
              const name = labelParts.slice(1).join(' ');
              return (
                <div
                  key={vehicle.value}
                  className={`vehicle-type-card ${form.vehicleType === vehicle.value ? 'selected' : ''}`}
                  onClick={() => setForm(f => ({ ...f, vehicleType: vehicle.value, seatsAvailable: vehicle.capacity }))}
                >
                  <div className="vehicle-icon">{icon}</div>
                  <div className="vehicle-name">{name}</div>
                  <div className="vehicle-capacity">
                    Max {vehicle.capacity} seat{vehicle.capacity > 1 ? 's' : ''}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Auto Calculated Cost ── */}
        <div className="field mb-20">
          <label>Auto-Calculated Cost per Seat (₹)</label>
          <div className="cost-display">
            <div className="cost-amount">₹{calculatedCost}</div>
            <div className="cost-info">
              {calculatedCost > 0 ? (
                <span className="text-muted text-sm">Based on distance and vehicle type</span>
              ) : (
                <span className="text-muted text-sm">Set pickup and drop locations to calculate cost</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Earnings preview ── */}
        {maxEarnings > 0 && (
          <div className="earn-card mb-20">
            <div>
              <div className="earn-label">Max earnings if fully booked</div>
              <div className="earn-formula text-dim text-xs">{form.seatsAvailable} seat{form.seatsAvailable>1?'s':''} × ₹{calculatedCost}</div>
            </div>
            <div className="earn-amount">₹{maxEarnings}</div>
          </div>
        )}

        {/* ── Women-only ride toggle (female accounts only) ── */}
        {isFemale && (
          <div className="field mb-20">
            <label>Safety Preference</label>
            <button
              type="button"
              onClick={() => setWomenOnly(w => !w)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                background: womenOnly ? 'rgba(233,30,140,0.12)' : 'rgba(255,255,255,0.05)',
                border: `2px solid ${womenOnly ? '#e91e8c' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
                transition: 'all 0.2s', textAlign: 'left',
              }}>
              <span style={{fontSize: 24}}>{womenOnly ? '🔒' : '♀'}</span>
              <div>
                <div style={{color: womenOnly ? '#e91e8c' : '#ccc', fontWeight: 700, fontSize: 14}}>
                  Women-only ride {womenOnly && <span style={{background:'#e91e8c',color:'#fff',borderRadius:4,padding:'1px 8px',fontSize:11,marginLeft:4}}>ON</span>}
                </div>
                <div style={{color: '#666', fontSize: 12, marginTop: 2}}>
                  {womenOnly
                    ? 'Only female seekers can book this ride.'
                    : 'Enable to restrict this ride to female seekers only.'}
                </div>
              </div>
            </button>
          </div>
        )}

        {/* ── Error shown near submit button ── */}
        {error && <div className="alert alert-error mb-12">{error}</div>}

        <button type="submit" className={`btn btn-primary btn-lg btn-full ${loading ? 'btn-loading' : ''}`} disabled={loading}>
          {!loading && '🚗 Post Ride'}
        </button>
      </form>

      {/* ── Nearby map (shows nearby seekers + optimal route preview) ── */}
      <div style={{marginTop: 28}}>
        <NearbyMap
          pickupLat={form.pickupLat}
          pickupLng={form.pickupLng}
          dropLat={form.dropLat}
          dropLng={form.dropLng}
          userGender={user?.gender}
        />
      </div>
    </div>
  );
}