/**
 * DemoSonarView — full-screen animated sonar simulation.
 *
 * Cycles through 5 bundled 2D arch sonar images (barra demos 1-5) with
 * a crossfade every 4 seconds and a sweeping green scan line, giving the
 * appearance of a live sonar screen scrolling. Total cycle = ~20 seconds.
 * Mounted in place of the CameraView when BoatDemoStore is active.
 */
import React, { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, StyleSheet, View } from "react-native";

const { width: W } = Dimensions.get("window");

const FRAMES = [
  require("../assets/sonar-demo-1.png"),
  require("../assets/sonar-demo-2.png"),
  require("../assets/sonar-demo-3.png"),
  require("../assets/sonar-demo-4.png"),
  require("../assets/images/sonar-sample.png"), // Kimberley barra school
];

const FRAME_MS = 4000;  // 4 s per frame → 20 s full cycle
const SCAN_MS  = 3200;  // scan-line sweep period

export function DemoSonarView() {
  const [idx, setIdx]   = useState(0);
  const fadeAnim        = useRef(new Animated.Value(1)).current;
  const scanAnim        = useRef(new Animated.Value(0)).current;

  // Continuous sweeping scan line (left → right, loops)
  useEffect(() => {
    let cancelled = false;
    const sweep = () => {
      if (cancelled) return;
      scanAnim.setValue(0);
      Animated.timing(scanAnim, {
        toValue: 1,
        duration: SCAN_MS,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && !cancelled) sweep();
      });
    };
    sweep();
    return () => { cancelled = true; };
  }, [scanAnim]);

  // Frame cycling with brief fade-through
  useEffect(() => {
    const t = setInterval(() => {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0.12, duration: 280, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1,    duration: 480, useNativeDriver: true }),
      ]).start();
      setIdx(i => (i + 1) % FRAMES.length);
    }, FRAME_MS);
    return () => clearInterval(t);
  }, [fadeAnim]);

  const scanX = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-4, W + 4],
  });

  return (
    <View style={styles.root}>
      <Animated.Image
        source={FRAMES[idx]}
        style={[styles.img, { opacity: fadeAnim }]}
        resizeMode="cover"
      />
      {/* Green sonar scan line sweeping right */}
      <Animated.View style={[styles.scanLine, { transform: [{ translateX: scanX }] }]} />
      {/* Subtle depth axis on left edge */}
      <View style={styles.leftEdge} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    overflow: "hidden",
  },
  img: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  scanLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: "rgba(0,255,136,0.55)",
    shadowColor: "#00ff88",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 8,
  },
  leftEdge: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 2,
    backgroundColor: "rgba(0,255,136,0.12)",
  },
});
