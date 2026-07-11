import React, { useState, useEffect } from 'react';
import * as api from '../services/api.js';
import PreRideChecklist from '../pages/PreRideChecklist.jsx';
import io from 'socket.io-client';
import './TripStatusFlow.css';
import { API_BASE } from '../services/api.js';

export default function TripStatusFlow({ ride, onUpdate }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showChecklist, setShowChecklist] = useState(false);
  const [checklistCompleted, setChecklistCompleted] = useState(false);

  // Check if pre-ride checklist is already completed
  useEffect(() => {
    if (ride?.preRideChecklist?.completedAt) {
      setChecklistCompleted(true);
    }
  }, [ride]);

  const act = async (fn, label) => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fn();
      if (res?.message) alert(res.message);
      
      // Socket emission for cancellation
      if (label === 'cancel ride') {
        //const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000');
        const socket = io(
        API_BASE.replace(/\/api\/?$/, ''),
        {
        transports: ['websocket', 'polling'],
        withCredentials: true
       }
      );
        socket.emit('join-ride', ride._id);
        socket.emit('provider-cancelled', {
          rideId: ride._id,
          reason: res.ride?.cancelReason || 'Provider cancelled',
          cancelledAt: new Date()
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

  // Handle checklist completion
  const handleChecklistComplete = () => {
    setChecklistCompleted(true);
    setShowChecklist(false);
    onUpdate(); // Refresh ride data
  };

  const status = ride?.status;

  // Check if all pre-ride checks are done
  const preRideChecks = ride?.preRideChecklist || {};
  const allChecksDone = preRideChecks.vehicleInspected && 
                        preRideChecks.emergencyKitReady && 
                        preRideChecks.routeConfirmed && 
                        preRideChecks.contactsNotified;

  return (
    <div className="trip-status-flow">
      <div className="tsf-header">
        <h4>🚗 Trip Controls</h4>
        <div className={`tsf-status ${status}`}>
          Status: <span className="capitalize">{status}</span>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{marginBottom:12}}>{error}</div>}

      {/* Pre-Ride Checklist Section */}
      {status === 'active' && !allChecksDone && (
        <div className="checklist-section" style={{marginBottom: 20}}>
          {!showChecklist ? (
            <div className="checklist-prompt" style={{
              background: 'rgba(255, 193, 7, 0.1)', 
              border: '1px solid rgba(255, 193, 7, 0.3)', 
              borderRadius: 10, 
              padding: 16,
              textAlign: 'center'
            }}>
              <div style={{fontSize: 32, marginBottom: 8}}>✅</div>
              <h5 style={{color: '#ffc107', marginBottom: 8}}>Pre-Ride Checklist Required</h5>
              <p style={{color: '#aaa', fontSize: 14, marginBottom: 12}}>
                Complete safety checklist before picking up passenger
              </p>
              <button 
                className="btn btn-warning"
                onClick={() => setShowChecklist(true)}
              >
                Start Checklist
              </button>
            </div>
          ) : (
            <PreRideChecklist 
              rideId={ride._id} 
              onComplete={handleChecklistComplete}
            />
          )}
        </div>
      )}

      {/* Checklist Completed Indicator */}
      {status === 'active' && allChecksDone && (
        <div className="checklist-completed" style={{
          background: 'rgba(40, 167, 69, 0.1)', 
          border: '1px solid rgba(40, 167, 69, 0.3)', 
          borderRadius: 10, 
          padding: 12,
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
          <span style={{fontSize: 20}}>✅</span>
          <div>
            <div style={{color: '#28a745', fontWeight: 600}}>Pre-Ride Checklist Complete</div>
            <div style={{color: '#aaa', fontSize: 12}}>
              Completed at {new Date(preRideChecks.completedAt).toLocaleTimeString()}
            </div>
          </div>
        </div>
      )}

      <div className="tsf-actions">
        <div className="action-buttons">

          {/* Active → pick up passenger (ONLY if checklist done) */}
          {status === 'active' && allChecksDone && (
            <button
              className="btn btn-primary btn-lg"
              onClick={() => act(() => api.pickupPassenger(ride._id), 'pick up passenger')}
              disabled={isLoading}
            >
              {isLoading ? '🔄 Updating...' : '🛑 Passenger Picked Up'}
            </button>
          )}

          {/* Active → start ride (ONLY if checklist done) */}
          {status === 'active' && allChecksDone && (
            <button
              className="btn btn-success btn-lg"
              onClick={() => act(() => api.startRide(ride._id), 'start ride')}
              disabled={isLoading}
            >
              {isLoading ? '🔄 Starting...' : '🚀 Start Ride'}
            </button>
          )}

          {/* Disabled state when checklist not done */}
          {status === 'active' && !allChecksDone && (
            <button
              className="btn btn-secondary btn-lg"
               disabled
              >
             <span>🔒</span> Complete Checklist
            </button>
          )}

          {/* In-progress → drop passenger */}
          {status === 'in-progress' && (
            <button
              className="btn btn-warning btn-lg"
              onClick={() => act(() => api.dropPassenger(ride._id), 'drop passenger')}
              disabled={isLoading}
            >
              {isLoading ? '🔄 Updating...' : '📍 Passenger Dropped'}
            </button>
          )}

          {/* In-progress → complete ride */}
          {status === 'in-progress' && (
            <button
              className="btn btn-success btn-lg"
              onClick={() => act(() => api.completeRide(ride._id), 'complete ride')}
              disabled={isLoading}
            >
              {isLoading ? '🔄 Completing...' : '🎉 Complete Ride'}
            </button>
          )}

          {/* Active or in-progress → cancel */}
          {(status === 'active' || status === 'in-progress') && (
            <button
              className="btn btn-danger btn-lg"
              onClick={() => {
                const reason = prompt('Reason for cancellation (optional):') || '';
                act(() => api.cancelRide(ride._id, reason), 'cancel ride');
              }}
              disabled={isLoading}
            >
              {isLoading ? '🔄 Cancelling...' : '❌ Cancel Ride'}
            </button>
          )}

          {/* Completed */}
          {status === 'completed' && (
            <div className="ride-active-notice">
              <div className="active-indicator">🎉</div>
              <div className="active-text">
                <strong>Ride Completed</strong>
                {ride.completedAt && (
                  <small>Finished at {new Date(ride.completedAt).toLocaleTimeString()}</small>
                )}
              </div>
            </div>
          )}

          {/* Cancelled */}
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