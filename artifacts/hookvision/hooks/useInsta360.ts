import { useCallback, useEffect, useRef, useState } from "react";
import * as FileSystem from "expo-file-system";
import { polarFilter } from "@/utils/polarFilter";

// ─── Insta360 / OSC API constants ─────────────────────────────────────────────
const BASE_URL   = "http://192.168.42.1";
const INFO_URL   = `${BASE_URL}/osc/info`;
const CMD_URL    = `${BASE_URL}/osc/commands/execute`;
const STATUS_URL = `${BASE_URL}/osc/commands/status`;
const POLL_MS    = 2500;   // how often to ping for connection
const SNAP_TIMEOUT = 18000; // max ms to wait for takePicture to complete

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
  startSearch: () => void;
  stopSearch: () => void;
  takeSnapshot: () => Promise<{ base64: string; uri: string } | null>;
}

// ─── Helper: fetch with timeout ───────────────────────────────────────────────
async function fetchWithTimeout(url: string, options: RequestInit = {}, ms = 3000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

// ─── Helper: poll a command until done or timeout ────────────────────────────
async function pollCommand(commandId: string, timeoutMs: number): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 800));
    try {
      const res = await fetchWithTimeout(
        `${STATUS_URL}?id=${encodeURIComponent(commandId)}`,
        { method: "GET" },
        4000
      );
      if (!res.ok) continue;
      const data = await res.json() as any;
      if (data.state === "done") return data;
      if (data.state === "error") throw new Error(data.error?.message ?? "Command failed");
    } catch (e: any) {
      if (e?.name === "AbortError") continue;
      throw e;
    }
  }
  throw new Error("Insta360 snapshot timed out");
}

// ─── Main hook ────────────────────────────────────────────────────────────────
export function useInsta360(): UseInsta360Result {
  const [status, setStatus]         = useState<Insta360Status>("disconnected");
  const [cameraInfo, setCameraInfo] = useState<Insta360CameraInfo | null>(null);
  const [snapping, setSnapping]     = useState(false);

  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const active    = useRef(false);

  const stopSearch = useCallback(() => {
    active.current = false;
    if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
    setStatus("disconnected");
    setCameraInfo(null);
  }, []);

  const pingCamera = useCallback(async () => {
    try {
      const res = await fetchWithTimeout(INFO_URL, { method: "GET" }, 2500);
      if (!res.ok) {
        setStatus("searching");
        setCameraInfo(null);
        return;
      }
      const data = await res.json() as any;
      setCameraInfo({
        manufacturer:    data.manufacturer  ?? "Insta360",
        model:           data.model         ?? "Camera",
        firmwareVersion: data.firmwareVersion ?? "–",
        serialNumber:    data.serialNumber   ?? "–",
      });
      setStatus("connected");
    } catch {
      if (active.current) {
        setStatus("searching");
        setCameraInfo(null);
      }
    }
  }, []);

  const startSearch = useCallback(() => {
    if (active.current) return;
    active.current = true;
    setStatus("searching");
    setCameraInfo(null);

    // Ping immediately, then every POLL_MS
    pingCamera();
    pollTimer.current = setInterval(() => {
      if (active.current) pingCamera();
    }, POLL_MS);
  }, [pingCamera]);

  // ── takeSnapshot: capture via OSC then download → base64 ─────────────────
  const takeSnapshot = useCallback(async (): Promise<{ base64: string; uri: string } | null> => {
    if (status !== "connected" || snapping) return null;
    setSnapping(true);
    try {
      // 1. Fire takePicture
      const execRes = await fetchWithTimeout(
        CMD_URL,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "camera.takePicture" }),
        },
        6000
      );
      if (!execRes.ok) throw new Error(`Insta360 API error: ${execRes.status}`);
      const execData = await execRes.json() as any;

      let fileUrl: string | null = null;

      if (execData.state === "done") {
        fileUrl = execData.results?.fileUrl ?? null;
      } else if (execData.state === "inProgress" && execData.id) {
        // 2. Poll until done
        const pollResult = await pollCommand(execData.id, SNAP_TIMEOUT);
        fileUrl = pollResult.results?.fileUrl ?? null;
      }

      if (!fileUrl) throw new Error("No file URL returned from camera");

      // If fileUrl is relative, prepend base
      const fullUrl = fileUrl.startsWith("http") ? fileUrl : `${BASE_URL}${fileUrl}`;

      // 3. Download image to local cache
      const localUri = FileSystem.cacheDirectory + `insta360_${Date.now()}.jpg`;
      const dl = await FileSystem.downloadAsync(fullUrl, localUri);
      if (dl.status !== 200) throw new Error("Failed to download image from camera");

      // 4. Read as base64
      const raw = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // 5. Apply polarised-lens filter (glare reduction) — fails open
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

  return { status, cameraInfo, snapping, startSearch, stopSearch, takeSnapshot };
}
