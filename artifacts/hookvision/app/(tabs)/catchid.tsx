/**
 * Catch ID — Two-Stage AI Fish Identification
 *
 * Stage 1 (FAST — ~400 ms): gpt-5-mini barra detector
 *   → instant "BARRA CONFIRMED / NOT A BARRA" verdict + confidence
 * Stage 2 (FULL — ~2 s):   gpt-5.4 species analyser
 *   → species, WA regulations, size estimate, handling advice
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
  viewingAngle?:     "side" | "top" | "angled" | "head-on" | "unknown";
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

// ─── Top-view target zone overlay ─────────────────────────────────────────────
// Shown over the photo when top-view mode is active.
// During scanning: sweep line runs, zones show at default colours.
// After results arrive: sweep stops, zones light up teal (detected),
// red (missing), or grey (not mentioned by AI).

interface TVZone {
  label:          string;
  featureKeyword: string;   // substring matched against featuresDetected / featuresMissing
  top:            string;
  left?:          string;
  right?:         string;
  defaultColor:   string;
}
const TV_ZONES: TVZone[] = [
  { label: "EYE L",        featureKeyword: "EYE",      top: "17%", left:   "8%",             defaultColor: "#00d4aa" },
  { label: "EYE R",        featureKeyword: "EYE",      top: "17%",             right:  "8%", defaultColor: "#00d4aa" },
  { label: "DORSAL RIDGE", featureKeyword: "DORSAL",   top:  "8%", left:  "28%",             defaultColor: "#00a8ff" },
  { label: "PECT. FIN ◀",  featureKeyword: "PECTORAL", top: "44%", left:   "2%",             defaultColor: "#ffd700" },
  { label: "▶ PECT. FIN",  featureKeyword: "PECTORAL", top: "44%",             right:  "2%", defaultColor: "#ffd700" },
  { label: "CAUDAL FIN",   featureKeyword: "CAUDAL",   top: "76%", left:  "30%",             defaultColor: "#00d4aa" },
  { label: "SHADOW ZONE",  featureKeyword: "SHADOW",   top: "60%", left:  "56%",             defaultColor: "#ff8800" },
];

function matchFeature(list: string[], keyword: string): boolean {
  return list.some(f => f.toUpperCase().includes(keyword));
}

function TopViewScanOverlay({
  active,
  scanning,
  detectedFeatures,
  missingFeatures,
}: {
  active:            boolean;
  scanning?:         boolean;
  detectedFeatures?: string[];
  missingFeatures?:  string[];
}) {
  const scanY  = useSharedValue(0);
  const pulse  = useSharedValue(0.4);
  const fadein = useSharedValue(0);

  const hasResults = (detectedFeatures?.length ?? 0) > 0 || (missingFeatures?.length ?? 0) > 0;

  // Count unique feature zones confirmed
  const detectedZoneCount = React.useMemo(() => {
    const seen = new Set<string>();
    TV_ZONES.forEach(z => {
      if (!seen.has(z.featureKeyword) && matchFeature(detectedFeatures ?? [], z.featureKeyword)) {
        seen.add(z.featureKeyword);
      }
    });
    return seen.size;
  }, [detectedFeatures]);

  React.useEffect(() => {
    if (!active) {
      fadein.value = withTiming(0, { duration: 200 });
      return;
    }
    fadein.value = withTiming(1, { duration: 350 });
    if (!hasResults || scanning) {
      scanY.value = withRepeat(withTiming(1, { duration: 1800 }), -1, false);
    } else {
      scanY.value = withTiming(-0.05, { duration: 400 });
    }
    pulse.value = withRepeat(withSequence(
      withTiming(1,   { duration: 700 }),
      withTiming(0.4, { duration: 700 }),
    ), -1, true);
  }, [active, hasResults, scanning, fadein, scanY, pulse]);

  const scanAnim = useAnimatedStyle(() => ({
    top: `${interpolate(scanY.value, [0, 1], [0, 100])}%`,
  }));
  const containerAnim = useAnimatedStyle(() => ({ opacity: fadein.value }));
  const cornerAnim    = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0.4, 1], [0.5, 1]),
  }));

  if (!active) return null;
  return (
    <Animated.View style={[ST.tvOverlay, containerAnim]} pointerEvents="none">
      {(["tl","tr","bl","br"] as const).map(pos => (
        <Animated.View key={pos} style={[ST.corner, ST[`corner_${pos}`], cornerAnim]} />
      ))}

      {/* Sweep line — only while scanning */}
      {(!hasResults || scanning) && (
        <Animated.View style={[ST.scanLine, scanAnim]} />
      )}

      {/* Zone labels — colored by detection result */}
      {TV_ZONES.map((z, i) => {
        const detected = hasResults && matchFeature(detectedFeatures ?? [], z.featureKeyword);
        const missing  = hasResults && matchFeature(missingFeatures  ?? [], z.featureKeyword);
        const color    = !hasResults ? z.defaultColor
                       : detected   ? "#00d4aa"
                       : missing    ? "#ff4400"
                       : "#555555";
        const opacity  = !hasResults ? 0.9 : detected ? 1 : missing ? 0.85 : 0.35;
        const prefix   = !hasResults ? "" : detected ? "✓ " : missing ? "✗ " : "○ ";
        return (
          <View key={i} style={[ST.zoneTag, {
            top:   z.top   as any,
            left:  z.left  as any,
            right: z.right as any,
            opacity,
          }]}>
            <View style={[ST.zoneDot, { backgroundColor: color }]} />
            <Text style={[ST.zoneLabel, { color }]}>{prefix}{z.label}</Text>
          </View>
        );
      })}

      <View style={ST.tvBadge}>
        <Text style={ST.tvBadgeText}>
          {hasResults && !scanning
            ? `📐 ${detectedZoneCount}/5 ZONES CONFIRMED`
            : "📐 TOP VIEW SCAN"}
        </Text>
      </View>
    </Animated.View>
  );
}

// ─── Top-view shape analysis card ─────────────────────────────────────────────
// Full 8-hallmark checklist card shown after a top-view barra detection.

