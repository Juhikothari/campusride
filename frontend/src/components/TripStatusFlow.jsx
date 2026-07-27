import React, { useState } from 'react';
import * as api from '../services/api.js';
import './TripStatusFlow.css';

export default function TripStatusFlow({ ride, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const act = async (fn) => {
    setLoading(true);
    setError('');
    try {
      await fn();
      onUpdate?.();
    } catch (e) {
      setError(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const status = ride?.status;

  return (
    <div className="trip-status-flow">
      <div className="tsf-header">
        <h4>🚗 Trip Controls</h4>
        <span className={`tsf-status ${status}`}>
          STATUS: <span style={{textTransform:'capitalize'}}>{status}</span>
        </span>
      </div>

      {error && (
        <div style={{background:'rgba(244,67,54,0.1)',border:'1px solid #f44336',borderRadius:10,padding:'10px 14px',marginBottom:12,fontSize:13,color:'#ff6b6b'}}>
          {error}
        </div>
      )}

      <div className="tsf-actions">
        {status === 'active' && (
          <button className="btn btn-success btn-lg btn-full"
            onClick={() => act(() => api.startRide(ride._id))}
            disabled={loading}>
            {loading ? '⏳ Starting...' : '🚀 Start Ride'}
          </button>
        )}

        {status === 'in-progress' && (
          <button className="btn btn-success btn-lg btn-full"
            onClick={() => act(() => api.completeRide(ride._id))}
            disabled={loading}>
            {loading ? '⏳ Completing...' : '🎉 Complete Ride'}
          </button>
        )}

        {(status === 'active' || status === 'in-progress') && (
          <button className="btn btn-danger btn-lg btn-full"
            onClick={() => {
              const reason = prompt('Reason for cancellation (optional):') || '';
              act(() => api.cancelRide(ride._id, reason));
            }}
            disabled={loading}>
            {loading ? '⏳ Cancelling...' : '❌ Cancel Ride'}
          </button>
        )}

        {status === 'completed' && (
          <div style={{textAlign:'center',padding:'20px 0',color:'#4caf50',fontSize:16,fontWeight:700}}>
            🎉 Ride Completed!
          </div>
        )}

        {status === 'cancelled' && (
          <div style={{textAlign:'center',padding:'20px 0',color:'#f44336',fontSize:16,fontWeight:700}}>
            ❌ Ride Cancelled
          </div>
        )}
      </div>
    </div>
  );
}
