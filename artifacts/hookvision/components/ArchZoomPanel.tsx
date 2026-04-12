/**
 * ArchZoomPanel — zooms into the detected arch area on the sonar image
 * and explains the AI's identification reasoning.
 *
 * Layout:
 *   ┌─ ARCH DETAIL ──────────────────────────────────┐
 *   │  [Zoomed sonar image cropped to arch area]      │
 *   │  [Crosshair target] [Depth zone label]          │
 *   │  [Bottom type badge]                            │
 *   ├─────────────────────────────────────────────────│
 *   │  HOW I MADE THIS CALL                           │
 *   │  <archReasoning text>                           │
 *   └─────────────────────────────────────────────────┘
 */
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  imageUri: string;
  depth: string;
  distance: string;
  species: string;
  confidence: number;
  bottomType?: string | null;
  archReasoning?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDepthM(depthStr: string): number {
  const ft = depthStr.match(/(\d+(?:\.\d+)?)\s*ft/i);
  if (ft) return parseFloat(ft[1]) * 0.3048;
  const nums = depthStr.match(/\d+(?:\.\d+)?/g);
  if (!nums) return 5;
  return nums.reduce((s, n) => s + parseFloat(n), 0) / nums.length;
}

function depthFraction(depthM: number): number {
  const colM = Math.max(depthM * 1.6, 10);
  return Math.min(0.86, Math.max(0.14, depthM / colM));
}

function horizontalFraction(distance: string): number {
  const d = distance.toLowerCase();
  if (d.includes("right") || d.includes("ahead") || d.includes("starboard")) return 0.70;
  if (d.includes("port") || d.includes("left")) return 0.30;
  return 0.50;
}

interface ZoneInfo {
  label: string;
  color: string;
}

function depthZoneInfo(depthM: number): ZoneInfo {
  if (depthM <= 8) return { label: "BARRA/THREADY/JACK ZONE", color: "#00d4aa" };
  if (depthM <= 15) return { label: "FINGERMARK PRIMARY ZONE", color: "#ffd700" };
  if (depthM <= 25) return { label: "FINGERMARK/JEWFISH ZONE", color: "#ff9800" };
  if (depthM <= 45) return { label: "DEEP REEF ZONE", color: "#ff7043" };
  return { label: "OFFSHORE ZONE", color: "#e91e63" };
}

function bottomColor(bt: string | null | undefined): string {
  if (!bt) return "#78909c";
  const b = bt.toLowerCase();
  if (b.includes("rock") || b.includes("reef") || b.includes("rubble")) return "#ff7043";
  if (b.includes("mud") || b.includes("soft") || b.includes("silt")) return "#4fc3f7";
  if (b.includes("sand")) return "#ffd700";
  return "#78909c";
}

const ZOOM_SCALE = 2.6;
const ZOOM_HEIGHT = 175;

// ─── Component ────────────────────────────────────────────────────────────────

