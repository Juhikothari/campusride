// campusride-mobile/src/components/LiveMapView.jsx
// Native MapLibre + OpenStreetMap implementation with crisp POI/road visibility,
// multi-seeker pickup & drop USN pins, single combined GPS crosshair control, and stable camera state.
import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import {
  Map,
  Camera,
  GeoJSONSource,
  Layer,
  Marker,
  ViewAnnotation,
  UserLocation,
} from '@maplibre/maplibre-react-native';
import { radius } from '../theme';
import {
  MAP_STYLE_URL,
  MAP_ATTRIBUTION,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  toLngLat,
  computeLngLatBounds,
} from '../config/mapConfig';

function GpsCrosshairGlyph({ active = false }) {
  const c = active ? '#0f172a' : '#f5a623';
  return (
    <View style={{ width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 1.8, borderColor: c, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: c }} />
      </View>
      <View style={{ position: 'absolute', top: 0, width: 1.8, height: 4, backgroundColor: c, borderRadius: 1 }} />
      <View style={{ position: 'absolute', bottom: 0, width: 1.8, height: 4, backgroundColor: c, borderRadius: 1 }} />
      <View style={{ position: 'absolute', left: 0, height: 1.8, width: 4, backgroundColor: c, borderRadius: 1 }} />
      <View style={{ position: 'absolute', right: 0, height: 1.8, width: 4, backgroundColor: c, borderRadius: 1 }} />
    </View>
  );
}

function coordKey(pt) {
  return pt ? `${pt[0].toFixed(5)},${pt[1].toFixed(5)}` : '';
}

