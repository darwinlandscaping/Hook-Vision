/**
 * Catch ID — Two-Stage AI Fish Identification
 *
 * Stage 1 (FAST — ~400 ms): gpt-4.1-mini barra detector
 *   → instant "BARRA CONFIRMED / NOT A BARRA" verdict + confidence
 * Stage 2 (FULL — ~2 s):   gpt-4.1 species analyser
 *   → species, NT regulations, size estimate, handling advice
 *
 * Both calls fire simultaneously (Promise.race / Promise.all).
 * Stage 1 result appears the moment it resolves; Stage 2 fills in below it.
 * This mirrors the facial-recognition cascade pattern.
 */
import React, { useCallback, useRef, useState } from "react";
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
  interpolate,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { HVHeader } from "@/components/HVHeader";

// ─── Types ────────────────────────────────────────────────────────────────────
interface BarraCheck {
  isBarra:           boolean;
  confidence:        number;
  featuresDetected:  string[];
  featuresMissing:   string[];
  keyEvidence:       string;
  slotWarning:       string | null;
  sizeHint:          string | null;
  refPhotosUsed?:    number;
  refSourceDetails?: string[];
  refMatchScore?:    number;
}

interface BrainStatus {
  total:     number;
  inat:      number;
  community: number;
  cacheSize: number;
}

interface FishIdResult {
  species:             string;
  scientificName:      string;
  confidence:          number;
  alternateId?:        string;
  sizeEstimate?:       string | null;
  sizeEstimateMethod?: string | null;
  legalSizeNT:         string;
  bagLimitNT:          string;
  legalStatus:         "keep" | "release" | "protected" | "measure";
  legalNote?:          string;
  features:            string[];
  handling:            string;
  releaseTip?:         string | null;
  isProtected:         boolean;
  habitat:             string;
  season:              string;
  funFact:             string;
}

// ─── Colour tokens ────────────────────────────────────────────────────────────
const C = {
  teal:   "#00d4aa",
  gold:   "#ffd700",
  navy:   "#0a1628",
  accent: "#00a8ff",
  red:    "#ff4400",
  orange: "#ff8800",
};

