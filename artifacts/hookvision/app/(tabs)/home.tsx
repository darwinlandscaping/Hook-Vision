import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { LilyPadCard } from "@/components/LilyPadCard";
import { NarratorButton } from "@/components/NarratorButton";
import { useAutoNarrate } from "@/hooks/useAutoNarrate";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DailyConditions {
  date: string;
  darwinLocalTime: string;
  season: {
    name: string;
    emoji: string;
    fishingContext: string;
    waterTempRange: string;
    topTechnique: string;
  };
  moon: {
    name: string;
    emoji: string;
    illuminationPct: number;
    fishingRating: string;
  };
  weather: {
    tempC: number;
    apparentTempC: number;
    humidity: number;
    windDir: string;
    windSpeedKmh: number;
    pressureHpa: number;
    pressureTrend: string;
    conditions: string;
  } | null;
  barraActivity: string;
  sonarTip: string;
  aiBriefing: string;
  lastRefreshed: string;
}

// ─── Quick nav tiles ──────────────────────────────────────────────────────────

const TILES = [
  { label: "Barra\nNation",   emoji: "🎯", route: "/(tabs)/barra",    border: "#ff220055" },
  { label: "NT\nTides",       emoji: "🌊", route: "/(tabs)/tides",    border: "#00a8ff55" },
  { label: "Species\nGuide",  emoji: "🐟", route: "/(tabs)/species",  border: "#00d4aa55" },
  { label: "Fishy\nForecast", emoji: "🎣", route: "/(tabs)/forecast", border: "#ffd70055" },
  { label: "AI\nAnalyze",    emoji: "📡", route: "/(tabs)/index",    border: "#7986cb55" },
  { label: "Live\nCamera",    emoji: "📷", route: "/(tabs)/live",     border: "#ff980055" },
  { label: "Fishing\nZones",  emoji: "🗺️",  route: "/(tabs)/zones",    border: "#4caf5055" },
  { label: "Catch\nHistory",  emoji: "📖", route: "/(tabs)/history",  border: "#e91e6355" },
];

// ─── Darwin local time helper ─────────────────────────────────────────────────

function getDarwinTime() {
  const now = new Date();
  const hour = parseInt(
    now.toLocaleString("en-AU", { hour: "numeric", hour12: false, timeZone: "Australia/Darwin" }),
    10
  );
  const timeStr = now.toLocaleTimeString("en-AU", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Australia/Darwin",
  });
  const isGolden = (hour >= 5 && hour <= 8) || (hour >= 16 && hour <= 20);
  return { timeStr, isGolden };
}

// ─── Pulsing dot ─────────────────────────────────────────────────────────────

