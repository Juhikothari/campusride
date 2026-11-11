// src/components/BookingPointsModal.jsx
//
// Shown when a seeker taps "Book": lets them choose THEIR OWN pickup and drop point
// (defaults to the ride's start / destination) and clearly displays the calculated price
// before they confirm their request. The provider then sees this price and both locations.

import React, { useEffect, useState } from 'react';
import { Modal, Alert as RNAlert } from 'react-native';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from '../theme/themed';
import { useTheme } from '../context/ThemeContext';
import LocationSearch from './LocationSearch';
import { colors, radius } from '../theme';
import { getEstimatedFare, haversineDistanceKm } from '../utils/pricing';

const addrOf = (p) => (typeof p === 'string' ? p : (p?.address || p?.name || ''));
const fromRide = (p) => {
  if (!p) return { text: '', lat: '', lng: '' };
  const text = addrOf(p);
  if (Array.isArray(p.coordinates) && p.coordinates.length >= 2) {
    return { text, lat: String(p.coordinates[1]), lng: String(p.coordinates[0]) };
  }
  const lat = p.lat ?? p.latitude;
  const lng = p.lng ?? p.longitude;
  if (lat != null && lng != null) {
    return { text, lat: String(lat), lng: String(lng) };
  }
  return { text, lat: '', lng: '' };
};

export default function BookingPointsModal({ visible, ride, loading, onCancel, onConfirm }) {
  const { isDark } = useTheme();
  const [pickup, setPickup] = useState({ text: '', lat: '', lng: '' });
  const [drop, setDrop]     = useState({ text: '', lat: '', lng: '' });

  useEffect(() => {
    if (visible && ride) { setPickup(fromRide(ride.pickup)); setDrop(fromRide(ride.drop)); }
  }, [visible, ride && ride._id]);

  const valid = (p) => Number.isFinite(parseFloat(p.lat)) && Number.isFinite(parseFloat(p.lng));

  const confirm = () => {
    if (!valid(pickup)) { RNAlert.alert('Pickup point', 'Please choose your pickup point from the suggestions.'); return; }
    if (!valid(drop))   { RNAlert.alert('Drop point',   'Please choose your drop point from the suggestions.'); return; }
    onConfirm(
      { lat: parseFloat(pickup.lat), lng: parseFloat(pickup.lng), address: pickup.text },
      { lat: parseFloat(drop.lat),   lng: parseFloat(drop.lng),   address: drop.text },
    );
  };

  const fareAmount = getEstimatedFare(pickup, drop, ride?.vehicleType, null);

  return (
    <Modal visible={!!visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
        <View style={{
          backgroundColor: isDark ? colors.bg : '#ffffff', borderTopLeftRadius: 22, borderTopRightRadius: 22,
          padding: 18, maxHeight: '88%', borderWidth: 1, borderColor: isDark ? colors.border : '#cbd5e1',
        }}>
          <Text style={{ color: isDark ? colors.text : '#0f172a', fontSize: 18, fontWeight: '800' }}>Where should we pick you up?</Text>
          <Text style={{ color: isDark ? colors.text2 : '#475569', fontSize: 12, marginTop: 4, marginBottom: 12 }}>
            Your driver sees both points and plans the best route. Change them if you are not at the ride's start or going elsewhere on the way.
          </Text>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <LocationSearch
              label="Your pickup point"
              placeholder="Where will you wait?"
              value={pickup.text}
              onChange={(text, lat, lng) => setPickup({ text, lat, lng })}
            />
            <LocationSearch
              label="Your drop point"
              placeholder="Where do you get off?"
              value={drop.text}
              onChange={(text, lat, lng) => setDrop({ text, lat, lng })}
            />

            {/* Prominent Price Display before confirming */}
            <View style={{
              backgroundColor: isDark ? 'rgba(245,166,35,0.12)' : '#fffbeb',
              borderWidth: 1.5,
              borderColor: colors.accent,
              borderRadius: radius.md,
              padding: 12,
              marginTop: 6,
              marginBottom: 4,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <View>
                <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>💰 ESTIMATED FARE TO PAY</Text>
                <Text style={{ color: isDark ? colors.text2 : '#475569', fontSize: 11, marginTop: 2 }}>Direct to provider via UPI / Cash</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: colors.accent, fontSize: 20, fontWeight: '900' }}>₹{fareAmount}</Text>
                <Text style={{ color: isDark ? colors.text3 : '#64748b', fontSize: 10 }}>1 seat</Text>
              </View>
            </View>
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <TouchableOpacity onPress={onCancel} disabled={loading}
              style={{ flex: 1, paddingVertical: 13, borderRadius: radius.md, borderWidth: 1, borderColor: isDark ? colors.border : '#cbd5e1', backgroundColor: isDark ? colors.surface : '#f1f5f9', alignItems: 'center' }}>
              <Text style={{ color: isDark ? colors.text : '#0f172a', fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={confirm} disabled={loading}
              style={{ flex: 2, paddingVertical: 13, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center' }}>
              {loading ? <ActivityIndicator color="#000" /> : <Text style={{ color: '#000', fontWeight: '800' }}>Send request • ₹{fareAmount}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
