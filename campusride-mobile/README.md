# CampusRide — React Native Mobile App

Complete conversion of the CampusRide web app to a React Native Expo app for Android & iOS.

---

## Stack

- **Framework:** React Native + Expo SDK 51
- **Navigation:** React Navigation (Stack + Bottom Tabs)
- **Storage:** AsyncStorage (replaces localStorage)
- **Location:** expo-location
- **Camera/Uploads:** expo-image-picker
- **Realtime:** socket.io-client (same as web)
- **API:** Same Express/MongoDB backend — no changes needed

---

## Project Structure

```
campusride-mobile/
├── App.jsx                          # Root entry point
├── app.json                         # Expo config
├── package.json
├── babel.config.js
└── src/
    ├── context/
    │   └── AuthContext.jsx           # Auth state (AsyncStorage)
    ├── services/
    │   └── api.js                   # All API calls (same endpoints)
    ├── hooks/
    │   └── useSocket.js             # Socket.IO hook
    ├── navigation/
    │   └── AppNavigator.jsx         # Stack + Tab navigation
    ├── theme/
    │   └── index.js                 # Design tokens (same as web CSS vars)
    ├── components/
    │   ├── UI.jsx                   # Btn, Input, Card, Badge, Alert, etc.
    │   ├── RideCard.jsx             # Ride listing card
    │   └── LocationSearch.jsx       # Location autocomplete
    └── screens/
        ├── LoginScreen.jsx
        ├── RegisterScreen.jsx       # With KYC doc upload via expo-image-picker
        ├── DashboardScreen.jsx
        ├── SearchRidesScreen.jsx    # GPS + filters + women-only
        ├── CreateRideScreen.jsx     # Auto fare calculator
        ├── CommunityScreen.jsx      # Posts + real-time college chat
        ├── MyBookingsScreen.jsx     # Seeker bookings + provider details
        ├── ProviderBookingsScreen.jsx # Ride management + accept/reject
        ├── ProfileScreen.jsx        # Read-only + phone edit
        └── MiscScreens.jsx          # RideDetail, Notifications, WalkTogether,
                                     # RouteAlerts, IncidentReport, ForgotPassword
```

---

## Setup

### 1. Prerequisites

```bash
node -v   # v18 or newer
npm i -g expo-cli eas-cli
```

### 2. Install dependencies

```bash
cd campusride-mobile
npm install
```

### 3. Configure your backend URL

Edit `src/services/api.js` line 10:

```js
export const API_BASE = 'https://your-backend-url.onrender.com';
```

Replace with your actual deployed backend URL (the same one your web app uses).

### 4. Run on device / simulator

```bash
# Start Expo dev server
npx expo start

# Scan the QR code with Expo Go app on your phone
# OR press 'a' for Android emulator, 'i' for iOS simulator
```

### 5. Build for release

```bash
# Configure EAS (first time only)
eas build:configure

# Android APK / AAB
eas build --platform android

# iOS IPA
eas build --platform ios
```

---

## Backend — No Changes Required

The mobile app talks to the exact same backend:
- All API endpoints are identical
- JWT tokens stored in AsyncStorage instead of memory
- Socket.IO works the same way
- Cloudinary uploads work (multipart FormData via `fetch`)

---

## What changed from Web → Mobile

| Web (React)              | Mobile (React Native)                  |
|--------------------------|----------------------------------------|
| `div`, `span`, `p`       | `View`, `Text`                         |
| CSS files                | `StyleSheet.create({})`                |
| `localStorage`           | `AsyncStorage`                         |
| `navigator.geolocation`  | `expo-location`                        |
| `<input type="file">`    | `expo-image-picker`                    |
| `<input type="date">`    | `TextInput` (YYYY-MM-DD)               |
| React Router / PAGE_MAP  | React Navigation                       |
| CSS variables            | `src/theme/index.js` constants         |
| `react-leaflet` map      | `react-native-maps`                    |
| Web push notifications   | `expo-notifications`                   |

---

## Features Included

- ✅ Login / Register (with KYC doc camera/gallery upload)
- ✅ Dashboard with quick actions (role-aware)
- ✅ Search rides (GPS detect, filters, women-only)
- ✅ Create ride (auto fare calculator, GPS)
- ✅ Seeker bookings (provider contact reveal on accept)
- ✅ Provider ride management (accept/reject, start/complete/cancel)
- ✅ Real-time community posts + college chat (Socket.IO)
- ✅ Walk Together companion finder
- ✅ Route alerts subscription
- ✅ Incident report
- ✅ Notifications (derived from bookings/rides)
- ✅ Profile (read-only, phone edit once per 90 days)
- ✅ Auth persistence (token in AsyncStorage)
- ✅ Dark theme matching the web app exactly

---

## Notes

- **EAS credentials:** You'll need an Apple Developer account (iOS) or Google Play account (Android) for production builds.
- **Maps:** `react-native-maps` is listed in dependencies — add a `MapView` component to `SearchRidesScreen` if you want the map back (requires a Google Maps API key for Android).
- **Push Notifications:** `expo-notifications` is installed — wire up the token registration in `AuthContext.jsx` to send it to your backend.
