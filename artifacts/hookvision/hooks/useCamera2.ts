/**
 * useCamera2 — generic WiFi snapshot camera hook.
 *
 * Works with any IP camera that serves a JPEG image via HTTP GET
 * (most consumer IP cameras, action-cam hotspot modes, DJI, etc.).
 *
 * Live preview: React Native's <Image> component fetches the URL directly
 * and we increment `tick` every TICK_MS to force a fresh request.
 * Connection status is determined by the Image's onLoad / onError callbacks.
 *
 * High-quality scan: FileSystem.downloadAsync → base64 → polarFilter.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import * as FileSystem from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { polarFilter } from "@/utils/polarFilter";

// ─── Persistence keys ─────────────────────────────────────────────────────────
const STORAGE_IP   = "@hookvision/cam2_ip";
const STORAGE_PATH = "@hookvision/cam2_path";

// ─── Defaults ─────────────────────────────────────────────────────────────────
export const DEFAULT_CAM2_IP   = "192.168.1.100";
export const DEFAULT_CAM2_PATH = "/snapshot";

const TICK_MS = 1500;   // ms between live-preview frame refreshes

export type Camera2Status = "disconnected" | "searching" | "connected";

export interface UseCamera2Result {
  status:         Camera2Status;
  ip:             string;
  path:           string;
  /** Increments every TICK_MS when active — include in Image URI to force refresh */
  tick:           number;
  snapping:       boolean;
  setIp:          (ip: string) => void;
  setPath:        (path: string) => void;
  startSearch:    () => void;
  stopSearch:     () => void;
  /** Pass to <Image onLoad> — marks camera as connected */
  onPreviewLoad:  () => void;
  /** Pass to <Image onError> — marks camera as searching */
  onPreviewError: () => void;
  /** Capture a full-quality JPEG for AI sonar analysis */
  takeSnapshot:   () => Promise<{ base64: string; uri: string } | null>;
}

export function useCamera2(): UseCamera2Result {
  const [status,   setStatus]   = useState<Camera2Status>("disconnected");
  const [ip,       setIpState]  = useState(DEFAULT_CAM2_IP);
  const [path,     setPathState] = useState(DEFAULT_CAM2_PATH);
  const [tick,     setTick]     = useState(0);
  const [snapping, setSnapping] = useState(false);

  const activeRef  = useRef(false);
  const ipRef      = useRef(ip);
  const pathRef    = useRef(path);
  const tickTimer  = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Persist & restore IP / path ───────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.multiGet([STORAGE_IP, STORAGE_PATH]).then((pairs) => {
      const storedIp   = pairs[0][1];
      const storedPath = pairs[1][1];
      if (storedIp)   { setIpState(storedIp);     ipRef.current   = storedIp;   }
      if (storedPath) { setPathState(storedPath);  pathRef.current = storedPath; }
    }).catch(() => {});
  }, []);

  const setIp = useCallback((v: string) => {
    const trimmed = v.trim();
    setIpState(trimmed);
    ipRef.current = trimmed;
    AsyncStorage.setItem(STORAGE_IP, trimmed).catch(() => {});
  }, []);

  const setPath = useCallback((v: string) => {
    const p = v.trim().startsWith("/") ? v.trim() : `/${v.trim()}`;
    setPathState(p);
    pathRef.current = p;
    AsyncStorage.setItem(STORAGE_PATH, p).catch(() => {});
  }, []);

  // ── Connection control ────────────────────────────────────────────────────
  const stopSearch = useCallback(() => {
    activeRef.current = false;
    if (tickTimer.current) { clearInterval(tickTimer.current); tickTimer.current = null; }
    setStatus("disconnected");
    setTick(0);
  }, []);

  const startSearch = useCallback(() => {
    if (activeRef.current) return;
    activeRef.current = true;
    setStatus("searching");
    setTick(0);
    // Kick the tick counter — <Image> will start fetching frames
    tickTimer.current = setInterval(() => {
      if (activeRef.current) setTick((n) => n + 1);
    }, TICK_MS);
  }, []);

  // ── Image callbacks (connection status comes from the Image component) ────
  const onPreviewLoad = useCallback(() => {
    if (activeRef.current) setStatus("connected");
  }, []);

  const onPreviewError = useCallback(() => {
    if (activeRef.current) setStatus("searching");
  }, []);

  // ── High-quality snapshot for sonar AI analysis ───────────────────────────
  const takeSnapshot = useCallback(async (): Promise<{ base64: string; uri: string } | null> => {
    if (status !== "connected" || snapping) return null;
    setSnapping(true);
    try {
      const url      = `http://${ipRef.current}${pathRef.current}?t=${Date.now()}`;
      const localUri = `${FileSystem.cacheDirectory}cam2_scan_${Date.now()}.jpg`;
      const dl       = await FileSystem.downloadAsync(url, localUri);
      if (dl.status !== 200) throw new Error(`Camera 2 returned HTTP ${dl.status}`);
      const raw = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const b64 = await polarFilter(raw);
      return { base64: b64, uri: localUri };
    } catch (err) {
      console.warn("[Camera2] snapshot error:", err);
      return null;
    } finally {
      setSnapping(false);
    }
  }, [status, snapping]);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => () => {
    activeRef.current = false;
    if (tickTimer.current) clearInterval(tickTimer.current);
  }, []);

  return {
    status, ip, path, tick, snapping,
    setIp, setPath,
    startSearch, stopSearch,
    onPreviewLoad, onPreviewError,
    takeSnapshot,
  };
}
