import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, Animated, Platform,
} from "react-native";
import Svg, {
  Path, Rect, Ellipse, Circle, G, Defs, Filter,
  FeGaussianBlur, FeMerge, FeMergeNode,
  LinearGradient as SvgLG, RadialGradient as SvgRG, Stop,
} from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

import { HVHeader } from "@/components/HVHeader";
import { useColors } from "@/hooks/useColors";
import { LiveScanStore } from "@/stores/LiveScanStore";

const { width: SW } = Dimensions.get("window");
const CAM_W = (SW - 30 - 4) / 2;   // half of available width
const CAM_H = CAM_W * 0.65;        // ~16:10 aspect

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

// ─── CAM1 — SmartLife water feed (SVG scene) ─────────────────────────────────
function Cam1Feed({ tick, ptzLog }: { tick: number; ptzLog: string | null }) {
  const scene = tick % 4;
  type Scene = { skyA: string; skyB: string; waterA: string; waterB: string; label: string; night: boolean };
  const scenes: Scene[] = [
    { skyA: "#1a2a3a", skyB: "#3d5a6e", waterA: "#1e3a4a", waterB: "#061520", label: "ESTUARY · MANGROVE", night: false },
    { skyA: "#0d1f3a", skyB: "#24547a", waterA: "#1a3a5c", waterB: "#061929", label: "RIVER MOUTH · OPEN",  night: false },
    { skyA: "#050e18", skyB: "#0a1a22", waterA: "#0a1a22", waterB: "#050e18", label: "IR NIGHT · BILLABONG", night: true },
    { skyA: "#3a1a0a", skyB: "#4a2a10", waterA: "#2a1a0a", waterB: "#0a0803", label: "TIDAL CREEK · SUNSET", night: false },
  ];
  const s = scenes[scene];
  const fishX = (28 + (tick * 6) % 38) / 100;
  const fishColor = s.night ? C.green : C.gold;
  const birdColor = scene === 3 ? "#330000" : s.night ? C.green : "#1a1a2a";

  return (
    <View style={{ width: CAM_W, height: CAM_H, overflow: "hidden", backgroundColor: "#000" }}>
      <Svg width={CAM_W} height={CAM_H} viewBox={`0 0 300 100`} preserveAspectRatio="xMidYMid slice">
        <Defs>
          <SvgLG id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={s.skyA} />
            <Stop offset="1" stopColor={s.skyB} />
          </SvgLG>
          <SvgLG id="water" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={s.waterA} />
            <Stop offset="1" stopColor={s.waterB} />
          </SvgLG>
        </Defs>
        {/* Sky */}
        <Rect x="0" y="0" width="300" height="50" fill="url(#sky)" />
        {/* Water */}
        <Rect x="0" y="45" width="300" height="60" fill="url(#water)" />
        {/* Horizon glow */}
        <Rect x="0" y="43" width="300" height="5" fill={s.night ? "rgba(0,255,100,0.06)" : "rgba(255,200,100,0.09)"} />
        {/* Mangrove silhouettes */}
        <Path d="M0,55 L0,38 Q8,24 18,38 Q22,16 32,35 Q38,20 48,36 L48,55Z" fill={s.night ? "#030a10" : "#0d1f2a"} opacity="0.65" />
        <Path d="M252,55 L252,40 Q260,24 268,38 Q274,18 284,36 Q290,25 300,37 L300,55Z" fill={s.night ? "#030a10" : "#0d1f2a"} opacity="0.65" />
        {/* Water ripples */}
        <Path d={`M${-30+(tick*5)%50},80 Q60,72 140,80 Q220,88 310,80`}
          fill="none" stroke={s.night ? "#00ff4433" : "#00d4aa33"} strokeWidth="1.2" />
        <Path d={`M${(tick*4)%50},88 Q80,80 160,88 Q240,96 310,88`}
          fill="none" stroke={s.night ? "#00ff4433" : "#00d4aa22"} strokeWidth="1" />
        {/* Fish dots */}
        {[0,1,2,3].map(i => (
          <Ellipse key={i} cx={fishX*300 + i*4} cy={75 + (i%2)} rx={1.5+(i%2)*0.5} ry={1}
            fill={fishColor} opacity="0.65" />
        ))}
        {/* Birds */}
        {!s.night && [0,1,2].map(i => {
          const bx = ((tick * 3.5 + i * 55) % 340) - 20;
          const by = 12 + i * 5;
          const sz = 10 - i * 1.5;
          return (
            <G key={`b${i}`} transform={`translate(${bx},${by})`} opacity={0.85 - i * 0.15}>
              <Path d={`M0,${sz*0.4} Q${sz*0.5},0 ${sz},${sz*0.4} Q${sz*1.5},0 ${sz*2},${sz*0.4}`}
                fill="none" stroke={birdColor} strokeWidth={sz > 8 ? 1.8 : 1.3} strokeLinecap="round" />
            </G>
          );
        })}
        {s.night && [0,1,2].map(i => {
          const bx = ((tick * 4 + i * 80) % 340) - 20;
          const by = 15 + i * 12;
          return (
            <G key={`ib${i}`} transform={`translate(${bx},${by})`} opacity="0.9">
              <Path d={`M0,4 Q5,0 10,4 Q15,0 20,4`}
                fill="none" stroke={C.green} strokeWidth="1.4" strokeLinecap="round" />
              <Ellipse cx={10} cy={3.5} rx={2} ry={1.2} fill={C.green} opacity="0.7" />
            </G>
          );
        })}
        {/* IR overlay tint */}
        {s.night && <Rect x="0" y="0" width="300" height="100" fill="rgba(0,70,35,0.16)" />}
        {/* Scan lines */}
        {Array.from({ length: 12 }).map((_, i) => (
          <Rect key={i} x="0" y={i * 8.5} width="300" height="0.5" fill="rgba(0,0,0,0.15)" />
        ))}
      </Svg>
      {/* CAM1 label */}
      <View style={S.camLabel}>
        <Text style={[S.camBadge, { color: s.night ? C.green : C.sl }]}>{s.night ? "●IR " : "●"}CAM1</Text>
        <Text style={S.camScene}>{s.label}</Text>
      </View>
      {/* IP stamp */}
      <Text style={S.camStamp}>192.168.4.1/snapshot.cgi?t={tick}</Text>
      {/* PTZ flash */}
      {ptzLog && (
        <View style={S.ptzFlash}>
          <Text style={S.ptzFlashText}>{ptzLog}</Text>
        </View>
      )}
    </View>
  );
}

