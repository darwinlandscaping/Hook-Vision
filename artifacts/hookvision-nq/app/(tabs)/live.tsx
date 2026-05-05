import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { HVHeader } from "@/components/HVHeader";
import { SonarPulse } from "@/components/SonarPulse";

interface BoatCycleResponse {
  fishCount?: number;
  depthRange?: string;
  species?: string;
  confidence?: number;
  suggestion?: string;
  lure?: string;
  lureType?: string;
  technique?: string;
  crocAlert?: boolean;
  crocWarning?: string | null;
  birdAlert?: string | null;
  barraPct?: number | null;
  targetCount?: number | null;
  targetType?: string;
  waterTemp?: string;
  bottomType?: string;
  activeZones?: unknown[];
  frameZones?: unknown[];
  movementVector?: string;
  movingZones?: unknown[];
  staticZones?: unknown[];
  movingTargetCount?: number;
  sonarType?: string;
}

interface VisionTarget {
  id: string;
  label: string;
  confidence: number;
  box: { x: number; y: number; w: number; h: number };
  note?: string;
  trackId?: string;
  velocity?: { dx: number; dy: number } | null;
}

// Retries a fetch through transient network errors (e.g. Starlink handoff dropouts).
// Uses capped linear back-off so the device waits long enough for the satellite
// connection to re-establish (typically 1–10 s) without waiting forever.
async function fetchRetry(
  url: string,
  init: Omit<RequestInit, "signal">,
  timeoutMs: number,
  retries = 4,
  baseDelayMs = 3_500,
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      lastErr = err;
      if (attempt === retries - 1) break;
      // Linear back-off capped at 10 s — matches Starlink re-establishment window
      const delay = Math.min(baseDelayMs * (attempt + 1), 10_000);
      await new Promise<void>(r => setTimeout(r, delay));
    }
  }
  throw lastErr ?? new Error("fetchRetry: all retries exhausted");
}

// Retries /api/ping up to maxAttempts times before declaring no connection.
// Starlink satellite-handoff dropouts typically last 1–10 s — this waits them
// out before failing the cycle, instead of aborting on the first missed ping.
async function waitForConnectivity(
  apiBase: string,
  maxAttempts = 5,
  intervalMs = 3_000,
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const r = await fetch(`${apiBase}/api/ping`, {
        cache: "no-store",
        signal: AbortSignal.timeout(7_000),
      });
      if (r.ok) return true;
    } catch { /* network error — likely a Starlink handoff, will retry */ }
    if (i < maxAttempts - 1) {
      await new Promise<void>(r => setTimeout(r, intervalMs));
    }
  }
  return false;
}

// Reads a streaming response body with a per-chunk watchdog timer.
// Chunk timeout raised to 18 s to survive Starlink packet-loss gaps mid-stream.
async function readStreamWithTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  totalMs: number,
  chunkMs = 18_000,
): Promise<string> {
  const dec = new TextDecoder();
  let txt = "";
  const deadline = Date.now() + totalMs;
  for (;;) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("stream total timeout");
    const to = Math.min(remaining, chunkMs);
    let chunkTimer: ReturnType<typeof setTimeout> | null = null;
    const { done, value } = await Promise.race([
      reader.read(),
      new Promise<never>((_, rej) => { chunkTimer = setTimeout(() => rej(new Error("stream chunk timeout")), to); }),
    ]);
    if (chunkTimer !== null) { clearTimeout(chunkTimer); chunkTimer = null; }
    if (done) break;
    txt += dec.decode(value, { stream: true });
  }
  return txt;
}
import { NarratorSettingsTrigger } from "@/components/NarratorSettings";
import { useAutoNarrate } from "@/hooks/useAutoNarrate";
import { useColors } from "@/hooks/useColors";
import { useHistory } from "@/context/HistoryContext";
import { CHARACTERS, useNarrator, type NarratorCharacter } from "@/context/NarratorContext";
import { LiveScanStore } from "@/stores/LiveScanStore";
import { BoatDemoStore } from "@/stores/BoatDemoStore";
import { DemoSonarView } from "@/components/DemoSonarView";
import { useInsta360Context } from "@/contexts/Insta360Context";
import { useCamera2, DEFAULT_CAM2_IP, DEFAULT_CAM2_PATH } from "@/hooks/useCamera2";
import { useCameraScanner, type DiscoveredCamera } from "@/hooks/useCameraScanner";
import { useCrocSound } from "@/hooks/useCrocSound";
import { HUD_PAGE_URL } from "@/hooks/useHudStream";
import { Insta360PipelineCard } from "@/components/Insta360PipelineCard";
import { polarFilter } from "@/utils/polarFilter";

// ─── Conditional IntentLauncher (Android only) ────────────────────────────────
let IntentLauncher: any = null;
if (Platform.OS === "android") {
  try { IntentLauncher = require("expo-intent-launcher"); } catch {}
}

// ─── Native-only imports ──────────────────────────────────────────────────────
let CameraView: any = null;
let useCameraPermissions: any = null;
if (Platform.OS !== "web") {
  const cam = require("expo-camera");
  CameraView = cam.CameraView;
  useCameraPermissions = cam.useCameraPermissions;
}

// ─── MediaLibrary — gallery saves from boat mode ──────────────────────────────
let MediaLibrary: any = null;
if (Platform.OS !== "web") {
  try { MediaLibrary = require("expo-media-library"); } catch {}
}

// ─── Web camera component (loaded conditionally) ──────────────────────────────
let WebCameraView: any = null;
if (Platform.OS === "web") {
  WebCameraView = require("@/components/WebCameraView.web").default;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface FishAnalysis {
  fishCount: number;
  depth: string;
  distance: string;
  species: string;
  confidence: number;
  suggestion: string;
  lure?: string;
  lureType?: string;
  technique?: string;
  crocAlert?: boolean;
  crocWarning?: string | null;
  birdAlert?: string | null;
  targetCount?: number;
  targetType?: string;
  barraPct?: number;
  waterTemp?: string;
  bottomType?: string;
  detectedZones?: string[];
  frameZones?: string[][];
  movementVector?: string;
  movingZones?: string[];
  staticZones?: string[];
  movingTargetCount?: number;
  sonarType?: string;
}

const SPECIES_SLANG: Record<string, string> = {
  barramundi: "barra", "mangrove jack": "jack",
  "spanish mackerel": "spaniard", "giant trevally": "GT",
  "coral trout": "coral", queenfish: "queenie",
  "threadfin salmon": "threadie", "king threadfin": "threadie",
  "black jewfish": "jewie", jewfish: "jewie",
  "red emperor": "emperor",
};
function speciesNickname(raw: string) {
  const clean = raw.replace(/\s*\(\d+%\)/, "").toLowerCase();
  for (const [k, v] of Object.entries(SPECIES_SLANG)) if (clean.includes(k)) return v;
  return raw.replace(/\s*\(\d+%\)/, "");
}

function buildSpeech(a: FishAnalysis, character: NarratorCharacter): string {
  const nick = speciesNickname(a.species);
  const count = a.fishCount;
  const lureNote = a.lure ? ` Chuck on ${a.lure}.` : "";
  switch (character) {
    case "BENAUD": {
      const w = count === 0 ? "Nothing at all" : count === 1 ? "One magnificent specimen" : `${count} fish`;
      return `${w} on the sonar — ${nick} holding at ${a.depth}, ${a.distance}. ${a.confidence >= 80 ? "One has complete confidence." : "The evidence suggests that is most likely."}${lureNote ? ` ${lureNote}` : ""} Marvellous conditions.`;
    }
    case "CHOPPER":
      if (count === 0) return "Listen here ya mug — absolutely nothin' on the sonar. Move the bloody boat.";
      return `${count === 1 ? "One unit" : `${count} fish ya mug`} — ${nick}, ${a.depth}, ${a.distance}. I'm tellin' ya deadset.${lureNote} Get in there.`;
    case "ATTENBOROUGH":
      if (count === 0) return "The ancient waters yield nothing to our instruments at this moment. We must seek them elsewhere.";
      return `Here, in the remarkable Gulf Country waters, ${count === 1 ? "a solitary" : `${count}`} ${nick} ${count === 1 ? "rests" : "rest"} at ${a.depth}.${lureNote}`;
    case "WIFE":
      if (count === 0) return "Nothing on the sonar. Honestly. I told you to move the boat twenty minutes ago. The gutters still need cleaning when you get home.";
      return `Okay fine — ${count === 1 ? "there's one" : `there are ${count} fish`} showing, ${nick} at ${a.depth}. Don't stuff it up.${lureNote ? ` And ${lureNote.trim()}` : ""} You better bring something home.`;
    default:
      if (count === 0) return "Oi mate, sonar's drawing a blank — nothing showing down there right now.";
      return `${count <= 1 ? "Got a lone unit" : count <= 3 ? `Ripper — got ${count} fish showing` : `Bloody hell, ${count} fish stacked up`}! Reckon they're ${nick} — about ${a.depth}, ${a.distance}.${lureNote} Smash 'em!`;
  }
}

// ─── Barra sketch background ──────────────────────────────────────────────────
const BARRA_POSITIONS = [
  { size: 140, top: 30,  left: -30, rotate: "12deg",  opacity: 0.09 },
  { size: 80,  top: 160, right:-15, rotate: "-22deg", opacity: 0.07 },
  { size: 180, top: 270, left: -40, rotate: "6deg",   opacity: 0.06 },
  { size: 100, top: 390, right:-10, rotate: "28deg",  opacity: 0.08 },
  { size: 160, top: 510, left: -5,  rotate: "-8deg",  opacity: 0.07 },
  { size: 90,  top: 650, right: 15, rotate: "-35deg", opacity: 0.08 },
  { size: 120, top: 180, left: 160, rotate: "-5deg",  opacity: 0.05 },
  { size: 70,  top: 560, left: 200, rotate: "18deg",  opacity: 0.06 },
];
function BarraSketches({ opacity = 1 }: { opacity?: number }) {
  return (
    <View style={[StyleSheet.absoluteFill, { overflow: "hidden" }]} pointerEvents="none">
      {BARRA_POSITIONS.map((f, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            top: f.top,
            ...(f.left !== undefined ? { left: f.left } : {}),
            ...(f.right !== undefined ? { right: f.right } : {}),
            opacity: f.opacity * opacity,
            transform: [{ rotate: f.rotate }],
          }}
        >
          <MaterialCommunityIcons name="fish" size={f.size} color="#00d4aa" />
        </View>
      ))}
    </View>
  );
}

