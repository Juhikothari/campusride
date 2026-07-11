import React, { useState, useEffect } from 'react';
import * as api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const NOTIF_TYPES = {
  booking_request:   { icon: '📬', color: '#6c63ff', label: 'New Request'       },
  booking_accepted:  { icon: '✅', color: '#2dd4a0', label: 'Booking Accepted'  },
  booking_rejected:  { icon: '❌', color: '#ff6b6b', label: 'Booking Rejected'  },
  booking_cancelled: { icon: '🚫', color: '#ff8800', label: 'Booking Cancelled' },
  ride_pickup:       { icon: '🚗', color: '#f5a623', label: 'Pickup Confirmed'  },
  ride_in_progress:  { icon: '🛣️', color: '#f5a623', label: 'Ride In Progress'  },
  ride_drop:         { icon: '📍', color: '#2dd4a0', label: 'Dropped Off'       },
  ride_completed:    { icon: '🏁', color: '#2dd4a0', label: 'Ride Completed'    },
  ride_cancelled:    { icon: '❌', color: '#ff6b6b', label: 'Ride Cancelled'    },
  kyc_submitted:     { icon: '📋', color: '#888',    label: 'KYC Submitted'     },
  kyc_approved:      { icon: '🪪', color: '#2dd4a0', label: 'KYC Approved'      },
  kyc_rejected:      { icon: '🪪', color: '#ff6b6b', label: 'KYC Rejected'      },
  kyc_revoked:       { icon: '🪪', color: '#ff8800', label: 'KYC Update'        },
  account_removed:   { icon: '📢', color: '#ff4444', label: 'Account'           },
  alert_match:       { icon: '🔔', color: '#f5a623', label: 'Route Alert'       },
  incident_update:   { icon: '⚠️', color: '#ff8800', label: 'Incident Update'   },

  system:            { icon: '📢', color: '#555',    label: 'System'            },
};

const TYPE_ORDER = {
  ride_completed:   6,
  ride_drop:        5,
  ride_in_progress: 4,
  ride_pickup:      3,
  booking_accepted: 2,
  booking_request:  1,
};

