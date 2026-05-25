/**
 * AI Model Config — auto-selects best available models on startup.
 * Falls back to hardcoded gpt-4.1 family if auto-detect fails.
 */

import { openai } from "@workspace/integrations-openai-ai-server";

export type Tier = "top" | "mid" | "fast";

const FALLBACK_MODELS: Record<Tier, string> = {
  top:  "gpt-4.1",
  mid:  "gpt-4.1-mini",
  fast: "gpt-4.1-nano",
};

const TIER_PREFERENCES: Record<Tier, string[]> = {
  top:  ["gpt-4.1", "gpt-4o", "gpt-4-turbo"],
  mid:  ["gpt-4.1-mini", "gpt-4o-mini"],
  fast: ["gpt-4.1-nano", "gpt-4o-mini"],
};

let _models: Record<Tier, string> = { ...FALLBACK_MODELS };
let _lastRefreshMs = 0;
let _mode: "hardcoded" | "auto-detected" = "hardcoded";

export function getModel(tier: Tier): string {
  return _models[tier];
}

export async function initModels(): Promise<void> {
  try {
    const resp = await openai.models.list();
    const available = new Set<string>();
    for await (const model of resp) {
      available.add(model.id);
    }

    for (const tier of ["top", "mid", "fast"] as Tier[]) {
      for (const candidate of TIER_PREFERENCES[tier]) {
        if (available.has(candidate)) {
          _models[tier] = candidate;
          break;
        }
      }
    }

    _mode = "auto-detected";
    _lastRefreshMs = Date.now();
    console.log(`[models] auto-detected: top=${_models.top} mid=${_models.mid} fast=${_models.fast}`);
  } catch (err) {
    console.warn("[models] auto-detect failed, using hardcoded fallbacks:", (err as Error).message);
    _mode = "hardcoded";
    _lastRefreshMs = Date.now();
  }
}

export function modelsStatus() {
  return {
    selected: { ..._models },
    mode: _mode,
    note: _mode === "auto-detected"
      ? "Models auto-selected from available OpenAI models."
      : "Auto-detect failed; using hardcoded gpt-4.1 family fallbacks.",
    lastRefreshMs: _lastRefreshMs,
  };
}
