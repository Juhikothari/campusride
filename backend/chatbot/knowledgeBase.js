// backend/chatbot/knowledgeBase.js
// Verified single-source-of-truth HOGO (CampusRide) Knowledge Base covering all 30 app areas.
// Every fact is grounded strictly in implemented backend & mobile source files.

const KNOWLEDGE_SECTIONS = [
  {
    id: 'registration-login',
    topic: 'Registration and Login',
    keywords: ['register', 'signup', 'sign up', 'create account', 'login', 'sign in', 'password', 'otp', 'forgot password', 'device', 'single device'],
    content: `Registration & Login in HOGO:
• Account creation requires Full Name, 10-digit Phone, College Email, College USN, College/University, Gender, Password (min 6 chars), a mandatory live Selfie, and a College ID Card photo. Roles: Seeker (find rides), Provider (offer rides), or Both.
• Providers can also add vehicle details (and Driving License in KYC) during or after signup.
• Single-device login security: One active session per device is enforced via session seeds; logging in on a new device prompts to log out the other session.
• Forgot Password uses a 3-step email OTP flow via Brevo: Send OTP (60s resend cooldown) -> Verify OTP (max 5 attempts) -> Reset Password.`
  },
  {
    id: 'college-verification',
    topic: 'College Verification',
    keywords: ['college', 'university', 'campus', 'other college', 'custom college', 'campus domain', 'college list'],
    content: `College Verification & Directory:
• Select your college from the searchable college directory during registration.
• If your college is not listed, choose "Other", enter your custom college name in the second input box, and submit. Admin receives a NEW_COLLEGE_REQUEST notification to review and standardize it.
• Rides and Campus Community rooms are scoped to your verified college so only students from the same institution match together.`
  },
  {
    id: 'user-profiles',
    topic: 'User Profiles',
    keywords: ['profile', 'edit profile', 'phone number', '90 days', 'cooldown', 'emergency contact', 'usn', 'photo', 'selfie'],
    content: `User Profiles (Menu > My Profile):
• Displays your Name, Email, College, USN, Role, KYC status, registered vehicles, and profile photo.
• You can edit Gender, Emergency Contact (10-digit number), USN, and Profile Photo anytime.
• Phone Number cooldown: You can update your phone number only once every 90 days for campus safety.
• Name, email, and approved vehicle numbers cannot be edited directly by users—contact Campus Support if correction is required.`
  },
  {
    id: 'student-identity-verification',
    topic: 'Student Identity Verification',
    keywords: ['student id', 'identity', 'usn', 'college id card', 'privacy', 'real name', 'badge'],
    content: `Student Identity Verification:
• Every non-admin account verifies campus affiliation via College ID Card, live Selfie, and USN.
• To protect student privacy, ride cards and booking requests display your verified USN instead of broadcasting your full personal name publicly.`
  },
  {
    id: 'kyc-verification',
    topic: 'KYC Verification',
    keywords: ['kyc', 'verification', 'documents', 'driving license', 'aadhaar', 'selfie', 'approve', 'rejected', 'pending'],
    content: `KYC Verification (Menu > KYC Verification):
• Providers (and "Both" role users wanting to offer rides) must have KYC status "approved" before creating rides.
• Required documents: College ID Card photo and front-camera Selfie (mandatory), plus Driving License and Vehicle details for ride providers. Files must be JPEG, PNG, or WebP under 5MB and are stored privately on the server (never on public CDNs).
• Statuses: not_submitted, not_required, pending, approved, rejected. Campus Admins review pending submissions and approve, reject (with remarks), or revoke KYC.`
  },
  {
    id: 'vehicle-registration',
    topic: 'Vehicle Registration and Verification',
    keywords: ['vehicle', 'car', 'bike', 'suv', 'xuv', 'plate', 'registration number', 'rc', 'change vehicle', 'add vehicle', 'edit vehicle'],
    content: `Vehicle Registration & Policy (My Profile > Vehicle Details):
• Tap "+ Add Vehicle" or "+ Add Another" to submit Vehicle Registration Number (validated Indian standard or BH plate format), Vehicle Model/Name, and Type (Bike, Car, SUV, XUV).
• Global plate uniqueness: One vehicle registration number cannot be registered across two separate student accounts (returns conflict error).
• Submitted vehicles enter "pending" admin review (typically reviewed within 24 hours).
• Approved vehicle details are locked for safety and cannot be edited directly; if you change your vehicle, contact Campus Support from the menu with your new RC.`
  },
  {
    id: 'creating-rides',
    topic: 'Creating Rides',
    keywords: ['create ride', 'post ride', 'offer ride', 'need a ride', 'publish', 'seats', 'active ride limit'],
    content: `Offering / Creating a Ride (Dashboard > "Need a Ride" / OfferRide):
• Requires role "provider" or "both" and KYC status "approved".
• Enter Pickup & Drop locations (search, tap map, drag pin, GPS, or Start/Drop at campus chips), choose Ride Now or Schedule (later date/time), pick verified Vehicle and available Seats (1 to 6), and tap Post Ride.
• Active Ride Limit: Providers may hold only 1 active immediate ("Ride Now" / in-progress) ride at a time, and cannot post while holding an active pending/accepted booking as a seeker. Future scheduled rides can still be added. Stale active rides older than 3 hours are auto-cancelled.`
  },
  {
    id: 'searching-rides',
    topic: 'Searching for Rides',
    keywords: ['search ride', 'find a ride', 'browse rides', 'no match', 'route alerts', 'radius'],
    content: `Searching for Rides (Dashboard > "Find a Ride"):
• Both Pickup location and Drop location are mandatory and must be distinct points (>= 50m apart).
• Searches active college-scoped rides within a 50 km radius matching your pickup/drop corridor, selected vehicle filter, and optional Women-Only filter.
• If no exact rides match, you can inspect nearby suggestions or create a Route Alert (GET/POST /api/alerts) to check future matches.`
  },
  {
    id: 'ride-matching',
    topic: 'Ride Matching',
    keywords: ['match', 'matching', 'algorithm', 'route corridor', 'campus match', 'college scoped'],
    content: `How HOGO Ride Matching Works:
• Matching checks: (1) Same college/campus scope, (2) Ride status "active" with seatsAvailable > 0, (3) Women-only compatibility (only female seekers see womenOnly rides), and (4) Geographic proximity between your pickup/drop coordinates and the provider's route.`
  },
  {
    id: 'booking-rides',
    topic: 'Booking Rides',
    keywords: ['book', 'booking', 'request seat', 'seats', 'pickup code', 'pending request', 'my bookings'],
    content: `Booking a Ride:
• From search results or Ride Details, tap Book Ride to request 1 or more available seats.
• The booking starts as "pending" until the provider accepts or rejects it in Ride Requests.
• Track your requests in Menu > My Bookings. Accepted seekers can also fetch their Pickup Verification Code (GET /api/booking/:bookingId/pickup-code) for pickup confirmation.`
  },
  {
    id: 'booking-acceptance',
    topic: 'Booking Acceptance and Rejection',
    keywords: ['accept', 'reject', 'ride requests', 'provider bookings', 'confirmed', 'phone revealed'],
    content: `Booking Acceptance & Rejection (Menu > Ride Requests):
• Providers inspect pending seeker requests showing seeker USN, requested seats, college, and calculated per-seat fare before accepting or rejecting.
• Phone numbers stay hidden while pending, are revealed for coordination once accepted, and are hidden again once the ride is completed for privacy.
• On completed rides, confirmed ("accepted") buddies are displayed at the top of the Ride Requests summary.`
  },
  {
    id: 'ride-cancellation',
    topic: 'Ride Cancellation',
    keywords: ['cancel', 'cancellation', 'refund', 'cancel reason', 'withdraw booking'],
    content: `Ride & Booking Cancellation:
• Seekers can cancel a booking before ride departure from My Bookings or Live Tracking and must choose a cancellation reason (Change in Plans, Found Another Ride, Rider Delay, Pickup/Destination Changed, Safety Concerns, Emergency/Personal Reason, Other Reason).
• Providers can cancel an active ride from Ride Requests or Live Tracking, which notifies all affected seekers.
• There are zero cancellation fees or penalties in the app.`
  },
  {
    id: 'recurring-rides',
    topic: 'Recurring Rides',
    keywords: ['recurring', 'repeat', 'daily ride', 'every day', 'weekday', 'weekly', 'schedule', 'scheduled'],
    content: `Scheduled & Recurring Rides Status:
• Providers can switch between "Ride Now" and "Schedule" (later date and time) in the "Need a Ride" (CreateRide) screen, allowing future scheduled rides without exceeding the 1 active immediate-ride limit.
• Honest limitation: While the backend Ride schema contains partial recurring metadata fields (isRecurring, recurringPattern, recurringGroupId) and an instances lookup endpoint, automated daily/weekly recurring ride creation is NOT currently exposed in the mobile CreateRide UI—you post each upcoming scheduled ride separately.`
  },
  {
    id: 'women-only-rides',
    topic: 'Women-Only Rides',
    keywords: ['women', 'women only', 'female', 'ladies', 'girls only', 'safety filter'],
    content: `Women-Only Rides:
• Only providers whose profile gender is set to "female" can enable the "Women Only" toggle when creating a ride (enforced server-side as well).
• In Find a Ride, only female students can toggle or view rides marked womenOnly: true for added comfort and campus safety.`
  },
  {
    id: 'cost-sharing-payments',
    topic: 'Cost-Sharing and Payments',
    keywords: ['cost', 'fare', 'price', 'payment', 'pay', 'upi', 'cash', 'wallet', 'razorpay', 'split', 'commission'],
    content: `Cost-Sharing & Payments:
• HOGO estimates distance-based cost splitting automatically: Bike ₹15 base + ₹5/km, Car ₹20 base + ₹7/km, SUV ₹22 base + ₹8.5/km, XUV ₹25 base + ₹10/km (minimum base for <= 1 km), or a custom per-seat cost set by the provider. Zero platform commission.
• Payment availability: Online in-app payments, wallets, or UPI checkout are NOT built inside HOGO—all fares are settled directly between rider and passenger via UPI or Cash upon arrival.`
  },
  {
    id: 'pickup-drop-locations',
    topic: 'Pickup and Drop Locations',
    keywords: ['pickup', 'drop', 'location', 'pin', 'drag pin', 'stop plan', 'multi pickup', 'address', 'search location', 'gps'],
    content: `Pickup & Drop Locations (Map Picker & Search):
• Pick locations via address autocomplete, Popular Campus Spots chips, GPS recenter button, tapping anywhere on the map, or dragging the selected amber pin directly on the map and releasing to reverse-geocode the street address.
• Providers with multiple accepted passengers can open Stop Plan to view the optimized pickup/drop stop sequence (/api/ride/:id/stops).`
  },
  {
    id: 'map-functionality',
    topic: 'Map Functionality',
    keywords: ['map', 'maplibre', 'openstreetmap', 'openfreemap', 'route', 'directions', 'polyline', 'osrm', 'eta'],
    content: `Native OpenStreetMap / MapLibre Maps:
• HOGO renders native vector maps via MapLibre + OpenFreeMap (OpenStreetMap data) without WebViews or Google map tiles.
• Routes and ETAs are fetched via the backend OpenStreetMap OSRM routing proxy (/api/location/route).
• If the external OSRM routing service is temporarily unreachable, HOGO honestly displays a route-unavailable notice rather than fabricating fake ETAs or straight-line distances.`
  },
  {
    id: 'live-tracking',
    topic: 'Live GPS Tracking',
    keywords: ['tracking', 'live tracking', 'track', 'driver location', 'reached', 'arrived', 'stale', 'follow driver'],
    content: `Live GPS Tracking (LiveTrackingScreen):
• Once a ride is accepted or started, open the Active Ride card on Dashboard (or Bookings) to launch Live Tracking.
• Streams real-time provider GPS coordinates over Socket.IO (/api/tracking/update) with Follow Driver / Recenter controls and automatically flags driver location as "LAST KNOWN" (stale) if no GPS update arrives for over 45 seconds.
• Flow: Arrived at Pickup -> Safety Checklist -> Start Ride -> Drop/Complete Ride.`
  },
  {
    id: 'ride-chat',
    topic: 'Ride Chat',
    keywords: ['ride chat', 'message driver', 'message passenger', 'in-ride chat', 'talk to buddy'],
    content: `Real-Time Ride Chat:
• Inside an active booking's Live Tracking / Ride screen, accepted passengers and the provider can exchange real-time messages over Socket.IO.
• Access to ride chat (GET /api/chat/:rideId and Socket room ride-{rideId}) is strictly restricted to the ride provider, accepted/completed seekers of that ride, and admins.`
  },
  {
    id: 'college-community',
    topic: 'College Community',
    keywords: ['community', 'posts', 'campus chat', 'lounge', 'anonymous', 'pdf', 'like', 'reply', 'comment'],
    content: `College Community & Campus Chat (Community Screen):
• Scoped to your registered college. Includes Community Posts and real-time Campus Chat.
• You can publish text posts, attach images (with interactive Rotate & Crop editor) or PDFs in chat, like/reply to posts, delete your own posts/messages, or post anonymously (your student identity remains protected in public output; admins retain moderation oversight).`
  },
  {
    id: 'notifications',
    topic: 'Notifications',
    keywords: ['notification', 'notifications', 'push', 'alerts', 'bell', 'badge', 'clear notification', 'swipe'],
    content: `Notifications (Bell Icon > NotificationsScreen):
• Receives real-time in-app Socket alerts and external Expo push notifications for booking requests, acceptances, rejections, arrival, cancellations, walk joins, KYC updates, and admin notices.
• Swipe left (or tap ✕) to clear items or tap "Mark all read".
• Account suspension or revocation notifications stay displayed cleanly in Notifications without redirecting you to other screens.`
  },
  {
    id: 'walk-together',
    topic: 'Walk Together (Nadi)',
    keywords: ['walk', 'nadi', 'walk together', 'walking', 'pedestrian', 'campus walk'],
    content: `Walk Together / Nadi (Dashboard > Nadi / WalkTogetherScreen):
• Designed for students walking across or near campus who want a walking companion.
• Post your origin, destination, and time slot as a walk post in your campus community, or tap Join on an active peer walk post to coordinate and receive join notifications.`
  },
  {
    id: 'safety-checklist',
    topic: 'Pre-Ride Safety Checklist',
    keywords: ['checklist', 'safety checklist', 'pre-ride', 'start ride', 'verify driver'],
    content: `Pre-Ride Safety Checklist (PreRideChecklistScreen):
• Before starting the ride at pickup, driver arrives and marks arrival.
• Both rider/seeker complete the pre-ride safety checklist verifying the driver's photo, vehicle registration plate, USN, and route before the ride transitions to "in-progress".`
  },
  {
    id: 'sos-functionality',
    topic: 'SOS Emergency Functionality',
    keywords: ['sos', 'emergency', 'panic', '112', 'helpline', 'sms', 'call', 'twilio', 'emergency contact'],
    content: `SOS Emergency System (Live Tracking Screen):
• Available to active ride participants via the red SOS button on Live Tracking, triggering POST /api/sos/trigger.
• Honest capability & delivery behavior:
  - Emits immediate real-time Socket.IO alerts to online admins and active ride participants.
  - Queues Expo push notifications (verified asynchronously via receipt worker—receipt confirmation proves device delivery acceptance, NOT that a human read it).
  - Backend automated SMS uses Twilio/Fast2SMS ONLY if configured in production; if unconfigured ("client_action_required"), the app prompts native SMS composer with GPS coordinates and direct dial to your emergency contact or India Emergency Helpline 112.`
  },
  {
    id: 'incident-reporting',
    topic: 'Incident Reporting',
    keywords: ['incident', 'report', 'complaint', 'harassment', 'unsafe driving', 'fare dispute', 'road incident'],
    content: `Incident Reporting (Menu > Report Incident):
• Supports two categories:
  1. Ride Incidents: Physical Threat/Violence/Harassment, Verbal Abuse/Rude Behavior, Fare Dispute/Non-Payment, Booking/Pickup/Cancellation Issue, Vehicle Damage/Spills/Prohibited Items, Fake Booking/Privacy Violation, Other.
  2. Rider/Road Incidents: Near-Miss/Dangerous situation, Accident/Collision, Vehicle Breakdown/Problem, Tyre/Fuel Problem, Unsafe/Rash Driving, Road Hazard/External Damage, Medical Emergency, Security/Theft/Robbery, Traffic/Law Enforcement Issue, Other Incident.
• Server assigns severity (Low, Medium, High, Critical) and notifies admins for investigation, warnings (3 warnings -> automatic suspension), or account blocks.`
  },
  {
    id: 'ratings-reviews',
    topic: 'Ratings and Reviews',
    keywords: ['rating', 'ratings', 'review', 'stars', 'feedback', 'score'],
    content: `Ratings & Reviews (POST /api/ratings & Ratings Screen):
• After completing a ride, participants can submit a 1 to 5 star rating and optional comment for their co-commuter.
• Self-rating and duplicate ratings for the same ride are blocked (HTTP 409). Aggregated averageRating and totalRatings appear on user profiles.`
  },
  {
    id: 'account-settings',
    topic: 'Account Settings and Theme',
    keywords: ['settings', 'theme', 'dark mode', 'light mode', 'sign out', 'logout', 'menu', 'support'],
    content: `Account Settings, Appearance & Menu:
• Toggle Dark / Light Mode directly on the Dashboard hero card or Profile screen.
• Access Profile, My Bookings, Ride Requests, KYC Verification, Report Incident, Contact Support, and Rewards from the Dashboard/TopHeader Menu.
• Sign Out immediately clears your device session token (SecureStore) and rotates your server session seed, disconnecting live sockets.`
  },
  {
    id: 'account-deletion',
    topic: 'Account Deletion',
    keywords: ['delete account', 'remove account', 'close account', 'deactivate'],
    content: `Account Deletion Status:
• Self-service in-app account deletion is NOT currently available as an automated button inside Profile.
• To request permanent deletion of your account and associated rides/bookings, please submit a request via Menu > Contact Support (which emails campus support administrators) so an Admin can process deletion.`
  },
  {
    id: 'privacy-data-protection',
    topic: 'Privacy and Data Protection',
    keywords: ['privacy', 'data protection', 'security', 'securestore', 'kyc privacy', 'suspension', 'blocked', 'revoked'],
    content: `Privacy & Data Protection in HOGO:
• Mobile tokens are stored exclusively in hardware-backed SecureStore (Android KeyStore / iOS Keychain) with no plaintext AsyncStorage token fallback.
• Unrelated users only see minimal public fields; personal email, phone, and USN are hidden from non-participants, and phone numbers are hidden again after ride completion.
• KYC documents reside in private non-public storage accessible only to the document owner or verified admin via authenticated streaming or 15-minute signed URLs.
• Suspended or blocked accounts are locked to a restriction screen with zero access to rides, chats, or community features.`
  },
  {
    id: 'technical-troubleshooting',
    topic: 'Technical Troubleshooting',
    keywords: ['error', 'bug', 'timeout', 'slow', 'stuck', 'loading', 'cannot login', 'logged out', 'gps not working', 'location permission', 'suspended'],
    content: `Technical Troubleshooting:
• App feels slow on first open: The Render backend wakes up from sleep on initial requests (~10-30s); your persisted login session stays signed in automatically.
• Logged into another device error: Tap "Log out other device & sign in here" on Login to rotate session seed cleanly.
• Map or GPS not centering: Grant Foreground Location permission in device OS settings and tap 🎯 GPS / Recenter.
• Selfies or documents failing to upload: Ensure Camera/Gallery permission is granted and the photo is under 5MB in JPEG, PNG, or WebP format.
• Account suspended/blocked: Shows a lock screen with the reason; tap "Check Status" if an admin revoked sanctions, or Contact Support via email.`
  },
];

module.exports = { KNOWLEDGE_SECTIONS };
