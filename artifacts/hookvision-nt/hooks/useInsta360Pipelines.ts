/**
 * Insta360 dual-pipeline hook.
 * Pipeline 1 — Bait birds + water bust-up (surface activity)
 * Pipeline 2 — Crocodile visual detection merged with sonar croc-brain
 *
 * Runs when `active=true` and Insta360 is connected.
 * Auto-snapshots every `intervalMs` (default 6s) and fires both pipelines in parallel.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { UseInsta360Result } from "./useInsta360";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ZoneMap { left: boolean; centre: boolean; right: boolean; }

export interface SurfaceResult {
  activity: boolean;
  zones: ZoneMap;
  types: string[];
  birdSpecies: string[];    // identified NT bird species (e.g. "Crested Tern", "Frigatebird")
  urgency: "none" | "low" | "high";
  confidence: number;
  description: string;
  birdRefCount: number;     // how many library refs were injected
  ts: number;
}

export interface CrocVisionResult {
  detected: boolean;
  zones: ZoneMap;
  parts: string[];
  species: "salty" | "freshie" | "unknown" | "none";  // saltwater vs freshwater croc
  alertLevel: "none" | "possible" | "confirmed";
  visionOnly: string;
  confidence: number;
  description: string;
  safetyNote: string;
  sonarContributed: boolean;
  crocRefCount: number;     // how many library refs were injected
  ts: number;
}

export interface Insta360PipelineState {
  running: boolean;
  scanning: boolean;
  surface: SurfaceResult | null;
  croc: CrocVisionResult | null;
  scanCount: number;
  lastError: string | null;
  /** Most recent Insta360 snapshot base64 from the last pipeline cycle (up to 6s old). */
  latestSnapshotBase64: string | null;
  start: () => void;
  stop: () => void;
}

const DEFAULT_INTERVAL_MS = 6000;

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useInsta360Pipelines(
  insta360: UseInsta360Result,
  opts: {
    intervalMs?: number;
    /** Current sonar croc alert from the scan tab (optional merge) */
    sonarCrocAlert?: boolean;
    sonarCrocWarning?: string;
  } = {}
): Insta360PipelineState {
  const { intervalMs = DEFAULT_INTERVAL_MS, sonarCrocAlert = false, sonarCrocWarning = "" } = opts;

  const [running, setRunning]       = useState(false);
  const [scanning, setScanning]     = useState(false);
  const [surface, setSurface]       = useState<SurfaceResult | null>(null);
  const [croc, setCroc]             = useState<CrocVisionResult | null>(null);
  const [scanCount, setScanCount]   = useState(0);
  const [lastError, setLastError]   = useState<string | null>(null);
  const [latestSnapshotBase64, setLatestSnapshotBase64] = useState<string | null>(null);

  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef   = useRef(false);
  const scanningRef = useRef(false);

  const domain  = process.env.EXPO_PUBLIC_DOMAIN;
  const baseUrl = domain ? `https://${domain}` : "";

  // ── Run one pipeline cycle ─────────────────────────────────────────────────
  const runCycle = useCallback(async () => {
    if (!activeRef.current || scanningRef.current) return;
    if (insta360.status !== "connected") return;

    scanningRef.current = true;
    setScanning(true);
    setLastError(null);

    try {
      // 1. Grab snapshot from Insta360
      const snap = await insta360.takeSnapshot();
      if (!snap || !activeRef.current) return;

      const { base64 } = snap;
      setLatestSnapshotBase64(base64);

      // 2. Fire both pipelines in parallel
      const [surfRes, crocRes] = await Promise.allSettled([
        fetch(`${baseUrl}/api/insta360/surface-detect`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64 }),
        }).then((r) => r.json()),

        fetch(`${baseUrl}/api/insta360/croc-vision`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: base64,
            sonarCrocAlert,
            sonarCrocWarning,
          }),
        }).then((r) => r.json()),
      ]);

      if (!activeRef.current) return;

      if (surfRes.status === "fulfilled") {
        setSurface({ ...surfRes.value, ts: Date.now() });
      }
      if (crocRes.status === "fulfilled") {
        setCroc({ ...crocRes.value, ts: Date.now() });
      }

      setScanCount((n) => n + 1);
    } catch (err) {
      if (activeRef.current) {
        setLastError(err instanceof Error ? err.message : "Pipeline error");
      }
    } finally {
      scanningRef.current = false;
      if (activeRef.current) setScanning(false);
    }
  }, [insta360, baseUrl, sonarCrocAlert, sonarCrocWarning]);

  // ── Start / stop ──────────────────────────────────────────────────────────
  const start = useCallback(() => {
    if (activeRef.current) return;
    activeRef.current = true;
    setRunning(true);
    setScanCount(0);
    setSurface(null);
    setCroc(null);
    setLastError(null);

    // First scan fires immediately
    runCycle();
    timerRef.current = setInterval(runCycle, intervalMs);
  }, [runCycle, intervalMs]);

  const stop = useCallback(() => {
    activeRef.current = false;
    scanningRef.current = false;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setRunning(false);
    setScanning(false);
  }, []);

  // Stop pipelines if Insta360 disconnects
  useEffect(() => {
    if (insta360.status !== "connected" && activeRef.current) stop();
  }, [insta360.status, stop]);

  // Cleanup on unmount
  useEffect(() => () => {
    activeRef.current = false;
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  return { running, scanning, surface, croc, scanCount, lastError, latestSnapshotBase64, start, stop };
}
