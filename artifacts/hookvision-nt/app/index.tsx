import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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
import { MaterialCommunityIcons } from "@expo/vector-icons";

const { width: W, height: H } = Dimensions.get("window");

const BUFFALO  = require("@/assets/images/splash-buffalo.png");
const BARRA    = require("@/assets/images/splash-barra.png");
const HV_LOGO  = require("@/assets/images/hv-logo2-nobg.png");
const NT_FLAG  = require("@/assets/images/nt-flag-real.png");

const BG   = "#0a1628";
const TEAL = "#00d4aa";
const GOLD = "#ffd700";

// ── Particle data (deterministic, module-level) ──────────────────────────────

const SPLASH_X = W * 0.48;
const SPLASH_Y = H * 0.37;

// Water particles — large bright drops fanning out from fish splash
const WATER: Array<{ dx: number; dy: number; size: number; dur: number; delay: number }> = [
  { dx:  90, dy:-110, size:10, dur: 900, delay:   0 },
  { dx: -70, dy: -95, size: 8, dur: 850, delay: 110 },
  { dx: 120, dy: -60, size:12, dur: 800, delay: 220 },
  { dx:-105, dy: -75, size:10, dur: 950, delay:  55 },
  { dx:  40, dy:-140, size: 8, dur: 750, delay: 170 },
  { dx: -45, dy:-130, size: 7, dur: 820, delay: 300 },
  { dx:  75, dy: -50, size:11, dur: 780, delay:  90 },
  { dx: -80, dy: -45, size: 9, dur: 870, delay: 200 },
  { dx: 140, dy: -85, size: 7, dur: 730, delay: 360 },
  { dx:-130, dy: -90, size: 8, dur: 810, delay: 270 },
  { dx:  55, dy:-155, size: 6, dur: 700, delay: 430 },
  { dx: -50, dy:-145, size: 6, dur: 760, delay: 490 },
  { dx: 100, dy: -28, size:10, dur: 840, delay: 140 },
  { dx: -90, dy: -25, size: 9, dur: 890, delay: 390 },
  { dx:  20, dy:-120, size: 7, dur: 720, delay: 540 },
  { dx: -22, dy:-115, size: 7, dur: 770, delay: 620 },
];


// ── Particle layer components ─────────────────────────────────────────────────

// ── CSS keyframe injection (web only — compositor-driven, never throttled) ────

function injectParticleCSS() {
  if (typeof document === "undefined") return;
  if (document.getElementById("hv-particles")) return;
  const css = WATER.map((p, i) => `
      @keyframes wd${i} {
        0%   { transform: translate(0px, 0px) scale(1);   opacity: 0; }
        12%  { opacity: 0.85; }
        75%  { opacity: 0.7; }
        100% { transform: translate(${p.dx}px, ${p.dy + 70}px) scale(0.5); opacity: 0; }
      }
      .wd${i} {
        position: absolute;
        left: ${SPLASH_X - p.size / 2}px;
        top:  ${SPLASH_Y - p.size / 2}px;
        width: ${p.size}px; height: ${p.size}px;
        border-radius: 50%;
        background: ${i % 3 === 0 ? "rgba(255,255,255,0.9)" : i % 3 === 1 ? "rgba(200,238,255,0.8)" : "rgba(224,248,255,0.75)"};
        animation: wd${i} ${p.dur}ms cubic-bezier(0.25,0.46,0.45,0.94) ${p.delay}ms infinite;
        pointer-events: none;
      }
    `).join("\n");
  const tag = document.createElement("style");
  tag.id = "hv-particles";
  tag.textContent = css;
  document.head.appendChild(tag);
}

function WebParticles() {
  useEffect(() => { injectParticleCSS(); }, []);
  if (Platform.OS !== "web" || typeof document === "undefined") return null;
  return (
    // @ts-ignore — native div for web, guaranteed no RN style interference
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 99 }}>
      {WATER.map((_, i) => <div key={`w${i}`} className={`wd${i}`} />)}
    </div>
  );
}

