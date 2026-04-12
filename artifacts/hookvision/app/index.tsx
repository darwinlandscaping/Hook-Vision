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

const DUST_Y = H * 0.72;
const DUST: Array<{ x: number; dy: number; dx: number; w: number; h: number; dur: number; delay: number; color: string }> = [
  { x: W*0.04, dy:-55, dx: 28, w:40, h:24, dur:1600, delay:   0, color:"rgba(200,160, 90,0.38)" },
  { x: W*0.16, dy:-38, dx:-24, w:32, h:18, dur:1800, delay: 220, color:"rgba(185,140, 70,0.32)" },
  { x: W*0.28, dy:-68, dx: 40, w:48, h:28, dur:1400, delay: 110, color:"rgba(210,165,100,0.40)" },
  { x: W*0.40, dy:-30, dx:-18, w:26, h:15, dur:2000, delay: 370, color:"rgba(175,130, 65,0.30)" },
  { x: W*0.52, dy:-60, dx: 35, w:45, h:26, dur:1500, delay: 520, color:"rgba(200,155, 85,0.36)" },
  { x: W*0.64, dy:-45, dx:-28, w:36, h:22, dur:1700, delay: 165, color:"rgba(190,145, 78,0.34)" },
  { x: W*0.76, dy:-75, dx: 45, w:52, h:32, dur:1300, delay: 430, color:"rgba(215,170,105,0.42)" },
  { x: W*0.88, dy:-35, dx:-20, w:30, h:18, dur:1900, delay: 275, color:"rgba(180,135, 68,0.30)" },
  { x: W*0.10, dy:-80, dx: 22, w:22, h:14, dur:1200, delay: 650, color:"rgba(220,175,110,0.28)" },
  { x: W*0.22, dy:-50, dx:-35, w:42, h:25, dur:1550, delay: 475, color:"rgba(195,150, 82,0.36)" },
  { x: W*0.46, dy:-42, dx: 30, w:35, h:20, dur:1750, delay:  90, color:"rgba(185,140, 72,0.34)" },
  { x: W*0.60, dy:-62, dx:-25, w:46, h:28, dur:1450, delay: 730, color:"rgba(205,160, 95,0.38)" },
  { x: W*0.72, dy:-28, dx: 38, w:24, h:14, dur:1850, delay: 340, color:"rgba(170,125, 60,0.28)" },
  { x: W*0.84, dy:-70, dx:-42, w:50, h:30, dur:1350, delay: 580, color:"rgba(212,168,102,0.40)" },
  { x: W*0.34, dy:-88, dx: 15, w:18, h:12, dur:1100, delay: 800, color:"rgba(222,178,112,0.26)" },
  { x: W*0.56, dy:-22, dx:-12, w:36, h:22, dur:2100, delay: 690, color:"rgba(178,132, 62,0.30)" },
];

// ── Particle layer components ─────────────────────────────────────────────────

// ── CSS keyframe injection (web only — compositor-driven, never throttled) ────

function injectParticleCSS() {
  if (typeof document === "undefined") return;
  if (document.getElementById("hv-particles")) return;
  const css = [
    ...WATER.map((p, i) => `
      @keyframes wd${i} {
        0%   { transform: translate(0px, 0px) scale(1);   opacity: 0; }
        10%  { opacity: 1; }
        70%  { opacity: 0.9; }
        100% { transform: translate(${p.dx}px, ${p.dy + 70}px) scale(0.6); opacity: 0; }
      }
      .wd${i} {
        position: absolute;
        left: ${SPLASH_X - p.size / 2}px;
        top:  ${SPLASH_Y - p.size / 2}px;
        width: ${p.size}px; height: ${p.size}px;
        border-radius: 50%;
        background: ${i % 3 === 0 ? "#fff" : i % 3 === 1 ? "#c8eeff" : "#e0f8ff"};
        animation: wd${i} ${p.dur}ms cubic-bezier(0.25,0.46,0.45,0.94) ${p.delay}ms infinite;
        pointer-events: none;
      }
    `),
    ...DUST.map((p, i) => `
      @keyframes dd${i} {
        0%   { transform: translate(0px, 0px) scale(0.2); opacity: 0; }
        15%  { opacity: 1; }
        60%  { opacity: 0.85; }
        100% { transform: translate(${p.dx}px, ${p.dy}px) scale(1.8); opacity: 0; }
      }
      .dd${i} {
        position: absolute;
        left: ${p.x}px;
        top:  ${DUST_Y + (i % 4) * H * 0.03}px;
        width: ${p.w}px; height: ${p.h}px;
        border-radius: 50%;
        background: ${p.color};
        animation: dd${i} ${p.dur}ms ease-in ${p.delay}ms infinite;
        pointer-events: none;
      }
    `),
  ].join("\n");
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
      {DUST.map((_, i) => <div key={`d${i}`} className={`dd${i}`} />)}
    </div>
  );
}

// ── Main welcome screen ───────────────────────────────────────────────────────

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

  useEffect(() => {
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
      Animated.loop(
        Animated.sequence([
          Animated.timing(windAnim, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(windAnim, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ).start();
    });
  }, []);

  const enter = () => router.replace("/(tabs)");

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
      <Animated.View style={[styles.buffContainer, { opacity: barraOpacity, transform: [{ translateY: barraY }] }]}>
        <Image source={BUFFALO} style={styles.buffImg} resizeMode="cover" />
        <LinearGradient colors={[BG, "transparent", "transparent"]} locations={[0, 0.35, 1]} style={styles.buffFade} pointerEvents="none" />
      </Animated.View>

      {/* ── Centre dark band ── */}
      <LinearGradient
        colors={["transparent", `${BG}cc`, `${BG}f0`, `${BG}cc`, "transparent"]}
        locations={[0.22, 0.38, 0.5, 0.64, 0.8]}
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
            top: H * 0.37 + logoH * 0.58,
            right: Math.max((W - logoW) / 2, 16),
            opacity: flagOpacity,
            transform: [{ rotate: flagRotate }, { scaleX: flagScaleX }, { translateY: flagTranslateY }],
          },
        ]}
        resizeMode="cover"
      />

      {/* ── HookVision logo ── */}
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

      {/* ── Enter button ── */}
      <Animated.View style={[styles.btnWrap, { bottom: Math.max(insets.bottom + 36, 52), opacity: btnOpacity, transform: [{ scale: btnScale }] }]}>
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
});
