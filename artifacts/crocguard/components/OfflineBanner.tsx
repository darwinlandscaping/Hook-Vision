import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text } from "react-native";

export function OfflineBanner({ visible }: { visible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  return (
    <Animated.View style={[styles.banner, { opacity }]} pointerEvents="none">
      <Text style={styles.text}>⚠ Device Offline — Reconnecting…</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#7f1d1d",
    paddingVertical: 10,
    paddingHorizontal: 16,
    zIndex: 99,
    alignItems: "center",
  },
  text: {
    color: "#fecaca",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
});
