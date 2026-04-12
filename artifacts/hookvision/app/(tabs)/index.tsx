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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
      if (!jsonMatch) throw new Error("Incomplete response from AI — please try again.");
      const data: FishAnalysis = JSON.parse(jsonMatch[0]);
      if (!data.species || typeof data.fishCount !== "number") {
        throw new Error("AI response was cut off — please try again.");
      }
      setAnalysis(data);
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
      // Fire-and-forget: contribute to community data bank
      try {
        const reportDomain = process.env.EXPO_PUBLIC_DOMAIN;
        const reportBase = reportDomain ? `https://${reportDomain}` : "";
        fetch(`${reportBase}/api/community/report`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            species: data.species,
            fishCount: data.fishCount,
            depth: data.depth,
            lureSuggestion: data.suggestion,
            rawAnalysis: data,
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

        {analysis && (
          <TouchableOpacity style={[styles.newBtn, { borderColor: colors.border }]} onPress={() => { setImageUri(null); setImageBase64(null); setAnalysis(null); setError(null); }} activeOpacity={0.7}>
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
});
