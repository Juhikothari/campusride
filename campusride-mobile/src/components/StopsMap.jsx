// campusride-mobile/src/components/StopsMap.jsx
// Native MapLibre + OpenStreetMap route & multi-stop viewer (zero WebView/Leaflet).
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Map, Camera, GeoJSONSource, Layer, Marker } from '@maplibre/maplibre-react-native';
import {
  MAP_STYLE_URL,
  MAP_ATTRIBUTION,
  DEFAULT_CENTER,
  toLngLat,
  computeLngLatBounds,
} from '../config/mapConfig';

const COLORS = {
  start: '#22c55e',
  pickup: '#f5a623',
  drop: '#3b82f6',
  destination: '#ef4444',
};

export default function StopsMap({ stops, geometry, height = 280 }) {
  const cameraRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  const normalizedStops = useMemo(() => {
    if (!Array.isArray(stops)) return [];
    return stops
      .map((s, idx) => ({
        key: `${s.type || 'stop'}-${idx}`,
        index: idx,
        type: s.type,
        lngLat: toLngLat(s),
        badge: s.type === 'start' ? 'S' : s.type === 'destination' ? '🏁' : String(idx),
        color: COLORS[s.type] || '#64748b',
      }))
      .filter(s => Boolean(s.lngLat));
  }, [stops]);

  const routeFeatureCollection = useMemo(() => {
    const lineCoords = Array.isArray(geometry)
      ? geometry.map(toLngLat).filter(Boolean)
      : [];
    if (lineCoords.length < 2) return null;
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: lineCoords,
          },
          properties: {},
        },
      ],
    };
  }, [geometry]);

  useEffect(() => {
    if (!mapReady || !cameraRef.current) return;
    const pts = [];
    if (routeFeatureCollection?.features?.[0]?.geometry?.coordinates?.length) {
      pts.push(...routeFeatureCollection.features[0].geometry.coordinates);
    }
    normalizedStops.forEach(s => pts.push(s.lngLat));
    if (pts.length > 1) {
      const bounds = computeLngLatBounds(pts);
      if (bounds) {
        try {
          cameraRef.current.fitBounds(bounds, {
            padding: { top: 36, right: 36, bottom: 36, left: 36 },
            duration: 500,
          });
        } catch {}
      }
    } else if (pts.length === 1) {
      try {
        cameraRef.current.easeTo({ center: pts[0], zoom: 14, duration: 400 });
      } catch {}
    }
  }, [mapReady, routeFeatureCollection, normalizedStops]);

  const initialCenter = normalizedStops[0]?.lngLat || DEFAULT_CENTER;

  return (
    <View style={[styles.container, { height }]}>
      <Map
        style={styles.map}
        mapStyle={MAP_STYLE_URL}
        androidView={Platform.OS === 'android' ? 'texture' : 'surface'}
        attribution={false}
        logo={false}
        compass={true}
        onDidFinishLoadingMap={() => setMapReady(true)}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{ center: initialCenter, zoom: 12.5 }}
          minZoom={3}
          maxZoom={20}
        />

        {routeFeatureCollection && (
          <GeoJSONSource id="stops-route-source" data={routeFeatureCollection}>
            <Layer
              id="stops-route-line"
              type="line"
              paint={{
                'line-color': '#f5a623',
                'line-width': 5,
                'line-opacity': 0.92,
                'line-cap': 'round',
                'line-join': 'round',
              }}
            />
          </GeoJSONSource>
        )}

        {normalizedStops.map(s => (
          <Marker key={s.key} id={s.key} lngLat={s.lngLat} anchor="center">
            <View style={[styles.pin, { backgroundColor: s.color }]}>
              <Text style={styles.pinText}>{s.badge}</Text>
            </View>
          </Marker>
        ))}
      </Map>

      <View style={styles.attributionBox} pointerEvents="none">
        <Text style={styles.attributionText}>{MAP_ATTRIBUTION}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0c0f17',
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.25)',
  },
  map: {
    flex: 1,
  },
  pin: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  pinText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '900',
  },
  attributionBox: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  attributionText: {
    color: '#e2e8f0',
    fontSize: 9.5,
    fontWeight: '600',
  },
});
