import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import {
  Oswald_400Regular,
  Oswald_700Bold,
} from "@expo-google-fonts/oswald";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GoldenHourOverlay } from "@/components/GoldenHourOverlay";
import { OfflineBanner } from "@/components/OfflineBanner";
import { HistoryProvider } from "@/context/HistoryContext";
import { NarratorProvider } from "@/context/NarratorContext";
import { RiverScanProvider } from "@/context/RiverScanContext";
import { getApiBaseUrl } from "@/utils/apiBase";
import { setBaseUrl } from "@workspace/api-client-react";

setBaseUrl(getApiBaseUrl());

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false, animation: "none" }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Oswald_400Regular,
    Oswald_700Bold,
  });
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 5000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError || timedOut) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, timedOut]);

  if (!fontsLoaded && !fontError && !timedOut) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0a1628", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#00d4ff" />
        <Text style={{ color: "#ffd700", marginTop: 16, fontSize: 14, letterSpacing: 2 }}>LOADING…</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          {/*
           * Wrap nav + overlay in a single positioned container.
           * GoldenHourOverlay comes AFTER GestureHandlerRootView in DOM order,
           * so it naturally sits on top without z-index competition.
           */}
          <View style={styles.root}>
            <GestureHandlerRootView style={styles.root}>
              <NarratorProvider>
                <HistoryProvider>
                  <RiverScanProvider>
                    <RootLayoutNav />
                  </RiverScanProvider>
                </HistoryProvider>
              </NarratorProvider>
            </GestureHandlerRootView>

            {/* Overlay renders after nav in DOM → always on top, no z-index battle */}
            <GoldenHourOverlay />
            <OfflineBanner />
          </View>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
