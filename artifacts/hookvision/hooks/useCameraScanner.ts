/**
 * useCameraScanner — probes all known WiFi camera IPs in parallel.
 *
 * Concurrently hits the info endpoint for each camera brand's default
 * gateway IP. Returns discovered cameras within a 4-second window.
 *
 * Supported brands / IPs:
 *   Insta360  → 192.168.42.1   (OSC /osc/info)
 *   GoPro     → 10.5.5.9:8080  (Open GoPro /gopro/camera/info)
 *   DJI Osmo  → 192.168.2.1    (DJI Wi-Fi API /v1/camera/info)
 *   Generic   → 192.168.1.1 + 192.168.0.1 (RTSP/HTTP sniff)
 */
import { useCallback, useRef, useState } from "react";

export type CameraBrand = "Insta360" | "GoPro" | "DJI" | "Other";

export interface DiscoveredCamera {
  id:           string;
  brand:        CameraBrand;
  ip:           string;
  baseUrl:      string;
  model:        string;
  manufacturer: string;
  responseMs:   number;
  infoPath:     string;
  cmdPath:      string;
}

// ─── Known camera probe targets ───────────────────────────────────────────────
interface CameraProbe {
  id:        string;
  brand:     CameraBrand;
  ip:        string;
  port?:     number;
  infoPath:  string;
  cmdPath:   string;
  timeout:   number;
  parseInfo: (json: any) => { model: string; manufacturer: string };
}

const PROBES: CameraProbe[] = [
  {
    id:       "insta360-42",
    brand:    "Insta360",
    ip:       "192.168.42.1",
    infoPath: "/osc/info",
    cmdPath:  "/osc/commands/execute",
    timeout:  3500,
    parseInfo: (j) => ({
      model:        j.model        ?? "Insta360",
      manufacturer: j.manufacturer ?? "Insta360",
    }),
  },
  {
    id:       "gopro-5-9",
    brand:    "GoPro",
    ip:       "10.5.5.9",
    port:     8080,
    infoPath: "/gopro/camera/info",
    cmdPath:  "/gopro/camera/shutter/start",
    timeout:  3500,
    parseInfo: (j) => ({
      model:        j.info?.model_name        ?? j.model_name        ?? "GoPro",
      manufacturer: j.info?.manufacturer_name ?? j.manufacturer_name ?? "GoPro Inc.",
    }),
  },
  {
    id:       "dji-2-1",
    brand:    "DJI",
    ip:       "192.168.2.1",
    infoPath: "/osc/info",
    cmdPath:  "/osc/commands/execute",
    timeout:  3500,
    parseInfo: (j) => ({
      model:        j.model        ?? "Osmo Action",
      manufacturer: j.manufacturer ?? "DJI",
    }),
  },
  {
    id:       "generic-1-1",
    brand:    "Other",
    ip:       "192.168.1.1",
    infoPath: "/osc/info",
    cmdPath:  "/osc/commands/execute",
    timeout:  3000,
    parseInfo: (j) => ({
      model:        j.model        ?? "WiFi Camera",
      manufacturer: j.manufacturer ?? "Unknown",
    }),
  },
  {
    id:       "generic-0-1",
    brand:    "Other",
    ip:       "192.168.0.1",
    infoPath: "/osc/info",
    cmdPath:  "/osc/commands/execute",
    timeout:  3000,
    parseInfo: (j) => ({
      model:        j.model        ?? "WiFi Camera",
      manufacturer: j.manufacturer ?? "Unknown",
    }),
  },
];

// ─── XHR + fetch race ─────────────────────────────────────────────────────────
function quickPing(url: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let fails   = 0;
    const done  = (t: string) => { if (!settled) { settled = true; resolve(t); } };
    const fail  = (e: Error)  => { fails++; if (fails >= 2 && !settled) { settled = true; reject(e); } };

    // XHR path
    const xhr = new XMLHttpRequest();
    xhr.timeout = timeoutMs;
    xhr.ontimeout = () => fail(new Error("timeout"));
    xhr.onerror   = () => fail(new Error("net_err"));
    xhr.onload    = () => xhr.status >= 200 && xhr.status < 300 ? done(xhr.responseText) : fail(new Error(`http_${xhr.status}`));
    xhr.open("GET", url, true);
    xhr.send();

    // fetch path
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    fetch(url, { signal: ctrl.signal, headers: { "Cache-Control": "no-store" } })
      .then((r) => {
        clearTimeout(timer);
        return r.ok ? r.text() : Promise.reject(new Error(`http_${r.status}`));
      })
      .then(done)
      .catch((e) => { clearTimeout(timer); fail(e); });
  });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export interface CameraScannerResult {
  scanning:   boolean;
  discovered: DiscoveredCamera[];
  scan:       () => void;
  clear:      () => void;
}

export function useCameraScanner(): CameraScannerResult {
  const [scanning,   setScanning]   = useState(false);
  const [discovered, setDiscovered] = useState<DiscoveredCamera[]>([]);
  const abortRef = useRef(false);

  const clear = useCallback(() => {
    setDiscovered([]);
  }, []);

  const scan = useCallback(async () => {
    abortRef.current = false;
    setScanning(true);
    setDiscovered([]);

    const probeOne = async (probe: CameraProbe): Promise<DiscoveredCamera | null> => {
      const base = probe.port
        ? `http://${probe.ip}:${probe.port}`
        : `http://${probe.ip}`;
      const url = `${base}${probe.infoPath}`;
      const t0  = Date.now();
      try {
        const text = await quickPing(url, probe.timeout);
        const ms   = Date.now() - t0;
        let info   = { model: "Camera", manufacturer: probe.brand };
        try { info = probe.parseInfo(JSON.parse(text)); } catch {}
        const cam: DiscoveredCamera = {
          id:           probe.id,
          brand:        probe.brand,
          ip:           probe.ip,
          baseUrl:      base,
          model:        info.model,
          manufacturer: info.manufacturer,
          responseMs:   ms,
          infoPath:     probe.infoPath,
          cmdPath:      probe.cmdPath,
        };
        if (!abortRef.current) {
          setDiscovered((prev) => {
            if (prev.some((c) => c.id === cam.id)) return prev;
            return [...prev, cam];
          });
        }
        return cam;
      } catch {
        return null;
      }
    };

    await Promise.allSettled(PROBES.map(probeOne));
    if (!abortRef.current) setScanning(false);
  }, []);

  return { scanning, discovered, scan, clear };
}
