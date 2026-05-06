import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { HVHeader } from "@/components/HVHeader";
import { useColors } from "@/hooks/useColors";
import { NarratorButton } from "@/components/NarratorButton";
import { NarratorSettingsTrigger } from "@/components/NarratorSettings";
import { useAutoNarrate } from "@/hooks/useAutoNarrate";

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

// ─── CrocGuard types ──────────────────────────────────────────────────────────
type CrocStatus      = "green" | "orange" | "red";
type DeterrentMode   = "off" | "pulse" | "alarm" | "continuous";
type DeterrentSound  = "siren" | "horn" | "dolphin" | "ultrasonic";

interface CrocGuardState { status: CrocStatus; confidence: number; alerts24h: number }
interface DeterrentState {
  mode:         DeterrentMode;
  sound:        DeterrentSound;
  auto_mode:    boolean;
  triggered_at: string | null;
  updated_at:   string;
}

function CrocGuardBadge({ cg, colors }: { cg: CrocGuardState; colors: ReturnType<typeof useColors> }) {
  const cfg: Record<CrocStatus, { bg: string; icon: string; label: string }> = {
    green:  { bg: "#16a34a", icon: "shield-check",   label: "CrocGuard: CLEAR" },
    orange: { bg: "#d97706", icon: "shield-alert",   label: "CrocGuard: CAUTION" },
    red:    { bg: "#dc2626", icon: "shield-off",     label: "CrocGuard: ALERT" },
  };
  const c = cfg[cg.status];
  return (
    <View style={[styles.crocBadge, { backgroundColor: `${c.bg}22`, borderColor: `${c.bg}66` }]}>
      <MaterialCommunityIcons name={c.icon as any} size={13} color={c.bg} />
      <Text style={[styles.crocBadgeText, { color: c.bg }]}>{c.label}</Text>
      {cg.alerts24h > 0 && (
        <View style={[styles.crocAlertPill, { backgroundColor: c.bg }]}>
          <Text style={styles.crocAlertPillText}>{cg.alerts24h} alert{cg.alerts24h > 1 ? "s" : ""} / 24h</Text>
        </View>
      )}
    </View>
  );
}

// ─── Deterrent local audio ────────────────────────────────────────────────────
const DETERRENT_SIREN_LOCAL  = require("../../assets/sounds/siren.wav") as number;
const DETERRENT_SIREN_REMOTE = "https://www.soundjay.com/mechanical/sounds/alarm-01a.mp3";
let deterrentSoundRef: Audio.Sound | null = null;

async function playDeterrentLocally() {
  try {
    if (deterrentSoundRef) {
      await deterrentSoundRef.unloadAsync().catch(() => {});
      deterrentSoundRef = null;
    }
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true });
    let sound: Audio.Sound;
    try {
      ({ sound } = await Audio.Sound.createAsync(DETERRENT_SIREN_LOCAL, { shouldPlay: true, volume: 1.0 }));
    } catch {
      ({ sound } = await Audio.Sound.createAsync({ uri: DETERRENT_SIREN_REMOTE }, { shouldPlay: true, volume: 1.0 }));
    }
    deterrentSoundRef = sound;
    sound.setOnPlaybackStatusUpdate((s) => {
      if (s.isLoaded && s.didJustFinish) sound.unloadAsync().catch(() => {});
    });
    Vibration.vibrate([0, 400, 200, 400, 200, 400]);
    setTimeout(() => {
      try { Speech.speak("Crocodile deterrent activated. Stay out of the water.", { language: "en-AU", rate: 0.9, onError: () => {} }); } catch {}
    }, 1500);
  } catch { /* vibration still fires */ }
}

