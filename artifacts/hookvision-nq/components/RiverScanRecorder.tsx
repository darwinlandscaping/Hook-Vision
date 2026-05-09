import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import type { DepthPoint } from "@/context/RiverScanContext";
import { buildScanEntry } from "@/context/RiverScanContext";
import type { RiverScanEntry } from "@/context/RiverScanContext";

interface Props {
  visible: boolean;
  onClose: () => void;
  onComplete: (scan: RiverScanEntry) => void;
}

const MIN_POINTS = 3;
const MAX_DURATION = 10 * 60; // 10 minutes

export function RiverScanRecorder({ visible, onClose, onComplete }: Props) {
  const colors = useColors();

  const [elapsed, setElapsed] = useState(0);
  const [points, setPoints] = useState<DepthPoint[]>([]);
  const [gpsStatus, setGpsStatus] = useState<"waiting" | "locked" | "error">("waiting");
  const [currentPos, setCurrentPos] = useState<{ lat: number; lng: number } | null>(null);
  const [depth, setDepth] = useState(3.0);
  const [fishCount, setFishCount] = useState(0);
  const [locationName, setLocationName] = useState("");
  const [isFinishing, setIsFinishing] = useState(false);

  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);

  const startSession = useCallback(async () => {
    startTimeRef.current = Date.now();
    setElapsed(0);
    setPoints([]);
    setIsFinishing(false);

    timerRef.current = setInterval(() => {
      const e = Math.round((Date.now() - startTimeRef.current) / 1000);
      setElapsed(e);
      if (e >= MAX_DURATION) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
      }
    }, 1000);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setGpsStatus("error");
        return;
      }
      setGpsStatus("waiting");
      locationSubRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 1 },
        (loc) => {
          setGpsStatus("locked");
          setCurrentPos({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        },
      );
    } catch {
      setGpsStatus("error");
    }
  }, []);

  const stopSession = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    locationSubRef.current?.remove();
    locationSubRef.current = null;
    setGpsStatus("waiting");
    setCurrentPos(null);
  }, []);

  useEffect(() => {
    if (visible) {
      startSession();
    } else {
      stopSession();
      setElapsed(0);
      setPoints([]);
      setDepth(3.0);
      setFishCount(0);
      setLocationName("");
    }
    return () => { stopSession(); };
  }, [visible, startSession, stopSession]);

  const capturePoint = useCallback(() => {
    if (!currentPos) {
      Alert.alert("No GPS", "Waiting for GPS lock. Move to an open area if signal is weak.");
      return;
    }
    const pt: DepthPoint = {
      lat: currentPos.lat,
      lng: currentPos.lng,
      depth,
      fishCount,
      timestamp: Date.now(),
    };
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPoints((prev) => [...prev, pt]);
  }, [currentPos, depth, fishCount]);

  const finishScan = useCallback(() => {
    if (points.length < MIN_POINTS) return;
    setIsFinishing(true);
    stopSession();
    setTimeout(() => {
      const scan = buildScanEntry(
        `rscan_${Date.now()}`,
        startTimeRef.current,
        points,
        locationName.trim() || undefined,
      );
      setIsFinishing(false);
      onComplete(scan);
    }, 800);
  }, [points, locationName, stopSession, onComplete]);

  const handleClose = useCallback(() => {
    if (points.length > 0) {
      Alert.alert(
        "Discard Scan?",
        `You've captured ${points.length} point${points.length === 1 ? "" : "s"}. Closing will discard this scan.`,
        [
          { text: "Keep Recording", style: "cancel" },
          { text: "Discard", style: "destructive", onPress: onClose },
        ],
      );
    } else {
      onClose();
    }
  }, [points, onClose]);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  const progress = elapsed / MAX_DURATION;
  const canFinish = points.length >= MIN_POINTS;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent>
      <View style={[styles.root, { backgroundColor: colors.background }]}>

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.7}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <MaterialCommunityIcons name="waves" size={16} color={colors.primary} />
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>RIVER SCAN</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Timer */}
          <View style={styles.timerSection}>
            <Text style={[styles.timer, { color: colors.foreground }]}>{mm}:{ss}</Text>
            <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progress * 100}%`, backgroundColor: colors.primary },
                ]}
              />
            </View>
            <Text style={[styles.timerSub, { color: colors.mutedForeground }]}>
              10 MIN SCAN SESSION
            </Text>
          </View>

          {/* GPS Status */}
          <View style={[styles.gpsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.gpsRow}>
              <View
                style={[
                  styles.gpsDot,
                  {
                    backgroundColor:
                      gpsStatus === "locked" ? "#00C9A7"
                        : gpsStatus === "error" ? "#FF4444"
                          : "#FF6B00",
                  },
                ]}
              />
              <Text style={[styles.gpsLabel, { color: colors.foreground }]}>
                {gpsStatus === "locked" ? "GPS LOCKED" : gpsStatus === "error" ? "GPS ERROR" : "ACQUIRING GPS…"}
              </Text>
            </View>
            {currentPos && (
              <Text style={[styles.gpsCoords, { color: colors.mutedForeground }]}>
                {currentPos.lat.toFixed(5)}°, {currentPos.lng.toFixed(5)}°
              </Text>
            )}
            {!currentPos && gpsStatus !== "error" && (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 4 }} />
            )}
          </View>

          {/* Points captured */}
          <View style={[styles.pointsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="map-pin" size={16} color={colors.primary} />
            <Text style={[styles.pointsCount, { color: colors.foreground }]}>
              {points.length}
            </Text>
            <Text style={[styles.pointsLabel, { color: colors.mutedForeground }]}>
              {points.length === 1 ? "POINT CAPTURED" : "POINTS CAPTURED"}
              {points.length < MIN_POINTS && ` (need ${MIN_POINTS - points.length} more)`}
            </Text>
          </View>

          {/* Depth input */}
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              DEPTH FROM SOUNDER
            </Text>
            <View style={styles.depthRow}>
              <TouchableOpacity
                style={[styles.depthBtn, { borderColor: colors.border }]}
                onPress={() => setDepth((d) => Math.max(0.5, parseFloat((d - 0.5).toFixed(1))))}
                activeOpacity={0.7}
              >
                <Feather name="minus" size={20} color={colors.foreground} />
              </TouchableOpacity>
              <View style={styles.depthDisplay}>
                <Text style={[styles.depthValue, { color: colors.primary }]}>
                  {depth.toFixed(1)}
                </Text>
                <Text style={[styles.depthUnit, { color: colors.mutedForeground }]}>metres</Text>
              </View>
              <TouchableOpacity
                style={[styles.depthBtn, { borderColor: colors.border }]}
                onPress={() => setDepth((d) => parseFloat((d + 0.5).toFixed(1)))}
                activeOpacity={0.7}
              >
                <Feather name="plus" size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Fish count */}
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              FISH VISIBLE ON SONAR
            </Text>
            <View style={styles.fishRow}>
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[
                    styles.fishBtn,
                    {
                      borderColor: fishCount === n ? colors.primary : colors.border,
                      backgroundColor: fishCount === n ? colors.primary + "20" : "transparent",
                    },
                  ]}
                  onPress={() => setFishCount(n)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.fishBtnText,
                      { color: fishCount === n ? colors.primary : colors.mutedForeground },
                    ]}
                  >
                    {n === 5 ? "5+" : n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Location name */}
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              LOCATION NAME (OPTIONAL)
            </Text>
            <TextInput
              style={[styles.nameInput, { color: colors.foreground, borderColor: colors.border }]}
              placeholder="e.g. Oolloo Rock Bar"
              placeholderTextColor={colors.mutedForeground}
              value={locationName}
              onChangeText={setLocationName}
              maxLength={50}
              returnKeyType="done"
            />
          </View>

          {/* Capture button */}
          <TouchableOpacity
            style={[
              styles.captureBtn,
              {
                backgroundColor: gpsStatus === "locked" ? colors.primary : colors.border,
                opacity: gpsStatus === "locked" ? 1 : 0.5,
              },
            ]}
            onPress={capturePoint}
            activeOpacity={0.8}
            disabled={gpsStatus !== "locked"}
          >
            <Feather name="map-pin" size={18} color={gpsStatus === "locked" ? "#000" : colors.mutedForeground} />
            <Text
              style={[
                styles.captureBtnText,
                { color: gpsStatus === "locked" ? "#000" : colors.mutedForeground },
              ]}
            >
              CAPTURE POINT
            </Text>
          </TouchableOpacity>

          {/* Recent points preview */}
          {points.length > 0 && (
            <View style={styles.recentPoints}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                RECENT CAPTURES
              </Text>
              {points.slice(-4).reverse().map((pt, i) => (
                <View
                  key={pt.timestamp}
                  style={[styles.ptRow, { borderColor: colors.border + "60" }]}
                >
                  <MaterialCommunityIcons name="map-marker" size={12} color={colors.primary} />
                  <Text style={[styles.ptText, { color: colors.mutedForeground }]}>
                    {pt.lat.toFixed(4)}°, {pt.lng.toFixed(4)}°
                  </Text>
                  <Text style={[styles.ptDepth, { color: colors.primary }]}>
                    {pt.depth.toFixed(1)}m
                  </Text>
                  {pt.fishCount > 0 && (
                    <Text style={[styles.ptFish, { color: "#FF6B00" }]}>
                      {pt.fishCount}🐟
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Finish button */}
          <TouchableOpacity
            style={[
              styles.finishBtn,
              {
                borderColor: canFinish ? colors.primary : colors.border,
                opacity: canFinish ? 1 : 0.4,
              },
            ]}
            onPress={finishScan}
            activeOpacity={0.8}
            disabled={!canFinish}
          >
            {isFinishing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Feather name="box" size={16} color={canFinish ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.finishBtnText, { color: canFinish ? colors.primary : colors.mutedForeground }]}>
                  {canFinish ? "BUILD 3D MAP" : `CAPTURE ${MIN_POINTS - points.length} MORE POINT${MIN_POINTS - points.length === 1 ? "" : "S"}`}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: Platform.OS === "ios" ? 40 : 20 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 56 : 40,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  closeBtn: { padding: 4 },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 1.5 },
  body: { padding: 20, gap: 14 },
  timerSection: { alignItems: "center", paddingVertical: 16 },
  timer: { fontSize: 64, fontFamily: "Oswald_700Bold", letterSpacing: 2 },
  progressTrack: { width: "70%", height: 3, borderRadius: 2, overflow: "hidden", marginTop: 8 },
  progressFill: { height: "100%", borderRadius: 2 },
  timerSub: { fontSize: 10, fontFamily: "Inter_500Medium", letterSpacing: 1.5, marginTop: 6 },
  gpsCard: {
    borderRadius: 12, borderWidth: 1, padding: 14, gap: 4,
  },
  gpsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  gpsDot: { width: 8, height: 8, borderRadius: 4 },
  gpsLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  gpsCoords: { fontSize: 11, fontFamily: "Inter_400Regular" },
  pointsRow: {
    flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, padding: 14,
  },
  pointsCount: { fontSize: 22, fontFamily: "Oswald_700Bold" },
  pointsLabel: { fontSize: 11, fontFamily: "Inter_500Medium", flex: 1 },
  section: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 12 },
  sectionLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1 },
  depthRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16 },
  depthBtn: {
    width: 48, height: 48, borderRadius: 24, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  depthDisplay: { alignItems: "center", minWidth: 80 },
  depthValue: { fontSize: 40, fontFamily: "Oswald_700Bold" },
  depthUnit: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: -4 },
  fishRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  fishBtn: {
    width: 44, height: 36, borderRadius: 8, borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
  },
  fishBtnText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  nameInput: {
    height: 40, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12,
    fontSize: 14, fontFamily: "Inter_400Regular",
  },
  captureBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, paddingVertical: 18, borderRadius: 14,
  },
  captureBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  recentPoints: { gap: 8 },
  ptRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 6, borderBottomWidth: 1,
  },
  ptText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular" },
  ptDepth: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  ptFish: { fontSize: 11 },
  finishBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, paddingVertical: 16, borderRadius: 14, borderWidth: 1.5,
    marginTop: 4,
  },
  finishBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", letterSpacing: 0.8 },
});
