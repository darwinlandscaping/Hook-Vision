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
import * as Brightness from "expo-brightness";
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
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";

import { AnalysisCard } from "@/components/AnalysisCard";
import { HVHeader } from "@/components/HVHeader";
import { SonarOverlay } from "@/components/SonarOverlay";
import { SonarPulse } from "@/components/SonarPulse";
import { useColors } from "@/hooks/useColors";
import { useHistory } from "@/context/HistoryContext";
import { useNarrator, type NarratorCharacter } from "@/context/NarratorContext";
import { useAutoNarrate } from "@/hooks/useAutoNarrate";
import { getVision, quickScan, visionStatusSync, type MobileSonarScan } from "@/services/vision";
import { LiveScanStore } from "@/stores/LiveScanStore";
import { useHudStream } from "@/hooks/useHudStream";

interface FishAnalysis {
  fishCount: number;
  depth: string;
  distance: string;
  species: string;
  confidence: number;
  suggestion: string;
  lure?: string;
  lureType?: string;
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
  // Live sonar specialist fields
  liveBrand?: string;
  liveMode?: string;
  targetShape?: string;
  shadowAnalysis?: string;
  targetSeparation?: string;
  bodyRatio?: string;
  structureProximity?: string;
  targetBoostActive?: boolean;
  paletteDetected?: string;
}

const H_PAD = 14;
const GAP = 14;

interface SonarBarraResult {
  isBarraArch:        boolean;
  confidence:         number;
  archCount:          number;
  estimatedDepth:     string | null;
  keyEvidence:        string;
  sonarBrand:         string;
  bottomType?:        string;
  archFeatures?:      string[];
  missingFeatures?:   string[];
  refMatchScore?:     number;
  lureRecommendation: string | null;
  refPhotosUsed:      number;
  positiveRefsUsed:   number;
  negativeRefsUsed?:  number;
  barraBodyRefsUsed?: number;
}

interface FishAnalysisForBrain {
  fishCount:  number;
  depth:      string;
  species:    string;
  confidence: number;
}

