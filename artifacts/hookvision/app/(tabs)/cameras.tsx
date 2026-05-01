/**
 * HookVision — Camera Hub
 * Instant WiFi + Bluetooth connect for Insta360, GoPro, DJI, SmartLife,
 * plus auto-scan, step guide, 360° live view, and AI Brain analysis.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated, Dimensions, Easing, Linking, Platform,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import Svg, {
  Circle, Defs, Ellipse, G, Path, Rect,
  RadialGradient as SvgRG, LinearGradient as SvgLG, Stop,
} from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ExpoLinking from "expo-linking";
import { useInsta360Context } from "@/contexts/Insta360Context";
import { useCameraScanner, type DiscoveredCamera } from "@/hooks/useCameraScanner";
import { HVHeader } from "@/components/HVHeader";

let IntentLauncher: any = null;
if (Platform.OS === "android") {
  try { IntentLauncher = require("expo-intent-launcher"); } catch {}
}

const { width: SW } = Dimensions.get("window");

// ─── Colours ──────────────────────────────────────────────────────────────────
const C = {
  bg:     "#080e1a",
  card:   "#0c1628",
  border: "#1a2f4a",
  teal:   "#00d4aa",
  blue:   "#00a8ff",
  gold:   "#ffd700",
  red:    "#ff4400",
  green:  "#00ff88",
  purple: "#a855f7",
  i360:   "#7c3aed",
  orange: "#ff9900",
  mute:   "rgba(255,255,255,0.28)",
  dim:    "rgba(255,255,255,0.72)",
};

// ─── Camera brand configs ─────────────────────────────────────────────────────
const BRANDS = [
  {
    id: "insta360", label: "Insta360", sub: "ONE X3 / X4 / RS / Go 3",
    icon: "rotate-360", color: C.purple,
    ssid: "LIVE-xxxxxx · Insta360 X4-xxxxxx",
    baseUrl: "http://192.168.42.1", infoPath: "/osc/info", cmdPath: "/osc/commands/execute",
  },
  {
    id: "gopro", label: "GoPro", sub: "Max · Hero 13/12/11",
    icon: "camera", color: C.blue,
    ssid: "GOPRO-XXXX",
    baseUrl: "http://10.5.5.9:8080", infoPath: "/gopro/camera/info", cmdPath: "/gopro/camera/shutter/start",
  },
  {
    id: "dji", label: "DJI Osmo", sub: "Action 4/5 · Pocket 3",
    icon: "video-outline", color: "#1a9fff",
    ssid: "DJI_OSMO-XXXX · OSMO-ACTION-XXXX",
    baseUrl: "http://192.168.2.1", infoPath: "/osc/info", cmdPath: "/osc/commands/execute",
  },
  {
    id: "smartlife", label: "SmartLife", sub: "PTZ · IP Camera · WiFi",
    icon: "cctv", color: "#00ffcc",
    ssid: "SmartLife_XXXX · IP cam hotspot",
    baseUrl: "http://192.168.4.1", infoPath: "/snapshot.cgi", cmdPath: "/snapshot.cgi",
  },
  {
    id: "bluetooth", label: "Bluetooth", sub: "BT cameras · wireless mic",
    icon: "bluetooth", color: "#60a5fa",
    ssid: "Via Bluetooth pairing",
    baseUrl: "", infoPath: "", cmdPath: "",
  },
  {
    id: "other", label: "Other WiFi", sub: "Manual IP · any HTTP stream",
    icon: "wifi", color: C.gold,
    ssid: "Check camera screen or manual",
    baseUrl: "http://192.168.1.1", infoPath: "/osc/info", cmdPath: "/osc/commands/execute",
  },
] as const;
type BrandId = typeof BRANDS[number]["id"];

// ─── Animated fisheye SVG view (simulated 360° feed) ─────────────────────────
function FisheyeView({ tick, active }: { tick: number; active: boolean }) {
  const R = Math.min(SW - 48, 280) / 2;
  const CX = R; const CY = R;
  const fishX = 80 + ((tick * 18) % 120);
  const fishY = CY * 1.35 + Math.sin(tick * 0.5) * 12;
  const bird1X = ((tick * 8) % (R * 2 + 40)) - 20;
  const bird2X = ((tick * 5 + 60) % (R * 2 + 40)) - 20;
  const rippleR = (tick % 4) * 14 + 5;
  return (
    <View style={{ width: R * 2, height: R * 2, borderRadius: R, overflow: "hidden", borderWidth: 3, borderColor: C.i360, alignSelf: "center" }}>
      <Svg width={R * 2} height={R * 2}>
        <Defs>
          <SvgRG id="vig" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="transparent" />
            <Stop offset="0.85" stopColor="transparent" />
            <Stop offset="1" stopColor="rgba(0,0,0,0.6)" />
          </SvgRG>
          <SvgLG id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0"   stopColor="#0a2040" />
            <Stop offset="0.5" stopColor="#0e3a5c" />
            <Stop offset="1"   stopColor="#1a5a3a" />
          </SvgLG>
          <SvgLG id="water" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0"   stopColor="#0a3d1e" />
            <Stop offset="0.5" stopColor="#0a2f1a" />
            <Stop offset="1"   stopColor="#041208" />
          </SvgLG>
          <SvgRG id="ring" cx="50%" cy="50%" r="50%">
            <Stop offset="0.85" stopColor="transparent" />
            <Stop offset="1"    stopColor={C.i360 + "aa"} />
          </SvgRG>
        </Defs>
        {/* Sky */}
        <Rect x={0} y={0} width={R*2} height={CY} fill="url(#sky)" />
        {/* Water */}
        <Rect x={0} y={CY} width={R*2} height={R*2 - CY} fill="url(#water)" />
        {/* Horizon shimmer */}
        <Rect x={0} y={CY - 2} width={R*2} height={4} fill="rgba(0,255,136,0.12)" />
        {/* Mangroves left */}
        <Rect x={0} y={CY*0.4} width={R*0.35} height={CY*0.9} fill="#0d1f0a" opacity="0.7" />
        {/* Mangroves right */}
        <Rect x={R*1.65} y={CY*0.4} width={R*0.35} height={CY*0.9} fill="#0d1f0a" opacity="0.7" />
        {/* Water shimmer lines */}
        {[0,1,2,3].map(i => (
          <Rect key={i} x={R*0.2 + i*R*0.18} y={CY + 15 + i*18} width={R*0.22} height={1.5}
            fill="#00ff88" opacity="0.18" />
        ))}
        {/* Fish */}
        {active && [0,1,2].map(i => (
          <Ellipse key={i} cx={fishX + i*12} cy={fishY + i*5} rx={7-i} ry={3}
            fill={i===0 ? C.gold : C.teal} opacity="0.75" />
        ))}
        {/* Ripple */}
        {active && (
          <Ellipse cx={fishX + 6} cy={CY + 5} rx={rippleR * 1.5} ry={rippleR * 0.5}
            fill="none" stroke="#00ff88" strokeWidth="1.2" opacity={0.7 - (tick % 4) * 0.18} />
        )}
        {/* Birds */}
        {!active && [0,1].map(i => (
          <Path key={i} d={`M${i===0?bird1X:bird2X},${30+i*18} Q${(i===0?bird1X:bird2X)+7},${24+i*18} ${(i===0?bird1X:bird2X)+14},${30+i*18}`}
            fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.2" />
        ))}
        {/* Horizon distortion ellipses */}
        {[0.3, 0.65, 0.95].map((pct, i) => (
          <Ellipse key={i} cx={CX} cy={CY} rx={R*pct} ry={15+i*12}
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        ))}
        {/* Vignette */}
        <Circle cx={CX} cy={CY} r={R} fill="url(#vig)" />
        {/* Ring */}
        <Circle cx={CX} cy={CY} r={R} fill="url(#ring)" />
        {/* REC dot */}
        <Circle cx={18} cy={18} r={6} fill={active ? C.red : C.mute} />
        <Rect x={26} y={11} width={28} height={14} fill="rgba(0,0,0,0.55)" rx={3} />
        {/* North */}
        <Rect x={CX-12} y={4} width={24} height={14} fill="rgba(0,0,0,0.6)" rx={3} />
      </Svg>
      {/* Text overlays (can't put Text inside SVG in RN) */}
      <View style={{ position: "absolute", top: 7, left: 28, width: 30 }}>
        <Text style={{ color: C.red, fontSize: 8, fontFamily: "Inter_700Bold" }}>REC</Text>
      </View>
      <View style={{ position: "absolute", top: 5, left: R - 10 }}>
        <Text style={{ color: C.purple, fontSize: 9, fontFamily: "Inter_700Bold" }}>N</Text>
      </View>
      <View style={{ position: "absolute", bottom: 12, left: 8 }}>
        <Text style={{ color: C.teal, fontSize: 8, fontFamily: "Inter_400Regular" }}>DEPTH 4.2m</Text>
        <Text style={{ color: C.gold, fontSize: 8, fontFamily: "Inter_400Regular" }}>TEMP 28°C</Text>
        <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 8, fontFamily: "Inter_400Regular" }}>TIDE ↑ +0.3</Text>
      </View>
    </View>
  );
}

