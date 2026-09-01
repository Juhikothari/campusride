import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';

// ── Auth screens ──────────────────────────────────────────────
import LoginScreen    from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';

// ── Tab screens ───────────────────────────────────────────────
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
const Tab   = createBottomTabNavigator();

// ── Shared header config ──────────────────────────────────────
const screenOptions = {
  headerStyle:      { backgroundColor: colors.bg, elevation: 0, shadowOpacity: 0 },
  headerTitleStyle: { color: colors.text, fontWeight: '700', fontSize: 16 },
  headerTintColor:  colors.accent,
  headerBackTitle:  '',
  cardStyle:        { backgroundColor: colors.bg },
};

// ── Tab icon ──────────────────────────────────────────────────
function TabIcon({ emoji, focused }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
    </View>
  );
}

// ── Main Tabs Navigator (The 5 Classic Tabs) ──────────────────
function MainTabs() {
  const { user } = useAuth();
  const isProvider = user?.role === 'provider' || user?.role === 'both';

  return (
    <Tab.Navigator
      initialRouteName="FindRide"
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor:  colors.border,
          borderTopWidth:  1,
          paddingBottom: 6,
          paddingTop: 6,
          height: 62,
        },
        tabBarLabelStyle:        { fontSize: 11, fontWeight: '600' },
        tabBarActiveTintColor:   colors.accent,
        tabBarInactiveTintColor: colors.text3,
      }}
    >
      <Tab.Screen
        name="FindRide"
        component={SearchRidesScreen}
        options={{
          tabBarLabel: 'Find Ride',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🔍" focused={focused} />
        }}
      />

      <Tab.Screen
        name="OfferRide"
        component={CreateRideScreen}
        options={{
          tabBarLabel: 'Offer Ride',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🚗" focused={focused} />
        }}
      />

      <Tab.Screen
        name="TrackRide"
        component={LiveTrackingScreen}
        options={{
          tabBarLabel: 'Track Ride',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📍" focused={focused} />
        }}
      />

      <Tab.Screen
        name="Community"
        component={CommunityScreen}
        options={{
          tabBarLabel: 'Community',
          tabBarIcon: ({ focused }) => <TabIcon emoji="💬" focused={focused} />
        }}
      />

      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />
        }}
      />
    </Tab.Navigator>
  );
}

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

// ── Main app stack ────────────────────────────────────────────
function AppStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {/* Root tabs */}
      <Stack.Screen name="Tabs"              component={MainTabs}               options={{ headerShown: false }} />

      {/* Rides */}
      <Stack.Screen name="SearchRides"       component={SearchRidesScreen}      options={{ title: 'Find a Ride' }} />
      <Stack.Screen name="CreateRide"        component={CreateRideScreen}       options={{ title: 'Offer a Ride' }} />
      <Stack.Screen name="RideDetail"        component={RideDetailScreen}       options={{ title: 'Ride Details' }} />
      <Stack.Screen name="LiveTracking"      component={LiveTrackingScreen}     options={{ headerShown: false }} />

      {/* Bookings */}
      <Stack.Screen name="MyBookings"        component={MyBookingsScreen}       options={{ title: 'My Bookings' }} />
      <Stack.Screen name="ProviderBookings"  component={ProviderBookingsScreen} options={{ title: 'Ride Requests' }} />

      {/* Community & Safety */}
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
