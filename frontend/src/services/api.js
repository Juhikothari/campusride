// ══════════════════════════════════════════════════════════════════
//  API SERVICE  —  frontend/src/services/api.js
// ══════════════════════════════════════════════════════════════════

// FIXED: Remove /api suffix if present, then add it back for REST calls only
const rawBase = import.meta.env?.VITE_API_URL || 'http://localhost:5000';
export const API_BASE = rawBase.replace(/\/api\/?$/, ''); // Remove /api if present
const BASE = `${API_BASE}/api`; // Add /api for REST calls

// ── Token / User helpers ──────────────────────────────────────────
export const getToken   = ()  => localStorage.getItem('cr_token') || ''
export const setToken   = (t) => localStorage.setItem('cr_token', t);
export const removeToken= ()  => localStorage.removeItem('cr_token');

export const getUser    = ()  => JSON.parse(localStorage.getItem('cr_user') || 'null');
export const setUser    = (u) => localStorage.setItem('cr_user', JSON.stringify(u));
export const removeUser = ()  => localStorage.removeItem('cr_user');

// ── Base fetch wrapper ────────────────────────────────────────────
const request = async (path, options = {}) => {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res  = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.message || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
};

// ══════════════════════════════════════════════════════════════════
//  LOCATION SEARCH (Use backend proxy to avoid CORS)
// ══════════════════════════════════════════════════════════════════

