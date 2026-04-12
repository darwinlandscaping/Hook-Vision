import React, { useCallback } from "react";
import { TouchableOpacity } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { StyleSheet } from "react-native";

export const LP_BG     = "#0b1d0e";
export const LP_BORDER = "#1f4827";

interface LilyPadCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  borderColor?: string;
  borderLeftColor?: string;
  borderLeftWidth?: number;
  innerStyle?: any;
  style?: any;
}

export function LilyPadCard({
  children,
  onPress,
  borderColor,
  borderLeftColor,
  borderLeftWidth = 3,
  innerStyle,
  style,
}: LilyPadCardProps) {
  const scale  = useSharedValue(1);
  const rotate = useSharedValue(0);

  const wobble = useCallback(() => {
    scale.value = withSequence(
      withTiming(0.968, { duration: 75 }),
      withSpring(1.014, { damping: 4, stiffness: 280 }),
      withSpring(1, { damping: 12 })
    );
    rotate.value = withSequence(
      withTiming(-2.5, { duration: 65 }),
      withTiming(2.5, { duration: 65 }),
      withTiming(-1.2, { duration: 50 }),
      withTiming(1.2, { duration: 50 }),
      withSpring(0, { damping: 14, stiffness: 180 })
    );
    onPress?.();
  }, [onPress]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.lilyPad,
        { borderColor: borderColor ?? LP_BORDER },
        borderLeftColor ? { borderLeftColor, borderLeftWidth } : null,
        animStyle,
        style,
      ]}
    >
      <TouchableOpacity onPress={wobble} activeOpacity={0.92} style={innerStyle}>
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  lilyPad: {
    borderRadius: 22,
    borderWidth: 1.5,
    backgroundColor: LP_BG,
    overflow: "hidden",
  },
});