// ─── Big glowing scan button ──────────────────────────────────────────────────
function GlowButton({
  onPress, scanning, boatMode, ready,
}: {
  onPress: () => void; scanning: boolean; boatMode: boolean; ready: boolean;
}) {
  const ring1 = useSharedValue(1);
  const ring2 = useSharedValue(1);

  useEffect(() => {
    const speed = scanning ? 600 : 1400;
    ring1.value = withRepeat(withTiming(1.45, { duration: speed }), -1, true);
    ring2.value = withRepeat(withTiming(1.85, { duration: speed * 1.5 }), -1, true);
  }, [scanning]);

  const color = scanning ? "#ffd700" : boatMode ? "#aaff00" : "#00d4aa";

  const r1Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring1.value }],
    opacity: interpolate(ring1.value, [1, 1.45], [0.38, 0]),
  }));
  const r2Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring2.value }],
    opacity: interpolate(ring2.value, [1, 1.85], [0.2, 0]),
  }));

  return (
    <View style={styles.glowWrap}>
      <Animated.View style={[styles.glowRing, { borderColor: color }, r2Style]} />
      <Animated.View style={[styles.glowRing, { borderColor: color }, r1Style]} />
      <TouchableOpacity
        style={[styles.glowBtn, { backgroundColor: color, opacity: ready ? 1 : 0.45 }]}
        onPress={onPress}
        disabled={!ready || scanning}
        activeOpacity={0.8}
      >
        {scanning ? (
          <>
            <SonarPulse size={38} active />
            <Text style={styles.glowBtnSub}>READING…</Text>
          </>
        ) : (
          <>
            <Feather name="zap" size={44} color="#0a1628" />
            <Text style={[styles.glowBtnLabel, { color: "#0a1628" }]}>
              {!ready ? "LOADING" : boatMode ? "AUTO ON" : "SCAN"}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ─── Boat mode big result card ────────────────────────────────────────────────
function BoatResultCard({
  result, charInfo, speaking, onReplay, onClear,
}: {
  result: FishAnalysis;
  charInfo: { emoji: string; color: string };
  speaking: boolean;
  onReplay: () => void;
  onClear: () => void;
}) {
  const hasfish = result.fishCount > 0;
  const accent = hasfish ? "#aaff00" : "#ff4500";
  return (
    <View style={[styles.boatCard, { borderColor: accent + "88" }]}>
      {/* Species + count row */}
      <View style={styles.boatRow}>
        <MaterialCommunityIcons name="fish" size={28} color={accent} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.boatSpecies, { color: accent }]} numberOfLines={1}>
            {result.species}
          </Text>
          <Text style={[styles.boatCount, { color: hasfish ? "#fff" : "#ff4500" }]}>
            {result.fishCount === 0 ? "No fish showing" : `${result.fishCount} fish detected`}
          </Text>
        </View>
        <TouchableOpacity onPress={onClear} style={styles.boatClose}>
          <Feather name="x" size={18} color="#ffffff77" />
        </TouchableOpacity>
      </View>

      {/* Depth + distance */}
      <View style={styles.boatDepthRow}>
        <View style={[styles.boatBadge, { backgroundColor: "#00a8ff33" }]}>
          <Feather name="anchor" size={13} color="#00a8ff" />
          <Text style={[styles.boatBadgeText, { color: "#00a8ff" }]}>{result.depth}</Text>
        </View>
        <View style={[styles.boatBadge, { backgroundColor: "#ffd70033" }]}>
          <MaterialCommunityIcons name="radar" size={13} color="#ffd700" />
          <Text style={[styles.boatBadgeText, { color: "#ffd700" }]}>{result.distance}</Text>
        </View>
      </View>

      {/* Lure tip */}
      {result.lure ? (
        <Text style={styles.boatLure} numberOfLines={2}>🎣 {result.lure}</Text>
      ) : null}

      {/* Actions */}
      <View style={styles.boatActions}>
        <TouchableOpacity
          style={[styles.boatReplay, { backgroundColor: charInfo.color + "33", borderColor: charInfo.color + "66" }]}
          onPress={onReplay}
        >
          <Feather name={speaking ? "volume-x" : "volume-2"} size={15} color={charInfo.color} />
          <Text style={[styles.boatReplayText, { color: charInfo.color }]}>
            {speaking ? "Stop" : `${charInfo.emoji} Read aloud`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Boat Mode Dashboard ───────────────────────────────────────────────────────
function BoatModeDashboard({
  result, scanning, countdown, scanCount,
  charInfo, speaking, autoSpeak,
  onToggleVoice, onBack, onReplay, onClear,
  topPad, botPad, autoInterval,
}: {
  result: FishAnalysis | null;
  scanning: boolean;
  countdown: number;
  scanCount: number;
  charInfo: { emoji: string; color: string };
  speaking: boolean;
  autoSpeak: boolean;
  onToggleVoice: () => void;
  onBack: () => void;
  onReplay: () => void;
  onClear: () => void;
  topPad: number;
  botPad: number;
  autoInterval: number;
}) {
  const noFish = result !== null && result.fishCount === 0;
  const accent = result === null ? "#aaff00" : noFish ? "#ff4500" : "#aaff00";

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: "#030f1f" }]}>
      <BarraSketches opacity={0.35} />

      {/* Header */}
      <View style={{ paddingTop: topPad + 10, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <TouchableOpacity
          onPress={onBack}
          style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#ffffff0e", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: "#ffffff22" }}
        >
          <Feather name="camera" size={13} color="#ffffffaa" />
          <Text style={{ color: "#ffffffaa", fontSize: 12, fontWeight: "700" }}>CAMERA</Text>
        </TouchableOpacity>

        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <MaterialCommunityIcons name="anchor" size={15} color="#aaff00" />
          <Text style={{ color: "#aaff00", fontSize: 13, fontWeight: "800", letterSpacing: 2 }}>BOAT MODE</Text>
        </View>

        <TouchableOpacity
          onPress={onToggleVoice}
          style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: autoSpeak ? "#aaff0015" : "#ffffff0e", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: autoSpeak ? "#aaff0055" : "#ffffff22" }}
        >
          <Feather name={autoSpeak ? "volume-2" : "volume-x"} size={13} color={autoSpeak ? "#aaff00" : "#ffffff66"} />
          <Text style={{ color: autoSpeak ? "#aaff00" : "#ffffff66", fontSize: 12, fontWeight: "700" }}>VOICE</Text>
        </TouchableOpacity>
      </View>

      {/* Auto-scan status strip */}
      <View style={{ marginHorizontal: 14, marginBottom: 14, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#aaff000e", borderRadius: 12, borderWidth: 1, borderColor: "#aaff0028", paddingHorizontal: 14, paddingVertical: 10 }}>
        {scanning ? (
          <SonarPulse size={10} active />
        ) : (
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#aaff00" }} />
        )}
        <Text style={{ color: "#aaff00", fontWeight: "700", fontSize: 13, flex: 1 }}>
          {scanning ? "SCANNING SONAR…" : `AUTO-SCAN · NEXT IN ${countdown}s`}
        </Text>
        {scanCount > 0 && (
          <Text style={{ color: "#aaff0066", fontSize: 12, fontWeight: "700" }}>{scanCount} scans</Text>
        )}
      </View>

      {/* Central result or idle state */}
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 }}>
        {scanning ? (
          <View style={{ alignItems: "center", gap: 22 }}>
            <SonarPulse size={72} active />
            <Text style={{ color: "#ffd700", fontSize: 20, fontWeight: "700", letterSpacing: 2 }}>READING SONAR…</Text>
          </View>
        ) : result !== null ? (
          <View style={{ alignItems: "center", gap: 12, width: "100%" }}>
            <Text style={{ fontSize: 100, fontWeight: "900", color: accent, lineHeight: 108, textAlign: "center" }}>
              {result.fishCount}
            </Text>
            <Text style={{ fontSize: 11, color: accent + "88", letterSpacing: 4, fontWeight: "700" }}>FISH DETECTED</Text>

            <Text style={{ fontSize: 26, fontWeight: "800", color: "#fff", textAlign: "center", lineHeight: 30, marginTop: 4 }}>
              {result.species}
            </Text>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
              <View style={{ backgroundColor: "#00a8ff22", borderRadius: 12, borderWidth: 1, borderColor: "#00a8ff55", paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", gap: 6, alignItems: "center" }}>
                <Feather name="anchor" size={14} color="#00a8ff" />
                <Text style={{ color: "#00a8ff", fontWeight: "700", fontSize: 17 }}>{result.depth}</Text>
              </View>
              <View style={{ backgroundColor: "#ffd70022", borderRadius: 12, borderWidth: 1, borderColor: "#ffd70055", paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", gap: 6, alignItems: "center" }}>
                <MaterialCommunityIcons name="radar" size={14} color="#ffd700" />
                <Text style={{ color: "#ffd700", fontWeight: "700", fontSize: 17 }}>{result.distance}</Text>
              </View>
            </View>

            {result.lure ? (
              <Text style={{ color: "#ffffffcc", fontSize: 15, textAlign: "center", marginTop: 4 }}>🎣 {result.lure}</Text>
            ) : null}

            <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
              <TouchableOpacity
                style={{ flexDirection: "row", gap: 7, alignItems: "center", backgroundColor: charInfo.color + "22", borderRadius: 14, borderWidth: 1, borderColor: charInfo.color + "55", paddingHorizontal: 20, paddingVertical: 13 }}
                onPress={onReplay}
              >
                <Feather name={speaking ? "volume-x" : "volume-2"} size={18} color={charInfo.color} />
                <Text style={{ color: charInfo.color, fontWeight: "700", fontSize: 15 }}>
                  {speaking ? "Stop" : `${charInfo.emoji} Read`}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flexDirection: "row", gap: 7, alignItems: "center", backgroundColor: "#ffffff0d", borderRadius: 14, borderWidth: 1, borderColor: "#ffffff22", paddingHorizontal: 20, paddingVertical: 13 }}
                onPress={onClear}
              >
                <Feather name="x" size={18} color="#ffffff88" />
                <Text style={{ color: "#ffffff88", fontWeight: "700", fontSize: 15 }}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={{ alignItems: "center", gap: 20 }}>
            <MaterialCommunityIcons name="radar" size={90} color="#aaff0020" />
            <Text style={{ color: "#aaff00", fontSize: 22, fontWeight: "700", textAlign: "center", letterSpacing: 1 }}>
              AIM AT SONAR SCREEN
            </Text>
            <Text style={{ color: "#aaff0066", fontSize: 14, textAlign: "center", lineHeight: 22 }}>
              {"Auto-scanning every " + autoInterval + "s\nLay phone flat, point at sonar screen"}
            </Text>
          </View>
        )}
      </View>

      {/* Bottom hint */}
      <Text style={{ color: "#aaff0044", fontSize: 12, textAlign: "center", paddingHorizontal: 16, paddingBottom: botPad + 14 }}>
        {"Screen stays on · auto-scan every " + autoInterval + "s · voice " + (autoSpeak ? "ON" : "OFF")}
      </Text>
    </View>
  );
}

// ─── Boat Mode Fish Detection Grid ────────────────────────────────────────────
const _GRID_COLS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
const _GRID_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"] as const;

function BoatGrid({ detectedZones, frameZones, movementVector, movingZones, staticZones }: {
  detectedZones: string[];
  frameZones?: string[][];
  movementVector?: string;
  movingZones?: string[];
  staticZones?: string[];
}) {
  const movingSet = new Set(movingZones ?? []);
  const staticSet = new Set(staticZones ?? []);
  const totalFrames = frameZones && frameZones.length > 0 ? frameZones.length : 1;
  const zoneLastFrame = new Map<string, number>();
  if (frameZones && frameZones.length > 0) {
    frameZones.forEach((zones, fi) => zones.forEach(z => zoneLastFrame.set(z, fi)));
  } else {
    detectedZones.forEach(z => zoneLastFrame.set(z, 0));
  }
  const ARROW: Record<string, string> = {
    left: "←", right: "→", deeper: "↓", shallower: "↑", stationary: "●",
  };
  const movingCount = movingZones && movingZones.length > 0 ? Math.ceil(movingZones.length / 2) : 0;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {(["12.5%","25%","37.5%","50%","62.5%","75%","87.5%"] as const).map(pct => (
        <View key={`h${pct}`} style={{ position: "absolute", left: 0, right: 0, top: pct, height: 1, backgroundColor: "#FF6B0044" }} />
      ))}
      {(["12.5%","25%","37.5%","50%","62.5%","75%","87.5%"] as const).map(pct => (
        <View key={`v${pct}`} style={{ position: "absolute", top: 0, bottom: 0, left: pct, width: 1, backgroundColor: "#FF6B0044" }} />
      ))}
      {_GRID_ROWS.map((row, ri) => _GRID_COLS.map((col, ci) => {
        const zone = `${col}${row}`;
        const lastFi = zoneLastFrame.get(zone);
        const frameAlpha = lastFi !== undefined ? 0.15 + (lastFi / Math.max(totalFrames - 1, 1)) * 0.65 : 0;
        const isMoving = movingSet.has(zone);
        const isStatic = staticSet.has(zone);
        let bgColor = "transparent";
        let borderColor = "transparent";
        let borderWidth = 0;
        let labelColor = "#FF6B0030";
        if (isMoving) {
          bgColor = "rgba(0,220,100,0.18)";
          borderColor = "rgba(0,220,100,0.85)";
          borderWidth = 1.5;
          labelColor = "rgba(0,255,120,0.95)";
        } else if (isStatic) {
          bgColor = "rgba(180,180,180,0.05)";
          labelColor = "rgba(150,150,150,0.5)";
        } else if (frameAlpha > 0) {
          bgColor = `rgba(255,140,0,${(frameAlpha * 0.3).toFixed(2)})`;
          borderColor = `rgba(255,140,0,${frameAlpha.toFixed(2)})`;
          borderWidth = frameAlpha > 0.5 ? 1 : 0;
          labelColor = `rgba(255,165,0,${Math.min(frameAlpha + 0.2, 1).toFixed(2)})`;
        }
        return (
          <View key={zone} style={{
            position: "absolute",
            left: `${ci * 12.5}%` as `${number}%`, width: "12.5%",
            top: `${ri * 12.5}%` as `${number}%`, height: "12.5%",
            backgroundColor: bgColor, borderWidth, borderColor,
          }}>
            <Text style={{ color: labelColor, fontSize: 7, fontWeight: "700", margin: 2, letterSpacing: 0 }}>
              {zone}
            </Text>
          </View>
        );
      }))}
      <View style={{ position: "absolute", top: 6, left: 6, width: 16, height: 16, borderTopWidth: 2, borderLeftWidth: 2, borderColor: "#FF8C00CC" }} />
      <View style={{ position: "absolute", top: 6, right: 6, width: 16, height: 16, borderTopWidth: 2, borderRightWidth: 2, borderColor: "#FF8C00CC" }} />
      <View style={{ position: "absolute", bottom: 6, left: 6, width: 16, height: 16, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: "#FF8C00CC" }} />
      <View style={{ position: "absolute", bottom: 6, right: 6, width: 16, height: 16, borderBottomWidth: 2, borderRightWidth: 2, borderColor: "#FF8C00CC" }} />
      {movingCount > 0 && (
        <View style={{ position: "absolute", top: 10, left: 10, backgroundColor: "rgba(0,200,80,0.88)", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
          <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 0.5 }}>▶ {movingCount > 1 ? `${movingCount} TARGETS` : "MOVEMENT"}</Text>
        </View>
      )}
      {movementVector && movementVector !== "unknown" && (
        <View style={{ position: "absolute", bottom: 10, right: 10, backgroundColor: "rgba(255,140,0,0.85)", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, flexDirection: "row", alignItems: "center", gap: 3 }}>
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "bold" }}>{ARROW[movementVector] ?? "?"}</Text>
          <Text style={{ color: "#ffffffcc", fontSize: 9, fontWeight: "600" }}>{movementVector.toUpperCase()}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function LiveScreen() {
  const colors   = useColors();
  const insets   = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { addEntry } = useHistory();
  const { character, speak, stop: stopSpeaking, speaking } = useNarrator();
  useAutoNarrate(() => "AI Live Camera — real-time Barramundi and wildlife detection active. NQ regional brain loaded.");

  const [nativePermission, requestNativePermission] =
    useCameraPermissions ? useCameraPermissions() : [null, null];

  const [webPermission, setWebPermission] = useState<"unknown" | "requesting" | "granted" | "denied">("unknown");
  const [webReady, setWebReady]           = useState(false);

  const [scanning, setScanning]         = useState(false);
  const [galleryPicking, setGalleryPicking] = useState(false);
  const [result, setResult]             = useState<FishAnalysis | null>(null);
  const [error, setError]               = useState<string | null>(null);
  const [autoSpeak, setAutoSpeak]       = useState(true);
  const [boatMode, setBoatMode]                     = useState(false);
  const [boatLive, setBoatLive]                     = useState(false);
  const [boatPhase, setBoatPhase]                   = useState<"idle"|"capturing"|"analyzing"|"waiting">("idle");
  const [detectedZones, setDetectedZones]           = useState<string[]>([]);
  const [frameZones, setFrameZones]                 = useState<string[][]>([]);
  const [movementVector, setMovementVector]         = useState<string>("unknown");
  const [movingZones, setMovingZones]               = useState<string[]>([]);
  const [staticZones, setStaticZones]               = useState<string[]>([]);
  const [boatCycleNum, setBoatCycleNum]             = useState(0);
  const [boatCaptureCount, setBoatCaptureCount]     = useState(0);
  const [boatWaitRemaining, setBoatWaitRemaining]   = useState(0);
  const [boatSummaryNarration, setBoatSummaryNarration] = useState<string|null>(null);
  const [crocAlertActive, setCrocAlertActive]       = useState(false);
  useCrocSound(crocAlertActive);
  const [fishTrackingText, setFishTrackingText]     = useState<string|null>(null);
  const [polarOn, setPolarOn]           = useState(true);   // polarised-lens filter
  const [polarising, setPolarising]     = useState(false);  // filter in progress
  const [feedView, setFeedView]         = useState<"camera" | "visual">("camera"); // full-screen feed toggle

  // ── VISION MODE — live real-time AI detector ──────────────────────────────
  const [visionMode, setVisionMode]         = useState(false);
  const [visionModeType, setVisionModeType] = useState<"face"|"object"|"barra">("barra");
  const [visionDetecting, setVisionDetecting] = useState(false);
  const [visionTargets, setVisionTargets]   = useState<VisionTarget[]>([]);
  const [visionFrameNote, setVisionFrameNote] = useState("");
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const visionIntervalRef   = useRef<ReturnType<typeof setInterval>|null>(null);
  const visionScanProgress  = useSharedValue(0);
  const sweepLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: visionScanProgress.value * windowHeight }],
  }));
  const sweepTrailStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (visionScanProgress.value * windowHeight) - 80 }],
  }));
  const visionDetectingRef  = useRef(false);
  const visionModeTypeRef   = useRef<"face"|"object"|"barra">("barra");
  const [burstRows, setBurstRows] = useState<Array<{ num: number; status: string; targets: VisionTarget[]; note: string }>>([]);
  const burstRunRef         = useRef(false);
  const sessionIdRef        = useRef<number | null>(null);
  const burstNumRef         = useRef(0);
  const [isOffline, setIsOffline] = useState(false);

  // ── Live Scan Panel (non-boat-mode scan) ──────────────────────────────────
  const [lsUri, setLsUri]           = useState<string | null>(null);
  const [lsB64, setLsB64]           = useState<string | null>(null);
  const [lsAnalysis, setLsAnalysis] = useState<FishAnalysis | null>(null);
  const [lsLoading, setLsLoading]   = useState(false);
  const [lsError, setLsError]       = useState<string | null>(null);

  const nativeCamRef        = useRef<any>(null);
  const webCamRef           = useRef<any>(null);
  const capturedFramesRef   = useRef<Array<{base64:string;uri:string;result:FishAnalysis|null;score:number}>>([]);
  const captureTimerRef     = useRef<ReturnType<typeof setTimeout>|null>(null);
  const cycleTimeoutRef     = useRef<ReturnType<typeof setTimeout>|null>(null);
  const waitCountdownRef    = useRef<ReturnType<typeof setInterval>|null>(null);
  const isBoatLiveRef       = useRef(false);
  const cycleNumRef         = useRef(0);
  const cycleStartTimeRef   = useRef(0);
  const runBoatCycleRef     = useRef<(()=>Promise<void>)|null>(null);

  // ── Insta360 (shared context — one instance for whole app) ───────────────
  const { camera: insta360, pipelines } = useInsta360Context();
  const [insta360Panel, setInsta360Panel]       = useState(false);
  const [insta360Snapping, setInsta360Snapping] = useState(false);

  // ── Camera 2 — generic WiFi sonar-screen camera ───────────────────────────
  const cam2 = useCamera2();
  const [cam2Panel,  setCam2Panel]  = useState(false);
  const [cam2IpEdit, setCam2IpEdit] = useState<string | null>(null);  // null = not editing
  const [cam2PathEdit, setCam2PathEdit] = useState<string | null>(null);
  const cam2Connected = cam2.status === "connected";

  // ── Smart-glass HUD panel ─────────────────────────────────────────────────
  const [hudPanel, setHudPanel] = useState(false);

  // ── SmartLife camera auto-discovery ───────────────────────────────────────
  const slScanner = useCameraScanner();
  const [smartlifePanel,  setSmartlifePanel]  = useState(false);
  const [slConnecting,    setSlConnecting]    = useState(false);
  const [slConnectedCam,  setSlConnectedCam]  = useState<DiscoveredCamera | null>(null);

  const BOAT_CAPTURE_INTERVAL = 1_000;   // 1 s between silent captures — faster movement tracking
  const BOAT_CAPTURE_COUNT    = 5;
  const BOAT_TOTAL_CYCLE_MS   = 45_000; // 4 s capture + analysis + 30 s gap = 45 s total

  const charInfo = CHARACTERS.find((c) => c.id === character) ?? CHARACTERS[0];
  const topPad   = Platform.OS === "web" ? 20 : insets.top;
  const botPad   = Platform.OS === "web" ? 70 : insets.bottom + 16;

  // ── Screen keep-awake in boat mode ────────────────────────────────────────
  useEffect(() => {
    if (boatMode) {
      activateKeepAwakeAsync().catch(() => {});
    }
    return () => { try { deactivateKeepAwake(); } catch {} };
  }, [boatMode]);

  const requestWebCamera = useCallback(async () => {
    setWebPermission("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
      setWebPermission("granted");
    } catch {
      setWebPermission("denied");
    }
  }, []);

  // ── VISION MODE callbacks ─────────────────────────────────────────────────
  const stopVisionMode = useCallback(() => {
    burstRunRef.current = false;
    if (sessionIdRef.current) {
      const sid = sessionIdRef.current; sessionIdRef.current = null;
      const _d = process.env.EXPO_PUBLIC_DOMAIN; const _b = _d ? `https://${_d}` : "";
      fetch(`${_b}/api/vision-session/end`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: sid }) }).catch(() => {});
    }
    if (visionIntervalRef.current) { clearInterval(visionIntervalRef.current); visionIntervalRef.current = null; }
    visionDetectingRef.current = false;
    setVisionMode(false);
    setVisionDetecting(false);
    setVisionTargets([]);
    setVisionFrameNote("");
    setAnalysisRunning(false);
    setBurstRows([]);
    setIsOffline(false);
    try { deactivateKeepAwake(); } catch {}
  }, []);

  const captureVisionFrame = useCallback(async () => {
    if (!nativeCamRef.current || visionDetectingRef.current) return;
    visionDetectingRef.current = true;
    setVisionDetecting(true);
    try {
      const photo = await nativeCamRef.current.takePictureAsync({
        base64: true, quality: 0.28, skipProcessing: false, exif: false,
      });
      if (!photo?.base64) return;
      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      const baseUrl = domain ? `https://${domain}` : "";
      const resp = await fetch(`${baseUrl}/api/vision-detect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: photo.base64, region: "nq", mode: visionModeTypeRef.current }),
        signal: AbortSignal.timeout(15_000),
      });
      if (resp.ok) {
        const data = await resp.json() as { targets: VisionTarget[]; frameNote: string };
        setVisionTargets(data.targets ?? []);
        setVisionFrameNote(data.frameNote ?? "");
      }
    } catch { setVisionFrameNote("No signal — retrying next frame…"); } finally {
      visionDetectingRef.current = false;
      setVisionDetecting(false);
    }
  }, []);

  const runBurst = useCallback(async () => {
    if (!nativeCamRef.current) return;
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    const baseUrl = domain ? `https://${domain}` : "";
    const results: Array<{ targets: VisionTarget[]; note: string } | null> = Array(5).fill(null);

    setBurstRows(Array.from({ length: 5 }, (_, i) => ({ num: i + 1, status: "pending", targets: [], note: "" })));

    // Phase 1 — rapid burst capture (5 photos ~350 ms apart)
    // Capture at native res then resize to 640 px wide — keeps payload under 80 KB
    // so it clears the Replit reverse-proxy body limit and never gets silently dropped.
    const photos: (string | null)[] = [];
    for (let i = 0; i < 5; i++) {
      setBurstRows(prev => prev.map((r, idx) => idx === i ? { ...r, status: "capturing" } : r));
      try {
        const p = await nativeCamRef.current.takePictureAsync({ base64: false, exif: false, skipProcessing: true });
        if (p?.uri) {
          try {
            const small = await manipulateAsync(p.uri, [{ resize: { width: 640 } }], { compress: 0.4, format: SaveFormat.JPEG, base64: true });
            photos[i] = small.base64 ?? null;
          } catch {
            // expo-image-manipulator native module absent from binary — retake at low quality
            const fb = await nativeCamRef.current.takePictureAsync({ base64: true, quality: 0.04, exif: false, skipProcessing: false });
            photos[i] = fb?.base64 ?? null;
          }
        } else { photos[i] = null; }
      } catch { photos[i] = null; }
      setBurstRows(prev => prev.map((r, idx) => idx === i ? { ...r, status: photos[i] ? "analyzing" : "error", note: photos[i] ? "" : "Capture failed" } : r));
      if (i < 4) await new Promise<void>(res => setTimeout(res, 350));
    }

    // Phase 2 — parallel GPT-4.1 Vision analysis
    burstNumRef.current += 1;
    const thisBurst = burstNumRef.current;
    await Promise.all(photos.map(async (b64, i) => {
      if (!b64) return;
      try {
        const resp = await fetchRetry(
          `${baseUrl}/api/vision-detect`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64: b64, region: "nq", mode: visionModeTypeRef.current, sessionId: sessionIdRef.current ?? undefined, burstNum: thisBurst, frameNum: i + 1 }),
          },
          20_000, 1, 2_000,
        );
        if (resp.ok) {
          const data = await resp.json() as { targets: VisionTarget[]; frameNote: string };
          const tgts = data.targets ?? [];
          const note = data.frameNote ?? "";
          results[i] = { targets: tgts, note };
          const prevResult = results[i - 1];
          const prevSet = new Set((prevResult?.targets ?? []).map(t => t.label.toLowerCase()));
          const currSet = new Set(tgts.map(t => t.label.toLowerCase()));
          const added   = [...currSet].filter(l => !prevSet.has(l)).map(l => `+${l}`);
          const removed = [...prevSet].filter(l => !currSet.has(l)).map(l => `-${l}`);
          const delta   = [...added, ...removed].join("  ");
          const display = tgts.length > 0 ? note : "No targets";
          setBurstRows(prev2 => prev2.map((r, idx) => idx === i ? { ...r, status: "done", targets: tgts, note: display + (delta ? `  [${delta}]` : "") } : r));
          if (tgts.length > 0) { setVisionTargets(tgts); setVisionFrameNote(note); }
          setIsOffline(false);
        } else {
          setBurstRows(prev2 => prev2.map((r, idx) => idx === i ? { ...r, status: "error", note: `Server ${resp.status}` } : r));
        }
      } catch {
        setBurstRows(prev2 => prev2.map((r, idx) => idx === i ? { ...r, status: "error", note: "Offline" } : r));
        setIsOffline(true);
      }
    }));
  }, []);

  const startVisionMode = useCallback(() => {
    setVisionMode(true);
    setVisionTargets([]);
    setVisionFrameNote("");
    activateKeepAwakeAsync().catch(() => {});
  }, []);

  const startAnalysis = useCallback(() => {
    if (burstRunRef.current) return;
    burstRunRef.current = true;
    burstNumRef.current = 0;
    setAnalysisRunning(true);
    setIsOffline(false);
    const _d = process.env.EXPO_PUBLIC_DOMAIN; const _b = _d ? `https://${_d}` : "";
    fetch(`${_b}/api/vision-session/start`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ region: "nq" }) })
      .then(r => r.ok ? r.json() : null).then((d: { sessionId?: number } | null) => { if (d?.sessionId) sessionIdRef.current = d.sessionId; }).catch(() => {});
    const loop = async () => {
      while (burstRunRef.current) {
        await runBurst();
        if (burstRunRef.current) await new Promise<void>(res => setTimeout(res, 1500));
      }
      setAnalysisRunning(false);
    };
    loop();
  }, [runBurst]);

  const stopAnalysis = useCallback(() => {
    burstRunRef.current = false;
    if (visionIntervalRef.current) { clearInterval(visionIntervalRef.current); visionIntervalRef.current = null; }
    if (sessionIdRef.current) {
      const sid = sessionIdRef.current; sessionIdRef.current = null;
      const _d = process.env.EXPO_PUBLIC_DOMAIN; const _b = _d ? `https://${_d}` : "";
      fetch(`${_b}/api/vision-session/end`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: sid }) }).catch(() => {});
    }
    setAnalysisRunning(false);
  }, []);

  // Handles first-time permission grant while tab is already in focus
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (nativePermission?.granted && Platform.OS !== "web") { startVisionMode(); startAnalysis(); }
  }, [nativePermission?.granted]);

  // Restart vision analysis EVERY time the Live tab is re-focused (e.g. after tab-switch)
  useFocusEffect(useCallback(() => {
    if (nativePermission?.granted && Platform.OS !== "web") { startVisionMode(); startAnalysis(); }
    return () => stopVisionMode();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nativePermission?.granted]));

  // Sonar sweep animation — continuous while camera is live (reanimated v3)
  useEffect(() => {
    if (!visionMode) { cancelAnimation(visionScanProgress); visionScanProgress.value = 0; return; }
    visionScanProgress.value = withRepeat(withTiming(1, { duration: 2400 }), -1, false);
    return () => { cancelAnimation(visionScanProgress); visionScanProgress.value = 0; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visionMode]);

  const speakResult = useCallback(
    (analysis: FishAnalysis) => speak(buildSpeech(analysis, character)),
    [speak, character]
  );

  // ── Live Scan Panel callbacks ─────────────────────────────────────────────
  const lsPickCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission Required", "Allow camera access to photograph your sonar screen."); return; }
    const picked = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.85, base64: false });
    if (!picked.canceled && picked.assets[0]) {
      const jpeg = await manipulateAsync(picked.assets[0].uri, [{ resize: { width: 1280 } }], { compress: 0.85, format: SaveFormat.JPEG, base64: true });
      setLsUri(jpeg.uri); setLsB64(jpeg.base64 ?? null);
      setLsAnalysis(null); setLsError(null);
    }
  }, []);

  const lsPickGallery = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission Required", "Allow access to your photo library."); return; }
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85, base64: false });
    if (!picked.canceled && picked.assets[0]) {
      const jpeg = await manipulateAsync(picked.assets[0].uri, [{ resize: { width: 1280 } }], { compress: 0.85, format: SaveFormat.JPEG, base64: true });
      setLsUri(jpeg.uri); setLsB64(jpeg.base64 ?? null);
      setLsAnalysis(null); setLsError(null);
    }
  }, []);

  const lsAnalyze = useCallback(async () => {
    if (!lsB64) return;
    setLsLoading(true);
    setLsError(null);
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    const baseUrl = domain ? `https://${domain}` : "";
    try {
      let sonarType = "arch-2d";
      try {
        const vr = await fetch(`${baseUrl}/api/sonar-validate`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: lsB64 }),
        });
        if (vr.ok) {
          const vd = await vr.json() as { isSonar: boolean; sonarType?: string; reason?: string };
          if (!vd.isSonar) { setLsError(`Not a sonar image — ${vd.reason ?? "Please photograph your sonar screen."}`); return; }
          sonarType = vd.sonarType ?? "arch-2d";
        }
      } catch { /* fail open */ }
      const endpoint = sonarType === "live-sonar" ? `${baseUrl}/api/live-sonar-analyze` : `${baseUrl}/api/analyze`;
      const resp = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: lsB64, location: null }),
      });
      if (!resp.ok) throw new Error(`Analysis failed (${resp.status}) — check your connection and try again.`);
      // ── Stream the response (analyze streams text/plain, not JSON) ─────────
      let accumulated = "";
      if (resp.body) {
        const reader = resp.body.getReader();
        try { accumulated = await readStreamWithTimeout(reader, 85_000); }
        finally { try { reader.cancel(); } catch {} }
      } else {
        accumulated = await resp.text();
      }
      // Strip __FLASH__ prefix line before JSON parsing
      accumulated = accumulated.replace(/__FLASH__:[^\n]*\n?/, "");
      const data = JSON.parse(accumulated.trim()) as FishAnalysis;
      setLsAnalysis(data);
      if (data.crocAlert) setCrocAlertActive(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setLsError(e?.message ?? "Analysis failed — please try again.");
    } finally {
      setLsLoading(false);
    }
  }, [lsB64]);

  // ── Open device WiFi settings ──────────────────────────────────────────────
  const openWifiSettings = useCallback(async () => {
    try {
      if (Platform.OS === "android" && IntentLauncher) {
        await IntentLauncher.startActivityAsync(
          IntentLauncher.ActivityAction.WIFI_SETTINGS
        );
      } else {
        // iOS — open Settings root (WiFi is top-level)
        await Linking.openURL("App-prefs:WIFI");
      }
    } catch {
      try { await Linking.openSettings(); } catch {}
    }
  }, []);

  // ── Insta360 manual snap → send to Scan tab for AI analysis ───────────────
  const insta360Snap = useCallback(async () => {
    if (insta360.status !== "connected" || insta360Snapping) return;
    setInsta360Snapping(true);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const snap = await insta360.takeSnapshot();
      if (!snap) { setError("Insta360 snapshot failed — check connection."); return; }
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      LiveScanStore.push(snap.base64, snap.uri, "live");
      router.navigate("/");
    } catch (err) {
      setError("Insta360 snapshot failed.");
    } finally {
      setInsta360Snapping(false);
    }
  }, [insta360, insta360Snapping]);

  // ── Stop live cycle ───────────────────────────────────────────────────────
  const stopBoatLive = useCallback(() => {
    isBoatLiveRef.current = false;
    if (captureTimerRef.current)  { clearTimeout(captureTimerRef.current);   captureTimerRef.current  = null; }
    if (cycleTimeoutRef.current)  { clearTimeout(cycleTimeoutRef.current);   cycleTimeoutRef.current  = null; }
    if (waitCountdownRef.current) { clearInterval(waitCountdownRef.current); waitCountdownRef.current = null; }
    setBoatLive(false);
    setBoatPhase("idle");
    setBoatCaptureCount(0);
    setBoatWaitRemaining(0);
    LiveScanStore.setBoatActive(false);
    BoatDemoStore.clear();
  }, []);

  // ── Silent single capture (no haptics, no sound) ──────────────────────────
  const silentCapture = useCallback(async (): Promise<{base64:string;uri:string}|null> => {
    try {
      // ── Demo mode: return next pre-loaded frame instead of camera capture ──
      if (BoatDemoStore.active && BoatDemoStore.length > 0) {
        return BoatDemoStore.nextFrame();
      }

      if (cam2Connected && Platform.OS !== "web") {
        const snap = await cam2.takeSnapshot();
        if (!snap) return null;
        if (snap.uri) {
          try {
            const j = await manipulateAsync(snap.uri, [], { format: SaveFormat.JPEG, compress: 0.75, base64: true });
            if (j.base64) return { base64: j.base64, uri: j.uri };
          } catch { /* fall through to raw */ }
        }
        const raw = (snap.base64 ?? "").replace(/^data:[^;]+;base64,/, "");
        return raw ? { base64: raw, uri: snap.uri ?? "" } : null;
      }
      if (Platform.OS === "web") {
        const photo = await webCamRef.current?.takePicture?.();
        return photo?.base64 ? { base64: photo.base64, uri: photo.uri } : null;
      }
      if (!nativeCamRef.current) return null;
      // base64:true is the safety net; skipProcessing:false avoids HEIF on iOS
      const photo = await nativeCamRef.current.takePictureAsync({ base64: true, quality: 0.85, skipProcessing: false });
      if (!photo) return null;
      // Prefer manipulateAsync → guaranteed clean JPEG (same as scan page toJpeg)
      if (photo.uri) {
        try {
          const j = await manipulateAsync(photo.uri, [], { format: SaveFormat.JPEG, compress: 0.75, base64: true });
          if (j.base64) return { base64: j.base64, uri: j.uri };
        } catch { /* fall through to raw base64 */ }
      }
      // Fallback: raw camera base64 (strip any accidental data: prefix)
      const raw = (photo.base64 ?? "").replace(/^data:[^;]+;base64,/, "");
      return raw ? { base64: raw, uri: photo.uri ?? "" } : null;
    } catch { return null; }
  }, [cam2Connected, cam2]);

  // ── Full repeating boat cycle (10 captures → analyse best 2 → wait → repeat) ──
  const runBoatCycle = useCallback(async (): Promise<void> => {
    if (!isBoatLiveRef.current) return;
    cycleNumRef.current += 1;
    const cycleNum = cycleNumRef.current;
    const domain  = process.env.EXPO_PUBLIC_DOMAIN;
    const apiBase = domain ? `https://${domain}` : "";

    capturedFramesRef.current = [];
    cycleStartTimeRef.current = Date.now();
    setBoatCycleNum(cycleNum);
    setBoatPhase("capturing");
    setBoatCaptureCount(0);
    setCrocAlertActive(false);
    setDetectedZones([]);

    for (let i = 0; i < BOAT_CAPTURE_COUNT; i++) {
      if (!isBoatLiveRef.current) return;
      const photo = await silentCapture();
      if (photo) {
        capturedFramesRef.current.push({ base64: photo.base64, uri: photo.uri, result: null, score: 0 });
        setBoatCaptureCount(capturedFramesRef.current.length);
      }
      if (i < BOAT_CAPTURE_COUNT - 1) {
        await new Promise<void>(r => { captureTimerRef.current = setTimeout(r, BOAT_CAPTURE_INTERVAL); });
      }
    }
    if (captureTimerRef.current) { clearTimeout(captureTimerRef.current); captureTimerRef.current = null; }
    if (!isBoatLiveRef.current) return;

    // Phase 2: GPT-4.1 Vision as primary — runs immediately, no gate
    setBoatPhase("analyzing");
    const frames = [...capturedFramesRef.current];
    const bestFrame = frames.at(-1) ?? frames[0];

    let cycleResult: FishAnalysis | null = null;

    if (bestFrame) {
      // Detect sonar type once — reused by DPT and boat-cycle
      let sonarType = "arch-2d";
      try {
        const vr = await fetchRetry(`${apiBase}/api/sonar-validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: bestFrame.base64 }),
        }, 15_000, 2, 2_000);
        if (vr.ok) {
          const vd = await vr.json() as { isSonar?: boolean; sonarType?: string };
          sonarType = vd.sonarType ?? "arch-2d";
        }
      } catch { /* fail open */ }

      // ── PRIMARY: GPT-4.1 Vision — runs immediately, always ───────────────
      setLsB64(bestFrame.base64);
      setLsUri(bestFrame.uri ?? null);
      setLsAnalysis(null);
      setLsLoading(true);
      try {
        const dptEndpoint = sonarType === "live-sonar"
          ? `${apiBase}/api/live-sonar-analyze`
          : `${apiBase}/api/analyze`;
        const dresp = await fetchRetry(dptEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: bestFrame.base64 }),
        }, 90_000);
        if (dresp.ok) {
          let accumulated = "";
          if (dresp.body) {
            const reader = dresp.body.getReader();
            try { accumulated = await readStreamWithTimeout(reader, 85_000); }
            catch { /* partial — fall through to parse */ }
            finally { try { reader.cancel(); } catch {} }
          } else {
            accumulated = await dresp.text();
          }
          accumulated = accumulated
            .replace(/__FLASH__:[^\n]*\n?/, "")
            .replace(/\n__CV__:[^\n]*/, "")
            .replace(/\n__SCAN2__:[^\n]*/, "");
          const cleaned = accumulated.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();
          const m = cleaned.match(/\{[\s\S]*\}/);
          if (m) {
            let d: Record<string, unknown> = {};
            try { d = JSON.parse(m[0]); } catch { /* leave empty */ }
            if (typeof d.fishCount !== "number") d.fishCount = parseInt(String(d.fishCount ?? "0"), 10) || 0;
            const cr: FishAnalysis = {
              fishCount:         (d.fishCount        as number)         ?? 0,
              depth:             ((d.depth ?? d.depthRange) as string)  ?? "unknown",
              distance:          (d.distance          as string)        ?? "unknown",
              species:           (d.species           as string)        ?? "Unknown",
              confidence:        (d.confidence        as number)        ?? 0,
              suggestion:        (d.suggestion        as string)        ?? "",
              lure:              (d.lure              as string)        ?? "",
              lureType:          (d.lureType          as string)        ?? "",
              technique:         (d.technique         as string)        ?? "",
              crocAlert:         (d.crocAlert         as boolean)       ?? false,
              crocWarning:       (d.crocWarning       as string | null) ?? null,
              birdAlert:         null, barraPct: undefined, targetCount: undefined,
              targetType:        sonarType,
              waterTemp:         (d.waterTemp         as string)        ?? "",
              bottomType:        (d.bottomType        as string)        ?? "",
              detectedZones:     Array.isArray(d.detectedZones) ? d.detectedZones as string[] : [],
              frameZones:        [],
              movementVector:    (d.movementVector    as string)        ?? "unknown",
              movingZones:       [],
              staticZones:       [],
              movingTargetCount: (d.movingTargetCount as number)        ?? 0,
              sonarType:         sonarType,
            };
            cycleResult = cr;
            if (cr.crocAlert) setCrocAlertActive(true);
            setResult(cr);
            setLsAnalysis(cr);
            setDetectedZones(cr.detectedZones ?? []);
            setMovementVector(cr.movementVector ?? "unknown");
          }
        }
      } catch { /* cycleResult stays null */ } finally {
        setLsLoading(false);
      }

      // ── SECONDARY: boat-cycle for zone/movement intelligence ─────────────
      if (isBoatLiveRef.current) {
        try {
          const cResp = await fetchRetry(`${apiBase}/api/boat-cycle`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ frames: frames.map(f => f.base64) }),
          }, 60_000);
          if (cResp.ok) {
            const cycleData = await cResp.json() as Record<string, unknown>;
            const cdFrameZ = Array.isArray(cycleData.frameZones)  ? cycleData.frameZones  as string[][] : [];
            const cdMoving = Array.isArray(cycleData.movingZones) ? cycleData.movingZones as string[]  : [];
            const cdStatic = Array.isArray(cycleData.staticZones) ? cycleData.staticZones as string[]  : [];
            const cdVector = (cycleData.movementVector   as string) ?? "unknown";
            const cdMTC    = (cycleData.movingTargetCount as number) ?? 0;
            setResult(prev => prev ? {
              ...prev,
              frameZones:        cdFrameZ,
              movingZones:       cdMoving,
              staticZones:       cdStatic,
              movementVector:    cdVector,
              movingTargetCount: cdMTC,
              barraPct:          (cycleData.barraPct    as number | undefined) ?? prev.barraPct,
              targetCount:       (cycleData.targetCount as number | undefined) ?? prev.targetCount,
            } : prev);
            setFrameZones(cdFrameZ);
            setMovementVector(cdVector);
            setMovingZones(cdMoving);
            setStaticZones(cdStatic);
          }
        } catch { /* zone data optional */ }
      }
    }
    if (!isBoatLiveRef.current) return;

    if (MediaLibrary && Platform.OS !== "web" && cycleResult && (cycleResult.fishCount ?? 0) > 0) {
      for (const fr of frames.filter(f => f.uri).slice(-2)) {
        try {
          const perm = await MediaLibrary.requestPermissionsAsync();
          if (perm.granted) await MediaLibrary.saveToLibraryAsync(fr.uri);
        } catch {}
      }
    }

    if (cycleResult) {
      addEntry({ id: `boat-${cycleNum}-${Date.now()}`, timestamp: Date.now(), imageUri: frames.at(-1)?.uri ?? "",
        species: cycleResult.species, fishCount: cycleResult.fishCount, depth: cycleResult.depth,
        suggestion: cycleResult.suggestion });
    }

    {
      const mCount = cycleResult?.movingTargetCount ?? (cycleResult?.movingZones?.length ? Math.ceil(cycleResult.movingZones.length / 2) : 0);
      const sonar = cycleResult?.sonarType && cycleResult.sonarType !== "unknown" ? ` [${cycleResult.sonarType}]` : "";
      const moveText = mCount > 0 ? `${mCount} moving target${mCount > 1 ? "s" : ""}` : "no movement";
      const archInfo = `${moveText} · ${cycleResult?.targetType ?? "none"} · ${cycleResult?.movementVector ?? "?"}${sonar}`;
      setFishTrackingText((cycleResult?.fishCount ?? 0) > 0 || mCount > 0
        ? `Cycle ${cycleNum}: ${archInfo} · ${cycleResult?.depth ?? "?"}`
        : `Cycle ${cycleNum}: no fish · ${archInfo}`);
    }

    if (cycleResult) {
      const r = cycleResult;
      fetch(`${apiBase}/api/hud/update`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ species: r.species, fishCount: r.fishCount, depth: r.depth,
          confidence: r.confidence, suggestion: r.suggestion, lure: r.lure ?? "",
          crocAlert: r.crocAlert ?? false, crocWarning: r.crocWarning ?? null,
          birdAlert: r.birdAlert ?? null, region: "nq", source: "boat" }),
      }).catch(() => {});
    }

    // Narrate — always fires after every cycle, even if no fish detected
    if (!isBoatLiveRef.current) return;
    {
      const scans = cycleResult ? [cycleResult] : [];
      const fallback = scans.length === 0
        ? `Cycle ${cycleNum} complete. Five frames captured — no fish detected in this pass. Water looks clear, keep scanning.`
        : undefined;
      try {
        const resp = await fetchRetry(`${apiBase}/api/boat-session`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scans, region: "nq" }),
        }, 45_000);
        if (resp.ok) {
          const data = await resp.json() as { narration?: string };
          const narration = data.narration ?? fallback ?? `Cycle ${cycleNum} complete.`;
          setBoatSummaryNarration(narration);
          if (autoSpeak) speak(narration);
        } else {
          const msg = fallback ?? `Cycle ${cycleNum} complete.`;
          setBoatSummaryNarration(msg);
          if (autoSpeak) speak(msg);
        }
      } catch {
        const msg = fallback ?? `Cycle ${cycleNum} complete.`;
        setBoatSummaryNarration(msg);
        if (autoSpeak) speak(msg);
      }
    }

    if (!isBoatLiveRef.current) return;

    setBoatPhase("waiting");
    const elapsed = Date.now() - cycleStartTimeRef.current;
    const waitMs  = Math.max(5_000, BOAT_TOTAL_CYCLE_MS - elapsed);
    let waitSecs  = Math.ceil(waitMs / 1000);
    setBoatWaitRemaining(waitSecs);
    waitCountdownRef.current = setInterval(() => {
      waitSecs = Math.max(0, waitSecs - 1);
      setBoatWaitRemaining(waitSecs);
      if (waitSecs <= 0 && waitCountdownRef.current) { clearInterval(waitCountdownRef.current); waitCountdownRef.current = null; }
    }, 1000);
    await new Promise<void>(r => { cycleTimeoutRef.current = setTimeout(r, waitMs); });
    if (waitCountdownRef.current) { clearInterval(waitCountdownRef.current); waitCountdownRef.current = null; }

    if (isBoatLiveRef.current) void runBoatCycleRef.current?.();
  }, [silentCapture, speak, addEntry]); // eslint-disable-line react-hooks/exhaustive-deps
  runBoatCycleRef.current = runBoatCycle;

  const startBoatLive = useCallback(() => {
    isBoatLiveRef.current = true;
    cycleNumRef.current   = 0;
    setBoatLive(true);
    setBoatSummaryNarration(null);
    setFishTrackingText(null);
    setCrocAlertActive(false);
    LiveScanStore.setBoatActive(true);
    void runBoatCycleRef.current?.();
  }, []);

  // ── Demo boat mode: auto-start when navigated from demo tab ──────────────
  useFocusEffect(useCallback(() => {
    if (BoatDemoStore.active && !isBoatLiveRef.current) {
      const t = setTimeout(() => {
        if (BoatDemoStore.active && !isBoatLiveRef.current) startBoatLive();
      }, 400);
      return () => clearTimeout(t);
    }
  }, [startBoatLive]));

  // ── Scan — capture photo then send to Scan tab for full AI analysis ──────
  const scanNow = useCallback(async () => {
    if (scanning) return;
    setScanning(true);
    setError(null);

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }

    try {
      let base64 = "";
      let uri    = "";

      // ── Branch: Camera 2 WiFi connected → use remote sonar camera ────────
      if (cam2Connected && Platform.OS !== "web") {
        const snap = await cam2.takeSnapshot();
        if (!snap?.base64) throw new Error("Camera 2 snapshot failed — is it reachable?");
        base64 = snap.base64;
        uri    = snap.uri ?? "";
      } else if (Platform.OS === "web") {
        const photo = await webCamRef.current?.takePicture?.();
        if (!photo?.base64) throw new Error("Camera not ready — please wait.");
        base64 = photo.base64;
        uri    = photo.uri;
      } else {
        if (!nativeCamRef.current) throw new Error("Camera not ready.");
        const photo = await nativeCamRef.current.takePictureAsync({
          base64: true, quality: 0.85, skipProcessing: false,
        });
        if (!photo?.base64) throw new Error("Failed to capture photo.");
        base64 = photo.base64;
        uri    = photo.uri ?? "";
      }

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Polarised-lens filter (glare reduction)
      if (polarOn) {
        setPolarising(true);
        base64 = await polarFilter(base64);
        setPolarising(false);
      }

      // ── Regular mode: push to Scan tab for full streaming analysis ──────────
      LiveScanStore.push(base64, uri, "live");
      router.navigate("/");   // go to Scan tab (no-op if already there)

    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setPolarising(false);
      setScanning(false);
    }
  }, [scanning, polarOn, cam2Connected, cam2, insta360]);

  // ── Pick from gallery & analyse ──────────────────────────────────────────
  const pickFromGallery = useCallback(async () => {
    if (galleryPicking || scanning) return;

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError("Gallery access denied — allow Photos in Settings.");
        return;
      }

      setGalleryPicking(true);
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
        allowsEditing: false,
        base64: false,
      });

      if (picked.canceled || !picked.assets?.length) return;

      const asset = picked.assets[0];
      setScanning(true);
      setError(null);

      // Convert to JPEG base64 (fixes WebP / HEIC on Android/iOS)
      const jpeg = await manipulateAsync(
        asset.uri,
        [],
        { compress: 0.85, format: SaveFormat.JPEG, base64: true }
      );
      if (!jpeg.base64) throw new Error("Could not read image.");

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Polarised-lens filter (glare reduction)
      let filtered = jpeg.base64;
      if (polarOn) {
        setPolarising(true);
        filtered = await polarFilter(jpeg.base64);
        setPolarising(false);
      }

      // Send to Scan tab for full streaming analysis
      LiveScanStore.push(filtered, asset.uri, "live");
      router.navigate("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gallery analysis failed.";
      setError(msg);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setPolarising(false);
      setScanning(false);
      setGalleryPicking(false);
    }
  }, [galleryPicking, scanning, polarOn]);

  // ── Open native camera app → send to Scan tab ────────────────────────────
  const openCamera = useCallback(async () => {
    if (galleryPicking || scanning) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setError("Camera access denied — allow in Settings.");
        return;
      }
      setGalleryPicking(true);
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.85,
        allowsEditing: false,
        exif: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setScanning(true);
      setError(null);
      const jpeg = await manipulateAsync(
        asset.uri,
        [],
        { compress: 0.85, format: SaveFormat.JPEG, base64: true }
      );
      if (!jpeg.base64) throw new Error("Could not read image.");
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Polarised-lens filter (glare reduction)
      let filtered = jpeg.base64;
      if (polarOn) {
        setPolarising(true);
        filtered = await polarFilter(jpeg.base64);
        setPolarising(false);
      }

      LiveScanStore.push(filtered, asset.uri, "live");
      router.navigate("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Camera failed.";
      setError(msg);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setPolarising(false);
      setScanning(false);
      setGalleryPicking(false);
    }
  }, [galleryPicking, scanning, polarOn]);

  // ── Boat mode lifecycle — auto-starts scan on entry; stops on exit ────────
  useEffect(() => {
    if (boatMode) {
      if (!isBoatLiveRef.current) startBoatLive();
    } else {
      stopBoatLive();
      setBoatSummaryNarration(null);
      setFishTrackingText(null);
      setCrocAlertActive(false);
      // result is intentionally preserved so the card shows it after exiting
    }
    return () => { stopBoatLive(); };
  }, [boatMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Shared overlay UI ───────────────────────────────────────────────────
  function renderOverlays(isNative: boolean) {
    return (
      <>
        {/* Boat mode tint */}
        {boatMode && (
          <View style={[StyleSheet.absoluteFill, styles.boatTint]} pointerEvents="none" />
        )}

        {/* Boat mode fish-detection grid */}
        {boatMode && boatLive && (
          <BoatGrid detectedZones={detectedZones} frameZones={frameZones} movementVector={movementVector} movingZones={movingZones} staticZones={staticZones} />
        )}

        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: (isNative ? insets.top : topPad) + 8 }]}>
          {!boatMode && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <TouchableOpacity
                style={[styles.chip, { backgroundColor: autoSpeak ? `${colors.primary}44` : "#00000077", borderColor: autoSpeak ? colors.primary : "#ffffff44" }]}
                onPress={() => { setAutoSpeak((v) => !v); if (autoSpeak) stopSpeaking(); }}
              >
                <Feather name={autoSpeak ? "volume-2" : "volume-x"} size={13} color={autoSpeak ? colors.primary : "#ffffffaa"} />
                <Text style={[styles.chipText, { color: autoSpeak ? colors.primary : "#ffffffaa" }]}>
                  {autoSpeak ? `${charInfo.emoji} Voice` : "Voice OFF"}
                </Text>
              </TouchableOpacity>

              {/* Polarised lens toggle */}
              <TouchableOpacity
                style={[styles.chip, polarOn
                  ? { backgroundColor: "#00a8ff22", borderColor: "#00a8ff88" }
                  : { backgroundColor: "#ffffff11", borderColor: "#ffffff33" }
                ]}
                onPress={() => setPolarOn((v) => !v)}
              >
                <Text style={{ fontSize: 11 }}>{polarOn ? "🔵" : "⚪"}</Text>
                <Text style={[styles.chipText, { color: polarOn ? "#00a8ff" : "#ffffff66" }]}>
                  {polarising ? "Polarising…" : polarOn ? "Polarised" : "No Polar"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {boatMode && (
            <View style={[styles.chip, { backgroundColor: "#aaff0022", borderColor: "#aaff0066" }]}>
              <MaterialCommunityIcons name="anchor" size={13} color="#aaff00" />
              <Text style={[styles.chipText, { color: "#aaff00" }]}>
                {boatLive
                  ? boatPhase === "capturing"
                    ? `📡 ${boatCaptureCount}/${BOAT_CAPTURE_COUNT}`
                    : boatPhase === "analyzing"
                    ? "🧠 Analysing…"
                    : boatPhase === "waiting"
                    ? `⏳ ${boatWaitRemaining}s`
                    : "🚤 LIVE"
                  : "🚤 BOAT MODE"}
              </Text>
            </View>
          )}

          {speaking && (
            <TouchableOpacity
              style={[styles.chip, { backgroundColor: `${charInfo.color}44`, borderColor: charInfo.color }]}
              onPress={stopSpeaking}
            >
              <SonarPulse size={12} active />
              <Text style={[styles.chipText, { color: charInfo.color }]}>Stop {charInfo.emoji}</Text>
            </TouchableOpacity>
          )}

          {/* Camera chips (top-right when not in boat mode) */}
          {!boatMode && (
            <View style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 6 }}>

              {/* ── Insta360 chip ─────────────────────────────────────────── */}
              <TouchableOpacity
                style={[
                  styles.chip,
                  insta360.status === "connected"
                    ? { backgroundColor: "#00d4aa22", borderColor: "#00d4aa88" }
                    : insta360.status === "searching"
                    ? { backgroundColor: "#ffd70022", borderColor: "#ffd70066" }
                    : { backgroundColor: "#ffffff11", borderColor: "#ffffff33" },
                ]}
                onPress={() => {
                  setCam2Panel(false);
                  setHudPanel(false);
                  setInsta360Panel(false);
                  router.push("/insta360");
                }}
              >
                <MaterialCommunityIcons
                  name="camera-wireless"
                  size={13}
                  color={
                    insta360.status === "connected"
                      ? "#00d4aa"
                      : insta360.status === "searching"
                      ? "#ffd700"
                      : "#ffffff88"
                  }
                />
                <Text
                  style={[
                    styles.chipText,
                    {
                      color:
                        insta360.status === "connected"
                          ? "#00d4aa"
                          : insta360.status === "searching"
                          ? "#ffd700"
                          : "#ffffff88",
                    },
                  ]}
                >
                  {insta360.status === "connected"
                    ? "📡 Insta360"
                    : insta360.status === "searching"
                    ? "Searching…"
                    : "Insta360"}
                </Text>
              </TouchableOpacity>

              {/* ── Camera 2 chip ─────────────────────────────────────────── */}
              <TouchableOpacity
                style={[
                  styles.chip,
                  cam2.status === "connected"
                    ? { backgroundColor: "#00a8ff22", borderColor: "#00a8ff88" }
                    : cam2.status === "searching"
                    ? { backgroundColor: "#ffd70022", borderColor: "#ffd70066" }
                    : { backgroundColor: "#ffffff11", borderColor: "#ffffff33" },
                ]}
                onPress={() => {
                  setInsta360Panel(false);
                  setHudPanel(false);
                  if (!cam2Panel) {
                    setCam2Panel(true);
                    if (cam2.status === "disconnected") cam2.startSearch();
                  } else {
                    setCam2Panel(false);
                    if (cam2.status === "searching") cam2.stopSearch();
                  }
                }}
              >
                <Feather
                  name="monitor"
                  size={13}
                  color={
                    cam2.status === "connected"
                      ? "#00a8ff"
                      : cam2.status === "searching"
                      ? "#ffd700"
                      : "#ffffff88"
                  }
                />
                <Text
                  style={[
                    styles.chipText,
                    {
                      color:
                        cam2.status === "connected"
                          ? "#00a8ff"
                          : cam2.status === "searching"
                          ? "#ffd700"
                          : "#ffffff88",
                    },
                  ]}
                >
                  {cam2.status === "connected"
                    ? "📺 WiFi Cam 1"
                    : cam2.status === "searching"
                    ? "Searching…"
                    : "WiFi Cam 1"}
                </Text>
              </TouchableOpacity>

              {/* ── SmartLife chip ────────────────────────────────────── */}
              <TouchableOpacity
                style={[
                  styles.chip,
                  cam2Connected && slConnectedCam
                    ? { backgroundColor: "#00d4aa22", borderColor: "#00d4aa88" }
                    : slScanner.scanning
                    ? { backgroundColor: "#ffd70022", borderColor: "#ffd70066" }
                    : smartlifePanel
                    ? { backgroundColor: "#00d4aa11", borderColor: "#00d4aa55" }
                    : { backgroundColor: "#ffffff11", borderColor: "#ffffff33" },
                ]}
                onPress={() => {
                  setInsta360Panel(false);
                  setCam2Panel(false);
                  setHudPanel(false);
                  const opening = !smartlifePanel;
                  setSmartlifePanel(opening);
                  if (opening && !slScanner.scanning) {
                    slScanner.clear();
                    slScanner.scan();
                  }
                }}
              >
                <MaterialCommunityIcons
                  name="cctv"
                  size={14}
                  color={
                    cam2Connected && slConnectedCam ? "#00d4aa"
                    : slScanner.scanning ? "#ffd700"
                    : "#ffffff88"
                  }
                />
                <Text style={[styles.chipText, {
                  color: cam2Connected && slConnectedCam ? "#00d4aa"
                    : slScanner.scanning ? "#ffd700"
                    : "#ffffff88",
                }]}>
                  {cam2Connected && slConnectedCam
                    ? "WiFi Cam 2 ✓"
                    : slScanner.scanning
                    ? "Scanning…"
                    : "WiFi Cam 2"}
                </Text>
              </TouchableOpacity>

              {/* ── Smart Glass HUD chip ─────────────────────────────────── */}
              <TouchableOpacity
                style={[
                  styles.chip,
                  hudPanel
                    ? { backgroundColor: "#ffd70022", borderColor: "#ffd70088" }
                    : { backgroundColor: "#ffffff11", borderColor: "#ffffff33" },
                ]}
                onPress={() => {
                  setInsta360Panel(false);
                  setCam2Panel(false);
                  setSmartlifePanel(false);
                  setHudPanel((v) => !v);
                }}
              >
                <MaterialCommunityIcons
                  name="glasses"
                  size={14}
                  color={hudPanel ? "#ffd700" : "#ffffff88"}
                />
                <Text style={[styles.chipText, { color: hudPanel ? "#ffd700" : "#ffffff88" }]}>
                  HUD
                </Text>
              </TouchableOpacity>

              <NarratorSettingsTrigger />
            </View>
          )}
        </View>

        {/* ── Insta360 connection panel ───────────────────────────────────── */}
        {insta360Panel && !boatMode && (
          <View
            style={{
              position: "absolute",
              top: (isNative ? insets.top : topPad) + 60,
              left: 12,
              right: 12,
              maxHeight: 560,
              backgroundColor: "#0a1628ee",
              borderRadius: 16,
              borderWidth: 1,
              borderColor:
                insta360.status === "connected" ? "#00d4aa66" : "#ffd70044",
              zIndex: 50,
              overflow: "hidden",
            }}
          >
          <ScrollView
            style={{ padding: 16 }}
            contentContainerStyle={{ gap: 12, paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <MaterialCommunityIcons name="camera-wireless" size={20} color="#00d4aa" />
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15, letterSpacing: 0.5 }}>
                  INSTA360 CONNECT
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => { setInsta360Panel(false); if (insta360.status === "searching") insta360.stopSearch(); }}
              >
                <Feather name="x" size={18} color="#ffffff88" />
              </TouchableOpacity>
            </View>

            {/* Status row */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              {insta360.status === "searching" && (
                <ActivityIndicator size="small" color="#ffd700" />
              )}
              {insta360.status === "connected" && (
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#00d4aa" }} />
              )}
              {insta360.status === "disconnected" && (
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#ffffff44" }} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ color: insta360.status === "connected" ? "#00d4aa" : insta360.status === "searching" ? "#ffd700" : "#ffffff88", fontWeight: "600", fontSize: 13 }}>
                  {insta360.status === "connected"
                    ? `✓ Connected — ${insta360.cameraInfo?.model ?? "Insta360"}`
                    : insta360.status === "searching"
                    ? "Searching for Insta360 at 192.168.42.1…"
                    : "Not connected"}
                </Text>
                {insta360.cameraInfo && (
                  <Text style={{ color: "#ffffff55", fontSize: 11, marginTop: 2 }}>
                    {insta360.cameraInfo.manufacturer} · FW {insta360.cameraInfo.firmwareVersion}
                  </Text>
                )}
              </View>
            </View>

            {/* Instructions (when not connected) */}
            {insta360.status !== "connected" && (
              <View style={{ backgroundColor: "#ffffff0a", borderRadius: 10, padding: 12, gap: 6 }}>
                <Text style={{ color: "#ffffffcc", fontSize: 12, lineHeight: 18 }}>
                  1. On your Insta360 camera, go to{"\n"}
                  {'   '}⚙️ Settings → WiFi / Bluetooth → Enable WiFi{"\n"}
                  2. Connect your phone to the Insta360 WiFi network{"\n"}
                  3. Return here — connection detects automatically
                </Text>
              </View>
            )}

            {/* Action buttons */}
            <View style={{ flexDirection: "row", gap: 8 }}>
              {insta360.status !== "connected" && (
                <>
                  <TouchableOpacity
                    onPress={openWifiSettings}
                    style={{
                      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                      gap: 6, backgroundColor: "#00a8ff22", borderRadius: 10,
                      borderWidth: 1, borderColor: "#00a8ff66", paddingVertical: 10,
                    }}
                    activeOpacity={0.8}
                  >
                    <Feather name="wifi" size={15} color="#00a8ff" />
                    <Text style={{ color: "#00a8ff", fontWeight: "600", fontSize: 13 }}>Open WiFi Settings</Text>
                  </TouchableOpacity>
                  {insta360.status === "disconnected" ? (
                    <TouchableOpacity
                      onPress={() => insta360.startSearch()}
                      style={{
                        flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                        gap: 6, backgroundColor: "#ffd70022", borderRadius: 10,
                        borderWidth: 1, borderColor: "#ffd70066", paddingVertical: 10,
                      }}
                      activeOpacity={0.8}
                    >
                      <MaterialCommunityIcons name="radar" size={15} color="#ffd700" />
                      <Text style={{ color: "#ffd700", fontWeight: "600", fontSize: 13 }}>Start Search</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={() => insta360.stopSearch()}
                      style={{
                        flexDirection: "row", alignItems: "center", justifyContent: "center",
                        gap: 6, backgroundColor: "#ff440022", borderRadius: 10,
                        borderWidth: 1, borderColor: "#ff440066", paddingVertical: 10, paddingHorizontal: 14,
                      }}
                      activeOpacity={0.8}
                    >
                      <Feather name="square" size={14} color="#ff4400" />
                      <Text style={{ color: "#ff4400", fontWeight: "600", fontSize: 13 }}>Stop</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

              {insta360.status === "connected" && (
                <TouchableOpacity
                  onPress={insta360Snap}
                  disabled={insta360Snapping || insta360.snapping}
                  style={{
                    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                    gap: 8, backgroundColor: "#00d4aa", borderRadius: 12, paddingVertical: 12,
                    opacity: (insta360Snapping || insta360.snapping) ? 0.5 : 1,
                  }}
                  activeOpacity={0.8}
                >
                  {(insta360Snapping || insta360.snapping) ? (
                    <ActivityIndicator size="small" color="#0a1628" />
                  ) : (
                    <MaterialCommunityIcons name="camera-wireless" size={18} color="#0a1628" />
                  )}
                  <Text style={{ color: "#0a1628", fontWeight: "800", fontSize: 14, letterSpacing: 0.4 }}>
                    {(insta360Snapping || insta360.snapping) ? "Capturing…" : "📸 Snap & Scan"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* ── Pipeline 1 + 2 — only shown when connected ───────────────── */}
            {insta360.status === "connected" && (
              <View style={{ marginTop: 4 }}>
                <Insta360PipelineCard
                  surface={pipelines.surface}
                  croc={pipelines.croc}
                  scanning={pipelines.scanning}
                  running={pipelines.running}
                  scanCount={pipelines.scanCount}
                  lastError={pipelines.lastError}
                  onStart={pipelines.start}
                  onStop={pipelines.stop}
                />
              </View>
            )}
          </ScrollView>
          </View>
        )}

        {/* ── Camera 2 connection panel ────────────────────────────────────── */}
        {cam2Panel && !boatMode && (
          <View
            style={{
              position: "absolute",
              top: (isNative ? insets.top : topPad) + 60,
              left: 12,
              right: 12,
              maxHeight: 480,
              backgroundColor: "#0a1628ee",
              borderRadius: 16,
              borderWidth: 1,
              borderColor: cam2.status === "connected" ? "#00a8ff66" : "#ffd70044",
              zIndex: 50,
              overflow: "hidden",
            }}
          >
            <ScrollView
              style={{ padding: 16 }}
              contentContainerStyle={{ gap: 12, paddingBottom: 8 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Header */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Feather name="monitor" size={20} color="#00a8ff" />
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15, letterSpacing: 0.5 }}>
                    SONAR CAM 2
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => { setCam2Panel(false); if (cam2.status === "searching") cam2.stopSearch(); }}
                >
                  <Feather name="x" size={18} color="#ffffff88" />
                </TouchableOpacity>
              </View>

              {/* Status row */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                {cam2.status === "searching" && <ActivityIndicator size="small" color="#ffd700" />}
                {cam2.status === "connected" && (
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#00a8ff" }} />
                )}
                {cam2.status === "disconnected" && (
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#ffffff44" }} />
                )}
                <Text style={{
                  color: cam2.status === "connected" ? "#00a8ff" : cam2.status === "searching" ? "#ffd700" : "#ffffff88",
                  fontWeight: "600", fontSize: 13, flex: 1,
                }}>
                  {cam2.status === "connected"
                    ? `✓ Connected — ${cam2.ip}`
                    : cam2.status === "searching"
                    ? `Searching at ${cam2.ip}…`
                    : "Not connected"}
                </Text>
              </View>

              {/* IP address input */}
              <View style={{ gap: 4 }}>
                <Text style={{ color: "#ffffff88", fontSize: 11, fontWeight: "600", letterSpacing: 0.5 }}>
                  CAMERA IP ADDRESS
                </Text>
                <TextInput
                  style={{
                    backgroundColor: "#ffffff0f", borderRadius: 8, borderWidth: 1,
                    borderColor: "#00a8ff44", color: "#fff", fontFamily: "Inter_400Regular",
                    fontSize: 14, paddingHorizontal: 12, paddingVertical: 8,
                  }}
                  value={cam2IpEdit ?? cam2.ip}
                  onChangeText={(t) => setCam2IpEdit(t)}
                  onBlur={() => {
                    if (cam2IpEdit !== null) { cam2.setIp(cam2IpEdit); setCam2IpEdit(null); }
                  }}
                  placeholder={DEFAULT_CAM2_IP}
                  placeholderTextColor="#ffffff44"
                  keyboardType="decimal-pad"
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    if (cam2IpEdit !== null) { cam2.setIp(cam2IpEdit); setCam2IpEdit(null); }
                  }}
                />
              </View>

              {/* Snapshot path input */}
              <View style={{ gap: 4 }}>
                <Text style={{ color: "#ffffff88", fontSize: 11, fontWeight: "600", letterSpacing: 0.5 }}>
                  SNAPSHOT PATH
                </Text>
                <TextInput
                  style={{
                    backgroundColor: "#ffffff0f", borderRadius: 8, borderWidth: 1,
                    borderColor: "#00a8ff44", color: "#fff", fontFamily: "Inter_400Regular",
                    fontSize: 14, paddingHorizontal: 12, paddingVertical: 8,
                  }}
                  value={cam2PathEdit ?? cam2.path}
                  onChangeText={(t) => setCam2PathEdit(t)}
                  onBlur={() => {
                    if (cam2PathEdit !== null) { cam2.setPath(cam2PathEdit); setCam2PathEdit(null); }
                  }}
                  placeholder={DEFAULT_CAM2_PATH}
                  placeholderTextColor="#ffffff44"
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    if (cam2PathEdit !== null) { cam2.setPath(cam2PathEdit); setCam2PathEdit(null); }
                  }}
                />
                <Text style={{ color: "#ffffff44", fontSize: 10 }}>
                  Full URL: http://{cam2.ip}{cam2.path}
                </Text>
              </View>

              {/* Instructions */}
              <View style={{ backgroundColor: "#ffffff0a", borderRadius: 10, padding: 12, gap: 6 }}>
                <Text style={{ color: "#ffffffcc", fontSize: 12, lineHeight: 18 }}>
                  Common snapshot paths:{"\n"}
                  {"  "}/snapshot · /snapshot.jpg · /photo{"\n"}
                  {"  "}/cgi-bin/snapshot.cgi (Hikvision){"\n"}
                  {"  "}/image.jpg · /mjpeg/snap.jpg{"\n\n"}
                  Connect your phone to the camera's WiFi,{"\n"}
                  enter its IP, then tap Connect.
                </Text>
              </View>

              {/* Action buttons */}
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  onPress={openWifiSettings}
                  style={{
                    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                    gap: 6, backgroundColor: "#00a8ff22", borderRadius: 10,
                    borderWidth: 1, borderColor: "#00a8ff66", paddingVertical: 10,
                  }}
                  activeOpacity={0.8}
                >
                  <Feather name="wifi" size={15} color="#00a8ff" />
                  <Text style={{ color: "#00a8ff", fontWeight: "600", fontSize: 13 }}>WiFi Settings</Text>
                </TouchableOpacity>

                {cam2.status === "disconnected" ? (
                  <TouchableOpacity
                    onPress={() => {
                      if (cam2IpEdit !== null) { cam2.setIp(cam2IpEdit); setCam2IpEdit(null); }
                      if (cam2PathEdit !== null) { cam2.setPath(cam2PathEdit); setCam2PathEdit(null); }
                      cam2.startSearch();
                    }}
                    style={{
                      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                      gap: 6, backgroundColor: "#ffd70022", borderRadius: 10,
                      borderWidth: 1, borderColor: "#ffd70066", paddingVertical: 10,
                    }}
                    activeOpacity={0.8}
                  >
                    <Feather name="radio" size={15} color="#ffd700" />
                    <Text style={{ color: "#ffd700", fontWeight: "600", fontSize: 13 }}>Connect</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => cam2.stopSearch()}
                    style={{
                      flexDirection: "row", alignItems: "center", justifyContent: "center",
                      gap: 6, backgroundColor: "#ff440022", borderRadius: 10,
                      borderWidth: 1, borderColor: "#ff440066", paddingVertical: 10, paddingHorizontal: 14,
                    }}
                    activeOpacity={0.8}
                  >
                    <Feather name="square" size={14} color="#ff4400" />
                    <Text style={{ color: "#ff4400", fontWeight: "600", fontSize: 13 }}>Disconnect</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Live preview thumbnail when connected */}
              {cam2.status === "connected" && (
                <View style={{ borderRadius: 10, overflow: "hidden", aspectRatio: 16 / 9 }}>
                  <Image
                    source={{ uri: `http://${cam2.ip}${cam2.path}?t=${cam2.tick}` }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                    onLoad={cam2.onPreviewLoad}
                    onError={cam2.onPreviewError}
                  />
                  <View style={{
                    position: "absolute", bottom: 0, left: 0, right: 0,
                    backgroundColor: "#00000066", paddingHorizontal: 8, paddingVertical: 4,
                    flexDirection: "row", alignItems: "center", gap: 6,
                  }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#00a8ff" }} />
                    <Text style={{ color: "#00a8ffcc", fontSize: 10, fontWeight: "600" }}>
                      LIVE · frame {cam2.tick}
                    </Text>
                    <Text style={{ color: "#ffffff66", fontSize: 10, marginLeft: "auto" }}>
                      Tap SCAN to analyse
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        )}

        {/* ── SmartLife auto-discovery panel ──────────────────────────────────── */}
        {smartlifePanel && !boatMode && (
          <View style={{
            position: "absolute",
            top: (isNative ? insets.top : topPad) + 60,
            left: 12, right: 12,
            maxHeight: 560,
            backgroundColor: "#0a1628ee",
            borderRadius: 16,
            borderWidth: 1,
            borderColor: cam2Connected && slConnectedCam ? "#00d4aa66" : "#00d4aa33",
            zIndex: 50,
            overflow: "hidden",
          }}>
            <ScrollView
              style={{ padding: 16 }}
              contentContainerStyle={{ gap: 12, paddingBottom: 12 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Header */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <MaterialCommunityIcons name="cctv" size={20} color="#00d4aa" />
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15, letterSpacing: 0.5 }}>
                    ALL WIFI CAM 2 — AUTO-CONNECT
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSmartlifePanel(false)}>
                  <Feather name="x" size={18} color="#ffffff88" />
                </TouchableOpacity>
              </View>

              {/* Status row */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {cam2Connected && slConnectedCam ? (
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#00d4aa" }} />
                ) : slScanner.scanning ? (
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#ffd700" }} />
                ) : (
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#ffffff44" }} />
                )}
                <Text style={{ color: cam2Connected && slConnectedCam ? "#00d4aa" : slScanner.scanning ? "#ffd700" : "#ffffff88", fontWeight: "600", fontSize: 13, flex: 1 }}>
                  {cam2Connected && slConnectedCam
                    ? `✓ Connected — ${slConnectedCam.ip}${slConnectedCam.snapshotPath}`
                    : slScanner.scanning
                    ? "Scanning WiFi for cameras…"
                    : slScanner.discovered.length > 0
                    ? `Found ${slScanner.discovered.length} camera(s)`
                    : "No cameras detected"}
                </Text>
              </View>

              {/* Discovered cameras list */}
              {slScanner.discovered.map((cam) => (
                <View key={cam.id} style={{
                  backgroundColor: "#00d4aa0a",
                  borderRadius: 10, borderWidth: 1, borderColor: "#00d4aa33",
                  padding: 12, gap: 8,
                }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <MaterialCommunityIcons name="cctv" size={18} color="#00d4aa" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>{cam.model}</Text>
                      <Text style={{ color: "#ffffff88", fontSize: 11 }}>
                        {cam.ip}{cam.snapshotPath} · {cam.responseMs}ms
                      </Text>
                    </View>
                    <View style={{ backgroundColor: "#00d4aa22", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ color: "#00d4aa", fontSize: 10, fontWeight: "700" }}>LIVE</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setSlConnecting(true);
                      cam2.setIp(cam.ip);
                      cam2.setPath(cam.snapshotPath);
                      cam2.stopSearch();
                      setTimeout(() => {
                        cam2.startSearch();
                        setSlConnectedCam(cam);
                        setSlConnecting(false);
                        setCam2Panel(false);
                      }, 200);
                    }}
                    disabled={slConnecting}
                    style={{
                      flexDirection: "row", alignItems: "center", justifyContent: "center",
                      gap: 8, backgroundColor: "#00d4aa22", borderRadius: 10,
                      borderWidth: 1, borderColor: "#00d4aa66", paddingVertical: 10,
                      opacity: slConnecting ? 0.5 : 1,
                    }}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name="link-variant" size={16} color="#00d4aa" />
                    <Text style={{ color: "#00d4aa", fontWeight: "700", fontSize: 13 }}>
                      {slConnecting ? "Connecting…" : "Auto-Connect to Live Tab"}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}

              {/* Rescan button */}
              <TouchableOpacity
                onPress={() => { slScanner.clear(); slScanner.scan(); }}
                disabled={slScanner.scanning}
                style={{
                  flexDirection: "row", alignItems: "center", justifyContent: "center",
                  gap: 8, backgroundColor: "#ffffff0f", borderRadius: 10,
                  borderWidth: 1, borderColor: "#ffffff22", paddingVertical: 10,
                  opacity: slScanner.scanning ? 0.5 : 1,
                }}
                activeOpacity={0.8}
              >
                <Feather name="refresh-cw" size={14} color="#ffffff88" />
                <Text style={{ color: "#ffffff88", fontWeight: "600", fontSize: 13 }}>
                  {slScanner.scanning ? "Scanning…" : "Rescan WiFi"}
                </Text>
              </TouchableOpacity>

              {/* Disconnect button when connected */}
              {cam2Connected && slConnectedCam && (
                <TouchableOpacity
                  onPress={() => { cam2.stopSearch(); setSlConnectedCam(null); }}
                  style={{
                    flexDirection: "row", alignItems: "center", justifyContent: "center",
                    gap: 8, backgroundColor: "#ff440011", borderRadius: 10,
                    borderWidth: 1, borderColor: "#ff440044", paddingVertical: 10,
                  }}
                  activeOpacity={0.8}
                >
                  <Feather name="square" size={14} color="#ff4400" />
                  <Text style={{ color: "#ff4400", fontWeight: "600", fontSize: 13 }}>Disconnect</Text>
                </TouchableOpacity>
              )}

              {/* Live preview thumbnail */}
              {cam2Connected && slConnectedCam && (
                <View style={{ borderRadius: 10, overflow: "hidden", aspectRatio: 16 / 9 }}>
                  <Image
                    source={{ uri: `http://${cam2.ip}${cam2.path}?t=${cam2.tick}` }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                    onLoad={cam2.onPreviewLoad}
                    onError={cam2.onPreviewError}
                  />
                  <View style={{
                    position: "absolute", bottom: 0, left: 0, right: 0,
                    backgroundColor: "#00000066", paddingHorizontal: 8, paddingVertical: 4,
                    flexDirection: "row", alignItems: "center", gap: 6,
                  }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#00d4aa" }} />
                    <Text style={{ color: "#00d4aacc", fontSize: 10, fontWeight: "600" }}>
                      SMARTLIFE LIVE · frame {cam2.tick}
                    </Text>
                    <Text style={{ color: "#ffffff66", fontSize: 10, marginLeft: "auto" }}>
                      Tap SCAN to analyse
                    </Text>
                  </View>
                </View>
              )}

              {/* Setup guide */}
              <View style={{ backgroundColor: "#ffffff0a", borderRadius: 10, padding: 12, gap: 6 }}>
                <Text style={{ color: "#00d4aa", fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>
                  SETUP GUIDE
                </Text>
                <Text style={{ color: "#ffffffbb", fontSize: 12, lineHeight: 18 }}>
                  Works with any WiFi camera on your local network:{"\n"}
                  SmartLife · Swann · Reolink · Hikvision · ONVIF{"\n\n"}
                  1. Connect phone to same WiFi as your camera{"\n"}
                  2. Tap Rescan — all discovered cameras appear above{"\n"}
                  3. Tap "Auto-Connect" — feed streams in the Live tab{"\n\n"}
                  Common snapshot paths:{"\n"}
                  {"  "}/snapshot · /snapshot.jpg · /image.jpg{"\n"}
                  {"  "}/cgi-bin/snapshot.cgi (Hikvision / Reolink)
                </Text>
              </View>
            </ScrollView>
          </View>
        )}

        {/* ── Smart Glass HUD panel ─────────────────────────────────────────── */}
        {hudPanel && !boatMode && (
          <View
            style={{
              position: "absolute",
              top: (isNative ? insets.top : topPad) + 60,
              left: 12, right: 12,
              maxHeight: 500,
              backgroundColor: "#0a1628ee",
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "#ffd70044",
              zIndex: 50,
              overflow: "hidden",
            }}
          >
            <ScrollView
              style={{ padding: 16 }}
              contentContainerStyle={{ gap: 14, paddingBottom: 12 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Header */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <MaterialCommunityIcons name="glasses" size={20} color="#ffd700" />
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15, letterSpacing: 0.5 }}>
                    SMART GLASS HUD
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setHudPanel(false)}>
                  <Feather name="x" size={18} color="#ffffff88" />
                </TouchableOpacity>
              </View>

              {/* Description */}
              <Text style={{ color: "#ffffffaa", fontSize: 13, lineHeight: 20 }}>
                Every scan result is pushed to the HUD page in real-time. Open the URL below on your smart glasses browser — results update automatically after each SCAN.
              </Text>

              {/* HUD URL display */}
              <View style={{ backgroundColor: "#ffd70012", borderRadius: 10, borderWidth: 1, borderColor: "#ffd70033", padding: 14, gap: 6 }}>
                <Text style={{ color: "#ffd700", fontSize: 10, fontWeight: "700", letterSpacing: 2 }}>HUD URL</Text>
                <Text style={{ color: "#fff", fontSize: 12, fontFamily: "Inter_400Regular", letterSpacing: 0.3 }} selectable>
                  {HUD_PAGE_URL}
                </Text>
                <Text style={{ color: "#ffffff55", fontSize: 10 }}>
                  Point glasses browser at this address · updates live via SSE
                </Text>
              </View>

              {/* What the HUD shows */}
              <View style={{ backgroundColor: "#ffffff0a", borderRadius: 10, padding: 12, gap: 6 }}>
                <Text style={{ color: "#ffd700", fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>HUD DISPLAYS</Text>
                <Text style={{ color: "#ffffffbb", fontSize: 12, lineHeight: 18 }}>
                  🐟 Species identified + confidence bar{"\n"}
                  📏 Fish count · depth · arch count · water temp{"\n"}
                  💡 Lure suggestion strip{"\n"}
                  🐊 Croc alerts · 🐦 bird activity · 🎣 Barra %{"\n"}
                  🕐 Live clock · source badge (Live / Boat / Cam 2)
                </Text>
              </View>

              {/* Audio note */}
              <View style={{ backgroundColor: "#ffffff0a", borderRadius: 10, padding: 12, gap: 4 }}>
                <Text style={{ color: "#ffd700", fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>AUDIO / EARPHONES</Text>
                <Text style={{ color: "#ffffffbb", fontSize: 12, lineHeight: 18 }}>
                  The AI voice narrator already plays through any connected Bluetooth device — including earphones in your glasses.{"\n\n"}
                  Connect glasses earphones as a Bluetooth audio device in Android settings. Audio from Barra Brain, Croc Brain, and boat-mode narration routes automatically.
                </Text>
              </View>

              {/* Setup buttons */}
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  onPress={openWifiSettings}
                  style={{
                    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                    gap: 6, backgroundColor: "#00a8ff22", borderRadius: 10,
                    borderWidth: 1, borderColor: "#00a8ff66", paddingVertical: 10,
                  }}
                  activeOpacity={0.8}
                >
                  <Feather name="wifi" size={15} color="#00a8ff" />
                  <Text style={{ color: "#00a8ff", fontWeight: "600", fontSize: 12 }}>WiFi Settings</Text>
                </TouchableOpacity>
                {Platform.OS === "android" && IntentLauncher && (
                  <TouchableOpacity
                    onPress={() => {
                      try {
                        IntentLauncher.startActivityAsync("android.settings.BLUETOOTH_SETTINGS");
                      } catch {
                        Linking.openURL("android.settings.BLUETOOTH_SETTINGS").catch(() => {});
                      }
                    }}
                    style={{
                      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                      gap: 6, backgroundColor: "#ffd70022", borderRadius: 10,
                      borderWidth: 1, borderColor: "#ffd70066", paddingVertical: 10,
                    }}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name="bluetooth-audio" size={15} color="#ffd700" />
                    <Text style={{ color: "#ffd700", fontWeight: "600", fontSize: 12 }}>BT Audio</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Croc alert banner */}
        {boatMode && crocAlertActive && (
          <View style={styles.crocBanner} pointerEvents="none">
            <Text style={styles.crocBannerText}>🐊 CROC ALERT — CHECK SURROUNDINGS</Text>
          </View>
        )}

        {/* Fish tracking text */}
        {boatMode && fishTrackingText && (
          <View style={styles.fishTrackBanner} pointerEvents="none">
            <Text style={styles.fishTrackText}>{fishTrackingText}</Text>
          </View>
        )}

        {/* Aim guide */}
        <View style={[styles.aimGuide, boatMode && styles.aimGuideLive]} pointerEvents="none">
          <View style={[styles.aimCorner, styles.aimTL, { borderColor: boatMode ? "#aaff00" : cam2Connected ? "#00a8ff" : colors.primary }]} />
          <View style={[styles.aimCorner, styles.aimTR, { borderColor: boatMode ? "#aaff00" : cam2Connected ? "#00a8ff" : colors.primary }]} />
          <View style={[styles.aimCorner, styles.aimBL, { borderColor: boatMode ? "#aaff00" : cam2Connected ? "#00a8ff" : colors.primary }]} />
          <View style={[styles.aimCorner, styles.aimBR, { borderColor: boatMode ? "#aaff00" : cam2Connected ? "#00a8ff" : colors.primary }]} />
          <Text style={[styles.aimLabel, { color: boatMode ? "#aaff00" : cam2Connected ? "#00a8ff" : colors.primary }]}>
            {boatMode
              ? boatPhase === "analyzing"
                ? `🧠 Analysing ${boatCaptureCount} frames…`
                : boatPhase === "waiting"
                ? `⏳ Next cycle in ${boatWaitRemaining}s`
                : boatPhase === "capturing"
                ? `📡 Capturing ${boatCaptureCount}/${BOAT_CAPTURE_COUNT}`
                : "🚤 Boat Live"
              : cam2Connected
                ? `📺 CAM 2 · ${cam2.ip} · frame ${cam2.tick}`
                : "Aim at sonar screen"}
          </Text>
          {boatMode && boatPhase === "analyzing" && (
            <View style={[styles.cdBadge, { borderColor: "#aaff0066", backgroundColor: "#aaff0011" }]}>
              <ActivityIndicator size="small" color="#aaff00" />
            </View>
          )}
          {boatMode && boatPhase === "capturing" && (
            <View style={[styles.cdBadge, { borderColor: "#aaff0066", backgroundColor: "#aaff0011" }]}>
              <Text style={[styles.cdText, { color: "#aaff00" }]}>{boatCaptureCount}/{BOAT_CAPTURE_COUNT}</Text>
            </View>
          )}
          {boatMode && boatPhase === "waiting" && (
            <View style={[styles.cdBadge, { borderColor: "#aaff0066", backgroundColor: "#aaff0011" }]}>
              <Text style={[styles.cdText, { color: "#aaff00" }]}>{boatWaitRemaining}</Text>
              <Text style={[styles.cdSub, { color: "#aaff0099" }]}>sec</Text>
            </View>
          )}
        </View>

        {/* Boat narration card */}
        {boatMode && boatSummaryNarration && (
          <View style={[styles.resultOverlay, { backgroundColor: "#0a162899", borderColor: "#aaff0055" }]}>
            <View style={styles.resultRow}>
              <Text style={{ fontSize: 16 }}>🎙️</Text>
              <Text style={[styles.resultSpecies, { color: "#aaff00" }]}>Cycle {boatCycleNum}</Text>
            </View>
            <ScrollView style={{ maxHeight: 110 }} showsVerticalScrollIndicator={false}>
              <Text style={[styles.resultDetail, { color: "#ffffffcc", lineHeight: 18 }]}>{boatSummaryNarration}</Text>
            </ScrollView>
            <View style={styles.resultActions}>
              <TouchableOpacity
                style={[styles.replayBtn, { backgroundColor: "#aaff0022", borderColor: "#aaff0044" }]}
                onPress={() => { if (speaking) stopSpeaking(); else speak(boatSummaryNarration); }}
              >
                <Feather name={speaking ? "volume-x" : "volume-2"} size={14} color="#aaff00" />
                <Text style={[styles.replayText, { color: "#aaff00" }]}>{speaking ? "Stop" : "🎤 Replay"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.clearBtn, { borderColor: "#aaff0033" }]}
                onPress={() => { setBoatSummaryNarration(null); stopSpeaking(); }}
              >
                <Feather name="x" size={14} color="#aaff0088" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Bottom bar */}
        <View style={[styles.bottomBar, { paddingBottom: botPad }]}>
          {/* BOAT MODE toggle + GO LIVE / STOP LIVE */}
          <TouchableOpacity
            style={[
              styles.boatModeBtn,
              boatMode
                ? { backgroundColor: "#0a162888", borderColor: "#aaff0066" }
                : { backgroundColor: "#0a162888", borderColor: "#aaff0066" },
            ]}
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              setBoatMode((v) => !v);
              setResult(null);
            }}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="anchor" size={18} color="#aaff00" />
            <Text style={[styles.boatModeBtnText, { color: "#aaff00" }]}>
              {boatMode ? "🚤 EXIT BOAT MODE" : "🚤 BOAT MODE"}
            </Text>
          </TouchableOpacity>

          {/* GO LIVE / STOP LIVE — only shown in boat mode */}
          {boatMode && (
            <TouchableOpacity
              style={[
                styles.boatModeBtn,
                boatLive
                  ? { backgroundColor: "#ff2200", borderColor: "#ff220088" }
                  : { backgroundColor: "#aaff00", borderColor: "#aaff00" },
              ]}
              onPress={() => {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                if (boatLive) { stopBoatLive(); } else { startBoatLive(); }
              }}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name={boatLive ? "stop-circle" : "broadcast"} size={20} color={boatLive ? "#fff" : "#0a1628"} />
              <Text style={[styles.boatModeBtnText, { color: boatLive ? "#fff" : "#0a1628" }]}>
                {boatLive ? "⏹ STOP LIVE" : "▶ GO LIVE"}
              </Text>
              {boatLive && <View style={styles.boatLiveDot} />}
            </TouchableOpacity>
          )}

          {/* VISION MODE — primary live detection button */}
          {!boatMode && (
            <TouchableOpacity
              style={[styles.boatModeBtn, { backgroundColor: "#00d4aa22", borderColor: "#00d4aa88" }]}
              onPress={() => {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                startVisionMode();
              }}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="eye-circle-outline" size={22} color="#00d4aa" />
              <Text style={[styles.boatModeBtnText, { color: "#00d4aa", fontSize: 14 }]}>👁 VISION MODE</Text>
            </TouchableOpacity>
          )}

          <Text style={[styles.hint, { color: "#ffffffcc" }]}>
            {boatMode
              ? boatLive
                ? "📡 Capturing every 3s · best 2 saved · voice ON"
                : "Tap GO LIVE to start continuous boat scanning"
              : "Tap VISION MODE to start live AI detection"}
          </Text>
        </View>

        {/* ── AI VISUAL FEED (removed) — placeholder anchor */}
        {false && (
          <View style={[StyleSheet.absoluteFill, styles.visualFeedBg]}>
            {/* Visual feed top label */}
            <View style={[styles.visualFeedHeader, { paddingTop: (isNative ? insets.top : topPad) + 10 }]}>
              <SonarPulse size={10} active={scanning} />
              <Text style={styles.visualFeedTitle}>📡 AI VISUAL FEED</Text>
              <TouchableOpacity onPress={() => setFeedView("camera")} style={styles.visualFeedClose}>
                <Feather name="camera" size={13} color="#00d4aacc" />
                <Text style={styles.visualFeedCloseText}>CAMERA</Text>
              </TouchableOpacity>
            </View>

            {/* No result yet — idle state */}
            {!result && !scanning && (
              <View style={styles.visualFeedIdle}>
                <MaterialCommunityIcons name="fish" size={72} color="#00d4aa18" />
                <Text style={styles.visualFeedIdleText}>
                  {"Tap ● SCAN below\nto see AI analysis here"}
                </Text>
              </View>
            )}

            {/* Scanning spinner */}
            {scanning && (
              <View style={styles.visualFeedIdle}>
                <ActivityIndicator size="large" color="#00d4aa" />
                <Text style={[styles.visualFeedIdleText, { color: "#00d4aacc" }]}>Analysing sonar…</Text>
              </View>
            )}

            {/* Result — rich full-screen AI data card */}
            {result && !scanning && (
              <ScrollView
                contentContainerStyle={styles.visualFeedContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Giant fish count */}
                <View style={{ alignItems: "center", marginBottom: 8 }}>
                  <Text style={styles.visualFeedCount}>{result.fishCount}</Text>
                  <Text style={styles.visualFeedCountLabel}>FISH DETECTED</Text>
                </View>

                {/* Species */}
                <Text style={styles.visualFeedSpecies}>{result.species}</Text>

                {/* Depth + distance */}
                <Text style={styles.visualFeedDepth}>{result.depth} · {result.distance}</Text>

                {/* Confidence bar */}
                <View style={styles.visualFeedConfWrap}>
                  <View style={styles.visualFeedConfTrack}>
                    <View
                      style={[
                        styles.visualFeedConfFill,
                        {
                          width: `${result.confidence}%` as any,
                          backgroundColor:
                            result.confidence > 80
                              ? "#00ff88"
                              : result.confidence > 60
                              ? "#ffd700"
                              : "#ff6600",
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.visualFeedConfText}>{result.confidence}% confidence</Text>
                </View>

                {/* Lure recommendation */}
                {result.lure ? (
                  <View style={styles.visualFeedLureCard}>
                    <Text style={styles.visualFeedLureLabel}>RECOMMENDED LURE</Text>
                    <Text style={styles.visualFeedLureName}>{result.lure}</Text>
                    {result.technique ? (
                      <Text style={styles.visualFeedTechnique}>{result.technique}</Text>
                    ) : null}
                  </View>
                ) : null}

                {/* AI suggestion */}
                {result.suggestion ? (
                  <Text style={styles.visualFeedSuggestion}>"{result.suggestion}"</Text>
                ) : null}

                {/* Voice / replay button */}
                <TouchableOpacity
                  style={[
                    styles.visualFeedVoiceBtn,
                    speaking
                      ? { backgroundColor: `${charInfo.color}22`, borderColor: charInfo.color }
                      : { backgroundColor: "#00d4aa22", borderColor: "#00d4aa66" },
                  ]}
                  onPress={() => { if (speaking) stopSpeaking(); else speakResult(result); }}
                >
                  <Feather
                    name={speaking ? "volume-x" : "volume-2"}
                    size={18}
                    color={speaking ? charInfo.color : "#00d4aa"}
                  />
                  <Text style={[styles.visualFeedVoiceTxt, { color: speaking ? charInfo.color : "#00d4aa" }]}>
                    {speaking ? `Stop ${charInfo.emoji}` : `${charInfo.emoji} Read Result`}
                  </Text>
                </TouchableOpacity>

                {/* Clear */}
                <TouchableOpacity
                  style={styles.visualFeedClearBtn}
                  onPress={() => { setResult(null); stopSpeaking(); }}
                >
                  <Feather name="trash-2" size={14} color="#ffffff55" />
                  <Text style={styles.visualFeedClearTxt}>Clear</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            {/* Camera PiP thumbnail (bottom-left) */}
            <View style={styles.pipThumb} pointerEvents="none">
              <Feather name="camera" size={16} color="#00d4aacc" />
              <Text style={styles.pipThumbText}>CAM</Text>
            </View>
          </View>
        )}

      </>
    );
  }

  // ─── WEB rendering ──────────────────────────────────────────────────────────
  if (Platform.OS === "web") {
    if (webPermission === "unknown" || webPermission === "requesting") {
      return (
        <View style={[styles.permContainer, { backgroundColor: colors.background }]}>
          <BarraSketches opacity={1.3} />
          <View style={styles.permContent}>
            <Text style={styles.permLogo}>HOOK<Text style={{ color: "#00d4aa" }}>VISION</Text></Text>
            <Text style={[styles.permSubtitle, { color: "#00d4aa" }]}>LIVE SONAR CAMERA</Text>
            <Text style={[styles.permDesc, { color: colors.mutedForeground }]}>
              Point your phone at the sonar screen.{"\n"}AI reads fish, depth & species in real-time.
            </Text>
            {webPermission === "requesting" ? (
              <View style={styles.glowWrap}>
                <ActivityIndicator color="#00d4aa" size="large" />
              </View>
            ) : (
              <View style={styles.glowWrap}>
                <Animated.View style={[styles.glowRing, { borderColor: "#00d4aa" }]} />
                <TouchableOpacity
                  style={[styles.glowBtn, { backgroundColor: "#00d4aa" }]}
                  onPress={requestWebCamera}
                  activeOpacity={0.85}
                >
                  <Feather name="camera" size={44} color="#fff" />
                  <Text style={styles.glowBtnLabel}>ALLOW</Text>
                </TouchableOpacity>
              </View>
            )}
            <Text style={[styles.permOrDivider, { color: colors.mutedForeground }]}>— or pick a photo —</Text>
            <View style={styles.pickRow}>
              <TouchableOpacity
                style={styles.pickCameraBtn}
                onPress={openCamera}
                disabled={galleryPicking || scanning}
                activeOpacity={0.85}
              >
                {galleryPicking ? (
                  <ActivityIndicator color="#0a1628" size="small" />
                ) : (
                  <Feather name="camera" size={17} color="#0a1628" />
                )}
                <Text style={styles.pickCameraBtnText}>{galleryPicking ? "Analysing…" : "Camera"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.pickGalleryBtn}
                onPress={pickFromGallery}
                disabled={galleryPicking || scanning}
                activeOpacity={0.82}
              >
                {galleryPicking ? (
                  <ActivityIndicator color="#00d4aa" size="small" />
                ) : (
                  <Feather name="image" size={17} color="#00d4aa" />
                )}
                <Text style={styles.pickGalleryBtnText}>{galleryPicking ? "Analysing…" : "Gallery"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    if (webPermission === "denied") {
      return (
        <View style={[styles.permContainer, { backgroundColor: colors.background }]}>
          <BarraSketches opacity={1.3} />
          <View style={styles.permContent}>
            <Feather name="video-off" size={64} color={colors.destructive} />
            <Text style={[styles.permTitle, { color: colors.foreground }]}>Camera Blocked</Text>
            <Text style={[styles.permDesc, { color: colors.mutedForeground }]}>
              Allow camera access in your browser settings, then reload.
            </Text>
            <View style={styles.pickRow}>
              <TouchableOpacity
                style={styles.pickCameraBtn}
                onPress={openCamera}
                disabled={galleryPicking || scanning}
                activeOpacity={0.85}
              >
                {galleryPicking ? <ActivityIndicator color="#0a1628" size="small" /> : <Feather name="camera" size={17} color="#0a1628" />}
                <Text style={styles.pickCameraBtnText}>{galleryPicking ? "Analysing…" : "Camera"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.pickGalleryBtn}
                onPress={pickFromGallery}
                disabled={galleryPicking || scanning}
                activeOpacity={0.82}
              >
                {galleryPicking ? <ActivityIndicator color="#00d4aa" size="small" /> : <Feather name="image" size={17} color="#00d4aa" />}
                <Text style={styles.pickGalleryBtnText}>{galleryPicking ? "Analysing…" : "Gallery"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.container, { backgroundColor: "#000" }]}>
        {WebCameraView && <WebCameraView ref={webCamRef} onReady={() => setWebReady(true)} />}
        <>
          {!boatMode && <BarraSketches opacity={0.7} />}
          {renderOverlays(false)}
        </>
      </View>
    );
  }

  // ─── NATIVE rendering ────────────────────────────────────────────────────────
  if (!nativePermission) {
    return (
      <View style={[styles.permContainer, { backgroundColor: colors.background }]}>
        <BarraSketches opacity={1.3} />
        <ActivityIndicator color="#00d4aa" size="large" />
      </View>
    );
  }

  if (!nativePermission.granted) {
    return (
      <View style={[styles.permContainer, { backgroundColor: colors.background }]}>
        <BarraSketches opacity={1.3} />
        <View style={styles.permContent}>
          <Text style={styles.permLogo}>HOOK<Text style={{ color: "#00d4aa" }}>VISION</Text></Text>
          <Text style={[styles.permSubtitle, { color: "#00d4aa" }]}>LIVE SONAR CAMERA</Text>
          <Text style={[styles.permDesc, { color: colors.mutedForeground }]}>
            Point your phone at the sonar screen.{"\n"}AI reads fish, depth & species in real-time.
          </Text>
          <View style={styles.glowWrap}>
            <Animated.View style={[styles.glowRing, { borderColor: "#00d4aa" }]} />
            <TouchableOpacity
              style={[styles.glowBtn, { backgroundColor: "#00d4aa" }]}
              onPress={requestNativePermission}
              activeOpacity={0.85}
            >
              <Feather name="camera" size={44} color="#fff" />
              <Text style={styles.glowBtnLabel}>ALLOW</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.permOrDivider, { color: colors.mutedForeground }]}>— or pick a photo —</Text>
          <View style={styles.pickRow}>
            <TouchableOpacity
              style={styles.pickCameraBtn}
              onPress={openCamera}
              disabled={galleryPicking || scanning}
              activeOpacity={0.85}
            >
              {galleryPicking ? <ActivityIndicator color="#0a1628" size="small" /> : <Feather name="camera" size={17} color="#0a1628" />}
              <Text style={styles.pickCameraBtnText}>{galleryPicking ? "Analysing…" : "Camera"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.pickGalleryBtn}
              onPress={pickFromGallery}
              disabled={galleryPicking || scanning}
              activeOpacity={0.82}
            >
              {galleryPicking ? <ActivityIndicator color="#00d4aa" size="small" /> : <Feather name="image" size={17} color="#00d4aa" />}
              <Text style={styles.pickGalleryBtnText}>{galleryPicking ? "Analysing…" : "Gallery"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ── VISION MODE — full-screen live AI detector ───────────────────────────
  if (visionMode) {
    return (
      <View style={[styles.container, { backgroundColor: "#000" }]}>
        {Platform.OS !== "web" && (
          <CameraView ref={nativeCamRef} style={StyleSheet.absoluteFill} facing="back" mode="picture" />
        )}

        {/* Sonar reference grid — 3×3 zone overlay */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={{ position: "absolute", left: "33.3%", top: 0, bottom: 0, width: 1, backgroundColor: "#00d4aa22" }} />
          <View style={{ position: "absolute", left: "66.6%", top: 0, bottom: 0, width: 1, backgroundColor: "#00d4aa22" }} />
          <View style={{ position: "absolute", top: "33.3%", left: 0, right: 0, height: 1, backgroundColor: "#00d4aa22" }} />
          <View style={{ position: "absolute", top: "66.6%", left: 0, right: 0, height: 1, backgroundColor: "#00d4aa22" }} />
          <View style={{ position: "absolute", top: 0, left: 0, width: 22, height: 22, borderTopWidth: 2, borderLeftWidth: 2, borderColor: "#00d4aa88" }} />
          <View style={{ position: "absolute", top: 0, right: 0, width: 22, height: 22, borderTopWidth: 2, borderRightWidth: 2, borderColor: "#00d4aa88" }} />
          <View style={{ position: "absolute", bottom: 0, left: 0, width: 22, height: 22, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: "#00d4aa88" }} />
          <View style={{ position: "absolute", bottom: 0, right: 0, width: 22, height: 22, borderBottomWidth: 2, borderRightWidth: 2, borderColor: "#00d4aa88" }} />
          <View style={{ position: "absolute", top: "50%", left: "50%", width: 28, height: 28, marginLeft: -14, marginTop: -14, borderWidth: 1.5, borderRadius: 14, borderColor: "#00d4aa44" }} />
          <View style={{ position: "absolute", right: 5, top: 5 }}>
            <Text style={{ color: "#00d4aa55", fontSize: 7, fontFamily: "Inter_700Bold", letterSpacing: 0.5 }}>SURFACE</Text>
          </View>
          <View style={{ position: "absolute", right: 5, top: "35%" }}>
            <Text style={{ color: "#00d4aa44", fontSize: 7, fontFamily: "Inter_700Bold", letterSpacing: 0.5 }}>MID</Text>
          </View>
          <View style={{ position: "absolute", right: 5, top: "68%" }}>
            <Text style={{ color: "#00d4aa33", fontSize: 7, fontFamily: "Inter_700Bold", letterSpacing: 0.5 }}>DEEP</Text>
          </View>
        </View>

        {/* Animated sonar sweep line — continuous top-to-bottom */}
        <Animated.View
          pointerEvents="none"
          style={[{
            position: "absolute",
            left: 0,
            right: 0,
            height: 2,
            backgroundColor: "#00d4aa",
            shadowColor: "#00d4aa",
            shadowOffset: { width: 0, height: 0 },
            shadowRadius: 12,
            shadowOpacity: 1,
          }, sweepLineStyle]}
        />
        {/* Sweep glow trail */}
        <Animated.View
          pointerEvents="none"
          style={[{
            position: "absolute",
            left: 0,
            right: 0,
            height: 80,
            opacity: 0.10,
            backgroundColor: "#00d4aa",
          }, sweepTrailStyle]}
        />

        {/* Targeting overlay — bounding boxes */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {visionTargets.map((t) => {
            const isBarramundi = t.label.toLowerCase().includes("barra") || t.label.toLowerCase().includes("lates");
            const isCroc = t.label.toLowerCase().includes("croc") || t.label.toLowerCase().includes("crocodile");
            const isPerson = t.label.toLowerCase().includes("person") || t.label.toLowerCase().includes("face") || t.label.toLowerCase().includes("human");
            const bColor = isCroc ? "#ff3030" : isBarramundi ? "#00d4aa" : isPerson ? "#ffffff" : "#ffd700";
            const bgColor = isCroc ? "#ff303018" : isBarramundi ? "#00d4aa18" : isPerson ? "#ffffff10" : "#ffd70012";
            return (
              <View key={t.id} style={{ position: "absolute", left: `${Math.max(0, Math.min(t.box.x, 0.98)) * 100}%` as any, top: `${Math.max(0, Math.min(t.box.y, 0.98)) * 100}%` as any, width: `${Math.max(0.04, Math.min(t.box.w, 1 - t.box.x)) * 100}%` as any, height: `${Math.max(0.04, Math.min(t.box.h, 1 - t.box.y)) * 100}%` as any, borderWidth: 2, borderColor: bColor, backgroundColor: bgColor, borderRadius: 4 }}>
                <View style={{ position: "absolute", top: -2, left: -2, width: 14, height: 14, borderTopWidth: 3, borderLeftWidth: 3, borderColor: bColor }} />
                <View style={{ position: "absolute", top: -2, right: -2, width: 14, height: 14, borderTopWidth: 3, borderRightWidth: 3, borderColor: bColor }} />
                <View style={{ position: "absolute", bottom: -2, left: -2, width: 14, height: 14, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: bColor }} />
                <View style={{ position: "absolute", bottom: -2, right: -2, width: 14, height: 14, borderBottomWidth: 3, borderRightWidth: 3, borderColor: bColor }} />
                <View style={{ position: "absolute", top: -26, left: -2, flexDirection: "row", alignItems: "center", backgroundColor: bColor + "dd", borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 }}>
                  <Text style={{ color: "#000", fontSize: 10, fontFamily: "Inter_700Bold" }} numberOfLines={1}>
                    {t.velocity && (Math.abs(t.velocity.dx) > 0.015 || Math.abs(t.velocity.dy) > 0.015) ? (["→","↘","↓","↙","←","↖","↑","↗"][Math.round((Math.atan2(t.velocity.dy, t.velocity.dx) * 180 / Math.PI + 180) / 45) % 8] + " ") : ""}{isCroc ? "⚠ " : isBarramundi ? "🐟 " : isPerson ? "👤 " : "● "}{t.label} {Math.round(t.confidence * 100)}%{t.trackId ? ` #${t.trackId}` : ""}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* HUD strip — top */}
        <View style={{ position: "absolute", top: insets.top + 4, left: 0, right: 0, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#0a162299", gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: visionDetecting ? "#ffd700" : "#00ff88" }} />
          <Text style={{ color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1.2, flex: 1 }}>
            AI LIVE · 🐟 BARRA · NQ{analysisRunning ? (visionDetecting ? " · SCANNING…" : " · RUNNING") : " · STANDBY"}
          </Text>
          {isOffline ? (
            <Text style={{ color: "#ff5555", fontSize: 9, fontFamily: "Inter_700Bold" }}>OFFLINE</Text>
          ) : (
            <Text style={{ color: visionTargets.length > 0 ? "#00d4aa" : "#ffffff55", fontSize: 10, fontFamily: "Inter_700Bold" }}>
              {visionTargets.length > 0 ? `${visionTargets.length} TARGET${visionTargets.length !== 1 ? "S" : ""} LOCKED` : "WATCHING"}
            </Text>
          )}
        </View>

        {/* Croc alert banner */}
        {visionTargets.some(t => t.label.toLowerCase().includes("croc")) && (
          <View style={{ position: "absolute", top: insets.top + 52, left: 14, right: 14, backgroundColor: "#ff2222ee", borderRadius: 12, padding: 12, borderWidth: 2, borderColor: "#ff4444", alignItems: "center" }}>
            <Text style={{ color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 0.8 }}>⚠ CROCODILE DETECTED — STAY IN THE BOAT</Text>
          </View>
        )}

        {/* ── Burst checklist + controls panel ─────────────────────────── */}
        <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#0a1628f0", borderTopWidth: 1, borderTopColor: "#00d4aa22" }}>
          {burstRows.length > 0 ? (
            <View style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4, gap: 4 }}>
              {burstRows.map(row => {
                const s = row.status;
                const clr = s === "done" && row.targets.length > 0 ? "#00d4aa" : s === "done" ? "#ffffff55" : s === "analyzing" ? "#ffd700" : s === "capturing" ? "#aaff00" : s === "error" ? "#ff5555" : "#ffffff22";
                const icon = s === "done" ? "●" : s === "analyzing" ? "◌" : s === "capturing" ? "◉" : s === "error" ? "✕" : "○";
                const txt  = s === "done" ? (row.note || "No targets") : s === "analyzing" ? "Analyzing…" : s === "capturing" ? "Capturing…" : s === "error" ? (row.note || "Failed") : "Waiting";
                return (
                  <View key={row.num} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ color: clr, fontSize: 10, width: 10 }}>{icon}</Text>
                    <Text style={{ color: "#ffffff55", fontSize: 10, fontFamily: "Inter_700Bold", width: 28 }}>F{row.num}</Text>
                    <Text style={{ color: clr, fontSize: 11, fontFamily: "Inter_500Medium", flex: 1 }} numberOfLines={1}>{txt}</Text>
                    {s === "done" && row.targets.length > 0 && (
                      <Text style={{ color: "#00d4aa", fontSize: 10, fontFamily: "Inter_700Bold" }}>{row.targets.length}⚑</Text>
                    )}
                  </View>
                );
              })}
            </View>
          ) : visionFrameNote ? (
            <View style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4 }}>
              <Text style={{ color: visionTargets.length > 0 ? "#00d4aaee" : "#ffffffcc", fontSize: 13, fontFamily: "Inter_500Medium", textAlign: "center", lineHeight: 20 }}>{visionFrameNote}</Text>
            </View>
          ) : (
            <View style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4, alignItems: "center" }}>
              <Text style={{ color: "#ffffff33", fontSize: 12, fontFamily: "Inter_400Regular" }}>{analysisRunning ? "Preparing burst scan…" : "Press START · 5-frame burst · auto-repeats"}</Text>
            </View>
          )}
          <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 14, paddingBottom: insets.bottom + 10, paddingTop: 6 }}>
            {!analysisRunning ? (
              <TouchableOpacity onPress={startAnalysis} style={{ flex: 1, backgroundColor: "#00d4aa", borderRadius: 12, paddingVertical: 13, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }} activeOpacity={0.85}>
                <MaterialCommunityIcons name="play-circle" size={17} color="#0a1628" />
                <Text style={{ color: "#0a1628", fontSize: 13, fontFamily: "Inter_700Bold" }}>START</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={stopAnalysis} style={{ flex: 1, backgroundColor: "#ff333322", borderRadius: 12, paddingVertical: 13, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, borderWidth: 1.5, borderColor: "#ff4444aa" }} activeOpacity={0.85}>
                <MaterialCommunityIcons name="stop-circle" size={17} color="#ff5555" />
                <Text style={{ color: "#ff5555", fontSize: 13, fontFamily: "Inter_700Bold" }}>STOP</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={startAnalysis}
              disabled={analysisRunning}
              style={{ flex: 1, backgroundColor: analysisRunning ? "#0a162888" : "#ffd70022", borderRadius: 12, paddingVertical: 13, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, borderWidth: 1.5, borderColor: analysisRunning ? "#ffffff22" : "#ffd70088" }}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="radar" size={17} color={analysisRunning ? "#ffffff33" : "#ffd700"} />
              <Text style={{ color: analysisRunning ? "#ffffff33" : "#ffd700", fontSize: 13, fontFamily: "Inter_700Bold" }}>ANALYZE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  if (boatMode) {
    return (
      <View style={[styles.container, { backgroundColor: "#000" }]}>
        {BoatDemoStore.active ? (
          <DemoSonarView />
        ) : cam2Connected ? (
          <Image
            source={{ uri: `http://${cam2.ip}${cam2.path}?t=${cam2.tick}` }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onLoad={cam2.onPreviewLoad}
            onError={cam2.onPreviewError}
          />
        ) : (
          <CameraView ref={nativeCamRef} style={StyleSheet.absoluteFill} facing="back" mode="picture" />
        )}
        {!BoatDemoStore.active && cam2Connected && (
          <CameraView ref={nativeCamRef} style={{ width: 1, height: 1, opacity: 0 }} facing="back" mode="picture" />
        )}
        {renderOverlays(true)}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Tiny camera keeps nativeCamRef warm so boat mode starts instantly */}
      {Platform.OS !== "web" && !BoatDemoStore.active && (
        <CameraView ref={nativeCamRef} style={{ width: 1, height: 1, opacity: 0 }} facing="back" mode="picture" />
      )}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: topPad + 12, paddingBottom: botPad + 16, paddingHorizontal: 16, gap: 14 }}
        showsVerticalScrollIndicator={false}
      >
        <HVHeader subtitle="Live Camera" />

        {/* ─── Live Sonar Analysis — AI Pipeline ──────────────────────────────── */}
        <View style={{ backgroundColor: colors.card, borderRadius: 18, borderWidth: 1.5, borderColor: "#ffffff18", overflow: "hidden" }}>
          {/* Dual accent bar: lime = Auto-Scan | teal = DPT 4.1 */}
          <View style={{ height: 5, backgroundColor: "#00d4aa" }} />
          <View style={{ paddingHorizontal: 18, paddingVertical: 18, gap: 14 }}>

            {/* ── Card header ─────────────────────────────────────────────── */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: "#ffffff0a", borderWidth: 1, borderColor: "#ffffff22", alignItems: "center", justifyContent: "center" }}>
                <MaterialCommunityIcons name="ferry" size={27} color="#aaff00" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontSize: 17, fontFamily: "Inter_700Bold" }}>Live Sonar Analysis</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium" }}>
                  <Text style={{ color: "#00d4aa" }}>GPT-4.1 Vision</Text>
                  <Text>{"  ·  Auto-Scan  ·  45 s cycles"}</Text>
                </Text>
              </View>
            </View>

            {/* ── Sequence 1 — GPT-4.1 Vision: Camera / Gallery ───────────── */}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#00d4aa", borderRadius: 12, paddingVertical: 13 }}
                onPress={lsPickCamera}
                disabled={lsLoading}
                activeOpacity={0.85}
              >
                <Feather name="camera" size={15} color="#0a1628" />
                <Text style={{ color: "#0a1628", fontSize: 13, fontFamily: "Inter_700Bold" }}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.secondary, borderRadius: 12, paddingVertical: 13, borderWidth: 1, borderColor: "#00d4aa55" }}
                onPress={lsPickGallery}
                disabled={lsLoading}
                activeOpacity={0.8}
              >
                <Feather name="image" size={15} color="#00d4aa" />
                <Text style={{ color: "#00d4aa", fontSize: 13, fontFamily: "Inter_600SemiBold" }}>Gallery</Text>
              </TouchableOpacity>
            </View>

            {/* ── Scan guide (shown when no image is loaded) ───────────────── */}
            {!lsUri && !result ? (
              <View style={{ borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "#ffffff18", backgroundColor: "#ffffff06" }}>
                {/* 3×3 reference grid */}
                <View style={{ aspectRatio: 4 / 3, position: "relative" }}>
                  {/* Grid columns */}
                  <View style={{ position: "absolute", left: "33.3%", top: 0, bottom: 0, width: 1, backgroundColor: "#00d4aa22" }} />
                  <View style={{ position: "absolute", left: "66.6%", top: 0, bottom: 0, width: 1, backgroundColor: "#00d4aa22" }} />
                  {/* Grid rows */}
                  <View style={{ position: "absolute", top: "33.3%", left: 0, right: 0, height: 1, backgroundColor: "#00d4aa22" }} />
                  <View style={{ position: "absolute", top: "66.6%", left: 0, right: 0, height: 1, backgroundColor: "#00d4aa22" }} />
                  {/* Corner crosshair brackets */}
                  <View style={{ position: "absolute", top: 10, left: 10, width: 18, height: 18, borderTopWidth: 2, borderLeftWidth: 2, borderColor: "#00d4aa88" }} />
                  <View style={{ position: "absolute", top: 10, right: 10, width: 18, height: 18, borderTopWidth: 2, borderRightWidth: 2, borderColor: "#00d4aa88" }} />
                  <View style={{ position: "absolute", bottom: 10, left: 10, width: 18, height: 18, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: "#00d4aa88" }} />
                  <View style={{ position: "absolute", bottom: 10, right: 10, width: 18, height: 18, borderBottomWidth: 2, borderRightWidth: 2, borderColor: "#00d4aa88" }} />
                  {/* Center crosshair */}
                  <View style={{ position: "absolute", top: "50%", left: "50%", width: 24, height: 24, marginLeft: -12, marginTop: -12, borderWidth: 1.5, borderRadius: 12, borderColor: "#aaff0066" }} />
                  <View style={{ position: "absolute", top: "50%", left: "40%", right: "40%", height: 1, backgroundColor: "#aaff0044" }} />
                  <View style={{ position: "absolute", left: "50%", top: "40%", bottom: "40%", width: 1, backgroundColor: "#aaff0044" }} />
                  {/* Depth zone labels */}
                  <View style={{ position: "absolute", right: 6, top: "5%", alignItems: "flex-end", gap: 2 }}>
                    <Text style={{ color: "#00d4aa88", fontSize: 8, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 }}>SURFACE</Text>
                  </View>
                  <View style={{ position: "absolute", right: 6, top: "37%", alignItems: "flex-end" }}>
                    <Text style={{ color: "#00d4aa66", fontSize: 8, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 }}>MID</Text>
                  </View>
                  <View style={{ position: "absolute", right: 6, bottom: "8%", alignItems: "flex-end" }}>
                    <Text style={{ color: "#00d4aa44", fontSize: 8, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 }}>DEEP</Text>
                  </View>
                  {/* Guide text */}
                  <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <MaterialCommunityIcons name="sonar" size={28} color="#ffffff22" />
                    <Text style={{ color: "#ffffff44", fontSize: 12, fontFamily: "Inter_500Medium", textAlign: "center" }}>
                      {"Point at sonar screen\nthen tap Camera or Start Auto-Scan"}
                    </Text>
                  </View>
                </View>
                {/* Zone bar */}
                <View style={{ flexDirection: "row", borderTopWidth: 1, borderColor: "#ffffff0a" }}>
                  <View style={{ flex: 1, paddingVertical: 5, alignItems: "center", borderRightWidth: 1, borderColor: "#ffffff0a" }}>
                    <Text style={{ color: "#00d4aa", fontSize: 8, fontFamily: "Inter_700Bold", letterSpacing: 0.8 }}>SURFACE</Text>
                  </View>
                  <View style={{ flex: 1, paddingVertical: 5, alignItems: "center", borderRightWidth: 1, borderColor: "#ffffff0a" }}>
                    <Text style={{ color: "#00d4aa99", fontSize: 8, fontFamily: "Inter_700Bold", letterSpacing: 0.8 }}>MID WATER</Text>
                  </View>
                  <View style={{ flex: 1, paddingVertical: 5, alignItems: "center" }}>
                    <Text style={{ color: "#00d4aa55", fontSize: 8, fontFamily: "Inter_700Bold", letterSpacing: 0.8 }}>DEEP WATER</Text>
                  </View>
                </View>
              </View>
            ) : null}

            {/* ── Image preview with grid overlay ─────────────────────────── */}
            {lsUri ? (
              <View style={{ borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: lsLoading ? "#00d4aa88" : colors.border }}>
                <View style={{ position: "relative" }}>
                  <Image source={{ uri: lsUri }} style={{ width: "100%", aspectRatio: 4 / 3 }} resizeMode="cover" />
                  {/* Reference grid overlay */}
                  <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
                    <View style={{ position: "absolute", left: "33.3%", top: 0, bottom: 0, width: 1, backgroundColor: "#00d4aa33" }} />
                    <View style={{ position: "absolute", left: "66.6%", top: 0, bottom: 0, width: 1, backgroundColor: "#00d4aa33" }} />
                    <View style={{ position: "absolute", top: "33.3%", left: 0, right: 0, height: 1, backgroundColor: "#00d4aa33" }} />
                    <View style={{ position: "absolute", top: "66.6%", left: 0, right: 0, height: 1, backgroundColor: "#00d4aa33" }} />
                    {/* Corner brackets */}
                    <View style={{ position: "absolute", top: 8, left: 8, width: 16, height: 16, borderTopWidth: 2, borderLeftWidth: 2, borderColor: "#00d4aacc" }} />
                    <View style={{ position: "absolute", top: 8, right: 8, width: 16, height: 16, borderTopWidth: 2, borderRightWidth: 2, borderColor: "#00d4aacc" }} />
                    <View style={{ position: "absolute", bottom: 8, left: 8, width: 16, height: 16, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: "#00d4aacc" }} />
                    <View style={{ position: "absolute", bottom: 8, right: 8, width: 16, height: 16, borderBottomWidth: 2, borderRightWidth: 2, borderColor: "#00d4aacc" }} />
                    {/* Depth zone labels */}
                    <View style={{ position: "absolute", right: 6, top: 6 }}>
                      <Text style={{ color: "#00d4aacc", fontSize: 8, fontFamily: "Inter_700Bold", letterSpacing: 0.5 }}>SURFACE</Text>
                    </View>
                    <View style={{ position: "absolute", right: 6, top: "36%" }}>
                      <Text style={{ color: "#00d4aa99", fontSize: 8, fontFamily: "Inter_700Bold", letterSpacing: 0.5 }}>MID</Text>
                    </View>
                    <View style={{ position: "absolute", right: 6, bottom: 6 }}>
                      <Text style={{ color: "#00d4aa66", fontSize: 8, fontFamily: "Inter_700Bold", letterSpacing: 0.5 }}>DEEP</Text>
                    </View>
                    {/* Scanning pulse when loading */}
                    {lsLoading ? (
                      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#00d4aa08" }}>
                        <View style={{ position: "absolute", bottom: 6, left: 8, right: 8, flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <ActivityIndicator color="#00d4aa" size="small" />
                          <Text style={{ color: "#00d4aa", fontSize: 10, fontFamily: "Inter_600SemiBold" }}>GPT-4.1 Vision analysing…</Text>
                        </View>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
            ) : null}

            {/* ── Analyze button — manual DPT path ────────────────────────── */}
            {lsUri && !lsLoading && !lsAnalysis && !result ? (
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14 }}
                onPress={lsAnalyze}
                activeOpacity={0.85}
              >
                <SonarPulse size={18} active={false} />
                <Text style={{ color: colors.primaryForeground, fontSize: 15, fontFamily: "Inter_700Bold" }}>Analyze Sonar — DPT 4.1</Text>
              </TouchableOpacity>
            ) : null}

            {/* ── Error ───────────────────────────────────────────────────── */}
            {lsError ? (
              <View style={{ backgroundColor: "#ef444420", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#ef444455" }}>
                <Text style={{ color: "#ef4444", fontSize: 13, lineHeight: 18 }}>{lsError}</Text>
              </View>
            ) : null}


            {/* ══════════════════════════════════════════════════════════════
                STAGE 2 — DPT 4.1 loading
            ══════════════════════════════════════════════════════════════ */}
            {lsLoading ? (
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ height: 1.5, flex: 1, backgroundColor: "#00d4aa33" }} />
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#00d4aa18", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: "#00d4aa44" }}>
                    <Text style={{ color: "#00d4aa", fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 1 }}>GPT-4.1 VISION SCANNING</Text>
                  </View>
                  <View style={{ height: 1.5, flex: 1, backgroundColor: "#00d4aa33" }} />
                </View>
                <View style={{ alignItems: "center", gap: 10, paddingVertical: 14, backgroundColor: "#00d4aa0a", borderRadius: 12 }}>
                  <ActivityIndicator color="#00d4aa" size="large" />
                  <Text style={{ color: "#00d4aa", fontSize: 13, fontFamily: "Inter_500Medium" }}>GPT-4.1 Vision scanning sonar image…</Text>
                  <Text style={{ color: "#00d4aa66", fontSize: 11 }}>3×3 grid analysis · depth zones · arch detection</Text>
                </View>
              </View>
            ) : null}

            {/* ══════════════════════════════════════════════════════════════
                STAGE 2 — DPT 4.1 result  (teal)
            ══════════════════════════════════════════════════════════════ */}
            {lsAnalysis && !lsLoading ? (
              <View style={{ gap: 10 }}>
                {/* Stage header */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ height: 1.5, flex: 1, backgroundColor: "#00d4aa33" }} />
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#00d4aa18", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: "#00d4aa44" }}>
                    <Text style={{ color: "#00d4aa", fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 1 }}>{"GPT-4.1 VISION · CYCLE " + boatCycleNum}</Text>
                  </View>
                  <View style={{ height: 1.5, flex: 1, backgroundColor: "#00d4aa33" }} />
                </View>
                {/* Fish / Confidence / Species tiles */}
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1, backgroundColor: "#00d4aa15", borderRadius: 10, padding: 12, alignItems: "center", gap: 3 }}>
                    <Text style={{ color: "#00d4aa", fontSize: 26, fontFamily: "Inter_700Bold" }}>{lsAnalysis.fishCount}</Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 10, letterSpacing: 0.5 }}>FISH</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: "#00d4aa15", borderRadius: 10, padding: 12, alignItems: "center", gap: 4 }}>
                    <Text style={{ color: "#00d4aa", fontSize: 26, fontFamily: "Inter_700Bold" }}>{lsAnalysis.confidence}%</Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 10, letterSpacing: 0.5 }}>CONF</Text>
                    {/* Confidence bar */}
                    <View style={{ width: "100%", height: 3, backgroundColor: "#ffffff15", borderRadius: 2 }}>
                      <View style={{ width: `${lsAnalysis.confidence}%`, height: 3, backgroundColor: "#00d4aa", borderRadius: 2 }} />
                    </View>
                  </View>
                  <View style={{ flex: 2, backgroundColor: "#00d4aa15", borderRadius: 10, padding: 12, alignItems: "center", gap: 3 }}>
                    <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: "Inter_700Bold", textAlign: "center" }} numberOfLines={2}>{lsAnalysis.species}</Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 10, letterSpacing: 0.5 }}>SPECIES</Text>
                  </View>
                </View>
                {/* Detail row */}
                <View style={{ backgroundColor: colors.secondary, borderRadius: 10, padding: 12, gap: 4 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Depth</Text>
                    <Text style={{ color: colors.foreground, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>{lsAnalysis.depth}</Text>
                  </View>
                  {lsAnalysis.suggestion ? (
                    <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>{lsAnalysis.suggestion}</Text>
                  ) : null}
                </View>
                {lsAnalysis.crocAlert ? (
                  <View style={{ backgroundColor: "#ff000022", borderRadius: 10, padding: 12, borderWidth: 1.5, borderColor: "#ff0000aa", flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Text style={{ fontSize: 22 }}>🐊</Text>
                    <Text style={{ color: "#ff4444", fontFamily: "Inter_700Bold", fontSize: 14, flex: 1 }}>CROCODILE DETECTED — STAY ALERT</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* ── Sequence 2 — Auto-Scan: boat-cycle zone intelligence ─────── */}
            {boatLive ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: lsLoading ? "#00d4aa0a" : "#ffffff06", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: lsLoading ? "#00d4aa55" : "#ffffff18" }}>
                {lsLoading
                  ? <ActivityIndicator size="small" color="#00d4aa" />
                  : <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: boatPhase === "capturing" ? "#aaff00" : boatPhase === "analyzing" ? "#00d4aa" : "#ffffff33" }} />
                }
                <Text style={{ color: lsLoading ? "#00d4aa" : colors.mutedForeground, fontSize: 12, fontFamily: "Inter_600SemiBold", flex: 1 }}>
                  {lsLoading ? "GPT-4.1 Vision scanning sonar…" : boatPhase === "capturing" ? "Capturing frames…" : boatPhase === "waiting" ? `Next scan in ${boatWaitRemaining}s` : "Scan complete"}
                </Text>
                {boatCycleNum > 0 ? <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{"Cycle " + boatCycleNum}</Text> : null}
              </View>
            ) : null}
            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#aaff00", borderRadius: 12, paddingVertical: 13 }}
              onPress={() => setBoatMode(true)}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="play-circle" size={16} color="#0a1628" />
              <Text style={{ color: "#0a1628", fontSize: 13, fontFamily: "Inter_700Bold" }}>
                {result ? "NEW AUTO-SCAN" : "START AUTO-SCAN"}
              </Text>
            </TouchableOpacity>

            {/* ── Clear all / empty-state hint ────────────────────────────── */}
            {(result || lsAnalysis) ? (
              <TouchableOpacity
                style={{ alignItems: "center", paddingVertical: 8 }}
                onPress={() => { setResult(null); setLsUri(null); setLsB64(null); setLsAnalysis(null); setLsError(null); }}
                activeOpacity={0.7}
              >
                <Text style={{ color: "#ffffff44", fontSize: 12, fontFamily: "Inter_500Medium" }}>← Clear all results</Text>
              </TouchableOpacity>
            ) : (
              !result && !lsAnalysis && !lsUri ? null : null
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  permContainer: { flex: 1, backgroundColor: "#0a1628" },
  permContent: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 36, gap: 18,
  },
  permLogo:    { fontSize: 32, fontFamily: "Oswald_700Bold", color: "#fff", letterSpacing: 1 },
  permSubtitle:{ fontSize: 13, fontFamily: "Inter_600SemiBold", letterSpacing: 3, marginTop: -10 },
  permTitle:   { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center", color: "#fff" },
  permDesc:    { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22, color: "#ffffffaa" },
  permOrDivider: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", marginVertical: 4 },
  permGalleryBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderWidth: 1.5, borderColor: "#00d4aa66", borderRadius: 32,
    paddingVertical: 14, paddingHorizontal: 28,
    backgroundColor: "#00d4aa14",
  },
  permGalleryText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#00d4aa" },

  pickRow: { flexDirection: "row", gap: 12, width: "100%" },
  pickCameraBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    backgroundColor: "#00d4aa", borderRadius: 12, paddingVertical: 14,
  },
  pickCameraBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#0a1628" },
  pickGalleryBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    borderWidth: 1.5, borderColor: "#00d4aa55", backgroundColor: "#00d4aa14",
    borderRadius: 12, paddingVertical: 14,
  },
  pickGalleryBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#00d4aa" },

  glowWrap: { width: 190, height: 190, alignItems: "center", justifyContent: "center", marginTop: 12 },
  glowRing: {
    position: "absolute", width: 145, height: 145, borderRadius: 72.5,
    borderWidth: 2.5,
  },
  glowBtn: {
    width: 145, height: 145, borderRadius: 72.5,
    alignItems: "center", justifyContent: "center", gap: 5,
  },
  glowBtnLabel: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 2 },
  glowBtnSub:   { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#fff", letterSpacing: 1.5 },

  boatTint: { backgroundColor: "#aaff0006" },
  mountTint: { backgroundColor: "#ff450008" },

  topBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    paddingHorizontal: 12, flexDirection: "row", alignItems: "center",
    gap: 8, zIndex: 10, flexWrap: "wrap",
  },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  aimGuide:     { position: "absolute", top: "25%", left: 32, right: 32, height: "35%", alignItems: "center", justifyContent: "center", zIndex: 5 },
  aimGuideLive: { top: "12%", left: 10, right: 10, height: "60%" },
  crocBanner:   { position: "absolute", top: 0, left: 0, right: 0, backgroundColor: "#cc0000ee", paddingVertical: 10, alignItems: "center", zIndex: 50 },
  crocBannerText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  fishTrackBanner: { position: "absolute", top: 56, left: 16, right: 16, backgroundColor: "#0a162899", borderRadius: 10, paddingVertical: 6, paddingHorizontal: 12, alignItems: "center", zIndex: 40 },
  fishTrackText:   { color: "#aaff00", fontSize: 12, fontFamily: "Inter_500Medium" },
  aimCorner: { position: "absolute", width: 22, height: 22 },
  aimTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 4 },
  aimTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 4 },
  aimBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 4 },
  aimBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 4 },
  aimLabel: { fontSize: 11, fontFamily: "Inter_500Medium", letterSpacing: 0.5, opacity: 0.9, textAlign: "center" },
  cdBadge:  { marginTop: 12, width: 64, height: 64, borderRadius: 32, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  cdText:   { fontSize: 20, fontFamily: "Inter_700Bold" },
  cdSub:    { fontSize: 9, fontFamily: "Inter_500Medium" },

  // ── Standard result overlay ───────────────────────────────────────────────
  resultOverlay: { position: "absolute", left: 16, right: 16, bottom: 260, borderRadius: 16, borderWidth: 1, padding: 16, gap: 6, zIndex: 20 },
  resultRow:     { flexDirection: "row", alignItems: "center", gap: 8 },
  charBadge:     { fontSize: 16 },
  resultSpecies: { fontSize: 16, fontFamily: "Inter_700Bold", flex: 1 },
  countBadge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  countText:     { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  resultDetail:  { fontSize: 13, fontFamily: "Inter_500Medium" },
  resultLure:    { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  resultActions: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  replayBtn:     { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  replayText:    { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  clearBtn:      { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center" },

  // ── Boat mode big card ────────────────────────────────────────────────────
  boatCard: {
    position: "absolute", left: 12, right: 12, bottom: 260,
    backgroundColor: "#0a1628ee", borderRadius: 20, borderWidth: 2,
    padding: 20, gap: 12, zIndex: 20,
  },
  boatRow:       { flexDirection: "row", alignItems: "center", gap: 12 },
  boatSpecies:   { fontSize: 24, fontFamily: "Oswald_700Bold", letterSpacing: 0.5 },
  boatCount:     { fontSize: 16, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  boatClose:     { padding: 4 },
  boatDepthRow:  { flexDirection: "row", gap: 10 },
  boatBadge:     { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  boatBadgeText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  boatLure:      { fontSize: 14, fontFamily: "Inter_400Regular", color: "#ffffffcc", lineHeight: 20 },
  boatActions:   { flexDirection: "row", marginTop: 4 },
  boatReplay:    { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 24, borderWidth: 1 },
  boatReplayText:{ fontSize: 14, fontFamily: "Inter_600SemiBold" },

  errorOverlay: { position: "absolute", left: 16, right: 16, bottom: 260, borderRadius: 12, borderWidth: 1, padding: 12, flexDirection: "row", alignItems: "center", gap: 8, zIndex: 20 },
  errorText:    { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },

  // ── Bottom bar ────────────────────────────────────────────────────────────
  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    alignItems: "center", paddingTop: 12, gap: 8, zIndex: 35,
  },
  boatModeBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 28, paddingVertical: 13,
    borderRadius: 32, borderWidth: 2,
    minWidth: 200, justifyContent: "center",
  },
  boatModeBtnText: {
    fontSize: 15, fontFamily: "Inter_700Bold", letterSpacing: 0.5,
  },
  boatLiveDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: "#0a1628",
  },
  hint: { fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 4, textAlign: "center", paddingHorizontal: 20 },
  sonarPhotoBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    borderWidth: 1, borderColor: "#00d4aa44", borderRadius: 8,
    paddingVertical: 9, paddingHorizontal: 18,
    backgroundColor: "#00d4aa0d", marginTop: 2,
  },
  sonarPhotoBtnText: { fontSize: 11, fontFamily: "Oswald_700Bold", color: "#00d4aa", letterSpacing: 2 },

  // ── Gallery button ────────────────────────────────────────────────────────
  scanRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  galleryBtn: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "#00d4aa14",
    borderWidth: 1.5,
    borderColor: "#00d4aa55",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  galleryBtnText: {
    fontSize: 8,
    fontFamily: "Oswald_700Bold",
    color: "#00d4aa",
    letterSpacing: 1.5,
  },
  gallerySpacer: {
    width: 72,
    height: 72,
  },

  // ── Feed swap button (floating, bottom-right) ─────────────────────────────
  swapFeedBtn: {
    position: "absolute",
    bottom: 170,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 24,
    borderWidth: 1.5,
    paddingHorizontal: 13,
    paddingVertical: 9,
    zIndex: 40,
  },
  swapFeedBtnText: {
    fontSize: 10,
    fontFamily: "Oswald_700Bold",
    letterSpacing: 1.2,
  },

  // ── Visual (AI) feed full-screen overlay ─────────────────────────────────
  visualFeedBg: {
    backgroundColor: "#060d1a",
    zIndex: 20,
  },
  visualFeedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#00d4aa22",
  },
  visualFeedTitle: {
    flex: 1,
    color: "#00d4aacc",
    fontSize: 11,
    fontFamily: "Oswald_700Bold",
    letterSpacing: 2,
  },
  visualFeedClose: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#00d4aa14",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#00d4aa44",
  },
  visualFeedCloseText: {
    color: "#00d4aacc",
    fontSize: 10,
    fontFamily: "Oswald_700Bold",
    letterSpacing: 1,
  },
  visualFeedIdle: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  visualFeedIdleText: {
    color: "#ffffff44",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  visualFeedContent: {
    padding: 24,
    gap: 18,
    alignItems: "center",
    paddingBottom: 200,
  },
  visualFeedCount: {
    fontSize: 100,
    fontFamily: "Oswald_700Bold",
    color: "#00d4aa",
    lineHeight: 100,
  },
  visualFeedCountLabel: {
    fontSize: 12,
    fontFamily: "Oswald_700Bold",
    color: "#00d4aa88",
    letterSpacing: 3,
    marginTop: 4,
  },
  visualFeedSpecies: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    textAlign: "center",
  },
  visualFeedDepth: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#ffffff88",
    textAlign: "center",
  },
  visualFeedConfWrap: {
    width: "100%",
    gap: 5,
  },
  visualFeedConfTrack: {
    height: 7,
    backgroundColor: "#ffffff15",
    borderRadius: 4,
    overflow: "hidden",
  },
  visualFeedConfFill: {
    height: "100%",
    borderRadius: 4,
  },
  visualFeedConfText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#ffffff44",
    textAlign: "right",
  },
  visualFeedLureCard: {
    width: "100%",
    backgroundColor: "#00d4aa0f",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#00d4aa33",
    gap: 4,
  },
  visualFeedLureLabel: {
    fontSize: 10,
    fontFamily: "Oswald_700Bold",
    color: "#00d4aa",
    letterSpacing: 2,
  },
  visualFeedLureName: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: "#ffffffee",
  },
  visualFeedTechnique: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#ffffff77",
  },
  visualFeedSuggestion: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#ffffffaa",
    textAlign: "center",
    lineHeight: 22,
    fontStyle: "italic",
  },
  visualFeedVoiceBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 15,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  visualFeedVoiceTxt: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  visualFeedClearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "#ffffff08",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ffffff22",
  },
  visualFeedClearTxt: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#ffffff55",
  },

  // ── PiP camera thumbnail label ────────────────────────────────────────────
  pipThumb: {
    position: "absolute",
    bottom: 200,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#0a162888",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#00d4aa33",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pipThumbText: {
    fontSize: 9,
    fontFamily: "Oswald_700Bold",
    color: "#00d4aa88",
    letterSpacing: 1.5,
  },
});
