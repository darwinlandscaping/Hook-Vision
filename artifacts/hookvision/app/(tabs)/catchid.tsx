/**
 * Catch ID — AI Fish Photo Identification
 * Photograph a caught fish → GPT-4.1 identifies species, estimates size,
 * checks NT regulations, and gives handling advice.
 */
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { HVHeader } from "@/components/HVHeader";

// ─── Types ────────────────────────────────────────────────────────────────────
interface FishIdResult {
  species:            string;
  scientificName:     string;
  confidence:         number;
  alternateId?:       string;
  sizeEstimate?:      string | null;
  sizeEstimateMethod?:string | null;
  legalSizeNT:        string;
  bagLimitNT:         string;
  legalStatus:        "keep" | "release" | "protected" | "measure";
  legalNote?:         string;
  features:           string[];
  handling:           string;
  releaseTip?:        string | null;
  isProtected:        boolean;
  habitat:            string;
  season:             string;
  funFact:            string;
}

// ─── Legal status config ──────────────────────────────────────────────────────
const LEGAL = {
  keep:      { label: "✓ KEEP",      bg: "#00c85080", border: "#00c850", text: "#00ff66" },
  release:   { label: "↩ RELEASE",   bg: "#ff440040", border: "#ff4400", text: "#ff6633" },
  protected: { label: "⚠ PROTECTED", bg: "#ff880040", border: "#ff8800", text: "#ffaa33" },
  measure:   { label: "📏 MEASURE",   bg: "#ffd70040", border: "#ffd700", text: "#ffd700" },
};

// ─── Helper: force JPEG ───────────────────────────────────────────────────────
async function toJpeg(uri: string): Promise<{ uri: string; base64: string }> {
  const r = await manipulateAsync(uri, [], { format: SaveFormat.JPEG, compress: 0.85, base64: true });
  return { uri: r.uri, base64: r.base64 ?? "" };
}

// ─── Confidence badge ─────────────────────────────────────────────────────────
function ConfBadge({ value }: { value: number }) {
  const color = value >= 80 ? "#00d4aa" : value >= 55 ? "#ffd700" : "#ff8800";
  return (
    <View style={[S.confBadge, { borderColor: color + "80", backgroundColor: color + "18" }]}>
      <Text style={[S.confText, { color }]}>{value}% confident</Text>
    </View>
  );
}

// ─── Feature pill ─────────────────────────────────────────────────────────────
function FeatPill({ text }: { text: string }) {
  return (
    <View style={S.pill}>
      <Text style={S.pillText}>{text}</Text>
    </View>
  );
}

// ─── Spinning fish loader ─────────────────────────────────────────────────────
function FishLoader() {
  const spin = useSharedValue(0);
  React.useEffect(() => {
    spin.value = withRepeat(withTiming(1, { duration: 900 }), -1, false);
  }, [spin]);
  const anim = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  return (
    <View style={S.loaderWrap}>
      <Animated.View style={anim}>
        <MaterialCommunityIcons name="fish" size={48} color="#00d4aa" />
      </Animated.View>
      <Text style={S.loaderText}>Identifying fish…</Text>
      <Text style={S.loaderSub}>Checking NT regulations</Text>
    </View>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ onCamera, onGallery }: { onCamera: () => void; onGallery: () => void }) {
  return (
    <View style={S.emptyWrap}>
      <View style={S.emptyIcon}>
        <MaterialCommunityIcons name="camera-iris" size={64} color="#00d4aa40" />
        <MaterialCommunityIcons name="fish" size={36} color="#00d4aa" style={S.emptyFish} />
      </View>
      <Text style={S.emptyTitle}>Catch ID</Text>
      <Text style={S.emptySub}>
        Photograph your catch and get instant AI species ID, size estimate, and NT
        regulations — powered by the same vision tech as face recognition.
      </Text>

      <View style={S.emptyBtns}>
        <TouchableOpacity style={S.emptyBtnPrimary} onPress={onCamera} activeOpacity={0.8}>
          <Feather name="camera" size={22} color="#0a1628" />
          <Text style={S.emptyBtnPrimaryText}>Take Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={S.emptyBtnSecondary} onPress={onGallery} activeOpacity={0.8}>
          <Feather name="image" size={22} color="#00d4aa" />
          <Text style={S.emptyBtnSecondaryText}>Choose Photo</Text>
        </TouchableOpacity>
      </View>

      <View style={S.tipBox}>
        <Text style={S.tipTitle}>Best shot tips</Text>
        <Text style={S.tipItem}>• Side-on view of the whole fish</Text>
        <Text style={S.tipItem}>• Include your hand or rod for size reference</Text>
        <Text style={S.tipItem}>• Good light, no heavy shadow across the body</Text>
        <Text style={S.tipItem}>• Keep fish in water if releasing</Text>
      </View>
    </View>
  );
}

