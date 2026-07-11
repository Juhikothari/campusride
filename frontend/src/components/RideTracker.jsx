// RideTracker.jsx or similar component
import React, { useState, useEffect } from 'react';
import * as api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import io from 'socket.io-client';
import './RideTracker.css';

export default function RideTracker({ rideId, bookingId, navigate }) {
  const { user } = useAuth();
  const [ride, setRide] = useState(null);
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);

  const fetchStatus = async () => {
    try {
      const [rideData, bookingData] = await Promise.all([
        api.getRide(rideId),
        api.getMyBookings().then(books => books.find(b => b._id === bookingId))
      ]);
      setRide(rideData.ride || rideData);
      setBooking(bookingData);
      
      // Check if cancelled
      if (rideData.ride?.status === 'cancelled' || bookingData?.status === 'cancelled') {
        alert('This ride has been cancelled by the provider');
        navigate('my-bookings');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    
    // Setup socket for real-time updates
    const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000');
    setSocket(newSocket);
    
    // Join ride room
    newSocket.emit('join-ride', rideId);
    
    // Listen for status updates
    newSocket.on('rideStarted', (data) => {
      console.log('Ride started:', data);
      setRide(prev => ({ ...prev, status: 'in-progress' }));
    });
    
    newSocket.on('rideCompleted', (data) => {
      console.log('Ride completed:', data);
      setRide(prev => ({ ...prev, status: 'completed' }));
      alert('Ride completed! Please rate your experience.');
    });
    
    // FIXED: Listen for cancellation
    newSocket.on('rideCancelled', (data) => {
      console.log('Ride cancelled:', data);
      alert(`Ride cancelled by provider. Reason: ${data.reason || 'No reason provided'}`);
      navigate('my-bookings'); // Redirect to bookings list
    });
    
    // Poll every 10 seconds as backup
    const interval = setInterval(fetchStatus, 10000);
    
    return () => {
      newSocket.disconnect();
      clearInterval(interval);
    };
  }, [rideId]);

  if (loading) return <div className="loading">Loading...</div>;
  if (!ride) return <div className="error">Ride not found</div>;

  const isCancelled = ride.status === 'cancelled';
  const isInProgress = ride.status === 'in-progress';
  const isCompleted = ride.status === 'completed';

  return (
    <div className={`ride-tracker ${isCancelled ? 'cancelled' : ''}`}>
      {isCancelled ? (
        <div className="cancelled-banner">
          <h2>🚫 RIDE CANCELLED</h2>
          <p>This ride has been cancelled by the provider</p>
          {ride.cancelReason && <p>Reason: {ride.cancelReason}</p>}
          <button className="btn btn-primary" onClick={() => navigate('my-bookings')}>
            Back to My Bookings
          </button>
        </div>
      ) : (
        <>
          <div className="status-banner in-progress">
            <h2>🚗 Ride In Progress</h2>
            <p>Provider has picked you up. Enjoy your ride!</p>
          </div>
          
          <div className="trip-progress">
            <div className="step completed">✓ Booking Confirmed</div>
            <div className="step completed">✓ Passenger Picked Up</div>
            <div className="step pending">○ Ride Completed</div>
          </div>
          
          {/* Map and other details */}
        </>
      )}
    </div>
  );
}