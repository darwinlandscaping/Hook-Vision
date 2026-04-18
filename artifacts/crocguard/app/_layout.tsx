// Must import backgroundMonitor at module level so TaskManager.defineTask() runs
// before any component mounts. This is required by expo-task-manager.
import "@/lib/backgroundMonitor";

import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { registerBackgroundMonitor } from "@/lib/backgroundMonitor";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
    // Register background fetch task + request notification permissions.
    // Runs once on app launch. Safe to call multiple times (no-ops if already registered).
    registerBackgroundMonitor();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <GestureHandlerRootView style={styles.root}>
        <SettingsProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
        </SettingsProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0d1f0f" },
});
