import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { useColors } from "@/hooks/useColors";
import { NarratorButton } from "@/components/NarratorButton";
import { NarratorSettingsTrigger } from "@/components/NarratorSettings";

// ─── Moon Phase (reuse same algorithm) ───────────────────────────────────────
function getMoonPhase(date: Date): { name: string; day: number; tideType: string } {
  const knownNewMoon = new Date("2000-01-06T18:14:00Z").getTime();
  const lunarCycle = 29.53058867;
  const daysSince = (date.getTime() - knownNewMoon) / (1000 * 60 * 60 * 24);
  const cycleDay = ((daysSince % lunarCycle) + lunarCycle) % lunarCycle;
  if (cycleDay < 1.85) return { name: "New Moon", day: cycleDay, tideType: "spring" };
  if (cycleDay < 7.38) return { name: "Waxing Crescent", day: cycleDay, tideType: "normal" };
  if (cycleDay < 9.22) return { name: "First Quarter", day: cycleDay, tideType: "neap" };
  if (cycleDay < 14.77) return { name: "Waxing Gibbous", day: cycleDay, tideType: "normal" };
  if (cycleDay < 16.61) return { name: "Full Moon", day: cycleDay, tideType: "spring" };
  if (cycleDay < 22.15) return { name: "Waning Gibbous", day: cycleDay, tideType: "normal" };
  if (cycleDay < 23.99) return { name: "Last Quarter", day: cycleDay, tideType: "neap" };
  return { name: "Waning Crescent", day: cycleDay, tideType: "normal" };
}

function getNTSeason(month: number): { name: string; waterTemp: string } {
  if (month >= 5 && month <= 9) return { name: "Dry Season", waterTemp: "24–27°C" };
  if (month === 10 || month === 11) return { name: "Build-Up", waterTemp: "28–31°C" };
  return { name: "Wet Season", waterTemp: "29–32°C" };
}

// ─── Confidence config ────────────────────────────────────────────────────────
const CONF = {
  HIGH:   { color: "#ff2200", label: "HIGH", emoji: "🎯", bg: "#ff220018" },
  MEDIUM: { color: "#ff8c00", label: "MEDIUM", emoji: "⚡", bg: "#ff8c0018" },
  LOW:    { color: "#4a9eff", label: "LOW",  emoji: "🎣", bg: "#4a9eff18" },
};

interface TideEntry { time: string; type: "HW" | "LW"; height: number; timestamp: number; }
interface BarraPrediction {
  rank: number;
  river: string;
  spot: string;
  targetDepth: string;
  why: string;
  lure: string;
  rig: string;
  technique: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  windowHours: number;
  windowNote: string;
}
interface BarraResult {
  predictions: BarraPrediction[];
  bigPictureRead: string;
  topDepth: string;
  topTechnique: string;
}

