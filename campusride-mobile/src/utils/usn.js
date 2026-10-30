// src/utils/usn.js
// Universal helper to format student USN — guarantees last 3 digits, never displays "STUDENT"

export function getDisplayUSN(userOrObj, fallback = 'Buddy') {
  if (!userOrObj) return fallback;

  let rawUsn = '';
  if (typeof userOrObj === 'string') {
    rawUsn = userOrObj;
  } else if (typeof userOrObj === 'object') {
    rawUsn = userOrObj.usn || userOrObj.senderUsn || userOrObj.providerUsn || userOrObj.seekerUsn || '';
  }

  rawUsn = (rawUsn || '').trim();

  // If valid USN provided and not generic placeholder 'STUDENT'
  if (rawUsn && rawUsn.toUpperCase() !== 'STUDENT') {
    const clean = rawUsn.toUpperCase();
    return clean.length > 3 ? clean.slice(-3) : clean;
  }

  // If USN is missing or 'STUDENT', fallback to last 3 chars of user ID
  if (typeof userOrObj === 'object' && userOrObj !== null) {
    const id = userOrObj._id || userOrObj.id || userOrObj.userId;
    if (id && typeof id === 'string' && id.length >= 3) {
      return id.slice(-3).toUpperCase();
    }
  }

  return fallback;
}
