// frontend/src/pages/WalkTogetherPage.jsx
// Standalone page — also accessible from Dashboard "Walk Together" card
import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function WalkTogetherPage({ navigate }) {
  // Just navigate to community > walk tab
  React.useEffect(() => {
    navigate('community');
  }, []);
  return null;
}
