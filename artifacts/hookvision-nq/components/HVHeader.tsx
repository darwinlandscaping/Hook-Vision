import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

const LOGO = require("@/assets/images/hv-logo2-nobg.png");

const BUILD_TAG = "28 APR";

interface HVHeaderProps {
  subtitle?: string;
}

export function HVHeader({ subtitle }: HVHeaderProps) {
  return (
    <View style={styles.container}>
      <Image source={LOGO} style={styles.logo} resizeMode="contain" />
      {subtitle ? (
        <Text style={styles.subtitle}>{subtitle}</Text>
      ) : null}
      <View style={styles.bar} />
      <Text style={styles.build}>BUILD {BUILD_TAG}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingTop: 4,
    paddingBottom: 6,
    gap: 2,
  },
  logo: {
    width: 160,
    height: 44,
  },
  subtitle: {
    fontSize: 9,
    color: "#00d4aa",
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginTop: 1,
  },
  bar: {
    height: 2,
    width: 50,
    borderRadius: 1,
    backgroundColor: "#00d4aa",
    marginTop: 4,
  },
  build: {
    fontSize: 8,
    color: "#00d4aa44",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginTop: 1,
  },
});
