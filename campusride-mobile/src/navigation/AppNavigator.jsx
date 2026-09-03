import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';

// ── Auth screens ──────────────────────────────────────────────
import LoginScreen    from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';

// ── Tab screens ───────────────────────────────────────────────
import DashboardScreen    from '../screens/DashboardScreen';
import SearchRidesScreen  from '../screens/SearchRidesScreen';
import CreateRideScreen   from '../screens/CreateRideScreen';
import ChatBotScreen      from '../screens/ChatBotScreen';
import CommunityScreen    from '../screens/CommunityScreen';
import ProfileScreen      from '../screens/ProfileScreen';

// ── Stack screens ─────────────────────────────────────────────
import LiveTrackingScreen     from '../screens/LiveTrackingScreen';
import MyBookingsScreen       from '../screens/MyBookingsScreen';
import ProviderBookingsScreen from '../screens/ProviderBookingsScreen';
import KYCScreen              from '../screens/KYCScreen';

import {
  RideDetailScreen,
  NotificationsScreen,
  WalkTogetherScreen,
  IncidentReportScreen,
  ForgotPasswordScreen,
} from '../screens/MiscScreens';

import {
  RatingsScreen,
  AdminDashboardScreen,
  ContactSupportScreen,
  ResetPasswordScreen,
  PreRideChecklistScreen,
} from '../screens/ExtraScreens';

const Stack = createStackNavigator();

// ── Shared header config ──────────────────────────────────────
const screenOptions = {
  headerStyle:      { backgroundColor: colors.bg, elevation: 0, shadowOpacity: 0 },
  headerTitleStyle: { color: colors.text, fontWeight: '700', fontSize: 16 },
  headerTintColor:  colors.accent,
  headerBackTitle:  '',
  cardStyle:        { backgroundColor: colors.bg },
};

// ── Auth stack ────────────────────────────────────────────────
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ ...screenOptions, headerShown: false }}>
      <Stack.Screen name="Login"          component={LoginScreen} />
      <Stack.Screen name="Register"       component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen}
        options={{ headerShown: true, title: 'Forgot Password' }} />
      <Stack.Screen name="ResetPassword"  component={ResetPasswordScreen}
        options={{ headerShown: true, title: 'Reset Password' }} />
    </Stack.Navigator>
  );
}

// ── Main app stack (No bottom tabs — single unified stack with floating HOGO AI) ──
function AppStack() {
  return (
    <Stack.Navigator initialRouteName="Home" screenOptions={screenOptions}>
      {/* Root Dashboard */}
      <Stack.Screen name="Home"              component={DashboardScreen}        options={{ headerShown: false }} />
      <Stack.Screen name="Tabs"              component={DashboardScreen}        options={{ headerShown: false }} />

      {/* Rides & Search */}
      <Stack.Screen name="SearchRides"       component={SearchRidesScreen}      options={{ title: 'Search Your Match' }} />
      <Stack.Screen name="SearchMatch"       component={SearchRidesScreen}      options={{ title: 'Search Your Match' }} />
      <Stack.Screen name="CreateRide"        component={CreateRideScreen}       options={{ title: 'Offer a Ride' }} />
      <Stack.Screen name="OfferRide"         component={CreateRideScreen}       options={{ title: 'Offer a Ride' }} />
      <Stack.Screen name="RideDetail"        component={RideDetailScreen}       options={{ title: 'Ride Details' }} />
      <Stack.Screen name="LiveTracking"      component={LiveTrackingScreen}     options={{ headerShown: false }} />

      {/* Bookings */}
      <Stack.Screen name="MyBookings"        component={MyBookingsScreen}       options={{ title: 'My Bookings' }} />
      <Stack.Screen name="ProviderBookings"  component={ProviderBookingsScreen} options={{ title: 'Ride Requests' }} />

      {/* AI Assistant & Community */}
      <Stack.Screen name="ChatBot"           component={ChatBotScreen}          options={{ title: 'HOGO AI Assistant' }} />
      <Stack.Screen name="Community"         component={CommunityScreen}        options={{ title: 'Campus Community' }} />
      <Stack.Screen name="WalkTogether"      component={WalkTogetherScreen}     options={{ title: 'Walk Together' }} />
      <Stack.Screen name="IncidentReport"    component={IncidentReportScreen}   options={{ title: 'Report Incident' }} />

      {/* Profile & Account */}
      <Stack.Screen name="Profile"           component={ProfileScreen}          options={{ title: 'My Profile' }} />
      <Stack.Screen name="KYC"               component={KYCScreen}              options={{ title: 'KYC Verification' }} />
      <Stack.Screen name="Ratings"           component={RatingsScreen}          options={{ title: 'Ratings & Reviews' }} />
      <Stack.Screen name="ContactSupport"    component={ContactSupportScreen}   options={{ title: 'Contact Support' }} />
      <Stack.Screen name="PreRideChecklist"  component={PreRideChecklistScreen} options={{ title: 'Pre-Ride Checklist' }} />

      {/* Notifications */}
      <Stack.Screen name="Notifications"     component={NotificationsScreen}    options={{ title: 'Notifications' }} />

      {/* Admin */}
      <Stack.Screen name="AdminDashboard"    component={AdminDashboardScreen}   options={{ title: 'Admin Dashboard' }} />
    </Stack.Navigator>
  );
}

// ── Root: switches on auth state ──────────────────────────────
export default function AppNavigator() {
  const { user } = useAuth();
  return user ? <AppStack /> : <AuthStack />;
}
