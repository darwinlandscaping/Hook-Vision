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
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GoldenHourOverlay } from "@/components/GoldenHourOverlay";
import { OfflineBanner } from "@/components/OfflineBanner";
import { HistoryProvider } from "@/context/HistoryContext";
import { NarratorProvider } from "@/context/NarratorContext";
import { RiverScanProvider } from "@/context/RiverScanContext";
import { setBaseUrl } from "@workspace/api-client-react";

if (process.env.EXPO_PUBLIC_DOMAIN) {
  setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);
}

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
  useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Oswald_400Regular,
    Oswald_700Bold,
  });

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
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
