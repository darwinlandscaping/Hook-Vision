import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface SonarPulseProps {
  size?: number;
  active?: boolean;
}

export function SonarPulse({ size = 120, active = true }: SonarPulseProps) {
  const colors = useColors();
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      ring1.setValue(0);
      ring2.setValue(0);
      ring3.setValue(0);
      return;
    }

    const animate = (ring: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(ring, {
            toValue: 1,
            duration: 2000,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(ring, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );

    const a1 = animate(ring1, 0);
    const a2 = animate(ring2, 600);
    const a3 = animate(ring3, 1200);

    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [active, ring1, ring2, ring3]);

  const getRingStyle = (ring: Animated.Value) => ({
    opacity: ring.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.8, 0.4, 0] }),
    transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }],
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {[ring1, ring2, ring3].map((ring, i) => (
        <Animated.View
          key={i}
          style={[
            styles.ring,
            { width: size, height: size, borderRadius: size / 2, borderColor: colors.primary },
            getRingStyle(ring),
          ]}
        />
      ))}
      <View
        style={[
          styles.core,
          {
            width: size * 0.22,
            height: size * 0.22,
            borderRadius: size * 0.11,
            backgroundColor: colors.primary,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    borderWidth: 1.5,
  },
  core: {
    shadowColor: "#00d4aa",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 8,
  },
});
