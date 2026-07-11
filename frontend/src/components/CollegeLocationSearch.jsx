import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as api from '../services/api.js';
import './LocationSearch.css';

export default function CollegeLocationSearch({ value, onChange, placeholder, className }) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceTimer = useRef(null);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Sync internal state with value prop
  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  // Get Bangalore colleges only - use fallback data immediately
  const getBangaloreColleges = useCallback(async (searchQuery) => {
    try {
      setLoading(true);
      console.log('Searching Bangalore colleges for:', searchQuery);
      
      // Comprehensive Bangalore college database - all types of institutions
      const fallbackColleges = [
        // Engineering Colleges
        { label: 'RV College of Engineering', display_name: 'RV College of Engineering, Bangalore', lat: 12.9215, lng: 77.4958 },
        { label: 'BMS College of Engineering', display_name: 'BMS College of Engineering, Bangalore', lat: 12.9611, lng: 77.5908 },
        { label: 'PES University', display_name: 'PES University, Bangalore', lat: 12.9345, lng: 77.5366 },
        { label: 'MS Ramaiah Institute of Technology', display_name: 'MS Ramaiah Institute of Technology, Bangalore', lat: 13.0163, lng: 77.5770 },
        { label: 'Bangalore Institute of Technology', display_name: 'Bangalore Institute of Technology (BIT), Bangalore', lat: 12.9539, lng: 77.6007 },
        { label: 'UVCE', display_name: 'University Visvesvaraya College of Engineering, Bangalore', lat: 12.9629, lng: 77.5709 },
        { label: 'Sir M Visvesvaraya Institute of Technology', display_name: 'Sir M Visvesvaraya Institute of Technology, Bangalore', lat: 13.1253, lng: 77.5686 },
        { label: 'Dayananda Sagar College of Engineering', display_name: 'Dayananda Sagar College of Engineering, Bangalore', lat: 12.9116, lng: 77.5834 },
        { label: 'Acharya Institute of Technology', display_name: 'Acharya Institute of Technology, Bangalore', lat: 13.1296, lng: 77.6376 },
        { label: 'Nitte Meenakshi Institute of Technology', display_name: 'Nitte Meenakshi Institute of Technology, Bangalore', lat: 13.1123, lng: 77.6452 },
        { label: 'RNS Institute of Technology', display_name: 'RNS Institute of Technology, Bangalore', lat: 13.0915, lng: 77.5579 },
        { label: 'Sapthagiri College of Engineering', display_name: 'Sapthagiri College of Engineering, Bangalore', lat: 13.0279, lng: 77.5732 },
        { label: 'Don Bosco Institute of Technology', display_name: 'Don Bosco Institute of Technology, Bangalore', lat: 12.9064, lng: 77.5637 },
        { label: 'East West College of Engineering', display_name: 'East West College of Engineering, Bangalore', lat: 12.9372, lng: 77.6223 },
        { label: 'Vijaya College of Engineering', display_name: 'Vijaya College of Engineering, Bangalore', lat: 12.9234, lng: 77.5412 },
        { label: 'AMC Engineering College', display_name: 'AMC Engineering College, Bangalore', lat: 12.9178, lng: 77.5621 },
        { label: 'Reva Institute of Technology', display_name: 'Reva Institute of Technology, Bangalore', lat: 13.1314, lng: 77.6342 },
        { label: 'Oxford College of Engineering', display_name: 'Oxford College of Engineering, Bangalore', lat: 12.9187, lng: 77.5698 },
        { label: 'Nagarjuna College of Engineering', display_name: 'Nagarjuna College of Engineering, Bangalore', lat: 13.0567, lng: 77.5789 },
        { label: 'International Institute of Information Technology', display_name: 'International Institute of Information Technology, Bangalore', lat: 12.9892, lng: 77.6587 },
        { label: 'New Horizon College of Engineering', display_name: 'New Horizon College of Engineering, Bangalore', lat: 13.0803, lng: 77.6432 },
        { label: 'Vivekananda College of Engineering', display_name: 'Vivekananda College of Engineering, Bangalore', lat: 12.9176, lng: 77.5641 },
        { label: 'SJB Institute of Technology', display_name: 'SJB Institute of Technology, Bangalore', lat: 12.9216, lng: 77.4958 },
        { label: 'Sri Venkateshwara College of Engineering', display_name: 'Sri Venkateshwara College of Engineering, Bangalore', lat: 13.0184, lng: 77.5675 },
        { label: 'BMS Institute of Technology', display_name: 'BMS Institute of Technology (BMSIT), Bangalore', lat: 12.9189, lng: 77.5601 },
        { label: 'Ghousia College of Engineering', display_name: 'Ghousia College of Engineering, Bangalore', lat: 12.9456, lng: 77.5712 },
        { label: 'Maharaja Institute of Technology', display_name: 'Maharaja Institute of Technology, Bangalore', lat: 12.9043, lng: 77.5789 },
        { label: 'KLE Society College of Engineering', display_name: 'KLE Society College of Engineering, Bangalore', lat: 12.9267, lng: 77.5634 },
        { label: 'Dr. Ambedkar Institute of Technology', display_name: 'Dr. Ambedkar Institute of Technology, Bangalore', lat: 13.0176, lng: 77.5698 },
        { label: 'Sri Krishna Institute of Technology', display_name: 'Sri Krishna Institute of Technology, Bangalore', lat: 13.0896, lng: 77.5723 },
        { label: 'Atria Institute of Technology', display_name: 'Atria Institute of Technology, Bangalore', lat: 13.0245, lng: 77.5896 },
        
        // Medical Colleges and Universities
        { label: 'Bangalore Medical College and Research Institute', display_name: 'Bangalore Medical College and Research Institute, Bangalore', lat: 12.9716, lng: 77.5946 },
        { label: 'St. Johns Medical College', display_name: 'St. Johns Medical College, Bangalore', lat: 12.9456, lng: 77.5812 },
        { label: 'Kempegowda Institute of Medical Sciences', display_name: 'Kempegowda Institute of Medical Sciences, Bangalore', lat: 12.9678, lng: 77.5923 },
        { label: 'MS Ramaiah Medical College', display_name: 'MS Ramaiah Medical College, Bangalore', lat: 13.0163, lng: 77.5770 },
        { label: 'Dr. B.R. Ambedkar Medical College', display_name: 'Dr. B.R. Ambedkar Medical College, Bangalore', lat: 13.0176, lng: 77.5698 },
        { label: 'Vydehi Institute of Medical Sciences', display_name: 'Vydehi Institute of Medical Sciences, Bangalore', lat: 12.9456, lng: 77.5712 },
        { label: 'Sapthagiri Institute of Medical Sciences', display_name: 'Sapthagiri Institute of Medical Sciences, Bangalore', lat: 13.0279, lng: 77.5732 },
        { label: 'Sri Devaraj Urs Medical College', display_name: 'Sri Devaraj Urs Medical College, Bangalore', lat: 12.9456, lng: 77.5712 },
        { label: 'Rajarajeswari Medical College and Hospital', display_name: 'Rajarajeswari Medical College and Hospital, Bangalore', lat: 12.9234, lng: 77.4978 },
        { label: 'A.J. Institute of Medical Sciences', display_name: 'A.J. Institute of Medical Sciences, Bangalore', lat: 12.9456, lng: 77.5712 },
        { label: 'East Point College of Medical Sciences', display_name: 'East Point College of Medical Sciences, Bangalore', lat: 13.0245, lng: 77.5896 },
        { label: 'Siddhartha Medical College', display_name: 'Siddhartha Medical College, Bangalore', lat: 12.9456, lng: 77.5712 },
        { label: 'Al-Ameen Medical College', display_name: 'Al-Ameen Medical College, Bangalore', lat: 12.9456, lng: 77.5712 },
        { label: 'Khaja Banda Nawaz Institute of Medical Sciences', display_name: 'Khaja Banda Nawaz Institute of Medical Sciences, Bangalore', lat: 12.9456, lng: 77.5712 },
        
        // Dental Colleges
        { label: 'MS Ramaiah Dental College', display_name: 'MS Ramaiah Dental College, Bangalore', lat: 13.0163, lng: 77.5770 },
        { label: 'BMS Dental College', display_name: 'BMS Dental College, Bangalore', lat: 12.9611, lng: 77.5908 },
        { label: 'RV Dental College', display_name: 'RV Dental College, Bangalore', lat: 12.9215, lng: 77.4958 },
        { label: 'Vijaya Dental College', display_name: 'Vijaya Dental College, Bangalore', lat: 12.9234, lng: 77.5412 },
        { label: 'Sri Venkateshwara Dental College', display_name: 'Sri Venkateshwara Dental College, Bangalore', lat: 13.0184, lng: 77.5675 },
        { label: 'KLE Societys Dental College', display_name: 'KLE Societys Dental College, Bangalore', lat: 12.9267, lng: 77.5634 },
        { label: 'Dayananda Sagar College of Dental Sciences', display_name: 'Dayananda Sagar College of Dental Sciences, Bangalore', lat: 12.9116, lng: 77.5834 },
        { label: 'AECS Maaruti College of Dental Sciences', display_name: 'AECS Maaruti College of Dental Sciences, Bangalore', lat: 12.9456, lng: 77.5712 },
        { label: 'Oxford Dental College', display_name: 'Oxford Dental College, Bangalore', lat: 12.9187, lng: 77.5698 },
        { label: 'Krishnadevaraya College of Dental Sciences', display_name: 'Krishnadevaraya College of Dental Sciences, Bangalore', lat: 12.9456, lng: 77.5712 },
        
        // Universities
        { label: 'Christ University', display_name: 'Christ University, Bangalore', lat: 12.9345, lng: 77.6094 },
        { label: 'Jain University', display_name: 'Jain University, Bangalore', lat: 12.9351, lng: 77.5940 },
        { label: 'Presidency University', display_name: 'Presidency University, Bangalore', lat: 13.1306, lng: 77.6318 },
        { label: 'Alliance University', display_name: 'Alliance University, Bangalore', lat: 12.8925, lng: 77.5832 },
        { label: 'Bangalore University', display_name: 'Bangalore University, Bangalore', lat: 12.9716, lng: 77.5946 },
        { label: 'Visvesvaraya Technological University', display_name: 'Visvesvaraya Technological University (VTU), Bangalore', lat: 12.9629, lng: 77.5709 },
        { label: 'Rajiv Gandhi University of Health Sciences', display_name: 'Rajiv Gandhi University of Health Sciences, Bangalore', lat: 12.9456, lng: 77.5712 },
        { label: 'Karnataka State Open University', display_name: 'Karnataka State Open University, Bangalore', lat: 12.9456, lng: 77.5712 },
        { label: 'Garden City University', display_name: 'Garden City University, Bangalore', lat: 12.9456, lng: 77.5712 },
        { label: 'Reva University', display_name: 'Reva University, Bangalore', lat: 13.1314, lng: 77.6342 },
        { label: 'CMR University', display_name: 'CMR University, Bangalore', lat: 13.0456, lng: 77.6234 },
        { label: 'JSS Science and Technology University', display_name: 'JSS Science and Technology University, Bangalore', lat: 12.9456, lng: 77.5712 },
        { label: 'Sri Jayachamarajendra College of Engineering', display_name: 'Sri Jayachamarajendra College of Engineering (SJCE), Bangalore', lat: 12.9456, lng: 77.5712 },
        
        // Arts and Science Colleges
        { label: 'Mount Carmel College', display_name: 'Mount Carmel College, Bangalore', lat: 12.9867, lng: 77.5856 },
        { label: 'St. Josephs College', display_name: 'St. Josephs College, Bangalore', lat: 12.9716, lng: 77.6134 },
        { label: 'Jyoti Nivas College', display_name: 'Jyoti Nivas College, Bangalore', lat: 12.9456, lng: 77.5812 },
        { label: 'Maharani Lakshmi Ammanni College for Women', display_name: 'Maharani Lakshmi Ammanni College for Women, Bangalore', lat: 12.9456, lng: 77.5712 },
        { label: 'Mount Carmel College of Arts Science and Commerce', display_name: 'Mount Carmel College of Arts Science and Commerce, Bangalore', lat: 12.9867, lng: 77.5856 },
        { label: 'Christ College', display_name: 'Christ College, Bangalore', lat: 12.9345, lng: 77.6094 },
        { label: 'Jain College', display_name: 'Jain College, Bangalore', lat: 12.9351, lng: 77.5940 },
        { label: 'Presidency College', display_name: 'Presidency College, Bangalore', lat: 13.1306, lng: 77.6318 },
        { label: 'Vijaya College', display_name: 'Vijaya College, Bangalore', lat: 12.9234, lng: 77.5412 },
        { label: 'NMKRV College for Women', display_name: 'NMKRV College for Women, Bangalore', lat: 12.9456, lng: 77.5712 },
        { label: 'MES College of Arts Science and Commerce', display_name: 'MES College of Arts Science and Commerce, Bangalore', lat: 12.9456, lng: 77.5712 },
        { label: 'Vivekananda College', display_name: 'Vivekananda College, Bangalore', lat: 12.9456, lng: 77.5712 },
        { label: 'National College', display_name: 'National College, Bangalore', lat: 12.9456, lng: 77.5712 },
        { label: 'Sri Bhagawan Mahaveer Jain College', display_name: 'Sri Bhagawan Mahaveer Jain College, Bangalore', lat: 12.9351, lng: 77.5940 },
        
        // Management Colleges
        { label: 'Indian Institute of Management Bangalore', display_name: 'Indian Institute of Management Bangalore (IIMB), Bangalore', lat: 12.9919, lng: 77.5716 },
        { label: 'Xavier Institute of Management and Entrepreneurship', display_name: 'Xavier Institute of Management and Entrepreneurship (XIME), Bangalore', lat: 12.9456, lng: 77.5712 },
        { label: 'PES University Management Studies', display_name: 'PES University Management Studies, Bangalore', lat: 12.9345, lng: 77.5366 },
        { label: 'Christ University Management', display_name: 'Christ University Management, Bangalore', lat: 12.9345, lng: 77.6094 },
        { label: 'Jain University Management', display_name: 'Jain University Management, Bangalore', lat: 12.9351, lng: 77.5940 },
        { label: 'Alliance School of Management', display_name: 'Alliance School of Management, Bangalore', lat: 12.8925, lng: 77.5832 },
        { label: 'Presidency College of Management', display_name: 'Presidency College of Management, Bangalore', lat: 13.1306, lng: 77.6318 },
        { label: 'IFIM Business School', display_name: 'IFIM Business School, Bangalore', lat: 12.9456, lng: 77.5712 },
        { label: 'Woxsen School of Business', display_name: 'Woxsen School of Business, Bangalore', lat: 12.9456, lng: 77.5712 },
        { label: 'International School of Management Excellence', display_name: 'International School of Management Excellence, Bangalore', lat: 12.9456, lng: 77.5712 },
        
        // Law Colleges
        { label: 'National Law School of India University', display_name: 'National Law School of India University (NLSIU), Bangalore', lat: 12.9456, lng: 77.5712 },
        { label: 'Christ College of Law', display_name: 'Christ College of Law, Bangalore', lat: 12.9345, lng: 77.6094 },
        { label: 'Jain University Law College', display_name: 'Jain University Law College, Bangalore', lat: 12.9351, lng: 77.5940 },
        { label: 'Presidency College of Law', display_name: 'Presidency College of Law, Bangalore', lat: 13.1306, lng: 77.6318 },
        { label: 'Bangalore Institute of Legal Studies', display_name: 'Bangalore Institute of Legal Studies, Bangalore', lat: 12.9456, lng: 77.5712 },
        { label: 'KLE Societys Law College', display_name: 'KLE Societys Law College, Bangalore', lat: 12.9267, lng: 77.5634 },
        { label: 'Sri Krishna Law College', display_name: 'Sri Krishna Law College, Bangalore', lat: 13.0896, lng: 77.5723 },
        { label: 'Vijaya Law College', display_name: 'Vijaya Law College, Bangalore', lat: 12.9234, lng: 77.5412 },
        { label: 'MS Ramaiah College of Law', display_name: 'MS Ramaiah College of Law, Bangalore', lat: 13.0163, lng: 77.5770 },
        { label: 'Dayananda Sagar College of Law', display_name: 'Dayananda Sagar College of Law, Bangalore', lat: 12.9116, lng: 77.5834 },
        
        // Pharmacy Colleges
        { label: 'MS Ramaiah College of Pharmacy', display_name: 'MS Ramaiah College of Pharmacy, Bangalore', lat: 13.0163, lng: 77.5770 },
        { label: 'BMS College of Pharmacy', display_name: 'BMS College of Pharmacy, Bangalore', lat: 12.9611, lng: 77.5908 },
        { label: 'RV College of Pharmacy', display_name: 'RV College of Pharmacy, Bangalore', lat: 12.9215, lng: 77.4958 },
        { label: 'PES University College of Pharmacy', display_name: 'PES University College of Pharmacy, Bangalore', lat: 12.9345, lng: 77.5366 },
        { label: 'JSS College of Pharmacy', display_name: 'JSS College of Pharmacy, Bangalore', lat: 12.9456, lng: 77.5712 },
        { label: 'Sri Venkateshwara College of Pharmacy', display_name: 'Sri Venkateshwara College of Pharmacy, Bangalore', lat: 13.0184, lng: 77.5675 },
        { label: 'Dayananda Sagar College of Pharmacy', display_name: 'Dayananda Sagar College of Pharmacy, Bangalore', lat: 12.9116, lng: 77.5834 },
        { label: 'Al-Ameen College of Pharmacy', display_name: 'Al-Ameen College of Pharmacy, Bangalore', lat: 12.9456, lng: 77.5712 },
        { label: 'Oxford College of Pharmacy', display_name: 'Oxford College of Pharmacy, Bangalore', lat: 12.9187, lng: 77.5698 },
        { label: 'KLE Societys College of Pharmacy', display_name: 'KLE Societys College of Pharmacy, Bangalore', lat: 12.9267, lng: 77.5634 },
        
        // Architecture Colleges
        { label: 'BMS College of Architecture', display_name: 'BMS College of Architecture, Bangalore', lat: 12.9587, lng: 77.5923 },
        { label: 'R V College of Architecture', display_name: 'R V College of Architecture, Bangalore', lat: 12.9234, lng: 77.4978 },
        { label: 'MS Ramaiah Institute of Technology Architecture', display_name: 'MS Ramaiah Institute of Technology Architecture, Bangalore', lat: 13.0163, lng: 77.5770 },
        { label: 'Dayananda Sagar College of Architecture', display_name: 'Dayananda Sagar College of Architecture, Bangalore', lat: 12.9116, lng: 77.5834 },
        { label: 'PES University Architecture', display_name: 'PES University Architecture, Bangalore', lat: 12.9345, lng: 77.5366 },
        { label: 'Jain University Architecture', display_name: 'Jain University Architecture, Bangalore', lat: 12.9351, lng: 77.5940 },
        { label: 'Christ University Architecture', display_name: 'Christ University Architecture, Bangalore', lat: 12.9345, lng: 77.6094 },
        { label: 'RV College of Architecture', display_name: 'RV College of Architecture, Bangalore', lat: 12.9215, lng: 77.4958 },
        { label: 'Acharya College of Architecture', display_name: 'Acharya College of Architecture, Bangalore', lat: 13.1296, lng: 77.6376 },
        { label: 'Nitte School of Architecture', display_name: 'Nitte School of Architecture, Bangalore', lat: 13.1123, lng: 77.6452 },
        
        // Nursing Colleges
        { label: 'R V College of Nursing', display_name: 'R V College of Nursing, Bangalore', lat: 12.9234, lng: 77.4978 },
        { label: 'MS Ramaiah College of Nursing', display_name: 'MS Ramaiah College of Nursing, Bangalore', lat: 13.0163, lng: 77.5770 },
        { label: 'BMS College of Nursing', display_name: 'BMS College of Nursing, Bangalore', lat: 12.9611, lng: 77.5908 },
        { label: 'St. Johns College of Nursing', display_name: 'St. Johns College of Nursing, Bangalore', lat: 12.9456, lng: 77.5812 },
        { label: 'Mount Carmel College of Nursing', display_name: 'Mount Carmel College of Nursing, Bangalore', lat: 12.9456, lng: 77.5712 },
        { label: 'Vydehi College of Nursing', display_name: 'Vydehi College of Nursing, Bangalore', lat: 12.9456, lng: 77.5712 },
        { label: 'Sapthagiri College of Nursing', display_name: 'Sapthagiri College of Nursing, Bangalore', lat: 13.0279, lng: 77.5732 },
        { label: 'KLE Societys College of Nursing', display_name: 'KLE Societys College of Nursing, Bangalore', lat: 12.9267, lng: 77.5634 },
        { label: 'Dayananda Sagar College of Nursing', display_name: 'Dayananda Sagar College of Nursing, Bangalore', lat: 12.9116, lng: 77.5834 },
        { label: 'Oxford College of Nursing', display_name: 'Oxford College of Nursing, Bangalore', lat: 12.9187, lng: 77.5698 },
        
        // Specialized Colleges
        { label: 'Garden City College', display_name: 'Garden City College, Bangalore', lat: 12.9456, lng: 77.5712 },
        { label: 'Garden City College of Engineering', display_name: 'Garden City College of Engineering, Bangalore', lat: 12.9456, lng: 77.5712 },
        { label: 'Garden City College of Science', display_name: 'Garden City College of Science, Bangalore', lat: 12.9456, lng: 77.5712 },
        { label: 'Garden City College of Commerce', display_name: 'Garden City College of Commerce, Bangalore', lat: 12.9456, lng: 77.5712 },
        { label: 'Garden City College of Management', display_name: 'Garden City College of Management, Bangalore', lat: 12.9456, lng: 77.5712 },
        { label: 'Indian Institute of Science', display_name: 'Indian Institute of Science (IISc), Bangalore', lat: 13.0238, lng: 77.5678 },
        { label: 'National Institute of Fashion Technology', display_name: 'National Institute of Fashion Technology (NIFT), Bangalore', lat: 12.9456, lng: 77.5712 },
        { label: 'National Institute of Design', display_name: 'National Institute of Design (NID), Bangalore', lat: 12.9456, lng: 77.5712 },
        { label: 'Srishti Institute of Art Design and Technology', display_name: 'Srishti Institute of Art Design and Technology, Bangalore', lat: 12.9456, lng: 77.5712 },
        { label: 'Woxsen University', display_name: 'Woxsen University, Bangalore', lat: 12.9456, lng: 77.5712 },
        { label: 'Azim Premji University', display_name: 'Azim Premji University, Bangalore', lat: 12.9456, lng: 77.5712 },
        { label: 'IIIT Bangalore', display_name: 'International Institute of Information Technology Bangalore, Bangalore', lat: 12.9892, lng: 77.6587 },
        { label: 'NCBS Bangalore', display_name: 'National Centre for Biological Sciences, Bangalore', lat: 13.0748, lng: 77.5999 },
        { label: 'JNCASR Bangalore', display_name: 'Jawaharlal Nehru Centre for Advanced Scientific Research, Bangalore', lat: 13.0238, lng: 77.5678 }
      ];
      
      // Always use fallback data for immediate results
      let collegeLocations = fallbackColleges;
      
      // Filter colleges based on search query
      if (searchQuery && searchQuery.length >= 1) {
        const searchLower = searchQuery.toLowerCase();
        collegeLocations = fallbackColleges.filter(college => {
          // More flexible matching - check if search term appears anywhere in college name
          const labelMatch = college.label.toLowerCase().includes(searchLower);
          const displayNameMatch = college.display_name.toLowerCase().includes(searchLower);
          
          // Also check for partial matches and common abbreviations
          const collegeWords = college.label.toLowerCase().split(' ');
          const displayWords = college.display_name.toLowerCase().split(' ');
          const partialMatch = collegeWords.some(word => word.startsWith(searchLower)) || 
                              displayWords.some(word => word.startsWith(searchLower));
          
          // Special handling for common abbreviations
          const abbreviationMatch = 
            (searchLower === 'bit' && college.label.toLowerCase().includes('bangalore institute of technology')) ||
            (searchLower === 'rv' && college.label.toLowerCase().includes('rv college')) ||
            (searchLower === 'bms' && college.label.toLowerCase().includes('bms')) ||
            (searchLower === 'pes' && college.label.toLowerCase().includes('pes')) ||
            (searchLower === 'uvce' && college.label.toLowerCase().includes('uvce')) ||
            (searchLower === 'iim' && college.label.toLowerCase().includes('indian institute of management')) ||
            (searchLower === 'nift' && college.label.toLowerCase().includes('national institute of fashion')) ||
            (searchLower === 'nid' && college.label.toLowerCase().includes('national institute of design')) ||
            (searchLower === 'iisc' && college.label.toLowerCase().includes('indian institute of science')) ||
            (searchLower === 'nlsiu' && college.label.toLowerCase().includes('national law school')) ||
            (searchLower === 'medical' && college.label.toLowerCase().includes('medical')) ||
            (searchLower === 'dental' && college.label.toLowerCase().includes('dental')) ||
            (searchLower === 'pharmacy' && college.label.toLowerCase().includes('pharmacy')) ||
            (searchLower === 'nursing' && college.label.toLowerCase().includes('nursing')) ||
            (searchLower === 'law' && college.label.toLowerCase().includes('law')) ||
            (searchLower === 'architecture' && college.label.toLowerCase().includes('architecture')) ||
            (searchLower === 'management' && college.label.toLowerCase().includes('management')) ||
            (searchLower === 'engineering' && college.label.toLowerCase().includes('engineering')) ||
            (searchLower === 'university' && college.label.toLowerCase().includes('university')) ||
            (searchLower === 'college' && college.label.toLowerCase().includes('college')) ||
            (searchLower === 'institute' && college.label.toLowerCase().includes('institute')) ||
            (searchLower === 'garden city' && college.label.toLowerCase().includes('garden city')) ||
            (searchLower === 'christ' && college.label.toLowerCase().includes('christ')) ||
            (searchLower === 'jain' && college.label.toLowerCase().includes('jain')) ||
            (searchLower === 'presidency' && college.label.toLowerCase().includes('presidency')) ||
            (searchLower === 'alliance' && college.label.toLowerCase().includes('alliance')) ||
            (searchLower === 'bangalore university' && college.label.toLowerCase().includes('bangalore university')) ||
            (searchLower === 'vtu' && college.label.toLowerCase().includes('visvesvaraya technological')) ||
            (searchLower === 'rajiv gandhi' && college.label.toLowerCase().includes('rajiv gandhi')) ||
            (searchLower === 'reva' && college.label.toLowerCase().includes('reva')) ||
            (searchLower === 'cmr' && college.label.toLowerCase().includes('cmr')) ||
            (searchLower === 'jss' && college.label.toLowerCase().includes('jss')) ||
            (searchLower === 'mount carmel' && college.label.toLowerCase().includes('mount carmel')) ||
            (searchLower === 'st josephs' && college.label.toLowerCase().includes('st josephs')) ||
            (searchLower === 'jyoti nivas' && college.label.toLowerCase().includes('jyoti nivas')) ||
            (searchLower === 'maharani' && college.label.toLowerCase().includes('maharani')) ||
            (searchLower === 'mes' && college.label.toLowerCase().includes('mes')) ||
            (searchLower === 'national college' && college.label.toLowerCase().includes('national college')) ||
            (searchLower === 'sri jayachamarajendra' && college.label.toLowerCase().includes('sri jayachamarajendra')) ||
            (searchLower === 'sjce' && college.label.toLowerCase().includes('sjce')) ||
            (searchLower === 'time' && college.label.toLowerCase().includes('time institute')) ||
            (searchLower === 'career launcher' && college.label.toLowerCase().includes('career launcher')) ||
            (searchLower === 'byjus' && college.label.toLowerCase().includes('byjus')) ||
            (searchLower === 'vedantu' && college.label.toLowerCase().includes('vedantu')) ||
            (searchLower === 'unacademy' && college.label.toLowerCase().includes('unacademy')) ||
            (searchLower === 'planet edu' && college.label.toLowerCase().includes('planet edu')) ||
            (searchLower === 'ims' && college.label.toLowerCase().includes('ims learning')) ||
            (searchLower === 'azim premji' && college.label.toLowerCase().includes('azim premji')) ||
            (searchLower === 'woxsen' && college.label.toLowerCase().includes('woxsen')) ||
            (searchLower === 'srishti' && college.label.toLowerCase().includes('srishti')) ||
            (searchLower === 'ncbs' && college.label.toLowerCase().includes('ncbs')) ||
            (searchLower === 'jncasr' && college.label.toLowerCase().includes('jncasr')) ||
            (searchLower === 'iiit' && college.label.toLowerCase().includes('iiit')) ||
            (searchLower === 'national centre' && college.label.toLowerCase().includes('national centre')) ||
            (searchLower === 'jawaharlal nehru' && college.label.toLowerCase().includes('jawaharlal nehru'));
          
          return labelMatch || displayNameMatch || partialMatch || abbreviationMatch;
        });
      }
      
      console.log('College search results:', collegeLocations);
      setSuggestions(collegeLocations);
    } catch (error) {
      console.error('College search failed:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const debouncedSearch = useCallback((searchQuery) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    if (searchQuery.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    
    debounceTimer.current = setTimeout(() => {
      getBangaloreColleges(searchQuery);
      setShowSuggestions(true);
    }, 200); // Reduced from 300ms to 200ms for faster response
  }, [getBangaloreColleges]);

  const handleSelect = (suggestion) => {
    console.log('College selected:', suggestion);
    console.log('Calling onChange with:', suggestion.label, suggestion.lat, suggestion.lng);
    setQuery(suggestion.label);
    onChange(suggestion.label, suggestion.lat, suggestion.lng);
    setShowSuggestions(false);
    setSuggestions([]);
    console.log('After onChange, query set to:', suggestion.label);
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setQuery(newValue);
    debouncedSearch(newValue);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleClickOutside = (e) => {
    if (containerRef.current && !containerRef.current.contains(e.target)) {
      setShowSuggestions(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return (
    <div className={`location-search ${className || ''}`} ref={containerRef}>
      <div className="location-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "Search for pickup location..."}
          className="location-input"
          onFocus={() => query.length >= 2 && setShowSuggestions(true)}
        />
      </div>
      
      {showSuggestions && (
        <div className="location-suggestions">
          {loading ? (
            <div className="suggestion-loading">
              <div className="loading-spinner"></div>
              <span>Loading colleges...</span>
            </div>
          ) : suggestions.length > 0 ? (
            suggestions.map((suggestion, index) => (
              <div
                key={index}
                className="suggestion-item"
                onMouseDown={() => handleSelect(suggestion)}
              >
                <div className="suggestion-label">{suggestion.label}</div>
                <div className="suggestion-address">{suggestion.display_name}</div>
              </div>
            ))
          ) : query.length >= 1 ? (
            <div className="suggestion-empty">
              <span>No colleges found</span>
              <small>Try: Medical, Dental, Engineering, Law, IIM, IISc, NIFT, BIT, Garden City</small>
            </div>
          ) : query.length > 0 ? (
            <div className="suggestion-empty">
              <span>Type to search colleges</span>
              <small>150+ institutions: Medical, Engineering, Universities, Arts, Law, Pharmacy</small>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
