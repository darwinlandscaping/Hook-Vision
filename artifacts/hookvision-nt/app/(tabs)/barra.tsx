import React, { useCallback, useEffect, useMemo, useState, Component } from "react";
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

import { HVHeader } from "@/components/HVHeader";
import { LilyPadCard, LP_BG, LP_BORDER } from "@/components/LilyPadCard";
import { useColors } from "@/hooks/useColors";
import { NarratorButton } from "@/components/NarratorButton";
import { NarratorSettingsTrigger } from "@/components/NarratorSettings";
import { useAutoNarrate } from "@/hooks/useAutoNarrate";

// ─── Moon phase ────────────────────────────────────────────────────────────────
function getMoonPhase(date: Date): { name: string; day: number; tideType: string; emoji: string } {
  const knownNew = new Date("2000-01-06T18:14:00Z").getTime();
  const cycle = 29.53058867;
  const d = ((( date.getTime() - knownNew) / 86400000) % cycle + cycle) % cycle;
  if (d < 1.85)  return { name: "New Moon",       day: d, tideType: "spring", emoji: "🌑" };
  if (d < 7.38)  return { name: "Waxing Crescent", day: d, tideType: "normal", emoji: "🌒" };
  if (d < 9.22)  return { name: "First Quarter",   day: d, tideType: "neap",   emoji: "🌓" };
  if (d < 14.77) return { name: "Waxing Gibbous",  day: d, tideType: "normal", emoji: "🌔" };
  if (d < 16.61) return { name: "Full Moon",        day: d, tideType: "spring", emoji: "🌕" };
  if (d < 22.15) return { name: "Waning Gibbous",  day: d, tideType: "normal", emoji: "🌖" };
  if (d < 23.99) return { name: "Last Quarter",     day: d, tideType: "neap",   emoji: "🌗" };
  return          { name: "Waning Crescent",        day: d, tideType: "normal", emoji: "🌘" };
}
function getNTSeason(m: number): { name: string; waterTemp: string; short: string } {
  if (m >= 5 && m <= 9)  return { name: "Dry Season",  waterTemp: "24–27°C", short: "Dry" };
  if (m === 10 || m === 11) return { name: "Build-Up", waterTemp: "28–31°C", short: "Build-Up" };
  return { name: "Wet Season", waterTemp: "29–32°C", short: "Wet" };
}

// ─── Million Dollar Fish ───────────────────────────────────────────────────────
interface MDFSeason { year: string; start: Date; end: Date; prize1M: string; prize100K: string; prizes10K: number; url: string; }
function getMDFStatus(): { season: MDFSeason; active: boolean; daysUntil: number; daysLeft: number } {
  const seasons: MDFSeason[] = [
    { year: "2025/26", start: new Date("2025-10-01"), end: new Date("2026-03-31"),
      prize1M: "$1,000,000", prize100K: "$100,000", prizes10K: 10,
      url: "https://www.milliondollarfish.com.au" },
    { year: "2026/27", start: new Date("2026-10-01"), end: new Date("2027-03-31"),
      prize1M: "$1,000,000", prize100K: "$100,000", prizes10K: 10,
      url: "https://www.milliondollarfish.com.au" },
  ];
  const now = Date.now();
  const current = seasons.find((s) => now >= s.start.getTime() && now <= s.end.getTime());
  if (current) {
    const daysLeft = Math.ceil((current.end.getTime() - now) / 86400000);
    return { season: current, active: true, daysUntil: 0, daysLeft };
  }
  const next = seasons.find((s) => s.start.getTime() > now) ?? seasons[seasons.length - 1];
  const daysUntil = Math.ceil((next.start.getTime() - now) / 86400000);
  return { season: next, active: false, daysUntil, daysLeft: 0 };
}

// ─── Real-time hot spots engine ───────────────────────────────────────────────
interface HotSpot {
  name: string; river: string; region: string;
  lure: string; species: string; tip: string;
  score: number; reason: string; emoji: string;
  isSpring: boolean; isGoldHour: boolean;
}
const SPOT_POOL = [
  { name: "Shady Camp Rock Bar",    river: "Mary River",        region: "Mary River",     lure: "Surface walker 100mm", species: "Barra 70–100cm+",     emoji: "🪨", bestMoon: ["spring"], bestSeason: ["Dry","Build-Up"], tidal: true,  baseScore: 88 },
  { name: "Cahills Crossing",       river: "East Alligator R.", region: "Kakadu",          lure: "Heavy hard-body 100mm",species: "Barra + Jack",         emoji: "🏞️", bestMoon: ["spring"], bestSeason: ["Dry"],            tidal: true,  baseScore: 85 },
  { name: "Roper Bar",              river: "Roper River",       region: "Gulf Coast",      lure: "Surface walker 80mm",  species: "Barra 60–100cm+",     emoji: "🌊", bestMoon: ["spring"], bestSeason: ["Dry"],            tidal: true,  baseScore: 84 },
  { name: "King Ash Bay Rock Bar",  river: "McArthur River",    region: "Gulf Coast",      lure: "Metal slice 40g",      species: "Barra + Threadfin",   emoji: "⚓", bestMoon: ["spring"], bestSeason: ["Dry"],            tidal: true,  baseScore: 83 },
  { name: "South Alligator Mouth", river: "South Alligator R.",region: "Kakadu",          lure: "Popper 80mm",          species: "Barra + Threadfin",   emoji: "🦆", bestMoon: ["any"],    bestSeason: ["Dry","Build-Up"], tidal: true,  baseScore: 80 },
  { name: "Daly River Mouth",       river: "Daly River",        region: "Daly River",      lure: "Surface walker 80mm",  species: "Barra + Jack",         emoji: "🎣", bestMoon: ["any"],    bestSeason: ["Dry"],            tidal: true,  baseScore: 79 },
  { name: "Mary River Mouth",       river: "Mary River",        region: "Mary River",      lure: "Metal slice 40g",      species: "Barra + Threadfin",   emoji: "🌊", bestMoon: ["any"],    bestSeason: ["Dry","Build-Up"], tidal: true,  baseScore: 78 },
  { name: "Woolianna Pool",         river: "Daly River",        region: "Daly River",      lure: "Hard-body minnow 80mm",species: "Barra 60–90cm",       emoji: "🌿", bestMoon: ["any"],    bestSeason: ["Wet","Build-Up"], tidal: false, baseScore: 72 },
  { name: "Adelaide River Mouth",   river: "Adelaide River",    region: "Adelaide River",  lure: "Rattling hard-body",   species: "Barra + Queenfish",   emoji: "🐊", bestMoon: ["spring"], bestSeason: ["Dry"],            tidal: true,  baseScore: 76 },
  { name: "Victoria River Mouth",   river: "Victoria River",    region: "Victoria River",  lure: "Surface walker 120mm", species: "Barra + Threadfin",   emoji: "🌄", bestMoon: ["spring"], bestSeason: ["Dry"],            tidal: true,  baseScore: 74 },
  { name: "Bynoe Harbour Creeks",   river: "Bynoe Harbour",     region: "Darwin Area",     lure: "Deep-diver 80mm",      species: "Barra + Jack",         emoji: "⚓", bestMoon: ["any"],    bestSeason: ["Dry"],            tidal: true,  baseScore: 70 },
  { name: "Darwin Harbour Channel", river: "Darwin Harbour",    region: "Darwin Area",     lure: "Soft plastic 4\"",     species: "Barra + GT",           emoji: "🌅", bestMoon: ["any"],    bestSeason: ["any"],            tidal: true,  baseScore: 68 },
];

