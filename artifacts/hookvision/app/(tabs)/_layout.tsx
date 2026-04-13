import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";

import { useColors } from "@/hooks/useColors";

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="home">
        <Icon sf={{ default: "house", selected: "house.fill" }} />
        <Label>Home</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "waveform", selected: "waveform" }} />
        <Label>Analyze</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="buff">
        <Icon sf={{ default: "bag.fill", selected: "bag.fill" }} />
        <Label>Boof</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="live">
        <Icon sf={{ default: "camera.viewfinder", selected: "camera.viewfinder" }} />
        <Label>Live</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="tides">
        <Icon sf={{ default: "water.waves", selected: "water.waves" }} />
        <Label>Tides</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="species">
        <Icon sf={{ default: "fish", selected: "fish.fill" }} />
        <Label>Species</Label>
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
      <NativeTabs.Trigger name="demo">
        <Icon sf={{ default: "photo.on.rectangle", selected: "photo.on.rectangle.angled" }} />
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
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#00d4aa",
        tabBarInactiveTintColor: "#556677",
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "#0a1628",
          borderTopWidth: 2,
          borderTopColor: "#00d4aa44",
          elevation: 8,
          shadowColor: "#00d4aa",
          shadowOpacity: 0.15,
          shadowOffset: { width: 0, height: -2 },
          height: isWeb ? 60 : 58,
        },
        tabBarBackground: () => null,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700", marginBottom: 2 },
        tabBarIconStyle: { marginTop: 4 },
      }}
    >
      {/* ── 5 primary tabs always visible ── */}
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: "Scan",
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="fish" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="buff"
        options={{
          title: "Boof",
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="shopping" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: "Live",
          tabBarIcon: ({ color }) => (
            <Feather name="video" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: "Intel",
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="brain" size={24} color={color} />
          ),
        }}
      />

      {/* ── All other screens — navigable via home tiles, hidden from tab bar ── */}
      <Tabs.Screen name="tides"    options={{ href: null }} />
      <Tabs.Screen name="species"  options={{ href: null }} />
      <Tabs.Screen name="barra"    options={{ href: null }} />
      <Tabs.Screen name="zones"    options={{ href: null }} />
      <Tabs.Screen name="forecast" options={{ href: null }} />
      <Tabs.Screen name="fishy"    options={{ href: null }} />
      <Tabs.Screen name="demo"     options={{ href: null }} />
      <Tabs.Screen name="history"  options={{ href: null }} />
      <Tabs.Screen name="map"      options={{ href: null }} />
    </Tabs>
  );
}

export default function TabLayout() {
  if (Platform.OS === "ios" && isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
