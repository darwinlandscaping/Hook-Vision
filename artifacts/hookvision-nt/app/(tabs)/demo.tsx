import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";

import { HVHeader } from "@/components/HVHeader";
import { useColors } from "@/hooks/useColors";
import { useAutoNarrate } from "@/hooks/useAutoNarrate";
import { BoatDemoStore } from "@/stores/BoatDemoStore";

// ─── Local bundled sonar images (demos 1–5, always available, no network) ─────
const LOCAL_DEMO_IMAGES: Partial<Record<number, any>> = {
  1: require("../../assets/sonar-demo-1.png"),
  2: require("../../assets/sonar-demo-2.png"),
  3: require("../../assets/sonar-demo-3.png"),
  4: require("../../assets/sonar-demo-4.png"),
  5: require("../../assets/images/sonar-sample.png"),
};
type DemoNum = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

const DEMOS = [
  {
    num: 1 as DemoNum,
    brand: "Lowrance",
    model: "HDS Live",
    desc: "3 barramundi marks at 5.2m — classic barra arch signatures on a Lowrance HDS Live unit.",
    tags: ["Barra", "3 fish", "5.2m"],
    accent: "#00d4aa",
  },
  {
    num: 2 as DemoNum,
    brand: "Garmin",
    model: "ECHOMAP UHD",
    desc: "School of fish at 3.1m — mid-water column aggregation typical of threadfin bream on Garmin.",
    tags: ["School", "Threadfin", "3.1m"],
    accent: "#00a8ff",
  },
  {
    num: 3 as DemoNum,
    brand: "Humminbird",
    model: "HELIX 10",
    desc: "Clean arch at 8m over hard rocky reef — classic fingermark (golden snapper) feeding posture above the rubble.",
    tags: ["Fingermark", "Goldies", "8m"],
    accent: "#ffd700",
  },
  {
    num: 4 as DemoNum,
    brand: "Simrad",
    model: "GO9 XSE",
    desc: "Dual-layer suspension at 7m — two distinct species at separate depths on a Simrad unit.",
    tags: ["Dual layer", "Multi-species", "7m"],
    accent: "#ff7043",
  },
  {
    num: 5 as DemoNum,
    brand: "Lowrance",
    model: "Elite FS 9",
    desc: "Kakadu Jim Jim Billabong — dense barra school locked at 3-5m on a submerged rock shelf. Saratoga surface arches visible at 1m and Archer Fish scatter at 0.5m as an early-warning feeding signal.",
    tags: ["Kakadu", "Barra school", "3-5m", "Saratoga"],
    accent: "#aaff00",
  },
  {
    num: 6 as DemoNum,
    brand: "Humminbird",
    model: "MEGA Live 2",
    desc: "Live sonar reference — Humminbird MEGA Live 2. Fish appear as bright oval bodies with dark acoustic shadows. TargetBoost highlights targets with crisp white-orange edges against dimmed structure.",
    tags: ["Live Sonar", "MEGA Live 2", "Body shapes", "Shadow"],
    accent: "#ff8800",
  },
  {
    num: 7 as DemoNum,
    brand: "Lowrance",
    model: "ActiveTarget",
    desc: "Lowrance ActiveTarget streaming display — fish visible as oval blobs with trailing acoustic shadows on dark navy background. Scout mode shows 180° wide forward sweep.",
    tags: ["Live Sonar", "ActiveTarget", "Scout mode", "Shadow"],
    accent: "#00a8ff",
  },
  {
    num: 8 as DemoNum,
    brand: "Lowrance",
    model: "ActiveTarget",
    desc: "ActiveTarget live sonar — body shape comparison. Large elongated ovals near structure = barra. Multiple slim bodies mid-column = threadfin. Very large blob near surface = croc.",
    tags: ["Live Sonar", "Barra", "Threadfin", "Croc"],
    accent: "#00d4aa",
  },
  {
    num: 9 as DemoNum,
    brand: "Lowrance",
    model: "ActiveTarget Close-up",
    desc: "ActiveTarget close-up — individual fish bodies and shadow voids. Barramundi: torpedo shape 4× length vs height, long shadow equal to body length, stationary near structure.",
    tags: ["Live Sonar", "Close-up", "Shadow void", "Barra shape"],
    accent: "#7c5cfc",
  },
];