// FIXED: Use backend proxy instead of direct Nominatim to avoid CORS
export const searchLocation = async (query) => {
  try {
    console.log('Searching for location:', query);
    
    // Try backend proxy first (avoids CORS)
    try {
      const response = await fetch(
        `${API_BASE}/api/location/search?q=${encodeURIComponent(query)}`,
        {
          headers: {
            'Authorization': `Bearer ${getToken()}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          return data;
        }
      }
    } catch (backendError) {
      console.log('Backend location search failed, using fallbacks:', backendError);
    }
    
    // Fallback to local hardcoded locations
    return getFallbackLocations(query);
    
  } catch (error) {
    console.error('Location search failed:', error);
    return getFallbackLocations(query);
  }
};

// FIXED: Use backend proxy for reverse geocode
export const reverseGeocode = async (lat, lng) => {
  try {
    // Try backend proxy first (avoids CORS)
    const response = await fetch(
      `${API_BASE}/api/location/reverse?lat=${lat}&lng=${lng}`,
      {
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      return {
        display_name: data.display_name || data.label,
        label: data.label || 'Unknown Location'
      };
    }
    
    throw new Error('Backend reverse geocode failed');
    
  } catch (error) {
    console.error('Reverse geocoding failed:', error);
    // Return coordinate string as last resort
    return { 
      display_name: `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`, 
      label: `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E` 
    };
  }
};

// Helper function for fallback locations
const getFallbackLocations = (query) => {
  const lowerQuery = query.toLowerCase();
  console.log('Using fallback for:', lowerQuery);
  
  // Engineering colleges all over Bangalore
  const bangaloreColleges = [
    { name: 'rv college of engineering', display: 'RV College of Engineering, Bangalore', lat: 12.9215, lng: 77.4958 },
    { name: 'bms college of engineering', display: 'BMS College of Engineering, Bangalore', lat: 12.9611, lng: 77.5908 },
    { name: 'pes university', display: 'PES University, Bangalore', lat: 12.9345, lng: 77.5366 },
    { name: 'pesit', display: 'PESIT, Bangalore', lat: 12.9345, lng: 77.5366 },
    { name: 'ms ramaiah institute of technology', display: 'MS Ramaiah Institute of Technology, Bangalore', lat: 13.0163, lng: 77.5770 },
    { name: 'ramaiah', display: 'MS Ramaiah Institute of Technology, Bangalore', lat: 13.0163, lng: 77.5770 },
    { name: 'bangalore institute of technology', display: 'Bangalore Institute of Technology, Bangalore', lat: 12.9539, lng: 77.6007 },
    { name: 'bit', display: 'Bangalore Institute of Technology, Bangalore', lat: 12.9539, lng: 77.6007 },
    { name: 'uvce', display: 'University Visvesvaraya College of Engineering, Bangalore', lat: 12.9581, lng: 77.5946 },
    { name: 'university visvesvaraya college of engineering', display: 'University Visvesvaraya College of Engineering, Bangalore', lat: 12.9581, lng: 77.5946 },
    { name: 'international institute of information technology', display: 'IIIT Bangalore', lat: 12.9234, lng: 77.5401 },
    { name: 'iiit bangalore', display: 'IIIT Bangalore', lat: 12.9234, lng: 77.5401 },
    { name: 'christ university', display: 'Christ University, Bangalore', lat: 12.9333, lng: 77.6111 },
    { name: 'christ college', display: 'Christ University, Bangalore', lat: 12.9333, lng: 77.6111 },
    { name: 'jain university', display: 'Jain University, Bangalore', lat: 12.9187, lng: 77.6408 },
    { name: 'jain college', display: 'Jain University, Bangalore', lat: 12.9187, lng: 77.6408 },
    { name: 'vivekananda college of engineering', display: 'Vivekananda College of Engineering, Bangalore', lat: 12.8477, lng: 77.6833 },
    { name: 'vce', display: 'Vivekananda College of Engineering, Bangalore', lat: 12.8477, lng: 77.6833 },
    { name: 'sir mvit', display: 'Sir M Visvesvaraya Institute of Technology, Bangalore', lat: 13.1337, lng: 77.5783 },
    { name: 'mvit', display: 'Sir M Visvesvaraya Institute of Technology, Bangalore', lat: 13.1337, lng: 77.5783 },
    { name: 'new horizon college of engineering', display: 'New Horizon College of Engineering, Bangalore', lat: 13.0497, lng: 77.6408 },
    { name: 'nhce', display: 'New Horizon College of Engineering, Bangalore', lat: 13.0497, lng: 77.6408 },
    { name: 'acharya institute of technology', display: 'Acharya Institute of Technology, Bangalore', lat: 13.1337, lng: 77.6408 },
    { name: 'acharya', display: 'Acharya Institute of Technology, Bangalore', lat: 13.1337, lng: 77.6408 },
    { name: 'dayananda sagar college of engineering', display: 'Dayananda Sagar College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'dsce', display: 'Dayananda Sagar College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'reva university', display: 'REVA University, Bangalore', lat: 13.1337, lng: 77.6408 },
    { name: 'reva', display: 'REVA University, Bangalore', lat: 13.1337, lng: 77.6408 },
    { name: 'siddaganga institute of technology', display: 'Siddaganga Institute of Technology, Bangalore', lat: 13.1337, lng: 77.5401 },
    { name: 'sit', display: 'Siddaganga Institute of Technology, Bangalore', lat: 13.1337, lng: 77.5401 },
    { name: 'nm institute of technology', display: 'NM Institute of Technology, Bangalore', lat: 12.9187, lng: 77.5783 },
    { name: 'nmit', display: 'NM Institute of Technology, Bangalore', lat: 12.9187, lng: 77.5783 },
    { name: 'bangalore college of engineering', display: 'Bangalore College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'bce', display: 'Bangalore College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'sri krishna institute of technology', display: 'Sri Krishna Institute of Technology, Bangalore', lat: 13.1337, lng: 77.5783 },
    { name: 'skit', display: 'Sri Krishna Institute of Technology, Bangalore', lat: 13.1337, lng: 77.5783 },
    { name: 'don bosco institute of technology', display: 'Don Bosco Institute of Technology, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'dbit', display: 'Don Bosco Institute of Technology, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'east west college of engineering', display: 'East West College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'ewce', display: 'East West College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'garden city college of engineering', display: 'Garden City College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'gcce', display: 'Garden City College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'global academy of technology', display: 'Global Academy of Technology, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'gat', display: 'Global Academy of Technology, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'hkbk college of engineering', display: 'HKBK College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'hkbk', display: 'HKBK College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'indian institute of information technology', display: 'IIIT Bangalore', lat: 12.9234, lng: 77.5401 },
    { name: 'iiitb', display: 'IIIT Bangalore', lat: 12.9234, lng: 77.5401 },
    { name: 'islamic university of science', display: 'Islamic University of Science, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'ius', display: 'Islamic University of Science, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'karnataka college of engineering', display: 'Karnataka College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'kce', display: 'Karnataka College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'karnataka law society', display: 'KLS Gogte Institute of Technology, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'kls git', display: 'KLS Gogte Institute of Technology, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'maharaja institute of technology', display: 'Maharaja Institute of Technology, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'mit', display: 'Maharaja Institute of Technology, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'malnad college of engineering', display: 'Malnad College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'mce', display: 'Malnad College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'maratha mandal engineering college', display: 'Maratha Mandal Engineering College, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'mmec', display: 'Maratha Mandal Engineering College, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'm s engineering college', display: 'M S Engineering College, Bangalore', lat: 13.1337, lng: 77.5783 },
    { name: 'msec', display: 'M S Engineering College, Bangalore', lat: 13.1337, lng: 77.5783 },
    { name: 'm s ramaiah institute of technology', display: 'MS Ramaiah Institute of Technology, Bangalore', lat: 13.0163, lng: 77.5770 },
    { name: 'msrit', display: 'MS Ramaiah Institute of Technology, Bangalore', lat: 13.0163, lng: 77.5770 },
    { name: 'national institute of engineering', display: 'National Institute of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'nie', display: 'National Institute of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'nitte meenakshi institute of technology', display: 'Nitte Meenakshi Institute of Technology, Bangalore', lat: 13.1337, lng: 77.5783 },
    { name: 'nmit', display: 'Nitte Meenakshi Institute of Technology, Bangalore', lat: 13.1337, lng: 77.5783 },
    { name: 'oxford college of engineering', display: 'Oxford College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'oxford', display: 'Oxford College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'presidency college of engineering', display: 'Presidency College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'presidency', display: 'Presidency College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'ramaiah institute of technology', display: 'Ramaiah Institute of Technology, Bangalore', lat: 13.0163, lng: 77.5770 },
    { name: 'rit', display: 'Ramaiah Institute of Technology, Bangalore', lat: 13.0163, lng: 77.5770 },
    { name: 'rns institute of technology', display: 'RNS Institute of Technology, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'rnsit', display: 'RNS Institute of Technology, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 's j b institute of technology', display: 'S J B Institute of Technology, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'sjbit', display: 'S J B Institute of Technology, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 's j c institute of technology', display: 'S J C Institute of Technology, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'sjcit', display: 'S J C Institute of Technology, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 's m v institute of technology', display: 'S M V Institute of Technology, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'smvit', display: 'S M V Institute of Technology, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'sapthagiri college of engineering', display: 'Sapthagiri College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'sce', display: 'Sapthagiri College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'sri bhagawan mahaveer jain college', display: 'Sri Bhagawan Mahaveer Jain College, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'sbmjc', display: 'Sri Bhagawan Mahaveer Jain College, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'sri jayachamarajendra college of engineering', display: 'SJCE, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'sjce', display: 'SJCE, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'sri krishna institute of technology', display: 'Sri Krishna Institute of Technology, Bangalore', lat: 13.1337, lng: 77.5783 },
    { name: 'skit', display: 'Sri Krishna Institute of Technology, Bangalore', lat: 13.1337, lng: 77.5783 },
    { name: 'sri venkateswara college of engineering', display: 'Sri Venkateswara College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'svce', display: 'Sri Venkateswara College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'sri vidya niketan college of engineering', display: 'Sri Vidya Niketan College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'svn', display: 'Sri Vidya Niketan College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'sullia college of engineering', display: 'Sullia College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'sce', display: 'Sullia College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'trinity college of engineering', display: 'Trinity College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'tce', display: 'Trinity College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'university college of engineering', display: 'University College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'uce', display: 'University College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'vijaya college of engineering', display: 'Vijaya College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'vce', display: 'Vijaya College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'vishweshwaraiah institute of technology', display: 'Vishweshwaraiah Institute of Technology, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'vit', display: 'Vishweshwaraiah Institute of Technology, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'yellamma dasappa institute of technology', display: 'Yellamma Dasappa Institute of Technology, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'ydit', display: 'Yellamma Dasappa Institute of Technology, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'amrita vishwa vidyapeetham', display: 'Amrita Vishwa Vidyapeetham, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'amrita', display: 'Amrita Vishwa Vidyapeetham, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'b m sreenivasaiah college of engineering', display: 'B M Sreenivasaiah College of Engineering, Bangalore', lat: 12.9611, lng: 77.5908 },
    { name: 'bmsce', display: 'B M Sreenivasaiah College of Engineering, Bangalore', lat: 12.9611, lng: 77.5908 },
    { name: 'b n m institute of technology', display: 'B N M Institute of Technology, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'bnmit', display: 'B N M Institute of Technology, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'c m r institute of technology', display: 'C M R Institute of Technology, Bangalore', lat: 13.1337, lng: 77.5783 },
    { name: 'cmrit', display: 'C M R Institute of Technology, Bangalore', lat: 13.1337, lng: 77.5783 },
    { name: 'c byregowda institute of technology', display: 'C Byregowda Institute of Technology, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'cbit', display: 'C Byregowda Institute of Technology, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'd n s institute of technology', display: 'D N S Institute of Technology, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'dnsit', display: 'D N S Institute of Technology, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'e s college of engineering', display: 'E S College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'esce', display: 'E S College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'g m institute of technology', display: 'G M Institute of Technology, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'gmit', display: 'G M Institute of Technology, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'h k e s polytechnic', display: 'H K E S Polytechnic, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'hkes', display: 'H K E S Polytechnic, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'j n n college of engineering', display: 'J N N College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'jnn', display: 'J N N College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'k l e society college of engineering', display: 'K L E Society College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'kle', display: 'K L E Society College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'k v g college of engineering', display: 'K V G College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'kvg', display: 'K V G College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'm v j college of engineering', display: 'M V J College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'mvj', display: 'M V J College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'p e s college of engineering', display: 'P E S College of Engineering, Bangalore', lat: 12.9345, lng: 77.5366 },
    { name: 'pesce', display: 'P E S College of Engineering, Bangalore', lat: 12.9345, lng: 77.5366 },
    { name: 'r l jalappa institute of technology', display: 'R L Jalappa Institute of Technology, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'rljit', display: 'R L Jalappa Institute of Technology, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 's g s institute of technology', display: 'S G S Institute of Technology, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'sgsit', display: 'S G S Institute of Technology, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 's j b central institute of technology', display: 'S J B Central Institute of Technology, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'sjbcit', display: 'S J B Central Institute of Technology, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 's r m institute of technology', display: 'S R M Institute of Technology, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'srm', display: 'S R M Institute of Technology, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 't john institute of technology', display: 'T John Institute of Technology, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'tjohn', display: 'T John Institute of Technology, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'v t u college of engineering', display: 'V T U College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'vtu', display: 'V T U College of Engineering, Bangalore', lat: 12.9187, lng: 77.5401 }
  ];
  
  // Major Indian cities for non-Bangalore searches
  const cities = [
    { name: 'bangalore', display: 'Bangalore, Karnataka, India', lat: 12.9716, lng: 77.5946 },
    { name: 'bengaluru', display: 'Bengaluru, Karnataka, India', lat: 12.9716, lng: 77.5946 },
    { name: 'hyderabad', display: 'Hyderabad, Telangana, India', lat: 17.3850, lng: 78.4867 },
    { name: 'delhi', display: 'New Delhi, Delhi, India', lat: 28.6139, lng: 77.2090 },
    { name: 'mumbai', display: 'Mumbai, Maharashtra, India', lat: 19.0760, lng: 72.8777 }
  ];
  
  // Bangalore areas and locations (comprehensive list)
 /* const bangaloreAreas = [
    // Major Areas
    { name: 'marathahalli', display: 'Marathahalli, Bangalore', lat: 12.9591, lng: 77.6995 },
    { name: 'marthahalli', display: 'Marathahalli, Bangalore', lat: 12.9591, lng: 77.6995 },
    { name: 'whitefield', display: 'Whitefield, Bangalore', lat: 12.9698, lng: 77.7499 },
    { name: 'electronic city', display: 'Electronic City, Bangalore', lat: 12.8445, lng: 77.6763 },
    { name: 'indiranagar', display: 'Indiranagar, Bangalore', lat: 12.9793, lng: 77.6408 },
    { name: 'koramangala', display: 'Koramangala, Bangalore', lat: 12.9345, lng: 77.6234 },
    { name: 'jayanagar', display: 'Jayanagar, Bangalore', lat: 12.9257, lng: 77.5811 },
    { name: 'basavanagudi', display: 'Basavanagudi, Bangalore', lat: 12.9406, lng: 77.5657 },
    { name: 'malleshwaram', display: 'Malleshwaram, Bangalore', lat: 13.0039, lng: 77.5806 },
    { name: 'rajajinagar', display: 'Rajajinagar, Bangalore', lat: 13.0011, lng: 77.5578 },
    { name: 'yeshwanthpur', display: 'Yeshwanthpur, Bangalore', lat: 13.0167, lng: 77.5510 },
    { name: 'hsr layout', display: 'HSR Layout, Bangalore', lat: 12.9081, lng: 77.6479 },
    { name: 'btm layout', display: 'BTM Layout, Bangalore', lat: 12.9162, lng: 77.6107 },
    { name: 'banashankari', display: 'Banashankari, Bangalore', lat: 12.9317, lng: 77.5439 },
    { name: 'kalyan nagar', display: 'Kalyan Nagar, Bangalore', lat: 13.0163, lng: 77.6408 },
    { name: 'domlur', display: 'Domlur, Bangalore', lat: 12.9611, lng: 77.6408 },
    { name: 'bellandur', display: 'Bellandur, Bangalore', lat: 12.9257, lng: 77.6806 },
    { name: 'sarjapur', display: 'Sarjapur, Bangalore', lat: 12.9187, lng: 77.7833 },
    
    // Additional Major Areas
    { name: 'bannerghatta road', display: 'Bannerghatta Road, Bangalore', lat: 12.9102, lng: 77.5806 },
    { name: 'hosur road', display: 'Hosur Road, Bangalore', lat: 12.9141, lng: 77.6583 },
    { name: 'sarjapur road', display: 'Sarjapur Road, Bangalore', lat: 12.9257, lng: 77.6806 },
    { name: 'old madras road', display: 'Old Madras Road, Bangalore', lat: 12.9983, lng: 77.7408 },
    { name: 'airport road', display: 'Airport Road, Bangalore', lat: 12.9591, lng: 77.6408 },
    { name: 'kammanahalli', display: 'Kammanahalli, Bangalore', lat: 13.0163, lng: 77.6408 },
    { name: 'banswadi', display: 'Banswadi, Bangalore', lat: 13.0163, lng: 77.6408 },
    { name: 'horamavu', display: 'Horamavu, Bangalore', lat: 13.0163, lng: 77.6408 },
    { name: 'ramamurthy nagar', display: 'Ramamurthy Nagar, Bangalore', lat: 13.0163, lng: 77.6408 },
    { name: 'babusapalya', display: 'Babusapalya, Bangalore', lat: 13.0163, lng: 77.6408 },
    { name: 'hennur', display: 'Hennur, Bangalore', lat: 13.0163, lng: 77.6408 },
    { name: 'kaggadasapura', display: 'Kaggadasapura, Bangalore', lat: 12.9890, lng: 77.6583 },
    { name: 'vijayanagar', display: 'Vijayanagar, Bangalore', lat: 12.9716, lng: 77.5401 },
    { name: 'magadi road', display: 'Magadi Road, Bangalore', lat: 12.9716, lng: 77.5401 },
    { name: 'chickpet', display: 'Chickpet, Bangalore', lat: 12.9793, lng: 77.5806 },
    { name: 'city market', display: 'City Market, Bangalore', lat: 12.9706, lng: 77.5806 },
    { name: 'majestic', display: 'Majestic, Bangalore', lat: 12.9779, lng: 77.5706 },
    { name: 'shivajinagar', display: 'Shivajinagar, Bangalore', lat: 12.9890, lng: 77.5806 },
    { name: 'cunningham road', display: 'Cunningham Road, Bangalore', lat: 12.9890, lng: 77.5806 },
    { name: 'residency road', display: 'Residency Road, Bangalore', lat: 12.9698, lng: 77.6007 },
    { name: 'brigade road', display: 'Brigade Road, Bangalore', lat: 12.9698, lng: 77.6007 },
    { name: 'commercial street', display: 'Commercial Street, Bangalore', lat: 12.9793, lng: 77.6007 },
    { name: 'richmond road', display: 'Richmond Road, Bangalore', lat: 12.9698, lng: 77.6007 },
    { name: 'trinity circle', display: 'Trinity Circle, Bangalore', lat: 12.9698, lng: 77.6107 },
    { name: 'ulsoor', display: 'Ulsoor, Bangalore', lat: 12.9890, lng: 77.6107 },
    { name: 'frazer town', display: 'Frazer Town, Bangalore', lat: 12.9890, lng: 77.6107 },
    { name: 'coxtown', display: 'Cox Town, Bangalore', lat: 12.9890, lng: 77.6107 },
    { name: 'richmond town', display: 'Richmond Town, Bangalore', lat: 12.9698, lng: 77.6007 },
    { name: 'langford town', display: 'Langford Town, Bangalore', lat: 12.9698, lng: 77.6007 },
    { name: 'shantinagar', display: 'Shantinagar, Bangalore', lat: 12.9591, lng: 77.5908 },
    { name: 'seshadripuram', display: 'Seshadripuram, Bangalore', lat: 13.0039, lng: 77.5806 },
    { name: 'vasanth nagar', display: 'Vasanth Nagar, Bangalore', lat: 13.0039, lng: 77.5908 },
    { name: 'sadashivanagar', display: 'Sadashivanagar, Bangalore', lat: 13.0039, lng: 77.5806 },
    { name: 'sanjay nagar', display: 'Sanjay Nagar, Bangalore', lat: 13.0163, lng: 77.6408 },
    { name: 'vijayanagar', display: 'Vijayanagar, Bangalore', lat: 12.9716, lng: 77.5401 },
    { name: 'attiguppe', display: 'Attiguppe, Bangalore', lat: 12.9716, lng: 77.5401 },
    { name: 'nagarbhavi', display: 'Nagarbhavi, Bangalore', lat: 12.9716, lng: 77.5401 },
    { name: 'deepanjali nagar', display: 'Deepanjali Nagar, Bangalore', lat: 12.9716, lng: 77.5401 },
    { name: 'nandini layout', display: 'Nandini Layout, Bangalore', lat: 13.0039, lng: 77.5706 },
    { name: 'mahalakshmipuram', display: 'Mahalakshmipuram, Bangalore', lat: 13.0039, lng: 77.5706 },
    { name: 'nagarbhavi 2nd stage', display: 'Nagarbhavi 2nd Stage, Bangalore', lat: 12.9716, lng: 77.5401 },
    { name: 'chandra layout', display: 'Chandra Layout, Bangalore', lat: 12.9716, lng: 77.5401 },
    { name: 'sunkadakatte', display: 'Sunkadakatte, Bangalore', lat: 12.9716, lng: 77.5401 },
    { name: 'basaveshwaranagar', display: 'Basaveshwaranagar, Bangalore', lat: 13.0039, lng: 77.5401 },
    { name: 'kamakshipalya', display: 'Kamakshipalya, Bangalore', lat: 13.0039, lng: 77.5401 },
    { name: 'nagarbhavi circle', display: 'Nagarbhavi Circle, Bangalore', lat: 12.9716, lng: 77.5401 },
    { name: 'uttarahalli', display: 'Uttarahalli, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'gottigere', display: 'Gottigere, Bangalore', lat: 12.9187, lng: 77.5806 },
    { name: 'anepalya', display: 'Anepalya, Bangalore', lat: 12.9406, lng: 77.5806 },
    { name: 'neelasandra', display: 'Neelasandra, Bangalore', lat: 12.9406, lng: 77.5806 },
    { name: 'adugodi', display: 'Adugodi, Bangalore', lat: 12.9406, lng: 77.5806 },
    { name: 'madiwala', display: 'Madiwala, Bangalore', lat: 12.9162, lng: 77.6107 },
    { name: 'singasandra', display: 'Singasandra, Bangalore', lat: 12.8445, lng: 77.7408 },
    { name: 'parappana agrahara', display: 'Parappana Agrahara, Bangalore', lat: 12.8445, lng: 77.7408 },
    { name: 'bommanahalli', display: 'Bommanahalli, Bangalore', lat: 12.9162, lng: 77.6408 },
    { name: 'hulimavu', display: 'Hulimavu, Bangalore', lat: 13.1337, lng: 77.6408 },
    { name: 'vidyaranyapura', display: 'Vidyaranyapura, Bangalore', lat: 13.1337, lng: 77.5401 },
    { name: 'dasarahalli', display: 'Dasarahalli, Bangalore', lat: 13.1337, lng: 77.5401 },
    { name: 'peenya', display: 'Peenya, Bangalore', lat: 13.1337, lng: 77.5401 },
    { name: 'yelahanka', display: 'Yelahanka, Bangalore', lat: 13.1337, lng: 77.5401 },
    { name: 'jalahalli', display: 'Jalahalli, Bangalore', lat: 13.1337, lng: 77.5401 },
    { name: 'vijayanagar', display: 'Vijayanagar, Bangalore', lat: 12.9716, lng: 77.5401 },
    { name: 'kengeri', display: 'Kengeri, Bangalore', lat: 12.9716, lng: 77.5401 },
    { name: 'rr nagar', display: 'RR Nagar, Bangalore', lat: 12.9716, lng: 77.5401 },
    { name: 'bilekahalli', display: 'Bilekahalli, Bangalore', lat: 12.9187, lng: 77.5806 },
    { name: 'girinagar', display: 'Girinagar, Bangalore', lat: 12.9406, lng: 77.5401 },
    { name: 'padmanabhanagar', display: 'Padmanabhanagar, Bangalore', lat: 12.9406, lng: 77.5401 },
    { name: 'kumaraswamy layout', display: 'Kumaraswamy Layout, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'uttarahalli', display: 'Uttarahalli, Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'gokula', display: 'Gokula, Bangalore', lat: 13.0039, lng: 77.5706 },
    { name: 'mathikere', display: 'Mathikere, Bangalore', lat: 13.0039, lng: 77.5706 },
    { name: 'sanjaynagar', display: 'Sanjaynagar, Bangalore', lat: 13.0163, lng: 77.6408 },
    { name: 'cox town', display: 'Cox Town, Bangalore', lat: 12.9890, lng: 77.6107 },
    { name: 'fraser town', display: 'Fraser Town, Bangalore', lat: 12.9890, lng: 77.6107 },
    { name: 'pulikeshi nagar', display: 'Pulikeshi Nagar, Bangalore', lat: 12.9890, lng: 77.6107 },
    { name: 'tippasandra', display: 'Tippasandra, Bangalore', lat: 12.9890, lng: 77.6408 },
    { name: 'jollypet', display: 'Jollypet, Bangalore', lat: 12.9793, lng: 77.5806 },
    { name: 'kalasipalya', display: 'Kalasipalya, Bangalore', lat: 12.9706, lng: 77.5806 },
    { name: 'gandhinagar', display: 'Gandhinagar, Bangalore', lat: 12.9890, lng: 77.5806 },
    { name: 'siddapura', display: 'Siddapura, Bangalore', lat: 12.9890, lng: 77.6408 },
    { name: 'benson town', display: 'Benson Town, Bangalore', lat: 12.9890, lng: 77.6107 },
    { name: 'pallikaranai', display: 'Pallikaranai, Bangalore', lat: 12.9187, lng: 77.6408 },
    { name: 'medavakkam', display: 'Medavakkam, Bangalore', lat: 12.9187, lng: 77.6408 },
    { name: 'perungudi', display: 'Perungudi, Bangalore', lat: 12.9187, lng: 77.6408 },
    { name: 'tamil nagar', display: 'Tamil Nagar, Bangalore', lat: 12.9187, lng: 77.6408 },
    { name: 'thippasandra', display: 'Thippasandra, Bangalore', lat: 12.9890, lng: 77.6408 },
    { name: 'vignan nagar', display: 'Vignan Nagar, Bangalore', lat: 12.9890, lng: 77.6408 },
    { name: 'c v raman nagar', display: 'C V Raman Nagar, Bangalore', lat: 12.9890, lng: 77.6408 },
    { name: 'bhoopasandra', display: 'Bhoopasandra, Bangalore', lat: 13.0163, lng: 77.6408 },
    { name: 'hbr layout', display: 'HBR Layout, Bangalore', lat: 13.0163, lng: 77.6408 },
    { name: 'lakshminarayanapura', display: 'Lakshminarayanapura, Bangalore', lat: 13.0163, lng: 77.6408 },
    { name: 'ramaswamy palya', display: 'Ramaswamy Palya, Bangalore', lat: 13.0163, lng: 77.6408 },
    { name: 'vijayanapura', display: 'Vijayanapura, Bangalore', lat: 13.0163, lng: 77.6408 },
    { name: 'lingarajapuram', display: 'Lingarajapuram, Bangalore', lat: 13.0163, lng: 77.6408 },
    { name: 'cooke town', display: 'Cooke Town, Bangalore', lat: 12.9890, lng: 77.6107 },
    { name: 'richmond circle', display: 'Richmond Circle, Bangalore', lat: 12.9698, lng: 77.6007 },
    { name: 'langford gardens', display: 'Langford Gardens, Bangalore', lat: 12.9698, lng: 77.6007 },
    { name: 'wheeler road', display: 'Wheeler Road, Bangalore', lat: 13.0039, lng: 77.5908 },
    { name: 'cantonment', display: 'Cantonment, Bangalore', lat: 12.9890, lng: 77.6107 },
    { name: 'benson cross', display: 'Benson Cross, Bangalore', lat: 12.9890, lng: 77.6107 },
    { name: 'richmond circle', display: 'Richmond Circle, Bangalore', lat: 12.9698, lng: 77.6007 },
    { name: 'central bangalore', display: 'Central Bangalore', lat: 12.9716, lng: 77.5946 },
    { name: 'north bangalore', display: 'North Bangalore', lat: 13.0163, lng: 77.6408 },
    { name: 'south bangalore', display: 'South Bangalore', lat: 12.9187, lng: 77.5401 },
    { name: 'east bangalore', display: 'East Bangalore', lat: 12.9890, lng: 77.6408 },
    { name: 'west bangalore', display: 'West Bangalore', lat: 12.9716, lng: 77.5401 }
  ];
  
  let found = [];
  
  // Always search in Bangalore areas only
  found = bangaloreAreas.filter(area => 
    area.name.includes(lowerQuery) || lowerQuery.includes(area.name)
  );
  */
  // Also search in colleges
  const collegeResults = bangaloreColleges.filter(college => 
    college.name.includes(lowerQuery) || lowerQuery.includes(college.name)
  );
  
  // Combine areas and colleges
  found = [...found, ...collegeResults];
  
  // If no match, return Bangalore areas + colleges
  if (found.length === 0) {
    console.log('No specific match, returning Bangalore areas and colleges');
    found = [...bangaloreAreas.slice(0, 8), ...bangaloreColleges.slice(0, 7)];
  }
  
  console.log('Found locations:', found);
  const mapped = found.map(location => ({
    display_name: location.display,
    lat: location.lat,
    lng: location.lng,
    label: location.display.split(',')[0]
  }));
  console.log('Mapped locations:', mapped);
  return mapped;
};

// ══════════════════════════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════════════════════════
export const register = (body) =>
  request('/auth/register', { method: 'POST', body: JSON.stringify(body) });

export const login = (body) =>
  request('/auth/login', { method: 'POST', body: JSON.stringify(body) });

export const getMe = () => request('/auth/me');

export const resetPasswordDirect = (email, password) =>
  request('/auth/reset-password-direct', { method: 'POST', body: JSON.stringify({ email, password }) });

// OTP-based password reset
export const sendOtp = (email) =>
  request('/auth/send-otp', { method: 'POST', body: JSON.stringify({ email }) });
export const verifyOtp = (email, otp) =>
  request('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email, otp }) });
export const resetPasswordWithOtp = (resetToken, password) =>
  request('/auth/reset-password-otp', { method: 'POST', body: JSON.stringify({ resetToken, password }) });

// Nearby users & route
export const getNearbyUsers = ({ lat, lng, radius = 5000 } = {}) =>
  request(`/location/nearby-users?lat=${lat}&lng=${lng}&radius=${radius}`);
export const getRoute = ({ fromLat, fromLng, toLat, toLng }) =>
  request(`/location/route?fromLat=${fromLat}&fromLng=${fromLng}&toLat=${toLat}&toLng=${toLng}`);

// ══════════════════════════════════════════════════════════════════
//  USERS
// ══════════════════════════════════════════════════════════════════
export const getProfile    = ()     => request('/users/profile');
export const updateProfile = (body) =>
  request('/users/profile', { method: 'PUT', body: JSON.stringify(body) });

// ══════════════════════════════════════════════════════════════════
//  RIDES
// ══════════════════════════════════════════════════════════════════
export const createRide = (body) =>
  request('/ride/create', { method: 'POST', body: JSON.stringify(body) });

export const searchRides = ({ lat, lng, maxDistance = 5000, date, womenOnly } = {}) => {
  const params = new URLSearchParams();
  if (lat) params.append('lat', lat);
  if (lng) params.append('lng', lng);
  if (maxDistance) params.append('maxDistance', maxDistance);
  if (date) params.append('date', date);
  if (womenOnly) params.append('womenOnly', 'true');
  return request(`/ride/search?${params.toString()}`);
};

export const getMyRides  = ()     => request('/ride/my');
export const getRide     = (id)   => request(`/ride/${id}`);
export const updateRide  = (id, body) =>
  request(`/ride/${id}`, { method: 'PUT', body: JSON.stringify(body) });
export const deleteRide  = (id)   =>
  request(`/ride/${id}`, { method: 'DELETE' });

export const noMatchSuggest = ({ lat, lng } = {}) =>
  request(`/ride/no-match-suggest?lat=${lat}&lng=${lng}`);

// ── Recurring ride instances
export const getRecurringInstances = (rideId) =>
  request(`/ride/recurring/${rideId}/instances`);

// ── Pre-ride checklist
export const submitChecklist = (rideId, checks) =>
  request(`/ride/${rideId}/checklist`, { method: 'POST', body: JSON.stringify(checks) });

// ── Trip status flow
export const pickupPassenger = (rideId) =>
  request(`/ride/${rideId}/pickup`, { method: 'POST' });

export const dropPassenger = (rideId) =>
  request(`/ride/${rideId}/drop`, { method: 'POST' });

export const startRide    = (rideId) =>
  request(`/ride/${rideId}/start`, { method: 'POST' });

export const completeRide = (rideId) =>
  request(`/ride/${rideId}/complete`, { method: 'POST' });

export const cancelRide   = (rideId, reason) =>
  request(`/ride/${rideId}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) });

// ══════════════════════════════════════════════════════════════════
//  BOOKINGS
// ══════════════════════════════════════════════════════════════════
export const requestBooking = (rideId, seats) =>
  request('/booking/request', {
    method: 'POST',
    body: JSON.stringify({ rideId, seats })
  });

export const respondBooking = (bookingId, status) =>
  request('/booking/respond', { method: 'PUT', body: JSON.stringify({ bookingId, status }) });

export const getMyBookings      = ()       => request('/booking/my');
export const getRideRequests    = ()       => request('/booking/requests');
export const getBookingsForRide = (rideId) => request(`/booking/ride/${rideId}`);

// ══════════════════════════════════════════════════════════════════
//  ALERTS (Route-based alert subscriptions)
// ══════════════════════════════════════════════════════════════════
export const createAlert = (body) =>
  request('/alerts', { method: 'POST', body: JSON.stringify(body) });

export const getMyAlerts = () => request('/alerts/my');

export const deleteAlert = (id) =>
  request(`/alerts/${id}`, { method: 'DELETE' });

export const checkAlertMatches = (id) =>
  request(`/alerts/${id}/check`);

// ══════════════════════════════════════════════════════════════════
//  INCIDENTS
// ══════════════════════════════════════════════════════════════════
export const reportIncident = (body) =>
  request('/incidents/report', { method: 'POST', body: JSON.stringify(body) });

export const addEvidence = (id, evidence) =>
  request(`/incidents/${id}/evidence`, { method: 'POST', body: JSON.stringify({ evidence }) });

export const getMyIncidents  = ()  => request('/incidents/my');
export const getAllIncidents  = ()  => request('/incidents/all');

export const exportIncident = (id) =>
  request(`/incidents/${id}/export`, { method: 'POST' });

// ══════════════════════════════════════════════════════════════════
//  ADMIN SETTINGS
// ══════════════════════════════════════════════════════════════════
export const getAdminSettings = ()           => request('/admin/settings');
export const setAdminSetting  = (key, value) =>
  request('/admin/settings', { method: 'POST', body: JSON.stringify({ key, value }) });

export const getAdminSetting = (key) => request(`/admin/settings/${key}`);

// ══════════════════════════════════════════════════════════════════
//  OTHER EXISTING SERVICES (unchanged)
// ══════════════════════════════════════════════════════════════════
export const getRideStatus = (rideId) => request(`/ride/${rideId}/status`);

export async function apiFetch(url, options = {}) {
  const token = localStorage.getItem("token");

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || "API Error");
  }

  return data;
}

// ══════════════════════════════════════════════════════════════════
//  KYC
// ══════════════════════════════════════════════════════════════════

// Submit KYC documents (expects URLs from file upload)
export const submitKyc = (body) =>
  request('/kyc/submit', { method: 'POST', body: JSON.stringify(body) });

// Get KYC status and documents
export const getKycStatus = () =>
  request('/kyc/status');

export const uploadKycFile = async (file) => {
  // Option 1: Convert to base64 and send directly
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result); // base64 string
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  
}; 

