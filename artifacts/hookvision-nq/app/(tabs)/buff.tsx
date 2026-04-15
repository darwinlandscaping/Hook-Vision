import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

const HV_LOGO = require("../../assets/images/hv-logo2-nobg.png");

// ─── Brand palette ────────────────────────────────────────────────────────────
const C = {
  bg:     "#08040a",
  card:   "#130810",
  cardExp:"#1a0815",
  red:    "#e8151a",
  pink:   "#ff0085",
  gold:   "#ffd700",
  white:  "#ffffff",
  muted:  "#c490a0",
  border: "#3a1020",
};

const EXPAND_SECS = 5;

type Category = "ALL" | "LURES" | "RODS" | "REELS" | "LINE" | "BUFFS" | "HATS" | "OPTICS";

interface Product {
  id: string;
  name: string;
  desc: string;
  price: string;
  category: Category;
  hot?: boolean;
  color: string;
}

// ─── Static image map (all resolved at bundle time) ──────────────────────────
const PRODUCT_IMAGES: Record<string, any> = {
  l1:  require("../../assets/images/store/l1-roosta-popper.png"),
  l2:  require("../../assets/images/store/l2-sorcerer.png"),
  l3:  require("../../assets/images/store/l3-bent-minnow.png"),
  l4:  require("../../assets/images/store/l4-twitchbait.png"),
  l5:  require("../../assets/images/store/l5-fish-trap.png"),
  l6:  require("../../assets/images/store/l6-pencil.png"),
  l7:  require("../../assets/images/store/l7-xrap.png"),
  r1:  require("../../assets/images/store/r1-daiwa-tatula.png"),
  r2:  require("../../assets/images/store/r2-expride.png"),
  r3:  require("../../assets/images/store/r3-sick-stick.png"),
  r4:  require("../../assets/images/store/r4-nomad-tidal.png"),
  re1: require("../../assets/images/store/re1-curado-dc.png"),
  re2: require("../../assets/images/store/re2-steez.png"),
  re3: require("../../assets/images/store/re3-revo-beast.png"),
  re4: require("../../assets/images/store/re4-slx-dc.png"),
  ln1: require("../../assets/images/store/ln1-sunline-braid.png"),
  ln2: require("../../assets/images/store/ln2-seaguar-fluoro.png"),
  ln3: require("../../assets/images/store/ln3-powerpro.png"),
  ln4: require("../../assets/images/store/ln4-unitika.png"),
  b1:  require("../../assets/images/store/b1-barra-hunter.png"),
  b2:  require("../../assets/images/store/b2-territory-tough.png"),
  b3:  require("../../assets/images/store/b3-sunrise-session.png"),
  b4:  require("../../assets/images/store/b4-stealth-barra.png"),
  b5:  require("../../assets/images/store/b5-barra-nation.png"),
  h1:  require("../../assets/images/store/h1-barra-nation-cap.png"),
  h2:  require("../../assets/images/store/h2-wide-brim.png"),
  h3:  require("../../assets/images/store/h3-trucker-cap.png"),
  h4:  require("../../assets/images/store/h4-hookvision-cap.png"),
  op1: require("../../assets/images/store/op1-moment-cpl.png"),
  op2: require("../../assets/images/store/op2-sandmarc-polariser.png"),
  op3: require("../../assets/images/store/op3-xenvo-kit.png"),
  op4: require("../../assets/images/store/op4-phone-shade.png"),
  op5: require("../../assets/images/store/op5-neewer-cpl.png"),
  op6: require("../../assets/images/store/op6-antiglare-film.png"),
};