function TotalBrainAnalyser({
  cvScan,
  sonarBarra,
  analysis,
}: {
  cvScan:      import("@/services/vision").MobileSonarScan | null;
  sonarBarra:  SonarBarraResult | null;
  analysis:    FishAnalysisForBrain;
}) {
  // ── System 1 · CV ENGINE (12%) ─────────────────────────────────────────
  const cvScore: number | null = cvScan
    ? cvScan.echoStrength === "strong" ? 90
      : cvScan.echoStrength === "moderate" ? 65 : 30
    : null;
  const cvSignal = cvScore != null && cvScore >= 65;

  // ── System 2 · ARCH DETECT (15%) ──────────────────────────────────────
  const archScore: number | null = sonarBarra
    ? Math.min(100, (sonarBarra.archFeatures?.length ?? 0) * 30)
    : null;
  const archSignal = archScore != null && archScore >= 60;

  // ── System 3 · REF MATCH (13%) ────────────────────────────────────────
  const refScore: number | null = sonarBarra?.refMatchScore ?? null;
  const refSignal = refScore != null && refScore >= 60;

  // ── System 4 · SONAR BRAIN (20%) ──────────────────────────────────────
  const sbScore: number | null = sonarBarra?.confidence ?? null;
  const sbSignal = sonarBarra
    ? sonarBarra.isBarraArch && sonarBarra.confidence >= 50
    : null;

  // ── System 5 · HABITAT (10%) ──────────────────────────────────────────
  const habitatScore: number | null = sonarBarra
    ? sonarBarra.bottomType?.includes("rock") ? 90
      : sonarBarra.bottomType?.includes("reef") ? 85
      : sonarBarra.bottomType?.includes("weed") ? 75
      : sonarBarra.bottomType?.includes("sand") ? 55
      : sonarBarra.bottomType?.includes("mud") ? 50
      : 40
    : null;
  const habitatSignal = habitatScore != null && habitatScore >= 70;

  // ── System 6 · DEPTH SCAN (10%) ───────────────────────────────────────
  const depthScore: number | null = analysis
    ? analysis.fishCount > 0
      ? Math.min(90, Math.round(analysis.confidence * 0.75 + 18))
      : 28
    : null;
  const depthSignal = depthScore != null && depthScore >= 60;

  // ── System 7 · GPT-4.1 (20%) ──────────────────────────────────────────
  const gptScore  = analysis.confidence;
  const gptSignal = analysis.fishCount > 0;

  // ── Weighted brain score ────────────────────────────────────────────────
  const WEIGHTS = [0.12, 0.15, 0.13, 0.20, 0.10, 0.10, 0.20];
  const raw      = [cvScore, archScore, refScore, sbScore, habitatScore, depthScore, gptScore];
  let wSum = 0, wWt = 0;
  raw.forEach((v, i) => { if (v != null) { wSum += v * WEIGHTS[i]; wWt += WEIGHTS[i]; } });
  const brainScore = wWt > 0 ? Math.round(wSum / wWt) : 0;

  // ── Consensus (7 binary signals) ───────────────────────────────────────
  const bools = [cvSignal, archSignal, refSignal, sbSignal === true, habitatSignal, depthSignal, gptSignal];
  const yeses = bools.filter(Boolean).length;
  const ready = raw.filter(v => v != null).length;
  type CStatus = "CONFIRMED" | "PROBABLE" | "POSSIBLE" | "NOT DETECTED";
  const consensus: CStatus =
    yeses >= 5 ? "CONFIRMED"
    : yeses >= 3 ? "PROBABLE"
    : yeses >= 1 ? "POSSIBLE"
    : "NOT DETECTED";
  const cc =
    consensus === "CONFIRMED" ? "#00d4aa"
    : consensus === "PROBABLE" ? "#ffd700"
    : consensus === "POSSIBLE" ? "#ff8800"
    : "#666666";
  const scoreColor = brainScore >= 75 ? "#00d4aa" : brainScore >= 50 ? "#ffd700" : "#ff8800";

  // ── 6 upstream nodes (grid) ────────────────────────────────────────────
  const upstream: Array<{
    icon: string; label: string; color: string; wt: string;
    score: number | null; signal: boolean | null; chip?: string | null;
  }> = [
    {
      icon: "eye-circle", label: "CV\nENGINE",    color: "#00a8ff", wt: "12%",
      score: cvScore, signal: cvSignal,
      chip: cvScan ? `${cvScan.brightPixelPct.toFixed(0)}% hot` : null,
    },
    {
      icon: "wave",       label: "ARCH\nDETECT",  color: "#00d4aa", wt: "15%",
      score: archScore, signal: archSignal,
      chip: sonarBarra?.archFeatures ? `${sonarBarra.archFeatures.length} arch${sonarBarra.archFeatures.length !== 1 ? "es" : ""}` : null,
    },
    {
      icon: "compare",    label: "REF\nMATCH",    color: "#ffd700", wt: "13%",
      score: refScore, signal: refSignal,
      chip: sonarBarra ? `${sonarBarra.refPhotosUsed} refs` : null,
    },
    {
      icon: "radar",      label: "SONAR\nBRAIN",  color: "#00d4aa", wt: "20%",
      score: sbScore, signal: sbSignal,
      chip: sonarBarra?.bottomType && sonarBarra.bottomType !== "unknown"
        ? sonarBarra.bottomType : null,
    },
    {
      icon: "terrain",    label: "HABITAT",       color: "#ff8800", wt: "10%",
      score: habitatScore, signal: habitatSignal,
      chip: habitatScore != null ? `${habitatScore}% suit.` : null,
    },
    {
      icon: "arrow-collapse-down", label: "DEPTH\nSCAN", color: "#00a8ff", wt: "10%",
      score: depthScore, signal: depthSignal,
      chip: analysis.depth ?? null,
    },
  ];

  return (
    <View style={BT.card}>
      {/* Accent bar */}
      <View style={{ height: 4, backgroundColor: "#00d4aa" }} />

      {/* Header */}
      <View style={BT.header}>
        <MaterialCommunityIcons name="brain" size={18} color="#00d4aa" />
        <Text style={BT.title}>TOTAL BRAIN ANALYSIS</Text>
        <View style={[BT.scoreBadge, { backgroundColor: scoreColor + "20", borderColor: scoreColor + "50" }]}>
          <Text style={[BT.scoreBadgeText, { color: scoreColor }]}>{brainScore}%</Text>
        </View>
      </View>
      <Text style={BT.subtitle}>
        7 AI systems · {ready} active · weighted confidence consensus
      </Text>

      {/* ── 6-node upstream grid (3 × 2) ─────────────────────────────────── */}
      <View style={BT.nodeGrid}>
        {upstream.map((n, idx) => (
          <View key={idx} style={BT.nodeWrap}>
            <View style={[BT.node, { borderColor: n.score != null ? n.color : "#2a2a2a" }]}>
              <MaterialCommunityIcons
                name={n.icon as any}
                size={17}
                color={n.score != null ? n.color : "#2d2d2d"}
              />
              <Text style={[BT.nodeLabel, { color: n.score != null ? n.color : "#2d2d2d" }]}>
                {n.label}
              </Text>
              <Text style={[BT.nodeScore, { color: n.score != null ? "#ffffff" : "#2d2d2d" }]}>
                {n.score != null ? `${n.score}%` : "—"}
              </Text>
              {n.chip && n.score != null && (
                <Text style={[BT.nodeChip, { color: n.color + "aa" }]} numberOfLines={1}>
                  {n.chip}
                </Text>
              )}
            </View>
            <Text style={[BT.nodeWeight, { color: n.score != null ? n.color + "60" : "#2a2a2a" }]}>
              {n.wt}
            </Text>
          </View>
        ))}
      </View>

      {/* ── Funnel arrow into GPT-4.1 ────────────────────────────────────── */}
      <View style={BT.funnelRow}>
        <View style={BT.funnelLine} />
        <MaterialCommunityIcons name="arrow-down-circle" size={20} color="#00d4aa30" />
        <View style={BT.funnelLine} />
      </View>

      {/* ── GPT-4.1 master node (full-width) ─────────────────────────────── */}
      <View style={BT.masterWrap}>
        <View style={[BT.masterNode, { borderColor: "#7c5cfc" }]}>
          <View style={BT.masterInner}>
            <MaterialCommunityIcons name="chip" size={22} color="#7c5cfc" />
            <View style={{ flex: 1 }}>
              <Text style={[BT.masterLabel, { color: "#7c5cfc" }]}>GPT-4.1  MASTER ANALYSIS</Text>
              <Text style={BT.masterSub}>Full sonar intelligence · 20% weight</Text>
            </View>
            <Text style={[BT.masterScore, { color: gptSignal ? "#ffffff" : "#555" }]}>
              {gptScore}%
            </Text>
          </View>
        </View>
      </View>

      {/* Brain score bar */}
      <View style={BT.scoreBarWrap}>
        <View style={BT.scoreBarTrack}>
          <View style={[BT.scoreBarFill, { width: `${brainScore}%` as any, backgroundColor: scoreColor }]} />
        </View>
        <Text style={[BT.scoreBarLabel, { color: scoreColor }]}>BRAIN SCORE  {brainScore}%</Text>
      </View>

      {/* Verdict rows */}
      <View style={BT.verdictList}>
        {cvScan && (
          <View style={BT.verdictRow}>
            <View style={[BT.verdictDot, { backgroundColor: cvSignal ? "#00a8ff" : "#555" }]} />
            <Text style={BT.verdictSys}>CV ENGINE</Text>
            <Text style={[BT.verdictVal, { color: cvSignal ? "#00a8ff" : "#666" }]}>
              {cvSignal ? `✓ ${cvScan.echoStrength.toUpperCase()} ECHO` : "○ WEAK ECHO"}
            </Text>
            <Text style={[BT.verdictChip, { color: "#00a8ff", borderColor: "#00a8ff25", backgroundColor: "#00a8ff0d" }]}>
              {cvScan.brightPixelPct.toFixed(0)}% hot
            </Text>
          </View>
        )}
        {sonarBarra && (
          <>
            <View style={BT.verdictRow}>
              <View style={[BT.verdictDot, { backgroundColor: archSignal ? "#00d4aa" : "#555" }]} />
              <Text style={BT.verdictSys}>ARCH DETECT</Text>
              <Text style={[BT.verdictVal, { color: archSignal ? "#00d4aa" : "#666" }]}>
                {archSignal
                  ? `✓ ${sonarBarra.archFeatures?.length ?? 0} ARCH FEATURES`
                  : sonarBarra.archFeatures?.length
                  ? `⚠ ${sonarBarra.archFeatures.length} WEAK`
                  : "✗ NO ARCH FEATURES"}
              </Text>
            </View>
            {refScore != null && (
              <View style={BT.verdictRow}>
                <View style={[BT.verdictDot, { backgroundColor: refSignal ? "#ffd700" : "#555" }]} />
                <Text style={BT.verdictSys}>REF MATCH</Text>
                <Text style={[BT.verdictVal, { color: refSignal ? "#ffd700" : "#666" }]}>
                  {refSignal ? `✓ ${refScore}% REFERENCE MATCH` : `○ ${refScore}% MATCH`}
                </Text>
                <Text style={[BT.verdictChip, { color: "#ffd700", borderColor: "#ffd70025", backgroundColor: "#ffd7000d" }]}>
                  {sonarBarra.refPhotosUsed} refs
                </Text>
              </View>
            )}
            <View style={BT.verdictRow}>
              <View style={[BT.verdictDot, { backgroundColor: sbSignal ? "#00d4aa" : "#555" }]} />
              <Text style={BT.verdictSys}>SONAR BRAIN</Text>
              <Text style={[BT.verdictVal, { color: sbSignal ? "#00d4aa" : "#666" }]}>
                {sbSignal ? "✓ BARRA ARCHES"
                 : sonarBarra.isBarraArch ? "⚠ LOW CONFIDENCE"
                 : "✗ NO ARCHES"}
              </Text>
              {sonarBarra.bottomType && sonarBarra.bottomType !== "unknown" && (
                <Text style={[BT.verdictChip, { color: "#00d4aa", borderColor: "#00d4aa25", backgroundColor: "#00d4aa0d" }]}>
                  {sonarBarra.bottomType}
                </Text>
              )}
            </View>
            {habitatScore != null && sonarBarra.bottomType && (
              <View style={BT.verdictRow}>
                <View style={[BT.verdictDot, { backgroundColor: habitatSignal ? "#ff8800" : "#555" }]} />
                <Text style={BT.verdictSys}>HABITAT</Text>
                <Text style={[BT.verdictVal, { color: habitatSignal ? "#ff8800" : "#666" }]}>
                  {habitatSignal
                    ? `✓ PRIME ${sonarBarra.bottomType.toUpperCase()}`
                    : `○ ${sonarBarra.bottomType.toUpperCase()}`}
                </Text>
                <Text style={[BT.verdictChip, { color: "#ff8800", borderColor: "#ff880025", backgroundColor: "#ff88000d" }]}>
                  {habitatScore}% suit.
                </Text>
              </View>
            )}
          </>
        )}
        <View style={BT.verdictRow}>
          <View style={[BT.verdictDot, { backgroundColor: depthSignal ? "#00a8ff" : "#555" }]} />
          <Text style={BT.verdictSys}>DEPTH SCAN</Text>
          <Text style={[BT.verdictVal, { color: depthSignal ? "#00a8ff" : "#666" }]}>
            {depthSignal
              ? `✓ FISH AT ${analysis.depth}`
              : analysis.fishCount === 0 ? "✗ EMPTY WATER COLUMN"
              : `○ ${analysis.depth}`}
          </Text>
        </View>
        <View style={BT.verdictRow}>
          <View style={[BT.verdictDot, { backgroundColor: gptSignal ? "#7c5cfc" : "#555" }]} />
          <Text style={BT.verdictSys}>GPT-4.1</Text>
          <Text style={[BT.verdictVal, { color: gptSignal ? "#7c5cfc" : "#666" }]}>
            {gptSignal
              ? `✓ ${analysis.fishCount} FISH @ ${analysis.depth}`
              : "✗ NONE DETECTED"}
          </Text>
          <Text style={[BT.verdictChip, { color: "#7c5cfc", borderColor: "#7c5cfc25", backgroundColor: "#7c5cfc0d" }]}>
            {gptScore}% conf
          </Text>
        </View>
      </View>

      {/* Consensus banner */}
      <View style={[BT.consensusBar, { backgroundColor: cc + "18", borderColor: cc + "44" }]}>
        <MaterialCommunityIcons
          name={
            consensus === "CONFIRMED" ? "check-circle"
            : consensus === "PROBABLE" ? "alert-circle"
            : consensus === "POSSIBLE" ? "help-circle"
            : "close-circle"
          }
          size={18}
          color={cc}
        />
        <Text style={[BT.consensusLabel, { color: cc }]}>
          {consensus === "CONFIRMED" ? `ALL ${yeses} SYSTEMS AGREE`
           : consensus === "PROBABLE" ? `${yeses} OF 7 SYSTEMS AGREE`
           : consensus === "POSSIBLE" ? `${yeses} SYSTEM${yeses !== 1 ? "S" : ""} POSITIVE`
           : "NO FISH SIGNAL DETECTED"}
        </Text>
        <Text style={[BT.consensusBadge, { color: cc }]}>{consensus}</Text>
      </View>
    </View>
  );
}

