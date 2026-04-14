/**
 * CrocTabBar — 2-row croc-mouth navigation bar
 * Row 1: Live · Home · Boof · Tides · Species · Barra
 * Row 2: Zones · Fishy · Catch · History · Brain  (+ hidden: index/fishy/map/demo)
 */
import React from "react";
// @ts-ignore — types bundled with expo-router at runtime
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { View, TouchableOpacity, Text, StyleSheet, Dimensions } from "react-native";
import Svg, {
  Defs, LinearGradient, RadialGradient, Stop,
  Rect, Path, Ellipse, Circle,
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
  activeIcon:   "#000000",
  inactiveIcon: "#000000",
  activeLbl:    "#000000",
  inactiveLbl:  "#000000",
  activeBg:     "#ffffff33",
  divider:      "#7a3800",
};

// ─── Tab config ───────────────────────────────────────────────────────────────
const META: Record<string, { label: string; icon: (c: string, s: number) => React.ReactNode }> = {
  index:     { label: "Scan",    icon: (c, s) => <MaterialCommunityIcons name="radar"              size={s} color={c} /> },
  live:      { label: "Live",    icon: (c, s) => <Feather                name="video"              size={s} color={c} /> },
  home:      { label: "Home",    icon: (c, s) => <Feather                name="home"               size={s} color={c} /> },
  buff:      { label: "Boof",    icon: (c, s) => <MaterialCommunityIcons name="shopping"           size={s} color={c} /> },
  tides:     { label: "Tides",   icon: (c, s) => <MaterialCommunityIcons name="waves"              size={s} color={c} /> },
  species:   { label: "Species", icon: (c, s) => <MaterialCommunityIcons name="fish"               size={s} color={c} /> },
  barra:     { label: "Barra",   icon: (c, s) => <MaterialCommunityIcons name="crosshairs-gps"    size={s} color={c} /> },
  zones:     { label: "Zones",   icon: (c, s) => <MaterialCommunityIcons name="map-marker-radius"  size={s} color={c} /> },
  forecast:  { label: "Fishy",   icon: (c, s) => <MaterialCommunityIcons name="weather-windy"     size={s} color={c} /> },
  catchid:   { label: "Catch",   icon: (c, s) => <MaterialCommunityIcons name="camera-iris"        size={s} color={c} /> },
  history:   { label: "History", icon: (c, s) => <Feather                name="clock"              size={s} color={c} /> },
  community: { label: "Brain",   icon: (c, s) => <MaterialCommunityIcons name="brain"              size={s} color={c} /> },
};

const COLS    = 6;                             // tabs per row
const W       = Dimensions.get("window").width;
const SLOT_W  = W / COLS;

