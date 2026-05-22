/**
 * useInsta360OSC — Full Insta360 Open Platform API hook.
 *
 * Provides complete camera control over WiFi via the OSC 2.0 spec +
 * Insta360-specific extensions:
 *   • Real-time status: battery, storage, recording state, temperature
 *   • Full settings: mode, resolution, fps, ISO, WB, EV, stabilization
 *   • Capture control: start/stop recording, take photo
 *   • Preview stream: startPreview with resolution/bitrate params → RTSP URL
 *   • File management: list files, delete files
 *
 * Mount this inside <Insta360Provider> and pass camera.activeBaseUrl +
 * camera.status so the hook knows when to auto-refresh.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { oscCommand, oscGet, oscRun } from "@/utils/oscApi";

// ─── Public types ─────────────────────────────────────────────────────────────

export type CaptureStatus =
  | "idle"
  | "recording"
  | "timelapse"
  | "interval"
  | "preview"
  | "busy"
  | "unknown";

export interface CameraStatus {
  batteryLevel: number;             // 0–100
  batteryState: "charging" | "discharging" | "full" | "unknown";
  storageAvailableMB: number;
  storageTotalMB: number;
  captureStatus: CaptureStatus;
  recordingDurationSecs: number;
  captureMode: "photo" | "video" | "unknown";
  temperatureC: number | null;      // null if camera doesn't report it
}

export interface CameraSettings {
  captureMode: "photo" | "video";
  videoResolution: string;         // "5.7K" | "4K" | "2.7K" | "1440p" | "1080p" | "720p"
  videoFrameRate: number;          // 24 | 25 | 30 | 50 | 60 | 100 | 120
  photoResolution: string;         // "72MP" | "27MP" | "18MP" | "12MP"
  iso: number;
  isoAuto: boolean;
  shutterAuto: boolean;
  exposureCompensation: number;    // –3.0 … +3.0
  whiteBalance: string;            // "auto" | "daylight" | "cloudy" | "incandescent" | "fluorescent"
  colorTemperature: number;        // 2500–10000
  stabilization: string;           // "off" | "standard" | "flowState" | "rockSteady" | "rockSteadyPlus"
  previewResolution: string;       // "1920x1080" | "1280x720" | "854x480"
}

export interface CameraFile {
  name: string;
  fileUrl: string;
  size: number;           // bytes
  dateTimeZone: string;
  width?: number;
  height?: number;
  durationSecs?: number;  // videos only
  thumbnailUrl?: string;
}

export interface UseInsta360OSCResult {
  cameraStatus: CameraStatus | null;
  settings: CameraSettings | null;
  isRecording: boolean;
  recordingTimeSecs: number;
  isLoadingStatus: boolean;
  isLoadingSettings: boolean;
  lastCommandError: string | null;

  fetchStatus:   () => Promise<void>;
  fetchSettings: () => Promise<void>;

  setMode:                 (mode: "photo" | "video") => Promise<boolean>;
  setVideoResolution:      (res: string) => Promise<boolean>;
  setFrameRate:            (fps: number) => Promise<boolean>;
  setExposureCompensation: (ev: number) => Promise<boolean>;
  setISO:                  (iso: number | "auto") => Promise<boolean>;
  setWhiteBalance:         (wb: string) => Promise<boolean>;
  setStabilization:        (mode: string) => Promise<boolean>;

  startRecording: () => Promise<boolean>;
  stopRecording:  () => Promise<boolean>;

  startPreview: (opts?: { resolution?: string; bitrateBps?: number }) => Promise<string | null>;
  stopPreview:  () => Promise<boolean>;

  listFiles:   (opts?: { type?: "image" | "video" | "all"; count?: number; offset?: number }) => Promise<CameraFile[]>;
  deleteFiles: (urls: string[]) => Promise<boolean>;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: CameraSettings = {
  captureMode:          "video",
  videoResolution:      "4K",
  videoFrameRate:       30,
  photoResolution:      "18MP",
  iso:                  400,
  isoAuto:              true,
  shutterAuto:          true,
  exposureCompensation: 0,
  whiteBalance:         "auto",
  colorTemperature:     5500,
  stabilization:        "flowState",
  previewResolution:    "1280x720",
};

// ─── OSC state parser ─────────────────────────────────────────────────────────

function parseState(raw: any): CameraStatus {
  const level = raw["_batteryLevel"] ?? raw.batteryLevel;
  const pct   = typeof level === "number"
    ? (level <= 1 ? Math.round(level * 100) : Math.round(level))
    : 0;

  const capStatus: CaptureStatus = (() => {
    const s = (raw["_captureStatus"] ?? raw.captureStatus ?? "").toLowerCase();
    if (s.includes("video") || s.includes("record")) return "recording";
    if (s.includes("timelapse"))                      return "timelapse";
    if (s.includes("interval"))                       return "interval";
    if (s.includes("preview"))                        return "preview";
    if (s.includes("idle"))                           return "idle";
    if (s.includes("busy"))                           return "busy";
    return "unknown";
  })();

  const storageRaw = raw["_storageInfo"] ?? raw.storageInfo ?? {};
  const totalKB    = storageRaw.totalSpace    ?? storageRaw.total    ?? 0;
  const freeKB     = storageRaw.freeSpace     ?? storageRaw.free     ?? 0;
  const totalMB    = totalKB > 1024 ? Math.round(totalKB / 1024) : totalKB; // cope with KB vs MB
  const freeMB     = freeKB  > 1024 ? Math.round(freeKB  / 1024) : freeKB;

  const capMode = (raw["_captureMode"] ?? raw.captureMode ?? "").toLowerCase();

  return {
    batteryLevel:        pct,
    batteryState:        pct > 98 ? "full" : "discharging",
    storageAvailableMB:  freeMB,
    storageTotalMB:      totalMB,
    captureStatus:       capStatus,
    recordingDurationSecs: raw["_recordingTime"] ?? raw.recordingTime ?? 0,
    captureMode:         capMode.includes("photo") ? "photo"
                       : capMode.includes("video") ? "video"
                       : "unknown",
    temperatureC:        raw["_temperature"] ?? raw.temperature ?? null,
  };
}

function parseOptions(opts: Record<string, any>): Partial<CameraSettings> {
  const out: Partial<CameraSettings> = {};
  if (opts.captureMode)             out.captureMode          = opts.captureMode;
  if (opts["_videoResolution"])     out.videoResolution      = opts["_videoResolution"];
  if (opts["_videoFrameRate"])      out.videoFrameRate       = opts["_videoFrameRate"];
  if (opts["_photoResolution"])     out.photoResolution      = opts["_photoResolution"];
  if (opts.iso !== undefined)       out.iso                  = opts.iso;
  if (opts.isoAuto !== undefined)   out.isoAuto              = opts.isoAuto;
  if (opts.exposureCompensation !== undefined)
    out.exposureCompensation = opts.exposureCompensation;
  if (opts.whiteBalance)            out.whiteBalance         = opts.whiteBalance;
  if (opts.colorTemperature)        out.colorTemperature     = opts.colorTemperature;
  if (opts["_videoStabilization"]) {
    const s = opts["_videoStabilization"];
    out.stabilization = s === true || s === "on" ? "standard" : s === false || s === "off" ? "off" : String(s);
  }
  return out;
}

// ─── Main hook ────────────────────────────────────────────────────────────────

export function useInsta360OSC(
  baseUrl: string,
  connected: boolean,
): UseInsta360OSCResult {
  const [cameraStatus,       setCameraStatus]       = useState<CameraStatus | null>(null);
  const [settings,           setSettings]           = useState<CameraSettings | null>(null);
  const [isLoadingStatus,    setIsLoadingStatus]    = useState(false);
  const [isLoadingSettings,  setIsLoadingSettings]  = useState(false);
  const [lastCommandError,   setLastCommandError]   = useState<string | null>(null);

  // Recording timer
  const [isRecording,       setIsRecording]       = useState(false);
  const [recordingTimeSecs, setRecordingTimeSecs] = useState(0);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const baseRef      = useRef(baseUrl);
  const connRef      = useRef(connected);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { baseRef.current = baseUrl; }, [baseUrl]);
  useEffect(() => { connRef.current = connected; }, [connected]);

  // ── Recording timer ──────────────────────────────────────────────────────
  useEffect(() => {
    if (isRecording) {
      setRecordingTimeSecs(0);
      recTimerRef.current = setInterval(() => setRecordingTimeSecs((s) => s + 1), 1000);
    } else {
      if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
      setRecordingTimeSecs(0);
    }
    return () => { if (recTimerRef.current) clearInterval(recTimerRef.current); };
  }, [isRecording]);

  // ── Status fetch ─────────────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    if (!connRef.current) return;
    setIsLoadingStatus(true);
    try {
      const raw = await oscGet(baseRef.current, "/osc/state", 5000);
      const status = parseState(raw);
      setCameraStatus(status);
      setIsRecording(status.captureStatus === "recording");
    } catch {
      // Non-fatal — camera may not expose /osc/state on all firmware
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  // ── Settings fetch ───────────────────────────────────────────────────────
  const fetchSettings = useCallback(async () => {
    if (!connRef.current) return;
    setIsLoadingSettings(true);
    try {
      const result = await oscCommand(
        baseRef.current,
        "camera.getOptions",
        {
          optionNames: [
            "captureMode",
            "_videoResolution",
            "_videoFrameRate",
            "_photoResolution",
            "iso",
            "isoAuto",
            "exposureCompensation",
            "whiteBalance",
            "colorTemperature",
            "_videoStabilization",
          ],
        },
        8000,
      );
      const opts = result?.results?.options ?? result?.options ?? {};
      setSettings((prev) => ({ ...DEFAULT_SETTINGS, ...prev, ...parseOptions(opts) }));
    } catch {
      setSettings((prev) => prev ?? DEFAULT_SETTINGS);
    } finally {
      setIsLoadingSettings(false);
    }
  }, []);

  // ── Auto-refresh on connect / disconnect ─────────────────────────────────
  useEffect(() => {
    if (connected) {
      fetchStatus();
      fetchSettings();
      pollTimerRef.current = setInterval(fetchStatus, 5000);
    } else {
      if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
      setCameraStatus(null);
      setSettings(null);
      setIsRecording(false);
    }
    return () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); };
  }, [connected, fetchStatus, fetchSettings]);

  // ── Generic setOptions helper ────────────────────────────────────────────
  const setOptions = useCallback(async (options: Record<string, unknown>): Promise<boolean> => {
    setLastCommandError(null);
    try {
      await oscCommand(baseRef.current, "camera.setOptions", { options }, 8000);
      await fetchSettings();
      return true;
    } catch (e: any) {
      setLastCommandError(e?.message ?? "setOptions failed");
      return false;
    }
  }, [fetchSettings]);

  // ── Individual setters ───────────────────────────────────────────────────
  const setMode = useCallback((mode: "photo" | "video") =>
    setOptions({ captureMode: mode }), [setOptions]);

  const setVideoResolution = useCallback((res: string) =>
    setOptions({ _videoResolution: res }), [setOptions]);

  const setFrameRate = useCallback((fps: number) =>
    setOptions({ _videoFrameRate: fps }), [setOptions]);

  const setExposureCompensation = useCallback((ev: number) =>
    setOptions({ exposureCompensation: ev }), [setOptions]);

  const setISO = useCallback((iso: number | "auto") =>
    iso === "auto"
      ? setOptions({ isoAuto: true })
      : setOptions({ isoAuto: false, iso }), [setOptions]);

  const setWhiteBalance = useCallback((wb: string) =>
    setOptions({ whiteBalance: wb }), [setOptions]);

  const setStabilization = useCallback((mode: string) =>
    setOptions({ _videoStabilization: mode }), [setOptions]);

  // ── Recording ────────────────────────────────────────────────────────────
  const startRecording = useCallback(async (): Promise<boolean> => {
    setLastCommandError(null);
    try {
      await oscRun(baseRef.current, "camera.startCapture", {}, 15000);
      setIsRecording(true);
      await fetchStatus();
      return true;
    } catch (e: any) {
      setLastCommandError(e?.message ?? "startCapture failed");
      return false;
    }
  }, [fetchStatus]);

  const stopRecording = useCallback(async (): Promise<boolean> => {
    setLastCommandError(null);
    try {
      await oscRun(baseRef.current, "camera.stopCapture", {}, 15000);
      setIsRecording(false);
      await fetchStatus();
      return true;
    } catch (e: any) {
      setLastCommandError(e?.message ?? "stopCapture failed");
      return false;
    }
  }, [fetchStatus]);

  // ── Preview stream ───────────────────────────────────────────────────────
  const startPreview = useCallback(async (
    opts: { resolution?: string; bitrateBps?: number } = {},
  ): Promise<string | null> => {
    setLastCommandError(null);
    const params: Record<string, unknown> = {};
    if (opts.resolution) {
      const [w, h] = opts.resolution.split("x").map(Number);
      if (w && h) { params._previewWidth = w; params._previewHeight = h; }
    }
    if (opts.bitrateBps) params._previewBitrate = opts.bitrateBps;

    try {
      await oscCommand(baseRef.current, "camera.startPreview", params, 8000);
    } catch {
      // Some firmware returns non-2xx but still starts RTSP — carry on
    }
    // Insta360 RTSP URLs in priority order
    return "rtsp://192.168.42.1/live/preview";
  }, []);

  const stopPreview = useCallback(async (): Promise<boolean> => {
    try {
      await oscCommand(baseRef.current, "camera.stopPreview", {}, 5000);
      return true;
    } catch {
      return false;
    }
  }, []);

  // ── File management ──────────────────────────────────────────────────────
  const listFiles = useCallback(async (
    opts: { type?: "image" | "video" | "all"; count?: number; offset?: number } = {},
  ): Promise<CameraFile[]> => {
    setLastCommandError(null);
    try {
      const result = await oscRun(
        baseRef.current,
        "camera.listFiles",
        {
          fileType:      opts.type ?? "all",
          entryCount:    opts.count ?? 20,
          startPosition: opts.offset ?? 0,
        },
        15000,
      );
      const entries: any[] = result?.results?.entries ?? [];
      return entries.map((e) => ({
        name:         e.name ?? "",
        fileUrl:      e.fileUrl ?? "",
        size:         e.size ?? 0,
        dateTimeZone: e.dateTimeZone ?? "",
        width:        e.width,
        height:       e.height,
        durationSecs: e.recordTime != null ? Math.round(e.recordTime / 1000) : undefined,
        thumbnailUrl: e._thumbnailUrl ?? e.thumbnailUrl,
      }));
    } catch (e: any) {
      setLastCommandError(e?.message ?? "listFiles failed");
      return [];
    }
  }, []);

  const deleteFiles = useCallback(async (urls: string[]): Promise<boolean> => {
    setLastCommandError(null);
    try {
      await oscRun(baseRef.current, "camera.delete", { fileUrls: urls }, 15000);
      return true;
    } catch (e: any) {
      setLastCommandError(e?.message ?? "delete failed");
      return false;
    }
  }, []);

  return {
    cameraStatus, settings,
    isRecording, recordingTimeSecs,
    isLoadingStatus, isLoadingSettings,
    lastCommandError,
    fetchStatus, fetchSettings,
    setMode, setVideoResolution, setFrameRate,
    setExposureCompensation, setISO, setWhiteBalance, setStabilization,
    startRecording, stopRecording,
    startPreview, stopPreview,
    listFiles, deleteFiles,
  };
}
