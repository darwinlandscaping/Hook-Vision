import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useVoice } from "@/hooks/useVoice";
import { useFishImage } from "@/hooks/useFishImage";
import { fetchLureImage, getLureCategory } from "@/data/lureImages";

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

const SPECIES_SLANG: Record<string, string> = {
  barramundi: "barra",
  "mangrove jack": "jack",
  "spanish mackerel": "spaniard",
  "giant trevally": "GT",
  "coral trout": "coral",
  queenfish: "queenie",
  "threadfin salmon": "threadie",
  "king threadfin": "threadie",
  "black jewfish": "jewie",
  jewfish: "jewie",
  "red emperor": "emperor",
};

function speciesNickname(raw: string): string {
  const clean = raw.replace(/\s*\(\d+%\)/, "").toLowerCase();
  for (const [key, nick] of Object.entries(SPECIES_SLANG)) {
    if (clean.includes(key)) return nick;
  }
  return raw.replace(/\s*\(\d+%\)/, "");
}

function buildSpeechText(a: FishAnalysis): string {
  const parts: string[] = [];
  const nick = speciesNickname(a.species);
  const count = a.fishCount;

  // Fish count opener
  if (count === 0) {
    parts.push("Oi mate, sonar's drawing a blank — nothing showing down there right now.");
  } else if (count === 1) {
    parts.push(`Got a lone unit on the sonar, mate.`);
  } else if (count <= 3) {
    parts.push(`Ripper — got ${count} fish showing on the sonar!`);
  } else {
    parts.push(`Bloody hell, ${count} fish on the sonar — they're stacked up down there!`);
  }

  // Species + position
  parts.push(`Reckon they're ${nick} — sitting about ${a.depth}, ${a.distance}.`);

  // Confidence qualifier
  if (a.confidence < 60) {
    parts.push("Hard to be certain but that's my best read of it.");
  } else if (a.confidence >= 90) {
    parts.push("Deadset confident on that call.");
  }

  // Lure
  if (a.lure) {
    parts.push(`Chuck on ${a.lure}.`);
  }

  // Technique — keep as-is since it's already tactical
  if (a.technique) {
    parts.push(a.technique);
  }

  // Rig
  if (a.rig) {
    parts.push(`Rig up with ${a.rig}.`);
  }

  // Outro
  parts.push("Get in there and smash 'em, ya bloody legend!");

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
  const { speak, stop, speaking } = useVoice();
  const fishImageUrl = useFishImage(analysis.species);
  const [lureImageUrl, setLureImageUrl] = useState<string | null>(null);
  const lureCategory = analysis.lure ? getLureCategory(analysis.lure) : null;

  useEffect(() => {
    if (analysis.lure) {
      fetchLureImage(analysis.lure).then(setLureImageUrl);
    }
  }, [analysis.lure]);

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
        speak(buildSpeechText(analysis));
      }, 600);
      return () => {
        clearTimeout(timer);
        stop();
      };
    }
  }, []);

  const toggleSpeech = () => {
    if (speaking) {
      stop();
    } else {
      speak(buildSpeechText(analysis));
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

      {/* Fish photo */}
      {fishImageUrl && (
        <View style={[styles.fishImageContainer, { borderColor: colors.border }]}>
          <Image
            source={{ uri: fishImageUrl }}
            style={styles.fishImage}
            resizeMode="cover"
          />
          <View style={[styles.fishImageLabel, { backgroundColor: `${colors.background}cc` }]}>
            <Text style={[styles.fishImageLabelText, { color: colors.primary }]}>
              {analysis.species.replace(/\s*\(\d+%\)/, "")}
            </Text>
          </View>
        </View>
      )}

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
            <>
              {lureImageUrl && (
                <View style={[styles.lureImageRow]}>
                  <Image
                    source={{ uri: lureImageUrl }}
                    style={[styles.lureImage, { borderColor: colors.border }]}
                    resizeMode="cover"
                  />
                  {lureCategory && (
                    <View style={styles.lureLabelCol}>
                      <Text style={[styles.lureCategoryLabel, { color: colors.mutedForeground }]}>
                        TYPE
                      </Text>
                      <Text style={[styles.lureCategoryValue, { color: colors.accent }]}>
                        {lureCategory.label}
                      </Text>
                    </View>
                  )}
                </View>
              )}
              <TacticBox
                icon={<MaterialCommunityIcons name="hook" size={13} color={colors.accent} />}
                label="LURE / BAIT"
                value={analysis.lure}
                colors={colors}
                delay={200}
              />
            </>
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
  fishImageContainer: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    height: 160,
    position: "relative",
  },
  fishImage: {
    width: "100%",
    height: "100%",
  },
  fishImageLabel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  fishImageLabelText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  lureImageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  lureImage: {
    width: 90,
    height: 70,
    borderRadius: 8,
    borderWidth: 1,
  },
  lureLabelCol: {
    flex: 1,
    gap: 3,
  },
  lureCategoryLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  lureCategoryValue: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
});
