// backend/colleges/colleges.routes.js
const express = require('express');
const router  = express.Router();

const COLLEGES = [
  // Karnataka (Bangalore & others)
  { name: 'RNS Institute of Technology (RNSIT)', short: 'RNSIT', city: 'Bengaluru' },
  { name: 'RV College of Engineering (RVCE)', short: 'RVCE', city: 'Bengaluru' },
  { name: 'BMS College of Engineering (BMSCE)', short: 'BMSCE', city: 'Bengaluru' },
  { name: 'BMS Institute of Technology (BMSIT)', short: 'BMSIT', city: 'Bengaluru' },
  { name: 'PES University (RR Campus)', short: 'PESU', city: 'Bengaluru' },
  { name: 'PES University (Electronic City)', short: 'PES EC', city: 'Bengaluru' },
  { name: 'MS Ramaiah Institute of Technology (MSRIT)', short: 'MSRIT', city: 'Bengaluru' },
  { name: 'Dayananda Sagar College of Engineering (DSCE)', short: 'DSCE', city: 'Bengaluru' },
  { name: 'Dayananda Sagar University (DSU)', short: 'DSU', city: 'Bengaluru' },
  { name: 'Bangalore Institute of Technology (BIT)', short: 'BIT', city: 'Bengaluru' },
  { name: 'Sir M. Visvesvaraya Institute of Technology (SMVIT)', short: 'SMVIT', city: 'Bengaluru' },
  { name: 'New Horizon College of Engineering (NHCE)', short: 'NHCE', city: 'Bengaluru' },
  { name: 'CMR Institute of Technology (CMRIT)', short: 'CMRIT', city: 'Bengaluru' },
  { name: 'CMR University', short: 'CMRU', city: 'Bengaluru' },
  { name: 'Jain University', short: 'JU', city: 'Bengaluru' },
  { name: 'Christ University (Central Campus)', short: 'Christ', city: 'Bengaluru' },
  { name: 'Christ University (Bannerghatta / Kengeri)', short: 'Christ', city: 'Bengaluru' },
  { name: 'Nitte Meenakshi Institute of Technology (NMIT)', short: 'NMIT', city: 'Bengaluru' },
  { name: 'Reva University', short: 'REVA', city: 'Bengaluru' },
  { name: 'Oxford College of Engineering', short: 'Oxford', city: 'Bengaluru' },
  { name: 'East West Institute of Technology', short: 'EWIT', city: 'Bengaluru' },
  { name: 'Dr. Ambedkar Institute of Technology', short: 'AIT', city: 'Bengaluru' },
  { name: 'IIIT Bangalore', short: 'IIIT-B', city: 'Bengaluru' },
  { name: 'Indian Institute of Science (IISc)', short: 'IISc', city: 'Bengaluru' },
  { name: 'National Institute of Technology Karnataka (NITK)', short: 'NITK', city: 'Surathkal' },
  { name: 'Manipal Institute of Technology (MIT)', short: 'MIT', city: 'Manipal' },
  { name: 'Siddaganga Institute of Technology (SIT)', short: 'SIT', city: 'Tumkur' },
  { name: 'National Institute of Engineering (NIE)', short: 'NIE', city: 'Mysuru' },
  { name: 'SJCE / JSS Science & Technology University', short: 'SJCE', city: 'Mysuru' },
  { name: 'KLE Technological University', short: 'KLE Tech', city: 'Hubli' },

  // Premier National Institutes
  { name: 'IIT Bombay', short: 'IITB', city: 'Mumbai' },
  { name: 'IIT Delhi', short: 'IITD', city: 'New Delhi' },
  { name: 'IIT Madras', short: 'IITM', city: 'Chennai' },
  { name: 'IIT Kanpur', short: 'IITK', city: 'Kanpur' },
  { name: 'IIT Kharagpur', short: 'IITKGP', city: 'Kharagpur' },
  { name: 'IIT Roorkee', short: 'IITR', city: 'Roorkee' },
  { name: 'IIT Guwahati', short: 'IITG', city: 'Guwahati' },
  { name: 'IIT Hyderabad', short: 'IITH', city: 'Hyderabad' },
  { name: 'IIT Gandhinagar', short: 'IITGN', city: 'Gandhinagar' },
  { name: 'IIT Indore', short: 'IITI', city: 'Indore' },
  { name: 'IIT BHU (Varanasi)', short: 'IIT-BHU', city: 'Varanasi' },
  { name: 'BITS Pilani (Pilani Campus)', short: 'BITS', city: 'Pilani' },
  { name: 'BITS Pilani (Goa Campus)', short: 'BITS Goa', city: 'Goa' },
  { name: 'BITS Pilani (Hyderabad Campus)', short: 'BITS Hyd', city: 'Hyderabad' },
  { name: 'NIT Trichy', short: 'NITT', city: 'Tiruchirappalli' },
  { name: 'NIT Warangal', short: 'NITW', city: 'Warangal' },
  { name: 'NIT Calicut', short: 'NITC', city: 'Calicut' },
  { name: 'NIT Rourkela', short: 'NITR', city: 'Rourkela' },
  { name: 'NIT Kurukshetra', short: 'NITKKR', city: 'Kurukshetra' },
  { name: 'NIT Durgapur', short: 'NITDGP', city: 'Durgapur' },
  { name: 'SVNIT Surat', short: 'SVNIT', city: 'Surat' },
  { name: 'VNIT Nagpur', short: 'VNIT', city: 'Nagpur' },
  { name: 'MNIT Jaipur', short: 'MNIT', city: 'Jaipur' },
  { name: 'IIIT Hyderabad', short: 'IIIT-H', city: 'Hyderabad' },
  { name: 'IIIT Delhi', short: 'IIIT-D', city: 'New Delhi' },
  { name: 'IIIT Allahabad', short: 'IIITA', city: 'Prayagraj' },

  // Tamil Nadu & Chennai
  { name: 'VIT Vellore', short: 'VIT', city: 'Vellore' },
  { name: 'VIT Chennai', short: 'VIT-C', city: 'Chennai' },
  { name: 'SRM Institute of Science and Technology (KTR)', short: 'SRM', city: 'Chennai' },
  { name: 'SSN College of Engineering', short: 'SSN', city: 'Chennai' },
  { name: 'Anna University (CEG Campus)', short: 'CEG', city: 'Chennai' },
  { name: 'PSG College of Technology', short: 'PSG Tech', city: 'Coimbatore' },
  { name: 'Coimbatore Institute of Technology (CIT)', short: 'CIT', city: 'Coimbatore' },
  { name: 'SASTRA Deemed University', short: 'SASTRA', city: 'Thanjavur' },
  { name: 'Amrita Vishwa Vidyapeetham', short: 'Amrita', city: 'Coimbatore' },

  // Maharashtra
  { name: 'College of Engineering Pune (COEP)', short: 'COEP', city: 'Pune' },
  { name: 'VJTI Mumbai', short: 'VJTI', city: 'Mumbai' },
  { name: 'MIT World Peace University (MIT-WPU)', short: 'MIT-WPU', city: 'Pune' },
  { name: 'Symbiosis International University', short: 'SIU', city: 'Pune' },
  { name: 'Pune Institute of Computer Technology (PICT)', short: 'PICT', city: 'Pune' },

  // Delhi NCR & North
  { name: 'Delhi Technological University (DTU)', short: 'DTU', city: 'New Delhi' },
  { name: 'Netaji Subhas University of Technology (NSUT)', short: 'NSUT', city: 'New Delhi' },
  { name: 'Thapar Institute of Engineering and Technology', short: 'TIET', city: 'Patiala' },
  { name: 'Amity University Noida', short: 'Amity', city: 'Noida' },
  { name: 'Shiv Nadar University', short: 'SNU', city: 'Greater Noida' },

  // Hyderabad & Telangana
  { name: 'CBIT Hyderabad', short: 'CBIT', city: 'Hyderabad' },
  { name: 'VNR Vignana Jyothi Institute of Engineering', short: 'VNRVJIET', city: 'Hyderabad' },
  { name: 'JNTU Hyderabad', short: 'JNTUH', city: 'Hyderabad' },
  { name: 'Osmania University College of Engineering', short: 'OUCE', city: 'Hyderabad' },

  // Kerala
  { name: 'College of Engineering Trivandrum (CET)', short: 'CET', city: 'Thiruvananthapuram' },
  { name: 'Government Model Engineering College (MEC)', short: 'MEC', city: 'Kochi' },
  { name: 'CUSAT (Cochin University)', short: 'CUSAT', city: 'Kochi' },

  // East & Other Regions
  { name: 'Jadavpur University', short: 'JU-Kol', city: 'Kolkata' },
  { name: 'IIEST Shibpur', short: 'IIEST', city: 'Howrah' },
  { name: 'KIIT University', short: 'KIIT', city: 'Bhubaneswar' },
  { name: 'ITER / Siksha O Anusandhan', short: 'ITER', city: 'Bhubaneswar' },
];

router.get('/', (req, res) => {
  const query = (req.query.search || req.query.q || '').trim().toLowerCase();
  const city  = (req.query.city || '').trim().toLowerCase();

  let results = COLLEGES;

  if (city) {
    results = results.filter(c => c.city.toLowerCase() === city);
  }

  if (query) {
    results = results.filter(c =>
      c.name.toLowerCase().includes(query) ||
      c.short.toLowerCase().includes(query) ||
      c.city.toLowerCase().includes(query)
    );
  }

  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 200);

  return res.json({
    success: true,
    total: results.length,
    colleges: results.slice(0, limit),
  });
});

module.exports = router;
