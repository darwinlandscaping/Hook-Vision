/**
 * AI Model Auto-Selector
 *
 * Queries OpenAI's /v1/models on startup and every 6 hours, then picks the
 * best available model for each tier (top / mid / fast).
 *
 * Scoring: parses "gpt-X.Y[-suffix]" → score = major×100 + minor×10.
 *   gpt-5.4 → 540   gpt-5 → 500   gpt-4.1 → 410   gpt-4o → 400
 * Always prefers higher scores, so gpt-6 (if/when released) is picked
 * automatically without any code change.
 *
 * Tier definitions:
 *   top  — full-power reasoning (no -mini/-nano suffix)
 *   mid  — balanced speed/cost (-mini suffix)
 *   fast — fastest / cheapest  (-nano suffix)
 *
 * Falls back to hardcoded defaults if the OpenAI model list is unreachable.
 */

import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "./logger.js";

// ── Model preference lists (best first per tier) ──────────────────────────────
// Update this list as new GPT generations are released.

const PREFERENCES: Record<Tier, string[]> = {
  top:  ["gpt-5.4", "gpt-5", "gpt-4.5", "gpt-4.1"],
  mid:  ["gpt-5-mini", "gpt-4.5-mini", "gpt-4.1-mini", "gpt-4o-mini"],
  fast: ["gpt-5-nano", "gpt-4.1-nano"],
};

// Derived fallback = first item in each preference list
const FALLBACK: Record<Tier, string> = {
  top:  PREFERENCES.top[0]!,
  mid:  PREFERENCES.mid[0]!,
  fast: PREFERENCES.fast[0]!,
};

export type Tier = "top" | "mid" | "fast";

// ── State ─────────────────────────────────────────────────────────────────────

let _selected: Record<Tier, string> = { ...FALLBACK };
let _lastRefresh = 0;
let _allChatModels: string[] = [];
let _refreshPromise: Promise<void> | null = null;

const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

// ── Scoring ───────────────────────────────────────────────────────────────────

/**
 * Score a model ID so higher = newer / more capable.
 * Returns 0 for non-GPT or unrecognised patterns.
 */
function scoreModel(id: string): number {
  // Match: gpt-<major>[.<minor>][-suffix]
  const m = id.match(/^gpt-(\d+)(?:\.(\d+))?(?:-([\w]+))?$/);
  if (!m) return 0;
  const major = parseInt(m[1], 10);
  const minor  = m[2] ? parseInt(m[2], 10) : 0;
  return major * 100 + minor * 10;
}

function tierOf(id: string): Tier | null {
  if (id.endsWith("-nano"))  return "fast";
  if (id.endsWith("-mini"))  return "mid";
  // Exclude noise: preview, vision-preview, instruct, dated snapshots, dall-e, tts, whisper
  if (/preview|instruct|vision$|turbo|dall|tts|whisper|realtime|audio|search/.test(id)) return null;
  if (scoreModel(id) === 0) return null;
  return "top";
}

// ── Refresh logic ─────────────────────────────────────────────────────────────

async function doRefresh(): Promise<void> {
  try {
    // Attempt live discovery — may be blocked (405) when running behind the
    // Replit AI proxy which only proxies chat completions.
    const list = await openai.models.list();

    const chatModels = list.data
      .map((m: { id: string }) => m.id)
      .filter((id: string) => id.startsWith("gpt-") && scoreModel(id) > 0);

    _allChatModels = chatModels.sort((a: string, b: string) => scoreModel(b) - scoreModel(a));

    const bestByTier: Record<Tier, { id: string; score: number }> = {
      top:  { id: FALLBACK.top,  score: 0 },
      mid:  { id: FALLBACK.mid,  score: 0 },
      fast: { id: FALLBACK.fast, score: 0 },
    };

    for (const id of chatModels) {
      const t = tierOf(id);
      if (!t) continue;
      const s = scoreModel(id);
      if (s > bestByTier[t].score) {
        bestByTier[t] = { id, score: s };
      }
    }

    _selected = {
      top:  bestByTier.top.id,
      mid:  bestByTier.mid.id,
      fast: bestByTier.fast.id,
    };

    logger.info(
      { top: _selected.top, mid: _selected.mid, fast: _selected.fast, total: chatModels.length },
      "[models] auto-selected from live API"
    );
  } catch (_err) {
    // Live API unavailable (proxy limitation or network error).
    // Resolve from PREFERENCES list — pick the highest-scoring model per tier.
    const tiers: Tier[] = ["top", "mid", "fast"];
    for (const tier of tiers) {
      const best = PREFERENCES[tier]
        .map((id) => ({ id, score: scoreModel(id) }))
        .sort((a, b) => b.score - a.score)[0];
      if (best) _selected[tier] = best.id;
    }

    _allChatModels = tiers.flatMap((t) => PREFERENCES[t]);

    logger.info(
      { top: _selected.top, mid: _selected.mid, fast: _selected.fast },
      "[models] using preference list (live API unavailable)"
    );
  } finally {
    _lastRefresh = Date.now();
    _refreshPromise = null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the best currently-known model for the given tier.
 * Triggers a background refresh if the cache is stale (>6 h).
 */
export function getModel(tier: Tier): string {
  const stale = Date.now() - _lastRefresh > REFRESH_INTERVAL_MS;
  if (stale && !_refreshPromise) {
    _refreshPromise = doRefresh();            // fire-and-forget refresh
  }
  return _selected[tier];
}

/**
 * Run the first model refresh and wait for it to complete.
 * Call once at server startup so the first request gets fresh models.
 */
export async function initModels(): Promise<void> {
  if (!_refreshPromise) _refreshPromise = doRefresh();
  await _refreshPromise;
}

/**
 * Returns a status snapshot for the /api/models endpoint.
 */
export function modelsStatus() {
  return {
    selected:       { ..._selected },
    preferences:    { ...PREFERENCES },
    fallback:       { ...FALLBACK },
    lastRefreshMs:  _lastRefresh,
    lastRefreshAgo: _lastRefresh ? `${Math.round((Date.now() - _lastRefresh) / 60000)} min ago` : "never",
    nextRefreshIn:  _lastRefresh
      ? `${Math.max(0, Math.round((REFRESH_INTERVAL_MS - (Date.now() - _lastRefresh)) / 60000))} min`
      : "pending",
    chatModelsAvailable: _allChatModels,
  };
}
