import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
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

// ─── Moon Phase Calculation ───────────────────────────────────────────────────
function getMoonPhase(date: Date): {
  name: string;
  emoji: string;
  day: number;
  fishingImpact: string;
  tideType: "spring" | "neap" | "normal";
} {
  const knownNewMoon = new Date("2000-01-06T18:14:00Z").getTime();
  const lunarCycle = 29.53058867;
  const daysSince = (date.getTime() - knownNewMoon) / (1000 * 60 * 60 * 24);
  const cycleDay = ((daysSince % lunarCycle) + lunarCycle) % lunarCycle;

  if (cycleDay < 1.85)
    return { name: "New Moon", emoji: "🌑", day: cycleDay, fishingImpact: "Spring tides — massive barra activity", tideType: "spring" };
  if (cycleDay < 7.38)
    return { name: "Waxing Crescent", emoji: "🌒", day: cycleDay, fishingImpact: "Tides building — fish becoming more active", tideType: "normal" };
  if (cycleDay < 9.22)
    return { name: "First Quarter", emoji: "🌓", day: cycleDay, fishingImpact: "Neap tides — slower current, try bait fishing", tideType: "neap" };
  if (cycleDay < 14.77)
    return { name: "Waxing Gibbous", emoji: "🌔", day: cycleDay, fishingImpact: "Tides strengthening — lure fishing improving", tideType: "normal" };
  if (cycleDay < 16.61)
    return { name: "Full Moon", emoji: "🌕", day: cycleDay, fishingImpact: "SPRING TIDES — best fishing of the month!", tideType: "spring" };
  if (cycleDay < 22.15)
    return { name: "Waning Gibbous", emoji: "🌖", day: cycleDay, fishingImpact: "Strong tides fading — still solid fishing", tideType: "normal" };
  if (cycleDay < 23.99)
    return { name: "Last Quarter", emoji: "🌗", day: cycleDay, fishingImpact: "Neap tides — bait and bottom fishing best", tideType: "neap" };
  return { name: "Waning Crescent", emoji: "🌘", day: cycleDay, fishingImpact: "New moon approaching — fish sensing change", tideType: "normal" };
}

