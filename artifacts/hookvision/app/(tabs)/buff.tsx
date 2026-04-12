import React, { useState } from "react";
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Brand palette ────────────────────────────────────────────────────────────
const C = {
  bg:     "#08040a",
  card:   "#130810",
  red:    "#e8151a",
  pink:   "#ff0085",
  gold:   "#ffd700",
  white:  "#ffffff",
  muted:  "#c490a0",
  border: "#3a1020",
};

type Category = "ALL" | "LURES" | "RODS" | "REELS" | "LINE" | "BUFFS" | "HATS";

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
};

const PRODUCTS: Product[] = [
  // ── Lures ────────────────────────────────────────────────────────────────
  { id:"l1", name:"Roosta Popper 105",      desc:"Surface carnage. Barra magnet.",              price:"$34.95", category:"LURES", hot:true, color:C.red  },
  { id:"l2", name:"Halco Sorcerer 150DD",   desc:"Deep-diving bibbed minnow destroyer.",        price:"$28.95", category:"LURES",           color:C.pink },
  { id:"l3", name:"OSP Bent Minnow 130",    desc:"Subsurface jerkbait — irresistible twitch.",  price:"$42.00", category:"LURES", hot:true, color:C.gold },
  { id:"l4", name:"Storm 65 Twitchbait",    desc:"Slow-sink rattler for timber structure.",     price:"$19.95", category:"LURES",           color:C.red  },
  { id:"l5", name:"Zerek Fish Trap 95",     desc:"Paddle-tail soft plastic on jig head.",      price:"$14.99", category:"LURES",           color:C.pink },
  { id:"l6", name:"Lucky Craft PT 75",      desc:"Walk-the-dog topwater pencil bait.",         price:"$38.50", category:"LURES",           color:C.gold },
  { id:"l7", name:"Rapala X-Rap 10",        desc:"Aggressive slash-bait, mid-water column.",   price:"$24.95", category:"LURES", hot:true, color:C.red  },

  // ── Rods ─────────────────────────────────────────────────────────────────
  { id:"r1", name:"Daiwa Tatula 7'4\" MH",  desc:"Barra casting specialist, fast action.",     price:"$249.00", category:"RODS", hot:true, color:C.red  },
  { id:"r2", name:"Shimano Expride 7'6\"",  desc:"Jerkbait & heavy lure precision rod.",       price:"$319.00", category:"RODS",            color:C.gold },
  { id:"r3", name:"Berkley Sick Stick 7'",  desc:"Medium-heavy NT all-rounder.",               price:"$179.95", category:"RODS",            color:C.pink },
  { id:"r4", name:"Nomad Tidal 7'2\" H",    desc:"Brutal power for big structure barra.",      price:"$299.00", category:"RODS", hot:true, color:C.red  },

  // ── Reels ─────────────────────────────────────────────────────────────────
  { id:"re1", name:"Shimano Curado 200 DC", desc:"Digital cast control — zero backlash.",      price:"$399.00", category:"REELS", hot:true, color:C.gold },
  { id:"re2", name:"Daiwa Steez CT SV TW",  desc:"Low-profile, lightning-fast retrieve.",      price:"$549.00", category:"REELS",            color:C.red  },
  { id:"re3", name:"Abu Garcia Revo Beast", desc:"Max drag for big fish in heavy cover.",      price:"$299.00", category:"REELS",            color:C.pink },
  { id:"re4", name:"Shimano SLX DC 150",    desc:"Budget digital control, no compromise.",     price:"$229.00", category:"REELS", hot:true, color:C.gold },

  // ── Line ──────────────────────────────────────────────────────────────────
  { id:"ln1", name:"Sunline PE Braid 50lb", desc:"Zero stretch, high-vis green. Boss braid.",  price:"$64.95", category:"LINE", hot:true, color:C.red  },
  { id:"ln2", name:"Seaguar Fluoro 60lb",   desc:"Tough invisible leader for structure.",      price:"$49.95", category:"LINE",            color:C.gold },
  { id:"ln3", name:"PowerPro Super 8 40lb", desc:"8-carrier ultra-smooth casting braid.",      price:"$54.95", category:"LINE",            color:C.pink },
  { id:"ln4", name:"Unitika Gyogun 80lb",   desc:"Heavy leader for XL barra season.",          price:"$39.95", category:"LINE", hot:true,  color:C.red  },

  // ── Buffs (neck gaiters) ──────────────────────────────────────────────────
  { id:"b1", name:"Barra Hunter Boof",      desc:"UV-block cooling neck gaiter. Croc red.",    price:"$39.95", category:"BUFFS", hot:true, color:C.red  },
  { id:"b2", name:"Territory Tough Boof",   desc:"Crimson & gold — 100% UV50+ shield.",        price:"$39.95", category:"BUFFS",           color:C.gold },
  { id:"b3", name:"Sunrise Session Boof",   desc:"Pink & gold NT sunrise print. Unisex.",      price:"$39.95", category:"BUFFS",           color:C.pink },
  { id:"b4", name:"Stealth Barra Boof",     desc:"Tactical black-on-black NT design.",          price:"$39.95", category:"BUFFS", hot:true, color:C.red  },
  { id:"b5", name:"Barramundi Nation Boof", desc:"Full-sublimation trophy barra art.",          price:"$44.95", category:"BUFFS",           color:C.gold },

  // ── Hats ─────────────────────────────────────────────────────────────────
  { id:"h1", name:"Savage Barra Nation Cap", desc:"Embroidered gold barra. Snapback.",         price:"$49.95", category:"HATS", hot:true, color:C.gold },
  { id:"h2", name:"Wide-Brim NT Hat",        desc:"360° sun protection for all-day sessions.", price:"$59.95", category:"HATS",            color:C.red  },
  { id:"h3", name:"Buff Trucker Cap",        desc:"Mesh back, hot pink barra print.",          price:"$44.95", category:"HATS",            color:C.pink },
  { id:"h4", name:"Hookvision Low-Crown",    desc:"Structured low-crown in crimson/gold.",     price:"$54.95", category:"HATS", hot:true,  color:C.gold },
];

