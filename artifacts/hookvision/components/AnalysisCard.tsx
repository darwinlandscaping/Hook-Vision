import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import { useColors } from "@/hooks/useColors";

interface FishAnalysis {
  fishCount: number;
  depth: string;
  distance: string;
  species: string;
  confidence: number;
  suggestion: string;
  lure?: string;
  technique?: string;
  rig?: string;
  waterTemp?: string;
  bottomType?: string;
  sonarModel?: string | null;
}

interface AnalysisCardProps {
  analysis: FishAnalysis;
  autoSpeak?: boolean;
}

function buildSpeechText(a: FishAnalysis): string {
  const parts: string[] = [];
  const speciesClean = a.species.replace(/\s*\(\d+%\)/, "");
  parts.push(`${a.fishCount} ${a.fishCount === 1 ? "fish" : "fish"} detected on the sonar.`);
  parts.push(`Most likely ${speciesClean}, at ${a.depth}, ${a.distance}.`);
  if (a.lure) parts.push(`Use ${a.lure}.`);
  if (a.technique) parts.push(a.technique);
  if (a.rig) parts.push(`Rig: ${a.rig}.`);
  if (a.suggestion) parts.push(a.suggestion);
  return parts.join(" ");
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

interface TacticBoxProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
  delay: number;
}

function TacticBox({ icon, label, value, colors, delay }: TacticBoxProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, delay, useNativeDriver: true }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 350,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY, delay]);

  return (
    <Animated.View
      style={[
        styles.tacticBox,
        { backgroundColor: colors.secondary, opacity, transform: [{ translateY }] },
      ]}
    >
      <View style={styles.tacticHeader}>
        {icon}
        <Text style={[styles.tacticLabel, { color: colors.mutedForeground }]}>{label}</Text>
      </View>
      <Text style={[styles.tacticValue, { color: colors.foreground }]}>{value}</Text>
    </Animated.View>
  );
}

export function AnalysisCard({ analysis, autoSpeak = true }: AnalysisCardProps) {
  const colors = useColors();
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.95)).current;
  const [speaking, setSpeaking] = useState(false);

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

    if (autoSpeak) {
      const timer = setTimeout(() => {
        Speech.stop();
        setSpeaking(true);
        Speech.speak(buildSpeechText(analysis), {
          language: "en-AU",
          rate: 0.92,
          pitch: 1.0,
          onDone: () => setSpeaking(false),
          onError: () => setSpeaking(false),
          onStopped: () => setSpeaking(false),
        });
      }, 600);
      return () => {
        clearTimeout(timer);
        Speech.stop();
      };
    }
  }, []);

  const toggleSpeech = () => {
    if (speaking) {
      Speech.stop();
      setSpeaking(false);
    } else {
      setSpeaking(true);
      Speech.speak(buildSpeechText(analysis), {
        language: "en-AU",
        rate: 0.92,
        pitch: 1.0,
        onDone: () => setSpeaking(false),
        onError: () => setSpeaking(false),
        onStopped: () => setSpeaking(false),
      });
    }
  };

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
      {/* Header — fish count + confidence + voice */}
      <View style={styles.cardHeader}>
        <View style={styles.fishCountSection}>
          <Text style={[styles.fishCountNumber, { color: colors.primary }]}>
            {analysis.fishCount}
          </Text>
          <Text style={[styles.fishCountLabel, { color: colors.mutedForeground }]}>
            fish detected
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.confidenceBadge, { backgroundColor: `${confidenceColor}22`, borderColor: `${confidenceColor}66` }]}>
            <Text style={[styles.confidenceText, { color: confidenceColor }]}>
              {analysis.confidence}%
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.voiceBtn,
              {
                backgroundColor: speaking ? `${colors.primary}22` : colors.secondary,
                borderColor: speaking ? colors.primary : colors.border,
              },
            ]}
            onPress={toggleSpeech}
            activeOpacity={0.8}
          >
            <Feather
              name={speaking ? "volume-x" : "volume-2"}
              size={16}
              color={speaking ? colors.primary : colors.mutedForeground}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Where & what */}
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
        label="Position"
        value={analysis.distance}
        delay={300}
      />
      {analysis.waterTemp && (
        <StatRow
          icon={<Feather name="thermometer" size={16} color={colors.sonar} />}
          label="Water Temp"
          value={analysis.waterTemp}
          delay={380}
        />
      )}
      {analysis.bottomType && (
        <StatRow
          icon={<MaterialCommunityIcons name="layers" size={16} color={colors.mutedForeground} />}
          label="Bottom"
          value={analysis.bottomType}
          delay={440}
        />
      )}
      {analysis.sonarModel && (
        <StatRow
          icon={<MaterialCommunityIcons name="radar" size={16} color={colors.accent} />}
          label="Sonar Unit"
          value={analysis.sonarModel}
          delay={500}
        />
      )}

      {/* How to catch it */}
      {(analysis.lure || analysis.technique || analysis.rig) && (
        <>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="fish" size={13} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>HOW TO CATCH IT</Text>
          </View>
          {analysis.lure && (
            <TacticBox
              icon={<MaterialCommunityIcons name="hook" size={13} color={colors.accent} />}
              label="LURE / BAIT"
              value={analysis.lure}
              colors={colors}
              delay={200}
            />
          )}
          {analysis.technique && (
            <TacticBox
              icon={<Feather name="activity" size={13} color={colors.primary} />}
              label="TECHNIQUE"
              value={analysis.technique}
              colors={colors}
              delay={300}
            />
          )}
          {analysis.rig && (
            <TacticBox
              icon={<Feather name="link" size={13} color={colors.depth} />}
              label="RIG"
              value={analysis.rig}
              colors={colors}
              delay={400}
            />
          )}
        </>
      )}

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Overall plan */}
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
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  voiceBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
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
    marginVertical: 2,
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
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: -4,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  tacticBox: {
    borderRadius: 10,
    padding: 12,
    gap: 5,
  },
  tacticHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  tacticLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  tacticValue: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
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
