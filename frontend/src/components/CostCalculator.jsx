import React, { useState, useEffect } from 'react';
import { calculateFare } from '../utils/FareCalculator.js';
import './CostCalculator.css';

// Distance calculation using Haversine formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function CostCalculator({ 
  pickup, 
  drop, 
  vehicleType, 
  seatsAvailable, 
  onCostChange,
  showSuggestion = true 
}) {
  const [costData, setCostData] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (pickup && drop && vehicleType) {
      // Calculate distance for the fare calculator
      const distance = calculateDistance(pickup.lat, pickup.lng, drop.lat, drop.lng);
      
      // Map vehicle types to fare calculator format
      const vehicleMap = {
        'motorcycle': 'bike',
        'car': 'car', 
        'suv': 'suv',
        'xuv': 'xuv'
      };
      
      const fareType = vehicleMap[vehicleType] || 'car';
      const numberOfRiders = seatsAvailable || 1;
      
      const calculated = calculateFare(fareType, distance, numberOfRiders);
      setCostData(calculated);
      
      if (onCostChange) {
        onCostChange(calculated.totalFare);
      }
    }
  }, [pickup, drop, vehicleType, seatsAvailable, onCostChange]);

  if (!costData) {
    return (
      <div className="cost-calculator loading">
        <div className="loading-spinner"></div>
        <span>Calculating cost...</span>
      </div>
    );
  }

  return (
    <div className="cost-calculator">
      <div className="cost-header">
        <h3>Ride Cost Calculator</h3>
        <p className="cost-subtitle">Student-friendly pricing with base fare + per km rates</p>
      </div>

      {/* Main Cost Display */}
      <div className="cost-main">
        <div className="cost-amount">
          <span className="cost-label">Total Cost:</span>
          <span className="cost-value">Rs. {costData.totalFare}</span>
        </div>
        
        <div className="cost-per-seat">
          <span className="cost-label">Cost Per Seat:</span>
          <span className="cost-value">Rs. {costData.perPersonFare}</span>
        </div>
        
        <div className="cost-distance">
          <span className="cost-label">Distance:</span>
          <span className="cost-value">{costData.distance.toFixed(2)} km</span>
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="cost-breakdown">
        <div className="breakdown-header">
          <h4>Cost Breakdown</h4>
          <button 
            className="toggle-details"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? 'Hide Details' : 'Show Details'}
          </button>
        </div>

        {showDetails && (
          <div className="breakdown-details">
            <div className="detail-row">
              <span className="detail-label">Vehicle Type:</span>
              <span className="detail-value">{costData.vehicleType}</span>
            </div>
            
            <div className="detail-row">
              <span className="detail-label">Distance:</span>
              <span className="detail-value">{costData.distance.toFixed(2)} km</span>
            </div>
            
            <div className="detail-row">
              <span className="detail-label">Base Fare:</span>
              <span className="detail-value">Rs. {costData.breakdown.baseFare}</span>
            </div>
            
            <div className="detail-row">
              <span className="detail-label">Per KM Rate:</span>
              <span className="detail-value">Rs. {costData.breakdown.perKmRate}/km</span>
            </div>
            
            <div className="detail-row">
              <span className="detail-label">Distance Cost:</span>
              <span className="detail-value">Rs. {costData.breakdown.distanceCost}</span>
            </div>
            
            <div className="detail-row">
              <span className="detail-label">Number of Riders:</span>
              <span className="detail-value">{costData.numberOfRiders}</span>
            </div>
            
            <div className="detail-row total">
              <span className="detail-label">Total Fare:</span>
              <span className="detail-value">Rs. {costData.totalFare}</span>
            </div>
            
            <div className="detail-row">
              <span className="detail-label">Cost Per Person:</span>
              <span className="detail-value">Rs. {costData.perPersonFare}</span>
            </div>

            </div>
        )}

        {!showDetails && (
          <div className="cost-explanation">
            <h5> How this is calculated:</h5>
            <p className="explanation-text">Base fare + (distance × per km rate) × number of riders</p>
          </div>
        )}
      </div>

      {/* Pricing Tips */}
      <div className="pricing-tips">
        <h4>💡 Pricing Tips:</h4>
        <ul className="tips-list">
          <li>
            <strong>Peak Hours:</strong> 8-10 AM & 5-8 PM have 50% higher rates
          </li>
          <li>
            <strong>Weekend Surcharge:</strong> Saturday & Sunday have 30% higher rates
          </li>
          <li>
            <strong>Night Hours:</strong> 10 PM - 6 AM have 20% higher rates
          </li>
          <li>
            <strong>Vehicle Types:</strong> Bikes are 40% cheaper, Autos are 20% cheaper than cars
          </li>
          <li>
            <strong>Popular Routes:</strong> High-demand routes may have dynamic pricing
          </li>
        </ul>
      </div>
    </div>
  );
}
