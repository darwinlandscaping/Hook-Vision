import React, { useState } from "react";
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
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import { HVHeader } from "@/components/HVHeader";
import { useColors } from "@/hooks/useColors";
import { useAutoNarrate } from "@/hooks/useAutoNarrate";
import {
  NT_TIDE_REGIONS,
  TYPE_LABELS,
  TYPE_COLORS,
  type TideLocation,
  type TideRegion,
} from "@/data/ntTideLocations";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface TideEntry {
  time: string;
  type: "HW" | "LW";
  height: number;
  timestamp: number;
}
interface TideDay {
  date: string;
  tides: TideEntry[];
}
interface TideResponse {
  port: string;
  portKey: string;
  data: TideDay[];
  isSecondary?: boolean;
  refPort?: string;
}

// ─── API ───────────────────────────────────────────────────────────────────────
async function fetchTidesForLocation(locationId: string): Promise<TideResponse> {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const baseUrl = domain ? `https://${domain}` : "";
  const res = await fetch(`${baseUrl}/api/tides?location=${locationId}&days=3`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Network error" }));
    throw new Error((err as { error: string }).error || "Failed to load tides");
  }
  return res.json();
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (date.getDate() === today.getDate() && date.getMonth() === today.getMonth())
    return "Today";
  if (date.getDate() === tomorrow.getDate() && date.getMonth() === tomorrow.getMonth())
    return "Tomorrow";
  return date.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function TideEntryRow({ tide, colors }: { tide: TideEntry; colors: ReturnType<typeof useColors> }) {
  const isHigh = tide.type === "HW";
  const isPast = tide.timestamp < Date.now();
  return (
    <View style={[styles.tideRow, isPast && styles.pastRow]}>
      <View style={[styles.tideTypeTag, { backgroundColor: isHigh ? `${colors.accent}22` : colors.secondary }]}>
        <Feather name={isHigh ? "arrow-up" : "arrow-down"} size={14} color={isHigh ? colors.accent : colors.mutedForeground} />
        <Text style={[styles.tideTypeText, { color: isHigh ? colors.accent : colors.mutedForeground }]}>
          {isHigh ? "HIGH" : "LOW"}
        </Text>
      </View>
      <Text style={[styles.tideTime, { color: isPast ? colors.mutedForeground : colors.foreground }]}>{tide.time}</Text>
      <View style={styles.tideHeightRow}>
        <Text style={[styles.tideHeight, { color: isHigh ? colors.accent : colors.mutedForeground }]}>{tide.height.toFixed(2)}</Text>
        <Text style={[styles.tideUnit, { color: colors.mutedForeground }]}>m</Text>
      </View>
      {isPast && <Text style={[styles.passedLabel, { color: colors.mutedForeground }]}>passed</Text>}
    </View>
  );
}

function NextTideCard({ data, colors }: { data: TideDay[]; colors: ReturnType<typeof useColors> }) {
  const now = Date.now();
  const all = data.flatMap((d) => d.tides);
  const next = all.find((t) => t.timestamp > now);
  const prev = [...all].reverse().find((t) => t.timestamp <= now);
  if (!next) return null;
  const ms = next.timestamp - now;
  const h = Math.floor(ms / 3600000);
  const min = Math.floor((ms % 3600000) / 60000);
  const rising = prev ? next.type === "HW" : next.type === "LW";
  return (
    <View style={[styles.nextCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.nextCardHeader}>
        <Feather name={rising ? "trending-up" : "trending-down"} size={18} color={rising ? colors.accent : colors.primary} />
        <Text style={[styles.nextCardTitle, { color: colors.mutedForeground }]}>
          {rising ? "Tide Rising" : "Tide Falling"}
        </Text>
      </View>
      <View style={styles.nextCardBody}>
        <View>
          <Text style={[styles.nextTideType, { color: colors.foreground }]}>Next {next.type === "HW" ? "High" : "Low"} Water</Text>
          <Text style={[styles.nextTideTime, { color: colors.primary }]}>{next.time}</Text>
        </View>
        <View style={styles.countdownBox}>
          <Text style={[styles.countdownNum, { color: colors.foreground }]}>{h}h {min}m</Text>
          <Text style={[styles.countdownLabel, { color: colors.mutedForeground }]}>away</Text>
        </View>
      </View>
      <View style={styles.nextHeightRow}>
        <Text style={[styles.nextHeightLabel, { color: colors.mutedForeground }]}>Height</Text>
        <Text style={[styles.nextHeightVal, { color: next.type === "HW" ? colors.accent : colors.primary }]}>
          {next.height.toFixed(2)}m
        </Text>
        {prev && (
          <>
            <Text style={[styles.nextHeightLabel, { color: colors.mutedForeground }]}> · Prev</Text>
            <Text style={[styles.nextHeightVal, { color: colors.mutedForeground }]}> {prev.height.toFixed(2)}m</Text>
          </>
        )}
      </View>
    </View>
  );
}

// ─── Location card ─────────────────────────────────────────────────────────────
function LocationCard({
  loc,
  regionColor,
  onSelect,
  colors,
}: {
  loc: TideLocation;
  regionColor: string;
  onSelect: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const typeColor = TYPE_COLORS[loc.type];
  return (
    <TouchableOpacity
      style={[styles.locCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onSelect}
      activeOpacity={0.8}
    >
      {/* Left accent bar */}
      <View style={[styles.locAccent, { backgroundColor: regionColor }]} />

      <View style={styles.locBody}>
        <View style={styles.locHeader}>
          <Text style={styles.locEmoji}>{loc.emoji}</Text>
          <View style={styles.locTitleCol}>
            <View style={styles.locTitleRow}>
              <Text style={[styles.locName, { color: colors.foreground }]} numberOfLines={1}>
                {loc.name}
              </Text>
              {loc.star && <Text style={styles.starBadge}>★</Text>}
            </View>
            <View style={[styles.typeBadge, { backgroundColor: `${typeColor}22` }]}>
              <Text style={[styles.typeBadgeText, { color: typeColor }]}>{TYPE_LABELS[loc.type]}</Text>
            </View>
          </View>
          <View style={[styles.checkBtn, { backgroundColor: regionColor + "22", borderColor: regionColor + "55" }]}>
            <Feather name="clock" size={13} color={regionColor} />
            <Text style={[styles.checkBtnText, { color: regionColor }]}>Tides</Text>
          </View>
        </View>

        <Text style={[styles.locTip, { color: colors.mutedForeground }]} numberOfLines={2}>
          {loc.tip}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Tide detail view ──────────────────────────────────────────────────────────
function TideDetailView({
  loc,
  region,
  onBack,
  colors,
  topPad,
  bottomPad,
}: {
  loc: TideLocation;
  region: TideRegion;
  onBack: () => void;
  colors: ReturnType<typeof useColors>;
  topPad: number;
  bottomPad: number;
}) {
  const { data, isLoading, error, refetch, isRefetching } = useQuery<TideResponse>({
    queryKey: ["tides-loc", loc.id],
    queryFn: () => fetchTidesForLocation(loc.id),
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 12, paddingBottom: bottomPad }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
    >
      {/* Back button */}
      <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]} onPress={onBack} activeOpacity={0.7}>
        <Feather name="arrow-left" size={16} color={colors.foreground} />
        <Text style={[styles.backBtnText, { color: colors.foreground }]}>{region.name}</Text>
      </TouchableOpacity>

      {/* Location header */}
      <View style={[styles.detailHeader, { backgroundColor: colors.card, borderColor: region.color + "55" }]}>
        <View style={[styles.detailAccent, { backgroundColor: region.color }]} />
        <View style={styles.detailHeaderBody}>
          <Text style={styles.detailEmoji}>{loc.emoji}</Text>
          <View style={{ flex: 1 }}>
            <View style={styles.detailTitleRow}>
              <Text style={[styles.detailName, { color: colors.foreground }]}>{loc.name}</Text>
              {loc.star && <Text style={styles.detailStar}>★</Text>}
            </View>
            <View style={[styles.typeBadge, { backgroundColor: `${TYPE_COLORS[loc.type]}22` }]}>
              <Text style={[styles.typeBadgeText, { color: TYPE_COLORS[loc.type] }]}>{TYPE_LABELS[loc.type]}</Text>
            </View>
          </View>
        </View>
        {/* Tip */}
        <View style={[styles.detailTipBox, { backgroundColor: colors.background }]}>
          <Text style={[styles.detailTipLabel, { color: region.color }]}>🎣 FISHING TIP</Text>
          <Text style={[styles.detailTip, { color: colors.foreground }]}>{loc.tip}</Text>
        </View>
      </View>

      {isLoading && (
        <View style={styles.loadingState}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Fetching tide predictions...</Text>
        </View>
      )}

      {error && (
        <View style={[styles.errorBox, { backgroundColor: `${colors.destructive}18`, borderColor: `${colors.destructive}44` }]}>
          <Feather name="alert-circle" size={16} color={colors.destructive} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.errorText, { color: colors.destructive }]}>
              {error instanceof Error ? error.message : "Could not load tides"}
            </Text>
            <TouchableOpacity onPress={() => refetch()} style={{ marginTop: 6 }}>
              <Text style={[styles.retryText, { color: colors.primary }]}>Tap to retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {data && (
        <>
          {data.data.length > 0 && <NextTideCard data={data.data} colors={colors} />}

          {data.data.map((day) => (
            <View key={day.date}>
              <Text style={[styles.dayHeader, { color: colors.mutedForeground }]}>{formatDate(day.date)}</Text>
              <View style={[styles.dayCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {day.tides.length === 0 ? (
                  <Text style={[styles.noDataText, { color: colors.mutedForeground }]}>No data for this day</Text>
                ) : (
                  day.tides.map((tide, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && <View style={[styles.tideDivider, { backgroundColor: colors.border }]} />}
                      <TideEntryRow tide={tide} colors={colors} />
                    </React.Fragment>
                  ))
                )}
              </View>
            </View>
          ))}

          <View style={[styles.disclaimer, { backgroundColor: colors.secondary }]}>
            <Feather name="info" size={12} color={colors.mutedForeground} />
            <Text style={[styles.disclaimerText, { color: colors.mutedForeground }]}>
              {data.isSecondary
                ? `Corrected from ${data.refPort === "darwin" ? "Darwin" : data.refPort === "gove" ? "Gove" : "Groote Eylandt"} BOM reference using standard secondary port corrections. Verify before use.`
                : "Predictions sourced from Bureau of Meteorology. Always check current conditions before heading out."}{" "}
              Darwin time (ACST, UTC+9:30).
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function TidesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [selectedRegionId, setSelectedRegionId] = useState("darwin");
  const [selectedLoc, setSelectedLoc] = useState<TideLocation | null>(null);

  useAutoNarrate(() => "NT Tides. 50 fishing locations across all NT rivers, boat ramps, river mouths and rock bars. Select a region to check your tides.");

  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 70 : insets.bottom + 24;
  const selectedRegion = NT_TIDE_REGIONS.find((r) => r.id === selectedRegionId) ?? NT_TIDE_REGIONS[0];

  // Show tide detail when a location is selected
  if (selectedLoc) {
    return (
      <TideDetailView
        loc={selectedLoc}
        region={selectedRegion}
        onBack={() => setSelectedLoc(null)}
        colors={colors}
        topPad={topPad}
        bottomPad={bottomPad}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Fixed header + region tabs */}
      <View style={{ paddingTop: topPad + 12, paddingHorizontal: 14, gap: 10, paddingBottom: 8 }}>
        <HVHeader subtitle="NT Tide Predictions" />

        {/* Region tabs — horizontal scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.regionTabRow}
        >
          {NT_TIDE_REGIONS.map((r) => {
            const active = r.id === selectedRegionId;
            return (
              <TouchableOpacity
                key={r.id}
                style={[
                  styles.regionTab,
                  {
                    backgroundColor: active ? r.color : colors.card,
                    borderColor: active ? r.color : colors.border,
                  },
                ]}
                onPress={() => { setSelectedRegionId(r.id); setSelectedLoc(null); }}
                activeOpacity={0.75}
              >
                <Text style={styles.regionTabEmoji}>{r.emoji}</Text>
                <Text style={[styles.regionTabText, { color: active ? "#0a1628" : colors.mutedForeground }]}>
                  {r.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Region subtitle */}
        <View style={styles.regionInfo}>
          <View style={[styles.regionDot, { backgroundColor: selectedRegion.color }]} />
          <Text style={[styles.regionInfoText, { color: colors.mutedForeground }]}>
            {selectedRegion.locations.length} locations · {selectedRegion.refNote}
          </Text>
        </View>
      </View>

      {/* Location list */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.locList, { paddingBottom: bottomPad }]}
      >
        {selectedRegion.locations.map((loc) => (
          <LocationCard
            key={loc.id}
            loc={loc}
            regionColor={selectedRegion.color}
            onSelect={() => setSelectedLoc(loc)}
            colors={colors}
          />
        ))}

        <View style={[styles.disclaimer, { backgroundColor: colors.secondary, marginTop: 4 }]}>
          <Feather name="info" size={12} color={colors.mutedForeground} />
          <Text style={[styles.disclaimerText, { color: colors.mutedForeground }]}>
            ★ marks iconic NT fishing locations. Tide times are in Darwin time (UTC+9:30). Secondary locations use BOM secondary port correction tables.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 14, gap: 10 },

  regionTabRow: { gap: 6, paddingBottom: 2 },
  regionTab: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1,
  },
  regionTabEmoji: { fontSize: 14 },
  regionTabText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  regionInfo: { flexDirection: "row", alignItems: "center", gap: 6 },
  regionDot: { width: 6, height: 6, borderRadius: 3 },
  regionInfoText: { fontSize: 11, fontFamily: "Inter_400Regular" },

  locList: { paddingHorizontal: 14, gap: 8, paddingTop: 4 },

  locCard: {
    borderRadius: 14, borderWidth: 1,
    overflow: "hidden", flexDirection: "row",
  },
  locAccent: { width: 4 },
  locBody: { flex: 1, padding: 12, gap: 6 },
  locHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  locEmoji: { fontSize: 22 },
  locTitleCol: { flex: 1, gap: 4 },
  locTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  locName: { fontSize: 14, fontFamily: "Inter_700Bold", flex: 1 },
  starBadge: { fontSize: 14, color: "#ffd700" },
  typeBadge: { alignSelf: "flex-start", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  typeBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  checkBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
  },
  checkBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  locTip: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },

  backBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 20, borderWidth: 1, alignSelf: "flex-start",
  },
  backBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  detailHeader: { borderRadius: 14, borderWidth: 1, overflow: "hidden", gap: 0 },
  detailAccent: { height: 4 },
  detailHeaderBody: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, paddingBottom: 8 },
  detailEmoji: { fontSize: 28 },
  detailTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  detailName: { fontSize: 16, fontFamily: "Inter_700Bold", flex: 1 },
  detailStar: { fontSize: 16, color: "#ffd700" },
  detailTipBox: { margin: 12, marginTop: 4, padding: 10, borderRadius: 10, gap: 4 },
  detailTipLabel: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.8 },
  detailTip: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },

  loadingState: { alignItems: "center", gap: 12, paddingVertical: 40 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },

  errorBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 10, borderWidth: 1 },
  errorText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  retryText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  nextCard: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 8 },
  nextCardHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  nextCardTitle: { fontSize: 10, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.8 },
  nextCardBody: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  nextTideType: { fontSize: 12, fontFamily: "Inter_500Medium" },
  nextTideTime: { fontSize: 22, fontFamily: "Inter_700Bold", marginTop: 2 },
  countdownBox: { alignItems: "flex-end" },
  countdownNum: { fontSize: 18, fontFamily: "Inter_700Bold" },
  countdownLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  nextHeightRow: { flexDirection: "row", alignItems: "center" },
  nextHeightLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  nextHeightVal: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginLeft: 4 },

  dayHeader: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: -4 },
  dayCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  tideRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  pastRow: { opacity: 0.45 },
  tideTypeTag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, width: 70 },
  tideTypeText: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  tideTime: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  tideHeightRow: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  tideHeight: { fontSize: 15, fontFamily: "Inter_700Bold" },
  tideUnit: { fontSize: 12, fontFamily: "Inter_400Regular" },
  passedLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  tideDivider: { height: 1, marginHorizontal: 14 },
  noDataText: { fontSize: 14, fontFamily: "Inter_400Regular", padding: 16, textAlign: "center" },

  disclaimer: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 10 },
  disclaimerText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
});
