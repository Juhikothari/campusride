// backend/colleges/colleges.routes.js
const express = require('express');
const router = express.Router();

const COLLEGES = [
  {
    "name": "Other",
    "short": "OTHER",
    "city": "Other College",
    "isOther": true
  },
  {
    "name": "RNS Institute of Technology (RNSIT)",
    "short": "RNSIT",
    "city": "Bengaluru"
  },
  {
    "name": "RV College of Engineering (RVCE)",
    "short": "RVCE",
    "city": "Bengaluru"
  },
  {
    "name": "BMS College of Engineering (BMSCE)",
    "short": "BMSCE",
    "city": "Bengaluru"
  },
  {
    "name": "BMS Institute of Technology (BMSIT)",
    "short": "BMSIT",
    "city": "Bengaluru"
  },
  {
    "name": "PES University (RR Campus)",
    "short": "PESU",
    "city": "Bengaluru"
  },
  {
    "name": "PES University (Electronic City Campus)",
    "short": "PES EC",
    "city": "Bengaluru"
  },
  {
    "name": "Ramaiah Institute of Technology (MSRIT)",
    "short": "MSRIT",
    "city": "Bengaluru"
  },
  {
    "name": "Dayananda Sagar College of Engineering (DSCE)",
    "short": "DSCE",
    "city": "Bengaluru"
  },
  {
    "name": "Dayananda Sagar University (DSU Harohalli/Kanakapura)",
    "short": "DSU",
    "city": "Bengaluru"
  },
  {
    "name": "Dayananda Sagar Academy of Technology & Management (DSATM)",
    "short": "DSATM",
    "city": "Bengaluru"
  },
  {
    "name": "Bangalore Institute of Technology (BIT)",
    "short": "BIT",
    "city": "Bengaluru"
  },
  {
    "name": "New Horizon College of Engineering (NHCE)",
    "short": "NHCE",
    "city": "Bengaluru"
  },
  {
    "name": "CMR Institute of Technology (CMRIT)",
    "short": "CMRIT",
    "city": "Bengaluru"
  },
  {
    "name": "CMR University (CMRU)",
    "short": "CMRU",
    "city": "Bengaluru"
  },
  {
    "name": "Nitte Meenakshi Institute of Technology (NMIT)",
    "short": "NMIT",
    "city": "Bengaluru"
  },
  {
    "name": "Sir M. Visvesvaraya Institute of Technology (Sir MVIT)",
    "short": "SMVIT",
    "city": "Bengaluru"
  },
  {
    "name": "The Oxford College of Engineering (TOCE)",
    "short": "TOCE",
    "city": "Bengaluru"
  },
  {
    "name": "The Oxford College of Science & Arts",
    "short": "TOCS",
    "city": "Bengaluru"
  },
  {
    "name": "Acharya Institute of Technology (AIT)",
    "short": "AIT",
    "city": "Bengaluru"
  },
  {
    "name": "Dr. Ambedkar Institute of Technology (Dr. AIT)",
    "short": "Dr. AIT",
    "city": "Bengaluru"
  },
  {
    "name": "JSS Academy of Technical Education (JSSATE)",
    "short": "JSSATE",
    "city": "Bengaluru"
  },
  {
    "name": "Reva University (REVA)",
    "short": "REVA",
    "city": "Bengaluru"
  },
  {
    "name": "Presidency University (PU Bengaluru)",
    "short": "Presidency",
    "city": "Bengaluru"
  },
  {
    "name": "Christ University (Central Campus, Hosur Road)",
    "short": "Christ",
    "city": "Bengaluru"
  },
  {
    "name": "Christ University (Kengeri Campus)",
    "short": "Christ Kengeri",
    "city": "Bengaluru"
  },
  {
    "name": "Christ University (Yeshwanthpur Campus)",
    "short": "Christ YPR",
    "city": "Bengaluru"
  },
  {
    "name": "Christ University (Bannerghatta Road Campus)",
    "short": "Christ BGR",
    "city": "Bengaluru"
  },
  {
    "name": "Jain University (CMS Lalbagh Road)",
    "short": "Jain CMS",
    "city": "Bengaluru"
  },
  {
    "name": "Jain University (Faculty of Engg & Tech, JGI Global Campus)",
    "short": "Jain FET",
    "city": "Bengaluru"
  },
  {
    "name": "Alliance University (Anekal/Chandapura)",
    "short": "Alliance",
    "city": "Bengaluru"
  },
  {
    "name": "MVJ College of Engineering (MVJCE Whitefield)",
    "short": "MVJCE",
    "city": "Bengaluru"
  },
  {
    "name": "East Point College of Engineering and Technology (EPCET)",
    "short": "East Point",
    "city": "Bengaluru"
  },
  {
    "name": "Cambridge Institute of Technology (CIT KR Puram)",
    "short": "CIT",
    "city": "Bengaluru"
  },
  {
    "name": "Don Bosco Institute of Technology (DBIT Kumbalgodu)",
    "short": "DBIT",
    "city": "Bengaluru"
  },
  {
    "name": "K.S. Institute of Technology (KSIT Kanakapura Rd)",
    "short": "KSIT",
    "city": "Bengaluru"
  },
  {
    "name": "K.S. School of Engineering and Management (KSSEM)",
    "short": "KSSEM",
    "city": "Bengaluru"
  },
  {
    "name": "SJB Institute of Technology (SJBIT Kengeri)",
    "short": "SJBIT",
    "city": "Bengaluru"
  },
  {
    "name": "Global Academy of Technology (GAT Rajarajeshwari Nagar)",
    "short": "GAT",
    "city": "Bengaluru"
  },
  {
    "name": "Atria Institute of Technology (AIT Hebbal)",
    "short": "Atria",
    "city": "Bengaluru"
  },
  {
    "name": "Gopalan College of Engineering and Management (GCEM)",
    "short": "GCEM",
    "city": "Bengaluru"
  },
  {
    "name": "HKBK College of Engineering (Nagawara)",
    "short": "HKBK",
    "city": "Bengaluru"
  },
  {
    "name": "Vemana Institute of Technology (Koramangala)",
    "short": "Vemana",
    "city": "Bengaluru"
  },
  {
    "name": "University Visvesvaraya College of Engineering (UVCE KR Circle)",
    "short": "UVCE",
    "city": "Bengaluru"
  },
  {
    "name": "Indian Institute of Science (IISc Bengaluru)",
    "short": "IISc",
    "city": "Bengaluru"
  },
  {
    "name": "International Institute of Information Technology (IIIT Bangalore)",
    "short": "IIIT-B",
    "city": "Bengaluru"
  },
  {
    "name": "Indian Institute of Management Bangalore (IIMB Bannerghatta)",
    "short": "IIM-B",
    "city": "Bengaluru"
  },
  {
    "name": "National Law School of India University (NLSIU Nagarbhavi)",
    "short": "NLSIU",
    "city": "Bengaluru"
  },
  {
    "name": "Bangalore Medical College and Research Institute (BMCRI)",
    "short": "BMCRI",
    "city": "Bengaluru"
  },
  {
    "name": "Kempegowda Institute of Medical Sciences (KIMS VV Puram/Banashankari)",
    "short": "KIMS",
    "city": "Bengaluru"
  },
  {
    "name": "St. John’s Medical College (Koramangala)",
    "short": "St. Johns",
    "city": "Bengaluru"
  },
  {
    "name": "MS Ramaiah Medical College (MSRMC MSR Nagar)",
    "short": "MSRMC",
    "city": "Bengaluru"
  },
  {
    "name": "Vydehi Institute of Medical Sciences and Research Centre (Whitefield)",
    "short": "VIMS",
    "city": "Bengaluru"
  },
  {
    "name": "RajaRajeswari Medical College and Hospital (RRMCH Mysore Road)",
    "short": "RRMCH",
    "city": "Bengaluru"
  },
  {
    "name": "Dr. B.R. Ambedkar Medical College (Kadugondanahalli)",
    "short": "BRAMC",
    "city": "Bengaluru"
  },
  {
    "name": "Sapthagiri Institute of Medical Sciences (Hessarghatta Rd)",
    "short": "SIMS",
    "city": "Bengaluru"
  },
  {
    "name": "Bowring and Lady Curzon Medical College (Shivajinagar)",
    "short": "BLCMC",
    "city": "Bengaluru"
  },
  {
    "name": "St. Joseph’s College of Commerce (SJCC Brigade Road)",
    "short": "SJCC",
    "city": "Bengaluru"
  },
  {
    "name": "St. Joseph’s University (Langford Road)",
    "short": "SJU",
    "city": "Bengaluru"
  },
  {
    "name": "Mount Carmel College (MCC Vasanth Nagar)",
    "short": "MCC",
    "city": "Bengaluru"
  },
  {
    "name": "Kristu Jayanti College (KJC Kothanur)",
    "short": "KJC",
    "city": "Bengaluru"
  },
  {
    "name": "Jyoti Nivas College (JNC Koramangala)",
    "short": "JNC",
    "city": "Bengaluru"
  },
  {
    "name": "MES College of Arts, Commerce and Science (Malleshwaram)",
    "short": "MES",
    "city": "Bengaluru"
  },
  {
    "name": "Vijaya College (RV Road / Basavanagudi)",
    "short": "Vijaya",
    "city": "Bengaluru"
  },
  {
    "name": "National College (Basavanagudi)",
    "short": "NCB",
    "city": "Bengaluru"
  },
  {
    "name": "National College (Jayanagar)",
    "short": "NCJ",
    "city": "Bengaluru"
  },
  {
    "name": "BMS College of Law (Basavanagudi)",
    "short": "BMS Law",
    "city": "Bengaluru"
  },
  {
    "name": "KLE Law Academy / S. Nijalingappa College (Rajajinagar)",
    "short": "KLE Law",
    "city": "Bengaluru"
  },
  {
    "name": "BMS College of Architecture (BMSCA)",
    "short": "BMSCA",
    "city": "Bengaluru"
  },
  {
    "name": "Dayananda Sagar College of Arts, Science and Commerce",
    "short": "DSCASC",
    "city": "Bengaluru"
  },
  {
    "name": "Govt SKSJTI (KR Circle)",
    "short": "SKSJTI",
    "city": "Bengaluru"
  },
  {
    "name": "Govt Engineering College Ramanagara",
    "short": "GEC Ramanagara",
    "city": "Ramanagara"
  },
  {
    "name": "Sri Jayachamarajendra College of Engineering (SJCE JSS STU)",
    "short": "SJCE",
    "city": "Mysuru"
  },
  {
    "name": "The National Institute of Engineering (NIE Mysuru)",
    "short": "NIE",
    "city": "Mysuru"
  },
  {
    "name": "Vidyavardhaka College of Engineering (VVCE Mysuru)",
    "short": "VVCE",
    "city": "Mysuru"
  },
  {
    "name": "GSSS Institute of Engineering and Technology for Women (GSSSIETW)",
    "short": "GSSS",
    "city": "Mysuru"
  },
  {
    "name": "Mysore Medical College and Research Institute (MMCRI)",
    "short": "MMCRI",
    "city": "Mysuru"
  },
  {
    "name": "JSS Medical College (JSS AHER)",
    "short": "JSSMC",
    "city": "Mysuru"
  },
  {
    "name": "University of Mysore (Manasagangotri)",
    "short": "UoM",
    "city": "Mysuru"
  },
  {
    "name": "National Institute of Technology Karnataka (NITK Surathkal)",
    "short": "NITK",
    "city": "Mangaluru"
  },
  {
    "name": "Manipal Institute of Technology (MIT Manipal)",
    "short": "MIT Manipal",
    "city": "Manipal"
  },
  {
    "name": "Kasturba Medical College Manipal (KMC Manipal)",
    "short": "KMC Manipal",
    "city": "Manipal"
  },
  {
    "name": "Kasturba Medical College Mangalore (KMC Mangaluru)",
    "short": "KMC MNG",
    "city": "Mangaluru"
  },
  {
    "name": "St. Joseph Engineering College (SJEC Vamanjoor)",
    "short": "SJEC",
    "city": "Mangaluru"
  },
  {
    "name": "NMAM Institute of Technology (Nitte Nitte)",
    "short": "NMAMIT",
    "city": "Karkala"
  },
  {
    "name": "Sahyadri College of Engineering and Management (Adyar)",
    "short": "Sahyadri",
    "city": "Mangaluru"
  },
  {
    "name": "Canara Engineering College (Benjanapadavu)",
    "short": "CEC",
    "city": "Mangaluru"
  },
  {
    "name": "Father Muller Medical College (Kankanady)",
    "short": "FMMC",
    "city": "Mangaluru"
  },
  {
    "name": "K.S. Hegde Medical Academy (KSHEMA Deralakatte)",
    "short": "KSHEMA",
    "city": "Mangaluru"
  },
  {
    "name": "Yenepoya University (Deralakatte)",
    "short": "Yenepoya",
    "city": "Mangaluru"
  },
  {
    "name": "Alva’s Institute of Engineering & Technology (Moodbidri)",
    "short": "AIET",
    "city": "Moodbidri"
  },
  {
    "name": "St. Aloysius College (Autonomous)",
    "short": "Aloysius",
    "city": "Mangaluru"
  },
  {
    "name": "KLE Technological University (B.V. Bhoomaraddi College Hubballi)",
    "short": "KLE Tech",
    "city": "Hubballi"
  },
  {
    "name": "SDM College of Engineering and Technology (Dharwad)",
    "short": "SDMCET",
    "city": "Dharwad"
  },
  {
    "name": "Indian Institute of Technology Dharwad (IIT Dharwad)",
    "short": "IIT Dharwad",
    "city": "Dharwad"
  },
  {
    "name": "Indian Institute of Information Technology Dharwad (IIIT Dharwad)",
    "short": "IIIT Dharwad",
    "city": "Dharwad"
  },
  {
    "name": "Karnatak University Dharwad",
    "short": "KUD",
    "city": "Dharwad"
  },
  {
    "name": "Karnataka Institute of Medical Sciences (KIMS Hubballi)",
    "short": "KIMS Hubli",
    "city": "Hubballi"
  },
  {
    "name": "SDM College of Medical Sciences (Dharwad)",
    "short": "SDMMC",
    "city": "Dharwad"
  },
  {
    "name": "Basaveshwar Engineering College (BEC Bagalkot)",
    "short": "BEC",
    "city": "Bagalkot"
  },
  {
    "name": "Poojya Doddappa Appa College of Engineering (PDA Kalaburagi)",
    "short": "PDACE",
    "city": "Kalaburagi"
  },
  {
    "name": "BLDEA’s V.P. Dr. P.G. Halakatti College of Engineering (Vijayapura)",
    "short": "BLDEA",
    "city": "Vijayapura"
  },
  {
    "name": "Siddaganga Institute of Technology (SIT Tumakuru)",
    "short": "SIT",
    "city": "Tumakuru"
  },
  {
    "name": "Sri Siddhartha Institute of Technology (SSIT Tumakuru)",
    "short": "SSIT",
    "city": "Tumakuru"
  },
  {
    "name": "Bapuji Institute of Engineering and Technology (BIET Davanagere)",
    "short": "BIET",
    "city": "Davanagere"
  },
  {
    "name": "JJM Medical College (JJMMC Davanagere)",
    "short": "JJMMC",
    "city": "Davanagere"
  },
  {
    "name": "Malnad College of Engineering (MCE Hassan)",
    "short": "MCE",
    "city": "Hassan"
  },
  {
    "name": "Jawaharlal Nehru National College of Engineering (JNNCE Shivamogga)",
    "short": "JNNCE",
    "city": "Shivamogga"
  },
  {
    "name": "Indian Institute of Technology Bombay (IIT Bombay)",
    "short": "IIT-B",
    "city": "Mumbai"
  },
  {
    "name": "Indian Institute of Technology Delhi (IIT Delhi)",
    "short": "IIT-D",
    "city": "New Delhi"
  },
  {
    "name": "Indian Institute of Technology Madras (IIT Madras)",
    "short": "IIT-M",
    "city": "Chennai"
  },
  {
    "name": "Indian Institute of Technology Kanpur (IIT Kanpur)",
    "short": "IIT-K",
    "city": "Kanpur"
  },
  {
    "name": "Indian Institute of Technology Kharagpur (IIT Kharagpur)",
    "short": "IIT-KGP",
    "city": "Kharagpur"
  },
  {
    "name": "Indian Institute of Technology Roorkee (IIT Roorkee)",
    "short": "IIT-R",
    "city": "Roorkee"
  },
  {
    "name": "Indian Institute of Technology Guwahati (IIT Guwahati)",
    "short": "IIT-G",
    "city": "Guwahati"
  },
  {
    "name": "Indian Institute of Technology Hyderabad (IIT Hyderabad)",
    "short": "IIT-H",
    "city": "Hyderabad"
  },
  {
    "name": "Indian Institute of Technology (BHU) Varanasi",
    "short": "IIT-BHU",
    "city": "Varanasi"
  },
  {
    "name": "Indian Institute of Technology (Indian School of Mines) Dhanbad",
    "short": "IIT-ISM",
    "city": "Dhanbad"
  },
  {
    "name": "Indian Institute of Technology Indore (IIT Indore)",
    "short": "IIT Indore",
    "city": "Indore"
  },
  {
    "name": "Indian Institute of Technology Gandhinagar (IIT Gandhinagar)",
    "short": "IIT Gandhinagar",
    "city": "Gandhinagar"
  },
  {
    "name": "Indian Institute of Technology Ropar (IIT Ropar)",
    "short": "IIT Ropar",
    "city": "Rupnagar"
  },
  {
    "name": "Indian Institute of Technology Patna (IIT Patna)",
    "short": "IIT Patna",
    "city": "Patna"
  },
  {
    "name": "Indian Institute of Technology Bhubaneswar (IIT Bhubaneswar)",
    "short": "IIT BBS",
    "city": "Bhubaneswar"
  },
  {
    "name": "Indian Institute of Technology Mandi (IIT Mandi)",
    "short": "IIT Mandi",
    "city": "Mandi"
  },
  {
    "name": "Indian Institute of Technology Jodhpur (IIT Jodhpur)",
    "short": "IIT Jodhpur",
    "city": "Jodhpur"
  },
  {
    "name": "Indian Institute of Technology Tirupati (IIT Tirupati)",
    "short": "IIT Tirupati",
    "city": "Tirupati"
  },
  {
    "name": "Indian Institute of Technology Palakkad (IIT Palakkad)",
    "short": "IIT Palakkad",
    "city": "Palakkad"
  },
  {
    "name": "Indian Institute of Technology Goa (IIT Goa)",
    "short": "IIT Goa",
    "city": "Ponda"
  },
  {
    "name": "Indian Institute of Technology Bhilai (IIT Bhilai)",
    "short": "IIT Bhilai",
    "city": "Bhilai"
  },
  {
    "name": "Indian Institute of Technology Jammu (IIT Jammu)",
    "short": "IIT Jammu",
    "city": "Jammu"
  },
  {
    "name": "National Institute of Technology Tiruchirappalli (NIT Trichy)",
    "short": "NITT",
    "city": "Tiruchirappalli"
  },
  {
    "name": "National Institute of Technology Warangal (NIT Warangal)",
    "short": "NITW",
    "city": "Warangal"
  },
  {
    "name": "National Institute of Technology Rourkela (NIT Rourkela)",
    "short": "NITR",
    "city": "Rourkela"
  },
  {
    "name": "National Institute of Technology Calicut (NIT Calicut)",
    "short": "NITC",
    "city": "Kozhikode"
  },
  {
    "name": "Visvesvaraya National Institute of Technology (VNIT Nagpur)",
    "short": "VNIT",
    "city": "Nagpur"
  },
  {
    "name": "Malaviya National Institute of Technology (MNIT Jaipur)",
    "short": "MNIT",
    "city": "Jaipur"
  },
  {
    "name": "Motilal Nehru National Institute of Technology (MNNIT Allahabad)",
    "short": "MNNIT",
    "city": "Prayagraj"
  },
  {
    "name": "National Institute of Technology Kurukshetra (NIT Kurukshetra)",
    "short": "NITKKR",
    "city": "Kurukshetra"
  },
  {
    "name": "National Institute of Technology Durgapur (NIT Durgapur)",
    "short": "NITDGP",
    "city": "Durgapur"
  },
  {
    "name": "National Institute of Technology Silchar (NIT Silchar)",
    "short": "NITS",
    "city": "Silchar"
  },
  {
    "name": "National Institute of Technology Hamirpur (NIT Hamirpur)",
    "short": "NITH",
    "city": "Hamirpur"
  },
  {
    "name": "Dr. B. R. Ambedkar National Institute of Technology (NIT Jalandhar)",
    "short": "NITJ",
    "city": "Jalandhar"
  },
  {
    "name": "National Institute of Technology Meghalaya (NIT Meghalaya)",
    "short": "NITM",
    "city": "Shillong"
  },
  {
    "name": "National Institute of Technology Patna (NIT Patna)",
    "short": "NITP",
    "city": "Patna"
  },
  {
    "name": "National Institute of Technology Raipur (NIT Raipur)",
    "short": "NITRR",
    "city": "Raipur"
  },
  {
    "name": "National Institute of Technology Srinagar (NIT Srinagar)",
    "short": "NITSRI",
    "city": "Srinagar"
  },
  {
    "name": "National Institute of Technology Agartala (NIT Agartala)",
    "short": "NITA",
    "city": "Agartala"
  },
  {
    "name": "National Institute of Technology Goa (NIT Goa)",
    "short": "NITG",
    "city": "Farmagudi"
  },
  {
    "name": "National Institute of Technology Jamshedpur (NIT Jamshedpur)",
    "short": "NITJSR",
    "city": "Jamshedpur"
  },
  {
    "name": "National Institute of Technology Manipur (NIT Manipur)",
    "short": "NITMN",
    "city": "Imphal"
  },
  {
    "name": "National Institute of Technology Mizoram (NIT Mizoram)",
    "short": "NITMZ",
    "city": "Aizawl"
  },
  {
    "name": "National Institute of Technology Nagaland (NIT Nagaland)",
    "short": "NITN",
    "city": "Dimapur"
  },
  {
    "name": "National Institute of Technology Puducherry (NIT Puducherry)",
    "short": "NITPY",
    "city": "Karaikal"
  },
  {
    "name": "National Institute of Technology Sikkim (NIT Sikkim)",
    "short": "NITSKM",
    "city": "Ravangla"
  },
  {
    "name": "National Institute of Technology Arunachal Pradesh (NIT AP)",
    "short": "NITAP",
    "city": "Yupia"
  },
  {
    "name": "National Institute of Technology Uttarakhand (NIT UK)",
    "short": "NITUK",
    "city": "Srinagar Garhwal"
  },
  {
    "name": "National Institute of Technology Andhra Pradesh (NIT Tadepalligudem)",
    "short": "NITANP",
    "city": "Tadepalligudem"
  },
  {
    "name": "Indian Institute of Engineering Science and Technology (IIEST Shibpur)",
    "short": "IIEST",
    "city": "Howrah"
  },
  {
    "name": "International Institute of Information Technology Hyderabad (IIIT Hyderabad)",
    "short": "IIIT-H",
    "city": "Hyderabad"
  },
  {
    "name": "Indraprastha Institute of Information Technology Delhi (IIIT Delhi)",
    "short": "IIIT-D",
    "city": "New Delhi"
  },
  {
    "name": "Indian Institute of Information Technology Allahabad (IIIT Allahabad)",
    "short": "IIIT-A",
    "city": "Prayagraj"
  },
  {
    "name": "Indian Institute of Information Technology Lucknow (IIIT Lucknow)",
    "short": "IIITL",
    "city": "Lucknow"
  },
  {
    "name": "Indian Institute of Information Technology Gwalior (ABV-IIITM Gwalior)",
    "short": "IIITM",
    "city": "Gwalior"
  },
  {
    "name": "Indian Institute of Information Technology Jabalpur (PDPM IIITDM)",
    "short": "IIITDMJ",
    "city": "Jabalpur"
  },
  {
    "name": "Indian Institute of Information Technology Kancheepuram (IIITDM)",
    "short": "IIITDM",
    "city": "Chennai"
  },
  {
    "name": "Indian Institute of Information Technology Pune (IIIT Pune)",
    "short": "IIIT Pune",
    "city": "Pune"
  },
  {
    "name": "Indian Institute of Information Technology Sri City (IIIT Sri City)",
    "short": "IIIT Sricity",
    "city": "Chittoor"
  },
  {
    "name": "BITS Pilani (Pilani Campus)",
    "short": "BITS Pilani",
    "city": "Pilani"
  },
  {
    "name": "BITS Pilani (Goa Campus)",
    "short": "BITS Goa",
    "city": "Goa"
  },
  {
    "name": "BITS Pilani (Hyderabad Campus)",
    "short": "BITS Hyd",
    "city": "Hyderabad"
  },
  {
    "name": "College of Engineering, Guindy (CEG Anna University)",
    "short": "CEG",
    "city": "Chennai"
  },
  {
    "name": "Madras Institute of Technology (MIT Chromepet)",
    "short": "MIT Chennai",
    "city": "Chennai"
  },
  {
    "name": "Vellore Institute of Technology (VIT Vellore)",
    "short": "VIT",
    "city": "Vellore"
  },
  {
    "name": "Vellore Institute of Technology (VIT Chennai)",
    "short": "VIT Chennai",
    "city": "Chennai"
  },
  {
    "name": "SRM Institute of Science and Technology (Kattankulathur)",
    "short": "SRM KTR",
    "city": "Chennai"
  },
  {
    "name": "SRM Institute of Science and Technology (Ramapuram)",
    "short": "SRM RMP",
    "city": "Chennai"
  },
  {
    "name": "PSG College of Technology (PSG Tech)",
    "short": "PSG",
    "city": "Coimbatore"
  },
  {
    "name": "PSG Institute of Technology and Applied Research (PSG iTech)",
    "short": "PSG iTech",
    "city": "Coimbatore"
  },
  {
    "name": "Coimbatore Institute of Technology (CIT Coimbatore)",
    "short": "CIT CBE",
    "city": "Coimbatore"
  },
  {
    "name": "Thiagarajar College of Engineering (TCE Madurai)",
    "short": "TCE",
    "city": "Madurai"
  },
  {
    "name": "SSN College of Engineering (SSNCE Kalavakkam)",
    "short": "SSN",
    "city": "Chennai"
  },
  {
    "name": "SASTRA Deemed University (Tirumalaisamudram)",
    "short": "SASTRA",
    "city": "Thanjavur"
  },
  {
    "name": "Amrita Vishwa Vidyapeetham (Coimbatore Campus)",
    "short": "Amrita CBE",
    "city": "Coimbatore"
  },
  {
    "name": "Amrita Vishwa Vidyapeetham (Bengaluru Campus Kasavanahalli)",
    "short": "Amrita BLR",
    "city": "Bengaluru"
  },
  {
    "name": "Kumaraguru College of Technology (KCT Coimbatore)",
    "short": "KCT",
    "city": "Coimbatore"
  },
  {
    "name": "Government College of Technology (GCT Coimbatore)",
    "short": "GCT",
    "city": "Coimbatore"
  },
  {
    "name": "Sri Krishna College of Engineering and Technology (SKCET)",
    "short": "SKCET",
    "city": "Coimbatore"
  },
  {
    "name": "Bannari Amman Institute of Technology (BIT Sathyamangalam)",
    "short": "BIT Sathy",
    "city": "Sathyamangalam"
  },
  {
    "name": "Sona College of Technology (Salem)",
    "short": "Sona",
    "city": "Salem"
  },
  {
    "name": "Kongu Engineering College (Perundurai)",
    "short": "Kongu",
    "city": "Erode"
  },
  {
    "name": "College of Engineering Pune (COEP Technological University)",
    "short": "COEP",
    "city": "Pune"
  },
  {
    "name": "Veermata Jijabai Technological Institute (VJTI Mumbai)",
    "short": "VJTI",
    "city": "Mumbai"
  },
  {
    "name": "Sardar Patel Institute of Technology (SPIT Andheri)",
    "short": "SPIT",
    "city": "Mumbai"
  },
  {
    "name": "Sardar Patel College of Engineering (SPCE Andheri)",
    "short": "SPCE",
    "city": "Mumbai"
  },
  {
    "name": "Pune Institute of Computer Technology (PICT Dhankawadi)",
    "short": "PICT",
    "city": "Pune"
  },
  {
    "name": "Vishwakarma Institute of Technology (VIT Bibwewadi Pune)",
    "short": "VIT Pune",
    "city": "Pune"
  },
  {
    "name": "Vishwakarma Institute of Information Technology (VIIT Kondhwa Pune)",
    "short": "VIIT Pune",
    "city": "Pune"
  },
  {
    "name": "MIT World Peace University (MIT-WPU Kothrud Pune)",
    "short": "MIT-WPU",
    "city": "Pune"
  },
  {
    "name": "MKSSS’s Cummins College of Engineering for Women (Karvenagar Pune)",
    "short": "Cummins",
    "city": "Pune"
  },
  {
    "name": "D.J. Sanghvi College of Engineering (DJSCE Vile Parle)",
    "short": "DJSCE",
    "city": "Mumbai"
  },
  {
    "name": "Thadomal Shahani Engineering College (TSEC Bandra)",
    "short": "TSEC",
    "city": "Mumbai"
  },
  {
    "name": "K.J. Somaiya College of Engineering (Vidyavihar Mumbai)",
    "short": "KJSCE",
    "city": "Mumbai"
  },
  {
    "name": "Walchand College of Engineering (WCE Sangli)",
    "short": "WCE",
    "city": "Sangli"
  },
  {
    "name": "Government College of Engineering Aurangabad (GCEA)",
    "short": "GECA",
    "city": "Chhatrapati Sambhajinagar"
  },
  {
    "name": "Government College of Engineering Amravati (GCOEA)",
    "short": "GCOEA",
    "city": "Amravati"
  },
  {
    "name": "Shri Ramdeobaba College of Engineering and Management (RCOEM)",
    "short": "RCOEM",
    "city": "Nagpur"
  },
  {
    "name": "Yeshwantrao Chavan College of Engineering (YCCE Nagpur)",
    "short": "YCCE",
    "city": "Nagpur"
  },
  {
    "name": "Delhi Technological University (DTU Bawana)",
    "short": "DTU",
    "city": "New Delhi"
  },
  {
    "name": "Netaji Subhas University of Technology (NSUT Dwarka)",
    "short": "NSUT",
    "city": "New Delhi"
  },
  {
    "name": "Guru Gobind Singh Indraprastha University (GGSIPU Dwarka)",
    "short": "GGSIPU",
    "city": "New Delhi"
  },
  {
    "name": "Maharaja Agrasen Institute of Technology (MAIT Rohini)",
    "short": "MAIT",
    "city": "New Delhi"
  },
  {
    "name": "Bharati Vidyapeeth’s College of Engineering (BVCOE Paschim Vihar)",
    "short": "BVCOE",
    "city": "New Delhi"
  },
  {
    "name": "Bhagwan Parshuram Institute of Technology (BPIT Rohini)",
    "short": "BPIT",
    "city": "New Delhi"
  },
  {
    "name": "Thapar Institute of Engineering and Technology (TIET Patiala)",
    "short": "Thapar",
    "city": "Patiala"
  },
  {
    "name": "Punjab Engineering College (PEC Chandigarh)",
    "short": "PEC",
    "city": "Chandigarh"
  },
  {
    "name": "Harcourt Butler Technical University (HBTU Kanpur)",
    "short": "HBTU",
    "city": "Kanpur"
  },
  {
    "name": "Madan Mohan Malaviya University of Technology (MMMUT Gorakhpur)",
    "short": "MMMUT",
    "city": "Gorakhpur"
  },
  {
    "name": "Institute of Engineering and Technology (IET Lucknow)",
    "short": "IET Lucknow",
    "city": "Lucknow"
  },
  {
    "name": "Kamla Nehru Institute of Technology (KNIT Sultanpur)",
    "short": "KNIT",
    "city": "Sultanpur"
  },
  {
    "name": "Aligarh Muslim University (ZHCET AMU)",
    "short": "AMU",
    "city": "Aligarh"
  },
  {
    "name": "Jamia Millia Islamia Faculty of Engineering (JMI)",
    "short": "JMI",
    "city": "New Delhi"
  },
  {
    "name": "Shiv Nadar University (SNU Greater Noida)",
    "short": "SNU",
    "city": "Greater Noida"
  },
  {
    "name": "Jaypee Institute of Information Technology (JIIT Sector 62/128 Noida)",
    "short": "JIIT",
    "city": "Noida"
  },
  {
    "name": "Amity University (Amity Noida Campus)",
    "short": "Amity",
    "city": "Noida"
  },
  {
    "name": "Galgotias University / Galgotias College of Engg (Greater Noida)",
    "short": "Galgotias",
    "city": "Greater Noida"
  },
  {
    "name": "JSS Academy of Technical Education Noida",
    "short": "JSS Noida",
    "city": "Noida"
  },
  {
    "name": "Ajay Kumar Garg Engineering College (AKGEC Ghaziabad)",
    "short": "AKGEC",
    "city": "Ghaziabad"
  },
  {
    "name": "KIET Group of Institutions (Ghaziabad)",
    "short": "KIET",
    "city": "Ghaziabad"
  },
  {
    "name": "Krishna Institute of Engineering and Technology (Ghaziabad)",
    "short": "Krishna",
    "city": "Ghaziabad"
  },
  {
    "name": "Osmania University College of Engineering (OUCE)",
    "short": "OUCE",
    "city": "Hyderabad"
  },
  {
    "name": "JNTUH University College of Engineering (Kukatpally)",
    "short": "JNTUH",
    "city": "Hyderabad"
  },
  {
    "name": "Chaitanya Bharathi Institute of Technology (CBIT Gandipet)",
    "short": "CBIT",
    "city": "Hyderabad"
  },
  {
    "name": "Vasavi College of Engineering (Ibrahimbagh)",
    "short": "Vasavi",
    "city": "Hyderabad"
  },
  {
    "name": "VNR Vignana Jyothi Institute of Engineering and Technology (VNR VJIET Bachupally)",
    "short": "VNR VJIET",
    "city": "Hyderabad"
  },
  {
    "name": "Gokaraju Rangaraju Institute of Engineering and Technology (GRIET)",
    "short": "GRIET",
    "city": "Hyderabad"
  },
  {
    "name": "BVRIT Hyderabad College of Engineering for Women (Nizampet)",
    "short": "BVRITW",
    "city": "Hyderabad"
  },
  {
    "name": "B.V. Raju Institute of Technology (BVRIT Narsapur)",
    "short": "BVRIT",
    "city": "Narsapur"
  },
  {
    "name": "Sreenidhi Institute of Science and Technology (SNIST Ghatkesar)",
    "short": "SNIST",
    "city": "Hyderabad"
  },
  {
    "name": "Mahatma Gandhi Institute of Technology (MGIT Gandipet)",
    "short": "MGIT",
    "city": "Hyderabad"
  },
  {
    "name": "CVR College of Engineering (Ibrahimpatnam)",
    "short": "CVR",
    "city": "Hyderabad"
  },
  {
    "name": "Vardhaman College of Engineering (Shamshabad)",
    "short": "Vardhaman",
    "city": "Hyderabad"
  },
  {
    "name": "Muffakham Jah College of Engineering and Technology (MJCET Banjara Hills)",
    "short": "MJCET",
    "city": "Hyderabad"
  },
  {
    "name": "Andhra University College of Engineering (AUCE Visakhapatnam)",
    "short": "AUCE",
    "city": "Visakhapatnam"
  },
  {
    "name": "Gayatri Vidya Parishad College of Engineering (GVPCE Madhurawada)",
    "short": "GVPCE",
    "city": "Visakhapatnam"
  },
  {
    "name": "VR Siddhartha Engineering College (VRSEC Vijayawada)",
    "short": "VRSEC",
    "city": "Vijayawada"
  },
  {
    "name": "RVR & JC College of Engineering (Chowdavaram Guntur)",
    "short": "RVRJC",
    "city": "Guntur"
  },
  {
    "name": "JNTUK University College of Engineering (Kakinada)",
    "short": "JNTUK",
    "city": "Kakinada"
  },
  {
    "name": "College of Engineering Trivandrum (CET Thiruvananthapuram)",
    "short": "CET",
    "city": "Thiruvananthapuram"
  },
  {
    "name": "Government Engineering College Barton Hill (GECB)",
    "short": "GECB",
    "city": "Thiruvananthapuram"
  },
  {
    "name": "Government Engineering College Thrissur (GECT)",
    "short": "GECT",
    "city": "Thrissur"
  },
  {
    "name": "TKM College of Engineering (TKMCE Kollam)",
    "short": "TKMCE",
    "city": "Kollam"
  },
  {
    "name": "Model Engineering College (MEC Thrikkakara Kochi)",
    "short": "MEC Kochi",
    "city": "Kochi"
  },
  {
    "name": "Cochin University of Science and Technology (CUSAT SOE Kochi)",
    "short": "CUSAT",
    "city": "Kochi"
  },
  {
    "name": "Jadavpur University Faculty of Engineering (JU Kolkata)",
    "short": "Jadavpur",
    "city": "Kolkata"
  },
  {
    "name": "Heritage Institute of Technology (HIT Kolkata Anandapur)",
    "short": "Heritage",
    "city": "Kolkata"
  },
  {
    "name": "Institute of Engineering and Management (IEM Salt Lake Kolkata)",
    "short": "IEM",
    "city": "Kolkata"
  },
  {
    "name": "Kalyani Government Engineering College (KGEC)",
    "short": "KGEC",
    "city": "Kalyani"
  },
  {
    "name": "Haldia Institute of Technology (HIT Haldia)",
    "short": "Haldia",
    "city": "Haldia"
  },
  {
    "name": "L.D. College of Engineering (LDCE Navrangpura Ahmedabad)",
    "short": "LDCE",
    "city": "Ahmedabad"
  },
  {
    "name": "Nirma University Institute of Technology (Ahmedabad)",
    "short": "Nirma",
    "city": "Ahmedabad"
  },
  {
    "name": "Pandit Deendayal Energy University (PDEU Gandhinagar)",
    "short": "PDEU",
    "city": "Gandhinagar"
  },
  {
    "name": "Dharmsinh Desai University (DDU Nadiad)",
    "short": "DDU",
    "city": "Nadiad"
  },
  {
    "name": "Birla Institute of Technology Mesra (BIT Mesra Ranchi)",
    "short": "BIT Mesra",
    "city": "Ranchi"
  },
  {
    "name": "KIIT Deemed to be University (Bhubaneswar)",
    "short": "KIIT",
    "city": "Bhubaneswar"
  },
  {
    "name": "Siksha ‘O’ Anusandhan (SOA ITER Bhubaneswar)",
    "short": "ITER",
    "city": "Bhubaneswar"
  },
  {
    "name": "College of Engineering and Technology (OUTR Bhubaneswar)",
    "short": "OUTR",
    "city": "Bhubaneswar"
  },
  {
    "name": "MBM University (Jodhpur)",
    "short": "MBM",
    "city": "Jodhpur"
  },
  {
    "name": "College of Technology and Engineering (CTAE Udaipur)",
    "short": "CTAE",
    "city": "Udaipur"
  },
  {
    "name": "All India Institute of Medical Sciences (AIIMS New Delhi)",
    "short": "AIIMS Delhi",
    "city": "New Delhi"
  },
  {
    "name": "All India Institute of Medical Sciences (AIIMS Bhopal)",
    "short": "AIIMS Bhopal",
    "city": "Bhopal"
  },
  {
    "name": "All India Institute of Medical Sciences (AIIMS Bhubaneswar)",
    "short": "AIIMS BBS",
    "city": "Bhubaneswar"
  },
  {
    "name": "All India Institute of Medical Sciences (AIIMS Jodhpur)",
    "short": "AIIMS Jodhpur",
    "city": "Jodhpur"
  },
  {
    "name": "All India Institute of Medical Sciences (AIIMS Patna)",
    "short": "AIIMS Patna",
    "city": "Patna"
  },
  {
    "name": "All India Institute of Medical Sciences (AIIMS Raipur)",
    "short": "AIIMS Raipur",
    "city": "Raipur"
  },
  {
    "name": "All India Institute of Medical Sciences (AIIMS Rishikesh)",
    "short": "AIIMS Rishikesh",
    "city": "Rishikesh"
  },
  {
    "name": "All India Institute of Medical Sciences (AIIMS Nagpur)",
    "short": "AIIMS Nagpur",
    "city": "Nagpur"
  },
  {
    "name": "All India Institute of Medical Sciences (AIIMS Mangalagiri)",
    "short": "AIIMS Mangalagiri",
    "city": "Vijayawada"
  },
  {
    "name": "Postgraduate Institute of Medical Education and Research (PGIMER)",
    "short": "PGIMER",
    "city": "Chandigarh"
  },
  {
    "name": "Jawaharlal Institute of Postgraduate Medical Education & Research (JIPMER)",
    "short": "JIPMER",
    "city": "Puducherry"
  },
  {
    "name": "Christian Medical College (CMC Vellore)",
    "short": "CMC Vellore",
    "city": "Vellore"
  },
  {
    "name": "King George’s Medical University (KGMU Lucknow)",
    "short": "KGMU",
    "city": "Lucknow"
  },
  {
    "name": "Maulana Azad Medical College (MAMC New Delhi)",
    "short": "MAMC",
    "city": "New Delhi"
  },
  {
    "name": "Lady Hardinge Medical College (LHMC New Delhi)",
    "short": "LHMC",
    "city": "New Delhi"
  },
  {
    "name": "Vardhman Mahavir Medical College & Safdarjung Hospital (VMMC)",
    "short": "VMMC",
    "city": "New Delhi"
  },
  {
    "name": "University College of Medical Sciences (UCMS Dilshad Garden)",
    "short": "UCMS",
    "city": "New Delhi"
  },
  {
    "name": "Madras Medical College (MMC Chennai)",
    "short": "MMC",
    "city": "Chennai"
  },
  {
    "name": "Stanley Medical College (Chennai)",
    "short": "Stanley",
    "city": "Chennai"
  },
  {
    "name": "Seth GS Medical College & KEM Hospital (Parel Mumbai)",
    "short": "KEM",
    "city": "Mumbai"
  },
  {
    "name": "Grant Government Medical College & Sir JJ Group of Hospitals",
    "short": "JJ Hospital",
    "city": "Mumbai"
  },
  {
    "name": "Lokmanya Tilak Municipal Medical College (Sion Mumbai)",
    "short": "Sion Hospital",
    "city": "Mumbai"
  },
  {
    "name": "B.J. Government Medical College (Pune)",
    "short": "BJMC",
    "city": "Pune"
  },
  {
    "name": "Institute of Medical Sciences, BHU Varanasi",
    "short": "IMS-BHU",
    "city": "Varanasi"
  },
  {
    "name": "Medical College Kolkata (Calcutta Medical College)",
    "short": "CMC Kolkata",
    "city": "Kolkata"
  },
  {
    "name": "Government Medical College Thiruvananthapuram (TMC)",
    "short": "GMC TVM",
    "city": "Thiruvananthapuram"
  },
  {
    "name": "Government Medical College Kozhikode (Calicut Medical College)",
    "short": "GMC Kozhikode",
    "city": "Kozhikode"
  },
  {
    "name": "Osmania Medical College (Koti Hyderabad)",
    "short": "OMC",
    "city": "Hyderabad"
  },
  {
    "name": "Gandhi Medical College (Musheerabad Secunderabad)",
    "short": "GMC Hyd",
    "city": "Secunderabad"
  },
  {
    "name": "NALSAR University of Law (Shamirpet Hyderabad)",
    "short": "NALSAR",
    "city": "Hyderabad"
  },
  {
    "name": "The West Bengal National University of Juridical Sciences (WBNUJS)",
    "short": "WBNUJS",
    "city": "Kolkata"
  },
  {
    "name": "National Law University, Delhi (NLU Delhi Sector 14 Dwarka)",
    "short": "NLU Delhi",
    "city": "New Delhi"
  },
  {
    "name": "National Law Institute University (NLIU Bhopal)",
    "short": "NLIU",
    "city": "Bhopal"
  },
  {
    "name": "Gujarat National Law University (GNLU Gandhinagar)",
    "short": "GNLU",
    "city": "Gandhinagar"
  },
  {
    "name": "Dr. Ram Manohar Lohiya National Law University (RMLNLU Lucknow)",
    "short": "RMLNLU",
    "city": "Lucknow"
  },
  {
    "name": "National Law University, Jodhpur (NLUJ)",
    "short": "NLU Jodhpur",
    "city": "Jodhpur"
  },
  {
    "name": "Hidayatullah National Law University (HNLU Raipur)",
    "short": "HNLU",
    "city": "Raipur"
  },
  {
    "name": "Symbiosis Law School (SLS Pune Viman Nagar)",
    "short": "SLS Pune",
    "city": "Pune"
  },
  {
    "name": "Symbiosis Law School (SLS Noida)",
    "short": "SLS Noida",
    "city": "Noida"
  },
  {
    "name": "ILS Law College (Law College Road Pune)",
    "short": "ILS",
    "city": "Pune"
  },
  {
    "name": "Government Law College (GLC Churchgate Mumbai)",
    "short": "GLC",
    "city": "Mumbai"
  },
  {
    "name": "Faculty of Law, University of Delhi (Campus Law Centre CLC)",
    "short": "CLC DU",
    "city": "New Delhi"
  },
  {
    "name": "Amity Law School (Noida)",
    "short": "ALS Noida",
    "city": "Noida"
  },
  {
    "name": "Jindal Global Law School (O.P. Jindal Sonipat)",
    "short": "JGLS",
    "city": "Sonipat"
  },
  {
    "name": "Shri Ram College of Commerce (SRCC University of Delhi)",
    "short": "SRCC",
    "city": "New Delhi"
  },
  {
    "name": "Lady Shri Ram College for Women (LSR Lajpat Nagar)",
    "short": "LSR",
    "city": "New Delhi"
  },
  {
    "name": "Hindu College (University of Delhi North Campus)",
    "short": "Hindu",
    "city": "New Delhi"
  },
  {
    "name": "St. Stephen’s College (University of Delhi)",
    "short": "Stephens",
    "city": "New Delhi"
  },
  {
    "name": "Hansraj College (University of Delhi North Campus)",
    "short": "Hansraj",
    "city": "New Delhi"
  },
  {
    "name": "Miranda House (University of Delhi)",
    "short": "Miranda",
    "city": "New Delhi"
  },
  {
    "name": "Kirori Mal College (KMC University of Delhi)",
    "short": "KMC DU",
    "city": "New Delhi"
  },
  {
    "name": "Ramjas College (University of Delhi)",
    "short": "Ramjas",
    "city": "New Delhi"
  },
  {
    "name": "Gargi College (Siri Fort New Delhi)",
    "short": "Gargi",
    "city": "New Delhi"
  },
  {
    "name": "Sri Venkateswara College (Venky Dhaula Kuan)",
    "short": "Venky",
    "city": "New Delhi"
  },
  {
    "name": "Atma Ram Sanatan Dharma College (ARSD Dhaula Kuan)",
    "short": "ARSD",
    "city": "New Delhi"
  },
  {
    "name": "Loyola College (Autonomous Nungambakkam Chennai)",
    "short": "Loyola",
    "city": "Chennai"
  },
  {
    "name": "Madras Christian College (MCC Tambaram Chennai)",
    "short": "MCC Chennai",
    "city": "Chennai"
  },
  {
    "name": "Stella Maris College (Cathedral Road Chennai)",
    "short": "Stella Maris",
    "city": "Chennai"
  },
  {
    "name": "Presidency College (Kamarajar Salai Chennai)",
    "short": "Presidency Chennai",
    "city": "Chennai"
  },
  {
    "name": "Women’s Christian College (WCC College Road Chennai)",
    "short": "WCC",
    "city": "Chennai"
  },
  {
    "name": "St. Xavier’s College (Fort Mumbai)",
    "short": "Xaviers Mumbai",
    "city": "Mumbai"
  },
  {
    "name": "St. Xavier’s College (Park Street Kolkata)",
    "short": "Xaviers Kolkata",
    "city": "Kolkata"
  },
  {
    "name": "Mithibai College of Arts and Chauhan Institute (Vile Parle Mumbai)",
    "short": "Mithibai",
    "city": "Mumbai"
  },
  {
    "name": "Narsee Monjee College of Commerce and Economics (NM College)",
    "short": "NM College",
    "city": "Mumbai"
  },
  {
    "name": "H.R. College of Commerce and Economics (Churchgate Mumbai)",
    "short": "HR College",
    "city": "Mumbai"
  },
  {
    "name": "R.A. Podar College of Commerce and Economics (Matunga Mumbai)",
    "short": "Podar",
    "city": "Mumbai"
  },
  {
    "name": "Fergusson College (FC Road Pune)",
    "short": "Fergusson",
    "city": "Pune"
  },
  {
    "name": "Brihan Maharashtra College of Commerce (BMCC Pune)",
    "short": "BMCC",
    "city": "Pune"
  },
  {
    "name": "Symbiosis Centre for Management Studies (SCMS Viman Nagar Pune)",
    "short": "SCMS",
    "city": "Pune"
  },
  {
    "name": "Bhavan’s Vivekananda College (Sainikpuri Secunderabad)",
    "short": "BVC",
    "city": "Secunderabad"
  },
  {
    "name": "St. Francis College for Women (Begumpet Hyderabad)",
    "short": "St. Francis",
    "city": "Hyderabad"
  },
  {
    "name": "St. Ann’s College for Women (Mehdipatnam Hyderabad)",
    "short": "St. Anns",
    "city": "Hyderabad"
  },
  {
    "name": "Loyola Academy Degree & PG College (Old Alwal Secunderabad)",
    "short": "Loyola Hyd",
    "city": "Secunderabad"
  },
  {
    "name": "Sacred Heart College (Thevara Kochi)",
    "short": "Sacred Heart",
    "city": "Kochi"
  },
  {
    "name": "St. Teresa’s College (Park Avenue Ernakulam)",
    "short": "Teresas",
    "city": "Kochi"
  },
  {
    "name": "Mar Ivanios College (Nalanchira Thiruvananthapuram)",
    "short": "Mar Ivanios",
    "city": "Thiruvananthapuram"
  },
  {
    "name": "Indian Institute of Management Ahmedabad (IIM-A)",
    "short": "IIM-A",
    "city": "Ahmedabad"
  },
  {
    "name": "Indian Institute of Management Calcutta (IIM-C)",
    "short": "IIM-C",
    "city": "Kolkata"
  },
  {
    "name": "Indian Institute of Management Lucknow (IIM-L)",
    "short": "IIM-L",
    "city": "Lucknow"
  },
  {
    "name": "Indian Institute of Management Kozhikode (IIM-K)",
    "short": "IIM-K",
    "city": "Kozhikode"
  },
  {
    "name": "Indian Institute of Management Indore (IIM-I)",
    "short": "IIM-I",
    "city": "Indore"
  },
  {
    "name": "Indian Institute of Management Shillong (IIM-S)",
    "short": "IIM-S",
    "city": "Shillong"
  },
  {
    "name": "XLRI Xavier School of Management (Jamshedpur)",
    "short": "XLRI",
    "city": "Jamshedpur"
  },
  {
    "name": "SP Jain Institute of Management and Research (SPJIMR Andheri)",
    "short": "SPJIMR",
    "city": "Mumbai"
  },
  {
    "name": "Faculty of Management Studies, University of Delhi (FMS Delhi)",
    "short": "FMS",
    "city": "New Delhi"
  },
  {
    "name": "Management Development Institute (MDI Gurgaon)",
    "short": "MDI",
    "city": "Gurgaon"
  },
  {
    "name": "Narsee Monjee Institute of Management Studies (NMIMS Vile Parle)",
    "short": "NMIMS",
    "city": "Mumbai"
  },
  {
    "name": "Symbiosis Institute of Business Management (SIBM Lavale Pune)",
    "short": "SIBM",
    "city": "Pune"
  },
  {
    "name": "T.A. Pai Management Institute (TAPMI Manipal)",
    "short": "TAPMI",
    "city": "Manipal"
  },
  {
    "name": "BNM Institute of Technology (BNMIT)",
    "short": "BNMIT",
    "city": "Bengaluru"
  },
  {
    "name": "AMC Engineering College",
    "short": "AEC",
    "city": "Bengaluru"
  },
  {
    "name": "APS College of Engineering",
    "short": "ACE",
    "city": "Bengaluru"
  },
  {
    "name": "BTL Institute of Technology",
    "short": "BIT",
    "city": "Bengaluru"
  },
  {
    "name": "City Engineering College",
    "short": "CEC",
    "city": "Bengaluru"
  },
  {
    "name": "CMR Institute of Technology",
    "short": "CIT",
    "city": "Bengaluru"
  },
  {
    "name": "Channabasaveshwara Institute of Technology",
    "short": "CIT",
    "city": "Bengaluru"
  },
  {
    "name": "Bangalore Institute of Technology",
    "short": "BIT",
    "city": "Bengaluru"
  },
  {
    "name": "Bangalore Technological Institute",
    "short": "BTI",
    "city": "Bengaluru"
  },
  {
    "name": "BGS College of Engineering & Technology",
    "short": "BCET",
    "city": "Bengaluru"
  },
  {
    "name": "BES College of Engineering & Technology",
    "short": "BCET",
    "city": "Bengaluru"
  },
  {
    "name": "Sambhram Institute of Technology",
    "short": "SIT",
    "city": "Bengaluru"
  },
  {
    "name": "Sambhram College of Engineering",
    "short": "SCE",
    "city": "Bengaluru"
  },
  {
    "name": "Sapthagiri College of Engineering",
    "short": "SCE",
    "city": "Bengaluru"
  },
  {
    "name": "Sri Venkateshwara College of Engineering",
    "short": "SVCE",
    "city": "Bengaluru"
  },
  {
    "name": "Sri Sairam College of Engineering",
    "short": "SSCE",
    "city": "Bengaluru"
  },
  {
    "name": "Sri Pillappa College of Engineering",
    "short": "SPCE",
    "city": "Bengaluru"
  },
  {
    "name": "MS Ramaiah University of Applied Sciences",
    "short": "MRUA",
    "city": "Bengaluru"
  },
  {
    "name": "RV University",
    "short": "RU",
    "city": "Bengaluru"
  },
  {
    "name": "Azim Premji University",
    "short": "APU",
    "city": "Bengaluru"
  },
  {
    "name": "Alliance College of Engineering and Design",
    "short": "ACED",
    "city": "Bengaluru"
  },
  {
    "name": "Bangalore University - University / Visvesvaraya College of Engineering",
    "short": "BUUV",
    "city": "Bengaluru"
  },
  {
    "name": "Bangalore University - Jnana Bharathi Campus",
    "short": "BUJB",
    "city": "Bengaluru"
  },
  {
    "name": "Bengaluru North University",
    "short": "BNU",
    "city": "Bengaluru"
  },
  {
    "name": "Bengaluru City University",
    "short": "BCU",
    "city": "Bengaluru"
  },
  {
    "name": "NITTE Bengaluru - Nitte Institute of Technology",
    "short": "NBNI",
    "city": "Bengaluru"
  },
  {
    "name": "MS Ramaiah University",
    "short": "MRU",
    "city": "Bengaluru"
  },
  {
    "name": "Symbiosis International University - Bengaluru",
    "short": "SIUB",
    "city": "Bengaluru"
  },
  {
    "name": "Manipal Academy of Higher Education - Bengaluru Campus",
    "short": "MAHE",
    "city": "Bengaluru"
  },
  {
    "name": "S-VYASA University",
    "short": "SU",
    "city": "Bengaluru"
  },
  {
    "name": "Sri Sri University / Sri Sri College-related degree institutions",
    "short": "SSUS",
    "city": "Bengaluru"
  },
  {
    "name": "Seshadripuram First Grade College",
    "short": "SFGC",
    "city": "Bengaluru"
  },
  {
    "name": "Seshadripuram First Grade College, Yelahanka",
    "short": "SFGC",
    "city": "Bengaluru"
  },
  {
    "name": "BMS College for Women",
    "short": "BCW",
    "city": "Bengaluru"
  },
  {
    "name": "Maharani's Women's College",
    "short": "MWC",
    "city": "Bengaluru"
  },
  {
    "name": "Government First Grade College, Malleshwaram",
    "short": "GFGC",
    "city": "Bengaluru"
  },
  {
    "name": "Government First Grade College, Vijayanagar",
    "short": "GFGC",
    "city": "Bengaluru"
  },
  {
    "name": "Government First Grade College, Varthur",
    "short": "GFGC",
    "city": "Bengaluru"
  },
  {
    "name": "Acharya Institute of Graduate Studies",
    "short": "AIGS",
    "city": "Bengaluru"
  },
  {
    "name": "Acharya Institute of Management & Sciences",
    "short": "AIMS",
    "city": "Bengaluru"
  },
  {
    "name": "Al-Ameen Arts, Science & Commerce College",
    "short": "AASC",
    "city": "Bengaluru"
  },
  {
    "name": "Presidency College",
    "short": "PC",
    "city": "Bengaluru"
  },
  {
    "name": "Community Institute of Commerce and Management Studies",
    "short": "CICM",
    "city": "Bengaluru"
  },
  {
    "name": "S.B. College of Management Studies",
    "short": "SCMS",
    "city": "Bengaluru"
  },
  {
    "name": "City College",
    "short": "CC",
    "city": "Bengaluru"
  },
  {
    "name": "Christ Academy Institute for Advanced Studies",
    "short": "CAIA",
    "city": "Bengaluru"
  },
  {
    "name": "Benedictine Academy",
    "short": "BA",
    "city": "Bengaluru"
  },
  {
    "name": "Besant Women's College / BES College",
    "short": "BWCB",
    "city": "Bengaluru"
  },
  {
    "name": "Silicon City College",
    "short": "SCC",
    "city": "Bengaluru"
  },
  {
    "name": "Srushti College",
    "short": "SC",
    "city": "Bengaluru"
  },
  {
    "name": "Krupanidhi College",
    "short": "KC",
    "city": "Bengaluru"
  },
  {
    "name": "Krupanidhi Degree College",
    "short": "KDC",
    "city": "Bengaluru"
  },
  {
    "name": "Vidya Sanskaar Institute of Science, Commerce & Management",
    "short": "VSIS",
    "city": "Bengaluru"
  },
  {
    "name": "Sri Sai Institute of Management Science",
    "short": "SSIM",
    "city": "Bengaluru"
  },
  {
    "name": "MVM College of Speech and Hearing",
    "short": "MCSH",
    "city": "Bengaluru"
  },
  {
    "name": "Al-Ameen College",
    "short": "AC",
    "city": "Bengaluru"
  },
  {
    "name": "Columbia College",
    "short": "CC",
    "city": "Bengaluru"
  },
  {
    "name": "Ramnarayan Chellaram College of Commerce",
    "short": "RCCC",
    "city": "Bengaluru"
  },
  {
    "name": "ESIC Medical College & PGIMSR",
    "short": "EMCP",
    "city": "Bengaluru"
  },
  {
    "name": "BGS Medical College & Hospital",
    "short": "BMCH",
    "city": "Bengaluru"
  },
  {
    "name": "BGS Global Institute of Medical Sciences",
    "short": "BGIM",
    "city": "Bengaluru"
  },
  {
    "name": "East Point College of Medical Sciences & Research Centre",
    "short": "EPCM",
    "city": "Bengaluru"
  },
  {
    "name": "Hosmat Institute of Medical Sciences",
    "short": "HIMS",
    "city": "Bengaluru"
  },
  {
    "name": "Akash Institute of Medical Sciences & Research Centre",
    "short": "AIMS",
    "city": "Bengaluru"
  },
  {
    "name": "Kidwai Memorial Institute of Oncology",
    "short": "KMIO",
    "city": "Bengaluru"
  },
  {
    "name": "Shri Atal Bihari Vajpayee Medical College & Research Institute",
    "short": "SABV",
    "city": "Bengaluru"
  },
  {
    "name": "NIMHANS",
    "short": "N",
    "city": "Bengaluru"
  },
  {
    "name": "Siddaganga Medical College & Research Institute",
    "short": "SMCR",
    "city": "Bengaluru"
  },
  {
    "name": "Bangalore Institute of Dental Sciences & Hospital",
    "short": "BIDS",
    "city": "Bengaluru"
  },
  {
    "name": "BGS Global Institute of Dental Sciences & Hospital",
    "short": "BGID",
    "city": "Bengaluru"
  },
  {
    "name": "D.A. Pandu Memorial R.V. Dental College",
    "short": "DPMR",
    "city": "Bengaluru"
  },
  {
    "name": "Government Dental College & Research Institute",
    "short": "GDCR",
    "city": "Bengaluru"
  },
  {
    "name": "KLE Society's Institute of Dental Sciences",
    "short": "KSID",
    "city": "Bengaluru"
  },
  {
    "name": "Krishnadevaraya College of Dental Sciences & Hospital",
    "short": "KCDS",
    "city": "Bengaluru"
  },
  {
    "name": "M.R. Ambedkar Dental College",
    "short": "MADC",
    "city": "Bengaluru"
  },
  {
    "name": "M.S. Ramaiah Dental College",
    "short": "MRDC",
    "city": "Bengaluru"
  },
  {
    "name": "Maaruti College of Dental Sciences & Research Centre",
    "short": "MCDS",
    "city": "Bengaluru"
  },
  {
    "name": "Rajarajeshwari Dental College & Hospital",
    "short": "RDCH",
    "city": "Bengaluru"
  },
  {
    "name": "Sri Rajiv Gandhi College of Dental Sciences & Hospital",
    "short": "SRGC",
    "city": "Bengaluru"
  },
  {
    "name": "Sri Venkateshwara Dental College & Hospital",
    "short": "SVDC",
    "city": "Bengaluru"
  },
  {
    "name": "Vokkaligara Sangha Dental College & Hospital",
    "short": "VSDC",
    "city": "Bengaluru"
  },
  {
    "name": "Vydehi Institute of Dental Sciences & Research",
    "short": "VIDS",
    "city": "Bengaluru"
  },
  {
    "name": "The Oxford Dental College",
    "short": "ODC",
    "city": "Bengaluru"
  },
  {
    "name": "Ramaiah College of Law",
    "short": "RCL",
    "city": "Bengaluru"
  },
  {
    "name": "Kristu Jayanti College of Law",
    "short": "KJCL",
    "city": "Bengaluru"
  },
  {
    "name": "Bangalore Institute of Legal Studies",
    "short": "BILS",
    "city": "Bengaluru"
  },
  {
    "name": "St. Joseph's College of Law",
    "short": "SJCL",
    "city": "Bengaluru"
  },
  {
    "name": "KLE Law College",
    "short": "KLC",
    "city": "Bengaluru"
  },
  {
    "name": "RV Institute of Legal Studies",
    "short": "RILS",
    "city": "Bengaluru"
  },
  {
    "name": "AL-Ameen College of Law",
    "short": "ACL",
    "city": "Bengaluru"
  },
  {
    "name": "NMIMS School of Law, Bengaluru",
    "short": "NSLB",
    "city": "Bengaluru"
  },
  {
    "name": "CMR University School of Legal Studies",
    "short": "CUSL",
    "city": "Bengaluru"
  },
  {
    "name": "University Law College, Bangalore University",
    "short": "ULCB",
    "city": "Bengaluru"
  },
  {
    "name": "ACS College of Engineering (Kengeri)",
    "short": "KENGERI",
    "city": "Bengaluru"
  },
  {
    "name": "APS College of Engineering (Somanahalli)",
    "short": "ACE",
    "city": "Bengaluru"
  },
  {
    "name": "Alpha College of Engineering (Sahakar Nagar)",
    "short": "ACE",
    "city": "Bengaluru"
  },
  {
    "name": "Adarsha Institute of Technology (Chintamani Road)",
    "short": "AIT",
    "city": "Bengaluru"
  },
  {
    "name": "Akshaya Institute of Technology (Tumkur Road)",
    "short": "AIT",
    "city": "Bengaluru"
  },
  {
    "name": "Amrutha Institute of Engineering and Management Sciences (Bidadi)",
    "short": "BIDADI",
    "city": "Bengaluru"
  },
  {
    "name": "Achutha Institute of Technology (Nelamangala)",
    "short": "AIT",
    "city": "Bengaluru"
  },
  {
    "name": "Bangalore College of Engineering & Technology (Chandapura)",
    "short": "BCET",
    "city": "Bengaluru"
  },
  {
    "name": "Bangalore Technological Institute (Chandapura)",
    "short": "BTI",
    "city": "Bengaluru"
  },
  {
    "name": "BGS College of Engineering & Technology (Mahalakshmipuram)",
    "short": "BCET",
    "city": "Bengaluru"
  },
  {
    "name": "BGS Institute of Technology (BG Nagara - Bengaluru Rural)",
    "short": "BIT",
    "city": "Bengaluru"
  },
  {
    "name": "BTL Institute of Technology (Bommasandra)",
    "short": "BIT",
    "city": "Bengaluru"
  },
  {
    "name": "Brindavan College of Engineering (Yelahanka)",
    "short": "BCE",
    "city": "Bengaluru"
  },
  {
    "name": "BNM Institute of Technology",
    "short": "BIT",
    "city": "Bengaluru"
  },
  {
    "name": "City Engineering College (Kanakapura Road)",
    "short": "CEC",
    "city": "Bengaluru"
  },
  {
    "name": "Channabasaveshwara Institute of Technology (Gubbi - Bengaluru Rural)",
    "short": "CIT",
    "city": "Bengaluru"
  },
  {
    "name": "East West Institute of Technology (Magadi Road)",
    "short": "EWIT",
    "city": "Bengaluru"
  },
  {
    "name": "Ghousia College of Engineering (Ramanagara)",
    "short": "GCE",
    "city": "Bengaluru"
  },
  {
    "name": "Global Academy of Technology",
    "short": "GAT",
    "city": "Bengaluru"
  },
  {
    "name": "Impact College of Engineering and Applied Sciences (Kodigehalli)",
    "short": "ICEA",
    "city": "Bengaluru"
  },
  {
    "name": "Islamiah Institute of Technology (Bangalore)",
    "short": "IIT",
    "city": "Bengaluru"
  },
  {
    "name": "Jnanavikasa Institute of Technology (Bidadi)",
    "short": "BIDADI",
    "city": "Bengaluru"
  },
  {
    "name": "Jyothi Institute of Technology (Kanakapura Road)",
    "short": "JIT",
    "city": "Bengaluru"
  },
  {
    "name": "KNS Institute of Technology (Yelahanka)",
    "short": "KIT",
    "city": "Bengaluru"
  },
  {
    "name": "Nagarjuna College of Engineering & Technology (Devanahalli)",
    "short": "NCET",
    "city": "Bengaluru"
  },
  {
    "name": "Nadgir Institute of Engineering and Technology (Hesaraghatta)",
    "short": "NIET",
    "city": "Bengaluru"
  },
  {
    "name": "Nandi Institute of Technology and Management Sciences (Koppa Gate)",
    "short": "NITM",
    "city": "Bengaluru"
  },
  {
    "name": "Rajarajeswari College of Engineering (RRCE Mysore Road)",
    "short": "RCE",
    "city": "Bengaluru"
  },
  {
    "name": "Sambhram Institute of Technology (MS Palya)",
    "short": "MS PALYA",
    "city": "Bengaluru"
  },
  {
    "name": "Sapthagiri College of Engineering (Hesaraghatta)",
    "short": "SCE",
    "city": "Bengaluru"
  },
  {
    "name": "SEA College of Engineering and Technology (Virgonagar)",
    "short": "SCET",
    "city": "Bengaluru"
  },
  {
    "name": "Shirdi Sai Engineering College (Anekal)",
    "short": "ANEKAL",
    "city": "Bengaluru"
  },
  {
    "name": "Sri Krishna Institute of Technology (Chikkabanavara)",
    "short": "SKIT",
    "city": "Bengaluru"
  },
  {
    "name": "Sri Sairam College of Engineering (Anekal)",
    "short": "ANEKAL",
    "city": "Bengaluru"
  },
  {
    "name": "Sri Revana Siddeshwara Institute of Technology (Chikkaballapur Road)",
    "short": "SRSI",
    "city": "Bengaluru"
  },
  {
    "name": "Sri Pillappa College of Engineering (Chikkaballapur Road)",
    "short": "SPCE",
    "city": "Bengaluru"
  },
  {
    "name": "Sri Venkateshwara College of Engineering (Vidyanagar)",
    "short": "SVCE",
    "city": "Bengaluru"
  },
  {
    "name": "Sri Venkateshwara College of Engineering & Technology (Chikkajala)",
    "short": "SVCE",
    "city": "Bengaluru"
  },
  {
    "name": "T. John Institute of Technology (Gottigere)",
    "short": "TJIT",
    "city": "Bengaluru"
  },
  {
    "name": "Vivekananda Institute of Technology (Kumbalgodu)",
    "short": "VIT",
    "city": "Bengaluru"
  },
  {
    "name": "Yellamma Dasappa Institute of Technology (Chikkaballapur Road)",
    "short": "YDIT",
    "city": "Bengaluru"
  },
  {
    "name": "BMS Evening College of Engineering (Basavanagudi)",
    "short": "BECE",
    "city": "Bengaluru"
  },
  {
    "name": "S.C.T. Institute of Technology (Kaggadasapura)",
    "short": "SIT",
    "city": "Bengaluru"
  },
  {
    "name": "Shridevi Institute of Engineering and Technology (Tumkur - Bengaluru Rural)",
    "short": "SIET",
    "city": "Bengaluru"
  },
  {
    "name": "SJB Institute of Technology",
    "short": "SIT",
    "city": "Bengaluru"
  },
  {
    "name": "RV University (Mysore Road)",
    "short": "RU",
    "city": "Bengaluru"
  },
  {
    "name": "MS Ramaiah University of Applied Sciences (MSR Nagar)",
    "short": "MRUA",
    "city": "Bengaluru"
  },
  {
    "name": "Azim Premji University (Sarjapur Road)",
    "short": "APU",
    "city": "Bengaluru"
  },
  {
    "name": "Bengaluru North University (Tamaka, Kolar Road - Bengaluru Rural)",
    "short": "BNU",
    "city": "Bengaluru"
  },
  {
    "name": "Bengaluru City University (Central College Campus)",
    "short": "BCU",
    "city": "Bengaluru"
  },
  {
    "name": "NITTE University - Bengaluru Campus (Yelahanka)",
    "short": "NUBC",
    "city": "Bengaluru"
  },
  {
    "name": "Symbiosis International University - Bengaluru (Electronic City)",
    "short": "SIUB",
    "city": "Bengaluru"
  },
  {
    "name": "Manipal Academy of Higher Education - Bengaluru Campus (Yelahanka)",
    "short": "MAHE",
    "city": "Bengaluru"
  },
  {
    "name": "S-VYASA University (Jigani)",
    "short": "JIGANI",
    "city": "Bengaluru"
  },
  {
    "name": "Garden City University (Virgonagar)",
    "short": "GCU",
    "city": "Bengaluru"
  },
  {
    "name": "KLE Technological University - Bengaluru Campus",
    "short": "KTUB",
    "city": "Bengaluru"
  },
  {
    "name": "CMR University",
    "short": "CU",
    "city": "Bengaluru"
  },
  {
    "name": "Dayananda Sagar University",
    "short": "DSU",
    "city": "Bengaluru"
  },
  {
    "name": "Seshadripuram First Grade College (Seshadripuram)",
    "short": "SFGC",
    "city": "Bengaluru"
  },
  {
    "name": "BMS College for Women (Basavanagudi)",
    "short": "BCW",
    "city": "Bengaluru"
  },
  {
    "name": "Maharani Lakshmi Ammanni College for Women (Malleshwaram)",
    "short": "MLAC",
    "city": "Bengaluru"
  },
  {
    "name": "Government Arts College, KR Circle",
    "short": "GACK",
    "city": "Bengaluru"
  },
  {
    "name": "Acharya Institute of Graduate Studies (Soladevanahalli)",
    "short": "AIGS",
    "city": "Bengaluru"
  },
  {
    "name": "Acharya Institute of Management & Sciences (Peenya)",
    "short": "PEENYA",
    "city": "Bengaluru"
  },
  {
    "name": "Al-Ameen Arts, Science & Commerce College (Hosur Road)",
    "short": "AASC",
    "city": "Bengaluru"
  },
  {
    "name": "Presidency College (Hebbal)",
    "short": "HEBBAL",
    "city": "Bengaluru"
  },
  {
    "name": "City College (Jayanagar)",
    "short": "CC",
    "city": "Bengaluru"
  },
  {
    "name": "Christ Academy Institute for Advanced Studies (Begur)",
    "short": "BEGUR",
    "city": "Bengaluru"
  },
  {
    "name": "BES College (Jayanagar)",
    "short": "BC",
    "city": "Bengaluru"
  },
  {
    "name": "Silicon City College (Konanakunte)",
    "short": "SCC",
    "city": "Bengaluru"
  },
  {
    "name": "Krupanidhi College (Chikka Bellandur)",
    "short": "KC",
    "city": "Bengaluru"
  },
  {
    "name": "Krupanidhi Degree College (Carmelaram)",
    "short": "KDC",
    "city": "Bengaluru"
  },
  {
    "name": "Vidya Sanskaar Institute of Science, Commerce & Management (K.R. Puram)",
    "short": "VSIS",
    "city": "Bengaluru"
  },
  {
    "name": "Sri Sai Institute of Management Science (Hesaraghatta)",
    "short": "SSIM",
    "city": "Bengaluru"
  },
  {
    "name": "MVM College of Speech and Hearing (Yelahanka)",
    "short": "MCSH",
    "city": "Bengaluru"
  },
  {
    "name": "Columbia College (Ganganagar)",
    "short": "CC",
    "city": "Bengaluru"
  },
  {
    "name": "Ramnarayan Chellaram College of Commerce (Lalbagh Road)",
    "short": "RCCC",
    "city": "Bengaluru"
  },
  {
    "name": "S.B. College of Management Studies (Yelahanka)",
    "short": "SCMS",
    "city": "Bengaluru"
  },
  {
    "name": "Srushti College (Yelahanka)",
    "short": "SC",
    "city": "Bengaluru"
  },
  {
    "name": "St. Paul's College (Nagasandra)",
    "short": "SPC",
    "city": "Bengaluru"
  },
  {
    "name": "St. Francis College (Koramangala)",
    "short": "SFC",
    "city": "Bengaluru"
  },
  {
    "name": "Bishop Cotton Women's Christian College (Mission Road)",
    "short": "BCWC",
    "city": "Bengaluru"
  },
  {
    "name": "Indian Academy Degree College (Hennur)",
    "short": "HENNUR",
    "city": "Bengaluru"
  },
  {
    "name": "Garden City College of Science & Management (Virgonagar)",
    "short": "GCCS",
    "city": "Bengaluru"
  },
  {
    "name": "IFIM College (Electronic City)",
    "short": "IC",
    "city": "Bengaluru"
  },
  {
    "name": "IIFA Lancaster Degree College (Kalyan Nagar)",
    "short": "ILDC",
    "city": "Bengaluru"
  },
  {
    "name": "Jain College (VV Puram / Jayanagar)",
    "short": "JC",
    "city": "Bengaluru"
  },
  {
    "name": "Baldwin Methodist College (Richmond Road)",
    "short": "BMC",
    "city": "Bengaluru"
  },
  {
    "name": "Baldwin Women's Methodist College (Richmond Road)",
    "short": "BWMC",
    "city": "Bengaluru"
  },
  {
    "name": "Oxford College of Science (HSR Layout)",
    "short": "OCS",
    "city": "Bengaluru"
  },
  {
    "name": "Oxford College of Arts (HSR Layout)",
    "short": "OCA",
    "city": "Bengaluru"
  },
  {
    "name": "The Oxford College of Business Management (HSR Layout)",
    "short": "OCBM",
    "city": "Bengaluru"
  },
  {
    "name": "Reva Independent PU / Degree College (Ganganagar)",
    "short": "RIPD",
    "city": "Bengaluru"
  },
  {
    "name": "Surana College (Peenya / Kengeri)",
    "short": "SC",
    "city": "Bengaluru"
  },
  {
    "name": "Soundarya Institute of Management and Science (Sidedahalli)",
    "short": "SIMS",
    "city": "Bengaluru"
  },
  {
    "name": "East West First Grade College (Magadi Road)",
    "short": "EWFG",
    "city": "Bengaluru"
  },
  {
    "name": "Dayananda Sagar Business Academy (Kumaraswamy Layout)",
    "short": "DSBA",
    "city": "Bengaluru"
  },
  {
    "name": "AIMS Institute of Higher Education (Peenya)",
    "short": "PEENYA",
    "city": "Bengaluru"
  },
  {
    "name": "Administrative Management College (Bannerghatta Road)",
    "short": "AMC",
    "city": "Bengaluru"
  },
  {
    "name": "Anupama College of Management and Science (Mahalakshmipuram)",
    "short": "ACMS",
    "city": "Bengaluru"
  },
  {
    "name": "ASC Degree College (Rajajinagar)",
    "short": "ADC",
    "city": "Bengaluru"
  },
  {
    "name": "Bangalore City College (Kalyan Nagar)",
    "short": "BCC",
    "city": "Bengaluru"
  },
  {
    "name": "Bangalore Institute of Management Studies (Bannerghatta Road)",
    "short": "BIMS",
    "city": "Bengaluru"
  },
  {
    "name": "Don Bosco College of Science and Management (Hosur Road)",
    "short": "DBCS",
    "city": "Bengaluru"
  },
  {
    "name": "Florence Degree College (Electronic City)",
    "short": "FDC",
    "city": "Bengaluru"
  },
  {
    "name": "Gupta College (BSK 3rd Stage)",
    "short": "GC",
    "city": "Bengaluru"
  },
  {
    "name": "SJR College for Women (Rajajinagar)",
    "short": "SCW",
    "city": "Bengaluru"
  },
  {
    "name": "SJRC Arts, Science and Commerce College (Rajajinagar)",
    "short": "SASC",
    "city": "Bengaluru"
  },
  {
    "name": "Government First Grade College, K.R. Puram",
    "short": "GFGC",
    "city": "Bengaluru"
  },
  {
    "name": "Government First Grade College, Yelahanka",
    "short": "GFGC",
    "city": "Bengaluru"
  },
  {
    "name": "Government First Grade College, Hesaraghatta",
    "short": "GFGC",
    "city": "Bengaluru"
  },
  {
    "name": "ESIC Medical College & PGIMSR (Rajajinagar)",
    "short": "EMCP",
    "city": "Bengaluru"
  },
  {
    "name": "BGS Medical College & Hospital (Nagarur)",
    "short": "NAGARUR",
    "city": "Bengaluru"
  },
  {
    "name": "BGS Global Institute of Medical Sciences (Uttarahalli)",
    "short": "BGIM",
    "city": "Bengaluru"
  },
  {
    "name": "East Point College of Medical Sciences & Research Centre (Bidarahalli)",
    "short": "EPCM",
    "city": "Bengaluru"
  },
  {
    "name": "Hosmat Institute of Medical Sciences (Magadi Road)",
    "short": "HIMS",
    "city": "Bengaluru"
  },
  {
    "name": "Akash Institute of Medical Sciences & Research Centre (Devanahalli)",
    "short": "AIMS",
    "city": "Bengaluru"
  },
  {
    "name": "Kidwai Memorial Institute of Oncology (Hosur Road)",
    "short": "KMIO",
    "city": "Bengaluru"
  },
  {
    "name": "Shri Atal Bihari Vajpayee Medical College & Research Institute (Shivajinagar)",
    "short": "SABV",
    "city": "Bengaluru"
  },
  {
    "name": "NIMHANS (Hosur Road)",
    "short": "N",
    "city": "Bengaluru"
  },
  {
    "name": "Bangalore Institute of Dental Sciences & Hospital (Hosur Road)",
    "short": "BIDS",
    "city": "Bengaluru"
  },
  {
    "name": "BGS Global Institute of Dental Sciences (Uttarahalli)",
    "short": "BGID",
    "city": "Bengaluru"
  },
  {
    "name": "D.A. Pandu Memorial R.V. Dental College (JP Nagar)",
    "short": "JP NAGAR",
    "city": "Bengaluru"
  },
  {
    "name": "Government Dental College & Research Institute (Victoria Hospital)",
    "short": "GDCR",
    "city": "Bengaluru"
  },
  {
    "name": "KLE Society's Institute of Dental Sciences (Yeshwanthpur)",
    "short": "KSID",
    "city": "Bengaluru"
  },
  {
    "name": "Krishnadevaraya College of Dental Sciences & Hospital (Yelahanka)",
    "short": "KCDS",
    "city": "Bengaluru"
  },
  {
    "name": "M.R. Ambedkar Dental College (Malleshwaram)",
    "short": "MADC",
    "city": "Bengaluru"
  },
  {
    "name": "M.S. Ramaiah Dental College (MSR Nagar)",
    "short": "MRDC",
    "city": "Bengaluru"
  },
  {
    "name": "Maaruti College of Dental Sciences & Research Centre (Yelahanka)",
    "short": "MCDS",
    "city": "Bengaluru"
  },
  {
    "name": "Sri Rajiv Gandhi College of Dental Sciences (Cholanagar)",
    "short": "SRGC",
    "city": "Bengaluru"
  },
  {
    "name": "Sri Venkateshwara Dental College & Hospital (Bidadi)",
    "short": "BIDADI",
    "city": "Bengaluru"
  },
  {
    "name": "Vydehi Institute of Dental Sciences & Research (Whitefield)",
    "short": "VIDS",
    "city": "Bengaluru"
  },
  {
    "name": "AECS Maaruti College of Dental Sciences (Kamakshipalya)",
    "short": "AMCD",
    "city": "Bengaluru"
  },
  {
    "name": "Vokkaligara Sangha Dental College & Hospital (KR Road)",
    "short": "VSDC",
    "city": "Bengaluru"
  },
  {
    "name": "Kengal Hanumanthaiah Institute of Physiotherapy (KR Road)",
    "short": "KHIP",
    "city": "Bengaluru"
  },
  {
    "name": "K.T.G. College of Physiotherapy (Hegganahalli)",
    "short": "KCP",
    "city": "Bengaluru"
  },
  {
    "name": "Lakeside College of Physiotherapy (Jigani)",
    "short": "JIGANI",
    "city": "Bengaluru"
  },
  {
    "name": "Little Flower College of Physiotherapy (Rajajinagar)",
    "short": "LFCP",
    "city": "Bengaluru"
  },
  {
    "name": "M.G.P. College of Physiotherapy (Hosakerehalli)",
    "short": "MCP",
    "city": "Bengaluru"
  },
  {
    "name": "Manjunatha College of Physiotherapy (Kengeri)",
    "short": "KENGERI",
    "city": "Bengaluru"
  },
  {
    "name": "MVM College of Physiotherapy (Yelahanka)",
    "short": "MCP",
    "city": "Bengaluru"
  },
  {
    "name": "Narayana Hrudayalaya Institute of Physiotherapy (Bommasandra)",
    "short": "NHIP",
    "city": "Bengaluru"
  },
  {
    "name": "Nargund College of Physiotherapy (Banashankari)",
    "short": "NCP",
    "city": "Bengaluru"
  },
  {
    "name": "RV College of Physiotherapy (Jayanagar)",
    "short": "RCP",
    "city": "Bengaluru"
  },
  {
    "name": "Kempegowda Institute of Physiotherapy (VV Puram)",
    "short": "VV PURAM",
    "city": "Bengaluru"
  },
  {
    "name": "MS Ramaiah College of Physiotherapy (MSR Nagar)",
    "short": "MRCP",
    "city": "Bengaluru"
  },
  {
    "name": "The Oxford College of Physiotherapy (HSR Layout)",
    "short": "OCP",
    "city": "Bengaluru"
  },
  {
    "name": "Krupanidhi College of Physiotherapy (Carmelaram)",
    "short": "KCP",
    "city": "Bengaluru"
  },
  {
    "name": "Acharya's NR Institute of Physiotherapy (Soladevanahalli)",
    "short": "ANIP",
    "city": "Bengaluru"
  },
  {
    "name": "Aditya College of Physiotherapy (Yelahanka)",
    "short": "ACP",
    "city": "Bengaluru"
  },
  {
    "name": "CMR College of Physiotherapy (HRBR Layout)",
    "short": "CCP",
    "city": "Bengaluru"
  },
  {
    "name": "Acharya & B.M. Reddy College of Pharmacy (Soladevanahalli)",
    "short": "ABRC",
    "city": "Bengaluru"
  },
  {
    "name": "Al-Ameen College of Pharmacy (Hosur Road)",
    "short": "ACP",
    "city": "Bengaluru"
  },
  {
    "name": "East West College of Pharmacy (Magadi Road)",
    "short": "EWCP",
    "city": "Bengaluru"
  },
  {
    "name": "Krupanidhi College of Pharmacy (Carmelaram)",
    "short": "KCP",
    "city": "Bengaluru"
  },
  {
    "name": "The Oxford College of Pharmacy (HSR Layout)",
    "short": "OCP",
    "city": "Bengaluru"
  },
  {
    "name": "Visveswarapura Institute of Pharmaceutical Sciences (Kengeri)",
    "short": "KENGERI",
    "city": "Bengaluru"
  },
  {
    "name": "MES College of Pharmacy (Aradeshahalli)",
    "short": "MCP",
    "city": "Bengaluru"
  },
  {
    "name": "Government College of Nursing (Victoria Hospital Campus)",
    "short": "GCN",
    "city": "Bengaluru"
  },
  {
    "name": "St. Martha's College of Nursing (Nrupathunga Road)",
    "short": "SMCN",
    "city": "Bengaluru"
  },
  {
    "name": "St. John's College of Nursing (Koramangala)",
    "short": "SJCN",
    "city": "Bengaluru"
  },
  {
    "name": "Rajiv Gandhi College of Nursing (Jalahalli)",
    "short": "RGCN",
    "city": "Bengaluru"
  },
  {
    "name": "Kempegowda Institute of Nursing (VV Puram)",
    "short": "VV PURAM",
    "city": "Bengaluru"
  },
  {
    "name": "Vydehi Institute of Nursing Sciences (Whitefield)",
    "short": "VINS",
    "city": "Bengaluru"
  },
  {
    "name": "Ramaiah College of Law (MSR Nagar)",
    "short": "RCL",
    "city": "Bengaluru"
  },
  {
    "name": "Kristu Jayanti College of Law (Kothanur)",
    "short": "KOTHANUR",
    "city": "Bengaluru"
  },
  {
    "name": "Bangalore Institute of Legal Studies (Vijayanagar)",
    "short": "BILS",
    "city": "Bengaluru"
  },
  {
    "name": "St. Joseph's College of Law (Langford Road)",
    "short": "SJCL",
    "city": "Bengaluru"
  },
  {
    "name": "KLE Law College (Rajajinagar)",
    "short": "KLC",
    "city": "Bengaluru"
  },
  {
    "name": "RV Institute of Legal Studies (Jayanagar)",
    "short": "RILS",
    "city": "Bengaluru"
  },
  {
    "name": "AL-Ameen College of Law (Hosur Road)",
    "short": "ACL",
    "city": "Bengaluru"
  },
  {
    "name": "University Law College, Bangalore University (Central College)",
    "short": "ULCB",
    "city": "Bengaluru"
  },
  {
    "name": "BMS College of Architecture",
    "short": "BCA",
    "city": "Bengaluru"
  },
  {
    "name": "RV College of Architecture (RVCA Mysore Road)",
    "short": "RCA",
    "city": "Bengaluru"
  },
  {
    "name": "Acharya's NRV School of Architecture (Soladevanahalli)",
    "short": "ANSA",
    "city": "Bengaluru"
  },
  {
    "name": "BGS School of Architecture & Planning (Mahalakshmipuram)",
    "short": "BSAP",
    "city": "Bengaluru"
  },
  {
    "name": "Dayananda Sagar College of Architecture (Kumaraswamy Layout)",
    "short": "DSCA",
    "city": "Bengaluru"
  },
  {
    "name": "Wadiyar Centre for Architecture (Mysore Road)",
    "short": "WCA",
    "city": "Bengaluru"
  },
  {
    "name": "Karnataka Chitrakala Parishath College of Fine Arts (Kumara Krupa Road)",
    "short": "KCPC",
    "city": "Bengaluru"
  },
  {
    "name": "Army Institute of Fashion & Design (Kothanur)",
    "short": "KOTHANUR",
    "city": "Bengaluru"
  },
  {
    "name": "Army Institute of Hotel Management & Catering (Kothanur)",
    "short": "KOTHANUR",
    "city": "Bengaluru"
  }
];