// ─── Big Red Button ───────────────────────────────────────────────────────────
function BigRedButton({ onPress, loading }: { onPress: () => void; loading: boolean }) {
  const scale = useSharedValue(1);
  const glow  = useSharedValue(0.5);

  useEffect(() => {
    if (!loading) {
      glow.value = withRepeat(
        withSequence(withTiming(1, { duration: 800 }), withTiming(0.5, { duration: 800 })),
        -1, false
      );
    }
  }, [loading, glow]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    shadowOpacity: glow.value,
  }));

  return (
    <Animated.View style={[styles.bigBtnWrap, animStyle]}>
      <TouchableOpacity
        style={[styles.bigBtn, loading && styles.bigBtnLoading]}
        onPress={() => {
          scale.value = withSpring(0.93, {}, () => { scale.value = withSpring(1); });
          onPress();
        }}
        activeOpacity={0.85}
        disabled={loading}
      >
        {loading ? (
          <>
            <ActivityIndicator color="#fff" size="large" />
            <Text style={styles.bigBtnText}>Scanning the depths...</Text>
          </>
        ) : (
          <>
            <Text style={styles.bigBtnIcon}>🎣</Text>
            <Text style={styles.bigBtnText}>FIND BIG BARRA</Text>
            <Text style={styles.bigBtnSub}>70cm+ trophy fish</Text>
          </>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Depth Meter visual ───────────────────────────────────────────────────────
function DepthMeter({ depth, colors }: { depth: string; colors: ReturnType<typeof useColors> }) {
  const match = depth.match(/([\d.]+)/g);
  const minD = match ? parseFloat(match[0]) : 0;
  const maxD = match && match[1] ? parseFloat(match[1]) : minD + 2;
  const MAX_VISUAL = 12;
  const topPct   = (minD / MAX_VISUAL) * 100;
  const fillPct  = ((maxD - minD) / MAX_VISUAL) * 100;

  return (
    <View style={styles.depthMeter}>
      <View style={[styles.depthMeterTrack, { borderColor: colors.border }]}>
        <View style={[styles.depthMeterFill, { top: `${topPct}%` as any, height: `${fillPct}%` as any }]} />
      </View>
      <View style={styles.depthMeterLabels}>
        <Text style={[styles.depthMeterLabel, { color: colors.mutedForeground }]}>0m</Text>
        <Text style={[styles.depthMeterDepth, { color: "#ff2200" }]}>{depth}</Text>
        <Text style={[styles.depthMeterLabel, { color: colors.mutedForeground }]}>12m</Text>
      </View>
    </View>
  );
}

// ─── Prediction Card ──────────────────────────────────────────────────────────
function PredCard({ pred, colors }: { pred: BarraPrediction; colors: ReturnType<typeof useColors> }) {
  const [open, setOpen] = useState(true);
  const c = CONF[pred.confidence] ?? CONF.MEDIUM;

  return (
    <View style={[styles.predCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: c.color, borderLeftWidth: 3 }]}>
      {/* Header */}
      <TouchableOpacity style={styles.predHeader} onPress={() => setOpen((o) => !o)} activeOpacity={0.8}>
        <View style={[styles.rankBadge, { backgroundColor: "#ff220022", borderColor: "#ff220044" }]}>
          <Text style={styles.rankText}>#{pred.rank}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.predRiver, { color: c.color }]}>{pred.river}</Text>
          <Text style={[styles.predSpot, { color: colors.foreground }]}>{pred.spot}</Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <View style={[styles.confBadge, { backgroundColor: c.bg, borderColor: `${c.color}44` }]}>
            <Text style={[styles.confText, { color: c.color }]}>{c.emoji} {c.label}</Text>
          </View>
          <Feather name={open ? "chevron-up" : "chevron-down"} size={15} color={colors.mutedForeground} />
        </View>
      </TouchableOpacity>

      {open && (
        <View style={{ gap: 10 }}>
          {/* Depth + Why row */}
          <View style={styles.depthWhyRow}>
            <DepthMeter depth={pred.targetDepth} colors={colors} />
            <View style={[styles.whyBox, { backgroundColor: `#ff220010`, borderColor: `#ff220030` }]}>
              <MaterialCommunityIcons name="lightbulb-on" size={13} color="#ff2200" />
              <Text style={[styles.whyText, { color: colors.foreground }]}>{pred.why}</Text>
            </View>
          </View>

          {/* Window */}
          <View style={[styles.windowRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="clock-fast" size={14} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.windowLabel, { color: colors.mutedForeground }]}>
                WINDOW: {pred.windowHours}h remaining
              </Text>
              <Text style={[styles.windowNote, { color: colors.foreground }]}>{pred.windowNote}</Text>
            </View>
          </View>

          {/* Tactic boxes */}
          <View style={styles.tacticGrid}>
            <TacticBox icon="hook" label="LURE / BAIT" value={pred.lure} colors={colors} />
            <TacticBox icon="link-variant" label="RIG" value={pred.rig} colors={colors} />
          </View>
          <TacticBox icon="run-fast" label="TECHNIQUE" value={pred.technique} colors={colors} full />
        </View>
      )}
    </View>
  );
}

function TacticBox({ icon, label, value, colors, full }: {
  icon: string; label: string; value: string;
  colors: ReturnType<typeof useColors>; full?: boolean;
}) {
  return (
    <View style={[styles.tacticBox, full && styles.tacticBoxFull, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
      <MaterialCommunityIcons name={icon as any} size={13} color={colors.accent} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.tacticLabel, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[styles.tacticValue, { color: colors.foreground }]}>{value}</Text>
      </View>
    </View>
  );
}

// ─── Conditions Mini Bar ──────────────────────────────────────────────────────
function CondBar({ moon, season, nextTide, colors }: {
  moon: ReturnType<typeof getMoonPhase>;
  season: ReturnType<typeof getNTSeason>;
  nextTide: (TideEntry & { minutesUntil: number }) | null;
  colors: ReturnType<typeof useColors>;
}) {
  const isSpring = moon.tideType === "spring";
  return (
    <View style={[styles.condBar, { backgroundColor: colors.card, borderColor: isSpring ? "#ff2200" : colors.border }]}>
      <CondItem emoji={isSpring ? "🌕" : "🌒"} label={moon.name} hot={isSpring} />
      <View style={[styles.condDivider, { backgroundColor: colors.border }]} />
      <CondItem emoji="☀️" label={season.name} />
      <View style={[styles.condDivider, { backgroundColor: colors.border }]} />
      <CondItem
        emoji={nextTide?.type === "HW" ? "🌊" : "🏖️"}
        label={nextTide ? `${nextTide.type === "HW" ? "High" : "Low"} ${nextTide.time}` : "…"}
      />
      <View style={[styles.condDivider, { backgroundColor: colors.border }]} />
      <CondItem emoji="🌡️" label={season.waterTemp} />
    </View>
  );
}

function CondItem({ emoji, label, hot }: { emoji: string; label: string; hot?: boolean }) {
  return (
    <View style={styles.condItem}>
      <Text style={styles.condEmoji}>{emoji}</Text>
      <Text style={[styles.condLabel, hot && { color: "#ff2200" }]}>{label}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function BarraScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === "web" ? 67 : insets.top;

  const now    = new Date();
  const month  = now.getMonth() + 1;
  const moon   = getMoonPhase(now);
  const season = getNTSeason(month);

  const localTime = now.toLocaleTimeString("en-AU", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Australia/Darwin",
  });

  const [nextTide, setNextTide] = useState<(TideEntry & { minutesUntil: number }) | null>(null);
  const [result,   setResult]   = useState<BarraResult | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    const baseUrl = domain ? `https://${domain}` : "";
    fetch(`${baseUrl}/api/tides?port=darwin&days=2`)
      .then((r) => r.json())
      .then((d) => {
        const allTides: TideEntry[] = [];
        if (d.data) for (const day of d.data) for (const t of day.tides) allTides.push(t);
        const nowMs = Date.now();
        const next = allTides
          .filter((t) => t.timestamp > nowMs - 1000 * 60 * 30)
          .sort((a, b) => a.timestamp - b.timestamp)[0];
        if (next) setNextTide({ ...next, minutesUntil: Math.round((next.timestamp - nowMs) / 60000) });
      })
      .catch(() => {});
  }, []);

  const predict = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      const baseUrl = domain ? `https://${domain}` : "";
      const resp = await fetch(`${baseUrl}/api/barra`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moonPhase: moon.name,
          moonDay: Math.round(moon.day),
          tideType: moon.tideType,
          season: season.name,
          month,
          waterTempRange: season.waterTemp,
          localTime,
          nextTide: nextTide
            ? { type: nextTide.type, height: nextTide.height, time: nextTide.time, minutesUntil: nextTide.minutesUntil }
            : null,
        }),
      });
      if (!resp.ok) throw new Error("Prediction failed");
      const data: BarraResult = await resp.json();
      setResult(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setError("Couldn't run prediction. Check your connection and try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }, [moon, season, month, nextTide, localTime]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad + 16, paddingBottom: Platform.OS === "web" ? 70 : insets.bottom + 24 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.titleRed}>TROPHY BARRA</Text>
          <NarratorSettingsTrigger />
        </View>
        <Text style={styles.titleWhite}>DEPTH PREDICTOR</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          40 years of NT river data · targeting 70cm+
        </Text>
      </View>

      {/* Conditions bar */}
      <CondBar moon={moon} season={season} nextTide={nextTide} colors={colors} />

      {/* THE BIG RED BUTTON */}
      <BigRedButton onPress={predict} loading={loading} />

      {/* Error */}
      {error && (
        <View style={[styles.errorBox, { backgroundColor: "#ff220015", borderColor: "#ff220040" }]}>
          <Feather name="alert-circle" size={16} color="#ff2200" />
          <Text style={[styles.errorText, { color: "#ff2200" }]}>{error}</Text>
        </View>
      )}

      {/* Results */}
      {result && (
        <View style={{ gap: 14 }}>
          {/* Big picture read */}
          <View style={[styles.bigPicBox, { backgroundColor: colors.card, borderColor: "#ff2200" }]}>
            <Text style={styles.bigPicLabel}>TODAY'S READ</Text>
            <Text style={[styles.bigPicText, { color: colors.foreground }]}>{result.bigPictureRead}</Text>
          </View>

          {/* Top depth + technique */}
          <View style={styles.topRow}>
            <View style={[styles.topCard, { backgroundColor: colors.card, borderColor: "#ff2200" }]}>
              <MaterialCommunityIcons name="arrow-down-bold" size={16} color="#ff2200" />
              <Text style={[styles.topLabel, { color: colors.mutedForeground }]}>BEST DEPTH TODAY</Text>
              <Text style={[styles.topValue, { color: "#ff2200" }]}>{result.topDepth}</Text>
            </View>
            <View style={[styles.topCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="run-fast" size={16} color={colors.accent} />
              <Text style={[styles.topLabel, { color: colors.mutedForeground }]}>KEY TECHNIQUE</Text>
              <Text style={[styles.topValue, { color: colors.foreground }]}>{result.topTechnique}</Text>
            </View>
          </View>

          <Text style={[styles.predsHeader, { color: colors.mutedForeground }]}>
            TOP 3 TROPHY PREDICTIONS
          </Text>

          {result.predictions.map((pred) => (
            <PredCard key={pred.rank} pred={pred} colors={colors} />
          ))}

          {/* Narrator */}
          {result && (
            <NarratorButton
              pageType="trophy barra prediction"
              content={`${result.bigPictureRead} Top depth: ${result.topDepth}. ${result.predictions.map((p, i) => `${i + 1}. ${p.spot} on the ${p.river} — ${p.targetDepth} depth, ${p.confidence} confidence. ${p.why}`).join(" ")}`}
            />
          )}

          {/* Re-run */}
          <TouchableOpacity
            style={[styles.rerunBtn, { borderColor: colors.border }]}
            onPress={predict}
            activeOpacity={0.7}
          >
            <Feather name="refresh-cw" size={14} color={colors.mutedForeground} />
            <Text style={[styles.rerunText, { color: colors.mutedForeground }]}>Re-read conditions</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 18, gap: 16 },

  header: { alignItems: "center", gap: 2 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%" },
  titleRed: { fontSize: 28, fontFamily: "Inter_700Bold", color: "#ff2200", letterSpacing: 1 },
  titleWhite: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#ffffff", letterSpacing: 0.5 },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 4, textAlign: "center" },

  condBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 4,
  },
  condItem: { flex: 1, alignItems: "center", gap: 2 },
  condEmoji: { fontSize: 16 },
  condLabel: { fontSize: 9, fontFamily: "Inter_500Medium", textAlign: "center", color: "#9ca3af" },
  condDivider: { width: 1, height: 32, opacity: 0.4 },

  bigBtnWrap: {
    shadowColor: "#ff2200",
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 24,
    elevation: 10,
    borderRadius: 20,
  },
  bigBtn: {
    backgroundColor: "#cc1100",
    borderRadius: 20,
    paddingVertical: 28,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 2,
    borderColor: "#ff2200",
  },
  bigBtnLoading: { backgroundColor: "#8b0000" },
  bigBtnIcon: { fontSize: 36 },
  bigBtnText: { fontSize: 24, fontFamily: "Inter_700Bold", color: "#ffffff", letterSpacing: 1 },
  bigBtnSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#ffaaaa", letterSpacing: 0.3 },

  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 14, borderRadius: 10, borderWidth: 1,
  },
  errorText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },

  bigPicBox: {
    padding: 16, borderRadius: 14, borderWidth: 1, borderLeftWidth: 4, gap: 8,
  },
  bigPicLabel: {
    fontSize: 10, fontFamily: "Inter_700Bold", color: "#ff2200",
    textTransform: "uppercase", letterSpacing: 1,
  },
  bigPicText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21 },

  topRow: { flexDirection: "row", gap: 10 },
  topCard: {
    flex: 1, alignItems: "center", gap: 4,
    padding: 14, borderRadius: 12, borderWidth: 1,
  },
  topLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.8, textAlign: "center" },
  topValue: { fontSize: 14, fontFamily: "Inter_700Bold", textAlign: "center", lineHeight: 19 },

  predsHeader: {
    fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase",
    letterSpacing: 1, textAlign: "center",
  },

  predCard: {
    borderRadius: 14, borderWidth: 1, padding: 14, gap: 10, overflow: "hidden",
  },
  predHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  rankBadge: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center", borderWidth: 1,
  },
  rankText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#ff2200" },
  predRiver: { fontSize: 13, fontFamily: "Inter_700Bold" },
  predSpot: { fontSize: 16, fontFamily: "Inter_700Bold", marginTop: 1 },
  confBadge: {
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, borderWidth: 1,
  },
  confText: { fontSize: 11, fontFamily: "Inter_700Bold" },

  depthWhyRow: { flexDirection: "row", gap: 10, alignItems: "stretch" },
  depthMeter: { width: 48, alignItems: "center", gap: 4 },
  depthMeterTrack: {
    width: 14, flex: 1, minHeight: 80, borderRadius: 7,
    borderWidth: 1, overflow: "hidden", position: "relative",
    backgroundColor: "#0a1628",
  },
  depthMeterFill: {
    position: "absolute", left: 0, right: 0,
    backgroundColor: "#ff2200", opacity: 0.85, borderRadius: 7,
  },
  depthMeterLabels: { alignItems: "center", gap: 2 },
  depthMeterLabel: { fontSize: 9, fontFamily: "Inter_400Regular" },
  depthMeterDepth: { fontSize: 11, fontFamily: "Inter_700Bold", textAlign: "center" },

  whyBox: {
    flex: 1, flexDirection: "row", alignItems: "flex-start",
    gap: 8, padding: 10, borderRadius: 10, borderWidth: 1,
  },
  whyText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },

  windowRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 9,
    padding: 10, borderRadius: 8, borderWidth: 1,
  },
  windowLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.8 },
  windowNote: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 17 },

  tacticGrid: { flexDirection: "row", gap: 8 },
  tacticBox: {
    flex: 1, flexDirection: "row", alignItems: "flex-start",
    gap: 8, padding: 10, borderRadius: 8, borderWidth: 1,
  },
  tacticBoxFull: { flex: undefined, width: "100%" },
  tacticLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.8 },
  tacticValue: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2, lineHeight: 16 },

  rerunBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1,
  },
  rerunText: { fontSize: 13, fontFamily: "Inter_500Medium" },
});
