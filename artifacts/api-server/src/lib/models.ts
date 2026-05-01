/**
 * AI Model Config — HARDCODED to gpt-4.1 family.
 *
 * gpt-4.1 (top), gpt-4.1-mini (mid), gpt-4.1-nano (fast) are the ONLY
 * confirmed-working models on Replit's AI proxy. Do NOT change these to
 * gpt-4.5 or gpt-5.x — those return empty responses on this proxy.
 *
 * Update manually here when a newer model is confirmed to work end-to-end.
 */

export type Tier = "top" | "mid" | "fast";

const MODELS: Record<Tier, string> = {
  top:  "gpt-4.1",
  mid:  "gpt-4.1-mini",
  fast: "gpt-4.1-nano",
};

/**
 * Returns the model for the given tier.
 * Always returns a hardcoded gpt-4.1 family model — no auto-selection.
 */
export function getModel(tier: Tier): string {
  return MODELS[tier];
}

/**
 * No-op — kept for backward compatibility with startup call in index.ts.
 */
export async function initModels(): Promise<void> {
  // Nothing to initialise — models are hardcoded.
}

/**
 * Returns a status snapshot for the /api/models endpoint.
 */
export function modelsStatus() {
  return {
    selected:      { ...MODELS },
    mode:          "hardcoded",
    note:          "Models are hardcoded to gpt-4.1 family. Update models.ts manually to change.",
    lastRefreshMs: 0,
  };
}
