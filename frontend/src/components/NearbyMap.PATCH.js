// ═══════════════════════════════════════════════════════════════════
//  PATCH INSTRUCTIONS FOR frontend/src/components/NearbyMap.jsx
// ═══════════════════════════════════════════════════════════════════

// ── 1. In the "Update map markers + route" useEffect, find the
//       providers.forEach block and replace it with: ───────────────

// FIND:
    // Provider markers
    providers.forEach(p => {
      bounds.push([p.lat, p.lng]);
      const isFemale  = p.gender === 'female';
      const svg       = isFemale ? FEMALE_ICON_SVG(p.womenOnly) : MALE_ICON_SVG;
      const genderTag = isFemale ? '♀ Female provider' : (p.gender === 'male' ? '♂ Male provider' : 'Provider');
      const womenBadge= p.womenOnly ? '<span style="background:#e91e8c;color:#fff;border-radius:4px;padding:2px 6px;font-size:11px;margin-left:6px;">Women Only</span>' : '';

      L.marker([p.lat, p.lng], { icon: makeIcon(svg) })
        .bindPopup(`
          <div style="min-width:180px;">
            <b style="font-size:14px;">${p.name}</b> ${womenBadge}<br/>
            <span style="color:#888;font-size:12px;">${genderTag}</span><br/>
            <hr style="margin:6px 0;border-color:#333;"/>
            <div>📍 ${p.pickup}</div>
            <div>🏁 ${p.drop}</div>
            <div>💺 ${p.seatsAvailable} seats · ₹${p.costPerSeat}/seat</div>
          </div>
        `)
        .addTo(markersLayer.current);
    });

// REPLACE WITH:
    // Provider markers
    // FIX: Male users should not see female-only ride markers
    const viewerIsMale = userGender === 'male';

    providers.forEach(p => {
      const isFemaleProvider = p.gender === 'female';
      const isWomenOnlyRide  = p.womenOnly;

      // Hide women-only rides and female provider markers from male viewers
      if (viewerIsMale && (isWomenOnlyRide || isFemaleProvider)) return;

      bounds.push([p.lat, p.lng]);
      const svg        = isFemaleProvider ? FEMALE_ICON_SVG(isWomenOnlyRide) : MALE_ICON_SVG;
      const genderTag  = isFemaleProvider ? '♀ Female provider' : (p.gender === 'male' ? '♂ Male provider' : 'Provider');
      const womenBadge = isWomenOnlyRide
        ? '<span style="background:#e91e8c;color:#fff;border-radius:4px;padding:2px 6px;font-size:11px;margin-left:6px;">Women Only</span>'
        : '';

      L.marker([p.lat, p.lng], { icon: makeIcon(svg) })
        .bindPopup(`
          <div style="min-width:180px;">
            <b style="font-size:14px;">${p.name}</b> ${womenBadge}<br/>
            <span style="color:#888;font-size:12px;">${genderTag}</span><br/>
            <hr style="margin:6px 0;border-color:#333;"/>
            <div>📍 ${p.pickup}</div>
            <div>🏁 ${p.drop}</div>
            <div>💺 ${p.seatsAvailable} seats · ₹${p.costPerSeat}/seat</div>
          </div>
        `)
        .addTo(markersLayer.current);
    });


// ── 2. In the same useEffect's dependency array, add userGender: ──
// FIND:
  }, [leafletReady, providers, routeInfo, pickupLat, pickupLng, dropLat, dropLng]);

// REPLACE WITH:
  }, [leafletReady, providers, routeInfo, pickupLat, pickupLng, dropLat, dropLng, userGender]);


// ── 3. Update the stats bar to not show female stats to males: ────
// FIND:
          {!loading && providers.length > 0 && (
            <>
              <span className="nearby-stat">{providers.length} nearby</span>
              {femaleCount > 0 && <span className="nearby-stat female">♀ {femaleCount} female</span>}
              {womenOnlyCount > 0 && <span className="nearby-stat women-only">🔒 {womenOnlyCount} women-only</span>}
            </>
          )}

// REPLACE WITH:
          {!loading && providers.length > 0 && (() => {
            const visibleProviders = userGender === 'male'
              ? providers.filter(p => p.gender !== 'female' && !p.womenOnly)
              : providers;
            const vFemale   = visibleProviders.filter(p => p.gender === 'female').length;
            const vWomenOnly= visibleProviders.filter(p => p.womenOnly).length;
            return (
              <>
                <span className="nearby-stat">{visibleProviders.length} nearby</span>
                {vFemale > 0 && <span className="nearby-stat female">♀ {vFemale} female</span>}
                {vWomenOnly > 0 && <span className="nearby-stat women-only">🔒 {vWomenOnly} women-only</span>}
              </>
            );
          })()}
