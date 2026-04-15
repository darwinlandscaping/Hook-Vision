/**
 * useInsta360SonarPreview
 * ─────────────────────────────────────────────────────────────────────────────
 * Polls the Insta360 camera for a live preview frame at a set interval
 * whenever the camera is connected. The result is a base64 JPEG that can be
 * displayed as the camera viewfinder background in the Live tab.
 *
 * When the Insta360 is connected via WiFi and pointed at the sonar screen,
 * this hook acts as a "remote sonar camera" — the phone camera is not used.
 *
 * Lifecycle:
 *   - Starts automatically when `active = true` AND Insta360 is connected
 *   - Stops / clears when disconnected or `active = false`
 *   - Does NOT run if the Insta360 is disconnected or searching
 *
 * The hook is intentionally lightweight — it just polls takeSnapshot() from
 * the existing useInsta360 hook and stores the last base64 frame.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { UseInsta360Result } from "./useInsta360";

export interface Insta360SonarPreviewState {
  /** base64 JPEG of last snapshot from Insta360, or null if none yet */
  previewBase64: string | null;
  /** true while a snapshot is in flight */
  refreshing: boolean;
  /** Unix ms timestamp of the last successful preview capture */
  lastRefreshAt: number;
  /** how many preview frames captured so far */
  frameCount: number;
  /** force an immediate refresh (e.g. user tapped the viewfinder) */
  refresh: () => Promise<void>;
}

const DEFAULT_INTERVAL_MS = 2500;   // ~0.4 fps — enough for a sonar screen

export function useInsta360SonarPreview(
  insta360: UseInsta360Result,
  opts: {
    /** poll interval in ms — default 2500 */
    intervalMs?: number;
    /** set to false to pause polling (e.g. while scanning) */
    active?: boolean;
  } = {},
): Insta360SonarPreviewState {
  const { intervalMs = DEFAULT_INTERVAL_MS, active = true } = opts;

  const [previewBase64, setPreviewBase64] = useState<string | null>(null);
  const [refreshing, setRefreshing]       = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState(0);
  const [frameCount, setFrameCount]       = useState(0);

  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshingRef = useRef(false);

  const doRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    if (insta360.status !== "connected") return;

    refreshingRef.current = true;
    setRefreshing(true);

    try {
      const snap = await insta360.takeSnapshot();
      if (snap?.base64) {
        setPreviewBase64(snap.base64);
        setLastRefreshAt(Date.now());
        setFrameCount((n) => n + 1);
      }
    } catch {
      // fail silently — preview is best-effort
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, [insta360]);

  // Start/stop the polling loop
  useEffect(() => {
    const shouldPoll = active && insta360.status === "connected";

    if (!shouldPoll) {
      // Stop polling and clear preview when disconnected
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (insta360.status !== "connected") {
        setPreviewBase64(null);
        setFrameCount(0);
        setLastRefreshAt(0);
      }
      return;
    }

    // Connected — fire first frame immediately then start interval
    doRefresh();
    timerRef.current = setInterval(doRefresh, intervalMs);

    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, insta360.status, intervalMs]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  return { previewBase64, refreshing, lastRefreshAt, frameCount, refresh: doRefresh };
}
