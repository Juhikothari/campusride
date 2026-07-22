import React, { useState } from 'react';
import './PreRideChecklist.css';

const CHECKS = [
  { key: 'vehicleNumber',   label: 'I have noted the vehicle number' },
  { key: 'routeKnown',      label: 'I know the pickup & drop location' },
  { key: 'toldSomeone',     label: 'I have informed someone about this ride' },
  { key: 'phoneFull',       label: 'My phone is sufficiently charged' },
  { key: 'sosKnown',        label: 'I know how to use SOS if needed' },
];

export default function PreRideChecklist({ onComplete, onCancel }) {
  const [checks, setChecks] = useState(
    Object.fromEntries(CHECKS.map(c => [c.key, false]))
  );

  const toggle = (k) => setChecks(prev => ({ ...prev, [k]: !prev[k] }));
  const done   = Object.values(checks).filter(Boolean).length;
  const allDone = done === CHECKS.length;

  return (
    <div className="prc-container">
      <div className="prc-head">
        <div className="prc-icon">🛡️</div>
        <div>
          <div className="prc-title">Safety Checklist</div>
          <div className="prc-sub">Tick all before you ride</div>
        </div>
      </div>

      <div className="prc-progress-wrap">
        <div className="prc-progress-bar" style={{ width: `${(done / CHECKS.length) * 100}%` }} />
      </div>
      <div className="prc-count">{done} / {CHECKS.length} completed</div>

      <div className="prc-checks">
        {CHECKS.map(c => (
          <div key={c.key}
            className={`prc-check ${checks[c.key] ? 'checked' : ''}`}
            onClick={() => toggle(c.key)}>
            <div className={`prc-checkbox ${checks[c.key] ? 'checked' : ''}`}>
              {checks[c.key] && '✓'}
            </div>
            <span className="prc-label">{c.label}</span>
          </div>
        ))}
      </div>

      <div className="prc-actions">
        {onCancel && (
          <button className="btn btn-ghost" type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button
          className="btn btn-primary"
          type="button"
          disabled={!allDone}
          onClick={() => allDone && onComplete?.()}>
          {allDone ? "✅ I'm Ready to Ride!" : `${CHECKS.length - done} item${CHECKS.length - done > 1 ? 's' : ''} remaining`}
        </button>
      </div>
    </div>
  );
}
