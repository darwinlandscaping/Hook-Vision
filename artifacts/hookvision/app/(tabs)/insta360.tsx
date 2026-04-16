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
  Keyboard,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useFocusEffect } from "expo-router";
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

// ─── Camera brands with their WiFi SSID patterns + quick IPs ─────────────────
const CAMERA_CONFIGS = {
  insta360:   { label: "Insta360",   ssid: "LIVE-xxxxxx  /  Insta360 X4-xxxxxx",  icon: "rotate-360",   color: "#00d4aa",
                quickIps: ["192.168.42.1"],
                infoPath: "/osc/info", cmdPath: "/osc/commands/execute" },
  gopro:      { label: "GoPro",      ssid: "GOPRO-XXXX",                           icon: "camera",        color: "#0099ff",
                quickIps: ["10.5.5.9:8080"],
                infoPath: "/gopro/camera/info", cmdPath: "/gopro/camera/shutter/start" },
  dji:        { label: "DJI Osmo",   ssid: "DJI_OSMO-XXXX  /  OSMO-ACTION-XXXX",  icon: "video-outline", color: "#1a9fff",
                quickIps: ["192.168.2.1"],
                infoPath: "/osc/info", cmdPath: "/osc/commands/execute" },
  smartlife:  { label: "SmartLife",  ssid: "SmartLife_XXXX  /  IP camera hotspot", icon: "cctv",          color: "#00ffcc",
                quickIps: ["192.168.4.1", "192.168.1.100", "192.168.0.100"],
                infoPath: "/snapshot.cgi", cmdPath: "/snapshot.cgi" },
  other:      { label: "Other",      ssid: "Check camera screen or manual",         icon: "wifi",          color: "#ffd700",
                quickIps: ["192.168.1.1", "192.168.0.1"],
                infoPath: "/osc/info", cmdPath: "/osc/commands/execute" },
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

// ─── SmartLife PTZ control pad ────────────────────────────────────────────────
const SL_COLOR = "#00ffcc";

function ptzBtn(
  cmd: string,
  icon: string,
  active: string | null,
  onPress: (cmd: string) => void,
) {
  const isActive = active === cmd;
  return (
    <TouchableOpacity
      key={cmd}
      onPress={() => onPress(cmd)}
      activeOpacity={0.75}
      style={{
        width: 52, height: 52, borderRadius: 26,
        backgroundColor: isActive ? SL_COLOR + "44" : SL_COLOR + "18",
        borderWidth: 2, borderColor: SL_COLOR + (isActive ? "ff" : "55"),
        alignItems: "center", justifyContent: "center",
      }}
    >
      <MaterialCommunityIcons name={icon as any} size={22} color={SL_COLOR} />
    </TouchableOpacity>
  );
}

function SmartLifePTZ({ baseUrl }: { baseUrl: string }) {
  const [active, setActive] = useState<string | null>(null);

  const sendPTZ = useCallback(async (cmd: string) => {
    setActive(cmd);
    const candidates = [
      `http://${baseUrl}/ptz.cgi?cmd=ptzctrl&act=${cmd}&speed=45`,
      `http://${baseUrl}/cgi-bin/ptz.cgi?act=${cmd}&speed=45`,
      `http://${baseUrl}/cgi-bin/hi3510/ptz.cgi?-step=0&-act=${cmd}&-speed=32`,
    ];
    for (const url of candidates) {
      try { await fetch(url, { signal: AbortSignal.timeout(1500) }); break; }
      catch {}
    }
    setTimeout(() => setActive(null), 400);
  }, [baseUrl]);

  return (
    <View style={{ alignItems: "center", gap: 4 }}>
      <Text style={{ color: C.mute, fontSize: 10, fontWeight: "700", letterSpacing: 0.8, marginBottom: 2 }}>PTZ</Text>
      {ptzBtn("up",    "arrow-up-circle-outline",    active, sendPTZ)}
      <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
        {ptzBtn("left", "arrow-left-circle-outline", active, sendPTZ)}
        <TouchableOpacity
          onPress={() => sendPTZ("stop")}
          activeOpacity={0.75}
          style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.red + "22", borderWidth: 2, borderColor: C.red + "66", alignItems: "center", justifyContent: "center" }}
        >
          <MaterialCommunityIcons name="stop-circle-outline" size={22} color={C.red} />
        </TouchableOpacity>
        {ptzBtn("right", "arrow-right-circle-outline", active, sendPTZ)}
      </View>
      {ptzBtn("down",  "arrow-down-circle-outline",   active, sendPTZ)}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
        <TouchableOpacity onPress={() => sendPTZ("zoomin")} activeOpacity={0.75}
          style={{ flex: 1, height: 34, borderRadius: 8, backgroundColor: SL_COLOR + "18", borderWidth: 1.5, borderColor: SL_COLOR + "55", alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name="magnify-plus-outline" size={18} color={SL_COLOR} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => sendPTZ("zoomout")} activeOpacity={0.75}
          style={{ flex: 1, height: 34, borderRadius: 8, backgroundColor: SL_COLOR + "18", borderWidth: 1.5, borderColor: SL_COLOR + "55", alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name="magnify-minus-outline" size={18} color={SL_COLOR} />
        </TouchableOpacity>
      </View>
    </View>
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
  const autoConnectedRef = useRef(false);

  const handleSelectCamera = useCallback((cam: DiscoveredCamera) => {
    setSelectedCamera(cam);
    // Auto-match the brand picker chip
    const brand = cam.brand === "Insta360"   ? "insta360"
      : cam.brand === "GoPro"    ? "gopro"
      : cam.brand === "DJI"      ? "dji"
      : cam.brand === "SmartLife" ? "smartlife"
      : "other";
    setCamType(brand as CamType);
    // Connect to the chosen camera
    startSearchAt(cam.baseUrl, cam.infoPath, cam.cmdPath);
  }, [startSearchAt]);

  // ── Auto-scan when this tab gains focus ────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      autoConnectedRef.current = false;
      if (status === "disconnected") {
        scanner.scan();
      }
    }, []) // intentionally empty — fire once per focus
  );

  // ── Auto-connect to first discovered camera ────────────────────────────
  // Prioritises Insta360 then SmartLife then anything else
  useEffect(() => {
    if (
      scanner.discovered.length === 0 ||
      isConnected ||
      isSearching ||
      autoConnectedRef.current
    ) return;
    autoConnectedRef.current = true;
    const priority = ["Insta360", "SmartLife", "GoPro", "DJI", "Other"] as const;
    const pick =
      priority.reduce<DiscoveredCamera | null>((best, brand) => {
        if (best) return best;
        return scanner.discovered.find((c) => c.brand === brand) ?? null;
      }, null) ?? scanner.discovered[0];
    handleSelectCamera(pick);
  }, [scanner.discovered, isConnected, isSearching, handleSelectCamera]);

  const [camType,         setCamType]         = useState<CamType>("insta360");
  const [previewUri,      setPreviewUri]      = useState<string | null>(null);
  const [previewBase64,   setPreviewBase64]   = useState<string | null>(null);
  const [samsungGuide,    setSamsungGuide]     = useState(false);
  const [snappingManual,  setSnappingManual]   = useState(false);
  const [brainResult,     setBrainResult]      = useState<BrainResult | null>(null);
  const [brainLoading,    setBrainLoading]     = useState(false);
  const [brainError,      setBrainError]       = useState<string | null>(null);
  const [manualIp,        setManualIp]        = useState("");
  const [connectStep,     setConnectStep]     = useState<"idle"|"connecting">("idle");
  const [slTick,          setSlTick]          = useState(0);
  const [slStreamOk,      setSlStreamOk]      = useState(false);
  const [slEndpointIdx,   setSlEndpointIdx]   = useState(0);

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

  // ── SmartLife live stream ticker (polls snapshot every 1.5 s) ──────────────
  const SL_ENDPOINTS = [
    "/snapshot.cgi", "/cgi-bin/snapshot.cgi",
    "/snap.jpg", "/video0.jpg", "/Streaming/channels/1/picture",
  ];
  useEffect(() => {
    if (!isConnected || camType !== "smartlife") {
      setSlTick(0); setSlStreamOk(false); setSlEndpointIdx(0);
      return;
    }
    const t = setInterval(() => setSlTick((n) => n + 1), 1500);
    return () => clearInterval(t);
  }, [isConnected, camType]);

  // ── SmartLife IP (strip http:// prefix for PTZ commands) ───────────────────
  const slIp = activeBaseUrl
    ? activeBaseUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")
    : "192.168.4.1";

  const slStreamUrl = activeBaseUrl
    ? `${activeBaseUrl}${SL_ENDPOINTS[slEndpointIdx]}?_t=${slTick}`
    : null;

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

  // Connect to a camera by manual IP / quick-tap IP
  const connectToIp = useCallback((ipStr: string) => {
    const raw = ipStr.trim();
    if (!raw) return;
    Keyboard.dismiss();
    setManualIp(raw);
    setConnectStep("connecting");
    const cfg = CAMERA_CONFIGS[camType];
    // Build base URL — handle optional port like "10.5.5.9:8080"
    const baseUrl = raw.startsWith("http") ? raw : `http://${raw}`;
    startSearchAt(baseUrl, cfg.infoPath, cfg.cmdPath);
    // Reset connecting state after a moment
    setTimeout(() => setConnectStep("idle"), 3500);
  }, [camType, startSearchAt]);

  const handleManualConnect = useCallback(() => connectToIp(manualIp), [connectToIp, manualIp]);

  // Auto-open Samsung guide when a scan finishes with 0 cameras on Android
  useEffect(() => {
    if (scanner.lastScanDone && scanner.discovered.length === 0 && Platform.OS === "android") {
      setSamsungGuide(true);
    }
  }, [scanner.lastScanDone, scanner.discovered.length]);

  const isWeb = Platform.OS === "web";

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

      {/* ── Auto-scan status banner ──────────────────────────────────────────── */}
      {scanner.scanning && !isConnected && (
        <View style={{
          flexDirection: "row", alignItems: "center", gap: 10,
          backgroundColor: C.gold + "18", paddingHorizontal: 16, paddingVertical: 10,
          borderBottomWidth: 1, borderBottomColor: C.gold + "44",
        }}>
          <MaterialCommunityIcons name="radar" size={18} color={C.gold} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.gold, fontSize: 13, fontWeight: "800" }}>
              AUTO-SCANNING YOUR NETWORK…
            </Text>
            <Text style={{ color: C.gold + "aa", fontSize: 11 }}>
              Checking {scanner.probedCount} / {18} IPs — Insta360 · SmartLife · GoPro · DJI
            </Text>
          </View>
        </View>
      )}
      {!scanner.scanning && isConnected && selectedCamera && (
        <View style={{
          flexDirection: "row", alignItems: "center", gap: 10,
          backgroundColor: C.teal + "18", paddingHorizontal: 16, paddingVertical: 10,
          borderBottomWidth: 1, borderBottomColor: C.teal + "44",
        }}>
          <MaterialCommunityIcons name="check-circle" size={18} color={C.teal} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.teal, fontSize: 13, fontWeight: "800" }}>
              CONNECTED — {selectedCamera.manufacturer} {selectedCamera.model}
            </Text>
            <Text style={{ color: C.teal + "aa", fontSize: 11 }}>
              {selectedCamera.ip}  ·  {selectedCamera.responseMs}ms
            </Text>
          </View>
          <TouchableOpacity onPress={stopSearch} style={{ padding: 4 }} activeOpacity={0.7}>
            <Feather name="x-circle" size={16} color={C.teal} />
          </TouchableOpacity>
        </View>
      )}
      {!scanner.scanning && scanner.lastScanDone && scanner.discovered.length === 0 && !isConnected && !isSearching && (
        <View style={{
          flexDirection: "row", alignItems: "center", gap: 10,
          backgroundColor: C.red + "18", paddingHorizontal: 16, paddingVertical: 10,
          borderBottomWidth: 1, borderBottomColor: C.red + "44",
        }}>
          <MaterialCommunityIcons name="wifi-off" size={18} color={C.red} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.red, fontSize: 12, fontWeight: "800" }}>
              NO CAMERAS FOUND — checked {scanner.probedCount} IPs
            </Text>
            <Text style={{ color: C.red + "aa", fontSize: 11 }}>
              {Platform.OS === "android"
                ? "Samsung: tap STAY CONNECTED when asked, disable Smart Network Switch"
                : "Make sure your phone is on the camera's WiFi hotspot, not your home network"}
            </Text>
          </View>
          <TouchableOpacity onPress={() => scanner.scan()} style={{ padding: 4 }} activeOpacity={0.7}>
            <MaterialCommunityIcons name="refresh" size={18} color={C.red} />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Web-mode notice ──────────────────────────────────────────────── */}
        {isWeb && (
          <View style={{
            backgroundColor: "#ff880022", borderRadius: 12,
            borderWidth: 1.5, borderColor: "#ff880099",
            padding: 14, gap: 8,
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <MaterialCommunityIcons name="cellphone" size={20} color={C.orange} />
              <Text style={{ color: C.orange, fontSize: 13, fontWeight: "800" }}>USE EXPO GO ON YOUR PHONE</Text>
            </View>
            <Text style={{ color: C.dim, fontSize: 12, lineHeight: 18 }}>
              WiFi camera scanning does not work in a web browser — browser security blocks
              local network requests. To connect to a camera:{"\n"}
              {"  1. "}Install <Text style={{ color: C.white, fontWeight: "700" }}>Expo Go</Text> on your phone{"\n"}
              {"  2. "}Scan the QR code shown in the workflows panel{"\n"}
              {"  3. "}Open the WiFi Cam tab in Expo Go{"\n\n"}
              Manual IP entry below will also work once you're in the native app.
            </Text>
          </View>
        )}

        {/* ── Samsung critical warning — always visible on Android ──────────── */}
        {Platform.OS === "android" && (
          <View style={{
            backgroundColor: "#ff440018", borderRadius: 12,
            borderWidth: 1.5, borderColor: "#ff440099",
            padding: 12, gap: 8,
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <MaterialCommunityIcons name="android" size={18} color="#ff6644" />
              <Text style={{ color: "#ff6644", fontSize: 12, fontWeight: "800" }}>SAMSUNG / ANDROID — MUST DO FIRST</Text>
            </View>
            <Text style={{ color: C.dim, fontSize: 12, lineHeight: 19 }}>
              <Text style={{ color: C.white, fontWeight: "700" }}>1. </Text>
              Go to WiFi Settings → join the camera's hotspot{"\n"}
              <Text style={{ color: "#ff6644", fontWeight: "800" }}>2. When Android asks "No internet — stay connected?" → tap STAY CONNECTED{"\n"}</Text>
              <Text style={{ color: C.white, fontWeight: "700" }}>3. </Text>
              WiFi Settings → ⋮ → Advanced → Switch to mobile data → <Text style={{ fontWeight: "700" }}>OFF{"\n"}</Text>
              <Text style={{ color: C.white, fontWeight: "700" }}>4. </Text>
              Settings → Connections → More connection settings → Adaptive connectivity → <Text style={{ fontWeight: "700" }}>OFF</Text>
            </Text>
            <TouchableOpacity onPress={openWifi} style={[styles.miniBtn, { alignSelf: "flex-start", borderColor: "#ff664488", backgroundColor: "#ff440018" }]} activeOpacity={0.7}>
              <MaterialCommunityIcons name="wifi" size={13} color="#ff6644" />
              <Text style={[styles.miniBtnText, { color: "#ff6644" }]}>Open WiFi Settings</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 1: Connect to hotspot ───────────────────────────────────── */}
        <View style={[styles.card, { gap: 10 }]}>
          <View style={styles.cardRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={[styles.stepBadge, { backgroundColor: C.blue + "33", borderColor: C.blue + "88" }]}>
                <Text style={{ color: C.blue, fontSize: 11, fontWeight: "800" }}>1</Text>
              </View>
              <Text style={styles.cardLabel}>CONNECT TO CAMERA HOTSPOT</Text>
            </View>
            {!isWeb && (
              <TouchableOpacity onPress={openWifi} style={[styles.miniBtn, { borderColor: C.gold + "88" }]} activeOpacity={0.7}>
                <MaterialCommunityIcons name="wifi" size={13} color={C.gold} />
                <Text style={[styles.miniBtnText, { color: C.gold }]}>WiFi Settings</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={{ backgroundColor: CAMERA_CONFIGS[camType].color + "14", borderRadius: 8, padding: 10, gap: 3 }}>
            <Text style={{ color: C.dim, fontSize: 10, fontWeight: "700", letterSpacing: 0.8 }}>LOOK FOR THIS HOTSPOT:</Text>
            <Text style={{ color: CAMERA_CONFIGS[camType].color, fontSize: 13, fontWeight: "700" }}>
              {CAMERA_CONFIGS[camType].ssid}
            </Text>
            {camType === "smartlife" && (
              <Text style={{ color: C.mute, fontSize: 11, marginTop: 2 }}>
                Hold reset button 5 s to enable AP/pairing mode — default hotspot IP: 192.168.4.1
              </Text>
            )}
            {camType === "insta360" && (
              <Text style={{ color: C.mute, fontSize: 11, marginTop: 2 }}>
                Press the Mode button 3× on the camera to activate WiFi hotspot
              </Text>
            )}
            {camType === "gopro" && (
              <Text style={{ color: C.mute, fontSize: 11, marginTop: 2 }}>
                Swipe down → Connections → Connect Device → GoPro App (or Quick)
              </Text>
            )}
            {camType === "dji" && (
              <Text style={{ color: C.mute, fontSize: 11, marginTop: 2 }}>
                Swipe down on camera screen → WiFi icon to enable hotspot
              </Text>
            )}
          </View>
        </View>

        {/* ── STEP 2: Find & connect ────────────────────────────────────────── */}
        <View style={[styles.card, { gap: 12 }]}>
          <View style={styles.cardRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={[styles.stepBadge, { backgroundColor: C.teal + "33", borderColor: C.teal + "88" }]}>
                <Text style={{ color: C.teal, fontSize: 11, fontWeight: "800" }}>2</Text>
              </View>
              <Text style={styles.cardLabel}>FIND &amp; CONNECT</Text>
            </View>
            {/* Status chip */}
            <View style={[styles.statusChip, { borderColor: statusColor + "88", backgroundColor: statusColor + "18" }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>

          {/* Camera ring — status indicator */}
          <View style={{ alignItems: "center", paddingVertical: 4 }}>
            <View style={styles.ringOuter}>
              {isSearching && <PulseRing color={C.gold} size={110} />}
              {isConnected && <PulseRing color={C.teal} size={110} />}
              <View style={[styles.ringInner, { borderColor: statusColor, width: 88, height: 88, borderRadius: 44 }]}>
                <MaterialCommunityIcons
                  name={isConnected ? "camera-wireless" : "camera-wireless-outline"}
                  size={36}
                  color={statusColor}
                />
                {isConnected && cameraInfo && (
                  <Text style={[styles.ringModel, { fontSize: 9 }]}>{cameraInfo.model}</Text>
                )}
              </View>
            </View>
          </View>

          {/* Quick-tap IPs */}
          <View style={{ gap: 6 }}>
            <Text style={{ color: C.mute, fontSize: 10, fontWeight: "700", letterSpacing: 0.8 }}>
              QUICK-CONNECT — TAP TO TRY:
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {CAMERA_CONFIGS[camType].quickIps.map((ip) => (
                <TouchableOpacity
                  key={ip}
                  onPress={() => connectToIp(ip)}
                  activeOpacity={0.7}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
                    backgroundColor: CAMERA_CONFIGS[camType].color + "22",
                    borderWidth: 1.5, borderColor: CAMERA_CONFIGS[camType].color + "88",
                  }}
                >
                  <Text style={{ color: CAMERA_CONFIGS[camType].color, fontSize: 12, fontWeight: "700", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }}>
                    {ip}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Manual IP entry */}
          <View style={{ gap: 6 }}>
            <Text style={{ color: C.mute, fontSize: 10, fontWeight: "700", letterSpacing: 0.8 }}>
              OR ENTER CAMERA IP ADDRESS:
            </Text>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <TextInput
                value={manualIp}
                onChangeText={setManualIp}
                placeholder="e.g. 192.168.42.1"
                placeholderTextColor={C.mute}
                keyboardType="decimal-pad"
                returnKeyType="done"
                onSubmitEditing={handleManualConnect}
                style={{
                  flex: 1, height: 42, borderRadius: 10,
                  borderWidth: 1.5, borderColor: C.border,
                  backgroundColor: C.card + "cc",
                  paddingHorizontal: 12,
                  color: C.white, fontSize: 14,
                  fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                }}
              />
              <TouchableOpacity
                onPress={handleManualConnect}
                disabled={!manualIp.trim() || connectStep === "connecting"}
                activeOpacity={0.8}
                style={{
                  height: 42, paddingHorizontal: 16, borderRadius: 10,
                  backgroundColor: C.teal,
                  alignItems: "center", justifyContent: "center",
                  opacity: !manualIp.trim() ? 0.4 : 1,
                }}
              >
                <Text style={{ color: "#000", fontWeight: "800", fontSize: 13 }}>
                  {connectStep === "connecting" ? "…" : "CONNECT"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Action buttons row */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {/* Scan button */}
            <TouchableOpacity
              onPress={scanner.scan}
              disabled={scanner.scanning}
              activeOpacity={0.7}
              style={[{
                flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                height: 42, borderRadius: 10, gap: 6,
                borderWidth: 1.5, borderColor: C.blue + "88",
                backgroundColor: C.blue + "18",
              }, scanner.scanning && { opacity: 0.55 }]}
            >
              <MaterialCommunityIcons name={scanner.scanning ? "radar" : "wifi"} size={15} color={C.blue} />
              <Text style={{ color: C.blue, fontSize: 12, fontWeight: "800" }}>
                {scanner.scanning ? "SCANNING…" : "SCAN NETWORK"}
              </Text>
            </TouchableOpacity>

            {/* Stop / Disconnect */}
            {isSearching ? (
              <TouchableOpacity
                onPress={stopSearch}
                activeOpacity={0.8}
                style={{
                  height: 42, paddingHorizontal: 16, borderRadius: 10,
                  borderWidth: 1.5, borderColor: C.gold + "88",
                  backgroundColor: C.gold + "18",
                  alignItems: "center", justifyContent: "center",
                }}
              >
                <Text style={{ color: C.gold, fontWeight: "800", fontSize: 12 }}>STOP</Text>
              </TouchableOpacity>
            ) : isConnected ? (
              <TouchableOpacity
                onPress={stopSearch}
                activeOpacity={0.8}
                style={{
                  height: 42, paddingHorizontal: 16, borderRadius: 10,
                  borderWidth: 1.5, borderColor: C.red + "88",
                  backgroundColor: C.red + "18",
                  alignItems: "center", justifyContent: "center",
                }}
              >
                <Text style={{ color: C.red, fontWeight: "800", fontSize: 12 }}>DISCONNECT</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Scan progress */}
          {scanner.scanning && (
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={styles.scanDot} />
                <Text style={{ color: C.gold, fontSize: 12 }}>
                  Scanning… ({scanner.probedCount} IPs checked so far)
                </Text>
              </View>
              <Text style={{ color: C.mute, fontSize: 11 }}>
                Checking Insta360 · GoPro · DJI · SmartLife · Generic IPs in parallel
              </Text>
            </View>
          )}

          {/* Discovered cameras */}
          {scanner.discovered.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text style={[styles.cardLabel, { color: C.blue }]}>
                {scanner.discovered.length} CAMERA{scanner.discovered.length > 1 ? "S" : ""} FOUND — TAP TO CONNECT
              </Text>
              {scanner.discovered.map((cam) => {
                const isActive = selectedCamera?.id === cam.id && isConnected;
                const isSel    = selectedCamera?.id === cam.id;
                const brandCfg = CAMERA_CONFIGS[
                  cam.brand === "Insta360"    ? "insta360"
                  : cam.brand === "GoPro"     ? "gopro"
                  : cam.brand === "DJI"       ? "dji"
                  : cam.brand === "SmartLife"  ? "smartlife"
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
          )}

          {/* No cameras — first time or just instructions */}
          {!scanner.scanning && !scanner.lastScanDone && scanner.discovered.length === 0 && !isConnected && !isSearching && (
            <Text style={[styles.cardSubtitle, { textAlign: "center", paddingVertical: 2 }]}>
              Tap a quick-connect IP above, type your camera's IP manually, or tap{" "}
              <Text style={{ color: C.blue }}>Scan Network</Text> to auto-detect.
            </Text>
          )}

          {/* No cameras after a full scan */}
          {!scanner.scanning && scanner.lastScanDone && scanner.discovered.length === 0 && !isConnected && (
            <View style={{
              backgroundColor: C.red + "18", borderRadius: 10,
              borderWidth: 1, borderColor: C.red + "44", padding: 12, gap: 8,
            }}>
              <Text style={{ color: C.red, fontSize: 12, fontWeight: "800" }}>
                ✗ No cameras found — checked {scanner.probedCount} IPs
              </Text>
              <Text style={{ color: C.dim, fontSize: 12, lineHeight: 19 }}>
                Check these things:{"\n"}
                <Text style={{ color: C.white }}>{"  ✓ "}</Text>Camera is ON and in WiFi hotspot mode{"\n"}
                <Text style={{ color: C.white }}>{"  ✓ "}</Text>Phone is connected to the camera's WiFi (not your home network){"\n"}
                {Platform.OS === "android"
                  ? <Text style={{ color: "#ff6644", fontWeight: "700" }}>{"  ✗ Samsung: did you tap STAY CONNECTED when Android asked?\n  ✗ Is Switch to mobile data turned OFF?"}</Text>
                  : <Text style={{ color: C.white }}>{"  ✓ "}</Text>}
                {Platform.OS !== "android" ? "Camera hotspot password entered correctly" : ""}
                {"\n"}
                <Text style={{ color: C.white }}>{"  ✓ "}</Text>Using Expo Go on your phone (not web browser)
              </Text>
              {Platform.OS === "android" && (
                <TouchableOpacity
                  onPress={() => setSamsungGuide(true)}
                  style={[styles.miniBtn, { alignSelf: "flex-start", borderColor: "#ff664488", backgroundColor: "#ff440018" }]}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="android" size={13} color="#ff6644" />
                  <Text style={[styles.miniBtnText, { color: "#ff6644" }]}>Open Samsung Fix Guide ↓</Text>
                </TouchableOpacity>
              )}
            </View>
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

        {/* ── SmartLife Live View ──────────────────────────────────────────────── */}
        {isConnected && camType === "smartlife" && (
          <View style={[styles.card, { gap: 12, borderColor: SL_COLOR + "55", borderWidth: 1.5 }]}>
            {/* Header */}
            <View style={styles.cardRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <MaterialCommunityIcons name="cctv" size={18} color={SL_COLOR} />
                <Text style={[styles.cardLabel, { color: SL_COLOR }]}>SMARTLIFE LIVE VIEW</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.red + "22", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: C.red + "44" }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.red }} />
                <Text style={{ color: C.red, fontSize: 10, fontWeight: "800" }}>LIVE</Text>
              </View>
            </View>

            {/* Stream frame — polls snapshot endpoint every 1.5 s */}
            {slStreamUrl ? (
              <View style={{ borderRadius: 12, overflow: "hidden", backgroundColor: "#000", aspectRatio: 16 / 9 }}>
                {slStreamOk ? (
                  <Image
                    source={{ uri: slStreamUrl }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                    onLoad={() => setSlStreamOk(true)}
                    onError={() => {
                      // Rotate to next known endpoint
                      setSlEndpointIdx((i) => (i + 1) % SL_ENDPOINTS.length);
                    }}
                  />
                ) : (
                  <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <Image
                      source={{ uri: slStreamUrl }}
                      style={{ position: "absolute", width: "100%", height: "100%" }}
                      resizeMode="cover"
                      onLoad={() => setSlStreamOk(true)}
                      onError={() => setSlEndpointIdx((i) => (i + 1) % SL_ENDPOINTS.length)}
                    />
                    <MaterialCommunityIcons name="cctv" size={36} color={SL_COLOR + "66"} />
                    <Text style={{ color: SL_COLOR + "99", fontSize: 12, fontWeight: "700" }}>
                      {slTick < 3 ? "Connecting to stream…" : `Trying endpoint ${slEndpointIdx + 1}/${SL_ENDPOINTS.length}`}
                    </Text>
                    <Text style={{ color: C.mute, fontSize: 10, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }}>
                      {slIp}{SL_ENDPOINTS[slEndpointIdx]}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={{ borderRadius: 12, backgroundColor: "#000", aspectRatio: 16/9, alignItems: "center", justifyContent: "center" }}>
                <MaterialCommunityIcons name="cctv" size={40} color={C.mute} />
                <Text style={{ color: C.mute, fontSize: 12, marginTop: 8 }}>Connect to camera first</Text>
              </View>
            )}

            {/* Controls row: PTZ (left) + Snapshot/Web UI (right) */}
            <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
              <SmartLifePTZ baseUrl={slIp} />
              <View style={{ flex: 1, gap: 8, justifyContent: "center", paddingTop: 28 }}>
                {/* Snapshot */}
                <TouchableOpacity
                  onPress={doSnapshot}
                  disabled={snapping || snappingManual}
                  activeOpacity={0.8}
                  style={[{
                    flexDirection: "row", alignItems: "center", justifyContent: "center",
                    gap: 6, height: 44, borderRadius: 10,
                    backgroundColor: C.teal + "22", borderWidth: 1.5, borderColor: C.teal + "88",
                  }, (snapping || snappingManual) && { opacity: 0.4 }]}
                >
                  <MaterialCommunityIcons name="camera" size={18} color={C.teal} />
                  <Text style={{ color: C.teal, fontWeight: "800", fontSize: 13 }}>
                    {snapping || snappingManual ? "CAPTURING…" : "SNAPSHOT"}
                  </Text>
                </TouchableOpacity>
                {/* Open camera web UI in browser */}
                <TouchableOpacity
                  onPress={() => Linking.openURL(`http://${slIp}/`).catch(() => {})}
                  activeOpacity={0.8}
                  style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 44, borderRadius: 10, backgroundColor: SL_COLOR + "18", borderWidth: 1.5, borderColor: SL_COLOR + "44" }}
                >
                  <MaterialCommunityIcons name="web" size={18} color={SL_COLOR} />
                  <Text style={{ color: SL_COLOR, fontWeight: "800", fontSize: 13 }}>WEB UI</Text>
                </TouchableOpacity>
                {/* Stream endpoint badge */}
                <View style={{ backgroundColor: C.border, borderRadius: 6, padding: 6 }}>
                  <Text style={{ color: C.mute, fontSize: 10, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }}>
                    {slIp}{SL_ENDPOINTS[slEndpointIdx]}
                  </Text>
                </View>
              </View>
            </View>

            {/* Snapshot result */}
            {previewUri && (
              <View style={{ gap: 6 }}>
                <Text style={{ color: C.mute, fontSize: 10, fontWeight: "700", letterSpacing: 0.8 }}>LAST SNAPSHOT</Text>
                <Image source={{ uri: previewUri }} style={[styles.previewImg, { borderRadius: 10 }]} resizeMode="cover" />
              </View>
            )}
          </View>
        )}

        {/* ── Snapshot preview ─────────────────────────────────────────────── */}
        {isConnected && camType !== "smartlife" && (
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
            {camType === "insta360"  ? "\n• Insta360 X4/X3: press the Mode button 3× to activate WiFi hotspot" : ""}
            {camType === "gopro"     ? "\n• GoPro: swipe down → Connections → Connect Device → GoPro App (or Quick)" : ""}
            {camType === "dji"       ? "\n• DJI Osmo: swipe down on screen → WiFi icon to enable hotspot" : ""}
            {camType === "smartlife" ? "\n• SmartLife/Tuya: in the app go to Add Device → Other → Local Network, or enable AP mode by holding reset 5 s\n• Default hotspot IP: 192.168.4.1  (no password needed in AP mode)" : ""}
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

  stepBadge: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
  },
});
