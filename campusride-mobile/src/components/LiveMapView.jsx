import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, radius } from '../theme';

export default function LiveMapView({
  pickup,
  drop,
  driverLocation,
  coordinates = [],
  leg1Coordinates = [],
  leg2Coordinates = [],
  extraPickups = [],
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

    // Combine route coordinates into 1 single unified continuous route:
    // Start -> Pickups -> Drops -> Finish
    let unifiedPoints = [];
    if (coordinates && coordinates.length > 0) {
      unifiedPoints = coordinates;
    } else if ((leg1Coordinates && leg1Coordinates.length > 0) || (leg2Coordinates && leg2Coordinates.length > 0)) {
      unifiedPoints = [...(leg1Coordinates || []), ...(leg2Coordinates || [])];
    }

    const singleRouteArray = (unifiedPoints && unifiedPoints.length > 0)
      ? unifiedPoints.map(c => `[${c.latitude || c.lat}, ${c.longitude || c.lng}]`).join(',')
      : '';

    // Direct sequential fallback if detailed path coordinates are not loaded yet
    const fallbackSeq = [];
    if (drLat && drLng) fallbackSeq.push(`[${drLat}, ${drLng}]`);
    if (pLat && pLng) fallbackSeq.push(`[${pLat}, ${pLng}]`);
    (Array.isArray(extraPickups) ? extraPickups : []).forEach(ep => {
      const eLat = ep?.lat ? parseFloat(ep.lat) : null;
      const eLng = ep?.lng ? parseFloat(ep.lng) : null;
      if (eLat && eLng) fallbackSeq.push(`[${eLat}, ${eLng}]`);
    });
    if (dLat && dLng) fallbackSeq.push(`[${dLat}, ${dLng}]`);
    const fallbackSeqArray = fallbackSeq.length > 1 ? fallbackSeq.join(',') : '';

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
            background: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          
          /* Eye-Catching Custom Point Symbols */
          .pin-container {
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            pointer-events: auto;
          }

          /* Concentric Expanding Pulse Rings */
          .beacon-ring {
            position: absolute;
            top: 50%; left: 50%;
            border-radius: 50%;
            pointer-events: none;
            z-index: 1;
            transform: translate(-50%, -50%);
          }
          .beacon-pickup {
            width: 52px; height: 52px;
            background: rgba(16, 185, 129, 0.25);
            border: 2px solid rgba(16, 185, 129, 0.85);
            animation: pulseWave 1.8s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
          }
          .beacon-drop {
            width: 52px; height: 52px;
            background: rgba(239, 68, 68, 0.25);
            border: 2px solid rgba(239, 68, 68, 0.85);
            animation: pulseWave 1.8s cubic-bezier(0.215, 0.61, 0.355, 1) infinite 0.4s;
          }
          .beacon-driver {
            width: 58px; height: 58px;
            background: rgba(0, 229, 255, 0.28);
            border: 2.5px solid rgba(0, 229, 255, 0.95);
            animation: pulseWave 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
          }

          @keyframes pulseWave {
            0%   { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
            100% { transform: translate(-50%, -50%) scale(2.0); opacity: 0; }
          }

          /* Eye-Catching Point Badges */
          .point-badge {
            position: relative;
            z-index: 3;
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 5px 12px;
            border-radius: 24px;
            border: 2px solid #ffffff;
            font-size: 11px;
            font-weight: 900;
            letter-spacing: 0.6px;
            color: #ffffff;
            white-space: nowrap;
            text-shadow: 0 1px 3px rgba(0,0,0,0.8);
            cursor: pointer;
          }

          .badge-pickup {
            background: linear-gradient(135deg, #10B981 0%, #06B6D4 100%);
            box-shadow: 0 4px 18px rgba(16, 185, 129, 0.7), 0 0 0 2px rgba(255,255,255,0.9);
          }
          .badge-drop {
            background: linear-gradient(135deg, #EF4444 0%, #F59E0B 100%);
            box-shadow: 0 4px 18px rgba(239, 68, 68, 0.7), 0 0 0 2px rgba(255,255,255,0.9);
          }
          .badge-driver {
            background: linear-gradient(135deg, #00E5FF 0%, #3B82F6 100%);
            box-shadow: 0 4px 20px rgba(0, 229, 255, 0.8), 0 0 0 2.5px #ffffff;
            animation: floatIcon 2s ease-in-out infinite alternate;
          }
          @keyframes floatIcon {
            0% { transform: translateY(0); }
            100% { transform: translateY(-4px); }
          }

          .point-arrow {
            width: 0; height: 0;
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            margin-top: -1px;
            z-index: 3;
          }
          .arrow-pickup { border-top: 8px solid #06B6D4; }
          .arrow-drop { border-top: 8px solid #F59E0B; }
          .arrow-driver { border-top: 8px solid #3B82F6; }

          .point-anchor-dot {
            width: 8px; height: 8px;
            border-radius: 50%;
            background: #ffffff;
            border: 2px solid #0b0f17;
            box-shadow: 0 2px 6px rgba(0,0,0,0.8);
            z-index: 4;
            margin-top: -2px;
          }

          .leaflet-bar { border: none !important; }
          .leaflet-bar a { background: #161b24 !important; color: #f5a623 !important; border: 1px solid rgba(255,255,255,0.1) !important; }
          .leaflet-popup-content-wrapper {
            background: #121824 !important; color: #fff !important;
            border-radius: 10px !important; border: 1.5px solid rgba(245,166,35,0.4) !important;
            box-shadow: 0 8px 24px rgba(0,0,0,0.8) !important;
          }
          .leaflet-popup-tip { background: #121824 !important; }
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

          // Google Maps standard street road tiles
          L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
            attribution: ''
          }).addTo(map);

          const markers = [];

          // 1. Start / Provider Live Marker
          ${drLat && drLng ? `
            const drIcon = L.divIcon({
              className: '',
              html: \`
                <div class="pin-container">
                  <div class="beacon-ring beacon-driver"></div>
                  <div class="point-badge badge-driver">
                    <span style="font-size: 16px;">🚗</span>
                    <span>START / PROVIDER</span>
                  </div>
                  <div class="point-arrow arrow-driver"></div>
                  <div class="point-anchor-dot"></div>
                </div>
              \`,
              iconSize: [140, 52],
              iconAnchor: [70, 50]
            });
            L.marker([${drLat}, ${drLng}], { icon: drIcon }).addTo(map).bindPopup('<b>🚗 Provider / Start Location</b><br/>En Route');
            markers.push([${drLat}, ${drLng}]);
          ` : ''}

          // 2. Seeker 1 Pickup Marker
          ${pLat && pLng ? `
            const pIcon = L.divIcon({
              className: '',
              html: \`
                <div class="pin-container">
                  <div class="beacon-ring beacon-pickup"></div>
                  <div class="point-badge badge-pickup">
                    <span style="font-size: 15px;">📍</span>
                    <span>PICKUP 1</span>
                  </div>
                  <div class="point-arrow arrow-pickup"></div>
                  <div class="point-anchor-dot"></div>
                </div>
              \`,
              iconSize: [100, 52],
              iconAnchor: [50, 50]
            });
            L.marker([${pLat}, ${pLng}], { icon: pIcon }).addTo(map).bindPopup('<b>🟢 Seeker 1 Pickup Spot</b><br/>${pickup?.label || "Confirmed Pickup"}');
            markers.push([${pLat}, ${pLng}]);
          ` : ''}

          // 3. Additional Seekers Pickups (Multi-Seeker Commute)
          ${(Array.isArray(extraPickups) ? extraPickups : []).map((ep, epIdx) => {
            const epLat = ep?.lat ? parseFloat(ep.lat) : null;
            const epLng = ep?.lng ? parseFloat(ep.lng) : null;
            if (!epLat || !epLng) return '';
            const pickupNum = epIdx + 2;
            return `
              const epIcon_${epIdx} = L.divIcon({
                className: '',
                html: \`
                  <div class="pin-container">
                    <div class="beacon-ring beacon-pickup"></div>
                    <div class="point-badge badge-pickup">
                      <span style="font-size: 15px;">📍</span>
                      <span>PICKUP ${pickupNum}</span>
                    </div>
                    <div class="point-arrow arrow-pickup"></div>
                    <div class="point-anchor-dot"></div>
                  </div>
                \`,
                iconSize: [106, 52],
                iconAnchor: [53, 50]
              });
              L.marker([${epLat}, ${epLng}], { icon: epIcon_${epIdx} }).addTo(map).bindPopup('<b>🟢 Pickup ${pickupNum}</b><br/>${ep.label || "Buddy Pickup Location"}');
              markers.push([${epLat}, ${epLng}]);
            `;
          }).join('\n')}

          // 4. Finish / Destination Drop Marker (Always visible to show complete route)
          ${dLat && dLng ? `
            const dIcon = L.divIcon({
              className: '',
              html: \`
                <div class="pin-container">
                  <div class="beacon-ring beacon-drop"></div>
                  <div class="point-badge badge-drop">
                    <span style="font-size: 15px;">🏁</span>
                    <span>FINISH / DROP</span>
                  </div>
                  <div class="point-arrow arrow-drop"></div>
                  <div class="point-anchor-dot"></div>
                </div>
              \`,
              iconSize: [130, 52],
              iconAnchor: [65, 50]
            });
            L.marker([${dLat}, ${dLng}], { icon: dIcon }).addTo(map).bindPopup('<b>🏁 Drop Destination (Finish)</b><br/>${drop?.label || "Confirmed Drop Destination"}');
            markers.push([${dLat}, ${dLng}]);
          ` : ''}

          // 5. Pin marker for manual coordinate picking
          ${pinLat && pinLng ? `
            const pinIcon = L.divIcon({
              className: '',
              html: \`
                <div class="pin-container">
                  <div class="beacon-ring beacon-driver"></div>
                  <div class="point-badge" style="background: linear-gradient(135deg, #f5a623, #ff6f00); box-shadow: 0 4px 16px rgba(245,166,35,0.8);">
                    <span style="font-size: 15px;">📍</span>
                    <span>DRAG TO SET</span>
                  </div>
                  <div class="point-arrow" style="border-top: 8px solid #ff6f00;"></div>
                  <div class="point-anchor-dot"></div>
                </div>
              \`,
              iconSize: [120, 52],
              iconAnchor: [60, 50]
            });
            const pinMarker = L.marker([${pinLat}, ${pinLng}], { icon: pinIcon, draggable: true }).addTo(map);
            pinMarker.on('dragend', function(e) {
              const pos = e.target.getLatLng();
              window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'PIN_MOVED', lat: pos.lat, lng: pos.lng
              }));
            });
            markers.push([${pinLat}, ${pinLng}]);
          ` : ''}

          // ── 1 SINGLE CONTINUOUS ROUTE: Start -> Pickup(s) -> Finish ──
          const allRouteBounds = [];
          const routePathPoints = ${singleRouteArray ? `[${singleRouteArray}]` : (fallbackSeqArray ? `[${fallbackSeqArray}]` : '[]')};

          if (routePathPoints && routePathPoints.length > 1) {
            try {
              // Outer vibrant neon halo
              L.polyline(routePathPoints, {
                color: '#1d4ed8',
                weight: 8,
                opacity: 0.35,
                lineJoin: 'round'
              }).addTo(map);

              // Inner bold single route line
              const singleRoute = L.polyline(routePathPoints, {
                color: '#2563eb',
                weight: 5,
                opacity: 0.98,
                lineJoin: 'round'
              }).addTo(map).bindPopup('<b>🚗 Campus Ride Route</b><br/>Start → Pickup → Finish');

              if (singleRoute.getBounds && singleRoute.getBounds().isValid()) {
                allRouteBounds.push(singleRoute.getBounds());
              }
            } catch(e) {
              console.error('Route polyline error:', e);
            }
          }

          if (allRouteBounds.length > 0) {
            try {
              map.fitBounds(allRouteBounds[0], { padding: [40, 40] });
            } catch(e) {}
          } else if (markers.length > 1) {
            try {
              map.fitBounds(L.latLngBounds(markers), { padding: [40, 40] });
            } catch(e) {}
          } else if (markers.length === 1) {
            map.setView(markers[0], 15);
          }

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
