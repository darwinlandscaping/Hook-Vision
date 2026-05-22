import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { HUD_PAGE_URL } from "@/hooks/useHudStream";

export default function HudTab() {
  const insets = useSafeAreaInsets();
  const [key, setKey]         = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [stopped, setStopped] = useState(false);

  const reload = useCallback(() => {
    setError(false);
    setLoading(true);
    setStopped(false);
    setKey((k) => k + 1);
  }, []);

  const stop = useCallback(() => {
    setStopped(true);
    setLoading(false);
    setError(false);
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons name="glasses" size={20} color="#ffd700" />
          <Text style={styles.headerTitle}>CAST HUD</Text>
          {!stopped && (
            <>
              <View style={styles.liveDot} />
              <Text style={styles.liveLabel}>LIVE</Text>
            </>
          )}
          {stopped && (
            <View style={styles.stoppedBadge}>
              <Text style={styles.stoppedBadgeText}>STOPPED</Text>
            </View>
          )}
        </View>
        <View style={styles.headerRight}>
          {!stopped && (
            <TouchableOpacity onPress={stop} style={styles.stopBtn} hitSlop={12}>
              <Feather name="square" size={16} color="#ff4400" />
              <Text style={styles.stopBtnText}>Stop</Text>
            </TouchableOpacity>
          )}
          {!stopped && (
            <TouchableOpacity onPress={reload} style={styles.refreshBtn} hitSlop={12}>
              <Feather name="refresh-cw" size={18} color="#ffffff88" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Stopped screen ────────────────────────────────────────────────── */}
      {stopped && (
        <View style={styles.stoppedBox}>
          <MaterialCommunityIcons name="pause-circle-outline" size={64} color="#ffffff22" />
          <Text style={styles.stoppedTitle}>HUD Stopped</Text>
          <Text style={styles.stoppedSub}>
            The HUD stream has been stopped.{"\n"}Tap Resume to reconnect.
          </Text>
          <TouchableOpacity style={styles.resumeBtn} onPress={reload}>
            <Feather name="play" size={15} color="#ffd700" />
            <Text style={styles.resumeText}>Resume HUD</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── WebView ───────────────────────────────────────────────────────── */}
      {!stopped && error && (
        <View style={styles.errorBox}>
          <MaterialCommunityIcons name="wifi-off" size={48} color="#ffffff33" />
          <Text style={styles.errorTitle}>HUD Offline</Text>
          <Text style={styles.errorSub}>
            Make sure the app is on the same network as the API server.
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={reload}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!stopped && !error && (
        <WebView
          key={key}
          source={{ uri: HUD_PAGE_URL }}
          style={styles.webview}
          onLoadStart={() => { setLoading(true); setError(false); }}
          onLoadEnd={() => setLoading(false)}
          onError={() => { setLoading(false); setError(true); }}
          renderLoading={() => (
            <View style={styles.loadingBox}>
              <ActivityIndicator color="#00d4aa" size="large" />
              <Text style={styles.loadingText}>Connecting to HUD…</Text>
            </View>
          )}
          startInLoadingState
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={["*"]}
          mixedContentMode="always"
          userAgent={
            Platform.OS === "android"
              ? "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36"
              : undefined
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#0a1628",
    borderBottomWidth: 1,
    borderBottomColor: "#ffd70044",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 0.8,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#00d4aa",
    marginLeft: 4,
  },
  liveLabel: {
    color: "#00d4aa",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  stoppedBadge: {
    backgroundColor: "#ff440022",
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "#ff440055",
    marginLeft: 4,
  },
  stoppedBadgeText: {
    color: "#ff4400",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  stopBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#ff440018",
    borderWidth: 1,
    borderColor: "#ff440055",
  },
  stopBtnText: {
    color: "#ff4400",
    fontSize: 12,
    fontWeight: "700",
  },
  refreshBtn: {
    padding: 4,
  },
  webview: {
    flex: 1,
    backgroundColor: "#000",
  },
  loadingBox: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  loadingText: {
    color: "#ffffff88",
    fontSize: 13,
  },
  stoppedBox: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 32,
  },
  stoppedTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    marginTop: 4,
  },
  stoppedSub: {
    color: "#ffffff55",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
  },
  resumeBtn: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 13,
    backgroundColor: "#ffd70022",
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: "#ffd70066",
  },
  resumeText: {
    color: "#ffd700",
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 0.3,
  },
  errorBox: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 32,
  },
  errorTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  errorSub: {
    color: "#ffffff66",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: "#00d4aa22",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#00d4aa66",
  },
  retryText: {
    color: "#00d4aa",
    fontWeight: "700",
    fontSize: 14,
  },
});
