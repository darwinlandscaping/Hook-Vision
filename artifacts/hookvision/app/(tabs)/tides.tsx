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

const NT_PORTS = [
  { key: "darwin", label: "Darwin" },
  { key: "gove", label: "Gove" },
  { key: "groote", label: "Groote" },
];

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
}

async function fetchTides(port: string): Promise<TideResponse> {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const baseUrl = domain ? `https://${domain}` : "";
  const res = await fetch(`${baseUrl}/api/tides?port=${port}&days=3`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Network error" }));
    throw new Error((err as { error: string }).error || "Failed to load tides");
  }
  return res.json() as Promise<TideResponse>;
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth()
  ) {
    return "Today";
  }
  if (
    date.getDate() === tomorrow.getDate() &&
    date.getMonth() === tomorrow.getMonth()
  ) {
    return "Tomorrow";
  }
  return date.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function TideEntryRow({ tide, colors }: { tide: TideEntry; colors: ReturnType<typeof useColors> }) {
  const isHigh = tide.type === "HW";
  const now = Date.now();
  const isPast = tide.timestamp < now;

  return (
    <View style={[styles.tideRow, isPast && styles.pastRow]}>
      <View style={[styles.tideTypeTag, { backgroundColor: isHigh ? `${colors.accent}22` : `${colors.secondary}` }]}>
        <Feather
          name={isHigh ? "arrow-up" : "arrow-down"}
          size={14}
          color={isHigh ? colors.accent : colors.mutedForeground}
        />
        <Text style={[styles.tideTypeText, { color: isHigh ? colors.accent : colors.mutedForeground }]}>
          {isHigh ? "HIGH" : "LOW"}
        </Text>
      </View>
      <Text style={[styles.tideTime, { color: isPast ? colors.mutedForeground : colors.foreground }]}>
        {tide.time}
      </Text>
      <View style={styles.tideHeightContainer}>
        <Text style={[styles.tideHeight, { color: isHigh ? colors.accent : colors.mutedForeground }]}>
          {tide.height.toFixed(2)}
        </Text>
        <Text style={[styles.tideUnit, { color: colors.mutedForeground }]}>m</Text>
      </View>
      {isPast && (
        <Text style={[styles.passedLabel, { color: colors.mutedForeground }]}>passed</Text>
      )}
    </View>
  );
}

