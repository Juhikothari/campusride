// ═══════════════════════════════════════════════════════════════════
//  PATCH INSTRUCTIONS FOR frontend/src/pages/IncidentReport.jsx
//  Adds provider-as-rider incident types (e.g. vehicle issues,
//  accidents, road hazards that the rider experienced themselves)
// ═══════════════════════════════════════════════════════════════════

// FIND:
const PROVIDER_INCIDENT_TYPES = [
  'Passenger No Show',
  'Passenger Rude / Abusive Behaviour',
  'Passenger Harassment',
  'Passenger Refused to Pay',
  'Passenger Cancelled at Last Minute',
  'Passenger Brought Extra People',
  'Passenger Damaged Vehicle',
  'Passenger Under Influence',
  'Passenger Threatened Driver',
  'Passenger Privacy Violation',
  'Fake Booking',
  'Wrong Pickup Location Given',
  'Passenger Verbal Abuse',
  'Passenger Physical Aggression',
  'Passenger Brought Prohibited Items',
  'Passenger Inappropriate Behaviour',
  'Passenger Left Without Confirmation',
  'Booking Fraud / Identity Mismatch',
  'Safety Threat by Passenger',
  'Other',
];

// REPLACE WITH:
// ── Passenger-related incidents (provider reporting about a passenger)
const PROVIDER_PASSENGER_INCIDENT_TYPES = [
  'Passenger No Show',
  'Passenger Rude / Abusive Behaviour',
  'Passenger Harassment',
  'Passenger Refused to Pay',
  'Passenger Cancelled at Last Minute',
  'Passenger Brought Extra People',
  'Passenger Damaged Vehicle',
  'Passenger Under Influence',
  'Passenger Threatened Driver',
  'Passenger Privacy Violation',
  'Fake Booking',
  'Wrong Pickup Location Given',
  'Passenger Verbal Abuse',
  'Passenger Physical Aggression',
  'Passenger Brought Prohibited Items',
  'Passenger Inappropriate Behaviour',
  'Passenger Left Without Confirmation',
  'Booking Fraud / Identity Mismatch',
  'Safety Threat by Passenger',
  'Other',
];

// ── Rider/road incidents (provider reporting something that happened to them)
const PROVIDER_RIDER_INCIDENT_TYPES = [
  'Accident / Collision',
  'Near-Miss / Close Call',
  'Vehicle Breakdown Mid-Ride',
  'Tyre Puncture Mid-Ride',
  'Fuel Ran Out Mid-Ride',
  'Rash Driving by Another Vehicle',
  'Road Rage by Another Driver',
  'Pothole / Road Hazard Caused Damage',
  'Traffic Signal / Law Enforcement Stop',
  'Vehicle Stolen During Ride',
  'Vehicle Damage (Not by Passenger)',
  'Medical Emergency — Rider',
  'Medical Emergency — Passenger',
  'Natural Hazard (Flooding, Fallen Tree etc.)',
  'Third-Party Collision (Hit by Another Vehicle)',
  'Phone Snatching / Robbery',
  'Other Road / Safety Incident',
  'Other',
];


// ── Now update the part where incidentTypes is determined: ─────────
// FIND:
  const incidentTypes = isProvider ? PROVIDER_INCIDENT_TYPES : SEEKER_INCIDENT_TYPES;

// REPLACE WITH:
  // Provider can choose which category of incident to report
  const [providerSubtype, setProviderSubtype] = useState('passenger'); // 'passenger' | 'rider'
  const incidentTypes = isProvider
    ? (providerSubtype === 'rider' ? PROVIDER_RIDER_INCIDENT_TYPES : PROVIDER_PASSENGER_INCIDENT_TYPES)
    : SEEKER_INCIDENT_TYPES;


// ── Add the subtype toggle UI just above the incident type selector: ─
// FIND (inside the report tab form, before the "Incident Type" card):
          {/* Incident Type — DROPDOWN */}
          <div className="card" style={{padding:20, marginBottom:16}}>

// INSERT BEFORE IT:
          {/* Provider: choose between passenger incident and rider/road incident */}
          {isProvider && (
            <div style={{display:'flex',gap:4,marginBottom:16,background:'#111318',borderRadius:10,padding:4}}>
              {[
                { key:'passenger', label:'🧑‍🤝‍🧑 Passenger Incident', desc:'Issues caused by your passenger' },
                { key:'rider',     label:'🏍️ Rider / Road Incident',  desc:'Accidents, breakdowns, hazards' },
              ].map(s => (
                <button key={s.key}
                  type="button"
                  onClick={() => { setProviderSubtype(s.key); setType(''); }}
                  style={{
                    flex:1, padding:'10px 8px', borderRadius:8, border:'none', cursor:'pointer',
                    fontWeight:600, fontSize:12, textAlign:'center',
                    background: providerSubtype===s.key ? '#f5a623' : 'transparent',
                    color:      providerSubtype===s.key ? '#000'    : '#888',
                  }}>
                  <div>{s.label}</div>
                  <div style={{fontSize:10, fontWeight:400, marginTop:2,
                    color: providerSubtype===s.key ? '#333' : '#555'}}>{s.desc}</div>
                </button>
              ))}
            </div>
          )}

          {/* Incident Type — DROPDOWN */}
          <div className="card" style={{padding:20, marginBottom:16}}>
