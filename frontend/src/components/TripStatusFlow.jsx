import React, { useState } from 'react';
import * as api from '../services/api.js';
import io from 'socket.io-client';
import './TripStatusFlow.css';
import { API_BASE } from '../services/api.js';

// Provider-only trip controls — NO checklist here
export default function TripStatusFlow({ ride, onUpdate }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState('');

  const act = async (fn, label) => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fn();
      if (res?.message) alert(res.message);
      if (label === 'cancel ride') {
        const socket = io(API_BASE.replace(/\/api\/?$/, ''), {
          transports: ['websocket', 'polling'], withCredentials: true,
        });
        socket.emit('join-ride', ride._id);
        socket.emit('provider-cancelled', {
          rideId: ride._id,
          reason: res.ride?.cancelReason || 'Provider cancelled',
          cancelledAt: new Date(),
        });
        socket.disconnect();
      }
      onUpdate();
    } catch (e) {
      setError(e.message || `Failed to ${label}`);
    } finally {
      setIsLoading(false);
    }
  };

  const status = ride?.status;

  return (
    <div className="trip-status-flow">
      <div className="tsf-header">
        <h4>🚗 Trip Controls</h4>
        <div className={`tsf-status ${status}`}>
          Status: <span className="capitalize">{status}</span>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{marginBottom:12}}>{error}</div>}

      <div className="tsf-actions">
        <div className="action-buttons">

          {/* Active → pick up passenger */}
          {status === 'active' && (
            <button className="btn btn-primary btn-lg"
              onClick={() => act(() => api.pickupPassenger(ride._id), 'pick up passenger')}
              disabled={isLoading}>
              {isLoading ? '🔄 Updating...' : '🛑 Passenger Picked Up'}
            </button>
          )}

          {/* Active → start ride */}
          {status === 'active' && (
            <button className="btn btn-success btn-lg"
              onClick={() => act(() => api.startRide(ride._id), 'start ride')}
              disabled={isLoading}>
              {isLoading ? '🔄 Starting...' : '🚀 Start Ride'}
            </button>
          )}

          {/* In-progress → drop passenger */}
          {status === 'in-progress' && (
            <button className="btn btn-warning btn-lg"
              onClick={() => act(() => api.dropPassenger(ride._id), 'drop passenger')}
              disabled={isLoading}>
              {isLoading ? '🔄 Updating...' : '📍 Passenger Dropped'}
            </button>
          )}

          {/* In-progress → complete ride */}
          {status === 'in-progress' && (
            <button className="btn btn-success btn-lg"
              onClick={() => act(() => api.completeRide(ride._id), 'complete ride')}
              disabled={isLoading}>
              {isLoading ? '🔄 Completing...' : '🎉 Complete Ride'}
            </button>
          )}

          {/* Cancel */}
          {(status === 'active' || status === 'in-progress') && (
            <button className="btn btn-danger btn-lg"
              onClick={() => {
                const reason = prompt('Reason for cancellation (optional):') || '';
                act(() => api.cancelRide(ride._id, reason), 'cancel ride');
              }}
              disabled={isLoading}>
              {isLoading ? '🔄 Cancelling...' : '❌ Cancel Ride'}
            </button>
          )}

          {status === 'completed' && (
            <div className="ride-active-notice">
              <div className="active-indicator">🎉</div>
              <div className="active-text">
                <strong>Ride Completed</strong>
                {ride.completedAt && <small>Finished at {new Date(ride.completedAt).toLocaleTimeString()}</small>}
              </div>
            </div>
          )}

          {status === 'cancelled' && (
            <div className="ride-active-notice">
              <div className="active-indicator">❌</div>
              <div className="active-text">
                <strong>Ride Cancelled</strong>
                {ride.cancelReason && <small>{ride.cancelReason}</small>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
