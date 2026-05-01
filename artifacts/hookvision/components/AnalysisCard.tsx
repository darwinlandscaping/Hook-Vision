import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useVoice } from "@/hooks/useVoice";
import { useFishImage, getSpeciesLabel } from "@/hooks/useFishImage";
import { useLureLibrary } from "@/hooks/useLureLibrary";
import { getDarwinStoreLinks } from "@/lib/lureLibrary";
import { ArchZoomPanel } from "@/components/ArchZoomPanel";

interface FishAnalysis {
  fishCount: number;
  depth: string;
  distance?: string;
  species: string;
  confidence: number;
  suggestion: string;
  lure?: string;
  lureType?: string;
  technique?: string;
  rig?: string;
  waterTemp?: string;
  bottomType?: string;
  sonarModel?: string | null;
  sonarMode?: string | null;
  bladderShape?: string | null;
  fishMovement?: string | null;
  crocAlert?: boolean;
  crocWarning?: string | null;
  archReasoning?: string;
}

interface AnalysisCardProps {
  analysis: FishAnalysis;
  imageUri?: string;
  autoSpeak?: boolean;
  cvRegions?: Array<{ xFrac: number; yFrac: number; size: number }>;
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

function speciesNickname(raw: string | undefined): string {
  if (!raw) return "unknown";
  const clean = raw.replace(/\s*\(\d+%\)/, "").toLowerCase();
  for (const [key, nick] of Object.entries(SPECIES_SLANG)) {
    if (clean.includes(key)) return nick;
  }
  return raw.replace(/\s*\(\d+%\)/, "");
}

function buildSpeechText(a: FishAnalysis): string {
  const parts: string[] = [];
  const nick = speciesNickname(a.species ?? "Unknown species");
  const count = a.fishCount;

  // Croc alert — safety warning only, repeated 3 times, no fishing advice
  if (a.crocAlert) {
    const warning = "CROCODILE ALERT! There is a saltwater crocodile on the sonar! Do NOT enter the water, do NOT lean over the side. Move away from this area immediately!";
    parts.push(warning, warning, warning);
    return parts.join(" ");
  }

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
  parts.push(`Reckon they're ${nick} — sitting about ${a.depth}${a.distance ? `, ${a.distance}` : ""}.`);

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

  // Arch reasoning — how the AI made the call (spoken after the main result)
  if (a.archReasoning) {
    parts.push(`Here's how I read it. ${a.archReasoning}`);
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

export function AnalysisCard({ analysis, imageUri, autoSpeak = true, cvRegions }: AnalysisCardProps) {
  const colors = useColors();
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.95)).current;
  const crocPulse = useRef(new Animated.Value(1)).current;
  const { speak, stop, speaking } = useVoice();
  const fishImageUrl = useFishImage(analysis.crocAlert ? "saltwater crocodile" : analysis.species);
  const lureEntry = useLureLibrary(
    analysis.crocAlert ? undefined : analysis.lure,
    analysis.crocAlert ? undefined : analysis.lureType
  );

  useEffect(() => {
    if (analysis.crocAlert) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(crocPulse, { toValue: 0.55, duration: 500, useNativeDriver: true }),
          Animated.timing(crocPulse, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [analysis.crocAlert, crocPulse]);

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
      {/* ⚠️ CROCODILE ALERT — shown above everything else */}
      {analysis.crocAlert && (
        <Animated.View style={[styles.crocAlertBanner, { opacity: crocPulse }]}>
          <Text style={styles.crocAlertTitle}>🐊  CROCODILE DETECTED</Text>
          <Text style={styles.crocAlertSub}>DO NOT ENTER THE WATER</Text>
        </Animated.View>
      )}
      {analysis.crocAlert && analysis.crocWarning && (
        <View style={styles.crocWarningBox}>
          <Text style={styles.crocWarningLabel}>⚠️  SONAR READING</Text>
          <Text style={styles.crocWarningText}>{analysis.crocWarning}</Text>
          <Text style={styles.crocSafetyText}>
            🚨 WA/Kimberley Croc Safety: Stay 5m from the water's edge. Never clean fish or wash hands at the water. Saltwater crocs can be submerged and undetected. Relocate immediately.
          </Text>
        </View>
      )}

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

      {/* Fish photo — always shown, skeleton while loading */}
      <View style={[styles.fishImageContainer, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
        {fishImageUrl ? (
          <Image
            source={{ uri: fishImageUrl }}
            style={styles.fishImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.fishImageSkeleton}>
            <MaterialCommunityIcons name="fish" size={48} color={colors.border} />
            <Text style={[styles.fishSkeletonText, { color: colors.mutedForeground }]}>Loading photo…</Text>
          </View>
        )}
        <View style={[styles.fishImageLabel, { backgroundColor: `${colors.background}dd` }]}>
          <Text style={[styles.fishImageLabelText, { color: analysis.crocAlert ? "#ff4444" : colors.primary }]}>
            {analysis.crocAlert
              ? "⚠ SALTWATER CROCODILE"
              : (getSpeciesLabel(analysis.species) ?? analysis.species?.replace(/\s*\(\d+%\)/, "") ?? "Unknown species")}
          </Text>
          <Text style={[styles.fishImageConfidence, { color: colors.mutedForeground }]}>
            {analysis.crocAlert ? "DO NOT ENTER WATER" : `${analysis.confidence}% confidence`}
          </Text>
        </View>
      </View>

      {/* ── Arch zoom panel — shown only when we have the source image ── */}
      {imageUri && !analysis.crocAlert && (
        <ArchZoomPanel
          imageUri={imageUri}
          depth={analysis.depth}
          distance={analysis.distance}
          species={analysis.species}
          confidence={analysis.confidence}
          bottomType={analysis.bottomType}
          archReasoning={analysis.archReasoning}
          cvRegions={cvRegions}
        />
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
      {analysis.distance && (
        <StatRow
          icon={<Feather name="navigation" size={16} color={colors.depth} />}
          label="Position"
          value={analysis.distance}
          delay={300}
        />
      )}
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
      {(analysis.sonarModel || analysis.sonarMode) && (
        <StatRow
          icon={<MaterialCommunityIcons name="radar" size={16} color={colors.accent} />}
          label="Sonar Unit"
          value={[
            analysis.sonarModel,
            analysis.sonarMode && analysis.sonarMode !== "traditional-2d"
              ? `📡 LIVE SCAN`
              : analysis.sonarMode === "traditional-2d"
              ? "2D History"
              : null,
          ].filter(Boolean).join("  ·  ")}
          delay={500}
        />
      )}

      {/* ── Arch / Body shape + movement — labels adapt for live sonar ── */}
      {!analysis.crocAlert && (analysis.bladderShape || analysis.fishMovement) && (
        <>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="waveform" size={13} color="#00a8ff" />
            <Text style={[styles.sectionTitle, { color: "#00a8ff" }]}>
              {analysis.sonarMode && analysis.sonarMode !== "traditional-2d"
                ? "LIVE SONAR READING"
                : "SONAR SIGNAL"}
            </Text>
          </View>
          {analysis.bladderShape && (
            <TacticBox
              icon={<MaterialCommunityIcons name="sine-wave" size={13} color="#00a8ff" />}
              label={
                analysis.sonarMode && analysis.sonarMode !== "traditional-2d"
                  ? "BODY SHAPE & SHADOW"
                  : "ARCH / BLADDER SHAPE"
              }
              value={analysis.bladderShape}
              colors={colors}
              delay={150}
            />
          )}
          {analysis.fishMovement && (
            <TacticBox
              icon={<MaterialCommunityIcons name="trending-up" size={13} color="#ffd700" />}
              label={
                analysis.sonarMode && analysis.sonarMode !== "traditional-2d"
                  ? "FISH POSTURE & MOVEMENT"
                  : "BLADDER MOVEMENT"
              }
              value={analysis.fishMovement}
              colors={colors}
              delay={250}
            />
          )}
        </>
      )}

      {/* How to catch it — suppressed when croc alert is active */}
      {!analysis.crocAlert && (analysis.lure || analysis.technique || analysis.rig) && (
        <>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="fish" size={13} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>HOW TO CATCH IT</Text>
          </View>
          {analysis.lure && (
            <>
              <TacticBox
                icon={<MaterialCommunityIcons name="hook" size={13} color={colors.accent} />}
                label="LURE / BAIT"
                value={analysis.lure}
                colors={colors}
                delay={200}
              />
              {/* Lure library card — image always matches the recommendation */}
              {lureEntry ? (() => {
                const storeLinks = getDarwinStoreLinks(lureEntry.name);
                return (
                  <View>
                    {/* Lure image + name */}
                    <View style={[styles.craigsCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                      <View style={[styles.craigsImageWrap, { backgroundColor: colors.card }]}>
                        <Image
                          source={{ uri: lureEntry.imageUrl }}
                          style={styles.craigsImage}
                          resizeMode="cover"
                        />
                      </View>
                      <View style={styles.craigsInfo}>
                        <Text style={[styles.craigsStoreBadge, { color: "#ffd700", backgroundColor: "#ffd70018" }]}>
                          FEATURED LURE
                        </Text>
                        <Text style={[styles.craigsProductName, { color: colors.foreground }]} numberOfLines={2}>
                          {lureEntry.name}
                        </Text>
                        <Text style={[styles.craigsViewBtn, { color: colors.mutedForeground, fontSize: 10 }]}>
                          {lureEntry.brand}
                        </Text>
                      </View>
                    </View>

                    {/* Darwin stores buy row */}
                    <Text style={[styles.craigsStoreBadge, { color: colors.primary, backgroundColor: `${colors.primary}14`, marginTop: 8, marginBottom: 4, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, overflow: "hidden", fontSize: 9, fontWeight: "700" }]}>
                      BUY IN DARWIN
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                      <View style={{ flexDirection: "row", gap: 6, paddingRight: 8 }}>
                        {storeLinks.map(({ store, url }) => (
                          <TouchableOpacity
                            key={store.id}
                            activeOpacity={0.8}
                            onPress={() => Linking.openURL(url)}
                            style={{ backgroundColor: `${store.color}22`, borderColor: `${store.color}55`, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, alignItems: "center", justifyContent: "center", minWidth: 76 }}
                          >
                            <Text style={{ color: store.color, fontSize: 10, fontWeight: "700", textAlign: "center" }}>
                              {store.shortName}
                            </Text>
                            <Text style={{ color: store.color, fontSize: 8, opacity: 0.8, textAlign: "center" }}>
                              Search →
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                );
              })() : (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => Linking.openURL(`https://craigsfishingwarehouse.com.au/?s=${encodeURIComponent(analysis.lure ?? "")}&post_type=product`)}
                  style={[styles.craigsSearchBtn, { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}44` }]}
                >
                  <MaterialCommunityIcons name="fish" size={15} color={colors.primary} />
                  <Text style={[styles.craigsSearchText, { color: colors.primary }]}>
                    Search for this lure in Darwin →
                  </Text>
                </TouchableOpacity>
              )}
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

      {/* Overall plan — suppressed when croc alert is active */}
      {!analysis.crocAlert && (
        <>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={[styles.suggestionBox, { backgroundColor: colors.secondary }]}>
            <Feather name="target" size={14} color={colors.primary} style={styles.suggestionIcon} />
            <Text style={[styles.suggestionText, { color: colors.foreground }]}>
              {analysis.suggestion}
            </Text>
          </View>
        </>
      )}

      {/* ── DETECTION CONFIDENCE VERDICT ─────────────────────────────────── */}
      {!analysis.crocAlert && analysis.confidence > 0 && (
        <>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={[styles.verdictPanel, {
            backgroundColor: confidenceColor + "12",
            borderColor: confidenceColor + "55",
          }]}>
            {/* Header row */}
            <View style={styles.verdictHeaderRow}>
              <MaterialCommunityIcons name="radar" size={13} color={confidenceColor} />
              <Text style={[styles.verdictTitle, { color: confidenceColor }]}>DETECTION CONFIDENCE</Text>
            </View>

            {/* Score row — big % + label + bar */}
            <View style={styles.verdictScoreRow}>
              <Text style={[styles.verdictPct, { color: confidenceColor }]}>
                {analysis.confidence}%
              </Text>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.verdictArchLabel, { color: colors.mutedForeground }]}>
                  ARCH DETECTION
                </Text>
                <Text style={[styles.verdictVerdict, { color: confidenceColor }]}>
                  {analysis.confidence >= 85
                    ? "HIGH CONFIDENCE"
                    : analysis.confidence >= 70
                    ? "MODERATE CONFIDENCE"
                    : analysis.confidence >= 50
                    ? "POSSIBLE — RE-SCAN"
                    : "LOW — RE-POSITION"}
                </Text>
                {/* Horizontal progress bar */}
                <View style={[styles.verdictBarTrack, { backgroundColor: colors.border }]}>
                  <View style={[styles.verdictBarFill, {
                    width: `${analysis.confidence}%` as any,
                    backgroundColor: confidenceColor,
                  }]} />
                </View>
              </View>
            </View>

            {/* Arch type chip */}
            {analysis.archType && analysis.archType !== "none" && analysis.archType !== "" && (
              <View style={[styles.verdictChip, {
                borderColor: confidenceColor + "44",
                backgroundColor: confidenceColor + "0e",
              }]}>
                <MaterialCommunityIcons name="sine-wave" size={11} color={confidenceColor} />
                <Text style={[styles.verdictChipText, { color: confidenceColor }]}>
                  {analysis.archType.replace(/_/g, " ").toUpperCase()}
                </Text>
              </View>
            )}

            {/* archReasoning — the AI's evidence trail */}
            {analysis.archReasoning && (
              <Text style={[styles.verdictReasoning, { color: colors.mutedForeground }]}>
                {analysis.archReasoning.length > 200
                  ? analysis.archReasoning.slice(0, 200) + "…"
                  : analysis.archReasoning}
              </Text>
            )}
          </View>
        </>
      )}
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
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    height: 200,
    position: "relative",
  },
  fishImage: {
    width: "100%",
    height: "100%",
  },
  fishImageSkeleton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  fishSkeletonText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  fishImageLabel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 1,
  },
  fishImageLabelText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.2,
  },
  fishImageConfidence: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  craigsCard: {
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
    gap: 0,
  },
  craigsImageWrap: {
    width: 110,
    height: 100,
  },
  craigsImage: {
    width: 110,
    height: 100,
  },
  craigsInfo: {
    flex: 1,
    padding: 10,
    gap: 4,
    justifyContent: "space-between",
  },
  craigsHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  craigsStoreBadge: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  craigsProductName: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 17,
    flex: 1,
  },
  craigsFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  craigsViewBtn: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  craigsLoadingText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    padding: 14,
    textAlign: "center",
    flex: 1,
  },
  craigsSearchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  craigsSearchText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },

  crocAlertBanner: {
    backgroundColor: "#cc0000",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 4,
    marginBottom: -4,
  },
  crocAlertTitle: {
    fontSize: 20,
    fontFamily: "Oswald_700Bold",
    color: "#ffffff",
    letterSpacing: 2,
  },
  crocAlertSub: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#ffcccc",
    letterSpacing: 1.5,
  },
  crocWarningBox: {
    backgroundColor: "#1a0000",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cc000066",
    padding: 14,
    gap: 8,
    marginBottom: -4,
  },
  crocWarningLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#ff4444",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  crocWarningText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#ffaaaa",
    lineHeight: 19,
  },
  crocSafetyText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#ff8888",
    lineHeight: 17,
    marginTop: 2,
  },

  // ── Detection Confidence Verdict ──────────────────────────────────────────
  verdictPanel: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  verdictHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  verdictTitle: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  verdictScoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  verdictPct: {
    fontSize: 44,
    fontFamily: "Inter_700Bold",
    lineHeight: 48,
    letterSpacing: -1,
  },
  verdictArchLabel: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  verdictVerdict: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  verdictBarTrack: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
    marginTop: 2,
  },
  verdictBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  verdictChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  verdictChipText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
  },
  verdictReasoning: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
    marginTop: 2,
  },
});
