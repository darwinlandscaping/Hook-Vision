import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

import { SonarPulse } from "@/components/SonarPulse";
import { NarratorSettingsTrigger } from "@/components/NarratorSettings";
import { useColors } from "@/hooks/useColors";
import { useHistory } from "@/context/HistoryContext";
import { CHARACTERS, useNarrator, type NarratorCharacter } from "@/context/NarratorContext";

interface FishAnalysis {
  fishCount: number;
  depth: string;
  distance: string;
  species: string;
  confidence: number;
  suggestion: string;
  lure?: string;
  technique?: string;
  rig?: string;
  waterTemp?: string;
  bottomType?: string;
  sonarModel?: string | null;
}

const SPECIES_SLANG: Record<string, string> = {
  barramundi: "barra",
  "mangrove jack": "jack",
  "spanish mackerel": "spaniard",
  "giant trevally": "GT",
  "coral trout": "coral",
  queenfish: "queenie",
  "threadfin salmon": "threadie",
  "king threadfin": "threadie",
  "black jewfish": "jewie",
  jewfish: "jewie",
  "red emperor": "emperor",
};

function speciesNickname(raw: string): string {
  const clean = raw.replace(/\s*\(\d+%\)/, "").toLowerCase();
  for (const [key, nick] of Object.entries(SPECIES_SLANG)) {
    if (clean.includes(key)) return nick;
  }
  return raw.replace(/\s*\(\d+%\)/, "");
}

// ─── Character-specific speech builders ──────────────────────────────────────
function buildSpeech(a: FishAnalysis, character: NarratorCharacter): string {
  const nick = speciesNickname(a.species);
  const count = a.fishCount;
  const lureNote = a.lure ? ` Chuck on ${a.lure}.` : "";
  const techNote = a.technique ? ` ${a.technique}` : "";

  switch (character) {
    case "BENAUD": {
      const countWord = count === 0 ? "Nothing at all" : count === 1 ? "One magnificent specimen" : `${count} fish`;
      return `${countWord} on the sonar — ${nick} holding at ${a.depth}, ${a.distance}. ${
        a.confidence >= 80 ? "One has complete confidence in that reading." : "The evidence suggests that is the most likely candidate."
      }${lureNote ? ` ${lureNote}` : ""} Marvellous conditions for a delivery.`;
    }
    case "CHOPPER": {
      if (count === 0) return "Listen here ya mug — absolutely nothin' on the sonar. Move the bloody boat.";
      return `${count === 1 ? "One unit" : `${count} fish, ya mug`} — ${nick}, ${a.depth}, ${a.distance}. I'm tellin' ya deadset.${lureNote}${techNote} Get in there and do it.`;
    }
    case "ATTENBOROUGH": {
      if (count === 0) return "The ancient waters yield nothing to our instruments at this moment. We must seek them elsewhere.";
      return `Here, in the remarkable waters of the Northern Territory, ${count === 1 ? "a solitary" : `${count}`} ${nick} ${count === 1 ? "rests" : "rest"} at ${a.depth}. ${
        a.confidence >= 80 ? "Our instruments confirm this with some certainty." : "The evidence, while suggestive, remains inconclusive."
      }${lureNote}`;
    }
    default: {
      // AUSSIE
      if (count === 0) return "Oi mate, sonar's drawing a blank — nothing showing down there right now.";
      const opener = count === 1 ? "Got a lone unit on the sonar, mate." :
        count <= 3 ? `Ripper — got ${count} fish showing!` :
        `Bloody hell, ${count} fish stacked up down there!`;
      return `${opener} Reckon they're ${nick} — sitting about ${a.depth}, ${a.distance}.${lureNote}${techNote} Get in there and smash 'em!`;
    }
  }
}