// ─── Hex scales on skin band ──────────────────────────────────────────────────
function ScaleRow({ y, count }: { y: number; count: number }) {
  const sw = W / count;
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
export function CrocTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets  = useSafeAreaInsets();
  const routes  = state.routes;

  // Strip routes that are hidden from the tab bar (href: null in layout)
  const HIDDEN = new Set(["index", "fishy", "map", "demo"]);
  const visibleRoutes = routes.filter((r: any) => !HIDDEN.has(r.name));

  // Layout constants
  const SKIN_H    = 20;
  const ICON_SZ   = 24;
  const LBL_H     = 13;
  const ROW_PAD_V = 10;                              // vertical padding per row
  const ROW_H     = ROW_PAD_V + ICON_SZ + LBL_H + ROW_PAD_V;
  const DIV_H     = 1;                               // row divider
  const PAD_BOT   = 6 + insets.bottom;
  const BAR_H     = SKIN_H + ROW_H + DIV_H + ROW_H + PAD_BOT;

  // Split visible routes into two rows
  const row1 = visibleRoutes.slice(0, COLS);
  const row2 = visibleRoutes.slice(COLS);

  const row1Y  = SKIN_H;
  const divY   = SKIN_H + ROW_H;
  const row2Y  = divY + DIV_H;

  function handlePress(route: (typeof routes)[number], isActive: boolean) {
    const ev = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (!isActive && !ev.defaultPrevented) navigation.navigate(route.name);
  }

  function renderTab(route: (typeof routes)[number], col: number, rowTopY: number) {
    const isActive  = state.index === routes.indexOf(route);
    const meta      = META[route.name] ?? {
      label: route.name,
      icon:  (c: string, s: number) => <Feather name="circle" size={s} color={c} />,
    };
    const ic = isActive ? P.activeIcon   : P.inactiveIcon;
    const lc = isActive ? P.activeLbl    : P.inactiveLbl;
    const left = col * SLOT_W;

    return (
      <TouchableOpacity
        key={route.key}
        onPress={() => handlePress(route, isActive)}
        activeOpacity={0.6}
        style={[
          styles.tab,
          {
            position:  "absolute",
            left:      left,
            top:       rowTopY,
            width:     SLOT_W,
            height:    ROW_H,
          },
        ]}
      >
        {/* Active highlight pill */}
        {isActive && (
          <View style={styles.activePill} />
        )}
        {meta.icon(ic, ICON_SZ)}
        <Text style={[styles.lbl, { color: lc }]} numberOfLines={1}>
          {meta.label}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={{ width: "100%", height: BAR_H, overflow: "hidden" }}>
      {/* ── SVG mouth background ── */}
      <Svg
        style={StyleSheet.absoluteFill}
        width={W}
        height={BAR_H}
        viewBox={`0 0 ${W} ${BAR_H}`}
      >
        <Defs>
          <LinearGradient id="mouth" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0"    stopColor={P.mouthDeep} />
            <Stop offset="0.45" stopColor={P.mouthMid}  />
            <Stop offset="1"    stopColor={P.mouthDeep} />
          </LinearGradient>
          <LinearGradient id="skin" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0"   stopColor={P.skinTop} />
            <Stop offset="0.6" stopColor={P.skinMid} />
            <Stop offset="1"   stopColor={P.skinLow} />
          </LinearGradient>
          <LinearGradient id="gum" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={P.gumBase}  />
            <Stop offset="1" stopColor={P.gumLight} />
          </LinearGradient>
          <RadialGradient id="tongue" cx="50%" cy="38%" r="55%">
            <Stop offset="0"   stopColor={P.tongueShine} stopOpacity={0.5} />
            <Stop offset="0.4" stopColor={P.tongueTip}   />
            <Stop offset="0.7" stopColor={P.tongueMid}   />
            <Stop offset="1"   stopColor={P.tongueBase}  />
          </RadialGradient>
        </Defs>

        {/* Mouth interior */}
        <Rect x="0" y="0" width={W} height={BAR_H} fill="url(#mouth)" />

        {/* Tongue */}
        <Ellipse
          cx={W / 2} cy={BAR_H * 0.72}
          rx={W * 0.25} ry={BAR_H * 0.15}
          fill="url(#tongue)" opacity={0.65}
        />
        <Path
          d={`M ${W / 2} ${BAR_H * 0.58} Q ${W / 2} ${BAR_H * 0.88} ${W / 2} ${BAR_H * 0.92}`}
          stroke={P.tongueBase} strokeWidth={1.5} fill="none" opacity={0.55}
        />

        {/* Palate ridges */}
        {[0.48, 0.62, 0.76, 0.88].map((pct, i) => {
          const y   = BAR_H * pct;
          const sag = 3 + i * 1.5;
          return (
            <Path
              key={i}
              d={`M 0 ${y} Q ${W / 2} ${y + sag} ${W} ${y}`}
              stroke={P.palateRidge} strokeWidth={1.3} fill="none" opacity={0.4}
            />
          );
        })}

        {/* Gum veins */}
        {[0.1, 0.28, 0.52, 0.68, 0.88].map((xp, i) => (
          <Path
            key={i}
            d={`M ${W * xp} ${SKIN_H + 3} Q ${W * xp + 3} ${SKIN_H + 12} ${W * xp - 2} ${SKIN_H + 20}`}
            stroke={P.veinColor} strokeWidth={0.7} fill="none" opacity={0.45}
          />
        ))}

        {/* Gum strip below skin */}
        <Rect x="0" y={SKIN_H - 4} width={W} height={12} fill="url(#gum)" opacity={0.9} />

        {/* Row divider — gum ridge between the two rows */}
        <Rect x="0" y={divY} width={W} height={DIV_H + 2} fill={P.divider} opacity={0.8} />
        {/* Subtle highlight above divider */}
        <Rect x="0" y={divY - 1} width={W} height={1} fill="#ff3030" opacity={0.15} />

        {/* Vertical slot separators — row 1 */}
        {Array.from({ length: COLS - 1 }).map((_, i) => (
          <Rect key={`r1-${i}`} x={(i + 1) * SLOT_W - 0.5} y={row1Y} width={1} height={ROW_H} fill={P.divider} opacity={0.45} />
        ))}
        {/* Vertical slot separators — row 2 */}
        {Array.from({ length: COLS - 1 }).map((_, i) => (
          <Rect key={`r2-${i}`} x={(i + 1) * SLOT_W - 0.5} y={row2Y} width={1} height={ROW_H} fill={P.divider} opacity={0.45} />
        ))}

        {/* Croc skin band */}
        <Rect x="0" y="0" width={W} height={SKIN_H} fill="url(#skin)" />

        {/* Scale rows */}
        <ScaleRow y={SKIN_H * 0.3}  count={Math.floor(W / 20)} />
        <ScaleRow y={SKIN_H * 0.73} count={Math.floor(W / 16)} />

        {/* Top border */}
        <Rect x="0" y="0" width={W} height={1.5} fill="#050805" />
      </Svg>

      {/* ── Row 1 touch targets ── */}
      {row1.map((route: any, col: number) => renderTab(route, col, row1Y))}

      {/* ── Row 2 touch targets ── */}
      {row2.map((route: any, col: number) => renderTab(route, col, row2Y))}
    </View>
  );
}

const styles = StyleSheet.create({
  tab: {
    alignItems:     "center",
    justifyContent: "center",
    gap:             2,
  },
  activePill: {
    position:     "absolute",
    width:        "70%",
    height:       "82%",
    borderRadius: 10,
    backgroundColor: P.activeBg,
    borderWidth:  1,
    borderColor:  "#00d4aa44",
  },
  lbl: {
    fontSize:      9,
    fontFamily:    "Inter_600SemiBold",
    letterSpacing: 0.3,
    textAlign:     "center",
  },
});
