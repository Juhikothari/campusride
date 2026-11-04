// src/components/StopsMap.jsx
//
// Built-in map (Leaflet + OpenStreetMap, same as the rest of the app) that draws the
// provider's route with numbered stops: 🟢 start, numbered pickups / drops, 🏁 destination.
//
//   <StopsMap stops={plan.stops} geometry={plan.geometry} height={280} />

import React, { useMemo } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

const COLORS = { start: '#22c55e', pickup: '#f5a623', drop: '#3b82f6', destination: '#ef4444' };

function buildHtml(stops, geometry) {
  const data = {
    stops: (stops || []).map((s, i) => ({
      i, type: s.type, lat: s.lat, lng: s.lng,
      label: s.type === 'start' ? 'Start' : s.type === 'destination' ? 'Destination'
        : `${s.type === 'pickup' ? 'Pick up' : 'Drop'}${s.name ? ' · ' + s.name : ''}`,
      address: s.address || '',
    })),
    line: (geometry || []).map((p) => [p.lat, p.lng]),
    colors: COLORS,
  };
  // keep the embedded JSON from ever closing the <script> tag
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html,body,#map{height:100%;margin:0;background:#0c0f17}
  .pin{width:26px;height:26px;border-radius:13px;border:2px solid #fff;color:#000;font:800 12px sans-serif;
       display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.5)}
</style></head><body><div id="map"></div>
<script>
  var D = ${json};
  var map = L.map('map', { zoomControl: true });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
  var pts = [];
  if (D.line.length > 1) { L.polyline(D.line, { color: '#f5a623', weight: 5, opacity: 0.9 }).addTo(map); pts = pts.concat(D.line); }
  D.stops.forEach(function (s) {
    var txt = s.type === 'start' ? 'S' : s.type === 'destination' ? '🏁' : String(s.i);
    var icon = L.divIcon({ className: '', iconSize: [26, 26], iconAnchor: [13, 13],
      html: '<div class="pin" style="background:' + (D.colors[s.type] || '#999') + '"></div>' });
    var m = L.marker([s.lat, s.lng], { icon: icon }).addTo(map);
    m.getElement().firstChild.textContent = txt;           // textContent: names are user-provided
    var box = document.createElement('div');
    var b = document.createElement('b'); b.textContent = s.label; box.appendChild(b);
    if (s.address) { box.appendChild(document.createElement('br')); box.appendChild(document.createTextNode(s.address)); }
    m.bindPopup(box);
    pts.push([s.lat, s.lng]);
  });
  if (pts.length) map.fitBounds(pts, { padding: [30, 30] }); else map.setView([12.9716, 77.5946], 12);
</script></body></html>`;
}

export default function StopsMap({ stops, geometry, height = 280 }) {
  const html = useMemo(() => buildHtml(stops, geometry), [stops, geometry]);
  return (
    <View style={{ height, borderRadius: 16, overflow: 'hidden', backgroundColor: '#0c0f17' }}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        style={{ backgroundColor: '#0c0f17' }}
      />
    </View>
  );
}
