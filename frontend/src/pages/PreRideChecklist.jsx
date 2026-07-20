import React, { useState } from 'react';
import './PreRideChecklist.css';

const CHECKS = [
  { key:'sharedDetails',    label:'I have the provider\'s vehicle number' },
  { key:'routeConfirmed',   label:'I know the pickup & drop location' },
  { key:'contactNotified',  label:'I\'ve told someone I\'m riding' },
  { key:'chargedPhone',     label:'My phone is charged' },
  { key:'sosKnown',         label:'I know how to use SOS if needed' },
];

export default function PreRideChecklist({ onComplete, onCancel }) {
  const [checks, setChecks] = useState({
    sharedDetails:   false,
    routeConfirmed:  false,
    contactNotified: false,
    chargedPhone:    false,
    sosKnown:        false,
  });

  const toggle = (k) => setChecks(prev => ({ ...prev, [k]: !prev[k] }));

  const completed = Object.values(checks).filter(Boolean).length;
  const allDone   = completed === CHECKS.length;

  return (
    <div className="prc-container">
      <div className="prc-head">
        <div className="prc-icon">✔</div>
        <div>
          <div className="prc-title">Before You Ride</div>
          <div className="prc-sub">Quick safety checklist for your trip</div>
        </div>
      </div>

      <div className="prc-progress">
        <div className="prc-progress-bar" style={{ width: `${(completed / CHECKS.length) * 100}%` }} />
      </div>
      <div className="prc-count">{completed}/{CHECKS.length} done</div>

      <div className="prc-checks">
        {CHECKS.map(c => (
          <div key={c.key} className={`prc-check ${checks[c.key] ? 'checked' : ''}`}
            onClick={() => toggle(c.key)}>
            <div className={`prc-checkbox ${checks[c.key] ? 'checked' : ''}`}>
              {checks[c.key] && '✓'}
            </div>
            <span>{c.label}</span>
          </div>
        ))}
      </div>

      <div className="prc-actions">
        {onCancel && (
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        )}
        <button
          className={`btn btn-primary ${!allDone ? 'btn-disabled' : ''}`}
          disabled={!allDone}
          onClick={() => allDone && onComplete?.()}>
          {allDone ? '✅ I\'m Ready!' : `Complete all ${CHECKS.length - completed} remaining`}
        </button>
      </div>
    </div>
  );
}
