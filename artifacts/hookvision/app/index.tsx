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
const SPLASH_Y = H * 0.36;

// Water: dx/dy = total travel in px over lifetime, delay = ms phase offset
const WATER: Array<{ dx: number; dy: number; size: number; dur: number; delay: number }> = [
  { dx:  72, dy: -95, size: 5, dur: 900,  delay:   0 },
  { dx: -58, dy: -82, size: 4, dur: 850,  delay: 130 },
  { dx:  96, dy: -52, size: 6, dur: 800,  delay: 260 },
  { dx: -84, dy: -64, size: 5, dur: 950,  delay:  65 },
  { dx:  32, dy:-112, size: 4, dur: 750,  delay: 195 },
  { dx: -34, dy:-108, size: 3, dur: 820,  delay: 325 },
  { dx:  62, dy: -42, size: 6, dur: 780,  delay: 100 },
  { dx: -68, dy: -38, size: 5, dur: 870,  delay: 215 },
  { dx: 114, dy: -72, size: 4, dur: 730,  delay: 380 },
  { dx:-102, dy: -78, size: 4, dur: 810,  delay: 290 },
  { dx:  48, dy:-134, size: 3, dur: 700,  delay: 445 },
  { dx: -44, dy:-122, size: 3, dur: 760,  delay: 510 },
  { dx:  82, dy: -22, size: 5, dur: 840,  delay: 155 },
  { dx: -72, dy: -20, size: 5, dur: 890,  delay: 405 },
];

const DUST_Y = H * 0.73;
const DUST: Array<{ x: number; dy: number; dx: number; w: number; h: number; dur: number; delay: number; color: string }> = [
  { x: W*0.04, dy:-38, dx: 22, w:26, h:16, dur:1600, delay:   0, color:"rgba(180,140, 80,0.22)" },
  { x: W*0.16, dy:-26, dx:-18, w:20, h:12, dur:1800, delay: 220, color:"rgba(160,120, 60,0.18)" },
  { x: W*0.28, dy:-48, dx: 32, w:30, h:18, dur:1400, delay: 110, color:"rgba(190,150, 90,0.24)" },
  { x: W*0.40, dy:-20, dx:-14, w:16, h:10, dur:2000, delay: 370, color:"rgba(150,110, 55,0.16)" },
  { x: W*0.52, dy:-42, dx: 28, w:28, h:17, dur:1500, delay: 520, color:"rgba(175,135, 75,0.20)" },
  { x: W*0.64, dy:-32, dx:-22, w:22, h:14, dur:1700, delay: 165, color:"rgba(165,125, 65,0.19)" },
  { x: W*0.76, dy:-54, dx: 38, w:32, h:20, dur:1300, delay: 430, color:"rgba(195,155, 95,0.26)" },
  { x: W*0.88, dy:-24, dx:-16, w:18, h:11, dur:1900, delay: 275, color:"rgba(155,115, 58,0.17)" },
  { x: W*0.10, dy:-60, dx: 20, w:14, h: 9, dur:1200, delay: 650, color:"rgba(200,160,100,0.14)" },
  { x: W*0.22, dy:-36, dx:-28, w:25, h:15, dur:1550, delay: 475, color:"rgba(170,130, 70,0.21)" },
  { x: W*0.46, dy:-28, dx: 24, w:21, h:13, dur:1750, delay:  90, color:"rgba(160,120, 60,0.18)" },
  { x: W*0.60, dy:-44, dx:-20, w:29, h:18, dur:1450, delay: 730, color:"rgba(185,145, 85,0.23)" },
  { x: W*0.72, dy:-18, dx: 30, w:15, h: 9, dur:1850, delay: 340, color:"rgba(145,105, 52,0.15)" },
  { x: W*0.84, dy:-50, dx:-34, w:31, h:19, dur:1350, delay: 580, color:"rgba(192,152, 92,0.25)" },
  { x: W*0.34, dy:-65, dx: 12, w:12, h: 8, dur:1100, delay: 800, color:"rgba(205,165,105,0.13)" },
  { x: W*0.56, dy:-15, dx:-10, w:22, h:14, dur:2100, delay: 690, color:"rgba(155,115, 58,0.16)" },
];

// ── Particle layer components ─────────────────────────────────────────────────

function easeOutQuad(t: number) { return 1 - (1 - t) * (1 - t); }
function easeInQuad(t: number)  { return t * t; }

function WaterParticles() {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setMs(t => t + 40), 40);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      {WATER.map((p, i) => {
        const period = p.dur;
        const t = ((ms - p.delay) % (period + 400) + (period + 400)) % (period + 400);
        if (t > period) return null; // rest phase
        const phase = t / period;
        const e = easeOutQuad(phase);
        const fallPhase = phase * phase; // gravity
        const ox = p.dx * e;
        const oy = p.dy * e + 60 * fallPhase; // arc up then gravity pulls down
        const opRaw = phase < 0.12 ? phase / 0.12 : phase > 0.65 ? 1 - (phase - 0.65) / 0.35 : 1;
        const op = opRaw * 0.9;
        const col = i % 3 === 0 ? "#e8f6ff" : i % 3 === 1 ? "#b0dcf5" : "#ffffff";
        return (
          <View
            key={i}
            pointerEvents="none"
            style={{
              position: "absolute",
              left: SPLASH_X + ox - p.size / 2,
              top: SPLASH_Y + oy - p.size / 2,
              width: p.size,
              height: p.size,
              borderRadius: p.size / 2,
              backgroundColor: col,
              opacity: op,
            }}
          />
        );
      })}
    </>
  );
}

function DustParticles() {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setMs(t => t + 40), 40);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      {DUST.map((p, i) => {
        const period = p.dur;
        const t = ((ms - p.delay) % (period + 600) + (period + 600)) % (period + 600);
        if (t > period) return null;
        const phase = t / period;
        const e = easeInQuad(phase);
        const ox = p.dx * phase;
        const oy = p.dy * phase;
        const scale = 0.3 + phase * 1.4; // grows from small to large
        const opRaw = phase < 0.18 ? phase / 0.18 : phase > 0.6 ? 1 - (phase - 0.6) / 0.4 : 1;
        const w = p.w * scale;
        const h = p.h * scale;
        return (
          <View
            key={i}
            pointerEvents="none"
            style={{
              position: "absolute",
              left: p.x + ox - w / 2,
              top: DUST_Y + (i % 3) * H * 0.04 + oy - h / 2,
              width: w,
              height: h,
              borderRadius: w,
              backgroundColor: p.color,
              opacity: opRaw,
            }}
          />
        );
      })}
    </>
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

      {/* ── Water spray particles ── */}
      <WaterParticles />

      {/* ── Dust cloud particles ── */}
      <DustParticles />

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
