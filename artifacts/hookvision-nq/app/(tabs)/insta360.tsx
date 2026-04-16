/**
 * HookVision — WiFi Camera Screen
 * Supports any WiFi-hotspot camera: Insta360 (X4, X3, X2, ONE RS, Go 3),
 * GoPro (Max, Hero 12/11/10), DJI Osmo (Action 4/5, Pocket 3), and other
 * cameras that serve a local HTTP preview stream.
 * Includes Samsung WiFi fix guide, AI brain analysis, auto-scan pipelines,
 * live snapshot preview, croc vision, and bird detection.
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
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useInsta360Context } from "@/contexts/Insta360Context";
import { useCameraScanner, type DiscoveredCamera } from "@/hooks/useCameraScanner";

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

// ─── Camera brands with their WiFi SSID patterns ─────────────────────────────
const CAMERA_CONFIGS = {
  insta360: { label: "Insta360", ssid: "LIVE-xxxxxx  /  Insta360 X4-xxxxxx",   icon: "rotate-360",     color: "#00d4aa" },
  gopro:    { label: "GoPro",    ssid: "GOPRO-XXXX",                            icon: "camera",          color: "#0099ff" },
  dji:      { label: "DJI Osmo", ssid: "DJI_OSMO-XXXX  /  OSMO-ACTION-XXXX",  icon: "video-outline",   color: "#1a9fff" },
  other:    { label: "Other",    ssid: "Check camera screen or manual",         icon: "wifi",            color: "#ffd700" },
} as const;
type CamType = keyof typeof CAMERA_CONFIGS;

// ─── Samsung step-by-step guide ────────────────────────────────────────────────
const SAMSUNG_STEPS: {
  icon: string;
  title: string;
  body: string;
  btnLabel?: string;
  intent?: string;
}[] = [
  {
    icon: "wifi",
    title: "Connect to Camera WiFi Hotspot",
    body:
      "Open WiFi settings and join your camera's hotspot:\n" +
      "• Insta360 X4/X3/X2: LIVE-xxxxxx or Insta360 X4-xxxxxx\n" +
      "• GoPro Max / Hero: GOPRO-XXXX\n" +
      "• DJI Osmo Action / Pocket: DJI_OSMO-XXXX or OSMO-ACTION-XXXX\n" +
      "• Other cameras: check the camera screen or manual\n" +
      "Password is usually printed on the camera body or visible on-screen.",
    btnLabel: "Open WiFi Settings",
    intent: "android.settings.WIFI_SETTINGS",
  },
  {
    icon: "check-circle",
    title: 'Tap "Stay Connected" — CRITICAL',
    body: 'Samsung shows a popup: "No internet — stay connected?" → tap STAY CONNECTED every time. Without this, ALL traffic goes through mobile data and the camera is unreachable.',
  },
  {
    icon: "toggle-left",
    title: "Turn off Wi-Fi+ / Switch to Mobile Data",
    body: "WiFi Settings → ⋮ (three dots) → Advanced → Switch to mobile data — turn OFF. This is Samsung's #1 cause of camera disconnections.",
    btnLabel: "WiFi Advanced Settings",
    intent: "android.settings.WIFI_SETTINGS",
  },
  {
    icon: "smartphone",
    title: "Disable Adaptive Connectivity",
    body: "Settings → Connections → More connection settings → Adaptive connectivity → OFF. Prevents Samsung auto-switching based on signal quality.",
    btnLabel: "Network Settings",
    intent: "android.settings.WIRELESS_SETTINGS",
  },
  {
    icon: "battery",
    title: "Disable Battery Optimisation for HookVision",
    body: "Settings → Battery → Background usage limits → Sleeping apps — remove HookVision. Samsung kills WiFi on background apps to save power.",
    btnLabel: "Battery Settings",
    intent: "android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS",
  },
  {
    icon: "refresh-cw",
    title: "Return here and tap SEARCH FOR CAMERA",
    body: "Camera connects in 3–6 seconds once the above settings are applied. Screen stays on automatically while searching.",
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

// ─── Brain result type ────────────────────────────────────────────────────────
interface BrainResult {
  summary: string;
  activityLevel: "none" | "low" | "medium" | "high";
  castZone: "left" | "centre" | "right" | "all" | "none";
  birds: { detected: boolean; species: string[]; urgency: string; description: string };
  surface: { bustUp: boolean; baitBall: boolean; description: string };
  water: { colour: string; conditions: string; visibility: string };
  crocRisk: "none" | "low" | "medium" | "high";
  crocDetail: string;
  structure: string;
  tactics: { lure: string; technique: string; depth: string; priority: string };
  weatherRead: string;
  confidence: number;
  birdRefCount: number;
  crocRefCount: number;
}

const ACTIVITY_COLOR: Record<string, string> = {
  none: C.mute, low: C.blue, medium: C.orange, high: C.red,
};
const CROC_RISK_COLOR: Record<string, string> = {
  none: C.mute, low: C.blue, medium: C.orange, high: C.red,
};

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function Insta360Screen() {
  const insets = useSafeAreaInsets();
  const { camera, pipelines } = useInsta360Context();
  const {
    status, cameraInfo, snapping, connectionHint,
    activeBaseUrl, startSearch, startSearchAt, stopSearch, takeSnapshot,
  } = camera;

  // ── Camera scanner — detects all reachable WiFi cameras in parallel ──────
  const scanner = useCameraScanner();
  const [selectedCamera, setSelectedCamera] = useState<DiscoveredCamera | null>(null);

  const handleSelectCamera = useCallback((cam: DiscoveredCamera) => {
    setSelectedCamera(cam);
    // Auto-match the brand picker chip
    const brand = cam.brand === "Insta360" ? "insta360"
      : cam.brand === "GoPro"  ? "gopro"
      : cam.brand === "DJI"    ? "dji"
      : "other";
    setCamType(brand as CamType);
    // Connect to the chosen camera
    startSearchAt(cam.baseUrl, cam.infoPath, cam.cmdPath);
  }, [startSearchAt]);

  const [camType,         setCamType]         = useState<CamType>("insta360");
  const [previewUri,      setPreviewUri]      = useState<string | null>(null);
  const [previewBase64,   setPreviewBase64]   = useState<string | null>(null);
  const [samsungGuide,    setSamsungGuide]     = useState(false);
  const [snappingManual,  setSnappingManual]   = useState(false);
  const [brainResult,     setBrainResult]      = useState<BrainResult | null>(null);
  const [brainLoading,    setBrainLoading]     = useState(false);
  const [brainError,      setBrainError]       = useState<string | null>(null);

  const baseUrl = process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
    : "";

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

  // Manual snapshot — also stores base64 for brain analysis
  const doSnapshot = useCallback(async () => {
    if (!isConnected || snapping || snappingManual) return;
    setSnappingManual(true);
    try {
      const snap = await takeSnapshot();
      if (snap) {
        setPreviewUri(snap.uri);
        setPreviewBase64(snap.base64);
        // Auto-clear old brain result when new snapshot is taken
        setBrainResult(null);
        setBrainError(null);
      }
    } finally {
      setSnappingManual(false);
    }
  }, [isConnected, snapping, snappingManual, takeSnapshot]);

  // Brain analysis — sends current snapshot to /api/insta360/brain
  const doBrainAnalysis = useCallback(async () => {
    if (!previewBase64 || brainLoading) return;
    setBrainLoading(true);
    setBrainError(null);
    try {
      const res = await fetch(`${baseUrl}/api/insta360/brain`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          imageBase64:  previewBase64,
          sonarContext: pipelines.croc ? {
            crocAlert: pipelines.croc.detected,
          } : undefined,
        }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setBrainResult(data as BrainResult);
    } catch (err: any) {
      setBrainError(err.message ?? "Brain analysis failed");
    } finally {
      setBrainLoading(false);
    }
  }, [previewBase64, brainLoading, baseUrl, pipelines.croc]);

  // ── Keep screen awake while searching / connected ─────────────────────────
  // Samsung drops local-network WiFi when screen dims. Keeping awake prevents that.
  const keepAwakeActive = useRef(false);
  useEffect(() => {
    const TAG = "insta360";
    if (status === "searching" || status === "connected") {
      activateKeepAwakeAsync(TAG).then(() => { keepAwakeActive.current = true; }).catch(() => {});
    } else if (keepAwakeActive.current) {
      try { deactivateKeepAwake(TAG); } catch {}
      keepAwakeActive.current = false;
    }
    return () => {
      if (keepAwakeActive.current) {
        try { deactivateKeepAwake(TAG); } catch {}
        keepAwakeActive.current = false;
      }
    };
  }, [status]);

  // Open any Android settings intent (with iOS App-Prefs fallback)
  const openSettings = useCallback((intent?: string) => {
    if (Platform.OS === "android" && IntentLauncher && intent) {
      try {
        IntentLauncher.startActivityAsync(intent);
        return;
      } catch {}
    }
    // iOS fallback — deep-link into Settings
    Linking.openURL("App-Prefs:WIFI").catch(() =>
      Linking.openURL("app-settings:").catch(() => {})
    );
  }, []);

  // Convenience — open WiFi settings
  const openWifi = useCallback(() => openSettings("android.settings.WIFI_SETTINGS"), [openSettings]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons name="camera-wireless" size={22} color={C.teal} />
          <Text style={styles.headerTitle}>WIFI  <Text style={{ color: C.teal }}>CAM</Text></Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {(status === "searching" || status === "connected") && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#ffd70018", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, borderWidth: 1, borderColor: "#ffd70044" }}>
              <Feather name="sun" size={10} color="#ffd700" />
              <Text style={{ color: "#ffd700", fontSize: 9, fontWeight: "700" }}>SCREEN ON</Text>
            </View>
          )}
          <View style={[styles.statusChip, { borderColor: statusColor + "88", backgroundColor: statusColor + "18" }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>
      </View>

      {/* ── Camera type selector ─────────────────────────────────────────────── */}
      <View style={styles.camPicker}>
        {(Object.keys(CAMERA_CONFIGS) as CamType[]).map((key) => {
          const cfg = CAMERA_CONFIGS[key];
          const active = camType === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setCamType(key)}
              activeOpacity={0.7}
              style={[styles.camChip, active && { backgroundColor: cfg.color + "28", borderColor: cfg.color }]}
            >
              <MaterialCommunityIcons name={cfg.icon as any} size={13} color={active ? cfg.color : C.mute} />
              <Text style={[styles.camChipLabel, { color: active ? cfg.color : C.mute }]}>{cfg.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Camera Discovery Scanner ─────────────────────────────────────── */}
        <View style={[styles.card, { gap: 12 }]}>
          <View style={styles.cardRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <MaterialCommunityIcons name="wifi-find" size={16} color={C.teal} />
              <Text style={styles.cardLabel}>DETECT CAMERAS ON WiFi</Text>
            </View>
            <TouchableOpacity
              onPress={scanner.scan}
              disabled={scanner.scanning}
              style={[styles.miniBtn, { borderColor: C.teal + "99" }, scanner.scanning && { opacity: 0.5 }]}
              activeOpacity={0.7}
            >
              {scanner.scanning ? (
                <>
                  <MaterialCommunityIcons name="radar" size={13} color={C.teal} />
                  <Text style={[styles.miniBtnText, { color: C.teal }]}>Scanning…</Text>
                </>
              ) : (
                <>
                  <Feather name="search" size={13} color={C.teal} />
                  <Text style={[styles.miniBtnText, { color: C.teal }]}>Scan WiFi</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Scanning progress indicator */}
          {scanner.scanning && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={styles.scanDot} />
              <Text style={{ color: C.gold, fontSize: 12 }}>
                Probing Insta360 · GoPro · DJI · Other…
              </Text>
            </View>
          )}

          {/* Discovered cameras list */}
          {scanner.discovered.length > 0 ? (
            <View style={{ gap: 8 }}>
              <Text style={[styles.cardLabel, { color: C.dim }]}>
                {scanner.discovered.length} CAMERA{scanner.discovered.length > 1 ? "S" : ""} FOUND — TAP TO CONNECT
              </Text>
              {scanner.discovered.map((cam) => {
                const isActive = selectedCamera?.id === cam.id && isConnected;
                const isSel    = selectedCamera?.id === cam.id;
                const brandCfg = CAMERA_CONFIGS[
                  cam.brand === "Insta360" ? "insta360"
                  : cam.brand === "GoPro"  ? "gopro"
                  : cam.brand === "DJI"    ? "dji"
                  : "other"
                ];
                return (
                  <TouchableOpacity
                    key={cam.id}
                    onPress={() => handleSelectCamera(cam)}
                    activeOpacity={0.75}
                    style={[
                      styles.camDiscoveryRow,
                      { borderColor: isSel ? brandCfg.color : C.border },
                      isActive && { backgroundColor: brandCfg.color + "18" },
                    ]}
                  >
                    <View style={[styles.camDiscoveryIcon, { backgroundColor: brandCfg.color + "22" }]}>
                      <MaterialCommunityIcons name={brandCfg.icon as any} size={20} color={brandCfg.color} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ color: C.white, fontSize: 13, fontWeight: "700" }}>
                        {cam.manufacturer} {cam.model}
                      </Text>
                      <Text style={{ color: C.mute, fontSize: 10 }}>
                        {cam.ip}  ·  {cam.responseMs}ms
                      </Text>
                    </View>
                    {isActive ? (
                      <View style={[styles.miniChip, { backgroundColor: C.teal + "22", borderColor: C.teal }]}>
                        <Text style={{ color: C.teal, fontSize: 9, fontWeight: "800" }}>LIVE</Text>
                      </View>
                    ) : isSel ? (
                      <View style={[styles.miniChip, { backgroundColor: C.gold + "22", borderColor: C.gold }]}>
                        <Text style={{ color: C.gold, fontSize: 9, fontWeight: "800" }}>CONNECTING</Text>
                      </View>
                    ) : (
                      <Feather name="arrow-right-circle" size={18} color={C.mute} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : !scanner.scanning ? (
            <Text style={[styles.cardSubtitle, { textAlign: "center", paddingVertical: 4 }]}>
              Connect your phone to a camera's WiFi hotspot first, then tap{" "}
              <Text style={{ color: C.teal }}>Scan WiFi</Text> to detect it.
            </Text>
          ) : null}
        </View>

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

        {/* ── Brain Analysis ───────────────────────────────────────────────── */}
        {isConnected && previewBase64 && (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <MaterialCommunityIcons name="brain" size={16} color={C.teal} />
                <Text style={styles.cardLabel}>AI BRAIN ANALYSIS</Text>
              </View>
              <TouchableOpacity
                onPress={doBrainAnalysis}
                disabled={brainLoading}
                style={[styles.miniBtn, { borderColor: C.teal + "99" }, brainLoading && { opacity: 0.4 }]}
              >
                <MaterialCommunityIcons name={brainLoading ? "loading" : "brain"} size={13} color={C.teal} />
                <Text style={[styles.miniBtnText, { color: C.teal }]}>
                  {brainLoading ? "Analysing…" : "Analyse Frame"}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.cardSubtitle}>
              GPT-4.1 reads the camera frame: birds, surface busts, water colour, croc risk, tactics, cast zone.
            </Text>
            {brainError && (
              <Text style={{ color: C.red, fontSize: 12, marginTop: 4 }}>{brainError}</Text>
            )}
          </View>
        )}

        {/* ── Brain Result Card ──────────────────────────────────────────────── */}
        {brainResult && (
          <View style={[styles.card, { borderColor: C.teal + "55", gap: 12 }]}>
            {/* Header */}
            <View style={styles.cardRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <MaterialCommunityIcons name="brain" size={16} color={C.teal} />
                <Text style={[styles.cardLabel, { color: C.teal }]}>WIFI CAM BRAIN</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <View style={[styles.miniChip, {
                  backgroundColor: (ACTIVITY_COLOR[brainResult.activityLevel] ?? C.mute) + "22",
                  borderColor:     (ACTIVITY_COLOR[brainResult.activityLevel] ?? C.mute) + "88",
                }]}>
                  <Text style={{ fontSize: 9, fontWeight: "800", color: ACTIVITY_COLOR[brainResult.activityLevel] ?? C.mute }}>
                    {brainResult.activityLevel.toUpperCase()} ACTIVITY
                  </Text>
                </View>
                <Text style={{ color: C.mute, fontSize: 10, alignSelf: "center" }}>
                  {brainResult.confidence}%
                </Text>
              </View>
            </View>

            {/* Summary */}
            <Text style={{ color: C.white, fontSize: 14, fontWeight: "700", lineHeight: 20 }}>
              {brainResult.summary}
            </Text>

            {/* Cast zone */}
            {brainResult.castZone !== "none" && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ color: C.dim, fontSize: 11 }}>CAST ZONE</Text>
                <View style={{ flexDirection: "row", gap: 4 }}>
                  {(brainResult.castZone === "all"
                    ? ["left", "centre", "right"]
                    : [brainResult.castZone]
                  ).map((z) => (
                    <View key={z} style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: C.teal + "33", borderWidth: 1, borderColor: C.teal }}>
                      <Text style={{ color: C.teal, fontSize: 10, fontWeight: "700" }}>{z.toUpperCase()}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Priority action */}
            {!!brainResult.tactics?.priority && (
              <View style={{ backgroundColor: C.teal + "18", borderRadius: 10, borderWidth: 1, borderColor: C.teal + "55", padding: 10 }}>
                <Text style={{ color: C.teal, fontSize: 10, fontWeight: "700", letterSpacing: 1, marginBottom: 3 }}>▶ DO THIS NOW</Text>
                <Text style={{ color: C.white, fontSize: 13, lineHeight: 20 }}>{brainResult.tactics.priority}</Text>
              </View>
            )}

            {/* Tactics */}
            {brainResult.tactics && (
              <View style={{ gap: 4 }}>
                <Text style={styles.cardLabel}>TACTICS</Text>
                {!!brainResult.tactics.lure && <BrainRow icon="target" label="Lure" value={brainResult.tactics.lure} />}
                {!!brainResult.tactics.technique && <BrainRow icon="activity" label="Technique" value={brainResult.tactics.technique} />}
                {!!brainResult.tactics.depth && <BrainRow icon="chevrons-down" label="Depth" value={brainResult.tactics.depth} />}
              </View>
            )}

            {/* Birds */}
            {brainResult.birds?.detected && (
              <View style={{ gap: 4 }}>
                <Text style={styles.cardLabel}>🐦 BIRDS</Text>
                {brainResult.birds.species.length > 0 && (
                  <Text style={{ color: C.orange, fontSize: 13, fontWeight: "700" }}>
                    {brainResult.birds.species.join(" · ")}
                  </Text>
                )}
                <Text style={styles.cardSubtitle}>{brainResult.birds.description}</Text>
              </View>
            )}

            {/* Surface */}
            {(brainResult.surface?.bustUp || brainResult.surface?.baitBall) && (
              <View style={{ gap: 3 }}>
                <Text style={styles.cardLabel}>🌊 SURFACE</Text>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {brainResult.surface.bustUp  && <View style={[styles.miniChip, { backgroundColor: C.red + "22", borderColor: C.red + "88" }]}><Text style={{ color: C.red, fontSize: 10, fontWeight: "700" }}>BUST-UP</Text></View>}
                  {brainResult.surface.baitBall && <View style={[styles.miniChip, { backgroundColor: C.orange + "22", borderColor: C.orange + "88" }]}><Text style={{ color: C.orange, fontSize: 10, fontWeight: "700" }}>BAIT BALL</Text></View>}
                </View>
                <Text style={styles.cardSubtitle}>{brainResult.surface.description}</Text>
              </View>
            )}

            {/* Water */}
            {brainResult.water && (
              <View style={{ gap: 3 }}>
                <Text style={styles.cardLabel}>💧 WATER</Text>
                <Text style={styles.cardSubtitle}>
                  {brainResult.water.colour} · {brainResult.water.conditions} · visibility {brainResult.water.visibility}
                </Text>
              </View>
            )}

            {/* Croc risk */}
            {brainResult.crocRisk !== "none" && (
              <View style={[styles.safetyBox, {
                borderColor: (CROC_RISK_COLOR[brainResult.crocRisk] ?? C.mute) + "88",
                backgroundColor: (CROC_RISK_COLOR[brainResult.crocRisk] ?? C.mute) + "18",
              }]}>
                <Feather name="alert-triangle" size={14} color={CROC_RISK_COLOR[brainResult.crocRisk] ?? C.mute} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: CROC_RISK_COLOR[brainResult.crocRisk] ?? C.mute, fontSize: 11, fontWeight: "800" }}>
                    🐊 CROC RISK: {brainResult.crocRisk.toUpperCase()}
                  </Text>
                  {!!brainResult.crocDetail && (
                    <Text style={{ color: C.dim, fontSize: 12, lineHeight: 18, marginTop: 3 }}>{brainResult.crocDetail}</Text>
                  )}
                </View>
              </View>
            )}

            {/* Structure + Weather */}
            {!!brainResult.structure && <BrainRow icon="anchor" label="Structure" value={brainResult.structure} />}
            {!!brainResult.weatherRead && <BrainRow icon="cloud" label="Weather" value={brainResult.weatherRead} />}

            <Text style={styles.refBadge}>
              {brainResult.birdRefCount} bird refs · {brainResult.crocRefCount} croc refs injected
            </Text>
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
              <Text style={[styles.cardLabel, { color: C.gold }]}>ANDROID WiFi FIX GUIDE</Text>
            </View>
            <Feather name={samsungGuide ? "chevron-up" : "chevron-down"} size={16} color={C.gold} />
          </View>
          <Text style={styles.cardSubtitle}>
            Android (especially Samsung) can drop camera WiFi — follow these steps if Search fails.
          </Text>
        </TouchableOpacity>

        {samsungGuide && (
          <View style={[styles.card, { borderColor: C.gold + "44", gap: 16 }]}>
            {/* Screen-on indicator */}
            {(status === "searching" || status === "connected") && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.teal + "18", borderRadius: 8, padding: 8 }}>
                <Feather name="sun" size={12} color={C.teal} />
                <Text style={{ color: C.teal, fontSize: 11, fontWeight: "700" }}>
                  Screen stays on automatically while camera is active
                </Text>
              </View>
            )}

            {SAMSUNG_STEPS.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepNumWrap}>
                  <Text style={styles.stepNum}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Feather name={step.icon as any} size={13} color={C.gold} />
                    <Text style={styles.stepTitle}>{step.title}</Text>
                  </View>
                  <Text style={styles.stepBody}>{step.body}</Text>
                  {step.btnLabel && (
                    <TouchableOpacity
                      onPress={() => openSettings(step.intent)}
                      style={styles.stepBtn}
                      activeOpacity={0.8}
                    >
                      <Feather name="external-link" size={11} color={C.gold} />
                      <Text style={styles.stepBtnText}>{step.btnLabel}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Quick tips ───────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>QUICK TIPS</Text>
          <Text style={styles.cardSubtitle}>
            {"• "}
            <Text style={{ color: C.dim }}>{CAMERA_CONFIGS[camType].label} hotspot SSID: </Text>
            <Text style={{ color: C.white }}>{CAMERA_CONFIGS[camType].ssid}</Text>
            {"\n• Password is usually printed on the camera body or visible on-screen"}
            {"\n• Camera must be in WiFi mode (hold Wi-Fi / mode button)"}
            {"\n• Keep camera <10 m from phone for best signal"}
            {"\n• Auto-scan fires every 6 s — croc + bird watch on the water"}
            {camType === "insta360" ? "\n• Insta360 X4/X3: press the Mode button 3× to activate WiFi hotspot" : ""}
            {camType === "gopro"    ? "\n• GoPro: swipe down → Connections → Connect Device → GoPro App (or Quick)" : ""}
            {camType === "dji"      ? "\n• DJI Osmo: swipe down on screen → WiFi icon to enable hotspot" : ""}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Brain data row ───────────────────────────────────────────────────────────
function BrainRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 2 }}>
      <Feather name={icon as any} size={12} color={C.teal} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.mute, fontSize: 9, fontWeight: "700", letterSpacing: 1 }}>{label.toUpperCase()}</Text>
        <Text style={{ color: C.white, fontSize: 12, lineHeight: 18 }}>{value}</Text>
      </View>
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

  camPicker: {
    flexDirection: "row", gap: 6, flexWrap: "wrap",
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  camChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.card,
  },
  camChipLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },

  camDiscoveryRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: C.border,
    backgroundColor: C.card,
  },
  camDiscoveryIcon: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
  },

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
  stepBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    alignSelf: "flex-start", marginTop: 4,
    backgroundColor: C.gold + "22", borderRadius: 8,
    borderWidth: 1, borderColor: C.gold + "66",
    paddingHorizontal: 10, paddingVertical: 5,
  },
  stepBtnText: { color: C.gold, fontSize: 11, fontWeight: "700" },

  wifiBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: C.gold, borderRadius: 10, paddingVertical: 11,
  },
  wifiBtnText: { color: C.bg, fontWeight: "800", fontSize: 13, letterSpacing: 0.5 },
});
