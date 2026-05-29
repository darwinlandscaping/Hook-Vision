/**
 * CrocTabBar — 2-row croc-mouth navigation bar.
 * Auto-balances the visible routes across both rows so every screen
 * remains reachable from the bottom bar as tabs are added or removed.
 */
import React from "react";
// @ts-ignore — types bundled with expo-router at runtime
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { View, TouchableOpacity, Text, StyleSheet, useWindowDimensions } from "react-native";
import Svg, {
  Defs, LinearGradient, RadialGradient, Stop,
  Rect, Path, Ellipse,
} from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

// ─── Palette ──────────────────────────────────────────────────────────────────
const P = {
  skinTop:      "#0e160a",
  skinMid:      "#1d2e0e",
  skinLow:      "#263a10",
  scaleStroke:  "#0a0f07",
  scaleFill:    "#192509",
  gumBase:      "#7a3000",
  gumLight:     "#cc6010",
  mouthDeep:    "#5a2000",
  mouthMid:     "#c05010",
  palateRidge:  "#d06020",
  tongueBase:   "#b04010",
  tongueMid:    "#e06820",
  tongueTip:    "#ff8c30",
  tongueShine:  "#ffb060",
  veinColor:    "#6a2800",
  activeIcon:   "#ffd700",
  inactiveIcon: "rgba(255,255,255,0.80)",
  activeLbl:    "#ffd700",
  inactiveLbl:  "rgba(255,255,255,0.65)",
  activeBg:     "#ffd70022",
  divider:      "#7a3800",
};

// ─── Tab config ───────────────────────────────────────────────────────────────
const META: Record<string, { label: string; icon: (c: string, s: number) => React.ReactNode }> = {
  index:      { label: "Scan",      icon: (c, s) => <MaterialCommunityIcons name="radar"              size={s} color={c} /> },
  live:       { label: "Live",      icon: (c, s) => <Feather                name="video"              size={s} color={c} /> },
  home:       { label: "Home",      icon: (c, s) => <Feather                name="home"               size={s} color={c} /> },
  buff:       { label: "Boof",      icon: (c, s) => <MaterialCommunityIcons name="shopping"           size={s} color={c} /> },
  tides:      { label: "Tides",     icon: (c, s) => <MaterialCommunityIcons name="waves"              size={s} color={c} /> },
  species:    { label: "Species",   icon: (c, s) => <MaterialCommunityIcons name="fish"               size={s} color={c} /> },
  hud:        { label: "HUD",       icon: (c, s) => <MaterialCommunityIcons name="compass-rose"       size={s} color={c} /> },
  barra:      { label: "Barra",     icon: (c, s) => <MaterialCommunityIcons name="crosshairs-gps"    size={s} color={c} /> },
  zones:      { label: "Zones",     icon: (c, s) => <MaterialCommunityIcons name="map-marker-radius"  size={s} color={c} /> },
  forecast:   { label: "Fishy",     icon: (c, s) => <MaterialCommunityIcons name="weather-windy"     size={s} color={c} /> },
  catchid:    { label: "Catch",     icon: (c, s) => <MaterialCommunityIcons name="camera-iris"        size={s} color={c} /> },
  demo:       { label: "Demo",      icon: (c, s) => <MaterialCommunityIcons name="image-multiple"     size={s} color={c} /> },
  history:    { label: "History",   icon: (c, s) => <Feather                name="clock"              size={s} color={c} /> },
  community:  { label: "Brain",     icon: (c, s) => <MaterialCommunityIcons name="brain"              size={s} color={c} /> },
  smartlife:  { label: "SmartCam",  icon: (c, s) => <MaterialCommunityIcons name="cctv"               size={s} color={c} /> },
  cameras:    { label: "360° Cams", icon: (c, s) => <MaterialCommunityIcons name="rotate-360"         size={s} color={c} /> },
  insta360:   { label: "360°",      icon: (c, s) => <MaterialCommunityIcons name="camera-wireless"    size={s} color={c} /> },
};

