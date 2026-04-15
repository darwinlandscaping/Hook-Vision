import React, { useState } from "react";
import {
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

import { HVHeader } from "@/components/HVHeader";
import { HistoryItem } from "@/components/HistoryItem";
import type { HistoryEntry } from "@/components/HistoryItem";
import { useColors } from "@/hooks/useColors";
import { useHistory } from "@/context/HistoryContext";
import { useAutoNarrate } from "@/hooks/useAutoNarrate";

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { history, removeEntry, clearHistory } = useHistory();
  const [selected, setSelected] = useState<HistoryEntry | null>(null);

  useAutoNarrate(() => `Fishing History. You have ${history.length} saved sonar scan${history.length === 1 ? "" : "s"}.`);

  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const botPad = Platform.OS === "web" ? 70 : insets.bottom + 24;

  const handleDelete = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (selected?.id === id) setSelected(null);
    removeEntry(id);
  };

  const handleClear = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setSelected(null);
    clearHistory();
  };

  const handlePress = (entry: HistoryEntry) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected(entry);
  };

  const closeModal = () => setSelected(null);

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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <HVHeader subtitle="Session History" />
        {history.length > 0 && (
          <TouchableOpacity onPress={handleClear} activeOpacity={0.7} style={styles.clearWrap}>
            <Text style={[styles.clearBtn, { color: colors.destructive }]}>Clear all</Text>
          </TouchableOpacity>
        )}
      </View>

      {history.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="clock" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No history yet</Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
            Your past sonar analyses will appear here.
          </Text>
        </View>
      ) : (
        <FlatList<HistoryEntry>
          data={history}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <HistoryItem
              entry={item}
              onPress={handlePress}
              onDelete={handleDelete}
            />
          )}
          contentContainerStyle={[styles.list, { paddingBottom: botPad }]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          scrollEnabled={history.length > 0}
        />
      )}

      <Modal
        visible={selected !== null}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
        statusBarTranslucent
      >
        <Pressable style={styles.backdrop} onPress={closeModal}>
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHandle} />

            <TouchableOpacity style={styles.closeBtn} onPress={closeModal} activeOpacity={0.7}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>

            {selected && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: botPad + 8 }}>
                <Image
                  source={{ uri: selected.imageUri }}
                  style={styles.bigImage}
                  resizeMode="cover"
                />

                <View style={styles.metaRow}>
                  <Text style={[styles.metaTime, { color: colors.mutedForeground }]}>
                    {timeAgo(selected.timestamp)}
                  </Text>
                </View>

                <View style={styles.statGrid}>
                  <View style={[styles.statBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="fish" size={22} color={colors.primary} />
                    <Text style={[styles.statVal, { color: colors.foreground }]}>{selected.fishCount}</Text>
                    <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Fish</Text>
                  </View>
                  <View style={[styles.statBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Feather name="arrow-down" size={22} color="#00a8ff" />
                    <Text style={[styles.statVal, { color: colors.foreground }]}>{selected.depth}</Text>
                    <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Depth</Text>
                  </View>
                </View>

                <Text style={[styles.speciesName, { color: colors.foreground }]}>{selected.species}</Text>

                {selected.suggestion ? (
                  <View style={[styles.suggestionBox, { backgroundColor: colors.background, borderColor: "#ffd70033" }]}>
                    <Text style={[styles.suggestionLabel, { color: "#ffd700" }]}>Lure Suggestion</Text>
                    <Text style={[styles.suggestionText, { color: colors.foreground }]}>{selected.suggestion}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[styles.reanalyseBtn, { backgroundColor: colors.primary }]}
                  activeOpacity={0.8}
                  onPress={() => {
                    closeModal();
                    router.push("/(tabs)");
                  }}
                >
                  <MaterialCommunityIcons name="fish" size={16} color="#000" />
                  <Text style={styles.reanalyseBtnText}>Re-analyse</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "column",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 4,
  },
  clearWrap: { alignSelf: "flex-end", marginRight: 8 },
  clearBtn: { fontSize: 14, fontFamily: "Inter_500Medium" },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  emptyDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  list: { paddingHorizontal: 20, paddingTop: 4 },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    paddingTop: 12,
    paddingHorizontal: 20,
    maxHeight: "90%",
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ffffff30",
    alignSelf: "center",
    marginBottom: 12,
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    padding: 4,
    zIndex: 10,
  },
  bigImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: "#1a3050",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 12,
  },
  metaTime: { fontSize: 12, fontFamily: "Inter_400Regular" },
  statGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  statVal: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  speciesName: {
    fontSize: 20,
    fontFamily: "Oswald_700Bold",
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  suggestionBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 6,
    marginBottom: 20,
  },
  suggestionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  suggestionText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  reanalyseBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  reanalyseBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#000",
  },
});
