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

const BARRA   = require("@/assets/images/splash-barra.png");
const HV_LOGO = require("@/assets/images/hv-logo2-nobg.png");
const NT_FLAG = require("@/assets/images/nt-flag-real.png");

const BG     = "#0a1628";
const TEAL   = "#00d4aa";
const GOLD   = "#ffd700";
const RED    = "#e63329";

const CHIPS = [
  { label: "SONAR AI",    icon: "📡" },
  { label: "BARRA BRAIN", icon: "🐟" },
  { label: "TIDE INTEL",  icon: "🌊" },
];

// ── Water particles (deterministic) ──────────────────────────────────────────
const SPLASH_X = W * 0.5;
const SPLASH_Y = H * 0.33;

const WATER = [
  { dx:  90, dy:-115, size:13, dur: 900, delay:   0 },
  { dx: -70, dy: -98, size:10, dur: 850, delay: 110 },
  { dx: 120, dy: -62, size:15, dur: 800, delay: 220 },
  { dx:-108, dy: -78, size:12, dur: 950, delay:  55 },
  { dx:  40, dy:-145, size:10, dur: 750, delay: 170 },
  { dx: -46, dy:-133, size: 9, dur: 820, delay: 300 },
  { dx:  76, dy: -52, size:14, dur: 780, delay:  90 },
  { dx: -82, dy: -47, size:11, dur: 870, delay: 200 },
  { dx: 142, dy: -88, size: 9, dur: 730, delay: 360 },
  { dx:-133, dy: -92, size:10, dur: 810, delay: 270 },
  { dx:  56, dy:-158, size: 8, dur: 700, delay: 430 },
  { dx: -51, dy:-148, size: 8, dur: 760, delay: 490 },
];

function injectParticleCSS() {
  if (typeof document === "undefined") return;
  if (document.getElementById("hv-particles-v2")) return;
  const css = WATER.map((p, i) => `
    @keyframes wd${i} {
      0%   { transform:translate(0,0) scale(1); opacity:0; }
      12%  { opacity:0.95; }
      75%  { opacity:0.8; }
      100% { transform:translate(${p.dx}px,${p.dy+65}px) scale(0.35); opacity:0; }
    }
    .wd${i} {
      position:absolute;
      left:${SPLASH_X - p.size/2}px; top:${SPLASH_Y - p.size/2}px;
      width:${p.size}px; height:${p.size}px; border-radius:50%;
      background:${i%3===0?"rgba(255,255,255,0.98)":i%3===1?"rgba(180,240,255,0.88)":"rgba(0,212,170,0.75)"};
      animation:wd${i} ${p.dur}ms cubic-bezier(.25,.46,.45,.94) ${p.delay}ms infinite;
      pointer-events:none;
    }
  `).join("\n");
  const tag = document.createElement("style");
  tag.id = "hv-particles-v2";
  tag.textContent = css;
  document.head.appendChild(tag);
}

