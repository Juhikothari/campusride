// campusride-mobile/src/components/LiveMapView.jsx
// Native MapLibre + OpenStreetMap implementation using OpenFreeMap styles.
// Uses GeoJSON [longitude, latitude] coordinates and imperative Camera updates.
import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import {
  Map,
  Camera,
  GeoJSONSource,
  Layer,
  Marker,
  UserLocation,
} from '@maplibre/maplibre-react-native';
import { colors, radius } from '../theme';
import {
  MAP_STYLE_URL,
  MAP_ATTRIBUTION,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  toLngLat,
  computeLngLatBounds,
} from '../config/mapConfig';

export default function LiveMapView({
  pickup,
  drop,
  driverLocation,
  coordinates = [],
  leg1Coordinates = [],
  leg2Coordinates = [],
  routeGeoJSON = null,
  extraPickups = [],
  pinLocation,
  onMapClick,
  onRecenter,
  followDriver = false,
  onFollowChange,
  driverStale = false,
  height = 280,
  interactive = true,
  inModal = false,
  showControls = true,
  showUserLocation = true,
  style,
}) {
  const cameraRef = useRef(null);
  const mapRef = useRef(null);
  const hasFittedBoundsRef = useRef(false);
  const lastPinKeyRef = useRef('');
  const [mapReady, setMapReady] = useState(false);

  const pickupLngLat = useMemo(() => toLngLat(pickup), [pickup]);
  const dropLngLat = useMemo(() => toLngLat(drop), [drop]);
  const driverLngLat = useMemo(() => toLngLat(driverLocation), [driverLocation]);
  const pinLngLat = useMemo(() => toLngLat(pinLocation), [pinLocation]);

  const extraPickupPoints = useMemo(() => {
    if (!Array.isArray(extraPickups)) return [];
    return extraPickups
      .map((ep, idx) => ({
        id: `extra-pickup-${idx}`,
        num: idx + 2,
        label: ep?.label || `Pickup ${idx + 2}`,
        lngLat: toLngLat(ep),
      }))
      .filter(p => Boolean(p.lngLat));
  }, [extraPickups]);

  // Build unified GeoJSON FeatureCollection for route rendering ([longitude, latitude])
  const routeFeatureCollection = useMemo(() => {
    // 1. Explicit GeoJSON feature/collection provided by backend OSRM route endpoint
    if (routeGeoJSON?.geometry?.type === 'LineString' && Array.isArray(routeGeoJSON.geometry.coordinates) && routeGeoJSON.geometry.coordinates.length > 1) {
      return {
        type: 'FeatureCollection',
        features: [routeGeoJSON],
      };
    }

    // 2. Merged coordinates array from route legs
    let pts = [];
    if (Array.isArray(coordinates) && coordinates.length > 1) {
      pts = coordinates.map(toLngLat).filter(Boolean);
    } else if ((leg1Coordinates && leg1Coordinates.length > 0) || (leg2Coordinates && leg2Coordinates.length > 0)) {
      pts = [...(leg1Coordinates || []), ...(leg2Coordinates || [])].map(toLngLat).filter(Boolean);
    }

    if (pts.length > 1) {
      return {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: pts,
            },
            properties: {},
          },
        ],
      };
    }
    return null;
  }, [routeGeoJSON, coordinates, leg1Coordinates, leg2Coordinates]);

  const initialCenter = useMemo(() => {
    return pinLngLat || driverLngLat || pickupLngLat || dropLngLat || DEFAULT_CENTER;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Move camera smoothly ONLY when external pin coordinates explicitly change
  useEffect(() => {
    if (!mapReady || !pinLngLat || !cameraRef.current) return;
    const key = `${pinLngLat[0].toFixed(5)},${pinLngLat[1].toFixed(5)}`;
    if (key === lastPinKeyRef.current) return;
    lastPinKeyRef.current = key;
    try {
      cameraRef.current.easeTo({
        center: pinLngLat,
        zoom: 15,
        duration: 450,
      });
    } catch {}
  }, [mapReady, pinLngLat]);

  // Fit bounds once when initial route or multiple markers become available (never hijacks user pan afterward)
  useEffect(() => {
    if (!mapReady || !cameraRef.current || hasFittedBoundsRef.current || pinLngLat) return;
    const allPts = [];
    if (routeFeatureCollection?.features?.[0]?.geometry?.coordinates?.length > 1) {
      allPts.push(...routeFeatureCollection.features[0].geometry.coordinates);
    } else {
      if (driverLngLat) allPts.push(driverLngLat);
      if (pickupLngLat) allPts.push(pickupLngLat);
      extraPickupPoints.forEach(p => allPts.push(p.lngLat));
      if (dropLngLat) allPts.push(dropLngLat);
    }

    if (allPts.length > 1) {
      const bounds = computeLngLatBounds(allPts);
      if (bounds) {
        hasFittedBoundsRef.current = true;
        try {
          cameraRef.current.fitBounds(bounds, {
            padding: { top: 48, right: 48, bottom: 48, left: 48 },
            duration: 600,
          });
        } catch {}
      }
    } else if (allPts.length === 1) {
      hasFittedBoundsRef.current = true;
      try {
        cameraRef.current.easeTo({ center: allPts[0], zoom: 14.5, duration: 500 });
      } catch {}
    }
  }, [mapReady, pinLngLat, routeFeatureCollection, driverLngLat, pickupLngLat, dropLngLat, extraPickupPoints]);

  // Follow-driver mode: smoothly pan when active without disrupting manual panning when disabled
  useEffect(() => {
    if (!mapReady || !followDriver || !driverLngLat || !cameraRef.current) return;
    try {
      cameraRef.current.easeTo({
        center: driverLngLat,
        duration: 650,
      });
    } catch {}
  }, [mapReady, followDriver, driverLngLat]);

  const handleMapPress = useCallback((event) => {
    if (!interactive || !onMapClick) return;
    const lngLat = event?.nativeEvent?.lngLat;
    if (Array.isArray(lngLat) && lngLat.length >= 2) {
      onMapClick({ lat: Number(lngLat[1].toFixed(6)), lng: Number(lngLat[0].toFixed(6)) });
    }
  }, [interactive, onMapClick]);

  const handleRegionDidChange = useCallback((event) => {
    // Pause follow mode immediately if user panned or zoomed manually
    if (event?.nativeEvent?.userInteraction && followDriver && onFollowChange) {
      onFollowChange(false);
    }
  }, [followDriver, onFollowChange]);

  const handleRecenterPress = useCallback(() => {
    if (onRecenter) {
      onRecenter();
    }
    if (!cameraRef.current) return;

    if (pinLngLat && !driverLngLat && !pickupLngLat && !dropLngLat) {
      cameraRef.current.flyTo({ center: pinLngLat, zoom: 15, duration: 550 });
      return;
    }

    const pts = [];
    if (driverLngLat) pts.push(driverLngLat);
    if (pickupLngLat) pts.push(pickupLngLat);
    extraPickupPoints.forEach(p => pts.push(p.lngLat));
    if (dropLngLat) pts.push(dropLngLat);

    if (followDriver && driverLngLat) {
      cameraRef.current.flyTo({ center: driverLngLat, zoom: 15.5, duration: 550 });
    } else if (pts.length > 1) {
      const b = computeLngLatBounds(pts);
      if (b) {
        cameraRef.current.fitBounds(b, {
          padding: { top: 48, right: 48, bottom: 48, left: 48 },
          duration: 600,
        });
      }
    } else if (pts.length === 1) {
      cameraRef.current.flyTo({ center: pts[0], zoom: 15, duration: 550 });
    }
  }, [onRecenter, pinLngLat, driverLngLat, pickupLngLat, dropLngLat, extraPickupPoints, followDriver]);

  return (
    <View style={[styles.container, { height }, style]}>
      <Map
        ref={mapRef}
        style={styles.map}
        mapStyle={MAP_STYLE_URL}
        androidView={inModal || Platform.OS === 'android' ? 'texture' : 'surface'}
        dragPan={interactive}
        touchZoom={interactive}
        doubleTapZoom={interactive}
        touchRotate={interactive}
        touchPitch={false}
        attribution={false}
        logo={false}
        compass={interactive}
        compassPosition={{ top: 10, left: 10 }}
        onPress={handleMapPress}
        onRegionDidChange={handleRegionDidChange}
        onDidFinishLoadingMap={() => setMapReady(true)}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{
            center: initialCenter,
            zoom: DEFAULT_ZOOM,
          }}
          minZoom={3}
          maxZoom={20}
        />

        {showUserLocation && (
          <UserLocation animated={true} accuracy={false} />
        )}

        {/* GeoJSON Route Line */}
        {routeFeatureCollection && (
          <GeoJSONSource id="hogo-route-source" data={routeFeatureCollection}>
            <Layer
              id="hogo-route-halo"
              type="line"
              paint={{
                'line-color': '#1d4ed8',
                'line-width': 8,
                'line-opacity': 0.35,
                'line-cap': 'round',
                'line-join': 'round',
              }}
            />
            <Layer
              id="hogo-route-line"
              type="line"
              paint={{
                'line-color': '#2563eb',
                'line-width': 4.5,
                'line-opacity': 0.96,
                'line-cap': 'round',
                'line-join': 'round',
              }}
            />
          </GeoJSONSource>
        )}

        {/* 1. Driver / Provider Live Marker */}
        {driverLngLat && (
          <Marker id="marker-driver" lngLat={driverLngLat} anchor="bottom">
            <View style={styles.markerWrapper}>
              <View style={[styles.badge, styles.badgeDriver, driverStale && styles.badgeStale]}>
                <Text style={styles.badgeText}>
                  🚗 {driverStale ? 'LAST KNOWN' : 'DRIVER'}
                </Text>
              </View>
              <View style={[styles.arrow, { borderTopColor: driverStale ? '#64748b' : '#2563eb' }]} />
            </View>
          </Marker>
        )}

        {/* 2. Primary Pickup Marker */}
        {pickupLngLat && (
          <Marker id="marker-pickup" lngLat={pickupLngLat} anchor="bottom">
            <View style={styles.markerWrapper}>
              <View style={[styles.badge, styles.badgePickup]}>
                <Text style={styles.badgeText}>📍 PICKUP</Text>
              </View>
              <View style={[styles.arrow, { borderTopColor: '#059669' }]} />
            </View>
          </Marker>
        )}

        {/* 3. Extra Multi-Seeker Pickups */}
        {extraPickupPoints.map(ep => (
          <Marker key={ep.id} id={ep.id} lngLat={ep.lngLat} anchor="bottom">
            <View style={styles.markerWrapper}>
              <View style={[styles.badge, styles.badgePickup]}>
                <Text style={styles.badgeText}>📍 PICKUP {ep.num}</Text>
              </View>
              <View style={[styles.arrow, { borderTopColor: '#059669' }]} />
            </View>
          </Marker>
        ))}

        {/* 4. Destination / Drop Marker */}
        {dropLngLat && (
          <Marker id="marker-drop" lngLat={dropLngLat} anchor="bottom">
            <View style={styles.markerWrapper}>
              <View style={[styles.badge, styles.badgeDrop]}>
                <Text style={styles.badgeText}>🏁 DROP</Text>
              </View>
              <View style={[styles.arrow, { borderTopColor: '#dc2626' }]} />
            </View>
          </Marker>
        )}

        {/* 5. Selected Pin Marker (Map Picker) */}
        {pinLngLat && (
          <Marker id="marker-pin" lngLat={pinLngLat} anchor="bottom">
            <View style={styles.markerWrapper}>
              <View style={[styles.badge, styles.badgePin]}>
                <Text style={[styles.badgeText, { color: '#0f172a' }]}>📍 SELECTED</Text>
              </View>
              <View style={[styles.arrow, { borderTopColor: '#f5a623' }]} />
            </View>
          </Marker>
        )}
      </Map>

      {/* Interactive Overlay Controls (Recenter & Follow Driver) */}
      {interactive && showControls && (
        <View style={styles.controlsOverlay} pointerEvents="box-none">
          {Boolean(driverLngLat && onFollowChange) && (
            <TouchableOpacity
              onPress={() => onFollowChange(!followDriver)}
              activeOpacity={0.8}
              style={[
                styles.controlPill,
                followDriver ? styles.controlPillActive : styles.controlPillInactive,
              ]}
            >
              <Text style={[styles.controlPillText, followDriver && { color: '#0f172a' }]}>
                {followDriver ? '📡 Following' : '📡 Follow'}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={handleRecenterPress}
            activeOpacity={0.8}
            style={styles.recenterBtn}
            accessibilityRole="button"
            accessibilityLabel="Recenter map"
          >
            <Text style={styles.recenterIcon}>🎯</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Required OpenStreetMap & OpenFreeMap Attribution */}
      <View style={styles.attributionBox} pointerEvents="none">
        <Text style={styles.attributionText}>{MAP_ATTRIBUTION}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(245,166,35,0.35)',
    backgroundColor: '#0f131a',
  },
  map: {
    flex: 1,
  },
  markerWrapper: {
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#ffffff',
    elevation: 4,
  },
  badgeDriver: {
    backgroundColor: '#2563eb',
  },
  badgeStale: {
    backgroundColor: '#64748b',
  },
  badgePickup: {
    backgroundColor: '#059669',
  },
  badgeDrop: {
    backgroundColor: '#dc2626',
  },
  badgePin: {
    backgroundColor: '#f5a623',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
  controlsOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  controlPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    elevation: 3,
  },
  controlPillActive: {
    backgroundColor: '#f5a623',
    borderColor: '#ffffff',
  },
  controlPillInactive: {
    backgroundColor: 'rgba(15, 23, 42, 0.86)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  controlPillText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  recenterBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  recenterIcon: {
    fontSize: 16,
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
