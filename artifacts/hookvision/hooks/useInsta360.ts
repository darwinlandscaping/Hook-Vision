import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";
import { polarFilter } from "@/utils/polarFilter";

// ─── Insta360 / OSC API constants ─────────────────────────────────────────────
const BASE_URL   = "http://192.168.42.1";
const INFO_URL   = `${BASE_URL}/osc/info`;
const CMD_URL    = `${BASE_URL}/osc/commands/execute`;
const STATUS_URL = `${BASE_URL}/osc/commands/status`;

// Timing — tuned for Android (Samsung Smart Network Switch + Adaptive WiFi)
const PING_TIMEOUT_MS  = 5000;  // ms per single attempt
const POLL_MS_SEARCH   = 1500;  // fast poll while hunting
const POLL_MS_HOLD     = 4000;  // relaxed poll once connected
const SNAP_TIMEOUT     = 20000; // max ms for takePicture to complete

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
  /** Human-readable hint for the connection failure reason (Samsung-aware) */
  connectionHint: string;
  startSearch: () => void;
  stopSearch: () => void;
  takeSnapshot: () => Promise<{ base64: string; uri: string } | null>;
}

// ─── XHR-based fetch ─────────────────────────────────────────────────────────
// XMLHttpRequest on Android may bypass Samsung's OkHttp-level Smart Network Switch
// interception for no-internet WiFi hotspots (Insta360 camera).
function xhrFetch(
  url: string,
  opts: { method?: string; body?: string; headers?: Record<string, string>; timeoutMs?: number } = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.timeout = opts.timeoutMs ?? PING_TIMEOUT_MS;
    xhr.ontimeout = () => reject(new Error("timeout"));
    xhr.onerror   = () => reject(new Error("network_error"));
    xhr.onload    = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.responseText);
      else reject(new Error(`http_${xhr.status}`));
    };
    xhr.open(opts.method ?? "GET", url, true);
    if (opts.headers) Object.entries(opts.headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.send(opts.body ?? null);
  });
}