function NextTideCard({ data, colors }: { data: TideDay[]; colors: ReturnType<typeof useColors> }) {
  const now = Date.now();
  const allTides = data.flatMap((day) => day.tides);
  const next = allTides.find((t) => t.timestamp > now);
  const prev = [...allTides].reverse().find((t) => t.timestamp <= now);

  if (!next) return null;

  const msUntil = next.timestamp - now;
  const hoursUntil = Math.floor(msUntil / 3600000);
  const minsUntil = Math.floor((msUntil % 3600000) / 60000);

  const isRising = prev ? next.type === "HW" : next.type === "LW";

  return (
    <View style={[styles.nextCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.nextCardHeader}>
        <Feather
          name={isRising ? "trending-up" : "trending-down"}
          size={18}
          color={isRising ? colors.accent : colors.primary}
        />
        <Text style={[styles.nextCardTitle, { color: colors.mutedForeground }]}>
          {isRising ? "Tide Rising" : "Tide Falling"}
        </Text>
      </View>
      <View style={styles.nextCardBody}>
        <View>
          <Text style={[styles.nextTideType, { color: colors.foreground }]}>
            Next {next.type === "HW" ? "High" : "Low"} Water
          </Text>
          <Text style={[styles.nextTideTime, { color: colors.primary }]}>
            {next.time}
          </Text>
        </View>
        <View style={styles.countdownBox}>
          <Text style={[styles.countdownNumber, { color: colors.foreground }]}>
            {hoursUntil}h {minsUntil}m
          </Text>
          <Text style={[styles.countdownLabel, { color: colors.mutedForeground }]}>away</Text>
        </View>
      </View>
      <View style={styles.heightRow}>
        <Text style={[styles.heightLabel, { color: colors.mutedForeground }]}>Height</Text>
        <Text style={[styles.heightValue, { color: next.type === "HW" ? colors.accent : colors.primary }]}>
          {next.height.toFixed(2)}m
        </Text>
        {prev && (
          <>
            <Text style={[styles.heightLabel, { color: colors.mutedForeground }]}>
              {" "}· Previous
            </Text>
            <Text style={[styles.heightValue, { color: colors.mutedForeground }]}>
              {" "}{prev.height.toFixed(2)}m
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

export default function TidesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [selectedPort, setSelectedPort] = useState("darwin");

  const { data, isLoading, error, refetch, isRefetching } = useQuery<TideResponse>({
    queryKey: ["tides", selectedPort],
    queryFn: () => fetchTides(selectedPort),
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });

  const topPad = Platform.OS === "web" ? 0 : insets.top;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: topPad + 16,
          paddingBottom: Platform.OS === "web" ? 70 : insets.bottom + 24,
        },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={colors.primary}
        />
      }
    >
      <HVHeader subtitle="NT Tide Predictions" />

      <View style={styles.portSelector}>
        {NT_PORTS.map((port) => (
          <TouchableOpacity
            key={port.key}
            style={[
              styles.portChip,
              {
                backgroundColor:
                  selectedPort === port.key ? colors.primary : colors.secondary,
                borderColor:
                  selectedPort === port.key ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setSelectedPort(port.key)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.portChipText,
                {
                  color:
                    selectedPort === port.key
                      ? colors.primaryForeground
                      : colors.mutedForeground,
                },
              ]}
            >
              {port.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading && (
        <View style={styles.loadingState}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Fetching tide data...
          </Text>
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
          {data.data.length > 0 && (
            <NextTideCard data={data.data} colors={colors} />
          )}

          {data.data.map((day) => (
            <View key={day.date}>
              <Text style={[styles.dayHeader, { color: colors.mutedForeground }]}>
                {formatDate(day.date)}
              </Text>
              <View style={[styles.dayCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {day.tides.length === 0 ? (
                  <Text style={[styles.noDataText, { color: colors.mutedForeground }]}>
                    No tide data available for this day
                  </Text>
                ) : (
                  day.tides.map((tide, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && (
                        <View style={[styles.tideDivider, { backgroundColor: colors.border }]} />
                      )}
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
              Predictions sourced from Bureau of Meteorology. Always check current conditions before heading out. Darwin time (ACST, UTC+9:30).
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 14, gap: 8 },
  header: { gap: 2 },
  title: { fontSize: 22, fontFamily: "Oswald_700Bold", letterSpacing: 0.5 },
  subtitle: { fontSize: 11, fontFamily: "Inter_400Regular" },
  portSelector: { flexDirection: "row", gap: 6 },
  portChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  portChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  loadingState: { alignItems: "center", gap: 12, paddingVertical: 40 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  retryText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  nextCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  nextCardHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  nextCardTitle: { fontSize: 10, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.8 },
  nextCardBody: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  nextTideType: { fontSize: 12, fontFamily: "Inter_500Medium" },
  nextTideTime: { fontSize: 22, fontFamily: "Inter_700Bold", marginTop: 2 },
  countdownBox: { alignItems: "flex-end" },
  countdownNumber: { fontSize: 18, fontFamily: "Inter_700Bold" },
  countdownLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  heightRow: { flexDirection: "row", alignItems: "center" },
  heightLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  heightValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginLeft: 4 },
  dayHeader: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: -8,
  },
  dayCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  tideRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  pastRow: { opacity: 0.45 },
  tideTypeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    width: 70,
  },
  tideTypeText: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  tideTime: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  tideHeightContainer: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  tideHeight: { fontSize: 15, fontFamily: "Inter_700Bold" },
  tideUnit: { fontSize: 12, fontFamily: "Inter_400Regular" },
  passedLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  tideDivider: { height: 1, marginHorizontal: 14 },
  noDataText: { fontSize: 14, fontFamily: "Inter_400Regular", padding: 16, textAlign: "center" },
  disclaimer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 10,
  },
  disclaimerText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
});
