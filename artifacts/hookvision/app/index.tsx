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
const CROC_BTN = require("@/assets/images/croc-btn-nobg.png");

const BG   = "#0a1628";
const TEAL = "#00d4aa";
const GOLD = "#ffd700";

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
    ]).start();
  }, []);

  const enter = () => router.replace("/(tabs)");

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

      {/* ── NT Flag — bottom-right corner of logo ── */}
      <Animated.Image
        source={NT_FLAG}
        style={[
          styles.ntFlag,
          {
            top: H * 0.37 + logoH * 0.58,
            right: Math.max((W - logoW) / 2, 16),
            opacity: flagOpacity,
          },
        ]}
        resizeMode="contain"
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

      {/* ── Gold corner marks — bottom-left only (flag occupies top-right) ── */}
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

  brandCenter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
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