const TV_HALLMARKS = [
  { label: "BODY OUTLINE",   keyword: "BODY",     detail: "4:1–5:1 length:width torpedo" },
  { label: "HEAD SHAPE",     keyword: "HEAD",     detail: "Broad, blunt; jaw protrudes" },
  { label: "EYE BULGES",     keyword: "EYE",      detail: "Large, high-set, prominent" },
  { label: "DORSAL RIDGE",   keyword: "RIDGE",    detail: "Spiny + soft section ridge" },
  { label: "PECTORAL FINS",  keyword: "PECTORAL", detail: "Large fan-shaped, splayed wide" },
  { label: "DORSAL COLOUR",  keyword: "COLOUR",   detail: "Dark blue-grey / olive-green" },
  { label: "CAUDAL FIN",     keyword: "CAUDAL",   detail: "Broad, slightly rounded tail" },
  { label: "SHADOW",         keyword: "SHADOW",   detail: "Body+fin silhouette, offset" },
] as const;

function TopViewShapeCard({ bc }: { bc: BarraCheck }) {
  const scale = useSharedValue(0.94);
  React.useEffect(() => {
    scale.value = withSpring(1, { damping: 14, stiffness: 160 });
  }, [scale]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const detected = bc.featuresDetected ?? [];
  const missing  = bc.featuresMissing  ?? [];

  const confirmedCount = TV_HALLMARKS.filter(h =>
    matchFeature(detected, h.keyword)
  ).length;

  const minToConfirm = 4;
  const passes = confirmedCount >= minToConfirm;

  return (
    <Animated.View style={[STV.card, anim]}>
      {/* Header */}
      <View style={STV.header}>
        <MaterialCommunityIcons name="fish" size={16} color={C.accent} />
        <Text style={STV.headerTitle}>TOP VIEW SHAPE ANALYSIS</Text>
        <View style={[STV.countBadge, { borderColor: passes ? C.teal + "80" : C.orange + "80" }]}>
          <Text style={[STV.countText, { color: passes ? C.teal : C.orange }]}>
            {confirmedCount}/8
          </Text>
        </View>
      </View>

      {/* 2-column hallmark grid */}
      <View style={STV.grid}>
        {TV_HALLMARKS.map((h) => {
          const isDetected = matchFeature(detected, h.keyword);
          const isMissing  = matchFeature(missing,  h.keyword);
          const status     = isDetected ? "detected" : isMissing ? "missing" : "neutral";
          const dotColor   = status === "detected" ? C.teal : status === "missing" ? C.red : "#444";
          const labelColor = status === "detected" ? C.teal : status === "missing" ? C.red : "#666";
          const icon       = status === "detected" ? "✓" : status === "missing" ? "✗" : "○";

          return (
            <View key={h.keyword} style={[STV.hallmarkRow, {
              backgroundColor: status === "detected" ? "#00d4aa0e" : status === "missing" ? "#ff440010" : "transparent",
              borderColor:     status === "detected" ? C.teal + "30" : status === "missing" ? C.red + "25" : "#ffffff12",
            }]}>
              <View style={[STV.hallmarkDot, { backgroundColor: dotColor }]} />
              <View style={{ flex: 1 }}>
                <Text style={[STV.hallmarkLabel, { color: labelColor }]}>
                  {icon} {h.label}
                </Text>
                <Text style={STV.hallmarkDetail}>{h.detail}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Footer note */}
      <View style={STV.footer}>
        <MaterialCommunityIcons
          name={passes ? "check-circle" : "alert-circle"}
          size={12}
          color={passes ? C.teal : C.orange}
        />
        <Text style={[STV.footerText, { color: passes ? C.teal + "cc" : C.orange + "cc" }]}>
          {passes
            ? `${confirmedCount} of 8 hallmarks confirmed — minimum 4 required ✓`
            : `${confirmedCount} of 8 confirmed — need ≥4 to confirm top-view barra`}
        </Text>
      </View>
    </Animated.View>
  );
}

// ─── Side-view anatomy zone overlay ───────────────────────────────────────────
// Shown over the photo for side-view / angled / head-on photos during scanning
// and after results arrive — zones colour-coded by detection outcome.

interface SVZone {
  label:          string;
  featureKeyword: string;
  top:            string;
  left?:          string;
  right?:         string;
  defaultColor:   string;
}
const SV_ZONES: SVZone[] = [
  { label: "FOREHEAD",     featureKeyword: "FOREHEAD",  top: "18%", left:  "6%",             defaultColor: "#00d4aa" },
  { label: "EYE",          featureKeyword: "EYE",       top: "40%", left:  "9%",             defaultColor: "#00d4aa" },
  { label: "JAW",          featureKeyword: "JAW",       top: "65%", left:  "3%",             defaultColor: "#ffd700" },
  { label: "DORSAL FIN",   featureKeyword: "DORSAL",    top:  "7%", left: "40%",             defaultColor: "#00a8ff" },
  { label: "LATERAL LINE", featureKeyword: "LATERAL",   top: "55%", left: "38%",             defaultColor: "#00a8ff" },
  { label: "SCALES",       featureKeyword: "SCALE",     top: "36%", left: "52%",             defaultColor: "#ffd700" },
  { label: "PECT. FIN",    featureKeyword: "PECTORAL",  top: "66%", left: "24%",             defaultColor: "#ffd700" },
  { label: "CAUDAL FIN",   featureKeyword: "CAUDAL",    top: "40%",             right:  "4%", defaultColor: "#00d4aa" },
  { label: "BODY",         featureKeyword: "BODY",      top: "13%",             right: "18%", defaultColor: "#00a8ff" },
];

function matchSVFeature(list: string[], keyword: string): boolean {
  return list.some(f => f.toUpperCase().includes(keyword));
}

function SideViewScanOverlay({
  active,
  scanning,
  detectedFeatures,
  missingFeatures,
}: {
  active:            boolean;
  scanning?:         boolean;
  detectedFeatures?: string[];
  missingFeatures?:  string[];
}) {
  const scanX  = useSharedValue(0);
  const pulse  = useSharedValue(0.4);
  const fadein = useSharedValue(0);

  const hasResults = (detectedFeatures?.length ?? 0) > 0 || (missingFeatures?.length ?? 0) > 0;

  const detectedZoneCount = React.useMemo(() => {
    const seen = new Set<string>();
    SV_ZONES.forEach(z => {
      if (!seen.has(z.featureKeyword) && matchSVFeature(detectedFeatures ?? [], z.featureKeyword)) {
        seen.add(z.featureKeyword);
      }
    });
    return seen.size;
  }, [detectedFeatures]);

  React.useEffect(() => {
    if (!active) { fadein.value = withTiming(0, { duration: 200 }); return; }
    fadein.value = withTiming(1, { duration: 350 });
    if (!hasResults || scanning) {
      scanX.value = withRepeat(withTiming(1, { duration: 1600 }), -1, false);
    } else {
      scanX.value = withTiming(1.05, { duration: 400 });
    }
    pulse.value = withRepeat(withSequence(
      withTiming(1,   { duration: 700 }),
      withTiming(0.4, { duration: 700 }),
    ), -1, true);
  }, [active, hasResults, scanning, fadein, scanX, pulse]);

  const scanAnimX = useAnimatedStyle(() => ({
    left: `${interpolate(scanX.value, [0, 1], [0, 100])}%`,
  }));
  const containerAnim = useAnimatedStyle(() => ({ opacity: fadein.value }));
  const cornerAnim    = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0.4, 1], [0.5, 1]),
  }));

  if (!active) return null;
  return (
    <Animated.View style={[ST.tvOverlay, containerAnim]} pointerEvents="none">
      {(["tl","tr","bl","br"] as const).map(pos => (
        <Animated.View key={pos} style={[ST.corner, ST[`corner_${pos}`], cornerAnim]} />
      ))}

      {/* Vertical sweep line — moves left-to-right like a facial recognition scan */}
      {(!hasResults || scanning) && (
        <Animated.View style={[SSV.scanLineV, scanAnimX]} />
      )}

      {/* Zone labels — colour-coded by detection outcome */}
      {SV_ZONES.map((z, i) => {
        const detected = hasResults && matchSVFeature(detectedFeatures ?? [], z.featureKeyword);
        const missing  = hasResults && matchSVFeature(missingFeatures  ?? [], z.featureKeyword);
        const color    = !hasResults ? z.defaultColor : detected ? "#00d4aa" : missing ? "#ff4400" : "#555555";
        const opacity  = !hasResults ? 0.85 : detected ? 1 : missing ? 0.85 : 0.3;
        const prefix   = !hasResults ? "" : detected ? "✓ " : missing ? "✗ " : "○ ";
        return (
          <View key={i} style={[ST.zoneTag, {
            top:   z.top   as any,
            left:  z.left  as any,
            right: z.right as any,
            opacity,
          }]}>
            <View style={[ST.zoneDot, { backgroundColor: color }]} />
            <Text style={[ST.zoneLabel, { color }]}>{prefix}{z.label}</Text>
          </View>
        );
      })}

      <View style={ST.tvBadge}>
        <Text style={ST.tvBadgeText}>
          {hasResults && !scanning
            ? `👁 ${detectedZoneCount}/9 FEATURES CONFIRMED`
            : "👁 SIDE VIEW SCAN"}
        </Text>
      </View>
    </Animated.View>
  );
}

