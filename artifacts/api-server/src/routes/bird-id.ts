import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getModel } from "../lib/models.js";
import { getBirdFewShotRefs, recordUserBirdSighting } from "../lib/birdLibrary.js";
import { logger } from "../lib/logger.js";

const router = Router();

const SYSTEM_PROMPT = `You are an expert ornithologist and Australian tropical fishing guide. You identify birds from photographs and assess their significance as live fishing indicators for Northern Australian coastal fisheries.

TARGET INDICATOR SPECIES (WA Kimberley / NT / NQ tropical waters):
• Frigatebird (Lesser/Great) — forked tail, long angular wings, often soaring high — HIGH: circles where large pelagics drive bait up
• Crested Tern — medium tern, black cap, yellow-orange bill, diving steeply — VERY HIGH: barra and GT actively pushing bait to surface
• Little Tern — tiny, white, rapid direct dives — HIGH: micro-baitfish being pushed up
• Brown Booby — brown back, white belly, torpedo dives — VERY HIGH: big pelagics below; one diving booby = cast immediately
• Masked Booby — white with black mask and wing tips, massive plunge diver — VERY HIGH: serious bait-ball indicator
• Australian Pelican — large, white, black wings, pink bill pouch — MODERATE: general bait concentration nearby
• Osprey — raptor, white underside, dark eye stripe, hovers then plunges feet-first — HIGH: shallow active fish
• Brahminy Kite — rust-red wings, white head, swoops low — MODERATE: opportunistic surface activity
• Little Black Cormorant — all-black, slender, swimming pursuit diver — MODERATE: schooling bait present

NON-INDICATOR SPECIES (low or no fishing value):
• Silver Gull / Seagull — white, scavenger, poor indicator
• Welcome Swallow — small, aerial insect hunter, not a fishing indicator
• Any terrestrial bird (kingfisher, bee-eater, honeyeater, etc.) — LOW/NONE for open-water fishing

BEHAVIOUR:
• "diving" — steep plunge dive toward water: FISHING HOTSPOT — fish are actively feeding below
• "aerial" — circling or wheeling above water: searching; MODERATE — bait may be present
• "perched" — sitting still on structure or ground: resting; LOW significance
• "other" — swimming, walking, preening: LOW

OUTPUT: valid JSON only — no markdown, no code fences:
{
  "species": "common species name",
  "scientificName": "Genus species",
  "confidence": 0-100,
  "behavior": "diving" | "aerial" | "perched" | "other",
  "fishingIndicator": "VERY HIGH" | "HIGH" | "MODERATE" | "LOW" | "NONE",
  "fishingSignificance": "one sharp sentence: what this sighting means RIGHT NOW for fishing",
  "description": "brief visual ID — key field marks seen in this photo",
  "narration": "2-3 sentences spoken by a laconic Australian fishing guide — vivid, practical, no waffle. Mention species, what they are doing, and what the angler should do right now."
}`;

function detectMimeType(b64: string): string {
  const prefix = b64.slice(0, 12);
  if (prefix.startsWith("iVBORw0")) return "image/png";
  if (prefix.startsWith("UklGR"))   return "image/webp";
  return "image/jpeg";
}

router.post("/bird-id", async (req, res) => {
  const { imageBase64 } = req.body as { imageBase64?: string };
  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 required" });
    return;
  }

  const mimeType  = detectMimeType(imageBase64);
  const refs      = getBirdFewShotRefs(2);

  // Build vision message with few-shot bird refs from the library
  const content: Array<{ type: string; text?: string; image_url?: { url: string; detail: string } }> = [];

  if (refs.length > 0) {
    content.push({ type: "text", text: `Reference photos from the bird library (${refs.length} examples — use these for species recognition):` });
    for (const ref of refs) {
      if (ref.thumbBase64) {
        content.push({ type: "text", text: `Reference — ${ref.species}${ref.poseType ? ` (${ref.poseType})` : ""}:` });
        content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${ref.thumbBase64}`, detail: "low" } });
      }
    }
    content.push({ type: "text", text: "Now identify the bird in THIS photo and return JSON:" });
  } else {
    content.push({ type: "text", text: "Identify the bird in this photo. Return JSON only:" });
  }

  content.push({ type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: "high" } });

  try {
    const ctrl    = new AbortController();
    const timer   = setTimeout(() => ctrl.abort(), 30_000);
    const response = await openai.chat.completions.create(
      {
        model:                 getModel("top"),
        max_completion_tokens: 350,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user",   content: content as Parameters<typeof openai.chat.completions.create>[0]["messages"][0]["content"] },
        ],
      },
      { signal: ctrl.signal },
    );
    clearTimeout(timer);

    const raw   = response.choices[0]?.message?.content ?? "{}";
    const clean = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(clean);
    } catch {
      res.status(500).json({ error: "AI parse error", raw });
      return;
    }

    // ── Feed successful detection into the brain (fire-and-forget) ──────────
    // Only store confident, real detections — skip if species is missing/unknown.
    const species         = typeof parsed.species         === "string" ? parsed.species         : "";
    const scientificName  = typeof parsed.scientificName  === "string" ? parsed.scientificName  : "";
    const behavior        = typeof parsed.behavior        === "string" ? parsed.behavior        : "other";
    const confidence      = typeof parsed.confidence      === "number" ? parsed.confidence      : 0;
    const fishingIndicator     = typeof parsed.fishingIndicator     === "string" ? parsed.fishingIndicator     : "NONE";
    const fishingSignificance  = typeof parsed.fishingSignificance  === "string" ? parsed.fishingSignificance  : "";
    const description          = typeof parsed.description          === "string" ? parsed.description          : "";

    if (species && species.toLowerCase() !== "unknown" && confidence >= 30) {
      recordUserBirdSighting({
        imageBase64,
        species,
        taxonName:   scientificName,
        behavior,
        confidence,
        fishingIndicator,
        fishingSignificance,
        description,
      }).catch((err) => logger.warn({ err: String(err) }, "recordUserBirdSighting error"));
    }

    res.json({ ...parsed, refPhotosUsed: refs.length });
  } catch (err) {
    res.status(500).json({ error: "Bird ID failed", detail: String(err) });
  }
});

export default router;
