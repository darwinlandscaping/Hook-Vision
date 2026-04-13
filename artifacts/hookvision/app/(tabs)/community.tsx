import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Image,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as VideoThumbnails from "expo-video-thumbnails";

import { HVHeader } from "@/components/HVHeader";
import { useColors } from "@/hooks/useColors";
import { DemoStore } from "@/app/(tabs)/demo";
import { SpeciesCompareStore } from "@/stores/SpeciesCompareStore";

const C = {
  teal:   "#00d4aa",
  blue:   "#00a8ff",
  gold:   "#ffd700",
  red:    "#e8151a",
  green:  "#4ade80",
};

const domain   = process.env.EXPO_PUBLIC_DOMAIN;
const BASE_URL = domain ? `https://${domain}` : "";

interface HotSpecies  { species: string; count: number; trend: "rising"|"stable"|"falling"; }
interface HotDepth    { range: string; count: number; notes: string; }
interface HotTime     { period: string; activity: "high"|"medium"|"low"; notes: string; }
interface Insights {
  generatedAt?: string;
  reportCount: number;
  hotSpecies: HotSpecies[];
  hotDepths: HotDepth[];
  hotTimes: HotTime[];
  hotLocations: string[];
  tips: string[];
  summary: string;
}
interface Hotspot {
  locationName: string;
  reportCount:  number;
  avgFishCount: number;
  speciesCount: number;
  topSpecies:   string | null;
  recent2h:     number;
  recent6h:     number;
  heat:         "firing" | "hot" | "warm";
  latestAt:     string;
}

interface FeedReport {
  id: number;
  species: string | null;
  fishCount: number | null;
  depth: string | null;
  locationName: string | null;
  lureSuggestion: string | null;
  submittedAt: string;
}

interface BrainVideo {
  id: number;
  title: string;
  description: string | null;
  durationSecs: number | null;
  frameCount: number;
  status: "queued" | "processing" | "done" | "failed";
  brainInsight: string | null;
  detectedSpecies: string[] | null;
  depthRanges: string[] | null;
  aiTips: string[] | null;
  cvSummary: Record<string, unknown> | null;
  videoUri: string | null;
  submittedAt: string;
  processedAt: string | null;
}

// Map community species name → demo image number (1-4)
function speciesDemoNum(species: string): number {
  const s = species.toLowerCase();
  if (s.includes("barra"))                         return 1;
  if (s.includes("threadfin"))                     return 2;
  if (s.includes("fingermark") || s.includes("golden snapper") ||
      s.includes("red emperor") || s.includes("mangrove jack")) return 3;
  return 4;
}

function trendIcon(t: HotSpecies["trend"]) {
  if (t === "rising")  return { name: "trending-up"   as const, color: C.green };
  if (t === "falling") return { name: "trending-down" as const, color: C.red   };
  return                      { name: "minus"         as const, color: C.gold  };
}
function activityColor(a: HotTime["activity"]) {
  if (a === "high")   return C.green;
  if (a === "medium") return C.gold;
  return C.blue;
}
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  if (hours >= 6) return "refresh due";
  if (hours > 0)  return `${hours}h ago`;
  if (mins  > 0)  return `${mins}m ago`;
  return "just now";
}
function feedTimeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const secs  = Math.floor(diff / 1000);
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) return `${hours}h ago`;
  if (mins  > 0) return `${mins}m ago`;
  if (secs  > 0) return `${secs}s ago`;
  return "now";
}

const FEED_POLL_MS      = 30_000;         // 30 seconds
const INSIGHTS_POLL_MS  = 5 * 60_000;    // 5 minutes
const HOTSPOT_POLL_MS   = 2 * 60_000;    // 2 minutes

