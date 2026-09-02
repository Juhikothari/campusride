import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, radius } from '../theme';

export default function LiveMapView({
  pickup,
  drop,
  driverLocation,
  coordinates = [],
  pinLocation,
  onMapClick,
  height = 280,
  interactive = true,
  style,
}) {
  const webViewRef = useRef(null);

  // Compute center point
  const defaultLat = pinLocation?.lat || driverLocation?.lat || pickup?.lat || 12.9716;
  const defaultLng = pinLocation?.lng || driverLocation?.lng || pickup?.lng || 77.5946;

  const generateLeafletHTML = () => {
    const pLat = pickup?.lat ? parseFloat(pickup.lat) : null;
    const pLng = pickup?.lng ? parseFloat(pickup.lng) : null;
    const dLat = drop?.lat ? parseFloat(drop.lat) : null;
    const dLng = drop?.lng ? parseFloat(drop.lng) : null;
    const drLat = driverLocation?.lat ? parseFloat(driverLocation.lat) : null;
    const drLng = driverLocation?.lng ? parseFloat(driverLocation.lng) : null;
    const pinLat = pinLocation?.lat ? parseFloat(pinLocation.lat) : null;
    const pinLng = pinLocation?.lng ? parseFloat(pinLocation.lng) : null;

    const coordsArray = (coordinates && coordinates.length > 0)
      ? coordinates.map(c => `[${c.latitude || c.lat}, ${c.longitude || c.lng}]`).join(',')
      : (pLat && pLng && dLat && dLng) ? `[${pLat}, ${pLng}], [${dLat}, ${dLng}]` : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          html, body, #map {
            margin: 0; padding: 0; width: 100%; height: 100%;
            background: #0f131a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          .custom-pin {
            display: flex; align-items: center; justify-content: center;
            font-size: 20px; text-shadow: 0 2px 4px rgba(0,0,0,0.6);
          }
          .pulse-dot {
            width: 14px; height: 14px; border-radius: 50%;
            background: #00E676; border: 2.5px solid #fff;
            box-shadow: 0 0 10px rgba(0,230,118,0.8);
          }
          .car-icon {
            font-size: 24px; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.8));
          }
          .leaflet-bar { border: none !important; }
          .leaflet-bar a { background: #161b24 !important; color: #f5a623 !important; border: 1px solid rgba(255,255,255,0.1) !important; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          const map = L.map('map', {
            zoomControl: ${interactive ? 'true' : 'false'},
            attributionControl: false,
            dragging: ${interactive ? 'true' : 'false'},
            touchZoom: ${interactive ? 'true' : 'false'},
          }).setView([${defaultLat}, ${defaultLng}], 14);

          // OpenStreetMap free street tiles (no API key required)
          L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: ''
          }).addTo(map);

          const markers = [];

          // Pickup marker
          ${pLat && pLng ? `
            const pIcon = L.divIcon({ className: 'custom-pin', html: '🟢', iconSize: [24, 24], iconAnchor: [12, 12] });
            const pMarker = L.marker([${pLat}, ${pLng}], { icon: pIcon }).addTo(map).bindPopup('<b>Pickup</b>');
            markers.push([${pLat}, ${pLng}]);
          ` : ''}

          // Drop marker
          ${dLat && dLng ? `
            const dIcon = L.divIcon({ className: 'custom-pin', html: '🏁', iconSize: [24, 24], iconAnchor: [12, 12] });
            const dMarker = L.marker([${dLat}, ${dLng}], { icon: dIcon }).addTo(map).bindPopup('<b>Destination</b>');
            markers.push([${dLat}, ${dLng}]);
          ` : ''}

          // Real-time Driver marker
          ${drLat && drLng ? `
            const drIcon = L.divIcon({ className: 'custom-pin car-icon', html: '🚗', iconSize: [28, 28], iconAnchor: [14, 14] });
            const drMarker = L.marker([${drLat}, ${drLng}], { icon: drIcon }).addTo(map).bindPopup('<b>Driver Live Location</b>');
            markers.push([${drLat}, ${drLng}]);
          ` : ''}

          // Pin marker for location picking
          ${pinLat && pinLng ? `
            const pinIcon = L.divIcon({ className: 'custom-pin', html: '📍', iconSize: [32, 32], iconAnchor: [16, 30] });
            const pinMarker = L.marker([${pinLat}, ${pinLng}], { icon: pinIcon, draggable: true }).addTo(map);
            pinMarker.on('dragend', function(e) {
              const pos = e.target.getLatLng();
              window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'PIN_MOVED', lat: pos.lat, lng: pos.lng
              }));
            });
            markers.push([${pinLat}, ${pinLng}]);
          ` : ''}

          // Polyline route
          ${coordsArray ? `
            const routePoints = [${coordsArray}];
            const polyline = L.polyline(routePoints, {
              color: '#f5a623',
              weight: 5,
              opacity: 0.9,
              lineJoin: 'round'
            }).addTo(map);
            map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
          ` : `
            if (markers.length > 1) {
              map.fitBounds(L.latLngBounds(markers), { padding: [40, 40] });
            } else if (markers.length === 1) {
              map.setView(markers[0], 15);
            }
          `}

          // Map click handler
          map.on('click', function(e) {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'MAP_CLICK', lat: e.latlng.lat, lng: e.latlng.lng
            }));
          });
        </script>
      </body>
      </html>
    `;
  };

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (onMapClick && (data.type === 'MAP_CLICK' || data.type === 'PIN_MOVED')) {
        onMapClick({ lat: data.lat, lng: data.lng });
      }
    } catch {}
  };

  return (
    <View style={[styles.container, { height }, style]}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: generateLeafletHTML() }}
        onMessage={handleMessage}
        style={styles.webView}
        scrollEnabled={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        renderLoading={() => (
          <View style={styles.loader}>
            <ActivityIndicator color={colors.accent} size="small" />
          </View>
        )}
        startInLoadingState={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(245,166,35,0.3)',
    backgroundColor: '#0f131a',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0f131a',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
