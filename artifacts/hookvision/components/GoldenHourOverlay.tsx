import React, { useEffect, useRef } from "react";
import { Animated, Easing, Platform, StyleSheet, Text, View } from "react-native";
import { useGoldenHour } from "@/hooks/useGoldenHour";

const GOLD      = "#ffd700";
const ORANGE    = "#ff8c00";
const PINK_GOLD = "#ffb347";
const ND        = Platform.OS !== "web"; // useNativeDriver

export function GoldenHourOverlay() {
  const { isGoldenHour, phase, intensity } = useGoldenHour();

  const flash   = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const badgeO  = useRef(new Animated.Value(isGoldenHour ? 1 : 0)).current;
  const badgeY  = useRef(new Animated.Value(isGoldenHour ? 0 : -60)).current;

  const flashLoopRef   = useRef<Animated.CompositeAnimation | null>(null);
  const breatheLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isGoldenHour) {
      Animated.parallel([
        Animated.spring(badgeY, { toValue: 0, tension: 80, friction: 10, useNativeDriver: ND }),
        Animated.timing(badgeO, { toValue: 1, duration: 600, useNativeDriver: ND }),
      ]).start();

      // Flash pulse — bright gold bloom every ~4.4 s
      flashLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(flash, { toValue: 1,   duration: 450,  easing: Easing.out(Easing.cubic),  useNativeDriver: ND }),
          Animated.timing(flash, { toValue: 0.2, duration: 1200, easing: Easing.inOut(Easing.sin),  useNativeDriver: ND }),
          Animated.timing(flash, { toValue: 0.7, duration: 350,  easing: Easing.out(Easing.cubic),  useNativeDriver: ND }),
          Animated.timing(flash, { toValue: 0,   duration: 1600, easing: Easing.inOut(Easing.sin),  useNativeDriver: ND }),
          Animated.delay(800),
        ])
      );
      flashLoopRef.current.start();

      // Slow amber edge breathe
      breatheLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(breathe, { toValue: 1, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: ND }),
          Animated.timing(breathe, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: ND }),
        ])
      );
      breatheLoopRef.current.start();

    } else {
      flashLoopRef.current?.stop();
      breatheLoopRef.current?.stop();
      Animated.parallel([
        Animated.timing(flash,   { toValue: 0,   duration: 800, useNativeDriver: ND }),
        Animated.timing(breathe, { toValue: 0,   duration: 800, useNativeDriver: ND }),
        Animated.timing(badgeO,  { toValue: 0,   duration: 600, useNativeDriver: ND }),
        Animated.timing(badgeY,  { toValue: -60, duration: 500, useNativeDriver: ND }),
      ]).start();
    }

    return () => {
      flashLoopRef.current?.stop();
      breatheLoopRef.current?.stop();
    };
  }, [isGoldenHour]);

  const maxFlash   = 0.22 * intensity;
  const maxBreathe = 0.14 * intensity;

  const flashOpacity   = flash.interpolate({ inputRange: [0, 1], outputRange: [0, maxFlash] });
  const breatheOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0, maxBreathe] });

  const emoji = phase === "morning" ? "🌅" : "🌄";
  const label = phase === "morning" ? "DAWN GOLDEN HOUR" : "DUSK GOLDEN HOUR";

  // pointerEvents="none" keeps the overlay non-interactive on all platforms
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Gold flash bloom */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: GOLD, opacity: flashOpacity }]} />

      {/* Warm amber edge border breathe */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { borderWidth: 18, borderColor: ORANGE, opacity: breatheOpacity },
        ]}
      />

      {/* Corner warm glows */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: breatheOpacity }]}>
        <View style={[styles.corner, styles.tl, { backgroundColor: PINK_GOLD }]} />
        <View style={[styles.corner, styles.tr, { backgroundColor: GOLD }]} />
        <View style={[styles.corner, styles.bl, { backgroundColor: GOLD }]} />
        <View style={[styles.corner, styles.br, { backgroundColor: PINK_GOLD }]} />
      </Animated.View>

      {/* GOLDEN HOUR badge */}
      <Animated.View
        style={[
          styles.badgeRow,
          { opacity: badgeO, transform: [{ translateY: badgeY }] },
        ]}
      >
        <View style={styles.badge}>
          <Text style={styles.badgeEmoji}>{emoji}</Text>
          <Text style={styles.badgeText}>{label}</Text>
          <Text style={styles.badgeEmoji}>{emoji}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  badgeRow: {
    position: "absolute",
    top: Platform.OS === "web" ? 8 : 54,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(20,10,0,0.82)",
    borderWidth: 1.5,
    borderColor: "#ffd70099",
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  badgeEmoji: { fontSize: 14 },
  badgeText: {
    fontSize: 11,
    fontFamily: "Oswald_700Bold",
    color: "#ffd700",
    letterSpacing: 2.5,
  },
  corner: {
    position: "absolute",
    width: 70,
    height: 70,
    opacity: 0.55,
  },
  tl: { top: 0,    left: 0 },
  tr: { top: 0,    right: 0 },
  bl: { bottom: 0, left: 0 },
  br: { bottom: 0, right: 0 },
});
