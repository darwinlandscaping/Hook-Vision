/**
 * SmartCam — Dual WiFi Camera → AI Analyser
 * Cam1 = first found WiFi camera (any brand: Swann, 360, SmartLife, GoPro, etc.)
 * Cam2 = second found WiFi camera (or sonar sim fallback)
 * Features: auto-scan, Connect Now button, enlarge each camera, live snapshot feed
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, Animated, Platform, Modal, Image,
  ActivityIndicator,
} from "react-native";
import Svg, {
  Path, Rect, Ellipse, Circle, G, Defs,
  LinearGradient as SvgLG, RadialGradient as SvgRG, Stop,
} from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

import { HVHeader } from "@/components/HVHeader";
import { useCameraScanner, type DiscoveredCamera } from "@/hooks/useCameraScanner";

const { width: SW, height: SH } = Dimensions.get("window");
const CAM_W = (SW - 30 - 4) / 2;
const CAM_H = CAM_W * 0.65;

// ─── Palette ─────────────────────────────────────────────────────────────────
const C = {
  bg:     "#0a1628",
  card:   "#0d1f3a",
  border: "#1a2f4a",
  teal:   "#00d4aa",
  blue:   "#00a8ff",
  gold:   "#ffd700",
  red:    "#ff4400",
  sl:     "#00ffcc",
  mute:   "rgba(255,255,255,0.27)",
  dim:    "rgba(255,255,255,0.67)",
  green:  "#00ff88",
  orange: "#ff9900",
};

// ─── Brand colour map ─────────────────────────────────────────────────────────
function brandColor(cam: DiscoveredCamera | null) {
  if (!cam) return C.mute;
  switch (cam.brand) {
    case "Insta360":  return "#a855f7";
    case "GoPro":     return C.blue;
    case "DJI":       return "#1a9fff";
    case "SmartLife": return C.sl;
    default:          return C.gold;
  }
}

// ─── SVG water scene sim (fallback when no real cam) ─────────────────────────
function WaterSimFeed({ tick, slot }: { tick: number; slot: 1 | 2 }) {
  const scene = (tick + slot) % 4;
  type Sc = { skyA: string; skyB: string; waterA: string; waterB: string; label: string; night: boolean };
  const scenes: Sc[] = [
    { skyA:"#1a2a3a", skyB:"#3d5a6e", waterA:"#1e3a4a", waterB:"#061520", label:"ESTUARY · MANGROVE",   night:false },
    { skyA:"#0d1f3a", skyB:"#24547a", waterA:"#1a3a5c", waterB:"#061929", label:"RIVER MOUTH · OPEN",   night:false },
    { skyA:"#050e18", skyB:"#0a1a22", waterA:"#0a1a22", waterB:"#050e18", label:"IR NIGHT · BILLABONG", night:true  },
    { skyA:"#3a1a0a", skyB:"#4a2a10", waterA:"#2a1a0a", waterB:"#0a0803", label:"TIDAL CREEK · SUNSET", night:false },
  ];
  const s = scenes[scene];
  const fishX = (28 + (tick * 6) % 38) / 100;

  return (
    <View style={{ width: CAM_W, height: CAM_H, overflow:"hidden", backgroundColor:"#000" }}>
      <Svg width={CAM_W} height={CAM_H} viewBox="0 0 300 100" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <SvgLG id={`sky${slot}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={s.skyA} />
            <Stop offset="1" stopColor={s.skyB} />
          </SvgLG>
          <SvgLG id={`water${slot}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={s.waterA} />
            <Stop offset="1" stopColor={s.waterB} />
          </SvgLG>
        </Defs>
        <Rect x="0" y="0" width="300" height="50" fill={`url(#sky${slot})`} />
        <Rect x="0" y="45" width="300" height="60" fill={`url(#water${slot})`} />
        <Rect x="0" y="43" width="300" height="5" fill={s.night ? "rgba(0,255,100,0.06)" : "rgba(255,200,100,0.09)"} />
        <Path d="M0,55 L0,38 Q8,24 18,38 Q22,16 32,35 Q38,20 48,36 L48,55Z" fill={s.night?"#030a10":"#0d1f2a"} opacity="0.65"/>
        <Path d="M252,55 L252,40 Q260,24 268,38 Q274,18 284,36 Q290,25 300,37 L300,55Z" fill={s.night?"#030a10":"#0d1f2a"} opacity="0.65"/>
        <Path d={`M${-30+(tick*5)%50},80 Q60,72 140,80 Q220,88 310,80`} fill="none" stroke={s.night?"#00ff4433":"#00d4aa33"} strokeWidth="1.2"/>
        {[0,1,2,3].map(i => (
          <Ellipse key={i} cx={fishX*300+i*4} cy={75+(i%2)} rx={1.5+(i%2)*0.5} ry={1} fill={s.night?C.green:C.gold} opacity="0.65"/>
        ))}
        {!s.night && [0,1,2].map(i => {
          const bx = ((tick*3.5+i*55)%340)-20;
          const by = 12+i*5;
          const sz = 10-i*1.5;
          return (
            <G key={i} transform={`translate(${bx},${by})`} opacity={0.85-i*0.15}>
              <Path d={`M0,${sz*0.4} Q${sz*0.5},0 ${sz},${sz*0.4} Q${sz*1.5},0 ${sz*2},${sz*0.4}`} fill="none" stroke="#1a1a2a" strokeWidth={sz>8?1.8:1.3} strokeLinecap="round"/>
            </G>
          );
        })}
        {s.night && <Rect x="0" y="0" width="300" height="100" fill="rgba(0,70,35,0.16)"/>}
      </Svg>
      <View style={S.camLabel}>
        <Text style={[S.camBadge, { color: C.mute }]}>● CAM{slot}</Text>
        <Text style={S.camScene}>{s.label}</Text>
      </View>
      <Text style={S.camStamp}>NO CAMERA · SIM</Text>
    </View>
  );
}

// ─── Live snapshot feed ───────────────────────────────────────────────────────
function LiveCamFeed({ cam, tick, slot, label }: { cam: DiscoveredCamera; tick: number; slot: 1|2; label: string }) {
  const color = brandColor(cam);
  const snapUri = `${cam.baseUrl}${cam.snapshotPath}?t=${tick}`;
  const [imgOk, setImgOk] = useState(true);

  return (
    <View style={{ width: CAM_W, height: CAM_H, overflow:"hidden", backgroundColor:"#000" }}>
      {imgOk ? (
        <Image
          source={{ uri: snapUri }}
          style={{ width: CAM_W, height: CAM_H }}
          resizeMode="cover"
          onError={() => setImgOk(false)}
        />
      ) : (
        <View style={{ width: CAM_W, height: CAM_H, backgroundColor:"#050e18", alignItems:"center", justifyContent:"center", gap: 6 }}>
          <MaterialCommunityIcons name="wifi-alert" size={28} color={color} />
          <Text style={{ color, fontFamily:"Inter_700Bold", fontSize:10, letterSpacing:0.5 }}>{cam.brand.toUpperCase()}</Text>
          <Text style={{ color: C.mute, fontSize:9, fontFamily:"Inter_400Regular" }}>{cam.ip}</Text>
          <Text style={{ color: C.dim, fontFamily:"Inter_400Regular", fontSize:8, textAlign:"center", paddingHorizontal:8 }}>
            LIVE — snapshot unavailable{"\n"}connect to camera hotspot
          </Text>
        </View>
      )}
      <View style={S.camLabel}>
        <Text style={[S.camBadge, { color }]}>● CAM{slot}</Text>
        <Text style={S.camScene}>{label}</Text>
      </View>
      <Text style={[S.camStamp, { color }]}>{cam.ip} · {cam.brand}</Text>
    </View>
  );
}

// ─── Fullscreen modal for enlarged camera ─────────────────────────────────────
function CamModal({
  visible, onClose, cam, tick, slot, simSlot
}: {
  visible: boolean; onClose: () => void;
  cam: DiscoveredCamera | null; tick: number; slot: 1|2; simSlot: 1|2
}) {
  const color = brandColor(cam);
  const snapUri = cam ? `${cam.baseUrl}${cam.snapshotPath}?t=${tick}` : null;
  const [imgOk, setImgOk] = useState(true);

  useEffect(() => { if (visible) setImgOk(true); }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor:"#000" }}>
        {/* Close bar */}
        <View style={S.modalBar}>
          <Text style={[S.modalTitle, { color: cam ? color : C.mute }]}>
            CAM{slot} — {cam ? `${cam.brand} · ${cam.model}` : "SIMULATION"}
          </Text>
          <TouchableOpacity onPress={onClose} style={S.modalClose} activeOpacity={0.7}>
            <MaterialCommunityIcons name="fullscreen-exit" size={22} color={C.dim} />
          </TouchableOpacity>
        </View>

        {/* Feed */}
        <View style={{ flex: 1, alignItems:"center", justifyContent:"center" }}>
          {cam && imgOk ? (
            <Image
              source={{ uri: snapUri! }}
              style={{ width: SW, height: SH * 0.78 }}
              resizeMode="contain"
              onError={() => setImgOk(false)}
            />
          ) : cam && !imgOk ? (
            <View style={{ alignItems:"center", gap:12 }}>
              <MaterialCommunityIcons name="wifi-alert" size={52} color={color} />
              <Text style={{ color, fontFamily:"Inter_700Bold", fontSize:16 }}>{cam.brand} · {cam.ip}</Text>
              <Text style={{ color: C.mute, fontSize:12, fontFamily:"Inter_400Regular", textAlign:"center", paddingHorizontal:32 }}>
                Camera found but snapshot stream unavailable.{"\n"}Join the camera's WiFi hotspot then tap Connect Now.
              </Text>
            </View>
          ) : (
            <View style={{ width: SW, height: SH * 0.72 }}>
              <WaterSimFeed tick={tick} slot={simSlot} />
            </View>
          )}
        </View>

        {/* Info bar */}
        {cam && (
          <View style={S.modalInfo}>
            <Text style={[S.modalInfoText, { color }]}>{cam.ip}  ·  {cam.responseMs}ms  ·  {cam.manufacturer}</Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

// ─── Pipeline chip ────────────────────────────────────────────────────────────
function PipelineChip({ label, color, fps }: { label: string; color: string; fps: number }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.3, duration: 600, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1,   duration: 600, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, []);
  return (
    <View style={[S.pipeChip, { backgroundColor: color+"14", borderColor: color+"44" }]}>
      <Animated.View style={[S.pipeChipDot, { backgroundColor: color, opacity: pulse }]} />
      <View style={{ flex:1 }}>
        <Text style={[S.pipeChipLabel, { color }]}>{label}</Text>
        <Text style={S.pipeChipSub}>{fps} fps · live</Text>
      </View>
    </View>
  );
}

// ─── PTZ button ───────────────────────────────────────────────────────────────
function PtzBtn({ icon, cmd, onCmd }: { icon: string; cmd: string; onCmd: (c: string) => void }) {
  const [pressed, setPressed] = useState(false);
  return (
    <TouchableOpacity
      onPress={() => { setPressed(true); onCmd(cmd); setTimeout(() => setPressed(false), 300); }}
      activeOpacity={0.7}
      style={[S.ptzBtn, pressed && S.ptzBtnActive]}
    >
      <Text style={[S.ptzBtnText, { color: C.sl }]}>{icon}</Text>
    </TouchableOpacity>
  );
}

// ─── Analyser row ─────────────────────────────────────────────────────────────
function AnalyserRow({ icon, label, value, color, source }: { icon:string; label:string; value:string; color:string; source:string }) {
  return (
    <View style={S.analyserRow}>
      <Text style={S.analyserIcon}>{icon}</Text>
      <View style={{ flex:1 }}>
        <Text style={S.analyserLabel}>{label}</Text>
        <Text style={S.analyserSource}>from {source}</Text>
      </View>
      <Text style={[S.analyserValue, { color }]}>{value}</Text>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function SmartCamScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scanner = useCameraScanner();

  const [tick,   setTick]   = useState(0);
  const [ptzLog, setPtzLog] = useState<string | null>(null);
  const ptzTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Assigned cameras: first found → cam1, second found → cam2
  const [cam1, setCam1] = useState<DiscoveredCamera | null>(null);
  const [cam2, setCam2] = useState<DiscoveredCamera | null>(null);

  // Enlarged camera modal
  const [expandedSlot, setExpandedSlot] = useState<1|2|null>(null);

  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const botPad = Platform.OS === "web" ? 80 : insets.bottom + 20;

  // Tick every 2s — drives animated feeds + snapshot refresh
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 2000);
    return () => clearInterval(t);
  }, []);

  // Auto-assign first two discovered cameras as they come in
  useEffect(() => {
    if (scanner.discovered.length >= 1 && !cam1) {
      setCam1(scanner.discovered[0]);
    }
    if (scanner.discovered.length >= 2 && !cam2) {
      setCam2(scanner.discovered[1]);
    }
  }, [scanner.discovered]);

  // Connect Now handler — scan all known WiFi camera IPs
  const handleConnect = useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setCam1(null);
    setCam2(null);
    scanner.scan();
  }, [scanner]);

  // PTZ
  const handlePTZ = useCallback((cmd: string) => {
    setPtzLog(`PTZ → ${cmd.toUpperCase()}`);
    if (ptzTimer.current) clearTimeout(ptzTimer.current);
    ptzTimer.current = setTimeout(() => setPtzLog(null), 1200);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // AI analyser derived values
  const fishCount    = 2 + (tick % 3);
  const depthM       = (8.4 + Math.sin(tick * 0.3) * 0.6).toFixed(1);
  const archStrength = ["STRONG", "MODERATE", "FAINT"][tick % 3];
  const archColor    = [C.red, C.gold, C.green][tick % 3];
  const croc         = tick % 7 < 2 ? "⚠ POSSIBLE — 8m NE" : "CLEAR";
  const crocColor    = tick % 7 < 2 ? C.red : C.green;
  const castZone     = ["CAST LEFT 30°", "CAST CENTRE", "CAST RIGHT 25°"][tick % 3];
  const clarity      = tick % 4 < 2 ? "TANNIN/MURKY" : "CLEAR";
  const clarityColor = tick % 4 < 2 ? C.orange : C.teal;

  const livePulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(livePulse, { toValue: 0.3, duration: 500, useNativeDriver: true }),
      Animated.timing(livePulse, { toValue: 1,   duration: 500, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, []);

  const scanStatus = scanner.scanning
    ? `SCANNING… ${scanner.probedCount} IPs checked`
    : scanner.lastScanDone
    ? `${scanner.discovered.length} camera${scanner.discovered.length !== 1 ? "s" : ""} found`
    : "Tap Connect Now to search";

  const cam1Color = brandColor(cam1);
  const cam2Color = brandColor(cam2);

  return (
    <View style={[S.root, { backgroundColor: C.bg }]}>
      {/* ── Fullscreen modals ──────────────────────────────────────────────── */}
      <CamModal
        visible={expandedSlot === 1}
        onClose={() => setExpandedSlot(null)}
        cam={cam1} tick={tick} slot={1} simSlot={1}
      />
      <CamModal
        visible={expandedSlot === 2}
        onClose={() => setExpandedSlot(null)}
        cam={cam2} tick={tick} slot={2} simSlot={2}
      />

      <ScrollView
        contentContainerStyle={[S.scroll, { paddingTop: topPad + 8, paddingBottom: botPad }]}
        showsVerticalScrollIndicator={false}
      >
        <HVHeader subtitle="SmartCam · Any WiFi Camera" />

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={S.headerRow}>
          <View style={S.headerLeft}>
            <View style={S.headerIcon}>
              <Text style={{ fontSize: 16 }}>📡</Text>
            </View>
            <View>
              <Text style={[S.headerTitle, { color: C.sl }]}>SMART CAM — DUAL FEED → AI</Text>
              <Text style={[S.headerSub, { color: C.mute }]}>Swann · 360 · SmartLife · Any WiFi cam</Text>
            </View>
          </View>
          <View style={S.liveBadge}>
            <Animated.View style={[S.liveDot, { opacity: livePulse }]} />
            <Text style={S.liveText}>{cam1 || cam2 ? "LIVE" : "IDLE"}</Text>
          </View>
        </View>

        {/* ── Connect Now button ──────────────────────────────────────────── */}
        <TouchableOpacity onPress={handleConnect} activeOpacity={0.8}
          style={[S.connectBtn, { borderColor: scanner.scanning ? C.gold+"88" : C.sl+"99", backgroundColor: scanner.scanning ? C.gold+"18" : C.sl+"18" }]}>
          {scanner.scanning ? (
            <ActivityIndicator size="small" color={C.gold} style={{ marginRight: 8 }} />
          ) : (
            <MaterialCommunityIcons name="wifi-refresh" size={18} color={C.sl} style={{ marginRight: 8 }} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={[S.connectBtnTitle, { color: scanner.scanning ? C.gold : C.sl }]}>
              {scanner.scanning ? "SCANNING FOR CAMERAS…" : "CONNECT NOW — CAM LIVE"}
            </Text>
            <Text style={S.connectBtnSub}>{scanStatus}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={18} color={C.mute} />
        </TouchableOpacity>

        {/* ── Discovered cameras list ─────────────────────────────────────── */}
        {scanner.discovered.length > 0 && (
          <View style={[S.discoveredCard, { borderColor: C.border }]}>
            <Text style={[S.discoveredTitle, { color: C.mute }]}>DETECTED CAMERAS</Text>
            {scanner.discovered.slice(0, 6).map((cam, idx) => {
              const col = brandColor(cam);
              const assigned = idx === 0 ? "→ CAM1" : idx === 1 ? "→ CAM2" : "";
              return (
                <View key={cam.id} style={S.discoveredRow}>
                  <MaterialCommunityIcons name="camera-wireless" size={14} color={col} />
                  <Text style={[S.discoveredBrand, { color: col }]}>{cam.brand}</Text>
                  <Text style={[S.discoveredModel, { color: C.dim }]}>{cam.model}</Text>
                  <Text style={[S.discoveredIp, { color: C.mute }]}>{cam.ip}</Text>
                  {assigned ? (
                    <View style={[S.assignedPill, { backgroundColor: col+"22", borderColor: col+"55" }]}>
                      <Text style={[S.assignedPillText, { color: col }]}>{assigned}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}

        {/* ── Pipeline chips ──────────────────────────────────────────────── */}
        <View style={S.pipeRow}>
          <PipelineChip label={cam1 ? `CAM1 · ${cam1.brand}` : "CAM1 · Waiting"}  color={cam1Color} fps={cam1 ? 5 : 0} />
          <PipelineChip label={cam2 ? `CAM2 · ${cam2.brand}` : "CAM2 · Waiting"}  color={cam2Color} fps={cam2 ? 4 : 0} />
        </View>

        {/* ── Split-screen cameras ─────────────────────────────────────── */}
        <View style={[S.splitScreen, { borderColor: C.border }]}>
          {/* CAM1 */}
          <View>
            {cam1
              ? <LiveCamFeed cam={cam1} tick={tick} slot={1} label={cam1.brand.toUpperCase()} />
              : <WaterSimFeed tick={tick} slot={1} />
            }
            {/* Enlarge button */}
            <TouchableOpacity onPress={() => setExpandedSlot(1)} style={S.enlargeBtn} activeOpacity={0.8}>
              <MaterialCommunityIcons name="fullscreen" size={16} color={cam1Color} />
            </TouchableOpacity>
            {/* PTZ flash */}
            {ptzLog && (
              <View style={S.ptzFlash}>
                <Text style={S.ptzFlashText}>{ptzLog}</Text>
              </View>
            )}
          </View>

          <View style={[S.splitDivider, { backgroundColor: C.border }]} />

          {/* CAM2 */}
          <View>
            {cam2
              ? <LiveCamFeed cam={cam2} tick={tick} slot={2} label={cam2.brand.toUpperCase()} />
              : <WaterSimFeed tick={tick} slot={2} />
            }
            {/* Enlarge button */}
            <TouchableOpacity onPress={() => setExpandedSlot(2)} style={S.enlargeBtn} activeOpacity={0.8}>
              <MaterialCommunityIcons name="fullscreen" size={16} color={cam2Color} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Controls row ────────────────────────────────────────────── */}
        <View style={S.controlsRow}>
          {/* PTZ pad (controls CAM1) */}
          <View style={[S.ptzPad, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[S.ptzPadLabel, { color: C.mute }]}>PTZ · CAM1</Text>
            <View style={S.ptzGrid}>
              <PtzBtn icon="↑" cmd="up"    onCmd={handlePTZ} />
            </View>
            <View style={S.ptzRow}>
              <PtzBtn icon="←" cmd="left"  onCmd={handlePTZ} />
              <TouchableOpacity onPress={() => handlePTZ("stop")} style={S.ptzStop}>
                <Text style={{ color: C.red, fontSize: 16 }}>■</Text>
              </TouchableOpacity>
              <PtzBtn icon="→" cmd="right" onCmd={handlePTZ} />
            </View>
            <View style={S.ptzGrid}>
              <PtzBtn icon="↓" cmd="down"  onCmd={handlePTZ} />
            </View>
            <View style={S.ptzZoomRow}>
              <TouchableOpacity onPress={() => handlePTZ("zoomin")}  style={S.ptzZoom}>
                <Text style={[S.ptzZoomText, { color: C.sl }]}>Z+</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handlePTZ("zoomout")} style={S.ptzZoom}>
                <Text style={[S.ptzZoomText, { color: C.sl }]}>Z−</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* CAM2 info */}
          <View style={[S.sonarStats, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[S.sonarStatsTitle, { color: C.mute }]}>CAM2 · READINGS</Text>
            {[
              { label:"Water Depth",   value:`${depthM}m`,           color:C.blue  },
              { label:"Fish Arches",   value:`${fishCount} detected`, color:C.green },
              { label:"Echo Strength", value:archStrength,            color:archColor},
              { label:"Freq / Range",  value:"200kHz / 12m",          color:C.mute  },
            ].map(r => (
              <View key={r.label} style={[S.sonarRow, { borderBottomColor: C.border }]}>
                <Text style={[S.sonarRowLabel, { color: C.mute }]}>{r.label}</Text>
                <Text style={[S.sonarRowValue, { color: r.color }]}>{r.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── AI Brain Analyser ───────────────────────────────────────── */}
        <View style={[S.analyserCard, { backgroundColor: C.card, borderColor: C.teal+"44" }]}>
          <View style={S.analyserHeader}>
            <View style={S.analyserHeaderLeft}>
              <Text style={{ fontSize:18 }}>🧠</Text>
              <View>
                <Text style={[S.analyserTitle, { color: C.teal }]}>AI BRAIN ANALYSER</Text>
                <Text style={[S.analyserSubtitle, { color: C.mute }]}>
                  GPT-4.1 Vision · CAM1 {cam1 ? `(${cam1.brand})` : "(sim)"} + CAM2 {cam2 ? `(${cam2.brand})` : "(sim)"} · frame #{tick}
                </Text>
              </View>
            </View>
            <View style={S.analyserBadgeRow}>
              <View style={[S.srcBadge, { backgroundColor: cam1Color+"22" }]}>
                <Text style={[S.srcBadgeText, { color: cam1Color }]}>CAM1</Text>
              </View>
              <Text style={{ color: C.mute, fontSize: 10 }}>+</Text>
              <View style={[S.srcBadge, { backgroundColor: cam2Color+"22" }]}>
                <Text style={[S.srcBadgeText, { color: cam2Color }]}>CAM2</Text>
              </View>
            </View>
          </View>

          <AnalyserRow icon="🐟" label="Fish Presence"  value={`${fishCount} school(s) · ${archStrength}`} color={archColor}    source="CAM2 + CAM1 surface" />
          <AnalyserRow icon="⚠️" label="Croc Risk"       value={croc}                                       color={crocColor}    source="CAM1 vision · thermal" />
          <AnalyserRow icon="🎣" label="Best Cast Zone"  value={castZone}                                   color={C.gold}       source="Fusion: sonar → surface" />
          <AnalyserRow icon="📏" label="Water Depth"     value={`${depthM}m · soft bottom`}                 color={C.blue}       source="CAM2 depth scale" />
          <AnalyserRow icon="🌊" label="Water Clarity"   value={clarity}                                    color={clarityColor} source="CAM1 colour analysis" />

          <View style={S.actionRow}>
            <TouchableOpacity onPress={() => { if (Platform.OS!=="web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); router.navigate("/"); }}
              activeOpacity={0.8}
              style={[S.actionBtn, { backgroundColor: C.teal+"22", borderColor: C.teal+"88" }]}>
              <Text style={[S.actionBtnText, { color: C.teal }]}>📸  SNAPSHOT BOTH</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { if (Platform.OS!=="web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); router.navigate("/"); }}
              activeOpacity={0.8}
              style={[S.actionBtn, { backgroundColor: C.gold+"22", borderColor: C.gold+"88" }]}>
              <Text style={[S.actionBtnText, { color: C.gold }]}>🧠  DEEP SCAN</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root:          { flex: 1 },
  scroll:        { paddingHorizontal: 14, gap: 10 },

  // Header
  headerRow:     { flexDirection:"row", alignItems:"center", justifyContent:"space-between" },
  headerLeft:    { flexDirection:"row", alignItems:"center", gap:8, flex:1 },
  headerIcon:    { width:30, height:30, borderRadius:7, backgroundColor:"#00ffcc22", borderWidth:1.5, borderColor:"#00ffcc55", alignItems:"center", justifyContent:"center" },
  headerTitle:   { fontSize:13, fontFamily:"Inter_700Bold", letterSpacing:0.4 },
  headerSub:     { fontSize:10, fontFamily:"Inter_400Regular" },
  liveBadge:     { flexDirection:"row", alignItems:"center", gap:4, backgroundColor:"#ff440022", borderWidth:1, borderColor:"#ff440055", borderRadius:6, paddingHorizontal:8, paddingVertical:3 },
  liveDot:       { width:6, height:6, borderRadius:3, backgroundColor:C.red },
  liveText:      { color:C.red, fontFamily:"Inter_700Bold", fontSize:10 },

  // Connect Now button
  connectBtn:    { flexDirection:"row", alignItems:"center", borderRadius:12, borderWidth:1.5, paddingHorizontal:14, paddingVertical:12 },
  connectBtnTitle: { fontFamily:"Inter_700Bold", fontSize:13, letterSpacing:0.3 },
  connectBtnSub: { fontFamily:"Inter_400Regular", fontSize:10, color:"rgba(255,255,255,0.35)", marginTop:1 },

  // Discovered list
  discoveredCard:  { borderRadius:10, borderWidth:1, paddingVertical:8, paddingHorizontal:10, gap:6, backgroundColor:"rgba(255,255,255,0.03)" },
  discoveredTitle: { fontSize:9, fontFamily:"Inter_700Bold", letterSpacing:0.8, marginBottom:2 },
  discoveredRow:   { flexDirection:"row", alignItems:"center", gap:7 },
  discoveredBrand: { fontFamily:"Inter_700Bold", fontSize:10 },
  discoveredModel: { fontFamily:"Inter_400Regular", fontSize:10, flex:1 },
  discoveredIp:    { fontFamily:"Inter_400Regular", fontSize:9 },
  assignedPill:    { borderRadius:20, paddingHorizontal:6, paddingVertical:1, borderWidth:1 },
  assignedPillText: { fontFamily:"Inter_700Bold", fontSize:8 },

  // Pipeline chips
  pipeRow:       { flexDirection:"row", gap:8 },
  pipeChip:      { flex:1, flexDirection:"row", alignItems:"center", gap:6, borderRadius:7, paddingHorizontal:9, paddingVertical:5, borderWidth:1 },
  pipeChipDot:   { width:7, height:7, borderRadius:3.5 },
  pipeChipLabel: { fontSize:10, fontFamily:"Inter_700Bold" },
  pipeChipSub:   { fontSize:9, fontFamily:"Inter_400Regular", color:C.mute },

  // Split screen
  splitScreen:   { flexDirection:"row", borderRadius:10, overflow:"hidden", borderWidth:1.5, height: CAM_H },
  splitDivider:  { width:2, flexShrink:0 },

  // Cam overlays
  camLabel:      { position:"absolute", top:5, left:5, flexDirection:"row", gap:4 },
  camBadge:      { backgroundColor:"rgba(0,0,0,0.75)", borderRadius:3, paddingHorizontal:5, paddingVertical:2, fontSize:9, fontFamily:"Inter_700Bold" },
  camScene:      { backgroundColor:"rgba(0,0,0,0.75)", borderRadius:3, paddingHorizontal:5, paddingVertical:2, fontSize:9, fontFamily:"Inter_400Regular", color:"rgba(255,255,255,0.55)" },
  camStamp:      { position:"absolute", bottom:4, left:5, backgroundColor:"rgba(0,0,0,0.7)", borderRadius:3, paddingHorizontal:5, paddingVertical:1, fontSize:9, fontFamily:"Inter_400Regular", color:C.sl },
  ptzFlash:      { position:"absolute", top:5, left:"15%", right:"15%", backgroundColor:"rgba(0,0,0,0.85)", borderRadius:6, paddingHorizontal:8, paddingVertical:3, alignItems:"center", borderWidth:1, borderColor:"#00ffcc66" },
  ptzFlashText:  { color:C.sl, fontFamily:"Inter_700Bold", fontSize:10 },

  // Enlarge button (bottom-right of each cam)
  enlargeBtn:    { position:"absolute", bottom:5, right:5, width:28, height:28, borderRadius:7, backgroundColor:"rgba(0,0,0,0.75)", alignItems:"center", justifyContent:"center", borderWidth:1, borderColor:"rgba(255,255,255,0.15)" },

  // Modal
  modalBar:      { flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingHorizontal:16, paddingTop:48, paddingBottom:12, borderBottomWidth:1, borderBottomColor:"#111" },
  modalTitle:    { fontFamily:"Inter_700Bold", fontSize:14, flex:1 },
  modalClose:    { padding:6 },
  modalInfo:     { paddingHorizontal:16, paddingBottom:24, paddingTop:8 },
  modalInfoText: { fontFamily:"Inter_400Regular", fontSize:11 },

  // Controls row
  controlsRow:   { flexDirection:"row", gap:8, alignItems:"flex-start" },

  // PTZ pad
  ptzPad:        { borderRadius:10, padding:10, borderWidth:1, alignItems:"center", gap:3, flexShrink:0 },
  ptzPadLabel:   { fontSize:9, fontFamily:"Inter_700Bold", letterSpacing:0.8, marginBottom:4 },
  ptzGrid:       { alignItems:"center" },
  ptzRow:        { flexDirection:"row", alignItems:"center", gap:3 },
  ptzBtn:        { width:38, height:38, borderRadius:19, backgroundColor:"#00ffcc18", borderWidth:1.5, borderColor:"#00ffcc55", alignItems:"center", justifyContent:"center" },
  ptzBtnActive:  { backgroundColor:"#00ffcc44", borderColor:C.sl },
  ptzBtnText:    { fontSize:18, fontFamily:"Inter_700Bold" },
  ptzStop:       { width:38, height:38, borderRadius:19, backgroundColor:"#ff440022", borderWidth:1.5, borderColor:"#ff440066", alignItems:"center", justifyContent:"center" },
  ptzZoomRow:    { flexDirection:"row", gap:3, marginTop:2 },
  ptzZoom:       { width:44, height:24, borderRadius:5, backgroundColor:"#00ffcc18", borderWidth:1, borderColor:"#00ffcc44", alignItems:"center", justifyContent:"center" },
  ptzZoomText:   { fontFamily:"Inter_700Bold", fontSize:11 },

  // CAM2 stats
  sonarStats:    { flex:1, borderRadius:10, padding:12, borderWidth:1 },
  sonarStatsTitle: { fontSize:9, fontFamily:"Inter_700Bold", letterSpacing:0.8, marginBottom:7 },
  sonarRow:      { flexDirection:"row", justifyContent:"space-between", paddingVertical:4, borderBottomWidth:1 },
  sonarRowLabel: { fontSize:10, fontFamily:"Inter_400Regular" },
  sonarRowValue: { fontSize:10, fontFamily:"Inter_700Bold" },

  // AI Analyser
  analyserCard:  { borderRadius:12, padding:14, borderWidth:1.5, gap:0 },
  analyserHeader: { flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:10 },
  analyserHeaderLeft: { flexDirection:"row", alignItems:"center", gap:7, flex:1 },
  analyserTitle: { fontSize:13, fontFamily:"Inter_700Bold" },
  analyserSubtitle: { fontSize:9, fontFamily:"Inter_400Regular" },
  analyserBadgeRow: { flexDirection:"row", alignItems:"center", gap:4 },
  srcBadge:      { borderRadius:4, paddingHorizontal:6, paddingVertical:2 },
  srcBadgeText:  { fontSize:9, fontFamily:"Inter_700Bold" },
  analyserRow:   { flexDirection:"row", alignItems:"center", gap:8, paddingVertical:6, borderBottomWidth:1, borderBottomColor:"#1a2f4a" },
  analyserIcon:  { fontSize:14 },
  analyserLabel: { color:"rgba(255,255,255,0.67)", fontSize:11, fontFamily:"Inter_700Bold" },
  analyserSource: { color:"rgba(255,255,255,0.27)", fontSize:9, fontFamily:"Inter_400Regular" },
  analyserValue: { fontFamily:"Inter_700Bold", fontSize:11, textAlign:"right" },
  actionRow:     { flexDirection:"row", gap:8, marginTop:10 },
  actionBtn:     { flex:1, height:40, borderRadius:8, borderWidth:1.5, alignItems:"center", justifyContent:"center" },
  actionBtnText: { fontFamily:"Inter_700Bold", fontSize:11 },
});
