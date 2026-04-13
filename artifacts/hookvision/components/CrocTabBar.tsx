/**
 * CrocTabBar — Realistic saltwater croc jaw navigation bar
 * Curved bezier teeth · tongue · palate ridges · saliva · hex scales · gum veins
 */
import React from "react";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { View, TouchableOpacity, Text, StyleSheet, Dimensions } from "react-native";
import Svg, {
  Defs, LinearGradient, RadialGradient, Stop,
  Rect, Path, Ellipse, Circle, G, Line,
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
  jawBone:      "#1a2c0c",
  gumBase:      "#3d0808",
  gumMid:       "#6e1010",
  gumLight:     "#9a2020",
  mouthDeep:    "#3c0808",
  mouthMid:     "#7a1616",
  mouthLight:   "#b02424",
  palateRidge:  "#8a1c1c",
  tongueBase:   "#a01818",
  tongueMid:    "#c83030",
  tongueTip:    "#e04848",
  tongueShine:  "#ff6060",
  salivaColor:  "#e8e0d8c0",
  veinColor:    "#4a0808",
  toothIvory:   "#f5efd8",
  toothMid:     "#dfd0a0",
  toothBase:    "#c0a85c",
  toothRoot:    "#8a7030",
  toothShine:   "#ffffffcc",
  toothActive:  "#00f5c8",
  toothActGlow: "#00d4aa",
  activeIcon:   "#00d4aa",
  inactiveIcon: "#c8a898",
  activeLbl:    "#00d4aa",
  inactiveLbl:  "#8a6858",
};

// ─── Tab config ───────────────────────────────────────────────────────────────
const META: Record<string, { label: string; icon: (c: string, s: number) => React.ReactNode }> = {
  index:     { label: "Scan",    icon: (c, s) => <MaterialCommunityIcons name="radar"             size={s} color={c} /> },
  live:      { label: "Live",    icon: (c, s) => <Feather                name="video"             size={s} color={c} /> },
  home:      { label: "Home",    icon: (c, s) => <Feather                name="home"              size={s} color={c} /> },
  buff:      { label: "Boof",    icon: (c, s) => <MaterialCommunityIcons name="shopping"          size={s} color={c} /> },
  tides:     { label: "Tides",   icon: (c, s) => <MaterialCommunityIcons name="waves"             size={s} color={c} /> },
  species:   { label: "Species", icon: (c, s) => <MaterialCommunityIcons name="fish"              size={s} color={c} /> },
  barra:     { label: "Barra",   icon: (c, s) => <MaterialCommunityIcons name="crosshairs-gps"   size={s} color={c} /> },
  zones:     { label: "Zones",   icon: (c, s) => <MaterialCommunityIcons name="map-marker-radius" size={s} color={c} /> },
  forecast:  { label: "Fishy",   icon: (c, s) => <MaterialCommunityIcons name="weather-windy"    size={s} color={c} /> },
  demo:      { label: "Demo",    icon: (c, s) => <MaterialCommunityIcons name="image-multiple"    size={s} color={c} /> },
  history:   { label: "History", icon: (c, s) => <Feather                name="clock"             size={s} color={c} /> },
  community: { label: "Intel",   icon: (c, s) => <MaterialCommunityIcons name="brain"             size={s} color={c} /> },
};


const W = Dimensions.get("window").width;



// Scale hex grid on skin band
function ScaleHex({ skinH, w }: { skinH: number; w: number }) {
  const cols = Math.ceil(w / 22);
  const rows = 2;
  const nodes: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ox = r % 2 === 0 ? 0 : 11;
      const cx = c * 22 + ox + 4;
      const cy = skinH * (r === 0 ? 0.3 : 0.75);
      nodes.push(
        <Ellipse key={`${r}-${c}`} cx={cx} cy={cy} rx={7} ry={4}
          fill={P.scaleFill} stroke={P.scaleStroke} strokeWidth={0.7} opacity={0.9} />
      );
    }
  }
  return <>{nodes}</>;
}

