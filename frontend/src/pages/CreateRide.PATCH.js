// ═══════════════════════════════════════════════════════════════════
//  PATCH INSTRUCTIONS FOR frontend/src/pages/CreateRide.jsx
//  Apply each block as a find-and-replace in your editor.
// ═══════════════════════════════════════════════════════════════════

// ── 1. Replace COLLEGE_PRESETS array ─────────────────────────────
// FIND:
const COLLEGE_PRESETS = [
  { label: 'RNS Institute of Technology',       lat: 12.9116, lng: 77.4655, keys: ['rns','rns institute'] },
  { label: 'RV College of Engineering',          lat: 12.9215, lng: 77.4958, keys: ['rv college','rvce'] },
  { label: 'BMS College of Engineering',         lat: 12.9611, lng: 77.5908, keys: ['bms college','bmsce'] },
  { label: 'PES University',                     lat: 12.9345, lng: 77.5366, keys: ['pes university','pesu'] },
  { label: 'MS Ramaiah Institute of Technology', lat: 13.0163, lng: 77.5770, keys: ['ramaiah','msrit','ms ramaiah'] },
  { label: 'Bangalore Institute of Technology',  lat: 12.9539, lng: 77.6007, keys: ['bit bangalore','bangalore institute of technology'] },
  { label: 'Dayananda Sagar College',            lat: 12.9148, lng: 77.5444, keys: ['dayananda sagar','dsce','dscet'] },
  { label: 'Christ University',                  lat: 12.9360, lng: 77.6115, keys: ['christ university','christ college'] },
  { label: 'Jain University',                    lat: 12.9630, lng: 77.5750, keys: ['jain university','jain college'] },
  { label: 'Nitte Meenakshi Institute',          lat: 13.1323, lng: 77.5869, keys: ['nitte','nitte meenakshi'] },
];

// REPLACE WITH:
const COLLEGE_PRESETS = [
  // ── Channasandra cluster (west Bangalore, NOT Yelahanka) ──────────
  { label: 'RNS Institute of Technology',          lat: 12.9218, lng: 77.4890, keys: ['rns','rnsit','rns institute','rns institute of technology'] },
  { label: 'RNS First Grade College',              lat: 12.9220, lng: 77.4885, keys: ['rnsfg','rns first grade','rns fg','rns first grade college'] },
  { label: 'Global Academy of Technology',         lat: 12.9449, lng: 77.4768, keys: ['gat','global academy','global academy of technology'] },
  { label: 'Don Bosco Institute of Technology',    lat: 12.9282, lng: 77.5046, keys: ['dbit','don bosco','don bosco institute'] },
  // ── South / south-west ───────────────────────────────────────────
  { label: 'RV College of Engineering',            lat: 12.9215, lng: 77.4958, keys: ['rv college','rvce','rv college of engineering'] },
  { label: 'BMS College of Engineering',           lat: 12.9611, lng: 77.5908, keys: ['bms college','bmsce','bms college of engineering'] },
  { label: 'BMS Institute of Technology',          lat: 13.0634, lng: 77.5122, keys: ['bmsit','bms institute of technology'] },
  { label: 'PES University (Ring Road)',           lat: 12.9345, lng: 77.5366, keys: ['pes university','pesu','pesit south'] },
  { label: 'Dayananda Sagar College of Engg',     lat: 12.9019, lng: 77.5679, keys: ['dayananda sagar','dsce','dscet','dayananda sagar college'] },
  { label: 'SJB Institute of Technology',         lat: 12.8999, lng: 77.5526, keys: ['sjbit','sjb institute','s j b institute'] },
  { label: 'Christ University',                   lat: 12.9360, lng: 77.6115, keys: ['christ university','christ college'] },
  // ── North Bangalore ──────────────────────────────────────────────
  { label: 'MS Ramaiah Institute of Technology',  lat: 13.0163, lng: 77.5770, keys: ['ramaiah','msrit','ms ramaiah','ms ramaiah institute'] },
  { label: 'CMR Institute of Technology',         lat: 13.1120, lng: 77.6120, keys: ['cmrit','cmr institute','cmr institute of technology'] },
  { label: 'Nitte Meenakshi Institute of Technology', lat: 13.1114, lng: 77.5963, keys: ['nitte','nmit','nitte meenakshi','nitte meenakshi institute'] },
  { label: 'Sir MVIT (Yelahanka)',                lat: 13.1337, lng: 77.5783, keys: ['mvit','sir mvit','m visvesvaraya institute'] },
  { label: 'Acharya Institute of Technology',     lat: 13.0633, lng: 77.5122, keys: ['acharya','ait','acharya institute'] },
  // ── Central / east ───────────────────────────────────────────────
  { label: 'Bangalore Institute of Technology',   lat: 12.9539, lng: 77.6007, keys: ['bit bangalore','bangalore institute of technology'] },
  { label: 'Jain University',                     lat: 12.9630, lng: 77.5750, keys: ['jain university','jain college'] },
  { label: 'New Horizon College of Engineering',  lat: 13.0497, lng: 77.6408, keys: ['nhce','new horizon','new horizon college'] },
  { label: 'REVA University (Yelahanka)',         lat: 13.1167, lng: 77.5942, keys: ['reva','reva university'] },
];


