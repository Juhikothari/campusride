// src/utils/date.js
// Standardized universal date & time formatting helper

/**
 * Formats a date string, Date object, or timestamp strictly into DD/MM/YYYY.
 * e.g. "2026-10-30" -> "30/10/2026"
 */
export function formatDateDMY(d) {
  if (!d) return '—';
  try {
    // If string is already in YYYY-MM-DD format
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) {
      const parts = d.split('T')[0].split('-');
      if (parts.length === 3) {
        return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
      }
    }
    const date = (typeof d === 'string' || typeof d === 'number') ? new Date(d) : d;
    if (isNaN(date.getTime())) {
      return String(d);
    }
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '—';
  }
}

/**
 * Formats a date strictly into DD/MM/YYYY at HH:MM
 */
export function formatDateTimeDMY(d) {
  if (!d) return '—';
  try {
    const date = (typeof d === 'string' || typeof d === 'number') ? new Date(d) : d;
    if (isNaN(date.getTime())) return String(d);
    const dmy = formatDateDMY(date);
    const time = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${dmy} • ${time}`;
  } catch {
    return '—';
  }
}

export default {
  formatDateDMY,
  formatDateTimeDMY,
};
