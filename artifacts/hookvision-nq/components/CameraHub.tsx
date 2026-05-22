/**
 * CameraHub — zero-setup live camera section.
 *
 * Insta360 (ONE X3 / X4 / RS / Go 3):
 *   - Auto-connects via context on app start (no button press).
 *   - When connected, sends camera.startPreview via OSC, then plays the
 *     live RTSP stream at rtsp://192.168.42.1/live/preview via expo-video.
 *   - If RTSP fails (model mismatch / firewall), falls back to 6-s snapshot.
 *   → connect phone to "Insta360 X4-XXXXXX" WiFi hotspot.
 *
 * SmartLife / Tuya IP cameras:
 *   - Auto-scans all known Tuya IPs on mount.
 *   - Shows live MJPEG via WebView; falls back to 2-s snapshot polling.
 *   → connect phone to "SmartLife_XXXX" hotspot or home LAN.
 */
import React, {
  useCallback, useEffect, useRef, useState,
} from "react";
import {
  Animated, Image, Platform, StyleSheet, Text,
  TouchableOpacity, View,
} from "react-native";
import { WebView } from "react-native-webview";
import { VideoView, useVideoPlayer } from "expo-video";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { useInsta360Context } from "@/contexts/Insta360Context";
import { useCameraScanner, type DiscoveredCamera } from "@/hooks/useCameraScanner";

// ─── Insta360 RTSP URLs to try (in order) ────────────────────────────────────
const RTSP_CANDIDATES = [
  "rtsp://192.168.42.1/live/preview",   // ONE X3 / X4
  "rtsp://192.168.42.1/live",           // some RS / older firmware
  "rtsp://192.168.42.1:8554/live",      // alternate port
];

const C = {
  bg:     "#080e1a",
  card:   "#0c1628",
  border: "#1a2f4a",
  teal:   "#00d4aa",
  purple: "#a855f7",
  teal2:  "#00ffcc",
  gold:   "#ffd700",
  red:    "#ff4400",
  green:  "#00ff88",
  mute:   "rgba(255,255,255,0.28)",
  dim:    "rgba(255,255,255,0.72)",
};

// ─── Pulsing status dot ───────────────────────────────────────────────────────
function PulseDot({ color }: { color: string }) {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 0.15, duration: 600, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 1,    duration: 600, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={[S.dot, { backgroundColor: color, opacity: anim }]} />;
}

// ─── RTSP live player (separate component — useVideoPlayer must be called
//     unconditionally per React hook rules) ────────────────────────────────────
function RtspPlayer({
  url,
  onError,
}: {
  url: string;
  onError: () => void;
}) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  // Detect error via status polling — expo-video fires status events
  useEffect(() => {
    const sub = player.addListener("statusChange", ({ status, error }) => {
      if (status === "error" || error) onError();
    });
    return () => sub.remove();
  }, [player, onError]);

  return (
    <VideoView
      player={player}
      style={S.streamView}
      contentFit="contain"
      nativeControls={false}
      allowsFullscreen={false}
    />
  );
}

// ─── Insta360 camera card ─────────────────────────────────────────────────────
type InstaMode = "idle" | "starting" | "rtsp" | "rtsp-error" | "snapshot";