const PRODUCTS: Product[] = [
  { id:"l1", name:"Roosta Popper 105",      desc:"Surface carnage. Barra magnet at dawn and dusk. Works best over shallow structure on the run-out tide.",              price:"$34.95", category:"LURES", hot:true, color:C.red  },
  { id:"l2", name:"Halco Sorcerer 150DD",   desc:"Deep-diving bibbed minnow destroyer. Gets down to 5m. Perfect for working rocky ledges and rock bars.",        price:"$28.95", category:"LURES",           color:C.pink },
  { id:"l3", name:"OSP Bent Minnow 130",    desc:"Subsurface jerkbait with an irresistible side-to-side twitch. Trophy barra can't leave this one alone.",  price:"$42.00", category:"LURES", hot:true, color:C.gold },
  { id:"l4", name:"Storm 65 Twitchbait",    desc:"Slow-sinking rattler built for timber structure. Pause-and-twitch through snags for lethargic barra.",     price:"$19.95", category:"LURES",           color:C.red  },
  { id:"l5", name:"Zerek Fish Trap 95",     desc:"Paddle-tail soft plastic on a 3/8oz jig head. Versatile mid-column presentation for barra and threadfin.",      price:"$14.99", category:"LURES",           color:C.pink },
  { id:"l6", name:"Lucky Craft PT 75",      desc:"Walk-the-dog topwater pencil bait. When barra are smashing surface in the shallows, this is the weapon.",         price:"$38.50", category:"LURES",           color:C.gold },
  { id:"l7", name:"Rapala X-Rap 10",        desc:"Aggressive slash-bait for mid-water column. Erratic action triggers reaction strikes from active fish.",   price:"$24.95", category:"LURES", hot:true, color:C.red  },

  { id:"r1", name:"Daiwa Tatula 7'4\" MH",  desc:"Barra casting specialist with fast action. Handles lures up to 60g. Built for long casts to distant structure.",     price:"$249.00", category:"RODS", hot:true, color:C.red  },
  { id:"r2", name:"Shimano Expride 7'6\"",  desc:"Precision jerkbait and heavy lure rod. Micro-pitch guides, high-modulus graphite, Japanese quality throughout.",       price:"$319.00", category:"RODS",            color:C.gold },
  { id:"r3", name:"Berkley Sick Stick 7'",  desc:"Medium-heavy NQ all-rounder. Handles surface lures through to heavy jigs. Great entry-level barra stick.",               price:"$179.95", category:"RODS",            color:C.pink },
  { id:"r4", name:"Nomad Tidal 7'2\" H",    desc:"Brutal power for big structure barra. Extra-fast action tip loads quickly for casting accuracy around pylons.",      price:"$299.00", category:"RODS", hot:true, color:C.red  },

  { id:"re1", name:"Shimano Curado 200 DC", desc:"Digital cast control eliminates backlash. 4 DC settings dial in perfectly for every lure weight and wind condition.",      price:"$399.00", category:"REELS", hot:true, color:C.gold },
  { id:"re2", name:"Daiwa Steez CT SV TW",  desc:"Low-profile, lightning-fast 8.1:1 retrieve. Zaion body and SV spool system for buttery-smooth casting.",      price:"$549.00", category:"REELS",            color:C.red  },
  { id:"re3", name:"Abu Garcia Revo Beast", desc:"Maximum 25lb drag for big fish in heavy cover. Carbon Matrix drag system handles the biggest barra in the tightest snags.",      price:"$299.00", category:"REELS",            color:C.pink },
  { id:"re4", name:"Shimano SLX DC 150",    desc:"Budget digital cast control, no compromise on performance. Recommended for anglers stepping up to baitcasters.",     price:"$229.00", category:"REELS", hot:true, color:C.gold },

  { id:"ln1", name:"Sunline PE Braid 50lb", desc:"Zero stretch, high-vis green. 8-carrier Japanese braid. The go-to mainline for Gulf Country estuaries and tidal systems.",  price:"$64.95", category:"LINE", hot:true, color:C.red  },
  { id:"ln2", name:"Seaguar Fluoro 60lb",   desc:"Tough invisible fluorocarbon leader for structure fishing. Near-zero stretch and abrasion resistance for rocky country.",      price:"$49.95", category:"LINE",            color:C.gold },
  { id:"ln3", name:"PowerPro Super 8 40lb", desc:"8-carrier ultra-smooth braid for casting distance. Enhanced body coating for minimal guides wear.",      price:"$54.95", category:"LINE",            color:C.pink },
  { id:"ln4", name:"Unitika Gyogun 80lb",   desc:"Heavy mono leader for XL barra season. Used by NQ guides for snag country where lighter gear gets cut off.",          price:"$39.95", category:"LINE", hot:true,  color:C.red  },

  { id:"b1", name:"Barra Hunter Boof",      desc:"UV-block cooling neck gaiter in croc red. UPF50+ fabric. Keeps the sun and flies off your face all day long.",    price:"$39.95", category:"BUFFS", hot:true, color:C.red  },
  { id:"b2", name:"Territory Tough Boof",   desc:"Crimson and gold — 100% UV50+ shield. Represents the Territory with every cast. One size fits all.",        price:"$39.95", category:"BUFFS",           color:C.gold },
  { id:"b3", name:"Sunrise Session Boof",   desc:"Pink and gold NQ Gulf sunrise print. Unisex design, quick-dry fabric. Perfect for dawn sessions on the water.",      price:"$39.95", category:"BUFFS",           color:C.pink },
  { id:"b4", name:"Stealth Barra Boof",     desc:"Tactical black-on-black NQ Gulf design. Stealth mode for sneaky barra hunters. No-logo low-profile fishing style.",          price:"$39.95", category:"BUFFS", hot:true, color:C.red  },
  { id:"b5", name:"Barramundi Nation Boof", desc:"Full-sublimation trophy barra art. Gallery-quality barramundi illustration wrapped around UPF50+ cooling fabric.",          price:"$44.95", category:"BUFFS",           color:C.gold },

  { id:"h1", name:"Savage Barra Nation Cap", desc:"Gold embroidered barramundi on a structured black snapback. The hat that says you mean business on the water.",         price:"$49.95", category:"HATS", hot:true, color:C.gold },
  { id:"h2", name:"Wide-Brim NQ Hat",        desc:"360-degree sun protection for all-day Gulf sessions. Breathable UPF50+ fabric. Works the flats, the boat, and the bank.", price:"$59.95", category:"HATS",            color:C.red  },
  { id:"h3", name:"Buff Trucker Cap",        desc:"Mesh-back trucker cap with hot pink barramundi print. Light, breathable, and unmistakably NQ Gulf fishing culture.",          price:"$44.95", category:"HATS",            color:C.pink },
  { id:"h4", name:"Hookvision Low-Crown",    desc:"Structured low-crown in crimson and gold. The official cap of the HookVision faithful. Limited seasonal run.",     price:"$54.95", category:"HATS", hot:true,  color:C.gold },

  { id:"op1", name:"Moment CPL Mobile Lens",    desc:"Circular polarising clip-on for any phone. Cuts glare off sonar screens and water surface. Rotate the ring to dial out reflections instantly — sonar colours pop like never before.", price:"$89.95", category:"OPTICS", hot:true,  color:C.gold },
  { id:"op2", name:"Sandmarc Polariser 58mm",   desc:"Premium universal CPL clip lens. Aircraft-grade aluminium housing, multi-coated HD glass. Eliminates reflected glare from fish finder screens so the AI scan reads clean every time.", price:"$69.95", category:"OPTICS",           color:C.pink },
  { id:"op3", name:"Xenvo Pro Lens Kit CPL",    desc:"Dual lens set: CPL polariser + wide angle. Captures the full sonar display in one shot without stepping back. Includes hard-shell carry case and clip mount.",                        price:"$79.95", category:"OPTICS", hot:true,  color:C.red  },
  { id:"op4", name:"Phone Screen Shade Hood",   desc:"Collapsible foam sunshade that clips around your phone. Blocks direct NQ Gulf sun from washing out sonar screens on the boat. Folds flat in seconds, fits phones up to 7 inches.",          price:"$34.95", category:"OPTICS",           color:C.gold },
  { id:"op5", name:"Neewer CPL Clip 18mm",      desc:"Budget-friendly circular polariser for tablets and large-screen phones. Rotatable glass element, rubber no-scratch clamp. Get cleaner sonar grabs without spending big.",              price:"$29.95", category:"OPTICS",           color:C.pink },
  { id:"op6", name:"Matte Anti-Glare Film",     desc:"Cut-to-size matte screen film for your capture device. Kills mirror reflections and fingerprint smear without losing screen brightness. The easiest glare fix money can buy.",         price:"$19.95", category:"OPTICS",           color:C.red  },
];

