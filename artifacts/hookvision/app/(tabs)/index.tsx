import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DemoStore } from "@/app/(tabs)/demo";
import { SpeciesCompareStore } from "@/stores/SpeciesCompareStore";
import { getNTLocationName } from "@/utils/ntLocation";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { AnalysisCard } from "@/components/AnalysisCard";
import { HVHeader } from "@/components/HVHeader";
import { SonarOverlay } from "@/components/SonarOverlay";
import { SonarPulse } from "@/components/SonarPulse";
import { useColors } from "@/hooks/useColors";
import { useHistory } from "@/context/HistoryContext";
import { useNarrator } from "@/context/NarratorContext";
import { useAutoNarrate } from "@/hooks/useAutoNarrate";
import { getVision, quickScan, visionStatusSync, type MobileSonarScan } from "@/services/vision";

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
  sonarMode?: string | null;
  bladderShape?: string | null;
  fishMovement?: string | null;
  crocAlert?: boolean;
  crocWarning?: string | null;
  archReasoning?: string;
}

const H_PAD = 14;
const GAP = 14;

/** Ensure any picked image (WebP, HEIF, etc) is re-encoded as JPEG before upload */
async function toJpeg(uri: string): Promise<{ uri: string; base64: string }> {
  const result = await manipulateAsync(uri, [], { format: SaveFormat.JPEG, compress: 0.82, base64: true });
  return { uri: result.uri, base64: result.base64 ?? "" };
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addEntry } = useHistory();
  const { autoSpeak } = useNarrator();

  useAutoNarrate(() => "Sonar Analyser. Load a photo of your sonar screen, or tap the camera button to scan and get instant AI fish detection.");

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<FishAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamChars, setStreamChars] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [imageLayout, setImageLayout] = useState({ width: 360, height: 240 });

  // ── Sonar Brain — Stage-1 fast barra arch detector ────────────────────────
  interface SonarBarraResult {
    isBarraArch:        boolean;
    confidence:         number;
    archCount:          number;
    estimatedDepth:     string | null;
    keyEvidence:        string;
    sonarBrand:         string;
    bottomType?:        string;
    lureRecommendation: string | null;
    refPhotosUsed:      number;
    positiveRefsUsed:   number;
    barraBodyRefsUsed?: number;
  }
  const [sonarBarraResult, setSonarBarraResult] = useState<SonarBarraResult | null>(null);
  const [sonarBarraLoading, setSonarBarraLoading] = useState(false);
  const autoAnalyzeRef = useRef(false);

  // ── On-device vision engine ────────────────────────────────────────────────
  const [cvReady, setCvReady] = useState(false);
  const [cvScan, setCvScan] = useState<MobileSonarScan | null>(null);
  const [cvScanning, setCvScanning] = useState(false);

  // ── Species comparison (community → analyze flow) ──────────────────────────
  const [compareCard, setCompareCard] = useState<{ expected: string; found: string } | null>(null);
  const [compareExp, setCompareExp]   = useState<string | null>(null);
  const [loadingCompare, setLoadingCompare] = useState(false);

  // ── Background location fetch (starts when photo is selected) ─────────────
  // Runs in parallel with user reviewing the image + pressing Analyze.
  // By the time the AI finishes, location is almost always ready.
  const locationPromiseRef = useRef<Promise<string | null> | null>(null);
  const [capturedLocation, setCapturedLocation] = useState<string | null>(null);
  const [cvRegions, setCvRegions] = useState<Array<{ xFrac: number; yFrac: number; size: number }>>([]);

  // ── Pre-warm TF.js backend (background, non-blocking) ────────────────────
  useEffect(() => {
    getVision()
      .then(() => setCvReady(true))
      .catch(() => {/* silent — vision is optional */});
  }, []);

  // Pick up demo image loaded from the Demo tab and auto-analyse it
  useFocusEffect(
    useCallback(() => {
      if (DemoStore.pendingUri && DemoStore.pendingBase64) {
        autoAnalyzeRef.current = true;
        setImageUri(DemoStore.pendingUri);
        setImageBase64(DemoStore.pendingBase64);
        setAnalysis(null);
        setError(null);
        DemoStore.pendingUri = null;
        DemoStore.pendingBase64 = null;
        // Start location grab in parallel with auto-analysis
        locationPromiseRef.current = getNTLocationName(10_000);
      }
    }, [])
  );

  const cameraScale = useSharedValue(1);
  const galleryScale = useSharedValue(1);
  const analyzeScale = useSharedValue(1);

  const animatedCameraStyle = useAnimatedStyle(() => ({ transform: [{ scale: cameraScale.value }] }));
  const animatedGalleryStyle = useAnimatedStyle(() => ({ transform: [{ scale: galleryScale.value }] }));
  const animatedAnalyzeStyle = useAnimatedStyle(() => ({ transform: [{ scale: analyzeScale.value }] }));

  const handleImageSelected = useCallback((uri: string, base64: string | null | undefined) => {
    setImageUri(uri);
    setImageBase64(base64 ?? null);
    setAnalysis(null);
    setError(null);
    setCapturedLocation(null);
    setCvScan(null);
    setSonarBarraResult(null);
    setSonarBarraLoading(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Kick off location grab in the background — runs while user taps "Analyze Sonar"
    locationPromiseRef.current = getNTLocationName(10_000);
    // Kick off on-device CV pre-scan in background while user reviews image
    if (base64) {
      setCvScanning(true);
      quickScan(base64)
        .then((scan) => setCvScan(scan))
        .catch(() => setCvScan(null))
        .finally(() => setCvScanning(false));
    }
  }, []);

  const openCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Camera Permission Required", "Please allow camera access to photograph your sonar screen.", [{ text: "OK" }]);
      return;
    }
    cameraScale.value = withSpring(0.92, {}, () => { cameraScale.value = withSpring(1); });
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8, base64: false, allowsEditing: false, exif: false });
    if (!result.canceled && result.assets[0]) {
      const { uri, base64 } = await toJpeg(result.assets[0].uri);
      handleImageSelected(uri, base64);
    }
  }, [cameraScale, handleImageSelected]);

  const openGallery = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please allow access to your photo library.");
      return;
    }
    galleryScale.value = withSpring(0.92, {}, () => { galleryScale.value = withSpring(1); });
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8, base64: false, allowsEditing: false, exif: false });
    if (!result.canceled && result.assets[0]) {
      const { uri, base64 } = await toJpeg(result.assets[0].uri);
      handleImageSelected(uri, base64);
    }
  }, [galleryScale, handleImageSelected]);

  const analyzeImage = useCallback(async () => {
    if (!imageBase64) return;
    analyzeScale.value = withSpring(0.96, {}, () => { analyzeScale.value = withSpring(1); });
    setLoading(true);
    setStreaming(false);
    setStreamChars(0);
    setError(null);
    setAnalysis(null);
    setSonarBarraResult(null);
    setSonarBarraLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // ── Sonar Brain Stage-1: fire sonar-barra-check in parallel ──────────────
    // Resolves in ~600ms — shows BARRA ARCH verdict while full analysis streams
    {
      const brDomain  = process.env.EXPO_PUBLIC_DOMAIN;
      const brBaseUrl = brDomain ? `https://${brDomain}` : "";
      fetch(`${brBaseUrl}/api/sonar-barra-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64 }),
      })
        .then(r => r.json())
        .then((data: { isBarraArch?: boolean; confidence?: number }) => {
          setSonarBarraResult(data as any);
          if (data.isBarraArch && (data.confidence ?? 0) >= 60) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        })
        .catch(() => {/* non-fatal — full analysis still runs */})
        .finally(() => setSonarBarraLoading(false));
    }

    try {
      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      const baseUrl = domain ? `https://${domain}` : "";
      const response = await fetch(`${baseUrl}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64 }),
      });
      if (!response.ok) {
        let errMsg = "Analysis failed. Please try again.";
        try { const b = await response.json(); if (b?.error) errMsg = b.error; } catch { /* noop */ }
        throw new Error(errMsg);
      }

      // ── Streaming read ────────────────────────────────────────────────────────
      // First bytes arrive in ~1-2s; we accumulate the full JSON then parse once.
      let accumulated = "";
      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        setStreaming(true);
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          accumulated += chunk;
          setStreamChars(accumulated.length);
        }
        setStreaming(false);
      } else {
        // Fallback for environments without ReadableStream
        accumulated = await response.text();
      }

      // ── Extract CV blob positions appended by server ──────────────────────
      let parsedCvRegions: Array<{ xFrac: number; yFrac: number; size: number }> = [];
      const cvSuffix = accumulated.match(/\n__CV__:(\{[^\n]+\})/);
      if (cvSuffix) {
        try {
          const cvData = JSON.parse(cvSuffix[1]);
          if (Array.isArray(cvData.regions)) parsedCvRegions = cvData.regions;
        } catch { /* silent */ }
        accumulated = accumulated.replace(/\n__CV__:[^\n]*/, "");
      }

      const cleaned = accumulated.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No response from AI — please try again.");
      let data: FishAnalysis;
      try {
        data = JSON.parse(jsonMatch[0]);
      } catch {
        throw new Error("Response interrupted — please try again.");
      }
      setCvRegions(parsedCvRegions);
      // Coerce fishCount to a number in case the model returned a string
      if (typeof data.fishCount !== "number") {
        data.fishCount = parseInt(String(data.fishCount), 10) || 0;
      }
      // Fallback species label so the card always renders
      if (!data.species) {
        data.species = "Unknown species";
      }
      setAnalysis(data);

      // ── Auto-save to Brain library (fire-and-forget) ──────────────────────
      {
        const brainDomain = process.env.EXPO_PUBLIC_DOMAIN;
        const brainBase   = brainDomain ? `https://${brainDomain}` : "";
        const scanDate    = new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
        fetch(`${brainBase}/api/brain/sonar`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title:      `${data.species} — ${scanDate}`,
            imageUri:   imageUri ?? null,
            species:    data.species,
            depth:      data.depth ?? null,
            aiSummary:  data.suggestion ?? "",
            tips:       [data.technique, data.rig, data.lure].filter(Boolean) as string[],
            location:   capturedLocation ?? null,
            fishCount:  data.fishCount ?? 0,
          }),
        }).catch(() => {/* silent — don't interrupt the user */});
      }

      // ── CROC ALERT — native dialog fires immediately ──────────────────────
      if (data.crocAlert) {
        Alert.alert(
          "🐊 CROCODILE DETECTED",
          data.crocWarning
            ? `${data.crocWarning}\n\n🚨 NT CROC SAFETY\n• Stay 5m back from the water's edge\n• Do NOT enter the water or lean over the side\n• Saltwater crocs can be submerged and unseen\n• Relocate immediately`
            : "A saltwater crocodile has been detected on your sonar.\n\n🚨 DO NOT ENTER THE WATER\n• Stay 5m back from the water's edge\n• Saltwater crocs can be submerged and unseen\n• Relocate immediately",
          [{ text: "UNDERSTOOD — MOVING AWAY", style: "destructive" }],
          { cancelable: false }
        );
      }

      // ── Compare with community-expected species ──
      if (SpeciesCompareStore.expectedSpecies) {
        const expected = SpeciesCompareStore.expectedSpecies;
        SpeciesCompareStore.expectedSpecies = null;
        SpeciesCompareStore.demoNum = null;
        const found = data.species ?? "";
        if (!found.toLowerCase().includes(expected.toLowerCase()) &&
            !expected.toLowerCase().includes(found.toLowerCase())) {
          setCompareCard({ expected, found });
          setCompareExp(null);
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Hands-free: narrate the result summary
      autoSpeak(
        `Scan complete. ${data.fishCount} fish detected at ${data.depth}. ` +
        `Species: ${data.species}. Confidence ${data.confidence} percent. ${data.suggestion}`
      );
      if (imageUri) {
        addEntry({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          imageUri,
          timestamp: Date.now(),
          fishCount: data.fishCount,
          species: data.species,
          depth: data.depth,
          suggestion: data.suggestion,
        });
      }
      // Fire-and-forget: contribute to community data bank (with real location)
      try {
        const reportDomain = process.env.EXPO_PUBLIC_DOMAIN;
        const reportBase = reportDomain ? `https://${reportDomain}` : "";
        // Await location — it's been fetching since the photo was selected
        // so this is usually instant (already resolved) by the time AI finishes
        const locationName = await (locationPromiseRef.current ?? Promise.resolve(null));
        locationPromiseRef.current = null;
        setCapturedLocation(locationName);
        fetch(`${reportBase}/api/community/report`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            species: data.species,
            fishCount: data.fishCount,
            depth: data.depth,
            lureSuggestion: data.suggestion,
            rawAnalysis: data,
            locationName: locationName ?? undefined,
          }),
        }).catch(() => {});
      } catch {}
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  }, [imageBase64, imageUri, addEntry, analyzeScale, autoSpeak]);

  // Auto-analyse when a demo image is injected from the Demo tab
  useEffect(() => {
    if (autoAnalyzeRef.current && imageBase64) {
      autoAnalyzeRef.current = false;
      analyzeImage();
    }
  }, [imageBase64, analyzeImage]);

  // ── Learn why two species differ on sonar ─────────────────────────────────
  const learnWhy = useCallback(async (expected: string, found: string) => {
    try {
      setLoadingCompare(true);
      const reportDomain = process.env.EXPO_PUBLIC_DOMAIN;
      const base = reportDomain ? `https://${reportDomain}` : "";
      const res = await fetch(
        `${base}/api/community/compare?a=${encodeURIComponent(expected)}&b=${encodeURIComponent(found)}`
      );
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setCompareExp(data.explanation ?? "No explanation available.");
      autoSpeak(data.explanation ?? "");
    } catch {
      setCompareExp("Could not load explanation — please check your connection.");
    } finally {
      setLoadingCompare(false);
    }
  }, [autoSpeak]);

  const topPad = Platform.OS === "web" ? 0 : insets.top;

  // ── Analyze view ─────────────────────────────────────────────────────────────
  if (imageUri) {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingTop: topPad + 12, paddingBottom: Platform.OS === "web" ? 70 : insets.bottom + 24, paddingHorizontal: 16, gap: 14 }}
        showsVerticalScrollIndicator={false}
      >
        <HVHeader subtitle="AI Sonar Analysis" />

        {/* ── Sonar image + AI interpretation overlay ── */}
        <View
          style={[styles.imageContainer, { borderColor: loading ? colors.primary + "88" : analysis?.crocAlert ? "#ff1744" : colors.border }]}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setImageLayout({ width, height });
          }}
        >
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            resizeMode="cover"
          />

          {/* AI interpretation layer */}
          <SonarOverlay
            imageWidth={imageLayout.width}
            imageHeight={imageLayout.height}
            loading={loading}
            analysis={analysis}
          />

          {/* Camera / Gallery swap buttons */}
          {!loading && (
            <View style={styles.imageActions}>
              <TouchableOpacity style={[styles.overlayBtn, { backgroundColor: colors.secondary }]} onPress={openCamera} activeOpacity={0.8}>
                <Feather name="camera" size={14} color={colors.primary} />
                <Text style={[styles.overlayBtnText, { color: colors.primary }]}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.overlayBtn, { backgroundColor: colors.secondary }]} onPress={openGallery} activeOpacity={0.8}>
                <Feather name="image" size={14} color={colors.primary} />
                <Text style={[styles.overlayBtnText, { color: colors.primary }]}>Gallery</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {loading && (
          <View style={styles.streamingPill}>
            <SonarPulse size={18} active />
            <Text style={[styles.streamingLabel, { color: colors.primary }]}>
              {streaming
                ? `AI reading sonar… ${Math.min(99, Math.round((streamChars / 680) * 100))}%`
                : "Uploading scan…"}
            </Text>
          </View>
        )}

        {/* ── Sonar Brain Stage-1 — instant barra arch verdict ────────────── */}
        {(sonarBarraLoading || sonarBarraResult) && (
          <View style={[styles.sonarBrainCard, {
            backgroundColor: sonarBarraLoading
              ? colors.card
              : sonarBarraResult?.isBarraArch && (sonarBarraResult.confidence ?? 0) >= 60
                ? "#00d4aa14"
                : sonarBarraResult?.isBarraArch && (sonarBarraResult.confidence ?? 0) >= 40
                  ? "#ff880014"
                  : "#ffffff0a",
            borderColor: sonarBarraLoading
              ? "#ffffff18"
              : sonarBarraResult?.isBarraArch && (sonarBarraResult.confidence ?? 0) >= 60
                ? "#00d4aa66"
                : sonarBarraResult?.isBarraArch && (sonarBarraResult.confidence ?? 0) >= 40
                  ? "#ff880066"
                  : "#ffffff22",
          }]}>
            {sonarBarraLoading ? (
              <View style={styles.sonarBrainRow}>
                <SonarPulse size={14} active />
                <Text style={[styles.sonarBrainLabel, { color: colors.mutedForeground }]}>SONAR BRAIN SCANNING…</Text>
                <Text style={[styles.sonarBrainSub, { color: colors.mutedForeground }]}>comparing against {2}+ confirmed barra arch refs</Text>
              </View>
            ) : sonarBarraResult ? (
              <>
                <View style={styles.sonarBrainRow}>
                  <View style={[styles.sonarBrainDot, {
                    backgroundColor: sonarBarraResult.isBarraArch && sonarBarraResult.confidence >= 60
                      ? "#00d4aa"
                      : sonarBarraResult.isBarraArch && sonarBarraResult.confidence >= 40
                        ? "#ff8800"
                        : "#888888",
                  }]} />
                  <Text style={[styles.sonarBrainVerdict, {
                    color: sonarBarraResult.isBarraArch && sonarBarraResult.confidence >= 60
                      ? "#00d4aa"
                      : sonarBarraResult.isBarraArch && sonarBarraResult.confidence >= 40
                        ? "#ff8800"
                        : "#888888",
                  }]}>
                    {sonarBarraResult.isBarraArch && sonarBarraResult.confidence >= 60
                      ? "⚡ BARRA ARCHES DETECTED"
                      : sonarBarraResult.isBarraArch && sonarBarraResult.confidence >= 40
                        ? "⚠ POSSIBLE BARRA ARCHES"
                        : "NO BARRA ARCHES"}
                  </Text>
                  <View style={styles.sonarBrainBadge}>
                    <Text style={styles.sonarBrainBadgeText}>{sonarBarraResult.confidence}%</Text>
                  </View>
                </View>
                <View style={styles.sonarBrainMeta}>
                  {sonarBarraResult.archCount > 0 && (
                    <Text style={[styles.sonarBrainPill, { backgroundColor: "#ffffff14", color: "#aaaaaa" }]}>
                      {sonarBarraResult.archCount} arch{sonarBarraResult.archCount !== 1 ? "es" : ""}
                    </Text>
                  )}
                  {sonarBarraResult.estimatedDepth && (
                    <Text style={[styles.sonarBrainPill, { backgroundColor: "#ffffff14", color: "#aaaaaa" }]}>
                      {sonarBarraResult.estimatedDepth}
                    </Text>
                  )}
                  {sonarBarraResult.sonarBrand && sonarBarraResult.sonarBrand !== "Unknown" && (
                    <Text style={[styles.sonarBrainPill, { backgroundColor: "#00a8ff18", color: "#00a8ff" }]}>
                      {sonarBarraResult.sonarBrand}
                    </Text>
                  )}
                  <Text style={[styles.sonarBrainPill, { backgroundColor: "#ff880018", color: "#ff8800" }]}>
                    {(sonarBarraResult.barraBodyRefsUsed ?? 0) > 0
                      ? `${sonarBarraResult.barraBodyRefsUsed} photo + ${sonarBarraResult.positiveRefsUsed ?? 2} sonar refs`
                      : `${sonarBarraResult.positiveRefsUsed ?? 2} sonar refs`}
                  </Text>
                </View>
                {sonarBarraResult.keyEvidence ? (
                  <Text style={[styles.sonarBrainEvidence, { color: colors.mutedForeground }]}>
                    {sonarBarraResult.keyEvidence}
                  </Text>
                ) : null}
                {sonarBarraResult.isBarraArch && sonarBarraResult.lureRecommendation && (
                  <Text style={[styles.sonarBrainLure, { color: "#ffd700" }]}>
                    🎣 {sonarBarraResult.lureRecommendation}
                  </Text>
                )}
              </>
            ) : null}
          </View>
        )}

        {/* ── CV Engine status / pre-scan panel ───────────────────────── */}
        {!analysis && (cvScanning || cvScan) && (
          <View style={[styles.cvPanel, { backgroundColor: colors.card, borderColor: "#00a8ff33" }]}>
            {/* Header row */}
            <View style={styles.cvPanelHeader}>
              <View style={[styles.cvDot, { backgroundColor: cvReady ? "#00a8ff" : "#888" }]} />
              <Text style={[styles.cvPanelTitle, { color: "#00a8ff" }]}>CV ENGINE</Text>
              {cvScanning && (
                <Text style={[styles.cvStatus, { color: colors.mutedForeground }]}>scanning…</Text>
              )}
              {!cvScanning && cvScan && (
                <Text style={[styles.cvStatus, { color: "#00a8ff" }]}>{visionStatusSync()}</Text>
              )}
            </View>

            {/* Scan results */}
            {cvScan && !cvScanning && (
              <View style={styles.cvGrid}>
                <View style={styles.cvCell}>
                  <Text style={[styles.cvLabel, { color: colors.mutedForeground }]}>BRIGHTNESS</Text>
                  <Text style={[styles.cvValue, { color: colors.foreground }]}>{cvScan.meanBrightness}/255</Text>
                </View>
                <View style={styles.cvCell}>
                  <Text style={[styles.cvLabel, { color: colors.mutedForeground }]}>ECHO</Text>
                  <Text style={[styles.cvValue, {
                    color: cvScan.echoStrength === "strong" ? "#00d4aa"
                         : cvScan.echoStrength === "moderate" ? "#ffd700" : "#888"
                  }]}>{cvScan.echoStrength.toUpperCase()}</Text>
                </View>
                <View style={styles.cvCell}>
                  <Text style={[styles.cvLabel, { color: colors.mutedForeground }]}>HOT PIXELS</Text>
                  <Text style={[styles.cvValue, { color: colors.foreground }]}>{cvScan.brightPixelPct.toFixed(1)}%</Text>
                </View>
                <View style={styles.cvCell}>
                  <Text style={[styles.cvLabel, { color: colors.mutedForeground }]}>PALETTE</Text>
                  <Text style={[styles.cvValue, { color: "#00a8ff" }]}>{cvScan.paletteCue}</Text>
                </View>
                <View style={styles.cvCell}>
                  <Text style={[styles.cvLabel, { color: colors.mutedForeground }]}>DOMINANT</Text>
                  <Text style={[styles.cvValue, { color: colors.foreground }]}>ch-{cvScan.dominantChannel}</Text>
                </View>
                <View style={styles.cvCell}>
                  <Text style={[styles.cvLabel, { color: colors.mutedForeground }]}>BACKEND</Text>
                  <Text style={[styles.cvValue, { color: colors.foreground }]}>{cvScan.backendUsed}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {!analysis && !loading && (
          <Animated.View style={animatedAnalyzeStyle}>
            <TouchableOpacity style={[styles.analyzeBtn, { backgroundColor: colors.primary }]} onPress={analyzeImage} activeOpacity={0.85}>
              <SonarPulse size={24} active={false} />
              <Text style={[styles.analyzeBtnText, { color: colors.primaryForeground }]}>Analyze Sonar</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {error && (
          <View style={[styles.errorBox, { backgroundColor: `${colors.destructive}18`, borderColor: `${colors.destructive}44` }]}>
            <Feather name="alert-circle" size={16} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
          </View>
        )}

        {analysis && <AnalysisCard analysis={analysis} imageUri={imageUri ?? undefined} cvRegions={cvRegions} />}

        {/* ── Scan logged location chip ─────────────────────────────────── */}
        {analysis && (
          <View style={[styles.locationChip, {
            borderColor: capturedLocation ? "#00d4aa44" : colors.border,
            backgroundColor: capturedLocation ? "#00d4aa10" : colors.card + "80",
          }]}>
            <Feather name="map-pin" size={12} color={capturedLocation ? "#00d4aa" : colors.mutedForeground} />
            <Text style={[styles.locationChipText, { color: capturedLocation ? "#00d4aa" : colors.mutedForeground }]}>
              {capturedLocation
                ? `Logged · ${capturedLocation}`
                : "Location not shared · enable in settings to improve hotspot data"}
            </Text>
          </View>
        )}

        {/* ── Species comparison card ─────────────────────────────────────── */}
        {analysis && compareCard && (
          <View style={[styles.compareCard, { backgroundColor: colors.card, borderColor: "#ffd70055" }]}>
            <View style={styles.compareHeader}>
              <Feather name="alert-circle" size={16} color="#ffd700" />
              <Text style={[styles.compareTitle, { color: "#ffd700" }]}>Species Difference Detected</Text>
            </View>
            <View style={styles.compareRow}>
              <View style={[styles.compareChip, { borderColor: "#00d4aa55", backgroundColor: "#00d4aa15" }]}>
                <Text style={[styles.compareChipLabel, { color: colors.mutedForeground }]}>Community expected</Text>
                <Text style={[styles.compareChipVal, { color: "#00d4aa" }]}>{compareCard.expected}</Text>
              </View>
              <Feather name="arrow-right" size={14} color={colors.mutedForeground} />
              <View style={[styles.compareChip, { borderColor: "#ffd70055", backgroundColor: "#ffd70015" }]}>
                <Text style={[styles.compareChipLabel, { color: colors.mutedForeground }]}>AI identified</Text>
                <Text style={[styles.compareChipVal, { color: "#ffd700" }]}>{compareCard.found}</Text>
              </View>
            </View>
            {compareExp ? (
              <Text style={[styles.compareExp, { color: colors.foreground }]}>{compareExp}</Text>
            ) : (
              <TouchableOpacity
                style={[styles.learnBtn, { borderColor: "#ffd70055", opacity: loadingCompare ? 0.6 : 1 }]}
                onPress={() => learnWhy(compareCard.expected, compareCard.found)}
                activeOpacity={0.8}
                disabled={loadingCompare}
              >
                {loadingCompare
                  ? <Text style={[styles.learnBtnText, { color: "#ffd700" }]}>Asking AI…</Text>
                  : <>
                      <MaterialCommunityIcons name="brain" size={14} color="#ffd700" />
                      <Text style={[styles.learnBtnText, { color: "#ffd700" }]}>Learn why they look different on sonar</Text>
                    </>
                }
              </TouchableOpacity>
            )}
          </View>
        )}

        {analysis && (
          <TouchableOpacity style={[styles.newBtn, { borderColor: colors.border }]} onPress={() => { setImageUri(null); setImageBase64(null); setAnalysis(null); setError(null); setCompareCard(null); setCompareExp(null); setCapturedLocation(null); setCvScan(null); setCvRegions([]); locationPromiseRef.current = null; }} activeOpacity={0.7}>
            <Feather name="plus" size={16} color={colors.mutedForeground} />
            <Text style={[styles.newBtnText, { color: colors.mutedForeground }]}>New analysis</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  }

  // ── Dashboard view ────────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPad + 12, paddingBottom: Platform.OS === "web" ? 72 : insets.bottom + 28, paddingHorizontal: H_PAD, gap: GAP }}
      showsVerticalScrollIndicator={false}
    >
      <HVHeader subtitle="NT Australia Fishing" />

      {/* ── HERO CARD 1: Scan Sonar ── */}
      <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: "#00d4aa55" }]}>
        <View style={[styles.heroAccentTop, { backgroundColor: "#00d4aa" }]} />
        <View style={styles.heroInner}>
          {/* Icon + title row */}
          <View style={styles.heroTitleRow}>
            <View style={[styles.heroIconCircle, { backgroundColor: "#00d4aa18", borderColor: "#00d4aa55" }]}>
              <SonarPulse size={44} active />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={[styles.heroTitle, { color: colors.foreground }]}>Scan Sonar</Text>
                <View style={styles.heroAiTag}>
                  <Text style={styles.heroAiTagText}>AI</Text>
                </View>
              </View>
              <Text style={[styles.heroSubtitle, { color: "#00d4aa" }]}>GPT-4.1 Vision Analysis</Text>
            </View>
          </View>

          {/* Description */}
          <Text style={[styles.heroDesc, { color: colors.mutedForeground }]}>
            Photo or pick a saved sonar screenshot — AI instantly identifies fish species, depth,
            bottom structure, lure advice and croc alerts.
          </Text>

          {/* Camera + Gallery buttons */}
          <View style={styles.heroBtnRow}>
            <Animated.View style={[animatedCameraStyle, { flex: 1 }]}>
              <TouchableOpacity style={styles.heroCameraBtn} onPress={openCamera} activeOpacity={0.85}>
                <Feather name="camera" size={20} color="#0a1628" />
                <Text style={styles.heroCameraBtnText}>Camera</Text>
              </TouchableOpacity>
            </Animated.View>
            <Animated.View style={[animatedGalleryStyle, { flex: 1 }]}>
              <TouchableOpacity style={[styles.heroGalleryBtn, { borderColor: "#00d4aa55", backgroundColor: colors.secondary }]} onPress={openGallery} activeOpacity={0.8}>
                <Feather name="image" size={20} color="#00d4aa" />
                <Text style={styles.heroGalleryBtnText}>Gallery</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
      </View>

      {/* ── HERO CARD 2: Demo Sonar ── */}
      <TouchableOpacity
        style={[styles.heroCard, { backgroundColor: colors.card, borderColor: "#7c5cfc55" }]}
        onPress={() => router.navigate("/(tabs)/demo" as any)}
        activeOpacity={0.83}
      >
        <View style={[styles.heroAccentTop, { backgroundColor: "#7c5cfc" }]} />
        <View style={styles.heroInner}>
          <View style={styles.heroTitleRow}>
            <View style={[styles.heroIconCircle, { backgroundColor: "#7c5cfc18", borderColor: "#7c5cfc55" }]}>
              <MaterialCommunityIcons name="image-multiple" size={34} color="#7c5cfc" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroTitle, { color: colors.foreground }]}>Demo Sonar Scans</Text>
              <Text style={[styles.heroSubtitle, { color: "#7c5cfc" }]}>Tap to explore samples</Text>
            </View>
            <Feather name="chevron-right" size={24} color="#7c5cfc" />
          </View>
          <Text style={[styles.heroDesc, { color: colors.mutedForeground }]}>
            Try AI analysis on real NT sonar screenshots — barra arches, structure maps,
            side-imaging and live sonar examples included.
          </Text>
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* Hero cards */
  heroCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    overflow: "hidden",
  },
  heroAccentTop: { height: 5, width: "100%" },
  heroInner: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 22,
    gap: 14,
  },
  heroTitleRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  heroIconCircle: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5,
  },
  heroTitle: { fontSize: 22, fontFamily: "Oswald_700Bold", letterSpacing: 0.5 },
  heroSubtitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.3, marginTop: 2 },
  heroAiTag: { backgroundColor: "#00d4aa30", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  heroAiTagText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#00d4aa", letterSpacing: 1 },
  heroDesc: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21 },
  heroBtnRow: { flexDirection: "row", gap: 12 },
  heroCameraBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: "#00d4aa", borderRadius: 14,
    paddingVertical: 15,
  },
  heroCameraBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#0a1628" },
  heroGalleryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, borderWidth: 1.5, borderRadius: 14, paddingVertical: 15,
  },
  heroGalleryBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#00d4aa" },

  /* Analyze view */
  imageContainer: { borderRadius: 16, overflow: "hidden", borderWidth: 1, position: "relative", minHeight: 260 },
  image: { width: "100%", height: 260 },
  imageActions: { position: "absolute", top: 10, right: 10, flexDirection: "row", gap: 6 },
  overlayBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  overlayBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  analyzeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 14, borderRadius: 30 },
  analyzeBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  loadingContainer: { alignItems: "center", gap: 12, paddingVertical: 20 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  streamingPill: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 30, backgroundColor: "#00d4aa18", borderWidth: 1, borderColor: "#00d4aa44" },
  streamingLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },

  /* Sonar Brain Stage-1 verdict card */
  sonarBrainCard: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 10 },
  sonarBrainRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  sonarBrainDot: { width: 8, height: 8, borderRadius: 4 },
  sonarBrainLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1 },
  sonarBrainSub: { fontSize: 10, fontFamily: "Inter_400Regular", marginLeft: "auto" as any },
  sonarBrainVerdict: { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 0.5, flex: 1 },
  sonarBrainBadge: { backgroundColor: "#ffffff18", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  sonarBrainBadgeText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#ffffff" },
  sonarBrainMeta: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  sonarBrainPill: { fontSize: 10, fontFamily: "Inter_500Medium", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  sonarBrainEvidence: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  sonarBrainLure: { fontSize: 12, fontFamily: "Inter_500Medium" },

  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 14, borderRadius: 10, borderWidth: 1 },
  errorText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  newBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  newBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },

  /* Location logged chip */
  locationChip: {
    flexDirection: "row", alignItems: "center", gap: 7,
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  locationChipText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular" },

  /* Species comparison card */
  compareCard: {
    borderRadius: 14, borderWidth: 1, padding: 14, gap: 12,
  },
  compareHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  compareTitle:  { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  compareRow:    { flexDirection: "row", alignItems: "center", gap: 8 },
  compareChip: {
    flex: 1, borderWidth: 1, borderRadius: 10, padding: 10, gap: 3, alignItems: "center",
  },
  compareChipLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  compareChipVal:   { fontSize: 13, fontFamily: "Inter_700Bold", textAlign: "center" },
  compareExp: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  learnBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    borderWidth: 1, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14,
  },
  learnBtnText: { fontSize: 13, fontFamily: "Inter_500Medium" },

  /* CV Engine pre-scan panel */
  cvPanel: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  cvPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  cvDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  cvPanelTitle: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.4,
    flex: 1,
  },
  cvStatus: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  cvGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  cvCell: {
    width: "30%",
    backgroundColor: "#00a8ff0d",
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 8,
    gap: 2,
  },
  cvLabel: {
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
  },
  cvValue: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});
