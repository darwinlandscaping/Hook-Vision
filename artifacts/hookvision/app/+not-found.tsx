import { Stack, useRouter } from "expo-router";
import React, { useEffect } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

export default function NotFoundScreen() {
  const colors = useColors();
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      console.log("[WA] +not-found shown — pathname:", window.location.pathname);
      const timer = setTimeout(() => {
        router.replace("/(tabs)/home");
      }, 50);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <>
      <Stack.Screen options={{ title: "Loading…" }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Loading…</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
});
