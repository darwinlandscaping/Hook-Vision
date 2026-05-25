import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";

const BASE_URL =
  Platform.OS === "web"
    ? typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.hostname}`
      : ""
    : process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
      : "";

const HUD_DATA_URL = `${BASE_URL}/api/hud/data`;
const POLL_MS = 6000;

interface BrainTarget {
  targetSpecies:   string;
  targetDepth:     string;
  targetLure:      string;
  targetTechnique: string;
  castZone:        string;
  confidence:      number;
  urgency:         "NOW" | "SOON" | "LATER";
  reasoning:       string;
  tideNote:        string;
  seasonNote:      string;
  communityNote:   string;
  compiledAt:      number;
}

interface ScanData {
  species:      string;
  fishCount:    number;
  depth:        string;
  confidence:   number;
  barraPct?:    number | null;
  waterTemp?:   string;
  bottomType?:  string;
  lure?:        string;
  crocAlert?:   boolean;
  crocWarning?: string | null;
  birdAlert?:   string | null;
  birdActivity?: string | null;
  updatedAt:    number;
}

interface TideContext {
  port:  string;
  state: string;
  phase: string;
  nextTide?: { type: string; time: string; height: number } | null;
}

interface EnvContext {
  season:    string;
  timeOfDay: string;
  moonPhase: string;
}

interface HudState {
  brain?:     BrainTarget | null;
  scan?:      ScanData    | null;
  tide?:      TideContext  | null;
  env?:       EnvContext;
  updatedAt:  number;
  brainUpdatedAt: number;
}

const URGENCY_COLOR: Record<string, string> = {
  NOW:   "#34c759",
  SOON:  "#ffb300",
  LATER: "#ffffff66",
};

function ConfBar({ value, color }: { value: number; color: string }) {
  const pct = Math.min(100, Math.max(0, Math.round(value * 100)));
  return (
    <View style={styles.confRow}>
      <View style={styles.confTrack}>
        <View style={[styles.confFill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[styles.confPct, { color }]}>{pct}%</Text>
    </View>
  );
}

export default function HudTab() {
  const insets = useSafeAreaInsets();
  const [data,    setData]    = useState<HudState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);
  const [stopped, setStopped] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live dot pulse
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.35, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const fetchData = useCallback(async () => {
    if (stopped) return;
    try {
      const r = await fetch(HUD_DATA_URL, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error("non-ok");
      const json = await r.json() as HudState;
      setData(json);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [stopped]);

  const startPolling = useCallback(() => {
    fetchData();
    timerRef.current = setInterval(fetchData, POLL_MS);
  }, [fetchData]);

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!stopped) {
      setLoading(true);
      setError(false);
      startPolling();
    } else {
      stopPolling();
    }
    return stopPolling;
  }, [stopped, startPolling, stopPolling]);

  const handleStop = useCallback(() => {
    setStopped(true);
  }, []);

  const handleResume = useCallback(() => {
    setStopped(false);
  }, []);

  const handleRefresh = useCallback(() => {
    setLoading(true);
    setError(false);
    fetchData();
  }, [fetchData]);

  const brain = data?.brain ?? null;
  const scan  = data?.scan  ?? null;
  const tide  = data?.tide  ?? null;
  const env   = data?.env;
  const hasData = !!(brain || scan);

  const urgencyColor = brain ? (URGENCY_COLOR[brain.urgency] ?? "#ffffff66") : "#ffffff66";

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons name="glasses" size={20} color="#ffd700" />
          <Text style={styles.headerTitle}>CAST HUD</Text>
          {!stopped && (
            <>
              <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
              <Text style={styles.liveLabel}>LIVE</Text>
            </>
          )}
          {stopped && (
            <View style={styles.stoppedBadge}>
              <Text style={styles.stoppedBadgeText}>STOPPED</Text>
            </View>
          )}
        </View>
        <View style={styles.headerRight}>
          {!stopped ? (
            <>
              <TouchableOpacity onPress={handleStop} style={styles.stopBtn} hitSlop={12}>
                <Feather name="square" size={14} color="#ff4400" />
                <Text style={styles.stopBtnText}>Stop</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleRefresh} style={styles.iconBtn} hitSlop={12}>
                <Feather name="refresh-cw" size={17} color="#ffffff88" />
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity onPress={handleResume} style={styles.resumeSmallBtn} hitSlop={12}>
              <Feather name="play" size={14} color="#ffd700" />
              <Text style={styles.resumeSmallText}>Resume</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Stopped screen ── */}
      {stopped && (
        <View style={styles.centreBox}>
          <MaterialCommunityIcons name="pause-circle-outline" size={60} color="#ffffff22" />
          <Text style={styles.centreTitle}>HUD Stopped</Text>
          <Text style={styles.centreSub}>Tap Resume to reconnect the live feed.</Text>
          <TouchableOpacity style={styles.resumeBtn} onPress={handleResume}>
            <Feather name="play" size={14} color="#ffd700" />
            <Text style={styles.resumeBtnText}>Resume HUD</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Loading ── */}
      {!stopped && loading && (
        <View style={styles.centreBox}>
          <ActivityIndicator color="#00d4aa" size="large" />
          <Text style={styles.centreTitle} />
          <Text style={styles.centreSub}>Connecting to brain…</Text>
        </View>
      )}

      {/* ── Error ── */}
      {!stopped && !loading && error && (
        <View style={styles.centreBox}>
          <MaterialCommunityIcons name="wifi-off" size={48} color="#ffffff33" />
          <Text style={styles.centreTitle}>Brain Offline</Text>
          <Text style={styles.centreSub}>Cannot reach the API server.{"\n"}Make sure you are on the same network.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleRefresh}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Waiting for first scan ── */}
      {!stopped && !loading && !error && !hasData && (
        <View style={styles.centreBox}>
          <MaterialCommunityIcons name="radar" size={52} color="#00d4aa44" />
          <Text style={styles.centreTitle}>Brain Initialising</Text>
          <Text style={styles.centreSub}>Run a sonar scan in HookVision{"\n"}to push data to the HUD.</Text>
        </View>
      )}

      {/* ── Live data ── */}
      {!stopped && !loading && !error && hasData && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >

          {/* ── Cast Zone (highlighted hero card) ── */}
          {brain && (
            <View style={styles.castZoneCard}>
              <View style={styles.castZoneHeader}>
                <MaterialCommunityIcons name="crosshairs-gps" size={15} color="#ffd700" />
                <Text style={styles.castZoneLabel}>CAST ZONE</Text>
                <View style={[styles.urgencyBadge, { borderColor: urgencyColor }]}>
                  <Text style={[styles.urgencyText, { color: urgencyColor }]}>{brain.urgency}</Text>
                </View>
              </View>
              <Text style={styles.castZoneValue}>{brain.castZone}</Text>
              <ConfBar value={brain.confidence} color="#ffd700" />
            </View>
          )}

          {/* ── Species + lure row ── */}
          {brain && (
            <View style={styles.row}>
              <View style={[styles.infoCard, { flex: 1 }]}>
                <Text style={styles.infoCardLabel}>TARGET</Text>
                <Text style={styles.infoCardValue} numberOfLines={2}>{brain.targetSpecies}</Text>
              </View>
              <View style={[styles.infoCard, { flex: 1 }]}>
                <Text style={styles.infoCardLabel}>LURE</Text>
                <Text style={[styles.infoCardValue, { color: "#ffd700", fontSize: 13 }]} numberOfLines={2}>{brain.targetLure}</Text>
              </View>
            </View>
          )}

          {/* ── Depth + technique ── */}
          {brain && (
            <View style={styles.row}>
              <View style={[styles.infoCard, { flex: 1 }]}>
                <Text style={styles.infoCardLabel}>DEPTH</Text>
                <Text style={[styles.infoCardValue, { color: "#00a8ff" }]}>{brain.targetDepth}</Text>
              </View>
              <View style={[styles.infoCard, { flex: 2 }]}>
                <Text style={styles.infoCardLabel}>TECHNIQUE</Text>
                <Text style={[styles.infoCardValue, { fontSize: 12, color: "#ffffffcc" }]} numberOfLines={3}>{brain.targetTechnique}</Text>
              </View>
            </View>
          )}

          {/* ── Reasoning ── */}
          {brain?.reasoning ? (
            <View style={styles.reasoningCard}>
              <Text style={styles.reasoningLabel}>AI REASONING</Text>
              <Text style={styles.reasoningText}>{brain.reasoning}</Text>
            </View>
          ) : null}

          {/* ── Tide note ── */}
          {brain?.tideNote ? (
            <View style={[styles.reasoningCard, { borderLeftColor: "#00a8ff" }]}>
              <Text style={[styles.reasoningLabel, { color: "#00a8ff" }]}>
                {tide ? `🌊 ${tide.phase}` : "TIDE"}
              </Text>
              <Text style={styles.reasoningText}>{brain.tideNote}</Text>
            </View>
          ) : tide ? (
            <View style={[styles.reasoningCard, { borderLeftColor: "#00a8ff" }]}>
              <Text style={[styles.reasoningLabel, { color: "#00a8ff" }]}>🌊 TIDE</Text>
              <Text style={styles.reasoningText}>{tide.phase}</Text>
            </View>
          ) : null}

          {/* ── Season note ── */}
          {data.brain?.seasonNote ? (
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="weather-partly-cloudy" size={14} color="#00d4aa" />
              <Text style={styles.infoText}>{data.brain.seasonNote}</Text>
            </View>
          ) : null}
          {/* ── Community note ── */}
          {data.brain?.communityNote ? (
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="account-group" size={14} color="#00e5ff" />
              <Text style={styles.infoText}>{data.brain.communityNote}</Text>
            </View>
          ) : null}

          {/* ── Sonar row ── */}
          {scan && (
            <View style={styles.sonarRow}>
              {[
                { label: "Fish",    value: String(scan.fishCount ?? "—"),          color: "#00d4aa" },
                { label: "Depth",   value: scan.depth || "—",                     color: "#00a8ff" },
                { label: "Barra%",  value: scan.barraPct != null ? `${scan.barraPct}%` : "—", color: "#ffd700" },
                { label: "Temp",    value: scan.waterTemp || "—",                 color: "#ff8800" },
              ].map((m) => (
                <View key={m.label} style={styles.sonarBox}>
                  <Text style={[styles.sonarVal, { color: m.color }]}>{m.value}</Text>
                  <Text style={styles.sonarLbl}>{m.label}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── Season / moon ── */}
          {env && (
            <View style={styles.tagRow}>
              {env.season    && <View style={styles.envTag}><Text style={styles.envTagText}>{env.season}</Text></View>}
              {env.moonPhase && <View style={styles.envTag}><Text style={styles.envTagText}>{env.moonPhase}</Text></View>}
              {env.timeOfDay && <View style={styles.envTag}><Text style={styles.envTagText}>{env.timeOfDay}</Text></View>}
            </View>
          )}

          {/* ── Croc / bird alerts ── */}
          {scan?.crocAlert && (
            <View style={styles.alertCard}>
              <Text style={styles.alertTitle}>🐊 CROC ALERT</Text>
              <Text style={styles.alertText}>{scan.crocWarning ?? "Crocodile detected — move position immediately"}</Text>
            </View>
          )}
          {(scan?.birdAlert || scan?.birdActivity) && (
            <View style={[styles.alertCard, { borderColor: "#00e5ff44", backgroundColor: "#00e5ff0a" }]}>
              <Text style={[styles.alertTitle, { color: "#00e5ff" }]}>🐦 BIRDS</Text>
              <Text style={styles.alertText}>{scan.birdAlert ?? scan.birdActivity}</Text>
            </View>
          )}

          {/* ── Updated timestamp ── */}
          {data && data.brainUpdatedAt > 0 && (
            <Text style={styles.timestamp}>
              Brain updated {Math.round((Date.now() - data.brainUpdatedAt) / 1000)}s ago
            </Text>
          )}

        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#050d1c",
  },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#0a1628",
    borderBottomWidth: 1,
    borderBottomColor: "#ffd70033",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 0.8,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#00d4aa",
    marginLeft: 2,
  },
  liveLabel: {
    color: "#00d4aa",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  stoppedBadge: {
    backgroundColor: "#ff440022",
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "#ff440055",
    marginLeft: 4,
  },
  stoppedBadgeText: {
    color: "#ff4400",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  stopBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#ff440018",
    borderWidth: 1,
    borderColor: "#ff440055",
  },
  stopBtnText: {
    color: "#ff4400",
    fontSize: 12,
    fontWeight: "700",
  },
  iconBtn: {
    padding: 4,
  },
  resumeSmallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#ffd70018",
    borderWidth: 1,
    borderColor: "#ffd70055",
  },
  resumeSmallText: {
    color: "#ffd700",
    fontSize: 12,
    fontWeight: "700",
  },

  /* Centre states */
  centreBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 32,
  },
  centreTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  centreSub: {
    color: "#ffffff66",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: 6,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: "#00d4aa22",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#00d4aa66",
  },
  retryText: {
    color: "#00d4aa",
    fontWeight: "700",
    fontSize: 14,
  },
  resumeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 12,
    backgroundColor: "#ffd70022",
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: "#ffd70066",
    marginTop: 6,
  },
  resumeBtnText: {
    color: "#ffd700",
    fontWeight: "700",
    fontSize: 15,
  },

  /* Scroll */
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    gap: 10,
    paddingBottom: 32,
  },

  /* Cast Zone hero */
  castZoneCard: {
    backgroundColor: "#ffd70012",
    borderWidth: 1.5,
    borderColor: "#ffd70055",
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  castZoneHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  castZoneLabel: {
    color: "#ffd700",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2.5,
    flex: 1,
  },
  urgencyBadge: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  urgencyText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  castZoneValue: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24,
  },
  confRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  confTrack: {
    flex: 1,
    height: 4,
    backgroundColor: "#ffffff12",
    borderRadius: 2,
    overflow: "hidden",
  },
  confFill: {
    height: "100%",
    borderRadius: 2,
  },
  confPct: {
    fontSize: 13,
    fontWeight: "800",
    minWidth: 36,
    textAlign: "right",
  },

  /* Info cards */
  row: {
    flexDirection: "row",
    gap: 10,
  },
  infoCard: {
    backgroundColor: "#ffffff08",
    borderWidth: 1,
    borderColor: "#ffffff12",
    borderRadius: 12,
    padding: 11,
    gap: 4,
  },
  infoCardLabel: {
    color: "#ffffff55",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  infoCardValue: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },

  /* Reasoning */
  reasoningCard: {
    borderLeftWidth: 3,
    borderLeftColor: "#ffd700",
    borderRadius: 4,
    backgroundColor: "#ffd7000a",
    paddingVertical: 9,
    paddingHorizontal: 12,
    gap: 4,
  },
  reasoningLabel: {
    color: "#ffd700",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  reasoningText: {
    color: "#ffffffcc",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
  },

  /* Info row (season / community notes) */
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
  },
  infoText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "500",
    flex: 1,
    lineHeight: 18,
  },

  /* Sonar strip */
  sonarRow: {
    flexDirection: "row",
    gap: 8,
  },
  sonarBox: {
    flex: 1,
    backgroundColor: "#ffffff07",
    borderWidth: 1,
    borderColor: "#ffffff10",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
    gap: 2,
  },
  sonarVal: {
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 20,
  },
  sonarLbl: {
    color: "#ffffff55",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },

  /* Env tags */
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  envTag: {
    borderWidth: 1,
    borderColor: "#ffffff22",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#ffffff08",
  },
  envTagText: {
    color: "#ffffff99",
    fontSize: 10,
    fontWeight: "600",
  },

  /* Alert cards */
  alertCard: {
    borderWidth: 1,
    borderColor: "#ff3b3044",
    backgroundColor: "#ff3b3012",
    borderRadius: 12,
    padding: 12,
    gap: 5,
  },
  alertTitle: {
    color: "#ff3b30",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },
  alertText: {
    color: "#ffffffcc",
    fontSize: 12,
    lineHeight: 18,
  },

  /* Timestamp */
  timestamp: {
    color: "#ffffff33",
    fontSize: 10,
    textAlign: "center",
    marginTop: 4,
  },
});