// ─── Hex scales on skin band ──────────────────────────────────────────────────
function ScaleRow({ y, count, width }: { y: number; count: number; width: number }) {
  const sw = width / count;
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Ellipse
          key={i}
          cx={i * sw + sw / 2}
          cy={y}
          rx={sw * 0.38}
          ry={3.5}
          fill={P.scaleFill}
          stroke={P.scaleStroke}
          strokeWidth={0.7}
          opacity={0.9}
        />
      ))}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function CrocTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const routes = state.routes;

  // Strip routes that are hidden from the tab bar (href: null in layout)
  const HIDDEN = new Set(["fishy", "map", "cameras", "insta360", "subscription", "web"]);
  const visibleRoutes = routes.filter((route: (typeof routes)[number]) => !HIDDEN.has(route.name));
  const topRowCount = Math.ceil(visibleRoutes.length / 2);
  const bottomRowCount = Math.max(visibleRoutes.length - topRowCount, 0);
  const columnCount = Math.max(topRowCount, bottomRowCount, 1);
  const slotWidth = windowWidth / columnCount;

  // Layout constants
  const SKIN_H = 20;
  const ICON_SZ = columnCount > 7 ? 22 : 24;
  const LBL_H = columnCount > 7 ? 12 : 13;
  const LABEL_FONT_SIZE = columnCount > 7 ? 8 : 9;
  const ROW_PAD_V = 10;
  const ROW_H = ROW_PAD_V + ICON_SZ + LBL_H + ROW_PAD_V;
  const DIV_H = 1;
  const PAD_BOT = 6 + insets.bottom;
  const BAR_H = SKIN_H + ROW_H + DIV_H + ROW_H + PAD_BOT;

  const row1 = visibleRoutes.slice(0, topRowCount);
  const row2 = visibleRoutes.slice(topRowCount);
  const rowOffset = (rowLength: number) =>
    rowLength < columnCount ? ((columnCount - rowLength) * slotWidth) / 2 : 0;

  const row1Y = SKIN_H;
  const divY = SKIN_H + ROW_H;
  const row2Y = divY + DIV_H;

  function handlePress(route: (typeof routes)[number], isActive: boolean) {
    const ev = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (!isActive && !ev.defaultPrevented) navigation.navigate(route.name);
  }

  function renderTab(route: (typeof routes)[number], col: number, rowTopY: number, xOffset = 0) {
    const isActive = state.index === routes.indexOf(route);
    const meta = META[route.name] ?? {
      label: route.name,
      icon: (c: string, s: number) => <Feather name="circle" size={s} color={c} />,
    };
    const ic = isActive ? P.activeIcon : P.inactiveIcon;
    const lc = isActive ? P.activeLbl : P.inactiveLbl;
    const left = col * slotWidth + xOffset;

    return (
      <TouchableOpacity
        key={route.key}
        onPress={() => handlePress(route, isActive)}
        activeOpacity={0.6}
        style={[
          styles.tab,
          {
            position: "absolute",
            left,
            top: rowTopY,
            width: slotWidth,
            height: ROW_H,
          },
        ]}
      >
        {isActive && <View style={styles.activePill} />}
        {meta.icon(ic, ICON_SZ)}
        <Text style={[styles.lbl, { color: lc, fontSize: LABEL_FONT_SIZE }]} numberOfLines={1}>
          {meta.label}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={{ width: "100%", height: BAR_H, overflow: "hidden" }}>
      <Svg
        style={StyleSheet.absoluteFill}
        width={windowWidth}
        height={BAR_H}
        viewBox={`0 0 ${windowWidth} ${BAR_H}`}
      >
        <Defs>
          <LinearGradient id="mouth" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={P.mouthDeep} />
            <Stop offset="0.45" stopColor={P.mouthMid} />
            <Stop offset="1" stopColor={P.mouthDeep} />
          </LinearGradient>
          <LinearGradient id="skin" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={P.skinTop} />
            <Stop offset="0.6" stopColor={P.skinMid} />
            <Stop offset="1" stopColor={P.skinLow} />
          </LinearGradient>
          <LinearGradient id="gum" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={P.gumBase} />
            <Stop offset="1" stopColor={P.gumLight} />
          </LinearGradient>
          <RadialGradient id="tongue" cx="50%" cy="38%" r="55%">
            <Stop offset="0" stopColor={P.tongueShine} stopOpacity={0.5} />
            <Stop offset="0.4" stopColor={P.tongueTip} />
            <Stop offset="0.7" stopColor={P.tongueMid} />
            <Stop offset="1" stopColor={P.tongueBase} />
          </RadialGradient>
        </Defs>

        <Rect x="0" y="0" width={windowWidth} height={BAR_H} fill="url(#mouth)" />

        <Ellipse
          cx={windowWidth / 2}
          cy={BAR_H * 0.72}
          rx={windowWidth * 0.25}
          ry={BAR_H * 0.15}
          fill="url(#tongue)"
          opacity={0.65}
        />
        <Path
          d={`M ${windowWidth / 2} ${BAR_H * 0.58} Q ${windowWidth / 2} ${BAR_H * 0.88} ${windowWidth / 2} ${BAR_H * 0.92}`}
          stroke={P.tongueBase}
          strokeWidth={1.5}
          fill="none"
          opacity={0.55}
        />

        {[0.48, 0.62, 0.76, 0.88].map((pct, i) => {
          const y = BAR_H * pct;
          const sag = 3 + i * 1.5;
          return (
            <Path
              key={i}
              d={`M 0 ${y} Q ${windowWidth / 2} ${y + sag} ${windowWidth} ${y}`}
              stroke={P.palateRidge}
              strokeWidth={1.3}
              fill="none"
              opacity={0.4}
            />
          );
        })}

        {[0.1, 0.28, 0.52, 0.68, 0.88].map((xp, i) => (
          <Path
            key={i}
            d={`M ${windowWidth * xp} ${SKIN_H + 3} Q ${windowWidth * xp + 3} ${SKIN_H + 12} ${windowWidth * xp - 2} ${SKIN_H + 20}`}
            stroke={P.veinColor}
            strokeWidth={0.7}
            fill="none"
            opacity={0.45}
          />
        ))}

        <Rect x="0" y={SKIN_H - 4} width={windowWidth} height={12} fill="url(#gum)" opacity={0.9} />
        <Rect x="0" y={divY} width={windowWidth} height={DIV_H + 2} fill={P.divider} opacity={0.8} />
        <Rect x="0" y={divY - 1} width={windowWidth} height={1} fill="#ff3030" opacity={0.15} />

        {Array.from({ length: columnCount - 1 }).map((_, i) => (
          <Rect
            key={`r1-${i}`}
            x={(i + 1) * slotWidth - 0.5}
            y={row1Y}
            width={1}
            height={ROW_H}
            fill={P.divider}
            opacity={0.45}
          />
        ))}
        {Array.from({ length: columnCount - 1 }).map((_, i) => (
          <Rect
            key={`r2-${i}`}
            x={(i + 1) * slotWidth - 0.5}
            y={row2Y}
            width={1}
            height={ROW_H}
            fill={P.divider}
            opacity={0.45}
          />
        ))}

        <Rect x="0" y="0" width={windowWidth} height={SKIN_H} fill="url(#skin)" />
        <ScaleRow y={SKIN_H * 0.3} count={Math.max(Math.floor(windowWidth / 20), 1)} width={windowWidth} />
        <ScaleRow y={SKIN_H * 0.73} count={Math.max(Math.floor(windowWidth / 16), 1)} width={windowWidth} />
        <Rect x="0" y="0" width={windowWidth} height={1.5} fill="#050805" />
      </Svg>

      {row1.map((route: (typeof routes)[number], col: number) => renderTab(route, col, row1Y, rowOffset(row1.length)))}
      {row2.map((route: (typeof routes)[number], col: number) => renderTab(route, col, row2Y, rowOffset(row2.length)))}
    </View>
  );
}

const styles = StyleSheet.create({
  tab: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  activePill: {
    position: "absolute",
    width: "70%",
    height: "82%",
    borderRadius: 10,
    backgroundColor: P.activeBg,
    borderWidth: 1,
    borderColor: "#00d4aa44",
  },
  lbl: {
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
    textAlign: "center",
  },
});
