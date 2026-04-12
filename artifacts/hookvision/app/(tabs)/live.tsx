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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

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
  // dynamically require so Metro doesn't try to resolve on web build
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

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function LiveScreen() {
  const colors   = useColors();
  const insets   = useSafeAreaInsets();
  const { addEntry } = useHistory();
  const { character, speak, stop: stopSpeaking, speaking } = useNarrator();
  useAutoNarrate(() => "Live Camera mode. Point your phone at a sonar screen for real-time AI fish detection and depth overlay.");

  // Native-only camera permissions
  const [nativePermission, requestNativePermission] =
    useCameraPermissions ? useCameraPermissions() : [null, null];

  // Web camera state
  const [webPermission, setWebPermission] = useState<"unknown" | "requesting" | "granted" | "denied">("unknown");
  const [webReady, setWebReady] = useState(false);

  // Shared state
  const [scanning, setScanning] = useState(false);
  const [result, setResult]     = useState<FishAnalysis | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [mountMode, setMountMode] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Camera refs
  const nativeCamRef = useRef<any>(null);
  const webCamRef    = useRef<any>(null);
  const mountTimer   = useRef<ReturnType<typeof setInterval> | null>(null);
  const cdTimer      = useRef<ReturnType<typeof setInterval> | null>(null);

  const AUTO_INTERVAL = 12;

  const charInfo = CHARACTERS.find((c) => c.id === character) ?? CHARACTERS[0];
  const topPad   = Platform.OS === "web" ? 20 : insets.top;
  const botPad   = Platform.OS === "web" ? 70 : insets.bottom + 16;

  // Request web camera
  const requestWebCamera = useCallback(async () => {
    setWebPermission("requesting");
    try {
      // Just checking we can — WebCameraView handles the actual stream
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop()); // release the probe stream
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
          base64: true, quality: 0.75, skipProcessing: true,
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

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      if (autoSpeak) speakResult(data);

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
  }, [scanning, autoSpeak, speakResult, addEntry]);

  // ── Mount mode ────────────────────────────────────────────────────────────
  const stopMount = useCallback(() => {
    if (mountTimer.current)  { clearInterval(mountTimer.current);  mountTimer.current = null; }
    if (cdTimer.current)     { clearInterval(cdTimer.current);     cdTimer.current = null; }
    setCountdown(0);
  }, []);

  const startMount = useCallback(() => {
    stopMount();
    setCountdown(AUTO_INTERVAL);
    cdTimer.current = setInterval(() =>
      setCountdown((c) => (c <= 1 ? AUTO_INTERVAL : c - 1)), 1000);
    mountTimer.current = setInterval(() => scanNow(), AUTO_INTERVAL * 1000);
  }, [scanNow, stopMount]);

  useEffect(() => {
    if (mountMode) startMount(); else stopMount();
    return stopMount;
  }, [mountMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── WEB rendering ──────────────────────────────────────────────────────────
  if (Platform.OS === "web") {
    // Step 1: ask permission
    if (webPermission === "unknown" || webPermission === "requesting") {
      return (
        <View style={[styles.permContainer, { backgroundColor: colors.background }]}>
          <HVHeader subtitle="Live Camera" />
          <MaterialCommunityIcons name="video" size={52} color={colors.primary} />
          <Text style={[styles.permTitle, { color: colors.foreground }]}>Live Sonar Camera</Text>
          <Text style={[styles.permDesc, { color: colors.mutedForeground }]}>
            Mount your phone facing the sonar screen for continuous hands-free analysis with voice readout.
          </Text>
          {webPermission === "requesting" ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />
          ) : (
            <TouchableOpacity
              style={[styles.permBtn, { backgroundColor: colors.primary }]}
              onPress={requestWebCamera}
              activeOpacity={0.85}
            >
              <Feather name="video" size={16} color={colors.primaryForeground} />
              <Text style={[styles.permBtnText, { color: colors.primaryForeground }]}>Allow Camera</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    if (webPermission === "denied") {
      return (
        <View style={[styles.permContainer, { backgroundColor: colors.background }]}>
          <HVHeader subtitle="Live Camera" />
          <Feather name="video-off" size={52} color={colors.destructive} />
          <Text style={[styles.permTitle, { color: colors.foreground }]}>Camera Blocked</Text>
          <Text style={[styles.permDesc, { color: colors.mutedForeground }]}>
            Camera access was denied. In your browser settings, allow camera access for this site, then reload.
          </Text>
        </View>
      );
    }

    // Step 2: show camera + UI
    return (
      <View style={[styles.container, { backgroundColor: "#000" }]}>
        {/* HTML5 camera stream */}
        {WebCameraView && (
          <WebCameraView
            ref={webCamRef}
            onReady={() => setWebReady(true)}
          />
        )}

        {/* Mount mode tint */}
        {mountMode && (
          <View style={[StyleSheet.absoluteFill, styles.mountTint]} pointerEvents="none" />
        )}

        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
          <TouchableOpacity
            style={[styles.chip, { backgroundColor: autoSpeak ? `${colors.primary}44` : "#00000077", borderColor: autoSpeak ? colors.primary : "#ffffff44" }]}
            onPress={() => { setAutoSpeak((v) => !v); if (autoSpeak) stopSpeaking(); }}
          >
            <Feather name={autoSpeak ? "volume-2" : "volume-x"} size={13} color={autoSpeak ? colors.primary : "#ffffffaa"} />
            <Text style={[styles.chipText, { color: autoSpeak ? colors.primary : "#ffffffaa" }]}>
              {autoSpeak ? `${charInfo.emoji} Voice` : "Voice OFF"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chip, { backgroundColor: mountMode ? "#ff450044" : "#00000077", borderColor: mountMode ? "#ff4500" : "#ffffff44" }]}
            onPress={() => setMountMode((v) => !v)}
          >
            <MaterialCommunityIcons name="bracket" size={13} color={mountMode ? "#ff4500" : "#ffffffaa"} />
            <Text style={[styles.chipText, { color: mountMode ? "#ff4500" : "#ffffffaa" }]}>
              {mountMode ? `Auto ${countdown}s` : "Mount Mode"}
            </Text>
          </TouchableOpacity>

          {speaking && (
            <TouchableOpacity
              style={[styles.chip, { backgroundColor: `${charInfo.color}44`, borderColor: charInfo.color }]}
              onPress={stopSpeaking}
            >
              <SonarPulse size={12} active />
              <Text style={[styles.chipText, { color: charInfo.color }]}>Stop {charInfo.emoji}</Text>
            </TouchableOpacity>
          )}

          <View style={{ marginLeft: "auto" }}>
            <NarratorSettingsTrigger />
          </View>
        </View>

        {/* Aim guide */}
        <View style={styles.aimGuide} pointerEvents="none">
          <View style={[styles.aimCorner, styles.aimTL, { borderColor: mountMode ? "#ff4500" : colors.primary }]} />
          <View style={[styles.aimCorner, styles.aimTR, { borderColor: mountMode ? "#ff4500" : colors.primary }]} />
          <View style={[styles.aimCorner, styles.aimBL, { borderColor: mountMode ? "#ff4500" : colors.primary }]} />
          <View style={[styles.aimCorner, styles.aimBR, { borderColor: mountMode ? "#ff4500" : colors.primary }]} />
          <Text style={[styles.aimLabel, { color: mountMode ? "#ff4500" : colors.primary }]}>
            {mountMode ? `⚡ AUTO — scanning every ${AUTO_INTERVAL}s` : "Aim at sonar screen"}
          </Text>
          {mountMode && (
            <View style={[styles.cdBadge, { borderColor: "#ff450066" }]}>
              <Text style={styles.cdText}>{countdown}s</Text>
            </View>
          )}
        </View>

        {/* Result overlay */}
        {result && !scanning && (
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
          {scanning ? (
            <View style={styles.scanningState}>
              <SonarPulse size={60} active />
              <Text style={[styles.scanningText, { color: colors.primary }]}>Analysing sonar…</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.scanBtn, { backgroundColor: mountMode ? "#cc3300" : colors.primary, opacity: webReady ? 1 : 0.5 }]}
              onPress={scanNow}
              disabled={!webReady}
            >
              <Feather name="zap" size={22} color="#fff" />
              <Text style={styles.scanBtnText}>
                {webReady ? (mountMode ? "Scan Now (Auto ON)" : "Scan Now") : "Starting camera…"}
              </Text>
            </TouchableOpacity>
          )}
          <Text style={[styles.hint, { color: "#ffffffaa" }]}>
            {mountMode ? "📡 Sonar mount — scanning automatically" : "Point at sonar screen and tap Scan"}
          </Text>
        </View>
      </View>
    );
  }

  // ─── NATIVE rendering ────────────────────────────────────────────────────────
  if (!nativePermission) {
    return (
      <View style={[styles.permContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!nativePermission.granted) {
    return (
      <View style={[styles.permContainer, { backgroundColor: colors.background, paddingTop: insets.top + 20 }]}>
        <MaterialCommunityIcons name="video-off" size={52} color={colors.mutedForeground} />
        <Text style={[styles.permTitle, { color: colors.foreground }]}>Camera Access Needed</Text>
        <Text style={[styles.permDesc, { color: colors.mutedForeground }]}>
          Mount your phone facing the sonar screen for continuous hands-free analysis with voice readout.
        </Text>
        <TouchableOpacity
          style={[styles.permBtn, { backgroundColor: colors.primary }]}
          onPress={requestNativePermission}
          activeOpacity={0.85}
        >
          <Feather name="camera" size={16} color={colors.primaryForeground} />
          <Text style={[styles.permBtnText, { color: colors.primaryForeground }]}>Allow Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <CameraView ref={nativeCamRef} style={StyleSheet.absoluteFill} facing="back" mode="picture" />

      {mountMode && <View style={[StyleSheet.absoluteFill, styles.mountTint]} pointerEvents="none" />}

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={[styles.chip, { backgroundColor: autoSpeak ? `${colors.primary}44` : "#00000077", borderColor: autoSpeak ? colors.primary : "#ffffff44" }]}
          onPress={() => { setAutoSpeak((v) => !v); if (autoSpeak) stopSpeaking(); }}
        >
          <Feather name={autoSpeak ? "volume-2" : "volume-x"} size={13} color={autoSpeak ? colors.primary : "#ffffffaa"} />
          <Text style={[styles.chipText, { color: autoSpeak ? colors.primary : "#ffffffaa" }]}>
            {autoSpeak ? `${charInfo.emoji} Voice` : "Voice OFF"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.chip, { backgroundColor: mountMode ? "#ff450044" : "#00000077", borderColor: mountMode ? "#ff4500" : "#ffffff44" }]}
          onPress={() => setMountMode((v) => !v)}
        >
          <MaterialCommunityIcons name="bracket" size={13} color={mountMode ? "#ff4500" : "#ffffffaa"} />
          <Text style={[styles.chipText, { color: mountMode ? "#ff4500" : "#ffffffaa" }]}>
            {mountMode ? `Auto ${countdown}s` : "Mount Mode"}
          </Text>
        </TouchableOpacity>

        {speaking && (
          <TouchableOpacity
            style={[styles.chip, { backgroundColor: `${charInfo.color}44`, borderColor: charInfo.color }]}
            onPress={stopSpeaking}
          >
            <SonarPulse size={12} active />
            <Text style={[styles.chipText, { color: charInfo.color }]}>Stop {charInfo.emoji}</Text>
          </TouchableOpacity>
        )}

        <View style={{ marginLeft: "auto" }}>
          <NarratorSettingsTrigger />
        </View>
      </View>

      {/* Aim guide */}
      <View style={styles.aimGuide} pointerEvents="none">
        <View style={[styles.aimCorner, styles.aimTL, { borderColor: mountMode ? "#ff4500" : colors.primary }]} />
        <View style={[styles.aimCorner, styles.aimTR, { borderColor: mountMode ? "#ff4500" : colors.primary }]} />
        <View style={[styles.aimCorner, styles.aimBL, { borderColor: mountMode ? "#ff4500" : colors.primary }]} />
        <View style={[styles.aimCorner, styles.aimBR, { borderColor: mountMode ? "#ff4500" : colors.primary }]} />
        <Text style={[styles.aimLabel, { color: mountMode ? "#ff4500" : colors.primary }]}>
          {mountMode ? `⚡ AUTO — scanning every ${AUTO_INTERVAL}s` : "Aim at sonar screen"}
        </Text>
        {mountMode && (
          <View style={[styles.cdBadge, { borderColor: "#ff450066" }]}>
            <Text style={styles.cdText}>{countdown}s</Text>
          </View>
        )}
      </View>

      {/* Result overlay */}
      {result && !scanning && (
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
        {scanning ? (
          <View style={styles.scanningState}>
            <SonarPulse size={60} active />
            <Text style={[styles.scanningText, { color: colors.primary }]}>Analysing sonar…</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.scanBtn, { backgroundColor: mountMode ? "#cc3300" : colors.primary }]}
            onPress={scanNow}
            activeOpacity={0.85}
          >
            <Feather name="zap" size={22} color="#fff" />
            <Text style={styles.scanBtnText}>
              {mountMode ? "Scan Now (Auto ON)" : "Scan Now"}
            </Text>
          </TouchableOpacity>
        )}
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          {mountMode ? "📡 Sonar mount — scanning automatically" : "Point at sonar screen and tap Scan"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  permContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16 },
  permTitle:   { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  permDesc:    { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  permBtn:     { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 13, borderRadius: 30, marginTop: 8 },
  permBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },

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
  cdBadge:  { marginTop: 12, width: 52, height: 52, borderRadius: 26, backgroundColor: "#ff450022", borderWidth: 2, alignItems: "center", justifyContent: "center" },
  cdText:   { fontSize: 18, fontFamily: "Inter_700Bold", color: "#ff4500" },

  resultOverlay: { position: "absolute", left: 16, right: 16, bottom: 140, borderRadius: 16, borderWidth: 1, padding: 16, gap: 6, zIndex: 20 },
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

  errorOverlay: { position: "absolute", left: 16, right: 16, bottom: 140, borderRadius: 12, borderWidth: 1, padding: 12, flexDirection: "row", alignItems: "center", gap: 8, zIndex: 20 },
  errorText:    { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },

  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, alignItems: "center", paddingTop: 16, gap: 10, zIndex: 10 },
  scanBtn:   { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 44, paddingVertical: 18, borderRadius: 50 },
  scanBtnText: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff" },
  scanningState: { alignItems: "center", gap: 8 },
  scanningText:  { fontSize: 14, fontFamily: "Inter_400Regular" },
  hint: { fontSize: 11, fontFamily: "Inter_400Regular" },
});
