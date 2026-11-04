// backend/location/mapsLink.js
//
// Turns a Google Maps share link (or plain "lat, lng") into coordinates.
// No Google API key needed: we only read the link / follow its redirects.
//
// Safety: only Google Maps hosts are ever contacted, only over https,
// redirects are followed manually (max 5) and every hop is re-checked.

const axios = require('axios');

const ALLOWED_HOSTS = new Set([
  'maps.app.goo.gl',
  'goo.gl',
  'www.google.com', 'google.com',
  'maps.google.com',
  'www.google.co.in', 'google.co.in', 'maps.google.co.in',
]);

const NUM = '(-?\\d{1,3}(?:\\.\\d+)?)';

function validLatLng(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng)
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    && !(lat === 0 && lng === 0);
}

function safeDecode(s) {
  try { return decodeURIComponent(s.replace(/\+/g, ' ')); } catch { return s; }
}

// Find coordinates inside a (long) Google Maps URL or text snippet.
function parseCoords(text) {
  if (!text) return null;
  const t = safeDecode(String(text));

  // 1) plain "12.9716, 77.5946"
  let m = t.trim().match(new RegExp(`^${NUM}\\s*[, ]\\s*${NUM}$`));
  // 2) the exact pin:  ...!3d12.97!4d77.59...
  if (!m) m = t.match(new RegExp(`!3d${NUM}!4d${NUM}`));
  // 3) map centre:  .../@12.97,77.59,17z
  if (!m) m = t.match(new RegExp(`@${NUM},${NUM}`));
  // 4) query-style:  ?q=12.97,77.59  &query=  &ll=  &destination=  &center=
  if (!m) m = t.match(new RegExp(`[?&](?:q|query|ll|sll|daddr|destination|center)=${NUM}\\s*,\\s*${NUM}`));

  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lng = parseFloat(m[2]);
  return validLatLng(lat, lng) ? { lat, lng } : null;
}

function parsePlaceName(text) {
  const m = String(text || '').match(/\/maps\/place\/([^/@?]+)/);
  if (!m) return '';
  const name = safeDecode(m[1]).trim();
  // a bare "12.97,77.59" is not a name
  return /^-?\d/.test(name) ? '' : name.slice(0, 120);
}

function isAllowed(urlStr) {
  try {
    const u = new URL(urlStr);
    return u.protocol === 'https:' && ALLOWED_HOSTS.has(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}

// Returns { lat, lng, name? }  |  { name } (name only)  |  null
async function resolveMapsLink(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;

  // Plain coordinates pasted directly
  if (!/^https?:\/\//i.test(raw)) {
    const direct = parseCoords(raw);
    return direct || null;
  }

  let current = raw;
  let name = '';

  for (let hop = 0; hop < 6; hop++) {
    if (!isAllowed(current)) {
      const err = new Error('Please paste a Google Maps link (maps.app.goo.gl or google.com/maps).');
      err.status = 400;
      throw err;
    }

    const found = parseCoords(current);
    if (!name) name = parsePlaceName(current);
    if (found) return { ...found, ...(name && { name }) };

    let resp;
    try {
      resp = await axios.get(current, {
        maxRedirects: 0,
        timeout: 6000,
        responseType: 'text',
        maxContentLength: 1.5e6,
        validateStatus: (s) => s >= 200 && s < 400,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
          'Accept-Language': 'en-IN,en;q=0.9',
        },
      });
    } catch {
      return name ? { name } : null;
    }

    if (resp.status >= 300 && resp.status < 400 && resp.headers.location) {
      current = new URL(resp.headers.location, current).toString();
      continue;
    }

    // Landed on a page: last attempt, look for the pin inside the page text
    const html = typeof resp.data === 'string' ? resp.data.slice(0, 600000) : '';
    const inPage = parseCoords(html);
    if (inPage) return { ...inPage, ...(name && { name }) };
    return name ? { name } : null;
  }

  return name ? { name } : null;
}

module.exports = { resolveMapsLink, parseCoords, parsePlaceName };