function WebParticles() {
  useEffect(() => { injectParticleCSS(); }, []);
  if (Platform.OS !== "web" || typeof document === "undefined") return null;
  return (
    // @ts-ignore
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:99 }}>
      {WATER.map((_, i) => <div key={`w${i}`} className={`wd${i}`} />)}
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const WEB = Platform.OS === "web";

  const heroOpacity    = useRef(new Animated.Value(WEB ? 1 : 0)).current;
  const overlayOpacity = useRef(new Animated.Value(WEB ? 1 : 0)).current;
  const topBarOpacity  = useRef(new Animated.Value(WEB ? 1 : 0)).current;
  const logoOpacity    = useRef(new Animated.Value(WEB ? 1 : 0)).current;
  const logoY          = useRef(new Animated.Value(0)).current;
  const dividerScaleX  = useRef(new Animated.Value(WEB ? 1 : 0)).current;
  const chipsOpacity   = useRef(new Animated.Value(WEB ? 1 : 0)).current;
  const chipsY         = useRef(new Animated.Value(0)).current;
  const btnOpacity     = useRef(new Animated.Value(WEB ? 1 : 0)).current;
  const btnScale       = useRef(new Animated.Value(WEB ? 1 : 0.88)).current;
  const shimmer        = useRef(new Animated.Value(0)).current;
  const scanLine       = useRef(new Animated.Value(0)).current;
  const redPulse       = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const startLoops = () => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(1800),
          Animated.timing(shimmer, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(shimmer, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLine, { toValue: 1, duration: 3200, easing: Easing.linear, useNativeDriver: true }),
          Animated.delay(1200),
          Animated.timing(scanLine, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(redPulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(redPulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ).start();
    };

    if (WEB) {
      // Web: skip stagger, everything is already visible — just run loops
      startLoops();
    } else {
      // Native: full cinematic stagger sequence
      Animated.sequence([
        Animated.timing(heroOpacity, { toValue: 1, duration: 550, useNativeDriver: true }),
        Animated.parallel([
          Animated.timing(overlayOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
          Animated.timing(topBarOpacity,  { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(logoOpacity,   { toValue: 1, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(logoY,         { toValue: 0, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(dividerScaleX, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(chipsOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
          Animated.timing(chipsY,       { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(btnOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.spring(btnScale,   { toValue: 1, tension: 140, friction: 7, useNativeDriver: true }),
        ]),
      ]).start(startLoops);
    }
  }, []);

  const enter  = () => router.replace("/(tabs)/home");
  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const logoW  = Math.min(W - 48, 320);
  const logoH  = logoW * (9 / 16);

  const scanY    = scanLine.interpolate({ inputRange: [0, 1], outputRange: [0, H] });
  const shimmerX = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-W * 0.5, W * 1.5] });
  const dotScale = redPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const dotAlpha = redPulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0.4] });

  const btnBottom = insets.bottom > 0 ? insets.bottom + 20 : 36;
  const btmBottom = insets.bottom > 0 ? insets.bottom + 4  : 12;

  return (
    <View style={styles.root}>

      {/* ── Full-screen hero photo ── */}
      <Animated.Image
        source={BARRA}
        style={[StyleSheet.absoluteFill, { opacity: heroOpacity }]}
        resizeMode="cover"
      />

      {/* ── Cinematic gradient overlays ── */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: overlayOpacity }]} pointerEvents="none">
        <LinearGradient
          colors={[`${BG}e0`, `${BG}88`, "transparent"]}
          locations={[0, 0.22, 0.52]}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={["transparent", `${BG}aa`, `${BG}f5`, BG]}
          locations={[0.38, 0.60, 0.78, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* ── HUD scan line ── */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute", left: 0, right: 0, height: 1.5,
          backgroundColor: `${TEAL}55`,
          transform: [{ translateY: scanY }],
        }}
      />

      {/* ── Water particles (web) ── */}
      <WebParticles />

      {/* ════════════════════════════════════════════
          TOP HUD BAR
      ════════════════════════════════════════════ */}
      <Animated.View style={[styles.topBar, { top: topPad + 14, opacity: topBarOpacity }]}>
        {/* Darwin coordinates */}
        <View style={styles.coordBlock}>
          <View style={styles.reticleCorner} />
          <Text style={styles.coordText}>12.46°S  131.03°E</Text>
        </View>

        {/* Centre territory badge */}
        <View style={styles.territoryPill}>
          <Animated.View style={[styles.liveRed, { transform: [{ scale: dotScale }], opacity: dotAlpha }]} />
          <Text style={styles.territoryText}>NORTHERN TERRITORY</Text>
        </View>

        {/* NT flag */}
        <Image source={NT_FLAG} style={styles.ntFlag} resizeMode="cover" />
      </Animated.View>

      {/* ════════════════════════════════════════════
          LOGO SECTION
      ════════════════════════════════════════════ */}
      {/* Divider — scales in from centre */}
      <Animated.View style={[styles.dividerRow, { top: H * 0.555, transform: [{ scaleX: dividerScaleX }] }]}>
        <View style={[styles.divLine, { backgroundColor: RED }]} />
        <View style={[styles.divDiamond, { backgroundColor: GOLD }]} />
        <View style={[styles.divLine, { flex: 2.5, backgroundColor: GOLD }]} />
        <View style={[styles.divDiamond, { backgroundColor: RED }]} />
        <View style={[styles.divLine, { backgroundColor: RED }]} />
      </Animated.View>

      {/* Logo + tagline */}
      <Animated.View style={[styles.logoBlock, { top: H * 0.565, opacity: logoOpacity, transform: [{ translateY: logoY }] }]}>
        <Image source={HV_LOGO} style={{ width: logoW, height: logoH }} resizeMode="contain" />
        <Text style={styles.tagline}>AUSTRALIA'S PREMIER AI FISHING GUIDE</Text>
      </Animated.View>

      {/* ════════════════════════════════════════════
          FEATURE CHIPS
      ════════════════════════════════════════════ */}
      <Animated.View style={[styles.chipsRow, { top: H * 0.755, opacity: chipsOpacity, transform: [{ translateY: chipsY }] }]}>
        {CHIPS.map((c, i) => (
          <View key={i} style={[styles.chip, i === 1 && styles.chipGold]}>
            <Text style={styles.chipIcon}>{c.icon}</Text>
            <Text style={[styles.chipLabel, i === 1 && { color: GOLD }]}>{c.label}</Text>
          </View>
        ))}
      </Animated.View>

      {/* ════════════════════════════════════════════
          CTA BUTTON
      ════════════════════════════════════════════ */}
      <Animated.View style={[styles.btnWrap, { bottom: btnBottom, opacity: btnOpacity, transform: [{ scale: btnScale }] }]}>
        <Pressable
          style={({ pressed }) => [styles.enterBtn, pressed && { opacity: 0.82 }]}
          onPress={enter}
        >
          {/* Dark teal fill */}
          <LinearGradient
            colors={[`${TEAL}28`, `${TEAL}18`, `${TEAL}08`]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: 5 }]}
          />
          {/* Shimmer sweep */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute", top: 0, bottom: 0, width: 90,
              backgroundColor: "rgba(255,255,255,0.07)",
              transform: [{ translateX: shimmerX }, { skewX: "-20deg" }],
            }}
          />
          {/* Button content */}
          <View style={styles.enterInner}>
            <View style={styles.redAccent} />
            <Text style={styles.enterText}>ENTER THE TERRITORY</Text>
            <Text style={styles.enterArrow}>▶</Text>
          </View>
        </Pressable>
      </Animated.View>

      {/* ── Bottom info bar ── */}
      <View style={[styles.btmBar, { bottom: btmBottom }]}>
        <View style={[styles.btmDot, { backgroundColor: RED }]} />
        <Text style={styles.btmTxt}>v1.0</Text>
        <View style={styles.btmSep} />
        <Text style={styles.btmTxt}>NT AUSTRALIA</Text>
        <View style={[styles.btmDot, { backgroundColor: GOLD }]} />
      </View>

      {/* ════════════════════════════════════════════
          CORNER RETICLES  (all four)
      ════════════════════════════════════════════ */}
      {/* top-left */}
      <View style={[styles.rt, { top: topPad + 8, left: 10 }]}>
        <View style={[styles.rtH, { backgroundColor: GOLD }]} />
        <View style={[styles.rtV, { backgroundColor: GOLD }]} />
      </View>
      {/* top-right */}
      <View style={[styles.rt, { top: topPad + 8, right: 10, transform: [{ scaleX: -1 }] }]}>
        <View style={[styles.rtH, { backgroundColor: GOLD }]} />
        <View style={[styles.rtV, { backgroundColor: GOLD }]} />
      </View>
      {/* bottom-left */}
      <View style={[styles.rt, { bottom: (insets.bottom > 0 ? insets.bottom : 0) + 8, left: 10, transform: [{ scaleY: -1 }] }]}>
        <View style={[styles.rtH, { backgroundColor: GOLD }]} />
        <View style={[styles.rtV, { backgroundColor: GOLD }]} />
      </View>
      {/* bottom-right */}
      <View style={[styles.rt, { bottom: (insets.bottom > 0 ? insets.bottom : 0) + 8, right: 10, transform: [{ scaleX: -1 }, { scaleY: -1 }] }]}>
        <View style={[styles.rtH, { backgroundColor: GOLD }]} />
        <View style={[styles.rtV, { backgroundColor: GOLD }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  // ── Top HUD bar
  topBar: {
    position: "absolute", left: 16, right: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  coordBlock:     { flexDirection: "row", alignItems: "center", gap: 5 },
  reticleCorner:  { width: 9, height: 9, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderColor: TEAL },
  coordText:      { fontSize: 9, fontFamily: "Inter_400Regular", color: `${TEAL}cc`, letterSpacing: 1.5 },
  territoryPill:  { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,0,0,0.4)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 0.5, borderColor: "rgba(255,255,255,0.12)" },
  liveRed:        { width: 5, height: 5, borderRadius: 2.5, backgroundColor: RED },
  territoryText:  { fontSize: 8.5, fontFamily: "Oswald_700Bold", color: "rgba(255,255,255,0.92)", letterSpacing: 2.5 },
  ntFlag:         { width: 52, height: 26, borderRadius: 2 },

  // ── Divider
  dividerRow: { position: "absolute", left: 20, right: 20, flexDirection: "row", alignItems: "center", height: 8 },
  divLine:    { flex: 1, height: 1.5, borderRadius: 1 },
  divDiamond: { width: 6, height: 6, borderRadius: 1, transform: [{ rotate: "45deg" }], marginHorizontal: 5 },

  // ── Logo block
  logoBlock: { position: "absolute", left: 0, right: 0, alignItems: "center", paddingHorizontal: 24 },
  tagline:   { fontFamily: "Inter_400Regular", fontSize: 9.5, letterSpacing: 3, color: "rgba(255,255,255,0.6)", textAlign: "center", marginTop: -6 },

  // ── Feature chips
  chipsRow: { position: "absolute", left: 12, right: 12, flexDirection: "row", justifyContent: "center", gap: 7 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingVertical: 6, paddingHorizontal: 10, borderRadius: 5,
    borderWidth: 1, borderColor: `${TEAL}44`,
    backgroundColor: "rgba(10,22,40,0.85)",
  },
  chipGold:  { borderColor: `${GOLD}55` },
  chipIcon:  { fontSize: 10 },
  chipLabel: { fontSize: 8.5, fontFamily: "Oswald_700Bold", color: "rgba(255,255,255,0.82)", letterSpacing: 1.5 },

  // ── CTA Button
  btnWrap: { position: "absolute", left: 18, right: 18 },
  enterBtn: {
    borderWidth: 1.5, borderColor: TEAL, borderRadius: 5, overflow: "hidden",
  },
  enterInner: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 19, paddingHorizontal: 16, gap: 12,
  },
  redAccent: { width: 3, height: 22, backgroundColor: RED, borderRadius: 1.5 },
  enterText: { fontSize: 14, fontFamily: "Oswald_700Bold", color: TEAL, letterSpacing: 3.5 },
  enterArrow:{ fontSize: 10, color: GOLD },

  // ── Bottom info bar
  btmBar: {
    position: "absolute", left: 0, right: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
  },
  btmDot: { width: 4, height: 4, borderRadius: 2 },
  btmSep: { width: 22, height: 1, backgroundColor: "rgba(255,255,255,0.18)" },
  btmTxt: { fontSize: 9, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.38)", letterSpacing: 2.5 },

  // ── Corner reticles
  rt:  { position: "absolute", width: 22, height: 22 },
  rtH: { position: "absolute", top: 0, left: 0, width: 22, height: 2, borderRadius: 1 },
  rtV: { position: "absolute", top: 0, left: 0, width: 2, height: 22, borderRadius: 1 },
});
