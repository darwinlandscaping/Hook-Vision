import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: W, height: H } = Dimensions.get("window");

const BUFFALO  = require("@/assets/images/splash-buffalo.png");
const BARRA    = require("@/assets/images/splash-barra.png");
const HV_LOGO  = require("@/assets/images/hv-logo2-nobg.png");
const NT_FLAG  = require("@/assets/images/nt-flag-real.png");

const BG   = "#0a1628";
const TEAL = "#00d4aa";
const GOLD = "#ffd700";

// ── Particle definitions (deterministic, created once) ───────────────────────

const SPLASH_X = W * 0.5;
const SPLASH_Y = H * 0.38;

const WATER_CONFIG = [
  { dx:  70, dy: -90, size: 4, dur: 700, delay:   0, op: 0.75 },
  { dx: -55, dy: -80, size: 3, dur: 750, delay: 120, op: 0.65 },
  { dx:  95, dy: -50, size: 5, dur: 650, delay: 240, op: 0.80 },
  { dx: -80, dy: -60, size: 4, dur: 800, delay:  60, op: 0.70 },
  { dx:  30, dy:-110, size: 3, dur: 600, delay: 180, op: 0.60 },
  { dx: -30, dy:-105, size: 2, dur: 680, delay: 300, op: 0.55 },
  { dx:  60, dy: -40, size: 5, dur: 720, delay:  90, op: 0.85 },
  { dx: -65, dy: -35, size: 4, dur: 760, delay: 200, op: 0.70 },
  { dx: 110, dy: -70, size: 3, dur: 640, delay: 350, op: 0.60 },
  { dx:-100, dy: -75, size: 3, dur: 710, delay: 270, op: 0.65 },
  { dx:  45, dy:-130, size: 2, dur: 580, delay: 420, op: 0.50 },
  { dx: -40, dy:-120, size: 2, dur: 620, delay: 480, op: 0.55 },
  { dx:  80, dy: -20, size: 4, dur: 680, delay: 140, op: 0.90 },
  { dx: -70, dy: -18, size: 4, dur: 740, delay: 380, op: 0.80 },
];

