import React from "react";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Dimensions,
} from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
  Polygon,
  Ellipse,
  Circle,
  Path,
  G,
} from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

// ─── Croc colour palette ───────────────────────────────────────────────────────
const C = {
  skinTop:      "#151f0a",   // very dark olive at top edge
  skinMid:      "#243312",   // dark croc green
  skinLow:      "#1a2710",   // darker green below scale row
  scaleStroke:  "#0d1808",   // scale outline
  scaleFill:    "#1e2c0f",   // scale interior
  gumDark:      "#4a0808",   // dark gum at tooth roots
  gumMid:       "#7a1010",   // mid gum
  mouthTop:     "#5c0e0e",   // top of mouth interior (behind teeth)
  mouthMid:     "#922020",   // mid mouth
  mouthLow:     "#6e1515",   // lower mouth shadow
  ridgeLight:   "#a02828",   // gum ridge highlight
  ridgeDark:    "#500a0a",   // gum ridge shadow
  toothCream:   "#f2ead4",   // tooth light tip
  toothBase:    "#c8b87a",   // tooth base (yellowed)
  toothShadow:  "#8a7030",   // tooth root shadow
  toothShine:   "#ffffff",   // tooth highlight glint
  activeGlow:   "#00d4aa",   // active tooth glow
  activeTint:   "#b0fff0",   // active tooth fill
  iconActive:   "#00d4aa",
  iconInactive: "#c8a898",
  labelActive:  "#00d4aa",
  labelInactive:"#9a7868",
};

// ─── Tab metadata ──────────────────────────────────────────────────────────────
const TAB_META: Record<string, { label: string; icon: (c: string, s: number) => React.ReactNode }> = {
  index:     { label: "Scan",    icon: (c, s) => <MaterialCommunityIcons name="radar" size={s} color={c} /> },
  live:      { label: "Live",    icon: (c, s) => <Feather name="video" size={s} color={c} /> },
  home:      { label: "Home",    icon: (c, s) => <Feather name="home" size={s} color={c} /> },
  buff:      { label: "Boof",    icon: (c, s) => <MaterialCommunityIcons name="shopping" size={s} color={c} /> },
  tides:     { label: "Tides",   icon: (c, s) => <MaterialCommunityIcons name="waves" size={s} color={c} /> },
  species:   { label: "Species", icon: (c, s) => <MaterialCommunityIcons name="fish" size={s} color={c} /> },
  barra:     { label: "Barra",   icon: (c, s) => <MaterialCommunityIcons name="crosshairs-gps" size={s} color={c} /> },
  zones:     { label: "Zones",   icon: (c, s) => <MaterialCommunityIcons name="map-marker-radius" size={s} color={c} /> },
  forecast:  { label: "Fishy",   icon: (c, s) => <MaterialCommunityIcons name="weather-windy" size={s} color={c} /> },
  demo:      { label: "Demo",    icon: (c, s) => <MaterialCommunityIcons name="image-multiple" size={s} color={c} /> },
  history:   { label: "History", icon: (c, s) => <Feather name="clock" size={s} color={c} /> },
  community: { label: "Intel",   icon: (c, s) => <MaterialCommunityIcons name="brain" size={s} color={c} /> },
};

// Tooth height profile — varies to mimic real croc jaw irregular spacing
const TOOTH_H_PROFILE = [24, 32, 20, 36, 22, 28, 20, 36, 22, 30, 20, 28];

const SCREEN_W = Dimensions.get("window").width;

// ─── Scale row helper ──────────────────────────────────────────────────────────
function ScaleRow({ y, w, count }: { y: number; w: number; count: number }) {
  const scaleW = w / count;
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const cx = i * scaleW + scaleW / 2;
        return (
          <G key={i}>
            <Ellipse cx={cx} cy={y} rx={scaleW * 0.38} ry={3.5} fill={C.scaleFill} stroke={C.scaleStroke} strokeWidth={0.6} />
          </G>
        );
      })}
    </>
  );
}

