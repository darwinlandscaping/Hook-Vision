/**
 * SonarOverlay — AI interpretation layer rendered ON TOP of a sonar image.
 *
 * Loading state  → animated green scan beam sweeps the image
 * Analysis ready → fish detection rings + species labels at estimated depths,
 *                  depth ruler, bottom-type bar, activity pill, croc alert
 */
import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SonarAnalysis {
  fishCount: number;
  depth: string;
  distance?: string;
  species: string;
  confidence: number;
  suggestion?: string;
  lure?: string;
  technique?: string;
  rig?: string;
  waterTemp?: string;
  bottomType?: string;
  sonarModel?: string | null;
  crocAlert?: boolean;
  crocWarning?: string | null;
}

interface Props {
  imageHeight: number;
  imageWidth: number;
  loading: boolean;
  analysis: SonarAnalysis | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract the average depth in metres from a string like "5–8m" or "3ft" */
function parseDepthM(depthStr: string | null | undefined): number {
  if (!depthStr) return 0;
  const ftMatch = depthStr.match(/(\d+(?:\.\d+)?)\s*ft/i);
  if (ftMatch) return parseFloat(ftMatch[1]) * 0.3048;
  const nums = depthStr.match(/\d+(?:\.\d+)?/g);
  if (!nums) return 0;
  const avg = nums.reduce((s, n) => s + parseFloat(n), 0) / nums.length;
  return avg;
}

/** Fraction 0–1 from top for a given depth in a ~15m column */
function depthFraction(depthM: number): number {
  const colM = Math.max(depthM * 1.6, 10); // estimated column depth
  return Math.min(0.88, Math.max(0.12, depthM / colM));
}

/** Fraction 0–1 from left based on distance description */
function horizontalFraction(distance: string | undefined | null): number {
  if (!distance) return 0.5;
  const d = distance.toLowerCase();
  if (d.includes("right") || d.includes("ahead") || d.includes("starboard")) return 0.72;
  if (d.includes("port") || d.includes("left")) return 0.28;
  return 0.5;
}

function parseActivity(suggestion: string | undefined): "active" | "lethargic" | "unknown" {
  if (!suggestion) return "unknown";
  const s = suggestion.toLowerCase();
  if (s.includes("active") || s.includes("feeding") || s.includes("gap")) return "active";
  if (s.includes("lethargic") || s.includes("merged") || s.includes("resting") || s.includes("slack")) return "lethargic";
  return "unknown";
}

function bottomColor(bottomType: string | undefined): string {
  if (!bottomType) return "#445566";
  const b = bottomType.toLowerCase();
  if (b.includes("rock") || b.includes("hard") || b.includes("reef") || b.includes("rubble")) return "#ff7043";
  if (b.includes("mud") || b.includes("silt") || b.includes("soft")) return "#4fc3f7";
  if (b.includes("sand")) return "#ffd700";
  return "#78909c";
}

function activityColor(act: "active" | "lethargic" | "unknown"): string {
  if (act === "active") return "#00e676";
  if (act === "lethargic") return "#ff9800";
  return "#78909c";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Vertical scan beam that sweeps top → bottom then resets */
function ScanBeam({ imageHeight }: { imageHeight: number }) {
  const y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(y, {
          toValue: imageHeight,
          duration: 1600,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        Animated.timing(y, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [imageHeight, y]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.scanBeam, { transform: [{ translateY: y }] }]}
    />
  );
}

/** Pulsing detection ring for a single fish target */
function DetectionRing({ color, label }: { color: string; label: string }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.4, duration: 900, useNativeDriver: false }),
          Animated.timing(pulse, { toValue: 1.0, duration: 900, useNativeDriver: false }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.2, duration: 900, useNativeDriver: false }),
          Animated.timing(opacity, { toValue: 0.8, duration: 900, useNativeDriver: false }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse, opacity]);

  return (
    <View style={styles.ringWrap}>
      {/* Outer pulsing ring */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ringOuter,
          { borderColor: color, transform: [{ scale: pulse }], opacity },
        ]}
      />
      {/* Inner solid dot */}
      <View style={[styles.ringInner, { backgroundColor: color }]} />
      {/* Label pill */}
      <View style={[styles.ringLabel, { backgroundColor: color + "dd" }]}>
        <Text style={styles.ringLabelText} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