// ─── Result card ──────────────────────────────────────────────────────────────
function ResultCard({
  result,
  imageUri,
  onReset,
}: {
  result: FishIdResult;
  imageUri: string;
  onReset: () => void;
}) {
  const legal = LEGAL[result.legalStatus] ?? LEGAL.measure;
  const scale = useSharedValue(0.92);
  React.useEffect(() => { scale.value = withSpring(1, { damping: 14 }); }, [scale]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[S.resultWrap, anim]}>
      {/* Photo */}
      <Image source={{ uri: imageUri }} style={S.photo} resizeMode="cover" />

      {/* Species header */}
      <View style={S.speciesHeader}>
        <View style={S.speciesNameRow}>
          <Text style={S.speciesName}>{result.species}</Text>
          <ConfBadge value={result.confidence} />
        </View>
        <Text style={S.sciName}>{result.scientificName}</Text>
        {result.alternateId && (
          <Text style={S.altId}>Could also be: {result.alternateId}</Text>
        )}
      </View>

      {/* Legal status — most prominent */}
      <View style={[S.legalBanner, { backgroundColor: legal.bg, borderColor: legal.border }]}>
        <Text style={[S.legalLabel, { color: legal.text }]}>{legal.label}</Text>
        {result.legalNote ? (
          <Text style={[S.legalNote, { color: legal.text + "cc" }]}>{result.legalNote}</Text>
        ) : null}
      </View>

      {/* Size + Regulations block */}
      <View style={S.regsBlock}>
        {result.sizeEstimate && (
          <View style={S.regRow}>
            <MaterialCommunityIcons name="ruler" size={16} color="#00a8ff" />
            <View style={S.regTextWrap}>
              <Text style={S.regLabel}>ESTIMATED SIZE</Text>
              <Text style={S.regValue}>
                {result.sizeEstimate}
                {result.sizeEstimateMethod ? (
                  <Text style={S.regSub}> · {result.sizeEstimateMethod}</Text>
                ) : null}
              </Text>
            </View>
          </View>
        )}
        <View style={S.regRow}>
          <MaterialCommunityIcons name="tape-measure" size={16} color="#ffd700" />
          <View style={S.regTextWrap}>
            <Text style={S.regLabel}>NT MINIMUM SIZE</Text>
            <Text style={S.regValue}>{result.legalSizeNT}</Text>
          </View>
        </View>
        <View style={S.regRow}>
          <MaterialCommunityIcons name="counter" size={16} color="#ffd700" />
          <View style={S.regTextWrap}>
            <Text style={S.regLabel}>NT BAG LIMIT</Text>
            <Text style={S.regValue}>{result.bagLimitNT}</Text>
          </View>
        </View>
        {result.isProtected && (
          <View style={[S.regRow, S.protectedRow]}>
            <MaterialCommunityIcons name="shield-alert" size={16} color="#ff8800" />
            <Text style={S.protectedText}>PROTECTED SPECIES — release immediately, do not remove from water</Text>
          </View>
        )}
      </View>

      {/* Visual features */}
      {result.features?.length > 0 && (
        <View style={S.section}>
          <Text style={S.sectionTitle}>IDENTIFICATION FEATURES</Text>
          <View style={S.pillRow}>
            {result.features.map((f, i) => <FeatPill key={i} text={f} />)}
          </View>
        </View>
      )}

      {/* Handling */}
      <View style={S.section}>
        <Text style={S.sectionTitle}>HANDLING</Text>
        <View style={S.infoBox}>
          <MaterialCommunityIcons name="hand-heart" size={16} color="#00d4aa" style={{ marginTop: 1 }} />
          <Text style={S.infoText}>{result.handling}</Text>
        </View>
        {result.releaseTip && (
          <View style={[S.infoBox, { marginTop: 6, borderColor: "#00a8ff40" }]}>
            <MaterialCommunityIcons name="water" size={16} color="#00a8ff" style={{ marginTop: 1 }} />
            <Text style={[S.infoText, { color: "#00a8ff" }]}>{result.releaseTip}</Text>
          </View>
        )}
      </View>

      {/* Habitat + Season */}
      <View style={S.section}>
        <Text style={S.sectionTitle}>NT HABITAT & SEASON</Text>
        <Text style={S.bodyText}>{result.habitat}</Text>
        <Text style={[S.bodyText, { color: "#ffd700", marginTop: 4 }]}>{result.season}</Text>
      </View>

      {/* Fun fact */}
      {result.funFact && (
        <View style={[S.section, S.factBox]}>
          <Text style={S.factLabel}>DID YOU KNOW?</Text>
          <Text style={S.factText}>{result.funFact}</Text>
        </View>
      )}

      {/* Regulation disclaimer */}
      <Text style={S.disclaimer}>
        * Always verify regulations with NT Fisheries before keeping. Rules change seasonally and by zone.
      </Text>

      {/* Actions */}
      <TouchableOpacity style={S.resetBtn} onPress={onReset} activeOpacity={0.8}>
        <Feather name="camera" size={18} color="#00d4aa" />
        <Text style={S.resetBtnText}>ID Another Fish</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function CatchIdScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === "web" ? 0 : insets.top;

  const [imageUri,  setImageUri]  = useState<string | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [result,    setResult]    = useState<FishIdResult | null>(null);
  const [error,     setError]     = useState<string | null>(null);

  const btnScale = useSharedValue(1);

  const runId = useCallback(async (uri: string, b64: string) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const domain  = process.env.EXPO_PUBLIC_DOMAIN;
      const baseUrl = domain ? `https://${domain}` : "";
      const resp = await fetch(`${baseUrl}/api/fish-id`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ imageBase64: b64 }),
      });
      if (!resp.ok) throw new Error(`Server error ${resp.status}`);
      const data: FishIdResult = await resp.json();
      setResult(data);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setError(String(e));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const openCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Camera Permission", "Please allow camera access to photograph your catch.");
      return;
    }
    btnScale.value = withSequence(withSpring(0.92), withSpring(1));
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.9, base64: false });
    if (!res.canceled && res.assets[0]) {
      const { uri, base64 } = await toJpeg(res.assets[0].uri);
      setImageUri(uri);
      runId(uri, base64);
    }
  }, [btnScale, runId]);

  const openGallery = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please allow access to your photo library.");
      return;
    }
    btnScale.value = withSequence(withSpring(0.92), withSpring(1));
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9, base64: false });
    if (!res.canceled && res.assets[0]) {
      const { uri, base64 } = await toJpeg(res.assets[0].uri);
      setImageUri(uri);
      runId(uri, base64);
    }
  }, [btnScale, runId]);

  const reset = useCallback(() => {
    setImageUri(null);
    setResult(null);
    setError(null);
    setLoading(false);
  }, []);

  return (
    <View style={[S.root, { backgroundColor: colors.background }]}>
      <HVHeader title="CATCH ID" subtitle="AI Fish Photo Identification" topPad={topPad} />

      <ScrollView
        style={S.scroll}
        contentContainerStyle={S.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* No photo yet */}
        {!imageUri && !loading && (
          <EmptyState onCamera={openCamera} onGallery={openGallery} />
        )}

        {/* Loading */}
        {loading && (
          <View style={S.loadingWrap}>
            {imageUri && <Image source={{ uri: imageUri }} style={S.photoThumb} resizeMode="cover" />}
            <FishLoader />
          </View>
        )}

        {/* Error */}
        {error && !loading && (
          <View style={S.errorWrap}>
            <MaterialCommunityIcons name="alert-circle" size={36} color="#ff4400" />
            <Text style={S.errorTitle}>ID Failed</Text>
            <Text style={S.errorText}>{error}</Text>
            <TouchableOpacity style={S.retryBtn} onPress={reset}>
              <Text style={S.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Result */}
        {result && imageUri && !loading && (
          <ResultCard result={result} imageUri={imageUri} onReset={reset} />
        )}
      </ScrollView>

      {/* Floating action buttons when result is shown */}
      {result && !loading && (
        <View style={[S.fab, { paddingBottom: insets.bottom + 8 }]}>
          <TouchableOpacity style={S.fabCamera} onPress={openCamera} activeOpacity={0.85}>
            <Feather name="camera" size={20} color="#0a1628" />
            <Text style={S.fabCameraText}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.fabGallery} onPress={openGallery} activeOpacity={0.85}>
            <Feather name="image" size={20} color="#00d4aa" />
            <Text style={S.fabGalleryText}>Gallery</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const C = { teal: "#00d4aa", gold: "#ffd700", navy: "#0a1628", accent: "#00a8ff" };

const S = StyleSheet.create({
  root:       { flex: 1 },
  scroll:     { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 120 },

  // Empty state
  emptyWrap:  { alignItems: "center", paddingTop: 20, gap: 16 },
  emptyIcon:  { width: 120, height: 120, justifyContent: "center", alignItems: "center" },
  emptyFish:  { position: "absolute", bottom: 18, right: 18 },
  emptyTitle: { fontSize: 26, fontFamily: "Oswald_700Bold", color: C.teal, letterSpacing: 1 },
  emptySub:   { fontSize: 13, fontFamily: "Inter_400Regular", color: "#aaa", textAlign: "center", lineHeight: 20, paddingHorizontal: 10 },
  emptyBtns:  { flexDirection: "row", gap: 12, marginTop: 4 },
  emptyBtnPrimary:      { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.teal, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 14 },
  emptyBtnPrimaryText:  { fontSize: 15, fontFamily: "Inter_700Bold", color: "#0a1628" },
  emptyBtnSecondary:    { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1.5, borderColor: C.teal + "80", paddingHorizontal: 22, paddingVertical: 13, borderRadius: 14 },
  emptyBtnSecondaryText:{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.teal },
  tipBox:   { borderWidth: 1, borderColor: "#ffffff15", borderRadius: 12, padding: 14, width: "100%", gap: 5, backgroundColor: "#ffffff08" },
  tipTitle: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#777", letterSpacing: 0.8, marginBottom: 4 },
  tipItem:  { fontSize: 12, fontFamily: "Inter_400Regular", color: "#999", lineHeight: 18 },

  // Loading
  loadingWrap: { alignItems: "center", gap: 16 },
  photoThumb:  { width: "100%", height: 200, borderRadius: 12, marginBottom: 8 },
  loaderWrap:  { alignItems: "center", gap: 8, paddingVertical: 24 },
  loaderText:  { fontSize: 18, fontFamily: "Oswald_700Bold", color: C.teal, letterSpacing: 0.5 },
  loaderSub:   { fontSize: 12, fontFamily: "Inter_400Regular", color: "#777" },

  // Error
  errorWrap:   { alignItems: "center", gap: 12, paddingVertical: 32 },
  errorTitle:  { fontSize: 18, fontFamily: "Oswald_700Bold", color: "#ff4400" },
  errorText:   { fontSize: 12, fontFamily: "Inter_400Regular", color: "#aaa", textAlign: "center" },
  retryBtn:    { borderWidth: 1, borderColor: C.teal, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryText:   { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.teal },

  // Result
  resultWrap: { gap: 14 },
  photo:      { width: "100%", height: 260, borderRadius: 14, backgroundColor: "#111" },

  // Species header
  speciesHeader:  { gap: 4 },
  speciesNameRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10 },
  speciesName:    { fontSize: 28, fontFamily: "Oswald_700Bold", color: C.teal, letterSpacing: 0.5, flexShrink: 1 },
  sciName:        { fontSize: 13, fontFamily: "Inter_400Regular", color: "#777", fontStyle: "italic" },
  altId:          { fontSize: 12, fontFamily: "Inter_400Regular", color: "#999" },

  // Confidence badge
  confBadge:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  confText:   { fontSize: 11, fontFamily: "Inter_700Bold" },

  // Legal banner
  legalBanner: { borderWidth: 1.5, borderRadius: 12, padding: 14, gap: 4 },
  legalLabel:  { fontSize: 18, fontFamily: "Oswald_700Bold", letterSpacing: 0.8 },
  legalNote:   { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },

  // Regulations
  regsBlock:    { borderWidth: 1, borderColor: "#ffffff12", borderRadius: 12, overflow: "hidden" },
  regRow:       { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: "#ffffff0a" },
  regTextWrap:  { flex: 1, gap: 2 },
  regLabel:     { fontSize: 9, fontFamily: "Inter_700Bold", color: "#555", letterSpacing: 0.8 },
  regValue:     { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#ddd" },
  regSub:       { fontSize: 11, fontFamily: "Inter_400Regular", color: "#777" },
  protectedRow: { backgroundColor: "#ff880012" },
  protectedText:{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#ff8800", flex: 1 },

  // Features
  section:     { gap: 8 },
  sectionTitle:{ fontSize: 10, fontFamily: "Inter_700Bold", color: "#555", letterSpacing: 1, textTransform: "uppercase" },
  pillRow:     { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pill:        { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: "#00d4aa14", borderWidth: 1, borderColor: "#00d4aa30", borderRadius: 20 },
  pillText:    { fontSize: 11, fontFamily: "Inter_500Medium", color: C.teal },

  // Info boxes
  infoBox:  { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, backgroundColor: "#00d4aa10", borderWidth: 1, borderColor: "#00d4aa30", borderRadius: 10 },
  infoText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#ccc", lineHeight: 19 },

  // Body text
  bodyText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#aaa", lineHeight: 19 },

  // Fun fact
  factBox:  { backgroundColor: "#ffd70010", borderWidth: 1, borderColor: "#ffd70030", borderRadius: 12, padding: 12 },
  factLabel:{ fontSize: 10, fontFamily: "Inter_700Bold", color: "#ffd700", letterSpacing: 0.8, marginBottom: 4 },
  factText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#e0c060", lineHeight: 19 },

  // Disclaimer
  disclaimer: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#555", textAlign: "center", lineHeight: 14, paddingHorizontal: 8 },

  // Reset button
  resetBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: C.teal + "60", borderRadius: 12, paddingVertical: 13 },
  resetBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.teal },

  // FAB bar
  fab:        { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 8, backgroundColor: "#0a162899", borderTopWidth: 1, borderTopColor: "#00d4aa22" },
  fabCamera:  { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.teal, borderRadius: 12, paddingVertical: 12 },
  fabCameraText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#0a1628" },
  fabGallery:    { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderColor: C.teal, borderRadius: 12, paddingVertical: 12 },
  fabGalleryText:{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.teal },
});