// ─── CrocGuard Deterrent Control Panel ────────────────────────────────────────
function CrocGuardPanel({
  cg, det, baseUrl, onUpdate,
}: {
  cg:       CrocGuardState;
  det:      DeterrentState | null;
  baseUrl:  string;
  onUpdate: (d: DeterrentState) => void;
}) {
  const [busy, setBusy] = useState(false);
  const prevCrocStatusRef = useRef<CrocStatus | null>(null);

  // Auto-trigger: play sound locally when status escalates to red with auto-mode on
  useEffect(() => {
    const isAutoOn = det?.auto_mode ?? true;
    if (isAutoOn && cg.status === "red" && prevCrocStatusRef.current !== "red") {
      playDeterrentLocally().catch(() => {});
    }
    prevCrocStatusRef.current = cg.status;
  }, [cg.status, det?.auto_mode]);

  const crocCfg: Record<CrocStatus, { bg: string; icon: string; label: string }> = {
    green:  { bg: "#16a34a", icon: "shield-check", label: "CLEAR" },
    orange: { bg: "#d97706", icon: "shield-alert", label: "CAUTION" },
    red:    { bg: "#dc2626", icon: "shield-off",   label: "🐊 ALERT" },
  };
  const cc = crocCfg[cg.status];

  const modeCfg: Record<DeterrentMode, { label: string; color: string; icon: string }> = {
    off:        { label: "OFF",        color: "#ffffff44", icon: "volume-off" },
    pulse:      { label: "PULSE",      color: "#ffd700",   icon: "volume-medium" },
    alarm:      { label: "ALARM",      color: "#ff6600",   icon: "volume-high" },
    continuous: { label: "CONTINUOUS", color: "#dc2626",   icon: "volume-vibrate" },
  };
  const soundCfg: Record<DeterrentSound, { label: string; emoji: string }> = {
    siren:      { label: "Siren",      emoji: "🚨" },
    horn:       { label: "Air Horn",   emoji: "📯" },
    dolphin:    { label: "Dolphin",    emoji: "🐬" },
    ultrasonic: { label: "Ultrasonic", emoji: "📡" },
  };

  const post = async (endpoint: string, body?: object) => {
    setBusy(true);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const r = await fetch(`${baseUrl}/api/crocguard/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
      const d = await r.json();
      if (d.ok && d.deterrent) onUpdate(d.deterrent);
    } catch {
    } finally {
      clearTimeout(timer);
      setBusy(false);
    }
  };

  const effectiveMode = det?.mode ?? "off";
  const effectiveSound = det?.sound ?? "siren";
  const autoMode = det?.auto_mode ?? true;

  return (
    <View style={{
      backgroundColor: "#0c1628",
      borderRadius: 16, borderWidth: 1,
      borderColor: cg.status === "red" ? "#dc262666" : cg.status === "orange" ? "#d9770644" : "#16a34a33",
      marginBottom: 16, overflow: "hidden",
    }}>
      {/* ── Header ── */}
      <View style={{
        flexDirection: "row", alignItems: "center", gap: 10,
        padding: 14, borderBottomWidth: 1, borderBottomColor: "#ffffff0f",
        backgroundColor: cg.status === "red" ? "#dc262612" : "#00000000",
      }}>
        <MaterialCommunityIcons name={cc.icon as any} size={22} color={cc.bg} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14, letterSpacing: 1 }}>
            🐊 CROCGUARD
          </Text>
          <Text style={{ color: cc.bg, fontSize: 11, fontWeight: "700", letterSpacing: 1.5, marginTop: 1 }}>
            {cc.label} · {cg.confidence}% confidence
          </Text>
        </View>
        {cg.alerts24h > 0 && (
          <View style={{ backgroundColor: `${cc.bg}33`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ color: cc.bg, fontSize: 10, fontWeight: "700" }}>
              {cg.alerts24h} alert{cg.alerts24h > 1 ? "s" : ""}/24h
            </Text>
          </View>
        )}
      </View>

      <View style={{ padding: 14, gap: 14 }}>
        {/* ── Deterrent Section Header ── */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <MaterialCommunityIcons name="speaker-wireless" size={15} color="#00d4aa" />
          <Text style={{ color: "#00d4aa", fontSize: 11, fontWeight: "700", letterSpacing: 1.5 }}>
            ACOUSTIC DETERRENT
          </Text>
          {busy && <ActivityIndicator size="small" color="#00d4aa" style={{ marginLeft: "auto" }} />}
        </View>

        {/* ── Mode selector ── */}
        <View style={{ gap: 6 }}>
          <Text style={{ color: "#ffffff55", fontSize: 10, fontWeight: "700", letterSpacing: 1 }}>MODE</Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {(["off", "pulse", "alarm", "continuous"] as DeterrentMode[]).map(m => {
              const mc = modeCfg[m];
              const active = effectiveMode === m;
              return (
                <TouchableOpacity
                  key={m}
                  onPress={() => post("deterrent", { mode: m })}
                  disabled={busy}
                  style={{
                    flex: 1, alignItems: "center", justifyContent: "center",
                    paddingVertical: 8, borderRadius: 8, borderWidth: 1.5,
                    backgroundColor: active ? `${mc.color}22` : "#ffffff08",
                    borderColor: active ? `${mc.color}88` : "#ffffff22",
                  }}
                  activeOpacity={0.75}
                >
                  <MaterialCommunityIcons
                    name={mc.icon as any} size={15}
                    color={active ? mc.color : "#ffffff44"}
                  />
                  <Text style={{
                    fontSize: 8, fontWeight: "700", letterSpacing: 0.5, marginTop: 2,
                    color: active ? mc.color : "#ffffff44",
                  }}>{mc.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Sound selector ── */}
        <View style={{ gap: 6 }}>
          <Text style={{ color: "#ffffff55", fontSize: 10, fontWeight: "700", letterSpacing: 1 }}>SOUND TYPE</Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {(["siren", "horn", "dolphin", "ultrasonic"] as DeterrentSound[]).map(s => {
              const sc = soundCfg[s];
              const active = effectiveSound === s;
              return (
                <TouchableOpacity
                  key={s}
                  onPress={() => post("deterrent", { sound: s })}
                  disabled={busy}
                  style={{
                    flex: 1, alignItems: "center", gap: 3,
                    paddingVertical: 8, borderRadius: 8, borderWidth: 1.5,
                    backgroundColor: active ? "#00d4aa22" : "#ffffff08",
                    borderColor: active ? "#00d4aa66" : "#ffffff22",
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={{ fontSize: 14 }}>{sc.emoji}</Text>
                  <Text style={{
                    fontSize: 8, fontWeight: "700",
                    color: active ? "#00d4aa" : "#ffffff44",
                  }}>{sc.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Auto-mode toggle ── */}
        <TouchableOpacity
          onPress={() => post("deterrent", { auto_mode: !autoMode })}
          disabled={busy}
          style={{
            flexDirection: "row", alignItems: "center", gap: 10,
            backgroundColor: autoMode ? "#00d4aa12" : "#ffffff08",
            borderRadius: 10, borderWidth: 1,
            borderColor: autoMode ? "#00d4aa44" : "#ffffff22",
            paddingHorizontal: 12, paddingVertical: 10,
          }}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name={autoMode ? "robot" : "robot-off"}
            size={18}
            color={autoMode ? "#00d4aa" : "#ffffff44"}
          />
          <View style={{ flex: 1 }}>
            <Text style={{ color: autoMode ? "#00d4aa" : "#ffffff88", fontWeight: "700", fontSize: 12 }}>
              Auto-Trigger {autoMode ? "ON" : "OFF"}
            </Text>
            <Text style={{ color: "#ffffff44", fontSize: 10, marginTop: 1 }}>
              {autoMode
                ? "Deterrent fires automatically when croc detected"
                : "Manual control only"}
            </Text>
          </View>
          <View style={{
            width: 36, height: 20, borderRadius: 10, justifyContent: "center",
            backgroundColor: autoMode ? "#00d4aa" : "#ffffff22",
          }}>
            <View style={{
              width: 16, height: 16, borderRadius: 8, backgroundColor: "#fff",
              marginLeft: autoMode ? 18 : 2,
            }} />
          </View>
        </TouchableOpacity>

        {/* ── Action buttons ── */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {/* Manual trigger */}
          <TouchableOpacity
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              playDeterrentLocally().catch(() => {});
              post("deterrent/trigger");
            }}
            disabled={busy}
            style={{
              flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center",
              gap: 8, backgroundColor: "#dc262622", borderRadius: 12,
              borderWidth: 1.5, borderColor: "#dc262666", paddingVertical: 12,
              opacity: busy ? 0.5 : 1,
            }}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="alarm-light" size={18} color="#dc2626" />
            <Text style={{ color: "#dc2626", fontWeight: "800", fontSize: 13, letterSpacing: 0.5 }}>
              🔊 TRIGGER NOW
            </Text>
          </TouchableOpacity>

          {/* Silence */}
          <TouchableOpacity
            onPress={() => post("deterrent/off")}
            disabled={busy || effectiveMode === "off"}
            style={{
              flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
              gap: 6, backgroundColor: "#ffffff08", borderRadius: 12,
              borderWidth: 1.5, borderColor: "#ffffff22", paddingVertical: 12,
              opacity: (busy || effectiveMode === "off") ? 0.4 : 1,
            }}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="volume-off" size={16} color="#ffffff88" />
            <Text style={{ color: "#ffffff88", fontWeight: "700", fontSize: 12 }}>SILENCE</Text>
          </TouchableOpacity>
        </View>

        {/* ── Last triggered ── */}
        {det?.triggered_at && (
          <Text style={{ color: "#ffffff33", fontSize: 10, textAlign: "center" }}>
            Last fired: {new Date(det.triggered_at).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true })}
          </Text>
        )}
      </View>
    </View>
  );
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
function SpotCard({ spot, index, colors, crocGuard }: {
  spot: ForecastSpot; index: number; colors: ReturnType<typeof useColors>;
  crocGuard: CrocGuardState | null;
}) {
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
          {crocGuard && <CrocGuardBadge cg={crocGuard} colors={colors} />}
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
  const topPad = Platform.OS === "web" ? 0 : insets.top;
  useAutoNarrate(() => "Here Fishy Fishy. AI bite forecast based on moon phase, NT season, tide stage and water temperature.");

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
  const [tidesError, setTidesError] = useState(false);
  const [tidesRetryCount, setTidesRetryCount] = useState(0);
  const [nextTide, setNextTide] = useState<(TideEntry & { minutesUntil: number }) | null>(null);
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [crocGuard, setCrocGuard] = useState<CrocGuardState | null>(null);
  const [deterrent, setDeterrent] = useState<DeterrentState | null>(null);

  const domain  = process.env.EXPO_PUBLIC_DOMAIN;
  const baseUrl = domain ? `https://${domain}` : "";

  // Fetch CrocGuard status + deterrent on mount and refresh every 15s
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10_000);
      try {
        const [brainRes, detRes] = await Promise.all([
          fetch(`${baseUrl}/api/crocguard/brain-context`, { signal: ctrl.signal }),
          fetch(`${baseUrl}/api/crocguard/deterrent`, { signal: ctrl.signal }),
        ]);
        const brain = await brainRes.json();
        const det   = await detRes.json();
        if (!cancelled) {
          if (brain.ok) setCrocGuard({ status: brain.status, confidence: brain.confidence, alerts24h: brain.alerts_24h ?? 0 });
          if (det.ok)   setDeterrent(det.deterrent);
        }
      } catch {} finally { clearTimeout(t); }
    };
    load();
    const timer = setInterval(load, 15_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [baseUrl]);

  // Fetch today's tides on mount
  useEffect(() => {
    setTidesError(false);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    fetch(`${baseUrl}/api/tides?port=darwin&days=2`, { signal: ctrl.signal })
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
      .catch(() => setTidesError(true))
      .finally(() => { clearTimeout(timer); setTidesLoading(false); });
  }, [baseUrl, tidesRetryCount]);

  const getForecast = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForecast(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
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
        region: "nt" as const,
      };
      const resp = await fetch(`${baseUrl}/api/forecast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
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
      clearTimeout(timer);
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
      <HVHeader subtitle="Here Fishy Fishy" />
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
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
      {tidesError && !nextTide && (
        <TouchableOpacity
          onPress={() => { setTidesError(false); setTidesRetryCount(c => c + 1); }}
          style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 4, marginTop: -4, marginBottom: 4 }}
          activeOpacity={0.7}
        >
          <Feather name="refresh-cw" size={11} color="#ff8c00" />
          <Text style={{ color: "#ff8c00", fontSize: 11 }}>Retry tides</Text>
        </TouchableOpacity>
      )}

      {/* Season impact box */}
      <View style={[styles.seasonBox, { backgroundColor: `${colors.accent}18`, borderColor: `${colors.accent}33` }]}>
        <Text style={[styles.seasonBoxEmoji]}>{season.emoji}</Text>
        <Text style={[styles.seasonBoxText, { color: colors.foreground }]}>{season.impact}</Text>
      </View>

      {/* ── CrocGuard Deterrent Control Panel ── */}
      {crocGuard && (
        <CrocGuardPanel
          cg={crocGuard}
          det={deterrent}
          baseUrl={baseUrl}
          onUpdate={setDeterrent}
        />
      )}

      {/* The Button */}
      <PulseButton onPress={getForecast} loading={loading} />

      {/* Error */}
      {error && (
        <View style={[styles.errorBox, { backgroundColor: `${colors.destructive}18`, borderColor: `${colors.destructive}44` }]}>
          <Feather name="alert-circle" size={16} color={colors.destructive} />
          <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
        </View>
      )}

      {/* Pre-result hint */}
      {!forecast && !loading && !error && (
        <View style={[styles.hintBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.hintTitle, { color: colors.mutedForeground }]}>WHAT YOU'LL GET</Text>
          {[
            { e: "📍", t: "Top 3 fishing spots in NT right now based on conditions" },
            { e: "🌊", t: "Species targeting advice matched to current tide stage" },
            { e: "🎣", t: "Exactly where to fish, what lure & when to be there" },
            { e: "🌙", t: "Moon phase, season & water temp all factored in" },
          ].map(({ e, t }) => (
            <View key={t} style={styles.hintRow}>
              <Text style={styles.hintEmoji}>{e}</Text>
              <Text style={[styles.hintText, { color: colors.foreground }]}>{t}</Text>
            </View>
          ))}
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
            <SpotCard key={i} spot={spot} index={i} colors={colors} crocGuard={crocGuard} />
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
  content: { paddingHorizontal: 14, gap: 8 },
  header: { alignItems: "center", gap: 2 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%" },
  title: { fontSize: 24, fontFamily: "Oswald_700Bold", letterSpacing: 1 },
  subtitle: { fontSize: 11, fontFamily: "Inter_400Regular" },

  condGrid: { gap: 6 },
  condPill: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  condEmoji: { fontSize: 18, marginTop: 1 },
  condLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.8 },
  condValue: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginTop: 1 },
  condSub: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 1, lineHeight: 14 },

  seasonBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  seasonBoxEmoji: { fontSize: 16, marginTop: 1 },
  seasonBoxText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },

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
    gap: 10,
    paddingVertical: 13,
    borderRadius: 30,
  },
  bigBtnEmoji: { fontSize: 18 },
  bigBtnText: { fontSize: 18, fontFamily: "Oswald_700Bold", letterSpacing: 1.5 },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },

  results: { gap: 10 },
  headlineBox: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  headlineText: { fontSize: 13, fontFamily: "Inter_700Bold", lineHeight: 18 },
  spotsHeader: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1,
    textAlign: "center",
  },

  spotCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    gap: 6,
    padding: 10,
  },
  spotHeader: { gap: 6 },
  spotTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  spotNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  spotNumberText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  spotName: { fontSize: 13, fontFamily: "Inter_700Bold" },
  spotSpecies: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 1 },

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
  crocBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  crocBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.4,
    flex: 1,
  },
  crocAlertPill: {
    borderRadius: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  crocAlertPillText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
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

  hintBox: {
    borderRadius: 14, borderWidth: 1, padding: 16, gap: 12,
  },
  hintTitle: {
    fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1, textTransform: "uppercase",
  },
  hintRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  hintEmoji: { fontSize: 16, width: 22 },
  hintText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
});
