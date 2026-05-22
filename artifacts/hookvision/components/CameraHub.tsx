/**
 * CameraHub — RTSP / MJPEG / HLS / Snapshot stream player
 * Embeds at the bottom of the Home tab.
 *
 * Stream types:
 *   rtsp://…      — server proxies RTSP → HLS (needs internet to reach server)
 *   http://…/mjpeg — MJPEG live stream played directly in WebView (local WiFi)
 *   http://…/snap  — HTTP snapshot polled every 2 s (local WiFi)
 *   https://….m3u8 — HLS stream played directly via expo-video
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WebView } from "react-native-webview";
import { useVideoPlayer, VideoView } from "expo-video";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

const STORAGE_KEY = "@hv_cameras_v2";

// ─── Types ───────────────────────────────────────────────────────────────────

type StreamType = "rtsp" | "mjpeg" | "snapshot" | "hls";

interface CameraConfig {
  id: string;
  label: string;
  url: string;
  type: StreamType;
}

interface CameraHubProps {
  apiBase: string;
}

// ─── Colour constants (matches HookVision dark theme) ────────────────────────

const C = {
  bg:     "#080e1a",
  card:   "#0c1628",
  border: "#1a2f4a",
  teal:   "#00d4aa",
  blue:   "#00a8ff",
  gold:   "#ffd700",
  red:    "#ff4400",
  purple: "#a855f7",
  orange: "#ff9900",
  mute:   "rgba(255,255,255,0.28)",
  dim:    "rgba(255,255,255,0.72)",
};

const TYPE_COLOR: Record<StreamType, string> = {
  rtsp:     C.purple,
  mjpeg:    C.teal,
  hls:      C.blue,
  snapshot: C.gold,
};

// ─── Detect stream type from URL ─────────────────────────────────────────────

function detectType(url: string): StreamType {
  if (/^rtsp:\/\//i.test(url)) return "rtsp";
  if (/\.m3u8(\?|$)/i.test(url)) return "hls";
  if (/mjpeg|mjpg|stream\.cgi|videostream\.cgi/i.test(url)) return "mjpeg";
  return "snapshot";
}

// ─── HLS player (expo-video) ─────────────────────────────────────────────────

function HlsPlayer({ hlsUrl }: { hlsUrl: string }) {
  const player = useVideoPlayer(hlsUrl, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={S.streamView}
      contentFit="contain"
      nativeControls
    />
  );
}

// ─── MJPEG stream (WebView with <img>) ───────────────────────────────────────

function MjpegPlayer({ url }: { url: string }) {
  const html = `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#000;display:flex;align-items:center;justify-content:center;height:100vh;overflow:hidden}img{max-width:100%;max-height:100%;object-fit:contain}</style>
</head><body><img src="${url}" onerror="this.style.opacity=0.2" /></body></html>`;
  return (
    <WebView
      source={{ html }}
      style={S.streamView}
      scrollEnabled={false}
      mediaPlaybackRequiresUserAction={false}
      allowsInlineMediaPlayback
    />
  );
}

// ─── Snapshot polling (Image refreshed every 2 s) ────────────────────────────

function SnapshotPlayer({ url }: { url: string }) {
  const [src, setSrc] = useState({ uri: `${url}?_t=${Date.now()}` });
  const [err, setErr] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setErr(false);
      setSrc({ uri: `${url}?_t=${Date.now()}` });
    }, 2000);
    return () => clearInterval(id);
  }, [url]);

  if (err) {
    return (
      <View style={[S.streamView, S.streamCenter]}>
        <MaterialCommunityIcons name="camera-off" size={28} color={C.red} />
        <Text style={S.errText}>Snapshot unavailable</Text>
        <Text style={S.errSub}>{url}</Text>
      </View>
    );
  }

  return (
    <Image
      source={src}
      style={S.streamView}
      resizeMode="contain"
      onError={() => setErr(true)}
    />
  );
}

// ─── Single camera card ───────────────────────────────────────────────────────

interface StreamCardProps {
  cam: CameraConfig;
  apiBase: string;
  onRemove: () => void;
}

function StreamCard({ cam, apiBase, onRemove }: StreamCardProps) {
  const [expanded, setExpanded]   = useState(false);
  const [hlsUrl, setHlsUrl]       = useState<string | null>(null);
  const [rtspBusy, setRtspBusy]   = useState(false);
  const [rtspError, setRtspError] = useState<string | null>(null);

  const color = TYPE_COLOR[cam.type];

  const startRtsp = useCallback(async () => {
    setRtspBusy(true);
    setRtspError(null);
    try {
      const resp = await fetch(`${apiBase}/api/rtsp/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cam.id, url: cam.url }),
        signal: AbortSignal.timeout(15_000),
      });
      const data = await resp.json() as { hlsPath?: string; error?: string };
      if (!resp.ok) throw new Error(data.error ?? "Server error");
      const domain = process.env["EXPO_PUBLIC_DOMAIN"];
      const base   = domain ? `https://${domain}` : apiBase;
      setHlsUrl(`${base}${data.hlsPath}`);
    } catch (e: unknown) {
      setRtspError(e instanceof Error ? e.message : "Failed to start stream");
    } finally {
      setRtspBusy(false);
    }
  }, [cam.id, cam.url, apiBase]);

  const stopRtsp = useCallback(async () => {
    setHlsUrl(null);
    try {
      await fetch(`${apiBase}/api/rtsp/stop/${cam.id}`, { method: "DELETE" });
    } catch {}
  }, [cam.id, apiBase]);

  const handleExpand = useCallback(() => setExpanded((e) => !e), []);

  return (
    <View style={S.camCard}>
      <TouchableOpacity style={S.camHeader} onPress={handleExpand} activeOpacity={0.8}>
        <View style={[S.typeBadge, { backgroundColor: color + "22", borderColor: color + "55" }]}>
          <Text style={[S.typeText, { color }]}>{cam.type.toUpperCase()}</Text>
        </View>
        <Text style={S.camLabel} numberOfLines={1}>{cam.label}</Text>
        <TouchableOpacity onPress={onRemove} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="trash-2" size={13} color="#ff440055" />
        </TouchableOpacity>
        <Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color="#ffffff33" />
      </TouchableOpacity>

      <Text style={S.camUrl} numberOfLines={1}>{cam.url}</Text>

      {expanded && (
        <View style={S.streamContainer}>
          {cam.type === "rtsp" && (
            <>
              {rtspBusy && (
                <View style={[S.streamView, S.streamCenter]}>
                  <ActivityIndicator color={C.purple} size="large" />
                  <Text style={S.streamMsg}>Starting RTSP → HLS proxy…</Text>
                  <Text style={S.streamSub}>This takes ~3 seconds</Text>
                </View>
              )}
              {!rtspBusy && !hlsUrl && !rtspError && (
                <TouchableOpacity style={S.startBtn} onPress={startRtsp} activeOpacity={0.8}>
                  <MaterialCommunityIcons name="play-circle" size={22} color={C.purple} />
                  <Text style={[S.startBtnText, { color: C.purple }]}>Start RTSP Stream</Text>
                </TouchableOpacity>
              )}
              {rtspError && (
                <View style={[S.streamView, S.streamCenter]}>
                  <MaterialCommunityIcons name="camera-off" size={28} color={C.red} />
                  <Text style={S.errText}>{rtspError}</Text>
                  <Text style={S.errSub}>Check the RTSP URL is accessible from the server</Text>
                  <TouchableOpacity onPress={startRtsp} style={[S.retryBtn]}>
                    <Text style={{ color: C.purple, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>Retry</Text>
                  </TouchableOpacity>
                </View>
              )}
              {hlsUrl && (
                <>
                  <HlsPlayer hlsUrl={hlsUrl} />
                  <TouchableOpacity style={S.stopBtn} onPress={stopRtsp} activeOpacity={0.8}>
                    <Feather name="square" size={12} color={C.red} />
                    <Text style={{ color: C.red, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>Stop stream</Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}
          {cam.type === "mjpeg"    && <MjpegPlayer url={cam.url} />}
          {cam.type === "hls"      && <HlsPlayer hlsUrl={cam.url} />}
          {cam.type === "snapshot" && <SnapshotPlayer url={cam.url} />}
        </View>
      )}
    </View>
  );
}

// ─── Main CameraHub ───────────────────────────────────────────────────────────

export function CameraHub({ apiBase }: CameraHubProps) {
  const [cameras, setCameras] = useState<CameraConfig[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl]   = useState("");
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try { setCameras(JSON.parse(raw) as CameraConfig[]); } catch {}
      }
    });
  }, []);

  const saveCameras = useCallback(async (list: CameraConfig[]) => {
    setCameras(list);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }, []);

  const addCamera = useCallback(async () => {
    const url   = newUrl.trim();
    const label = newLabel.trim() || `Camera ${cameras.length + 1}`;
    if (!url) return;
    setSaving(true);
    await saveCameras([
      ...cameras,
      { id: `cam-${Date.now()}`, label, url, type: detectType(url) },
    ]);
    setNewLabel("");
    setNewUrl("");
    setShowAdd(false);
    setSaving(false);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [newLabel, newUrl, cameras, saveCameras]);

  const removeCamera = useCallback((id: string) => {
    Alert.alert("Remove camera?", "This will remove it from the list.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive",
        onPress: () => saveCameras(cameras.filter((c) => c.id !== id)),
      },
    ]);
  }, [cameras, saveCameras]);

  const detectedType = newUrl.trim() ? detectType(newUrl.trim()) : null;

  const TYPE_HINT: Record<StreamType, string> = {
    rtsp:     "Proxied via server → HLS (needs internet to reach server)",
    mjpeg:    "MJPEG stream played directly — works on local WiFi",
    hls:      "HLS stream played directly via native player",
    snapshot: "HTTP snapshot refreshed every 2 s — works on local WiFi",
  };

  return (
    <View style={S.root}>
      {/* ── Section header ── */}
      <View style={S.sectionRow}>
        <MaterialCommunityIcons name="cctv" size={14} color={C.teal} />
        <Text style={S.sectionHead}>LIVE CAMERAS</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={() => setShowAdd(true)}
          activeOpacity={0.8}
          style={S.addBtn}
        >
          <Feather name="plus" size={13} color={C.teal} />
          <Text style={S.addBtnText}>Add Camera</Text>
        </TouchableOpacity>
      </View>

      {/* ── Camera cards ── */}
      {cameras.length === 0 ? (
        <View style={S.emptyCard}>
          <MaterialCommunityIcons name="camera-plus-outline" size={30} color="#ffffff18" />
          <Text style={S.emptyTitle}>No cameras configured</Text>
          <Text style={S.emptySub}>Add RTSP, MJPEG, HLS or HTTP snapshot feeds</Text>
          <View style={S.hintList}>
            <Text style={S.hint}>
              <Text style={{ color: C.purple }}>rtsp://</Text>{"  "}RTSP stream (proxied via server)
            </Text>
            <Text style={S.hint}>
              <Text style={{ color: C.teal }}>http://ip/mjpeg</Text>{"  "}MJPEG live (local WiFi)
            </Text>
            <Text style={S.hint}>
              <Text style={{ color: C.gold }}>http://ip/snap.jpg</Text>{"  "}Snapshot every 2s
            </Text>
            <Text style={S.hint}>
              <Text style={{ color: C.blue }}>https://…/stream.m3u8</Text>{"  "}HLS direct
            </Text>
          </View>
        </View>
      ) : (
        cameras.map((cam) => (
          <StreamCard
            key={cam.id}
            cam={cam}
            apiBase={apiBase}
            onRemove={() => removeCamera(cam.id)}
          />
        ))
      )}

      {/* ── Add camera modal ── */}
      <Modal
        visible={showAdd}
        animationType="slide"
        transparent
        presentationStyle="overFullScreen"
        onRequestClose={() => setShowAdd(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={S.modalOverlay}
        >
          <View style={S.modalCard}>
            {/* Header */}
            <View style={S.modalHeader}>
              <MaterialCommunityIcons name="camera-plus" size={18} color={C.teal} />
              <Text style={S.modalTitle}>Add Camera Stream</Text>
              <TouchableOpacity
                onPress={() => setShowAdd(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather name="x" size={18} color="#ffffff55" />
              </TouchableOpacity>
            </View>

            {/* Name input */}
            <Text style={S.inputLabel}>NAME (optional)</Text>
            <TextInput
              style={S.input}
              value={newLabel}
              onChangeText={setNewLabel}
              placeholder="e.g. Boat bow cam"
              placeholderTextColor="#ffffff28"
              autoCapitalize="words"
            />

            {/* URL input */}
            <Text style={S.inputLabel}>STREAM URL</Text>
            <TextInput
              style={[S.input, { fontFamily: "monospace", fontSize: 12 }]}
              value={newUrl}
              onChangeText={setNewUrl}
              placeholder="rtsp://192.168.1.1:554/stream1"
              placeholderTextColor="#ffffff28"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />

            {/* Type hint */}
            {detectedType && (
              <View style={[S.typeHintBox, { borderColor: TYPE_COLOR[detectedType] + "44" }]}>
                <View style={[S.typeDot, { backgroundColor: TYPE_COLOR[detectedType] }]} />
                <Text style={S.typeHintText}>
                  <Text style={{ color: TYPE_COLOR[detectedType], fontFamily: "Inter_700Bold" }}>
                    {detectedType.toUpperCase()}
                  </Text>
                  {"  "}{TYPE_HINT[detectedType]}
                </Text>
              </View>
            )}

            {/* Save button */}
            <TouchableOpacity
              onPress={addCamera}
              disabled={!newUrl.trim() || saving}
              activeOpacity={0.8}
              style={[S.saveBtn, { opacity: !newUrl.trim() || saving ? 0.45 : 1 }]}
            >
              {saving
                ? <ActivityIndicator color="#000" size="small" />
                : <Text style={S.saveBtnText}>Add Camera</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root: { gap: 0 },

  sectionRow:  { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  sectionHead: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1.2, color: "#ffffff55" },
  addBtn:      { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: C.teal + "18", borderWidth: 1, borderColor: C.teal + "44" },
  addBtnText:  { fontSize: 11, fontFamily: "Inter_600SemiBold", color: C.teal },

  emptyCard:   { backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 20, alignItems: "center", gap: 6 },
  emptyTitle:  { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#ffffff44", marginTop: 4 },
  emptySub:    { fontSize: 11, fontFamily: "Inter_400Regular", color: "#ffffff28", textAlign: "center" },
  hintList:    { alignSelf: "stretch", marginTop: 8, gap: 5 },
  hint:        { fontSize: 11, fontFamily: "Inter_400Regular", color: "#ffffff38", lineHeight: 18 },

  camCard:      { backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, overflow: "hidden", marginBottom: 8 },
  camHeader:    { flexDirection: "row", alignItems: "center", gap: 8, padding: 10 },
  typeBadge:    { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  typeText:     { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  camLabel:     { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#ffffffcc" },
  camUrl:       { fontSize: 10, fontFamily: "Inter_400Regular", color: "#ffffff33", paddingHorizontal: 10, paddingBottom: 8, marginTop: -4 },

  streamContainer: { borderTopWidth: 1, borderTopColor: C.border },
  streamView:      { width: "100%", height: 200, backgroundColor: "#000" },
  streamCenter:    { alignItems: "center", justifyContent: "center", gap: 8 },
  streamMsg:       { color: "#ffffff66", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 4 },
  streamSub:       { color: "#ffffff33", fontSize: 10, fontFamily: "Inter_400Regular" },
  errText:         { color: C.red, fontSize: 11, fontFamily: "Inter_600SemiBold", textAlign: "center", paddingHorizontal: 16 },
  errSub:          { color: "#ffffff33", fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 16 },
  startBtn:        { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 18, backgroundColor: C.purple + "11" },
  startBtnText:    { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  stopBtn:         { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, backgroundColor: C.red + "11" },
  retryBtn:        { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 6, borderWidth: 1, borderColor: C.purple + "55", backgroundColor: C.purple + "11" },

  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "#000000bb" },
  modalCard:    { backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: C.border, padding: 22, gap: 10 },
  modalHeader:  { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  modalTitle:   { flex: 1, fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
  inputLabel:   { fontSize: 9, fontFamily: "Inter_700Bold", color: "#ffffff55", letterSpacing: 0.8, marginTop: 4 },
  input:        { backgroundColor: C.bg, borderRadius: 8, borderWidth: 1, borderColor: C.border, color: "#fff", padding: 11, fontSize: 13, fontFamily: "Inter_400Regular" },
  typeHintBox:  { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#ffffff08", borderRadius: 8, borderWidth: 1, padding: 10 },
  typeDot:      { width: 8, height: 8, borderRadius: 4, marginTop: 3 },
  typeHintText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", color: "#ffffffaa", lineHeight: 17 },
  saveBtn:      { backgroundColor: C.teal, borderRadius: 10, alignItems: "center", paddingVertical: 13, marginTop: 6 },
  saveBtnText:  { fontSize: 14, fontFamily: "Inter_700Bold", color: "#000" },
});