function LiveDot() {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.2, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [anim]);
  return (
    <Animated.View style={[S.liveDot, { opacity: anim }]} />
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === "web" ? 0 : insets.top;
  const darwin  = useMemo(getDarwinTime, []);

  const [conds, setConds]       = useState<DailyConditions | null>(null);
  const [loading, setLoading]   = useState(true);
  const [fetchErr, setFetchErr] = useState(false);

  useEffect(() => {
    const domain  = process.env.EXPO_PUBLIC_DOMAIN;
    const baseUrl = domain ? `https://${domain}` : "";
    fetch(`${baseUrl}/api/daily-conditions`)
      .then((r) => r.json())
      .then((d) => { setConds(d as DailyConditions); setLoading(false); })
      .catch(() => { setFetchErr(true); setLoading(false); });
  }, []);

  const narrate = conds
    ? `Welcome to HookVision. Today's NT conditions: ${conds.season.emoji} ${conds.season.name}. Moon: ${conds.moon.emoji} ${conds.moon.name}. ${conds.barraActivity.replace(/[^a-zA-Z0-9 .—!%\/]/g, "").trim()}. ${darwin.isGolden ? "Golden hour is active — prime feeding time right now!" : ""} Today's briefing: ${conds.aiBriefing}`
    : `Welcome to HookVision. Loading today's NT fishing conditions.`;

  useAutoNarrate(() => narrate);

  // Barra activity colour (score extracted from string like "✅ VERY GOOD (80/100)")
  const barraScore = conds ? (parseInt(conds.barraActivity.match(/\((\d+)\/100\)/)?.[1] ?? "0", 10)) : 0;
  const barraColor = barraScore >= 80 ? "#00d4aa" : barraScore >= 60 ? "#ffd700" : barraScore >= 40 ? "#ff9800" : "#ff2200";

  const lastRefreshedLabel = conds
    ? (() => {
        const d = new Date(conds.lastRefreshed);
        return d.toLocaleString("en-AU", { timeZone: "Australia/Darwin", hour: "2-digit", minute: "2-digit", hour12: true });
      })()
    : "";

  return (
    <ScrollView
      style={[S.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[S.content, { paddingTop: topPad + 12, paddingBottom: 100 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── HEADER ── */}
      <View style={S.header}>
        <View>
          <Text style={S.brand}>HOOK<Text style={S.brandAccent}>VISION</Text></Text>
          <View style={S.liveRow}>
            <LiveDot />
            <Text style={[S.tagline, { color: colors.mutedForeground }]}>
              {loading ? "Fetching live NT data…" : fetchErr ? "NT's #1 fishing intelligence app" : `Live data · Updated ${lastRefreshedLabel}`}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/index")}
          style={[S.analyzeBtn, { backgroundColor: "#00d4aa22", borderColor: "#00d4aa55" }]}
        >
          <MaterialCommunityIcons name="fish" size={18} color="#00d4aa" />
          <Text style={S.analyzeBtnText}>Analyze</Text>
        </TouchableOpacity>
      </View>

      {/* ── CONDITIONS STRIP (live data) ── */}
      {loading ? (
        <View style={[S.condStrip, { backgroundColor: colors.card, borderColor: colors.border, justifyContent: "center" }]}>
          <ActivityIndicator color="#00d4aa" style={{ paddingVertical: 14 }} />
        </View>
      ) : conds ? (
        <View style={[S.condStrip, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={S.condItem}>
            <Text style={S.condEmoji}>{conds.moon.emoji}</Text>
            <Text style={[S.condLabel, { color: colors.mutedForeground }]} numberOfLines={2}>{conds.moon.name}</Text>
            <Text style={[S.condSub, { color: "#ffd700" }]}>{conds.moon.illuminationPct}%</Text>
          </View>
          <View style={[S.condDivider, { backgroundColor: colors.border }]} />
          <View style={S.condItem}>
            <Text style={S.condEmoji}>{conds.season.emoji}</Text>
            <Text style={[S.condLabel, { color: colors.mutedForeground }]} numberOfLines={2}>{conds.season.name}</Text>
          </View>
          <View style={[S.condDivider, { backgroundColor: colors.border }]} />
          {conds.weather ? (
            <View style={S.condItem}>
              <Text style={S.condEmoji}>🌡️</Text>
              <Text style={[S.condLabel, { color: "#ff9800" }]}>{conds.weather.tempC}°C</Text>
              <Text style={[S.condSub, { color: colors.mutedForeground }]}>{conds.weather.windDir} {conds.weather.windSpeedKmh}km/h</Text>
            </View>
          ) : (
            <View style={S.condItem}>
              <Text style={S.condEmoji}>🕐</Text>
              <Text style={[S.condLabel, { color: colors.mutedForeground }]}>{darwin.timeStr}</Text>
            </View>
          )}
          <View style={[S.condDivider, { backgroundColor: colors.border }]} />
          <View style={[S.condItem, darwin.isGolden && S.goldenItem]}>
            <Text style={S.condEmoji}>⚡</Text>
            <Text style={[S.condLabel, { color: darwin.isGolden ? "#ffd700" : colors.mutedForeground }]} numberOfLines={2}>
              {darwin.isGolden ? "Golden\nHour!" : "Not\nGolden"}
            </Text>
          </View>
        </View>
      ) : (
        <View style={[S.condStrip, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[S.condLabel, { color: colors.mutedForeground, paddingVertical: 12, textAlign: "center", flex: 1 }]}>
            Conditions unavailable — check connection
          </Text>
        </View>
      )}

      {/* ── DAILY INTEL BRIEFING ── */}
      {conds && (
        <>
          <Text style={[S.sectionHead, { color: colors.mutedForeground }]}>DAILY INTEL BRIEFING</Text>
          <LilyPadCard innerStyle={S.briefingInner}>
            {/* Barra activity bar — compact single row */}
            <View style={S.activityRow}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={S.briefingLabel}>BARRA ACTIVITY</Text>
                <View style={S.activityBarBg}>
                  <View style={[S.activityBarFill, { width: `${barraScore}%` as any, backgroundColor: barraColor }]} />
                </View>
                <Text style={[S.activityLine, { color: barraColor }]} numberOfLines={1}>
                  {conds.barraActivity.replace(/^[^\s]+ /, "")}
                </Text>
              </View>
              <Text style={[S.activityScore, { color: barraColor }]}>{barraScore}<Text style={S.activityScoreSub}>/100</Text></Text>
            </View>

            {/* AI briefing + technique on same divider */}
            <View style={[S.divider, { backgroundColor: "#2d8c4733" }]} />
            <View style={S.briefingMeta}>
              <Feather name="cpu" size={11} color="#00d4aa" />
              <Text style={S.briefingMetaText}>AI BRIEFING · {conds.date}</Text>
              <View style={{ flex: 1 }} />
              <Feather name="target" size={11} color="#ffd700" />
              <Text style={[S.briefingMetaText, { color: "#ffd700" }]}>TECHNIQUE</Text>
            </View>
            <Text style={[S.briefingText, { color: colors.foreground }]}>{conds.aiBriefing}</Text>
            <Text style={[S.techniqueText, { color: colors.mutedForeground }]}>{conds.season.topTechnique}</Text>
          </LilyPadCard>
        </>
      )}

      {/* ── QUICK NAV ── */}
      <Text style={[S.sectionHead, { color: colors.mutedForeground }]}>QUICK ACCESS</Text>
      <View style={S.tileGrid}>
        {TILES.map((t) => (
          <LilyPadCard
            key={t.route}
            onPress={() => router.push(t.route as any)}
            borderColor={t.border}
            style={S.tile}
            innerStyle={S.tileInner}
          >
            <Text style={S.tileEmoji}>{t.emoji}</Text>
            <Text style={[S.tileLabel, { color: colors.foreground }]}>{t.label}</Text>
          </LilyPadCard>
        ))}
      </View>

      {/* ── SONAR TIP OF THE DAY ── */}
      {conds && (
        <>
          <Text style={[S.sectionHead, { color: colors.mutedForeground }]}>SONAR TIP OF THE DAY</Text>
          <LilyPadCard innerStyle={S.tipInner}>
            <View style={S.tipIconRow}>
              <MaterialCommunityIcons name="radar" size={16} color="#00d4aa" />
              <Text style={S.tipHeading}>EXPERT SONAR KNOWLEDGE</Text>
            </View>
            <Text style={[S.tipText, { color: colors.foreground }]}>{conds.sonarTip}</Text>
          </LilyPadCard>
        </>
      )}

      {/* ── WEATHER DETAIL ── */}
      {conds?.weather && (
        <>
          <Text style={[S.sectionHead, { color: colors.mutedForeground }]}>DARWIN LIVE WEATHER</Text>
          <LilyPadCard innerStyle={S.weatherInner}>
            <View style={S.weatherGrid}>
              <WeatherCell emoji="🌡️" label="Air Temp"     value={`${conds.weather.tempC}°C`}            accent="#ff9800" />
              <WeatherCell emoji="🥵" label="Feels Like"   value={`${conds.weather.apparentTempC}°C`}     accent="#ff6422" />
              <WeatherCell emoji="💧" label="Humidity"     value={`${conds.weather.humidity}%`}           accent="#00a8ff" />
              <WeatherCell emoji="💨" label="Wind"         value={`${conds.weather.windDir} ${conds.weather.windSpeedKmh}km/h`} accent="#00d4aa" />
              <WeatherCell emoji="📊" label="Pressure"     value={`${conds.weather.pressureHpa} hPa`}     accent="#7986cb" />
              <WeatherCell emoji="📈" label="Baro Trend"   value={conds.weather.pressureTrend === "falling" ? "Falling 🐟" : conds.weather.pressureTrend === "rising" ? "Rising" : "Steady"} accent={conds.weather.pressureTrend === "falling" ? "#00d4aa" : "#888"} />
            </View>
            <Text style={[S.weatherSource, { color: colors.mutedForeground }]}>
              Source: BOM Darwin Airport · {conds.darwinLocalTime}
            </Text>
          </LilyPadCard>
        </>
      )}

      {/* ── SEASON SUMMARY ── */}
      {conds && (
        <>
          <Text style={[S.sectionHead, { color: colors.mutedForeground }]}>SEASON SUMMARY</Text>
          <LilyPadCard innerStyle={S.seasonInner}>
            <View style={S.seasonHeaderRow}>
              <Text style={S.seasonBig}>{conds.season.emoji} {conds.season.name}</Text>
              <View style={S.moonPill}>
                <Text style={S.moonPillText}>{conds.moon.emoji} {conds.moon.name}</Text>
              </View>
            </View>
            <Text style={[S.seasonContext, { color: colors.foreground }]}>{conds.season.fishingContext}</Text>
            <View style={[S.waterRow]}>
              <Feather name="thermometer" size={12} color="#00a8ff" />
              <Text style={[S.waterText, { color: colors.mutedForeground }]}>Water temp: {conds.season.waterTempRange}</Text>
            </View>
            <View style={S.waterRow}>
              <Feather name="moon" size={12} color="#ffd700" />
              <Text style={[S.waterText, { color: colors.mutedForeground }]}>{conds.moon.fishingRating}</Text>
            </View>
          </LilyPadCard>
        </>
      )}

      <NarratorButton
        pageType="home"
        content={narrate}
      />
    </ScrollView>
  );
}

// ─── Weather cell ─────────────────────────────────────────────────────────────

function WeatherCell({ emoji, label, value, accent }: { emoji: string; label: string; value: string; accent: string }) {
  return (
    <View style={S.weatherCell}>
      <Text style={S.weatherCellEmoji}>{emoji}</Text>
      <Text style={[S.weatherCellValue, { color: accent }]}>{value}</Text>
      <Text style={S.weatherCellLabel}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 14, gap: 14 },

  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  brand: { fontSize: 32, fontFamily: "Oswald_700Bold", color: "#ffffff", letterSpacing: 1 },
  brandAccent: { color: "#00d4aa" },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#00d4aa" },
  tagline: { fontSize: 11, fontFamily: "Inter_400Regular" },
  analyzeBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  analyzeBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#00d4aa" },

  condStrip: { flexDirection: "row", borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  condItem: { flex: 1, alignItems: "center", paddingVertical: 10, gap: 2 },
  condEmoji: { fontSize: 16 },
  condLabel: { fontSize: 9, fontFamily: "Inter_500Medium", textAlign: "center" },
  condSub: { fontSize: 8, fontFamily: "Inter_400Regular" },
  condDivider: { width: 1 },
  goldenItem: { backgroundColor: "#ffd70011" },

  sectionHead: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1.2, marginTop: 4 },

  briefingInner: { padding: 10, gap: 7 },
  briefingLabel: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#00d4aa", letterSpacing: 1 },
  activityRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  activityScore: { fontSize: 26, fontFamily: "Oswald_700Bold", lineHeight: 28 },
  activityScoreSub: { fontSize: 12, fontFamily: "Oswald_700Bold", opacity: 0.6 },
  activityBarBg: { height: 5, backgroundColor: "#1a2e1a", borderRadius: 3, overflow: "hidden" },
  activityBarFill: { height: "100%", borderRadius: 3 },
  activityLine: { fontSize: 11, fontFamily: "Inter_500Medium" },
  divider: { height: 1 },
  briefingMeta: { flexDirection: "row", alignItems: "center", gap: 5 },
  briefingMetaText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#00d4aa", letterSpacing: 0.8 },
  briefingText: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  techniqueText: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16, fontStyle: "italic" },

  tileGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { width: "22%", flexGrow: 1, aspectRatio: 0.9 },
  tileInner: { flex: 1, alignItems: "center", justifyContent: "center", padding: 8, gap: 6 },
  tileEmoji: { fontSize: 24 },
  tileLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", textAlign: "center", lineHeight: 13 },

  tipInner: { padding: 14, gap: 8 },
  tipIconRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  tipHeading: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#00d4aa", letterSpacing: 0.8 },
  tipText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },

  weatherInner: { padding: 12, gap: 10 },
  weatherGrid: { flexDirection: "row", flexWrap: "wrap", gap: 0 },
  weatherCell: { width: "33.33%", alignItems: "center", paddingVertical: 10, gap: 3 },
  weatherCellEmoji: { fontSize: 18 },
  weatherCellValue: { fontSize: 13, fontFamily: "Inter_700Bold" },
  weatherCellLabel: { fontSize: 9, fontFamily: "Inter_400Regular", color: "#666" },
  weatherSource: { fontSize: 9, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 4 },

  seasonInner: { padding: 14, gap: 8 },
  seasonHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 },
  seasonBig: { fontSize: 16, fontFamily: "Oswald_700Bold", color: "#fff" },
  moonPill: { backgroundColor: "#ffd70022", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: "#ffd70044" },
  moonPillText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#ffd700" },
  seasonContext: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  waterRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  waterText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },
});