// ─── fetch()-based attempt ────────────────────────────────────────────────────
// Standard fetch() with cache disabled — sometimes routes through WiFi even when
// XHR doesn't (depends on Android version and OEM firmware).
async function fetchAttempt(
  url: string,
  opts: { method?: string; body?: string; headers?: Record<string, string>; timeoutMs?: number } = {}
): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? PING_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method:  opts.method ?? "GET",
      headers: { "Cache-Control": "no-store, no-cache", ...opts.headers },
      body:    opts.body,
      signal:  ctrl.signal,
    });
    if (!res.ok) throw new Error(`http_${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// ─── Parallel race: XHR vs fetch — whichever succeeds first wins ─────────────
// This is the core Android fix: launch two parallel requests using different
// network stacks. On Android, one path may be routed through WiFi and the
// other through mobile data; the one that finds the camera wins.
// Both are fired simultaneously so there's no extra latency.
async function parallelPing(url: string, timeoutMs = PING_TIMEOUT_MS): Promise<string> {
  // Fire XHR + fetch in parallel
  const xhr     = xhrFetch(url, { timeoutMs });
  const fetchR  = fetchAttempt(url, { timeoutMs });

  // ANY single success resolves; collect errors for diagnostics
  return new Promise((resolve, reject) => {
    let settled    = false;
    let errCount   = 0;
    const errors: string[] = [];

    const done = (text: string) => {
      if (!settled) { settled = true; resolve(text); }
    };
    const fail = (err: Error) => {
      errors.push(err.message);
      errCount++;
      if (errCount === 2 && !settled) {
        settled = true;
        // Both failed — return the most descriptive error
        reject(new Error(errors.includes("timeout") ? "timeout" : errors[0]));
      }
    };

    xhr.then(done).catch(fail);
    fetchR.then(done).catch(fail);
  });
}

// ─── Retry wrapper ────────────────────────────────────────────────────────────
// 3 rounds of parallelPing before giving up on a single poll tick.
async function pingWithRetry(url: string, retries = 3): Promise<string> {
  let lastErr: Error = new Error("unknown");
  for (let i = 0; i < retries; i++) {
    try {
      return await parallelPing(url);
    } catch (e: any) {
      lastErr = e;
      if (i < retries - 1) await new Promise((r) => setTimeout(r, 600));
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
      const text = await parallelPing(`${STATUS_URL}?id=${encodeURIComponent(commandId)}`);
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

// ─── Error → human hint (Android/Samsung-aware) ───────────────────────────────
function hintFromError(err: Error): string {
  const m = err.message ?? "";
  if (m === "timeout" || m.includes("timed out")) {
    if (Platform.OS === "android") {
      return "Timeout — connect phone to the camera WiFi (LIVE-xxxxxx), then when Android asks 'No internet, stay connected?' tap STAY. Samsung: Settings → Wi-Fi → Advanced → turn off 'Switch to mobile data'.";
    }
    return "Timeout — check WiFi is connected to the Insta360 hotspot (LIVE-xxxxxx).";
  }
  if (m === "network_error" || m.includes("network")) {
    return "Network error — is the phone on the Insta360 WiFi? Try turning off mobile data temporarily.";
  }
  if (m.startsWith("http_")) {
    return `Camera responded HTTP ${m.replace("http_", "")} — try restarting the Insta360.`;
  }
  return "Camera not found — check it's powered on and WiFi mode is active.";
}

// ─── Main hook ────────────────────────────────────────────────────────────────
export function useInsta360(): UseInsta360Result {
  const [status, setStatus]         = useState<Insta360Status>("disconnected");
  const [cameraInfo, setCameraInfo] = useState<Insta360CameraInfo | null>(null);
  const [snapping, setSnapping]     = useState(false);
  const [connectionHint, setHint]   = useState("");

  const pollTimer   = useRef<ReturnType<typeof setInterval> | null>(null);
  const active      = useRef(false);
  const isConnected = useRef(false);

  const stopSearch = useCallback(() => {
    active.current      = false;
    isConnected.current = false;
    if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
    setStatus("disconnected");
    setCameraInfo(null);
    setHint("");
  }, []);

  const reschedule = useCallback((fn: () => void, connected: boolean) => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(fn, connected ? POLL_MS_HOLD : POLL_MS_SEARCH);
  }, []);

  const pingCamera = useCallback(async () => {
    if (!active.current) return;
    try {
      const text = await pingWithRetry(INFO_URL, 3);
      if (!active.current) return;
      const data = JSON.parse(text) as any;
      setCameraInfo({
        manufacturer:    data.manufacturer    ?? "Insta360",
        model:           data.model           ?? "Camera",
        firmwareVersion: data.firmwareVersion ?? "–",
        serialNumber:    data.serialNumber    ?? "–",
      });
      setHint("");
      if (!isConnected.current) {
        isConnected.current = true;
        setStatus("connected");
        reschedule(pingCamera, true);
      } else {
        setStatus("connected");
      }
    } catch (err: any) {
      if (!active.current) return;
      isConnected.current = false;
      setStatus("searching");
      setCameraInfo(null);
      setHint(hintFromError(err));
      reschedule(pingCamera, false);
    }
  }, [reschedule]);

  const startSearch = useCallback(() => {
    if (active.current) return;
    active.current      = true;
    isConnected.current = false;
    setStatus("searching");
    setCameraInfo(null);
    setHint("");
    pingCamera();
    pollTimer.current = setInterval(pingCamera, POLL_MS_SEARCH);
  }, [pingCamera]);

  // ── takeSnapshot ──────────────────────────────────────────────────────────
  const takeSnapshot = useCallback(async (): Promise<{ base64: string; uri: string } | null> => {
    if (status !== "connected" || snapping) return null;
    setSnapping(true);
    try {
      // Fire takePicture via XHR POST (parallel race only works for GET pings)
      const postText = await xhrFetch(CMD_URL, {
        method:    "POST",
        headers:   { "Content-Type": "application/json" },
        body:      JSON.stringify({ name: "camera.takePicture" }),
        timeoutMs: 10000,
      });
      const execData = JSON.parse(postText) as any;

      let fileUrl: string | null = null;
      if (execData.state === "done") {
        fileUrl = execData.results?.fileUrl ?? null;
      } else if (execData.state === "inProgress" && execData.id) {
        const pollResult = await pollCommand(execData.id, SNAP_TIMEOUT);
        fileUrl = pollResult.results?.fileUrl ?? null;
      }

      if (!fileUrl) throw new Error("No file URL from camera");
      const fullUrl = fileUrl.startsWith("http") ? fileUrl : `${BASE_URL}${fileUrl}`;

      const localUri = FileSystem.cacheDirectory + `insta360_${Date.now()}.jpg`;
      const dl = await FileSystem.downloadAsync(fullUrl, localUri);
      if (dl.status !== 200) throw new Error("Image download failed");

      const raw = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const b64 = await polarFilter(raw);
      return { base64: b64, uri: localUri };
    } catch (err) {
      console.warn("[Insta360] snapshot error:", err);
      return null;
    } finally {
      setSnapping(false);
    }
  }, [status, snapping]);

  useEffect(() => () => {
    active.current = false;
    if (pollTimer.current) clearInterval(pollTimer.current);
  }, []);

  return { status, cameraInfo, snapping, connectionHint, startSearch, stopSearch, takeSnapshot };
}
