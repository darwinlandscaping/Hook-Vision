import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import type { RiverScanEntry } from "@/context/RiverScanContext";

interface Props {
  scan: RiverScanEntry;
  onPress: (scan: RiverScanEntry) => void;
  onDelete: (id: string) => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

export function RiverScanCard({ scan, onPress, onDelete }: Props) {
  const colors = useColors();
  const depthRange = scan.points.length > 0
    ? `${scan.minDepth.toFixed(1)}–${scan.maxDepth.toFixed(1)}m`
    : "—";
  const depthFill = scan.maxDepth > 0
    ? Math.min(scan.maxDepth / 15, 1)
    : 0;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => onPress(scan)}
      activeOpacity={0.75}
    >
      {/* Left — depth visual */}
      <View style={[styles.depthVisual, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <View style={styles.depthBar}>
          <View
            style={[
              styles.depthFill,
              { height: `${depthFill * 100}%`, backgroundColor: colors.primary + "80" },
            ]}
          />
        </View>
        <Text style={[styles.depthMax, { color: colors.primary }]}>
          {scan.maxDepth > 0 ? `${scan.maxDepth.toFixed(0)}m` : "—"}
        </Text>
        <Text style={[styles.depthLabel, { color: colors.mutedForeground }]}>deep</Text>
      </View>

      {/* Middle — info */}
      <View style={styles.info}>
        <View style={styles.topRow}>
          <View style={styles.badge}>
            <MaterialCommunityIcons name="waves" size={11} color={colors.primary} />
            <Text style={[styles.badgeText, { color: colors.primary }]}>RIVER SCAN</Text>
          </View>
          <Text style={[styles.ago, { color: colors.mutedForeground }]}>
            {timeAgo(scan.startTime)}
          </Text>
        </View>

        {scan.locationName ? (
          <Text style={[styles.location, { color: colors.foreground }]} numberOfLines={1}>
            {scan.locationName}
          </Text>
        ) : (
          <Text style={[styles.location, { color: colors.mutedForeground }]}>
            GPS location
          </Text>
        )}

        <View style={styles.statsRow}>
          <View style={styles.statPill}>
            <Feather name="map-pin" size={10} color={colors.mutedForeground} />
            <Text style={[styles.statText, { color: colors.mutedForeground }]}>
              {scan.points.length} pts
            </Text>
          </View>
          <View style={styles.statPill}>
            <Feather name="arrow-down" size={10} color={colors.mutedForeground} />
            <Text style={[styles.statText, { color: colors.mutedForeground }]}>{depthRange}</Text>
          </View>
          {scan.totalFish > 0 && (
            <View style={styles.statPill}>
              <MaterialCommunityIcons name="fish" size={10} color={colors.primary} />
              <Text style={[styles.statText, { color: colors.primary }]}>{scan.totalFish}</Text>
            </View>
          )}
          <View style={styles.statPill}>
            <Feather name="clock" size={10} color={colors.mutedForeground} />
            <Text style={[styles.statText, { color: colors.mutedForeground }]}>
              {formatDuration(scan.duration)}
            </Text>
          </View>
        </View>
      </View>

      {/* Right — 3D icon + delete */}
      <View style={styles.right}>
        <View style={[styles.viewBadge, { borderColor: colors.primary + "40" }]}>
          <Feather name="box" size={14} color={colors.primary} />
          <Text style={[styles.viewText, { color: colors.primary }]}>3D</Text>
        </View>
        <TouchableOpacity
          onPress={() => onDelete(scan.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.deleteBtn}
        >
          <Feather name="trash-2" size={13} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  depthVisual: {
    width: 46,
    height: 64,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 6,
    overflow: "hidden",
  },
  depthBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    justifyContent: "flex-end",
  },
  depthFill: { borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  depthMax: { fontSize: 13, fontFamily: "Inter_700Bold", zIndex: 1 },
  depthLabel: { fontSize: 9, fontFamily: "Inter_400Regular", zIndex: 1 },
  info: { flex: 1, gap: 4 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  badgeText: { fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  ago: { fontSize: 10, fontFamily: "Inter_400Regular" },
  location: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 2 },
  statPill: { flexDirection: "row", alignItems: "center", gap: 3 },
  statText: { fontSize: 10, fontFamily: "Inter_400Regular" },
  right: { alignItems: "center", gap: 8 },
  viewBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  viewText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  deleteBtn: { padding: 2 },
});