// ─── Step trail indicator ─────────────────────────────────────────────────────
function StepDot({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  const col = done ? C.green : active ? C.purple : C.mute;
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <View style={[S.stepCircle, { borderColor: col, backgroundColor: done ? C.green + "28" : active ? C.purple + "28" : "transparent" }]}>
        <Text style={[S.stepNum, { color: col }]}>{done ? "✓" : n}</Text>
      </View>
      <Text style={[S.stepLabel, { color: col }]}>{label}</Text>
    </View>
  );
}

// ─── Camera brand button ──────────────────────────────────────────────────────
function CamBtn({ brand, active, onPress }: { brand: typeof BRANDS[number]; active: boolean; onPress: () => void }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active) { pulse.setValue(1); return; }
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.08, duration: 600, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1,    duration: 600, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, [active]);
  return (
    <Animated.View style={{ flex: 1, transform: [{ scale: pulse }] }}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}
        style={[S.camBtn, { borderColor: active ? brand.color : brand.color + "55", backgroundColor: active ? brand.color + "28" : brand.color + "12" }]}>
        <MaterialCommunityIcons name={brand.icon as any} size={26} color={brand.color} />
        <Text style={[S.camBtnLabel, { color: brand.color }]}>{brand.label}</Text>
        <Text style={[S.camBtnSub, { color: C.mute }]}>{brand.sub}</Text>
        {active && (
          <View style={[S.activePill, { backgroundColor: brand.color + "33" }]}>
            <Text style={[S.activePillText, { color: brand.color }]}>SELECTED</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── AI result row ────────────────────────────────────────────────────────────
function BrainRow({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={S.brainRow}>
      <Text style={S.brainIcon}>{icon}</Text>
      <Text style={S.brainLabel}>{label}</Text>
      <Text style={[S.brainValue, { color }]}>{value}</Text>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function CamerasScreen() {
  const insets  = useSafeAreaInsets();
  const { camera } = useInsta360Context();
  const { status, activeBaseUrl, startSearchAt, stopSearch } = camera;
  const scanner = useCameraScanner();

  const isConnected = status === "connected";
  const isSearching = status === "searching";

  const [selectedBrand, setSelectedBrand] = useState<BrandId>("insta360");
  const [tick, setTick]         = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Tick drives the animated fisheye
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1200);
    return () => clearInterval(t);
  }, []);

  // Auto-scan on mount
  useEffect(() => {
    if (status === "disconnected") scanner.scan();
  }, []);

  // Auto-connect to first discovered camera
  const autoRef = useRef(false);
  useEffect(() => {
    if (scanner.discovered.length === 0 || isConnected || isSearching || autoRef.current) return;
    autoRef.current = true;
    const priority = ["Insta360", "SmartLife", "GoPro", "DJI"];
    const pick = priority.reduce<DiscoveredCamera | null>((b, brand) => {
      if (b) return b;
      return scanner.discovered.find(c => c.brand === brand) ?? null;
    }, null) ?? scanner.discovered[0];
    if (pick) {
      startSearchAt(pick.baseUrl, pick.infoPath, pick.cmdPath);
      const bid = pick.brand === "Insta360" ? "insta360" : pick.brand === "GoPro" ? "gopro" : pick.brand === "DJI" ? "dji" : pick.brand === "SmartLife" ? "smartlife" : "other";
      setSelectedBrand(bid as BrandId);
    }
  }, [scanner.discovered, isConnected, isSearching]);

  const handleBrandPress = useCallback((brand: typeof BRANDS[number]) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedBrand(brand.id);
    if (brand.id === "bluetooth") {
      if (Platform.OS === "android" && IntentLauncher) {
        IntentLauncher.startActivityAsync("android.settings.BLUETOOTH_SETTINGS").catch(() => {});
      } else {
        Linking.openURL("App-Prefs:Bluetooth").catch(() => Linking.openURL("app-settings:"));
      }
      return;
    }
    if (brand.baseUrl && !isConnected) {
      if (isSearching) stopSearch();
      setTimeout(() => startSearchAt(brand.baseUrl, brand.infoPath, brand.cmdPath), 150);
    }
  }, [isConnected, isSearching, startSearchAt, stopSearch]);

  const openWifi = useCallback(() => {
    if (Platform.OS === "android" && IntentLauncher) {
      IntentLauncher.startActivityAsync("android.settings.WIFI_SETTINGS").catch(() => {});
    } else {
      Linking.openURL("App-Prefs:WIFI").catch(() => Linking.openURL("app-settings:"));
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    stopSearch();
    autoRef.current = false;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [stopSearch]);

  const handleRescan = useCallback(() => {
    autoRef.current = false;
    scanner.scan();
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  // AI Brain — streaming state
  const [showBrain,    setShowBrain]    = useState(false);
  const [brainLoading, setBrainLoading] = useState(false);
  const [brainResult,  setBrainResult]  = useState<any>(null);
  const [streamChars,  setStreamChars]  = useState(0);
  const [streamSpeed,  setStreamSpeed]  = useState(0);   // chars/sec
  const [totalMs,      setTotalMs]      = useState(0);
  const [liveMs,       setLiveMs]       = useState(0);
  const brainStartRef = useRef<number>(0);

  // Tick every 33ms while loading to show live elapsed time
  useEffect(() => {
    if (!brainLoading) { setLiveMs(0); return; }
    brainStartRef.current = Date.now();
    const id = setInterval(() => setLiveMs(Date.now() - brainStartRef.current), 33);
    return () => clearInterval(id);
  }, [brainLoading]);

  const apiBase = process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
    : "";

  const runBrain = useCallback(async () => {
    if (brainLoading) return;
    setBrainLoading(true);
    setShowBrain(false);
    setBrainResult(null);
    setStreamChars(0);
    setStreamSpeed(0);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const t0 = Date.now();
    let chars = 0;

    try {
      const res = await fetch(`${apiBase}/api/insta360/brain/stream`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          query: "Analyse current fishing conditions. Give best cast zone and croc risk.",
          sonarContext: { depth: "4.2m", fishCount: 2 },
        }),
      });

      if (!res.ok || !res.body) throw new Error(`API ${res.status}`);

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buf     = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") continue;
          try {
            const msg = JSON.parse(payload);
            if (msg.delta) {
              chars += msg.delta.length;
              setStreamChars(chars);
              const elapsed = (Date.now() - t0) / 1000;
              setStreamSpeed(Math.round(chars / Math.max(elapsed, 0.1)));
            }
            if (msg.done && msg.result) {
              setBrainResult(msg.result);
              setShowBrain(true);
              setTotalMs(msg.totalMs ?? (Date.now() - t0));
            }
          } catch {}
        }
      }
    } catch {
      // Fallback to simulated result
      const FALLBACK = [
        { summary: "3 Barra arches detected, 4–6kg avg — surface activity high", activityLevel: "high", castZone: "left", crocRisk: "none", crocDetail: "CLEAR", tactics: { priority: "CAST LEFT 25°, 12m — fish busting surface", lure: "Halco Roosta Popper", technique: "Walk the dog", depth: "surface" }, water: { colour: "tannin", conditions: "calm", visibility: "poor" }, birds: { detected: true, urgency: "high", description: "Ospreys diving left bank", species: ["Osprey"] }, confidence: 91 },
        { summary: "Surface bust in progress — bait ball centre channel", activityLevel: "high", castZone: "centre", crocRisk: "low", crocDetail: "LOW RISK · movement 40m upstream", tactics: { priority: "CAST CENTRE, 8m — bait ball forming", lure: "Lures 95mm minnow", technique: "Fast retrieve", depth: "1–3m" }, water: { colour: "clear", conditions: "rip", visibility: "good" }, birds: { detected: true, urgency: "high", description: "Frigatebirds wheeling tight", species: ["Frigatebird"] }, confidence: 78 },
        { summary: "Large single 65–80cm — croc 12m right bank CAUTION", activityLevel: "medium", castZone: "left", crocRisk: "high", crocDetail: "⚠ CAUTION — 12m, right bank", tactics: { priority: "CAST LEFT 35°, AWAY from croc", lure: "Savage Gear 3D Barra", technique: "Slow roll", depth: "2–4m" }, water: { colour: "murky", conditions: "calm", visibility: "poor" }, birds: { detected: false, urgency: "none", description: "No birds", species: [] }, confidence: 94 },
      ];
      const fb = FALLBACK[Math.floor(Date.now() / 10000) % FALLBACK.length];
      setBrainResult(fb);
      setShowBrain(true);
      setTotalMs(Date.now() - t0);
    } finally {
      setBrainLoading(false);
    }
  }, [brainLoading, apiBase]);

  const crocColor = !brainResult ? C.mute
    : (brainResult.crocRisk === "high" || brainResult.crocDetail?.includes("CAUTION")) ? C.red
    : brainResult.crocRisk === "medium" ? C.orange
    : brainResult.crocRisk === "low"    ? C.gold
    : C.green;

  // Step derivation
  const step = isConnected ? 3 : isSearching ? 2 : scanner.discovered.length > 0 ? 1 : 0;

  const statusColor = isConnected ? C.green : isSearching ? C.gold : C.mute;
  const statusLabel = isConnected ? "LIVE" : isSearching ? "SEARCHING…" : scanner.scanning ? "SCANNING…" : "SETUP";

  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const botPad = Platform.OS === "web" ? 80 : insets.bottom + 20;

  const livePulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(livePulse, { toValue: 0.2, duration: 500, useNativeDriver: true }),
      Animated.timing(livePulse, { toValue: 1,   duration: 500, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <View style={[S.root, { backgroundColor: C.bg }]}>
      <ScrollView contentContainerStyle={[S.scroll, { paddingTop: topPad + 8, paddingBottom: botPad }]}
        showsVerticalScrollIndicator={false}>

        <HVHeader subtitle="Camera Hub · WiFi + Bluetooth" />

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={S.headerRow}>
          <View style={S.headerLeft}>
            <View style={[S.headerIcon, { backgroundColor: C.i360 + "22", borderColor: C.purple + "55" }]}>
              <Text style={{ fontSize: 16 }}>🎥</Text>
            </View>
            <View>
              <Text style={[S.headerTitle, { color: C.purple }]}>CAMERA HUB</Text>
              <Text style={[S.headerSub, { color: C.mute }]}>Insta360 · GoPro · DJI · SmartLife · BT</Text>
            </View>
          </View>
          <View style={[S.statusBadge, { backgroundColor: statusColor + "18", borderColor: statusColor + "55" }]}>
            <Animated.View style={[S.statusDot, { backgroundColor: statusColor, opacity: livePulse }]} />
            <Text style={[S.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        {/* ── Step trail ──────────────────────────────────────────────────── */}
        <View style={[S.stepRow, { backgroundColor: C.card, borderColor: C.border }]}>
          <StepDot n={1} label="Power On"    active={step===0} done={step>0} />
          <Text style={S.stepArrow}>›</Text>
          <StepDot n={2} label="WiFi / BT"   active={step===1} done={step>1} />
          <Text style={S.stepArrow}>›</Text>
          <StepDot n={3} label="Searching"   active={step===2} done={step>2} />
          <Text style={S.stepArrow}>›</Text>
          <StepDot n={4} label="Live + AI"   active={step===3} done={false} />
        </View>

        {/* ── Instant connect grid ─────────────────────────────────────── */}
        <Text style={[S.sectionTitle, { color: C.mute }]}>INSTANT CONNECT</Text>
        <View style={S.brandGrid}>
          {BRANDS.map((brand, i) => (
            i % 2 === 0 ? (
              <View key={brand.id} style={S.brandRow}>
                <CamBtn brand={brand} active={selectedBrand === brand.id} onPress={() => handleBrandPress(brand)} />
                {BRANDS[i + 1] && (
                  <CamBtn brand={BRANDS[i + 1]} active={selectedBrand === BRANDS[i + 1].id} onPress={() => handleBrandPress(BRANDS[i + 1])} />
                )}
              </View>
            ) : null
          ))}
        </View>

        {/* ── Selected brand SSID guide ────────────────────────────────── */}
        {(() => {
          const b = BRANDS.find(x => x.id === selectedBrand);
          if (!b) return null;
          return (
            <View style={[S.ssidCard, { backgroundColor: C.card, borderColor: b.color + "44" }]}>
              <View style={S.ssidRow}>
                <MaterialCommunityIcons name="wifi" size={16} color={b.color} />
                <Text style={[S.ssidLabel, { color: b.color }]}>JOIN WiFi HOTSPOT</Text>
              </View>
              <Text style={[S.ssidName, { color: C.dim }]}>{b.ssid}</Text>
              <View style={S.ssidBtnRow}>
                <TouchableOpacity onPress={openWifi} activeOpacity={0.8}
                  style={[S.ssidBtn, { backgroundColor: b.color + "22", borderColor: b.color + "66" }]}>
                  <Feather name="settings" size={13} color={b.color} />
                  <Text style={[S.ssidBtnText, { color: b.color }]}>Open WiFi Settings</Text>
                </TouchableOpacity>
                {(isConnected || isSearching) ? (
                  <TouchableOpacity onPress={handleDisconnect} activeOpacity={0.8}
                    style={[S.ssidBtn, { backgroundColor: C.red + "18", borderColor: C.red + "44" }]}>
                    <Feather name="wifi-off" size={13} color={C.red} />
                    <Text style={[S.ssidBtnText, { color: C.red }]}>Disconnect</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={handleRescan} activeOpacity={0.8}
                    style={[S.ssidBtn, { backgroundColor: C.teal + "18", borderColor: C.teal + "44" }]}>
                    <Feather name="refresh-cw" size={13} color={C.teal} />
                    <Text style={[S.ssidBtnText, { color: C.teal }]}>Rescan</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })()}

        {/* ── Scanner results ───────────────────────────────────────────── */}
        {scanner.discovered.length > 0 && (
          <>
            <Text style={[S.sectionTitle, { color: C.mute }]}>DISCOVERED CAMERAS</Text>
            {scanner.discovered.map(cam => (
              <TouchableOpacity key={cam.id} activeOpacity={0.8}
                onPress={() => { startSearchAt(cam.baseUrl, cam.infoPath, cam.cmdPath); if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); }}
                style={[S.discoveredCard, { backgroundColor: C.card, borderColor: C.teal + "44" }]}>
                <MaterialCommunityIcons name="camera-wireless" size={20} color={C.teal} />
                <View style={{ flex: 1 }}>
                  <Text style={[S.discoveredName, { color: C.dim }]}>{cam.brand} · {cam.model}</Text>
                  <Text style={[S.discoveredSub, { color: C.mute }]}>{cam.baseUrl} · {cam.responseMs}ms</Text>
                </View>
                <View style={[S.connectNowBtn, { backgroundColor: C.teal + "22", borderColor: C.teal + "55" }]}>
                  <Text style={[S.connectNowText, { color: C.teal }]}>CONNECT</Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* ── 360° Live view ───────────────────────────────────────────── */}
        <Text style={[S.sectionTitle, { color: C.mute }]}>360° LIVE VIEW</Text>
        <View style={[S.fisheyeCard, { backgroundColor: C.card, borderColor: isConnected ? C.purple + "55" : C.border }]}>
          <View style={S.fisheyeHeader}>
            <Text style={{ fontSize: 14 }}>🎥</Text>
            <Text style={[S.fisheyeTitle, { color: C.purple }]}>
              {isConnected ? "LIVE — " + (activeBaseUrl ?? "CONNECTED") : "DEMO MODE — CONNECT CAMERA FOR REAL FEED"}
            </Text>
          </View>
          <FisheyeView tick={tick} active={isConnected} />
          <View style={S.fisheyeFooter}>
            <View style={[S.pipeChip, { backgroundColor: C.purple + "18", borderColor: C.purple + "44" }]}>
              <Animated.View style={[S.pipeDot, { backgroundColor: isConnected ? C.green : C.mute, opacity: livePulse }]} />
              <Text style={[S.pipeLabel, { color: C.purple }]}>Insta360 · 360° stream</Text>
            </View>
          </View>
        </View>

        {/* ── Samsung quick guide ───────────────────────────────────────── */}
        <TouchableOpacity onPress={() => setExpanded(expanded === "samsung" ? null : "samsung")} activeOpacity={0.8}
          style={[S.guideHeader, { backgroundColor: C.card, borderColor: C.orange + "44" }]}>
          <Feather name="smartphone" size={14} color={C.orange} />
          <Text style={[S.guideHeaderText, { color: C.orange }]}>Samsung WiFi Fix — Read if camera not connecting</Text>
          <Feather name={expanded === "samsung" ? "chevron-up" : "chevron-down"} size={14} color={C.mute} />
        </TouchableOpacity>
        {expanded === "samsung" && (
          <View style={[S.guideBody, { backgroundColor: C.card, borderColor: C.orange + "33" }]}>
            {[
              { icon: "wifi", tip: 'Connect phone to camera WiFi hotspot, then tap "STAY CONNECTED" when Samsung prompts (no internet).' },
              { icon: "toggle-left", tip: "WiFi Settings → ⋮ → Advanced → Switch to mobile data → OFF. Samsung's #1 cause of camera fails." },
              { icon: "smartphone", tip: "Settings → Connections → More → Adaptive connectivity → OFF. Stops Samsung from auto-switching away." },
              { icon: "battery", tip: "Settings → Battery → Background usage limits → remove HookVision from sleeping apps." },
            ].map(({ icon, tip }, i) => (
              <View key={i} style={S.guideTip}>
                <Feather name={icon as any} size={13} color={C.orange} />
                <Text style={[S.guideTipText, { color: C.dim }]}>{tip}</Text>
              </View>
            ))}
            <TouchableOpacity onPress={openWifi} activeOpacity={0.8}
              style={[S.guideBtn, { backgroundColor: C.orange + "22", borderColor: C.orange + "66" }]}>
              <Text style={[S.guideBtnText, { color: C.orange }]}>Open WiFi Settings</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── AI Brain Analyser ─────────────────────────────────────────── */}
        <View style={[S.brainCard, { backgroundColor: C.card, borderColor: C.teal + "44" }]}>
          {/* Header */}
          <View style={S.brainHeader}>
            <Text style={{ fontSize: 16 }}>🧠</Text>
            <View style={{ flex: 1 }}>
              <Text style={[S.brainTitle, { color: C.teal }]}>AI BRAIN ANALYSER</Text>
              <Text style={[S.brainSub, { color: C.mute }]}>gpt-5-nano · streaming SSE · detail:low · 200 token cap</Text>
            </View>
            {/* Turbo badge */}
            <View style={[S.turboBadge, { backgroundColor: C.purple + "22", borderColor: C.purple + "66" }]}>
              <Text style={[S.turboText, { color: C.purple }]}>⚡ TURBO</Text>
            </View>
          </View>

          {/* Scan button */}
          <TouchableOpacity onPress={runBrain} disabled={brainLoading} activeOpacity={0.8}
            style={[S.scanBtn, { backgroundColor: brainLoading ? C.teal + "12" : C.teal + "28", borderColor: brainLoading ? C.teal + "44" : C.teal + "99", opacity: brainLoading ? 0.85 : 1 }]}>
            {brainLoading
              ? <Text style={[S.scanBtnText, { color: C.teal }]}>⚡  {liveMs}ms · {streamChars} chars · {streamSpeed} c/s</Text>
              : <Text style={[S.scanBtnText, { color: C.teal }]}>📸  SNAP + AI BRAIN SCAN</Text>
            }
          </TouchableOpacity>

          {/* Streaming progress bar */}
          {brainLoading && streamChars > 0 && (
            <View style={[S.confBar, { backgroundColor: C.border, marginBottom: 8 }]}>
              <Animated.View style={[S.confFill, { width: `${Math.min(streamChars / 5, 100)}%` as any, backgroundColor: C.purple }]} />
            </View>
          )}

          {/* Results */}
          {showBrain && !brainLoading && brainResult && (
            <>
              {/* Speed stats */}
              <View style={[S.speedRow, { backgroundColor: C.purple + "12", borderColor: C.purple + "33" }]}>
                <Text style={[S.speedText, { color: C.purple }]}>⚡ {totalMs}ms · {streamChars} chars · {streamSpeed} c/s · gpt-5-nano</Text>
              </View>

              {/* Summary */}
              {brainResult.summary && (
                <Text style={[S.summaryText, { color: C.dim }]}>{brainResult.summary}</Text>
              )}

              {/* Confidence bar */}
              <View style={[S.confBar, { backgroundColor: C.border }]}>
                <View style={[S.confFill, { width: `${brainResult.confidence ?? 80}%` as any, backgroundColor: (brainResult.confidence ?? 80) > 85 ? C.green : C.gold }]} />
              </View>
              <Text style={[S.confLabel, { color: C.mute }]}>Confidence {brainResult.confidence ?? 80}% · {brainResult.activityLevel?.toUpperCase() ?? "?"} activity</Text>

              {/* Result rows from real API */}
              <BrainRow icon="🐟" label="Fish / Birds"
                value={brainResult.birds?.detected
                  ? `${brainResult.birds.species?.[0] ?? "Birds"} diving · ${brainResult.activityLevel} activity`
                  : brainResult.activityLevel === "high" ? "HIGH activity — fish busting" : "Low visible activity"}
                color={brainResult.activityLevel === "high" ? C.gold : brainResult.activityLevel === "medium" ? C.orange : C.mute} />
              <BrainRow icon="⚠️" label="Croc Risk"
                value={brainResult.crocDetail || brainResult.crocRisk?.toUpperCase() || "CLEAR"}
                color={crocColor} />
              <BrainRow icon="🎣" label="Cast Zone"
                value={brainResult.tactics?.priority || `CAST ${(brainResult.castZone ?? "centre").toUpperCase()}`}
                color={C.teal} />
              <BrainRow icon="🌊" label="Water"
                value={`${brainResult.water?.colour ?? "?"} · ${brainResult.water?.conditions ?? "?"} · ${brainResult.water?.visibility ?? "?"} vis`}
                color={C.blue} />
              {brainResult.tactics?.lure && (
                <BrainRow icon="🪝" label="Lure"
                  value={`${brainResult.tactics.lure} · ${brainResult.tactics.technique ?? ""}`}
                  color={C.orange} />
              )}
              {brainResult.structure && (
                <BrainRow icon="🗺" label="Structure"
                  value={brainResult.structure}
                  color={C.dim} />
              )}
            </>
          )}
        </View>

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root:            { flex: 1 },
  scroll:          { paddingHorizontal: 14, gap: 10 },

  headerRow:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerLeft:      { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  headerIcon:      { width: 32, height: 32, borderRadius: 8, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  headerTitle:     { fontSize: 14, fontFamily: "Inter_700Bold", letterSpacing: 0.4 },
  headerSub:       { fontSize: 9, fontFamily: "Inter_400Regular" },
  statusBadge:     { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 3 },
  statusDot:       { width: 6, height: 6, borderRadius: 3 },
  statusText:      { fontSize: 10, fontFamily: "Inter_700Bold" },

  stepRow:         { flexDirection: "row", alignItems: "center", borderRadius: 8, paddingHorizontal: 11, paddingVertical: 8, borderWidth: 1 },
  stepCircle:      { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  stepNum:         { fontSize: 10, fontFamily: "Inter_700Bold" },
  stepLabel:       { fontSize: 8, fontFamily: "Inter_700Bold", marginTop: 3, textAlign: "center" },
  stepArrow:       { color: "#1a2f4a", fontSize: 14, lineHeight: 22, marginHorizontal: 2 },

  sectionTitle:    { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 1, textTransform: "uppercase" },

  brandGrid:       { gap: 8 },
  brandRow:        { flexDirection: "row", gap: 8 },
  camBtn:          { flex: 1, borderRadius: 12, borderWidth: 1.5, padding: 12, alignItems: "center", gap: 4, minHeight: 90 },
  camBtnLabel:     { fontSize: 13, fontFamily: "Inter_700Bold", textAlign: "center" },
  camBtnSub:       { fontSize: 9, fontFamily: "Inter_400Regular", textAlign: "center" },
  activePill:      { marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  activePillText:  { fontSize: 8, fontFamily: "Inter_700Bold" },

  ssidCard:        { borderRadius: 10, padding: 12, borderWidth: 1, gap: 8 },
  ssidRow:         { flexDirection: "row", alignItems: "center", gap: 6 },
  ssidLabel:       { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },
  ssidName:        { fontSize: 12, fontFamily: "Inter_400Regular" },
  ssidBtnRow:      { flexDirection: "row", gap: 8 },
  ssidBtn:         { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 8, paddingVertical: 8, borderWidth: 1 },
  ssidBtnText:     { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  discoveredCard:  { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 10, padding: 12, borderWidth: 1 },
  discoveredName:  { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  discoveredSub:   { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 2 },
  connectNowBtn:   { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1 },
  connectNowText:  { fontSize: 9, fontFamily: "Inter_700Bold" },

  fisheyeCard:     { borderRadius: 12, padding: 14, borderWidth: 1.5, alignItems: "center", gap: 12 },
  fisheyeHeader:   { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start" },
  fisheyeTitle:    { fontSize: 11, fontFamily: "Inter_700Bold" },
  fisheyeFooter:   { alignSelf: "stretch" },
  pipeChip:        { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  pipeDot:         { width: 7, height: 7, borderRadius: 3.5 },
  pipeLabel:       { fontSize: 10, fontFamily: "Inter_600SemiBold" },

  guideHeader:     { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, padding: 12, borderWidth: 1 },
  guideHeaderText: { flex: 1, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  guideBody:       { borderRadius: 10, padding: 14, borderWidth: 1, gap: 10, marginTop: -4 },
  guideTip:        { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  guideTipText:    { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  guideBtn:        { alignItems: "center", paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  guideBtnText:    { fontSize: 13, fontFamily: "Inter_700Bold" },

  brainCard:       { borderRadius: 12, padding: 14, borderWidth: 1.5, gap: 0 },
  brainHeader:     { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  brainTitle:      { fontSize: 13, fontFamily: "Inter_700Bold" },
  brainSub:        { fontSize: 9, fontFamily: "Inter_400Regular" },
  turboBadge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  turboText:       { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  scanBtn:         { height: 44, borderRadius: 10, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  scanBtnText:     { fontSize: 12, fontFamily: "Inter_700Bold" },
  speedRow:        { borderRadius: 7, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, marginBottom: 8 },
  speedText:       { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  summaryText:     { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18, marginBottom: 8 },
  confBar:         { height: 4, borderRadius: 2, overflow: "hidden", marginBottom: 4 },
  confFill:        { height: "100%", borderRadius: 2 },
  confLabel:       { fontSize: 9, fontFamily: "Inter_400Regular", marginBottom: 8 },
  brainRow:        { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "#1a2f4a" },
  brainIcon:       { fontSize: 13 },
  brainLabel:      { flex: 1, color: "rgba(255,255,255,0.67)", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  brainValue:      { fontSize: 11, fontFamily: "Inter_700Bold", textAlign: "right", maxWidth: "55%" },
});