// ── 2. Replace calculateCostPerSeat function ──────────────────────
// FIND:
const calculateCostPerSeat = (distanceKm, vehicleType) => {
  if (!distanceKm || distanceKm <= 0) return 0;

  // Sanity check — campus rides shouldn't exceed 50km
  const safeDistance = Math.min(distanceKm, 50);

  // Rates per vehicle type (Indian campus ride context)
  // Bike: ≤1km → base ₹10; >1km → ₹5/km only (no base)
  // e.g. 6km bike = 6 × 5 = ₹30 ✓
  const rates = {
    motorcycle: { base: 20, perKm: 5  },
    car:        { base: 25, perKm: 7 },
    suv:        { base: 25, perKm: 7 },
    xuv:        { base: 25, perKm: 10 },
  };

  const { base, perKm } = rates[vehicleType] || rates.car;

  if (safeDistance <= 1) {
    // Short trip — just base fare
    return base;
  }
  // Longer trip — per-km charges only, no base fare
  return Math.round(safeDistance * perKm);
};

// REPLACE WITH:
// Auto cost calculator
// Logic:
//   • distance ≤ 1 km           → always show base fare (minimum trip)
//   • distance  > 1 km          → calculate per-km fare
//   • per-km fare < base fare   → show base fare (protects minimum)
//   • per-km fare ≥ base fare   → show per-km fare
const calculateCostPerSeat = (distanceKm, vehicleType) => {
  if (!distanceKm || distanceKm <= 0) return 0;

  // Cap at 50 km — longer than this is unusual for a campus ride
  const safeDistance = Math.min(distanceKm, 50);

  // Rates per vehicle type
  const rates = {
    motorcycle: { base: 20, perKm: 5  },
    car:        { base: 25, perKm: 7  },
    suv:        { base: 30, perKm: 9  },
    xuv:        { base: 35, perKm: 11 },
  };

  const { base, perKm } = rates[vehicleType] || rates.car;

  if (safeDistance <= 1) {
    // Very short — just charge the base fare
    return base;
  }

  const perKmFare = Math.round(safeDistance * perKm);
  // If per-km calculation comes out lower than the base fare (e.g. 2km car
  // = 2×7 = ₹14 which is less than ₹25 base), use the base fare instead.
  return Math.max(base, perKmFare);
};


// ── 3. Fix the earn-card formula display string ───────────────────
// FIND:
                  {roadDistanceKm < 1
                    ? `${roadDistanceKm} km → base fare`
                    : `${roadDistanceKm} km × ₹${({motorcycle:5,car:10,suv:12,xuv:14}[form.vehicleType]||10)}/km`}

// REPLACE WITH:
                  {roadDistanceKm <= 1
                    ? `${roadDistanceKm} km → base fare (₹${{ motorcycle:20,car:25,suv:30,xuv:35 }[form.vehicleType]||25})`
                    : calculatedCost === ({ motorcycle:20,car:25,suv:30,xuv:35 }[form.vehicleType]||25)
                      ? `${roadDistanceKm} km → per-km < base fare → showing base`
                      : `${roadDistanceKm} km × ₹${{ motorcycle:5,car:7,suv:9,xuv:11 }[form.vehicleType]||7}/km`}
