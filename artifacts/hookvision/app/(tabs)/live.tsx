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
import * as Speech from "expo-speech";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

import { SonarPulse } from "@/components/SonarPulse";
import { useColors } from "@/hooks/useColors";
import { useHistory } from "@/context/HistoryContext";

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

function buildSpeechText(a: FishAnalysis): string {
  const parts: string[] = [];
  const speciesClean = a.species.replace(/\s*\(\d+%\)/, "");
  parts.push(`I can see ${a.fishCount} ${a.fishCount === 1 ? "fish" : "fish"} on the sonar.`);
  parts.push(`Most likely ${speciesClean}, at ${a.depth}, ${a.distance}.`);
  if (a.lure) parts.push(`Use ${a.lure}.`);
  if (a.technique) parts.push(a.technique);
  if (a.rig) parts.push(`Rig up with ${a.rig}.`);
  if (a.suggestion) parts.push(a.suggestion);
  return parts.join(" ");
}

export default function LiveScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addEntry } = useHistory();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [result, setResult] = useState<FishAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(true);

  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  const speakResult = useCallback(
    (analysis: FishAnalysis) => {
      Speech.stop();
      setSpeaking(true);
      const text = buildSpeechText(analysis);
      Speech.speak(text, {
        language: "en-AU",
        rate: 0.92,
        pitch: 1.0,
        onDone: () => setSpeaking(false),
        onError: () => setSpeaking(false),
        onStopped: () => setSpeaking(false),
      });
    },
    []
  );

  const stopSpeaking = useCallback(() => {
    Speech.stop();
    setSpeaking(false);
  }, []);

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

      if (autoSpeak) speakResult(data);

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

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 16;

  if (Platform.OS === "web") {
    return (
      <View style={[styles.permissionContainer, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <MaterialCommunityIcons name="video" size={52} color={colors.mutedForeground} />
        <Text style={[styles.permTitle, { color: colors.foreground }]}>Live Camera</Text>
        <Text style={[styles.permDesc, { color: colors.mutedForeground }]}>
          Live camera is available on your phone. Open HookVision on your device to use it.
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
          Point your camera at the sonar screen for live hands-free analysis with voice readout.
        </Text>
        <TouchableOpacity
          style={[styles.permBtn, { backgroundColor: colors.primary }]}
          onPress={requestPermission}
          activeOpacity={0.85}
        >
          <Feather name="camera" size={16} color={colors.primaryForeground} />
          <Text style={[styles.permBtnText, { color: colors.primaryForeground }]}>
            Allow Camera
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Live camera feed — full screen */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        mode="picture"
      />

      {/* Top overlay — controls */}
      <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
        {/* Auto-speak toggle */}
        <TouchableOpacity
          style={[
            styles.toggleChip,
            {
              backgroundColor: autoSpeak ? `${colors.primary}33` : `${colors.secondary}cc`,
              borderColor: autoSpeak ? colors.primary : colors.border,
            },
          ]}
          onPress={() => {
            setAutoSpeak((v) => !v);
            if (autoSpeak) stopSpeaking();
          }}
          activeOpacity={0.8}
        >
          <Feather
            name={autoSpeak ? "volume-2" : "volume-x"}
            size={14}
            color={autoSpeak ? colors.primary : colors.mutedForeground}
          />
          <Text
            style={[
              styles.toggleText,
              { color: autoSpeak ? colors.primary : colors.mutedForeground },
            ]}
          >
            {autoSpeak ? "Voice ON" : "Voice OFF"}
          </Text>
        </TouchableOpacity>

        {/* Speaking indicator */}
        {speaking && (
          <TouchableOpacity
            style={[styles.speakingChip, { backgroundColor: `${colors.primary}33`, borderColor: colors.primary }]}
            onPress={stopSpeaking}
            activeOpacity={0.8}
          >
            <SonarPulse size={16} active />
            <Text style={[styles.toggleText, { color: colors.primary }]}>Speaking… tap to stop</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Sonar aim guide */}
      <View style={styles.aimGuide} pointerEvents="none">
        <View style={[styles.aimCorner, styles.aimTL, { borderColor: colors.primary }]} />
        <View style={[styles.aimCorner, styles.aimTR, { borderColor: colors.primary }]} />
        <View style={[styles.aimCorner, styles.aimBL, { borderColor: colors.primary }]} />
        <View style={[styles.aimCorner, styles.aimBR, { borderColor: colors.primary }]} />
        <Text style={[styles.aimLabel, { color: colors.primary }]}>Aim at sonar screen</Text>
      </View>

      {/* Result overlay */}
      {result && !scanning && (
        <View
          style={[
            styles.resultOverlay,
            { backgroundColor: `${colors.background}ee`, borderColor: colors.border },
          ]}
        >
          <View style={styles.resultRow}>
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
            <Text style={[styles.resultLure, { color: colors.accent }]} numberOfLines={2}>
              {result.lure}
            </Text>
          )}
          {result.technique && (
            <Text style={[styles.resultTechnique, { color: colors.mutedForeground }]} numberOfLines={2}>
              {result.technique}
            </Text>
          )}
          {/* Replay voice */}
          <View style={styles.resultActions}>
            <TouchableOpacity
              style={[styles.replayBtn, { backgroundColor: `${colors.primary}22`, borderColor: `${colors.primary}44` }]}
              onPress={() => {
                if (speaking) stopSpeaking();
                else speakResult(result);
              }}
              activeOpacity={0.8}
            >
              <Feather name={speaking ? "volume-x" : "volume-2"} size={14} color={colors.primary} />
              <Text style={[styles.replayText, { color: colors.primary }]}>
                {speaking ? "Stop" : "Read aloud"}
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

      {/* Bottom — scan button */}
      <View style={[styles.bottomBar, { paddingBottom: bottomPad }]}>
        {scanning ? (
          <View style={styles.scanningState}>
            <SonarPulse size={64} active />
            <Text style={[styles.scanningText, { color: colors.primary }]}>Scanning sonar…</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.scanBtn, { backgroundColor: colors.primary }]}
            onPress={scanNow}
            activeOpacity={0.85}
          >
            <Feather name="zap" size={22} color={colors.primaryForeground} />
            <Text style={[styles.scanBtnText, { color: colors.primaryForeground }]}>Scan Now</Text>
          </TouchableOpacity>
        )}
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Point camera at sonar screen and tap Scan
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  permissionContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  permTitle: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  permDesc: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  permBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 30,
    marginTop: 8,
  },
  permBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },

  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    zIndex: 10,
  },
  toggleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  toggleText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  speakingChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },

  aimGuide: {
    position: "absolute",
    top: "25%",
    left: 32,
    right: 32,
    height: "35%",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  aimCorner: {
    position: "absolute",
    width: 22,
    height: 22,
  },
  aimTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 4 },
  aimTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 4 },
  aimBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 4 },
  aimBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 4 },
  aimLabel: { fontSize: 11, fontFamily: "Inter_500Medium", letterSpacing: 0.5, opacity: 0.8 },

  resultOverlay: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 160,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 6,
    zIndex: 20,
  },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  resultSpecies: { fontSize: 16, fontFamily: "Inter_700Bold", flex: 1 },
  countBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  countText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  resultDetail: { fontSize: 13, fontFamily: "Inter_500Medium" },
  resultLure: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  resultTechnique: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  resultActions: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  replayBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  replayText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  clearBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  errorOverlay: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 160,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    zIndex: 20,
  },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },

  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingTop: 16,
    gap: 10,
    zIndex: 10,
  },
  scanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 44,
    paddingVertical: 18,
    borderRadius: 50,
  },
  scanBtnText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  scanningState: { alignItems: "center", gap: 8 },
  scanningText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  hint: { fontSize: 11, fontFamily: "Inter_400Regular" },
});
