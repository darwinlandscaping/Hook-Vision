import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

export interface HistoryEntry {
  id: string;
  imageUri: string;
  timestamp: number;
  fishCount: number;
  species: string;
  depth: string;
  suggestion: string;
}

interface HistoryItemProps {
  entry: HistoryEntry;
  onPress: (entry: HistoryEntry) => void;
  onDelete: (id: string) => void;
}

export function HistoryItem({ entry, onPress, onDelete }: HistoryItemProps) {
  const colors = useColors();

  const timeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (mins > 0) return `${mins}m ago`;
    return "just now";
  };

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => onPress(entry)}
      activeOpacity={0.7}
    >
      <Image source={{ uri: entry.imageUri }} style={styles.thumbnail} />
      <View style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.fishRow}>
            <MaterialCommunityIcons name="fish" size={14} color={colors.primary} />
            <Text style={[styles.fishCount, { color: colors.primary }]}>
              {entry.fishCount} fish
            </Text>
          </View>
          <Text style={[styles.time, { color: colors.mutedForeground }]}>
            {timeAgo(entry.timestamp)}
          </Text>
        </View>
        <Text style={[styles.species, { color: colors.foreground }]} numberOfLines={1}>
          {entry.species}
        </Text>
        <View style={styles.depthRow}>
          <Feather name="arrow-down" size={11} color={colors.mutedForeground} />
          <Text style={[styles.depth, { color: colors.mutedForeground }]}>{entry.depth}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={() => onDelete(entry.id)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Feather name="trash-2" size={14} color={colors.mutedForeground} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: "#1a3050",
  },
  content: {
    flex: 1,
    gap: 3,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  fishRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  fishCount: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  time: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  species: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  depthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  depth: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  deleteBtn: {
    padding: 4,
  },
});
