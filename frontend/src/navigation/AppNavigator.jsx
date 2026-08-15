import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors, radius } from '../theme';

// Auth screens
import LoginScreen    from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import { ForgotPasswordScreen } from '../screens/MiscScreens';

// Main screens
import DashboardScreen        from '../screens/DashboardScreen';
import SearchRidesScreen      from '../screens/SearchRidesScreen';
import CreateRideScreen       from '../screens/CreateRideScreen';
import CommunityScreen        from '../screens/CommunityScreen';
import MyBookingsScreen       from '../screens/MyBookingsScreen';
import ProviderBookingsScreen from '../screens/ProviderBookingsScreen';
import ProfileScreen          from '../screens/ProfileScreen';

import {
  RideDetailScreen,
  NotificationsScreen,
  WalkTogetherScreen,
  RouteAlertsScreen,
  IncidentReportScreen,
} from '../screens/MiscScreens';

const Stack = createStackNavigator();
const Tab   = createBottomTabNavigator();

// ── Shared header config ──────────────────────────────────────
const screenOptions = {
  headerStyle:       { backgroundColor: colors.bg, elevation: 0, shadowOpacity: 0 },
  headerTitleStyle:  { color: colors.text, fontWeight: '700', fontSize: 16 },
  headerTintColor:   colors.accent,
  headerBackTitle:   '',
  cardStyle:         { backgroundColor: colors.bg },
};

// ── Tab icon component ────────────────────────────────────────
function TabIcon({ emoji, focused }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
    </View>
  );
}

// ── Main (authenticated) tab navigator ────────────────────────
function MainTabs() {
  const { user } = useAuth();
  const isProvider = user?.role === 'provider' || user?.role === 'both';
  const isSeeker   = user?.role === 'seeker'   || user?.role === 'both';

  return (
    <Tab.Navigator
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
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarActiveTintColor:   colors.accent,
        tabBarInactiveTintColor: colors.text3,
      }}
    >
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />
      {isSeeker && (
        <Tab.Screen
          name="FindRide"
          component={SearchRidesScreen}
          options={{
            tabBarLabel: 'Find Ride',
            tabBarIcon: ({ focused }) => <TabIcon emoji="🔍" focused={focused} />,
          }}
        />
      )}
      {isProvider && (
        <Tab.Screen
          name="OfferRide"
          component={CreateRideScreen}
          options={{
            tabBarLabel: 'Offer Ride',
            tabBarIcon: ({ focused }) => <TabIcon emoji="🚗" focused={focused} />,
          }}
        />
      )}
      <Tab.Screen
        name="Community"
        component={CommunityScreen}
        options={{
          tabBarLabel: 'Community',
          tabBarIcon: ({ focused }) => <TabIcon emoji="💬" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
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
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ headerShown: true, title: 'Forgot Password' }} />
    </Stack.Navigator>
  );
}

// ── Main app stack (wraps tabs + modal screens) ──────────────
function AppStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Tabs"              component={MainTabs}              options={{ headerShown: false }} />
      <Stack.Screen name="SearchRides"       component={SearchRidesScreen}     options={{ title: 'Find a Ride' }} />
      <Stack.Screen name="CreateRide"        component={CreateRideScreen}      options={{ title: 'Offer a Ride' }} />
      <Stack.Screen name="RideDetail"        component={RideDetailScreen}      options={{ title: 'Ride Details' }} />
      <Stack.Screen name="MyBookings"        component={MyBookingsScreen}      options={{ title: 'My Bookings' }} />
      <Stack.Screen name="ProviderBookings"  component={ProviderBookingsScreen} options={{ title: 'Ride Requests' }} />
      <Stack.Screen name="Notifications"     component={NotificationsScreen}   options={{ title: 'Notifications' }} />
      <Stack.Screen name="WalkTogether"      component={WalkTogetherScreen}    options={{ title: 'Walk Together' }} />
      <Stack.Screen name="RouteAlerts"       component={RouteAlertsScreen}     options={{ title: 'Route Alerts' }} />
      <Stack.Screen name="IncidentReport"    component={IncidentReportScreen}  options={{ title: 'Report Incident' }} />
    </Stack.Navigator>
  );
}

// ── Root navigator — switches on auth state ──────────────────
export default function AppNavigator() {
  const { user } = useAuth();
  return user ? <AppStack /> : <AuthStack />;
}