export function ArchZoomPanel({
  imageUri,
  depth,
  distance,
  species,
  confidence,
  bottomType,
  archReasoning,
}: Props) {
  const colors = useColors();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [containerW, setContainerW] = useState(300);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 520,
        delay: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 520,
        delay: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse the crosshair ring
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.35, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setContainerW(w);
  };

  const depthM = parseDepthM(depth);
  const yFrac = depthFraction(depthM);
  const xFrac = horizontalFraction(distance);
  const zone = depthZoneInfo(depthM);
  const btColor = bottomColor(bottomType);
  const cleanSpecies = species.replace(/\s*\(\d+%\)/, "");

  // Translation to center the arch:
  // With scale(S) then translate(tx, ty), the arch at (xFrac*W, yFrac*H)
  // ends up at center when tx = S*(0.5 - xFrac)*W, ty = S*(0.5 - yFrac)*H
  const tx = ZOOM_SCALE * (0.5 - xFrac) * containerW;
  const ty = ZOOM_SCALE * (0.5 - yFrac) * ZOOM_HEIGHT;

  return (
    <Animated.View
      style={[
        styles.panel,
        {
          backgroundColor: "#0c1a2e",
          borderColor: zone.color + "55",
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* ── Title row ── */}
      <View style={styles.titleRow}>
        <View style={[styles.titleIcon, { backgroundColor: zone.color + "22" }]}>
          <Feather name="zoom-in" size={13} color={zone.color} />
        </View>
        <Text style={[styles.titleText, { color: colors.foreground }]}>ARCH DETAIL</Text>
        <View style={[styles.titleBadge, { backgroundColor: zone.color + "25" }]}>
          <Text style={[styles.titleBadgeText, { color: zone.color }]}>AI METHOD</Text>
        </View>
      </View>

      {/* ── Zoomed sonar image ── */}
      <View style={styles.zoomOuter} onLayout={onLayout}>
        <View style={styles.zoomClip}>
          <Image
            source={{ uri: imageUri }}
            style={[
              styles.zoomedImage,
              {
                transform: [
                  { scale: ZOOM_SCALE },
                  { translateX: tx },
                  { translateY: ty },
                ],
              },
            ]}
            resizeMode="cover"
          />

          {/* Scan-line overlay effect */}
          <View style={styles.scanlineOverlay} />

          {/* ── Crosshair at center (arch is panned to center) ── */}
          <View style={[styles.crosshairWrap, { pointerEvents: "none" }]}>
            {/* Outer pulsing ring */}
            <Animated.View
              style={[
                styles.crosshairRingOuter,
                { borderColor: zone.color + "99", transform: [{ scale: pulseAnim }] },
              ]}
            />
            {/* Inner solid ring */}
            <View style={[styles.crosshairRingInner, { borderColor: zone.color }]} />
            {/* Horizontal line */}
            <View style={[styles.crosshairH, { backgroundColor: zone.color + "cc" }]} />
            {/* Vertical line */}
            <View style={[styles.crosshairV, { backgroundColor: zone.color + "cc" }]} />
            {/* Centre dot */}
            <View style={[styles.crosshairDot, { backgroundColor: zone.color }]} />
          </View>

          {/* Species label — top-left */}
          <View style={[styles.speciesLabel, { backgroundColor: "#000000bb" }]}>
            <Text style={[styles.speciesLabelText, { color: zone.color }]} numberOfLines={1}>
              {cleanSpecies}
            </Text>
            <Text style={[styles.speciesConfText, { color: "#aabbcc" }]}>
              {confidence}% confidence
            </Text>
          </View>

          {/* Depth zone — top-right */}
          <View style={[styles.depthZoneTag, { backgroundColor: zone.color + "25", borderColor: zone.color + "55" }]}>
            <Feather name="arrow-down" size={9} color={zone.color} />
            <Text style={[styles.depthZoneDepth, { color: zone.color }]}>{depth}</Text>
          </View>
        </View>

        {/* ── Bottom-strip: zone label + bottom type ── */}
        <View style={[styles.bottomStrip, { backgroundColor: "#091525" }]}>
          <View style={[styles.zonePill, { backgroundColor: zone.color + "18" }]}>
            <MaterialCommunityIcons name="waves" size={10} color={zone.color} />
            <Text style={[styles.zonePillText, { color: zone.color }]}>{zone.label}</Text>
          </View>
          {bottomType && (
            <View style={[styles.bottomPill, { backgroundColor: btColor + "18" }]}>
              <MaterialCommunityIcons name="layers" size={10} color={btColor} />
              <Text style={[styles.bottomPillText, { color: btColor }]}>
                {bottomType}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Reasoning box ── */}
      {archReasoning ? (
        <View style={[styles.reasoningBox, { backgroundColor: "#0a1f35", borderColor: zone.color + "33" }]}>
          <View style={styles.reasoningHeader}>
            <MaterialCommunityIcons name="brain" size={13} color={zone.color} />
            <Text style={[styles.reasoningHeaderText, { color: zone.color }]}>
              HOW I IDENTIFIED THIS
            </Text>
          </View>
          <Text style={[styles.reasoningText, { color: colors.foreground }]}>
            {archReasoning}
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  panel: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    gap: 0,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  titleIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  titleText: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
  },
  titleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  titleBadgeText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
  },

  /* Zoom frame */
  zoomOuter: {
    overflow: "hidden",
  },
  zoomClip: {
    height: ZOOM_HEIGHT,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#000",
  },
  zoomedImage: {
    width: "100%",
    height: ZOOM_HEIGHT,
  },
  scanlineOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.08,
    backgroundColor: "transparent",
    borderStyle: "solid",
  },

  /* Crosshair centered on arch */
  crosshairWrap: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 0,
    height: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  crosshairRingOuter: {
    position: "absolute",
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    marginLeft: -27,
    marginTop: -27,
  },
  crosshairRingInner: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    marginLeft: -14,
    marginTop: -14,
  },
  crosshairH: {
    position: "absolute",
    width: 60,
    height: 1,
    marginLeft: -30,
    marginTop: -0.5,
  },
  crosshairV: {
    position: "absolute",
    width: 1,
    height: 60,
    marginTop: -30,
    marginLeft: -0.5,
  },
  crosshairDot: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: -3,
    marginTop: -3,
  },

  /* Labels on the zoomed image */
  speciesLabel: {
    position: "absolute",
    top: 8,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 1,
  },
  speciesLabelText: {
    fontSize: 12,
    fontFamily: "Oswald_700Bold",
    letterSpacing: 0.4,
  },
  speciesConfText: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
  },
  depthZoneTag: {
    position: "absolute",
    top: 8,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  depthZoneDepth: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },

  /* Bottom strip */
  bottomStrip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 8,
    flexWrap: "wrap",
  },
  zonePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
  },
  zonePillText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.7,
  },
  bottomPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
  },
  bottomPillText: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },

  /* Reasoning box */
  reasoningBox: {
    margin: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  reasoningHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  reasoningHeaderText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  reasoningText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
});