export default function LiveMapView({
  pickup,
  drop,
  driverLocation,
  coordinates = [],
  leg1Coordinates = [],
  leg2Coordinates = [],
  routeGeoJSON = null,
  extraPickups = [],
  extraDrops = [],
  pinLocation,
  pinDraggable = false,
  onPinDragStart,
  onPinDrag,
  onPinDragEnd,
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
  const pinAnnotationRef = useRef(null);
  const hasFittedBoundsRef = useRef(false);
  const lastPinKeyRef = useRef('');
  const lastFollowKeyRef = useRef('');
  const skipNextPinEaseRef = useRef(false);
  const dragSuppressedUntilRef = useRef(0);
  const userInteractingRef = useRef(false);

  const [mapReady, setMapReady] = useState(false);
  const [isDraggingPin, setIsDraggingPin] = useState(false);
  const [selectedStopInfo, setSelectedStopInfo] = useState(null);

  // Stabilize coordinate arrays using primitive rounded keys so parent timer ticks never jump camera
  const rawPickup = toLngLat(pickup);
  const pickupKey = coordKey(rawPickup);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pickupLngLat = useMemo(() => rawPickup, [pickupKey]);

  const rawDrop = toLngLat(drop);
  const dropKey = coordKey(rawDrop);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dropLngLat = useMemo(() => rawDrop, [dropKey]);

  const rawDriver = toLngLat(driverLocation);
  const driverKey = coordKey(rawDriver);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const driverLngLat = useMemo(() => rawDriver, [driverKey]);

  const rawPin = toLngLat(pinLocation);
  const pinKey = coordKey(rawPin);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pinLngLat = useMemo(() => rawPin, [pinKey]);

  const extraPickupsSerialized = Array.isArray(extraPickups)
    ? extraPickups.map((ep, idx) => `${idx}:${ep?.usn || ep?.label || ''}:${coordKey(toLngLat(ep))}`).join('|')
    : '';

  const extraPickupPoints = useMemo(() => {
    if (!Array.isArray(extraPickups)) return [];
    return extraPickups
      .map((ep, idx) => {
        const lngLat = toLngLat(ep);
        if (!lngLat) return null;
        const usnLabel = ep?.usn || ep?.label || `Seeker ${idx + 1}`;
        return {
          id: `extra-pickup-${idx}`,
          usn: usnLabel,
          address: ep?.address || '',
          title: `Pickup — ${usnLabel}`,
          lngLat,
        };
      })
      .filter(Boolean);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extraPickupsSerialized]);

  const extraDropsSerialized = Array.isArray(extraDrops)
    ? extraDrops.map((ed, idx) => `${idx}:${ed?.usn || ed?.label || ''}:${coordKey(toLngLat(ed))}`).join('|')
    : '';

  const extraDropPoints = useMemo(() => {
    if (!Array.isArray(extraDrops)) return [];
    return extraDrops
      .map((ed, idx) => {
        const lngLat = toLngLat(ed);
        if (!lngLat) return null;
        const usnLabel = ed?.usn || ed?.label || `Seeker ${idx + 1}`;
        return {
          id: `extra-drop-${idx}`,
          usn: usnLabel,
          address: ed?.address || '',
          title: `Drop — ${usnLabel}`,
          lngLat,
        };
      })
      .filter(Boolean);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extraDropsSerialized]);

  const routeKey = useMemo(() => {
    if (routeGeoJSON?.geometry?.coordinates?.length) {
      const c = routeGeoJSON.geometry.coordinates;
      return `gj:${c.length}:${c[0]?.[0]}:${c[c.length - 1]?.[1]}`;
    }
    const len = coordinates?.length || 0;
    const l1 = leg1Coordinates?.length || 0;
    const l2 = leg2Coordinates?.length || 0;
    const first = coordinates?.[0] || leg1Coordinates?.[0] || '';
    const last = coordinates?.[len - 1] || leg2Coordinates?.[l2 - 1] || '';
    return `${len}:${l1}:${l2}:${JSON.stringify(first)}:${JSON.stringify(last)}`;
  }, [routeGeoJSON, coordinates, leg1Coordinates, leg2Coordinates]);

  const routeFeatureCollection = useMemo(() => {
    if (routeGeoJSON?.geometry?.type === 'LineString' && Array.isArray(routeGeoJSON.geometry.coordinates) && routeGeoJSON.geometry.coordinates.length > 1) {
      return {
        type: 'FeatureCollection',
        features: [routeGeoJSON],
      };
    }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  const initialCenter = useMemo(() => {
    return pinLngLat || driverLngLat || pickupLngLat || dropLngLat || DEFAULT_CENTER;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ease camera ONLY when external pin coordinates change intentionally (never during drag)
  useEffect(() => {
    if (!mapReady || !pinLngLat || !cameraRef.current) return;
    if (pinKey === lastPinKeyRef.current) return;
    lastPinKeyRef.current = pinKey;
    if (skipNextPinEaseRef.current || isDraggingPin) {
      skipNextPinEaseRef.current = false;
      return;
    }
    try {
      cameraRef.current.easeTo({
        center: pinLngLat,
        zoom: 15.5,
        duration: 420,
      });
    } catch {}
  }, [mapReady, pinLngLat, pinKey, isDraggingPin]);

  // Fit bounds ONCE on initial load (never interrupts user pan/zoom afterward)
  useEffect(() => {
    if (!mapReady || !cameraRef.current || hasFittedBoundsRef.current || pinLngLat || userInteractingRef.current) return;
    const allPts = [];
    if (routeFeatureCollection?.features?.[0]?.geometry?.coordinates?.length > 1) {
      allPts.push(...routeFeatureCollection.features[0].geometry.coordinates);
    } else {
      if (driverLngLat) allPts.push(driverLngLat);
      if (pickupLngLat) allPts.push(pickupLngLat);
      extraPickupPoints.forEach(p => allPts.push(p.lngLat));
      extraDropPoints.forEach(d => allPts.push(d.lngLat));
      if (dropLngLat) allPts.push(dropLngLat);
    }

    if (allPts.length > 1) {
      const bounds = computeLngLatBounds(allPts);
      if (bounds) {
        hasFittedBoundsRef.current = true;
        try {
          cameraRef.current.fitBounds(bounds, {
            padding: { top: 48, right: 48, bottom: 48, left: 48 },
            duration: 550,
          });
        } catch {}
      }
    } else if (allPts.length === 1) {
      hasFittedBoundsRef.current = true;
      try {
        cameraRef.current.easeTo({ center: allPts[0], zoom: 14.5, duration: 480 });
      } catch {}
    }
  }, [mapReady, pinLngLat, routeFeatureCollection, driverLngLat, pickupLngLat, dropLngLat, extraPickupPoints, extraDropPoints]);

  // Follow-driver mode: only ease when driver coords actually moved and followDriver is enabled
  useEffect(() => {
    if (!mapReady || !followDriver || !driverLngLat || !cameraRef.current || userInteractingRef.current) return;
    if (driverKey === lastFollowKeyRef.current) return;
    lastFollowKeyRef.current = driverKey;
    try {
      cameraRef.current.easeTo({
        center: driverLngLat,
        duration: 600,
      });
    } catch {}
  }, [mapReady, followDriver, driverLngLat, driverKey]);

  const extractEventCoords = useCallback((event) => {
    const lngLat = event?.nativeEvent?.lngLat;
    if (!Array.isArray(lngLat) || lngLat.length < 2) return null;
    const lng = Number(lngLat[0]);
    const lat = Number(lngLat[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
  }, []);

  const handleMapPress = useCallback((event) => {
    setSelectedStopInfo(null);
    if (!interactive || !onMapClick) return;
    if (isDraggingPin || Date.now() < dragSuppressedUntilRef.current) return;
    const pt = extractEventCoords(event);
    if (pt) {
      onMapClick(pt);
    }
  }, [interactive, onMapClick, isDraggingPin, extractEventCoords]);

  const handlePinDragStart = useCallback((event) => {
    if (!interactive || !pinDraggable) return;
    setIsDraggingPin(true);
    dragSuppressedUntilRef.current = Date.now() + 1000;
    const pt = extractEventCoords(event);
    if (pt && onPinDragStart) onPinDragStart(pt);
    requestAnimationFrame(() => {
      try { pinAnnotationRef.current?.refresh(); } catch {}
    });
  }, [interactive, pinDraggable, extractEventCoords, onPinDragStart]);

  const handlePinDrag = useCallback((event) => {
    if (!interactive || !pinDraggable) return;
    dragSuppressedUntilRef.current = Date.now() + 1000;
    const pt = extractEventCoords(event);
    if (pt && onPinDrag) onPinDrag(pt);
  }, [interactive, pinDraggable, extractEventCoords, onPinDrag]);

  const handlePinDragEnd = useCallback((event) => {
    if (!interactive || !pinDraggable) return;
    setIsDraggingPin(false);
    dragSuppressedUntilRef.current = Date.now() + 300;
    const pt = extractEventCoords(event);
    if (pt) {
      skipNextPinEaseRef.current = true;
      lastPinKeyRef.current = `${pt.lng.toFixed(5)},${pt.lat.toFixed(5)}`;
      if (onPinDragEnd) {
        onPinDragEnd(pt);
      } else if (onMapClick) {
        onMapClick(pt);
      }
    }
    requestAnimationFrame(() => {
      try { pinAnnotationRef.current?.refresh(); } catch {}
    });
  }, [interactive, pinDraggable, extractEventCoords, onPinDragEnd, onMapClick]);

  const handleRegionWillChange = useCallback((event) => {
    const isUser = Boolean(event?.nativeEvent?.isUserInteraction ?? event?.nativeEvent?.userInteraction);
    if (isUser) {
      userInteractingRef.current = true;
      if (followDriver && onFollowChange) {
        onFollowChange(false);
      }
    }
  }, [followDriver, onFollowChange]);

  const handleRegionDidChange = useCallback((event) => {
    const isUser = Boolean(event?.nativeEvent?.isUserInteraction ?? event?.nativeEvent?.userInteraction);
    userInteractingRef.current = false;
    if (isUser && followDriver && onFollowChange) {
      onFollowChange(false);
    }
  }, [followDriver, onFollowChange]);

  // Single unified crosshair button handler (recenter + toggle follow mode cleanly)
  const handleUnifiedLocatePress = useCallback(() => {
    userInteractingRef.current = false;
    if (onRecenter) {
      onRecenter();
    }
    if (driverLngLat && onFollowChange) {
      const nextFollow = !followDriver;
      onFollowChange(nextFollow);
      if (nextFollow && cameraRef.current) {
        lastFollowKeyRef.current = driverKey;
        try {
          cameraRef.current.flyTo({ center: driverLngLat, zoom: 15.5, duration: 520 });
        } catch {}
        return;
      }
    }

    if (!cameraRef.current) return;

    if (pinLngLat && !driverLngLat && !pickupLngLat && !dropLngLat) {
      cameraRef.current.flyTo({ center: pinLngLat, zoom: 15.5, duration: 500 });
      return;
    }

    const pts = [];
    if (driverLngLat) pts.push(driverLngLat);
    if (pickupLngLat) pts.push(pickupLngLat);
    extraPickupPoints.forEach(p => pts.push(p.lngLat));
    extraDropPoints.forEach(d => pts.push(d.lngLat));
    if (dropLngLat) pts.push(dropLngLat);

    if (pts.length > 1) {
      const b = computeLngLatBounds(pts);
      if (b) {
        cameraRef.current.fitBounds(b, {
          padding: { top: 48, right: 48, bottom: 48, left: 48 },
          duration: 550,
        });
      }
    } else if (pts.length === 1) {
      cameraRef.current.flyTo({ center: pts[0], zoom: 15, duration: 500 });
    }
  }, [
    onRecenter, driverLngLat, driverKey, onFollowChange, followDriver,
    pinLngLat, pickupLngLat, dropLngLat, extraPickupPoints, extraDropPoints,
  ]);

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
        onRegionWillChange={handleRegionWillChange}
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
                'line-opacity': 0.32,
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

        {/* 3. Seeker Individual Pickups with USN */}
        {extraPickupPoints.map(ep => (
          <Marker
            key={ep.id}
            id={ep.id}
            lngLat={ep.lngLat}
            anchor="bottom"
            onPress={() => setSelectedStopInfo({ kind: 'pickup', usn: ep.usn, address: ep.address })}
          >
            <View style={styles.markerWrapper}>
              <View style={[styles.badge, styles.badgeSeekerPickup]}>
                <Text style={styles.badgeText}>📍 PICKUP · {ep.usn}</Text>
              </View>
              <View style={[styles.arrow, { borderTopColor: '#10b981' }]} />
            </View>
          </Marker>
        ))}

        {/* 4. Seeker Individual Drops with USN */}
        {extraDropPoints.map(ed => (
          <Marker
            key={ed.id}
            id={ed.id}
            lngLat={ed.lngLat}
            anchor="bottom"
            onPress={() => setSelectedStopInfo({ kind: 'drop', usn: ed.usn, address: ed.address })}
          >
            <View style={styles.markerWrapper}>
              <View style={[styles.badge, styles.badgeSeekerDrop]}>
                <Text style={styles.badgeText}>🏁 DROP · {ed.usn}</Text>
              </View>
              <View style={[styles.arrow, { borderTopColor: '#e11d48' }]} />
            </View>
          </Marker>
        ))}

        {/* 5. Provider Destination / Drop Marker */}
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

        {/* 6. Draggable Selected Pin Annotation (Map Picker) */}
        {pinLngLat && (
          <ViewAnnotation
            ref={pinAnnotationRef}
            id="annotation-selected-pin"
            lngLat={pinLngLat}
            anchor="bottom"
            selected={true}
            draggable={Boolean(interactive && pinDraggable)}
            onDragStart={handlePinDragStart}
            onDrag={handlePinDrag}
            onDragEnd={handlePinDragEnd}
          >
            <View style={styles.draggablePinRoot} collapsable={false}>
              <View style={[styles.pinBodyLift, isDraggingPin && styles.pinBodyLifted]}>
                <View style={[styles.badge, styles.badgePin, isDraggingPin && styles.badgePinDragging]}>
                  <Text style={[styles.badgeText, { color: '#0f172a' }]} numberOfLines={1}>
                    {isDraggingPin ? 'RELEASE PIN' : 'DRAG PIN'}
                  </Text>
                </View>
                <View style={[styles.pinHead, isDraggingPin && styles.pinHeadDragging]}>
                  <View style={styles.pinHeadInner} />
                </View>
                <View style={styles.pinStem} />
              </View>
              <View style={[styles.pinAnchorShadow, isDraggingPin && styles.pinAnchorShadowDragging]} />
            </View>
          </ViewAnnotation>
        )}
      </Map>

      {/* Stop Marker Info Callout */}
      {selectedStopInfo && (
        <View style={styles.calloutCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.calloutTitle}>
              {selectedStopInfo.kind === 'pickup' ? '📍 Seeker Pickup' : '🏁 Seeker Drop'} · {selectedStopInfo.usn}
            </Text>
            {Boolean(selectedStopInfo.address) && (
              <Text style={styles.calloutSub} numberOfLines={2}>
                {selectedStopInfo.address}
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={() => setSelectedStopInfo(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.calloutClose}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Single Combined Floating GPS Crosshair / Follow-Recenter Button */}
      {interactive && showControls && (
        <TouchableOpacity
          onPress={handleUnifiedLocatePress}
          activeOpacity={0.85}
          style={[
            styles.singleLocateBtn,
            followDriver && styles.singleLocateBtnActive,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Recenter map and toggle follow"
        >
          <GpsCrosshairGlyph active={followDriver} />
        </TouchableOpacity>
      )}

      {/* Required OpenStreetMap & CARTO Attribution */}
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
    paddingHorizontal: 9,
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
  badgeSeekerPickup: {
    backgroundColor: '#10b981',
  },
  badgeDrop: {
    backgroundColor: '#dc2626',
  },
  badgeSeekerDrop: {
    backgroundColor: '#e11d48',
  },
  badgePin: {
    backgroundColor: '#f5a623',
    marginBottom: 4,
  },
  badgePinDragging: {
    backgroundColor: '#fbbf24',
    borderColor: '#0f172a',
  },
  draggablePinRoot: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 2,
  },
  pinBodyLift: {
    alignItems: 'center',
  },
  pinBodyLifted: {
    transform: [{ translateY: -6 }, { scale: 1.06 }],
  },
  pinHead: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f5a623',
    borderWidth: 3,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },
  pinHeadDragging: {
    backgroundColor: '#ef4444',
  },
  pinHeadInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0f172a',
  },
  pinStem: {
    width: 3,
    height: 10,
    backgroundColor: '#0f172a',
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    marginTop: -1,
  },
  pinAnchorShadow: {
    width: 10,
    height: 5,
    borderRadius: 5,
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    marginTop: -2,
  },
  pinAnchorShadowDragging: {
    width: 14,
    height: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.45)',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.3,
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
  singleLocateBtn: {
    position: 'absolute',
    bottom: 30,
    right: 12,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderWidth: 1.5,
    borderColor: 'rgba(245,166,35,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  singleLocateBtnActive: {
    backgroundColor: '#f5a623',
    borderColor: '#ffffff',
  },
  calloutCard: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    elevation: 6,
  },
  calloutTitle: {
    color: '#f5a623',
    fontSize: 12,
    fontWeight: '800',
  },
  calloutSub: {
    color: '#e2e8f0',
    fontSize: 11.5,
    marginTop: 2,
  },
  calloutClose: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '800',
    paddingHorizontal: 4,
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
