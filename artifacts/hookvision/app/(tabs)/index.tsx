import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
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
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { AnalysisCard } from "@/components/AnalysisCard";
import { HVHeader } from "@/components/HVHeader";
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
  crocAlert?: boolean;
  crocWarning?: string | null;
}

// ── Widget definitions ────────────────────────────────────────────────────────

type IconLib = "MCIcon" | "Feather";

interface Widget {
  route: string | null;
  iconLib: IconLib;
  icon: string;
  title: string;
  desc: string;
  accent: string;
  tag?: string;
  featured?: boolean;
}

const WIDGETS: Widget[] = [
  {
    route: "/(tabs)/live",
    iconLib: "Feather",
    icon: "video",
    title: "Live Camera",
    desc: "Real-time AI overlay on your live feed",
    accent: "#00a8ff",
    tag: "LIVE",
  },
  {
    route: "/(tabs)/tides",
    iconLib: "MCIcon",
    icon: "wave",
    title: "NT Tides",
    desc: "Darwin BOM tide predictions",
    accent: "#4fc3f7",
    tag: "BOM",
  },
  {
    route: "/(tabs)/species",
    iconLib: "MCIcon",
    icon: "fish",
    title: "Species Guide",
    desc: "Barra, mangrove jack, threadfin & more",
    accent: "#66bb6a",
  },
  {
    route: "/(tabs)/barra",
    iconLib: "MCIcon",
    icon: "crosshairs-gps",
    title: "Trophy Barra",
    desc: "AI predictor for trophy-size barra",
    accent: "#ffd700",
    tag: "AI",
  },
  {
    route: "/(tabs)/zones",
    iconLib: "MCIcon",
    icon: "chart-bar",
    title: "Depth Strike Zones",
    desc: "Optimal depth bands per species",
    accent: "#ff7043",
  },
  {
    route: "/(tabs)/forecast",
    iconLib: "MCIcon",
    icon: "calendar-star",
    title: "Here Fishy Fishy",
    desc: "Bite-time forecast & conditions",
    accent: "#ab47bc",
    tag: "HOT",
  },
  {
    route: "/(tabs)/history",
    iconLib: "Feather",
    icon: "clock",
    title: "Session History",
    desc: "Review past scans & catches",
    accent: "#78909c",
  },
];

// ── Widget card ───────────────────────────────────────────────────────────────

