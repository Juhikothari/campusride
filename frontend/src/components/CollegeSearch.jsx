/**
 * CollegeSearch.jsx
 * Searchable dropdown for Indian colleges.
 * Replaces the plain text input for college name.
 */
import React, { useState, useRef, useEffect } from 'react';
import { searchColleges } from '../data/indianColleges.js';

export default function CollegeSearch({ value = '', onChange, placeholder = 'Search your college…', className = '' }) {
  const [query,       setQuery]       = useState(value);
  const [suggestions, setSuggestions] = useState([]);
  const [open,        setOpen]        = useState(false);
  const [selected,    setSelected]    = useState(false);
  const wrapRef   = useRef(null);
  const inputRef  = useRef(null);
  const debounce  = useRef(null);

  // Sync external value
  useEffect(() => { setQuery(value || ''); }, [value]);

  const handleInput = (val) => {
    setQuery(val);
    setSelected(false);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      if (val.length >= 2) {
        setSuggestions(searchColleges(val));
        setOpen(true);
      } else {
        setSuggestions([]);
        setOpen(false);
      }
    }, 150);
    onChange?.(val); // pass raw text too so form stays updated
  };

  const handleSelect = (college) => {
    setQuery(college.name);
    setSelected(true);
    setSuggestions([]);
    setOpen(false);
    onChange?.(college.name);
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={wrapRef} style={{ position: 'relative' }} className={className}>
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          className="input"
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={e => handleInput(e.target.value)}
          onFocus={() => query.length >= 2 && !selected && setOpen(true)}
          autoComplete="off"
        />
        {selected && (
          <span style={{
            position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
            color:'#4caf50', fontSize:16,
          }}>✓</span>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div style={{
          position:'absolute', top:'calc(100% + 4px)', left:0, right:0,
          background:'#1a1d24', border:'1px solid rgba(255,255,255,0.12)',
          borderRadius:10, zIndex:999, maxHeight:260, overflowY:'auto',
          boxShadow:'0 8px 32px rgba(0,0,0,0.4)',
        }}>
          {suggestions.map((c, i) => (
            <div key={i}
              onMouseDown={() => handleSelect(c)}
              style={{
                padding:'10px 14px', cursor:'pointer', borderBottom:'1px solid rgba(255,255,255,0.05)',
                display:'flex', flexDirection:'column', gap:2,
                transition:'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(245,166,35,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background='transparent'}
            >
              <div style={{fontSize:13, color:'#fff', fontWeight:500}}>{c.name}</div>
              <div style={{fontSize:11, color:'#666', display:'flex', gap:8}}>
                {c.state && <span>📍 {c.state}</span>}
                {c.domains?.[0] && <span>✉ @{c.domains[0]}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {open && query.length >= 2 && suggestions.length === 0 && (
        <div style={{
          position:'absolute', top:'calc(100% + 4px)', left:0, right:0,
          background:'#1a1d24', border:'1px solid rgba(255,255,255,0.1)',
          borderRadius:10, zIndex:999, padding:'12px 14px',
          fontSize:13, color:'#666',
        }}>
          No college found for "{query}" — you can still type it manually
        </div>
      )}
    </div>
  );
}
