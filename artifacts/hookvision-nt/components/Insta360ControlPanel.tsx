/**
 * Insta360ControlPanel — Full camera control UI.
 *
 * Shows:
 *  • Status bar   — battery %, storage remaining, temperature
 *  • Mode tabs    — VIDEO | PHOTO
 *  • Record/Snap  — big action button + live recording timer
 *  • Settings     — resolution, fps, EV, stabilization, white balance (expandable)
 *  • File browser — list + delete files from camera storage
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import type { UseInsta360OSCResult, CameraFile } from "@/hooks/useInsta360OSC";

const C = {
  bg:     "#080e1a",
  card:   "#0c1628",
  panel:  "#0a1220",
  border: "#1a2f4a",
  teal:   "#00d4aa",
  purple: "#a855f7",
  gold:   "#ffd700",
  red:    "#ff4400",
  green:  "#00ff88",
  blue:   "#3b82f6",
  mute:   "rgba(255,255,255,0.28)",
  dim:    "rgba(255,255,255,0.72)",
  white:  "#ffffff",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTimer(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function fmtStorage(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

function fmtFileSize(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`;
  return `${(bytes / 1e3).toFixed(0)} KB`;
}

function BatteryIcon({ level, charging }: { level: number; charging?: boolean }) {
  const name = charging ? "battery-charging" :
    level > 80 ? "battery" :
    level > 50 ? "battery-70" :
    level > 25 ? "battery-40" :
    level > 10 ? "battery-20" : "battery-alert";
  const color = level > 40 ? C.green : level > 20 ? C.gold : C.red;
  return <MaterialCommunityIcons name={name as any} size={14} color={color} />;
}

// ─── Option picker row ────────────────────────────────────────────────────────

interface PickerRowProps {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onSelect: (v: string) => void;
  loading?: boolean;
  accent?: string;
}

function PickerRow({ label, value, options, onSelect, loading, accent = C.purple }: PickerRowProps) {
  return (
    <View style={S.pickerRow}>
      <Text style={S.pickerLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.pickerScroll}>
        <View style={S.pickerChips}>
          {options.map((o) => {
            const active = o.value === value;
            return (
              <TouchableOpacity
                key={o.value}
                style={[S.chip, active && { borderColor: accent, backgroundColor: accent + "22" }]}
                onPress={() => !loading && onSelect(o.value)}
                disabled={loading}
              >
                {loading && active
                  ? <ActivityIndicator size={10} color={accent} />
                  : <Text style={[S.chipText, active && { color: accent }]}>{o.label}</Text>
                }
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── EV slider ───────────────────────────────────────────────────────────────

const EV_STEPS = [-3, -2, -1.7, -1.3, -1, -0.7, -0.3, 0, 0.3, 0.7, 1, 1.3, 1.7, 2, 3];

function EVRow({ value, onSelect, loading }: { value: number; onSelect: (v: number) => void; loading?: boolean }) {
  return (
    <View style={S.pickerRow}>
      <Text style={S.pickerLabel}>EV</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.pickerScroll}>
        <View style={S.pickerChips}>
          {EV_STEPS.map((ev) => {
            const active = Math.abs(ev - value) < 0.15;
            const label  = ev === 0 ? "0" : ev > 0 ? `+${ev}` : String(ev);
            return (
              <TouchableOpacity
                key={ev}
                style={[S.chip, active && { borderColor: C.gold, backgroundColor: C.gold + "22" }]}
                onPress={() => !loading && onSelect(ev)}
                disabled={loading}
              >
                {loading && active
                  ? <ActivityIndicator size={10} color={C.gold} />
                  : <Text style={[S.chipText, active && { color: C.gold }]}>{label}</Text>
                }
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── File browser modal ───────────────────────────────────────────────────────

function FileBrowserModal({
  visible,
  onClose,
  osc,
}: {
  visible: boolean;
  onClose: () => void;
  osc: UseInsta360OSCResult;
}) {
  const [files,    setFiles]    = useState<CameraFile[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [filter,   setFilter]   = useState<"all" | "image" | "video">("all");

  const load = useCallback(async () => {
    setLoading(true);
    const result = await osc.listFiles({ type: filter, count: 30 });
    setFiles(result);
    setLoading(false);
  }, [osc, filter]);

  useEffect(() => { if (visible) load(); }, [visible, load]);

  const handleDelete = useCallback(async (url: string) => {
    setDeleting(url);
    const ok = await osc.deleteFiles([url]);
    if (ok) setFiles((f) => f.filter((x) => x.fileUrl !== url));
    setDeleting(null);
  }, [osc]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={S.modalOverlay}>
        <View style={S.modalSheet}>
          <View style={S.modalHeader}>
            <Text style={S.modalTitle}>CAMERA FILES</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Feather name="x" size={20} color={C.mute} />
            </TouchableOpacity>
          </View>

          {/* Filter tabs */}
          <View style={S.filterRow}>
            {(["all", "video", "image"] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={[S.filterTab, filter === t && { borderColor: C.purple, backgroundColor: C.purple + "22" }]}
                onPress={() => setFilter(t)}
              >
                <Text style={[S.filterTabText, filter === t && { color: C.purple }]}>
                  {t.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={S.reloadBtn} onPress={load} disabled={loading}>
              <Feather name="refresh-cw" size={13} color={C.mute} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={S.fileCentre}>
              <ActivityIndicator color={C.purple} />
              <Text style={S.fileEmptyText}>Loading files…</Text>
            </View>
          ) : files.length === 0 ? (
            <View style={S.fileCentre}>
              <MaterialCommunityIcons name="folder-open-outline" size={36} color={C.mute} />
              <Text style={S.fileEmptyText}>No files found</Text>
            </View>
          ) : (
            <FlatList
              data={files}
              keyExtractor={(f) => f.fileUrl}
              style={S.fileList}
              renderItem={({ item }) => {
                const isVid = item.name.toLowerCase().endsWith(".mp4")
                  || item.name.toLowerCase().endsWith(".insv");
                const isDel = deleting === item.fileUrl;
                return (
                  <View style={S.fileRow}>
                    <MaterialCommunityIcons
                      name={isVid ? "video" : "image"}
                      size={18}
                      color={isVid ? C.purple : C.teal}
                    />
                    <View style={S.fileInfo}>
                      <Text style={S.fileName} numberOfLines={1}>{item.name}</Text>
                      <Text style={S.fileMeta}>
                        {fmtFileSize(item.size)}
                        {item.durationSecs != null && ` · ${fmtTimer(item.durationSecs)}`}
                        {item.width && item.height && ` · ${item.width}×${item.height}`}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDelete(item.fileUrl)}
                      disabled={isDel}
                      hitSlop={10}
                      style={S.deleteBtn}
                    >
                      {isDel
                        ? <ActivityIndicator size={12} color={C.red} />
                        : <Feather name="trash-2" size={14} color={C.red + "88"} />
                      }
                    </TouchableOpacity>
                  </View>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  osc: UseInsta360OSCResult;
}

export function Insta360ControlPanel({ osc }: Props) {
  const {
    cameraStatus, settings, isRecording, recordingTimeSecs,
    isLoadingSettings, lastCommandError,
    setMode, setVideoResolution, setFrameRate,
    setExposureCompensation, setWhiteBalance, setStabilization,
    startRecording, stopRecording,
  } = osc;

  const [showSettings,    setShowSettings]    = useState(false);
  const [showFiles,       setShowFiles]       = useState(false);
  const [commandPending,  setCommandPending]  = useState(false);

  const runCmd = useCallback(async (fn: () => Promise<boolean>) => {
    setCommandPending(true);
    await fn();
    setCommandPending(false);
  }, []);

  const handleRecord = useCallback(async () => {
    setCommandPending(true);
    if (isRecording) await stopRecording();
    else             await startRecording();
    setCommandPending(false);
  }, [isRecording, startRecording, stopRecording]);

  const storageUsedPct = cameraStatus && cameraStatus.storageTotalMB > 0
    ? Math.round((1 - cameraStatus.storageAvailableMB / cameraStatus.storageTotalMB) * 100)
    : 0;

  return (
    <View style={S.root}>
      {/* ── Status bar ─────────────────────────────────────────────────── */}
      {cameraStatus && (
        <View style={S.statusBar}>
          <View style={S.statusLeft}>
            <BatteryIcon
              level={cameraStatus.batteryLevel}
              charging={cameraStatus.batteryState === "charging"}
            />
            <Text style={S.statusVal}>{cameraStatus.batteryLevel}%</Text>

            <MaterialCommunityIcons name="sd" size={12} color={C.mute} style={{ marginLeft: 10 }} />
            <Text style={S.statusVal}>
              {fmtStorage(cameraStatus.storageAvailableMB)} free
            </Text>

            {/* Mini storage bar */}
            <View style={S.storageMini}>
              <View style={[S.storageFill, { width: `${Math.min(storageUsedPct, 100)}%` as any }]} />
            </View>
          </View>

          <View style={S.statusRight}>
            {cameraStatus.temperatureC != null && (
              <View style={S.tempBadge}>
                <MaterialCommunityIcons name="thermometer" size={11} color={cameraStatus.temperatureC > 45 ? C.red : C.mute} />
                <Text style={[S.statusVal, cameraStatus.temperatureC > 45 && { color: C.red }]}>
                  {cameraStatus.temperatureC}°C
                </Text>
              </View>
            )}
            {isRecording && (
              <View style={S.recBadge}>
                <View style={S.recDot} />
                <Text style={S.recTime}>{fmtTimer(recordingTimeSecs)}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* ── Mode tabs ──────────────────────────────────────────────────── */}
      {settings && (
        <View style={S.modeTabs}>
          {(["video", "photo"] as const).map((m) => {
            const active = settings.captureMode === m;
            const icon   = m === "video" ? "video" : "camera";
            return (
              <TouchableOpacity
                key={m}
                style={[S.modeTab, active && { borderBottomColor: C.purple, borderBottomWidth: 2 }]}
                onPress={() => runCmd(() => setMode(m))}
                disabled={commandPending || isLoadingSettings}
              >
                <Feather name={icon as any} size={13} color={active ? C.purple : C.mute} />
                <Text style={[S.modeTabText, active && { color: C.purple }]}>
                  {m.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* Settings toggle */}
          <TouchableOpacity
            style={[S.modeTab, showSettings && { borderBottomColor: C.teal, borderBottomWidth: 2 }]}
            onPress={() => setShowSettings((v) => !v)}
          >
            <Feather name="sliders" size={13} color={showSettings ? C.teal : C.mute} />
            <Text style={[S.modeTabText, showSettings && { color: C.teal }]}>SETTINGS</Text>
          </TouchableOpacity>

          {/* Files button */}
          <TouchableOpacity
            style={S.modeTab}
            onPress={() => setShowFiles(true)}
          >
            <Feather name="folder" size={13} color={C.mute} />
            <Text style={S.modeTabText}>FILES</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Action button ──────────────────────────────────────────────── */}
      {settings && (
        <View style={S.actionRow}>
          <TouchableOpacity
            style={[
              S.actionBtn,
              settings.captureMode === "video"
                ? isRecording
                  ? S.actionBtnStop
                  : S.actionBtnRecord
                : S.actionBtnPhoto,
              commandPending && S.actionBtnDisabled,
            ]}
            onPress={handleRecord}
            disabled={commandPending}
            activeOpacity={0.75}
          >
            {commandPending ? (
              <ActivityIndicator color={C.white} />
            ) : settings.captureMode === "video" ? (
              <>
                <MaterialCommunityIcons
                  name={isRecording ? "stop" : "record-circle"}
                  size={20}
                  color={C.white}
                />
                <Text style={S.actionBtnText}>
                  {isRecording ? "STOP" : "RECORD"}
                </Text>
              </>
            ) : (
              <>
                <MaterialCommunityIcons name="camera" size={20} color={C.white} />
                <Text style={S.actionBtnText}>CAPTURE</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* ── Settings panel ─────────────────────────────────────────────── */}
      {showSettings && settings && (
        <View style={S.settingsPanel}>
          {settings.captureMode === "video" && (
            <>
              <PickerRow
                label="Resolution"
                value={settings.videoResolution}
                options={[
                  { label: "8K",    value: "8K"   },
                  { label: "5.7K",  value: "5.7K" },
                  { label: "4K",    value: "4K"   },
                  { label: "2.7K",  value: "2.7K" },
                  { label: "1080p", value: "1080p" },
                  { label: "720p",  value: "720p"  },
                ]}
                onSelect={(v) => runCmd(() => setVideoResolution(v))}
                loading={isLoadingSettings}
              />
              <PickerRow
                label="FPS"
                value={String(settings.videoFrameRate)}
                options={[24, 25, 30, 50, 60, 100, 120].map((f) => ({ label: `${f}`, value: `${f}` }))}
                onSelect={(v) => runCmd(() => setFrameRate(Number(v)))}
                loading={isLoadingSettings}
              />
              <PickerRow
                label="Stabilisation"
                value={settings.stabilization}
                options={[
                  { label: "Off",          value: "off"           },
                  { label: "Standard",     value: "standard"      },
                  { label: "FlowState",    value: "flowState"     },
                  { label: "RockSteady",   value: "rockSteady"    },
                  { label: "RockSteady+",  value: "rockSteadyPlus" },
                ]}
                onSelect={(v) => runCmd(() => setStabilization(v))}
                loading={isLoadingSettings}
              />
            </>
          )}

          <EVRow
            value={settings.exposureCompensation}
            onSelect={(v) => runCmd(() => setExposureCompensation(v))}
            loading={isLoadingSettings}
          />

          <PickerRow
            label="White Balance"
            value={settings.whiteBalance}
            options={[
              { label: "Auto",          value: "auto"          },
              { label: "Daylight",      value: "daylight"      },
              { label: "Cloudy",        value: "cloudy"        },
              { label: "Incandescent",  value: "incandescent"  },
              { label: "Fluorescent",   value: "fluorescent"   },
            ]}
            onSelect={(v) => runCmd(() => setWhiteBalance(v))}
            loading={isLoadingSettings}
          />
        </View>
      )}

      {/* ── Command error ───────────────────────────────────────────────── */}
      {!!lastCommandError && (
        <View style={S.errorBar}>
          <Feather name="alert-circle" size={11} color={C.red} />
          <Text style={S.errorText} numberOfLines={1}>{lastCommandError}</Text>
        </View>
      )}

      {/* ── File browser modal ──────────────────────────────────────────── */}
      <FileBrowserModal
        visible={showFiles}
        onClose={() => setShowFiles(false)}
        osc={osc}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root: {
    borderTopWidth: 1,
    borderTopColor: C.border,
  },

  // Status bar
  statusBar: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: C.panel,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  statusLeft:  { flexDirection: "row", alignItems: "center", gap: 5, flex: 1 },
  statusRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusVal:   { fontSize: 10, fontFamily: "Inter_500Medium", color: C.mute },

  storageMini: {
    width: 48, height: 4, borderRadius: 2,
    backgroundColor: C.border,
    marginLeft: 6, overflow: "hidden",
  },
  storageFill: {
    height: "100%", borderRadius: 2,
    backgroundColor: C.teal,
  },

  tempBadge: { flexDirection: "row", alignItems: "center", gap: 2 },
  recBadge:  { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: C.red + "22", borderWidth: 1, borderColor: C.red + "44" },
  recDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: C.red },
  recTime:   { fontSize: 10, fontFamily: "Inter_700Bold", color: C.red, letterSpacing: 0.5 },

  // Mode tabs
  modeTabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.panel,
  },
  modeTab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, paddingVertical: 9,
  },
  modeTabText: {
    fontSize: 9, fontFamily: "Inter_700Bold",
    color: C.mute, letterSpacing: 0.5,
  },

  // Action button
  actionRow: {
    padding: 10,
    backgroundColor: C.panel,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  actionBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 12, borderRadius: 10,
  },
  actionBtnRecord:   { backgroundColor: C.red },
  actionBtnStop:     { backgroundColor: "#1a1a1a", borderWidth: 2, borderColor: C.red },
  actionBtnPhoto:    { backgroundColor: C.purple },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: {
    fontSize: 13, fontFamily: "Inter_700Bold",
    color: C.white, letterSpacing: 1,
  },

  // Settings panel
  settingsPanel: {
    backgroundColor: C.panel,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingBottom: 4,
  },

  pickerRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: C.border + "66",
  },
  pickerLabel: {
    width: 82, fontSize: 10, fontFamily: "Inter_600SemiBold",
    color: C.mute, letterSpacing: 0.4,
  },
  pickerScroll: { flex: 1 },
  pickerChips:  { flexDirection: "row", gap: 6 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 7, borderWidth: 1, borderColor: C.border,
    backgroundColor: "transparent",
    minWidth: 40, alignItems: "center",
  },
  chipText: {
    fontSize: 10, fontFamily: "Inter_500Medium", color: C.mute,
  },

  // Error bar
  errorBar: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: C.red + "11",
  },
  errorText: { fontSize: 10, fontFamily: "Inter_400Regular", color: C.red, flex: 1 },

  // File browser modal
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  modalTitle: {
    fontSize: 14, fontFamily: "Inter_700Bold", color: C.white, letterSpacing: 1,
  },

  filterRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 8,
    gap: 8, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  filterTab: {
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 7, borderWidth: 1, borderColor: C.border,
  },
  filterTabText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: C.mute },
  reloadBtn:     { marginLeft: "auto" as any, padding: 4 },

  fileList: { maxHeight: 350 },
  fileCentre: { height: 150, alignItems: "center", justifyContent: "center", gap: 8 },
  fileEmptyText: { fontSize: 12, fontFamily: "Inter_400Regular", color: C.mute },

  fileRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  fileInfo:  { flex: 1 },
  fileName:  { fontSize: 11, fontFamily: "Inter_500Medium", color: C.dim },
  fileMeta:  { fontSize: 9, fontFamily: "Inter_400Regular", color: C.mute, marginTop: 2 },
  deleteBtn: { padding: 4 },
});
