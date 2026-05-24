import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as Haptics from "expo-haptics";
import { HVHeader } from "@/components/HVHeader";
import { useColors } from "@/hooks/useColors";
import { useSoundDetection } from "@/hooks/useSoundDetection";
import { SoundMicButton, INDICATOR_COLOUR } from "@/components/SoundAlertOverlay";
import { useFishImage } from "@/hooks/useFishImage";
import { useAutoNarrate } from "@/hooks/useAutoNarrate";
import { useVoice } from "@/hooks/useVoice";
import { NT_SPECIES, CATEGORIES, type NTSpecies, type FishCategory } from "@/data/ntSpecies";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getBaseUrl(): string {
  const d = process.env.EXPO_PUBLIC_DOMAIN;
  return d ? `https://${d}` : "";
}

async function toJpeg(uri: string): Promise<{ base64: string }> {
  const r = await manipulateAsync(uri, [{ resize: { width: 1024 } }], {
    format: SaveFormat.JPEG, compress: 0.8, base64: true,
  });
  return { base64: r.base64 ?? "" };
}

// ─── Bird result types ────────────────────────────────────────────────────────
interface BirdResult {
  species:             string;
  scientificName:      string;
  confidence:          number;
  behavior:            "diving" | "aerial" | "perched" | "other";
  fishingIndicator:    "VERY HIGH" | "HIGH" | "MODERATE" | "LOW" | "NONE";
  fishingSignificance: string;
  description:         string;
  narration:           string;
  refPhotosUsed:       number;
}

// ─── Indicator colour mapping ─────────────────────────────────────────────────
const INDICATOR_STYLE: Record<string, { color: string; bg: string }> = {
  "VERY HIGH": { color: "#00ff66", bg: "#00c85020" },
  HIGH:        { color: "#00d4aa", bg: "#00d4aa18" },
  MODERATE:    { color: "#ffd700", bg: "#ffd70018" },
  LOW:         { color: "#ff8800", bg: "#ff880018" },
  NONE:        { color: "#666666", bg: "#66666612" },
};

const BEHAVIOR_LABEL: Record<string, string> = {
  diving:  "🔽 DIVING",
  aerial:  "🌀 AERIAL",
  perched: "🪺 PERCHED",
  other:   "· OTHER",
};

// ─── Lazy CameraView (web-safe) ───────────────────────────────────────────────
let CameraView: React.ComponentType<any> | null = null;
if (Platform.OS !== "web") {
  try { CameraView = (require("expo-camera") as { CameraView: React.ComponentType<any> }).CameraView; } catch {}
}

