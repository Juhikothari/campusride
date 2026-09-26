// campusride-mobile/src/navigation/AdminNavigator.jsx
import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';

import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen';
import { AdminKYCScreen } from '../screens/admin/AdminKYCScreen';
import { AdminUsersScreen } from '../screens/admin/AdminUsersScreen';
import { AdminRidesScreen } from '../screens/admin/AdminRidesScreen';
import { AdminIncidentsScreen } from '../screens/admin/AdminIncidentsScreen';
import { AdminMoreScreen } from '../screens/admin/AdminMoreScreen';
import { AdminBroadcastScreen } from '../screens/admin/AdminBroadcastScreen';
import { AdminAuditLogsScreen } from '../screens/admin/AdminAuditLogsScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function MoreStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#07090d' },
      }}
    >
      <Stack.Screen name="MoreHome" component={AdminMoreScreen} />
      <Stack.Screen name="Broadcast" component={AdminBroadcastScreen} />
      <Stack.Screen name="AuditLogs" component={AdminAuditLogsScreen} />
    </Stack.Navigator>
  );
}

export function AdminNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#07090d',
          borderTopColor: '#21262d',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: '#2dd4a0',
        tabBarInactiveTintColor: '#6e7681',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
        },
        tabBarIcon: ({ focused }) => {
          let icon = '⚡';
          if (route.name === 'Dashboard') icon = '📊';
          else if (route.name === 'KYC') icon = '🪪';
          else if (route.name === 'Users') icon = '👥';
          else if (route.name === 'Rides') icon = '🚗';
          else if (route.name === 'Incidents') icon = '🚨';
          else if (route.name === 'More') icon = '⚙️';

          return (
            <Text style={{ fontSize: focused ? 19 : 17, opacity: focused ? 1 : 0.65 }}>
              {icon}
            </Text>
          );
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={AdminDashboardScreen} />
      <Tab.Screen name="KYC" component={AdminKYCScreen} />
      <Tab.Screen name="Users" component={AdminUsersScreen} />
      <Tab.Screen name="Rides" component={AdminRidesScreen} />
      <Tab.Screen name="Incidents" component={AdminIncidentsScreen} />
      <Tab.Screen name="More" component={MoreStack} />
    </Tab.Navigator>
  );
}

export default AdminNavigator;
