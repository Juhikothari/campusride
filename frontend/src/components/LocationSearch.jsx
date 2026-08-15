import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { colors, radius, spacing } from '../theme';
import { searchLocation } from '../services/api';

export default function LocationSearch({ value, onChange, placeholder, label }) {
  const [query,       setQuery]       = useState(value || '');
  const [results,     setResults]     = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef(null);

  const search = useCallback((text) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim() || text.length < 2) { setResults([]); setShowResults(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchLocation(text);
        setResults(Array.isArray(data) ? data.slice(0, 6) : []);
        setShowResults(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
  }, []);

  const select = (item) => {
    const label = item.label || item.display_name?.split(',').slice(0, 2).join(', ').trim() || item.name || '';
    const lat   = item.lat  || item.latitude  || '';
    const lng   = item.lon  || item.longitude || item.lng || '';
    setQuery(label);
    setResults([]);
    setShowResults(false);
    onChange(label, lat, lng);
  };

  const clear = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
    onChange('', '', '');
  };

  return (
    <View style={{ marginBottom: spacing.md }}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.inputWrap}>
        <Text style={styles.icon}>📍</Text>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={search}
          placeholder={placeholder || 'Search location…'}
          placeholderTextColor={colors.text3}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {loading && <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: 10 }} />}
        {query.length > 0 && !loading && (
          <TouchableOpacity onPress={clear} style={{ padding: 8 }}>
            <Text style={{ color: colors.text3, fontSize: 16 }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {showResults && results.length > 0 && (
        <View style={styles.dropdown}>
          {results.map((item, idx) => {
            const displayName = item.label || item.display_name?.split(',').slice(0, 3).join(', ') || item.name || '';
            return (
              <TouchableOpacity key={idx} style={[styles.resultItem, idx < results.length - 1 && styles.resultBorder]} onPress={() => select(item)}>
                <Text style={styles.resultIcon}>📍</Text>
                <Text style={styles.resultText} numberOfLines={2}>{displayName}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.text2,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingLeft: 12,
  },
  icon: { fontSize: 15, marginRight: 8 },
  input: {
    flex: 1,
    color: colors.text,
    paddingVertical: 12,
    fontSize: 14,
  },
  dropdown: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginTop: 4,
    overflow: 'hidden',
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  resultBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  resultIcon: { fontSize: 14 },
  resultText: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 18 },
});
