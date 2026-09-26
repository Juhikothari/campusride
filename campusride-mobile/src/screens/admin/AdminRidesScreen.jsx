// campusride-mobile/src/screens/admin/AdminRidesScreen.jsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Alert, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '../../services/api';

export function AdminRidesScreen() {
  const [rides, setRides] = useState([]);
  const [statusFilter, setStatusFilter] = useState('active');
  const [loading, setLoading] = useState(false);

  const loadRides = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/admin/rides', {
        params: { status: statusFilter }
      });
      const list = res.data?.rides || (Array.isArray(res.data) ? res.data : []);
      setRides(list);
    } catch (err) {
      console.warn('loadRides error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRides();
  }, [statusFilter]);

  const handleForceCancel = async (rideId) => {
    Alert.alert(
      'Force Cancel Ride',
      'Cancel this ride on behalf of admin? All booked passengers will be automatically notified.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Cancel Ride',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.post('/admin/rides/force-cancel', {
                rideId,
                reason: 'Cancelled by campus admin due to safety/policy compliance'
              });
              loadRides();
              Alert.alert('Ride Cancelled', 'Ride was cancelled and seekers were notified.');
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerBadge}>TRIP OPERATIONS</Text>
          <Text style={styles.headerTitle}>Rides Management</Text>
        </View>

        {/* Filter Chips */}
        <View style={styles.filterRow}>
          {['active', 'completed', 'cancelled', 'all'].map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.chip, statusFilter === s && styles.chipActive]}
              onPress={() => setStatusFilter(s)}
            >
              <Text style={[styles.chipText, statusFilter === s && styles.chipTextActive]}>
                {s.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          data={rides}
          keyExtractor={r => r._id || r.id}
          onRefresh={loadRides}
          refreshing={loading}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>🚗</Text>
              <Text style={styles.emptyTitle}>No {statusFilter} rides</Text>
              <Text style={styles.emptySub}>No trips found in this category.</Text>
            </View>
          }
          renderItem={({ item: r }) => {
            const isActive = r.status === 'active' || r.status === 'in_progress' || r.status === 'started';

            return (
              <View style={styles.rideCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.rideRoute} numberOfLines={2}>
                    {r.fromLocation} → {r.toLocation}
                  </Text>
                  <View style={[styles.statusBadge, styles[`status_${r.status}`] || styles.status_default]}>
                    <Text style={[styles.statusBadgeText, styles[`statusText_${r.status}`] || styles.statusText_default]}>
                      {r.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <Text style={styles.rideSub}>
                  Driver: <Text style={{ color: '#fff', fontWeight: '700' }}>{r.providerName}</Text>
                  {r.providerPhone ? ` · 📞 ${r.providerPhone}` : ''}
                </Text>
                <Text style={styles.rideSub}>
                  Seats Booked: <Text style={{ color: '#2dd4a0', fontWeight: '700' }}>{r.bookedSeats}/{r.totalSeats}</Text>
                  {r.fare ? ` · Fare: ₹${r.fare}` : ''}
                </Text>
                <Text style={styles.rideTime}>
                  ⏰ Departure: {new Date(r.departureTime).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </Text>

                {isActive && (
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => handleForceCancel(r._id || r.id)}
                  >
                    <Text style={styles.cancelBtnText}>⚠️ Force Cancel Ride</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#07090d',
  },
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 12,
    paddingTop: 4,
  },
  headerBadge: {
    color: '#2dd4a0',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 2,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
  },
  chipActive: {
    backgroundColor: 'rgba(45,212,160,0.15)',
    borderColor: '#2dd4a0',
  },
  chipText: {
    color: '#8b949e',
    fontSize: 11,
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#2dd4a0',
    fontWeight: '800',
  },
  listContent: {
    paddingBottom: 24,
  },
  rideCard: {
    backgroundColor: '#0d1117',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#21262d',
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  rideRoute: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
    lineHeight: 20,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  status_active: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderColor: '#3b82f6',
  },
  statusText_active: {
    color: '#3b82f6',
  },
  status_completed: {
    backgroundColor: 'rgba(45,212,160,0.15)',
    borderColor: '#2dd4a0',
  },
  statusText_completed: {
    color: '#2dd4a0',
  },
  status_cancelled: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderColor: '#ef4444',
  },
  statusText_cancelled: {
    color: '#ef4444',
  },
  status_default: {
    backgroundColor: '#161b22',
    borderColor: '#30363d',
  },
  statusText_default: {
    color: '#8b949e',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  rideSub: {
    color: '#8b949e',
    fontSize: 12,
    marginBottom: 3,
  },
  rideTime: {
    color: '#6e7681',
    fontSize: 11,
    marginTop: 4,
    marginBottom: 8,
  },
  cancelBtn: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 6,
  },
  cancelBtnText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 10,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptySub: {
    color: '#8b949e',
    fontSize: 12,
  },
});