// ─── Main component ───────────────────────────────────────────────────────────
export function CrocTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const routes = state.routes;
  const n      = routes.length;

  const slotW   = W / n;
  const SKIN_H  = 20;
  const ICON_SZ = 20;
  const LBL_H   = 12;
  const PAD_TOP = 10;
  const PAD_BOT = 8 + insets.bottom;
  const BAR_H   = SKIN_H + PAD_TOP + ICON_SZ + LBL_H + PAD_BOT;
  const iconY   = SKIN_H + PAD_TOP;


  return (
    <View style={{ width: "100%", height: BAR_H, overflow: "hidden" }}>
      {/* ── SVG layer ── */}
      <Svg
        style={StyleSheet.absoluteFill}
        width={W}
        height={BAR_H}
        viewBox={`0 0 ${W} ${BAR_H}`}
      >
        <Defs>
          {/* Mouth interior */}
          <LinearGradient id="mouth" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0"    stopColor={P.mouthDeep}  />
            <Stop offset="0.38" stopColor={P.mouthMid}   />
            <Stop offset="1"    stopColor={P.mouthDeep}  />
          </LinearGradient>
          {/* Croc skin */}
          <LinearGradient id="skin" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0"   stopColor={P.skinTop} />
            <Stop offset="0.5" stopColor={P.skinMid} />
            <Stop offset="1"   stopColor={P.skinLow} />
          </LinearGradient>
          {/* Normal tooth */}
          <LinearGradient id="tooth" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0"    stopColor={P.toothIvory} />
            <Stop offset="0.55" stopColor={P.toothMid}   />
            <Stop offset="1"    stopColor={P.toothBase}  />
          </LinearGradient>
          {/* Active tooth */}
          <LinearGradient id="toothActive" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0"   stopColor="#c0fff4" />
            <Stop offset="0.5" stopColor="#50e8cc" />
            <Stop offset="1"   stopColor="#18b898" />
          </LinearGradient>
          {/* Gum */}
          <LinearGradient id="gum" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={P.gumBase}  />
            <Stop offset="1" stopColor={P.gumLight} />
          </LinearGradient>
          {/* Tongue */}
          <RadialGradient id="tongue" cx="50%" cy="40%" r="55%">
            <Stop offset="0"   stopColor={P.tongueShine} stopOpacity={0.5} />
            <Stop offset="0.4" stopColor={P.tongueTip}   />
            <Stop offset="0.7" stopColor={P.tongueMid}   />
            <Stop offset="1"   stopColor={P.tongueBase}  />
          </RadialGradient>
        </Defs>

        {/* ── Mouth interior ── */}
        <Rect x="0" y="0" width={W} height={BAR_H} fill="url(#mouth)" />

        {/* ── Tongue (wide ellipse in the lower mouth) ── */}
        <Ellipse
          cx={W / 2} cy={BAR_H * 0.76}
          rx={W * 0.28} ry={BAR_H * 0.18}
          fill="url(#tongue)"
          opacity={0.75}
        />
        {/* Tongue tip groove */}
        <Path
          d={`M ${W / 2} ${BAR_H * 0.6} Q ${W / 2} ${BAR_H * 0.9} ${W / 2} ${BAR_H * 0.95}`}
          stroke={P.tongueBase} strokeWidth={1.5} fill="none" opacity={0.6}
        />

        {/* ── Palate ridges (curved horizontal lines) ── */}
        {[0.50, 0.64, 0.76, 0.87].map((pct, i) => {
          const y = BAR_H * pct;
          const sag = 4 + i * 1.5;
          return (
            <Path
              key={i}
              d={`M 0 ${y} Q ${W / 2} ${y + sag} ${W} ${y}`}
              stroke={P.palateRidge}
              strokeWidth={1.4}
              fill="none"
              opacity={0.45}
            />
          );
        })}

        {/* ── Gum blood vessels / veins ── */}
        {[W * 0.12, W * 0.28, W * 0.55, W * 0.72, W * 0.88].map((x, i) => (
          <Path
            key={i}
            d={`M ${x} ${SKIN_H + 4} Q ${x + 3} ${SKIN_H + 14} ${x - 2} ${SKIN_H + 22}`}
            stroke={P.veinColor} strokeWidth={0.7} fill="none" opacity={0.5}
          />
        ))}

        {/* ── Gum strip just below skin ── */}
        <Rect x="0" y={SKIN_H - 4} width={W} height={12} fill="url(#gum)" opacity={0.95} />



        {/* ── Croc skin band ── */}
        <Rect x="0" y="0" width={W} height={SKIN_H} fill="url(#skin)" />

        {/* ── Hex scales on skin ── */}
        <ScaleHex skinH={SKIN_H} w={W} />

        {/* ── Skin top border (very dark) ── */}
        <Rect x="0" y="0" width={W} height={1.5} fill="#050805" />

        {/* ── Jawbone suture lines between teeth slots ── */}
        {routes.map((_, i) => {
          if (i === 0) return null;
          const x = i * slotW;
          return (
            <Rect
              key={i} x={x - 0.4} y={SKIN_H} width={0.8}
              height={10} fill="#1a0303" opacity={0.5}
            />
          );
        })}

        {/* ── Mucus sheen — semi-transparent gloss across whole bar bottom ── */}
        <Path
          d={`M 0 ${BAR_H} Q ${W * 0.25} ${BAR_H - 5} ${W * 0.5} ${BAR_H} Q ${W * 0.75} ${BAR_H + 5} ${W} ${BAR_H}`}
          fill="none"
          stroke="#ffffff"
          strokeWidth={2}
          opacity={0.06}
        />
      </Svg>

      {/* ── Touchable tab buttons ── */}
      <View style={[StyleSheet.absoluteFill, styles.row]}>
        {routes.map((route, i) => {
          const isActive = state.index === i;
          const meta     = META[route.name] ?? {
            label: route.name,
            icon:  (c: string, s: number) => <Feather name="circle" size={s} color={c} />,
          };
          const iconColor = isActive ? P.activeIcon   : P.inactiveIcon;
          const lblColor  = isActive ? P.activeLbl    : P.inactiveLbl;

          const onPress = () => {
            const ev = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!isActive && !ev.defaultPrevented) navigation.navigate(route.name);
          };

          return (
            <TouchableOpacity
              key={route.key}
              style={[styles.tab, { width: slotW, paddingTop: iconY, paddingBottom: PAD_BOT }]}
              onPress={onPress}
              activeOpacity={0.6}
            >
              {meta.icon(iconColor, ICON_SZ)}
              <Text style={[styles.lbl, { color: lblColor }]} numberOfLines={1} adjustsFontSizeToFit>
                {meta.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start" },
  tab: { alignItems: "center", gap: 2, overflow: "hidden" },
  lbl: {
    fontSize:      7.5,
    fontFamily:    "Inter_600SemiBold",
    letterSpacing: 0.25,
    textAlign:     "center",
  },
});
