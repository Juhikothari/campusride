// ═══════════════════════════════════════════════════════════════════
//  ADDITIONS TO frontend/src/services/api.js
//  Paste these into api.js at the relevant sections.
// ═══════════════════════════════════════════════════════════════════

// ── Community Posts (add after existing community exports) ─────────

// Delete own community post
export const deleteCommunityPost = (postId) =>
  request(`/community/${postId}`, { method: 'DELETE' });


// ── Users / Profile (replace or add after existing user exports) ───

// Get own full profile (read-only, includes canChangePhone)
export const getMyProfile = () => request('/users/profile');

// Update phone number only (throttled to once per 90 days)
export const updatePhoneNumber = (phone) =>
  request('/users/profile/phone', {
    method: 'PUT',
    body: JSON.stringify({ phone }),
  });
