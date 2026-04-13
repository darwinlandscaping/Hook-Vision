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
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const isAndroid = Platform.OS === "android";

  return (
    <Tabs
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
          ...(isAndroid ? { height: 62, paddingBottom: 6 } : {}),
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
        name="index"
        options={{
          title: "Analyze",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="waveform" tintColor={color} size={22} />
            ) : (
              <MaterialCommunityIcons name="radar" size={22} color={color} />
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
          href: isAndroid ? null : undefined,
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
        name="demo"
        options={{
          title: "Demo",
          href: isAndroid ? null : undefined,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="photo.on.rectangle" tintColor={color} size={22} />
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
      {/* Hidden screen — accessible from Intel tab map button */}
      <Tabs.Screen name="map" options={{ href: null }} />
    </Tabs>
  );
}

export default function TabLayout() {
  if (Platform.OS === "ios" && isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
