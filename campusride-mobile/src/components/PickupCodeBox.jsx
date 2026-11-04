// src/components/PickupCodeBox.jsx
// Seeker side: shows the 4-digit code to tell the driver when they arrive.
import React, { useEffect, useState } from 'react';
import { View, Text } from '../theme/themed';
import { getPickupCode } from '../services/api';
import { colors, radius } from '../theme';

const STATUS_TEXT = {
  waiting:   'Share this code with your driver when they reach you.',
  picked_up: '✅ You have been picked up. Enjoy the ride!',
  dropped:   '🏁 You have been dropped. Thanks for riding!',
};

export default function PickupCodeBox({ bookingId }) {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = () => getPickupCode(bookingId).then((d) => alive && setInfo(d)).catch(() => {});
    load();
    const t = setInterval(load, 15000);       // pick-up / drop status refreshes by itself
    return () => { alive = false; clearInterval(t); };
  }, [bookingId]);

  if (!info || !info.pickupCode) return null;
  const waiting = info.stopStatus === 'waiting';
  return (
    <View style={{
      marginTop: 10, padding: 12, borderRadius: radius.md, borderWidth: 1,
      borderColor: colors.accent, backgroundColor: 'rgba(245,166,35,0.10)', alignItems: 'center',
    }}>
      <Text style={{ color: colors.text2, fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>YOUR PICKUP CODE</Text>
      {waiting && (
        <Text style={{ color: colors.accent, fontSize: 32, fontWeight: '900', letterSpacing: 10, marginVertical: 4 }}>
          {info.pickupCode}
        </Text>
      )}
      <Text style={{ color: colors.text2, fontSize: 12, textAlign: 'center' }}>
        {STATUS_TEXT[info.stopStatus] || STATUS_TEXT.waiting}
      </Text>
    </View>
  );
}
