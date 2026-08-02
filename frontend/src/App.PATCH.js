// ═══════════════════════════════════════════════════════════════════
//  PATCH INSTRUCTIONS FOR frontend/src/App.jsx
// ═══════════════════════════════════════════════════════════════════

// ── 1. Add import at the top (after existing imports) ─────────────
// ADD this line:
import ProfilePage from './pages/ProfilePage.jsx';

// ── 2. Add 'profile' to PAGE_MAP ──────────────────────────────────
// FIND (inside PAGE_MAP):
  "reset-password":    ResetPassword,
// ADD after it:
  "profile":           ProfilePage,

// ── 3. Add Profile link to Navbar ─────────────────────────────────
// In Navbar.jsx, FIND the links array and ADD:
    { key: 'profile', label: 'My Profile', icon: '👤', show: true },