const DUST_Y_BASE = H * 0.75;
const DUST_CONFIG = [
  { x: W*0.05, dy:-30, dx: 20, size:18, dur:1400, delay:   0, op:0.18 },
  { x: W*0.18, dy:-22, dx:-15, size:14, dur:1600, delay: 200, op:0.14 },
  { x: W*0.30, dy:-40, dx: 30, size:22, dur:1200, delay: 100, op:0.20 },
  { x: W*0.42, dy:-18, dx:-10, size:12, dur:1800, delay: 350, op:0.12 },
  { x: W*0.55, dy:-35, dx: 25, size:20, dur:1300, delay: 500, op:0.16 },
  { x: W*0.67, dy:-28, dx:-20, size:16, dur:1500, delay: 150, op:0.15 },
  { x: W*0.80, dy:-45, dx: 35, size:24, dur:1100, delay: 400, op:0.22 },
  { x: W*0.90, dy:-20, dx:-12, size:13, dur:1700, delay: 250, op:0.13 },
  { x: W*0.12, dy:-50, dx: 18, size:10, dur:1000, delay: 600, op:0.10 },
  { x: W*0.25, dy:-32, dx:-25, size:19, dur:1350, delay: 450, op:0.17 },
  { x: W*0.48, dy:-25, dx: 22, size:15, dur:1550, delay:  80, op:0.14 },
  { x: W*0.62, dy:-38, dx:-18, size:21, dur:1250, delay: 700, op:0.19 },
  { x: W*0.75, dy:-15, dx: 28, size:11, dur:1650, delay: 320, op:0.11 },
  { x: W*0.85, dy:-42, dx:-30, size:23, dur:1150, delay: 550, op:0.21 },
  { x: W*0.35, dy:-55, dx: 10, size: 9, dur: 950, delay: 750, op:0.09 },
  { x: W*0.58, dy:-12, dx:-8,  size:16, dur:1900, delay: 650, op:0.12 },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const logoOpacity  = useRef(new Animated.Value(0)).current;
  const logoY        = useRef(new Animated.Value(20)).current;
  const flagOpacity  = useRef(new Animated.Value(0)).current;
  const btnOpacity   = useRef(new Animated.Value(0)).current;
  const btnScale     = useRef(new Animated.Value(0.9)).current;
  const barraY       = useRef(new Animated.Value(60)).current;
  const barraOpacity = useRef(new Animated.Value(0)).current;
  const windAnim     = useRef(new Animated.Value(0)).current;

  const waterAnims = useRef(WATER_CONFIG.map(() => new Animated.Value(0))).current;
  const dustAnims  = useRef(DUST_CONFIG.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    // Entrance animations
    Animated.parallel([
      Animated.timing(barraOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(barraY, { toValue: 0, duration: 750, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(150),
        Animated.parallel([
          Animated.timing(logoOpacity, { toValue: 1, duration: 550, useNativeDriver: true }),
          Animated.timing(logoY, { toValue: 0, duration: 550, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(flagOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(400),
        Animated.parallel([
          Animated.timing(btnOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.spring(btnScale, { toValue: 1, tension: 120, friction: 8, useNativeDriver: true }),
        ]),
      ]),
    ]).start(() => {
      // Flag wind loop
      Animated.loop(
        Animated.sequence([
          Animated.timing(windAnim, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(windAnim, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ).start();
    });

    // Water particles — start immediately, loop independently
    waterAnims.forEach((anim, i) => {
      const cfg = WATER_CONFIG[i];
      Animated.loop(
        Animated.sequence([
          Animated.delay(cfg.delay),
          Animated.timing(anim, { toValue: 1, duration: cfg.dur, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ).start();
    });

    // Dust particles — start immediately, loop independently
    dustAnims.forEach((anim, i) => {
      const cfg = DUST_CONFIG[i];
      Animated.loop(
        Animated.sequence([
          Animated.delay(cfg.delay),
          Animated.timing(anim, { toValue: 1, duration: cfg.dur, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ).start();
    });
  }, []);

  const enter = () => router.replace("/(tabs)");

  const flagRotate = windAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["-2deg", "2.5deg", "-2deg"],
  });
  const flagScaleX = windAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.88, 1],
  });
  const flagTranslateY = windAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -3, 0],
  });

  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const logoW  = Math.min(W - 32, 400);
  const logoH  = logoW * (9 / 16);

  return (
    <View style={styles.root}>
      {/* ── Barra — top half ── */}
      <Image source={BARRA} style={styles.buffaloImg} resizeMode="cover" />
      <LinearGradient colors={["transparent", BG]} style={styles.buffaloFade} pointerEvents="none" />

      {/* ── Buffalo — bottom half, slides up ── */}
      <Animated.View style={[styles.barraContainer, { opacity: barraOpacity, transform: [{ translateY: barraY }] }]}>
        <Image source={BUFFALO} style={styles.barraImg} resizeMode="cover" />
        <LinearGradient colors={[BG, "transparent", "transparent"]} locations={[0, 0.35, 1]} style={styles.barraFade} pointerEvents="none" />
      </Animated.View>

      {/* ── Centre dark overlay for readability ── */}
      <LinearGradient
        colors={["transparent", `${BG}cc`, `${BG}f0`, `${BG}cc`, "transparent"]}
        locations={[0.22, 0.38, 0.5, 0.64, 0.8]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* ── Water spray particles (fish splash area) ── */}
      {WATER_CONFIG.map((cfg, i) => {
        const anim = waterAnims[i];
        return (
          <Animated.View
            key={`w${i}`}
            pointerEvents="none"
            style={{
              position: "absolute",
              left: SPLASH_X,
              top: SPLASH_Y,
              width: cfg.size,
              height: cfg.size,
              borderRadius: cfg.size / 2,
              backgroundColor: i % 3 === 0 ? "#e8f6ff" : i % 3 === 1 ? "#b0dff5" : "#ffffff",
              opacity: anim.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, cfg.op, cfg.op * 0.4, 0] }),
              transform: [
                { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, cfg.dx] }) },
                { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, cfg.dy + cfg.size * 8] }) },
              ],
            }}
          />
        );
      })}

      {/* ── Dust particles (buffalo stampede area) ── */}
      {DUST_CONFIG.map((cfg, i) => {
        const anim = dustAnims[i];
        return (
          <Animated.View
            key={`d${i}`}
            pointerEvents="none"
            style={{
              position: "absolute",
              left: cfg.x,
              top: DUST_Y_BASE + (i % 3) * (H * 0.04),
              width: cfg.size,
              height: cfg.size * 0.7,
              borderRadius: cfg.size,
              backgroundColor: i % 4 === 0 ? "#c8a96e" : i % 4 === 1 ? "#b8904a" : i % 4 === 2 ? "#d4a870" : "#a07840",
              opacity: anim.interpolate({ inputRange: [0, 0.2, 0.7, 1], outputRange: [0, cfg.op, cfg.op * 0.5, 0] }),
              transform: [
                { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, cfg.dx] }) },
                { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, cfg.dy] }) },
                { scale: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 1.4, 1.8] }) },
              ],
            }}
          />
        );
      })}

      {/* ── NT Flag — bottom-right corner of logo, waving in wind ── */}
      <Animated.Image
        source={NT_FLAG}
        style={[
          styles.ntFlag,
          {
            top: H * 0.37 + logoH * 0.58,
            right: Math.max((W - logoW) / 2, 16),
            opacity: flagOpacity,
            transform: [
              { rotate: flagRotate },
              { scaleX: flagScaleX },
              { translateY: flagTranslateY },
            ],
          },
        ]}
        resizeMode="cover"
      />

      {/* ── HookVision logo — upper section of dark band ── */}
      <Animated.Image
        source={HV_LOGO}
        style={[
          styles.logo,
          {
            width: logoW,
            height: logoH,
            top: H * 0.37,
            left: (W - logoW) / 2,
            opacity: logoOpacity,
            transform: [{ translateY: logoY }],
          },
        ]}
        resizeMode="contain"
      />

      {/* ── Enter button — bottom ── */}
      <Animated.View
        style={[styles.btnWrap, { bottom: Math.max(insets.bottom + 36, 52), opacity: btnOpacity, transform: [{ scale: btnScale }] }]}
      >
        <Pressable style={({ pressed }) => [styles.enterBtn, pressed && styles.enterBtnPressed]} onPress={enter}>
          <LinearGradient colors={[TEAL, "#00a8d4"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.enterGradient}>
            <Text style={styles.enterText}>ENTER THE TERRITORY</Text>
            <Text style={styles.enterArrow}>→</Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>

      {/* ── Gold corner marks ── */}
      <View style={[styles.corner, { top: topPad + 16, left: 16 }]}>
        <View style={[styles.cornerH, { backgroundColor: GOLD }]} />
        <View style={[styles.cornerV, { backgroundColor: GOLD }]} />
      </View>
      <View style={[styles.corner, { bottom: Math.max(insets.bottom + 36, 52) + 70, left: 16 }]}>
        <View style={[styles.cornerH, { backgroundColor: GOLD, bottom: 0, top: "auto" }]} />
        <View style={[styles.cornerV, { backgroundColor: GOLD, bottom: 0, top: "auto" }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },

  buffaloImg: {
    position: "absolute",
    top: 0,
    left: 0,
    width: W,
    height: H * 0.58,
  },
  buffaloFade: {
    position: "absolute",
    top: H * 0.3,
    left: 0,
    right: 0,
    height: H * 0.28,
  },

  barraContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: W,
    height: H * 0.58,
  },
  barraImg: {
    width: "100%",
    height: "100%",
  },
  barraFade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: H * 0.32,
  },

  ntFlag: {
    position: "absolute",
    width: 100,
    height: 50,
    borderRadius: 3,
    overflow: "hidden",
  },

  logo: {
    position: "absolute",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
  },

  btnWrap: {
    position: "absolute",
    left: 24,
    right: 24,
    alignItems: "center",
  },
  enterBtn: {
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
  },
  enterBtnPressed: {
    opacity: 0.85,
  },
  enterGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    paddingHorizontal: 24,
    gap: 10,
  },
  enterText: {
    fontSize: 15,
    fontFamily: "Oswald_700Bold",
    color: "#000000",
    letterSpacing: 2.5,
  },
  enterArrow: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#000000",
  },

  corner: {
    position: "absolute",
    width: 18,
    height: 18,
  },
  cornerH: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 18,
    height: 2,
  },
  cornerV: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 2,
    height: 18,
  },
});
