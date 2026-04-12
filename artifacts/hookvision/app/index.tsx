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

const BUFFALO = require("@/assets/images/splash-buffalo.png");
const BARRA = require("@/assets/images/splash-barra.png");

const BG = "#0a1628";
const TEAL = "#00d4aa";
const GOLD = "#ffd700";

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(30)).current;
  const tagOpacity = useRef(new Animated.Value(0)).current;
  const btnOpacity = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(0.9)).current;
  const barraY = useRef(new Animated.Value(60)).current;
  const barraOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(barraOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(barraY, { toValue: 0, duration: 750, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(150),
        Animated.parallel([
          Animated.timing(titleOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(titleY, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(tagOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(300),
        Animated.parallel([
          Animated.timing(btnOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.spring(btnScale, { toValue: 1, tension: 120, friction: 8, useNativeDriver: true }),
        ]),
      ]),
    ]).start();
  }, []);

  const enter = () => {
    router.replace("/(tabs)");
  };

  const topPad = Platform.OS === "web" ? 0 : insets.top;

  return (
    <View style={styles.root}>
      {/* ── Buffalo image — top half ── */}
      <Image
        source={BUFFALO}
        style={styles.buffaloImg}
        resizeMode="cover"
      />

      {/* Fade buffalo into dark center */}
      <LinearGradient
        colors={["transparent", BG]}
        style={styles.buffaloFade}
        pointerEvents="none"
      />

      {/* ── Barra image — bottom half, slides up on load ── */}
      <Animated.View
        style={[
          styles.barraContainer,
          { opacity: barraOpacity, transform: [{ translateY: barraY }] },
        ]}
      >
        <Image
          source={BARRA}
          style={styles.barraImg}
          resizeMode="cover"
        />
        {/* Fade barra into dark center */}
        <LinearGradient
          colors={[BG, "transparent", "transparent"]}
          locations={[0, 0.35, 1]}
          style={styles.barraFade}
          pointerEvents="none"
        />
      </Animated.View>

      {/* ── Full dark gradient overlay for center readability ── */}
      <LinearGradient
        colors={["transparent", `${BG}cc`, `${BG}ee`, `${BG}cc`, "transparent"]}
        locations={[0.25, 0.4, 0.5, 0.62, 0.78]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* ── Branding — center ── */}
      <View style={[styles.brandCenter, { top: topPad }]}>
        <Animated.View
          style={[styles.brandBlock, { opacity: titleOpacity, transform: [{ translateY: titleY }] }]}
        >
          <Text style={styles.title}>HOOKVISION</Text>
        </Animated.View>
      </View>

      {/* ── Enter button — bottom ── */}
      <Animated.View
        style={[
          styles.btnWrap,
          {
            bottom: Math.max(insets.bottom + 40, 56),
            opacity: btnOpacity,
            transform: [{ scale: btnScale }],
          },
        ]}
      >
        <Pressable
          style={({ pressed }) => [styles.enterBtn, pressed && styles.enterBtnPressed]}
          onPress={enter}
        >
          <LinearGradient
            colors={[TEAL, "#00a8d4"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.enterGradient}
          >
            <Text style={styles.enterText}>ENTER THE TERRITORY</Text>
            <Text style={styles.enterArrow}>→</Text>
          </LinearGradient>
        </Pressable>
        <Text style={styles.versionTag}>Northern Territory · Australia</Text>
      </Animated.View>

      {/* ── Gold accent corner marks ── */}
      <View style={[styles.corner, styles.cornerTL, { top: topPad + 16, left: 16 }]}>
        <View style={[styles.cornerH, { backgroundColor: GOLD }]} />
        <View style={[styles.cornerV, { backgroundColor: GOLD }]} />
      </View>
      <View style={[styles.corner, styles.cornerTR, { top: topPad + 16, right: 16 }]}>
        <View style={[styles.cornerH, { backgroundColor: GOLD }]} />
        <View style={[styles.cornerV, { backgroundColor: GOLD }]} />
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
    objectFit: "cover",
  },
  barraFade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: H * 0.32,
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
  brandBlock: {
    alignItems: "center",
    gap: 6,
  },
  lineAccent: {
    width: 48,
    height: 3,
    backgroundColor: GOLD,
    borderRadius: 2,
    marginBottom: 6,
  },
  eyebrow: {
    fontSize: 11,
    color: TEAL,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 3,
  },
  title: {
    fontSize: 52,
    color: "#ffffff",
    fontFamily: "Oswald_700Bold",
    letterSpacing: 6,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  tagline: {
    fontSize: 10,
    color: "#aac8d8",
    fontFamily: "Inter_500Medium",
    letterSpacing: 1.5,
    marginTop: 4,
  },

  btnWrap: {
    position: "absolute",
    left: 24,
    right: 24,
    alignItems: "center",
    gap: 10,
  },
  enterBtn: {
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: TEAL,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
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
  versionTag: {
    fontSize: 11,
    color: "#506070",
    fontFamily: "Inter_400Regular",
    letterSpacing: 1,
  },

  corner: {
    position: "absolute",
    width: 18,
    height: 18,
  },
  cornerTL: {},
  cornerTR: {},
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
