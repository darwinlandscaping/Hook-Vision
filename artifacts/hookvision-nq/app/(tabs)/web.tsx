import React, { useState, useRef, useCallback } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { HVHeader } from "@/components/HVHeader";

// ─── Conditional WebView (not available on expo-web) ─────────────────────────
let WebView: any = null;
if (Platform.OS !== "web") {
  try { WebView = require("react-native-webview").WebView; } catch {}
}

// ─── Colours ─────────────────────────────────────────────────────────────────
const C = {
  bg:     "#0a1628",
  card:   "#0f2035",
  teal:   "#00d4aa",
  blue:   "#00a8ff",
  gold:   "#ffd700",
  white:  "#ffffff",
  mute:   "rgba(255,255,255,0.45)",
  dim:    "rgba(255,255,255,0.25)",
  border: "rgba(0,212,170,0.18)",
};

// ─── Bookmarks ────────────────────────────────────────────────────────────────
interface Bookmark {
  label: string;
  url: string;
  icon: string;
  color: string;
}

const BOOKMARKS: Bookmark[] = [
  { label: "BOM Tides",     url: "http://www.bom.gov.au/australia/tides/",         icon: "waves",                 color: C.teal   },
  { label: "Fisheries NT",  url: "https://nt.gov.au/fishing/home",                  icon: "fish",                  color: C.blue   },
  { label: "BOM Darwin",    url: "http://www.bom.gov.au/nt/",                       icon: "weather-partly-cloudy", color: "#87ceeb"},
  { label: "WillyWeather",  url: "https://www.willyweather.com.au/nt/darwin.html",  icon: "weather-windy",         color: "#7ec8e3"},
  { label: "Fishing World", url: "https://www.fishingworld.com.au/",                icon: "earth",                 color: C.gold   },
  { label: "Tackle World",  url: "https://www.tackleworld.com.au/",                 icon: "shopping",              color: "#f97316"},
  { label: "RecFish NT",    url: "https://www.recfishnt.com.au/",                   icon: "account-group",         color: "#34d399"},
  { label: "NT Fishing",    url: "https://nt.gov.au/fishing",                       icon: "office-building",       color: "#a78bfa"},
];

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function WebScreen() {
  const insets = useSafeAreaInsets();
  const [currentUrl, setCurrentUrl]     = useState("");
  const [inputUrl,   setInputUrl]       = useState("");
  const [canGoBack,  setCanGoBack]      = useState(false);
  const [canGoFwd,   setCanGoFwd]       = useState(false);
  const [loading,    setLoading]        = useState(false);
  const [progress,   setProgress]       = useState(0);
  const [showHome,   setShowHome]       = useState(true);
  const webRef = useRef<any>(null);

  const isNative = Platform.OS !== "web";

  const navigate = useCallback((target: string) => {
    let nav = target.trim();
    if (!nav) return;
    if (!/^https?:\/\//i.test(nav)) nav = "https://" + nav;
    setCurrentUrl(nav);
    setInputUrl(nav);
    setShowHome(false);
  }, []);

  const goHome = useCallback(() => {
    setCurrentUrl("");
    setInputUrl("");
    setShowHome(true);
    setCanGoBack(false);
    setCanGoFwd(false);
    setLoading(false);
  }, []);

  const handleNavState = useCallback((state: any) => {
    setCanGoBack(state.canGoBack);
    setCanGoFwd(state.canGoForward);
    if (state.url && state.url !== "about:blank") setInputUrl(state.url);
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <HVHeader subtitle="WEB BROWSER" />

      {/* ── URL bar ──────────────────────────────────────────────────────────── */}
      <View style={styles.urlBar}>
        <TouchableOpacity
          onPress={() => webRef.current?.goBack()}
          disabled={!canGoBack}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          style={[styles.navBtn, !canGoBack && { opacity: 0.28 }]}
        >
          <Feather name="chevron-left" size={22} color={C.teal} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => webRef.current?.goForward()}
          disabled={!canGoFwd}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          style={[styles.navBtn, !canGoFwd && { opacity: 0.28 }]}
        >
          <Feather name="chevron-right" size={22} color={C.teal} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={loading ? () => webRef.current?.stopLoading() : () => webRef.current?.reload()}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          style={styles.navBtn}
        >
          <Feather name={loading ? "x" : "refresh-cw"} size={17} color={C.teal} />
        </TouchableOpacity>

        <TextInput
          style={styles.urlInput}
          value={inputUrl}
          onChangeText={setInputUrl}
          onSubmitEditing={() => navigate(inputUrl)}
          placeholder="Enter URL or search…"
          placeholderTextColor={C.mute}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
          selectTextOnFocus
        />

        <TouchableOpacity
          onPress={() => navigate(inputUrl)}
          style={styles.goBtn}
          activeOpacity={0.8}
        >
          <Feather name="arrow-right" size={14} color={C.bg} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={goHome}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          style={styles.navBtn}
        >
          <Feather name="home" size={18} color={showHome ? C.teal : C.mute} />
        </TouchableOpacity>
      </View>

      {/* ── Progress bar ──────────────────────────────────────────────────────── */}
      {loading && (
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` as any }]} />
        </View>
      )}

      {/* ── Bookmarks home page ────────────────────────────────────────────────  */}
      {showHome ? (
        <ScrollView
          contentContainerStyle={[styles.homeScroll, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>FISHING QUICK LINKS</Text>
          <View style={styles.grid}>
            {BOOKMARKS.map((bm) => (
              <TouchableOpacity
                key={bm.url}
                onPress={() => navigate(bm.url)}
                style={styles.bmCard}
                activeOpacity={0.75}
              >
                <View style={[styles.bmIconWrap, { backgroundColor: bm.color + "22" }]}>
                  <MaterialCommunityIcons name={bm.icon as any} size={26} color={bm.color} />
                </View>
                <Text style={styles.bmLabel}>{bm.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {!isNative && (
            <Text style={[styles.sectionTitle, { color: C.mute, marginTop: 28, fontSize: 11 }]}>
              Full browsing available on iOS and Android
            </Text>
          )}
        </ScrollView>

      ) : isNative && WebView ? (
        /* ── WebView ────────────────────────────────────────────────────────── */
        <WebView
          ref={webRef}
          source={{ uri: currentUrl }}
          style={styles.webview}
          onNavigationStateChange={handleNavState}
          onLoadStart={() => { setLoading(true); setProgress(0); }}
          onLoadEnd={() => setLoading(false)}
          onLoadProgress={({ nativeEvent }: any) => setProgress(nativeEvent.progress)}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={C.teal} />
            </View>
          )}
        />
      ) : (
        /* ── Web-platform fallback ──────────────────────────────────────────── */
        <View style={styles.loadingWrap}>
          <MaterialCommunityIcons name="web" size={52} color={C.mute} />
          <Text style={[styles.sectionTitle, { color: C.mute, marginTop: 14, fontSize: 12 }]}>
            Open on your phone to browse
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  urlBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.card,
  },
  navBtn: {
    width: 34, height: 34,
    alignItems: "center", justifyContent: "center",
    borderRadius: 8,
  },
  urlInput: {
    flex: 1,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    color: C.white,
    fontSize: 13,
  },
  goBtn: {
    width: 30, height: 30,
    borderRadius: 15,
    backgroundColor: C.teal,
    alignItems: "center", justifyContent: "center",
  },

  progressBg: {
    height: 2,
    backgroundColor: C.border,
  },
  progressFill: {
    height: 2,
    backgroundColor: C.teal,
  },

  homeScroll: {
    padding: 16,
    gap: 16,
  },
  sectionTitle: {
    color: C.teal,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textAlign: "center",
    marginBottom: 4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "center",
  },
  bmCard: {
    width: "44%",
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    alignItems: "center",
    gap: 10,
  },
  bmIconWrap: {
    width: 52, height: 52,
    borderRadius: 26,
    alignItems: "center", justifyContent: "center",
  },
  bmLabel: {
    color: C.white,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },

  webview: { flex: 1 },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
});
