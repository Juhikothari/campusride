// ══════════════════════════════════════════════════════
//  HOGO API SERVICE  —  React Native version
// ══════════════════════════════════════════════════════
import AsyncStorage from '@react-native-async-storage/async-storage';

// Live Render backend API URL
export const API_BASE = 'https://campusride-backend-gwgr.onrender.com';
const BASE = `${API_BASE}/api`;

// ── Token / User helpers ──────────────────────────────
export const getToken    = async () => (await AsyncStorage.getItem('cr_token')) || '';
export const setToken    = (t)  => AsyncStorage.setItem('cr_token', t);
export const removeToken = ()   => AsyncStorage.removeItem('cr_token');

export const getUser     = async () => {
  const raw = await AsyncStorage.getItem('cr_user');
  return raw ? JSON.parse(raw) : null;
};
export const setUser     = (u)  => AsyncStorage.setItem('cr_user', JSON.stringify(u));
export const removeUser  = ()   => AsyncStorage.removeItem('cr_user');

// ── Base fetch wrapper with 10-second timeout ─────────
const request = async (path, options = {}) => {
  const token = await getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const controller = new AbortController();
  const timeoutMs  = options.timeout || 12000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(`${BASE}${path}`, { ...options, headers, signal: controller.signal });
  } catch (networkErr) {
    if (networkErr.name === 'AbortError') {
      const err = new Error(`Request timed out (12s). Server may be busy or waking up.`);
      err.isTimeout = true;
      throw err;
    }
    throw new Error(
      `Cannot connect to server at ${API_BASE}. ` +
      `Check your internet connection or verify your backend is running.`
    );
  } finally {
    clearTimeout(timer);
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (res.status === 404) {
      const err = new Error(`Endpoint not found (404) on ${API_BASE}.`);
      err.status = 404;
      throw err;
    }
    const err = new Error(`Server returned non-JSON response (Status ${res.status}).`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.message || data.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
};

// ── Auth ──────────────────────────────────────────────
export const login             = (body) => request('/auth/login',    { method:'POST', body: JSON.stringify(body) });
export const register          = (body) => request('/auth/register', { method:'POST', body: JSON.stringify(body) });
export const getMe             = ()     => request('/auth/me');
export const forgotPassword    = (email) => request('/auth/send-otp', { method:'POST', body: JSON.stringify({ email }) });
export const sendOtp           = (email) => request('/auth/send-otp', { method:'POST', body: JSON.stringify({ email }) });
export const verifyOtp         = (email, otp) => request('/auth/verify-otp', { method:'POST', body: JSON.stringify({ email, otp }) });
export const resetPassword     = (payload) => {
  const body = typeof payload === 'object' ? payload : { resetToken: payload };
  return request('/auth/reset-password-otp', { method:'POST', body: JSON.stringify(body) });
};

// ── AI Chatbot ────────────────────────────────────────
export const sendChatbotMessage = (messages) => request('/chatbot/message', { method:'POST', body: JSON.stringify({ messages }) });

// ── Users ─────────────────────────────────────────────
export const getProfile        = ()     => request('/users/profile');
export const updatePhoneNumber = (phone) => request('/users/profile/phone', { method:'PUT', body: JSON.stringify({ phone }) });
export const saveVehicle       = (data) => request('/users/profile/vehicle', { method:'PUT', body: JSON.stringify(data) });
export const getUserVehicles   = ()     => request('/users/profile/vehicles').catch(async () => {
  const profile = await getProfile().catch(() => null);
  if (profile?.vehicles && Array.isArray(profile.vehicles) && profile.vehicles.length > 0) return profile.vehicles;
  if (profile?.kycDocuments?.vehicleNumber) {
    return [{
      vehicleNumber: profile.kycDocuments.vehicleNumber,
      vehicleName: profile.kycDocuments.vehicleName || 'Registered Vehicle',
      vehicleType: profile.kycDocuments.vehicleType || 'car',
      status: profile.kycDocuments.vehicleStatus || 'pending',
    }];
  }
  return [];
});

// ── Location & Routing ────────────────────────────────
export const searchLocation    = (q)   => request(`/location/search?q=${encodeURIComponent(q)}`);
export const reverseGeocode    = (lat, lng) => request(`/location/reverse?lat=${lat}&lng=${lng}`);
export const getOptimalRoute   = (fromLat, fromLng, toLat, toLng) =>
  request(`/location/route?fromLat=${fromLat}&fromLng=${fromLng}&toLat=${toLat}&toLng=${toLng}`);
export const getDistance       = (fromLat, fromLng, toLat, toLng) =>
  request(`/location/distance?fromLat=${fromLat}&fromLng=${fromLng}&toLat=${toLat}&toLng=${toLng}`);

// ── Rides ─────────────────────────────────────────────
export const searchRides       = (params) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([,v]) => v !== undefined && v !== ''))
  ).toString();
  return request(`/ride/search?${qs}`);
};
export const getRideById       = (id)   => request(`/ride/${id}`);
export const createRide        = (body) => request('/ride/create', { method:'POST', body: JSON.stringify(body) });
export const getMyRides        = ()     => request('/ride/my');
export const startRide         = (id)   => request(`/ride/${id}/start`, { method:'POST' });
export const completeRide      = (id)   => request(`/ride/${id}/complete`, { method:'POST' });
export const cancelRide        = (id, reason) => request(`/ride/${id}/cancel`, { method:'POST', body: JSON.stringify({ reason }) });
export const updateRideStatus  = (id, status) => {
  if (status === 'in-progress') return startRide(id);
  if (status === 'completed')   return completeRide(id);
  if (status === 'cancelled')   return cancelRide(id, 'Cancelled by provider');
  return request(`/ride/${id}`, { method:'PUT', body: JSON.stringify({ status }) });
};

