import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
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
  bladderShape?: string | null;
  fishMovement?: string | null;
  crocAlert?: boolean;
  crocWarning?: string | null;
  archReasoning?: string;
}

const SCREEN_W = Dimensions.get("window").width;
const H_PAD = 14;
const GAP = 10;
const SQUARE_SIZE = (SCREEN_W - H_PAD * 2 - GAP) / 2;

type IconLib = "MCIcon" | "Feather";
interface GridItem {
  route: string;
  iconLib: IconLib;
  icon: string;
  title: string;
  desc: string;
  accent: string;
  tag?: string;
}

const GRID_ITEMS: GridItem[] = [
  { route: "/(tabs)/live",     iconLib: "Feather", icon: "video",         title: "Live Camera",    desc: "AI real-time overlay",         accent: "#00a8ff", tag: "LIVE" },
  { route: "/(tabs)/tides",    iconLib: "MCIcon",  icon: "wave",          title: "NT Tides",       desc: "BOM Darwin predictions",       accent: "#4fc3f7", tag: "BOM"  },
  { route: "/(tabs)/species",  iconLib: "MCIcon",  icon: "fish",          title: "Species Guide",  desc: "Bag limits & size rules",      accent: "#66bb6a" },
  { route: "/(tabs)/barra",    iconLib: "MCIcon",  icon: "crosshairs-gps",title: "Trophy Barra",   desc: "AI 70cm+ predictor",           accent: "#ffd700", tag: "AI"  },
  { route: "/(tabs)/zones",    iconLib: "MCIcon",  icon: "chart-bar",     title: "Strike Zones",   desc: "Optimal depth per species",    accent: "#ff7043" },
  { route: "/(tabs)/forecast", iconLib: "MCIcon",  icon: "calendar-star", title: "Here Fishy",     desc: "Bite forecast & conditions",   accent: "#ab47bc", tag: "HOT" },
];

