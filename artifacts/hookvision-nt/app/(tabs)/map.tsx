import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";

import { useColors } from "@/hooks/useColors";
import { NT_SPOTS } from "@/utils/ntLocation";

// ── Types ──────────────────────────────────────────────────────────────────
interface HotspotSpot {
  locationName: string;
  reportCount: number;
  avgFishCount: number;
  heat: "firing" | "hot" | "warm";
  latestAt: string;
  topSpecies: string | null;
}

interface MapPin {
  name: string;
  lat: number;
  lng: number;
  scanCount: number;
  totalFish: number;
  heat: "firing" | "hot" | "warm";
  topSpecies: string;
}

// ── All known NT spots for the background grid ────────────────────────────
const ALL_SPOTS_JSON = JSON.stringify(NT_SPOTS);

// ── Leaflet HTML template ─────────────────────────────────────────────────
function buildMapHtml(pins: MapPin[]): string {
  const pinsJson = JSON.stringify(pins);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0a1628; }
    #map { width: 100vw; height: 100vh; }

    /* Dark popup */
    .leaflet-popup-content-wrapper {
      background: #0d1e3a;
      color: #eaf4ff;
      border: 1px solid #00d4aa44;
      border-radius: 10px;
      box-shadow: 0 4px 24px #000a;
    }
    .leaflet-popup-tip { background: #0d1e3a; }
    .leaflet-popup-content { margin: 10px 14px; font-family: sans-serif; }
    .pop-name { font-size: 14px; font-weight: 700; color: #eaf4ff; margin-bottom: 6px; }
    .pop-row  { font-size: 11px; color: #8bb3cc; margin-top: 2px; }
    .pop-heat { font-size: 12px; font-weight: 700; margin-top: 6px; }

    /* Hide Leaflet attribution to save space */
    .leaflet-control-attribution { display: none; }

    /* Glow ring CSS animation */
    @keyframes pulse {
      0%   { box-shadow: 0 0 0 0px rgba(255,255,255,0.3); }
      100% { box-shadow: 0 0 0 10px rgba(255,255,255,0); }
    }
    .pin-dot { border-radius: 50%; animation: pulse 1.8s infinite; }
    .pin-dot-bg { border-radius: 50%; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const hotspots = ${pinsJson};
    const allSpots = ${ALL_SPOTS_JSON};

    const map = L.map('map', {
      center: [-13.2, 131.8],
      zoom: 6,
      zoomControl: true,
    });

    /* CartoDB dark tiles — free, no API key */
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 18,
    }).addTo(map);

    /* Background dots for all known NT spots */
    allSpots.forEach(function(spot) {
      const icon = L.divIcon({
        className: '',
        html: '<div class="pin-dot-bg" style="width:8px;height:8px;background:#00a8ff;opacity:0.25;border:1px solid #00a8ff44;"></div>',
        iconSize: [8, 8], iconAnchor: [4, 4],
      });
      L.marker([spot.lat, spot.lng], { icon })
        .addTo(map)
        .bindPopup('<div class="pop-name">' + spot.name + '</div><div class="pop-row">NT fishing spot</div>');
    });

    /* Live hotspot pins */
    hotspots.forEach(function(pin) {
      var color = pin.heat === 'firing' ? '#ff4400' : pin.heat === 'hot' ? '#ffd700' : '#00d4aa';
      var size  = pin.heat === 'firing' ? 22 : pin.heat === 'hot' ? 18 : 14;
      var label = pin.heat === 'firing' ? '🔥 FIRING' : pin.heat === 'hot' ? '🌡 HOT' : '✓ ACTIVE';
      var labelColor = color;

      var icon = L.divIcon({
        className: '',
        html: '<div class="pin-dot" style="width:' + size + 'px;height:' + size + 'px;background:' + color + ';opacity:0.92;box-shadow:0 0 12px ' + color + ',0 0 24px ' + color + '80;"></div>',
        iconSize: [size, size], iconAnchor: [size/2, size/2],
      });

      L.marker([pin.lat, pin.lng], { icon, zIndexOffset: 1000 })
        .addTo(map)
        .bindPopup(
          '<div class="pop-name">' + pin.name + '</div>' +
          '<div class="pop-row">📡 ' + pin.scanCount + ' scan' + (pin.scanCount !== 1 ? 's' : '') + '</div>' +
          '<div class="pop-row">🐟 ' + pin.totalFish + ' fish spotted</div>' +
          '<div class="pop-row">Top: ' + pin.topSpecies + '</div>' +
          '<div class="pop-heat" style="color:' + labelColor + '">' + label + '</div>'
        );
    });

    /* If we have hotspot pins, fit the map to show them */
    if (hotspots.length > 0) {
      var lats = hotspots.map(function(p){ return p.lat; });
      var lngs = hotspots.map(function(p){ return p.lng; });
      var bounds = L.latLngBounds(
        [Math.min.apply(null,lats)-0.5, Math.min.apply(null,lngs)-0.5],
        [Math.max.apply(null,lats)+0.5, Math.max.apply(null,lngs)+0.5]
      );
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  </script>
</body>
</html>`;
}

// ── Component ─────────────────────────────────────────────────────────────
export default function MapScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 0 : insets.top;

  const [pins, setPins] = useState<MapPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [html, setHtml] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadHotspots = useCallback(async () => {
    try {
      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      const base = domain ? `https://${domain}` : "";
      const res = await fetch(`${base}/api/community/hotspots`);
      if (!res.ok) return;
      const json = await res.json();
      const data: HotspotSpot[] = Array.isArray(json) ? json : (json.hotspots ?? []);

      // Match each hotspot location name to a known GPS coordinate
      const matched: MapPin[] = [];
      for (const spot of data) {
        const found = NT_SPOTS.find(
          (s) => s.name.toLowerCase() === spot.locationName.toLowerCase()
        );
        if (found) {
          matched.push({
            name: found.name,
            lat: found.lat,
            lng: found.lng,
            scanCount: spot.reportCount,
            totalFish: spot.avgFishCount,
            heat: spot.heat,
            topSpecies: spot.topSpecies ?? "Unknown",
          });
        }
      }

      setPins(matched);
      setHtml(buildMapHtml(matched));
    } catch {
      // Silently fail — map still shows background spots
      setHtml(buildMapHtml([]));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHotspots();
    pollRef.current = setInterval(loadHotspots, 60_000); // refresh every minute
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadHotspots]);

  // ── Legend colours ─────────────────────────────────────────────────────
  const firingCount = pins.filter((p) => p.heat === "firing").length;
  const hotCount    = pins.filter((p) => p.heat === "hot").length;
  const activeCount = pins.filter((p) => p.heat === "warm").length;

  return (
    <View style={[styles.root, { backgroundColor: "#0a1628" }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10, borderBottomColor: "#00d4aa20" }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Feather name="chevron-left" size={22} color="#00d4aa" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>LIVE SCAN MAP</Text>
          <Text style={styles.headerSub}>NT Fishing Hotspots</Text>
        </View>
        <TouchableOpacity onPress={loadHotspots} hitSlop={12} style={styles.refreshBtn}>
          <Feather name="refresh-cw" size={17} color="#00a8ff" />
        </TouchableOpacity>
      </View>

      {/* Legend strip */}
      <View style={[styles.legend, { backgroundColor: "#0d1e3a", borderBottomColor: "#ffffff10" }]}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#ff4400", shadowColor: "#ff4400", shadowRadius: 6, shadowOpacity: 0.8 }]} />
          <Text style={styles.legendLabel}>FIRING ({firingCount})</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#ffd700", shadowColor: "#ffd700", shadowRadius: 6, shadowOpacity: 0.8 }]} />
          <Text style={styles.legendLabel}>HOT ({hotCount})</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#00d4aa", shadowColor: "#00d4aa", shadowRadius: 6, shadowOpacity: 0.8 }]} />
          <Text style={styles.legendLabel}>ACTIVE ({activeCount})</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#00a8ff", opacity: 0.35 }]} />
          <Text style={styles.legendLabel}>KNOWN SPOT</Text>
        </View>
      </View>

      {/* Map or loader */}
      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator color="#00d4aa" size="large" />
          <Text style={styles.loaderText}>Loading hotspot map…</Text>
        </View>
      )}

      {!loading && html && Platform.OS !== "web" && (
        <WebView
          source={{ html }}
          style={styles.webview}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
          bounces={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Web-only fallback — WebView isn't available in the browser */}
      {!loading && Platform.OS === "web" && (
        <View style={styles.webFallback}>
          <Feather name="map" size={40} color="#00d4aa40" style={{ marginBottom: 16 }} />
          <Text style={styles.webFallbackTitle}>Live Map Available in App</Text>
          <Text style={styles.webFallbackSub}>
            Open HookVision in Expo Go on your Android device to see the live Leaflet map with glowing heat pins for every scan location.
          </Text>
          {pins.length > 0 && (
            <View style={styles.webPinList}>
              {pins.map((p) => {
                const col = p.heat === "firing" ? "#ff4400" : p.heat === "hot" ? "#ffd700" : "#00d4aa";
                const label = p.heat === "firing" ? "🔥 FIRING" : p.heat === "hot" ? "🌡 HOT" : "✓ ACTIVE";
                return (
                  <View key={p.name} style={[styles.webPinRow, { borderColor: col + "30", backgroundColor: col + "0a" }]}>
                    <View style={[styles.webPinDot, { backgroundColor: col }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.webPinName, { color: "#eaf4ff" }]}>{p.name}</Text>
                      <Text style={[styles.webPinSub, { color: "#4a7a9b" }]}>{p.topSpecies} · {p.scanCount} scan{p.scanCount !== 1 ? "s" : ""} · {p.totalFish} fish</Text>
                    </View>
                    <Text style={[styles.webPinLabel, { color: col }]}>{label}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      {!loading && !html && (
        <View style={styles.loader}>
          <Text style={styles.errorText}>Unable to load map</Text>
          <TouchableOpacity onPress={loadHotspots} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 15, fontFamily: "Oswald_700Bold", color: "#eaf4ff", letterSpacing: 1.5 },
  headerSub:   { fontSize: 11, fontFamily: "Inter_400Regular", color: "#4a7a9b", marginTop: 1 },
  refreshBtn: { marginLeft: "auto" as any, padding: 4 },

  legend: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-around",
    paddingVertical: 7, paddingHorizontal: 10,
    borderBottomWidth: 1,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot:  { width: 9, height: 9, borderRadius: 5 },
  legendLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", color: "#8bb3cc", letterSpacing: 0.8 },

  webview: { flex: 1 },

  loader: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
  loaderText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#4a7a9b" },
  errorText:  { fontSize: 14, fontFamily: "Inter_500Medium", color: "#8bb3cc" },
  retryBtn:   { paddingHorizontal: 20, paddingVertical: 9, borderRadius: 10, backgroundColor: "#00d4aa20", borderWidth: 1, borderColor: "#00d4aa40" },
  retryText:  { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#00d4aa" },

  webFallback: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 32, gap: 10,
  },
  webFallbackTitle: { fontSize: 17, fontFamily: "Oswald_700Bold", color: "#eaf4ff", letterSpacing: 1 },
  webFallbackSub:   { fontSize: 12, fontFamily: "Inter_400Regular", color: "#4a7a9b", textAlign: "center", lineHeight: 18 },
  webPinList:       { width: "100%", marginTop: 20, gap: 8 },
  webPinRow:        { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 10, padding: 12 },
  webPinDot:        { width: 10, height: 10, borderRadius: 5 },
  webPinName:       { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  webPinSub:        { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  webPinLabel:      { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.8 },
});
