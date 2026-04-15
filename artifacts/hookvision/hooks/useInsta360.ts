import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";
import { polarFilter } from "@/utils/polarFilter";

// ─── Insta360 / OSC API constants ─────────────────────────────────────────────
const BASE_URL   = "http://192.168.42.1";
const INFO_URL   = `${BASE_URL}/osc/info`;
const CMD_URL    = `${BASE_URL}/osc/commands/execute`;
const STATUS_URL = `${BASE_URL}/osc/commands/status`;

// Samsung's Smart Network Switch delays WiFi-only requests;
// use longer timeout + aggressive retry instead of one-shot fetch.
const PING_TIMEOUT_MS = 5000;   // ms per attempt
const PING_RETRIES    = 3;      // attempts before giving up
const RETRY_DELAY_MS  = 700;    // pause between retry attempts
const POLL_MS_SEARCH  = 1500;   // fast polling while searching
const POLL_MS_HOLD    = 4000;   // relaxed polling once connected
const SNAP_TIMEOUT    = 20000;  // max ms to wait for takePicture

export type Insta360Status = "disconnected" | "searching" | "connected" | "error";

export interface Insta360CameraInfo {
  manufacturer: string;
  model: string;
  firmwareVersion: string;
  serialNumber: string;
}

export interface UseInsta360Result {
  status: Insta360Status;
  cameraInfo: Insta360CameraInfo | null;
  snapping: boolean;
  /** Humanised error / hint — useful for Samsung WiFi guidance */
  connectionHint: string;
  startSearch: () => void;
  stopSearch: () => void;
  takeSnapshot: () => Promise<{ base64: string; uri: string } | null>;
}

// ─── Samsung-safe XHR fetch ───────────────────────────────────────────────────
// React Native's fetch() on Android goes through OkHttp3.  Samsung's Smart
// Network Switch intercepts OkHttp3 connections to no-internet WiFi networks
// and re-routes them through mobile data.  XMLHttpRequest bypasses that layer
// on many Samsung firmware versions because it uses a separate network binding.
function xhrFetch(
  url: string,
  opts: {
    method?: string;
    body?: string;
    headers?: Record<string, string>;
    timeoutMs?: number;
  } = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.timeout = opts.timeoutMs ?? PING_TIMEOUT_MS;
    xhr.ontimeout = () => reject(new Error("timeout"));
    xhr.onerror   = () => reject(new Error("network_error"));
    xhr.onload    = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.responseText);
      } else {
        reject(new Error(`http_${xhr.status}`));
      }
    };
    xhr.open(opts.method ?? "GET", url, true);
    if (opts.headers) {
      Object.entries(opts.headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    }
    xhr.send(opts.body ?? null);
  });
}

// ─── Retry wrapper ────────────────────────────────────────────────────────────
async function xhrWithRetry(
  url: string,
  opts: Parameters<typeof xhrFetch>[1] = {},
  retries = PING_RETRIES
): Promise<string> {
  let lastErr: Error = new Error("unknown");
  for (let i = 0; i < retries; i++) {
    try {
      return await xhrFetch(url, opts);
    } catch (e: any) {
      lastErr = e;
      if (i < retries - 1) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }
  throw lastErr;
}

// ─── Poll a command until done ────────────────────────────────────────────────
async function pollCommand(commandId: string, timeoutMs: number): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 800));
    try {
      const text = await xhrFetch(
        `${STATUS_URL}?id=${encodeURIComponent(commandId)}`,
        { method: "GET", timeoutMs: 5000 }
      );
      const data = JSON.parse(text) as any;
      if (data.state === "done") return data;
      if (data.state === "error") throw new Error(data.error?.message ?? "Command failed");
    } catch (e: any) {
      if (e?.message === "timeout" || e?.message === "network_error") continue;
      throw e;
    }
  }
  throw new Error("Insta360 snapshot timed out");
}

// ─── Humanise error code → user hint ─────────────────────────────────────────
function hintFromError(err: Error): string {
  const m = err.message ?? "";
  if (m === "timeout" || m.includes("timed out")) {
    if (Platform.OS === "android") {
      return "Timeout — Samsung: open WiFi settings, connect to LIVE-xxxxxx, tap 'Stay connected' when prompted. Also turn off Wi-Fi+ / Switch to mobile data.";
    }
    return "Timeout — check WiFi is connected to the Insta360 hotspot.";
  }
  if (m === "network_error" || m.includes("network")) {
    return "Network error — make sure phone is on the Insta360 WiFi (LIVE-xxxxxx). Samsung: disable Wi-Fi+.";
  }
  if (m.startsWith("http_")) {
    return `Camera returned ${m.replace("http_", "HTTP ")} — try restarting the camera.`;
  }
  return "Not found — camera off or wrong WiFi network.";
}