const CATS: { key: Category; label: string; color: string }[] = [
  { key:"ALL",   label:"🔥 ALL",     color:C.red  },
  { key:"LURES", label:"🎣 LURES",   color:C.pink },
  { key:"RODS",  label:"🎯 RODS",    color:C.red  },
  { key:"REELS", label:"⚙️ REELS",  color:C.gold },
  { key:"LINE",  label:"〰️ LINE",   color:C.pink },
  { key:"BUFFS", label:"👕 BOOFS",   color:C.red  },
  { key:"HATS",  label:"🧢 HATS",    color:C.gold },
];

const SECTION_TITLES: Record<Category, string> = {
  ALL:   "FULL CATALOG",
  LURES: "KILLER LURES",
  RODS:  "BARRA RODS",
  REELS: "PRECISION REELS",
  LINE:  "LINE & LEADER",
  BUFFS: "BOOF APPAREL",
  HATS:  "HEADWEAR",
};

export default function BuffScreen() {
  const insets = useSafeAreaInsets();
  const [cat, setCat] = useState<Category>("ALL");

  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const botPad = Platform.OS === "web" ? 80 : insets.bottom + 70;

  const sections =
    cat === "ALL"
      ? (["LURES","RODS","REELS","LINE","BUFFS","HATS"] as Category[]).map((k) => ({
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
          <Text style={styles.headerBrand}>HOOK<Text style={{ color: C.gold }}>VISION</Text></Text>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>BOOF</Text>
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>ACCESSORIES</Text>
            </View>
          </View>
          <Text style={styles.headerTag}>🔥 BUILT FOR NT · MADE TO DOMINATE 🔥</Text>
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
              onPress={() => setCat(c.key)}
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
              <TouchableOpacity
                key={p.id}
                style={[styles.card, { borderColor: p.color + "55" }]}
                activeOpacity={0.82}
              >
                {/* Product image */}
                <View style={[styles.imgWrap, { borderColor: p.color + "40" }]}>
                  <Image
                    source={PRODUCT_IMAGES[p.id]}
                    style={styles.img}
                    resizeMode="cover"
                  />
                  {/* Colour tint overlay at bottom */}
                  <View style={[styles.imgOverlay, { backgroundColor: p.color + "18" }]} />
                </View>

                {/* Info */}
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
              </TouchableOpacity>
            ))}
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>🔥 HOOKVISION BOOF GEAR 🔥</Text>
          <Text style={styles.footerSub}>NT's most dangerous tackle store</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: C.bg },

  // ── Header ──
  header: { position: "relative", marginBottom: 2 },
  headerStripe: { height: 4, backgroundColor: C.red },
  headerStripeBottom: { height: 3, backgroundColor: C.pink },
  headerInner: { paddingHorizontal: 18, paddingVertical: 14, backgroundColor: "#0f050c" },
  headerBrand: { fontSize: 11, fontFamily: "Inter_700Bold", color: C.muted, letterSpacing: 3 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 2 },
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
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1.5,
  },
  chipText: { fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },

  // ── Section ──
  sectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingTop: 18, paddingBottom: 8,
  },
  sectionBar: { width: 4, height: 20, borderRadius: 2 },
  sectionTitle: { fontSize: 14, fontFamily: "Oswald_700Bold", color: C.white, letterSpacing: 1.5, flex: 1 },
  sectionCount: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  // ── Card ──
  card: {
    flexDirection: "row", alignItems: "stretch",
    marginHorizontal: 12, marginBottom: 10,
    backgroundColor: C.card, borderRadius: 16, borderWidth: 1,
    overflow: "hidden",
    minHeight: 96,
  },
  imgWrap: {
    width: 96, borderRightWidth: 1,
    position: "relative",
    overflow: "hidden",
  },
  img: {
    width: 96, height: "100%",
    minHeight: 96,
  },
  imgOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  cardInfo: {
    flex: 1, paddingHorizontal: 14, paddingVertical: 12,
    justifyContent: "space-between",
  },
  cardNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardName: { fontSize: 14, fontFamily: "Inter_700Bold", color: C.white, flex: 1 },
  cardDesc: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.muted, marginTop: 3, lineHeight: 16 },
  hotBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, flexShrink: 0 },
  hotText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 1 },
  pricePill: {
    alignSelf: "flex-start", marginTop: 8,
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1.5,
  },
  priceText: { fontSize: 14, fontFamily: "Oswald_700Bold", letterSpacing: 0.5 },

  // ── Footer ──
  footer: { alignItems: "center", paddingVertical: 28, gap: 4 },
  footerText: { fontSize: 14, fontFamily: "Oswald_700Bold", color: C.gold, letterSpacing: 2 },
  footerSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.muted },
});
