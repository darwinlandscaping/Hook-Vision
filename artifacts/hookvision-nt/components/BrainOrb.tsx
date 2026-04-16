/**
 * BrainOrb — pulsating brain visualization for the HookVision Intel tab.
 *
 * Size grows logarithmically with totalDataPoints.
 * Three concentric rings pulse outward continuously (sonar-wave style).
 * Brain icon springs to new size whenever a new data source adds knowledge.
 */
import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export interface BrainStats {
  totalDataPoints: number;
  sources: {
    sonarScans:       number;
    crocPhotos:       number;
    barraPhotos:      number;
    communityReports: number;
    videoScans:       number;
  };
  message: string;
}

interface Props {
  stats:   BrainStats | null;
  loading: boolean;
  fgColor:   string;
  mutedColor: string;
  cardColor:  string;
}

function orbSize(total: number): number {
  return Math.min(70 + Math.log10(Math.max(total, 1)) * 26, 180);
}

export function BrainOrb({ stats, loading, fgColor, mutedColor, cardColor }: Props) {
  const total      = stats?.totalDataPoints ?? 0;
  const targetSize = orbSize(total);

  const ring1     = useRef(new Animated.Value(0)).current;
  const ring2     = useRef(new Animated.Value(0)).current;
  const ring3     = useRef(new Animated.Value(0)).current;
  const brainPulse = useRef(new Animated.Value(1)).current;
  const sizeAnim  = useRef(new Animated.Value(orbSize(0))).current;
  const burstAnim = useRef(new Animated.Value(1)).current;
  const prevTotal = useRef(0);

  // ── Continuous ring pulse (sonar wave) ────────────────────────────────────
  useEffect(() => {
    const makeLoop = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 2400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );

    makeLoop(ring1, 0).start();
    makeLoop(ring2, 800).start();
    makeLoop(ring3, 1600).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(brainPulse, { toValue: 1.06, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(brainPulse, { toValue: 1.0,  duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // ── Size spring + burst when data grows ────────────────────────────────────
  useEffect(() => {
    if (total === 0) return;
    const grew = total > prevTotal.current;
    prevTotal.current = total;

    Animated.spring(sizeAnim, {
      toValue: targetSize,
      tension: 60,
      friction: 9,
      useNativeDriver: false,
    }).start();

    if (grew) {
      Animated.sequence([
        Animated.timing(burstAnim, { toValue: 1.25, duration: 200, useNativeDriver: true }),
        Animated.spring(burstAnim, { toValue: 1.0, tension: 120, friction: 7, useNativeDriver: true }),
      ]).start();
    }
  }, [total]);

  const r1Scale   = ring1.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] });
  const r1Opacity = ring1.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.55, 0] });
  const r2Scale   = ring2.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] });
  const r2Opacity = ring2.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.55, 0] });
  const r3Scale   = ring3.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] });
  const r3Opacity = ring3.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.38, 0] });

  const s = stats?.sources;

  return (
    <View style={[styles.card, { backgroundColor: cardColor }]}>
      <Text style={[styles.title, { color: mutedColor }]}>HOOKVISION BRAIN</Text>

      {/* ── Orb ──────────────────────────────────────────────────────────── */}
      <View style={styles.orbWrap}>
        {/* Rings */}
        <Animated.View style={[styles.ring, { transform: [{ scale: r1Scale }], opacity: r1Opacity }]} />
        <Animated.View style={[styles.ring, styles.ring2, { transform: [{ scale: r2Scale }], opacity: r2Opacity }]} />
        <Animated.View style={[styles.ring, styles.ring3, { transform: [{ scale: r3Scale }], opacity: r3Opacity }]} />

        {/* Brain icon — animated size + pulse */}
        <Animated.View style={[styles.brainCenter, {
          transform: [{ scale: Animated.multiply(brainPulse, burstAnim) }],
        }]}>
          <Animated.View style={{ width: sizeAnim, height: sizeAnim, alignItems: "center", justifyContent: "center" }}>
            <MaterialCommunityIcons
              name="brain"
              size={Math.round(targetSize * 0.72)}
              color="#ff8800"
            />
          </Animated.View>
        </Animated.View>
      </View>

      {/* ── Total count ──────────────────────────────────────────────────── */}
      <Text style={[styles.count, { color: fgColor }]}>
        {loading && !stats ? "Syncing brain…" : `${total.toLocaleString()} knowledge units`}
      </Text>
      <Text style={[styles.sub, { color: mutedColor }]}>
        Grows with every scan · report · photo · video
      </Text>

      {/* ── Source chips ─────────────────────────────────────────────────── */}
      {s ? (
        <View style={styles.chips}>
          <Chip icon="chart-line"     label="Sonar"   value={s.sonarScans}       color="#00d4aa" />
          <Chip icon="account-group"  label="Reports" value={s.communityReports} color="#00a8ff" />
          <Chip icon="camera-outline"  label="Croc"    value={s.crocPhotos}       color="#e8151a" />
          <Chip icon="fish"           label="Barra"   value={s.barraPhotos}      color="#ffd700" />
          <Chip icon="video-outline"  label="Videos"  value={s.videoScans}       color="#ff8800" />
        </View>
      ) : null}
    </View>
  );
}

function Chip({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <View style={[styles.chip, { borderColor: color + "55" }]}>
      <MaterialCommunityIcons name={icon as any} size={11} color={color} />
      <Text style={[styles.chipLabel, { color }]}>{label}</Text>
      <Text style={styles.chipValue}>{value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value)}</Text>
    </View>
  );
}

const ORB_DIAMETER = 180;

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 4,
    borderRadius: 18,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,136,0,0.25)",
  },
  title: {
    fontSize: 11,
    letterSpacing: 3,
    fontFamily: "Oswald_700Bold",
    marginBottom: 20,
  },
  orbWrap: {
    width: ORB_DIAMETER,
    height: ORB_DIAMETER,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  ring: {
    position: "absolute",
    width: ORB_DIAMETER * 0.65,
    height: ORB_DIAMETER * 0.65,
    borderRadius: ORB_DIAMETER * 0.5,
    borderWidth: 2,
    borderColor: "#ff8800",
  },
  ring2: { borderColor: "#ffd700", borderWidth: 1.5 },
  ring3: { borderColor: "#ff8800", borderWidth: 1 },
  brainCenter: { alignItems: "center", justifyContent: "center" },
  count: { fontSize: 17, fontFamily: "Oswald_700Bold", letterSpacing: 1, marginBottom: 4 },
  sub: { fontSize: 11, fontFamily: "Inter_400Regular", letterSpacing: 0.5, marginBottom: 16, textAlign: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center" },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, borderRadius: 14,
    paddingHorizontal: 9, paddingVertical: 5,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  chipLabel: { fontSize: 10, fontFamily: "Oswald_700Bold", letterSpacing: 1 },
  chipValue: { fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)" },
});