// Add to api.js
export const findNearbySuggestions = ({ lat, lng, originalDistance, date, expandDistance, expandDate }) => {
  const params = new URLSearchParams();
  params.append('lat', lat);
  params.append('lng', lng);
  if (originalDistance) params.append('originalDistance', originalDistance);
  if (date) params.append('date', date);
  if (expandDistance) params.append('expandDistance', expandDistance);
  if (expandDate) params.append('expandDate', expandDate);
  
  return request(`/ride/nearby-suggestions?${params.toString()}`);
};

// ── Community Posts ───────────────────────────────────────────────
export const getCommunityPosts = () => request('/community');

export const createCommunityPost = (data) =>
  request('/community', { method: 'POST', body: JSON.stringify(data) });

export const toggleCommunityLike = (postId) =>
  request(`/community/${postId}/like`, { method: 'PATCH' });
export const addCommunityReply = (postId, content) =>
  request(`/community/${postId}/reply`, {
    method: 'POST',
    body: JSON.stringify({ content })
  });

// ── Community Chat ────────────────────────────────────────────────
export const getChatMessages = () => request('/community/chat/messages');
export const deleteChatMessage = (id) =>
  request(`/community/chat/messages/${id}`, { method: 'DELETE' });

  export const getNotifications = async () => {
  try {
    //const res = await fetch("/api/notifications/my");
    const res = await fetch(`${API_BASE}/notifications/my`);    return await res.json();
  } catch (err) {
    console.error("getNotifications error:", err);
    return [];
  }
};

//Forgot password
export const forgotPassword = async (email) => {
  localStorage.setItem(
    "resetEmail",
    email
  );

  return {
    success: true
  };
};

//Reset password
export const resetPassword = async (
  token,
  password
) => {

  const response = await fetch(
    `${API_BASE}/api/auth/reset-password/${token}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        password
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message);
  }

  return data;
};

//Ratings page
export const getRideRatings = (rideId) => request(`/ratings/ride/${rideId}`);
export const getUserRatings = (userId) => request(`/ratings/${userId}`);
export const getRatingsByReviewer = (userId) => request(`/ratings/reviewer/${userId}`);
