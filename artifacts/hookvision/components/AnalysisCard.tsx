import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface FishAnalysis {
  fishCount: number;
  depth: string;
  distance: string;
  species: string;
  confidence: number;
  suggestion: string;
  waterTemp?: string;
  bottomType?: string;
  lowranceModel?: string | null;
}

interface AnalysisCardProps {
  analysis: FishAnalysis;
}

interface StatRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  delay: number;
}

function StatRow({ icon, label, value, delay }: StatRowProps) {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: 400,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateX, delay]);

  return (
    <Animated.View
      style={[styles.statRow, { opacity, transform: [{ translateX }] }]}
    >
      <View style={[styles.statIcon, { backgroundColor: colors.secondary }]}>
        {icon}
      </View>
      <View style={styles.statContent}>
        <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      </View>
    </Animated.View>
  );
}

export function AnalysisCard({ analysis }: AnalysisCardProps) {
  const colors = useColors();
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(cardScale, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [cardOpacity, cardScale]);

  const confidenceColor =
    analysis.confidence >= 80
      ? colors.primary
      : analysis.confidence >= 60
      ? colors.warning
      : colors.destructive;

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: cardOpacity,
          transform: [{ scale: cardScale }],
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.fishCountSection}>
          <Text style={[styles.fishCountNumber, { color: colors.primary }]}>
            {analysis.fishCount}
          </Text>
          <Text style={[styles.fishCountLabel, { color: colors.mutedForeground }]}>
            {analysis.fishCount === 1 ? "fish detected" : "fish detected"}
          </Text>
        </View>
        <View style={[styles.confidenceBadge, { backgroundColor: `${confidenceColor}22`, borderColor: `${confidenceColor}66` }]}>
          <Text style={[styles.confidenceText, { color: confidenceColor }]}>
            {analysis.confidence}% confident
          </Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <StatRow
        icon={<MaterialCommunityIcons name="fish" size={16} color={colors.primary} />}
        label="Species"
        value={analysis.species}
        delay={100}
      />
      <StatRow
        icon={<Feather name="arrow-down" size={16} color={colors.accent} />}
        label="Depth"
        value={analysis.depth}
        delay={200}
      />
      <StatRow
        icon={<Feather name="navigation" size={16} color={colors.depth} />}
        label="Distance"
        value={analysis.distance}
        delay={300}
      />
      {analysis.waterTemp && (
        <StatRow
          icon={<Feather name="thermometer" size={16} color={colors.sonar} />}
          label="Water Temp"
          value={analysis.waterTemp}
          delay={400}
        />
      )}
      {analysis.bottomType && (
        <StatRow
          icon={<MaterialCommunityIcons name="layers" size={16} color={colors.mutedForeground} />}
          label="Bottom"
          value={analysis.bottomType}
          delay={500}
        />
      )}
      {analysis.lowranceModel && (
        <StatRow
          icon={<MaterialCommunityIcons name="radar" size={16} color={colors.accent} />}
          label="Sonar Unit"
          value={`Lowrance ${analysis.lowranceModel}`}
          delay={600}
        />
      )}

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={[styles.suggestionBox, { backgroundColor: colors.secondary }]}>
        <Feather name="target" size={14} color={colors.primary} style={styles.suggestionIcon} />
        <Text style={[styles.suggestionText, { color: colors.foreground }]}>
          {analysis.suggestion}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  fishCountSection: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  fishCountNumber: {
    fontSize: 48,
    fontFamily: "Inter_700Bold",
    lineHeight: 52,
  },
  fishCountLabel: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  confidenceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  confidenceText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  statContent: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  statValue: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginTop: 1,
  },
  suggestionBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 10,
    gap: 8,
  },
  suggestionIcon: {
    marginTop: 2,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
});