// ─── Side-view shape analysis card ────────────────────────────────────────────
// Full 9-hallmark checklist for side-view / angled / head-on catches.

const SIDE_HALLMARKS = [
  { label: "FOREHEAD",     keyword: "FOREHEAD", detail: "Concave ski-jump dip — most reliable" },
  { label: "JAW",          keyword: "JAW",      detail: "Upper jaw extends past eye; large gape" },
  { label: "EYE",          keyword: "EYE",      detail: "Large, golden/orange iris, high-set" },
  { label: "SCALES",       keyword: "SCALE",    detail: "Large ctenoid, silvery-grey flanks" },
  { label: "BODY SHAPE",   keyword: "BODY",     detail: "Elongated, deep shoulder, narrow peduncle" },
  { label: "DORSAL FIN",   keyword: "DORSAL",   detail: "Long, deep notch: spiny + soft section" },
  { label: "CAUDAL FIN",   keyword: "CAUDAL",   detail: "Rounded, convex edge, dark thin margin" },
  { label: "PECTORAL FIN", keyword: "PECTORAL", detail: "Large, fan-shaped — no free finger rays" },
  { label: "LATERAL LINE", keyword: "LATERAL",  detail: "Arches over pectoral, then runs straight" },
] as const;

function SideViewShapeCard({ bc }: { bc: BarraCheck }) {
  const scale = useSharedValue(0.94);
  React.useEffect(() => {
    scale.value = withSpring(1, { damping: 14, stiffness: 160 });
  }, [scale]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const detected = bc.featuresDetected ?? [];
  const missing  = bc.featuresMissing  ?? [];

  const confirmedCount = SIDE_HALLMARKS.filter(h =>
    matchSVFeature(detected, h.keyword)
  ).length;

  const minToConfirm = 5;
  const passes = confirmedCount >= minToConfirm;
  const angle  = bc.viewingAngle;
  const headerLabel =
    angle === "angled"  ? "↗ ANGLED VIEW SHAPE ANALYSIS"
    : angle === "head-on" ? "👁 HEAD-ON SHAPE ANALYSIS"
    : "◀ SIDE VIEW SHAPE ANALYSIS";

  return (
    <Animated.View style={[STV.card, { borderColor: C.teal + "40", backgroundColor: C.teal + "08" }, anim]}>
      {/* Header */}
      <View style={STV.header}>
        <MaterialCommunityIcons name="eye-outline" size={16} color={C.teal} />
        <Text style={STV.headerTitle}>{headerLabel}</Text>
        <View style={[STV.countBadge, { borderColor: passes ? C.teal + "80" : C.orange + "80" }]}>
          <Text style={[STV.countText, { color: passes ? C.teal : C.orange }]}>
            {confirmedCount}/9
          </Text>
        </View>
      </View>

      {/* 2-column hallmark grid */}
      <View style={STV.grid}>
        {SIDE_HALLMARKS.map((h) => {
          const isDetected = matchSVFeature(detected, h.keyword);
          const isMissing  = matchSVFeature(missing,  h.keyword);
          const status     = isDetected ? "detected" : isMissing ? "missing" : "neutral";
          const dotColor   = status === "detected" ? C.teal : status === "missing" ? C.red : "#444";
          const labelColor = status === "detected" ? C.teal : status === "missing" ? C.red : "#666";
          const icon       = status === "detected" ? "✓" : status === "missing" ? "✗" : "○";

          return (
            <View key={h.keyword} style={[STV.hallmarkRow, {
              backgroundColor: status === "detected" ? "#00d4aa0e" : status === "missing" ? "#ff440010" : "transparent",
              borderColor:     status === "detected" ? C.teal + "30" : status === "missing" ? C.red + "25" : "#ffffff12",
            }]}>
              <View style={[STV.hallmarkDot, { backgroundColor: dotColor }]} />
              <View style={{ flex: 1 }}>
                <Text style={[STV.hallmarkLabel, { color: labelColor }]}>
                  {icon} {h.label}
                </Text>
                <Text style={STV.hallmarkDetail}>{h.detail}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Footer note */}
      <View style={STV.footer}>
        <MaterialCommunityIcons
          name={passes ? "check-circle" : "alert-circle"}
          size={12}
          color={passes ? C.teal : C.orange}
        />
        <Text style={[STV.footerText, { color: passes ? C.teal + "cc" : C.orange + "cc" }]}>
          {passes
            ? `${confirmedCount} of 9 hallmarks confirmed — minimum 5 required ✓`
            : `${confirmedCount} of 9 confirmed — need ≥5 for side-view barra ID`}
        </Text>
      </View>
    </Animated.View>
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
          name={confirmed ? "fish" : "fish-off"}
          size={32}
          color={labelCol}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[S.verdictTitle, { color: labelCol }]}>
            {confirmed ? "BARRA CONFIRMED" : bc.isBarra ? "POSSIBLE BARRA" : "NOT A BARRA"}
          </Text>
          <Text style={S.verdictSub}>AI Detection — Stage 1 of 2</Text>
        </View>
        <View style={{ gap: 4, alignItems: "flex-end" }}>
          <View style={S.speedBadge}>
            <Text style={S.speedText}>⚡ FAST</Text>
          </View>
          {bc.viewingAngle === "top" && (
            <View style={S.topViewBadge}>
              <Text style={S.topViewBadgeText}>📐 TOP VIEW</Text>
            </View>
          )}
          {bc.viewingAngle === "angled" && (
            <View style={[S.topViewBadge, { borderColor: C.gold + "60", backgroundColor: C.gold + "18" }]}>
              <Text style={[S.topViewBadgeText, { color: C.gold }]}>↗ ANGLED</Text>
            </View>
          )}
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
          <Text style={S.verdictMeta}>
            HALLMARK FEATURES DETECTED ({bc.featuresDetected.length}/{bc.viewingAngle === "top" ? "8" : "9"})
            {bc.viewingAngle === "top" ? " · DORSAL VIEW" : bc.viewingAngle === "angled" ? " · ANGLED VIEW" : ""}
          </Text>
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
          <Text style={S.regKey}>WA MIN. SIZE</Text>
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
        <Text style={S.sectionTitle}>WA HABITAT & SEASON</Text>
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
        * Always verify current WA Fisheries regulations before keeping. Rules change seasonally and by zone.
      </Text>
    </Animated.View>
  );
}

// ─── Catch Brain Analyser ──────────────────────────────────────────────────────
// Appears the moment analysis starts. Nodes pulse while loading; light up with
// live results as each stage resolves. Both stages shown simultaneously.
function CatchBrainAnalyser({
  barraCheck,
  fullResult,
  stage1Loading = false,
  stage2Loading = false,
}: {
  barraCheck:    BarraCheck    | null;
  fullResult:    FishIdResult  | null;
  stage1Loading?: boolean;
  stage2Loading?: boolean;
}) {
  // ── Per-system signals ───────────────────────────────────────────────────
  const bbScore  = barraCheck?.confidence ?? 0;
  const bbSignal = barraCheck?.isBarra === true;
  const gptScore = fullResult?.confidence ?? 0;
  const gptSignal = gptScore >= 60;
  const featCount = barraCheck?.featuresDetected?.length ?? 0;
  const totalFeats = barraCheck?.viewingAngle === "top" ? 8 : 9;

  // ── Brain score: partial score while loading ─────────────────────────────
  const anyDone = !!barraCheck || !!fullResult;
  const brainScore = anyDone
    ? Math.round(bbScore * 0.40 + gptScore * 0.60)
    : 0;

  // ── Consensus ────────────────────────────────────────────────────────────
  const bothDone = !!barraCheck && !!fullResult;
  const yeses = [bbSignal, gptSignal].filter(Boolean).length;
  type CStatus = "CONFIRMED" | "PROBABLE" | "NOT DETECTED" | "ANALYSING";
  const consensus: CStatus = !anyDone
    ? "ANALYSING"
    : !bothDone
    ? "ANALYSING"
    : yeses === 2 ? "CONFIRMED"
    : yeses === 1 ? "PROBABLE"
    : "NOT DETECTED";
  const cc =
    consensus === "CONFIRMED"    ? "#00d4aa"
    : consensus === "PROBABLE"   ? "#ffd700"
    : consensus === "ANALYSING"  ? "#00a8ff"
    : "#666666";
  const scoreColor =
    brainScore >= 75 ? "#00d4aa" : brainScore >= 50 ? "#ffd700"
    : anyDone ? "#ff8800" : "#333333";

  // ── Pulsing opacity for loading nodes ────────────────────────────────────
  const pulse = useSharedValue(1);
  React.useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(0.25, { duration: 600 }), withTiming(1, { duration: 600 })),
      -1, true
    );
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  // Entry animation
  const scale = useSharedValue(0.93);
  React.useEffect(() => { scale.value = withSpring(1, { damping: 14 }); }, [scale]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  // ── Helpers ──────────────────────────────────────────────────────────────
  function NodeLoading({ color }: { color: string }) {
    return (
      <Animated.View style={pulseStyle}>
        <Text style={{ fontSize: 9, fontFamily: "Inter_700Bold", color, letterSpacing: 0.8 }}>
          SCANNING…
        </Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[CB.card, anim]}>
      {/* Teal accent top bar — pulses blue while loading */}
      <View style={{ height: 4, backgroundColor: stage1Loading && !anyDone ? "#00a8ff" : "#00d4aa" }} />

      {/* Header */}
      <View style={CB.header}>
        <MaterialCommunityIcons name="brain" size={18} color="#00d4aa" />
        <Text style={CB.title}>TOTAL BRAIN ANALYSIS</Text>
        <View style={[CB.scoreBadge, {
          backgroundColor: scoreColor + "20",
          borderColor:     scoreColor + "50",
        }]}>
          {anyDone ? (
            <Text style={[CB.scoreBadgeText, { color: scoreColor }]}>{brainScore}%</Text>
          ) : (
            <Animated.Text style={[CB.scoreBadgeText, { color: "#00a8ff" }, pulseStyle]}>
              —%
            </Animated.Text>
          )}
        </View>
      </View>
      <Text style={CB.subtitle}>2 AI systems · weighted confidence consensus</Text>

      {/* Neural node row */}
      <View style={CB.nodeRow}>

        {/* ── BARRA BRAIN node ── */}
        <View style={CB.nodeWrap}>
          <View style={[CB.node, {
            borderColor: barraCheck ? "#00d4aa" : stage1Loading ? "#00a8ff" : "#2a2a2a",
          }]}>
            <MaterialCommunityIcons
              name="fish"
              size={22}
              color={barraCheck ? "#00d4aa" : stage1Loading ? "#00a8ff" : "#333"}
            />
            <Text style={[CB.nodeLabel, {
              color: barraCheck ? "#00d4aa" : stage1Loading ? "#00a8ff" : "#333",
            }]}>BARRA{"\n"}BRAIN</Text>

            {stage1Loading && !barraCheck ? (
              <NodeLoading color="#00a8ff" />
            ) : barraCheck ? (
              <Text style={[CB.nodeScore, { color: "#ffffff" }]}>{bbScore}%</Text>
            ) : (
              <Text style={[CB.nodeScore, { color: "#333" }]}>—</Text>
            )}
          </View>
          <Text style={[CB.nodeWeight, {
            color: barraCheck ? "#00d4aa60" : "#33333360",
          }]}>40% wt</Text>
        </View>

        <View style={CB.connectorWrap}>
          <View style={CB.connLine} />
          <MaterialCommunityIcons name="chevron-right" size={13} color="#ffffff25" />
        </View>

        {/* ── GPT-5 node ── */}
        <View style={CB.nodeWrap}>
          <View style={[CB.node, {
            borderColor: fullResult ? "#7c5cfc" : stage2Loading ? "#00a8ff" : "#2a2a2a",
          }]}>
            <MaterialCommunityIcons
              name="chip"
              size={22}
              color={fullResult ? "#7c5cfc" : stage2Loading ? "#00a8ff" : "#333"}
            />
            <Text style={[CB.nodeLabel, {
              color: fullResult ? "#7c5cfc" : stage2Loading ? "#00a8ff" : "#333",
            }]}>GPT-5{"\n"}FULL ID</Text>

            {stage2Loading && !fullResult ? (
              <NodeLoading color="#00a8ff" />
            ) : fullResult ? (
              <Text style={[CB.nodeScore, { color: "#ffffff" }]}>{gptScore}%</Text>
            ) : (
              <Text style={[CB.nodeScore, { color: "#333" }]}>—</Text>
            )}
          </View>
          <Text style={[CB.nodeWeight, {
            color: fullResult ? "#7c5cfc60" : "#33333360",
          }]}>60% wt</Text>
        </View>
      </View>

      {/* Brain score fill-bar */}
      <View style={CB.scoreBarWrap}>
        <View style={CB.scoreBarTrack}>
          {anyDone ? (
            <View style={[CB.scoreBarFill, {
              width:           `${brainScore}%` as any,
              backgroundColor: scoreColor,
            }]} />
          ) : (
            <Animated.View style={[CB.scoreBarFill, {
              width: "30%", backgroundColor: "#00a8ff30",
            }, pulseStyle]} />
          )}
        </View>
        <Text style={[CB.scoreBarLabel, { color: anyDone ? scoreColor : "#00a8ff60" }]}>
          {anyDone ? `BRAIN SCORE  ${brainScore}%` : "BRAIN SCORE  CALCULATING…"}
        </Text>
      </View>

      {/* System verdict rows */}
      <View style={CB.verdictList}>
        {/* Barra Brain row */}
        <View style={CB.verdictRow}>
          <View style={[CB.verdictDot, {
            backgroundColor: barraCheck ? (bbSignal ? "#00d4aa" : "#555")
              : stage1Loading ? "#00a8ff" : "#222",
          }]} />
          <Text style={CB.verdictSys}>BARRA BRAIN</Text>
          {barraCheck ? (
            <>
              <Text style={[CB.verdictVal, { color: bbSignal ? "#00d4aa" : "#666" }]}>
                {bbSignal ? "✓ BARRA CONFIRMED" : "✗ NOT A BARRA"}
              </Text>
              <Text style={[CB.verdictChip, {
                color:           "#00d4aa",
                borderColor:     "#00d4aa25",
                backgroundColor: "#00d4aa0d",
              }]}>
                {featCount}/{totalFeats} feats
              </Text>
            </>
          ) : (
            <Animated.Text style={[CB.verdictVal, { color: "#00a8ff" }, pulseStyle]}>
              {stage1Loading ? "scanning image…" : "waiting"}
            </Animated.Text>
          )}
        </View>

        {/* GPT-5 row */}
        <View style={CB.verdictRow}>
          <View style={[CB.verdictDot, {
            backgroundColor: fullResult ? (gptSignal ? "#7c5cfc" : "#555")
              : stage2Loading ? "#00a8ff" : "#222",
          }]} />
          <Text style={CB.verdictSys}>GPT-5</Text>
          {fullResult ? (
            <>
              <Text style={[CB.verdictVal, { color: gptSignal ? "#7c5cfc" : "#666" }]}>
                {gptSignal ? `✓ ${fullResult.species}` : `○ ${fullResult.species}`}
              </Text>
              <Text style={[CB.verdictChip, {
                color:           "#7c5cfc",
                borderColor:     "#7c5cfc25",
                backgroundColor: "#7c5cfc0d",
              }]}>
                {fullResult.legalStatus.toUpperCase()}
              </Text>
            </>
          ) : (
            <Animated.Text style={[CB.verdictVal, { color: "#00a8ff" }, pulseStyle]}>
              {stage2Loading ? "identifying species…" : "waiting for Stage 1"}
            </Animated.Text>
          )}
        </View>
      </View>

      {/* Consensus banner */}
      <View style={[CB.consensusBar, { backgroundColor: cc + "18", borderColor: cc + "44" }]}>
        {consensus === "ANALYSING" ? (
          <Animated.View style={[{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }, pulseStyle]}>
            <MaterialCommunityIcons name="brain" size={18} color={cc} />
            <Text style={[CB.consensusLabel, { color: cc }]}>AI SYSTEMS PROCESSING…</Text>
          </Animated.View>
        ) : (
          <>
            <MaterialCommunityIcons
              name={consensus === "CONFIRMED" ? "check-circle" : consensus === "PROBABLE" ? "alert-circle" : "close-circle"}
              size={18}
              color={cc}
            />
            <Text style={[CB.consensusLabel, { color: cc }]}>
              {consensus === "CONFIRMED" ? "BOTH SYSTEMS AGREE"
               : consensus === "PROBABLE" ? "1 OF 2 SYSTEMS POSITIVE"
               : "NO POSITIVE SIGNAL"}
            </Text>
            <Text style={[CB.consensusBadge, { color: cc }]}>{consensus}</Text>
          </>
        )}
      </View>
    </Animated.View>
  );
}

const CB = StyleSheet.create({
  card: {
    borderRadius:    18,
    borderWidth:     1.5,
    borderColor:     "#00d4aa30",
    backgroundColor: "#060e1c",
    overflow:        "hidden",
  },
  header: {
    flexDirection:    "row",
    alignItems:       "center",
    gap:              8,
    paddingHorizontal: 16,
    paddingTop:        14,
    paddingBottom:     6,
  },
  title: {
    flex:          1,
    fontSize:      13,
    fontFamily:    "Oswald_700Bold",
    color:         "#00d4aa",
    letterSpacing: 1.5,
  },
  scoreBadge: {
    borderRadius:     8,
    borderWidth:      1,
    paddingHorizontal: 10,
    paddingVertical:   4,
  },
  scoreBadgeText: {
    fontSize:   14,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize:         10,
    fontFamily:       "Inter_400Regular",
    color:            "#ffffff40",
    paddingHorizontal: 16,
    paddingBottom:     14,
  },
  // ── Nodes ─────────────────────────────────────────
  nodeRow: {
    flexDirection:    "row",
    alignItems:       "flex-start",
    justifyContent:   "center",
    paddingHorizontal: 16,
    paddingBottom:     14,
    gap:              4,
  },
  nodeWrap: {
    alignItems: "center",
    gap:        4,
    flex:       1,
  },
  node: {
    borderWidth:     1.5,
    borderRadius:    12,
    backgroundColor: "#0c1a2e",
    padding:         10,
    alignItems:      "center",
    gap:             3,
    width:           "100%",
  },
  nodeLabel: {
    fontSize:      8,
    fontFamily:    "Inter_700Bold",
    textAlign:     "center",
    letterSpacing: 0.5,
  },
  nodeScore: {
    fontSize:   16,
    fontFamily: "Inter_700Bold",
    marginTop:  2,
  },
  nodeWeight: {
    fontSize:   9,
    fontFamily: "Inter_400Regular",
  },
  connectorWrap: {
    flexDirection: "row",
    alignItems:    "center",
    marginTop:     22,
    gap:           0,
    paddingHorizontal: 2,
  },
  connLine: {
    flex:            1,
    height:          1,
    backgroundColor: "#ffffff15",
    minWidth:        8,
  },
  // ── Brain score bar ───────────────────────────────
  scoreBarWrap: {
    paddingHorizontal: 16,
    paddingBottom:     14,
    gap:               6,
  },
  scoreBarTrack: {
    height:          6,
    borderRadius:    3,
    backgroundColor: "#ffffff10",
    overflow:        "hidden",
  },
  scoreBarFill: {
    height:       6,
    borderRadius: 3,
  },
  scoreBarLabel: {
    fontSize:      10,
    fontFamily:    "Inter_700Bold",
    letterSpacing: 1.2,
    textAlign:     "right",
  },
  // ── Verdict rows ──────────────────────────────────
  verdictList: {
    borderTopWidth: 1,
    borderTopColor: "#ffffff08",
    paddingVertical: 4,
  },
  verdictRow: {
    flexDirection:    "row",
    alignItems:       "center",
    gap:              8,
    paddingHorizontal: 16,
    paddingVertical:   7,
    borderBottomWidth: 1,
    borderBottomColor: "#ffffff06",
  },
  verdictDot: {
    width:        7,
    height:       7,
    borderRadius: 4,
  },
  verdictSys: {
    fontSize:      9,
    fontFamily:    "Inter_700Bold",
    color:         "#ffffff60",
    letterSpacing: 0.8,
    width:         80,
  },
  verdictVal: {
    flex:       1,
    fontSize:   10,
    fontFamily: "Inter_700Bold",
  },
  verdictChip: {
    fontSize:         9,
    fontFamily:       "Inter_700Bold",
    letterSpacing:    0.5,
    borderWidth:      1,
    borderRadius:     6,
    paddingHorizontal: 6,
    paddingVertical:   2,
  },
  // ── Consensus banner ──────────────────────────────
  consensusBar: {
    flexDirection:    "row",
    alignItems:       "center",
    gap:              10,
    paddingHorizontal: 16,
    paddingVertical:   12,
    borderTopWidth:    1,
  },
  consensusLabel: {
    flex:          1,
    fontSize:      11,
    fontFamily:    "Inter_700Bold",
    letterSpacing: 0.6,
  },
  consensusBadge: {
    fontSize:      10,
    fontFamily:    "Inter_700Bold",
    letterSpacing: 1.2,
  },
});

/** Empty state */
function EmptyState({
  onCamera, onGallery, brain, topViewMode, onToggleTopView,
}: {
  onCamera: () => void;
  onGallery: () => void;
  brain: BrainStatus | null;
  topViewMode: boolean;
  onToggleTopView: () => void;
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
        full species ID with WA Fisheries regulations.
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

      {/* Top-view mode toggle */}
      <TouchableOpacity
        style={[S.topViewToggle, topViewMode && S.topViewToggleActive]}
        onPress={onToggleTopView}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons
          name="arrow-up-bold-box-outline"
          size={16}
          color={topViewMode ? C.teal : "#555"}
        />
        <Text style={[S.topViewToggleTxt, topViewMode && { color: C.teal }]}>
          📐 TOP VIEW MODE
        </Text>
        <View style={[S.topViewTogglePill, topViewMode && S.topViewTogglePillOn]}>
          <Text style={[S.topViewTogglePillTxt, topViewMode && { color: C.teal }]}>
            {topViewMode ? "ON" : "OFF"}
          </Text>
        </View>
      </TouchableOpacity>

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
        <Text style={S.tipItem}>• Side-on view of the whole fish (most features visible)</Text>
        <Text style={S.tipItem}>• Top-down view also works — hold camera directly above, let shadow fall to one side</Text>
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
  const tabBarH = Platform.OS === "web" ? 141 : 141 + insets.bottom;
  const botPad  = tabBarH + 20;

  const [imageUri,      setImageUri]      = useState<string | null>(null);
  const [barraCheck,    setBarraCheck]    = useState<BarraCheck | null>(null);
  const [fullResult,    setFullResult]    = useState<FishIdResult | null>(null);
  const [stage1Loading, setStage1Loading] = useState(false);
  const [stage2Loading, setStage2Loading] = useState(false);
  const [stage1Error,   setStage1Error]   = useState<string | null>(null);
  const [stage2Error,   setStage2Error]   = useState<string | null>(null);
  const [brainStatus,   setBrainStatus]   = useState<BrainStatus | null>(null);
  const [topViewMode,   setTopViewMode]   = useState(false);
  const topViewModeRef = useRef(false);
  topViewModeRef.current = topViewMode;

  const [confirmState,  setConfirmState]  = useState<"idle" | "confirming" | "confirmed" | "error">("idle");

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
    setConfirmState("idle");
    imageB64Ref.current   = b64;
    barraCheckRef.current = null;

    const base = getBaseUrl();

    // ── STAGE 1: fast barra detector (fires first, resolves first) ───────────
    const stage1 = fetch(`${base}/api/barra-check`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ imageBase64: b64, topViewHint: topViewModeRef.current }),
      signal:  ac.signal,
    })
      .then(r => r.json() as Promise<BarraCheck>)
      .then(data => {
        if (ac.signal.aborted) return;
        barraCheckRef.current = data;
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
    setConfirmState("idle");
  }, []);

  // Store the latest base64 so the confirm handler can access it from state
  const imageB64Ref = useRef<string | null>(null);

  const confirmBarra = useCallback(async () => {
    if (!imageB64Ref.current) return;
    setConfirmState("confirming");
    try {
      const base = getBaseUrl();
      const resp = await fetch(`${base}/api/barra-confirm`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64:  imageB64Ref.current,
          viewingAngle: barraCheckRef.current?.viewingAngle ?? undefined,
        }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setConfirmState("confirmed");
    } catch {
      setConfirmState("error");
    }
  }, []);

  // Keep a ref to the latest barraCheck result for the confirm handler
  const barraCheckRef = useRef<BarraCheck | null>(null);

  const hasAnyResult = barraCheck !== null || fullResult !== null;
  const isAnalysing  = stage1Loading || stage2Loading;

  return (
    <View style={[S.root, { backgroundColor: colors.background, paddingTop: topPad }]}>
      <HVHeader subtitle="Two-Stage AI Fish Detection" />

      <ScrollView
        style={S.scroll}
        contentContainerStyle={[S.scrollContent, { paddingBottom: hasAnyResult ? botPad + 70 : botPad }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ─ No photo yet ─ */}
        {!imageUri && <EmptyState onCamera={() => pickImage("camera")} onGallery={() => pickImage("gallery")} brain={brainStatus} topViewMode={topViewMode} onToggleTopView={() => setTopViewMode(v => !v)} />}

        {/* ─ Photo + analysis ─ */}
        {imageUri && (
          <View style={S.analysisWrap}>
            {/* Photo thumbnail + anatomy zone overlays */}
            <View style={S.photoWrap}>
              <Image source={{ uri: imageUri }} style={S.photo} resizeMode="cover" />

              {/* Top-view overlay: active when top-view mode ON or AI detected top-view */}
              <TopViewScanOverlay
                active={topViewMode || barraCheck?.viewingAngle === "top"}
                scanning={stage1Loading}
                detectedFeatures={barraCheck?.featuresDetected}
                missingFeatures={barraCheck?.featuresMissing}
              />

              {/* Side-view overlay: active for non-top-view scans */}
              <SideViewScanOverlay
                active={
                  !topViewMode &&
                  (stage1Loading || (!!barraCheck && barraCheck.viewingAngle !== "top"))
                }
                scanning={stage1Loading}
                detectedFeatures={barraCheck?.featuresDetected}
                missingFeatures={barraCheck?.featuresMissing}
              />
            </View>

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
            {/* Shape analysis cards — top-view or side-view depending on AI angle */}
            {barraCheck?.viewingAngle === "top" && <TopViewShapeCard bc={barraCheck} />}
            {barraCheck && barraCheck.viewingAngle !== "top" && (
              <SideViewShapeCard bc={barraCheck} />
            )}

            {/* Confirm + Save to Brain — shown after a positive barra result */}
            {barraCheck?.isBarra && !stage1Loading && (
              <View style={S.confirmWrap}>
                {confirmState === "confirmed" ? (
                  <View style={S.confirmDone}>
                    <MaterialCommunityIcons name="brain" size={18} color={C.teal} />
                    <Text style={S.confirmDoneText}>Saved to Barra Brain!</Text>
                    <Text style={S.confirmDoneSub}>Next scan learns from your fish.</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[S.confirmBtn, confirmState === "confirming" && { opacity: 0.6 }]}
                    onPress={confirmBarra}
                    disabled={confirmState === "confirming"}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons
                      name={confirmState === "error" ? "alert" : "brain"}
                      size={18}
                      color={confirmState === "error" ? C.red : C.teal}
                    />
                    <Text style={[S.confirmBtnText, confirmState === "error" && { color: C.red }]}>
                      {confirmState === "confirming"
                        ? "Saving to Brain…"
                        : confirmState === "error"
                        ? "Save failed — tap to retry"
                        : "✓ Confirm + Save to Brain"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

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

            {/* Total Brain Analysis — appears the moment analysis starts */}
            {(stage1Loading || stage2Loading || !!barraCheck || !!fullResult) && (
              <CatchBrainAnalyser
                barraCheck={barraCheck}
                fullResult={fullResult}
                stage1Loading={stage1Loading}
                stage2Loading={stage2Loading}
              />
            )}
          </View>
        )}
      </ScrollView>

      {/* Floating action bar — show when photo is loaded */}
      {imageUri && (
        <View style={[S.fab, { bottom: tabBarH, paddingBottom: 8 }]}>
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
  photoWrap:    { width: "100%", height: 220, borderRadius: 14, overflow: "hidden", backgroundColor: "#111" },
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
  speedBadge:      { paddingHorizontal: 8, paddingVertical: 3, backgroundColor: "#ffd70020", borderWidth: 1, borderColor: "#ffd70050", borderRadius: 8 },
  speedText:       { fontSize: 9, fontFamily: "Inter_700Bold", color: C.gold, letterSpacing: 0.5 },
  topViewBadge:    { paddingHorizontal: 8, paddingVertical: 3, backgroundColor: "#00a8ff18", borderWidth: 1, borderColor: "#00a8ff60", borderRadius: 8 },
  topViewBadgeText:{ fontSize: 9, fontFamily: "Inter_700Bold", color: C.accent, letterSpacing: 0.5 },

  // ── Top View Mode toggle ──────────────────────────────────────────────────
  topViewToggle: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderColor: "#ffffff20", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 9,
    backgroundColor: "#ffffff08", width: "100%",
  },
  topViewToggleActive: {
    borderColor: C.teal + "60", backgroundColor: C.teal + "12",
  },
  topViewToggleTxt: { flex: 1, fontSize: 11, fontFamily: "Inter_700Bold", color: "#555", letterSpacing: 0.5 },
  topViewTogglePill: {
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 6, borderWidth: 1, borderColor: "#ffffff20", backgroundColor: "#ffffff08",
  },
  topViewTogglePillOn: { borderColor: C.teal + "60", backgroundColor: C.teal + "18" },
  topViewTogglePillTxt: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#555", letterSpacing: 0.5 },

  // ── Confirm + Save to Brain ────────────────────────────────────────────────
  confirmWrap:   { width: "100%" },
  confirmBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderWidth: 1.5, borderColor: C.teal + "60", borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: C.teal + "14",
  },
  confirmBtnText: { flex: 1, fontSize: 13, fontFamily: "Inter_700Bold", color: C.teal, letterSpacing: 0.3 },
  confirmDone: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1.5, borderColor: C.teal + "40", borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: C.teal + "10",
  },
  confirmDoneText: { fontSize: 13, fontFamily: "Inter_700Bold", color: C.teal },
  confirmDoneSub:  { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", color: C.teal + "aa" },

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

// ─── Top-view overlay styles ──────────────────────────────────────────────────
const CORNER_SIZE = 20;
const CORNER_W    = 2.5;
const ST = StyleSheet.create({
  tvOverlay: {
    position:  "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 14,
  },

  // Corner bracket shared base
  corner: {
    position: "absolute",
    width:    CORNER_SIZE,
    height:   CORNER_SIZE,
    borderColor: C.teal,
  },
  corner_tl: { top: 8,  left:  8,  borderTopWidth: CORNER_W, borderLeftWidth:  CORNER_W },
  corner_tr: { top: 8,  right: 8,  borderTopWidth: CORNER_W, borderRightWidth: CORNER_W },
  corner_bl: { bottom: 8, left:  8,  borderBottomWidth: CORNER_W, borderLeftWidth:  CORNER_W },
  corner_br: { bottom: 8, right: 8,  borderBottomWidth: CORNER_W, borderRightWidth: CORNER_W },

  // Horizontal sweep line (top-view)
  scanLine: {
    position: "absolute",
    left: 0, right: 0,
    height: 1.5,
    backgroundColor: C.teal + "55",
  },

  // Zone tag label
  zoneTag: {
    position:      "absolute",
    flexDirection: "row",
    alignItems:    "center",
    gap:           3,
  },
  zoneDot: {
    width:        5,
    height:       5,
    borderRadius: 3,
  },
  zoneLabel: {
    fontSize:    8,
    fontFamily:  "Inter_700Bold",
    letterSpacing: 0.3,
    textShadowColor: "#000a",
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 0 },
  },

  // Mode badge bottom-center
  tvBadge: {
    position:        "absolute",
    bottom:          8,
    alignSelf:       "center",
    left:            "25%",
    right:           "25%",
    alignItems:      "center",
    backgroundColor: "#00000088",
    borderWidth:     1,
    borderColor:     C.accent + "80",
    borderRadius:    8,
    paddingHorizontal: 6,
    paddingVertical:   3,
  },
  tvBadgeText: {
    fontSize:    9,
    fontFamily:  "Inter_700Bold",
    color:       C.accent,
    letterSpacing: 0.5,
  },
});

// Vertical scan line for SideViewScanOverlay (sweeps left → right)
const SSV = StyleSheet.create({
  scanLineV: {
    position: "absolute",
    top: 0, bottom: 0,
    width: 1.5,
    backgroundColor: C.teal + "55",
  },
});

// ─── TopViewShapeCard styles ───────────────────────────────────────────────────
const STV = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderColor: C.accent + "40",
    borderRadius: 14,
    padding: 14,
    gap: 12,
    backgroundColor: C.accent + "08",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  headerTitle: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: C.accent,
    letterSpacing: 0.8,
  },
  countBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: {
    fontSize: 12,
    fontFamily: "Oswald_700Bold",
    letterSpacing: 0.3,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  hallmarkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    width: "47.5%",
  },
  hallmarkDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 4,
  },
  hallmarkLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  hallmarkDetail: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    color: "#666",
    lineHeight: 12,
    marginTop: 1,
  },
  footer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: C.accent + "20",
    paddingTop: 10,
  },
  footerText: {
    flex: 1,
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    lineHeight: 14,
  },
});
