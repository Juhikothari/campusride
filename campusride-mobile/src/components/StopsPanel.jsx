// src/components/StopsPanel.jsx
//
// Provider view: the ride's pickups and drops in the best order, with
//   - ETA for each stop
//   - Picked up (asks for the passenger's 4-digit code) / Dropped buttons
//   - "Open in Google Maps" (turn-by-turn through every stop, in this order)
//
// Usage (e.g. inside the provider's ride / live tracking screen):
//   <StopsPanel rideId={ride._id} driverLocation={driverLocation} onPlan={setPlan} />
//   // then draw it on your existing map:
//   <LiveMapView coordinates={plan?.geometry} pickup=... drop=... />

import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Alert as RNAlert } from 'react-native';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator } from '../theme/themed';
import { getRideStops, updateBookingStop } from '../services/api';
import { colors, radius } from '../theme';

const LABEL = { start: 'Start', pickup: 'Pick up', drop: 'Drop', destination: 'Destination' };
const ICON  = { start: '🟢', pickup: '🧍', drop: '📍', destination: '🏁' };

export default function StopsPanel({ rideId, driverLocation, onPlan }) {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  // OTP / pickupCode removed by user request

  const load = useCallback(async () => {
    try {
      const p = await getRideStops(rideId, driverLocation, false);
      setPlan(p);
      onPlan && onPlan(p);
    } catch (e) {
      RNAlert.alert('Route plan', e.message || 'Could not load the stop plan');
    } finally {
      setLoading(false);
    }
  }, [rideId, driverLocation?.lat, driverLocation?.lng]);

  useEffect(() => { load(); }, [load]);

  const act = async (stop, action) => {
    setBusyId(stop.bookingId);
    try {
      await updateBookingStop(stop.bookingId, action);
      await load();                       // order is recalculated from the new position
    } catch (e) {
      RNAlert.alert(action === 'pickup' ? 'Pickup' : 'Drop', e.message || 'Something went wrong');
    } finally {
      setBusyId(null);
    }
  };

  const openGoogleMaps = () => {
    if (!plan?.googleMapsUrl) return;
    Linking.openURL(plan.googleMapsUrl).catch(() => RNAlert.alert('Google Maps', 'Could not open Google Maps'));
  };

  if (loading) return <ActivityIndicator color={colors.accent} style={{ marginVertical: 16 }} />;
  if (!plan) return null;

  // the first pickup/drop in the list is the "next" action
  const nextIdx = plan.stops.findIndex((s) => s.type === 'pickup' || s.type === 'drop');

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>Route plan</Text>
        <Text style={{ color: colors.text2, fontSize: 12 }}>
          {plan.totalMinutes} min{plan.totalKm ? ` · ${plan.totalKm} km` : ''}
        </Text>
      </View>

      {plan.stops.map((s, i) => {
        const isNext = i === nextIdx;
        const actionable = s.bookingId && (s.type === 'pickup' || s.type === 'drop');
        return (
          <View key={`${s.type}-${s.bookingId || i}`} style={{
            flexDirection: 'row', paddingVertical: 8, gap: 10,
            borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border,
          }}>
            <Text style={{ fontSize: 18 }}>{ICON[s.type]}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: isNext ? '800' : '600', fontSize: 13 }}>
                {LABEL[s.type]}{s.name ? ` · ${s.name}` : ''}
              </Text>
              {!!s.address && <Text style={{ color: colors.text2, fontSize: 11 }} numberOfLines={2}>{s.address}</Text>}

              {isNext && actionable && s.type === 'pickup' && (
                <TouchableOpacity
                  disabled={busyId === s.bookingId}
                  onPress={() => act(s, 'pickup')}
                  style={btn(colors.green)}
                >
                  <Text style={btnText}>{busyId === s.bookingId ? '…' : '👤 Picked up'}</Text>
                </TouchableOpacity>
              )}

              {isNext && actionable && s.type === 'drop' && (
                <TouchableOpacity
                  disabled={busyId === s.bookingId}
                  onPress={() => act(s, 'drop')}
                  style={btn(colors.green)}
                >
                  <Text style={btnText}>{busyId === s.bookingId ? '…' : 'Dropped'}</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={{ color: colors.text2, fontSize: 12 }}>{i === 0 ? 'now' : `+${s.etaMinutes}m`}</Text>
          </View>
        );
      })}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <TouchableOpacity onPress={openGoogleMaps} style={[btn(colors.accent), { flex: 1, marginTop: 0 }]}>
          <Text style={btnText}>🗺️  Open in Google Maps</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={load} style={[btn(colors.surface3), { marginTop: 0 }]}>
          <Text style={[btnText, { color: colors.text }]}>↻</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const btn = (bg) => ({
  alignSelf: 'flex-start', marginTop: 8, backgroundColor: bg,
  paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.md, alignItems: 'center',
});
const btnText = { color: '#000', fontWeight: '800', fontSize: 13 };
