/**
 * BookingPopup.jsx
 * Global popup that shows when:
 * - Seeker's booking is accepted or rejected
 * - Provider gets a new booking request
 * Mounted once in App.jsx, listens to socket via useSocket hook.
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../hooks/useSocket.js';

export default function BookingPopup() {
  const { user }   = useAuth();
  const userId     = user?._id || user?.id;
  const userType   = user?.role || 'both';
  const { notifications } = useSocket(userId, userType);
  const [popups, setPopups] = useState([]);

  // Convert new notifications to popups
  useEffect(() => {
    if (!notifications.length) return;
    const latest = notifications[0];
    const st = latest?.booking?.status || latest?.status || latest?.type;

    let popup = null;

    if (st === 'accepted' || latest?.type === 'BOOKING_ACCEPTED') {
      popup = {
        id: Date.now(),
        type: 'success',
        title: '🎉 Booking Accepted!',
        message: 'Your ride booking has been confirmed by the provider.',
      };
    } else if (st === 'rejected' || latest?.type === 'BOOKING_REJECTED') {
      popup = {
        id: Date.now(),
        type: 'error',
        title: '❌ Booking Declined',
        message: 'The provider has declined your booking. Please search for another ride.',
      };
    } else if (st === 'cancelled') {
      popup = {
        id: Date.now(),
        type: 'error',
        title: '❌ Ride Cancelled',
        message: 'This ride has been cancelled by the provider.',
      };
    } else if (latest?.type === 'new-booking' || latest?.notification?.type === 'BOOKING_REQUEST') {
      const seekerName = latest?.booking?.seeker?.name || 'A seeker';
      popup = {
        id: Date.now(),
        type: 'info',
        title: '📩 New Booking Request',
        message: `${seekerName} has requested to book your ride. Go to your bookings to accept or decline.`,
      };
    } else if (latest?.type === 'BOOKING_CANCELLED' || st === 'booking-cancelled') {
      popup = {
        id: Date.now(),
        type: 'warning',
        title: '🚫 Booking Cancelled',
        message: 'A seeker has cancelled their booking on your ride.',
      };
    }

    if (popup) {
      setPopups(prev => [popup, ...prev.slice(0, 2)]); // max 3 at once
      // Auto dismiss after 6 seconds
      setTimeout(() => {
        setPopups(prev => prev.filter(p => p.id !== popup.id));
      }, 6000);
    }
  }, [notifications]);

  if (!popups.length) return null;

  const colors = {
    success: { bg: '#0d2b0d', border: '#4caf50', icon: '✅' },
    error:   { bg: '#2b0d0d', border: '#f44336', icon: '❌' },
    info:    { bg: '#0d1a2b', border: '#2196f3', icon: '📩' },
    warning: { bg: '#2b1f0d', border: '#ff9800', icon: '⚠️' },
  };

  return (
    <div style={{
      position: 'fixed',
      top: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      minWidth: 300,
      maxWidth: '90vw',
      pointerEvents: 'none',
    }}>
      {popups.map(p => {
        const c = colors[p.type] || colors.info;
        return (
          <div key={p.id} style={{
            background: c.bg,
            border: `2px solid ${c.border}`,
            borderRadius: 14,
            padding: '14px 16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            pointerEvents: 'all',
            animation: 'slideDown 0.3s ease',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>{c.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: '#fff', fontSize: 14, marginBottom: 3 }}>{p.title}</div>
              <div style={{ color: '#ccc', fontSize: 13, lineHeight: 1.5 }}>{p.message}</div>
            </div>
            <button
              onClick={() => setPopups(prev => prev.filter(x => x.id !== p.id))}
              style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 18, lineHeight: 1, flexShrink: 0, padding: 0 }}>
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
