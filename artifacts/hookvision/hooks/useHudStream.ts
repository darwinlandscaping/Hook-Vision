/**
 * useHudStream — pushes scan results to the HookVision HUD server endpoint
 * so smart glasses (or any browser) showing /hud get live analysis data.
 *
 * Usage (Scan tab — after analysis completes):
 *   const hud = useHudStream();
 *   hud.push({ species, fishCount, depth, confidence, suggestion, ... });
 *
 * The HUD page at <API_SERVER>/hud updates in real-time via SSE.
 * Smart glasses open that URL in their browser over the shared WiFi.
 */

import { useCallback, useState } from "react";
import { Platform } from "react-native";

const BASE_URL = Platform.OS === "web"
  ? (typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname}` : "")
  : (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "");

export const HUD_PAGE_URL    = `${BASE_URL}/api/hud`;
export const HUD_GLASSES_URL = `${BASE_URL}/api/hud/glasses`;
const        HUD_UPDATE_URL  = `${BASE_URL}/api/hud/update`;

export interface HudPayload {
  species:      string;
  fishCount:    number;
  depth:        string;
  confidence:   number;     // 0–1
  suggestion:   string;
  archCount?:   number;
  sonarMode?:   string | null;
  waterTemp?:   string;
  bottomType?:  string;
  lure?:        string;
  crocAlert?:   boolean;
  crocWarning?: string | null;
  birdAlert?:   string | null;
  barraPct?:    number | null;
  region?:      "wa" | "nt" | "nq" | null;
  source?:      "live" | "boat" | "cam2";
}

export type HudStatus = "idle" | "pushing" | "ok" | "error";

export interface UseHudStreamResult {
  status:  HudStatus;
  pageUrl: string;
  push:    (payload: HudPayload) => void;
}

async function pushWithRetry(
  payload: HudPayload,
  retries = 3,
  baseDelayMs = 2000,
): Promise<boolean> {
  const body = JSON.stringify(payload);
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10_000);
      const r = await fetch(HUD_UPDATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (r.ok) return true;
    } catch { /* retry */ }
    if (attempt < retries - 1) {
      await new Promise<void>((r) => setTimeout(r, baseDelayMs * (attempt + 1)));
    }
  }
  return false;
}

export function useHudStream(): UseHudStreamResult {
  const [status, setStatus] = useState<HudStatus>("idle");

  const push = useCallback((payload: HudPayload) => {
    setStatus("pushing");
    pushWithRetry(payload)
      .then((ok) => {
        setStatus(ok ? "ok" : "error");
        setTimeout(() => setStatus("idle"), 2000);
      });
  }, []);

  return { status, pageUrl: HUD_PAGE_URL, push };
}
