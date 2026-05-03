import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

export function OfflineBanner() {
  const { isOnline, cameraWifiMode } = useNetworkStatus();
  const { top } = useSafeAreaInsets();

  if (isOnline) return null;

  const bgColor = cameraWifiMode ? "#92400e" : "#b91c1c";
  const icon    = cameraWifiMode ? "camera"  : "wifi-off";
  const message = cameraWifiMode
    ? "Camera WiFi active · AI Brain paused · disconnect to restore"
    : "Weak signal · AI retrying automatically";

  return (
    <View style={[styles.banner, { paddingTop: top + 6, backgroundColor: bgColor }]}>
      <Feather name={icon as any} size={12} color="#fff" />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingBottom: 6,
    zIndex: 9999,
    elevation: 20,
    pointerEvents: "none",
  } as any,
  text: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
});
