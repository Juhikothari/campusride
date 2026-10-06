// campusride-mobile/src/components/TimePickerModal.jsx
import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Platform,
} from 'react-native';
import { colors, radius, spacing } from '../theme';

const HOURS = ['12', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11'];
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

export function TimePickerModal({ visible, value, onConfirm, onClose }) {
  const [selectedHour, setSelectedHour] = useState('08');
  const [selectedMin, setSelectedMin] = useState('30');
  const [selectedPeriod, setSelectedPeriod] = useState('AM');

  useEffect(() => {
    if (value && typeof value === 'string' && value.includes(':')) {
      const parts = value.split(':');
      let h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const period = h >= 12 ? 'PM' : 'AM';
      if (h === 0) h = 12;
      else if (h > 12) h -= 12;

      setSelectedHour(String(h).padStart(2, '0'));
      setSelectedMin(String(Math.round(m / 5) * 5 % 60).padStart(2, '0'));
      setSelectedPeriod(period);
    }
  }, [value, visible]);

  const handleConfirm = () => {
    let h = parseInt(selectedHour, 10);
    if (selectedPeriod === 'PM' && h < 12) h += 12;
    if (selectedPeriod === 'AM' && h === 12) h = 0;
    const finalTime = `${String(h).padStart(2, '0')}:${selectedMin}`;
    onConfirm(finalTime);
    onClose();
  };

  const applyOffset = (minsToAdd) => {
    const now = new Date();
    const target = new Date(now.getTime() + minsToAdd * 60000);
    let h = target.getHours();
    const m = target.getMinutes();
    const period = h >= 12 ? 'PM' : 'AM';
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;

    setSelectedHour(String(h).padStart(2, '0'));
    setSelectedMin(String(Math.round(m / 5) * 5 % 60).padStart(2, '0'));
    setSelectedPeriod(period);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.badge}>SCHEDULE DEPARTURE</Text>
              <Text style={styles.title}>Select Ride Time</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Big Time Display */}
          <View style={styles.timePreviewCard}>
            <View style={styles.digitBox}>
              <Text style={styles.digitText}>{selectedHour}</Text>
              <Text style={styles.digitSub}>HOUR</Text>
            </View>
            <Text style={styles.colonText}>:</Text>
            <View style={styles.digitBox}>
              <Text style={styles.digitText}>{selectedMin}</Text>
              <Text style={styles.digitSub}>MINUTE</Text>
            </View>
            <View style={styles.periodCol}>
              <TouchableOpacity
                style={[styles.periodBtn, selectedPeriod === 'AM' && styles.periodBtnActive]}
                onPress={() => setSelectedPeriod('AM')}
              >
                <Text style={[styles.periodBtnText, selectedPeriod === 'AM' && styles.periodBtnTextActive]}>AM</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.periodBtn, selectedPeriod === 'PM' && styles.periodBtnActive]}
                onPress={() => setSelectedPeriod('PM')}
              >
                <Text style={[styles.periodBtnText, selectedPeriod === 'PM' && styles.periodBtnTextActive]}>PM</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Presets */}
          <View style={styles.quickRow}>
            <TouchableOpacity onPress={() => applyOffset(15)} style={styles.quickChip}>
              <Text style={styles.quickChipText}>+15 min</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => applyOffset(30)} style={styles.quickChip}>
              <Text style={styles.quickChipText}>+30 min</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => applyOffset(60)} style={styles.quickChip}>
              <Text style={styles.quickChipText}>+1 hour</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setSelectedHour('08'); setSelectedMin('30'); setSelectedPeriod('AM'); }}
              style={styles.quickChip}
            >
              <Text style={styles.quickChipText}>🏫 8:30 AM</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setSelectedHour('04'); setSelectedMin('30'); setSelectedPeriod('PM'); }}
              style={styles.quickChip}
            >
              <Text style={styles.quickChipText}>🏠 4:30 PM</Text>
            </TouchableOpacity>
          </View>

          {/* Vertical Order Columns: Hours, Minutes, and AM/PM */}
          <View style={styles.verticalColumnsContainer}>
            {/* Hours Column */}
            <View style={styles.verticalCol}>
              <Text style={styles.colHeaderLabel}>HOURS</Text>
              <View style={styles.colScrollWrapper}>
                <ScrollView
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.colScrollContent}
                >
                  {HOURS.map((h) => {
                    const isSel = selectedHour === h;
                    return (
                      <TouchableOpacity
                        key={h}
                        style={[styles.vChip, isSel && styles.vChipActive]}
                        onPress={() => setSelectedHour(h)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.vChipText, isSel && styles.vChipTextActive]}>{h}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            <View style={styles.vColDivider}>
              <Text style={styles.vColDividerColon}>:</Text>
            </View>

            {/* Minutes Column */}
            <View style={styles.verticalCol}>
              <Text style={styles.colHeaderLabel}>MINUTES</Text>
              <View style={styles.colScrollWrapper}>
                <ScrollView
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.colScrollContent}
                >
                  {MINUTES.map((m) => {
                    const isSel = selectedMin === m;
                    return (
                      <TouchableOpacity
                        key={m}
                        style={[styles.vChip, isSel && styles.vChipActive]}
                        onPress={() => setSelectedMin(m)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.vChipText, isSel && styles.vChipTextActive]}>{m}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            {/* Period Column */}
            <View style={[styles.verticalCol, { flex: 0.8 }]}>
              <Text style={styles.colHeaderLabel}>AM / PM</Text>
              <View style={[styles.colScrollWrapper, { justifyContent: 'center', gap: 10, paddingVertical: 10 }]}>
                <TouchableOpacity
                  style={[styles.periodVBtn, selectedPeriod === 'AM' && styles.periodVBtnActive]}
                  onPress={() => setSelectedPeriod('AM')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.periodVBtnText, selectedPeriod === 'AM' && styles.periodVBtnTextActive]}>
                    AM
                  </Text>
                  <Text style={[styles.periodSubText, selectedPeriod === 'AM' && styles.periodSubTextActive]}>
                    Morning
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.periodVBtn, selectedPeriod === 'PM' && styles.periodVBtnActive]}
                  onPress={() => setSelectedPeriod('PM')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.periodVBtnText, selectedPeriod === 'PM' && styles.periodVBtnTextActive]}>
                    PM
                  </Text>
                  <Text style={[styles.periodSubText, selectedPeriod === 'PM' && styles.periodSubTextActive]}>
                    Evening
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Confirm Button */}
          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={handleConfirm}
            activeOpacity={0.85}
          >
            <Text style={styles.confirmBtnText}>
              ✓ Set Time to {selectedHour}:{selectedMin} {selectedPeriod}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0d1117',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#21262d',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  badge: {
    color: '#2dd4a0',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    color: '#f0f6fc',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#161b22',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#30363d',
  },
  closeBtnText: {
    color: '#8b949e',
    fontSize: 14,
    fontWeight: '700',
  },
  timePreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#161b22',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#2dd4a0',
  },
  digitBox: {
    alignItems: 'center',
    minWidth: 64,
  },
  digitText: {
    color: '#2dd4a0',
    fontSize: 34,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  digitSub: {
    color: '#8b949e',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 2,
  },
  colonText: {
    color: '#2dd4a0',
    fontSize: 32,
    fontWeight: '900',
    marginHorizontal: 10,
    marginBottom: 12,
  },
  periodCol: {
    marginLeft: 18,
    gap: 6,
  },
  periodBtn: {
    backgroundColor: '#0d1117',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
  },
  periodBtnActive: {
    backgroundColor: '#2dd4a0',
    borderColor: '#2dd4a0',
  },
  periodBtnText: {
    color: '#8b949e',
    fontSize: 12,
    fontWeight: '800',
  },
  periodBtnTextActive: {
    color: '#000000',
    fontWeight: '900',
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  quickChip: {
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  quickChipText: {
    color: '#c9d1d9',
    fontSize: 11,
    fontWeight: '600',
  },
  sectionLabel: {
    color: '#8b949e',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  chip: {
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 10,
    width: 44,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: 'rgba(45, 212, 160, 0.15)',
    borderColor: '#2dd4a0',
  },
  chipText: {
    color: '#c9d1d9',
    fontSize: 13,
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#2dd4a0',
    fontWeight: '800',
  },
  confirmBtn: {
    backgroundColor: '#2dd4a0',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  confirmBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
  verticalColumnsContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#131822',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#21262d',
    padding: 10,
    marginBottom: 10,
    height: 195,
  },
  verticalCol: {
    flex: 1,
    alignItems: 'center',
  },
  colHeaderLabel: {
    color: '#8b949e',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  colScrollWrapper: {
    flex: 1,
    width: '100%',
    backgroundColor: '#0d1117',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#21262d',
    overflow: 'hidden',
  },
  colScrollContent: {
    paddingVertical: 6,
    paddingHorizontal: 6,
    gap: 6,
    alignItems: 'center',
  },
  vChip: {
    width: '100%',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vChipActive: {
    backgroundColor: 'rgba(45, 212, 160, 0.2)',
    borderColor: '#2dd4a0',
  },
  vChipText: {
    color: '#c9d1d9',
    fontSize: 15,
    fontWeight: '700',
  },
  vChipTextActive: {
    color: '#2dd4a0',
    fontWeight: '900',
  },
  vColDivider: {
    width: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vColDividerColon: {
    color: '#484f58',
    fontSize: 22,
    fontWeight: '900',
  },
  periodVBtn: {
    marginHorizontal: 6,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodVBtnActive: {
    backgroundColor: '#2dd4a0',
    borderColor: '#2dd4a0',
  },
  periodVBtnText: {
    color: '#8b949e',
    fontSize: 15,
    fontWeight: '800',
  },
  periodVBtnTextActive: {
    color: '#000000',
    fontWeight: '900',
  },
  periodSubText: {
    color: '#6e7681',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
  periodSubTextActive: {
    color: '#0d1117',
    fontWeight: '800',
  },
});

export default TimePickerModal;