const College = require('./colleges.model');

// Helper to get combined colleges (static seed + database approved colleges)
async function getAllApprovedColleges() {
  try {
    const dbColleges = await College.find({ status: 'approved' }).lean();
    const map = new Map();
    // Static base
    for (const c of COLLEGES) {
      map.set(c.name.toLowerCase().trim(), c);
    }
    // DB additions / overrides
    for (const c of dbColleges) {
      map.set(c.name.toLowerCase().trim(), {
        name: c.name,
        short: c.short || '',
        city: c.city || 'Bengaluru',
        _id: c._id,
      });
    }
    return Array.from(map.values());
  } catch (err) {
    return COLLEGES;
  }
}

// GET /api/colleges and /api/colleges/search?q=xyz or ?search=xyz
async function handleCollegeSearch(req, res) {
  const q = (req.query.q || req.query.search || '').trim().toLowerCase();
  const all = await getAllApprovedColleges();
  if (!q) {
    return res.json(all);
  }
  const filtered = all.filter(c =>
    (c.name && c.name.toLowerCase().includes(q)) ||
    (c.short && c.short.toLowerCase().includes(q)) ||
    (c.city && c.city.toLowerCase().includes(q))
  );
  res.json(filtered.slice(0, 100));
}

router.get('/', handleCollegeSearch);
router.get('/search', handleCollegeSearch);

// GET /api/colleges/all
router.get('/all', async (req, res) => {
  const all = await getAllApprovedColleges();
  res.json(all);
});

router.COLLEGES = COLLEGES;
router.getAllApprovedColleges = getAllApprovedColleges;
module.exports = router;