const LEGAL = {
  keep:      { label: "✓ KEEP",      bg: "#00c85080", border: "#00c850", text: "#00ff66" },
  release:   { label: "↩ RELEASE",   bg: "#ff440040", border: "#ff4400", text: "#ff6633" },
  protected: { label: "⚠ PROTECTED", bg: "#ff880040", border: "#ff8800", text: "#ffaa33" },
  measure:   { label: "📏 MEASURE",   bg: "#ffd70040", border: "#ffd700", text: "#ffd700" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function toJpeg(uri: string): Promise<{ uri: string; base64: string }> {
  const r = await manipulateAsync(uri, [], {
    format: SaveFormat.JPEG, compress: 0.85, base64: true,
  });
  return { uri: r.uri, base64: r.base64 ?? "" };
}

function getBaseUrl(): string {
  const d = process.env.EXPO_PUBLIC_DOMAIN;
  return d ? `https://${d}` : "";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Spinning fish during analysis */
function FishLoader({ label }: { label: string }) {
  const spin = useSharedValue(0);
  React.useEffect(() => {
    spin.value = withRepeat(withTiming(1, { duration: 800 }), -1, false);
  }, [spin]);
  const anim = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));
  return (
    <View style={S.loaderRow}>
      <Animated.View style={anim}>
        <MaterialCommunityIcons name="fish" size={20} color={C.teal} />
      </Animated.View>
      <Text style={S.loaderLabel}>{label}</Text>
    </View>
  );
}

/** Pulsing confidence bar */
function ConfBar({ value, color }: { value: number; color: string }) {
  const w = useSharedValue(0);
  React.useEffect(() => {
    w.value = withSpring(value, { damping: 18, stiffness: 120 });
  }, [value, w]);
  const barAnim = useAnimatedStyle(() => ({ width: `${w.value}%` as any }));
  return (
    <View style={S.confBarTrack}>
      <Animated.View style={[S.confBarFill, barAnim, { backgroundColor: color }]} />
      <Text style={[S.confBarLabel, { color }]}>{value}%</Text>
    </View>
  );
}

/** Stage 1 — Instant barra verdict card */
function BarraVerdictCard({ bc }: { bc: BarraCheck }) {
  const scale = useSharedValue(0.88);
  React.useEffect(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 180 });
  }, [scale]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const confirmed  = bc.isBarra && bc.confidence >= 60;
  const borderCol  = confirmed ? C.teal : C.red;
  const bgCol      = confirmed ? "#00d4aa15" : "#ff440015";
  const labelCol   = confirmed ? C.teal : C.red;
  const barCol     = confirmed
    ? (bc.confidence >= 85 ? C.teal : C.gold)
    : C.red;

  return (
    <Animated.View style={[S.verdictCard, { borderColor: borderCol, backgroundColor: bgCol }, anim]}>
      {/* Icon + title row */}
      <View style={S.verdictTop}>
        <MaterialCommunityIcons
          name={confirmed ? "fish-off" : "fish"}
          size={32}
          color={labelCol}
          style={{ transform: [{ scaleX: confirmed ? 1 : 1 }] }}
        />
        {/* actual fish icon when confirmed, warning when not */}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[S.verdictTitle, { color: labelCol }]}>
            {confirmed ? "BARRA CONFIRMED" : bc.isBarra ? "POSSIBLE BARRA" : "NOT A BARRA"}
          </Text>
          <Text style={S.verdictSub}>AI Detection — Stage 1 of 2</Text>
        </View>
        <View style={[S.speedBadge]}>
          <Text style={S.speedText}>⚡ FAST</Text>
        </View>
      </View>

      {/* Confidence bar */}
      <View style={S.verdictSection}>
        <Text style={S.verdictMeta}>DETECTION CONFIDENCE</Text>
        <ConfBar value={bc.confidence} color={barCol} />
      </View>

      {/* Key evidence */}
      {bc.keyEvidence ? (
        <View style={S.evidenceBox}>
          <MaterialCommunityIcons name="magnify" size={14} color={C.accent} />
          <Text style={S.evidenceText}>{bc.keyEvidence}</Text>
        </View>
      ) : null}

      {/* Features detected */}
      {bc.featuresDetected?.length > 0 && (
        <View style={S.verdictSection}>
          <Text style={S.verdictMeta}>HALLMARK FEATURES DETECTED ({bc.featuresDetected.length}/9)</Text>
          <View style={S.pillRow}>
            {bc.featuresDetected.map((f, i) => (
              <View key={i} style={[S.pill, { borderColor: C.teal + "40", backgroundColor: C.teal + "18" }]}>
                <Text style={[S.pillText, { color: C.teal }]}>✓ {f}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Features not confirmed */}
      {bc.featuresMissing?.length > 0 && (
        <View style={S.verdictSection}>
          <Text style={S.verdictMeta}>COULD NOT CONFIRM</Text>
          <View style={S.pillRow}>
            {bc.featuresMissing.slice(0, 4).map((f, i) => (
              <View key={i} style={[S.pill, { borderColor: "#ffffff18", backgroundColor: "#ffffff08" }]}>
                <Text style={[S.pillText, { color: "#666" }]}>○ {f}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Size hint */}
      {bc.sizeHint && (
        <Text style={S.sizeHint}>
          <MaterialCommunityIcons name="ruler" size={12} color={C.accent} /> Estimated: {bc.sizeHint}
        </Text>
      )}

      {/* Slot warning */}
      {bc.slotWarning && (
        <View style={S.slotWarn}>
          <MaterialCommunityIcons name="alert" size={14} color={C.orange} />
          <Text style={S.slotWarnText}>{bc.slotWarning}</Text>
        </View>
      )}

      {/* Reference match score + photos used */}
      {(bc.refPhotosUsed ?? 0) > 0 && (
        <View style={S.refRow}>
          <MaterialCommunityIcons name="brain" size={12} color={C.orange} />
          <Text style={S.refText}>
            Compared against {bc.refPhotosUsed} verified specimen{bc.refPhotosUsed === 1 ? "" : "s"}
            {bc.refMatchScore != null ? ` · ref match ${bc.refMatchScore}%` : ""}
          </Text>
        </View>
      )}
      {bc.refSourceDetails && bc.refSourceDetails.length > 0 && (
        <Text style={S.refLocText}>
          {bc.refSourceDetails.join(" · ")}
        </Text>
      )}
    </Animated.View>
  );
}

/** Full species ID result card */
function FullIdCard({ result }: { result: FishIdResult }) {
  const legal = LEGAL[result.legalStatus] ?? LEGAL.measure;
  const scale = useSharedValue(0.92);
  React.useEffect(() => { scale.value = withSpring(1, { damping: 14 }); }, [scale]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[S.fullCard, anim]}>
      {/* Header */}
      <View style={S.fullCardHeader}>
        <MaterialCommunityIcons name="dna" size={18} color={C.accent} />
        <Text style={S.fullCardTitle}>FULL SPECIES ANALYSIS — Stage 2 of 2</Text>
      </View>

      {/* Species */}
      <View style={S.speciesRow}>
        <View style={{ flex: 1 }}>
          <Text style={S.speciesName}>{result.species}</Text>
          <Text style={S.sciName}>{result.scientificName}</Text>
          {result.alternateId && (
            <Text style={S.altId}>Could also be: {result.alternateId}</Text>
          )}
        </View>
        <View style={[S.confBadge, { borderColor: result.confidence >= 80 ? C.teal : C.gold }]}>
          <Text style={[S.confBadgeText, { color: result.confidence >= 80 ? C.teal : C.gold }]}>
            {result.confidence}%
          </Text>
        </View>
      </View>

      {/* Legal banner */}
      <View style={[S.legalBanner, { backgroundColor: legal.bg, borderColor: legal.border }]}>
        <Text style={[S.legalLabel, { color: legal.text }]}>{legal.label}</Text>
        {result.legalNote ? (
          <Text style={[S.legalNote, { color: legal.text + "cc" }]}>{result.legalNote}</Text>
        ) : null}
      </View>

      {/* Regulations */}
      <View style={S.regsGrid}>
        {result.sizeEstimate && (
          <View style={S.regCell}>
            <Text style={S.regKey}>ESTIMATED SIZE</Text>
            <Text style={S.regVal}>{result.sizeEstimate}</Text>
            {result.sizeEstimateMethod && (
              <Text style={S.regSub}>{result.sizeEstimateMethod}</Text>
            )}
          </View>
        )}
        <View style={S.regCell}>
          <Text style={S.regKey}>NT MIN. SIZE</Text>
          <Text style={S.regVal}>{result.legalSizeNT}</Text>
        </View>
        <View style={S.regCell}>
          <Text style={S.regKey}>BAG LIMIT</Text>
          <Text style={S.regVal}>{result.bagLimitNT}</Text>
        </View>
      </View>

      {/* Feature pills */}
      {result.features?.length > 0 && (
        <View style={S.section}>
          <Text style={S.sectionTitle}>ID FEATURES</Text>
          <View style={S.pillRow}>
            {result.features.map((f, i) => (
              <View key={i} style={S.pill}>
                <Text style={S.pillText}>{f}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Handling */}
      <View style={S.section}>
        <Text style={S.sectionTitle}>HANDLING</Text>
        <View style={S.infoBox}>
          <MaterialCommunityIcons name="hand-heart" size={14} color={C.teal} style={{ marginTop: 2 }} />
          <Text style={S.infoText}>{result.handling}</Text>
        </View>
        {result.releaseTip && (
          <View style={[S.infoBox, { borderColor: C.accent + "40", backgroundColor: C.accent + "10", marginTop: 6 }]}>
            <MaterialCommunityIcons name="water" size={14} color={C.accent} style={{ marginTop: 2 }} />
            <Text style={[S.infoText, { color: C.accent }]}>{result.releaseTip}</Text>
          </View>
        )}
      </View>

      {/* Habitat + Season */}
      <View style={S.section}>
        <Text style={S.sectionTitle}>NT HABITAT & SEASON</Text>
        <Text style={S.bodyText}>{result.habitat}</Text>
        <Text style={[S.bodyText, { color: C.gold, marginTop: 4 }]}>{result.season}</Text>
      </View>

      {/* Fun fact */}
      {result.funFact && (
        <View style={S.factBox}>
          <Text style={S.factLabel}>DID YOU KNOW?</Text>
          <Text style={S.factText}>{result.funFact}</Text>
        </View>
      )}

      <Text style={S.disclaimer}>
        * Always verify current NT Fisheries regulations before keeping. Rules change seasonally and by zone.
      </Text>
    </Animated.View>
  );
}

/** Empty state */
function EmptyState({
  onCamera, onGallery, brain,
}: {
  onCamera: () => void;
  onGallery: () => void;
  brain: BrainStatus | null;
}) {
  return (
    <View style={S.emptyWrap}>
      <View style={S.emptyIconWrap}>
        <MaterialCommunityIcons name="camera-iris" size={56} color={C.teal + "30"} />
        <MaterialCommunityIcons name="fish" size={30} color={C.teal} style={S.emptyFish} />
      </View>
      <Text style={S.emptyTitle}>CATCH ID</Text>
      <Text style={S.emptySub}>
        Two-stage AI detection — instant barra verdict in ~400 ms, then
        full species ID with NT regulations.
      </Text>

      {/* Brain status card */}
      {brain && (
        <View style={S.brainCard}>
          <View style={S.brainRow}>
            <MaterialCommunityIcons name="brain" size={20} color={C.orange} />
            <Text style={S.brainTitle}>BARRA BRAIN LOADED</Text>
          </View>
          <Text style={S.brainCount}>{brain.total.toLocaleString()}</Text>
          <Text style={S.brainSub}>verified reference photos</Text>
          <View style={S.brainStats}>
            <View style={S.brainStatItem}>
              <Text style={S.brainStatNum}>{brain.inat.toLocaleString()}</Text>
              <Text style={S.brainStatLbl}>iNaturalist{"\n"}research-grade</Text>
            </View>
            <View style={S.brainStatDivider} />
            <View style={S.brainStatItem}>
              <Text style={[S.brainStatNum, { color: C.teal }]}>{brain.community}</Text>
              <Text style={S.brainStatLbl}>Community{"\n"}confirmed</Text>
            </View>
            <View style={S.brainStatDivider} />
            <View style={S.brainStatItem}>
              <Text style={[S.brainStatNum, { color: C.accent }]}>3</Text>
              <Text style={S.brainStatLbl}>Refs injected{"\n"}per scan</Text>
            </View>
          </View>
          <Text style={S.brainNote}>
            3 reference specimens are compared against your photo in every scan.
            The brain grows smarter with each community confirmation.
          </Text>
        </View>
      )}

      <View style={S.stageRow}>
        <View style={S.stageCard}>
          <Text style={[S.stageBadge, { color: C.teal }]}>⚡ STAGE 1</Text>
          <Text style={S.stageDesc}>Barra detector{"\n"}~400 ms</Text>
        </View>
        <MaterialCommunityIcons name="arrow-right" size={20} color="#444" />
        <View style={S.stageCard}>
          <Text style={[S.stageBadge, { color: C.accent }]}>🔬 STAGE 2</Text>
          <Text style={S.stageDesc}>Full ID + regs{"\n"}~2 s</Text>
        </View>
      </View>

      <View style={S.emptyBtns}>
        <TouchableOpacity style={S.btnPrimary} onPress={onCamera} activeOpacity={0.8}>
          <Feather name="camera" size={20} color={C.navy} />
          <Text style={S.btnPrimaryText}>Take Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={S.btnSecondary} onPress={onGallery} activeOpacity={0.8}>
          <Feather name="image" size={20} color={C.teal} />
          <Text style={S.btnSecondaryText}>Gallery</Text>
        </TouchableOpacity>
      </View>

      <View style={S.tipBox}>
        <Text style={S.tipTitle}>BEST SHOT TIPS</Text>
        <Text style={S.tipItem}>• Side-on view of the whole fish</Text>
        <Text style={S.tipItem}>• Include your hand or rod as a size reference</Text>
        <Text style={S.tipItem}>• Good light, avoid heavy shadow across the body</Text>
        <Text style={S.tipItem}>• Keep fish in water if releasing</Text>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CatchIdScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 0 : insets.top;

  const [imageUri,      setImageUri]      = useState<string | null>(null);
  const [barraCheck,    setBarraCheck]    = useState<BarraCheck | null>(null);
  const [fullResult,    setFullResult]    = useState<FishIdResult | null>(null);
  const [stage1Loading, setStage1Loading] = useState(false);
  const [stage2Loading, setStage2Loading] = useState(false);
  const [stage1Error,   setStage1Error]   = useState<string | null>(null);
  const [stage2Error,   setStage2Error]   = useState<string | null>(null);
  const [brainStatus,   setBrainStatus]   = useState<BrainStatus | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // Fetch brain library status on mount
  React.useEffect(() => {
    const base = getBaseUrl();
    fetch(`${base}/api/barra-library/status`)
      .then(r => r.json())
      .then(d => setBrainStatus({ total: d.total, inat: d.inat, community: d.community, cacheSize: d.cacheSize }))
      .catch(() => {});
  }, []);

  const runAnalysis = useCallback(async (uri: string, b64: string) => {
    // Cancel any in-flight request
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setBarraCheck(null);
    setFullResult(null);
    setStage1Error(null);
    setStage2Error(null);
    setStage1Loading(true);
    setStage2Loading(true);

    const base = getBaseUrl();

    // ── STAGE 1: fast barra detector (fires first, resolves first) ───────────
    const stage1 = fetch(`${base}/api/barra-check`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ imageBase64: b64 }),
      signal:  ac.signal,
    })
      .then(r => r.json() as Promise<BarraCheck>)
      .then(data => {
        if (ac.signal.aborted) return;
        setBarraCheck(data);
        setStage1Loading(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      })
      .catch(e => {
        if (ac.signal.aborted) return;
        setStage1Error(String(e));
        setStage1Loading(false);
      });

    // ── STAGE 2: full species analyser (fires simultaneously) ────────────────
    const stage2 = fetch(`${base}/api/fish-id`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ imageBase64: b64 }),
      signal:  ac.signal,
    })
      .then(r => r.json() as Promise<FishIdResult>)
      .then(data => {
        if (ac.signal.aborted) return;
        setFullResult(data);
        setStage2Loading(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      })
      .catch(e => {
        if (ac.signal.aborted) return;
        setStage2Error(String(e));
        setStage2Loading(false);
      });

    await Promise.allSettled([stage1, stage2]);
  }, []);

  const pickImage = useCallback(async (source: "camera" | "gallery") => {
    if (source === "camera") {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Camera Permission", "Please allow camera access to photograph your catch.");
        return;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Please allow photo library access.");
        return;
      }
    }

    const res = source === "camera"
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.9 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 });

    if (!res.canceled && res.assets[0]) {
      const { uri, base64 } = await toJpeg(res.assets[0].uri);
      setImageUri(uri);
      runAnalysis(uri, base64);
    }
  }, [runAnalysis]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setImageUri(null);
    setBarraCheck(null);
    setFullResult(null);
    setStage1Error(null);
    setStage2Error(null);
    setStage1Loading(false);
    setStage2Loading(false);
  }, []);

  const hasAnyResult = barraCheck !== null || fullResult !== null;
  const isAnalysing  = stage1Loading || stage2Loading;

  return (
    <View style={[S.root, { backgroundColor: colors.background }]}>
      <HVHeader title="CATCH ID" subtitle="Two-Stage AI Fish Detection" topPad={topPad} />

      <ScrollView
        style={S.scroll}
        contentContainerStyle={[S.scrollContent, { paddingBottom: hasAnyResult ? 110 : 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ─ No photo yet ─ */}
        {!imageUri && <EmptyState onCamera={() => pickImage("camera")} onGallery={() => pickImage("gallery")} brain={brainStatus} />}

        {/* ─ Photo + analysis ─ */}
        {imageUri && (
          <View style={S.analysisWrap}>
            {/* Photo thumbnail */}
            <Image source={{ uri: imageUri }} style={S.photo} resizeMode="cover" />

            {/* Stage 1 status */}
            {stage1Loading && (
              <View style={S.stageStatus}>
                <FishLoader label="Stage 1 — Barra detection…" />
              </View>
            )}
            {stage1Error && (
              <View style={S.stageErrBox}>
                <MaterialCommunityIcons name="alert" size={16} color={C.red} />
                <Text style={S.stageErrText}>Detection failed: {stage1Error}</Text>
              </View>
            )}
            {barraCheck && <BarraVerdictCard bc={barraCheck} />}

            {/* Stage 2 status */}
            {stage2Loading && (
              <View style={S.stageStatus}>
                <FishLoader label="Stage 2 — Full species analysis…" />
              </View>
            )}
            {stage2Error && (
              <View style={S.stageErrBox}>
                <MaterialCommunityIcons name="alert" size={16} color={C.orange} />
                <Text style={S.stageErrText}>Full ID failed: {stage2Error}</Text>
              </View>
            )}
            {fullResult && <FullIdCard result={fullResult} />}
          </View>
        )}
      </ScrollView>

      {/* Floating action bar — show when photo is loaded */}
      {imageUri && (
        <View style={[S.fab, { paddingBottom: insets.bottom + 8 }]}>
          <TouchableOpacity style={S.fabCamera} onPress={() => pickImage("camera")} activeOpacity={0.85}
            disabled={isAnalysing}>
            <Feather name="camera" size={18} color={C.navy} />
            <Text style={S.fabCameraText}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.fabGallery} onPress={() => pickImage("gallery")} activeOpacity={0.85}
            disabled={isAnalysing}>
            <Feather name="image" size={18} color={C.teal} />
            <Text style={S.fabGalleryText}>Gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.fabReset} onPress={reset} activeOpacity={0.85}>
            <Feather name="x" size={18} color="#888" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root:         { flex: 1 },
  scroll:       { flex: 1 },
  scrollContent:{ padding: 16 },

  // ── Empty state ──────────────────────────────────────────────────────────
  emptyWrap:    { alignItems: "center", gap: 16, paddingTop: 12 },
  emptyIconWrap:{ width: 110, height: 110, justifyContent: "center", alignItems: "center" },
  emptyFish:    { position: "absolute", bottom: 16, right: 16 },
  emptyTitle:   { fontSize: 28, fontFamily: "Oswald_700Bold", color: C.teal, letterSpacing: 2 },
  emptySub:     { fontSize: 13, fontFamily: "Inter_400Regular", color: "#999", textAlign: "center", lineHeight: 20, paddingHorizontal: 10 },

  stageRow:     { flexDirection: "row", alignItems: "center", gap: 10 },
  stageCard:    { borderWidth: 1, borderColor: "#ffffff15", borderRadius: 10, padding: 10, alignItems: "center", gap: 3, backgroundColor: "#ffffff08" },
  stageBadge:   { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  stageDesc:    { fontSize: 11, fontFamily: "Inter_400Regular", color: "#888", textAlign: "center", lineHeight: 15 },

  emptyBtns:       { flexDirection: "row", gap: 12 },
  btnPrimary:      { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.teal, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 14 },
  btnPrimaryText:  { fontSize: 15, fontFamily: "Inter_700Bold", color: C.navy },
  btnSecondary:    { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1.5, borderColor: C.teal + "80", paddingHorizontal: 22, paddingVertical: 13, borderRadius: 14 },
  btnSecondaryText:{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.teal },

  tipBox:   { borderWidth: 1, borderColor: "#ffffff15", borderRadius: 12, padding: 14, width: "100%", gap: 5, backgroundColor: "#ffffff08" },
  tipTitle: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#777", letterSpacing: 0.8, marginBottom: 4 },
  tipItem:  { fontSize: 12, fontFamily: "Inter_400Regular", color: "#999", lineHeight: 18 },

  // ── Analysis wrapper ──────────────────────────────────────────────────────
  analysisWrap: { gap: 14 },
  photo:        { width: "100%", height: 220, borderRadius: 14, backgroundColor: "#111" },

  // ── Stage status ──────────────────────────────────────────────────────────
  stageStatus:  { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  loaderRow:    { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 14 },
  loaderLabel:  { fontSize: 13, fontFamily: "Inter_400Regular", color: "#777" },

  stageErrBox:  { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#ff440010", borderWidth: 1, borderColor: "#ff440030", borderRadius: 10, padding: 10 },
  stageErrText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#ff7060", lineHeight: 17 },

  // ── Barra verdict card ────────────────────────────────────────────────────
  verdictCard:   { borderWidth: 1.5, borderRadius: 14, padding: 14, gap: 12 },
  verdictTop:    { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  verdictTitle:  { fontSize: 22, fontFamily: "Oswald_700Bold", letterSpacing: 0.5 },
  verdictSub:    { fontSize: 10, fontFamily: "Inter_400Regular", color: "#666" },
  speedBadge:    { paddingHorizontal: 8, paddingVertical: 3, backgroundColor: "#ffd70020", borderWidth: 1, borderColor: "#ffd70050", borderRadius: 8 },
  speedText:     { fontSize: 9, fontFamily: "Inter_700Bold", color: C.gold, letterSpacing: 0.5 },

  verdictSection:{ gap: 6 },
  verdictMeta:   { fontSize: 9, fontFamily: "Inter_700Bold", color: "#555", letterSpacing: 0.8 },

  confBarTrack:  { height: 10, backgroundColor: "#ffffff10", borderRadius: 6, overflow: "hidden", position: "relative" },
  confBarFill:   { height: 10, borderRadius: 6, position: "absolute", left: 0, top: 0 },
  confBarLabel:  { position: "absolute", right: 6, top: -1, fontSize: 9, fontFamily: "Inter_700Bold" },

  evidenceBox:   { flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: "#00a8ff10", borderWidth: 1, borderColor: "#00a8ff30", borderRadius: 8, padding: 8 },
  evidenceText:  { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#aac4dd", lineHeight: 17 },

  pillRow:   { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pill:      { paddingHorizontal: 9, paddingVertical: 4, backgroundColor: "#00d4aa14", borderWidth: 1, borderColor: "#00d4aa30", borderRadius: 20 },
  pillText:  { fontSize: 11, fontFamily: "Inter_500Medium", color: C.teal },

  sizeHint:  { fontSize: 12, fontFamily: "Inter_400Regular", color: C.accent },
  slotWarn:  { flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: "#ff880012", borderWidth: 1, borderColor: "#ff880040", borderRadius: 8, padding: 8 },
  slotWarnText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", color: C.orange, lineHeight: 17 },
  refRow:    { flexDirection: "row", alignItems: "center", gap: 5 },
  refText:   { fontSize: 10, fontFamily: "Inter_500Medium", color: C.orange + "cc" },
  refLocText:{ fontSize: 9, fontFamily: "Inter_400Regular", color: "#555", marginLeft: 17 },

  // ── Brain status card ─────────────────────────────────────────────────────
  brainCard:     { width: "100%", borderWidth: 1.5, borderColor: "#ff8800aa", borderRadius: 14, padding: 14, gap: 8, backgroundColor: "#ff880010" },
  brainRow:      { flexDirection: "row", alignItems: "center", gap: 8 },
  brainTitle:    { fontSize: 11, fontFamily: "Inter_700Bold", color: C.orange, letterSpacing: 0.8 },
  brainCount:    { fontSize: 44, fontFamily: "Oswald_700Bold", color: C.orange, lineHeight: 48 },
  brainSub:      { fontSize: 12, fontFamily: "Inter_400Regular", color: "#aaa", marginTop: -4 },
  brainStats:    { flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: "#ff880030", paddingTop: 10, marginTop: 4 },
  brainStatItem: { flex: 1, alignItems: "center", gap: 3 },
  brainStatNum:  { fontSize: 20, fontFamily: "Oswald_700Bold", color: C.orange },
  brainStatLbl:  { fontSize: 9, fontFamily: "Inter_400Regular", color: "#777", textAlign: "center", lineHeight: 13 },
  brainStatDivider: { width: 1, height: 36, backgroundColor: "#ff880030" },
  brainNote:     { fontSize: 10, fontFamily: "Inter_400Regular", color: "#888", lineHeight: 14, borderTopWidth: 1, borderTopColor: "#ff880020", paddingTop: 8 },

  // ── Full ID card ──────────────────────────────────────────────────────────
  fullCard:       { borderWidth: 1, borderColor: "#00a8ff30", borderRadius: 14, padding: 14, gap: 14, backgroundColor: "#00a8ff08" },
  fullCardHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  fullCardTitle:  { fontSize: 10, fontFamily: "Inter_700Bold", color: C.accent, letterSpacing: 0.8 },

  speciesRow:   { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  speciesName:  { fontSize: 26, fontFamily: "Oswald_700Bold", color: C.teal, letterSpacing: 0.5, lineHeight: 30 },
  sciName:      { fontSize: 12, fontFamily: "Inter_400Regular", color: "#777", fontStyle: "italic" },
  altId:        { fontSize: 11, fontFamily: "Inter_400Regular", color: "#999" },
  confBadge:    { paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderRadius: 10, alignItems: "center" },
  confBadgeText:{ fontSize: 16, fontFamily: "Oswald_700Bold" },

  legalBanner:  { borderWidth: 1.5, borderRadius: 12, padding: 12, gap: 3 },
  legalLabel:   { fontSize: 18, fontFamily: "Oswald_700Bold", letterSpacing: 0.8 },
  legalNote:    { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },

  regsGrid:     { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  regCell:      { flex: 1, minWidth: 90, borderWidth: 1, borderColor: "#ffffff12", borderRadius: 10, padding: 10, gap: 2 },
  regKey:       { fontSize: 8, fontFamily: "Inter_700Bold", color: "#555", letterSpacing: 0.8 },
  regVal:       { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#ddd" },
  regSub:       { fontSize: 10, fontFamily: "Inter_400Regular", color: "#777" },

  section:      { gap: 7 },
  sectionTitle: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#555", letterSpacing: 1 },
  infoBox:      { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, backgroundColor: "#00d4aa10", borderWidth: 1, borderColor: "#00d4aa30", borderRadius: 10 },
  infoText:     { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#ccc", lineHeight: 19 },

  bodyText:     { fontSize: 13, fontFamily: "Inter_400Regular", color: "#aaa", lineHeight: 19 },
  factBox:      { backgroundColor: "#ffd70010", borderWidth: 1, borderColor: "#ffd70030", borderRadius: 12, padding: 12 },
  factLabel:    { fontSize: 9, fontFamily: "Inter_700Bold", color: C.gold, letterSpacing: 0.8, marginBottom: 4 },
  factText:     { fontSize: 13, fontFamily: "Inter_400Regular", color: "#e0c060", lineHeight: 19 },
  disclaimer:   { fontSize: 10, fontFamily: "Inter_400Regular", color: "#555", textAlign: "center", lineHeight: 14 },

  // ── FAB ───────────────────────────────────────────────────────────────────
  fab:           { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", gap: 8, paddingHorizontal: 14, paddingTop: 8, backgroundColor: "#0a162899", borderTopWidth: 1, borderTopColor: "#00d4aa22" },
  fabCamera:     { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: C.teal, borderRadius: 12, paddingVertical: 12 },
  fabCameraText: { fontSize: 14, fontFamily: "Inter_700Bold", color: C.navy },
  fabGallery:    { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1.5, borderColor: C.teal, borderRadius: 12, paddingVertical: 12 },
  fabGalleryText:{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.teal },
  fabReset:      { width: 46, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#444", borderRadius: 12 },
});
