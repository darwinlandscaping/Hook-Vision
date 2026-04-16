/**
 * useCameraScanner — probes all known WiFi camera IPs in parallel.
 *
 * Concurrently hits the info/snapshot endpoint for each camera brand.
 * Returns discovered cameras within a 4-second window.
 *
 * Supported brands / IPs:
 *   Insta360   → 192.168.42.1   (OSC /osc/info)
 *   GoPro      → 10.5.5.9:8080  (Open GoPro /gopro/camera/info)
 *   DJI Osmo   → 192.168.2.1    (DJI Wi-Fi API /osc/info)
 *   SmartLife  → 192.168.4.1 (hotspot) + common LAN IPs (/snapshot.cgi etc.)
 *   Generic    → 192.168.1.1 + 192.168.0.1 (RTSP/HTTP sniff)
 */
import { useCallback, useRef, useState } from "react";

export type CameraBrand = "Insta360" | "GoPro" | "DJI" | "SmartLife" | "Other";

export interface DiscoveredCamera {
  id:           string;
  brand:        CameraBrand;
  ip:           string;
  port?:        number;
  baseUrl:      string;
  model:        string;
  manufacturer: string;
  responseMs:   number;
  infoPath:     string;
  cmdPath:      string;
  /** Best snapshot path for Camera 2 integration */
  snapshotPath: string;
}

// ─── Known camera probe targets ───────────────────────────────────────────────
interface CameraProbe {
  id:           string;
  brand:        CameraBrand;
  ip:           string;
  port?:        number;
  infoPath:     string;
  cmdPath:      string;
  snapshotPath: string;
  timeout:      number;
  parseInfo:    (json: any, rawText: string) => { model: string; manufacturer: string };
}

