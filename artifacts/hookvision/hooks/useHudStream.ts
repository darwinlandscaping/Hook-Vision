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
import { getApiUrl } from "@/utils/apiBase";

const HUD_PAGE_URL_VALUE = getApiUrl("/api/hud");
const HUD_GLASSES_URL_VALUE = getApiUrl("/api/hud/glasses");

export const HUD_PAGE_URL = HUD_PAGE_URL_VALUE ?? "";
export const HUD_GLASSES_URL = HUD_GLASSES_URL_VALUE ?? "";

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

export function useHudStream(): UseHudStreamResult {
  const [status, setStatus] = useState<HudStatus>("idle");

  const push = useCallback((payload: HudPayload) => {
    const hudUpdateUrl = getApiUrl("/api/hud/update");
    if (!hudUpdateUrl) {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2000);
      return;
    }

    setStatus("pushing");
    fetch(hudUpdateUrl, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    })
      .then((r) => {
        setStatus(r.ok ? "ok" : "error");
        setTimeout(() => setStatus("idle"), 2000);
      })
      .catch(() => {
        setStatus("error");
        setTimeout(() => setStatus("idle"), 2000);
      });
  }, []);

  return { status, pageUrl: HUD_PAGE_URL, push };
}