function Insta360Card() {
  const { camera, pipelines } = useInsta360Context();
  const { status, cameraInfo, connectionHint, activeBaseUrl } = camera;

  const isConnected = status === "connected";
  const isSearching = status === "searching";

  const [mode, setMode]           = useState<InstaMode>("idle");
  const [rtspUrl, setRtspUrl]     = useState(RTSP_CANDIDATES[0]);
  const [rtspAttempt, setAttempt] = useState(0);
  const prevConnected             = useRef(false);
  const pipelineStarted           = useRef(false);

  // ── Send camera.startPreview via OSC, then activate RTSP player ──────────
  const startPreview = useCallback(async (baseUrl: string) => {
    setMode("starting");
    try {
      await fetch(`${baseUrl}/osc/commands/execute`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: "camera.startPreview" }),
        signal:  AbortSignal.timeout(5000),
      });
    } catch {
      // startPreview may return non-200 on some firmware — still try RTSP
    }
    // Give the camera 1.5 s to open the stream before the player connects
    await new Promise((r) => setTimeout(r, 1500));
    setRtspUrl(RTSP_CANDIDATES[0]);
    setAttempt(0);
    setMode("rtsp");
  }, []);

  // ── When camera first connects, kick off preview sequence ─────────────────
  useEffect(() => {
    if (isConnected && !prevConnected.current) {
      prevConnected.current = true;
      startPreview(activeBaseUrl);
    }
    if (!isConnected) {
      prevConnected.current = false;
      setMode("idle");
    }
  }, [isConnected, activeBaseUrl, startPreview]);

  // ── Auto-start pipelines for snapshot fallback / AI detections ───────────
  useEffect(() => {
    if (isConnected && !pipelineStarted.current) {
      pipelineStarted.current = true;
      pipelines.start();
    }
    if (!isConnected) pipelineStarted.current = false;
  }, [isConnected]);

  // ── RTSP error → try next candidate or fall back to snapshot ─────────────
  const handleRtspError = useCallback(() => {
    const next = rtspAttempt + 1;
    if (next < RTSP_CANDIDATES.length) {
      setAttempt(next);
      setRtspUrl(RTSP_CANDIDATES[next]);
    } else {
      setMode("rtsp-error");
    }
  }, [rtspAttempt]);

  // ── Use snapshot mode as fallback ─────────────────────────────────────────
  const useSnapshot = useCallback(() => setMode("snapshot"), []);
  const retryRtsp   = useCallback(() => {
    setAttempt(0);
    setRtspUrl(RTSP_CANDIDATES[0]);
    startPreview(activeBaseUrl);
  }, [activeBaseUrl, startPreview]);

  const dotColor   = isConnected ? C.green : isSearching ? C.gold : C.mute;
  const statusText = isConnected
    ? mode === "rtsp" ? "LIVE · RTSP" : mode === "snapshot" ? "LIVE · SNAPSHOT" : "CONNECTING…"
    : isSearching ? "SEARCHING…" : "OFFLINE";

  return (
    <View style={[S.camCard, { borderColor: isConnected ? C.purple + "66" : C.border }]}>
      {/* Header */}
      <View style={S.cardHeader}>
        <View style={S.cardHeaderLeft}>
          <MaterialCommunityIcons name="rotate-360" size={16} color={C.purple} />
          <Text style={[S.cardTitle, { color: C.purple }]}>INSTA360</Text>
          {cameraInfo && <Text style={S.cardModel}>{cameraInfo.model}</Text>}
        </View>
        <View style={[S.statusPill, { borderColor: dotColor + "66", backgroundColor: dotColor + "18" }]}>
          <PulseDot color={dotColor} />
          <Text style={[S.statusText, { color: dotColor }]}>{statusText}</Text>
        </View>
      </View>

      {/* Feed area */}
      {isConnected && (mode === "starting") && (
        <View style={[S.feedContainer, S.feedWaiting]}>
          <MaterialCommunityIcons name="access-point" size={32} color={C.purple + "88"} />
          <Text style={S.waitText}>Starting live preview…</Text>
          <Text style={S.waitSub}>Activating RTSP stream on camera</Text>
        </View>
      )}

      {isConnected && mode === "rtsp" && (
        <View style={S.feedContainer}>
          <RtspPlayer url={rtspUrl} onError={handleRtspError} />
          <View style={S.frameFooter}>
            <MaterialCommunityIcons name="video-wireless" size={11} color={C.purple + "aa"} />
            <Text style={S.frameFooterText}>{rtspUrl}</Text>
          </View>
        </View>
      )}

      {isConnected && mode === "rtsp-error" && (
        <View style={[S.feedContainer, S.feedWaiting]}>
          <MaterialCommunityIcons name="video-off" size={32} color={C.red + "88"} />
          <Text style={S.waitText}>RTSP stream unavailable</Text>
          <Text style={S.waitSub}>Your camera model may use a different URL</Text>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
            <TouchableOpacity style={[S.actionBtn, { borderColor: C.purple + "66" }]} onPress={retryRtsp}>
              <Feather name="refresh-cw" size={12} color={C.purple} />
              <Text style={[S.actionBtnText, { color: C.purple }]}>Retry RTSP</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[S.actionBtn, { borderColor: C.teal + "66" }]} onPress={useSnapshot}>
              <MaterialCommunityIcons name="camera" size={12} color={C.teal} />
              <Text style={[S.actionBtnText, { color: C.teal }]}>Use Snapshots</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {isConnected && mode === "snapshot" && pipelines.latestSnapshotBase64 && (
        <View style={S.feedContainer}>
          <Image
            source={{ uri: `data:image/jpeg;base64,${pipelines.latestSnapshotBase64}` }}
            style={S.streamView}
            resizeMode="contain"
          />
          {pipelines.scanning && (
            <View style={S.scanOverlay}>
              <MaterialCommunityIcons name="radar" size={14} color={C.teal} />
              <Text style={S.scanOverlayText}>Scanning…</Text>
            </View>
          )}
          <View style={[S.frameFooter, { justifyContent: "space-between" }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <MaterialCommunityIcons name="camera-wireless" size={11} color={C.purple + "aa"} />
              <Text style={S.frameFooterText}>snapshot every 6 s</Text>
            </View>
            <TouchableOpacity onPress={retryRtsp} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Feather name="video" size={10} color={C.purple + "88"} />
              <Text style={[S.frameFooterText, { color: C.purple + "88" }]}>Try RTSP</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {isConnected && mode === "snapshot" && !pipelines.latestSnapshotBase64 && (
        <View style={[S.feedContainer, S.feedWaiting]}>
          <MaterialCommunityIcons name="camera-timer" size={32} color={C.purple + "55"} />
          <Text style={S.waitText}>Taking first snapshot…</Text>
          <Text style={S.waitSub}>About 6 seconds</Text>
        </View>
      )}

      {!isConnected && (
        <View style={[S.feedContainer, S.feedOffline]}>
          <MaterialCommunityIcons name="wifi-off" size={32} color={C.mute} />
          <Text style={S.offlineTitle}>Not connected</Text>
          <Text style={S.offlineInstr}>
            Turn on your Insta360{"\n"}Connect phone WiFi to:{"\n"}
            <Text style={{ color: C.purple, fontWeight: "700" }}>Insta360 X4-XXXXXX</Text>
            {"\n"}(your camera's hotspot name)
          </Text>
          {!!connectionHint && (
            <Text style={S.hintText} numberOfLines={3}>{connectionHint}</Text>
          )}
        </View>
      )}

      {/* AI detection chips */}
      {isConnected && (pipelines.surface?.activity || pipelines.croc?.detected) && (
        <View style={S.detectRow}>
          {pipelines.surface?.activity && (
            <View style={[S.detectChip, { backgroundColor: C.gold + "18", borderColor: C.gold + "44" }]}>
              <Text style={[S.detectChipText, { color: C.gold }]}>
                🐟 {pipelines.surface.urgency?.toUpperCase() ?? "ACTIVITY"} · surface
              </Text>
            </View>
          )}
          {pipelines.croc?.detected && (
            <View style={[S.detectChip, { backgroundColor: C.red + "18", borderColor: C.red + "55" }]}>
              <Text style={[S.detectChipText, { color: C.red }]}>
                ⚠️ CROC · {pipelines.croc.alertLevel}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ─── SmartLife / Tuya MJPEG WebView ──────────────────────────────────────────
function SmartLifeStream({ baseUrl }: { baseUrl: string }) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#000; display:flex; align-items:center; justify-content:center; height:100vh; overflow:hidden; }
    img  { width:100%; height:100%; object-fit:contain; }
    #msg { position:absolute; bottom:8px; left:0; right:0; text-align:center;
           color:rgba(255,255,255,.5); font-size:11px; font-family:monospace; }
  </style>
</head>
<body>
  <img id="f" src="" />
  <div id="msg">connecting…</div>
  <script>
    var BASE  = ${JSON.stringify(baseUrl)};
    var PATHS = [
      "/videostream.cgi",
      "/cgi-bin/videostream.cgi",
      "/mjpeg.cgi",
      "/stream",
      "/video",
    ];
    var SNAP  = "/snapshot.cgi";
    var img   = document.getElementById("f");
    var msg   = document.getElementById("msg");
    var tried = 0;
    var tick  = 0;

    function loadMjpeg(path) {
      img.onerror = function() {
        tried++;
        if (tried < PATHS.length) { loadMjpeg(PATHS[tried]); }
        else { msg.textContent = "LIVE · snapshot"; startSnap(); }
      };
      img.onload = function() { msg.textContent = "LIVE · stream"; };
      img.src = BASE + path;
    }

    function startSnap() {
      function refresh() {
        img.onerror = null;
        img.onload  = null;
        img.src = BASE + SNAP + "?_=" + (++tick);
      }
      refresh();
      setInterval(refresh, 2000);
    }

    loadMjpeg(PATHS[0]);
  </script>
</body>
</html>`;

  return (
    <WebView
      source={{ html }}
      style={S.streamView}
      scrollEnabled={false}
      mediaPlaybackRequiresUserAction={false}
      allowsInlineMediaPlayback
      mixedContentMode="always"
      originWhitelist={["*"]}
      javaScriptEnabled
    />
  );
}

// ─── SmartLife camera card ────────────────────────────────────────────────────
function SmartLifeCard() {
  const scanner = useCameraScanner();
  const [cam, setCam] = useState<DiscoveredCamera | null>(null);
  const scanTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    scanner.scan("SmartLife");
    scanTimer.current = setInterval(() => {
      if (!cam) scanner.scan("SmartLife");
    }, 15_000);
    return () => { if (scanTimer.current) clearInterval(scanTimer.current); };
  }, []);

  useEffect(() => {
    const found = scanner.discovered.find((c) => c.brand === "SmartLife");
    if (found && !cam) setCam(found);
  }, [scanner.discovered]);

  const isLive     = !!cam;
  const isScanning = scanner.scanning && !cam;
  const dotColor   = isLive ? C.green : isScanning ? C.gold : C.mute;
  const statusText = isLive ? "LIVE" : isScanning ? "SCANNING…" : "OFFLINE";

  const rescan = useCallback(() => { setCam(null); scanner.scan("SmartLife"); }, [scanner]);

  return (
    <View style={[S.camCard, { borderColor: isLive ? C.teal2 + "66" : C.border }]}>
      <View style={S.cardHeader}>
        <View style={S.cardHeaderLeft}>
          <MaterialCommunityIcons name="cctv" size={16} color={C.teal2} />
          <Text style={[S.cardTitle, { color: C.teal2 }]}>SMARTLIFE</Text>
          {cam && <Text style={S.cardModel}>{cam.ip}</Text>}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {!isLive && (
            <TouchableOpacity onPress={rescan} hitSlop={10} style={S.rescanBtn}>
              <Feather name="refresh-cw" size={12} color={C.mute} />
            </TouchableOpacity>
          )}
          <View style={[S.statusPill, { borderColor: dotColor + "66", backgroundColor: dotColor + "18" }]}>
            <PulseDot color={dotColor} />
            <Text style={[S.statusText, { color: dotColor }]}>{statusText}</Text>
          </View>
        </View>
      </View>

      {isLive && cam ? (
        <View style={S.feedContainer}>
          <SmartLifeStream baseUrl={cam.baseUrl} />
          <View style={S.frameFooter}>
            <MaterialCommunityIcons name="cctv" size={11} color={C.teal2 + "aa"} />
            <Text style={S.frameFooterText}>{cam.ip} · {cam.model}</Text>
          </View>
        </View>
      ) : (
        <View style={[S.feedContainer, S.feedOffline]}>
          <MaterialCommunityIcons name="wifi-off" size={32} color={C.mute} />
          <Text style={S.offlineTitle}>
            {isScanning ? "Scanning network…" : "Not connected"}
          </Text>
          {!isScanning && (
            <Text style={S.offlineInstr}>
              Connect phone WiFi to your SmartLife camera hotspot:{"\n"}
              <Text style={{ color: C.teal2, fontWeight: "700" }}>SmartLife_XXXX</Text>
              {"\n"}or check it's on the same home WiFi
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function CameraHub() {
  return (
    <View style={S.root}>
      <Insta360Card />
      <SmartLifeCard />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root: { gap: 12 },

  camCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: "hidden",
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flex: 1,
  },
  cardTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  cardModel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: C.mute,
    marginLeft: 2,
  },

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  rescanBtn: { padding: 4 },

  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  actionBtnText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },

  feedContainer: {
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  streamView: {
    width: "100%",
    height: 220,
    backgroundColor: "#000",
  },
  feedWaiting: {
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#000",
  },
  feedOffline: {
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 24,
    backgroundColor: "#000",
  },

  scanOverlay: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#000000bb",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  scanOverlayText: {
    color: C.teal,
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
  },

  frameFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#00000088",
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  frameFooterText: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    color: C.mute,
  },

  waitText: {
    color: C.mute,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  waitSub: {
    color: "#ffffff22",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  offlineTitle: {
    color: "#ffffff55",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  offlineInstr: {
    color: "#ffffff33",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 4,
  },
  hintText: {
    color: "#ffffff22",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 15,
    marginTop: 4,
    paddingHorizontal: 8,
  },

  detectRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  detectChip: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  detectChipText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
});