// ─── CAM2 — Sonar display (SVG) ──────────────────────────────────────────────
function SonarFeed({ tick }: { tick: number }) {
  const depth = 8.4 + Math.sin(tick * 0.3) * 0.6;
  const fishArches = [
    { y: 0.38 + Math.sin(tick * 0.15) * 0.04, x: 0.3 + Math.cos(tick * 0.1) * 0.05, s: "strong" },
    { y: 0.55 + Math.sin(tick * 0.2 + 1) * 0.03, x: 0.6 + Math.sin(tick * 0.12) * 0.06, s: "medium" },
    { y: 0.72 + Math.cos(tick * 0.18) * 0.03, x: 0.45, s: "weak" },
  ];
  const sc = (s: string) => s === "strong" ? "#ff6600" : s === "medium" ? "#ffcc00" : "#00cc44";
  const sw = (s: string) => s === "strong" ? 2.5 : s === "medium" ? 1.8 : 1.2;

  const btY = (t: number, phase: number, amp: number, base: number) =>
    base + Math.sin(tick * t + phase) * amp;

  return (
    <View style={{ width: CAM_W, height: CAM_H, overflow: "hidden", backgroundColor: "#000" }}>
      <Svg width={CAM_W} height={CAM_H} viewBox="0 0 300 100" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <SvgLG id="sonarBg" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0"   stopColor="#000" />
            <Stop offset="0.2" stopColor="#021008" />
            <Stop offset="0.5" stopColor="#031510" />
            <Stop offset="1"   stopColor="#000" />
          </SvgLG>
          <SvgLG id="depth" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0"   stopColor="rgba(0,40,20,0.3)" />
            <Stop offset="0.3" stopColor="rgba(0,80,30,0.4)" />
            <Stop offset="0.55" stopColor="rgba(30,80,0,0.5)" />
            <Stop offset="0.72" stopColor="rgba(80,60,0,0.6)" />
            <Stop offset="0.85" stopColor="rgba(100,40,0,0.7)" />
            <Stop offset="1"   stopColor="rgba(60,20,0,0.8)" />
          </SvgLG>
        </Defs>
        {/* Background */}
        <Rect x="0" y="0" width="300" height="100" fill="url(#sonarBg)" />
        <Rect x="0" y="0" width="300" height="100" fill="url(#depth)" />
        {/* Bottom contour */}
        <Path d={`M0,100 L0,${btY(0.2,0,4,72)} Q40,${btY(0.15,0,3,68)} 80,${btY(0.25,0,5,75)} Q120,${btY(0.18,0,3,70)} 160,${btY(0.12,0,4,76)} Q200,${btY(0.22,0,3,72)} 240,${btY(0.16,0,4,74)} Q270,${btY(0.2,0,2,70)} 300,${btY(0.14,0,3,73)} L300,100Z`}
          fill="#8B4513" opacity="0.9" />
        <Path d={`M0,100 L0,${btY(0.2,0,4,80)} Q80,${btY(0.25,0,3,83)} 160,${btY(0.12,0,3,85)} Q240,${btY(0.16,0,2,82)} 300,${btY(0.14,0,2,81)} L300,100Z`}
          fill="#5a2d00" opacity="0.95" />
        {/* Surface line */}
        <Rect x="0" y="4" width="300" height="2" fill={C.green} opacity="0.5" />
        {/* Fish arches */}
        {fishArches.map((f, i) => {
          const ax = f.x * 300 - 18;
          const ay = f.y * 100 - 4;
          return (
            <Path key={i} d={`M${ax},${ay+10} Q${ax+10},${ay} ${ax+20},${ay+4} Q${ax+30},${ay} ${ax+40},${ay+10}`}
              fill="none" stroke={sc(f.s)} strokeWidth={sw(f.s)} opacity="0.9" />
          );
        })}
        {/* Depth ruler */}
        {[0,2,4,6,8,10].map((d, i) => (
          <Text key={d} style={{ position: "absolute" }}>
            {/* handled below */}
          </Text>
        ))}
        {/* Scan lines */}
        {Array.from({ length: 10 }).map((_, i) => (
          <Rect key={i} x="0" y={i * 11} width="300" height="0.6" fill="rgba(0,0,0,0.2)" />
        ))}
      </Svg>
      {/* Depth ruler overlay */}
      <View style={S.depthRuler}>
        {[0,2,4,6,8,10].map(d => (
          <Text key={d} style={S.depthMark}>{d}m</Text>
        ))}
      </View>
      {/* CAM2 label */}
      <View style={S.camLabel}>
        <Text style={[S.camBadge, { color: C.blue }]}>●CAM2</Text>
        <Text style={S.camScene}>SONAR DISPLAY</Text>
      </View>
      {/* Stats stamp */}
      <View style={S.sonarBottom}>
        <Text style={[S.camStamp, { position: "relative" }]}>DEPTH {depth.toFixed(1)}m</Text>
        <Text style={[S.camStamp, { position: "relative", color: C.green }]}>200kHz</Text>
      </View>
    </View>
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
    <View style={[S.pipeChip, { backgroundColor: color + "14", borderColor: color + "44" }]}>
      <Animated.View style={[S.pipeChipDot, { backgroundColor: color, opacity: pulse }]} />
      <View style={{ flex: 1 }}>
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
function AnalyserRow({ icon, label, value, color, source }: { icon: string; label: string; value: string; color: string; source: string }) {
  return (
    <View style={S.analyserRow}>
      <Text style={S.analyserIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={S.analyserLabel}>{label}</Text>
        <Text style={S.analyserSource}>from {source}</Text>
      </View>
      <Text style={[S.analyserValue, { color }]}>{value}</Text>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function SmartLifeScreen() {
  const insets  = useSafeAreaInsets();
  const colors  = useColors();
  const router  = useRouter();
  const [tick,   setTick]   = useState(0);
  const [ptzLog, setPtzLog] = useState<string | null>(null);
  const ptzTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const botPad = Platform.OS === "web" ? 80 : insets.bottom + 20;

  // Tick every 2s — drives both simulated feeds + AI results
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 2000);
    return () => clearInterval(t);
  }, []);

  // PTZ command handler — in production would POST to camera ONVIF endpoint
  const handlePTZ = useCallback((cmd: string) => {
    setPtzLog(`PTZ → ${cmd.toUpperCase()}`);
    if (ptzTimer.current) clearTimeout(ptzTimer.current);
    ptzTimer.current = setTimeout(() => setPtzLog(null), 1200);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Derived AI analyser values that shift with tick
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

  const handleSnapshot = useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.navigate("/");
  }, []);

  const handleDeepScan = useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.navigate("/");
  }, []);

  return (
    <View style={[S.root, { backgroundColor: C.bg }]}>
      <ScrollView
        contentContainerStyle={[S.scroll, { paddingTop: topPad + 8, paddingBottom: botPad }]}
        showsVerticalScrollIndicator={false}
      >
        <HVHeader subtitle="Dual-Cam AI Analyser" />

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={S.headerRow}>
          <View style={S.headerLeft}>
            <View style={S.headerIcon}>
              <Text style={{ fontSize: 16 }}>📡</Text>
            </View>
            <View>
              <Text style={[S.headerTitle, { color: C.sl }]}>DUAL-CAM FEED → AI ANALYSER</Text>
              <Text style={[S.headerSub, { color: C.mute }]}>SmartLife PTZ + Sonar Monitor · 2 pipelines</Text>
            </View>
          </View>
          <View style={S.liveBadge}>
            <Animated.View style={[S.liveDot, { opacity: livePulse }]} />
            <Text style={S.liveText}>LIVE</Text>
          </View>
        </View>

        {/* ── Pipeline chips ──────────────────────────────────────────────── */}
        <View style={S.pipeRow}>
          <PipelineChip label="CAM1 · SmartLife PTZ" color={C.sl}   fps={6} />
          <PipelineChip label="CAM2 · Sonar Screen"  color={C.blue} fps={4} />
        </View>

        {/* ── Split-screen cameras ─────────────────────────────────────── */}
        <View style={[S.splitScreen, { borderColor: C.border }]}>
          <Cam1Feed tick={tick} ptzLog={ptzLog} />
          <View style={[S.splitDivider, { backgroundColor: C.border }]} />
          <SonarFeed tick={tick} />
        </View>

        {/* ── Controls row: PTZ + Sonar stats ────────────────────────── */}
        <View style={S.controlsRow}>
          {/* PTZ pad */}
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

          {/* Sonar quick stats */}
          <View style={[S.sonarStats, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[S.sonarStatsTitle, { color: C.mute }]}>CAM2 · SONAR READINGS</Text>
            {[
              { label: "Water Depth",   value: `${depthM}m`,             color: C.blue },
              { label: "Fish Arches",   value: `${fishCount} detected`,   color: C.green },
              { label: "Echo Strength", value: archStrength,              color: archColor },
              { label: "Freq / Range",  value: "200kHz / 12m",            color: C.mute },
            ].map(r => (
              <View key={r.label} style={[S.sonarRow, { borderBottomColor: C.border }]}>
                <Text style={[S.sonarRowLabel, { color: C.mute }]}>{r.label}</Text>
                <Text style={[S.sonarRowValue, { color: r.color }]}>{r.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── AI Brain Analyser ───────────────────────────────────────── */}
        <View style={[S.analyserCard, { backgroundColor: C.card, borderColor: C.teal + "44" }]}>
          {/* Header */}
          <View style={S.analyserHeader}>
            <View style={S.analyserHeaderLeft}>
              <Text style={{ fontSize: 18 }}>🧠</Text>
              <View>
                <Text style={[S.analyserTitle, { color: C.teal }]}>AI BRAIN ANALYSER</Text>
                <Text style={[S.analyserSubtitle, { color: C.mute }]}>GPT-4.1 Vision · fusing CAM1 + CAM2 · frame #{tick}</Text>
              </View>
            </View>
            <View style={S.analyserBadgeRow}>
              <View style={[S.srcBadge, { backgroundColor: C.sl + "22" }]}>
                <Text style={[S.srcBadgeText, { color: C.sl }]}>CAM1</Text>
              </View>
              <Text style={{ color: C.mute, fontSize: 10 }}>+</Text>
              <View style={[S.srcBadge, { backgroundColor: C.blue + "22" }]}>
                <Text style={[S.srcBadgeText, { color: C.blue }]}>CAM2</Text>
              </View>
            </View>
          </View>

          {/* Fusion pipeline flow */}
          <View style={[S.fusionRow, { backgroundColor: C.bg, borderColor: C.border }]}>
            <View style={[S.fusionNode, { backgroundColor: C.sl + "22" }]}>
              <Text style={[S.fusionNodeText, { color: C.sl }]}>CAM1{"\n"}Water</Text>
            </View>
            <Text style={[S.fusionArrow, { color: C.mute }]}>→</Text>
            <View style={[S.fusionNode, { backgroundColor: C.border }]}>
              <Text style={[S.fusionNodeText, { color: C.dim }]}>Vision{"\n"}Model</Text>
            </View>
            <Text style={[S.fusionArrow, { color: C.mute }]}>↘</Text>
            <View style={[S.fusionCenter, { backgroundColor: C.teal + "22", borderColor: C.teal + "44" }]}>
              <Text style={[S.fusionCenterTitle, { color: C.teal }]}>FUSION LAYER</Text>
              <Text style={[S.fusionCenterSub, { color: C.mute }]}>GPT-4.1 · cross-stream</Text>
            </View>
            <Text style={[S.fusionArrow, { color: C.mute }]}>→</Text>
            <View style={[S.fusionNode, { backgroundColor: C.gold + "22" }]}>
              <Text style={[S.fusionNodeText, { color: C.gold }]}>RESULT{"\n"}Intel</Text>
            </View>
            <Text style={[S.fusionArrow, { color: C.mute }]}>↗</Text>
            <View style={[S.fusionNode, { backgroundColor: C.border }]}>
              <Text style={[S.fusionNodeText, { color: C.dim }]}>Sonar{"\n"}OCR</Text>
            </View>
            <Text style={[S.fusionArrow, { color: C.mute }]}>←</Text>
            <View style={[S.fusionNode, { backgroundColor: C.blue + "22" }]}>
              <Text style={[S.fusionNodeText, { color: C.blue }]}>CAM2{"\n"}Sonar</Text>
            </View>
          </View>

          {/* Analysis results */}
          <AnalyserRow icon="🐟" label="Fish Presence"  value={`${fishCount} school(s) · ${archStrength}`} color={archColor}    source="CAM2 sonar + CAM1 surface bust" />
          <AnalyserRow icon="⚠️" label="Croc Risk"       value={croc}                                       color={crocColor}    source="CAM1 vision · thermal edge detect" />
          <AnalyserRow icon="🎣" label="Best Cast Zone"  value={castZone}                                   color={C.gold}       source="Fusion: sonar arch → surface feed" />
          <AnalyserRow icon="📏" label="Water Depth"     value={`${depthM}m · soft bottom`}                 color={C.blue}       source="CAM2 sonar depth scale OCR" />
          <AnalyserRow icon="🌊" label="Water Clarity"   value={clarity}                                    color={clarityColor} source="CAM1 vision · colour analysis" />

          {/* Action buttons */}
          <View style={S.actionRow}>
            <TouchableOpacity onPress={handleSnapshot} activeOpacity={0.8}
              style={[S.actionBtn, { backgroundColor: C.teal + "22", borderColor: C.teal + "88" }]}>
              <Text style={[S.actionBtnText, { color: C.teal }]}>📸  SNAPSHOT BOTH</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDeepScan} activeOpacity={0.8}
              style={[S.actionBtn, { backgroundColor: C.gold + "22", borderColor: C.gold + "88" }]}>
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
  headerRow:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerLeft:    { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  headerIcon:    { width: 30, height: 30, borderRadius: 7, backgroundColor: "#00ffcc22", borderWidth: 1.5, borderColor: "#00ffcc55", alignItems: "center", justifyContent: "center" },
  headerTitle:   { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 0.4 },
  headerSub:     { fontSize: 10, fontFamily: "Inter_400Regular" },
  liveBadge:     { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#ff440022", borderWidth: 1, borderColor: "#ff440055", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  liveDot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: C.red },
  liveText:      { color: C.red, fontFamily: "Inter_700Bold", fontSize: 10 },

  // Pipeline chips
  pipeRow:       { flexDirection: "row", gap: 8 },
  pipeChip:      { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1 },
  pipeChipDot:   { width: 7, height: 7, borderRadius: 3.5 },
  pipeChipLabel: { fontSize: 10, fontFamily: "Inter_700Bold" },
  pipeChipSub:   { fontSize: 9, fontFamily: "Inter_400Regular", color: C.mute },

  // Split screen
  splitScreen:   { flexDirection: "row", borderRadius: 10, overflow: "hidden", borderWidth: 1.5, height: CAM_H },
  splitDivider:  { width: 2, flexShrink: 0 },

  // Cam overlays
  camLabel:      { position: "absolute", top: 5, left: 5, flexDirection: "row", gap: 4 },
  camBadge:      { backgroundColor: "rgba(0,0,0,0.75)", borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2, fontSize: 9, fontFamily: "Inter_700Bold" },
  camScene:      { backgroundColor: "rgba(0,0,0,0.75)", borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2, fontSize: 9, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)" },
  camStamp:      { position: "absolute", bottom: 4, left: 5, backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 3, paddingHorizontal: 5, paddingVertical: 1, fontSize: 9, fontFamily: "Inter_400Regular", color: C.sl },
  ptzFlash:      { position: "absolute", top: 5, left: "15%", right: "15%", backgroundColor: "rgba(0,0,0,0.85)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignItems: "center", borderWidth: 1, borderColor: "#00ffcc66" },
  ptzFlashText:  { color: C.sl, fontFamily: "Inter_700Bold", fontSize: 10 },

  // Sonar overlays
  depthRuler:    { position: "absolute", right: 4, top: "8%", bottom: "8%", justifyContent: "space-between" },
  depthMark:     { color: "rgba(255,255,255,0.55)", fontSize: 8, fontFamily: "Inter_400Regular", textAlign: "right" },
  sonarBottom:   { position: "absolute", bottom: 4, left: 5, right: 12, flexDirection: "row", justifyContent: "space-between" },

  // Controls row
  controlsRow:   { flexDirection: "row", gap: 8, alignItems: "flex-start" },

  // PTZ pad
  ptzPad:        { borderRadius: 10, padding: 10, borderWidth: 1, alignItems: "center", gap: 3, flexShrink: 0 },
  ptzPadLabel:   { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.8, marginBottom: 4 },
  ptzGrid:       { alignItems: "center" },
  ptzRow:        { flexDirection: "row", alignItems: "center", gap: 3 },
  ptzBtn:        { width: 38, height: 38, borderRadius: 19, backgroundColor: "#00ffcc18", borderWidth: 1.5, borderColor: "#00ffcc55", alignItems: "center", justifyContent: "center" },
  ptzBtnActive:  { backgroundColor: "#00ffcc44", borderColor: C.sl },
  ptzBtnText:    { fontSize: 18, fontFamily: "Inter_700Bold" },
  ptzStop:       { width: 38, height: 38, borderRadius: 19, backgroundColor: "#ff440022", borderWidth: 1.5, borderColor: "#ff440066", alignItems: "center", justifyContent: "center" },
  ptzZoomRow:    { flexDirection: "row", gap: 3, marginTop: 2 },
  ptzZoom:       { width: 44, height: 24, borderRadius: 5, backgroundColor: "#00ffcc18", borderWidth: 1, borderColor: "#00ffcc44", alignItems: "center", justifyContent: "center" },
  ptzZoomText:   { fontFamily: "Inter_700Bold", fontSize: 11 },

  // Sonar stats
  sonarStats:    { flex: 1, borderRadius: 10, padding: 12, borderWidth: 1 },
  sonarStatsTitle: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.8, marginBottom: 7, color: C.mute },
  sonarRow:      { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 1 },
  sonarRowLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  sonarRowValue: { fontSize: 10, fontFamily: "Inter_700Bold" },

  // AI Analyser
  analyserCard:  { borderRadius: 12, padding: 14, borderWidth: 1.5, gap: 0 },
  analyserHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  analyserHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 7, flex: 1 },
  analyserTitle: { fontSize: 13, fontFamily: "Inter_700Bold" },
  analyserSubtitle: { fontSize: 9, fontFamily: "Inter_400Regular" },
  analyserBadgeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  srcBadge:      { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  srcBadgeText:  { fontSize: 9, fontFamily: "Inter_700Bold" },

  // Fusion pipeline
  fusionRow:     { flexDirection: "row", alignItems: "center", gap: 3, padding: 8, borderRadius: 8, borderWidth: 1, marginBottom: 10, flexWrap: "wrap" },
  fusionNode:    { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3 },
  fusionNodeText: { fontSize: 8, fontFamily: "Inter_700Bold", textAlign: "center" },
  fusionArrow:   { fontSize: 10, fontFamily: "Inter_400Regular" },
  fusionCenter:  { flex: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1, alignItems: "center", minWidth: 80 },
  fusionCenterTitle: { fontSize: 10, fontFamily: "Inter_700Bold" },
  fusionCenterSub:   { fontSize: 8, fontFamily: "Inter_400Regular" },

  // Analyser rows
  analyserRow:   { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#1a2f4a" },
  analyserIcon:  { fontSize: 14 },
  analyserLabel: { color: "rgba(255,255,255,0.67)", fontSize: 11, fontFamily: "Inter_700Bold" },
  analyserSource: { color: "rgba(255,255,255,0.27)", fontSize: 9, fontFamily: "Inter_400Regular" },
  analyserValue: { fontFamily: "Inter_700Bold", fontSize: 11, textAlign: "right" },

  // Action buttons
  actionRow:     { flexDirection: "row", gap: 8, marginTop: 10 },
  actionBtn:     { flex: 1, height: 40, borderRadius: 8, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  actionBtnText: { fontFamily: "Inter_700Bold", fontSize: 11 },
});
