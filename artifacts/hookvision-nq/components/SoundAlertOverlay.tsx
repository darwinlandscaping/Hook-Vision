import React, { useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import type { SoundAlert } from "@/hooks/useSoundDetection";

// ─── Sonar (barra) colour palette ─────────────────────────────────────────────
const SONAR_COLOR   = "#ffd700";
const SONAR_BG      = "#ffd70018";
const SONAR_BORDER  = "#ffd70055";

// ─── Bird colour palette ───────────────────────────────────────────────────────
const BIRD_COLOR    = "#00d4aa";
const BIRD_BG       = "#00d4aa14";
const BIRD_BORDER   = "#00d4aa55";

const INDICATOR_COLOUR: Record<string, string> = {
  "VERY HIGH": "#00ff66",
  "HIGH":      "#00d4aa",
  "MODERATE":  "#ffd700",
  "LOW":       "#ff8800",
  "NONE":      "#666666",
};

interface SoundAlertOverlayProps {
  alert:      SoundAlert;
  screenType: "sonar" | "bird";
  onDismiss:  () => void;
}

export function SoundAlertOverlay({ alert, screenType, onDismiss }: SoundAlertOverlayProps) {
  const slideY = useRef(new Animated.Value(300)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const accentColor  = screenType === "sonar" ? SONAR_COLOR  : BIRD_COLOR;
  const accentBg     = screenType === "sonar" ? SONAR_BG     : BIRD_BG;
  const accentBorder = screenType === "sonar" ? SONAR_BORDER : BIRD_BORDER;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideY,  { toValue: 0,   useNativeDriver: true, tension: 70, friction: 10 }),
      Animated.timing(opacity, { toValue: 1,   useNativeDriver: true, duration: 200 }),
    ]).start();
  }, [slideY, opacity]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(slideY,  { toValue: 300, useNativeDriver: true, duration: 220 }),
      Animated.timing(opacity, { toValue: 0,   useNativeDriver: true, duration: 180 }),
    ]).start(onDismiss);
  };

  const icon     = screenType === "sonar" ? "fish" : "bird";
  const speciesLabel = (alert.species ?? "Unknown").toUpperCase();
  const eventLabel   = (alert.event ?? alert.behavior ?? "DETECTED").toUpperCase().replace(/_/g, " ");
  const confidence   = alert.confidence ?? 0;

  return (
    <Animated.View
      style={[
        S.container,
        { backgroundColor: "#0a1628f5", borderColor: accentBorder, transform: [{ translateY: slideY }], opacity },
      ]}
      pointerEvents="box-none"
    >
      {/* Top accent bar */}
      <View style={[S.accentBar, { backgroundColor: accentColor }]} />

      <View style={S.inner}>
        {/* Header row */}
        <View style={S.headerRow}>
          <View style={[S.iconBubble, { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}44` }]}>
            <MaterialCommunityIcons name={icon as any} size={22} color={accentColor} />
          </View>

          <View style={S.headerText}>
            <View style={S.headerTop}>
              <Text style={[S.micLabel, { color: accentColor }]}>🎙 SOUND DETECTED</Text>
              {confidence > 0 && (
                <View style={[S.confBadge, { backgroundColor: `${accentColor}22`, borderColor: `${accentColor}55` }]}>
                  <Text style={[S.confText, { color: accentColor }]}>{confidence}%</Text>
                </View>
              )}
            </View>
            <Text style={S.speciesRow}>
              <Text style={[S.speciesName, { color: "#ffffffee" }]}>{speciesLabel}</Text>
              <Text style={S.eventSep}> — </Text>
              <Text style={[S.eventName, { color: accentColor }]}>{eventLabel}</Text>
            </Text>
          </View>

          <TouchableOpacity onPress={dismiss} style={S.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="x" size={18} color="#ffffff66" />
          </TouchableOpacity>
        </View>

        {/* Direction + distance strip */}
        {(alert.direction || alert.distance) && (
          <View style={[S.locationStrip, { backgroundColor: accentBg, borderColor: accentBorder }]}>
            {alert.direction && (
              <View style={S.locationItem}>
                <MaterialCommunityIcons name="compass-outline" size={14} color={accentColor} />
                <Text style={[S.locationText, { color: accentColor }]}>{alert.direction.toUpperCase()}</Text>
              </View>
            )}
            {alert.distance && alert.distance !== "unclear" && (
              <View style={S.locationItem}>
                <MaterialCommunityIcons name="ruler" size={14} color={accentColor} />
                <Text style={[S.locationText, { color: accentColor }]}>{alert.distance}</Text>
              </View>
            )}
            {screenType === "bird" && alert.fishingIndicator && (
              <View style={S.locationItem}>
                <Text style={[S.locationText, { color: INDICATOR_COLOUR[alert.fishingIndicator] ?? accentColor }]}>
                  {alert.fishingIndicator}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Narration */}
        {!!alert.narration && (
          <Text style={S.narration}>"{alert.narration}"</Text>
        )}

        {/* Plan */}
        {!!alert.plan && (
          <View style={[S.planBox, { borderLeftColor: accentColor }]}>
            <Text style={[S.planLabel, { color: accentColor }]}>🎯 CAST PLAN</Text>
            <Text style={S.planText}>{alert.plan}</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

// ─── Floating mic button ───────────────────────────────────────────────────────
interface SoundFABProps {
  isListening:  boolean;
  isAnalyzing:  boolean;
  screenType:   "sonar" | "bird";
  onPress:      () => void;
}

export function SoundFAB({ isListening, isAnalyzing, screenType, onPress }: SoundFABProps) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.25, useNativeDriver: true, duration: 500 }),
          Animated.timing(pulse, { toValue: 1.0,  useNativeDriver: true, duration: 500 }),
        ])
      ).start();
    } else {
      pulse.stopAnimation();
      Animated.timing(pulse, { toValue: 1, useNativeDriver: true, duration: 150 }).start();
    }
  }, [isListening, pulse]);

  const accentColor = screenType === "sonar" ? SONAR_COLOR : BIRD_COLOR;
  const fabBg       = isListening ? "#ff3b3022"
                    : isAnalyzing ? "#ffffff11"
                    : `${accentColor}18`;
  const fabBorder   = isListening ? "#ff3b30"
                    : isAnalyzing ? "#ffffff33"
                    : `${accentColor}55`;
  const iconColor   = isListening ? "#ff3b30"
                    : isAnalyzing ? "#ffffff66"
                    : accentColor;

  if (Platform.OS === "web") return null;

  return (
    <Animated.View style={[S.fab, { transform: [{ scale: pulse }] }]}>
      <TouchableOpacity
        style={[S.fabInner, { backgroundColor: fabBg, borderColor: fabBorder }]}
        onPress={onPress}
        activeOpacity={0.8}
        disabled={isAnalyzing}
      >
        <MaterialCommunityIcons
          name={isListening ? "microphone" : isAnalyzing ? "microphone-off" : "microphone-outline"}
          size={20}
          color={iconColor}
        />
        <Text style={[S.fabLabel, { color: iconColor }]}>
          {isListening ? "REC" : isAnalyzing ? "…" : "HEAR"}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Mic button for inline button rows (species screen) ───────────────────────
interface SoundMicButtonProps {
  isListening:  boolean;
  isAnalyzing:  boolean;
  onPress:      () => void;
  style?:       object;
}

export function SoundMicButton({ isListening, isAnalyzing, onPress, style }: SoundMicButtonProps) {
  if (Platform.OS === "web") return null;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.15, useNativeDriver: true, duration: 400 }),
          Animated.timing(pulse, { toValue: 1.0,  useNativeDriver: true, duration: 400 }),
        ])
      ).start();
    } else {
      pulse.stopAnimation();
      Animated.timing(pulse, { toValue: 1, useNativeDriver: true, duration: 150 }).start();
    }
  }, [isListening, pulse]);

  const bg     = isListening ? "#ff3b3022" : "#00d4aa18";
  const border = isListening ? "#ff3b30"   : "#00d4aa55";
  const color  = isListening ? "#ff3b30"   : isAnalyzing ? "#ffffff44" : "#00d4aa";

  return (
    <Animated.View style={[{ transform: [{ scale: pulse }] }, style]}>
      <TouchableOpacity
        style={[S.micBtn, { backgroundColor: bg, borderColor: border }]}
        onPress={onPress}
        activeOpacity={0.8}
        disabled={isAnalyzing}
      >
        <MaterialCommunityIcons
          name={isListening ? "microphone" : "microphone-outline"}
          size={18}
          color={color}
        />
        <Text style={[S.micBtnLabel, { color }]}>
          {isListening ? "REC" : isAnalyzing ? "…" : "Hear"}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const S = StyleSheet.create({
  container: {
    position:     "absolute",
    bottom:       90,
    left:         12,
    right:        12,
    borderRadius: 18,
    borderWidth:  1.5,
    overflow:     "hidden",
    zIndex:       999,
    elevation:    10,
    shadowColor:  "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius:  16,
  },
  accentBar: { height: 4 },
  inner:     { padding: 16, gap: 12 },

  headerRow:  { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  iconBubble: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  headerText: { flex: 1, gap: 3 },
  headerTop:  { flexDirection: "row", alignItems: "center", gap: 8 },
  micLabel:   { fontSize: 10, fontFamily: "Oswald_700Bold", letterSpacing: 1.5 },
  confBadge:  { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, borderWidth: 1 },
  confText:   { fontSize: 10, fontFamily: "Inter_700Bold" },
  speciesRow: { flexDirection: "row", flexWrap: "wrap" },
  speciesName:{ fontSize: 15, fontFamily: "Inter_700Bold" },
  eventSep:   { fontSize: 15, color: "#ffffff55" },
  eventName:  { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  closeBtn:   { padding: 4, marginTop: -2 },

  locationStrip: {
    flexDirection:  "row",
    flexWrap:       "wrap",
    gap:            12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius:   10,
    borderWidth:    1,
  },
  locationItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  locationText: { fontSize: 12, fontFamily: "Oswald_700Bold", letterSpacing: 1 },

  narration: {
    fontSize:    14,
    fontFamily:  "Inter_400Regular",
    color:       "#ffffffaa",
    fontStyle:   "italic",
    lineHeight:  21,
  },

  planBox: {
    borderLeftWidth: 3,
    paddingLeft:     12,
    gap:             3,
  },
  planLabel: { fontSize: 10, fontFamily: "Oswald_700Bold", letterSpacing: 1.5 },
  planText:  { fontSize: 13, fontFamily: "Inter_500Medium", color: "#ffffffcc", lineHeight: 19 },

  // FAB
  fab: {
    position: "absolute",
    bottom:   104,
    right:    16,
    zIndex:   100,
  },
  fabInner: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius:    24,
    borderWidth:     1.5,
  },
  fabLabel: { fontSize: 11, fontFamily: "Oswald_700Bold", letterSpacing: 1.2 },

  // inline mic button
  micBtn: {
    flexDirection: "row",
    alignItems:    "center",
    justifyContent: "center",
    gap:           5,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius:  12,
    borderWidth:   1,
  },
  micBtnLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
});
