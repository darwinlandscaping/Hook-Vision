import React, { useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { HVHeader } from "@/components/HVHeader";
import { useColors } from "@/hooks/useColors";
import { useFishImage } from "@/hooks/useFishImage";
import { useAutoNarrate } from "@/hooks/useAutoNarrate";
import { WA_SPECIES, CATEGORIES, type WASpecies, type FishCategory } from "@/data/ntSpecies";

function EatingStars({ rating, colors }: { rating: number; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Feather
          key={i}
          name="star"
          size={10}
          color={i <= rating ? colors.warning : colors.border}
        />
      ))}
    </View>
  );
}

function SpeciesCard({ species, colors }: { species: WASpecies; colors: ReturnType<typeof useColors> }) {
  const [expanded, setExpanded] = useState(false);
  const fishImageUrl = useFishImage(species.name);

  const categoryColor: Record<FishCategory, string> = {
    estuary: colors.primary,
    reef: colors.accent,
    pelagic: "#7c5cfc",
    freshwater: "#00b894",
    shellfish: colors.depth,
  };

  const categoryBg: Record<FishCategory, string> = {
    estuary: `${colors.primary}22`,
    reef: `${colors.accent}22`,
    pelagic: "#7c5cfc22",
    freshwater: "#00b89422",
    shellfish: `${colors.depth}22`,
  };

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.85}
    >
      {/* Always-visible fish photo banner */}
      <View style={[styles.photoBanner, { backgroundColor: colors.secondary }]}>
        {fishImageUrl ? (
          <Image
            source={{ uri: fishImageUrl }}
            style={styles.bannerImg}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.bannerPlaceholder, { backgroundColor: colors.secondary }]}>
            <MaterialCommunityIcons name="fish" size={36} color={colors.border} />
          </View>
        )}
        {/* Category chip overlaid on photo */}
        <View style={[styles.photoCategoryChip, { backgroundColor: categoryBg[species.category], borderColor: categoryColor[species.category] + "55" }]}>
          <Text style={[styles.categoryText, { color: categoryColor[species.category] }]}>
            {species.category.charAt(0).toUpperCase() + species.category.slice(1)}
          </Text>
        </View>
        {/* Season indicator dot */}
        <View style={[styles.seasonDot, { backgroundColor: species.seasonOpen ? colors.primary : colors.destructive }]} />
      </View>

      <View style={styles.cardHeader}>
        <View style={styles.cardTitleBlock}>
          <View style={styles.nameRow}>
            <Text style={[styles.commonName, { color: colors.foreground }]}>{species.name}</Text>
            {species.catchAndRelease && (
              <View style={[styles.crTag, { backgroundColor: `${colors.primary}22` }]}>
                <Text style={[styles.crText, { color: colors.primary }]}>C&R</Text>
              </View>
            )}
          </View>
          <Text style={[styles.sciName, { color: colors.mutedForeground }]}>
            {species.scientificName}
          </Text>
          {species.otherNames.length > 0 && (
            <Text style={[styles.otherNames, { color: colors.mutedForeground }]}>
              also: {species.otherNames.join(", ")}
            </Text>
          )}
        </View>
        <Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>BAG LIMIT</Text>
          <Text style={[styles.statVal, { color: colors.foreground }]}>
            {species.bagLimit === null ? "None" : species.bagLimit}
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>MIN SIZE</Text>
          <Text style={[styles.statVal, { color: colors.foreground }]}>
            {species.minSizeCm === null ? "—" : `${species.minSizeCm}cm`}
          </Text>
        </View>
        {species.maxSizeCm && (
          <>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>MAX SIZE</Text>
              <Text style={[styles.statVal, { color: colors.warning }]}>
                {`${species.maxSizeCm}cm`}
              </Text>
            </View>
          </>
        )}
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>EATING</Text>
          <EatingStars rating={species.eatingRating} colors={colors} />
        </View>
      </View>

      {expanded && (
        <View style={styles.expandedContent}>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={[styles.seasonBadge, { backgroundColor: species.seasonOpen ? `${colors.primary}18` : `${colors.destructive}18` }]}>
            <Feather
              name="calendar"
              size={12}
              color={species.seasonOpen ? colors.primary : colors.destructive}
            />
            <Text style={[styles.seasonText, { color: species.seasonOpen ? colors.primary : colors.destructive }]}>
              {species.season}
            </Text>
          </View>

          <Text style={[styles.description, { color: colors.foreground }]}>
            {species.description}
          </Text>

          <View style={styles.bestMonthsRow}>
            <Text style={[styles.bestMonthsLabel, { color: colors.mutedForeground }]}>Best months: </Text>
            <Text style={[styles.bestMonthsValue, { color: colors.primary }]}>
              {species.bestMonths
                .map((m) =>
                  new Date(2000, m - 1, 1).toLocaleDateString("en-AU", { month: "short" })
                )
                .join(" · ")}
            </Text>
          </View>

          {species.catchAndRelease && (
            <View style={[styles.crNote, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}33` }]}>
              <MaterialCommunityIcons name="fish" size={14} color={colors.primary} />
              <Text style={[styles.crNoteText, { color: colors.primary }]}>
                Catch-and-release strongly recommended for this species.
              </Text>
            </View>
          )}

          {species.slotLimit && (
            <View style={[styles.crNote, { backgroundColor: `${colors.warning}12`, borderColor: `${colors.warning}33` }]}>
              <Feather name="alert-triangle" size={14} color={colors.warning} />
              <Text style={[styles.crNoteText, { color: colors.warning }]}>
                Slot limit: fish over {species.maxSizeCm}cm must be released (breeding females).
              </Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function SpeciesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<FishCategory | "all">("all");
  useAutoNarrate(() => "WA Species Guide. Browse bag limits, minimum sizes, and fishing seasons for species found in Kimberley and WA waters.");

  const topPad = Platform.OS === "web" ? 0 : insets.top;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return WA_SPECIES.filter((s) => {
      const matchCategory = selectedCategory === "all" || s.category === selectedCategory;
      const matchSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.otherNames.some((n) => n.toLowerCase().includes(q)) ||
        s.scientificName.toLowerCase().includes(q) ||
        s.category.includes(q);
      return matchCategory && matchSearch;
    });
  }, [search, selectedCategory]);

  return (
    <FlatList<WASpecies>
      data={filtered}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <SpeciesCard species={item} colors={colors} />}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.listContent,
        {
          paddingTop: topPad + 16,
          paddingBottom: Platform.OS === "web" ? 70 : insets.bottom + 24,
        },
      ]}
      showsVerticalScrollIndicator={false}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      scrollEnabled={filtered.length > 0}
      ListHeaderComponent={
        <View style={styles.headerBlock}>
          <HVHeader subtitle="WA Species Guide" />
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.primary }]}>🐟 WA Species</Text>
            <Text style={[styles.count, { color: colors.mutedForeground }]}>
              {filtered.length} of {WA_SPECIES.length}
            </Text>
          </View>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Bag limits, size rules & season info
          </Text>

          <View style={[styles.searchBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              placeholder="Search species..."
              placeholderTextColor={colors.mutedForeground}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
              autoCorrect={false}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.categoryRow}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.key}
                style={[
                  styles.catChip,
                  {
                    backgroundColor:
                      selectedCategory === cat.key ? colors.primary : colors.secondary,
                    borderColor:
                      selectedCategory === cat.key ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setSelectedCategory(cat.key as FishCategory | "all")}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.catChipText,
                    {
                      color:
                        selectedCategory === cat.key
                          ? colors.primaryForeground
                          : colors.mutedForeground,
                    },
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.disclaimer, { backgroundColor: colors.secondary }]}>
            <Feather name="info" size={12} color={colors.mutedForeground} />
            <Text style={[styles.disclaimerText, { color: colors.mutedForeground }]}>
              Always verify current rules at nt.gov.au/marine before fishing. Rules change.
            </Text>
          </View>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Feather name="search" size={36} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No species found</Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
            Try a different search or category.
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: 16 },
  headerBlock: { gap: 12, marginBottom: 12 },
  titleRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  title: { fontSize: 24, fontFamily: "Oswald_700Bold", letterSpacing: 0.5 },
  count: { fontSize: 13, fontFamily: "Inter_400Regular" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: -6 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  categoryRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  catChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  disclaimer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: 8,
  },
  disclaimerText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 15 },
  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden", gap: 0 },
  photoBanner: { width: "100%", height: 160, position: "relative" },
  bannerImg: { width: "100%", height: "100%" },
  bannerPlaceholder: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  photoCategoryChip: {
    position: "absolute",
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  seasonDot: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10, padding: 12, paddingBottom: 0 },
  cardTitleBlock: { flex: 1, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  commonName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  crTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  crText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  sciName: { fontSize: 12, fontFamily: "Inter_400Regular", fontStyle: "italic" },
  otherNames: { fontSize: 11, fontFamily: "Inter_400Regular" },
  categoryChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  categoryText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "transparent",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  statItem: { flex: 1, alignItems: "center", gap: 3 },
  statLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  statVal: { fontSize: 14, fontFamily: "Inter_700Bold" },
  statDivider: { width: 1, height: 28 },
  stars: { flexDirection: "row", gap: 1 },
  expandedContent: { gap: 10, paddingHorizontal: 12, paddingBottom: 12 },
  divider: { height: 1 },
  seasonBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 8,
    borderRadius: 8,
  },
  seasonText: { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },
  description: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  bestMonthsRow: { flexDirection: "row", alignItems: "center" },
  bestMonthsLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  bestMonthsValue: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  crNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  crNoteText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  emptyState: { alignItems: "center", gap: 10, paddingVertical: 40 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyDesc: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
});