/** Horizontal tick ruler on the right edge */
function DepthRuler({
  imageHeight,
  fishFraction,
  depthLabel,
  color,
}: {
  imageHeight: number;
  fishFraction: number;
  depthLabel: string;
  color: string;
}) {
  const RULER_W = 36;
  const ticks = [0, 0.25, 0.5, 0.75, 1.0];

  return (
    <View style={[styles.ruler, { height: imageHeight, width: RULER_W }]}>
      {/* Vertical bar */}
      <View style={styles.rulerBar} />

      {/* Tick marks */}
      {ticks.map((f) => (
        <View
          key={f}
          style={[styles.rulerTick, { top: f * imageHeight - 1 }]}
        />
      ))}

      {/* Fish depth marker */}
      <View
        style={[
          styles.rulerFishMark,
          { top: fishFraction * imageHeight - 8, backgroundColor: color },
        ]}
      >
        <Text style={styles.rulerFishMarkText} numberOfLines={1}>
          {depthLabel}
        </Text>
      </View>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SonarOverlay({ imageHeight, imageWidth, loading, analysis }: Props) {
  const W = imageWidth;
  const H = imageHeight;

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.overlay, { height: H, width: W }]} pointerEvents="none">
        {/* Dark tint */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "#000000aa" }]} />

        {/* Scan beam */}
        <ScanBeam imageHeight={H} />

        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((f) => (
          <View
            key={f}
            style={[styles.gridLine, { top: f * H, width: W }]}
          />
        ))}
        {[0.25, 0.5, 0.75].map((f) => (
          <View
            key={f}
            style={[styles.gridLineV, { left: f * W, height: H }]}
          />
        ))}

        {/* Status pill */}
        <View style={styles.loadingPill}>
          <View style={styles.loadingDot} />
          <Text style={styles.loadingPillText}>AI READING SONAR</Text>
        </View>
      </View>
    );
  }

  // ── No analysis ────────────────────────────────────────────────────────────
  if (!analysis) return null;

  const depthM = parseDepthM(analysis.depth);
  const depthFrac = depthFraction(depthM);
  const xFrac = horizontalFraction(analysis.distance);
  const activity = parseActivity(analysis.suggestion);
  const actColor = activityColor(activity);
  const btColor = bottomColor(analysis.bottomType);
  const species = analysis.species.split(" ")[0]; // short name
  const confStr = `${analysis.confidence}%`;

  // Count fish markers to show (max 3 even if fishCount is huge)
  const markerCount = Math.min(analysis.fishCount, 3);

  // Spread multiple fish markers slightly around the estimated position
  const offsets = [
    { dx: 0, dy: 0 },
    { dx: -0.12, dy: -0.05 },
    { dx: 0.11, dy: 0.06 },
  ];

  // Detection ring colour: teal for fish, red for croc
  const ringColor = analysis.crocAlert ? "#ff1744" : "#00e5ff";

  return (
    <View style={[styles.overlay, { height: H, width: W }]} pointerEvents="none">

      {/* ── Croc alert banner ─────────────────────────────────────────────── */}
      {analysis.crocAlert && (
        <View style={styles.crocBanner}>
          <Text style={styles.crocBannerText}>
            ⚠️  CROCODILE DETECTED — DO NOT ENTER WATER  ⚠️
          </Text>
        </View>
      )}

      {/* ── Species + confidence header ────────────────────────────────────── */}
      {!analysis.crocAlert && (
        <View style={styles.speciesHeader}>
          <Text style={styles.speciesText} numberOfLines={1}>
            {species}
          </Text>
          <View
            style={[
              styles.confPill,
              { backgroundColor: analysis.confidence >= 70 ? "#00e5ff33" : "#ff980033" },
            ]}
          >
            <Text
              style={[
                styles.confText,
                { color: analysis.confidence >= 70 ? "#00e5ff" : "#ff9800" },
              ]}
            >
              {confStr}
            </Text>
          </View>
        </View>
      )}

      {/* ── Activity pill ─────────────────────────────────────────────────── */}
      {activity !== "unknown" && (
        <View style={[styles.activityPill, { borderColor: actColor + "88" }]}>
          <View style={[styles.activityDot, { backgroundColor: actColor }]} />
          <Text style={[styles.activityText, { color: actColor }]}>
            {activity === "active" ? "ACTIVE — FEEDING" : "LETHARGIC"}
          </Text>
        </View>
      )}

      {/* ── Fish detection rings ───────────────────────────────────────────── */}
      {markerCount > 0 &&
        offsets.slice(0, markerCount).map((off, i) => {
          const cx = Math.min(0.88, Math.max(0.12, xFrac + off.dx));
          const cy = Math.min(0.88, Math.max(0.12, depthFrac + off.dy));
          return (
            <View
              key={i}
              style={[
                styles.ringContainer,
                {
                  left: cx * W - 20,
                  top: cy * H - 20,
                },
              ]}
            >
              <DetectionRing
                color={ringColor}
                label={i === 0 ? `${species} ${confStr}` : species}
              />
            </View>
          );
        })}

      {/* ── Depth ruler on right edge ─────────────────────────────────────── */}
      <View style={[styles.rulerContainer, { right: 0, height: H }]}>
        <DepthRuler
          imageHeight={H}
          fishFraction={depthFrac}
          depthLabel={analysis.depth}
          color={ringColor}
        />
      </View>

      {/* ── Bottom type annotation bar ────────────────────────────────────── */}
      {analysis.bottomType && (
        <View style={[styles.bottomBar, { borderTopColor: btColor }]}>
          <View style={[styles.bottomBarDot, { backgroundColor: btColor }]} />
          <Text style={[styles.bottomBarText, { color: btColor }]} numberOfLines={1}>
            {analysis.bottomType.toUpperCase()}
          </Text>
        </View>
      )}

      {/* ── Fish count badge ──────────────────────────────────────────────── */}
      {analysis.fishCount > 0 && (
        <View style={[styles.fishCountBadge, { borderColor: ringColor + "88" }]}>
          <Text style={[styles.fishCountText, { color: ringColor }]}>
            {analysis.fishCount} fish
          </Text>
        </View>
      )}

      {/* ── Water temp (bottom-right) ──────────────────────────────────────── */}
      {analysis.waterTemp && (
        <View style={styles.tempBadge}>
          <Text style={styles.tempText}>{analysis.waterTemp}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    overflow: "hidden",
  },

  // ── Loading ──────────────────────────────────────────────────────────────
  scanBeam: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "#00ff88",
    shadowColor: "#00ff88",
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    // Glow trail via multiple nested views is not easy without a library,
    // so we use a simple bright line with native shadow
  },
  gridLine: {
    position: "absolute",
    height: 1,
    backgroundColor: "#00e5ff18",
  },
  gridLineV: {
    position: "absolute",
    width: 1,
    backgroundColor: "#00e5ff18",
  },
  loadingPill: {
    position: "absolute",
    bottom: 14,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#000000cc",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#00ff8866",
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#00ff88",
  },
  loadingPillText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#00ff88",
    letterSpacing: 1.5,
  },

  // ── Analysis ─────────────────────────────────────────────────────────────
  crocBanner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#ff1744ee",
    paddingVertical: 7,
    paddingHorizontal: 10,
    alignItems: "center",
    zIndex: 10,
  },
  crocBannerText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    letterSpacing: 0.5,
    textAlign: "center",
  },

  speciesHeader: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#000000bb",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#00e5ff44",
  },
  speciesText: {
    fontSize: 13,
    fontFamily: "Oswald_700Bold",
    color: "#ffffff",
    letterSpacing: 0.5,
    maxWidth: 130,
  },
  confPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  confText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },

  activityPill: {
    position: "absolute",
    top: 8,
    right: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#000000bb",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
  },
  activityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activityText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },

  // ── Detection rings ───────────────────────────────────────────────────────
  ringContainer: {
    position: "absolute",
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  ringWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  ringOuter: {
    position: "absolute",
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
  },
  ringInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    opacity: 0.9,
  },
  ringLabel: {
    position: "absolute",
    top: 22,
    left: 22,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    maxWidth: 120,
  },
  ringLabelText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#000000",
    letterSpacing: 0.3,
  },

  // ── Depth ruler ───────────────────────────────────────────────────────────
  rulerContainer: {
    position: "absolute",
    top: 0,
  },
  ruler: {
    position: "relative",
    backgroundColor: "#00000055",
  },
  rulerBar: {
    position: "absolute",
    left: 2,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: "#ffffff22",
  },
  rulerTick: {
    position: "absolute",
    left: 0,
    width: 8,
    height: 1,
    backgroundColor: "#ffffff44",
  },
  rulerFishMark: {
    position: "absolute",
    left: 0,
    right: 0,
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 2,
    alignItems: "center",
  },
  rulerFishMarkText: {
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    color: "#000000",
    letterSpacing: 0.3,
  },

  // ── Bottom type bar ───────────────────────────────────────────────────────
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#000000bb",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderTopWidth: 2,
  },
  bottomBarDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  bottomBarText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },

  // ── Fish count badge ──────────────────────────────────────────────────────
  fishCountBadge: {
    position: "absolute",
    bottom: 28,
    left: 10,
    backgroundColor: "#000000cc",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  fishCountText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },

  // ── Water temp ────────────────────────────────────────────────────────────
  tempBadge: {
    position: "absolute",
    bottom: 8,
    left: 10,
    backgroundColor: "#00000099",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  tempText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#4fc3f7",
  },
});
