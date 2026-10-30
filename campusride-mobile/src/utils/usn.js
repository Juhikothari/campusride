// src/utils/usn.js
// Universal helper to format student USN — guarantees last 3 digits, never displays "STUDENT" and never falls back to MongoDB _id hex

export function getDisplayUSN(userOrObj, fallback = 'Buddy') {
  if (!userOrObj) return fallback;

  let rawUsn = '';
  if (typeof userOrObj === 'string') {
    rawUsn = userOrObj;
  } else if (typeof userOrObj === 'object') {
    rawUsn = userOrObj.usn ||
             userOrObj.studentUsn ||
             userOrObj.kycDocuments?.usn ||
             userOrObj.providerId?.usn ||
             userOrObj.seekerId?.usn ||
             userOrObj.seeker?.usn ||
             userOrObj.provider?.usn ||
             userOrObj.author?.usn ||
             userOrObj.user?.usn ||
             userOrObj.senderUsn ||
             userOrObj.providerUsn ||
             userOrObj.seekerUsn ||
             '';
  }

  rawUsn = (rawUsn || '').trim();

  // If valid USN provided and not generic placeholder 'STUDENT'
  if (rawUsn && rawUsn.toUpperCase() !== 'STUDENT') {
    const clean = rawUsn.toUpperCase();
    return clean.length > 3 ? clean.slice(-3) : clean;
  }

  return fallback;
}

export default getDisplayUSN;
