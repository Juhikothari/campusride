// frontend/src/pages/WhatsMyRoutePage.jsx
// Standalone page — also accessible from Dashboard "What's My Route?" card
import React from 'react';

export default function WhatsMyRoutePage({ navigate }) {
  // Just navigate to community > route tab
  React.useEffect(() => {
    navigate('community');
  }, []);
  return null;
}