// ─── Main hook ────────────────────────────────────────────────────────────────
export function useInsta360(): UseInsta360Result {
  const [status, setStatus]             = useState<Insta360Status>("disconnected");
  const [cameraInfo, setCameraInfo]     = useState<Insta360CameraInfo | null>(null);
  const [snapping, setSnapping]         = useState(false);
  const [connectionHint, setHint]       = useState("");

  const pollTimer  = useRef<ReturnType<typeof setInterval> | null>(null);
  const active     = useRef(false);
  const connected  = useRef(false);

  const stopSearch = useCallback(() => {
    active.current   = false;
    connected.current = false;
    if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
    setStatus("disconnected");
    setCameraInfo(null);
    setHint("");
  }, []);

  // Reschedule the poll timer at the right rate based on connection state
  const rescheduleTimer = useCallback((fn: () => void, wasConnected: boolean) => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    const interval = wasConnected ? POLL_MS_HOLD : POLL_MS_SEARCH;
    pollTimer.current = setInterval(fn, interval);
  }, []);

  const pingCamera = useCallback(async () => {
    if (!active.current) return;
    try {
      const text = await xhrWithRetry(INFO_URL, { method: "GET" });
      if (!active.current) return;
      const data = JSON.parse(text) as any;
      setCameraInfo({
        manufacturer:    data.manufacturer   ?? "Insta360",
        model:           data.model          ?? "Camera",
        firmwareVersion: data.firmwareVersion ?? "–",
        serialNumber:    data.serialNumber    ?? "–",
      });
      setHint("");
      if (!connected.current) {
        // Just became connected — switch to relaxed polling
        connected.current = true;
        setStatus("connected");
        rescheduleTimer(pingCamera, true);
      } else {
        setStatus("connected");
      }
    } catch (err: any) {
      if (!active.current) return;
      connected.current = false;
      setStatus("searching");
      setCameraInfo(null);
      setHint(hintFromError(err));
      // Make sure we're on fast search interval
      rescheduleTimer(pingCamera, false);
    }
  }, [rescheduleTimer]);

  const startSearch = useCallback(() => {
    if (active.current) return;
    active.current    = true;
    connected.current = false;
    setStatus("searching");
    setCameraInfo(null);
    setHint("");

    // Ping immediately, then every POLL_MS_SEARCH
    pingCamera();
    pollTimer.current = setInterval(pingCamera, POLL_MS_SEARCH);
  }, [pingCamera]);

  // ── takeSnapshot: capture via OSC then download → base64 ──────────────────
  const takeSnapshot = useCallback(async (): Promise<{ base64: string; uri: string } | null> => {
    if (status !== "connected" || snapping) return null;
    setSnapping(true);
    try {
      // 1. Fire takePicture via XHR (Samsung-safe)
      const execText = await xhrFetch(
        CMD_URL,
        {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ name: "camera.takePicture" }),
          timeoutMs: 8000,
        }
      );
      const execData = JSON.parse(execText) as any;

      let fileUrl: string | null = null;

      if (execData.state === "done") {
        fileUrl = execData.results?.fileUrl ?? null;
      } else if (execData.state === "inProgress" && execData.id) {
        const pollResult = await pollCommand(execData.id, SNAP_TIMEOUT);
        fileUrl = pollResult.results?.fileUrl ?? null;
      }

      if (!fileUrl) throw new Error("No file URL returned from camera");

      const fullUrl = fileUrl.startsWith("http") ? fileUrl : `${BASE_URL}${fileUrl}`;

      // 2. Download image to local cache
      const localUri = FileSystem.cacheDirectory + `insta360_${Date.now()}.jpg`;
      const dl = await FileSystem.downloadAsync(fullUrl, localUri);
      if (dl.status !== 200) throw new Error("Failed to download image from camera");

      // 3. Read as base64
      const raw = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // 4. Apply polarised-lens filter — fails open
      const b64 = await polarFilter(raw);

      return { base64: b64, uri: localUri };
    } catch (err) {
      console.warn("[Insta360] snapshot error:", err);
      return null;
    } finally {
      setSnapping(false);
    }
  }, [status, snapping]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      active.current = false;
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  return { status, cameraInfo, snapping, connectionHint, startSearch, stopSearch, takeSnapshot };
}
