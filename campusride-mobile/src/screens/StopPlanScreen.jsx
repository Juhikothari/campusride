// src/screens/StopPlanScreen.jsx
// Provider: map + stop-by-stop plan for one ride (best order, Picked up / Dropped, Open in Google Maps).
import React, { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { useTheme } from '../context/ThemeContext';
import TopHeader from '../components/TopHeader';
import StopsMap from '../components/StopsMap';
import StopsPanel from '../components/StopsPanel';
import { View, ScrollView, SafeAreaView } from '../theme/themed';
import { colors, spacing } from '../theme';

export default function StopPlanScreen({ navigation, route }) {
  const { isDark } = useTheme();
  const rideId = route?.params?.rideId;
  const [plan, setPlan] = useState(null);
  const [driverLoc, setDriverLoc] = useState(null);

  // Start the plan from where the driver actually is (if they allow location)
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setDriverLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch { /* plan simply starts from the ride's start point */ }
    })();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? colors.bg : '#f8fafc' }} edges={['top']}>
      <TopHeader title="Route Plan" subtitle="Pickups & drops in the best order" showBack={navigation.canGoBack()} />
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: 12 }}>
        <StopsMap stops={plan?.stops} geometry={plan?.geometry} height={280} />
        <StopsPanel rideId={rideId} driverLocation={driverLoc} onPlan={setPlan} />
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
