import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { HVHeader } from "@/components/HVHeader";
import { SonarPulse } from "@/components/SonarPulse";
import { NarratorSettingsTrigger } from "@/components/NarratorSettings";
import { useAutoNarrate } from "@/hooks/useAutoNarrate";
import { useColors } from "@/hooks/useColors";
import { useHistory } from "@/context/HistoryContext";
import { CHARACTERS, useNarrator, type NarratorCharacter } from "@/context/NarratorContext";

// ─── Native-only imports ──────────────────────────────────────────────────────
let CameraView: any = null;
let useCameraPermissions: any = null;
if (Platform.OS !== "web") {
  const cam = require("expo-camera");
  CameraView = cam.CameraView;
  useCameraPermissions = cam.useCameraPermissions;
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
  technique?: string;
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
      return `Here, in the remarkable Northern Territory waters, ${count === 1 ? "a solitary" : `${count}`} ${nick} ${count === 1 ? "rests" : "rest"} at ${a.depth}.${lureNote}`;
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

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function LiveScreen() {
  const colors   = useColors();
  const insets   = useSafeAreaInsets();
  const { addEntry } = useHistory();
  const { character, speak, stop: stopSpeaking, speaking } = useNarrator();
  useAutoNarrate(() => "Live Camera mode. Point your phone at a sonar screen for real-time AI fish detection. Activate Boat Mode for hands-free auto-scanning.");

  const [nativePermission, requestNativePermission] =
    useCameraPermissions ? useCameraPermissions() : [null, null];

  const [webPermission, setWebPermission] = useState<"unknown" | "requesting" | "granted" | "denied">("unknown");
  const [webReady, setWebReady]           = useState(false);

  const [scanning, setScanning]         = useState(false);
  const [galleryPicking, setGalleryPicking] = useState(false);
  const [result, setResult]             = useState<FishAnalysis | null>(null);
  const [error, setError]               = useState<string | null>(null);
  const [autoSpeak, setAutoSpeak]       = useState(true);
  const [boatMode, setBoatMode]         = useState(false);
  const [countdown, setCountdown]       = useState(0);
  const [scanCount, setScanCount]       = useState(0);

  const nativeCamRef = useRef<any>(null);
  const webCamRef    = useRef<any>(null);
  const mountTimer   = useRef<ReturnType<typeof setInterval> | null>(null);
  const cdTimer      = useRef<ReturnType<typeof setInterval> | null>(null);

  const AUTO_INTERVAL = 20;

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

  const speakResult = useCallback(
    (analysis: FishAnalysis) => speak(buildSpeech(analysis, character)),
    [speak, character]
  );

  // ── Scan ─────────────────────────────────────────────────────────────────
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

      if (Platform.OS === "web") {
        const photo = await webCamRef.current?.takePicture?.();
        if (!photo?.base64) throw new Error("Camera not ready — please wait.");
        base64 = photo.base64;
        uri    = photo.uri;
      } else {
        if (!nativeCamRef.current) throw new Error("Camera not ready.");
        const photo = await nativeCamRef.current.takePictureAsync({
          base64: true, quality: 1, skipProcessing: false,
        });
        if (!photo?.base64) throw new Error("Failed to capture photo.");
        base64 = photo.base64;
        uri    = photo.uri ?? "";
      }

      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      const baseUrl = domain ? `https://${domain}` : "";
      const response = await fetch(`${baseUrl}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64 }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody?.error ?? "Analysis failed. Try again.");
      }

      const data: FishAnalysis = await response.json();
      setResult(data);
      setScanCount((n) => n + 1);

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      if (autoSpeak || boatMode) speakResult(data);

      addEntry({
        id: Date.now().toString() + Math.random().toString(36).slice(2, 9),
        imageUri: uri,
        timestamp: Date.now(),
        fishCount: data.fishCount,
        species: data.species,
        depth: data.depth,
        suggestion: data.suggestion,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setScanning(false);
    }
  }, [scanning, autoSpeak, boatMode, speakResult, addEntry]);

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

      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      const baseUrl = domain ? `https://${domain}` : "";
      const response = await fetch(`${baseUrl}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: jpeg.base64 }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody?.error ?? "Analysis failed. Try again.");
      }

      const data: FishAnalysis = await response.json();
      setResult(data);
      setScanCount((n) => n + 1);

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      if (autoSpeak) speakResult(data);

      addEntry({
        id: Date.now().toString() + Math.random().toString(36).slice(2, 9),
        imageUri: asset.uri,
        timestamp: Date.now(),
        fishCount: data.fishCount,
        species: data.species,
        depth: data.depth,
        suggestion: data.suggestion,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gallery analysis failed.";
      setError(msg);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setScanning(false);
      setGalleryPicking(false);
    }
  }, [galleryPicking, scanning, autoSpeak, speakResult, addEntry]);

  // ── Boat mode auto-scan loop ──────────────────────────────────────────────
  const stopBoatLoop = useCallback(() => {
    if (mountTimer.current) { clearInterval(mountTimer.current); mountTimer.current = null; }
    if (cdTimer.current)    { clearInterval(cdTimer.current);    cdTimer.current = null; }
    setCountdown(0);
  }, []);

  const startBoatLoop = useCallback(() => {
    stopBoatLoop();
    setCountdown(AUTO_INTERVAL);
    cdTimer.current = setInterval(() =>
      setCountdown((c) => (c <= 1 ? AUTO_INTERVAL : c - 1)), 1000);
    mountTimer.current = setInterval(() => scanNow(), AUTO_INTERVAL * 1000);
  }, [scanNow, stopBoatLoop]);

  useEffect(() => {
    if (boatMode) {
      setAutoSpeak(true);
      startBoatLoop();
    } else {
      stopBoatLoop();
      setScanCount(0);
    }
    return stopBoatLoop;
  }, [boatMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Shared overlay UI ───────────────────────────────────────────────────
  function renderOverlays(isNative: boolean) {
    return (
      <>
        {/* Boat mode tint */}
        {boatMode && (
          <View style={[StyleSheet.absoluteFill, styles.boatTint]} pointerEvents="none" />
        )}

        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: (isNative ? insets.top : topPad) + 8 }]}>
          {!boatMode && (
            <TouchableOpacity
              style={[styles.chip, { backgroundColor: autoSpeak ? `${colors.primary}44` : "#00000077", borderColor: autoSpeak ? colors.primary : "#ffffff44" }]}
              onPress={() => { setAutoSpeak((v) => !v); if (autoSpeak) stopSpeaking(); }}
            >
              <Feather name={autoSpeak ? "volume-2" : "volume-x"} size={13} color={autoSpeak ? colors.primary : "#ffffffaa"} />
              <Text style={[styles.chipText, { color: autoSpeak ? colors.primary : "#ffffffaa" }]}>
                {autoSpeak ? `${charInfo.emoji} Voice` : "Voice OFF"}
              </Text>
            </TouchableOpacity>
          )}

          {boatMode && (
            <View style={[styles.chip, { backgroundColor: "#aaff0022", borderColor: "#aaff0066" }]}>
              <MaterialCommunityIcons name="anchor" size={13} color="#aaff00" />
              <Text style={[styles.chipText, { color: "#aaff00" }]}>
                🚤 BOAT MODE — next scan in {countdown}s
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

          {!boatMode && (
            <View style={{ marginLeft: "auto" }}>
              <NarratorSettingsTrigger />
            </View>
          )}
        </View>

        {/* Aim guide */}
        <View style={styles.aimGuide} pointerEvents="none">
          <View style={[styles.aimCorner, styles.aimTL, { borderColor: boatMode ? "#aaff00" : colors.primary }]} />
          <View style={[styles.aimCorner, styles.aimTR, { borderColor: boatMode ? "#aaff00" : colors.primary }]} />
          <View style={[styles.aimCorner, styles.aimBL, { borderColor: boatMode ? "#aaff00" : colors.primary }]} />
          <View style={[styles.aimCorner, styles.aimBR, { borderColor: boatMode ? "#aaff00" : colors.primary }]} />
          <Text style={[styles.aimLabel, { color: boatMode ? "#aaff00" : colors.primary }]}>
            {boatMode ? `📡 Scanning sonar every ${AUTO_INTERVAL}s` : "Aim at sonar screen"}
          </Text>
          {boatMode && scanCount > 0 && (
            <View style={[styles.cdBadge, { borderColor: "#aaff0066", backgroundColor: "#aaff0011" }]}>
              <Text style={[styles.cdText, { color: "#aaff00" }]}>{scanCount}</Text>
              <Text style={[styles.cdSub, { color: "#aaff0099" }]}>scans</Text>
            </View>
          )}
          {boatMode && scanCount === 0 && (
            <View style={[styles.cdBadge, { borderColor: "#aaff0066", backgroundColor: "#aaff0011" }]}>
              <Text style={[styles.cdText, { color: "#aaff00" }]}>{countdown}s</Text>
            </View>
          )}
        </View>

        {/* Boat mode big result card */}
        {boatMode && result && !scanning && (
          <BoatResultCard
            result={result}
            charInfo={charInfo}
            speaking={speaking}
            onReplay={() => { if (speaking) stopSpeaking(); else speakResult(result); }}
            onClear={() => { setResult(null); stopSpeaking(); }}
          />
        )}

        {/* Standard result overlay (non-boat mode) */}
        {!boatMode && result && !scanning && (
          <View style={[styles.resultOverlay, { backgroundColor: `${colors.background}ee`, borderColor: colors.border }]}>
            <View style={styles.resultRow}>
              <Text style={styles.charBadge}>{charInfo.emoji}</Text>
              <MaterialCommunityIcons name="fish" size={16} color={colors.primary} />
              <Text style={[styles.resultSpecies, { color: colors.primary }]}>{result.species}</Text>
              <View style={[styles.countBadge, { backgroundColor: `${colors.primary}22` }]}>
                <Text style={[styles.countText, { color: colors.primary }]}>{result.fishCount} fish</Text>
              </View>
            </View>
            <Text style={[styles.resultDetail, { color: colors.foreground }]}>{result.depth} · {result.distance}</Text>
            {result.lure && <Text style={[styles.resultLure, { color: colors.accent }]} numberOfLines={2}>{result.lure}</Text>}
            <View style={styles.resultActions}>
              <TouchableOpacity
                style={[styles.replayBtn, { backgroundColor: `${charInfo.color}22`, borderColor: `${charInfo.color}44` }]}
                onPress={() => { if (speaking) stopSpeaking(); else speakResult(result); }}
              >
                <Feather name={speaking ? "volume-x" : "volume-2"} size={14} color={charInfo.color} />
                <Text style={[styles.replayText, { color: charInfo.color }]}>
                  {speaking ? "Stop" : `${charInfo.emoji} Read`}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.clearBtn, { borderColor: colors.border }]}
                onPress={() => { setResult(null); stopSpeaking(); }}
              >
                <Feather name="x" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Error overlay */}
        {error && !scanning && (
          <View style={[styles.errorOverlay, { backgroundColor: `${colors.destructive}22`, borderColor: `${colors.destructive}55` }]}>
            <Feather name="alert-circle" size={14} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]} numberOfLines={2}>{error}</Text>
            <TouchableOpacity onPress={() => setError(null)}>
              <Feather name="x" size={14} color={colors.destructive} />
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom bar */}
        <View style={[styles.bottomBar, { paddingBottom: botPad }]}>
          {/* Scan row: [GALLERY] [● SCAN ●] [spacer] */}
          <View style={styles.scanRow}>
            {!boatMode ? (
              <TouchableOpacity
                style={[styles.galleryBtn, (galleryPicking || scanning) && { opacity: 0.45 }]}
                onPress={pickFromGallery}
                disabled={galleryPicking || scanning}
                activeOpacity={0.78}
              >
                {galleryPicking ? (
                  <ActivityIndicator color="#00d4aa" size="small" />
                ) : (
                  <Feather name="image" size={26} color="#00d4aa" />
                )}
                <Text style={styles.galleryBtnText}>GALLERY</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.gallerySpacer} />
            )}

            <GlowButton
              onPress={scanNow}
              scanning={scanning}
              boatMode={boatMode}
              ready={isNative ? true : webReady}
            />

            {/* Mirror spacer so the scan button stays centred */}
            <View style={styles.gallerySpacer} />
          </View>

          {/* BOAT MODE big toggle button */}
          <TouchableOpacity
            style={[
              styles.boatModeBtn,
              boatMode
                ? { backgroundColor: "#aaff00", borderColor: "#aaff00" }
                : { backgroundColor: "#0a162888", borderColor: "#aaff0066" },
            ]}
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              setBoatMode((v) => !v);
              setResult(null);
            }}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons
              name="anchor"
              size={18}
              color={boatMode ? "#0a1628" : "#aaff00"}
            />
            <Text style={[styles.boatModeBtnText, { color: boatMode ? "#0a1628" : "#aaff00" }]}>
              {boatMode ? "🚤 EXIT BOAT MODE" : "🚤 BOAT MODE"}
            </Text>
            {boatMode && (
              <View style={styles.boatLiveDot} />
            )}
          </TouchableOpacity>

          {/* Scan a saved sonar photo */}
          {!boatMode && (
            <TouchableOpacity
              style={styles.sonarPhotoBtn}
              onPress={() => {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.navigate("/(tabs)/index" as any);
              }}
              activeOpacity={0.82}
            >
              <Feather name="image" size={14} color="#00d4aa" />
              <Text style={styles.sonarPhotoBtnText}>SCAN SONAR PHOTO</Text>
              <MaterialCommunityIcons name="radar" size={14} color="#00d4aa88" />
            </TouchableOpacity>
          )}

          <Text style={[styles.hint, { color: "#ffffffcc" }]}>
            {boatMode
              ? `Screen stays on · auto-scan every ${AUTO_INTERVAL}s · voice ON`
              : "Point at sonar — tap to scan"}
          </Text>
        </View>
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
            <Text style={[styles.permOrDivider, { color: colors.mutedForeground }]}>— or —</Text>
            <TouchableOpacity
              style={styles.permGalleryBtn}
              onPress={pickFromGallery}
              disabled={galleryPicking || scanning}
              activeOpacity={0.82}
            >
              {galleryPicking ? (
                <ActivityIndicator color="#00d4aa" size="small" />
              ) : (
                <Feather name="image" size={22} color="#00d4aa" />
              )}
              <Text style={styles.permGalleryText}>
                {galleryPicking ? "Analysing…" : "Pick from Gallery"}
              </Text>
            </TouchableOpacity>
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
            <TouchableOpacity
              style={styles.permGalleryBtn}
              onPress={pickFromGallery}
              disabled={galleryPicking || scanning}
              activeOpacity={0.82}
            >
              {galleryPicking ? (
                <ActivityIndicator color="#00d4aa" size="small" />
              ) : (
                <Feather name="image" size={22} color="#00d4aa" />
              )}
              <Text style={styles.permGalleryText}>
                {galleryPicking ? "Analysing…" : "Pick from Gallery"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.container, { backgroundColor: "#000" }]}>
        {WebCameraView && <WebCameraView ref={webCamRef} onReady={() => setWebReady(true)} />}
        <BarraSketches opacity={0.7} />
        {renderOverlays(false)}
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
          <Text style={[styles.permOrDivider, { color: colors.mutedForeground }]}>— or —</Text>
          <TouchableOpacity
            style={styles.permGalleryBtn}
            onPress={pickFromGallery}
            disabled={galleryPicking || scanning}
            activeOpacity={0.82}
          >
            {galleryPicking ? (
              <ActivityIndicator color="#00d4aa" size="small" />
            ) : (
              <Feather name="image" size={22} color="#00d4aa" />
            )}
            <Text style={styles.permGalleryText}>
              {galleryPicking ? "Analysing…" : "Pick from Gallery"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: "#000" }]}>
      <CameraView ref={nativeCamRef} style={StyleSheet.absoluteFill} facing="back" mode="picture" />
      <BarraSketches opacity={0.7} />
      {renderOverlays(true)}
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

  aimGuide: { position: "absolute", top: "25%", left: 32, right: 32, height: "35%", alignItems: "center", justifyContent: "center", zIndex: 5 },
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
    alignItems: "center", paddingTop: 12, gap: 8, zIndex: 10,
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
});
