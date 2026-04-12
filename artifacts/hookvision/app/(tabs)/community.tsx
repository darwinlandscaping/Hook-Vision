import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

import { HVHeader } from "@/components/HVHeader";
import { useColors } from "@/hooks/useColors";

const C = {
  teal: "#00d4aa",
  blue: "#00a8ff",
  gold: "#ffd700",
  red: "#e8151a",
  green: "#4ade80",
  orange: "#f97316",
};

interface HotSpecies {
  species: string;
  count: number;
  trend: "rising" | "stable" | "falling";
}
interface HotDepth {
  range: string;
  count: number;
  notes: string;
}
interface HotTime {
  period: string;
  activity: "high" | "medium" | "low";
  notes: string;
}
interface Insights {
  generatedAt?: string;
  reportCount: number;
  hotSpecies: HotSpecies[];
  hotDepths: HotDepth[];
  hotTimes: HotTime[];
  hotLocations: string[];
  tips: string[];
  summary: string;
}

function trendIcon(trend: HotSpecies["trend"]) {
  if (trend === "rising") return { name: "trending-up" as const, color: C.green };
  if (trend === "falling") return { name: "trending-down" as const, color: C.red };
  return { name: "minus" as const, color: C.gold };
}

function activityColor(activity: HotTime["activity"]) {
  if (activity === "high") return C.green;
  if (activity === "medium") return C.gold;
  return C.blue;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  if (hours >= 6) return "refresh due";
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

export default function CommunityScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const botPad = Platform.OS === "web" ? 70 : insets.bottom + 24;

  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      const base = domain ? `https://${domain}` : "";
      const res = await fetch(`${base}/api/community/insights`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const json = await res.json();
      setInsights(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    if (!insights) fetchInsights();
  }, [insights, fetchInsights]));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <HVHeader subtitle="Community Intel" />
        <TouchableOpacity onPress={fetchInsights} activeOpacity={0.7} style={styles.refreshBtn}>
          <Feather name="refresh-cw" size={16} color={C.teal} />
          <Text style={[styles.refreshLabel, { color: C.teal }]}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: botPad }]}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchInsights}
            tintColor={C.teal}
            colors={[C.teal]}
          />
        }
      >
        {loading && !insights ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={C.teal} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
              Analyzing community data…
            </Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Feather name="wifi-off" size={36} color={colors.mutedForeground} />
            <Text style={[styles.errorText, { color: colors.mutedForeground }]}>{error}</Text>
            <TouchableOpacity
              style={[styles.retryBtn, { borderColor: C.teal }]}
              onPress={fetchInsights}
              activeOpacity={0.8}
            >
              <Text style={[styles.retryLabel, { color: C.teal }]}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : insights ? (
          <>
            {/* Header card */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: C.teal + "40" }]}>
              <View style={styles.brainRow}>
                <MaterialCommunityIcons name="brain" size={28} color={C.teal} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.brainTitle, { color: colors.foreground }]}>Community Brain</Text>
                  <Text style={[styles.brainSub, { color: colors.mutedForeground }]}>
                    {insights.reportCount} scans analyzed
                    {insights.generatedAt ? ` · updated ${timeAgo(insights.generatedAt)}` : ""}
                  </Text>
                </View>
                <View style={[styles.liveBadge, { backgroundColor: C.teal + "22", borderColor: C.teal + "60" }]}>
                  <View style={[styles.liveDot, { backgroundColor: C.teal }]} />
                  <Text style={[styles.liveText, { color: C.teal }]}>LIVE</Text>
                </View>
              </View>
              {insights.summary ? (
                <Text style={[styles.summary, { color: colors.foreground }]}>{insights.summary}</Text>
              ) : null}
            </View>

            {/* Hot Species */}
            {insights.hotSpecies?.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>HOT SPECIES</Text>
                {insights.hotSpecies.map((s, i) => {
                  const t = trendIcon(s.trend);
                  return (
                    <View
                      key={i}
                      style={[styles.rowCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                      <MaterialCommunityIcons name="fish" size={18} color={C.teal} />
                      <Text style={[styles.rowTitle, { color: colors.foreground }]}>{s.species}</Text>
                      <View style={styles.rowRight}>
                        <Text style={[styles.rowCount, { color: colors.mutedForeground }]}>{s.count} scans</Text>
                        <Feather name={t.name} size={16} color={t.color} />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Active Depths */}
            {insights.hotDepths?.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>ACTIVE DEPTHS</Text>
                {insights.hotDepths.map((d, i) => (
                  <View
                    key={i}
                    style={[styles.rowCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <Feather name="arrow-down" size={16} color={C.blue} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowTitle, { color: colors.foreground }]}>{d.range}</Text>
                      {d.notes ? (
                        <Text style={[styles.rowNotes, { color: colors.mutedForeground }]}>{d.notes}</Text>
                      ) : null}
                    </View>
                    <Text style={[styles.rowCount, { color: colors.mutedForeground }]}>{d.count}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Peak Times */}
            {insights.hotTimes?.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>PEAK TIMES</Text>
                <View style={styles.timeGrid}>
                  {insights.hotTimes.map((t, i) => (
                    <View
                      key={i}
                      style={[
                        styles.timeBox,
                        { backgroundColor: colors.card, borderColor: activityColor(t.activity) + "50" },
                      ]}
                    >
                      <View style={[styles.activityDot, { backgroundColor: activityColor(t.activity) }]} />
                      <Text style={[styles.timePeriod, { color: colors.foreground }]}>{t.period}</Text>
                      <Text style={[styles.timeActivity, { color: activityColor(t.activity) }]}>
                        {t.activity.toUpperCase()}
                      </Text>
                      {t.notes ? (
                        <Text style={[styles.timeNotes, { color: colors.mutedForeground }]} numberOfLines={2}>
                          {t.notes}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Hot Locations */}
            {insights.hotLocations?.filter(Boolean).length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>ACTIVE LOCATIONS</Text>
                <View style={styles.locWrap}>
                  {insights.hotLocations.filter(Boolean).map((loc, i) => (
                    <View
                      key={i}
                      style={[styles.locChip, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                      <Feather name="map-pin" size={12} color={C.gold} />
                      <Text style={[styles.locText, { color: colors.foreground }]}>{loc}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* AI Tips */}
            {insights.tips?.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>AI TIPS FROM THE DATA</Text>
                {insights.tips.map((tip, i) => (
                  <View
                    key={i}
                    style={[styles.tipBox, { backgroundColor: colors.card, borderColor: C.gold + "30" }]}
                  >
                    <View style={[styles.tipNum, { backgroundColor: C.gold + "20" }]}>
                      <Text style={[styles.tipNumText, { color: C.gold }]}>{i + 1}</Text>
                    </View>
                    <Text style={[styles.tipText, { color: colors.foreground }]}>{tip}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Refresh note */}
            <Text style={[styles.refreshNote, { color: colors.mutedForeground }]}>
              Community intel refreshes every 6 hours as new scans come in.{"\n"}
              Every scan you run feeds the brain.
            </Text>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "column",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 4,
    gap: 4,
  },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-end",
    marginRight: 4,
    paddingVertical: 4,
  },
  refreshLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  scroll: { paddingHorizontal: 16, paddingTop: 8, gap: 0 },
  center: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingTop: 80,
  },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 8 },
  errorText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  retryBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  retryLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },

  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    gap: 10,
  },
  brainRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  brainTitle: { fontSize: 16, fontFamily: "Oswald_700Bold", letterSpacing: 0.5 },
  brainSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveText: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1 },
  summary: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },

  section: { marginBottom: 20, gap: 8 },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  rowCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  rowTitle: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  rowNotes: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowCount: { fontSize: 12, fontFamily: "Inter_400Regular" },

  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  timeBox: {
    width: "47%",
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 4,
    alignItems: "flex-start",
  },
  activityDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 2 },
  timePeriod: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  timeActivity: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },
  timeNotes: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 15, marginTop: 2 },

  locWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  locChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  locText: { fontSize: 13, fontFamily: "Inter_400Regular" },

  tipBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  tipNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  tipNumText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  tipText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },

  refreshNote: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 17,
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 20,
  },
});