const PROBES: CameraProbe[] = [
  // ── Insta360 ────────────────────────────────────────────────────────────────
  {
    id:           "insta360-42",
    brand:        "Insta360",
    ip:           "192.168.42.1",
    infoPath:     "/osc/info",
    cmdPath:      "/osc/commands/execute",
    snapshotPath: "/osc/commands/execute",
    timeout:      3500,
    parseInfo:    (j) => ({
      model:        j.model        ?? "Insta360",
      manufacturer: j.manufacturer ?? "Insta360",
    }),
  },
  // ── GoPro ───────────────────────────────────────────────────────────────────
  {
    id:           "gopro-5-9",
    brand:        "GoPro",
    ip:           "10.5.5.9",
    port:         8080,
    infoPath:     "/gopro/camera/info",
    cmdPath:      "/gopro/camera/shutter/start",
    snapshotPath: "/gopro/camera/media/last_captured",
    timeout:      3500,
    parseInfo:    (j) => ({
      model:        j.info?.model_name        ?? j.model_name        ?? "GoPro",
      manufacturer: j.info?.manufacturer_name ?? j.manufacturer_name ?? "GoPro Inc.",
    }),
  },
  // ── DJI ─────────────────────────────────────────────────────────────────────
  {
    id:           "dji-2-1",
    brand:        "DJI",
    ip:           "192.168.2.1",
    infoPath:     "/osc/info",
    cmdPath:      "/osc/commands/execute",
    snapshotPath: "/osc/commands/execute",
    timeout:      3500,
    parseInfo:    (j) => ({
      model:        j.model        ?? "Osmo Action",
      manufacturer: j.manufacturer ?? "DJI",
    }),
  },
  // ── SmartLife / Tuya — hotspot mode (192.168.4.1) ───────────────────────────
  {
    id:           "smartlife-ap-snap",
    brand:        "SmartLife",
    ip:           "192.168.4.1",
    infoPath:     "/snapshot.cgi",
    cmdPath:      "/snapshot.cgi",
    snapshotPath: "/snapshot.cgi",
    timeout:      3000,
    parseInfo:    () => ({ model: "SmartLife Camera", manufacturer: "Tuya" }),
  },
  {
    id:           "smartlife-ap-cgi",
    brand:        "SmartLife",
    ip:           "192.168.4.1",
    infoPath:     "/cgi-bin/snapshot.cgi",
    cmdPath:      "/cgi-bin/snapshot.cgi",
    snapshotPath: "/cgi-bin/snapshot.cgi",
    timeout:      3000,
    parseInfo:    () => ({ model: "SmartLife Camera", manufacturer: "Tuya" }),
  },
  {
    id:           "smartlife-ap-img",
    brand:        "SmartLife",
    ip:           "192.168.4.1",
    infoPath:     "/image.jpg",
    cmdPath:      "/image.jpg",
    snapshotPath: "/image.jpg",
    timeout:      3000,
    parseInfo:    () => ({ model: "SmartLife Camera", manufacturer: "Tuya" }),
  },
  // ── SmartLife / Tuya — home LAN IPs ─────────────────────────────────────────
  {
    id:           "smartlife-1-100",
    brand:        "SmartLife",
    ip:           "192.168.1.100",
    infoPath:     "/snapshot.cgi",
    cmdPath:      "/snapshot.cgi",
    snapshotPath: "/snapshot.cgi",
    timeout:      3000,
    parseInfo:    () => ({ model: "SmartLife Camera", manufacturer: "Tuya" }),
  },
  {
    id:           "smartlife-0-100",
    brand:        "SmartLife",
    ip:           "192.168.0.100",
    infoPath:     "/snapshot.cgi",
    cmdPath:      "/snapshot.cgi",
    snapshotPath: "/snapshot.cgi",
    timeout:      3000,
    parseInfo:    () => ({ model: "SmartLife Camera", manufacturer: "Tuya" }),
  },
  {
    id:           "smartlife-1-101",
    brand:        "SmartLife",
    ip:           "192.168.1.101",
    infoPath:     "/snapshot.cgi",
    cmdPath:      "/snapshot.cgi",
    snapshotPath: "/snapshot.cgi",
    timeout:      3000,
    parseInfo:    () => ({ model: "SmartLife Camera", manufacturer: "Tuya" }),
  },
  {
    id:           "smartlife-1-102",
    brand:        "SmartLife",
    ip:           "192.168.1.102",
    infoPath:     "/snapshot.cgi",
    cmdPath:      "/snapshot.cgi",
    snapshotPath: "/snapshot.cgi",
    timeout:      3000,
    parseInfo:    () => ({ model: "SmartLife Camera", manufacturer: "Tuya" }),
  },
  {
    id:           "smartlife-10-1",
    brand:        "SmartLife",
    ip:           "10.0.0.1",
    infoPath:     "/snapshot.cgi",
    cmdPath:      "/snapshot.cgi",
    snapshotPath: "/snapshot.cgi",
    timeout:      3000,
    parseInfo:    () => ({ model: "SmartLife Camera", manufacturer: "Tuya" }),
  },
  {
    id:           "smartlife-10-100",
    brand:        "SmartLife",
    ip:           "10.0.0.100",
    infoPath:     "/snapshot.cgi",
    cmdPath:      "/snapshot.cgi",
    snapshotPath: "/snapshot.cgi",
    timeout:      3000,
    parseInfo:    () => ({ model: "SmartLife Camera", manufacturer: "Tuya" }),
  },
  // ── Generic ──────────────────────────────────────────────────────────────────
  {
    id:           "generic-1-1",
    brand:        "Other",
    ip:           "192.168.1.1",
    infoPath:     "/osc/info",
    cmdPath:      "/osc/commands/execute",
    snapshotPath: "/snapshot",
    timeout:      3000,
    parseInfo:    (j) => ({
      model:        j.model        ?? "WiFi Camera",
      manufacturer: j.manufacturer ?? "Unknown",
    }),
  },
  {
    id:           "generic-0-1",
    brand:        "Other",
    ip:           "192.168.0.1",
    infoPath:     "/osc/info",
    cmdPath:      "/osc/commands/execute",
    snapshotPath: "/snapshot",
    timeout:      3000,
    parseInfo:    (j) => ({
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
    xhr.responseType = "arraybuffer";   // handles binary JPEG without throwing
    xhr.ontimeout = () => fail(new Error("timeout"));
    xhr.onerror   = () => fail(new Error("net_err"));
    xhr.onload    = () => xhr.status >= 200 && xhr.status < 300
      ? done("ok")
      : fail(new Error(`http_${xhr.status}`));
    xhr.open("GET", url, true);
    xhr.send();

    // fetch path
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    fetch(url, { signal: ctrl.signal, headers: { "Cache-Control": "no-store" } })
      .then((r) => {
        clearTimeout(timer);
        return r.ok ? r.text().catch(() => "ok") : Promise.reject(new Error(`http_${r.status}`));
      })
      .then(done)
      .catch((e) => { clearTimeout(timer); fail(e); });
  });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export interface CameraScannerResult {
  scanning:      boolean;
  discovered:    DiscoveredCamera[];
  probedCount:   number;   // IPs checked in last scan (success + fail)
  lastScanDone:  boolean;  // true once at least one full scan has finished
  scan:          (brandFilter?: CameraBrand) => void;
  clear:         () => void;
}

export function useCameraScanner(): CameraScannerResult {
  const [scanning,     setScanning]     = useState(false);
  const [discovered,   setDiscovered]   = useState<DiscoveredCamera[]>([]);
  const [probedCount,  setProbedCount]  = useState(0);
  const [lastScanDone, setLastScanDone] = useState(false);
  const abortRef = useRef(false);

  const clear = useCallback(() => {
    setDiscovered([]);
    setProbedCount(0);
    setLastScanDone(false);
  }, []);

  const scan = useCallback(async (brandFilter?: CameraBrand) => {
    abortRef.current = false;
    setScanning(true);
    setDiscovered([]);
    setProbedCount(0);
    setLastScanDone(false);

    const probes = brandFilter
      ? PROBES.filter((p) => p.brand === brandFilter)
      : PROBES;

    const probeOne = async (probe: CameraProbe): Promise<DiscoveredCamera | null> => {
      const base = probe.port
        ? `http://${probe.ip}:${probe.port}`
        : `http://${probe.ip}`;
      const url = `${base}${probe.infoPath}`;
      const t0  = Date.now();
      try {
        const text = await quickPing(url, probe.timeout);
        const ms   = Date.now() - t0;
        let info   = { model: "Camera", manufacturer: probe.brand as string };
        try { info = probe.parseInfo(JSON.parse(text), text); } catch {
          // Binary response (e.g. JPEG) — parseInfo fallback already returns defaults
          info = probe.parseInfo({}, text);
        }
        const cam: DiscoveredCamera = {
          id:           probe.id,
          brand:        probe.brand,
          ip:           probe.ip,
          port:         probe.port,
          baseUrl:      base,
          model:        info.model,
          manufacturer: info.manufacturer,
          responseMs:   ms,
          infoPath:     probe.infoPath,
          cmdPath:      probe.cmdPath,
          snapshotPath: probe.snapshotPath,
        };
        if (!abortRef.current) {
          setDiscovered((prev) => {
            if (prev.some((c) => c.id === cam.id)) return prev;
            return [...prev, cam];
          });
          setProbedCount((n) => n + 1);
        }
        return cam;
      } catch {
        if (!abortRef.current) setProbedCount((n) => n + 1);
        return null;
      }
    };

    await Promise.allSettled(probes.map(probeOne));
    if (!abortRef.current) {
      setScanning(false);
      setLastScanDone(true);
    }
  }, []);

  return { scanning, discovered, probedCount, lastScanDone, scan, clear };
}