// ─── SEEKER NOTIFICATIONS ────────────────────────────────────────────────────
function buildSeekerNotifications(bookings, navigate, ratedRideIds) {
  const notifs = [];

  bookings.forEach(b => {
    const ride = b.rideId;
    if (!ride) return;

    const pickup = ride.pickup?.label?.split(',')[0] || ride.pickup?.address?.split(',')[0] || 'Pickup';
    const drop   = ride.drop?.label?.split(',')[0]   || ride.drop?.address?.split(',')[0]   || 'Drop';
    const date   = ride.date
      ? new Date(ride.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
      : '';
    const rideId = ride._id?.toString().slice(-6).toUpperCase();

    if (b.status === 'accepted') {
      notifs.push({
        id: `seeker-ba-${b._id}`,
        type: 'booking_accepted',
        role: 'seeker',
        rideId: ride._id,
        title: '✅ Booking Confirmed!',
        body: `Ride #${rideId}: ${pickup} → ${drop} on ${date} at ${ride.time}. Your seat is confirmed!`,
        time: b.updatedAt || b.createdAt,
        action: () => navigate('ride-detail', { rideId: ride._id }),
        actionLabel: 'View Ride',
      });
    }

    if (b.status === 'rejected') {
      notifs.push({
        id: `seeker-br-${b._id}`,
        type: 'booking_rejected',
        role: 'seeker',
        rideId: ride._id,
        title: '❌ Booking Declined',
        body: `Ride #${rideId}: ${pickup} → ${drop} on ${date} was declined. Search for another ride.`,
        time: b.updatedAt || b.createdAt,
        action: () => navigate('search-rides'),
        actionLabel: 'Find Another Ride',
        secondaryAction: () => navigate('ride-detail', { rideId: ride._id }),
        secondaryLabel: 'View Ride',
      });
    }

    if (ride.status === 'in-progress') {
      notifs.push({
        id: `seeker-rp-${ride._id}`,
        type: 'ride_pickup',
        role: 'seeker',
        rideId: ride._id,
        title: '🚗 Ride Has Started — Pickup Confirmed',
        body: `Ride #${rideId}: Your provider has picked you up. Travelling from ${pickup} to ${drop}.`,
        time: ride.startedAt || ride.updatedAt,
        action: () => navigate('ride-detail', { rideId: ride._id }),
        actionLabel: 'Track Ride',
      });
    }

    if (ride.status === 'completed') {
      const isAlreadyRated = ratedRideIds.has(String(ride._id));
      notifs.push({
        id: `seeker-rd-${ride._id}`,
        type: 'ride_drop',
        role: 'seeker',
        rideId: ride._id,
        title: '📍 You Have Been Dropped Off',
        body: `Ride #${rideId}: Successfully reached ${drop} from ${pickup} on ${date}.`,
        time: ride.completedAt || ride.updatedAt,
        action: () => navigate('ride-detail', { rideId: ride._id }),
        actionLabel: 'View Ride',
      });

      if (isAlreadyRated) {
        notifs.push({
          id: `seeker-rc-${ride._id}`,
          type: 'ride_completed',
          role: 'seeker',
          rideId: ride._id,
          title: '🏁 Ride Complete — Already Rated',
          body: `Ride #${rideId}: ${pickup} → ${drop} on ${date} is complete. You already submitted your rating.`,
          time: ride.completedAt || ride.updatedAt,
          action: () => navigate('ride-detail', { rideId: ride._id }),
          actionLabel: 'View Ride',
        });
      } else {
        notifs.push({
          id: `seeker-rc-${ride._id}`,
          type: 'ride_completed',
          role: 'seeker',
          rideId: ride._id,
          title: '🏁 Ride Complete — Rate Your Experience',
          body: `Ride #${rideId}: ${pickup} → ${drop} on ${date} is complete. How was your ride?`,
          time: ride.completedAt || ride.updatedAt,
          action: () => navigate('ratings', { preselectedRideId: ride._id, bookingId: b._id }),
          actionLabel: '⭐ Rate Now',
          secondaryAction: () => navigate('ride-detail', { rideId: ride._id }),
          secondaryLabel: 'View Ride',
        });
      }
    }

    if (ride.status === 'cancelled') {
      notifs.push({
        id: `seeker-rcan-${ride._id}`,
        type: 'ride_cancelled',
        role: 'seeker',
        rideId: ride._id,
        title: '🚫 Ride Cancelled',
        body: `Ride #${rideId}: ${pickup} → ${drop} on ${date} was cancelled. Please search for another ride.`,
        time: ride.updatedAt || ride.createdAt,
        action: () => navigate('search-rides'),
        actionLabel: 'Find Ride',
        secondaryAction: () => navigate('ride-detail', { rideId: ride._id }),
        secondaryLabel: 'View Ride',
      });
    }
  });

  return notifs;
}

// ─── PROVIDER NOTIFICATIONS ──────────────────────────────────────────────────
function buildProviderNotifications(myRides, requests, navigate) {
  const notifs = [];

  requests.forEach(b => {
    if (b.status === 'pending') {
      notifs.push({
        id: `provider-req-${b._id}`,
        type: 'booking_request',
        role: 'provider',
        rideId: b.rideId?._id || b.rideId,
        title: '📬 New Booking Request',
        body: `${b.seekerId?.name || 'A user'} requested to join your ride.`,
        time: b.createdAt,
        action: () => navigate('provider-bookings'),
        actionLabel: 'Respond',
        secondaryAction: () => navigate('ride-detail', { rideId: b.rideId?._id || b.rideId }),
        secondaryLabel: 'View Ride',
      });
    }
  });

  myRides.forEach(ride => {
    const pickup  = ride.pickup?.label?.split(',')[0] || ride.pickup?.address?.split(',')[0] || 'Pickup';
    const drop    = ride.drop?.label?.split(',')[0]   || ride.drop?.address?.split(',')[0]   || 'Drop';
    const rideId  = ride._id?.toString().slice(-6).toUpperCase();

    if (ride.startedAt || ride.status === 'in-progress' || ride.status === 'completed') {
      notifs.push({
        id: `provider-pp-${ride._id}`,
        type: 'ride_pickup',
        role: 'provider',
        rideId: ride._id,
        title: '🚗 Pickup Completed',
        body: `Ride #${rideId}: Passengers picked up from ${pickup}.`,
        time: ride.startedAt || ride.updatedAt,
        action: () => navigate('ride-detail', { rideId: ride._id }),
        actionLabel: 'View Ride',
      });

      notifs.push({
        id: `provider-pi-${ride._id}`,
        type: 'ride_in_progress',
        role: 'provider',
        rideId: ride._id,
        title: '🛣️ Ride In Progress',
        body: `Ride #${rideId}: Heading towards ${drop}.`,
        time: ride.startedAt || ride.updatedAt,
        action: () => navigate('ride-detail', { rideId: ride._id }),
        actionLabel: 'View Ride',
        secondaryAction: () => navigate('provider-bookings'),
        secondaryLabel: 'Manage Ride',
      });
    }

    if (ride.status === 'completed') {
      notifs.push({
        id: `provider-pd-${ride._id}`,
        type: 'ride_drop',
        role: 'provider',
        rideId: ride._id,
        title: '📍 Passengers Dropped Off',
        body: `Ride #${rideId}: Successfully dropped passengers at ${drop}.`,
        time: ride.completedAt || ride.updatedAt,
        action: () => navigate('ride-detail', { rideId: ride._id }),
        actionLabel: 'View Ride',
      });

      notifs.push({
        id: `provider-pc-${ride._id}`,
        type: 'ride_completed',
        role: 'provider',
        rideId: ride._id,
        title: '🏁 Ride Completed',
        body: `Ride #${rideId}: ${pickup} → ${drop} completed successfully.`,
        time: ride.completedAt || ride.updatedAt,
        action: () => navigate('ride-detail', { rideId: ride._id }),
        actionLabel: 'View Ride',
        secondaryAction: () => navigate('ratings', { viewRideId: ride._id }),
        secondaryLabel: 'View Ratings',
      });
    }

    if (ride.status === 'cancelled') {
      notifs.push({
        id: `provider-rcan-${ride._id}`,
        type: 'ride_cancelled',
        role: 'provider',
        rideId: ride._id,
        title: '🚫 Ride Cancelled',
        body: `Ride #${rideId}: ${pickup} → ${drop} was cancelled.`,
        time: ride.updatedAt || ride.createdAt,
        action: () => navigate('ride-detail', { rideId: ride._id }),
        actionLabel: 'View Ride',
      });
    }
  });

  return notifs;
}

function sortAndFlattenNotifs(notifs) {
  const rideGroups = {};
  notifs.forEach(n => {
    const key = n.rideId ? String(n.rideId) : `solo-${n.id}`;
    if (!rideGroups[key]) rideGroups[key] = [];
    rideGroups[key].push(n);
  });

  Object.values(rideGroups).forEach(group => {
    group.sort((a, b) => {
      const o1 = TYPE_ORDER[a.type] ?? 0;
      const o2 = TYPE_ORDER[b.type] ?? 0;
      if (o1 !== o2) return o2 - o1;
      return new Date(b.time ?? 0) - new Date(a.time ?? 0);
    });
  });

  const sortedGroups = Object.values(rideGroups).sort((a, b) => {
    const latestA = Math.max(...a.map(x => new Date(x.time ?? 0).getTime()));
    const latestB = Math.max(...b.map(x => new Date(x.time ?? 0).getTime()));
    return latestB - latestA;
  });

  return sortedGroups.flat();
}

export default function NotificationsPage({ navigate }) {
  const { user } = useAuth();
  const isProvider = user?.role === 'provider' || user?.role === 'both';
  const isSeeker   = user?.role === 'seeker'   || user?.role === 'both';
  const isBoth     = user?.role === 'both';

  const [roleView,    setRoleView]    = useState(isSeeker ? 'seeker' : 'provider');
  const [tab,         setTab]         = useState('all');
  const [bookings,    setBookings]    = useState([]);
  const [myRides,     setMyRides]     = useState([]);
  const [requests,    setRequests]    = useState([]);
  const [alerts,      setAlerts]      = useState([]);
  const [incidents,   setIncidents]   = useState([]);
  const [serverInbox, setServerInbox] = useState([]);
  const [ratedRideIds, setRatedRideIds] = useState(new Set());
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    api.getNotifications()
      .then(d => setServerInbox(Array.isArray(d) ? d : []))
      .catch(() => setServerInbox([]));
  }, []);

  useEffect(() => { setTab('all'); }, [roleView]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (isSeeker) {
          const d = await api.getMyBookings();
          setBookings(d || []);
          const currentUserId = user?._id || user?.id || user?.userId;
          if (currentUserId) {
            const myRatings = await api.getRatingsByReviewer(currentUserId);
            const rated = new Set(
              (Array.isArray(myRatings) ? myRatings : [])
                .map(r => r?.rideId?._id || r?.rideId)
                .filter(Boolean)
                .map(id => String(id))
            );
            setRatedRideIds(rated);
          }
        }
        if (isProvider) {
          const r = await api.getRideRequests();
          setRequests(r || []);
          const m = await api.getMyRides();
          setMyRides(m || []);
        }
        const al  = await api.getMyAlerts();
        setAlerts(al || []);
        const inc = await api.getMyIncidents();
        setIncidents(inc || []);
      } catch (_) {}
      setLoading(false);
    };
    load();
  }, [isSeeker, isProvider, user]);

  const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff  = Date.now() - new Date(dateStr);
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins < 1)   return 'Just now';
    if (mins < 60)  return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const buildNotifications = () => {
    const notifs = [];

    if (isSeeker && roleView === 'seeker') {
      notifs.push(...buildSeekerNotifications(bookings, navigate, ratedRideIds));
    }

    if (isProvider && roleView === 'provider') {
      notifs.push(...buildProviderNotifications(myRides, requests, navigate));
    }

    serverInbox.forEach(n => {
      const normalizedType = String(n.type || 'system').toLowerCase();
      const rideId = n?.data?.rideId;
      notifs.push({
        id:    `inbox-${n._id}`,
        type:  normalizedType,
        role:  'system',
        title: n.title || 'CampusRide',
        body:  n.body  || '',
        time:  n.createdAt,
        ...(normalizedType === 'rating_received' && rideId
          ? {
              action: () => navigate('ratings', { viewRideId: rideId }),
              actionLabel: 'View Ride Ratings',
            }
          : {}),
      });
    });

    // KYC
    const kycStatus = user?.kycData?.status;
    if (kycStatus === 'pending') {
      notifs.push({
        id: 'kyc-pending', type: 'kyc_submitted', role: 'system',
        title: '📋 KYC Documents Submitted',
        body: 'Your documents are under review. This usually takes up to 24 hours.',
        time: user?.kycData?.submittedAt,
        action: () => navigate('kyc'), actionLabel: 'View Status',
      });
    }
    if (kycStatus === 'approved') {
      notifs.push({
        id: 'kyc-approved', type: 'kyc_approved', role: 'system',
        title: '🪪 KYC Verified — Full Access Granted!',
        body: 'Your identity has been verified. You now have full access to all features.',
        time: user?.kycData?.reviewedAt,
        action: () => navigate('dashboard'), actionLabel: 'Go to Dashboard',
      });
    }
    if (kycStatus === 'rejected') {
      notifs.push({
        id: 'kyc-rejected', type: 'kyc_rejected', role: 'system',
        title: '🪪 KYC Rejected — Action Required',
        body: `Reason: ${user?.kycData?.rejectReason || 'Documents unclear'}. Please resubmit.`,
        time: user?.kycData?.reviewedAt,
        action: () => navigate('kyc'), actionLabel: 'Resubmit Now',
      });
    }

    // Route Alerts
    alerts.forEach(a => {
      const from = a.from?.label?.split(',')[0] || 'your area';
      const to   = a.to?.label?.split(',')[0]   || 'destination';
      notifs.push({
        id: `al-${a._id}`, type: 'alert_match', role: 'system',
        title: '🔔 Route Alert Active',
        body: `Alert set for ${from} → ${to}. You'll be notified when a matching ride is posted.`,
        time: a.createdAt,
        action: () => navigate('route-alerts'), actionLabel: 'Manage Alerts',
      });
    });

    // Incidents
    incidents.forEach(inc => {
      const statusLabel = inc.status?.replace(/_/g, ' ') || 'open';
      const labelCap    = statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1);
      notifs.push({
        id: `inc-${inc._id}`, type: 'incident_update', role: 'system',
        title: `⚠️ Incident Report: ${labelCap}`,
        body: `"${inc.subject || inc.type}" — Your report is ${statusLabel}. Ref: #${inc._id?.slice(-8).toUpperCase()}`,
        time: inc.updatedAt || inc.createdAt,
        action: () => navigate('incident-report'), actionLabel: 'View Report',
      });
    });

    return sortAndFlattenNotifs(notifs);
  };

  const allNotifs = buildNotifications();

  const SEEKER_TABS = [
    { key: 'all',       label: 'All',       filter: () => true },
    { key: 'bookings',  label: 'Bookings',  filter: n => n.type.startsWith('booking') },
    { key: 'rides',     label: 'Rides',     filter: n => ['ride_pickup','ride_in_progress','ride_drop','ride_completed','ride_cancelled'].includes(n.type) },
   
    { key: 'kyc',       label: 'KYC',       filter: n => n.type.startsWith('kyc') },
    { key: 'alerts',    label: 'Alerts',    filter: n => n.type === 'alert_match' },
    { key: 'incidents', label: 'Incidents', filter: n => n.type === 'incident_update' },
  ];

  const PROVIDER_TABS = [
    { key: 'all',       label: 'All',       filter: () => true },
    { key: 'requests',  label: 'Requests',  filter: n => n.type === 'booking_request' },
    { key: 'rides',     label: 'My Rides',  filter: n => ['ride_pickup','ride_in_progress','ride_drop','ride_completed','ride_cancelled'].includes(n.type) },
   
    { key: 'kyc',       label: 'KYC',       filter: n => n.type.startsWith('kyc') },
    { key: 'incidents', label: 'Incidents', filter: n => n.type === 'incident_update' },
  ];

  const TABS    = roleView === 'seeker' ? SEEKER_TABS : PROVIDER_TABS;
  const current = TABS.find(t => t.key === tab) || TABS[0];
  const filtered = allNotifs.filter(current.filter);

  return (
    <div className="page-wrap fade-up">
      <p className="eyebrow mb-8">Activity</p>
      <h1 className="heading mb-4" style={{ fontSize: 28, color: '#fff' }}>Notifications</h1>
      <p className="text-muted mb-20 text-sm">All your ride updates, bookings, KYC and alert activity.</p>

      {/* Role Switcher */}
      {isBoth && (
        <div style={{ display:'flex', gap:8, marginBottom:20, background:'#0d0f14', borderRadius:12, padding:6, width:'fit-content', border:'1px solid #1e2028' }}>
          <button onClick={() => setRoleView('seeker')}
            style={{ padding:'9px 20px', borderRadius:8, border:'none', cursor:'pointer', fontWeight:700, fontSize:13, transition:'all 0.2s',
              background: roleView==='seeker' ? '#6c63ff' : 'transparent', color: roleView==='seeker' ? '#fff' : '#666' }}>
            🎒 As Seeker
          </button>
          <button onClick={() => setRoleView('provider')}
            style={{ padding:'9px 20px', borderRadius:8, border:'none', cursor:'pointer', fontWeight:700, fontSize:13, transition:'all 0.2s',
              background: roleView==='provider' ? '#f5a623' : 'transparent', color: roleView==='provider' ? '#000' : '#666' }}>
            🚗 As Provider
          </button>
        </div>
      )}

      {/* Tab Bar */}
      <div style={{ display:'flex', gap:6, marginBottom:24, overflowX:'auto', paddingBottom:4 }}>
        {TABS.map(t => {
          const count   = allNotifs.filter(t.filter).length;
          const isActive = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ padding:'8px 14px', borderRadius:99, border:'none', cursor:'pointer', whiteSpace:'nowrap', fontWeight:600, fontSize:13,
                background: isActive ? '#f5a623' : '#111318', color: isActive ? '#000' : '#888' }}>
              {t.label}
              {count > 0 && (
                <span style={{ marginLeft:5, padding:'1px 6px', borderRadius:99, fontSize:11, background: isActive ? 'rgba(0,0,0,0.2)' : '#1e2028', color: isActive ? '#000' : '#aaa' }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading && (
        <div>{[1,2,3,4].map(i => <div key={i} className="skeleton" style={{height:100, borderRadius:12, marginBottom:10}} />)}</div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="empty-state" style={{paddingTop:40}}>
          <div className="empty-icon">🔔</div>
          <div className="empty-title" style={{color:'#fff'}}>No notifications yet</div>
          <div className="empty-sub mt-8">
            {tab==='bookings'  ? 'No booking activity. Search for a ride to get started.' :
             tab==='requests'  ? 'No pending booking requests for your rides.' :
             tab==='rides'     ? 'No ride updates yet.' :
             
             tab==='kyc'       ? 'Complete KYC to see verification status here.' :
             tab==='alerts'    ? 'Set a route alert to get notified about matching rides.' :
             tab==='incidents' ? 'No incident reports filed.' :
                                 'Your activity will appear here as you use the app.'}
          </div>
          {tab==='alerts'   && <button className="btn btn-primary mt-16" onClick={() => navigate('route-alerts')}>Set Route Alert</button>}
          {tab==='kyc'      && <button className="btn btn-primary mt-16" onClick={() => navigate('kyc')}>Complete KYC</button>}
          {tab==='bookings' && <button className="btn btn-primary mt-16" onClick={() => navigate('search-rides')}>Find a Ride</button>}
          {tab==='requests' && <button className="btn btn-primary mt-16" onClick={() => navigate('create-ride')}>Post a Ride</button>}
          {tab==='incidents'&& <button className="btn btn-primary mt-16" onClick={() => navigate('incident-report')}>Report Incident</button>}
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {filtered.map(n => {
          const meta = NOTIF_TYPES[n.type] || NOTIF_TYPES.system;
          return (
            <div key={n.id}
              style={{ background:'#111318', border:'1px solid #1e2028', borderLeft:`3px solid ${meta.color}`,
                borderRadius:12, padding:'16px 18px', display:'flex', gap:14, alignItems:'flex-start' }}>
              <div style={{ width:42, height:42, borderRadius:'50%', background:`${meta.color}20`,
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
                {meta.icon}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4, gap:8 }}>
                  <div style={{ color:'#fff', fontWeight:700, fontSize:14 }}>{n.title}</div>
                  <div style={{ color:'#555', fontSize:11, whiteSpace:'nowrap', flexShrink:0 }}>{timeAgo(n.time)}</div>
                </div>
                <div style={{ color:'#888', fontSize:13, lineHeight:1.6, marginBottom: (n.action || n.secondaryAction) ? 12 : 0 }}>
                  {n.body}
                </div>
                {(n.action || n.secondaryAction) && (
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {n.action && (
                      <button onClick={n.action}
                        style={{ background:'transparent', border:`1px solid ${meta.color}`, borderRadius:6, color:meta.color,
                          fontSize:12, fontWeight:600, padding:'5px 12px', cursor:'pointer' }}>
                        {n.actionLabel} →
                      </button>
                    )}
                    {n.secondaryAction && (
                      <button onClick={n.secondaryAction}
                        style={{ background:'transparent', border:'1px solid #333', borderRadius:6, color:'#888',
                          fontSize:12, fontWeight:600, padding:'5px 12px', cursor:'pointer' }}>
                        {n.secondaryLabel}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
