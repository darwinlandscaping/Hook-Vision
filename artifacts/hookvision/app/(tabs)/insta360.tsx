/**
 * HookVision — 360 Camera Screen
 * Dedicated Insta360 camera management, Samsung WiFi fix guide,
 * live pipeline results, snapshot preview, and auto-scan toggle.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated as RNAnimated,
  Easing,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useInsta360Context } from "@/contexts/Insta360Context";

// ─── Conditional IntentLauncher (Android only) ────────────────────────────────
let IntentLauncher: any = null;
if (Platform.OS === "android") {
  try { IntentLauncher = require("expo-intent-launcher"); } catch {}
}

// ─── Colours ──────────────────────────────────────────────────────────────────
const C = {
  bg:      "#0a1628",
  card:    "#0d1f3a",
  border:  "#1a2f4a",
  teal:    "#00d4aa",
  blue:    "#00a8ff",
  gold:    "#ffd700",
  red:     "#ff4400",
  orange:  "#ff8800",
  white:   "#ffffff",
  dim:     "#ffffffaa",
  mute:    "#ffffff44",
};

// ─── Samsung step-by-step guide ────────────────────────────────────────────────
const SAMSUNG_STEPS = [
  {
    icon: "wifi",
    title: "Connect to Insta360 WiFi",
    body: 'Go to phone Settings → Connections → Wi-Fi. Connect to the network named "LIVE-xxxxxx" (shown on the camera screen).',
  },
  {
    icon: "check-circle",
    title: 'Tap "Stay Connected"',
    body: 'Samsung will show a banner: "Connected to LIVE-xxxxxx, but no internet access. Stay connected?" — tap STAY CONNECTED. Without this, Samsung routes traffic through mobile data instead of the camera WiFi.',
  },
  {
    icon: "toggle-left",
    title: "Turn off Wi-Fi+  (Samsung only)",
    body: "Settings → Connections → Wi-Fi → ⋮ (three dots) → Advanced → Switch to mobile data. Turn this OFF. This stops Samsung silently switching away from the camera WiFi.",
  },
  {
    icon: "smartphone",
    title: "Disable Adaptive connectivity",
    body: "Settings → Connections → More connection settings → Adaptive connectivity → turn OFF. This prevents network-quality-based switching.",
  },
  {
    icon: "refresh-cw",
    title: "Back to HookVision — tap Search",
    body: "Return to this screen and tap the SEARCH button below. The camera should connect within 3–6 seconds.",
  },
];

// ─── Pulsing ring animation ────────────────────────────────────────────────────
function PulseRing({ color, size = 120 }: { color: string; size?: number }) {
  const anim = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(anim, { toValue: 1, duration: 1200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        RNAnimated.timing(anim, { toValue: 0, duration: 400, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const scale   = anim.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1.15] });
  const opacity = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.9, 0.6, 0] });
  return (
    <RNAnimated.View style={{
      width: size, height: size, borderRadius: size / 2,
      borderWidth: 2.5, borderColor: color,
      transform: [{ scale }], opacity,
      position: "absolute",
    }} />
  );
}

// ─── Zone badge ──────────────────────────────────────────────────────────────
function ZoneBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <View style={{
      paddingHorizontal: 8, paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: active ? C.teal + "33" : C.border,
      borderWidth: 1, borderColor: active ? C.teal : C.border,
    }}>
      <Text style={{ color: active ? C.teal : C.mute, fontSize: 10, fontWeight: "700" }}>
        {label}
      </Text>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function Insta360Screen() {
  const insets = useSafeAreaInsets();
  const { camera, pipelines } = useInsta360Context();
  const { status, cameraInfo, snapping, connectionHint, startSearch, stopSearch, takeSnapshot } = camera;

  const [previewUri,      setPreviewUri]      = useState<string | null>(null);
  const [samsungGuide,    setSamsungGuide]     = useState(false);
  const [snappingManual,  setSnappingManual]   = useState(false);

  const isConnected  = status === "connected";
  const isSearching  = status === "searching";
  const isDisconnected = status === "disconnected";

  // Status colour
  const statusColor =
    isConnected  ? C.teal   :
    isSearching  ? C.gold   :
    C.mute;

  const statusLabel =
    isConnected  ? "CONNECTED"    :
    isSearching  ? "SEARCHING…"   :
    "DISCONNECTED";

  // Manual snapshot
  const doSnapshot = useCallback(async () => {
    if (!isConnected || snapping || snappingManual) return;
    setSnappingManual(true);
    try {
      const snap = await takeSnapshot();
      if (snap) setPreviewUri(snap.uri);
    } finally {
      setSnappingManual(false);
    }
  }, [isConnected, snapping, snappingManual, takeSnapshot]);

  // Open WiFi settings
  const openWifi = useCallback(() => {
    if (Platform.OS === "android" && IntentLauncher) {
      try {
        IntentLauncher.startActivityAsync("android.settings.WIFI_SETTINGS");
        return;
      } catch {}
    }
    Linking.openURL("App-Prefs:WIFI").catch(() => {});
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons name="camera-wireless" size={22} color={C.teal} />
          <Text style={styles.headerTitle}>INSTA360  <Text style={{ color: C.teal }}>360°</Text></Text>
        </View>
        <View style={[styles.statusChip, { borderColor: statusColor + "88", backgroundColor: statusColor + "18" }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Camera ring + connect button ───────────────────────────────────── */}
        <View style={styles.ringWrap}>
          <View style={styles.ringOuter}>
            {isSearching && <PulseRing color={C.gold} size={130} />}
            {isConnected && <PulseRing color={C.teal} size={130} />}
            <View style={[styles.ringInner, { borderColor: statusColor }]}>
              <MaterialCommunityIcons
                name={isConnected ? "camera-wireless" : "camera-wireless-outline"}
                size={44}
                color={statusColor}
              />
              {isConnected && cameraInfo && (
                <Text style={styles.ringModel}>{cameraInfo.model}</Text>
              )}
            </View>
          </View>

          {/* Connect / Disconnect buttons */}
          {isDisconnected ? (
            <TouchableOpacity style={[styles.btn, { backgroundColor: C.teal }]} onPress={startSearch} activeOpacity={0.8}>
              <Feather name="wifi" size={16} color="#000" />
              <Text style={[styles.btnText, { color: "#000" }]}>SEARCH FOR CAMERA</Text>
            </TouchableOpacity>
          ) : isSearching ? (
            <TouchableOpacity style={[styles.btn, { backgroundColor: C.border, borderColor: C.gold, borderWidth: 1.5 }]} onPress={stopSearch} activeOpacity={0.8}>
              <Feather name="x-circle" size={16} color={C.gold} />
              <Text style={[styles.btnText, { color: C.gold }]}>STOP SEARCH</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.btn, { backgroundColor: C.border, borderColor: C.red + "88", borderWidth: 1.5 }]} onPress={stopSearch} activeOpacity={0.8}>
              <Feather name="wifi-off" size={16} color={C.red} />
              <Text style={[styles.btnText, { color: C.red }]}>DISCONNECT</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Connection hint (Samsung-style) ─────────────────────────────────── */}
        {!!connectionHint && !isConnected && (
          <View style={styles.hintCard}>
            <Feather name="alert-circle" size={14} color={C.orange} />
            <Text style={styles.hintText}>{connectionHint}</Text>
          </View>
        )}

        {/* ── Camera info when connected ────────────────────────────────────── */}
        {isConnected && cameraInfo && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>CAMERA INFO</Text>
            <View style={styles.infoGrid}>
              <InfoRow label="Model"    value={cameraInfo.model} />
              <InfoRow label="Make"     value={cameraInfo.manufacturer} />
              <InfoRow label="Firmware" value={cameraInfo.firmwareVersion} />
              <InfoRow label="Serial"   value={cameraInfo.serialNumber} />
            </View>
          </View>
        )}

        {/* ── Snapshot preview ─────────────────────────────────────────────── */}
        {isConnected && (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>LIVE SNAPSHOT</Text>
              <TouchableOpacity
                onPress={doSnapshot}
                disabled={snapping || snappingManual}
                style={[styles.miniBtn, (snapping || snappingManual) && { opacity: 0.4 }]}
              >
                <MaterialCommunityIcons name="camera" size={14} color={C.teal} />
                <Text style={[styles.miniBtnText, { color: C.teal }]}>
                  {snapping || snappingManual ? "Capturing…" : "Capture"}
                </Text>
              </TouchableOpacity>
            </View>
            {previewUri ? (
              <Image
                source={{ uri: previewUri }}
                style={styles.previewImg}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.previewPlaceholder}>
                <MaterialCommunityIcons name="image-off" size={32} color={C.mute} />
                <Text style={{ color: C.mute, fontSize: 12, marginTop: 6 }}>Tap Capture to take a snapshot</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Pipeline auto-scan ───────────────────────────────────────────── */}
        {isConnected && (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>DUAL PIPELINE AUTO-SCAN</Text>
              {pipelines.running ? (
                <TouchableOpacity onPress={pipelines.stop} style={[styles.miniBtn, { borderColor: C.red + "88" }]}>
                  <Feather name="square" size={13} color={C.red} />
                  <Text style={[styles.miniBtnText, { color: C.red }]}>Stop</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={pipelines.start} style={[styles.miniBtn, { borderColor: C.teal + "88" }]}>
                  <Feather name="play" size={13} color={C.teal} />
                  <Text style={[styles.miniBtnText, { color: C.teal }]}>Start</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.cardSubtitle}>
              Scans every 6 seconds: Pipeline 1 detects bait birds + surface bust-ups. Pipeline 2 runs croc vision.
              {pipelines.running && ` · Scan ${pipelines.scanCount}`}
            </Text>
            {pipelines.scanning && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
                <View style={styles.scanDot} />
                <Text style={{ color: C.gold, fontSize: 12 }}>Analysing…</Text>
              </View>
            )}
            {pipelines.lastError && (
              <Text style={{ color: C.red, fontSize: 11, marginTop: 4 }}>{pipelines.lastError}</Text>
            )}
          </View>
        )}

        {/* ── Bird pipeline result ─────────────────────────────────────────── */}
        {isConnected && pipelines.surface && (
          <View style={[styles.card, pipelines.surface.activity && { borderColor: C.orange + "88" }]}>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>🐦  BAIT BIRDS + SURFACE ACTIVITY</Text>
              <View style={[styles.miniChip, {
                backgroundColor: pipelines.surface.activity ? C.orange + "22" : C.border,
                borderColor: pipelines.surface.activity ? C.orange + "88" : C.border,
              }]}>
                <Text style={{ color: pipelines.surface.activity ? C.orange : C.mute, fontSize: 10, fontWeight: "700" }}>
                  {pipelines.surface.urgency.toUpperCase()}
                </Text>
              </View>
            </View>

            {pipelines.surface.birdSpecies.length > 0 && (
              <Text style={styles.cardValue}>{pipelines.surface.birdSpecies.join(" · ")}</Text>
            )}

            <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
              <ZoneBadge label="LEFT"   active={pipelines.surface.zones.left} />
              <ZoneBadge label="CENTRE" active={pipelines.surface.zones.centre} />
              <ZoneBadge label="RIGHT"  active={pipelines.surface.zones.right} />
            </View>

            {pipelines.surface.types.length > 0 && (
              <Text style={[styles.cardSubtitle, { marginTop: 8 }]}>
                {pipelines.surface.types.join(", ")}
              </Text>
            )}
            <Text style={[styles.cardSubtitle, { marginTop: 4, opacity: 0.7 }]}>
              {pipelines.surface.description}
            </Text>
            <Text style={styles.refBadge}>
              {pipelines.surface.birdRefCount} library refs injected
            </Text>
          </View>
        )}

        {/* ── Croc vision result ───────────────────────────────────────────── */}
        {isConnected && pipelines.croc && (
          <View style={[styles.card,
            pipelines.croc.alertLevel === "confirmed" && { borderColor: C.red + "cc", borderWidth: 2 },
            pipelines.croc.alertLevel === "possible"  && { borderColor: C.orange + "88" },
          ]}>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>🐊  CROC VISION</Text>
              <View style={[styles.miniChip, {
                backgroundColor:
                  pipelines.croc.alertLevel === "confirmed" ? C.red + "33"    :
                  pipelines.croc.alertLevel === "possible"  ? C.orange + "22" :
                  C.border,
                borderColor:
                  pipelines.croc.alertLevel === "confirmed" ? C.red           :
                  pipelines.croc.alertLevel === "possible"  ? C.orange        :
                  C.border,
              }]}>
                <Text style={{
                  fontSize: 10, fontWeight: "800",
                  color:
                    pipelines.croc.alertLevel === "confirmed" ? C.red    :
                    pipelines.croc.alertLevel === "possible"  ? C.orange :
                    C.mute,
                }}>
                  {pipelines.croc.alertLevel.toUpperCase()}
                </Text>
              </View>
            </View>

            {pipelines.croc.detected && (
              <>
                <Text style={styles.cardValue}>
                  {pipelines.croc.species === "salty" ? "Saltwater Croc" :
                   pipelines.croc.species === "freshie" ? "Freshwater Croc" :
                   "Crocodile"}{" "}
                  <Text style={styles.confText}>({pipelines.croc.confidence}%)</Text>
                </Text>
                <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
                  <ZoneBadge label="LEFT"   active={pipelines.croc.zones.left} />
                  <ZoneBadge label="CENTRE" active={pipelines.croc.zones.centre} />
                  <ZoneBadge label="RIGHT"  active={pipelines.croc.zones.right} />
                </View>
                {pipelines.croc.parts.length > 0 && (
                  <Text style={[styles.cardSubtitle, { marginTop: 6 }]}>
                    Visible: {pipelines.croc.parts.join(", ")}
                  </Text>
                )}
                {!!pipelines.croc.safetyNote && (
                  <View style={styles.safetyBox}>
                    <Feather name="alert-triangle" size={13} color={C.red} />
                    <Text style={styles.safetyText}>{pipelines.croc.safetyNote}</Text>
                  </View>
                )}
              </>
            )}

            {!pipelines.croc.detected && (
              <Text style={styles.cardSubtitle}>No croc detected in current frame.</Text>
            )}

            <Text style={[styles.cardSubtitle, { marginTop: 4, opacity: 0.7 }]}>
              {pipelines.croc.description}
            </Text>
            <Text style={styles.refBadge}>
              {pipelines.croc.crocRefCount} croc library refs injected
              {pipelines.croc.sonarContributed ? " · sonar contributed" : ""}
            </Text>
          </View>
        )}

        {/* ── Samsung WiFi fix guide ────────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.card, styles.guideToggle]}
          onPress={() => setSamsungGuide((v) => !v)}
          activeOpacity={0.8}
        >
          <View style={styles.cardRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <MaterialCommunityIcons name="android" size={18} color={C.gold} />
              <Text style={[styles.cardLabel, { color: C.gold }]}>SAMSUNG WiFi FIX GUIDE</Text>
            </View>
            <Feather name={samsungGuide ? "chevron-up" : "chevron-down"} size={16} color={C.gold} />
          </View>
          <Text style={styles.cardSubtitle}>
            Samsung phones often drop camera WiFi — follow these steps if Search fails.
          </Text>
        </TouchableOpacity>

        {samsungGuide && (
          <View style={[styles.card, { borderColor: C.gold + "44", gap: 16 }]}>
            {SAMSUNG_STEPS.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepNumWrap}>
                  <Text style={styles.stepNum}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Feather name={step.icon as any} size={13} color={C.gold} />
                    <Text style={styles.stepTitle}>{step.title}</Text>
                  </View>
                  <Text style={styles.stepBody}>{step.body}</Text>
                </View>
              </View>
            ))}

            <TouchableOpacity onPress={openWifi} style={styles.wifiBtn} activeOpacity={0.8}>
              <Feather name="wifi" size={15} color={C.bg} />
              <Text style={styles.wifiBtnText}>Open WiFi Settings</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Quick tips ───────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>QUICK TIPS</Text>
          <Text style={styles.cardSubtitle}>
            • Camera hotspot SSID: <Text style={{ color: C.white }}>LIVE-xxxxxx</Text> (shown on camera screen){"\n"}
            • Default WiFi password is printed on the camera body{"\n"}
            • Camera must be in WiFi mode (hold Wi-Fi button){"\n"}
            • Keep camera &lt;10 m from phone for best signal{"\n"}
            • Auto-scan pipeline fires every 6 s — use in boat mode for continuous croc + bird watch
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Info row ────────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
      <Text style={{ color: C.mute, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: C.white, fontSize: 12, fontWeight: "600" }}>{value}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerLeft:  { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { color: C.white, fontSize: 17, fontWeight: "800", letterSpacing: 1.2 },
  statusChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1,
  },
  statusDot:  { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },

  scroll: { padding: 14, gap: 12 },

  ringWrap: {
    alignItems: "center", gap: 20,
    paddingVertical: 28,
  },
  ringOuter: { width: 130, height: 130, alignItems: "center", justifyContent: "center" },
  ringInner: {
    width: 110, height: 110, borderRadius: 55,
    borderWidth: 2.5,
    backgroundColor: C.card,
    alignItems: "center", justifyContent: "center", gap: 4,
  },
  ringModel: { color: C.white, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },

  btn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 28, paddingVertical: 12, borderRadius: 30,
  },
  btnText: { fontSize: 13, fontWeight: "800", letterSpacing: 1 },

  card: {
    backgroundColor: C.card, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    padding: 14, gap: 8,
  },
  cardRow:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardLabel:    { color: C.dim, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
  cardSubtitle: { color: C.dim, fontSize: 12, lineHeight: 18 },
  cardValue:    { color: C.white, fontSize: 16, fontWeight: "700" },
  confText:     { color: C.dim, fontSize: 13, fontWeight: "400" },
  infoGrid:     { gap: 2 },

  miniBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1, borderColor: C.border,
  },
  miniBtnText: { fontSize: 11, fontWeight: "600" },

  miniChip: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, borderWidth: 1,
  },

  previewImg: {
    width: "100%", height: 200, borderRadius: 10,
    backgroundColor: C.bg,
  },
  previewPlaceholder: {
    height: 140, borderRadius: 10,
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
  },

  scanDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: C.gold,
  },

  safetyBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 7,
    backgroundColor: C.red + "18", borderRadius: 8,
    borderWidth: 1, borderColor: C.red + "55",
    padding: 10, marginTop: 6,
  },
  safetyText: { color: C.red, fontSize: 12, lineHeight: 18, flex: 1 },

  refBadge: { color: C.mute, fontSize: 10, marginTop: 4 },

  hintCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: C.orange + "18", borderRadius: 10,
    borderWidth: 1, borderColor: C.orange + "55",
    padding: 12,
  },
  hintText: { color: C.orange, fontSize: 12, lineHeight: 18, flex: 1 },

  guideToggle: { borderColor: C.gold + "44" },

  stepRow:    { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  stepNumWrap: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: C.gold + "22", borderWidth: 1, borderColor: C.gold + "66",
    alignItems: "center", justifyContent: "center", marginTop: 1,
  },
  stepNum:   { color: C.gold, fontSize: 11, fontWeight: "800" },
  stepTitle: { color: C.white, fontSize: 12, fontWeight: "700" },
  stepBody:  { color: C.dim, fontSize: 12, lineHeight: 18 },

  wifiBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: C.gold, borderRadius: 10, paddingVertical: 11,
  },
  wifiBtnText: { color: C.bg, fontWeight: "800", fontSize: 13, letterSpacing: 0.5 },
});
