import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

import { HVHeader } from "@/components/HVHeader";
import { LilyPadCard } from "@/components/LilyPadCard";
import { useColors } from "@/hooks/useColors";
import { useCamera2 } from "@/hooks/useCamera2";
import { useCameraScanner } from "@/hooks/useCameraScanner";
import type { DiscoveredCamera } from "@/hooks/useCameraScanner";
import { LiveScanStore } from "@/stores/LiveScanStore";

// ─── SmartLife known default IPs to probe ─────────────────────────────────────
const SL_DEFAULT_PATH = "/snapshot.cgi";

export default function SmartLifeScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const cam2    = useCamera2();
  const scanner = useCameraScanner();

  const isConnected  = cam2.status === "connected";
  const isSearching  = cam2.status === "searching";

  const [manualIp,   setManualIp]   = useState(cam2.ip);
  const [manualPath, setManualPath] = useState(cam2.path || SL_DEFAULT_PATH);
  const [showManual, setShowManual] = useState(false);
  const [snapping,   setSnapping]   = useState(false);
  const [snapError,  setSnapError]  = useState<string | null>(null);
  const [activeSlCam, setActiveSlCam] = useState<DiscoveredCamera | null>(null);
  const hasAutoConnected = useRef(false);

  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const botPad = Platform.OS === "web" ? 80 : insets.bottom + 20;

  // ── Auto-scan on mount ─────────────────────────────────────────────────────
  useEffect(() => {
    scanner.scan("SmartLife");
    return () => {};
  }, []);

  // ── Auto-connect to first discovered SmartLife camera ─────────────────────
  const slCams = scanner.discovered.filter((c) => c.brand === "SmartLife");
  useEffect(() => {
    if (hasAutoConnected.current) return;
    if (slCams.length === 0) return;
    const cam = slCams[0];
    hasAutoConnected.current = true;
    cam2.setIp(cam.ip);
    cam2.setPath(cam.snapshotPath);
    cam2.startSearch();
    setActiveSlCam(cam);
  }, [slCams.length]);

  // ── Rescan ─────────────────────────────────────────────────────────────────
  const rescan = useCallback(() => {
    hasAutoConnected.current = false;
    scanner.clear();
    scanner.scan("SmartLife");
    if (isConnected || isSearching) {
      cam2.stopSearch();
      setActiveSlCam(null);
    }
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [isConnected, isSearching]);

  // ── Manual connect ─────────────────────────────────────────────────────────
  const connectManual = useCallback(() => {
    hasAutoConnected.current = true;
    cam2.setIp(manualIp.trim());
    cam2.setPath(manualPath.trim() || SL_DEFAULT_PATH);
    if (isConnected || isSearching) cam2.stopSearch();
    setTimeout(() => cam2.startSearch(), 150);
    setShowManual(false);
    setActiveSlCam(null);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [manualIp, manualPath, isConnected, isSearching]);

  // ── Connect to discovered camera ──────────────────────────────────────────
  const connectCam = useCallback((cam: DiscoveredCamera) => {
    hasAutoConnected.current = true;
    cam2.setIp(cam.ip);
    cam2.setPath(cam.snapshotPath);
    if (isConnected || isSearching) cam2.stopSearch();
    setTimeout(() => cam2.startSearch(), 150);
    setActiveSlCam(cam);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }, [isConnected, isSearching]);

  // ── Disconnect ────────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    cam2.stopSearch();
    hasAutoConnected.current = false;
    setActiveSlCam(null);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // ── Snap → Scan tab ───────────────────────────────────────────────────────
  const snapAndScan = useCallback(async () => {
    if (!isConnected || snapping) return;
    setSnapping(true);
    setSnapError(null);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const snap = await cam2.takeSnapshot();
      if (!snap?.base64) throw new Error("Snapshot failed — check camera connection.");
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      LiveScanStore.push(snap.base64, snap.uri, "live");
      router.navigate("/");
    } catch (err) {
      setSnapError(err instanceof Error ? err.message : "Snapshot failed");
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSnapping(false);
    }
  }, [isConnected, snapping]);

  // ── Status colour ──────────────────────────────────────────────────────────
  const statusColor = isConnected ? "#00d4aa" : isSearching ? "#ffd700" : "#ffffff44";
  const statusLabel = isConnected
    ? `LIVE · ${cam2.ip}${cam2.path}`
    : isSearching
    ? "CONNECTING…"
    : "NOT CONNECTED";

  // ── Preview URI ───────────────────────────────────────────────────────────
  const previewUri = isSearching || isConnected
    ? `http://${cam2.ip}${cam2.path}?t=${cam2.tick}`
    : null;

  return (
    <View style={[S.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[S.scroll, { paddingTop: topPad + 8, paddingBottom: botPad }]}
        showsVerticalScrollIndicator={false}
      >
        <HVHeader subtitle="SmartLife WiFi Camera" />

        {/* ── Title ── */}
        <View style={S.titleRow}>
          <MaterialCommunityIcons name="cctv" size={26} color="#00d4aa" />
          <View>
            <Text style={S.titleMain}>SMARTLIFE</Text>
            <Text style={[S.titleSub, { color: colors.mutedForeground }]}>
              WiFi camera · live feed · AI sonar scan
            </Text>
          </View>
        </View>

        {/* ── Status pill ── */}
        <View style={[S.statusPill, { borderColor: `${statusColor}55`, backgroundColor: `${statusColor}12` }]}>
          <View style={[S.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[S.statusText, { color: statusColor }]} numberOfLines={1}>
            {statusLabel}
          </Text>
          {isSearching && <ActivityIndicator size="small" color="#ffd700" style={{ marginLeft: 4 }} />}
        </View>

        {/* ── Live preview ── */}
        <LilyPadCard borderColor={isConnected ? "#00d4aa55" : "#ffffff11"} innerStyle={S.previewCard}>
          <View style={S.previewHeader}>
            <MaterialCommunityIcons name="video-wireless" size={16} color={isConnected ? "#00d4aa" : colors.mutedForeground} />
            <Text style={[S.previewLabel, { color: isConnected ? "#00d4aa" : colors.mutedForeground }]}>
              LIVE FEED
            </Text>
            {isConnected && (
              <View style={S.liveBadge}>
                <View style={S.liveDot} />
                <Text style={S.liveText}>LIVE</Text>
              </View>
            )}
          </View>

          <View style={S.previewFrame}>
            {previewUri ? (
              <Image
                source={{ uri: previewUri }}
                style={S.previewImage}
                resizeMode="cover"
                onLoad={cam2.onPreviewLoad}
                onError={cam2.onPreviewError}
              />
            ) : (
              <View style={S.previewPlaceholder}>
                <MaterialCommunityIcons name="cctv-off" size={48} color={colors.mutedForeground} />
                <Text style={[S.previewPlaceholderText, { color: colors.mutedForeground }]}>
                  {scanner.scanning
                    ? "Scanning for SmartLife cameras…"
                    : slCams.length === 0 && scanner.lastScanDone
                    ? "No cameras found on this network"
                    : "Connect a SmartLife camera to see live feed"}
                </Text>
              </View>
            )}
          </View>

          {/* ── Snap + AI Scan button ── */}
          <TouchableOpacity
            onPress={snapAndScan}
            disabled={!isConnected || snapping}
            activeOpacity={0.8}
            style={[S.snapBtn, { opacity: isConnected && !snapping ? 1 : 0.4 }]}
          >
            {snapping ? (
              <ActivityIndicator size="small" color="#0a1628" />
            ) : (
              <MaterialCommunityIcons name="radar" size={18} color="#0a1628" />
            )}
            <Text style={S.snapBtnText}>
              {snapping ? "Capturing…" : "Snap → AI Sonar Scan"}
            </Text>
          </TouchableOpacity>

          {snapError && (
            <Text style={S.snapError}>{snapError}</Text>
          )}
        </LilyPadCard>

        {/* ── Connection controls ── */}
        <View style={S.ctrlRow}>
          <TouchableOpacity
            onPress={rescan}
            disabled={scanner.scanning}
            activeOpacity={0.8}
            style={[S.ctrlBtn, { borderColor: "#ffffff22", opacity: scanner.scanning ? 0.5 : 1 }]}
          >
            <Feather name="refresh-cw" size={15} color={colors.mutedForeground} />
            <Text style={[S.ctrlBtnText, { color: colors.mutedForeground }]}>Rescan</Text>
          </TouchableOpacity>

          {isConnected || isSearching ? (
            <TouchableOpacity onPress={disconnect} activeOpacity={0.8}
              style={[S.ctrlBtn, { borderColor: "#ff220033" }]}>
              <Feather name="wifi-off" size={15} color="#ff2200" />
              <Text style={[S.ctrlBtnText, { color: "#ff2200" }]}>Disconnect</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity onPress={() => setShowManual((v) => !v)} activeOpacity={0.8}
            style={[S.ctrlBtn, { borderColor: "#00d4aa33" }]}>
            <Feather name={showManual ? "chevron-up" : "settings"} size={15} color="#00d4aa" />
            <Text style={[S.ctrlBtnText, { color: "#00d4aa" }]}>Manual IP</Text>
          </TouchableOpacity>
        </View>

        {/* ── Manual IP entry ── */}
        {showManual && (
          <LilyPadCard borderColor="#00d4aa33" innerStyle={{ gap: 10, padding: 14 }}>
            <Text style={[S.sectionLabel, { color: colors.mutedForeground }]}>MANUAL CONNECTION</Text>
            <View style={S.inputRow}>
              <Text style={[S.inputLabel, { color: colors.mutedForeground }]}>IP Address</Text>
              <TextInput
                value={manualIp}
                onChangeText={setManualIp}
                style={[S.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                placeholder="192.168.4.1"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="decimal-pad"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View style={S.inputRow}>
              <Text style={[S.inputLabel, { color: colors.mutedForeground }]}>Snapshot Path</Text>
              <TextInput
                value={manualPath}
                onChangeText={setManualPath}
                style={[S.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                placeholder="/snapshot.cgi"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <TouchableOpacity onPress={connectManual} activeOpacity={0.8} style={S.connectManualBtn}>
              <Feather name="wifi" size={15} color="#0a1628" />
              <Text style={S.connectManualText}>Connect</Text>
            </TouchableOpacity>
          </LilyPadCard>
        )}

        {/* ── Discovered cameras ── */}
        <View style={S.sectionHeader}>
          <Text style={[S.sectionLabel, { color: colors.mutedForeground }]}>DISCOVERED CAMERAS</Text>
          {scanner.scanning && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <ActivityIndicator size="small" color="#ffd700" />
              <Text style={{ color: "#ffd700", fontSize: 11, fontFamily: "Inter_500Medium" }}>Scanning…</Text>
            </View>
          )}
        </View>

        {slCams.length === 0 ? (
          <LilyPadCard borderColor="#ffffff11" innerStyle={{ padding: 16, alignItems: "center", gap: 8 }}>
            <MaterialCommunityIcons name="wifi-off" size={32} color={colors.mutedForeground} />
            <Text style={[S.emptyCopy, { color: colors.mutedForeground }]}>
              {scanner.scanning
                ? "Probing network for SmartLife cameras…"
                : scanner.lastScanDone
                ? "No SmartLife cameras found. Ensure your phone is on the same WiFi network as the camera, then tap Rescan."
                : "Tap Rescan to search for cameras."}
            </Text>
          </LilyPadCard>
        ) : (
          slCams.map((cam) => {
            const isCurrent = activeSlCam?.id === cam.id && (isConnected || isSearching);
            return (
              <LilyPadCard
                key={cam.id}
                borderColor={isCurrent ? "#00d4aa55" : "#ffffff11"}
                borderLeftColor={isCurrent ? "#00d4aa" : undefined}
                innerStyle={{ padding: 12, gap: 8 }}
              >
                <View style={S.camRow}>
                  <MaterialCommunityIcons name="cctv" size={22} color={isCurrent ? "#00d4aa" : colors.mutedForeground} />
                  <View style={{ flex: 1 }}>
                    <Text style={[S.camModel, { color: colors.foreground }]}>{cam.model}</Text>
                    <Text style={[S.camDetail, { color: colors.mutedForeground }]}>
                      {cam.ip}{cam.snapshotPath} · {cam.responseMs}ms
                    </Text>
                  </View>
                  {isCurrent && (
                    <View style={S.connectedBadge}>
                      <Text style={S.connectedBadgeText}>
                        {isConnected ? "LIVE" : "LINKING"}
                      </Text>
                    </View>
                  )}
                </View>

                {!isCurrent && (
                  <TouchableOpacity
                    onPress={() => connectCam(cam)}
                    activeOpacity={0.8}
                    style={S.connectBtn}
                  >
                    <Feather name="wifi" size={14} color="#0a1628" />
                    <Text style={S.connectBtnText}>Connect to Live Feed</Text>
                  </TouchableOpacity>
                )}
              </LilyPadCard>
            );
          })
        )}

        {/* ── Tips ── */}
        <LilyPadCard borderColor="#ffffff0a" innerStyle={{ padding: 14, gap: 8 }}>
          <Text style={[S.sectionLabel, { color: colors.mutedForeground }]}>SETUP TIPS</Text>
          {[
            { icon: "wifi", tip: "Connect your phone to the SmartLife camera's WiFi hotspot, or ensure both are on the same home/boat WiFi network." },
            { icon: "camera", tip: "SmartLife cameras typically use IP 192.168.4.1 in hotspot mode, or a router-assigned LAN IP." },
            { icon: "radar", tip: "Once connected, tap Snap → AI Sonar Scan to analyse the live view with HookVision AI." },
            { icon: "zap", tip: "Tap the snap button on the Live tab to feed frames directly to the sonar AI." },
          ].map(({ icon, tip }, i) => (
            <View key={i} style={S.tipRow}>
              <Feather name={icon as any} size={14} color="#00d4aa" style={{ marginTop: 1 }} />
              <Text style={[S.tipText, { color: colors.mutedForeground }]}>{tip}</Text>
            </View>
          ))}
        </LilyPadCard>
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  root:          { flex: 1 },
  scroll:        { paddingHorizontal: 14, gap: 12 },
  titleRow:      { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 },
  titleMain:     { fontSize: 26, fontFamily: "Oswald_700Bold", color: "#00d4aa", letterSpacing: 1.5 },
  titleSub:      { fontSize: 12, fontFamily: "Inter_400Regular" },
  statusPill:    { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  statusDot:     { width: 8, height: 8, borderRadius: 4 },
  statusText:    { flex: 1, fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  previewCard:   { gap: 10, padding: 0, overflow: "hidden" },
  previewHeader: { flexDirection: "row", alignItems: "center", gap: 6, padding: 12, paddingBottom: 0 },
  previewLabel:  { flex: 1, fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },
  liveBadge:     { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#ff220022", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  liveDot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: "#ff2200" },
  liveText:      { color: "#ff2200", fontSize: 10, fontFamily: "Inter_700Bold" },
  previewFrame:  { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#050d1a" },
  previewImage:  { width: "100%", height: "100%" },
  previewPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 20 },
  previewPlaceholderText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  snapBtn:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, margin: 12, marginTop: 10, backgroundColor: "#00d4aa", borderRadius: 12, paddingVertical: 12 },
  snapBtnText:   { color: "#0a1628", fontSize: 14, fontFamily: "Inter_700Bold" },
  snapError:     { color: "#ff2200", fontSize: 12, fontFamily: "Inter_500Medium", textAlign: "center", paddingHorizontal: 12, paddingBottom: 10 },
  ctrlRow:       { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  ctrlBtn:       { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1, minWidth: 90 },
  ctrlBtnText:   { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  inputRow:      { gap: 4 },
  inputLabel:    { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  input:         { borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, fontFamily: "Inter_400Regular" },
  connectManualBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#00d4aa", borderRadius: 10, paddingVertical: 11 },
  connectManualText: { color: "#0a1628", fontSize: 13, fontFamily: "Inter_700Bold" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionLabel:  { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1, textTransform: "uppercase" },
  emptyCopy:     { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  camRow:        { flexDirection: "row", alignItems: "center", gap: 10 },
  camModel:      { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  camDetail:     { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  connectedBadge:    { backgroundColor: "#00d4aa22", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "#00d4aa44" },
  connectedBadgeText: { color: "#00d4aa", fontSize: 10, fontFamily: "Inter_700Bold" },
  connectBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#00d4aa", borderRadius: 10, paddingVertical: 10 },
  connectBtnText: { color: "#0a1628", fontSize: 13, fontFamily: "Inter_700Bold" },
  tipRow:        { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  tipText:       { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
});
