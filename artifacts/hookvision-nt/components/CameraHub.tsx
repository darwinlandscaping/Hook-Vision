/**
 * CameraHub — zero-setup live camera section.
 *
 * Insta360 (ONE X3 / X4 / RS / Go 3):
 *   Auto-connects via WiFi context on app start.
 *   Live frames delivered by the pipeline (snapshot every 6 s).
 *   → connect phone to the "Insta360 X4-XXXXXX" WiFi hotspot and it appears.
 *
 * SmartLife / Tuya IP cameras:
 *   Auto-scans all known SmartLife IPs on mount.
 *   Shows live MJPEG stream via WebView when found.
 *   → connect phone to the camera's WiFi hotspot (SmartLife_XXXX) or home LAN.
 *
 * No URLs to enter. No buttons to press. Just open and it works.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated, Image, Platform, StyleSheet, Text,
  TouchableOpacity, View,
} from "react-native";
import { WebView } from "react-native-webview";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { useInsta360Context } from "@/contexts/Insta360Context";
import { useCameraScanner, type DiscoveredCamera } from "@/hooks/useCameraScanner";

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

// ─── SmartLife MJPEG WebView ──────────────────────────────────────────────────
// Tries videostream.cgi first, falls back to 2-s snapshot polling.
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
    var mode  = "probe"; // "mjpeg" | "snap" | "probe"

    function loadMjpeg(path) {
      img.onerror = function() {
        tried++;
        if (tried < PATHS.length) { loadMjpeg(PATHS[tried]); }
        else { mode = "snap"; startSnap(); }
      };
      img.onload = function() { mode = "mjpeg"; msg.textContent = "LIVE · " + path; };
      img.src = BASE + path;
    }

    function startSnap() {
      msg.textContent = "LIVE · snapshot";
      function refresh() {
        img.onerror = null;
        img.onload  = null;
        img.src = BASE + SNAP + "?_=" + (++tick);
      }
      refresh();
      setInterval(refresh, 2000);
    }

    // Start probing MJPEG paths
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

// ─── Insta360 camera card ─────────────────────────────────────────────────────
function Insta360Card() {
  const { camera, pipelines } = useInsta360Context();
  const { status, cameraInfo, connectionHint } = camera;

  const isConnected = status === "connected";
  const isSearching = status === "searching";

  // Auto-start pipelines the moment the camera connects
  const pipelineStarted = useRef(false);
  useEffect(() => {
    if (isConnected && !pipelineStarted.current) {
      pipelineStarted.current = true;
      pipelines.start();
    }
    if (!isConnected) {
      pipelineStarted.current = false;
    }
  }, [isConnected]);

  const dotColor   = isConnected ? C.green : isSearching ? C.gold : C.mute;
  const statusText = isConnected ? "LIVE" : isSearching ? "CONNECTING…" : "OFFLINE";

  return (
    <View style={[S.camCard, { borderColor: isConnected ? C.purple + "66" : C.border }]}>
      {/* Card header */}
      <View style={S.cardHeader}>
        <View style={S.cardHeaderLeft}>
          <MaterialCommunityIcons name="rotate-360" size={16} color={C.purple} />
          <Text style={[S.cardTitle, { color: C.purple }]}>INSTA360</Text>
          {cameraInfo && (
            <Text style={S.cardModel}>{cameraInfo.model}</Text>
          )}
        </View>
        <View style={[S.statusPill, { borderColor: dotColor + "66", backgroundColor: dotColor + "18" }]}>
          <PulseDot color={dotColor} />
          <Text style={[S.statusText, { color: dotColor }]}>{statusText}</Text>
        </View>
      </View>

      {/* Live feed */}
      {isConnected && pipelines.latestSnapshotBase64 ? (
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
          <View style={S.frameFooter}>
            <MaterialCommunityIcons name="camera-wireless" size={11} color={C.purple + "aa"} />
            <Text style={S.frameFooterText}>192.168.42.1 · snapshot every 6 s</Text>
          </View>
        </View>
      ) : isConnected ? (
        <View style={[S.feedContainer, S.feedWaiting]}>
          <MaterialCommunityIcons name="camera-timer" size={32} color={C.purple + "55"} />
          <Text style={S.waitText}>Taking first snapshot…</Text>
          <Text style={S.waitSub}>This takes about 6 seconds</Text>
        </View>
      ) : (
        <View style={[S.feedContainer, S.feedOffline]}>
          <MaterialCommunityIcons name="wifi-off" size={32} color={C.mute} />
          <Text style={S.offlineTitle}>Not connected</Text>
          <Text style={S.offlineInstr}>
            Turn on your Insta360{"\n"}Connect phone WiFi to:{"\n"}
            <Text style={{ color: C.purple, fontFamily: "Inter_700Bold" }}>Insta360 X4-XXXXXX</Text>
            {"\n"}(or your camera's hotspot name)
          </Text>
          {connectionHint ? (
            <Text style={S.hintText} numberOfLines={3}>{connectionHint}</Text>
          ) : null}
        </View>
      )}

      {/* AI detections row */}
      {isConnected && (pipelines.surface || pipelines.croc) && (
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

// ─── SmartLife camera card ────────────────────────────────────────────────────
function SmartLifeCard() {
  const scanner = useCameraScanner();
  const [cam, setCam] = useState<DiscoveredCamera | null>(null);
  const scanTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-scan for SmartLife on mount; retry every 15 s if not found
  useEffect(() => {
    scanner.scan("SmartLife");
    scanTimer.current = setInterval(() => {
      if (!cam) scanner.scan("SmartLife");
    }, 15_000);
    return () => {
      if (scanTimer.current) clearInterval(scanTimer.current);
    };
  }, []);

  useEffect(() => {
    const found = scanner.discovered.find((c) => c.brand === "SmartLife");
    if (found && !cam) setCam(found);
  }, [scanner.discovered]);

  const isLive     = !!cam;
  const isScanning = scanner.scanning && !cam;
  const dotColor   = isLive ? C.green : isScanning ? C.gold : C.mute;
  const statusText = isLive ? "LIVE" : isScanning ? "SCANNING…" : "OFFLINE";

  const rescan = useCallback(() => {
    setCam(null);
    scanner.scan("SmartLife");
  }, [scanner]);

  return (
    <View style={[S.camCard, { borderColor: isLive ? C.teal2 + "66" : C.border }]}>
      {/* Card header */}
      <View style={S.cardHeader}>
        <View style={S.cardHeaderLeft}>
          <MaterialCommunityIcons name="cctv" size={16} color={C.teal2} />
          <Text style={[S.cardTitle, { color: C.teal2 }]}>SMARTLIFE</Text>
          {cam && (
            <Text style={S.cardModel}>{cam.ip}</Text>
          )}
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

      {/* Live feed */}
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
              <Text style={{ color: C.teal2, fontFamily: "Inter_700Bold" }}>SmartLife_XXXX</Text>
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

  rescanBtn: {
    padding: 4,
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
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
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