function SquareTile({ item, colors }: { item: GridItem; colors: any }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const Icon = item.iconLib === "MCIcon"
    ? (props: any) => <MaterialCommunityIcons {...props} />
    : (props: any) => <Feather {...props} />;

  return (
    <Animated.View style={[animStyle, { width: SQUARE_SIZE }]}>
      <TouchableOpacity
        style={[styles.squareTile, { backgroundColor: colors.card, borderColor: item.accent + "55", height: SQUARE_SIZE * 0.92 }]}
        activeOpacity={0.82}
        onPress={() => {
          scale.value = withSpring(0.93, {}, () => { scale.value = withSpring(1); });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.navigate(item.route as any);
        }}
      >
        {/* Top accent bar */}
        <View style={[styles.tileAccentBar, { backgroundColor: item.accent }]} />

        <View style={styles.tileBody}>
          {/* Icon circle */}
          <View style={[styles.tileIconCircle, { backgroundColor: item.accent + "22", borderWidth: 1.5, borderColor: item.accent + "99" }]}>
            <Icon name={item.icon} size={26} color={item.accent} />
          </View>

          {item.tag && (
            <View style={[styles.tileTag, { backgroundColor: item.accent + "30" }]}>
              <Text style={[styles.tileTagText, { color: item.accent }]}>{item.tag}</Text>
            </View>
          )}
        </View>

        <View style={styles.tileFoot}>
          <Text style={[styles.tileTitle, { color: colors.foreground }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={[styles.tileDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
            {item.desc}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
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
  const [imageLayout, setImageLayout] = useState({ width: SCREEN_W - 32, height: 240 });
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
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.65, base64: true, allowsEditing: false, exif: false });
    if (!result.canceled && result.assets[0]) handleImageSelected(result.assets[0].uri, result.assets[0].base64);
  }, [cameraScale, handleImageSelected]);

  const openGallery = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please allow access to your photo library.");
      return;
    }
    galleryScale.value = withSpring(0.92, {}, () => { galleryScale.value = withSpring(1); });
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.65, base64: true, allowsEditing: false, exif: false });
    if (!result.canceled && result.assets[0]) handleImageSelected(result.assets[0].uri, result.assets[0].base64);
  }, [galleryScale, handleImageSelected]);

  const analyzeImage = useCallback(async () => {
    if (!imageBase64) return;
    analyzeScale.value = withSpring(0.96, {}, () => { analyzeScale.value = withSpring(1); });
    setLoading(true);
    setStreaming(false);
    setStreamChars(0);
    setError(null);
    setAnalysis(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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

      const cleaned = accumulated.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No response from AI — please try again.");
      let data: FishAnalysis;
      try {
        data = JSON.parse(jsonMatch[0]);
      } catch {
        throw new Error("Response interrupted — please try again.");
      }
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
            location:   capturedLocation?.name ?? null,
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

        {analysis && <AnalysisCard analysis={analysis} imageUri={imageUri ?? undefined} />}

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
          <TouchableOpacity style={[styles.newBtn, { borderColor: colors.border }]} onPress={() => { setImageUri(null); setImageBase64(null); setAnalysis(null); setError(null); setCompareCard(null); setCompareExp(null); setCapturedLocation(null); setCvScan(null); locationPromiseRef.current = null; }} activeOpacity={0.7}>
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
      contentContainerStyle={{ paddingTop: topPad + 12, paddingBottom: Platform.OS === "web" ? 72 : insets.bottom + 24, paddingHorizontal: H_PAD, gap: GAP }}
      showsVerticalScrollIndicator={false}
    >
      <HVHeader subtitle="NT Australia Fishing" />

      {/* ── RECTANGLE 1: Scan Sonar ── */}
      <View style={[styles.rectCard, { backgroundColor: colors.card, borderColor: "#00d4aa55" }]}>
        <View style={[styles.rectAccent, { backgroundColor: "#00d4aa" }]} />
        <View style={styles.rectBody}>
          <View style={styles.rectLeft}>
            <View style={[styles.rectIconCircle, { backgroundColor: "#00d4aa20" }]}>
              <SonarPulse size={32} active />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <Text style={[styles.rectTitle, { color: colors.foreground }]}>Scan Sonar</Text>
                <View style={[styles.tileTag, { backgroundColor: "#00d4aa30" }]}>
                  <Text style={[styles.tileTagText, { color: "#00d4aa" }]}>AI</Text>
                </View>
              </View>
              <Text style={[styles.rectDesc, { color: colors.mutedForeground }]}>
                Photo your sonar · get species, depth & lure advice
              </Text>
            </View>
          </View>
          <View style={styles.rectBtns}>
            <Animated.View style={animatedCameraStyle}>
              <TouchableOpacity style={[styles.rectBtn, { backgroundColor: "#00d4aa" }]} onPress={openCamera} activeOpacity={0.85}>
                <Feather name="camera" size={17} color="#0a1628" />
                <Text style={styles.rectBtnTextDark}>Camera</Text>
              </TouchableOpacity>
            </Animated.View>
            <Animated.View style={animatedGalleryStyle}>
              <TouchableOpacity style={[styles.rectBtn, { borderColor: "#00d4aa55", borderWidth: 1, backgroundColor: colors.secondary }]} onPress={openGallery} activeOpacity={0.8}>
                <Feather name="image" size={17} color="#00d4aa" />
                <Text style={[styles.rectBtnTextTeal, { color: "#00d4aa" }]}>Gallery</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
      </View>

      {/* ── RECTANGLE 2: Demo Sonar ── */}
      <TouchableOpacity
        style={[styles.rectCard, { backgroundColor: colors.card, borderColor: "#7c5cfc55" }]}
        onPress={() => router.navigate("/(tabs)/demo" as any)}
        activeOpacity={0.83}
      >
        <View style={[styles.rectAccent, { backgroundColor: "#7c5cfc" }]} />
        <View style={styles.rectBody}>
          <View style={styles.rectLeft}>
            <View style={[styles.rectIconCircle, { backgroundColor: "#7c5cfc20" }]}>
              <MaterialCommunityIcons name="image-multiple" size={24} color="#7c5cfc" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rectTitle, { color: colors.foreground }]}>Demo Sonar Scans</Text>
              <Text style={[styles.rectDesc, { color: colors.mutedForeground }]}>
                Try AI analysis on sample sonar images
              </Text>
            </View>
          </View>
          <Feather name="chevron-right" size={20} color={colors.mutedForeground} style={{ marginRight: 4 }} />
        </View>
      </TouchableOpacity>

      {/* ── Section label ── */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>EXPLORE FEATURES</Text>

      {/* ── 6 SQUARES grid ── */}
      <View style={styles.squareGrid}>
        {GRID_ITEMS.map((item) => (
          <SquareTile key={item.route} item={item} colors={colors} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* Rectangle cards */
  rectCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    flexDirection: "row",
  },
  rectAccent: { width: 5 },
  rectBody: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  rectLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  rectIconCircle: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  rectTitle: { fontSize: 15, fontFamily: "Oswald_700Bold", letterSpacing: 0.4 },
  rectDesc: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 15, marginTop: 2 },
  rectBtns: { flexDirection: "column", gap: 6 },
  rectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    minWidth: 90,
  },
  rectBtnTextDark: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#0a1628" },
  rectBtnTextTeal: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  /* Section label */
  sectionLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    textAlign: "center",
    marginTop: 2,
  },

  /* Square grid */
  squareGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GAP,
  },

  /* Square tile */
  squareTile: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    flexDirection: "column",
  },
  tileAccentBar: { height: 4, width: "100%" },
  tileBody: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  tileIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  tileTag: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3, alignSelf: "flex-start" },
  tileTagText: { fontSize: 8, fontFamily: "Inter_700Bold", letterSpacing: 0.8 },
  tileFoot: { paddingHorizontal: 12, paddingBottom: 12, gap: 2 },
  tileTitle: { fontSize: 13, fontFamily: "Oswald_700Bold", letterSpacing: 0.3 },
  tileDesc: { fontSize: 10, fontFamily: "Inter_400Regular", lineHeight: 14 },

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