const BT = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#00d4aa30",
    backgroundColor: "#060e1c",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  title: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Oswald_700Bold",
    color: "#00d4aa",
    letterSpacing: 1.5,
  },
  scoreBadge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  scoreBadgeText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "#ffffff40",
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  // ── 6-node upstream grid ─────────────────────────────────────────────
  nodeGrid: {
    flexDirection:    "row",
    flexWrap:         "wrap",
    justifyContent:   "space-between",
    paddingHorizontal: 12,
    paddingBottom:    10,
    gap:              8,
  },
  nodeWrap: {
    width:      "30%",
    alignItems: "center",
    gap:        4,
  },
  node: {
    width:           "100%",
    alignItems:      "center",
    paddingVertical:  8,
    borderRadius:    10,
    borderWidth:     1.5,
    backgroundColor: "#0b1520",
    gap:             2,
  },
  nodeLabel: {
    fontSize:      7,
    fontFamily:    "Inter_700Bold",
    letterSpacing: 0.3,
    textAlign:     "center",
  },
  nodeScore: {
    fontSize:   15,
    fontFamily: "Oswald_700Bold",
  },
  nodeChip: {
    fontSize:   7,
    fontFamily: "Inter_400Regular",
    marginTop:  1,
  },
  nodeWeight: {
    fontSize:   8,
    fontFamily: "Inter_400Regular",
  },
  // ── Funnel arrow ──────────────────────────────────────────────────────
  funnelRow: {
    flexDirection:    "row",
    alignItems:       "center",
    paddingHorizontal: 24,
    paddingVertical:   4,
    gap:              4,
  },
  funnelLine: {
    flex:            1,
    height:          1,
    backgroundColor: "#00d4aa18",
  },
  // ── GPT-4.1 master node ───────────────────────────────────────────────
  masterWrap: {
    paddingHorizontal: 12,
    paddingBottom:     12,
  },
  masterNode: {
    borderRadius:    12,
    borderWidth:     1.5,
    backgroundColor: "#0b1520",
    padding:         12,
  },
  masterInner: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           10,
  },
  masterLabel: {
    fontSize:      11,
    fontFamily:    "Inter_700Bold",
    letterSpacing: 0.5,
  },
  masterSub: {
    fontSize:   9,
    fontFamily: "Inter_400Regular",
    color:      "#7c5cfc60",
    marginTop:  1,
  },
  masterScore: {
    fontSize:   24,
    fontFamily: "Oswald_700Bold",
  },
  scoreBarWrap: {
    paddingHorizontal: 16,
    paddingBottom: 0,
    gap: 5,
    borderTopWidth: 1,
    borderTopColor: "#ffffff0d",
    paddingTop: 12,
  },
  scoreBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#ffffff12",
    overflow: "hidden",
  },
  scoreBarFill: {
    height: 6,
    borderRadius: 3,
  },
  scoreBarLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
    textAlign: "right",
    paddingBottom: 12,
  },
  verdictList: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 9,
    borderTopWidth: 1,
    borderTopColor: "#ffffff0d",
    paddingTop: 12,
  },
  verdictRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  verdictDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    flexShrink: 0,
  },
  verdictSys: {
    width: 86,
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    color: "#ffffff50",
    letterSpacing: 0.6,
  },
  verdictVal: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },
  verdictChip: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    letterSpacing: 0.2,
  },
  consensusBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    margin: 12,
    marginTop: 0,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  consensusLabel: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.4,
  },
  consensusBadge: {
    fontSize: 11,
    fontFamily: "Oswald_700Bold",
    letterSpacing: 1.2,
  },
});

/** Ensure any picked image (WebP, HEIF, etc) is re-encoded as JPEG before upload */
async function toJpeg(uri: string): Promise<{ uri: string; base64: string }> {
  const result = await manipulateAsync(uri, [], { format: SaveFormat.JPEG, compress: 0.82, base64: true });
  return { uri: result.uri, base64: result.base64 ?? "" };
}

