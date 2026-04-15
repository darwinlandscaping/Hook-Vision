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

const GBR_IMG  = require("@/assets/images/splash-gbr.png");
const BARRA    = require("@/assets/images/splash-barra.png");
const HV_LOGO  = require("@/assets/images/hv-logo2-nobg.png");
const QLD_FLAG = require("@/assets/images/qld-flag.png");

const BG     = "#0a1628";
const TEAL   = "#00d4aa";
const GOLD   = "#ffd700";
const MAROON = "#8b1a2c";

// ── Particle data (deterministic, module-level) ──────────────────────────────

const SPLASH_X = W * 0.48;
const SPLASH_Y = H * 0.37;

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

// ── CSS keyframe injection (web only) ─────────────────────────────────────────

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
    // @ts-ignore
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 99 }}>
      {WATER.map((_, i) => <div key={`w${i}`} className={`wd${i}`} />)}
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
  const textOpacity  = useRef(new Animated.Value(0)).current;
  const barraScale   = useRef(new Animated.Value(1)).current;
  const gbrOpacity   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(gbrOpacity, { toValue: 1, duration: 1200, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(logoY, { toValue: 0, duration: 700, useNativeDriver: true, easing: Easing.out(Easing.back(1.4)) }),
      ]),
      Animated.timing(flagOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(textOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(btnOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    ]).start();

    // Subtle barra idle breathe
    Animated.loop(
      Animated.sequence([
        Animated.timing(barraScale, { toValue: 1.03, duration: 2800, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(barraScale, { toValue: 1.0,  duration: 2800, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ])
    ).start();
  }, []);

  const topPad = insets.top > 0 ? insets.top : 44;
  const btnBottom = insets.bottom > 0 ? insets.bottom + 24 : 52;

  return (
    <View style={styles.root}>
      <WebParticles />

      {/* ── Great Barrier Reef aerial background ── */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: gbrOpacity }]}>
        <Image source={GBR_IMG} style={styles.gbrImg} resizeMode="cover" />
        <LinearGradient
          colors={["transparent", "rgba(10,22,40,0.65)", BG]}
          locations={[0, 0.52, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* ── Barra hero image (bottom half) ── */}
      <View style={styles.barraContainer}>
        <Animated.Image
          source={BARRA}
          style={[styles.barraImg, { transform: [{ scale: barraScale }] }]}
          resizeMode="contain"
        />
        <LinearGradient
          colors={[BG, "transparent"]}
          style={styles.barraFade}
        />
      </View>

      {/* ── Queensland flag (top right) ── */}
      <Animated.View style={[styles.qldFlag, { top: topPad + 12, right: 20, opacity: flagOpacity }]}>
        <Image source={QLD_FLAG} style={{ width: 100, height: 50, borderRadius: 3 }} resizeMode="cover" />
      </Animated.View>

      {/* ── HookVision NQ logo ── */}
      <Animated.View
        style={[
          styles.logo,
          {
            top: H * 0.21,
            left: 0, right: 0,
            alignItems: "center",
            opacity: logoOpacity,
            transform: [{ translateY: logoY }],
          },
        ]}
      >
        <Image source={HV_LOGO} style={{ width: W * 0.68, height: W * 0.28 }} resizeMode="contain" />
        <Animated.Text style={[styles.tagline, { opacity: textOpacity }]}>
          NORTH QUEENSLAND EDITION
        </Animated.Text>
        <Animated.Text style={[styles.subtitle, { opacity: textOpacity, marginTop: 6 }]}>
          GULF COUNTRY  ·  GREAT BARRIER REEF  ·  CAPE YORK
        </Animated.Text>
      </Animated.View>

      {/* ── Enter Gulf button ── */}
      <Animated.View
        style={[styles.btnWrap, { bottom: btnBottom, opacity: btnOpacity }]}
      >
        <Pressable
          style={({ pressed }) => [styles.enterBtn, pressed && styles.enterBtnPressed]}
          onPress={() => router.replace("/(tabs)/home")}
        >
          <LinearGradient
            colors={[TEAL, "#00b894"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.enterGradient}
          >
            <Text style={styles.enterText}>ENTER THE GULF</Text>
            <Text style={styles.enterArrow}>→</Text>
          </LinearGradient>
        </Pressable>
        <Text style={styles.regionLabel}>QLD Fisheries · Gulf Country · GBR</Text>
      </Animated.View>

      {/* ── Gold corner marks ── */}
      <View style={[styles.corner, { top: topPad + 16, left: 16 }]}>
        <View style={[styles.cornerH, { backgroundColor: GOLD }]} />
        <View style={[styles.cornerV, { backgroundColor: GOLD }]} />
      </View>
      <View style={[styles.corner, { bottom: btnBottom + 74, left: 16 }]}>
        <View style={[styles.cornerH, { backgroundColor: GOLD, bottom: 0, top: "auto" }]} />
        <View style={[styles.cornerV, { backgroundColor: GOLD, bottom: 0, top: "auto" }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  gbrImg: { position: "absolute", top: 0, left: 0, width: W, height: H * 0.62 },

  barraContainer: { position: "absolute", bottom: 0, left: 0, width: W, height: H * 0.52 },
  barraImg: { width: "100%", height: "100%" },
  barraFade: { position: "absolute", top: 0, left: 0, right: 0, height: H * 0.28 },

  qldFlag: { position: "absolute", borderRadius: 3, overflow: "hidden" },

  logo: { position: "absolute", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.6, shadowRadius: 16 },

  tagline: {
    fontFamily: "Oswald_700Bold",
    fontSize: 13,
    letterSpacing: 3.5,
    color: TEAL,
    textAlign: "center",
    marginTop: 6,
  },

  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
  },

  btnWrap: { position: "absolute", left: 24, right: 24, alignItems: "center" },
  enterBtn: { width: "100%", borderRadius: 14, overflow: "hidden" },
  enterBtnPressed: { opacity: 0.85 },
  enterGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 18, paddingHorizontal: 24, gap: 10 },
  enterText: { fontSize: 15, fontFamily: "Oswald_700Bold", color: "#000000", letterSpacing: 2.5 },
  enterArrow: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#000000" },

  regionLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    letterSpacing: 2,
    color: "rgba(255,255,255,0.45)",
    textAlign: "center",
    marginTop: 10,
  },

  corner: { position: "absolute", width: 18, height: 18 },
  cornerH: { position: "absolute", top: 0, left: 0, width: 18, height: 2 },
  cornerV: { position: "absolute", top: 0, left: 0, width: 2, height: 18 },
});
