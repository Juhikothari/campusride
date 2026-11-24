// backend/utils/vehicle.js
// Normalization and validation for Indian vehicle registration numbers

function normalizeVehicleNumber(raw) {
  if (!raw || typeof raw !== 'string') return '';
  return raw.toUpperCase().replace(/[\s\-_.]/g, '');
}

// Indian vehicle registration format:
// Standard: 2 letters (state) + 1-2 digits (RTO) + optional 0-4 letters + 1-5 digits
// BH series: 2 digits (year) + 'BH' + 4 digits + 1-2 letters
const INDIAN_VEHICLE_REGEX = /^(?:[A-Z]{2}[0-9]{1,2}(?:[A-Z]{1,4})?[0-9]{1,5}|[0-9]{2}BH[0-9]{4}[A-Z]{1,2})$/;

function validateVehicleNumber(raw) {
  const normalized = normalizeVehicleNumber(raw);
  if (!normalized) {
    return { valid: false, reason: 'Vehicle registration number is required', normalized: '' };
  }
  if (!INDIAN_VEHICLE_REGEX.test(normalized)) {
    return {
      valid: false,
      reason: 'Invalid vehicle registration number format. Please enter a valid Indian registration number (e.g. KA01AB1234 or 22BH1234AA).',
      normalized
    };
  }
  return { valid: true, normalized };
}

module.exports = {
  normalizeVehicleNumber,
  validateVehicleNumber,
  INDIAN_VEHICLE_REGEX
};
