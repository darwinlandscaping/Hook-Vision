import { Tabs } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";

const TAB_BAR_BG = "#0d1f0f";
const ACTIVE = "#22c55e";
const INACTIVE = "#4b7a52";
const BORDER = "#166534";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: {
          backgroundColor: TAB_BAR_BG,
          borderTopWidth: 1,
          borderTopColor: BORDER,
          elevation: 0,
          ...(Platform.OS === "web" ? { height: 60 } : {}),
        },
        tabBarBackground: () => (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: TAB_BAR_BG }]} />
        ),
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Status",
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="shield-alert" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="cameras"
        options={{
          title: "Cameras",
          tabBarIcon: ({ color }) => (
            <Feather name="video" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: "Alerts",
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="bell-alert" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => (
            <Feather name="settings" size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
