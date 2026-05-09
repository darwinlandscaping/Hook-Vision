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
import { RiverScanCard } from "@/components/RiverScanCard";
import { RiverScanRecorder } from "@/components/RiverScanRecorder";
import { RiverScan3DViewer } from "@/components/RiverScan3DViewer";
import { useColors } from "@/hooks/useColors";
import { useHistory } from "@/context/HistoryContext";
import { useRiverScans } from "@/context/RiverScanContext";
import type { RiverScanEntry } from "@/context/RiverScanContext";
import { useAutoNarrate } from "@/hooks/useAutoNarrate";

type Tab = "sonar" | "river";

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { history, removeEntry, clearHistory } = useHistory();
  const { scans, addScan, removeScan, clearScans } = useRiverScans();

  const [tab, setTab] = useState<Tab>("sonar");
  const [selected, setSelected] = useState<HistoryEntry | null>(null);
  const [viewingScan, setViewingScan] = useState<RiverScanEntry | null>(null);
  const [recording, setRecording] = useState(false);

  useAutoNarrate(() =>
    tab === "sonar"
      ? `Sonar History. ${history.length} scan${history.length === 1 ? "" : "s"}.`
      : `River Scans. ${scans.length} 3D map${scans.length === 1 ? "" : "s"}.`,
  );

  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const botPad = Platform.OS === "web" ? 70 : insets.bottom + 24;

  const handleDelete = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (selected?.id === id) setSelected(null);
    removeEntry(id);
  };

  const handleClear = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (tab === "sonar") {
      setSelected(null);
      clearHistory();
    } else {
      setViewingScan(null);
      clearScans();
    }
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

  const hasItems = tab === "sonar" ? history.length > 0 : scans.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <HVHeader subtitle="Session History" />

        {/* Segment control */}
        <View style={[styles.segmentBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.segBtn,
              tab === "sonar" && { backgroundColor: colors.primary },
            ]}
            onPress={() => setTab("sonar")}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="fish"
              size={13}
              color={tab === "sonar" ? "#000" : colors.mutedForeground}
            />
            <Text style={[styles.segText, { color: tab === "sonar" ? "#000" : colors.mutedForeground }]}>
              SONAR
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.segBtn,
              tab === "river" && { backgroundColor: colors.primary },
            ]}
            onPress={() => setTab("river")}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="waves"
              size={13}
              color={tab === "river" ? "#000" : colors.mutedForeground}
            />
            <Text style={[styles.segText, { color: tab === "river" ? "#000" : colors.mutedForeground }]}>
              RIVER SCANS
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionRow}>
          {tab === "river" && (
            <TouchableOpacity
              style={[styles.newScanBtn, { backgroundColor: colors.primary }]}
              onPress={() => setRecording(true)}
              activeOpacity={0.8}
            >
              <Feather name="plus" size={14} color="#000" />
              <Text style={styles.newScanText}>NEW SCAN</Text>
            </TouchableOpacity>
          )}
          {hasItems && (
            <TouchableOpacity
              onPress={handleClear}
              activeOpacity={0.7}
              style={styles.clearWrap}
            >
              <Text style={[styles.clearBtn, { color: colors.destructive }]}>Clear all</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* SONAR tab */}
      {tab === "sonar" && (
        history.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="clock" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No sonar history</Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
              Your past sonar analyses will appear here.
            </Text>
          </View>
        ) : (
          <FlatList<HistoryEntry>
            data={history}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <HistoryItem entry={item} onPress={handlePress} onDelete={handleDelete} />
            )}
            contentContainerStyle={[styles.list, { paddingBottom: botPad }]}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            scrollEnabled={history.length > 0}
          />
        )
      )}

      {/* RIVER SCANS tab */}
      {tab === "river" && (
        scans.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="waves" size={44} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No river scans yet</Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
              Tap NEW SCAN to GPS-track your depth readings and generate a 3D bottom contour map.
            </Text>
            <TouchableOpacity
              style={[styles.emptyStartBtn, { backgroundColor: colors.primary }]}
              onPress={() => setRecording(true)}
              activeOpacity={0.8}
            >
              <Feather name="plus" size={15} color="#000" />
              <Text style={styles.emptyStartText}>START FIRST SCAN</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList<RiverScanEntry>
            data={scans}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <RiverScanCard
                scan={item}
                onPress={(s) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setViewingScan(s);
                }}
                onDelete={(id) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (viewingScan?.id === id) setViewingScan(null);
                  removeScan(id);
                }}
              />
            )}
            contentContainerStyle={[styles.list, { paddingBottom: botPad }]}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          />
        )
      )}

      {/* ── Sonar detail modal ── */}
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
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: botPad + 8 }}
              >
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
                  onPress={() => { closeModal(); router.push("/(tabs)" as any); }}
                >
                  <MaterialCommunityIcons name="fish" size={16} color="#000" />
                  <Text style={styles.reanalyseBtnText}>Re-analyse</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── 3D viewer modal ── */}
      <Modal
        visible={viewingScan !== null}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={() => setViewingScan(null)}
      >
        <View style={[styles.viewerRoot, { backgroundColor: "#020c16" }]}>
          <View style={[styles.viewerHeader, { paddingTop: topPad + 8 }]}>
            <TouchableOpacity
              onPress={() => setViewingScan(null)}
              style={styles.viewerBack}
              activeOpacity={0.7}
            >
              <Feather name="arrow-left" size={20} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
            <View style={styles.viewerTitleBlock}>
              <Text style={styles.viewerTitle} numberOfLines={1}>
                {viewingScan?.locationName ?? "River Scan"}
              </Text>
              {viewingScan && (
                <Text style={styles.viewerSub}>
                  {viewingScan.points.length} pts · {viewingScan.minDepth.toFixed(1)}–{viewingScan.maxDepth.toFixed(1)}m
                </Text>
              )}
            </View>
            <View style={{ width: 40 }} />
          </View>
          {viewingScan && (
            <RiverScan3DViewer scan={viewingScan} style={{ flex: 1 }} />
          )}
        </View>
      </Modal>

      {/* ── Recorder ── */}
      <RiverScanRecorder
        visible={recording}
        onClose={() => setRecording(false)}
        onComplete={(scan) => {
          addScan(scan);
          setRecording(false);
          setTab("river");
          setTimeout(() => setViewingScan(scan), 300);
        }}
      />
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
    gap: 10,
  },

  // Segment
  segmentBar: {
    flexDirection: "row",
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
    gap: 2,
    alignSelf: "stretch",
  },
  segBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 7,
    borderRadius: 8,
  },
  segText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.8 },

  // Action row
  actionRow: {
    flexDirection: "row",
    alignSelf: "stretch",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 28,
  },
  newScanBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  newScanText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#000", letterSpacing: 0.5 },
  clearWrap: { marginLeft: "auto" },
  clearBtn: { fontSize: 14, fontFamily: "Inter_500Medium" },

  // List
  list: { paddingHorizontal: 20, paddingTop: 4 },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  emptyDesc: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  emptyStartBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  emptyStartText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#000" },

  // Sonar detail sheet
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1,
    paddingTop: 12, paddingHorizontal: 20, maxHeight: "90%",
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: "#ffffff30",
    alignSelf: "center", marginBottom: 12,
  },
  closeBtn: { position: "absolute", top: 16, right: 16, padding: 4, zIndex: 10 },
  bigImage: { width: "100%", height: 200, borderRadius: 12, marginBottom: 12, backgroundColor: "#1a3050" },
  metaRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 12 },
  metaTime: { fontSize: 12, fontFamily: "Inter_400Regular" },
  statGrid: { flexDirection: "row", gap: 12, marginBottom: 16 },
  statBox: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 14, borderRadius: 12, borderWidth: 1 },
  statVal: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  speciesName: { fontSize: 20, fontFamily: "Oswald_700Bold", letterSpacing: 0.5, marginBottom: 14 },
  suggestionBox: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 6, marginBottom: 20 },
  suggestionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, textTransform: "uppercase" },
  suggestionText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  reanalyseBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14, borderRadius: 12,
  },
  reanalyseBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#000" },

  // 3D viewer
  viewerRoot: { flex: 1 },
  viewerHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  viewerBack: { padding: 6, width: 40 },
  viewerTitleBlock: { flex: 1, alignItems: "center" },
  viewerTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "rgba(255,255,255,0.85)" },
  viewerSub: { fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.4)", marginTop: 2 },
});
