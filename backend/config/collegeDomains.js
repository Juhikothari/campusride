/**
 * Mapping of college names to their official email domains.
 * Keep in sync with frontend/src/data/collegeDomains.js
 */
const COLLEGE_DOMAINS = [
  { college: 'IIT Bombay',         domains: ['iitb.ac.in'] },
  { college: 'IIT Delhi',          domains: ['iitd.ac.in'] },
  { college: 'IIT Madras',         domains: ['smail.iitm.ac.in', 'iitm.ac.in'] },
  { college: 'IIT Kanpur',         domains: ['iitk.ac.in'] },
  { college: 'IIT Kharagpur',      domains: ['iitkgp.ac.in', 'kgpian.iitkgp.ac.in'] },
  { college: 'IIT Roorkee',        domains: ['iitr.ac.in'] },
  { college: 'IIT Hyderabad',      domains: ['iith.ac.in'] },
  { college: 'IIT Gandhinagar',    domains: ['iitgn.ac.in'] },
  { college: 'IIT Guwahati',       domains: ['iitg.ac.in'] },
  { college: 'BITS Pilani',        domains: ['pilani.bits-pilani.ac.in', 'bits-pilani.ac.in'] },
  { college: 'BITS Goa',           domains: ['goa.bits-pilani.ac.in'] },
  { college: 'BITS Hyderabad',     domains: ['hyderabad.bits-pilani.ac.in'] },
  { college: 'NIT Trichy',         domains: ['nitt.edu'] },
  { college: 'NIT Warangal',       domains: ['nitw.ac.in'] },
  { college: 'NIT Surathkal',      domains: ['nitk.ac.in'] },
  { college: 'NIT Surat',          domains: ['svnit.ac.in'] },
  { college: 'NIT Calicut',        domains: ['nitc.ac.in'] },
  { college: 'VIT Vellore',        domains: ['vit.ac.in'] },
  { college: 'VIT Chennai',        domains: ['vit.ac.in'] },
  { college: 'SRM University',     domains: ['srmist.edu.in', 'srm.edu.in'] },
  { college: 'Manipal Institute',  domains: ['learner.manipal.edu', 'manipal.edu'] },
  { college: 'IIIT Hyderabad',     domains: ['students.iiit.ac.in', 'iiit.ac.in'] },
  { college: 'IIIT Bangalore',     domains: ['iiitb.ac.in'] },
  { college: 'IIIT Delhi',         domains: ['iiitd.ac.in'] },
  { college: 'Anna University',    domains: ['annauniv.edu'] },
  { college: 'Jadavpur University',domains: ['jadavpuruniversity.in'] },
  { college: 'Delhi University',   domains: ['du.ac.in'] },
  { college: 'Mumbai University',  domains: ['mu.ac.in'] },
  { college: 'Pune University',    domains: ['unipune.ac.in'] },
  { college: 'Amity University',   domains: ['amity.edu'] },
  { college: 'Thapar University',  domains: ['thapar.edu'] },
  { college: 'PSG Tech',           domains: ['psgtech.ac.in'] },
  { college: 'Coimbatore Institute of Technology', domains: ['cit.edu.in'] },
];

const GENERIC_DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'rediffmail.com'];

function getDomainsForCollege(collegeName) {
  if (!collegeName) return [];
  const lower = collegeName.trim().toLowerCase();
  const match = COLLEGE_DOMAINS.find(c =>
    c.college.toLowerCase().includes(lower) || lower.includes(c.college.toLowerCase())
  );
  return match ? match.domains : [];
}

/**
 * Returns { valid: boolean, message: string }
 * Admin role bypasses domain check entirely.
 */
function validateCollegeEmail(email, collegeName, role) {
  if (role === 'admin') return { valid: true, message: '' };
  if (!email || !collegeName) return { valid: false, message: 'Email and college are required' };

  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return { valid: false, message: 'Invalid email address' };

  const allowedDomains = getDomainsForCollege(collegeName);

  if (allowedDomains.length === 0) {
    // College not in list — block obvious personal emails
    if (GENERIC_DOMAINS.includes(domain)) {
      return {
        valid: false,
        message: `Personal email addresses (${domain}) are not allowed. Use your official college email.`
      };
    }
    return { valid: true, message: '' };
  }

  const isValid = allowedDomains.includes(domain);
  return {
    valid: isValid,
    message: isValid ? '' : `Email must end with @${allowedDomains[0]} for ${collegeName} students`
  };
}

module.exports = { validateCollegeEmail, getDomainsForCollege };