// ─── Boat mode short commentary (5-8 seconds ≈ 12-20 words) ─────────────────
const BOAT_SLANG: Record<string, string> = {
  barramundi: "barra", "mangrove jack": "jack",
  "spanish mackerel": "spaniard", "giant trevally": "GT",
  "coral trout": "coral", queenfish: "queenie",
  "threadfin salmon": "threadie", "king threadfin": "threadie",
  "black jewfish": "jewie", jewfish: "jewie",
  "red emperor": "emperor",
};
function boatNick(raw: string) {
  const s = raw.replace(/\s*\(\d+%\)/, "").toLowerCase();
  for (const [k, v] of Object.entries(BOAT_SLANG)) if (s.includes(k)) return v;
  return raw.replace(/\s*\(\d+%\)/, "");
}
function buildBoatSummary(scans: FishAnalysis[], character: NarratorCharacter): string {
  const total = scans.reduce((s, a) => s + a.fishCount, 0);
  const blanks = scans.filter(a => a.fishCount === 0).length;

  // Top species by fish count
  const tally: Record<string, number> = {};
  for (const a of scans) if (a.fishCount > 0) {
    const k = boatNick(a.species);
    tally[k] = (tally[k] ?? 0) + a.fishCount;
  }
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "fish";
  const speciesCount = Object.keys(tally).length;

  // Depth range — parseFloat handles "4.2m", "3.0m (estimated)" etc.
  const depths = scans.map(a => parseFloat(a.depth)).filter(d => !isNaN(d) && d > 0);
  const minD = depths.length ? Math.min(...depths).toFixed(1) : null;
  const maxD = depths.length ? Math.max(...depths).toFixed(1) : null;
  const depthStr = (minD && maxD && minD !== maxD) ? `${minD}–${maxD}m` : minD ? `${minD}m` : "various depths";

  // Trend: first 5 vs last 5
  const first5 = scans.slice(0, 5).reduce((s, a) => s + a.fishCount, 0);
  const last5  = scans.slice(5).reduce((s, a)  => s + a.fishCount, 0);
  const trend  = last5 > first5 + 2 ? "on the rise" : last5 < first5 - 2 ? "dropping off" : "holding steady";

  // Blank-scan advice
  const moveAdvice   = blanks >= 7 ? "Strongly recommend moving to a new spot." : blanks >= 4 ? "Might be worth trying a different area." : "";
  const stayAdvice   = blanks < 4 ? (trend === "on the rise" ? "Activity is building — stay put and keep at it." : "Fish are sitting here — keep working the area.") : "";
  const advice = moveAdvice || stayAdvice;

  const mixNote = speciesCount > 1 ? ` Mixed species showing — ${top} dominating.` : "";

  switch (character) {
    case "BENAUD":
      return `Ten scans complete and the picture is becoming clear. ${total} fish observed in total, predominantly ${top} ranging between ${depthStr}. Activity is ${trend}${mixNote} ${blanks >= 5 ? "Several blank passes suggest repositioning may be wise." : "The signs are genuinely encouraging."} ${advice}`;
    case "CHOPPER":
      return `Alright listen up — ten scans done ya mugs. ${total} fish counted, mostly ${top} sitting at ${depthStr}, activity's ${trend}.${mixNote} ${blanks >= 5 ? "Too many blanks — move the bloody boat now." : "She's still firing, keep at it."} ${advice}`;
    case "ATTENBOROUGH":
      return `After ten extraordinary scans of these ancient waters, we document ${total} fish in total — primarily ${top} — inhabiting depths of ${depthStr}. Activity is ${trend}${mixNote} ${blanks >= 5 ? "The blanks suggest these creatures have ventured elsewhere." : "These waters continue to reward the patient observer."} ${advice}`;
    case "WIFE":
      return `Okay, ten scans. You found ${total} fish — mainly ${top} at ${depthStr} if you must know. Activity is ${trend}.${mixNote} ${blanks >= 5 ? "Mostly blank — maybe actually move the boat this time?" : "Not bad I suppose, for once."} ${advice}`;
    default:
      return `Ten scan summary mate — ${total} fish total, mostly ${top} between ${depthStr}. Activity's ${trend} across the session.${mixNote} ${blanks >= 5 ? "Heaps of blanks though — reckon it's time to shift spots." : "Fish are definitely here, crack on!"} ${advice}`;
  }
}