const CATS: { key: Category; label: string; color: string }[] = [
  { key:"ALL",   label:"🔥 ALL",     color:C.red  },
  { key:"LURES", label:"🎣 LURES",   color:C.pink },
  { key:"RODS",  label:"🎯 RODS",    color:C.red  },
  { key:"REELS", label:"⚙️ REELS",  color:C.gold },
  { key:"LINE",  label:"〰️ LINE",   color:C.pink },
  { key:"BUFFS", label:"👕 BOOFS",   color:C.red  },
  { key:"HATS",   label:"🧢 HATS",    color:C.gold },
  { key:"OPTICS", label:"🔭 OPTICS",  color:C.gold },
];

const SECTION_TITLES: Record<Category, string> = {
  ALL:   "FULL CATALOG",
  LURES: "KILLER LURES",
  RODS:  "BARRA RODS",
  REELS: "PRECISION REELS",
  LINE:  "LINE & LEADER",
  BUFFS: "BOOF APPAREL",
  HATS:   "HEADWEAR",
  OPTICS: "VISION ENHANCERS",
};

// ─── Animated product card ────────────────────────────────────────────────────
function ProductCard({
  p,
  isExpanded,
  countdown,
  onPress,
}: {
  p: Product;
  isExpanded: boolean;
  countdown: number;
  onPress: () => void;
}) {
  const anim = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: isExpanded ? 1 : 0,
      useNativeDriver: false,
      tension: 120,
      friction: 14,
    }).start();
  }, [isExpanded]);

  // Interpolated values
  const imgSize    = anim.interpolate({ inputRange: [0, 1], outputRange: [96, 260] });
  const detailOp   = anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0, 1] });
  const detailH    = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 130] });
  const borderClr  = isExpanded ? p.color + "cc" : p.color + "44";

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={[styles.card, { borderColor: borderClr }]}
    >
      {isExpanded ? (
        /* ── EXPANDED layout ── */
        <View style={{ width: "100%" }}>
          {/* Big image */}
          <Animated.View style={[styles.expImgWrap, { height: imgSize }]}>
            <Image
              source={PRODUCT_IMAGES[p.id]}
              style={styles.expImg}
              resizeMode="cover"
            />
            {/* Gradient-like overlay at bottom */}
            <View style={[styles.expImgGrad, { backgroundColor: C.bg + "cc" }]} />
            {/* HOT badge */}
            {p.hot && (
              <View style={[styles.expHotBadge, { backgroundColor: p.color }]}>
                <Text style={styles.hotText}>🔥 HOT SELLER</Text>
              </View>
            )}
            {/* Countdown pill */}
            <View style={[styles.countdownPill, { borderColor: p.color + "80" }]}>
              <Text style={[styles.countdownText, { color: p.color }]}>
                closing in {countdown}s
              </Text>
            </View>
          </Animated.View>

          {/* Animated detail panel */}
          <Animated.View style={[styles.expDetail, { opacity: detailOp, maxHeight: detailH }]}>
            <Text style={styles.expName}>{p.name}</Text>
            <Text style={styles.expDesc}>{p.desc}</Text>
            <View style={styles.expBottom}>
              <View style={[styles.expPricePill, { borderColor: p.color, backgroundColor: p.color + "20" }]}>
                <Text style={[styles.expPrice, { color: p.color }]}>{p.price}</Text>
              </View>
              <View style={[styles.shopBtn, { backgroundColor: p.color }]}>
                <Text style={styles.shopBtnText}>SHOP NOW →</Text>
              </View>
            </View>
          </Animated.View>
        </View>
      ) : (
        /* ── COLLAPSED layout ── */
        <View style={styles.collapsedInner}>
          <View style={[styles.imgWrap, { borderColor: p.color + "40", backgroundColor: "#1a0810" }]}>
            <Image
              source={PRODUCT_IMAGES[p.id]}
              style={styles.img}
              resizeMode="contain"
            />
            <View style={[styles.imgOverlay, { backgroundColor: p.color + "18" }]} />
          </View>
          <View style={styles.cardInfo}>
            <View style={styles.cardNameRow}>
              <Text style={styles.cardName} numberOfLines={1}>{p.name}</Text>
              {p.hot && (
                <View style={[styles.hotBadge, { backgroundColor: p.color }]}>
                  <Text style={styles.hotText}>HOT</Text>
                </View>
              )}
            </View>
            <Text style={styles.cardDesc} numberOfLines={2}>{p.desc}</Text>
            <View style={[styles.pricePill, { borderColor: p.color + "80", backgroundColor: p.color + "15" }]}>
              <Text style={[styles.priceText, { color: p.color }]}>{p.price}</Text>
            </View>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function BuffScreen() {
  const insets = useSafeAreaInsets();
  const [cat, setCat]             = useState<Category>("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [countdown, setCountdown]   = useState(EXPAND_SECS);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const collapseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current)    clearInterval(timerRef.current);
    if (collapseRef.current) clearTimeout(collapseRef.current);
  }, []);

  const collapse = useCallback(() => {
    clearTimers();
    setExpandedId(null);
    setCountdown(EXPAND_SECS);
  }, [clearTimers]);

  const handlePress = useCallback((id: string) => {
    // Tapping the already-expanded card collapses it immediately
    if (expandedId === id) {
      collapse();
      return;
    }
    clearTimers();
    setExpandedId(id);
    setCountdown(EXPAND_SECS);

    // Tick countdown every second
    let remaining = EXPAND_SECS;
    timerRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current!);
      }
    }, 1000);

    // Auto-collapse after EXPAND_SECS
    collapseRef.current = setTimeout(() => {
      setExpandedId(null);
      setCountdown(EXPAND_SECS);
    }, EXPAND_SECS * 1000);
  }, [expandedId, collapse, clearTimers]);

  // Clean up on unmount
  useEffect(() => () => clearTimers(), [clearTimers]);

  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const botPad = Platform.OS === "web" ? 80 : insets.bottom + 70;

  const sections =
    cat === "ALL"
      ? (["LURES","RODS","REELS","LINE","BUFFS","HATS","OPTICS"] as Category[]).map((k) => ({
          key: k,
          items: PRODUCTS.filter((p) => p.category === k),
        }))
      : [{ key: cat, items: PRODUCTS.filter((p) => p.category === cat) }];

  return (
    <View style={[styles.bg, { paddingTop: topPad }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerStripe} />
        <View style={styles.headerInner}>
          <Image source={HV_LOGO} style={styles.headerLogo} resizeMode="contain" />
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>BOOF</Text>
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>ACCESSORIES</Text>
            </View>
          </View>
          <Text style={styles.headerTag}>🔥 BUILT FOR NQ GULF · MADE TO DOMINATE 🔥</Text>
        </View>
        <View style={styles.headerStripeBottom} />
      </View>

      {/* ── Category filter ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        style={styles.chipScroll}
      >
        {CATS.map((c) => {
          const active = cat === c.key;
          return (
            <TouchableOpacity
              key={c.key}
              style={[
                styles.chip,
                active
                  ? { backgroundColor: c.color, borderColor: c.color }
                  : { backgroundColor: C.card, borderColor: C.border },
              ]}
              onPress={() => { collapse(); setCat(c.key); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, { color: active ? "#000" : C.muted }]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Products ── */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: botPad }}
      >
        {sections.map((sec) => (
          <View key={sec.key}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionBar, { backgroundColor: CATS.find(c=>c.key===sec.key)?.color ?? C.red }]} />
              <Text style={styles.sectionTitle}>{SECTION_TITLES[sec.key]}</Text>
              <Text style={[styles.sectionCount, { color: CATS.find(c=>c.key===sec.key)?.color ?? C.red }]}>
                {sec.items.length} items
              </Text>
            </View>

            {sec.items.map((p) => (
              <ProductCard
                key={p.id}
                p={p}
                isExpanded={expandedId === p.id}
                countdown={countdown}
                onPress={() => handlePress(p.id)}
              />
            ))}
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>🔥 HOOKVISION BOOF GEAR 🔥</Text>
          <Text style={styles.footerSub}>NQ Gulf's most dangerous tackle store</Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: C.bg },

  // ── Header ──
  header: { position: "relative", marginBottom: 2 },
  headerStripe: { height: 4, backgroundColor: C.red },
  headerStripeBottom: { height: 3, backgroundColor: C.pink },
  headerInner: { paddingHorizontal: 18, paddingVertical: 14, backgroundColor: "#0f050c" },
  headerLogo: { width: 140, height: 36 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
  headerTitle: { fontSize: 42, fontFamily: "Oswald_700Bold", color: C.white, lineHeight: 44 },
  headerBadge: {
    backgroundColor: C.pink, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 6, transform: [{ skewX: "-8deg" }],
  },
  headerBadgeText: { fontSize: 13, fontFamily: "Oswald_700Bold", color: "#fff", letterSpacing: 1 },
  headerTag: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: C.gold, marginTop: 4, letterSpacing: 0.5 },

  // ── Category chips ──
  chipScroll: { maxHeight: 52, flexGrow: 0 },
  chipRow: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: "row" },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  chipText: { fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },

  // ── Section header ──
  sectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingTop: 18, paddingBottom: 8,
  },
  sectionBar: { width: 4, height: 20, borderRadius: 2 },
  sectionTitle: { fontSize: 14, fontFamily: "Oswald_700Bold", color: C.white, letterSpacing: 1.5, flex: 1 },
  sectionCount: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  // ── Card shell ──
  card: {
    marginHorizontal: 12, marginBottom: 10,
    backgroundColor: C.card, borderRadius: 16, borderWidth: 1.5,
    overflow: "hidden",
  },

  // ── Collapsed layout ──
  collapsedInner: { flexDirection: "row", alignItems: "center", minHeight: 92 },
  imgWrap: { width: 92, height: 92, borderRightWidth: 1, position: "relative", overflow: "hidden", flexShrink: 0 },
  img: { width: 92, height: 92 },
  imgOverlay: { ...StyleSheet.absoluteFillObject },
  cardInfo: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, justifyContent: "space-between" },
  cardNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardName: { fontSize: 14, fontFamily: "Inter_700Bold", color: C.white, flex: 1 },
  cardDesc: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.muted, marginTop: 3, lineHeight: 16 },
  hotBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, flexShrink: 0 },
  hotText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 1 },
  pricePill: {
    alignSelf: "flex-start", marginTop: 8,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1.5,
  },
  priceText: { fontSize: 14, fontFamily: "Oswald_700Bold", letterSpacing: 0.5 },

  // ── Expanded layout ──
  expImgWrap: { width: "100%", position: "relative", overflow: "hidden" },
  expImg: { width: "100%", height: "100%" },
  expImgGrad: {
    position: "absolute", bottom: 0, left: 0, right: 0, height: 60,
  },
  expHotBadge: {
    position: "absolute", top: 12, left: 12,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  countdownPill: {
    position: "absolute", top: 12, right: 12,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    borderWidth: 1.5, backgroundColor: C.bg + "cc",
  },
  countdownText: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  expDetail: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, overflow: "hidden" },
  expName: { fontSize: 20, fontFamily: "Oswald_700Bold", color: C.white, letterSpacing: 0.5, marginBottom: 6 },
  expDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: C.muted, lineHeight: 20 },
  expBottom: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14 },
  expPricePill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 2,
  },
  expPrice: { fontSize: 18, fontFamily: "Oswald_700Bold" },
  shopBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center",
  },
  shopBtnText: { fontSize: 14, fontFamily: "Oswald_700Bold", color: "#fff", letterSpacing: 1 },

  // ── Footer ──
  footer: { alignItems: "center", paddingVertical: 28, gap: 4 },
  footerText: { fontSize: 14, fontFamily: "Oswald_700Bold", color: C.gold, letterSpacing: 2 },
  footerSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.muted },
});
