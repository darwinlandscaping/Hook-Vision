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
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "waveform", selected: "waveform" }} />
        <Label>Analyze</Label>
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
      <NativeTabs.Trigger name="zones">
        <Icon sf={{ default: "chart.bar.fill", selected: "chart.bar.fill" }} />
        <Label>Zones</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="forecast">
        <Icon sf={{ default: "fish.fill", selected: "fish.fill" }} />
        <Label>Fishy</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <Icon sf={{ default: "clock", selected: "clock.fill" }} />
        <Label>History</Label>
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
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
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
        tabBarLabelStyle: { fontSize: 10, fontFamily: "Inter_500Medium" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Analyze",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="waveform" tintColor={color} size={22} />
            ) : (
              <MaterialCommunityIcons name="fish" size={22} color={color} />
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
              <MaterialCommunityIcons name="fish" size={22} color={color} />
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
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