function buildBoatSpeech(a: FishAnalysis, character: NarratorCharacter): string {
  const nick = boatNick(a.species);
  const n    = a.fishCount;
  if (n === 0) {
    switch (character) {
      case "BENAUD":       return "Nothing on the sonar. We must look elsewhere.";
      case "CHOPPER":      return "Sweet FA on the sonar, ya mug. Move the boat.";
      case "ATTENBOROUGH": return "The depths reveal nothing. We must seek them elsewhere.";
      case "WIFE":         return "Nothing. I told you to move the boat.";
      default:             return "Sonar's blank mate. Chuck it somewhere else.";
    }
  }
  const fish = n === 1 ? `one ${nick}` : `${n} ${nick}`;
  switch (character) {
    case "BENAUD":       return `${fish} at ${a.depth}, ${a.distance}. Marvellous.`;
    case "CHOPPER":      return `${fish} showing — ${a.depth}. Get in there, deadset.`;
    case "ATTENBOROUGH": return `${fish} detected at ${a.depth}. Remarkable.`;
    case "WIFE":         return `${fish} at ${a.depth}. Don't stuff it up.`;
    default:             return `${fish} at ${a.depth}, ${a.distance}. Get into 'em!`;
  }
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addEntry } = useHistory();
  const { autoSpeak, speak, character, stop: stopSpeaking } = useNarrator();
  const hud = useHudStream();

  useAutoNarrate(() => "Sonar Analyser. Load a photo of your sonar screen, or tap the camera button to scan and get instant AI fish detection.");

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<FishAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamChars, setStreamChars] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [imageLayout, setImageLayout] = useState({ width: 360, height: 240 });
  const [scanSource, setScanSource] = useState<'manual' | 'live' | 'boat'>('manual');
  const scanSourceRef = useRef<'manual' | 'live' | 'boat'>('manual');
  const [boatActive, setBoatActive] = useState(false);
  // Previous scan — shown below scanner while the next image is being analysed
  const [prevAnalysis, setPrevAnalysis] = useState<FishAnalysis | null>(null);
  const [prevImageUri, setPrevImageUri] = useState<string | null>(null);

  // 10-scan summary
  const boatHistoryRef   = useRef<FishAnalysis[]>([]);
  const [summaryText, setSummaryText] = useState<string | null>(null);

  // ── Screen brightness — max while analysing, restore when done ────────────
  const prevBrightnessRef = useRef<number | null>(null);
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (loading) {
      Brightness.getBrightnessAsync()
        .then((b) => { prevBrightnessRef.current = b; })
        .catch(() => {});
      Brightness.setBrightnessAsync(1.0).catch(() => {});
    } else {
      if (prevBrightnessRef.current !== null) {
        Brightness.setBrightnessAsync(prevBrightnessRef.current).catch(() => {});
        prevBrightnessRef.current = null;
      }
    }
  }, [loading]);

  // ── Sonar Brain — Stage-1 fast barra arch detector ────────────────────────
  const [sonarBarraResult, setSonarBarraResult] = useState<SonarBarraResult | null>(null);
  const [sonarBarraLoading, setSonarBarraLoading] = useState(false);
  // ── Flash scan — gpt-4.1-mini instant first read (~0.8-1.5 s) ──────────────
  const [flashResult, setFlashResult] = useState<{
    species: string; fishCount: number; confidence: number; quickRead: string;
  } | null>(null);
  // ── Dual-scan consensus (scan 2 runs in background, appended as __SCAN2__ token) ──
  const [scan2Consensus, setScan2Consensus] = useState<{
    agreed: boolean; species2: string | null; confidence2: number | null;
  } | null>(null);
  const autoAnalyzeRef = useRef(false);
  const [liveSonarMode, setLiveSonarMode] = useState(false);
  const liveSonarModeRef = useRef(false);

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

  // ── LiveScanStore subscription — receives images from Live Camera tab ──────
  // Boat mode timer keeps running in Live tab; we display results here.
  useEffect(() => {
    setBoatActive(LiveScanStore.boatActive);
    const unsub = LiveScanStore.subscribe((payload) => {
      setBoatActive(LiveScanStore.boatActive);
      setScanSource(payload.source);
      scanSourceRef.current = payload.source;
      // Snapshot the current result so the user can see it while the next scan runs
      setAnalysis((prev) => { if (prev) setPrevAnalysis(prev); return null; });
      setImageUri((prev) => { if (prev) setPrevImageUri(prev); return payload.uri; });
      setImageBase64(payload.base64);
      setSonarBarraResult(null);
      setError(null);
      autoAnalyzeRef.current = true;
      locationPromiseRef.current = getNTLocationName(10_000);
      LiveScanStore.clear();
    });
    return unsub;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cameraScale = useSharedValue(1);
  const galleryScale = useSharedValue(1);
  const analyzeScale = useSharedValue(1);
  const scanLine     = useSharedValue(-8);
  const dotOpacity   = useSharedValue(1);
  const progressBar  = useSharedValue(0);

  const animatedCameraStyle  = useAnimatedStyle(() => ({ transform: [{ scale: cameraScale.value }] }));
  const animatedGalleryStyle = useAnimatedStyle(() => ({ transform: [{ scale: galleryScale.value }] }));
  const animatedAnalyzeStyle = useAnimatedStyle(() => ({ transform: [{ scale: analyzeScale.value }] }));
  const scanLineStyle = useAnimatedStyle(() => ({ top: scanLine.value }));
  const dotStyle      = useAnimatedStyle(() => ({ opacity: dotOpacity.value }));
  const progressStyle = useAnimatedStyle(() => ({ width: `${progressBar.value}%` as any }));

  // ── Scan animations (sweep line + dot blink + progress bar) ─────────────────
  useEffect(() => {
    if (loading) {
      scanLine.value    = -8;
      dotOpacity.value  = 1;
      progressBar.value = 4;
      scanLine.value    = withRepeat(
        withTiming(268, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        -1, true
      );
      dotOpacity.value  = withRepeat(
        withSequence(
          withTiming(0.15, { duration: 450 }),
          withTiming(1,    { duration: 450 })
        ),
        -1
      );
    } else {
      scanLine.value    = -8;
      dotOpacity.value  = 1;
      progressBar.value = 0;
    }
  }, [loading]);

  // Update progress bar from stream chars
  useEffect(() => {
    if (!loading) return;
    const pct = streaming ? Math.min(95, 10 + Math.round((streamChars / 680) * 82)) : 8;
    progressBar.value = withTiming(pct, { duration: 400 });
  }, [streaming, streamChars, loading]);

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
    setScan2Consensus(null);
    setFlashResult(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // ── Sonar validate fires concurrently with the main analyze call ──────────
    // Both start simultaneously. If validate returns false BEFORE the main call's
    // response headers arrive, we abort the main call immediately. If the main
    // call's headers arrive first (streaming started) validate result is ignored.
    const domain  = process.env.EXPO_PUBLIC_DOMAIN;
    const baseUrl = domain ? `https://${domain}` : "";
    const analyzeAbort = new AbortController();

    const validatePromise: Promise<{ isSonar: boolean; reason?: string | null } | null> = (async () => {
      try {
        const r = await fetch(`${baseUrl}/api/sonar-validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64 }),
        });
        return r.ok ? (await r.json()) as { isSonar: boolean; reason?: string | null } : null;
      } catch { return null; }
    })();

    // Race: if validate resolves with isSonar:false before main headers, abort main
    validatePromise.then(v => {
      if (v && !v.isSonar) analyzeAbort.abort();
    });

    // ── Sonar Brain Stage-1: fire sonar-barra-check in parallel ──────────────
    // Resolves in ~600ms — shows BARRA ARCH verdict while full analysis streams
    // Skipped for live sonar mode — arch detection doesn't apply to real-time imaging
    if (!liveSonarModeRef.current) {
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
    } else {
      setSonarBarraLoading(false);
    }

    try {
      let response: Response;
      try {
        response = await fetch(`${baseUrl}${liveSonarModeRef.current ? '/api/live-sonar-analyze' : '/api/analyze'}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64 }),
          signal: analyzeAbort.signal,
        });
      } catch (fetchErr: any) {
        if (fetchErr?.name === "AbortError") {
          // Validate aborted the main call — show the rejection reason
          const vResult = await validatePromise;
          if (vResult && !vResult.isSonar) {
            const why = vResult.reason ?? "Please photograph your sonar / fish finder screen.";
            setError(`Not a sonar image — ${why}`);
            setSonarBarraLoading(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          }
          return;
        }
        throw fetchErr;
      }
      if (!response.ok) {
        let errMsg = "Analysis failed. Please try again.";
        try { const b = await response.json(); if (b?.error) errMsg = b.error; } catch { /* noop */ }
        throw new Error(errMsg);
      }

      // ── Streaming read ────────────────────────────────────────────────────────
      // __FLASH__ arrives in ~0.8-1.5s (gpt-4.1-mini, raw image only).
      // Full dual-scan (gpt-4.1 with crops + refs) follows ~3-5s later.
      let accumulated = "";
      let flashParsed = false;
      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        setStreaming(true);
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            accumulated += chunk;
            setStreamChars(accumulated.length);
            // Parse flash result the moment it arrives — show instant banner
            if (!flashParsed && accumulated.includes("__FLASH__:")) {
              const fm = accumulated.match(/__FLASH__:(\{[^\n]+\})/);
              if (fm) {
                try {
                  const fd = JSON.parse(fm[1]);
                  if (fd.species) {
                    setFlashResult(fd);
                    const isBarra = (fd.species as string).toLowerCase().includes("barramundi");
                    if (isBarra && (fd.confidence ?? 0) >= 0.55) {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 350);
                    }
                  }
                } catch { /* silent */ }
                flashParsed = true;
              }
            }
          }
        } catch (streamErr: any) {
          if (accumulated.length < 20) {
            throw new Error("Connection dropped — please try again.");
          }
        } finally {
          try { reader.cancel(); } catch { /* ignore */ }
          setStreaming(false);
        }
      } else {
        // Fallback for environments without ReadableStream
        accumulated = await response.text();
      }

      // ── Strip flash prefix line before JSON parsing ────────────────────────
      accumulated = accumulated.replace(/__FLASH__:[^\n]*\n?/, "");

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

      // ── Extract dual-scan consensus token ─────────────────────────────────
      const scan2Suffix = accumulated.match(/\n__SCAN2__:(\{[^\n]+\})/);
      if (scan2Suffix) {
        try {
          const s2 = JSON.parse(scan2Suffix[1]) as {
            agreed: boolean; species2: string | null; confidence2: number | null;
          };
          setScan2Consensus(s2);
        } catch { /* silent */ }
        accumulated = accumulated.replace(/\n__SCAN2__:[^\n]*/, "");
      }

      const cleaned = accumulated.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        const fr = flashResult;
        if (fr?.species && (fr.confidence ?? 0) >= 0.40) {
          setCvRegions([]);
          setAnalysis({
            species:    fr.species,
            confidence: Math.round((fr.confidence ?? 0) * 100),
            fishCount:  fr.fishCount ?? 0,
            depth:      "—",
            distance:   "—",
            suggestion: fr.quickRead ?? "Re-scan for full lure advice — connection was unstable.",
          } as FishAnalysis);
          setFlashResult(null);
          return;
        }
        throw new Error("No response from AI — please try again.");
      }
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
      setFlashResult(null); // full analysis arrived — dismiss flash banner

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

      // ── Auto-teach Sonar Brain: high-confidence scans feed the collective ──
      // Fires when GPT-4.1 is ≥75% confident AND at least 1 fish was detected.
      // This is a fire-and-forget background call — never blocks the user.
      if ((data.confidence ?? 0) >= 75 && (data.fishCount ?? 0) > 0 && imageBase64) {
        const brainDomain = process.env.EXPO_PUBLIC_DOMAIN;
        const brainBase   = brainDomain ? `https://${brainDomain}` : "";
        const scanDate    = new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
        fetch(`${brainBase}/api/sonar-brain/submit`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64,
            depth:       data.depth ?? null,
            fishCount:   data.fishCount ?? 0,
            description: `Auto-learn: ${data.species} — ${data.confidence}% confidence — ${data.fishCount} fish — depth ${data.depth ?? "?"} — ${scanDate}`,
          }),
        }).catch(() => {/* silent — Sonar Brain submission is non-critical */});
      }

      // ── CROC ALERT — native dialog fires immediately ──────────────────────
      if (data.crocAlert) {
        Alert.alert(
          "🐊 CROCODILE DETECTED",
          data.crocWarning
            ? `${data.crocWarning}\n\n🚨 CROC SAFETY\n• Stay 5m back from the water's edge\n• Do NOT enter the water or lean over the side\n• Saltwater crocs can be submerged and unseen\n• Relocate immediately`
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
      // Narrate the result summary for manual scans only;
      // boat/live mode narrates via the dedicated useEffect below to avoid double-speak.
      if (scanSourceRef.current === 'manual') {
        autoSpeak(
          `Scan complete. ${data.fishCount} fish detected at ${data.depth}. ` +
          `Species: ${data.species}. Confidence ${data.confidence} percent. ${data.suggestion}`
        );
      }
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
      // ── Push result to smart-glass HUD (fire-and-forget) ───────────────────
      hud.push({
        species:    data.species    ?? "—",
        fishCount:  data.fishCount  ?? 0,
        depth:      data.depth      ?? "—",
        confidence: (data.confidence ?? 0) / 100,
        suggestion: data.suggestion ?? "",
        sonarMode:  data.sonarMode  ?? null,
        waterTemp:  data.waterTemp,
        bottomType: data.bottomType,
        lure:       data.lure,
        crocAlert:  data.crocAlert  ?? false,
        crocWarning:data.crocWarning ?? null,
        source:     LiveScanStore.boatActive ? "boat" : "live",
      });
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
  }, [imageBase64, imageUri, addEntry, analyzeScale, autoSpeak, hud.push]);

  // Auto-analyse when a demo image is injected from the Demo tab
  useEffect(() => {
    if (autoAnalyzeRef.current && imageBase64) {
      autoAnalyzeRef.current = false;
      analyzeImage();
    }
  }, [imageBase64, analyzeImage]);

  // Speak commentary when a boat/live mode result arrives;
  // every 10th boat scan delivers a 15-second overall summary instead.
  useEffect(() => {
    if (!analysis || (scanSource !== 'boat' && scanSource !== 'live')) return;

    if (scanSource === 'boat') {
      boatHistoryRef.current = [...boatHistoryRef.current, analysis];

      if (boatHistoryRef.current.length >= 10) {
        const summary = buildBoatSummary(boatHistoryRef.current, character);
        boatHistoryRef.current = [];
        setSummaryText(summary);
        if (autoSpeak) {
          stopSpeaking();
          speak(summary);
        }
      } else {
        if (autoSpeak) {
          stopSpeaking();
          speak(buildBoatSpeech(analysis, character));
        }
      }
    } else {
      if (autoSpeak) {
        stopSpeaking();
        speak(buildBoatSpeech(analysis, character));
      }
    }
  }, [analysis, scanSource]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear scan history and summary when boat mode stops
  useEffect(() => {
    if (!boatActive) {
      boatHistoryRef.current = [];
      setSummaryText(null);
    }
  }, [boatActive]);

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

        {/* ── Back button ── */}
        {!boatActive && (
          <TouchableOpacity
            onPress={() => {
              setImageUri(null); setImageBase64(null);
              setAnalysis(null); setError(null);
              setLoading(false); setStreaming(false); setStreamChars(0);
              setSonarBarraResult(null); setSonarBarraLoading(false);
              setScan2Consensus(null); setFlashResult(null);
              setCompareCard(null); setCompareExp(null);
              setCapturedLocation(null); setCvScan(null); setCvRegions([]);
              locationPromiseRef.current = null;
            }}
            activeOpacity={0.7}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: 4, paddingHorizontal: 2 }}
          >
            <Feather name="arrow-left" size={18} color="#00d4aa" />
            <Text style={{ color: "#00d4aa", fontSize: 14, fontWeight: "600" }}>Back</Text>
          </TouchableOpacity>
        )}

        {/* ── Boat mode + source banner ── */}
        {(boatActive || scanSource !== 'manual') && (
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: boatActive ? "#aaff0018" : "#00d4aa18",
            borderWidth: 1,
            borderColor: boatActive ? "#aaff0055" : "#00d4aa55",
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 8,
            gap: 8,
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 16 }}>{boatActive ? "⚓" : "📷"}</Text>
              <Text style={{ color: boatActive ? "#aaff00" : "#00d4aa", fontWeight: "700", fontSize: 13, letterSpacing: 0.5 }}>
                {boatActive ? "BOAT MODE ACTIVE" : scanSource === 'live' ? "LIVE CAM SCAN" : "SCAN"}
              </Text>
            </View>
            {boatActive && (
              <Text style={{ color: "#aaff00aa", fontSize: 11 }}>
                Auto-scanning every 40s · Results stream in real time
              </Text>
            )}
          </View>
        )}

        {/* ── Live Sonar mode badge (visible when active) ── */}
        {liveSonarMode && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#ff9a0012", borderWidth: 1, borderColor: "#ff9a0038", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}>
            <Text style={{ fontSize: 15 }}>⚡</Text>
            <Text style={{ color: "#ff9a00", fontFamily: "Inter_700Bold", fontSize: 13, letterSpacing: 0.5, flex: 1 }}>LIVE SONAR MODE</Text>
            {!loading && (
              <TouchableOpacity onPress={() => { setLiveSonarMode(false); liveSonarModeRef.current = false; }} activeOpacity={0.7}>
                <Text style={{ color: "#ff9a0070", fontSize: 11, fontFamily: "Inter_500Medium" }}>Switch to 2D</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Sonar image + AI interpretation overlay ── */}
        <View
          style={[styles.imageContainer, { borderColor: loading ? colors.primary + "88" : analysis?.crocAlert ? "#ff1744" : liveSonarMode ? "#ff9a0055" : colors.border }]}
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

          {/* Animated scan sweep line */}
          {loading && (
            <>
              <View style={styles.scanDimmer} />
              <Animated.View style={[styles.scanSweepLine, scanLineStyle]} />
              <View style={styles.scanSweepGlow} />
            </>
          )}
        </View>

        {/* ── ANALYSING CARD ── */}
        {loading && (
          <View style={[styles.analysingCard, { backgroundColor: colors.card, borderColor: "#00d4aa44" }]}>
            {/* Header */}
            <View style={styles.analysingHeader}>
              <Animated.View style={[styles.analysingDot, dotStyle]} />
              <Text style={styles.analysingTitle}>ANALYSING</Text>
              <Text style={[styles.analysingEngine, { color: colors.mutedForeground }]}>GPT-4.1 Vision</Text>
            </View>

            {/* Stage steps */}
            <View style={styles.analysingStages}>
              <View style={styles.analysingStageRow}>
                <View style={[styles.stageDot, { backgroundColor: "#00d4aa" }]} />
                <Text style={[styles.stageLabel, { color: "#00d4aa" }]}>✓ Sonar image verified</Text>
              </View>
              <View style={styles.analysingStageRow}>
                <View style={[styles.stageDot, { backgroundColor: "#00d4aa" }]} />
                <Text style={[styles.stageLabel, { color: "#00d4aa" }]}>Image uploaded</Text>
              </View>
              <View style={styles.analysingStageRow}>
                <View style={[styles.stageDot, { backgroundColor: "#00d4aa" }]} />
                <Text style={[styles.stageLabel, { color: "#00d4aa" }]}>CV engine scanning arches</Text>
              </View>
              <View style={styles.analysingStageRow}>
                <Animated.View style={[styles.stageDot, dotStyle, { backgroundColor: streaming ? "#00d4aa" : "#ff8800" }]} />
                <Text style={[styles.stageLabel, { color: streaming ? "#00d4aa" : "#ff8800" }]}>
                  {streaming ? `AI reading sonar… ${Math.min(99, Math.round((streamChars / 680) * 100))}%` : "GPT-4.1 reading sonar…"}
                </Text>
              </View>
              <View style={[styles.analysingStageRow, { opacity: streaming ? 0.4 : 0.25 }]}>
                <View style={[styles.stageDot, { backgroundColor: "#ffffff40" }]} />
                <Text style={[styles.stageLabel, { color: "#ffffff40" }]}>Building report</Text>
              </View>
            </View>

            {/* ⚡ Flash instant read — appears ~1s before full analysis */}
            {flashResult && (() => {
              const isBigBarra = !!flashResult.species?.toLowerCase().includes("barramundi")
                && (flashResult.confidence ?? 0) >= 0.55;
              return (
                <View style={[styles.flashBanner, isBigBarra ? styles.flashBannerHot : undefined]}>
                  {isBigBarra ? (
                    <>
                      <Text style={styles.flashHotBadge}>🎣 BARRAMUNDI DETECTED</Text>
                      <Text style={styles.flashHotSpecies}>{Math.round((flashResult.confidence ?? 0) * 100)}% CONFIDENT</Text>
                      {flashResult.fishCount > 0 && (
                        <Text style={styles.flashHotCount}>{flashResult.fishCount} fish on screen</Text>
                      )}
                      {!!flashResult.quickRead && (
                        <Text style={styles.flashQuick}>{flashResult.quickRead}</Text>
                      )}
                      <Text style={styles.flashHotAction}>GET READY TO CAST — full analysis coming…</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.flashBadge}>⚡ INSTANT READ</Text>
                      <Text style={styles.flashSpecies}>{flashResult.species}</Text>
                      <View style={styles.flashRow}>
                        {flashResult.fishCount > 0 && (
                          <Text style={styles.flashChip}>{flashResult.fishCount} fish</Text>
                        )}
                        <Text style={styles.flashChip}>{Math.round((flashResult.confidence ?? 0) * 100)}% conf</Text>
                      </View>
                      {!!flashResult.quickRead && (
                        <Text style={styles.flashQuick}>{flashResult.quickRead}</Text>
                      )}
                      <Text style={styles.flashSub}>Full analysis arriving…</Text>
                    </>
                  )}
                </View>
              );
            })()}

            {/* Progress bar */}
            <View style={[styles.progressTrack, { backgroundColor: colors.secondary }]}>
              <Animated.View style={[styles.progressFill, progressStyle]} />
            </View>
            <Text style={[styles.analysingHint, { color: colors.mutedForeground }]}>
              Species · depth · lure advice · croc check · arch analysis
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

                {/* Arch features detected */}
                {(sonarBarraResult.archFeatures?.length ?? 0) > 0 && (
                  <View style={styles.sonarFeatureSection}>
                    <Text style={styles.sonarFeatureSectionLabel}>
                      ARCH FEATURES DETECTED ({sonarBarraResult.archFeatures!.length})
                    </Text>
                    <View style={styles.sonarPillRow}>
                      {sonarBarraResult.archFeatures!.map((f, i) => (
                        <View key={i} style={[styles.sonarPill, { borderColor: "#00d4aa40", backgroundColor: "#00d4aa18" }]}>
                          <Text style={[styles.sonarPillText, { color: "#00d4aa" }]}>✓ {f}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Missing features */}
                {(sonarBarraResult.missingFeatures?.length ?? 0) > 0 && (
                  <View style={styles.sonarFeatureSection}>
                    <Text style={styles.sonarFeatureSectionLabel}>COULD NOT CONFIRM</Text>
                    <View style={styles.sonarPillRow}>
                      {sonarBarraResult.missingFeatures!.slice(0, 4).map((f, i) => (
                        <View key={i} style={[styles.sonarPill, { borderColor: "#ffffff18", backgroundColor: "#ffffff08" }]}>
                          <Text style={[styles.sonarPillText, { color: "#555" }]}>○ {f}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Bottom type + ref match */}
                {(sonarBarraResult.bottomType || sonarBarraResult.refMatchScore != null) && (
                  <View style={styles.sonarBrainMeta}>
                    {sonarBarraResult.bottomType && sonarBarraResult.bottomType !== "unknown" && (
                      <Text style={[styles.sonarBrainPill, {
                        backgroundColor: sonarBarraResult.bottomType === "hard" ? "#00d4aa18" : "#ffffff10",
                        color: sonarBarraResult.bottomType === "hard" ? "#00d4aa" : "#888",
                      }]}>
                        {sonarBarraResult.bottomType === "hard" ? "🪨 HARD BOTTOM" : "💧 SOFT BOTTOM"}
                      </Text>
                    )}
                    {sonarBarraResult.refMatchScore != null && (
                      <Text style={[styles.sonarBrainPill, { backgroundColor: "#ff880018", color: "#ff8800" }]}>
                        ref match {sonarBarraResult.refMatchScore}%
                      </Text>
                    )}
                  </View>
                )}

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

        {/* ── Live Sonar Detail Card ── */}
        {analysis && liveSonarMode && analysis.liveBrand && analysis.liveBrand !== "not-live-sonar" && (
          <View style={{ borderRadius: 14, borderWidth: 1.5, borderColor: "#ff9a0030", backgroundColor: "#070b04", overflow: "hidden" }}>
            <View style={{ height: 3, backgroundColor: "#ff9a00" }} />
            <View style={{ padding: 14, gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ color: "#ff9a00", fontSize: 13, fontFamily: "Oswald_700Bold", letterSpacing: 1.5, flex: 1 }}>⚡ LIVE SONAR ANALYSIS</Text>
                {analysis.liveBrand && (
                  <View style={{ backgroundColor: "#ff9a0018", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ color: "#ff9a00", fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 }}>
                      {analysis.liveBrand === "humminbird-mega-live-2" ? "MEGA LIVE 2"
                       : analysis.liveBrand === "garmin-livescope-plus" ? "LIVESCOPE+"
                       : analysis.liveBrand === "lowrance-activetarget-2" ? "ACTIVETARGET 2"
                       : analysis.liveBrand === "simrad-activetarget" ? "SIMRAD AT2"
                       : "LIVE SONAR"}
                    </Text>
                  </View>
                )}
                {analysis.liveMode && (
                  <View style={{ backgroundColor: "#ffffff0a", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ color: "#9ca3af", fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase" }}>{analysis.liveMode}</Text>
                  </View>
                )}
              </View>
              {[
                { icon: "⬭", label: "TARGET SHAPE", value: analysis.targetShape },
                { icon: "◐", label: "ACOUSTIC SHADOW", value: analysis.shadowAnalysis },
                { icon: "🏗", label: "STRUCTURE", value: analysis.structureProximity },
              ].filter(r => r.value).map(row => (
                <View key={row.label} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                  <Text style={{ fontSize: 14, width: 22, textAlign: "center", marginTop: 1 }}>{row.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#4b5563", fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 1.2, marginBottom: 2 }}>{row.label}</Text>
                    <Text style={{ color: "#d1d5db", fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 }}>{row.value}</Text>
                  </View>
                </View>
              ))}
              {analysis.targetBoostActive && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#ff9a0010", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "#ff9a0025", alignSelf: "flex-start" }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#ff9a00" }} />
                  <Text style={{ color: "#ff9a00", fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 }}>TargetBoost™ Active</Text>
                </View>
              )}
              <View style={{ paddingTop: 6, borderTopWidth: 1, borderTopColor: "#ffffff08" }}>
                <Text style={{ color: "#374151", fontSize: 10, fontFamily: "Inter_400Regular" }}>Identified by shape silhouette + acoustic shadow — no arch analysis</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── 10-scan summary card ── */}
        {summaryText && (
          <View style={{
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: "#ffd70066",
            backgroundColor: "#ffd70010",
            padding: 16,
            gap: 10,
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 20 }}>🏆</Text>
              <View>
                <Text style={{ color: "#ffd700", fontWeight: "800", fontSize: 13, letterSpacing: 1 }}>
                  10-SCAN SUMMARY
                </Text>
                <Text style={{ color: "#ffd700aa", fontSize: 10 }}>
                  {`${boatHistoryRef.current.length === 0 ? "New session starting" : `${boatHistoryRef.current.length}/10 scans`}`}
                </Text>
              </View>
              <TouchableOpacity
                style={{ marginLeft: "auto", padding: 4 }}
                onPress={() => setSummaryText(null)}
              >
                <Feather name="x" size={14} color="#ffd70088" />
              </TouchableOpacity>
            </View>
            <Text style={{ color: "#ffffffdd", fontSize: 13, lineHeight: 20 }}>
              {summaryText}
            </Text>
            {autoSpeak && (
              <TouchableOpacity
                style={{
                  flexDirection: "row", alignItems: "center", gap: 6,
                  alignSelf: "flex-start",
                  backgroundColor: "#ffd70018", borderWidth: 1, borderColor: "#ffd70044",
                  borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
                }}
                onPress={() => { stopSpeaking(); speak(summaryText); }}
              >
                <Feather name="volume-2" size={13} color="#ffd700" />
                <Text style={{ color: "#ffd700", fontSize: 12, fontWeight: "600" }}>Replay Summary</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Previous scan — visible while next boat mode image is analysing ── */}
        {loading && prevAnalysis && prevImageUri && (
          <View style={{
            borderRadius: 14,
            borderWidth: 1,
            borderColor: "#00d4aa33",
            backgroundColor: "#00d4aa0a",
            overflow: "hidden",
          }}>
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderBottomWidth: 1,
              borderBottomColor: "#00d4aa22",
            }}>
              <MaterialCommunityIcons name="history" size={14} color="#00d4aaaa" />
              <Text style={{ color: "#00d4aaaa", fontSize: 12, fontWeight: "600", letterSpacing: 0.5 }}>
                LAST SCAN RESULT
              </Text>
            </View>
            <Image
              source={{ uri: prevImageUri }}
              style={{ width: "100%", height: 160 }}
              resizeMode="cover"
            />
            <AnalysisCard analysis={prevAnalysis} imageUri={prevImageUri} cvRegions={[]} />
          </View>
        )}

        {/* ── Dual-scan consensus badge ──────────────────────────────────── */}
        {analysis && scan2Consensus && (
          <View style={[styles.consensusBadge, {
            borderColor: scan2Consensus.agreed ? "#00d4aa55" : "#ff880055",
            backgroundColor: scan2Consensus.agreed ? "#00d4aa12" : "#ff880012",
          }]}>
            <Text style={[styles.consensusBadgeText, {
              color: scan2Consensus.agreed ? "#00d4aa" : "#ff8800",
            }]}>
              {scan2Consensus.agreed
                ? `✓  2-SCAN CONSENSUS — BOTH SCANS AGREE`
                : `⚠  SCANS DISAGREED — SHOWING MOST CONFIDENT (scan 2: ${scan2Consensus.species2 ?? "?"} ${scan2Consensus.confidence2 ?? "?"}%)`}
            </Text>
          </View>
        )}

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

        {/* ── Total Brain Analyser ─────────────────────────────────────────── */}
        {analysis && (
          <TotalBrainAnalyser
            cvScan={cvScan}
            sonarBarra={sonarBarraResult}
            analysis={analysis}
          />
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
      <HVHeader subtitle="NQ Gulf Country Fishing" />

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

          {/* ── Live Sonar Mode toggle ── */}
          <View style={{ flexDirection: "row", borderRadius: 12, borderWidth: 1, borderColor: "#ffffff14", backgroundColor: "#0a1628", overflow: "hidden" }}>
            <TouchableOpacity
              onPress={() => { setLiveSonarMode(false); liveSonarModeRef.current = false; }}
              activeOpacity={0.8}
              style={[{ flex: 1, paddingVertical: 10, alignItems: "center", justifyContent: "center" }, !liveSonarMode && { backgroundColor: "#00d4aa22" }]}
            >
              <Text style={{ color: liveSonarMode ? "#ffffff30" : "#00d4aa", fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1 }}>2D SONAR</Text>
            </TouchableOpacity>
            <View style={{ width: 1, backgroundColor: "#ffffff10" }} />
            <TouchableOpacity
              onPress={() => { setLiveSonarMode(true); liveSonarModeRef.current = true; }}
              activeOpacity={0.8}
              style={[{ flex: 1, paddingVertical: 10, alignItems: "center", justifyContent: "center" }, liveSonarMode && { backgroundColor: "#ff9a0020" }]}
            >
              <Text style={{ color: liveSonarMode ? "#ff9a00" : "#ffffff30", fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1 }}>⚡ LIVE SONAR</Text>
            </TouchableOpacity>
          </View>

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
            Try AI analysis on real NQ sonar screenshots — barra arches, structure maps,
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

  /* Scan sweep overlay */
  scanDimmer:    { ...StyleSheet.absoluteFillObject, backgroundColor: "#00000060" },
  scanSweepLine: {
    position: "absolute", left: 0, right: 0, height: 2,
    backgroundColor: "#00d4aa",
    shadowColor: "#00d4aa", shadowRadius: 10, shadowOpacity: 1, shadowOffset: { width: 0, height: 0 },
  },
  scanSweepGlow: {
    position: "absolute", left: 0, right: 0, height: 24,
    backgroundColor: "#00d4aa18",
    top: 0,
  },

  /* Analysing card */
  analysingCard: {
    borderRadius: 16, borderWidth: 1.5, padding: 18, gap: 14,
  },
  analysingHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  analysingDot:    { width: 10, height: 10, borderRadius: 5, backgroundColor: "#00d4aa" },
  analysingTitle:  { fontSize: 16, fontFamily: "Oswald_700Bold", color: "#00d4aa", letterSpacing: 2, flex: 1 },
  analysingEngine: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  analysingStages: { gap: 10 },
  analysingStageRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  stageDot:        { width: 7, height: 7, borderRadius: 3.5 },
  stageLabel:      { fontSize: 13, fontFamily: "Inter_500Medium" },
  progressTrack:   { height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill:    { height: 4, borderRadius: 2, backgroundColor: "#00d4aa" },
  analysingHint:   { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 16 },

  /* ⚡ Flash instant-read banner (gpt-4.1-mini, ~1 s) */
  flashBanner: {
    backgroundColor: "#ffd70014", borderWidth: 1, borderColor: "#ffd70055",
    borderRadius: 12, padding: 12, gap: 6,
  },
  flashBannerHot: {
    backgroundColor: "#00d4aa1a", borderWidth: 2, borderColor: "#00d4aa",
    borderRadius: 12, padding: 14, gap: 8,
  },
  flashBadge:      { fontSize: 10, fontFamily: "Inter_700Bold", color: "#ffd700", letterSpacing: 1.5 },
  flashSpecies:    { fontSize: 15, fontFamily: "Oswald_700Bold", color: "#ffd700", letterSpacing: 1 },
  flashRow:        { flexDirection: "row", gap: 8 },
  flashChip:       { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#ffd700", backgroundColor: "#ffd70022", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  flashQuick:      { fontSize: 12, fontFamily: "Inter_400Regular", color: "#ffffffcc", lineHeight: 18 },
  flashSub:        { fontSize: 10, fontFamily: "Inter_400Regular", color: "#ffffff44" },
  flashHotBadge:   { fontSize: 11, fontFamily: "Inter_700Bold", color: "#00d4aa", letterSpacing: 2 },
  flashHotSpecies: { fontSize: 26, fontFamily: "Oswald_700Bold", color: "#00d4aa", letterSpacing: 1.5 },
  flashHotCount:   { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#00d4aacc" },
  flashHotAction:  { fontSize: 12, fontFamily: "Inter_700Bold", color: "#00d4aa", textAlign: "center" as const },

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

  sonarFeatureSection:      { gap: 5 },
  sonarFeatureSectionLabel: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#555", letterSpacing: 0.8 },
  sonarPillRow:             { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  sonarPill:                { borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  sonarPillText:            { fontSize: 10, fontFamily: "Inter_500Medium" },

  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 14, borderRadius: 10, borderWidth: 1 },
  errorText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  newBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  newBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },

  /* Dual-scan consensus badge */
  consensusBadge: {
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  consensusBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.4 },

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