// ─── Bird Detector Section ────────────────────────────────────────────────────
function BirdDetectorSection({ colors }: { colors: ReturnType<typeof useColors> }) {
  const [photo,     setPhoto]     = useState<string | null>(null);
  const [result,    setResult]    = useState<BirdResult | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [liveMode,  setLiveMode]  = useState(false);
  const [scanning,  setScanning]  = useState(false);
  const [liveCount, setLiveCount] = useState(0);
  const camRef        = useRef<any>(null);
  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanActiveRef = useRef(false);
  const { speak, stop, speaking } = useVoice();
  const _birdApiBase = getBaseUrl();
  const { isMonitoring: birdMonitoring, isListening: birdListening, isAnalyzing: birdAnalyzing, detections: birdDetections, startMonitoring: birdStart, stopMonitoring: birdStop } = useSoundDetection({
    screenType:  "bird",
    apiBase:     _birdApiBase,
    onDetection: (d) => {
      const text = [d.narration, d.plan].filter(Boolean).join(". ");
      if (text) speak(text);
    },
  });

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const stopLive = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    scanActiveRef.current = false;
    setLiveMode(false);
    setScanning(false);
  }, []);

  const runLiveScan = useCallback(async () => {
    if (scanActiveRef.current || !camRef.current) return;
    try {
      scanActiveRef.current = true;
      setScanning(true);
      const pic = await (camRef.current as any).takePictureAsync({
        base64: true, quality: 0.4, skipProcessing: true,
      }) as { base64?: string; uri: string } | null;
      if (!pic?.uri) return;
      const compressed = await manipulateAsync(
        pic.uri,
        [{ resize: { width: 640 } }],
        { format: SaveFormat.JPEG, compress: 0.65, base64: true },
      );
      const b64 = compressed.base64 ?? pic.base64 ?? "";
      if (!b64) return;
      const resp = await fetch(`${getBaseUrl()}/api/bird-id`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: b64 }),
      });
      if (!resp.ok) return;
      const data: BirdResult = await resp.json();
      setResult(data);
      setLiveCount((n) => n + 1);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      if (data.species && data.species.toLowerCase() !== "unknown" && data.confidence >= 30) {
        fetch(`${getBaseUrl()}/api/hud/update`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            birdAlert:    `${data.species} — ${data.fishingIndicator} indicator`,
            birdActivity: data.narration,
            source:       "bird_live",
          }),
        }).catch(() => {});
      }
    } catch { /* non-fatal */ } finally {
      scanActiveRef.current = false;
      setScanning(false);
    }
  }, []);

  const toggleLive = useCallback(async () => {
    if (liveMode) { stopLive(); return; }
    if (Platform.OS === "web" || !CameraView) {
      setError("Live mode requires the mobile app.");
      return;
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { setError("Camera permission required for live mode."); return; }
    setPhoto(null);
    setError(null);
    setResult(null);
    setLiveMode(true);
    setLiveCount(0);
    setTimeout(runLiveScan, 800);
    intervalRef.current = setInterval(runLiveScan, 6000);
  }, [liveMode, stopLive, runLiveScan]);

  const openCamera = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setResult(null);
    setError(null);
    stopLive();
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { setError("Camera permission required."); return; }
    const picked = await ImagePicker.launchCameraAsync({
      mediaTypes: "images", allowsEditing: false, quality: 0.9,
    });
    if (picked.canceled || !picked.assets[0]) return;
    const uri = picked.assets[0].uri;
    setPhoto(uri);
    setLoading(true);
    try {
      const { base64 } = await toJpeg(uri);
      const resp = await fetch(`${getBaseUrl()}/api/bird-id`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64 }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data: BirdResult = await resp.json();
      setResult(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) {
      setError(`Analysis failed: ${String(err)}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setLoading(false);
    }
  }, [stopLive]);

  const openLibrary = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setResult(null);
    setError(null);
    stopLive();
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError("Photo library permission required."); return; }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images", allowsEditing: false, quality: 0.9,
    });
    if (picked.canceled || !picked.assets[0]) return;
    const uri = picked.assets[0].uri;
    setPhoto(uri);
    setLoading(true);
    try {
      const { base64 } = await toJpeg(uri);
      const resp = await fetch(`${getBaseUrl()}/api/bird-id`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64 }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data: BirdResult = await resp.json();
      setResult(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) {
      setError(`Analysis failed: ${String(err)}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setLoading(false);
    }
  }, [stopLive]);

  const indStyle = result ? (INDICATOR_STYLE[result.fishingIndicator] ?? INDICATOR_STYLE.NONE) : null;

  return (
    <View style={BD.wrapper}>
      <View style={BD.sectionHead}>
        <MaterialCommunityIcons name="bird" size={18} color={colors.primary} />
        <Text style={[BD.sectionTitle, { color: colors.primary }]}>BIRD DETECTOR</Text>
        {liveMode && (
          <View style={BD.liveDot}>
            <Text style={BD.liveDotText}>● LIVE</Text>
          </View>
        )}
      </View>
      <Text style={[BD.sectionSub, { color: colors.mutedForeground }]}>
        Point camera at any bird — AI identifies species and live fishing significance
      </Text>

      <View style={BD.btnRow}>
        <TouchableOpacity
          style={[BD.cameraBtn, { backgroundColor: colors.primary, flex: 1 }]}
          onPress={openCamera}
          activeOpacity={0.82}
          disabled={loading || liveMode}
        >
          <Feather name="camera" size={20} color="#fff" />
          <Text style={BD.cameraBtnText}>Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[BD.cameraBtn, { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, flex: 0.7 }]}
          onPress={openLibrary}
          activeOpacity={0.82}
          disabled={loading || liveMode}
        >
          <Feather name="image" size={18} color={colors.foreground} />
          <Text style={[BD.cameraBtnText, { color: colors.foreground }]}>Library</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[BD.cameraBtn, {
            flex: 0.8,
            backgroundColor: liveMode ? "#ff3b3020" : colors.secondary,
            borderWidth: 1,
            borderColor: liveMode ? "#ff3b30" : colors.border,
          }]}
          onPress={toggleLive}
          activeOpacity={0.82}
          disabled={loading}
        >
          <MaterialCommunityIcons
            name={liveMode ? "stop-circle" : "broadcast"}
            size={18}
            color={liveMode ? "#ff3b30" : colors.foreground}
          />
          <Text style={[BD.cameraBtnText, { color: liveMode ? "#ff3b30" : colors.foreground }]}>
            {liveMode ? "Stop" : "Live"}
          </Text>
        </TouchableOpacity>
        {/* HEAR — ambient bird sound detection */}
        <SoundMicButton
          isMonitoring={birdMonitoring}
          isListening={birdListening}
          isAnalyzing={birdAnalyzing}
          onPress={birdMonitoring ? birdStop : birdStart}
          style={{ flex: 0.7 }}
        />
      </View>

      {/* Live bird radar — active while monitoring */}
      {birdMonitoring && (
        <View style={BD.birdRadar}>
          <View style={BD.birdRadarHeader}>
            <View style={BD.birdRadarDot} />
            <Text style={BD.birdRadarTitle}>🎙 LIVE BIRD RADAR</Text>
            {birdListening && <Text style={BD.birdRadarStatus}>● REC</Text>}
            {birdAnalyzing && <Text style={[BD.birdRadarStatus, { color: "#ffd700" }]}>AI…</Text>}
          </View>
          {birdDetections.length === 0 ? (
            <Text style={BD.birdRadarEmpty}>Scanning for bird calls…</Text>
          ) : (
            birdDetections.map((d) => {
              const ago = Math.round((Date.now() - d.ts) / 1000);
              const agoStr = ago < 60 ? `${ago}s ago` : `${Math.floor(ago / 60)}m ago`;
              return (
                <View key={d.id} style={BD.birdRadarRow}>
                  <View style={BD.birdRadarLeft}>
                    <Text style={BD.birdRadarSpecies}>{(d.species ?? "Unknown").toUpperCase()}</Text>
                    {!!d.direction && <Text style={BD.birdRadarDir}>{d.direction.toUpperCase()}</Text>}
                  </View>
                  <View style={BD.birdRadarRight}>
                    {!!d.fishingIndicator && (
                      <View style={[BD.birdRadarIndBadge, { borderColor: (INDICATOR_COLOUR[d.fishingIndicator] ?? "#00d4aa") + "88" }]}>
                        <Text style={[BD.birdRadarIndText, { color: INDICATOR_COLOUR[d.fishingIndicator] ?? "#00d4aa" }]}>
                          {d.fishingIndicator}
                        </Text>
                      </View>
                    )}
                    <Text style={BD.birdRadarAgo}>{agoStr}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}

      {liveMode && CameraView && (
        <View style={BD.liveContainer}>
          <CameraView
            ref={camRef}
            style={BD.liveCamera}
            facing="back"
            mode="picture"
            flash="off"
            animateShutter={false}
            shutterSound={false}
          />
          <View style={BD.liveOverlay}>
            <View style={BD.scanningPill}>
              {scanning ? (
                <ActivityIndicator size="small" color="#00ff88" />
              ) : (
                <View style={BD.livePulseDot} />
              )}
              <Text style={BD.scanningText}>
                {scanning ? "Scanning…" : liveCount > 0 ? `${liveCount} scan${liveCount !== 1 ? "s" : ""}` : "Warming up…"}
              </Text>
            </View>
          </View>
        </View>
      )}

      {!liveMode && photo && (
        <View style={BD.previewBox}>
          <Image source={{ uri: photo }} style={BD.previewImg} resizeMode="cover" />
          {loading && (
            <View style={BD.previewOverlay}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[BD.scanLabel, { color: colors.primary }]}>Identifying bird…</Text>
            </View>
          )}
        </View>
      )}

      {error && !loading && (
        <View style={[BD.errorBox, { backgroundColor: `${colors.destructive}18`, borderColor: `${colors.destructive}55` }]}>
          <Feather name="alert-triangle" size={14} color={colors.destructive} />
          <Text style={[BD.errorText, { color: colors.destructive }]}>{error}</Text>
        </View>
      )}

      {result && !loading && (
        <View style={[BD.resultCard, { backgroundColor: colors.card, borderColor: liveMode ? "#ff3b3055" : colors.border }]}>
          {liveMode && (
            <View style={BD.liveResultBadge}>
              <View style={BD.livePulseDot} />
              <Text style={BD.liveResultText}>LIVE DETECTION · HUD UPDATED</Text>
            </View>
          )}
          <View style={BD.resultHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[BD.speciesName, { color: colors.foreground }]}>{result.species}</Text>
              <Text style={[BD.sciName, { color: colors.mutedForeground }]}>{result.scientificName}</Text>
            </View>
            <View style={[BD.confBadge, { backgroundColor: `${colors.primary}22`, borderColor: `${colors.primary}55` }]}>
              <Text style={[BD.confText, { color: colors.primary }]}>{result.confidence}%</Text>
            </View>
          </View>

          <View style={BD.badgeRow}>
            <View style={[BD.behavBadge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Text style={[BD.behavText, { color: colors.mutedForeground }]}>
                {BEHAVIOR_LABEL[result.behavior] ?? result.behavior.toUpperCase()}
              </Text>
            </View>
            {indStyle && (
              <View style={[BD.indicatorBadge, { backgroundColor: indStyle.bg, borderColor: indStyle.color + "66" }]}>
                <Text style={[BD.indicatorLabel, { color: indStyle.color }]}>
                  🎣 {result.fishingIndicator} INDICATOR
                </Text>
              </View>
            )}
          </View>

          <Text style={[BD.descText, { color: colors.mutedForeground }]}>{result.description}</Text>

          <View style={[BD.sigBox, { backgroundColor: `${colors.primary}0e`, borderColor: `${colors.primary}33` }]}>
            <MaterialCommunityIcons name="fish" size={13} color={colors.primary} />
            <Text style={[BD.sigText, { color: colors.foreground }]}>{result.fishingSignificance}</Text>
          </View>

          <Text style={[BD.narrationText, { color: colors.mutedForeground }]}>"{result.narration}"</Text>

          <TouchableOpacity
            style={[BD.narrateBtn, { backgroundColor: speaking ? colors.secondary : `${colors.primary}22`, borderColor: speaking ? colors.border : `${colors.primary}55` }]}
            onPress={() => speaking ? stop() : speak(result.narration)}
            activeOpacity={0.8}
          >
            <Feather name={speaking ? "volume-x" : "volume-2"} size={15} color={speaking ? colors.mutedForeground : colors.primary} />
            <Text style={[BD.narrateBtnText, { color: speaking ? colors.mutedForeground : colors.primary }]}>
              {speaking ? "Stop" : "Narrate"}
            </Text>
          </TouchableOpacity>

          {result.refPhotosUsed > 0 && (
            <Text style={[BD.refNote, { color: colors.mutedForeground }]}>
              Identified using {result.refPhotosUsed} reference photo{result.refPhotosUsed !== 1 ? "s" : ""} from the bird library
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Eating stars ─────────────────────────────────────────────────────────────
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

function SpeciesCard({ species, colors }: { species: NTSpecies; colors: ReturnType<typeof useColors> }) {
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
  useAutoNarrate(() => "NT Species Guide. Browse bag limits, minimum sizes, and fishing seasons for species found in NT waters.");

  const topPad = Platform.OS === "web" ? 0 : insets.top;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return NT_SPECIES.filter((s) => {
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
    <FlatList<NTSpecies>
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
          <HVHeader subtitle="NT Species Guide" />
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.primary }]}>🐟 NT Species</Text>
            <Text style={[styles.count, { color: colors.mutedForeground }]}>
              {filtered.length} of {NT_SPECIES.length}
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
      ListFooterComponent={<BirdDetectorSection colors={colors} />}
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

// ─── Bird Detector Styles ─────────────────────────────────────────────────────
const BD = StyleSheet.create({
  wrapper:        { marginTop: 20, marginBottom: 8, gap: 10 },
  sectionHead:    { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle:   { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 1.2 },
  sectionSub:     { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  btnRow:         { flexDirection: "row", gap: 10 },
  cameraBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14 },
  cameraBtnText:  { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  previewBox:     { width: "100%", height: 220, borderRadius: 12, overflow: "hidden", position: "relative" },
  previewImg:     { width: "100%", height: "100%" },
  previewOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "#000c", alignItems: "center", justifyContent: "center", gap: 12 },
  scanLabel:      { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  errorBox:       { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  errorText:      { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  resultCard:     { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  resultHeader:   { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  speciesName:    { fontSize: 18, fontFamily: "Inter_700Bold" },
  sciName:        { fontSize: 12, fontFamily: "Inter_400Regular", fontStyle: "italic" },
  confBadge:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  confText:       { fontSize: 13, fontFamily: "Inter_700Bold" },
  badgeRow:       { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  behavBadge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  behavText:      { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  indicatorBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  indicatorLabel: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  descText:       { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  sigBox:         { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, borderRadius: 8, borderWidth: 1 },
  sigText:        { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 18 },
  narrationText:  { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19, fontStyle: "italic" },
  narrateBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  narrateBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  refNote:        { fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center" },
  // Live mode
  liveDot:         { flexDirection: "row", alignItems: "center", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: "#ff3b3022", marginLeft: 4 },
  liveDotText:     { fontSize: 10, fontFamily: "Inter_700Bold", color: "#ff3b30" },
  liveContainer:   { borderRadius: 12, overflow: "hidden", height: 240, position: "relative" },
  liveCamera:      { flex: 1 },
  liveOverlay:     { position: "absolute", bottom: 10, left: 10 },
  scanningPill:    { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: "#000000bb" },
  scanningText:    { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#ffffff" },
  livePulseDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ff3b30" },
  liveResultBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveResultText:  { fontSize: 10, fontFamily: "Inter_700Bold", color: "#ff3b30", letterSpacing: 0.5 },
  soundCard:        { borderRadius: 12, borderWidth: 1, padding: 14, gap: 8, marginTop: 4 },
  soundCardHeader:  { flexDirection: "row", alignItems: "center", gap: 8 },
  soundCardLabel:   { fontSize: 10, fontFamily: "Oswald_700Bold", letterSpacing: 1.5, color: "#00d4aa" },
  soundCardConf:    { fontSize: 10, fontFamily: "Inter_700Bold", color: "#00d4aa" },
  soundIndBadge:    { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  soundIndText:     { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  soundSpecies:     { fontSize: 16, fontFamily: "Inter_700Bold", color: "#ffffffee" },
  soundLocation:    { fontSize: 12, fontFamily: "Oswald_700Bold", letterSpacing: 1, color: "#00d4aa" },
  soundNarration:   { fontSize: 13, fontFamily: "Inter_400Regular", color: "#ffffffaa", fontStyle: "italic", lineHeight: 19 },
  soundPlanBox:     { borderLeftWidth: 3, borderLeftColor: "#00d4aa", paddingLeft: 10, gap: 3 },
  soundPlanLabel:   { fontSize: 10, fontFamily: "Oswald_700Bold", letterSpacing: 1.5, color: "#00d4aa" },
  soundPlanText:    { fontSize: 13, fontFamily: "Inter_500Medium", color: "#ffffffcc", lineHeight: 18 },
  soundDismiss:     { alignSelf: "flex-end", paddingVertical: 4, paddingHorizontal: 8 },
  soundDismissText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#ffffff44" },
  birdRadar:        { borderRadius: 14, borderWidth: 1, borderColor: "#00d4aa33", backgroundColor: "#00d4aa08", padding: 12, gap: 8, marginTop: 6 },
  birdRadarHeader:  { flexDirection: "row", alignItems: "center", gap: 8 },
  birdRadarDot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ff3b30" },
  birdRadarTitle:   { fontSize: 11, fontFamily: "Oswald_700Bold", letterSpacing: 1.5, color: "#00d4aa", flex: 1 },
  birdRadarStatus:  { fontSize: 10, fontFamily: "Inter_700Bold", color: "#ff3b30" },
  birdRadarEmpty:   { fontSize: 12, fontFamily: "Inter_400Regular", color: "#ffffff44", fontStyle: "italic", paddingVertical: 4 },
  birdRadarRow:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 7, borderTopWidth: 1, borderTopColor: "#00d4aa18" },
  birdRadarLeft:    { flex: 1, gap: 2 },
  birdRadarSpecies: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#ffffffee" },
  birdRadarDir:     { fontSize: 10, fontFamily: "Oswald_700Bold", letterSpacing: 1, color: "#00d4aa88" },
  birdRadarRight:   { alignItems: "flex-end", gap: 4 },
  birdRadarIndBadge:{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  birdRadarIndText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  birdRadarAgo:     { fontSize: 10, fontFamily: "Inter_400Regular", color: "#ffffff33" },
});

// ─── Species list styles ──────────────────────────────────────────────────────
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