// ── Bookings ──────────────────────────────────────────
export const bookRide          = (rideId, seats = 1) => request('/booking/request', { method:'POST', body: JSON.stringify({ rideId, seats }) });
export const getMyBookings     = ()     => request('/booking/my');
export const getRideRequests   = ()     => request('/booking/requests');
export const getRideBookings   = (rideId) => request(`/booking/ride/${rideId}`);
export const acceptBooking     = (id)   => request('/booking/respond', { method:'PUT', body: JSON.stringify({ bookingId: id, status: 'accepted' }) });
export const rejectBooking     = (id)   => request('/booking/respond', { method:'PUT', body: JSON.stringify({ bookingId: id, status: 'rejected' }) });
export const cancelBooking     = (id)   => request(`/booking/${id}/cancel`, { method:'DELETE' });

// ── Ratings ───────────────────────────────────────────
export const submitRating      = (body) => request('/ratings', { method:'POST', body: JSON.stringify(body) });
export const getMyRatings      = ()     => request('/ratings/my-ratings');

// ── KYC ───────────────────────────────────────────────
export const submitKyc         = (body) => request('/kyc/submit', { method:'POST', body: JSON.stringify(body) });
export const getKycStatus      = ()     => request('/kyc/status');

// ── Community ─────────────────────────────────────────
export const getCommunityPosts   = ()             => request('/community').catch(() => request('/community/posts'));
export const createCommunityPost = (body)        => request('/community', { method:'POST', body: JSON.stringify(body) }).catch(() => request('/community/posts', { method:'POST', body: JSON.stringify(body) }));
export const toggleCommunityLike = (id)          => request(`/community/${id}/like`, { method:'POST' }).catch(() => request(`/community/posts/${id}/like`, { method:'POST' }));
export const addCommunityReply   = (id, content) => request(`/community/${id}/reply`, { method:'POST', body: JSON.stringify({ content }) }).catch(() => request(`/community/posts/${id}/reply`, { method:'POST', body: JSON.stringify({ content }) }));
export const deleteCommunityPost = (id)          => request(`/community/${id}`, { method:'DELETE' }).catch(() => request(`/community/posts/${id}`, { method:'DELETE' }));
export const getChatMessages     = (college)     => request(`/community/chat/${encodeURIComponent(college)}`);
export const deleteChatMessage   = (id)          => request(`/community/chat/${id}`, { method:'DELETE' });

// ── Notifications ─────────────────────────────────────
export const getNotifications  = ()     => request('/notifications');
export const markNotificationsRead = () => request('/notifications/read-all', { method:'PUT' });

// ── SOS & Safety ──────────────────────────────────────
export const triggerSOS        = (body) => request('/sos', { method:'POST', body: JSON.stringify(body) });
export const reportIncident    = (body) => request('/incidents', { method:'POST', body: JSON.stringify(body) });

// ── Tracking ──────────────────────────────────────────
export const updateLocation    = (body) => request('/tracking/update', { method:'POST', body: JSON.stringify(body) });
export const getTracking       = (rideId) => request(`/tracking/${rideId}`);

// ── Admin ─────────────────────────────────────────────
export const getAdminStats     = ()     => request('/admin/stats');
export const getAllUsers        = ()     => request('/admin/users');
export const blockUser         = (id, reason) => request(`/admin/users/${id}/block`, { method:'PUT', body: JSON.stringify({ reason }) });
export const unblockUser       = (id)   => request(`/admin/users/${id}/unblock`, { method:'PUT' });
export const getKycRequests    = ()     => request('/admin/kyc');
export const approveKyc        = (id)   => request(`/admin/kyc/${id}/approve`, { method:'PUT' });
export const rejectKyc         = (id, remarks) => request(`/admin/kyc/${id}/reject`, { method:'PUT', body: JSON.stringify({ remarks }) });
