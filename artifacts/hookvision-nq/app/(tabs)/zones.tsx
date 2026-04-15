import React, { useState } from "react";
import {
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

import { HVHeader } from "@/components/HVHeader";
import { useColors } from "@/hooks/useColors";
import { useAutoNarrate } from "@/hooks/useAutoNarrate";
import { RIVER_SYSTEMS, type DepthZone, type RiverSystem } from "@/data/depthZones";

// ─── Hotness config ───────────────────────────────────────────────────────────
const HOTNESS: Record<string, { bar: string; badge: string; label: string }> = {
  fire: { bar: "#ff4500", badge: "#ff450022", label: "🔥 ON FIRE" },
  hot:  { bar: "#00d4aa", badge: "#00d4aa22", label: "✅ HOT" },
  warm: { bar: "#00a8ff", badge: "#00a8ff22", label: "🌊 ACTIVE" },
  cool: { bar: "#4a5568", badge: "#4a556822", label: "⏳ SLOW" },
};

// ─── Depth Bar visual ─────────────────────────────────────────────────────────
function DepthBar({
  zone,
  maxDepth,
  colors,
}: {
  zone: DepthZone;
  maxDepth: number;
  colors: ReturnType<typeof useColors>;
}) {
  const topPct = (zone.minM / maxDepth) * 100;
  const heightPct = ((zone.maxM - zone.minM) / maxDepth) * 100;
  const h = HOTNESS[zone.hotness];

  return (
    <View
      style={[
        styles.depthBarFill,
        {
          top: `${topPct}%` as any,
          height: `${heightPct}%` as any,
          backgroundColor: h.bar,
        },
      ]}
    />
  );
}

// ─── Zone Row ─────────────────────────────────────────────────────────────────
function ZoneRow({
  zone,
  maxDepth,
  colors,
}: {
  zone: DepthZone;
  maxDepth: number;
  colors: ReturnType<typeof useColors>;
}) {
  const [open, setOpen] = useState(false);
  const h = HOTNESS[zone.hotness];
  const topPct = (zone.minM / maxDepth) * 100;
  const heightPct = ((zone.maxM - zone.minM) / maxDepth) * 100;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => setOpen((o) => !o)}
      style={[
        styles.zoneRow,
        { backgroundColor: colors.card, borderColor: colors.border },
        open && { borderColor: h.bar },
      ]}
    >
      {/* Left depth ruler indicator */}
      <View style={[styles.zoneRulerBar, { backgroundColor: h.bar + "55" }]}>
        <View style={[styles.zoneRulerFill, { flex: heightPct, backgroundColor: h.bar }]} />
      </View>

      {/* Content */}
      <View style={{ flex: 1, gap: 6 }}>
        {/* Header row */}
        <View style={styles.zoneHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.zoneDepthLabel, { color: h.bar }]}>
              {zone.minM}–{zone.maxM}m
            </Text>
            <Text style={[styles.zoneName, { color: colors.foreground }]}>{zone.label}</Text>
          </View>
          <View style={[styles.hotnessBadge, { backgroundColor: h.badge, borderColor: h.bar + "44" }]}>
            <Text style={[styles.hotnessText, { color: h.bar }]}>{h.label}</Text>
          </View>
          <Feather
            name={open ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.mutedForeground}
            style={{ marginLeft: 4 }}
          />
        </View>

        {/* Species chips */}
        <View style={styles.speciesRow}>
          {zone.species.map((s) => (
            <View key={s} style={[styles.speciesChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Text style={[styles.speciesChipText, { color: colors.foreground }]}>{s}</Text>
            </View>
          ))}
        </View>

        {/* Tide pill */}
        <View style={styles.tidePillRow}>
          <MaterialCommunityIcons name="waves" size={12} color={colors.accent} />
          <Text style={[styles.tidePillText, { color: colors.mutedForeground }]}>{zone.tideStage}</Text>
        </View>

        {/* Expanded detail */}
        {open && (
          <View style={{ gap: 8, marginTop: 4 }}>
            <View style={[styles.expandBox, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}28` }]}>
              <MaterialCommunityIcons name="hook" size={13} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.expandLabel, { color: colors.mutedForeground }]}>LURE / BAIT</Text>
                <Text style={[styles.expandValue, { color: colors.foreground }]}>{zone.lure}</Text>
              </View>
            </View>
            <View style={[styles.expandBox, { backgroundColor: `${colors.accent}10`, borderColor: `${colors.accent}22` }]}>
              <MaterialCommunityIcons name="run-fast" size={13} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.expandLabel, { color: colors.mutedForeground }]}>TECHNIQUE</Text>
                <Text style={[styles.expandValue, { color: colors.foreground }]}>{zone.technique}</Text>
              </View>
            </View>
            <View style={[styles.histBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Text style={[styles.histBoxText, { color: colors.mutedForeground }]}>{zone.notes}</Text>
            </View>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Netting History Badge ────────────────────────────────────────────────────
function NettingBadge({ river, colors }: { river: RiverSystem; colors: ReturnType<typeof useColors> }) {
  if (!river.nettingHistory) return null;
  const n = river.nettingHistory;
  return (
    <View style={[styles.nettingCard, { backgroundColor: "#ff450012", borderColor: "#ff450033" }]}>
      <View style={styles.nettingHeader}>
        <MaterialCommunityIcons name="archive-outline" size={14} color="#ff6b35" />
        <Text style={[styles.nettingTitle, { color: "#ff6b35" }]}>80s COMMERCIAL NETTING RECORD</Text>
      </View>
      <Text style={[styles.nettingEra, { color: colors.foreground }]}>{n.era} — {n.area}</Text>
      <Text style={[styles.nettingDepth, { color: "#ff6b35" }]}>Primary depth: {n.depthRange}</Text>
      <Text style={[styles.nettingDetail, { color: colors.mutedForeground }]}>{n.detail}</Text>
      <Text style={[styles.nettingFooter, { color: colors.mutedForeground }]}>
        These historical netting depths confirm where fish concentrated and remain the most productive sportfishing zones today.
      </Text>
    </View>
  );
}

// ─── River Card ───────────────────────────────────────────────────────────────
function RiverCard({ river, colors }: { river: RiverSystem; colors: ReturnType<typeof useColors> }) {
  const [expanded, setExpanded] = useState(false);

  const openMap = () => {
    const url = `https://www.google.com/maps/@${river.lat},${river.lng},13z/data=!3m1!1e3`;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={[styles.riverCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
      {/* River header */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setExpanded((e) => !e)}
        style={styles.riverHeader}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.riverName, { color: colors.primary }]} numberOfLines={1}>
            {river.name}
          </Text>
          <View style={[styles.seasonPill, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}40`, alignSelf: "flex-start" }]}>
            <Text style={[styles.seasonPillText, { color: colors.primary }]}>{river.bestSeason}</Text>
          </View>
          <Text style={[styles.riverRegion, { color: colors.mutedForeground }]} numberOfLines={1} ellipsizeMode="tail">
            {river.region} · {river.distanceFromKarumba ?? river.distanceFromDarwin ?? ""}
          </Text>
        </View>
        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.mutedForeground}
          style={{ marginTop: 2 }}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={{ gap: 12 }}>
          {/* Character */}
          <Text style={[styles.riverCharacter, { color: colors.mutedForeground }]}>{river.character}</Text>

          {/* Meta row */}
          <View style={styles.riverMeta}>
            <MetaPill icon="road-variant" label={river.access} colors={colors} />
            <MetaPill icon="map-marker" label={`Max depth: ${river.maxDepth}m`} colors={colors} />
          </View>

          {/* Satellite map button */}
          <TouchableOpacity
            style={[styles.mapBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={openMap}
            activeOpacity={0.75}
          >
            <MaterialCommunityIcons name="satellite-variant" size={14} color={colors.primary} />
            <Text style={[styles.mapBtnText, { color: colors.primary }]}>View on Satellite Map</Text>
          </TouchableOpacity>

          {/* Depth Column + Zones */}
          <View style={{ gap: 6 }}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>DEPTH STRIKE ZONES</Text>

            {/* Visual depth ruler */}
            <View style={styles.depthRulerContainer}>
              <View style={[styles.depthRulerTrack, { borderColor: colors.border }]}>
                <View style={[styles.depthRulerWater, { backgroundColor: `${colors.accent}15` }]} />
                {river.zones.map((zone, i) => (
                  <DepthBar key={i} zone={zone} maxDepth={river.maxDepth} colors={colors} />
                ))}
                {/* Depth labels */}
                {[0, 0.25, 0.5, 0.75, 1.0].map((pct) => (
                  <View
                    key={pct}
                    style={[styles.depthRulerTick, { top: `${pct * 100}%` as any, borderTopColor: `${colors.border}88` }]}
                  >
                    <Text style={[styles.depthRulerLabel, { color: colors.mutedForeground }]}>
                      {Math.round(pct * river.maxDepth)}m
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Zone rows */}
            {river.zones.map((zone, i) => (
              <ZoneRow key={i} zone={zone} maxDepth={river.maxDepth} colors={colors} />
            ))}
          </View>

          {/* Historical note */}
          <View style={[styles.histNote, { backgroundColor: `${colors.accent}10`, borderColor: `${colors.accent}28` }]}>
            <View style={styles.histNoteHeader}>
              <MaterialCommunityIcons name="book-open-variant" size={14} color={colors.accent} />
              <Text style={[styles.histNoteTitle, { color: colors.accent }]}>HISTORICAL RECORD</Text>
            </View>
            <Text style={[styles.histNoteText, { color: colors.mutedForeground }]}>{river.historicalNote}</Text>
          </View>

          {/* 80s netting badge */}
          <NettingBadge river={river} colors={colors} />

          {/* Pro Tip */}
          <View style={[styles.proTipBox, { backgroundColor: `#ffd70015`, borderColor: `#ffd70033` }]}>
            <Text style={styles.proTipEmoji}>💡</Text>
            <Text style={[styles.proTipText, { color: colors.foreground }]}>{river.proTip}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function MetaPill({ icon, label, colors }: { icon: string; label: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.metaPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <MaterialCommunityIcons name={icon as any} size={11} color={colors.accent} />
      <Text style={[styles.metaPillText, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

// ─── River Selector Chips ─────────────────────────────────────────────────────
function RiverChips({
  rivers,
  selected,
  onSelect,
  colors,
}: {
  rivers: RiverSystem[];
  selected: string;
  onSelect: (id: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipScrollContent}>
      {rivers.map((r) => (
        <TouchableOpacity
          key={r.id}
          style={[
            styles.chip,
            { backgroundColor: colors.card, borderColor: colors.border },
            selected === r.id && { backgroundColor: colors.primary, borderColor: colors.primary },
          ]}
          onPress={() => onSelect(r.id)}
          activeOpacity={0.75}
        >
          <Text
            style={[
              styles.chipText,
              { color: selected === r.id ? colors.primaryForeground : colors.foreground },
            ]}
          >
            {r.shortName}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ZonesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 0 : insets.top;
  useAutoNarrate(() => "Depth Strike Zones. Find the optimal fishing depth for barramundi, threadfin, mangrove jack and more based on current NQ Gulf conditions.");

  const [selectedId, setSelectedId] = useState<string>("all");

  const visibleRivers =
    selectedId === "all"
      ? RIVER_SYSTEMS
      : RIVER_SYSTEMS.filter((r) => r.id === selectedId);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad + 16, paddingBottom: Platform.OS === "web" ? 70 : insets.bottom + 24 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <HVHeader subtitle="Depth Strike Zones" />

      {/* Legend */}
      <View style={styles.legendRow}>
        {Object.entries(HOTNESS).map(([key, val]) => (
          <View key={key} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: val.bar }]} />
            <Text style={[styles.legendText, { color: colors.mutedForeground }]}>{val.label}</Text>
          </View>
        ))}
      </View>

      {/* River selector */}
      <RiverChips
        rivers={RIVER_SYSTEMS}
        selected={selectedId}
        onSelect={(id) => setSelectedId(selectedId === id ? "all" : id)}
        colors={colors}
      />

      {/* River cards */}
      <View style={{ gap: 12 }}>
        {visibleRivers.map((river) => (
          <RiverCard key={river.id} river={river} colors={colors} />
        ))}
      </View>

      {/* Source note */}
      <View style={[styles.sourceNote, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <MaterialCommunityIcons name="information-outline" size={13} color={colors.mutedForeground} />
        <Text style={[styles.sourceNoteText, { color: colors.mutedForeground }]}>
          Depth zones compiled from QLD Fisheries technical reports (1982–2000), Fish NQ magazine archives (1985–2005), QLD Angling Club records, CSIRO fish surveys, and published North Queensland fishing guides. Commercial netting data from QLD Fisheries licensing records and annual reports.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 14, gap: 8 },

  header: { alignItems: "center", gap: 2 },
  title: { fontSize: 22, fontFamily: "Oswald_700Bold", letterSpacing: 0.5 },
  subtitle: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },

  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, fontFamily: "Inter_500Medium" },

  chipScroll: { flexGrow: 0 },
  chipScrollContent: { gap: 6, paddingHorizontal: 2 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  riverCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 8,
  },
  riverHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  riverName: { fontSize: 16, fontFamily: "Oswald_700Bold", letterSpacing: 0.3 },
  riverRegion: { fontSize: 10, fontFamily: "Inter_400Regular" },
  riverHeaderRight: { alignItems: "flex-end", gap: 6 },
  seasonPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  seasonPillText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  riverCharacter: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17, flexShrink: 1 },

  riverMeta: { gap: 6 },
  metaPill: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  metaPillText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },

  mapBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  mapBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  sectionLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },

  depthRulerContainer: { height: 80, marginBottom: 4 },
  depthRulerTrack: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  depthRulerWater: { ...StyleSheet.absoluteFillObject },
  depthRulerFill: { position: "absolute", left: 0, right: 0, opacity: 0.7 },
  depthBarFill: { position: "absolute", left: 0, right: 0 },
  depthRulerTick: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingLeft: 6,
  },
  depthRulerLabel: { fontSize: 9, fontFamily: "Inter_500Medium", marginTop: 1 },

  zoneRow: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    padding: 12,
    gap: 10,
  },
  zoneRulerBar: {
    width: 5,
    borderRadius: 3,
    overflow: "hidden",
    flexDirection: "column",
  },
  zoneRulerFill: { borderRadius: 3 },
  zoneHeaderRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  zoneDepthLabel: { fontSize: 12, fontFamily: "Inter_700Bold" },
  zoneName: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginTop: 1 },
  hotnessBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  hotnessText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  speciesRow: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  speciesChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  speciesChipText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  tidePillRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  tidePillText: { fontSize: 11, fontFamily: "Inter_400Regular" },

  expandBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  expandLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.8 },
  expandValue: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 17 },
  histBox: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderLeftColor: "#888",
  },
  histBoxText: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17, fontStyle: "italic" },

  histNote: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  histNoteHeader: { flexDirection: "row", alignItems: "center", gap: 7 },
  histNoteTitle: { fontSize: 10, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.8 },
  histNoteText: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },

  nettingCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  nettingHeader: { flexDirection: "row", alignItems: "center", gap: 7 },
  nettingTitle: { fontSize: 10, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.8 },
  nettingEra: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  nettingDepth: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  nettingDetail: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  nettingFooter: { fontSize: 11, fontFamily: "Inter_400Regular", fontStyle: "italic", lineHeight: 16, marginTop: 2 },

  proTipBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  proTipEmoji: { fontSize: 18, marginTop: 1 },
  proTipText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },

  sourceNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  sourceNoteText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
});