// ── Main welcome screen ───────────────────────────────────────────────────────

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const logoOpacity   = useRef(new Animated.Value(0)).current;
  const logoY         = useRef(new Animated.Value(20)).current;
  const flagOpacity   = useRef(new Animated.Value(0)).current;
  const btnOpacity    = useRef(new Animated.Value(0)).current;
  const btnScale      = useRef(new Animated.Value(0.9)).current;
  const windAnim      = useRef(new Animated.Value(0)).current;
  const bottomOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(bottomOpacity, { toValue: 1, duration: 800, useNativeDriver: true }).start();
    Animated.parallel([
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
      Animated.loop(
        Animated.sequence([
          Animated.timing(windAnim, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(windAnim, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ).start();
    });
  }, []);

  const enter = () => router.replace("/(tabs)/home");

  const flagRotate     = windAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: ["-2deg", "2.5deg", "-2deg"] });
  const flagScaleX     = windAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.88, 1] });
  const flagTranslateY = windAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -3, 0] });

  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const logoW  = Math.min(W - 32, 400);
  const logoH  = logoW * (9 / 16);

  return (
    <View style={styles.root}>
      {/* ── Barra — top half ── */}
      <Image source={BARRA} style={styles.barraTopImg} resizeMode="cover" />
      <LinearGradient colors={["transparent", BG]} style={styles.barraTopFade} pointerEvents="none" />

      {/* ── Buffalo — bottom half ── */}
      <Animated.View style={[styles.buffContainer, { opacity: bottomOpacity }]}>
        <Image source={BUFFALO} style={styles.buffImg} resizeMode="cover" />
        <LinearGradient colors={[BG, "transparent", "transparent"]} locations={[0, 0.35, 1]} style={styles.buffFade} pointerEvents="none" />
      </Animated.View>

      {/* ── Centre dark band ── */}
      <LinearGradient
        colors={["transparent", `${BG}99`, `${BG}cc`, `${BG}99`, "transparent"]}
        locations={[0.24, 0.38, 0.5, 0.63, 0.78]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* ── Particles — CSS keyframe driven, works in all iframe contexts ── */}
      <WebParticles />

      {/* ── NT Flag ── */}
      <Animated.Image
        source={NT_FLAG}
        style={[
          styles.ntFlag,
          {
            top: H * 0.36 + logoH * 0.54,
            right: Math.max((W - logoW) / 2, 16),
            opacity: flagOpacity,
            transform: [{ rotate: flagRotate }, { scaleX: flagScaleX }, { translateY: flagTranslateY }],
          },
        ]}
        resizeMode="cover"
      />

      {/* ── HookVision logo + tagline ── */}
      <Animated.View
        style={{
          position: "absolute",
          top: H * 0.36,
          left: (W - logoW) / 2,
          width: logoW,
          alignItems: "center",
          opacity: logoOpacity,
          transform: [{ translateY: logoY }],
        }}
      >
        <Image
          source={HV_LOGO}
          style={{ width: logoW, height: logoH }}
          resizeMode="contain"
        />
        <Text style={styles.tagline}>NT'S AI FISHING GUIDE</Text>
      </Animated.View>

      {/* ── HUD Glasses + 360 Camera quick-launch ── */}
      <Animated.View style={[styles.quickLaunch, { top: topPad + 54, opacity: logoOpacity }]}>
        <Pressable
          style={({ pressed }) => [styles.quickPill, pressed && { opacity: 0.7 }]}
          onPress={() => router.replace("/(tabs)/live" as any)}
        >
          <MaterialCommunityIcons name="glasses" size={18} color={GOLD} />
          <Text style={styles.quickPillText}>HUD</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.quickPill, pressed && { opacity: 0.7 }]}
          onPress={() => router.replace("/(tabs)/insta360" as any)}
        >
          <MaterialCommunityIcons name="rotate-360" size={18} color={GOLD} />
          <Text style={styles.quickPillText}>360° CAM</Text>
        </Pressable>
      </Animated.View>

      {/* ── Enter button ── */}
      <Animated.View style={[styles.btnWrap, { bottom: insets.bottom > 0 ? insets.bottom + 24 : 40, opacity: btnOpacity, transform: [{ scale: btnScale }] }]}>
        <Pressable style={({ pressed }) => [styles.enterBtn, pressed && styles.enterBtnPressed]} onPress={enter}>
          <LinearGradient colors={[TEAL, "#00a8d4"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.enterGradient}>
            <Text style={styles.enterText}>ENTER THE TERRITORY</Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>

      {/* ── Gold corner marks ── */}
      <View style={[styles.corner, { top: topPad + 16, left: 16 }]}>
        <View style={[styles.cornerH, { backgroundColor: GOLD }]} />
        <View style={[styles.cornerV, { backgroundColor: GOLD }]} />
      </View>
      <View style={[styles.corner, { bottom: (insets.bottom > 0 ? insets.bottom + 24 : 40) + 70, left: 16 }]}>
        <View style={[styles.cornerH, { backgroundColor: GOLD, bottom: 0, top: "auto" }]} />
        <View style={[styles.cornerV, { backgroundColor: GOLD, bottom: 0, top: "auto" }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  barraTopImg: { position: "absolute", top: 0, left: 0, width: W, height: H * 0.58 },
  barraTopFade: { position: "absolute", top: H * 0.3, left: 0, right: 0, height: H * 0.28 },

  buffContainer: { position: "absolute", bottom: 0, left: 0, width: W, height: H * 0.58 },
  buffImg: { width: "100%", height: "100%" },
  buffFade: { position: "absolute", top: 0, left: 0, right: 0, height: H * 0.32 },

  ntFlag: { position: "absolute", width: 100, height: 50, borderRadius: 3, overflow: "hidden" },

  logo: { position: "absolute", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.6, shadowRadius: 16 },

  btnWrap: { position: "absolute", left: 24, right: 24, alignItems: "center" },
  enterBtn: { width: "100%", borderRadius: 14, overflow: "hidden" },
  enterBtnPressed: { opacity: 0.85 },
  enterGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 18, paddingHorizontal: 24, gap: 10 },
  enterText: { fontSize: 15, fontFamily: "Oswald_700Bold", color: "#000000", letterSpacing: 2.5 },
  enterArrow: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#000000" },

  corner: { position: "absolute", width: 18, height: 18 },
  cornerH: { position: "absolute", top: 0, left: 0, width: 18, height: 2 },
  cornerV: { position: "absolute", top: 0, left: 0, width: 2, height: 18 },

  tagline: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    letterSpacing: 3,
    color: "rgba(255,255,255,0.70)",
    textAlign: "center",
    marginTop: -8,
  },

  quickLaunch: { position: "absolute", right: 16, flexDirection: "column", gap: 8, alignItems: "flex-end" },
  quickPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1, borderColor: "rgba(255,215,0,0.45)",
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7,
  },
  quickPillText: { fontSize: 11, fontFamily: "Oswald_700Bold", color: "#ffd700", letterSpacing: 1.5 },
});
