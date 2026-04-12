import React from "react";
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { HVHeader } from "@/components/HVHeader";
import { HistoryItem } from "@/components/HistoryItem";
import type { HistoryEntry } from "@/components/HistoryItem";
import { useColors } from "@/hooks/useColors";
import { useHistory } from "@/context/HistoryContext";
import { useAutoNarrate } from "@/hooks/useAutoNarrate";

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { history, removeEntry, clearHistory } = useHistory();
  useAutoNarrate(() => `Fishing History. You have ${history.length} saved sonar scan${history.length === 1 ? "" : "s"}.`);

  const topPad = Platform.OS === "web" ? 0 : insets.top;

  const handleDelete = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    removeEntry(id);
  };

  const handleClear = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    clearHistory();
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
              onPress={() => {}}
              onDelete={handleDelete}
            />
          )}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: Platform.OS === "web" ? 70 : insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          scrollEnabled={history.length > 0}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "column",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 4,
  },
  clearWrap: {
    alignSelf: "flex-end",
    marginRight: 8,
  },
  title: {
    fontSize: 24,
    fontFamily: "Oswald_700Bold",
    letterSpacing: 0.5,
  },
  clearBtn: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    marginTop: 8,
  },
  emptyDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
});
