/**
 * HookVision — Subscription & Payment Screen
 * Shows current plan, features, pricing tiers, and payment due notice.
 */
import React, { useState } from "react";
import {
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";

// ─── Colours ──────────────────────────────────────────────────────────────────
const C = {
  bg:     "#0a1628",
  card:   "#0d1f3a",
  border: "#1a2f4a",
  teal:   "#00d4aa",
  blue:   "#00a8ff",
  gold:   "#ffd700",
  red:    "#ff4400",
  orange: "#ff8800",
  white:  "#ffffff",
  dim:    "#ffffffaa",
  mute:   "#ffffff44",
};

// ─── Pricing tiers ────────────────────────────────────────────────────────────
const PLANS = [
  {
    id: "monthly",
    name: "PRO MONTHLY",
    price: "$9.99",
    period: "/ month",
    badge: null,
    color: C.blue,
    features: [
      "Unlimited AI sonar scans",
      "Barra Predictor",
      "Croc Brain + Bird Pipeline",
      "360° Camera integration",
      "Smart Glass HUD streaming",
      "WA Tides + Conditions",
      "Catch ID + Species Guide",
      "Community Intel (Barra Brain)",
    ],
  },
  {
    id: "annual",
    name: "PRO ANNUAL",
    price: "$79.99",
    period: "/ year",
    badge: "SAVE 33%",
    color: C.gold,
    features: [
      "Everything in Monthly",
      "Priority AI processing",
      "Offline sonar library",
      "Export scan history (CSV/PDF)",
      "Early access to new features",
      "Kimberley guide network access",
    ],
  },
];

const FREE_FEATURES = [
  "5 AI scans per month",
  "WA Tides (current day)",
  "Species Guide (basic)",
  "Scan History (last 10)",
];

const PAID_FEATURES = [
  { icon: "radar",              label: "Unlimited AI Sonar Analysis" },
  { icon: "crosshairs-gps",    label: "Barra Predictor + Trophy Alerts" },
  { icon: "brain",             label: "Barra Brain + Community Intel" },
  { icon: "shield-alert",      label: "Croc Brain + Vision Pipeline" },
  { icon: "feather",           label: "WA Bird Library (500 species photos)" },
  { icon: "camera-wireless",   label: "Insta360 360° Camera + Dual Pipelines" },
  { icon: "glasses",           label: "Smart Glass HUD Streaming" },
  { icon: "television-play",   label: "Camera 2 WiFi Sonar Remote" },
  { icon: "microphone",        label: "AI Voice Narrator (6 characters)" },
  { icon: "map-marker-radius", label: "Strike Zone Mapping" },
  { icon: "camera-iris",       label: "Catch ID (photo identification)" },
  { icon: "weather-windy",     label: "AI Fishy Forecast" },
];

// ─── Feature row ─────────────────────────────────────────────────────────────
function FeatureRow({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.featureRow}>
      <MaterialCommunityIcons name={icon as any} size={14} color={C.teal} />
      <Text style={styles.featureText}>{label}</Text>
    </View>
  );
}

