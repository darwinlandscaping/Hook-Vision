import React, { useMemo } from "react";
import {
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
import { LilyPadCard, LP_BG, LP_BORDER } from "@/components/LilyPadCard";
import { NarratorButton } from "@/components/NarratorButton";
import { useAutoNarrate } from "@/hooks/useAutoNarrate";

// ─── Moon / season helpers (inline to avoid cross-tab imports) ────────────────
function getMoonPhase(date: Date) {
  const knownNew = new Date("2000-01-06T18:14:00Z");
  const cycle = 29.530588853;
  const diff = (date.getTime() - knownNew.getTime()) / 86400000;
  const day = ((diff % cycle) + cycle) % cycle;
  const phases = [
    { name: "New Moon", emoji: "🌑", tideType: "Spring" },
    { name: "Waxing Crescent", emoji: "🌒", tideType: "Neap" },
    { name: "First Quarter", emoji: "🌓", tideType: "Neap" },
    { name: "Waxing Gibbous", emoji: "🌔", tideType: "Neap" },
    { name: "Full Moon", emoji: "🌕", tideType: "Spring" },
    { name: "Waning Gibbous", emoji: "🌖", tideType: "Neap" },
    { name: "Last Quarter", emoji: "🌗", tideType: "Neap" },
    { name: "Waning Crescent", emoji: "🌘", tideType: "Neap" },
  ];
  return { ...phases[Math.floor((day / cycle) * 8) % 8], day: Math.round(day) };
}

function getNTSeason(month: number) {
  if (month >= 11 || month <= 3) return { name: "Wet Season", short: "Wet 💧", waterTemp: "28–32°C", color: "#00a8ff" };
  if (month >= 4 && month <= 5) return { name: "Build-up", short: "Build-up ⚡", waterTemp: "26–30°C", color: "#ffd700" };
  return { name: "Dry Season", short: "Dry ☀️", waterTemp: "22–26°C", color: "#00d4aa" };
}

function getDarwinTime() {
  const now = new Date();
  const darwinHour = parseInt(now.toLocaleString("en-AU", { hour: "numeric", hour12: false, timeZone: "Australia/Darwin" }), 10);
  const timeStr = now.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Australia/Darwin" });
  const isGolden = (darwinHour >= 5 && darwinHour <= 8) || (darwinHour >= 16 && darwinHour <= 20);
  return { hour: darwinHour, timeStr, isGolden };
}

// ─── Quick nav tiles ───────────────────────────────────────────────────────────
const TILES = [
  { label: "Barra\nNation",  emoji: "🎯", route: "/(tabs)/barra",    color: "#ff2200", border: "#ff220055" },
  { label: "NT\nTides",      emoji: "🌊", route: "/(tabs)/tides",    color: "#00a8ff", border: "#00a8ff55" },
  { label: "Species\nGuide", emoji: "🐟", route: "/(tabs)/species",  color: "#00d4aa", border: "#00d4aa55" },
  { label: "Fishy\nForecast",emoji: "🎣", route: "/(tabs)/forecast", color: "#ffd700", border: "#ffd70055" },
  { label: "AI\nAnalyze",   emoji: "📡", route: "/(tabs)/index",    color: "#7986cb", border: "#7986cb55" },
  { label: "Live\nCamera",   emoji: "📷", route: "/(tabs)/live",     color: "#ff9800", border: "#ff980055" },
  { label: "Fishing\nZones", emoji: "🗺️", route: "/(tabs)/zones",    color: "#4caf50", border: "#4caf5055" },
  { label: "Catch\nHistory", emoji: "📖", route: "/(tabs)/history",  color: "#e91e63", border: "#e91e6355" },
];

// ─── Tips ──────────────────────────────────────────────────────────────────────
const TIPS = [
  "Barramundi are ambush predators — work structure edges slowly at dawn.",
  "Golden hour: barra feeding activity spikes in the first 90 mins of light.",
  "Spring tides (full & new moon) push bait fish into shallows — follow them.",
  "In the Wet season, target creek mouths after rain when fresh water flows in.",
  "Vary your retrieve speed; barra will often follow then eat on a pause.",
  "Rocky bars and submerged timber hold barra all year — don't skip structure.",
  "Light leaders in clear Dry water. Heavy leaders in snaggy Wet season habitat.",
];

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 0 : insets.top;

  const now    = new Date();
  const month  = now.getMonth() + 1;
  const moon   = useMemo(() => getMoonPhase(now), []);
  const season = useMemo(() => getNTSeason(month), [month]);
  const darwin = useMemo(getDarwinTime, []);
  const tip    = useMemo(() => TIPS[now.getDate() % TIPS.length], []);

  useAutoNarrate(() =>
    `Welcome to HookVision. Today is ${season.name} in the NT. ${moon.emoji} ${moon.name} — ${moon.tideType} tides. ${darwin.isGolden ? "Golden hour is active — prime feeding time right now!" : `Local Darwin time is ${darwin.timeStr}.`} Tip of the day: ${tip}`
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 12, paddingBottom: 100 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── HEADER ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>HOOK<Text style={styles.brandAccent}>VISION</Text></Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground }]}>NT's #1 fishing intelligence app</Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/(tabs)/index")} style={[styles.analyzeBtn, { backgroundColor: "#00d4aa22", borderColor: "#00d4aa55" }]}>
          <MaterialCommunityIcons name="fish" size={18} color="#00d4aa" />
          <Text style={styles.analyzeBtnText}>Analyze</Text>
        </TouchableOpacity>
      </View>

      {/* ── CONDITIONS STRIP ── */}
      <View style={[styles.condStrip, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.condItem}>
          <Text style={styles.condEmoji}>{moon.emoji}</Text>
          <Text style={[styles.condLabel, { color: colors.mutedForeground }]}>{moon.name}</Text>
        </View>
        <View style={[styles.condDivider, { backgroundColor: colors.border }]} />
        <View style={styles.condItem}>
          <Text style={styles.condEmoji}>☀️</Text>
          <Text style={[styles.condLabel, { color: colors.mutedForeground }]}>{season.short}</Text>
        </View>
        <View style={[styles.condDivider, { backgroundColor: colors.border }]} />
        <View style={styles.condItem}>
          <Text style={styles.condEmoji}>🕐</Text>
          <Text style={[styles.condLabel, { color: colors.mutedForeground }]}>{darwin.timeStr}</Text>
        </View>
        <View style={[styles.condDivider, { backgroundColor: colors.border }]} />
        <View style={[styles.condItem, darwin.isGolden && styles.goldenItem]}>
          <Text style={styles.condEmoji}>⚡</Text>
          <Text style={[styles.condLabel, { color: darwin.isGolden ? "#ffd700" : colors.mutedForeground }]}>
            {darwin.isGolden ? "Golden Hour!" : "Not Golden"}
          </Text>
        </View>
      </View>

      {/* ── QUICK NAV ── */}
      <Text style={[styles.sectionHead, { color: colors.mutedForeground }]}>QUICK ACCESS</Text>
      <View style={styles.tileGrid}>
        {TILES.map((t) => (
          <LilyPadCard
            key={t.route}
            onPress={() => router.push(t.route as any)}
            borderColor={t.border}
            style={styles.tile}
            innerStyle={styles.tileInner}
          >
            <Text style={styles.tileEmoji}>{t.emoji}</Text>
            <Text style={[styles.tileLabel, { color: colors.foreground }]}>{t.label}</Text>
          </LilyPadCard>
        ))}
      </View>

      {/* ── TIP OF THE DAY ── */}
      <Text style={[styles.sectionHead, { color: colors.mutedForeground }]}>TIP OF THE DAY</Text>
      <LilyPadCard innerStyle={styles.tipInner}>
        <View style={styles.tipIconRow}>
          <Feather name="zap" size={16} color="#00d4aa" />
          <Text style={styles.tipHeading}>FISHING TIP</Text>
        </View>
        <Text style={[styles.tipText, { color: colors.foreground }]}>{tip}</Text>
      </LilyPadCard>

      {/* ── SEASON BADGE ── */}
      <LilyPadCard innerStyle={styles.seasonInner}>
        <View style={styles.seasonRow}>
          <View style={[styles.seasonBadge, { backgroundColor: `${season.color}22`, borderColor: `${season.color}55` }]}>
            <Text style={[styles.seasonBadgeText, { color: season.color }]}>{season.short}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.seasonTitle, { color: colors.foreground }]}>{season.name}</Text>
            <Text style={[styles.seasonSub, { color: colors.mutedForeground }]}>Water: {season.waterTemp} · Moon: {moon.name} (Day {moon.day})</Text>
          </View>
          <View style={[styles.tideBadge, { backgroundColor: moon.tideType === "Spring" ? "#ffd70022" : "#00d4aa22" }]}>
            <Text style={[styles.tideText, { color: moon.tideType === "Spring" ? "#ffd700" : "#00d4aa" }]}>
              {moon.tideType === "Spring" ? "🌊 Spring" : "🔵 Neap"} Tides
            </Text>
          </View>
        </View>
      </LilyPadCard>

      <NarratorButton
        pageType="home"
        content={`HookVision home. ${season.name} in the NT. ${moon.emoji} ${moon.name}, ${moon.tideType} tides. ${darwin.isGolden ? "Golden hour is active." : ""}  Tip: ${tip}`}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 14, gap: 14 },

  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  brand: { fontSize: 32, fontFamily: "Oswald_700Bold", color: "#ffffff", letterSpacing: 1 },
  brandAccent: { color: "#00d4aa" },
  tagline: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  analyzeBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  analyzeBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#00d4aa" },

  condStrip: { flexDirection: "row", borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  condItem: { flex: 1, alignItems: "center", paddingVertical: 10, gap: 3 },
  condEmoji: { fontSize: 16 },
  condLabel: { fontSize: 9, fontFamily: "Inter_500Medium", textAlign: "center" },
  condDivider: { width: 1 },
  goldenItem: { backgroundColor: "#ffd70011" },

  sectionHead: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1.2, marginTop: 4 },

  tileGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { width: "22%", flexGrow: 1, aspectRatio: 0.9 },
  tileInner: { flex: 1, alignItems: "center", justifyContent: "center", padding: 8, gap: 6 },
  tileEmoji: { fontSize: 24 },
  tileLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", textAlign: "center", lineHeight: 13 },

  tipInner: { padding: 14, gap: 8 },
  tipIconRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  tipHeading: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#00d4aa", letterSpacing: 0.8 },
  tipText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },

  seasonInner: { padding: 12 },
  seasonRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  seasonBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  seasonBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  seasonTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  seasonSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  tideBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  tideText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
});