export default function LiveScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { addEntry } = useHistory();
  const { character, speak, stop: stopSpeaking, speaking } = useNarrator();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanning,   setScanning]        = useState(false);
  const [result,     setResult]          = useState<FishAnalysis | null>(null);
  const [error,      setError]           = useState<string | null>(null);
  const [autoSpeak,  setAutoSpeak]       = useState(true);
  const [mountMode,  setMountMode]       = useState(false);   // bracket mount auto-scan
  const [countdown,  setCountdown]       = useState(0);
  const [autoSpoke,  setAutoSpoke]       = useState(false);   // label feedback

  const cameraRef   = useRef<CameraView>(null);
  const mountTimer  = useRef<ReturnType<typeof setInterval> | null>(null);
  const cdTimer     = useRef<ReturnType<typeof setInterval> | null>(null);

  const AUTO_INTERVAL = 12; // seconds between auto-scans

  const speakResult = useCallback(
    (analysis: FishAnalysis) => {
      speak(buildSpeech(analysis, character));
    },
    [speak, character]
  );

  const scanNow = useCallback(async () => {
    if (scanning || !cameraRef.current) return;

    setScanning(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.75,
        skipProcessing: true,
      });

      if (!photo?.base64) throw new Error("Failed to capture photo.");

      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      const baseUrl = domain ? `https://${domain}` : "";
      const response = await fetch(`${baseUrl}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: photo.base64 }),
      });

      if (!response.ok) {
        let errMsg = "Analysis failed. Try again.";
        try {
          const errBody = await response.json();
          if (errBody?.error) errMsg = errBody.error;
        } catch { /* ignore */ }
        throw new Error(errMsg);
      }

      const data: FishAnalysis = await response.json();
      setResult(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (autoSpeak) {
        speakResult(data);
        setAutoSpoke(true);
        setTimeout(() => setAutoSpoke(false), 3000);
      }

      addEntry({
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        imageUri: photo.uri ?? "",
        timestamp: Date.now(),
        fishCount: data.fishCount,
        species: data.species,
        depth: data.depth,
        suggestion: data.suggestion,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setScanning(false);
    }
  }, [scanning, autoSpeak, speakResult, addEntry]);

  // ── Mount mode: auto-scan every AUTO_INTERVAL seconds ──────────────────────
  const stopMountMode = useCallback(() => {
    if (mountTimer.current)  { clearInterval(mountTimer.current);  mountTimer.current = null; }
    if (cdTimer.current)     { clearInterval(cdTimer.current);     cdTimer.current = null; }
    setCountdown(0);
  }, []);

  const startMountMode = useCallback(() => {
    stopMountMode();
    setCountdown(AUTO_INTERVAL);
    // countdown display
    cdTimer.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) return AUTO_INTERVAL;
        return c - 1;
      });
    }, 1000);
    // actual scans
    mountTimer.current = setInterval(() => {
      scanNow();
    }, AUTO_INTERVAL * 1000);
  }, [scanNow, stopMountMode]);

  useEffect(() => {
    if (mountMode) startMountMode();
    else stopMountMode();
    return stopMountMode;
  }, [mountMode]);  // eslint-disable-line react-hooks/exhaustive-deps

  const charInfo = CHARACTERS.find((c) => c.id === character) ?? CHARACTERS[0];
  const topPad    = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 16;

  if (Platform.OS === "web") {
    return (
      <View style={[styles.permissionContainer, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <MaterialCommunityIcons name="video" size={52} color={colors.mutedForeground} />
        <Text style={[styles.permTitle, { color: colors.foreground }]}>Live Camera</Text>
        <Text style={[styles.permDesc, { color: colors.mutedForeground }]}>
          Live camera and sonar mount mode are available on your phone. Open HookVision on your device to use it.
        </Text>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={[styles.permissionContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.permissionContainer, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <MaterialCommunityIcons name="video-off" size={52} color={colors.mutedForeground} />
        <Text style={[styles.permTitle, { color: colors.foreground }]}>Camera Access Needed</Text>
        <Text style={[styles.permDesc, { color: colors.mutedForeground }]}>
          Mount your phone facing the sonar screen for continuous hands-free analysis with voice readout.
        </Text>
        <TouchableOpacity
          style={[styles.permBtn, { backgroundColor: colors.primary }]}
          onPress={requestPermission}
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
      {/* Camera feed */}
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" mode="picture" />

      {/* Mount mode overlay tint */}
      {mountMode && (
        <View style={[StyleSheet.absoluteFill, styles.mountTint]} pointerEvents="none" />
      )}

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
        {/* Auto-speak */}
        <TouchableOpacity
          style={[styles.chip, { backgroundColor: autoSpeak ? `${colors.primary}33` : `#00000066`, borderColor: autoSpeak ? colors.primary : "#ffffff44" }]}
          onPress={() => { setAutoSpeak((v) => !v); if (autoSpeak) stopSpeaking(); }}
          activeOpacity={0.8}
        >
          <Feather name={autoSpeak ? "volume-2" : "volume-x"} size={13} color={autoSpeak ? colors.primary : "#ffffffaa"} />
          <Text style={[styles.chipText, { color: autoSpeak ? colors.primary : "#ffffffaa" }]}>
            {autoSpeak ? `${charInfo.emoji} Voice` : "Voice OFF"}
          </Text>
        </TouchableOpacity>

        {/* Sonar mount mode */}
        <TouchableOpacity
          style={[styles.chip, { backgroundColor: mountMode ? "#ff450033" : "#00000066", borderColor: mountMode ? "#ff4500" : "#ffffff44" }]}
          onPress={() => setMountMode((v) => !v)}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="bracket" size={13} color={mountMode ? "#ff4500" : "#ffffffaa"} />
          <Text style={[styles.chipText, { color: mountMode ? "#ff4500" : "#ffffffaa" }]}>
            {mountMode ? `Auto ${countdown}s` : "Mount Mode"}
          </Text>
        </TouchableOpacity>

        {/* Speaking indicator */}
        {speaking && (
          <TouchableOpacity
            style={[styles.chip, { backgroundColor: `${charInfo.color}33`, borderColor: charInfo.color }]}
            onPress={stopSpeaking}
          >
            <SonarPulse size={14} active />
            <Text style={[styles.chipText, { color: charInfo.color }]}>Stop {charInfo.emoji}</Text>
          </TouchableOpacity>
        )}

        {/* Narrator settings */}
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
          <Text style={[styles.resultDetail, { color: colors.foreground }]}>
            {result.depth} · {result.distance}
          </Text>
          {result.lure && (
            <Text style={[styles.resultLure, { color: colors.accent }]} numberOfLines={2}>{result.lure}</Text>
          )}
          {result.technique && (
            <Text style={[styles.resultTechnique, { color: colors.mutedForeground }]} numberOfLines={2}>{result.technique}</Text>
          )}
          <View style={styles.resultActions}>
            <TouchableOpacity
              style={[styles.replayBtn, { backgroundColor: `${charInfo.color}22`, borderColor: `${charInfo.color}44` }]}
              onPress={() => { if (speaking) stopSpeaking(); else speakResult(result); }}
              activeOpacity={0.8}
            >
              <Feather name={speaking ? "volume-x" : "volume-2"} size={14} color={charInfo.color} />
              <Text style={[styles.replayText, { color: charInfo.color }]}>
                {speaking ? "Stop" : `${charInfo.emoji} Read aloud`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.clearBtn, { borderColor: colors.border }]}
              onPress={() => { setResult(null); stopSpeaking(); }}
              activeOpacity={0.8}
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
      <View style={[styles.bottomBar, { paddingBottom: bottomPad }]}>
        {scanning ? (
          <View style={styles.scanningState}>
            <SonarPulse size={64} active />
            <Text style={[styles.scanningText, { color: colors.primary }]}>Analysing sonar…</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.scanBtn, { backgroundColor: mountMode ? "#cc3300" : colors.primary }]}
            onPress={scanNow}
            activeOpacity={0.85}
          >
            <Feather name="zap" size={22} color="#fff" />
            <Text style={[styles.scanBtnText, { color: "#fff" }]}>
              {mountMode ? "Scan Now (Auto ON)" : "Scan Now"}
            </Text>
          </TouchableOpacity>
        )}
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          {mountMode
            ? "📡 Sonar mount mode — scanning automatically"
            : "Point camera at sonar screen and tap Scan"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  permissionContainer: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 32, gap: 16,
  },
  permTitle: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  permDesc:  { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  permBtn:   { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 13, borderRadius: 30, marginTop: 8 },
  permBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },

  mountTint: { backgroundColor: "#ff450008" },

  topBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    paddingHorizontal: 12, flexDirection: "row", alignItems: "center",
    gap: 8, zIndex: 10, flexWrap: "wrap",
  },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20, borderWidth: 1,
  },
  chipText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  aimGuide: {
    position: "absolute", top: "25%", left: 32, right: 32, height: "35%",
    alignItems: "center", justifyContent: "center", zIndex: 5,
  },
  aimCorner: { position: "absolute", width: 22, height: 22 },
  aimTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 4 },
  aimTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 4 },
  aimBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 4 },
  aimBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 4 },
  aimLabel: { fontSize: 11, fontFamily: "Inter_500Medium", letterSpacing: 0.5, opacity: 0.9, textAlign: "center" },
  cdBadge: {
    marginTop: 12, width: 52, height: 52, borderRadius: 26,
    backgroundColor: "#ff450022", borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  cdText: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#ff4500" },

  resultOverlay: {
    position: "absolute", left: 16, right: 16, bottom: 160,
    borderRadius: 16, borderWidth: 1, padding: 16, gap: 6, zIndex: 20,
  },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  charBadge: { fontSize: 16 },
  resultSpecies: { fontSize: 16, fontFamily: "Inter_700Bold", flex: 1 },
  countBadge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  countText:     { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  resultDetail:  { fontSize: 13, fontFamily: "Inter_500Medium" },
  resultLure:    { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  resultTechnique: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  resultActions: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  replayBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1,
  },
  replayText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  clearBtn: {
    width: 30, height: 30, borderRadius: 15, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },

  errorOverlay: {
    position: "absolute", left: 16, right: 16, bottom: 160,
    borderRadius: 12, borderWidth: 1, padding: 12,
    flexDirection: "row", alignItems: "center", gap: 8, zIndex: 20,
  },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },

  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    alignItems: "center", paddingTop: 16, gap: 10, zIndex: 10,
  },
  scanBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, paddingHorizontal: 44, paddingVertical: 18, borderRadius: 50,
  },
  scanBtnText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  scanningState: { alignItems: "center", gap: 8 },
  scanningText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  hint: { fontSize: 11, fontFamily: "Inter_400Regular" },
});