// ─── Plan card ────────────────────────────────────────────────────────────────
function PlanCard({
  plan,
  selected,
  onSelect,
}: {
  plan: typeof PLANS[0];
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onSelect}
      activeOpacity={0.85}
      style={[
        styles.planCard,
        { borderColor: selected ? plan.color : C.border },
        selected && { backgroundColor: plan.color + "12" },
      ]}
    >
      {plan.badge && (
        <View style={[styles.badge, { backgroundColor: plan.color }]}>
          <Text style={styles.badgeText}>{plan.badge}</Text>
        </View>
      )}
      <View style={styles.planHeader}>
        <View style={[styles.radio, { borderColor: plan.color }]}>
          {selected && <View style={[styles.radioFill, { backgroundColor: plan.color }]} />}
        </View>
        <Text style={[styles.planName, { color: plan.color }]}>{plan.name}</Text>
      </View>
      <View style={styles.priceRow}>
        <Text style={[styles.price, { color: C.white }]}>{plan.price}</Text>
        <Text style={styles.period}>{plan.period}</Text>
      </View>
      {plan.features.slice(0, 4).map((f, i) => (
        <View key={i} style={styles.featureRow}>
          <Feather name="check" size={12} color={plan.color} />
          <Text style={styles.featureText}>{f}</Text>
        </View>
      ))}
      {plan.features.length > 4 && (
        <Text style={[styles.featureText, { color: C.mute, marginTop: 2 }]}>
          + {plan.features.length - 4} more features
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function SubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const [selectedPlan, setSelectedPlan] = useState<string>("annual");

  const plan = PLANS.find((p) => p.id === selectedPlan) ?? PLANS[1];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={C.white} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <MaterialCommunityIcons name="fish" size={20} color={C.teal} />
          <Text style={styles.headerTitle}>HOOKVISION <Text style={{ color: C.gold }}>PRO</Text></Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Payment Due Banner */}
        <View style={styles.dueBanner}>
          <View style={styles.dueRow}>
            <MaterialCommunityIcons name="credit-card-clock" size={22} color={C.gold} />
            <View style={{ flex: 1 }}>
              <Text style={styles.dueTitle}>PAYMENT DUE</Text>
              <Text style={styles.dueSubtitle}>Activate Pro to keep all features running</Text>
            </View>
          </View>
          <View style={styles.dueAmount}>
            <Text style={styles.dueAmountText}>
              {plan.price}
              <Text style={{ fontSize: 13, fontWeight: "400" }}> {plan.period}</Text>
            </Text>
          </View>
        </View>

        {/* Tagline */}
        <Text style={styles.tagline}>
          The complete AI fishing platform for WA/Kimberley. Every scan, every tide, every croc — covered.
        </Text>

        {/* Plan selector */}
        <Text style={styles.sectionLabel}>CHOOSE YOUR PLAN</Text>
        <View style={{ gap: 12 }}>
          {PLANS.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              selected={selectedPlan === p.id}
              onSelect={() => setSelectedPlan(p.id)}
            />
          ))}
        </View>

        {/* Subscribe button */}
        <TouchableOpacity
          style={[styles.subscribeBtn, { backgroundColor: plan.color }]}
          activeOpacity={0.85}
          onPress={() => {
            // Wire to Stripe/RevenueCat payment URL here
            Linking.openURL("https://hookvision.com.au/subscribe").catch(() => {});
          }}
        >
          <MaterialCommunityIcons name="lock-open" size={18} color="#000" />
          <Text style={styles.subscribeBtnText}>
            SUBSCRIBE — {plan.price}{plan.period}
          </Text>
        </TouchableOpacity>
        <Text style={styles.legalText}>
          Cancel anytime · Renews automatically · Secure payment
        </Text>

        {/* What you get */}
        <Text style={styles.sectionLabel}>EVERYTHING IN PRO</Text>
        <View style={styles.card}>
          {PAID_FEATURES.map((f, i) => (
            <FeatureRow key={i} icon={f.icon} label={f.label} />
          ))}
        </View>

        {/* Free tier */}
        <Text style={styles.sectionLabel}>FREE TIER (CURRENT)</Text>
        <View style={styles.card}>
          {FREE_FEATURES.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Feather name="check" size={12} color={C.mute} />
              <Text style={[styles.featureText, { color: C.mute }]}>{f}</Text>
            </View>
          ))}
          <View style={[styles.featureRow, { marginTop: 8 }]}>
            <Feather name="x" size={12} color={C.red} />
            <Text style={[styles.featureText, { color: C.red }]}>AI pipelines (Croc, Bird, Barra)</Text>
          </View>
          <View style={styles.featureRow}>
            <Feather name="x" size={12} color={C.red} />
            <Text style={[styles.featureText, { color: C.red }]}>360° Camera + HUD + Voice Narrator</Text>
          </View>
        </View>

        {/* Contact */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>SUPPORT</Text>
          <Text style={[styles.featureText, { lineHeight: 20 }]}>
            Broome, WA · Australia{"\n"}
            Questions? Email <Text style={{ color: C.teal }}>hello@hookvision.com.au</Text>
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn:      { width: 36, alignItems: "flex-start" },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle:  { color: C.white, fontSize: 16, fontWeight: "800", letterSpacing: 1.2 },

  scroll: { padding: 16, gap: 14 },

  dueBanner: {
    backgroundColor: C.gold + "18",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.gold + "66",
    padding: 16,
    gap: 10,
  },
  dueRow:       { flexDirection: "row", alignItems: "center", gap: 12 },
  dueTitle:     { color: C.gold, fontSize: 13, fontWeight: "800", letterSpacing: 1 },
  dueSubtitle:  { color: C.dim, fontSize: 12, marginTop: 2 },
  dueAmount:    { alignItems: "flex-end" },
  dueAmountText:{ color: C.gold, fontSize: 26, fontWeight: "800" },

  tagline: {
    color: C.dim, fontSize: 13, lineHeight: 20, textAlign: "center",
  },

  sectionLabel: {
    color: C.mute, fontSize: 10, fontWeight: "700", letterSpacing: 2,
    marginTop: 4,
  },

  planCard: {
    backgroundColor: C.card, borderRadius: 14,
    borderWidth: 1.5, borderColor: C.border,
    padding: 16, gap: 8, position: "relative", overflow: "hidden",
  },
  badge: {
    position: "absolute", top: 12, right: 12,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: { color: "#000", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  planHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  radio: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  radioFill:  { width: 9, height: 9, borderRadius: 5 },
  planName:   { fontSize: 13, fontWeight: "800", letterSpacing: 1 },
  priceRow:   { flexDirection: "row", alignItems: "baseline", gap: 4 },
  price:      { fontSize: 28, fontWeight: "800" },
  period:     { color: C.dim, fontSize: 13 },

  featureRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 2 },
  featureText:{ color: C.dim, fontSize: 12, flex: 1, lineHeight: 18 },

  subscribeBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, borderRadius: 14, paddingVertical: 16,
  },
  subscribeBtnText: { color: "#000", fontSize: 15, fontWeight: "800", letterSpacing: 0.5 },
  legalText: { color: C.mute, fontSize: 10, textAlign: "center", marginTop: -6 },

  card: {
    backgroundColor: C.card, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    padding: 14, gap: 6,
  },
});