function WidgetCard({ w, colors }: { w: Widget; colors: any }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const Icon =
    w.iconLib === "MCIcon"
      ? (props: any) => <MaterialCommunityIcons {...props} />
      : (props: any) => <Feather {...props} />;

  return (
    <Animated.View style={[animStyle, styles.widgetWrap]}>
      <TouchableOpacity
        style={[styles.widgetCard, { backgroundColor: colors.card, borderColor: w.accent + "55" }]}
        activeOpacity={0.8}
        onPress={() => {
          scale.value = withSpring(0.94, {}, () => { scale.value = withSpring(1); });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          if (w.route) router.navigate(w.route as any);
        }}
      >
        {/* Colored left strip */}
        <View style={[styles.widgetStrip, { backgroundColor: w.accent }]} />

        <View style={styles.widgetInner}>
          <View style={[styles.widgetIconWrap, { backgroundColor: w.accent + "22" }]}>
            <Icon name={w.icon} size={22} color={w.accent} />
          </View>
          <View style={styles.widgetText}>
            <Text style={[styles.widgetTitle, { color: colors.foreground }]}>{w.title}</Text>
            <Text style={[styles.widgetDesc, { color: colors.mutedForeground }]}>{w.desc}</Text>
          </View>
          <View style={styles.widgetRight}>
            {w.tag && (
              <View style={[styles.widgetTag, { backgroundColor: w.accent + "33" }]}>
                <Text style={[styles.widgetTagText, { color: w.accent }]}>{w.tag}</Text>
              </View>
            )}
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addEntry } = useHistory();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<FishAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoLoading, setDemoLoading] = useState<number | null>(null);

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
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7, base64: true, allowsEditing: false });
    if (!result.canceled && result.assets[0]) handleImageSelected(result.assets[0].uri, result.assets[0].base64);
  }, [cameraScale, handleImageSelected]);

  const openGallery = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please allow access to your photo library.");
      return;
    }
    galleryScale.value = withSpring(0.92, {}, () => { galleryScale.value = withSpring(1); });
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8, base64: true, allowsEditing: false });
    if (!result.canceled && result.assets[0]) handleImageSelected(result.assets[0].uri, result.assets[0].base64);
  }, [galleryScale, handleImageSelected]);

  const analyzeImage = useCallback(async () => {
    if (!imageBase64) return;
    analyzeScale.value = withSpring(0.96, {}, () => { analyzeScale.value = withSpring(1); });
    setLoading(true);
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
      const data: FishAnalysis = await response.json();
      setAnalysis(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }, [imageBase64, imageUri, addEntry, analyzeScale]);

  const DEMOS = [
    { num: 1, label: "Lowrance", sub: "3 barra · 5.2m" },
    { num: 2, label: "Garmin", sub: "School · 3.1m" },
    { num: 3, label: "Humminbird", sub: "Trophy · 8m" },
    { num: 4, label: "Simrad", sub: "Dual · 7m" },
  ];

  const loadDemoImage = useCallback(async (num: number) => {
    try {
      setDemoLoading(num);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      const baseUrl = domain ? `https://${domain}` : "";
      const url = `${baseUrl}/api/demos/sonar-demo-${num}.png`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to load demo");
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      handleImageSelected(url, base64);
    } catch {
      Alert.alert("Error", "Could not load demo image.");
    } finally {
      setDemoLoading(null);
    }
  }, [handleImageSelected]);

  const topPad = Platform.OS === "web" ? 0 : insets.top;

  // ── Analyze view (when image selected) ──────────────────────────────────────
  if (imageUri) {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingTop: topPad + 12, paddingBottom: Platform.OS === "web" ? 70 : insets.bottom + 24, paddingHorizontal: 16, gap: 14 }}
        showsVerticalScrollIndicator={false}
      >
        <HVHeader subtitle="AI Sonar Analysis" />

        <View style={[styles.imageContainer, { borderColor: colors.border }]}>
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
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
        </View>

        {!analysis && !loading && (
          <Animated.View style={animatedAnalyzeStyle}>
            <TouchableOpacity style={[styles.analyzeBtn, { backgroundColor: colors.primary }]} onPress={analyzeImage} activeOpacity={0.85}>
              <SonarPulse size={24} active={false} />
              <Text style={[styles.analyzeBtnText, { color: colors.primaryForeground }]}>Analyze Sonar</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {loading && (
          <View style={styles.loadingContainer}>
            <SonarPulse size={80} active />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Reading your sonar...</Text>
            <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />
          </View>
        )}

        {error && (
          <View style={[styles.errorBox, { backgroundColor: `${colors.destructive}18`, borderColor: `${colors.destructive}44` }]}>
            <Feather name="alert-circle" size={16} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
          </View>
        )}

        {analysis && <AnalysisCard analysis={analysis} />}

        {analysis && (
          <TouchableOpacity style={[styles.newBtn, { borderColor: colors.border }]} onPress={() => { setImageUri(null); setImageBase64(null); setAnalysis(null); setError(null); }} activeOpacity={0.7}>
            <Feather name="plus" size={16} color={colors.mutedForeground} />
            <Text style={[styles.newBtnText, { color: colors.mutedForeground }]}>New analysis</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  }

  // ── Dashboard view ───────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPad + 12, paddingBottom: Platform.OS === "web" ? 72 : insets.bottom + 24, paddingHorizontal: 14, gap: 10 }}
      showsVerticalScrollIndicator={false}
    >
      <HVHeader subtitle="NT Australia Fishing" />

      {/* ── Featured: AI Sonar Analysis ── */}
      <View style={[styles.featuredCard, { backgroundColor: colors.card, borderColor: "#00d4aa55" }]}>
        <View style={[styles.featuredStrip, { backgroundColor: "#00d4aa" }]} />
        <View style={styles.featuredContent}>
          <View style={styles.featuredHeader}>
            <View style={[styles.featuredIconWrap, { backgroundColor: "#00d4aa22" }]}>
              <MaterialCommunityIcons name="fish" size={28} color="#00d4aa" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.featuredTitleRow}>
                <Text style={[styles.featuredTitle, { color: colors.foreground }]}>AI Sonar Analysis</Text>
                <View style={[styles.widgetTag, { backgroundColor: "#00d4aa33" }]}>
                  <Text style={[styles.widgetTagText, { color: "#00d4aa" }]}>AI</Text>
                </View>
              </View>
              <Text style={[styles.featuredDesc, { color: colors.mutedForeground }]}>
                Point at sonar · get species, depth, lure & technique advice
              </Text>
            </View>
          </View>

          {/* Sonar pulse + actions */}
          <View style={styles.featuredActions}>
            <SonarPulse size={40} active />
            <View style={styles.featuredBtns}>
              <Animated.View style={[animatedCameraStyle, { flex: 1 }]}>
                <TouchableOpacity style={[styles.featCameraBtn, { backgroundColor: "#00d4aa" }]} onPress={openCamera} activeOpacity={0.85}>
                  <Feather name="camera" size={16} color="#0a1628" />
                  <Text style={styles.featCameraBtnText}>Camera</Text>
                </TouchableOpacity>
              </Animated.View>
              <Animated.View style={[animatedGalleryStyle, { flex: 1 }]}>
                <TouchableOpacity style={[styles.featGalleryBtn, { borderColor: "#00d4aa55", backgroundColor: colors.secondary }]} onPress={openGallery} activeOpacity={0.8}>
                  <Feather name="image" size={16} color="#00d4aa" />
                  <Text style={[styles.featGalleryBtnText, { color: "#00d4aa" }]}>Gallery</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>

          {/* Demo thumbnails */}
          <View style={styles.demoRow}>
            <Text style={[styles.demoRowLabel, { color: colors.mutedForeground }]}>TRY A DEMO SCAN</Text>
            <View style={styles.demoThumbs}>
              {DEMOS.map(({ num, label }) => {
                const domain = process.env.EXPO_PUBLIC_DOMAIN;
                const baseUrl = domain ? `https://${domain}` : "";
                const thumbUri = `${baseUrl}/api/demos/sonar-demo-${num}.png`;
                const isLoading = demoLoading === num;
                return (
                  <TouchableOpacity
                    key={num}
                    style={[styles.demoThumb, { borderColor: colors.primary + "44", backgroundColor: colors.background }]}
                    onPress={() => loadDemoImage(num)}
                    activeOpacity={0.75}
                    disabled={demoLoading !== null}
                  >
                    <Image source={{ uri: thumbUri }} style={styles.demoThumbImg} resizeMode="cover" />
                    {isLoading && (
                      <View style={styles.demoThumbOverlay}>
                        <ActivityIndicator size="small" color="#00d4aa" />
                      </View>
                    )}
                    <Text style={[styles.demoThumbLabel, { color: colors.primary }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </View>

      {/* ── Section label ── */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>EXPLORE FEATURES</Text>

      {/* ── Widget grid ── */}
      {WIDGETS.map((w) => (
        <WidgetCard key={w.title} w={w} colors={colors} />
      ))}
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* featured card */
  featuredCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    flexDirection: "row",
  },
  featuredStrip: { width: 4 },
  featuredContent: { flex: 1, padding: 14, gap: 12 },
  featuredHeader: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  featuredIconWrap: { width: 50, height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  featuredTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  featuredTitle: { fontSize: 17, fontFamily: "Oswald_700Bold", letterSpacing: 0.5 },
  featuredDesc: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17, marginTop: 2 },
  featuredActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  featuredBtns: { flex: 1, flexDirection: "row", gap: 8 },
  featCameraBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 24,
  },
  featCameraBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#0a1628" },
  featGalleryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 24, borderWidth: 1,
  },
  featGalleryBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  /* demo row */
  demoRow: { gap: 6 },
  demoRowLabel: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 1.2, textTransform: "uppercase" },
  demoThumbs: { flexDirection: "row", gap: 6 },
  demoThumb: { flex: 1, borderRadius: 8, borderWidth: 1, overflow: "hidden" },
  demoThumbImg: { width: "100%", height: 50 },
  demoThumbOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  demoThumbLabel: { fontSize: 9, fontFamily: "Inter_700Bold", textAlign: "center", paddingVertical: 3 },

  /* section label */
  sectionLabel: {
    fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1.5,
    textTransform: "uppercase", textAlign: "center", marginTop: 4,
  },

  /* widget cards */
  widgetWrap: { width: "100%" },
  widgetCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    flexDirection: "row",
  },
  widgetStrip: { width: 4 },
  widgetInner: { flex: 1, flexDirection: "row", alignItems: "center", padding: 13, gap: 12 },
  widgetIconWrap: { width: 42, height: 42, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  widgetText: { flex: 1, gap: 2 },
  widgetTitle: { fontSize: 15, fontFamily: "Oswald_700Bold", letterSpacing: 0.3 },
  widgetDesc: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 15 },
  widgetRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  widgetTag: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  widgetTagText: { fontSize: 8, fontFamily: "Inter_700Bold", letterSpacing: 0.8 },

  /* analyze view */
  imageContainer: { borderRadius: 16, overflow: "hidden", borderWidth: 1, position: "relative" },
  image: { width: "100%", height: 220 },
  imageActions: { position: "absolute", top: 10, right: 10, flexDirection: "row", gap: 6 },
  overlayBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  overlayBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  analyzeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 14, borderRadius: 30 },
  analyzeBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  loadingContainer: { alignItems: "center", gap: 12, paddingVertical: 20 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 14, borderRadius: 10, borderWidth: 1 },
  errorText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  newBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  newBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
});