export default function CommunityScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const topPad  = Platform.OS === "web" ? 0 : insets.top;
  const botPad  = Platform.OS === "web" ? 70 : insets.bottom + 24;

  const [insights, setInsights]         = useState<Insights | null>(null);
  const [feed, setFeed]                 = useState<FeedReport[]>([]);
  const [totalReports, setTotalReports] = useState<number>(0);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [insightsError, setInsightsError]     = useState<string | null>(null);
  const [newCount, setNewCount]         = useState(0);
  const [expandedIdx, setExpandedIdx]   = useState<number | null>(null);
  const [analysingIdx, setAnalysingIdx] = useState<number | null>(null);

  const [hotspots, setHotspots]         = useState<Hotspot[]>([]);
  const [firingAlert, setFiringAlert]   = useState<Hotspot | null>(null);
  const [alertDismissed, setAlertDismissed] = useState(false);

  const feedTimer     = useRef<ReturnType<typeof setInterval> | null>(null);
  const insightsTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const hotspotTimer  = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFeedId    = useRef<number>(0);
  const isFocused     = useRef(false);

  // ── Brain Video Library ────────────────────────────────────────────────────
  const [videoLibrary, setVideoLibrary]   = useState<BrainVideo[]>([]);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadStatus, setUploadStatus]   = useState<string | null>(null);
  const [expandedVideoId, setExpandedVideoId] = useState<number | null>(null);

  // ── Brain Snapshot popup ──────────────────────────────────────────────────
  const [snapshotVideo, setSnapshotVideo] = useState<BrainVideo | null>(null);
  const [snapshotCountdown, setSnapshotCountdown] = useState(10);
  const snapshotProgress = useRef(new Animated.Value(1)).current;
  const snapshotAnimRef  = useRef<Animated.CompositeAnimation | null>(null);
  const snapshotTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const closeSnapshot = useCallback(() => {
    snapshotAnimRef.current?.stop();
    if (snapshotTimerRef.current) clearInterval(snapshotTimerRef.current);
    setSnapshotVideo(null);
    setSnapshotCountdown(10);
  }, []);

  const showSnapshot = useCallback((v: BrainVideo) => {
    snapshotProgress.setValue(1);
    snapshotAnimRef.current?.stop();
    if (snapshotTimerRef.current) clearInterval(snapshotTimerRef.current);
    setSnapshotCountdown(10);
    setSnapshotVideo(v);
    snapshotAnimRef.current = Animated.timing(snapshotProgress, {
      toValue: 0,
      duration: 10_000,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    snapshotAnimRef.current.start(({ finished }) => {
      if (finished) setSnapshotVideo(null);
    });
    let count = 10;
    snapshotTimerRef.current = setInterval(() => {
      count -= 1;
      setSnapshotCountdown(count);
      if (count <= 0) {
        clearInterval(snapshotTimerRef.current!);
      }
    }, 1000);
  }, [snapshotProgress]);

  // Only show snapshot when the video has meaningful sonar data
  const hasHandyVisual = useCallback((v: BrainVideo): boolean => {
    if (v.status !== "done" || !v.cvSummary) return false;
    const cv = v.cvSummary as Record<string, number>;
    return (cv.totalBlobsDetected ?? 0) >= 5 || (cv.avgBrightPct ?? 0) >= 12;
  }, []);

  const handleVideoTap = useCallback((v: BrainVideo, isExpanded: boolean) => {
    setExpandedVideoId(isExpanded ? null : v.id);
    if (!isExpanded && hasHandyVisual(v)) {
      showSnapshot(v);
    }
  }, [hasHandyVisual, showSnapshot]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      snapshotAnimRef.current?.stop();
      if (snapshotTimerRef.current) clearInterval(snapshotTimerRef.current);
    };
  }, []);

  const fetchVideos = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/brain/videos`);
      if (!res.ok) return;
      const data = await res.json() as { videos: BrainVideo[] };
      setVideoLibrary(data.videos ?? []);
    } catch {}
  }, []);

  const pickAndUploadVideo = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Allow photo library access to add videos to the brain.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset   = result.assets[0];
      const uri     = asset.uri;
      const durMs   = asset.duration ?? 0;
      const durSecs = Math.round(durMs / 1000);
      const title   = asset.fileName ?? `Video ${new Date().toLocaleDateString()}`;

      setUploadingVideo(true);
      setUploadStatus("Extracting frames…");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // ── Extract frames at even intervals (up to 20 frames) ────────────────
      const maxFrames  = Math.min(20, Math.max(3, Math.floor(durSecs / 3)));
      const intervalMs = durMs > 0 ? (durMs / maxFrames) : 2000;
      const frames: string[] = [];

      for (let i = 0; i < maxFrames; i++) {
        const timeMs = Math.floor(intervalMs * i);
        try {
          const thumb = await VideoThumbnails.getThumbnailAsync(uri, {
            time:    timeMs,
            quality: 0.65,
          });
          // Convert thumbnail URI → base64
          const r    = await fetch(thumb.uri);
          const blob = await r.blob();
          const b64  = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload  = () => resolve((reader.result as string).split(",")[1] ?? "");
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          if (b64) frames.push(b64);
        } catch {}

        setUploadStatus(`Extracting frame ${i + 1}/${maxFrames}…`);
      }

      if (frames.length === 0) {
        Alert.alert("Error", "Could not extract frames from this video. Try a different file.");
        setUploadingVideo(false);
        setUploadStatus(null);
        return;
      }

      setUploadStatus(`Sending ${frames.length} frames to Brain…`);

      const uploadRes = await fetch(`${BASE_URL}/api/brain/video`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ title, durationSecs: durSecs, videoUri: uri, frames }),
      });

      if (!uploadRes.ok) throw new Error("Upload failed");

      setUploadStatus("Video added to brain — analyzing…");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Refresh library after a short delay so the processing entry is visible
      setTimeout(() => {
        fetchVideos();
        setUploadStatus(null);
      }, 1500);

    } catch (e) {
      Alert.alert("Error", "Failed to add video. Please try again.");
    } finally {
      setUploadingVideo(false);
    }
  }, [fetchVideos]);

  // Poll for status updates on processing videos
  const videoPolling = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── fetch hotspots ─────────────────────────────────────────────────────────
  const fetchHotspots = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/community/hotspots`);
      if (!res.ok) return;
      const data = await res.json();
      const spots: Hotspot[] = data.hotspots ?? [];
      setHotspots(spots);
      const topFiring = spots.find((s) => s.heat === "firing");
      if (topFiring && !alertDismissed) {
        setFiringAlert(topFiring);
      } else if (!topFiring) {
        setFiringAlert(null);
      }
    } catch {}
  }, [alertDismissed]);

  // ── fetch live feed ────────────────────────────────────────────────────────
  const fetchFeed = useCallback(async (silent = true) => {
    try {
      const res  = await fetch(`${BASE_URL}/api/community/feed?limit=20`);
      if (!res.ok) return;
      const json = await res.json() as { reports: FeedReport[]; total: number };
      setFeed(json.reports);
      setTotalReports(json.total);

      // count truly new arrivals since last poll
      if (lastFeedId.current > 0 && json.reports.length > 0) {
        const newOnes = json.reports.filter((r) => r.id > lastFeedId.current);
        if (newOnes.length > 0) setNewCount((n) => n + newOnes.length);
      }
      if (json.reports.length > 0) {
        lastFeedId.current = json.reports[0].id;
      }
    } catch { /* silent */ }
  }, []);

  // ── fetch insights ─────────────────────────────────────────────────────────
  const fetchInsights = useCallback(async (showSpinner = false) => {
    if (showSpinner) { setLoadingInsights(true); setInsightsError(null); }
    try {
      const res  = await fetch(`${BASE_URL}/api/community/insights`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const json = await res.json() as Insights;
      setInsights(json);
    } catch (e) {
      setInsightsError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (showSpinner) setLoadingInsights(false);
    }
  }, []);

  // ── refresh everything ─────────────────────────────────────────────────────
  const refreshAll = useCallback(async () => {
    setNewCount(0);
    setAlertDismissed(false);
    await Promise.all([fetchFeed(false), fetchInsights(true), fetchHotspots()]);
  }, [fetchFeed, fetchInsights, fetchHotspots]);

  // ── start / stop polling on focus ─────────────────────────────────────────
  useFocusEffect(useCallback(() => {
    isFocused.current = true;
    setNewCount(0);

    // initial load
    fetchFeed(false);
    fetchHotspots();
    fetchVideos();
    if (!insights) fetchInsights(true);

    feedTimer.current     = setInterval(() => fetchFeed(true), FEED_POLL_MS);
    insightsTimer.current = setInterval(() => fetchInsights(false), INSIGHTS_POLL_MS);
    hotspotTimer.current  = setInterval(() => fetchHotspots(), HOTSPOT_POLL_MS);
    // Poll for video status updates every 8s (catches processing → done transitions)
    videoPolling.current  = setInterval(() => fetchVideos(), 8_000);

    return () => {
      isFocused.current = false;
      if (feedTimer.current)     clearInterval(feedTimer.current);
      if (insightsTimer.current) clearInterval(insightsTimer.current);
      if (hotspotTimer.current)  clearInterval(hotspotTimer.current);
      if (videoPolling.current)  clearInterval(videoPolling.current);
    };
  }, [fetchFeed, fetchInsights, fetchHotspots, fetchVideos, insights]));

  // ── Send community species demo to Analyzer ────────────────────────────────
  const sendToAnalyzer = useCallback(async (speciesName: string, idx: number) => {
    try {
      setAnalysingIdx(idx);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const demoNum = speciesDemoNum(speciesName);
      const url = `${BASE_URL}/api/demos/sonar-demo-${demoNum}.png`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Could not load demo image");
      const blob  = await res.blob();
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload  = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      DemoStore.pendingUri    = url;
      DemoStore.pendingBase64 = base64;
      SpeciesCompareStore.expectedSpecies = speciesName;
      SpeciesCompareStore.demoNum         = demoNum;
      router.navigate("/(tabs)");
    } catch (e) {
      Alert.alert("Error", "Could not load sonar image. Try again.");
    } finally {
      setAnalysingIdx(null);
    }
  }, [router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <HVHeader subtitle="Community Intel" />
        <View style={styles.headerRow}>
          {/* Privacy badge */}
          <View style={[styles.privacyBadge, { borderColor: C.teal + "50", backgroundColor: C.teal + "12" }]}>
            <Feather name="lock" size={10} color={C.teal} />
            <Text style={[styles.privacyText, { color: C.teal }]}>Anonymous · No personal data</Text>
          </View>
          <TouchableOpacity onPress={refreshAll} activeOpacity={0.7} style={styles.refreshBtn}>
            <Feather name="refresh-cw" size={15} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── FIRING HOTSPOT ALERT BANNER ──────────────────────────────────────── */}
      {firingAlert && !alertDismissed && (
        <View style={styles.alertBanner}>
          <Text style={styles.alertFire}>🔥</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.alertTitle}>SPOT FIRING NOW</Text>
            <Text style={styles.alertBody} numberOfLines={1}>
              {firingAlert.locationName}
              {firingAlert.topSpecies ? ` · ${firingAlert.topSpecies}` : ""}
              {` · ${firingAlert.recent2h} scan${firingAlert.recent2h !== 1 ? "s" : ""} in 2h`}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.alertDismiss}
            onPress={() => setAlertDismissed(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="x" size={15} color="#ff9900" />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: botPad }]}
        refreshControl={
          <RefreshControl
            refreshing={loadingInsights}
            onRefresh={refreshAll}
            tintColor={C.teal}
            colors={[C.teal]}
          />
        }
      >
        {/* ── BEST GO'S — HOTSPOT TRACKER ──────────────────────────────── */}
        {hotspots.length > 0 && (
          <View style={[styles.hotspotCard, { backgroundColor: colors.card, borderColor: "#ff990040" }]}>
            <View style={styles.hotspotHeader}>
              <View style={styles.hotspotTitleRow}>
                <Text style={styles.hotspotFire}>🎯</Text>
                <View>
                  <Text style={[styles.hotspotTitle, { color: colors.foreground }]}>BEST GO'S</Text>
                  <Text style={[styles.hotspotSub, { color: colors.mutedForeground }]}>Top spots · last 24h</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {/* Live scan map button */}
                <TouchableOpacity
                  onPress={() => router.push("/(tabs)/map" as any)}
                  style={[styles.mapBtn, { borderColor: "#00d4aa40", backgroundColor: "#00d4aa10" }]}
                  hitSlop={10}
                  activeOpacity={0.7}
                >
                  <Feather name="map-pin" size={13} color="#00d4aa" />
                  <Text style={[styles.mapBtnText, { color: "#00d4aa" }]}>MAP</Text>
                </TouchableOpacity>
                <View style={[styles.livePill, { borderColor: "#ff990050", backgroundColor: "#ff990015" }]}>
                  <View style={[styles.liveDot, { backgroundColor: "#ff9900" }]} />
                  <Text style={[styles.livePillText, { color: "#ff9900" }]}>LIVE</Text>
                </View>
              </View>
            </View>

            {hotspots.map((spot, i) => {
              const isFirst = i === 0;
              const heatCol = spot.heat === "firing" ? "#ff4400" : spot.heat === "hot" ? "#ffd700" : C.teal;
              const heatLabel = spot.heat === "firing" ? "🔥 FIRING" : spot.heat === "hot" ? "🌡 HOT" : "✓ ACTIVE";
              return (
                <View
                  key={spot.locationName}
                  style={[
                    styles.spotRow,
                    {
                      borderColor: heatCol + (isFirst ? "60" : "30"),
                      backgroundColor: isFirst ? heatCol + "12" : "transparent",
                    },
                  ]}
                >
                  <View style={[styles.spotRank, { backgroundColor: heatCol + "25" }]}>
                    <Text style={[styles.spotRankText, { color: heatCol }]}>#{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.spotName, { color: colors.foreground }]} numberOfLines={1}>
                      {spot.locationName}
                    </Text>
                    <Text style={[styles.spotDetail, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {spot.topSpecies ?? "Mixed species"}
                      {spot.avgFishCount > 0 ? ` · avg ${spot.avgFishCount} fish` : ""}
                      {spot.speciesCount > 1 ? ` · ${spot.speciesCount} species` : ""}
                    </Text>
                  </View>
                  <View style={[styles.heatBadge, { borderColor: heatCol + "60", backgroundColor: heatCol + "20" }]}>
                    <Text style={[styles.heatBadgeText, { color: heatCol }]}>{heatLabel}</Text>
                    <Text style={[styles.spotScans, { color: heatCol + "cc" }]}>{spot.reportCount} scans</Text>
                  </View>
                </View>
              );
            })}

            <Text style={[styles.pollNote, { color: colors.mutedForeground + "70", marginTop: 6 }]}>
              Updates every 2 min · Heat = recency × fish count
            </Text>
          </View>
        )}

        {/* ── LIVE FEED ─────────────────────────────────────────────────── */}
        <View style={[styles.feedCard, { backgroundColor: colors.card, borderColor: C.teal + "35" }]}>
          <View style={styles.feedHeader}>
            <View style={styles.liveRow}>
              <View style={styles.livePulse} />
              <Text style={[styles.feedTitle, { color: C.teal }]}>LIVE FEED</Text>
            </View>
            <Text style={[styles.feedTotal, { color: colors.mutedForeground }]}>
              {totalReports.toLocaleString()} total scans
            </Text>
          </View>

          {feed.length === 0 ? (
            <Text style={[styles.feedEmpty, { color: colors.mutedForeground }]}>
              Waiting for reports… scan something to start the feed.
            </Text>
          ) : (
            feed.slice(0, 8).map((r, i) => (
              <View
                key={r.id}
                style={[
                  styles.feedRow,
                  i < feed.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                ]}
              >
                <MaterialCommunityIcons name="fish" size={13} color={C.teal} style={{ marginTop: 1 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.feedSpecies, { color: colors.foreground }]}>
                    {r.species ?? "Unknown"}
                    {r.fishCount ? ` · ${r.fishCount} fish` : ""}
                    {r.depth ? ` @ ${r.depth}` : ""}
                  </Text>
                  {r.locationName ? (
                    <Text style={[styles.feedLocation, { color: colors.mutedForeground }]}>
                      <Feather name="map-pin" size={10} /> {r.locationName}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.feedTime, { color: colors.mutedForeground }]}>
                  {feedTimeAgo(r.submittedAt)}
                </Text>
              </View>
            ))
          )}
          <Text style={[styles.pollNote, { color: colors.mutedForeground + "88" }]}>
            Refreshes every 30s · All data anonymous
          </Text>
        </View>

        {/* ── INSIGHTS ──────────────────────────────────────────────────── */}
        {loadingInsights && !insights ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={C.teal} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
              Analyzing community data…
            </Text>
          </View>
        ) : insightsError ? (
          <View style={styles.center}>
            <Feather name="wifi-off" size={36} color={colors.mutedForeground} />
            <Text style={[styles.errorText, { color: colors.mutedForeground }]}>{insightsError}</Text>
            <TouchableOpacity
              style={[styles.retryBtn, { borderColor: C.teal }]}
              onPress={() => fetchInsights(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.retryLabel, { color: C.teal }]}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : insights ? (
          <>
            {/* Summary card */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: C.teal + "40" }]}>
              <View style={styles.brainRow}>
                <MaterialCommunityIcons name="brain" size={26} color={C.teal} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.brainTitle, { color: colors.foreground }]}>Community Brain</Text>
                  <Text style={[styles.brainSub, { color: colors.mutedForeground }]}>
                    {insights.reportCount} scans analyzed
                    {insights.generatedAt ? ` · ${timeAgo(insights.generatedAt)}` : ""}
                  </Text>
                </View>
                <View style={[styles.sixhBadge, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Feather name="clock" size={10} color={colors.mutedForeground} />
                  <Text style={[styles.sixhText, { color: colors.mutedForeground }]}>6h</Text>
                </View>
              </View>
              {insights.summary ? (
                <Text style={[styles.summary, { color: colors.foreground }]}>{insights.summary}</Text>
              ) : null}
            </View>

            {/* Hot Species — expandable with sonar image + Analyse This */}
            {insights.hotSpecies?.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>HOT SPECIES</Text>
                {insights.hotSpecies.map((s, i) => {
                  const t        = trendIcon(s.trend);
                  const expanded = expandedIdx === i;
                  const demoNum  = speciesDemoNum(s.species);
                  const imgUri   = `${BASE_URL}/api/demos/sonar-demo-${demoNum}.png`;
                  const isLoading = analysingIdx === i;
                  return (
                    <TouchableOpacity
                      key={i}
                      activeOpacity={0.85}
                      onPress={() => setExpandedIdx(expanded ? null : i)}
                      style={[
                        styles.rowCard,
                        { backgroundColor: colors.card, borderColor: expanded ? C.teal + "80" : colors.border, flexDirection: "column", padding: 0, overflow: "hidden" },
                      ]}
                    >
                      {/* ── Collapsed row ── */}
                      <View style={styles.speciesRow}>
                        <MaterialCommunityIcons name="fish" size={17} color={C.teal} />
                        <Text style={[styles.rowTitle, { color: colors.foreground }]}>{s.species}</Text>
                        <View style={styles.rowRight}>
                          <Text style={[styles.rowCount, { color: colors.mutedForeground }]}>{s.count} scans</Text>
                          <Feather name={t.name} size={15} color={t.color} />
                          <Feather name={expanded ? "chevron-up" : "chevron-down"} size={14} color={colors.mutedForeground} />
                        </View>
                      </View>

                      {/* ── Expanded panel ── */}
                      {expanded && (
                        <View style={styles.speciesExpanded}>
                          <Image
                            source={{ uri: imgUri }}
                            style={styles.speciesSonar}
                            resizeMode="cover"
                          />
                          <View style={styles.speciesExpandBody}>
                            <Text style={[styles.speciesExpandLabel, { color: colors.mutedForeground }]}>
                              {demoNum === 1 && "Classic barra arch signatures · 5.2m depth range"}
                              {demoNum === 2 && "Mid-water school formation · 3.1m depth range"}
                              {demoNum === 3 && "Hard-bottom reef arch · 8m depth range"}
                              {demoNum === 4 && "Dual-layer suspension · 7m depth range"}
                            </Text>
                            <TouchableOpacity
                              style={[styles.analyseBtn, { backgroundColor: C.teal, opacity: isLoading ? 0.7 : 1 }]}
                              onPress={() => sendToAnalyzer(s.species, i)}
                              activeOpacity={0.8}
                              disabled={isLoading}
                            >
                              {isLoading
                                ? <ActivityIndicator size="small" color="#0a1628" />
                                : <>
                                    <MaterialCommunityIcons name="fish" size={15} color="#0a1628" />
                                    <Text style={styles.analyseBtnText}>Analyse This →</Text>
                                  </>
                              }
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Active Depths */}
            {insights.hotDepths?.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>ACTIVE DEPTHS</Text>
                {insights.hotDepths.map((d, i) => (
                  <View key={i} style={[styles.rowCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Feather name="arrow-down" size={15} color={C.blue} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowTitle, { color: colors.foreground }]}>{d.range}</Text>
                      {d.notes ? (
                        <Text style={[styles.rowNotes, { color: colors.mutedForeground }]}>{d.notes}</Text>
                      ) : null}
                    </View>
                    <Text style={[styles.rowCount, { color: colors.mutedForeground }]}>{d.count}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Peak Times */}
            {insights.hotTimes?.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>PEAK TIMES</Text>
                <View style={styles.timeGrid}>
                  {insights.hotTimes.map((t, i) => (
                    <View
                      key={i}
                      style={[styles.timeBox, { backgroundColor: colors.card, borderColor: activityColor(t.activity) + "50" }]}
                    >
                      <View style={[styles.activityDot, { backgroundColor: activityColor(t.activity) }]} />
                      <Text style={[styles.timePeriod, { color: colors.foreground }]}>{t.period}</Text>
                      <Text style={[styles.timeActivity, { color: activityColor(t.activity) }]}>
                        {t.activity.toUpperCase()}
                      </Text>
                      {t.notes ? (
                        <Text style={[styles.timeNotes, { color: colors.mutedForeground }]} numberOfLines={2}>
                          {t.notes}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Hot Locations */}
            {insights.hotLocations?.filter(Boolean).length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>ACTIVE LOCATIONS</Text>
                <View style={styles.locWrap}>
                  {insights.hotLocations.filter(Boolean).map((loc, i) => (
                    <View key={i} style={[styles.locChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Feather name="map-pin" size={11} color={C.gold} />
                      <Text style={[styles.locText, { color: colors.foreground }]}>{loc}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* AI Tips */}
            {insights.tips?.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>AI TIPS FROM THE DATA</Text>
                {insights.tips.map((tip, i) => (
                  <View key={i} style={[styles.tipBox, { backgroundColor: colors.card, borderColor: C.gold + "30" }]}>
                    <View style={[styles.tipNum, { backgroundColor: C.gold + "20" }]}>
                      <Text style={[styles.tipNumText, { color: C.gold }]}>{i + 1}</Text>
                    </View>
                    <Text style={[styles.tipText, { color: colors.foreground }]}>{tip}</Text>
                  </View>
                ))}
              </View>
            )}

            <Text style={[styles.footNote, { color: colors.mutedForeground }]}>
              🔒 No names, devices or locations are stored.{"\n"}
              Only fishing data: species · depth · fish count · lure.{"\n"}
              AI analysis refreshes every 6 hours.
            </Text>
          </>
        ) : null}

        {/* ── BRAIN VIDEO LIBRARY ──────────────────────────────────────── */}
        <View style={[styles.videoLibCard, { backgroundColor: colors.card, borderColor: "#7c5cfc40" }]}>
          {/* Header */}
          <View style={styles.videoLibHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
              <MaterialCommunityIcons name="brain" size={20} color="#7c5cfc" />
              <View>
                <Text style={[styles.videoLibTitle, { color: colors.foreground }]}>BRAIN LIBRARY</Text>
                <Text style={[styles.videoLibSub, { color: colors.mutedForeground }]}>
                  Add fishing videos · CV engine learns from every frame
                </Text>
              </View>
            </View>
            <View style={[styles.cvBadge, { borderColor: "#7c5cfc40", backgroundColor: "#7c5cfc12" }]}>
              <Text style={[styles.cvBadgeText, { color: "#7c5cfc" }]}>CV + AI</Text>
            </View>
          </View>

          {/* Upload status / progress */}
          {uploadStatus && (
            <View style={[styles.uploadStatus, { backgroundColor: "#7c5cfc15", borderColor: "#7c5cfc40" }]}>
              <ActivityIndicator size="small" color="#7c5cfc" />
              <Text style={[styles.uploadStatusText, { color: "#7c5cfc" }]}>{uploadStatus}</Text>
            </View>
          )}

          {/* Add video button */}
          <TouchableOpacity
            style={[styles.addVideoBtn, {
              backgroundColor: uploadingVideo ? "#7c5cfc30" : "#7c5cfc",
              opacity: uploadingVideo ? 0.6 : 1,
            }]}
            onPress={pickAndUploadVideo}
            disabled={uploadingVideo}
            activeOpacity={0.8}
          >
            {uploadingVideo
              ? <ActivityIndicator size="small" color="#fff" />
              : <Feather name="film" size={16} color="#fff" />
            }
            <Text style={styles.addVideoBtnText}>
              {uploadingVideo ? "Processing…" : "Add Video to Brain"}
            </Text>
          </TouchableOpacity>

          {/* Video library list */}
          {videoLibrary.length === 0 && !uploadingVideo ? (
            <Text style={[styles.videoEmptyText, { color: colors.mutedForeground }]}>
              No videos yet. Add a fishing video — the CV engine will extract every frame, measure sonar signatures with TF.js + OpenCV, and feed the intelligence into the brain.
            </Text>
          ) : (
            videoLibrary.map((v) => {
              const isExpanded = expandedVideoId === v.id;
              const statusColor =
                v.status === "done"       ? C.teal :
                v.status === "processing" ? "#ffd700" :
                v.status === "failed"     ? "#ff4444" : colors.mutedForeground;
              const statusLabel =
                v.status === "done"       ? "ANALYSED" :
                v.status === "processing" ? "ANALYSING…" :
                v.status === "failed"     ? "FAILED" : "QUEUED";

              return (
                <TouchableOpacity
                  key={v.id}
                  style={[styles.videoRow, {
                    backgroundColor: isExpanded ? "#7c5cfc08" : "transparent",
                    borderColor: isExpanded ? "#7c5cfc50" : colors.border,
                  }]}
                  onPress={() => handleVideoTap(v, isExpanded)}
                  activeOpacity={0.8}
                >
                  {/* Collapsed header */}
                  <View style={styles.videoRowTop}>
                    <Feather name="film" size={14} color="#7c5cfc" style={{ marginTop: 1 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.videoTitle, { color: colors.foreground }]} numberOfLines={1}>
                        {v.title}
                      </Text>
                      <Text style={[styles.videoMeta, { color: colors.mutedForeground }]}>
                        {v.frameCount} frames
                        {v.durationSecs ? ` · ${v.durationSecs}s` : ""}
                        {v.processedAt ? ` · ${feedTimeAgo(v.processedAt)}` : ""}
                      </Text>
                    </View>
                    <View style={[styles.videoStatus, { borderColor: statusColor + "60", backgroundColor: statusColor + "15" }]}>
                      {v.status === "processing" && <ActivityIndicator size="small" color={statusColor} style={{ marginRight: 4 }} />}
                      <Text style={[styles.videoStatusText, { color: statusColor }]}>{statusLabel}</Text>
                    </View>
                    {hasHandyVisual(v) && (
                      <View style={styles.snapReadyBadge}>
                        <MaterialCommunityIcons name="brain" size={9} color="#7c5cfc" />
                        <Text style={styles.snapReadyText}>SNAP</Text>
                      </View>
                    )}
                    <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={14} color={colors.mutedForeground} />
                  </View>

                  {/* Expanded panel — brain results */}
                  {isExpanded && v.status === "done" && (
                    <View style={styles.videoExpanded}>
                      {/* CV stats */}
                      {v.cvSummary && (
                        <View style={[styles.cvStatsRow, { backgroundColor: "#00a8ff08" }]}>
                          <Text style={[styles.cvStatLabel, { color: colors.mutedForeground }]}>
                            {(v.cvSummary as any).framesAnalysed ?? 0} frames · brightness {(v.cvSummary as any).avgBrightness ?? "?"}/255 · {(v.cvSummary as any).totalBlobsDetected ?? 0} arch blobs
                          </Text>
                        </View>
                      )}

                      {/* Brain insight */}
                      {v.brainInsight ? (
                        <View style={[styles.insightBox, { backgroundColor: "#7c5cfc10", borderColor: "#7c5cfc30" }]}>
                          <MaterialCommunityIcons name="brain" size={13} color="#7c5cfc" />
                          <Text style={[styles.insightText, { color: colors.foreground }]}>{v.brainInsight}</Text>
                        </View>
                      ) : null}

                      {/* Species detected */}
                      {v.detectedSpecies && v.detectedSpecies.length > 0 && (
                        <View style={styles.chipRow}>
                          <Text style={[styles.chipRowLabel, { color: colors.mutedForeground }]}>SPECIES</Text>
                          {v.detectedSpecies.map((s, i) => (
                            <View key={i} style={[styles.chip, { borderColor: C.teal + "50", backgroundColor: C.teal + "15" }]}>
                              <MaterialCommunityIcons name="fish" size={10} color={C.teal} />
                              <Text style={[styles.chipText, { color: C.teal }]}>{s}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* Depth ranges */}
                      {v.depthRanges && v.depthRanges.length > 0 && (
                        <View style={styles.chipRow}>
                          <Text style={[styles.chipRowLabel, { color: colors.mutedForeground }]}>DEPTHS</Text>
                          {v.depthRanges.map((d, i) => (
                            <View key={i} style={[styles.chip, { borderColor: C.blue + "50", backgroundColor: C.blue + "15" }]}>
                              <Text style={[styles.chipText, { color: C.blue }]}>{d}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* AI tips */}
                      {v.aiTips && v.aiTips.length > 0 && (
                        <View style={{ gap: 5, marginTop: 4 }}>
                          <Text style={[styles.chipRowLabel, { color: colors.mutedForeground }]}>AI TIPS</Text>
                          {v.aiTips.map((tip, i) => (
                            <View key={i} style={[styles.videoTipRow, { borderColor: C.gold + "30", backgroundColor: C.gold + "08" }]}>
                              <Text style={[styles.videoTipNum, { color: C.gold }]}>{i + 1}</Text>
                              <Text style={[styles.videoTipText, { color: colors.foreground }]}>{tip}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  )}

                  {isExpanded && v.status === "processing" && (
                    <View style={styles.videoProcessing}>
                      <ActivityIndicator color="#ffd700" />
                      <Text style={[styles.videoProcessingText, { color: colors.mutedForeground }]}>
                        TF.js + OpenCV analysing {v.frameCount} frames… GPT-4.1 synthesising intelligence…
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>

      </ScrollView>

      {/* ── Brain Snapshot Modal ──────────────────────────────────────────── */}
      <Modal
        visible={!!snapshotVideo}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={closeSnapshot}
      >
        {snapshotVideo && (() => {
          const cv = (snapshotVideo.cvSummary ?? {}) as Record<string, number | string>;
          const brightPct   = Number(cv.avgBrightPct   ?? 0);
          const blobs       = Number(cv.totalBlobsDetected ?? 0);
          const brightness  = Number(cv.avgBrightness  ?? 0);
          const echoLabel   = brightPct > 30 ? "STRONG" : brightPct > 15 ? "MODERATE" : "LOW";
          const echoColor   = brightPct > 30 ? C.teal : brightPct > 15 ? C.gold : C.blue;
          const screenH     = Dimensions.get("window").height;

          return (
            <View style={styles.snapOverlay}>
              <TouchableOpacity style={styles.snapDismissArea} activeOpacity={1} onPress={closeSnapshot} />
              <View style={[styles.snapPanel, { height: screenH * 0.5, backgroundColor: "#07111f" }]}>

                {/* Header row */}
                <View style={styles.snapHeader}>
                  <View style={styles.snapHeaderLeft}>
                    <MaterialCommunityIcons name="brain" size={16} color="#7c5cfc" />
                    <Text style={styles.snapHeaderTitle}>BRAIN SNAPSHOT</Text>
                    <View style={[styles.snapCountBadge, { backgroundColor: "#7c5cfc30", borderColor: "#7c5cfc60" }]}>
                      <Text style={[styles.snapCountText, { color: "#7c5cfc" }]}>{snapshotCountdown}s</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={closeSnapshot} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Feather name="x" size={18} color="#888" />
                  </TouchableOpacity>
                </View>

                {/* Video title */}
                <Text style={styles.snapVideoTitle} numberOfLines={1}>{snapshotVideo.title}</Text>

                {/* Echo strength meter */}
                <View style={styles.snapMeterRow}>
                  <Text style={styles.snapMeterLabel}>ECHO STRENGTH</Text>
                  <View style={[styles.snapMeterTrack, { backgroundColor: "#ffffff10" }]}>
                    <View style={[styles.snapMeterFill, {
                      width: `${Math.min(100, brightPct * 2.5)}%` as any,
                      backgroundColor: echoColor,
                    }]} />
                  </View>
                  <Text style={[styles.snapMeterValue, { color: echoColor }]}>{echoLabel}</Text>
                </View>

                {/* Stats row */}
                <View style={styles.snapStatsRow}>
                  <View style={styles.snapStat}>
                    <Text style={styles.snapStatNum}>{blobs}</Text>
                    <Text style={styles.snapStatLabel}>ARCH BLOBS</Text>
                  </View>
                  <View style={[styles.snapStatDivider]} />
                  <View style={styles.snapStat}>
                    <Text style={styles.snapStatNum}>{brightness.toFixed(0)}</Text>
                    <Text style={styles.snapStatLabel}>BRIGHTNESS</Text>
                  </View>
                  <View style={[styles.snapStatDivider]} />
                  <View style={styles.snapStat}>
                    <Text style={styles.snapStatNum}>{snapshotVideo.frameCount}</Text>
                    <Text style={styles.snapStatLabel}>FRAMES</Text>
                  </View>
                </View>

                {/* Species chips */}
                {snapshotVideo.detectedSpecies && snapshotVideo.detectedSpecies.length > 0 && (
                  <View style={styles.snapChipRow}>
                    {snapshotVideo.detectedSpecies.slice(0, 3).map((s, i) => (
                      <View key={i} style={[styles.snapChip, { borderColor: C.teal + "50", backgroundColor: C.teal + "18" }]}>
                        <MaterialCommunityIcons name="fish" size={10} color={C.teal} />
                        <Text style={[styles.snapChipText, { color: C.teal }]}>{s}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Top AI tip + Watch button row */}
                <View style={{ flexDirection: "row", gap: 8, alignItems: "stretch" }}>
                  {snapshotVideo.aiTips && snapshotVideo.aiTips[0] && (
                    <View style={[styles.snapTipBox, { borderColor: C.gold + "30", backgroundColor: C.gold + "0a" }]}>
                      <Text style={[styles.snapTipLabel, { color: C.gold }]}>🎣 TOP TIP</Text>
                      <Text style={styles.snapTipText} numberOfLines={3}>{snapshotVideo.aiTips[0]}</Text>
                    </View>
                  )}
                  {snapshotVideo.videoUri && (
                    <TouchableOpacity
                      style={styles.snapWatchBtn}
                      activeOpacity={0.75}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        Linking.openURL(snapshotVideo!.videoUri!).catch(() =>
                          Alert.alert("Can't open", "The video file could not be found on this device.")
                        );
                      }}
                    >
                      <Feather name="play-circle" size={22} color="#fff" />
                      <Text style={styles.snapWatchText}>WATCH</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Countdown progress bar */}
                <View style={styles.snapBarTrack}>
                  <Animated.View style={[styles.snapBarFill, {
                    width: snapshotProgress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
                    backgroundColor: "#7c5cfc",
                  }]} />
                </View>
              </View>
            </View>
          );
        })()}
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "column",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 4,
    gap: 6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 4,
  },
  privacyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  privacyText: { fontSize: 10, fontFamily: "Inter_500Medium" },
  refreshBtn:  { padding: 6 },

  scroll: { paddingHorizontal: 16, paddingTop: 8 },

  center: { alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 60 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 8 },
  errorText:   { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  retryBtn:    { borderWidth: 1, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 24, marginTop: 8 },
  retryLabel:  { fontSize: 14, fontFamily: "Inter_500Medium" },

  // ── Live feed ──────────────────────────────────────────────────────────────
  feedCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  feedHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  liveRow:    { flexDirection: "row", alignItems: "center", gap: 8 },
  livePulse:  { width: 8, height: 8, borderRadius: 4, backgroundColor: C.teal },
  feedTitle:  { fontSize: 12, fontFamily: "Inter_700Bold" ?? "Inter_600SemiBold", letterSpacing: 1.2 },
  feedTotal:  { fontSize: 11, fontFamily: "Inter_400Regular" },
  feedEmpty:  { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", paddingVertical: 8 },
  feedRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 8,
  },
  feedSpecies:  { fontSize: 13, fontFamily: "Inter_500Medium" },
  feedLocation: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  feedTime:     { fontSize: 11, fontFamily: "Inter_400Regular", flexShrink: 0 },
  pollNote:     { fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 4 },

  // ── Summary card ──────────────────────────────────────────────────────────
  card: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 16, gap: 10 },
  brainRow:  { flexDirection: "row", alignItems: "center", gap: 10 },
  brainTitle: { fontSize: 15, fontFamily: "Oswald_700Bold", letterSpacing: 0.5 },
  brainSub:   { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  sixhBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
  },
  sixhText: { fontSize: 10, fontFamily: "Inter_500Medium" },
  summary:  { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },

  // ── Sections ───────────────────────────────────────────────────────────────
  section:      { marginBottom: 18, gap: 7 },
  sectionTitle: {
    fontSize: 10, fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 1,
  },
  rowCard:  { flexDirection: "row", alignItems: "center", gap: 9, borderRadius: 10, borderWidth: 1, padding: 11 },
  rowTitle: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  rowNotes: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 7 },
  rowCount: { fontSize: 11, fontFamily: "Inter_400Regular" },

  // ── Expandable species cards ──────────────────────────────────────────────
  speciesRow: {
    flexDirection: "row", alignItems: "center", gap: 9,
    padding: 11,
  },
  speciesExpanded: { borderTopWidth: 1, borderTopColor: "#00d4aa30" },
  speciesSonar: { width: "100%", height: 160 },
  speciesExpandBody: { padding: 12, gap: 10 },
  speciesExpandLabel: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  analyseBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 7, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 18,
  },
  analyseBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#0a1628" },

  timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  timeBox:  { width: "47%", borderRadius: 10, borderWidth: 1, padding: 11, gap: 3, alignItems: "flex-start" },
  activityDot: { width: 7, height: 7, borderRadius: 3.5, marginBottom: 2 },
  timePeriod:  { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  timeActivity: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },
  timeNotes:   { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 15, marginTop: 2 },

  locWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  locChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 20, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 5,
  },
  locText: { fontSize: 12, fontFamily: "Inter_400Regular" },

  tipBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 10, borderWidth: 1, padding: 11 },
  tipNum: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  tipNumText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  tipText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },

  footNote: {
    fontSize: 11, fontFamily: "Inter_400Regular",
    textAlign: "center", lineHeight: 17,
    marginTop: 4, marginBottom: 8, paddingHorizontal: 16,
  },

  // ── Firing alert banner ──────────────────────────────────────────────────
  alertBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#ff440018",
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#ff440060",
    paddingHorizontal: 16, paddingVertical: 10,
  },
  alertFire:    { fontSize: 22 },
  alertTitle:   { fontSize: 10, fontFamily: "Inter_700Bold", color: "#ff6600", letterSpacing: 1.2 },
  alertBody:    { fontSize: 12, fontFamily: "Inter_500Medium", color: "#ff9900", marginTop: 1 },
  alertDismiss: { padding: 4 },

  // ── BEST GO'S hotspot card ───────────────────────────────────────────────
  hotspotCard: {
    borderRadius: 14, borderWidth: 1,
    padding: 14, marginBottom: 16, gap: 10,
  },
  hotspotHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  hotspotTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  hotspotFire:   { fontSize: 26 },
  hotspotTitle:  { fontSize: 16, fontFamily: "Oswald_700Bold", letterSpacing: 0.5 },
  hotspotSub:    { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  mapBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4,
  },
  mapBtnText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.8 },

  livePill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderWidth: 1, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4,
  },
  liveDot:      { width: 7, height: 7, borderRadius: 3.5 },
  livePillText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.8 },

  spotRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 10, borderWidth: 1, padding: 10,
  },
  spotRank: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  spotRankText:  { fontSize: 12, fontFamily: "Inter_700Bold" },
  spotName:      { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  spotDetail:    { fontSize: 11, fontFamily: "Inter_400Regular" },
  heatBadge: {
    alignItems: "center", borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 5, gap: 1, flexShrink: 0,
  },
  heatBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  spotScans:     { fontSize: 9, fontFamily: "Inter_400Regular" },

  // ── Brain Video Library ────────────────────────────────────────────────────
  videoLibCard: {
    borderRadius: 14, borderWidth: 1,
    padding: 14, marginBottom: 16, gap: 12,
  },
  videoLibHeader: {
    flexDirection: "row", alignItems: "center", gap: 10,
  },
  videoLibTitle: {
    fontSize: 13, fontFamily: "Oswald_700Bold", letterSpacing: 0.8,
  },
  videoLibSub: {
    fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 1,
  },
  cvBadge: {
    borderWidth: 1, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  cvBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 1 },

  uploadStatus: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 10, borderWidth: 1, padding: 10,
  },
  uploadStatusText: { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },

  addVideoBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 12, borderRadius: 24,
  },
  addVideoBtnText: {
    fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff",
  },

  videoEmptyText: {
    fontSize: 12, fontFamily: "Inter_400Regular",
    lineHeight: 18, textAlign: "center", paddingVertical: 4,
  },

  videoRow: {
    borderRadius: 10, borderWidth: 1,
    padding: 11, gap: 0,
  },
  videoRowTop: {
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  videoTitle: { fontSize: 13, fontFamily: "Inter_500Medium" },
  videoMeta:  { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 1 },
  videoStatus: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 3, flexShrink: 0,
  },
  videoStatusText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },

  videoExpanded: { marginTop: 12, gap: 8 },
  cvStatsRow: { borderRadius: 8, padding: 8 },
  cvStatLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },

  insightBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    borderWidth: 1, borderRadius: 8, padding: 10,
  },
  insightText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, alignItems: "center" },
  chipRowLabel: { fontSize: 8, fontFamily: "Inter_700Bold", letterSpacing: 1, marginRight: 2 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3,
  },
  chipText: { fontSize: 11, fontFamily: "Inter_500Medium" },

  videoTipRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    borderWidth: 1, borderRadius: 8, padding: 8,
  },
  videoTipNum: { fontSize: 11, fontFamily: "Inter_700Bold", marginTop: 1, width: 14 },
  videoTipText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },

  videoProcessing: {
    flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10,
  },
  videoProcessingText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },

  snapReadyBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    borderWidth: 1, borderRadius: 8,
    borderColor: "#7c5cfc70", backgroundColor: "#7c5cfc20",
    paddingHorizontal: 6, paddingVertical: 3,
  },
  snapReadyText: {
    fontSize: 8, fontFamily: "Inter_700Bold",
    letterSpacing: 1, color: "#7c5cfc",
  },

  // ── Brain Snapshot Modal ────────────────────────────────────────────────────
  snapOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  snapDismissArea: { flex: 1 },
  snapPanel: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    gap: 12,
    borderTopWidth: 1,
    borderColor: "#7c5cfc40",
    overflow: "hidden",
  },
  snapHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  snapHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  snapHeaderTitle: {
    fontSize: 11, fontFamily: "Inter_700Bold",
    letterSpacing: 1.5, color: "#7c5cfc",
  },
  snapCountBadge: {
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  snapCountText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  snapVideoTitle: {
    fontSize: 14, fontFamily: "Oswald_700Bold",
    color: "#e0e8f5", letterSpacing: 0.3,
  },
  snapMeterRow: { gap: 5 },
  snapMeterLabel: {
    fontSize: 9, fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2, color: "#667788",
  },
  snapMeterTrack: {
    height: 8, borderRadius: 4, overflow: "hidden",
  },
  snapMeterFill: { height: 8, borderRadius: 4 },
  snapMeterValue: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },
  snapStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff06",
    borderRadius: 12,
    paddingVertical: 12,
  },
  snapStat: { flex: 1, alignItems: "center", gap: 2 },
  snapStatNum: {
    fontSize: 24, fontFamily: "Oswald_700Bold", color: "#e0e8f5",
  },
  snapStatLabel: {
    fontSize: 8, fontFamily: "Inter_600SemiBold",
    letterSpacing: 1, color: "#667788",
  },
  snapStatDivider: { width: 1, height: 32, backgroundColor: "#ffffff15" },
  snapChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  snapChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4,
  },
  snapChipText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  snapTipBox: {
    borderWidth: 1, borderRadius: 10, padding: 10, gap: 4, flex: 1,
  },
  snapTipLabel: {
    fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 1.2,
  },
  snapTipText: {
    fontSize: 12, fontFamily: "Inter_400Regular",
    lineHeight: 17, color: "#c0cce0",
  },
  snapBarTrack: {
    height: 3, borderRadius: 2,
    backgroundColor: "#ffffff10",
    overflow: "hidden",
    marginTop: "auto" as any,
  },
  snapBarFill: { height: 3, borderRadius: 2 },

  snapWatchBtn: {
    alignItems: "center", justifyContent: "center",
    gap: 6, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: "#7c5cfc",
    flexShrink: 0,
  },
  snapWatchText: {
    fontSize: 9, fontFamily: "Inter_700Bold",
    letterSpacing: 1.2, color: "#fff",
  },
});