function calcHotSpots(moon: ReturnType<typeof getMoonPhase>, season: ReturnType<typeof getNTSeason>, darwinHour: number): HotSpot[] {
  const isGoldHour = (darwinHour >= 5 && darwinHour <= 8) || (darwinHour >= 16 && darwinHour <= 20);
  const isSpringTide = moon.tideType === "spring";

  return SPOT_POOL
    .map((s) => {
      let score = s.baseScore;
      if (s.bestMoon.includes("spring") && isSpringTide) score += 18;
      if (s.bestSeason.includes(season.short) || s.bestSeason.includes("any")) score += 12;
      if (isGoldHour) score += 10;
      if (s.tidal && isSpringTide) score += 8;
      const reasons: string[] = [];
      if (isSpringTide && s.bestMoon.includes("spring")) reasons.push(`${moon.name} spring tides`);
      if (isGoldHour) reasons.push("golden hour");
      if (s.bestSeason.includes(season.short)) reasons.push(season.short + " prime");
      return {
        name: s.name, river: s.river, region: s.region,
        lure: s.lure, species: s.species, tip: "", emoji: s.emoji,
        score, isSpring: isSpringTide, isGoldHour,
        reason: reasons.length ? reasons.join(" · ") : "season conditions",
      } as HotSpot;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

// ─── Barra Nationals ──────────────────────────────────────────────────────────
const BARRA_COMPS = [
  {
    name: "Million Dollar Fish",
    host: "Tourism NT",
    emoji: "💰",
    color: "#ffd700",
    description: "Tagged barra in NT waterways. Catch a tagged fish and win $1M, $100K or $10K prizes.",
    dates: "Oct 1 – Mar 31 annually",
    website: "https://www.milliondollarfish.com.au",
    highlight: "Jackpot fish worth $1,000,000",
  },
  {
    name: "NT Barra Fishing Nationals",
    host: "NT Fishing Federation",
    emoji: "🏆",
    color: "#ff2200",
    description: "NT's premier barramundi competition. Categories include Open, Women's, Junior and Kayak divisions.",
    dates: "Usually July–August (Dry Season)",
    website: "https://www.ntfishing.com.au",
    highlight: "Multiple divisions & major prizes",
  },
  {
    name: "Darwin Harbour Barra Bash",
    host: "Darwin Waterfront",
    emoji: "🌅",
    color: "#00a8ff",
    description: "Annual Darwin CBD competition targeting barra in the harbour. Great for families.",
    dates: "June each year",
    website: "https://www.darwin.nt.gov.au",
    highlight: "Catch & release categories",
  },
  {
    name: "Borroloola Barra Classic",
    host: "King Ash Bay Fishing Club",
    emoji: "🌊",
    color: "#00d4aa",
    description: "Remote Gulf classic from the iconic King Ash Bay ramp. Threadfin salmon also targeted.",
    dates: "August (Dry Season)",
    website: "https://www.kingashbayfishingclub.com.au",
    highlight: "Most remote NT comp — 1000km from Darwin",
  },
];

// ─── Barra facts ───────────────────────────────────────────────────────────────
const BARRA_FACTS = [
  { emoji: "🔄", fact: "Barramundi are protandrous hermaphrodites — they're born male and become female after about 5 years." },
  { emoji: "📏", fact: "Large female barra are the big egg producers. A 90cm fish produces far more eggs than two 65cm fish combined." },
  { emoji: "🌧️", fact: "In the NT, barramundi spawn during the Wet Season (Nov–Mar) in tidal estuaries." },
  { emoji: "⚡", fact: "Barra can accelerate from 0 to full speed in milliseconds — their strike is one of the fastest in Australian freshwater fishing." },
  { emoji: "👁️", fact: "Barramundi have exceptional low-light vision, which is why dawn/dusk fishing is so productive." },
  { emoji: "🌊", fact: "NT barramundi can move 300km+ during their lifetime between freshwater and saltwater." },
  { emoji: "🦈", fact: "A big barra will eat anything that fits in its mouth, including small birds, lizards, and even other barra." },
];

// ─── Types ─────────────────────────────────────────────────────────────────────
interface TideEntry { time: string; type: "HW" | "LW"; height: number; timestamp: number; }
interface BarraPrediction {
  rank: number; river: string; spot: string; targetDepth: string;
  why: string; lure: string; rig: string; technique: string;
  confidence: "HIGH" | "MEDIUM" | "LOW"; windowHours: number; windowNote: string;
}
interface BarraResult { predictions: BarraPrediction[]; bigPictureRead: string; topDepth: string; topTechnique: string; isFallback?: boolean; }

const CONF = {
  HIGH:   { color: "#ff2200", label: "HIGH",   emoji: "🎯", bg: "#ff220018" },
  MEDIUM: { color: "#ff8c00", label: "MEDIUM", emoji: "⚡", bg: "#ff8c0018" },
  LOW:    { color: "#4a9eff", label: "LOW",    emoji: "🎣", bg: "#4a9eff18" },
};

// ─── Tide helpers & card ───────────────────────────────────────────────────────
function getTidalPhase(
  minutesUntil: number | null,
  tideType: "HW" | "LW" | null,
): { label: string; color: string; bg: string; emoji: string } {
  if (minutesUntil === null || tideType === null) {
    return { label: "LOADING", color: "#888888", bg: "#88888818", emoji: "🌊" };
  }
  if (Math.abs(minutesUntil) <= 35) {
    return { label: "SLACK TIDE", color: "#ff8c00", bg: "#ff8c0018", emoji: "⚖️" };
  }
  if (tideType === "HW") {
    return { label: "INCOMING", color: "#00d4aa", bg: "#00d4aa18", emoji: "↗️" };
  }
  return { label: "OUTGOING", color: "#4a9eff", bg: "#4a9eff18", emoji: "↘️" };
}

function formatCountdown(absMinutes: number): string {
  if (absMinutes < 60) return `${absMinutes} min`;
  const h = Math.floor(absMinutes / 60);
  const m = absMinutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function DarwinTideCard({
  nextTide,
  tidesError,
  onRetry,
  colors,
}: {
  nextTide: TideEntry | null;
  tidesError: boolean;
  onRetry: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const minutesUntil = nextTide ? Math.round((nextTide.timestamp - nowMs) / 60000) : null;
  const phase = getTidalPhase(minutesUntil, nextTide?.type ?? null);
  const isHW = nextTide?.type === "HW";
  const tideColor = isHW ? "#ff2200" : "#4a9eff";
  const isPast = minutesUntil !== null && minutesUntil < 0;

  return (
    <LilyPadCard borderColor={`${phase.color}44`} borderLeftColor={phase.color} innerStyle={{ padding: 12, gap: 10 }}>
      <View style={styles.tideCardHeader}>
        <MaterialCommunityIcons name="waves" size={18} color={phase.color} />
        <Text style={[styles.tideCardTitle, { color: colors.foreground }]}>DARWIN TIDES</Text>
        <View style={[styles.tidePhaseBadge, { backgroundColor: phase.bg, borderColor: `${phase.color}55` }]}>
          <Text style={[styles.tidePhaseText, { color: phase.color }]}>{phase.emoji} {phase.label}</Text>
        </View>
      </View>

      {nextTide && minutesUntil !== null ? (
        <View style={styles.tideCardBody}>
          <View style={styles.tideMainBlock}>
            <Text style={[styles.tideTypeLabel, { color: colors.mutedForeground }]}>
              {isPast ? "LAST" : "NEXT"} {isHW ? "HIGH" : "LOW"} TIDE
            </Text>
            <View style={styles.tideMainRow}>
              <Text style={[styles.tideHeight, { color: tideColor }]}>{nextTide.height.toFixed(1)}m</Text>
              <View style={[styles.tideTypePill, { backgroundColor: `${tideColor}22`, borderColor: `${tideColor}44` }]}>
                <Text style={[styles.tideTypePillText, { color: tideColor }]}>{isHW ? "HIGH" : "LOW"}</Text>
              </View>
            </View>
            <Text style={[styles.tideTime, { color: colors.foreground }]}>{nextTide.time}</Text>
          </View>

          <View style={[styles.tideCountdownBlock, { borderColor: colors.border }]}>
            <Text style={[styles.tideCountdownLabel, { color: colors.mutedForeground }]}>
              {isPast ? "AGO" : "IN"}
            </Text>
            <Text style={[styles.tideCountdownNum, { color: phase.color }]}>
              {formatCountdown(Math.abs(minutesUntil))}
            </Text>
            <MaterialCommunityIcons
              name={isHW ? "arrow-up-bold" : "arrow-down-bold"}
              size={18}
              color={tideColor}
            />
          </View>
        </View>
      ) : (
        tidesError ? (
          <TouchableOpacity style={styles.tideLoadingRow} onPress={onRetry} activeOpacity={0.7}>
            <Feather name="refresh-cw" size={14} color="#ff8c00" />
            <Text style={[styles.tideLoadingText, { color: "#ff8c00" }]}>Tides unavailable — tap to retry</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.tideLoadingRow}>
            <ActivityIndicator size="small" color={colors.mutedForeground} />
            <Text style={[styles.tideLoadingText, { color: colors.mutedForeground }]}>Fetching Darwin tide data…</Text>
          </View>
        )
      )}

      <Text style={[styles.tideSource, { color: colors.mutedForeground }]}>
        Darwin Harbour · BOM port Darwin
      </Text>
    </LilyPadCard>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function SectionTitle({ emoji, label, sub, color = "#ff2200" }: { emoji: string; label: string; sub?: string; color?: string }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionEmoji}>{emoji}</Text>
      <View>
        <Text style={[styles.sectionLabel, { color }]}>{label}</Text>
        {sub && <Text style={styles.sectionSub}>{sub}</Text>}
      </View>
    </View>
  );
}

function BigRedButton({ onPress, loading }: { onPress: () => void; loading: boolean }) {
  const scale = useSharedValue(1);
  const glow  = useSharedValue(0.5);
  useEffect(() => {
    if (!loading) glow.value = withRepeat(withSequence(withTiming(1, { duration: 800 }), withTiming(0.5, { duration: 800 })), -1, false);
  }, [loading, glow]);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], shadowOpacity: glow.value }));
  return (
    <Animated.View style={[styles.bigBtnWrap, animStyle]}>
      <TouchableOpacity
        style={[styles.bigBtn, loading && styles.bigBtnLoading]}
        onPress={() => { scale.value = withSpring(0.93, {}, () => { scale.value = withSpring(1); }); onPress(); }}
        activeOpacity={0.85} disabled={loading}
      >
        {loading ? (
          <><ActivityIndicator color="#fff" size="large" /><Text style={styles.bigBtnText}>Scanning the depths...</Text></>
        ) : (
          <><Text style={styles.bigBtnIcon}>🎣</Text><Text style={styles.bigBtnText}>FIND BIG BARRA</Text><Text style={styles.bigBtnSub}>AI · 70cm+ trophy fish</Text></>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

function DepthMeter({ depth, colors }: { depth: string; colors: ReturnType<typeof useColors> }) {
  const match = depth.match(/([\d.]+)/g);
  const minD = match ? parseFloat(match[0]) : 0;
  const maxD = match && match[1] ? parseFloat(match[1]) : minD + 2;
  const topPct = (minD / 12) * 100; const fillPct = ((maxD - minD) / 12) * 100;
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

function PredCard({ pred, colors }: { pred: BarraPrediction; colors: ReturnType<typeof useColors> }) {
  const [open, setOpen] = useState(true);
  const c = CONF[pred.confidence] ?? CONF.MEDIUM;
  return (
    <View style={[styles.predCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: c.color, borderLeftWidth: 3 }]}>
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
          <View style={styles.depthWhyRow}>
            <DepthMeter depth={pred.targetDepth} colors={colors} />
            <View style={[styles.whyBox, { backgroundColor: "#ff220010", borderColor: "#ff220030" }]}>
              <MaterialCommunityIcons name="lightbulb-on" size={13} color="#ff2200" />
              <Text style={[styles.whyText, { color: colors.foreground }]}>{pred.why}</Text>
            </View>
          </View>
          <View style={[styles.windowRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="clock-fast" size={14} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.windowLabel, { color: colors.mutedForeground }]}>WINDOW: {pred.windowHours}h remaining</Text>
              <Text style={[styles.windowNote, { color: colors.foreground }]}>{pred.windowNote}</Text>
            </View>
          </View>
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

function TacticBox({ icon, label, value, colors, full }: { icon: string; label: string; value: string; colors: ReturnType<typeof useColors>; full?: boolean }) {
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

// ─── Million Dollar Fish Card ──────────────────────────────────────────────────
function MDFCard({ colors }: { colors: ReturnType<typeof useColors> }) {
  const { season, active, daysUntil, daysLeft } = useMemo(getMDFStatus, []);
  const scale  = useSharedValue(1);
  const rotate = useSharedValue(0);
  const wobble = useCallback(() => {
    scale.value = withSequence(withTiming(0.97, { duration: 75 }), withSpring(1.01, { damping: 4, stiffness: 280 }), withSpring(1, { damping: 12 }));
    rotate.value = withSequence(withTiming(-2.2, { duration: 65 }), withTiming(2.2, { duration: 65 }), withTiming(-1, { duration: 50 }), withTiming(1, { duration: 50 }), withSpring(0, { damping: 14 }));
  }, []);
  const mdfAnim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }, { rotate: `${rotate.value}deg` }] }));
  return (
    <Animated.View style={[styles.mdfCard, { borderColor: "#ffd700" }, mdfAnim]} onTouchStart={wobble}>
      <View style={styles.mdfGradient}>
        <View style={styles.mdfHeader}>
          <Text style={styles.mdfEmoji}>💰</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.mdfTitle}>MILLION DOLLAR FISH</Text>
            <Text style={styles.mdfHost}>Tourism NT · Season {season.year}</Text>
          </View>
          <View style={[styles.mdfStatusBadge, { backgroundColor: active ? "#00d4aa22" : "#ff220022", borderColor: active ? "#00d4aa" : "#ff2200" }]}>
            <Text style={[styles.mdfStatusText, { color: active ? "#00d4aa" : "#ff2200" }]}>
              {active ? "🟢 ACTIVE" : "⏳ OFF SEASON"}
            </Text>
          </View>
        </View>

        {active ? (
          <View style={styles.mdfCountdown}>
            <Text style={styles.mdfCountdownLabel}>SEASON ENDS IN</Text>
            <Text style={styles.mdfCountdownNum}>{daysLeft} DAYS</Text>
          </View>
        ) : (
          <View style={styles.mdfCountdown}>
            <Text style={styles.mdfCountdownLabel}>NEXT SEASON STARTS IN</Text>
            <Text style={styles.mdfCountdownNum}>{daysUntil} DAYS</Text>
            <Text style={styles.mdfCountdownSub}>Oct 1, {season.start.getFullYear()}</Text>
          </View>
        )}

        <View style={styles.mdfPrizes}>
          <View style={[styles.mdfPrize, { borderColor: "#ffd70066" }]}>
            <Text style={styles.mdfPrizeAmt}>$1,000,000</Text>
            <Text style={styles.mdfPrizeLabel}>JACKPOT FISH</Text>
          </View>
          <View style={[styles.mdfPrize, { borderColor: "#ffd70044" }]}>
            <Text style={styles.mdfPrizeAmt}>$100,000</Text>
            <Text style={styles.mdfPrizeLabel}>MAJOR FISH</Text>
          </View>
          <View style={[styles.mdfPrize, { borderColor: "#ffd70033" }]}>
            <Text style={styles.mdfPrizeAmt}>$10,000</Text>
            <Text style={styles.mdfPrizeLabel}>MINOR FISH ×10</Text>
          </View>
        </View>

        <Text style={styles.mdfHow}>
          Tagged barra are released across NT waterways. Register online, catch a tagged fish, win. Any legal barra caught in NT Oct–Mar could be worth $1 million.
        </Text>

        <TouchableOpacity
          style={styles.mdfBtn}
          onPress={() => Linking.openURL(season.url)}
          activeOpacity={0.8}
        >
          <Text style={styles.mdfBtnText}>Register & Learn More →</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ─── Hot spots card ────────────────────────────────────────────────────────────
function HotSpotsSection({ hotSpots, colors }: { hotSpots: HotSpot[]; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={{ gap: 8 }}>
      {hotSpots.map((spot, i) => (
        <LilyPadCard
          key={spot.name}
          borderColor={i === 0 ? "#00d4aa55" : LP_BORDER}
          borderLeftColor={i === 0 ? "#00d4aa" : spot.isSpring ? "#ffd700" : LP_BORDER}
          innerStyle={{ padding: 12, gap: 8 }}
        >
          <View style={styles.hotSpotHeader}>
            <View style={[styles.hotSpotRank, { backgroundColor: i === 0 ? "#00d4aa22" : "#ffffff11" }]}>
              <Text style={[styles.hotSpotRankNum, { color: i === 0 ? "#00d4aa" : colors.mutedForeground }]}>#{i + 1}</Text>
            </View>
            <Text style={styles.hotSpotEmoji}>{spot.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.hotSpotName, { color: colors.foreground }]}>{spot.name}</Text>
              <Text style={[styles.hotSpotRiver, { color: colors.mutedForeground }]}>{spot.river} · {spot.region}</Text>
            </View>
            <View style={[styles.hotScoreBadge, { backgroundColor: `${i === 0 ? "#00d4aa" : "#ffd700"}22` }]}>
              <Text style={[styles.hotScoreText, { color: i === 0 ? "#00d4aa" : "#ffd700" }]}>{spot.score}</Text>
            </View>
          </View>
          <View style={styles.hotSpotDetail}>
            <View style={[styles.hotSpotPill, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.hotSpotPillText, { color: colors.mutedForeground }]}>🐟 {spot.species}</Text>
            </View>
            <View style={[styles.hotSpotPill, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.hotSpotPillText, { color: colors.mutedForeground }]}>🎣 {spot.lure}</Text>
            </View>
          </View>
          {spot.reason && (
            <View style={[styles.hotSpotReason, { backgroundColor: "#00d4aa11" }]}>
              <Feather name="zap" size={11} color="#00d4aa" />
              <Text style={[styles.hotSpotReasonText, { color: "#00d4aa" }]}>Hot because: {spot.reason}</Text>
            </View>
          )}
        </LilyPadCard>
      ))}
    </View>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────
class BarraErrorBoundary extends Component<{ children: React.ReactNode }, { crashed: boolean; msg: string }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { crashed: false, msg: "" };
  }
  static getDerivedStateFromError(e: unknown) {
    const msg = (e instanceof Error) ? (e.message || e.toString() || "Unknown error") : String(e);
    return { crashed: true, msg };
  }
  componentDidCatch(e: unknown) { console.error("BARRA CRASH:", e); }
  render() {
    if (this.state.crashed) {
      return (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0a1628", padding: 24, gap: 16 }}>
          <Text style={{ color: "#ff2200", fontSize: 20, fontWeight: "bold" }}>⚠️ BARRA ERROR</Text>
          <Text style={{ color: "#ffd700", fontSize: 12, textAlign: "center", lineHeight: 18 }}>{this.state.msg}</Text>
          <TouchableOpacity
            onPress={() => this.setState({ crashed: false, msg: "" })}
            style={{ marginTop: 8, backgroundColor: "#ff220022", borderWidth: 1, borderColor: "#ff2200", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 24 }}
          >
            <Text style={{ color: "#ff2200", fontSize: 14, fontWeight: "700" }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

function BarraScreenInner() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 0 : insets.top;

  const now     = new Date();
  const month   = now.getMonth() + 1;
  const moon    = getMoonPhase(now);
  const season  = getNTSeason(month);
  const darwinHour = (() => {
    try {
      const raw = parseInt(now.toLocaleString("en-AU", { hour: "numeric", hour12: false, timeZone: "Australia/Darwin" }), 10);
      return isNaN(raw) ? now.getHours() : raw;
    } catch { return now.getHours(); }
  })();
  const isGoldHour = (darwinHour >= 5 && darwinHour <= 8) || (darwinHour >= 16 && darwinHour <= 20);
  const hotSpots = useMemo(() => calcHotSpots(moon, season, darwinHour), [moon.name, season.short, darwinHour]);

  const localTime = (() => {
    try {
      return now.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Australia/Darwin" });
    } catch { return now.toLocaleTimeString(); }
  })();

  const [nextTide, setNextTide] = useState<(TideEntry & { minutesUntil: number }) | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [tidesError, setTidesError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [result,   setResult]   = useState<BarraResult | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  useAutoNarrate(() => {
    const top = hotSpots[0];
    return `Savage Barra Nation. Your complete NT barramundi hub. Top hot spot right now: ${top.name} on the ${top.river}. ${moon.emoji} ${moon.name}, ${season.name}. ${isGoldHour ? "Golden hour — get out there now!" : "Fish are feeding. Check the hot spots."}`;
  });

  useEffect(() => {
    setTidesError(false);
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    const baseUrl = domain ? `https://${domain}` : "";
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    fetch(`${baseUrl}/api/tides?port=darwin&days=2`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        setIsOffline(false);
        const all: TideEntry[] = [];
        if (d.data) for (const day of d.data) for (const t of day.tides) all.push(t);
        const nowMs = Date.now();
        const next = all.filter((t) => t.timestamp > nowMs - 30 * 60000).sort((a, b) => a.timestamp - b.timestamp)[0];
        if (next) setNextTide({ ...next, minutesUntil: Math.round((next.timestamp - nowMs) / 60000) });
      }).catch((e: unknown) => { setTidesError(true); if (e instanceof TypeError) setIsOffline(true); })
      .finally(() => clearTimeout(timer));
  }, [retryCount]);

  const predict = useCallback(async () => {
    setLoading(true); setError(null); setResult(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      const baseUrl = domain ? `https://${domain}` : "";
      const resp = await fetch(`${baseUrl}/api/barra`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moonPhase: moon.name, moonDay: Math.round(moon.day), tideType: moon.tideType, season: season.name, month, waterTempRange: season.waterTemp, localTime, region: "nt", nextTide: nextTide ? { type: nextTide.type, height: nextTide.height, time: nextTide.time, minutesUntil: nextTide.minutesUntil } : null }),
        signal: ctrl.signal,
      });
      if (!resp.ok) throw new Error("Prediction failed");
      setResult(await resp.json());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setError("Couldn't run prediction. Check your connection and try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
      clearTimeout(timer);
    }
  }, [moon, season, month, nextTide, localTime]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 16, paddingBottom: Platform.OS === "web" ? 70 : insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      <HVHeader subtitle="Savage Barra Nation — NT's Barramundi Hub" />

      {isOffline && (
        <View style={{ backgroundColor: "#ff8c00", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ fontSize: 15 }}>📶</Text>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13, flex: 1 }}>No connection — live data unavailable. Connect to Wi-Fi or mobile data.</Text>
        </View>
      )}

      {/* Page title */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.titleRed}>SAVAGE</Text>
            <Text style={styles.titleGold}>BARRA NATION</Text>
          </View>
          <NarratorSettingsTrigger />
        </View>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          NT's complete barramundi hub · AI predictions · live hot spots · comps · records
        </Text>
      </View>

      <NarratorButton compact pageType="barra nation" content={`Savage Barra Nation. ${season.name}, ${moon.name}. Top hot spot right now: ${hotSpots[0].name} on the ${hotSpots[0].river}. ${isGoldHour ? "Golden hour — get out there now!" : "Fish are feeding."}`} />

      {/* Conditions strip */}
      <View style={[styles.condBar, { backgroundColor: colors.card, borderColor: moon.tideType === "spring" ? "#ffd700" : colors.border }]}>
        {[
          { e: moon.emoji, l: moon.name, hot: moon.tideType === "spring" },
          { e: "☀️", l: season.short, hot: false },
          { e: "🕐", l: localTime, hot: isGoldHour },
          { e: "🌡️", l: season.waterTemp, hot: false },
          { e: isGoldHour ? "⚡" : "🐟", l: isGoldHour ? "Golden Hour!" : "Fish on", hot: isGoldHour },
        ].map((item, i) => (
          <React.Fragment key={i}>
            {i > 0 && <View style={[styles.condDivider, { backgroundColor: colors.border }]} />}
            <View style={styles.condItem}>
              <Text style={styles.condEmoji}>{item.e}</Text>
              <Text style={[styles.condLabel, item.hot && { color: isGoldHour ? "#ffd700" : "#ff2200" }]}>{item.l}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>

      {/* ── MILLION DOLLAR FISH ── */}
      <MDFCard colors={colors} />

      {/* ── DARWIN TIDE CARD ── */}
      <DarwinTideCard nextTide={nextTide} tidesError={tidesError} onRetry={() => { setTidesError(false); setRetryCount(c => c + 1); }} colors={colors} />

      {/* ── AI TROPHY PREDICTOR ── */}
      <SectionTitle emoji="🎯" label="AI TROPHY PREDICTOR" sub="70cm+ fish · powered by 40yr NT data" color="#ff2200" />
      <BigRedButton onPress={predict} loading={loading} />

      {error && (
        <View style={[styles.errorBox, { backgroundColor: "#ff220015", borderColor: "#ff220040" }]}>
          <Feather name="alert-circle" size={16} color="#ff2200" />
          <Text style={[styles.errorText, { color: "#ff2200" }]}>{error}</Text>
        </View>
      )}

      {!result && !loading && !error && (
        <View style={[styles.hintBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.hintTitle, { color: colors.mutedForeground }]}>WHAT YOU'LL GET</Text>
          {[
            { e: "🎯", t: "Top 3 spots for 70cm+ barra right now" },
            { e: "📏", t: "Exact target depth per river based on tide & season" },
            { e: "🎣", t: "Lure, rig and retrieve technique" },
            { e: "📖", t: "Powered by 40 years of NT river netting records" },
          ].map(({ e, t }) => (
            <View key={t} style={styles.hintRow}>
              <Text style={styles.hintEmoji}>{e}</Text>
              <Text style={[styles.hintText, { color: colors.foreground }]}>{t}</Text>
            </View>
          ))}
        </View>
      )}

      {result && (
        <View style={{ gap: 14 }}>
          <View style={[styles.bigPicBox, { backgroundColor: colors.card, borderColor: "#ff2200" }]}>
            <Text style={styles.bigPicLabel}>TODAY'S READ</Text>
            <Text style={[styles.bigPicText, { color: colors.foreground }]}>{result.bigPictureRead}</Text>
          </View>
          {result.isFallback && (
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, backgroundColor: "#ff8c0015", borderRadius: 8, borderColor: "#ff8c0050", borderWidth: 1 }}>
              <Feather name="alert-triangle" size={14} color="#ff8c00" style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#ff8c00", fontSize: 12, fontWeight: "600" }}>AI temporarily unavailable</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 2 }}>These are general estimates — tap "Re-read conditions" to retry.</Text>
              </View>
            </View>
          )}
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
          <Text style={[styles.predsHeader, { color: colors.mutedForeground }]}>TOP 3 TROPHY PREDICTIONS</Text>
          {result.predictions.map((pred) => <PredCard key={pred.rank} pred={pred} colors={colors} />)}
          <NarratorButton
            pageType="trophy barra prediction"
            content={`${result.bigPictureRead} Top depth: ${result.topDepth}. ${result.predictions.map((p, i) => `${i + 1}. ${p.spot} on the ${p.river} — ${p.targetDepth} depth, ${p.confidence} confidence. ${p.why}`).join(" ")}`}
          />
          <TouchableOpacity style={[styles.rerunBtn, { borderColor: colors.border }]} onPress={predict} activeOpacity={0.7}>
            <Feather name="refresh-cw" size={14} color={colors.mutedForeground} />
            <Text style={[styles.rerunText, { color: colors.mutedForeground }]}>Re-read conditions</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── REAL-TIME HOT SPOTS ── */}
      <SectionTitle emoji="🔥" label="HOT SPOTS RIGHT NOW" sub={`Scored for ${moon.name} · ${season.short} · ${isGoldHour ? "⚡ Golden Hour" : localTime}`} color="#00d4aa" />
      <HotSpotsSection hotSpots={hotSpots} colors={colors} />

      {/* ── COMPETITIONS ── */}
      <SectionTitle emoji="🏆" label="NT BARRA COMPS" sub="Tournaments, cash prizes & glory" color="#ffd700" />
      {BARRA_COMPS.map((comp, i) => (
        <LilyPadCard
          key={i}
          onPress={() => Linking.openURL(comp.website)}
          borderColor={LP_BORDER}
          borderLeftColor={comp.color}
          innerStyle={{ padding: 12, gap: 8 }}
        >
          <View style={styles.compHeader}>
            <Text style={styles.compEmoji}>{comp.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.compName, { color: colors.foreground }]}>{comp.name}</Text>
              <Text style={[styles.compHost, { color: colors.mutedForeground }]}>{comp.host}</Text>
            </View>
            <Feather name="external-link" size={14} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.compDesc, { color: colors.foreground }]}>{comp.description}</Text>
          <View style={styles.compFooter}>
            <View style={[styles.compBadge, { backgroundColor: `${comp.color}22`, borderColor: `${comp.color}44` }]}>
              <Text style={[styles.compBadgeText, { color: comp.color }]}>📅 {comp.dates}</Text>
            </View>
            <Text style={[styles.compHighlight, { color: comp.color }]}>{comp.highlight}</Text>
          </View>
        </LilyPadCard>
      ))}

      {/* ── BARRA FACTS ── */}
      <SectionTitle emoji="🐟" label="DID YOU KNOW?" sub="Barramundi biology & behaviour" color="#7986cb" />
      <LilyPadCard>
        {BARRA_FACTS.map((f, i) => (
          <View key={i}>
            {i > 0 && <View style={[styles.factDivider, { backgroundColor: LP_BORDER }]} />}
            <View style={styles.factRow}>
              <Text style={styles.factEmoji}>{f.emoji}</Text>
              <Text style={[styles.factText, { color: colors.foreground }]}>{f.fact}</Text>
            </View>
          </View>
        ))}
      </LilyPadCard>

      <NarratorButton pageType="barra nation" content={`Savage Barra Nation — NT barramundi hub. ${season.name}, ${moon.name}. Top hot spot right now: ${hotSpots[0].name} on the ${hotSpots[0].river}. Million Dollar Fish: ${getMDFStatus().active ? "ACTIVE — season ends in " + getMDFStatus().daysLeft + " days" : "off season — next season in " + getMDFStatus().daysUntil + " days"}. Upcoming comps: NT Barra Nationals in July-August. Fun fact: ${BARRA_FACTS[0].fact}`} />
    </ScrollView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 14, gap: 14 },

  header: { gap: 4 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  titleRed:  { fontSize: 36, fontFamily: "Oswald_700Bold", color: "#ff2200", lineHeight: 36 },
  titleGold: { fontSize: 36, fontFamily: "Oswald_700Bold", color: "#ffd700", lineHeight: 36 },
  subtitle:  { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 15 },

  sectionTitle: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 4 },
  sectionEmoji: { fontSize: 22 },
  sectionLabel: { fontSize: 15, fontFamily: "Oswald_700Bold", letterSpacing: 0.5 },
  sectionSub:   { fontSize: 10, fontFamily: "Inter_400Regular", color: "#888", marginTop: 1 },

  condBar:  { flexDirection: "row", borderRadius: 12, borderWidth: 1, padding: 10, justifyContent: "space-around" },
  condDivider: { width: 1, height: 32, alignSelf: "center" },
  condItem: { alignItems: "center", gap: 2 },
  condEmoji: { fontSize: 14 },
  condLabel: { fontSize: 9, fontFamily: "Inter_500Medium", color: "#888", textAlign: "center" },

  // MDF
  mdfCard: { borderRadius: 16, borderWidth: 1.5, overflow: "hidden" },
  mdfGradient: { backgroundColor: "#1a1200", padding: 16, gap: 12 },
  mdfHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  mdfEmoji: { fontSize: 28 },
  mdfTitle: { fontSize: 16, fontFamily: "Oswald_700Bold", color: "#ffd700", letterSpacing: 0.5 },
  mdfHost:  { fontSize: 10, fontFamily: "Inter_400Regular", color: "#888" },
  mdfStatusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  mdfStatusText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  mdfCountdown: { alignItems: "center", paddingVertical: 8 },
  mdfCountdownLabel: { fontSize: 10, fontFamily: "Inter_500Medium", color: "#888", letterSpacing: 0.8, textTransform: "uppercase" },
  mdfCountdownNum: { fontSize: 40, fontFamily: "Oswald_700Bold", color: "#ffd700", lineHeight: 44 },
  mdfCountdownSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#888" },
  mdfPrizes: { flexDirection: "row", gap: 8 },
  mdfPrize: { flex: 1, alignItems: "center", padding: 10, borderRadius: 10, borderWidth: 1, backgroundColor: "#ffd70008" },
  mdfPrizeAmt: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#ffd700" },
  mdfPrizeLabel: { fontSize: 9, fontFamily: "Inter_500Medium", color: "#888", marginTop: 2 },
  mdfHow: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#aaa", lineHeight: 18 },
  mdfBtn: { backgroundColor: "#ffd700", borderRadius: 10, padding: 12, alignItems: "center" },
  mdfBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#0a1628" },

  // AI predictor
  bigBtnWrap: { alignSelf: "center", shadowColor: "#ff2200", shadowOffset: { width: 0, height: 0 }, shadowRadius: 20, elevation: 12 },
  bigBtn: { backgroundColor: "#ff2200", borderRadius: 60, width: 200, height: 200, alignItems: "center", justifyContent: "center", gap: 6 },
  bigBtnLoading: { backgroundColor: "#991500" },
  bigBtnIcon: { fontSize: 44 },
  bigBtnText: { fontSize: 18, fontFamily: "Oswald_700Bold", color: "#fff", letterSpacing: 1 },
  bigBtnSub:  { fontSize: 11, fontFamily: "Inter_400Regular", color: "#ffffff88" },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  hintBox: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  hintTitle: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.8 },
  hintRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  hintEmoji: { fontSize: 18, width: 24 },
  hintText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  bigPicBox: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 6 },
  bigPicLabel: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#ff2200", letterSpacing: 0.8 },
  bigPicText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  topRow: { flexDirection: "row", gap: 10 },
  topCard: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, gap: 4 },
  topLabel: { fontSize: 10, fontFamily: "Inter_500Medium", letterSpacing: 0.6 },
  topValue: { fontSize: 16, fontFamily: "Inter_700Bold" },
  predsHeader: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.8 },
  predCard: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 10 },
  predHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  rankBadge: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  rankText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#ff2200" },
  predRiver: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  predSpot:  { fontSize: 14, fontFamily: "Inter_700Bold" },
  confBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  confText:  { fontSize: 11, fontFamily: "Inter_700Bold" },
  depthWhyRow: { flexDirection: "row", gap: 10 },
  depthMeter: { width: 52, gap: 4, alignItems: "center" },
  depthMeterTrack: { width: 14, flex: 1, borderRadius: 7, borderWidth: 1, overflow: "hidden", backgroundColor: "#ffffff0a", minHeight: 70 },
  depthMeterFill: { position: "absolute", left: 0, right: 0, backgroundColor: "#ff2200", borderRadius: 7 },
  depthMeterLabels: { width: "100%", justifyContent: "space-between", alignItems: "center" },
  depthMeterLabel: { fontSize: 9, fontFamily: "Inter_500Medium" },
  depthMeterDepth: { fontSize: 12, fontFamily: "Inter_700Bold" },
  whyBox: { flex: 1, borderRadius: 10, borderWidth: 1, padding: 10, gap: 6, flexDirection: "row", alignItems: "flex-start" },
  whyText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  windowRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  windowLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  windowNote: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17, marginTop: 2 },
  tacticGrid: { flexDirection: "row", gap: 8 },
  tacticBox: { flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  tacticBoxFull: { flex: 0 },
  tacticLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 0.6 },
  tacticValue: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 16, marginTop: 2 },
  rerunBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  rerunText: { fontSize: 13, fontFamily: "Inter_500Medium" },

  // Hot spots
  hotSpotCard: { padding: 12, gap: 8 },
  hotSpotHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  hotSpotRank: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  hotSpotRankNum: { fontSize: 12, fontFamily: "Inter_700Bold" },
  hotSpotEmoji: { fontSize: 20 },
  hotSpotName: { fontSize: 14, fontFamily: "Inter_700Bold" },
  hotSpotRiver: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  hotScoreBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  hotScoreText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  hotSpotDetail: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  hotSpotPill: { flexDirection: "row", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  hotSpotPillText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  hotSpotReason: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  hotSpotReasonText: { fontSize: 11, fontFamily: "Inter_500Medium", flex: 1 },

  // Comps
  compCard: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 8 },
  compHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  compEmoji: { fontSize: 24 },
  compName: { fontSize: 14, fontFamily: "Inter_700Bold" },
  compHost: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  compDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  compFooter: { gap: 4 },
  compBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  compBadgeText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  compHighlight: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  // Facts
  factsCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  factDivider: { height: 1 },
  factRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12 },
  factEmoji: { fontSize: 18, marginTop: 1 },
  factText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  // Tide card
  tideCardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  tideCardTitle: { flex: 1, fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 0.4 },
  tidePhaseBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  tidePhaseText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  tideCardBody: { flexDirection: "row", alignItems: "center", gap: 14 },
  tideMainBlock: { flex: 1, gap: 3 },
  tideTypeLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase" },
  tideMainRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  tideHeight: { fontSize: 32, fontFamily: "Oswald_700Bold", lineHeight: 36 },
  tideTypePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  tideTypePillText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  tideTime: { fontSize: 14, fontFamily: "Inter_500Medium" },
  tideCountdownBlock: { alignItems: "center", gap: 2, paddingLeft: 14, borderLeftWidth: 1 },
  tideCountdownLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },
  tideCountdownNum: { fontSize: 22, fontFamily: "Oswald_700Bold", lineHeight: 26 },
  tideLoadingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  tideLoadingText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  tideSource: { fontSize: 9, fontFamily: "Inter_400Regular", textAlign: "right" },
});

export default function BarraScreen() {
  return (
    <BarraErrorBoundary>
      <BarraScreenInner />
    </BarraErrorBoundary>
  );
}
