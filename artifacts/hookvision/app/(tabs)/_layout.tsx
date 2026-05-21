import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useRef } from "react";
import { Platform, PanResponder, StyleSheet, View, useColorScheme } from "react-native";
import { useRouter, usePathname } from "expo-router";

import { useColors } from "@/hooks/useColors";
import { CrocTabBar } from "@/components/CrocTabBar";
import { Insta360Provider } from "@/contexts/Insta360Context";

// Ordered list of all tab route names (must match Tabs.Screen order below)
// insta360 is hidden from tab bar (accessed via Live tab chip)
const TAB_ROUTES = [
  "live", "home", "buff", "tides", "species", "hud",
  "barra", "zones", "forecast", "catchid", "demo", "history", "community", "smartlife", "cameras",
] as const;

function tabPath(name: string) {
  return name === "index" ? "/" : `/${name}`;
}

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="live">
        <Icon sf={{ default: "camera.viewfinder", selected: "camera.viewfinder" }} />
        <Label>Live</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="home">
        <Icon sf={{ default: "house", selected: "house.fill" }} />
        <Label>Home</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="buff">
        <Icon sf={{ default: "bag.fill", selected: "bag.fill" }} />
        <Label>Boof</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="tides">
        <Icon sf={{ default: "water.waves", selected: "water.waves" }} />
        <Label>Tides</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="species">
        <Icon sf={{ default: "fish", selected: "fish.fill" }} />
        <Label>Species</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="hud">
        <Icon sf={{ default: "arrow.up.circle.fill", selected: "arrow.up.circle.fill" }} />
        <Label>Cast HUD</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="barra">
        <Icon sf={{ default: "target", selected: "target" }} />
        <Label>Big Barra</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="zones">
        <Icon sf={{ default: "chart.bar.fill", selected: "chart.bar.fill" }} />
        <Label>Zones</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="forecast">
        <Icon sf={{ default: "fish.fill", selected: "fish.fill" }} />
        <Label>Fishy</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="catchid">
        <Icon sf={{ default: "camera.viewfinder", selected: "camera.viewfinder" }} />
        <Label>Catch ID</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="demo">
        <Icon sf={{ default: "photo.on.rectangle.angled", selected: "photo.on.rectangle.angled" }} />
        <Label>Demo</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <Icon sf={{ default: "clock", selected: "clock.fill" }} />
        <Label>History</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="community">
        <Icon sf={{ default: "brain.head.profile", selected: "brain.head.profile" }} />
        <Label>Intel</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="smartlife">
        <Icon sf={{ default: "video.badge.waveform", selected: "video.badge.waveform.fill" }} />
        <Label>SmartCam</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="cameras">
        <Icon sf={{ default: "camera.on.rectangle", selected: "camera.on.rectangle.fill" }} />
        <Label>360° Cams</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const isAndroid = Platform.OS === "android";
  const router = useRouter();
  const pathname = usePathname();

  // Keep a mutable ref so the PanResponder closure always sees the latest route
  const routeRef = useRef(pathname);
  routeRef.current = pathname;

  const panResponder = useRef(
    PanResponder.create({
      // Only claim the gesture for clear horizontal swipes
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 20 && Math.abs(gs.dx) > Math.abs(gs.dy) * 2.5,
      onPanResponderRelease: (_, gs) => {
        if (Math.abs(gs.dx) < 50) return;            // too short — ignore
        const seg = routeRef.current.replace(/^\//, "") || "index";
        const idx = TAB_ROUTES.indexOf(seg as typeof TAB_ROUTES[number]);
        if (idx === -1) return;
        if (gs.dx < 0 && idx < TAB_ROUTES.length - 1) {
          router.navigate(tabPath(TAB_ROUTES[idx + 1]) as any);   // swipe left → next
        } else if (gs.dx > 0 && idx > 0) {
          router.navigate(tabPath(TAB_ROUTES[idx - 1]) as any);   // swipe right → prev
        }
      },
    })
  ).current;

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
    <Tabs
      tabBar={(props) => <CrocTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.background,
          borderTopWidth: 2,
          borderTopColor: "#00d4aa",
          elevation: 0,
          ...(isWeb  ? { height: 60 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={90}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]}
            />
          ) : null,
        tabBarLabelStyle: { fontSize: 9, fontFamily: "Inter_500Medium" },
        tabBarIconStyle: { marginBottom: -2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Scan" }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: "Live",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="camera.viewfinder" tintColor={color} size={22} />
            ) : (
              <Feather name="video" size={22} color={color} />
            ),
        }}
      />
      {/* 360° screen — navigated to from Live tab chip, not in tab bar */}
      <Tabs.Screen name="insta360" options={{ href: null }} />
      {/* Subscription screen — navigated from Home, not in tab bar */}
      <Tabs.Screen name="subscription" options={{ href: null }} />
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="house.fill" tintColor={color} size={22} />
            ) : (
              <Feather name="home" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="buff"
        options={{
          title: "Boof",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="bag.fill" tintColor={color} size={22} />
            ) : (
              <MaterialCommunityIcons name="shopping" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="tides"
        options={{
          title: "Tides",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="water.waves" tintColor={color} size={22} />
            ) : (
              <Feather name="activity" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="species"
        options={{
          title: "Species",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="fish" tintColor={color} size={22} />
            ) : (
              <MaterialCommunityIcons name="fish" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="hud"
        options={{
          title: "Cast HUD",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="arrow.up.circle.fill" tintColor={color} size={22} />
            ) : (
              <MaterialCommunityIcons name="compass-rose" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="barra"
        options={{
          title: "Barra",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="target" tintColor={color} size={22} />
            ) : (
              <MaterialCommunityIcons name="crosshairs-gps" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="zones"
        options={{
          title: "Zones",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="chart.bar.fill" tintColor={color} size={22} />
            ) : (
              <MaterialCommunityIcons name="chart-bar" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="forecast"
        options={{
          title: "Fishy",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="fish.fill" tintColor={color} size={22} />
            ) : (
              <MaterialCommunityIcons name="weather-windy" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="fishy"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="catchid"
        options={{
          title: "Catch ID",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="camera.viewfinder" tintColor={color} size={22} />
            ) : (
              <MaterialCommunityIcons name="camera-iris" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="demo"
        options={{
          title: "Demo",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="photo.on.rectangle.angled" tintColor={color} size={22} />
            ) : (
              <MaterialCommunityIcons name="image-multiple" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="clock" tintColor={color} size={22} />
            ) : (
              <Feather name="clock" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: "Intel",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="brain.head.profile" tintColor={color} size={22} />
            ) : (
              <MaterialCommunityIcons name="brain" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="smartlife"
        options={{
          title: "SmartCam",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="video.badge.waveform" tintColor={color} size={22} />
            ) : (
              <MaterialCommunityIcons name="cctv" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="cameras"
        options={{
          title: "360° Cams",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="camera.on.rectangle" tintColor={color} size={22} />
            ) : (
              <MaterialCommunityIcons name="rotate-360" size={22} color={color} />
            ),
        }}
      />
      {/* Hidden screens */}
      <Tabs.Screen name="web" options={{ href: null }} />
      <Tabs.Screen name="map" options={{ href: null }} />
    </Tabs>
    </View>
  );
}

export default function TabLayout() {
  const inner =
    Platform.OS === "ios" && isLiquidGlassAvailable()
      ? <NativeTabLayout />
      : <ClassicTabLayout />;
  return <Insta360Provider>{inner}</Insta360Provider>;
}
