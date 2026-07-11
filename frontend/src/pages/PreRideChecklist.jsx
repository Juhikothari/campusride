import React, { useState } from 'react';
import * as api from '../services/api.js';
import './PreRideChecklist.css';

const CHECKS = [
  { key:'vehicleInspected',  label:'Vehicle inspected' },
  { key:'emergencyKitReady', label:'Emergency kit ready' },
  { key:'routeConfirmed',    label:'Route confirmed' },
  { key:'contactsNotified',  label:'Contacts notified' },
];

export default function PreRideChecklist({ rideId, onComplete, onCancel }) {
  const [checks, setChecks] = useState({
    vehicleInspected:false,
    emergencyKitReady:false,
    routeConfirmed:false,
    contactsNotified:false
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggle = (k) => {
    setChecks(prev => ({ ...prev, [k]: !prev[k] }));
  };

  const completed = Object.values(checks).filter(Boolean).length;
  const allDone = completed === CHECKS.length;

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      await api.submitChecklist(rideId, checks);
      onComplete && onComplete();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="prc-container">

      {/* Header */}
      <div className="prc-head">
        <div className="prc-icon">✔</div>
        <div>
          <div className="prc-title">Pre-Ride Checklist</div>
          <div className="prc-sub">Complete all steps before pickup</div>
        </div>
      </div>

      {/* Progress */}
      <div className="prc-progress">
        <div 
          className="prc-progress-bar"
          style={{ width: `${(completed / CHECKS.length) * 100}%` }}
        />
      </div>

      {/* Checklist */}
      <div className="prc-items">
        {CHECKS.map(item => (
          <div 
            key={item.key}
            className={`prc-row ${checks[item.key] ? 'done' : ''}`}
            onClick={() => toggle(item.key)}
          >
            <div className="prc-check">
              {checks[item.key] && '✓'}
            </div>
            <div className="prc-text">{item.label}</div>
          </div>
        ))}
      </div>

      {error && <div className="alert alert-error mt-8">{error}</div>}

      {/* Actions */}
      <div className="prc-actions">
        {onCancel && (
          <button className="btn btn-outline" onClick={onCancel}>
            Cancel
          </button>
        )}

        <button
          className={`btn btn-primary ${loading ? 'btn-loading' : ''}`}
          disabled={!allDone || loading}
          onClick={submit}
        >
          {allDone ? 'Start Ride' : `${CHECKS.length - completed} remaining`}
        </button>
      </div>

    </div>
  );
}