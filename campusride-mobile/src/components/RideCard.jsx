import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { Badge } from './UI';

const STATUS_COLOR = {
  active:       colors.green,
  'in-progress': colors.blue,
  completed:    colors.text3,
  cancelled:    colors.red,
};

const VEHICLE_ICON = {
  motorcycle: '🏍️',
  car:        '🚗',
  suv:        '🚙',
  xuv:        '🛻',
};

function formatTime(date, time) {
  try {
    if (time) return time;
    return new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}

function formatDate(date) {
  try {
    return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch { return '—'; }
}

function getAddress(field) {
  if (!field) return '—';
  if (field.address?.trim()) return field.address.trim();
  if (field.coordinates?.length === 2) {
    const [lng, lat] = field.coordinates;
    return `${lat.toFixed(3)}°N, ${lng.toFixed(3)}°E`;
  }
  return '—';
}

export default function RideCard({ ride, onView, onBook, bookingStatus }) {
  const vehicleIcon = VEHICLE_ICON[ride.vehicleType] || '🚗';
  const statusColor = STATUS_COLOR[ride.status] || colors.text2;
  const pickup = getAddress(ride.pickup);
  const drop   = getAddress(ride.drop);
  const isBooked = bookingStatus === 'pending' || bookingStatus === 'accepted';

  return (
    <View style={styles.card}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 22 }}>{vehicleIcon}</Text>
          <View>
            <Text style={styles.vehicleName}>
              {ride.vehicleName || (ride.vehicleType ? ride.vehicleType.charAt(0).toUpperCase() + ride.vehicleType.slice(1) : 'Ride')}
            </Text>
            <Text style={styles.providerName}>{ride.providerName || ride.provider?.name || 'Provider'}</Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Badge label={ride.status || 'active'} color={statusColor} />
          {ride.womenOnly && <Badge label="♀ Women Only" color={colors.pink} />}
        </View>
      </View>

      {/* Route */}
      <View style={styles.route}>
        <View style={styles.routePoint}>
          <View style={[styles.dot, { backgroundColor: colors.green }]} />
          <Text style={styles.routeText} numberOfLines={1}>{pickup}</Text>
        </View>
        <View style={styles.routeLine} />
        <View style={styles.routePoint}>
          <View style={[styles.dot, { backgroundColor: colors.red }]} />
          <Text style={styles.routeText} numberOfLines={1}>{drop}</Text>
        </View>
      </View>

      {/* Details row */}
      <View style={styles.detailRow}>
        <DetailChip icon="📅" text={formatDate(ride.date)} />
        <DetailChip icon="🕐" text={formatTime(ride.date, ride.time)} />
        <DetailChip icon="💺" text={`${ride.seatsAvailable} seat${ride.seatsAvailable !== 1 ? 's' : ''}`} />
        <DetailChip icon="₹" text={`${ride.costPerSeat}/seat`} />
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.viewBtn} onPress={() => onView?.(ride._id)}>
          <Text style={styles.viewBtnText}>View Details</Text>
        </TouchableOpacity>
        {onBook && !isBooked && (
          <TouchableOpacity style={styles.bookBtn} onPress={() => onBook(ride._id)}>
            <Text style={styles.bookBtnText}>Book Now</Text>
          </TouchableOpacity>
        )}
        {isBooked && (
          <View style={styles.bookedBadge}>
            <Text style={styles.bookedText}>
              {bookingStatus === 'accepted' ? '✓ Accepted' : '⏳ Pending'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function DetailChip({ icon, text }) {
  return (
    <View style={styles.chip}>
      <Text style={{ fontSize: 11 }}>{icon}</Text>
      <Text style={styles.chipText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  vehicleName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  providerName: { color: colors.text2, fontSize: 12, marginTop: 1 },

  route: { marginBottom: 12 },
  routePoint: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 3 },
  routeLine: { width: 2, height: 12, backgroundColor: colors.border, marginLeft: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  routeText: { flex: 1, color: colors.text, fontSize: 13 },

  detailRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surface2,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chipText: { color: colors.text2, fontSize: 11 },

  actions: { flexDirection: 'row', gap: 8 },
  viewBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border2,
    alignItems: 'center',
  },
  viewBtnText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  bookBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  bookBtnText: { color: '#000', fontSize: 13, fontWeight: '700' },
  bookedBadge: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.greenDim,
    alignItems: 'center',
  },
  bookedText: { color: colors.green, fontSize: 13, fontWeight: '700' },
});