export default function DemoScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [loadingNum, setLoadingNum] = useState<DemoNum | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const [livePulse,   setLivePulse]   = useState(true);

  useAutoNarrate(() => "Demo Sonar Scans. Nine sonar screenshots including Kakadu Jim Jim Billabong barra and live sonar references. Tap any card to run instant AI analysis.");

  const topPad = Platform.OS === "web" ? 0 : insets.top;

  // Base URL for API-served demo images (demos 6–9 are JPEG, served from API)
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const apiBase = domain ? `https://${domain}` : "";

  // Pulse the LIVE badge
  useEffect(() => {
    const t = setInterval(() => setLivePulse(p => !p), 700);
    return () => clearInterval(t);
  }, []);

  // Load all 4 live-sonar frames → store → navigate to Live tab (boat mode auto-starts)
  const startDemoBoatMode = useCallback(async () => {
    if (demoLoading) return;
    try {
      setDemoLoading(true);
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      const demoNums: DemoNum[] = [1, 2, 3, 4, 5];
      const frames: { base64: string; uri: string }[] = [];
      for (const num of demoNums) {
        try {
          if (Platform.OS === "web") {
            const fname = num === 5 ? "sonar-sample.png" : `sonar-demo-${num}.png`;
            const apiUrl = `${apiBase}/api/demos/${fname}`;
            const resp = await fetch(apiUrl);
            if (!resp.ok) continue;
            const blob = await resp.blob();
            const b64 = await new Promise<string>((res, rej) => {
              const fr = new FileReader();
              fr.onload = () => res((fr.result as string).split(",")[1]);
              fr.onerror = rej;
              fr.readAsDataURL(blob);
            });
            frames.push({ base64: b64, uri: apiUrl });
          } else {
            const asset = Asset.fromModule(LOCAL_DEMO_IMAGES[num]!);
            await asset.downloadAsync();
            const localUri = asset.localUri;
            if (!localUri) continue;
            const b64 = await FileSystem.readAsStringAsync(localUri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            frames.push({ base64: b64, uri: localUri });
          }
        } catch { /* skip failed frame */ }
      }
      if (frames.length === 0) {
        Alert.alert("Error", "Could not load demo sonar images.");
        return;
      }
      BoatDemoStore.setFrames(frames);
      router.navigate("/(tabs)/live" as any);
    } catch {
      Alert.alert("Error", "Could not start demo.");
    } finally {
      setDemoLoading(false);
    }
  }, [apiBase, demoLoading]);

  const loadAndAnalyze = useCallback(async (num: DemoNum) => {
    try {
      setLoadingNum(num);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      let base64: string;
      let pendingUri: string;

      const isApiDemo = num >= 6;
      const ext = isApiDemo ? "jpg" : "png";
      const apiUrl = `${apiBase}/api/demos/sonar-demo-${num}.${ext}`;

      if (Platform.OS === "web") {
        // Web: always fetch from API (FileSystem not available on web)
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error("Failed to load demo");
        const blob = await response.blob();
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        pendingUri = apiUrl;
      } else if (!isApiDemo) {
        // Native demos 1–5: read from bundled local asset — no network needed
        const asset = Asset.fromModule(LOCAL_DEMO_IMAGES[num]!);
        await asset.downloadAsync();
        const localUri = asset.localUri;
        if (!localUri) throw new Error("Asset unavailable");
        base64 = await FileSystem.readAsStringAsync(localUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        pendingUri = localUri;
      } else {
        // Native demos 6–9: download JPEG from API to device cache
        const cacheUri = `${FileSystem.cacheDirectory}demo-${num}.${ext}`;
        const dl = await FileSystem.downloadAsync(apiUrl, cacheUri);
        if (dl.status !== 200) throw new Error("Download failed");
        base64 = await FileSystem.readAsStringAsync(dl.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        pendingUri = dl.uri;
      }

      DemoStore.pendingUri = pendingUri;
      DemoStore.pendingBase64 = base64;
      router.navigate("/(tabs)/" as any);
    } catch {
      Alert.alert("Error", "Could not load demo image.");
    } finally {
      setLoadingNum(null);
    }
  }, [apiBase]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingTop: topPad + 12,
        paddingBottom: Platform.OS === "web" ? 72 : insets.bottom + 24,
        paddingHorizontal: 14,
        gap: 14,
      }}
      showsVerticalScrollIndicator={false}
    >
      <HVHeader subtitle="Demo Sonar Scans" />

      <Text style={[styles.intro, { color: colors.mutedForeground }]}>
        Try the AI analysis on real sonar screenshots from popular fish finders. Tap any scan to load it into the Analyze tab.
      </Text>

      {/* ─── LIVE BOAT MODE DEMO ──────────────────────────────────────────── */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: "#00ff8844" }]}>
        <View style={[styles.strip, { backgroundColor: "#00ff88" }]} />
        <View style={styles.imageWrap}>
          <Image
            source={LOCAL_DEMO_IMAGES[5]}
            style={styles.image}
            resizeMode="cover"
          />
          <View style={[styles.brandBadge, { backgroundColor: colors.background + "ee" }]}>
            <Text style={[styles.brandText, { color: "#00ff88" }]}>Barra Sonar</Text>
            <Text style={[styles.modelText, { color: colors.mutedForeground }]}>
              Lowrance · Humminbird · Simrad
            </Text>
          </View>
          <View style={{
            position: "absolute", top: 10, right: 10,
            flexDirection: "row", alignItems: "center", gap: 5,
            backgroundColor: "#0a162888", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
          }}>
            <View style={{
              width: 7, height: 7, borderRadius: 4,
              backgroundColor: "#00ff88", opacity: livePulse ? 1 : 0.25,
            }} />
            <Text style={{ color: "#00ff88", fontSize: 11, fontFamily: "Inter_700Bold" }}>LIVE DEMO</Text>
          </View>
        </View>
        <View style={styles.body}>
          <Text style={[styles.desc, { color: colors.foreground }]}>
            Practice the full boat mode AI pipeline without being on the water. Plays 5 real barra sonar frames (Kimberley, Lowrance, Humminbird) as an animated ~20-second live feed — identical detection pipeline to real boat mode.
          </Text>
          <View style={styles.tags}>
            {["Boat Mode", "5 Barra Frames", "~20s Animated Feed", "Full Analysis"].map(t => (
              <View key={t} style={[styles.tag, { backgroundColor: "#00ff8822" }]}>
                <Text style={[styles.tagText, { color: "#00ff88" }]}>{t}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.analyzeBtn, { backgroundColor: demoLoading ? "#00ff8866" : "#00ff88" }]}
            onPress={startDemoBoatMode}
            activeOpacity={0.85}
            disabled={demoLoading || loadingNum !== null}
          >
            {demoLoading ? (
              <ActivityIndicator size="small" color="#0a1628" />
            ) : (
              <>
                <Feather name="radio" size={16} color="#0a1628" />
                <Text style={styles.analyzeBtnText}>Start Demo Boat Analysis</Text>
                <Feather name="arrow-right" size={14} color="#0a1628" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {DEMOS.map((d) => {
        const isLoading = loadingNum === d.num;

        return (
          <View
            key={d.num}
            style={[styles.card, { backgroundColor: colors.card, borderColor: d.accent + "55" }]}
          >
            {/* Coloured top strip */}
            <View style={[styles.strip, { backgroundColor: d.accent }]} />

            {/* Image — local bundle for demos 1–5, API URI for demos 6–9 */}
            <View style={styles.imageWrap}>
              <Image
                source={
                  d.num <= 5
                    ? LOCAL_DEMO_IMAGES[d.num]
                    : { uri: `${apiBase}/api/demos/sonar-demo-${d.num}.jpg` }
                }
                style={styles.image}
                resizeMode="cover"
              />
              {/* Brand badge */}
              <View style={[styles.brandBadge, { backgroundColor: colors.background + "ee" }]}>
                <Text style={[styles.brandText, { color: d.accent }]}>{d.brand}</Text>
                <Text style={[styles.modelText, { color: colors.mutedForeground }]}>{d.model}</Text>
              </View>
            </View>

            {/* Body */}
            <View style={styles.body}>
              <Text style={[styles.desc, { color: colors.foreground }]}>{d.desc}</Text>

              {/* Tags */}
              <View style={styles.tags}>
                {d.tags.map((t) => (
                  <View key={t} style={[styles.tag, { backgroundColor: d.accent + "22" }]}>
                    <Text style={[styles.tagText, { color: d.accent }]}>{t}</Text>
                  </View>
                ))}
              </View>

              {/* Analyse button */}
              <TouchableOpacity
                style={[styles.analyzeBtn, { backgroundColor: d.accent }]}
                onPress={() => loadAndAnalyze(d.num)}
                activeOpacity={0.85}
                disabled={loadingNum !== null}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#0a1628" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="fish" size={16} color="#0a1628" />
                    <Text style={styles.analyzeBtnText}>Analyse This Scan</Text>
                    <Feather name="arrow-right" size={14} color="#0a1628" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

// Tiny store so the Analyze tab can receive the pre-loaded demo image
export const DemoStore: { pendingUri: string | null; pendingBase64: string | null } = {
  pendingUri: null,
  pendingBase64: null,
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  intro: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  strip: { height: 4 },
  imageWrap: {
    position: "relative",
  },
  image: {
    width: "100%",
    height: 160,
  },
  brandBadge: {
    position: "absolute",
    bottom: 8,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  brandText: {
    fontSize: 13,
    fontFamily: "Oswald_700Bold",
    letterSpacing: 0.5,
  },
  modelText: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  body: {
    padding: 14,
    gap: 10,
  },
  desc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  analyzeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 11,
    borderRadius: 24,
    marginTop: 2,
  },
  analyzeBtnText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#0a1628",
  },
});
