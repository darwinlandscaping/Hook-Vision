import { useKeepAwake } from "expo-keep-awake";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { OfflineBanner } from "@/components/OfflineBanner";
import { useSettings } from "@/contexts/SettingsContext";
import { useAudioAlert } from "@/hooks/useAudioAlert";
import { useCrocGuardStatus } from "@/hooks/useCrocGuardStatus";
import type { TrafficLight } from "@/hooks/useCrocGuardStatus";

const STATUS_CONFIG: Record<
  TrafficLight,
  { bg: string; light: string; label: string; sub: string; emoji: string }
> = {
  green: {
    bg: "#052e16",
    light: "#22c55e",
    label: "CLEAR",
    sub: "No crocodile activity detected",
    emoji: "🟢",
  },
  orange: {
    bg: "#431407",
    light: "#f97316",
    label: "MOVEMENT DETECTED",
    sub: "Possible crocodile activity — remain alert",
    emoji: "🟠",
  },
  red: {
    bg: "#450a0a",
    light: "#ef4444",
    label: "CROC CONFIRMED",
    sub: "Crocodile confirmed — stay out of water",
    emoji: "🔴",
  },
};

function formatTime(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function StatusScreen() {
  useKeepAwake();

  const { settings } = useSettings();
  const { data, isOffline, lastUpdated, prevStatus } = useCrocGuardStatus(
    settings.apiBaseUrl
  );
  useAudioAlert(data?.status, prevStatus, settings.audioEnabled);

  const status = data?.status ?? "green";
  const cfg = STATUS_CONFIG[status];

  // Pulse animation for orange/red
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (status === "green") {
      pulse.setValue(1);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.12,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [status, pulse]);

  return (
    <View style={[styles.root, { backgroundColor: cfg.bg }]}>
      <OfflineBanner visible={isOffline} />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.appTitle}>🐊 CrocGuard</Text>
          <Text style={styles.subtitle}>Boat Ramp Safety Monitor</Text>
          <Text style={styles.buildTag}>BUILD 28 APR</Text>
        </View>

        <View style={styles.lightContainer}>
          <Animated.View
            style={[
              styles.lightOuter,
              { borderColor: cfg.light, transform: [{ scale: pulse }] },
            ]}
          >
            <View style={[styles.lightInner, { backgroundColor: cfg.light }]}>
              <Text style={styles.lightEmoji}>{cfg.emoji}</Text>
            </View>
          </Animated.View>
        </View>

        <View style={styles.infoBlock}>
          <Text style={[styles.statusLabel, { color: cfg.light }]}>{cfg.label}</Text>
          <Text style={styles.statusSub}>{cfg.sub}</Text>

          {data && (
            <View style={styles.stats}>
              <View style={styles.statRow}>
                <Text style={styles.statKey}>Confidence</Text>
                <Text style={[styles.statVal, { color: cfg.light }]}>
                  {data.confidence}%
                </Text>
              </View>
              {data.source && (
                <View style={styles.statRow}>
                  <Text style={styles.statKey}>Source</Text>
                  <Text style={styles.statVal}>{data.source}</Text>
                </View>
              )}
              <View style={styles.statRow}>
                <Text style={styles.statKey}>Last updated</Text>
                <Text style={styles.statVal}>{formatTime(lastUpdated)}</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <View style={[styles.dot, { backgroundColor: isOffline ? "#ef4444" : "#22c55e" }]} />
          <Text style={styles.footerText}>
            {isOffline ? "Offline" : "Live — polling every 2s"}
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, justifyContent: "space-between", paddingHorizontal: 24 },
  header: { paddingTop: 12, alignItems: "center" },
  appTitle: { fontSize: 28, fontWeight: "800", color: "#fff", letterSpacing: 1 },
  subtitle: { fontSize: 13, color: "#86efac", marginTop: 2 },
  buildTag: { fontSize: 8, color: "#86efac44", letterSpacing: 1.5, marginTop: 2 },
  lightContainer: { alignItems: "center", justifyContent: "center", flex: 1 },
  lightOuter: {
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  lightInner: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 16,
  },
  lightEmoji: { fontSize: 80 },
  infoBlock: { alignItems: "center", paddingBottom: 16 },
  statusLabel: {
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 2,
    textAlign: "center",
    marginBottom: 8,
  },
  statusSub: {
    fontSize: 15,
    color: "#d1fae5",
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  stats: {
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 12,
    padding: 16,
    width: "100%",
    gap: 8,
  },
  statRow: { flexDirection: "row", justifyContent: "space-between" },
  statKey: { color: "#86efac", fontSize: 13 },
  statVal: { color: "#fff", fontSize: 13, fontWeight: "700" },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: Platform.OS === "android" ? 16 : 8,
    gap: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  footerText: { color: "#4ade80", fontSize: 12 },
});