// ─── NT Season ────────────────────────────────────────────────────────────────
function getNTSeason(month: number): {
  name: string;
  emoji: string;
  waterTemp: string;
  impact: string;
  colour: string;
} {
  if (month >= 5 && month <= 9)
    return {
      name: "Dry Season",
      emoji: "☀️",
      waterTemp: "24–27°C",
      impact: "BEST fishing of the year. Clear water, active barra, offshore pelagics red hot.",
      colour: "#ffd700",
    };
  if (month === 10 || month === 11)
    return {
      name: "Build-Up",
      emoji: "⛈️",
      waterTemp: "28–31°C",
      impact: "Barra fattening up pre-wet. Fish hard before afternoon storms. Explosive bite.",
      colour: "#ff8c00",
    };
  return {
    name: "Wet Season",
    emoji: "🌧️",
    waterTemp: "29–32°C",
    impact: "Fresh inflows bring barra into rivers. Threadfin & jewfish thrive in murky water.",
    colour: "#00a8ff",
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface TideEntry {
  time: string;
  type: "HW" | "LW";
  height: number;
  timestamp: number;
}

interface BoatRamp {
  name: string;
  lat: number;
  lng: number;
  accessNote: string;
}

interface ForecastSpot {
  name: string;
  species: string;
  why: string;
  lure: string;
  rig: string;
  technique: string;
  urgency: "NOW" | "SOON" | "LATER";
  boatRamp?: BoatRamp;
}

interface ForecastResult {
  spots: ForecastSpot[];
  headline: string;
}

// ─── Pulse animation component ────────────────────────────────────────────────
function PulseButton({ onPress, loading }: { onPress: () => void; loading: boolean }) {
  const colors = useColors();
  const scale = useSharedValue(1);
  const glow = useSharedValue(0.6);

  useEffect(() => {
    if (!loading) {
      glow.value = withRepeat(
        withSequence(withTiming(1, { duration: 900 }), withTiming(0.6, { duration: 900 })),
        -1,
        false
      );
    } else {
      glow.value = 0.8;
    }
  }, [loading, glow]);

  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    shadowOpacity: glow.value,
  }));

  const handlePress = () => {
    scale.value = withSpring(0.94, {}, () => { scale.value = withSpring(1); });
    onPress();
  };

  return (
    <Animated.View style={[btnStyle, styles.pulseWrapper]}>
      <TouchableOpacity
        style={[styles.bigBtn, { backgroundColor: colors.primary }]}
        onPress={handlePress}
        activeOpacity={0.85}
        disabled={loading}
      >
        {loading ? (
          <>
            <ActivityIndicator color={colors.primaryForeground} size="small" />
            <Text style={[styles.bigBtnText, { color: colors.primaryForeground }]}>
              Reading the water...
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.bigBtnEmoji}>🎣</Text>
            <Text style={[styles.bigBtnText, { color: colors.primaryForeground }]}>
              HERE FISHY FISHY
            </Text>
          </>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Urgency badge ────────────────────────────────────────────────────────────
function UrgencyBadge({ urgency, colors }: { urgency: string; colors: ReturnType<typeof useColors> }) {
  const cfg: Record<string, { bg: string; text: string; label: string }> = {
    NOW:   { bg: colors.primary,     text: colors.primaryForeground, label: "🔥 GO NOW" },
    SOON:  { bg: colors.accent,      text: "#fff",                   label: "⏱ SOON" },
    LATER: { bg: colors.secondary,   text: colors.mutedForeground,   label: "🕐 LATER" },
  };
  const c = cfg[urgency] ?? cfg.LATER;
  return (
    <View style={[styles.urgencyBadge, { backgroundColor: c.bg }]}>
      <Text style={[styles.urgencyText, { color: c.text }]}>{c.label}</Text>
    </View>
  );
}

// ─── Spot Card ────────────────────────────────────────────────────────────────
function SpotCard({ spot, index, colors }: { spot: ForecastSpot; index: number; colors: ReturnType<typeof useColors> }) {
  const openSatMap = () => {
    if (!spot.boatRamp) return;
    const { lat, lng } = spot.boatRamp;
    const url = `https://www.google.com/maps/@${lat},${lng},14z/data=!3m1!1e3`;
    Linking.openURL(url).catch(() => {});
  };

  const openRoadReport = () => {
    Linking.openURL("https://roadreport.nt.gov.au/").catch(() => {});
  };

  return (
    <View style={[styles.spotCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.spotHeader}>
        <View style={styles.spotTitleRow}>
          <View style={[styles.spotNumber, { backgroundColor: colors.primary }]}>
            <Text style={[styles.spotNumberText, { color: colors.primaryForeground }]}>{index + 1}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.spotName, { color: colors.foreground }]}>{spot.name}</Text>
            <Text style={[styles.spotSpecies, { color: colors.primary }]}>{spot.species}</Text>
          </View>
          <UrgencyBadge urgency={spot.urgency} colors={colors} />
        </View>
      </View>

      <View style={[styles.whyBox, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}33` }]}>
        <MaterialCommunityIcons name="lightbulb-on" size={14} color={colors.primary} />
        <Text style={[styles.whyText, { color: colors.foreground }]}>{spot.why}</Text>
      </View>

      <View style={styles.tacticGrid}>
        <TacticItem icon="hook" label="LURE / BAIT" value={spot.lure} colors={colors} />
        <TacticItem icon="link-variant" label="RIG" value={spot.rig} colors={colors} />
      </View>
      <TacticItem icon="run-fast" label="TECHNIQUE" value={spot.technique} colors={colors} full />

      {/* ── Boat Ramp Section ── */}
      {spot.boatRamp && (
        <View style={[styles.rampSection, { borderTopColor: colors.border }]}>
          <View style={styles.rampHeader}>
            <MaterialCommunityIcons name="ferry" size={14} color={colors.accent} />
            <Text style={[styles.rampHeaderText, { color: colors.mutedForeground }]}>NEAREST BOAT RAMP</Text>
          </View>
          <Text style={[styles.rampName, { color: colors.foreground }]}>{spot.boatRamp.name}</Text>
          <View style={[styles.rampAccessRow, { backgroundColor: `${colors.accent}14`, borderColor: `${colors.accent}28` }]}>
            <MaterialCommunityIcons name="road-variant" size={12} color={colors.accent} />
            <Text style={[styles.rampAccessText, { color: colors.mutedForeground }]}>{spot.boatRamp.accessNote}</Text>
          </View>
          <View style={styles.rampBtnRow}>
            <TouchableOpacity
              style={[styles.rampBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              onPress={openSatMap}
              activeOpacity={0.75}
            >
              <MaterialCommunityIcons name="satellite-variant" size={14} color={colors.primary} />
              <Text style={[styles.rampBtnText, { color: colors.primary }]}>Satellite Map</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rampBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              onPress={openRoadReport}
              activeOpacity={0.75}
            >
              <MaterialCommunityIcons name="alert-circle-outline" size={14} color="#ff8c00" />
              <Text style={[styles.rampBtnText, { color: "#ff8c00" }]}>Road Closures</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

function TacticItem({
  icon, label, value, colors, full,
}: {
  icon: string; label: string; value: string; colors: ReturnType<typeof useColors>; full?: boolean;
}) {
  return (
    <View style={[styles.tacticItem, full && styles.tacticItemFull, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
      <MaterialCommunityIcons name={icon as any} size={13} color={colors.accent} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.tacticLabel, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[styles.tacticValue, { color: colors.foreground }]}>{value}</Text>
      </View>
    </View>
  );
}

// ─── Condition Pill ───────────────────────────────────────────────────────────
function CondPill({ emoji, label, value, sub, colours }: {
  emoji: string; label: string; value: string; sub?: string;
  colours: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.condPill, { backgroundColor: colours.card, borderColor: colours.border }]}>
      <Text style={styles.condEmoji}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.condLabel, { color: colours.mutedForeground }]}>{label}</Text>
        <Text style={[styles.condValue, { color: colours.foreground }]}>{value}</Text>
        {sub ? <Text style={[styles.condSub, { color: colours.mutedForeground }]}>{sub}</Text> : null}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ForecastScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const now = new Date();
  const month = now.getMonth() + 1;
  const moon = getMoonPhase(now);
  const season = getNTSeason(month);

  const localTime = now.toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Australia/Darwin",
  });

  const [tides, setTides] = useState<TideEntry[]>([]);
  const [tidesLoading, setTidesLoading] = useState(true);
  const [nextTide, setNextTide] = useState<(TideEntry & { minutesUntil: number }) | null>(null);
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch today's tides on mount
  useEffect(() => {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    const baseUrl = domain ? `https://${domain}` : "";
    fetch(`${baseUrl}/api/tides?port=darwin&days=2`)
      .then((r) => r.json())
      .then((d) => {
        const allTides: TideEntry[] = [];
        if (d.data) {
          for (const day of d.data) {
            for (const t of day.tides) allTides.push(t);
          }
        }
        setTides(allTides);
        const nowMs = Date.now();
        const next = allTides
          .filter((t) => t.timestamp > nowMs - 1000 * 60 * 30)
          .sort((a, b) => a.timestamp - b.timestamp)[0];
        if (next) {
          const minutesUntil = Math.round((next.timestamp - nowMs) / 60000);
          setNextTide({ ...next, minutesUntil });
        }
      })
      .catch(() => {})
      .finally(() => setTidesLoading(false));
  }, []);

  const getForecast = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForecast(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      const baseUrl = domain ? `https://${domain}` : "";
      const body = {
        moonPhase: moon.name,
        moonDay: Math.round(moon.day),
        season: season.name,
        month,
        nextTide: nextTide
          ? {
              type: nextTide.type,
              height: nextTide.height,
              time: nextTide.time,
              minutesUntil: nextTide.minutesUntil,
            }
          : null,
        waterTempRange: season.waterTemp,
        port: "darwin",
        localTime,
      };
      const resp = await fetch(`${baseUrl}/api/forecast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!resp.ok) throw new Error("Forecast failed");
      const data: ForecastResult = await resp.json();
      setForecast(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setError("Couldn't generate forecast. Check your connection and try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }, [moon, season, month, nextTide, localTime]);

  const tideLabel = nextTide
    ? `${nextTide.type === "HW" ? "High" : "Low"} tide ${nextTide.time} (${nextTide.minutesUntil > 0 ? `in ${nextTide.minutesUntil}m` : `${Math.abs(nextTide.minutesUntil)}m ago`})`
    : tidesLoading
    ? "Loading tides..."
    : "Tide data unavailable";

  const tideSub = nextTide
    ? `${nextTide.height.toFixed(2)}m — ${nextTide.type === "HW" ? "fish the 2hrs before & after" : "creek mouths firing now"}`
    : undefined;

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
          <Text style={[styles.title, { color: colors.primary }]}>Here Fishy Fishy</Text>
          <NarratorSettingsTrigger />
        </View>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Conditions-based NT spot guide
        </Text>
      </View>

      {/* Conditions Grid */}
      <View style={styles.condGrid}>
        <CondPill
          emoji={moon.emoji}
          label="MOON"
          value={moon.name}
          sub={moon.fishingImpact}
          colours={colors}
        />
        <CondPill
          emoji={season.emoji}
          label="SEASON"
          value={season.name}
          sub={`Water ${season.waterTemp}`}
          colours={colors}
        />
        <CondPill
          emoji={nextTide?.type === "HW" ? "🌊" : "🏖️"}
          label="NEXT TIDE"
          value={tideLabel}
          sub={tideSub}
          colours={colors}
        />
        <CondPill
          emoji="🌡️"
          label="WATER TEMP"
          value={season.waterTemp}
          sub={season.impact.split(".")[0]}
          colours={colors}
        />
      </View>

      {/* Season impact box */}
      <View style={[styles.seasonBox, { backgroundColor: `${colors.accent}18`, borderColor: `${colors.accent}33` }]}>
        <Text style={[styles.seasonBoxEmoji]}>{season.emoji}</Text>
        <Text style={[styles.seasonBoxText, { color: colors.foreground }]}>{season.impact}</Text>
      </View>

      {/* The Button */}
      <PulseButton onPress={getForecast} loading={loading} />

      {/* Error */}
      {error && (
        <View style={[styles.errorBox, { backgroundColor: `${colors.destructive}18`, borderColor: `${colors.destructive}44` }]}>
          <Feather name="alert-circle" size={16} color={colors.destructive} />
          <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
        </View>
      )}

      {/* Results */}
      {forecast && (
        <View style={styles.results}>
          {/* Headline */}
          <View style={[styles.headlineBox, { backgroundColor: colors.card, borderColor: colors.primary }]}>
            <Text style={[styles.headlineText, { color: colors.primary }]}>{forecast.headline}</Text>
          </View>

          <Text style={[styles.spotsHeader, { color: colors.mutedForeground }]}>
            TOP 3 SPOTS RIGHT NOW
          </Text>

          {forecast.spots.map((spot, i) => (
            <SpotCard key={i} spot={spot} index={i} colors={colors} />
          ))}

          {/* Narrator */}
          {forecast && (
            <NarratorButton
              pageType="fishing forecast"
              content={`${forecast.headline}. Top spots: ${forecast.spots.map((s, i) => `${i + 1}. ${s.name} — ${s.species}, ${s.urgency}. ${s.why}`).join(" ")}`}
            />
          )}

          {/* Re-read button */}
          <TouchableOpacity
            style={[styles.rereadBtn, { borderColor: colors.border }]}
            onPress={getForecast}
            activeOpacity={0.7}
          >
            <Feather name="refresh-cw" size={14} color={colors.mutedForeground} />
            <Text style={[styles.rereadText, { color: colors.mutedForeground }]}>Fresh read</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 16 },
  header: { alignItems: "center", gap: 4 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%" },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular" },

  condGrid: { gap: 8 },
  condPill: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  condEmoji: { fontSize: 22, marginTop: 2 },
  condLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.8 },
  condValue: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginTop: 1 },
  condSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 15 },

  seasonBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  seasonBoxEmoji: { fontSize: 20, marginTop: 1 },
  seasonBoxText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },

  pulseWrapper: {
    shadowColor: "#00d4aa",
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 20,
    elevation: 8,
    borderRadius: 30,
  },
  bigBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 20,
    borderRadius: 30,
  },
  bigBtnEmoji: { fontSize: 24 },
  bigBtnText: { fontSize: 20, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },

  results: { gap: 14 },
  headlineBox: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  headlineText: { fontSize: 15, fontFamily: "Inter_700Bold", lineHeight: 22 },
  spotsHeader: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1,
    textAlign: "center",
  },

  spotCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    gap: 10,
    padding: 14,
  },
  spotHeader: { gap: 8 },
  spotTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  spotNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  spotNumberText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  spotName: { fontSize: 16, fontFamily: "Inter_700Bold" },
  spotSpecies: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginTop: 1 },

  urgencyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  urgencyText: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },

  whyBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  whyText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },

  tacticGrid: { flexDirection: "row", gap: 8 },
  tacticItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  tacticItemFull: { flex: undefined, width: "100%" },
  tacticLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.8 },
  tacticValue: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2, lineHeight: 16 },

  rereadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  rereadText: { fontSize: 13, fontFamily: "Inter_500Medium" },

  rampSection: {
    gap: 8,
    paddingTop: 12,
    marginTop: 4,
    borderTopWidth: 1,
  },
  rampHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rampHeaderText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  rampName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  rampAccessRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    padding: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  rampAccessText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  rampBtnRow: {
    flexDirection: "row",
    gap: 8,
  },
  rampBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  rampBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});