// ─── Main CrocTabBar component ─────────────────────────────────────────────────
export function CrocTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const routes = state.routes;
  const n = routes.length;

  const slotW = SCREEN_W / n;
  const maxToothH = Math.max(...TOOTH_H_PROFILE.slice(0, n));
  const SKIN_H  = 14;   // croc skin band height
  const ICON_H  = 16;
  const LABEL_H = 10;
  const INNER_PAD = 6;
  const BOTTOM_PAD = 6 + insets.bottom;
  const TEETH_ZONE = maxToothH + 4; // teeth + gum buffer
  const BAR_H = SKIN_H + TEETH_ZONE + INNER_PAD + ICON_H + LABEL_H + BOTTOM_PAD;

  // y-position where icons start (below the deepest tooth tip + buffer)
  const iconY = SKIN_H + TEETH_ZONE + INNER_PAD;

  return (
    <View style={{ width: "100%", height: BAR_H, overflow: "hidden" }}>
      {/* ── SVG mouth background + teeth ── */}
      <Svg
        style={StyleSheet.absoluteFill}
        width={SCREEN_W}
        height={BAR_H}
        viewBox={`0 0 ${SCREEN_W} ${BAR_H}`}
      >
        <Defs>
          {/* Mouth interior gradient */}
          <LinearGradient id="mouthGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0"    stopColor={C.mouthTop} />
            <Stop offset="0.45" stopColor={C.mouthMid} />
            <Stop offset="1"    stopColor={C.mouthLow} />
          </LinearGradient>
          {/* Croc skin gradient */}
          <LinearGradient id="skinGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0"   stopColor={C.skinTop} />
            <Stop offset="0.6" stopColor={C.skinMid} />
            <Stop offset="1"   stopColor={C.skinLow} />
          </LinearGradient>
          {/* Tooth gradient */}
          <LinearGradient id="toothGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0"   stopColor={C.toothCream} />
            <Stop offset="0.65" stopColor="#ddd0a0" />
            <Stop offset="1"   stopColor={C.toothBase} />
          </LinearGradient>
          {/* Active tooth gradient */}
          <LinearGradient id="toothActiveGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0"   stopColor="#d0fff6" />
            <Stop offset="0.5" stopColor="#80ffe8" />
            <Stop offset="1"   stopColor="#40d4b8" />
          </LinearGradient>
          {/* Gum gradient */}
          <LinearGradient id="gumGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={C.gumDark} />
            <Stop offset="1" stopColor={C.gumMid}  />
          </LinearGradient>
        </Defs>

        {/* ── Mouth interior background ── */}
        <Rect x="0" y="0" width={SCREEN_W} height={BAR_H} fill="url(#mouthGrad)" />

        {/* ── Gum ridges — horizontal texture lines ── */}
        {[0.42, 0.58, 0.75, 0.88].map((pct, i) => (
          <Rect
            key={i}
            x="0"
            y={BAR_H * pct}
            width={SCREEN_W}
            height={1.2}
            fill={i % 2 === 0 ? C.ridgeLight : C.ridgeDark}
            opacity={0.5}
          />
        ))}

        {/* ── Gum base strip (just below skin, around tooth roots) ── */}
        <Rect x="0" y={SKIN_H - 2} width={SCREEN_W} height={10} fill="url(#gumGrad)" opacity={0.9} />

        {/* ── Teeth ── */}
        {routes.map((route, i) => {
          const isActive = state.index === i;
          const toothH   = TOOTH_H_PROFILE[i % TOOTH_H_PROFILE.length];
          const cx       = i * slotW + slotW / 2;
          const gapSide  = slotW * 0.14;
          const leftX    = i * slotW + gapSide;
          const rightX   = (i + 1) * slotW - gapSide;
          const tipX     = cx;
          const tipY     = SKIN_H + toothH;
          const baseY    = SKIN_H;

          const toothPts = `${leftX},${baseY} ${tipX},${tipY} ${rightX},${baseY}`;
          // Shadow tooth (offset slightly for depth illusion)
          const shadowPts = `${leftX + 1.5},${baseY} ${tipX + 1},${tipY + 2.5} ${rightX + 0.5},${baseY}`;

          return (
            <G key={route.key}>
              {/* Gum socket at tooth base */}
              <Ellipse
                cx={cx}
                cy={baseY + 1}
                rx={slotW * 0.3}
                ry={3.5}
                fill={C.gumDark}
                opacity={0.8}
              />

              {/* Drop shadow tooth */}
              <Polygon points={shadowPts} fill="#000000" opacity={0.35} />

              {/* Main tooth body */}
              <Polygon
                points={toothPts}
                fill={isActive ? "url(#toothActiveGrad)" : "url(#toothGrad)"}
              />

              {/* Active teal glow edge */}
              {isActive && (
                <Polygon points={toothPts} fill={C.activeGlow} opacity={0.22} />
              )}

              {/* Tooth shine glint — left edge */}
              <Path
                d={`M ${leftX + 1} ${baseY} L ${leftX + 3} ${baseY} L ${tipX - 2} ${tipY - 5} L ${tipX - 4} ${tipY - 4} Z`}
                fill={C.toothShine}
                opacity={0.5}
              />

              {/* Tooth root darkening */}
              <Rect
                x={leftX}
                y={baseY - 3}
                width={rightX - leftX}
                height={5}
                fill={C.toothShadow}
                opacity={0.45}
              />

              {/* Active: teal dot on tooth tip */}
              {isActive && (
                <Circle
                  cx={tipX}
                  cy={tipY - 3}
                  r={2.5}
                  fill={C.activeGlow}
                  opacity={0.9}
                />
              )}
            </G>
          );
        })}

        {/* ── Croc skin band at top ── */}
        <Rect x="0" y="0" width={SCREEN_W} height={SKIN_H} fill="url(#skinGrad)" />

        {/* ── Scale rows on skin ── */}
        <ScaleRow y={SKIN_H * 0.33} w={SCREEN_W} count={Math.floor(SCREEN_W / 18)} />
        <ScaleRow y={SKIN_H * 0.72} w={SCREEN_W} count={Math.floor(SCREEN_W / 14)} />

        {/* ── Top skin border ── */}
        <Rect x="0" y="0" width={SCREEN_W} height={1.5} fill="#0a1005" />

        {/* ── Vertical dividers between teeth (croc jaw bone lines) ── */}
        {routes.map((_, i) => {
          if (i === 0) return null;
          const x = i * slotW;
          return (
            <Rect key={i} x={x - 0.5} y={SKIN_H} width={1} height={6} fill="#2a0808" opacity={0.4} />
          );
        })}
      </Svg>

      {/* ── Tab touch targets + icons ── */}
      <View style={[StyleSheet.absoluteFill, styles.tabRow]}>
        {routes.map((route, i) => {
          const isActive  = state.index === i;
          const meta      = TAB_META[route.name] ?? { label: route.name, icon: (c: string, s: number) => <Feather name="circle" size={s} color={c} /> };
          const iconColor = isActive ? C.iconActive  : C.iconInactive;
          const lblColor  = isActive ? C.labelActive : C.labelInactive;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!isActive && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              style={[styles.tab, { width: slotW, paddingTop: iconY, paddingBottom: BOTTOM_PAD }]}
              onPress={onPress}
              activeOpacity={0.65}
            >
              {meta.icon(iconColor, 13)}
              <Text style={[styles.label, { color: lblColor }]} numberOfLines={1} adjustsFontSizeToFit>
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
  tabRow: {
    flexDirection: "row",
    alignItems:    "flex-start",
  },
  tab: {
    alignItems:  "center",
    gap:          1,
    overflow:    "hidden",
  },
  label: {
    fontSize:       6.5,
    fontFamily:     "Inter_600SemiBold",
    letterSpacing:  0.3,
    textAlign:      "center",
    minWidth:       1,
  },
});
