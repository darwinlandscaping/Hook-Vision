import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getModel } from "../lib/models.js";

const router = Router();

// ─── WA Fish Regulations Reference ────────────────────────────────────────────
const NT_REGULATIONS = `
WA FISHING REGULATIONS (Recreational, Kimberley/North WA, current as of 2025):
BARRAMUNDI: Min 55cm. Bag limit 3/person/day. Season open year-round in Kimberley — check WA Fisheries for any current closures.
MANGROVE JACK: Min 35cm. Bag limit 10/person/day.
GOLDEN SNAPPER (Fingermark / Large-scale Sea Perch): Min 30cm. Bag limit 10/person/day. Part of combined demersal reef fish aggregate.
RED EMPEROR: Min 41cm. Bag limit 5/person/day. Part of reef fish aggregate.
THREADFIN SALMON (Blue Salmon): Min 60cm. Bag limit 5/person/day.
GIANT TREVALLY (GT): No minimum. Bag limit subject to WA combined finfish rules.
QUEENFISH: No minimum. No bag limit.
GOLDEN TREVALLY: No minimum. No bag limit.
CORAL TROUT: Min 38cm. Bag limit 10/person/day. Part of reef fish aggregate (combined max 20 reef fish).
SPANISH MACKEREL: Min 60cm. Bag limit 10/person/day.
MUD CRAB: Min 127mm carapace width. Males only — females must be released immediately. Bag limit 4/person/day.
BLACK JEWFISH (Mulloway / Butterfish): Min 60cm. Bag limit 5/person/day.
SADDLETAIL SNAPPER: Min 35cm. Bag limit 10 combined demersal.
FRESHWATER SAWFISH: PROTECTED — must release immediately, do not remove from water.
NORTHERN RIVER SHARK: PROTECTED — release immediately.
SPEARTOOTH SHARK: PROTECTED — release immediately.
SAWFISHES (all): PROTECTED — release immediately.
GENERAL: Keep fish alive until filleting; return undersized fish carefully; use circle hooks near structured habitat to reduce gut hooking; wet hands before handling for release.
`;

const SYSTEM_PROMPT = `You are an expert fish identification specialist for Western Australia (Kimberley region). You identify fish from photographs — a caught fish being held, lying on a surface, in a bucket, or photographed in water.

Your knowledge covers:
• All WA/Kimberley species visual features: lateral line pattern, fin shape/position, jaw profile, body depth, scale size, colour pattern, eye colour, caudal fin shape
• Size estimation from hand/arm/rod references in the photo (average adult male hand span ~22cm, forearm ~45cm, standard barra rod ~2.1m)
• WA Fisheries regulations — bag limits, size limits, protected species
• Catch-and-release handling best practice for WA tropical species

${NT_REGULATIONS}

IDENTIFICATION METHOD (apply in order):
1. BODY SHAPE: depth ratio (deep-bodied vs slender), length, overall silhouette
2. JAW & HEAD: jaw length, forehead profile (concave=barra, rounded=jack, pointed=thready), snout length
3. FINS: dorsal fin (spiny vs soft, single vs notched), pectoral fin shape, caudal fin shape (forked vs rounded)
4. SCALE PATTERN: large vs small, colour, lateral line visibility and position
5. COLOURATION: overall body colour, belly, distinctive markings
6. SIZE ESTIMATION: compare against any reference in photo (hand, arm, boat, rod, cooler)
7. HABITAT CONTEXT: if water, boat, or background is visible

FOR EACH FISH: commit to a species. Never leave species unknown. If uncertain, give your best ID with lower confidence and note what's ambiguous.

LEGAL STATUS RULES:
• "keep": fish appears above minimum size and within bag/slot limits
• "release": fish appears below minimum size OR above bag limit threshold
• "protected": species is protected regardless of size
• "measure": size cannot be estimated reliably from photo — advise to measure before keeping

OUTPUT: valid JSON only — no markdown, no explanation outside the JSON:
{
  "species": "common species name",
  "scientificName": "Genus species",
  "confidence": 0-100,
  "alternateId": "second most likely species if confident not 100%",
  "sizeEstimate": "~65cm" or null if no reference visible,
  "sizeEstimateMethod": "hand reference" | "arm reference" | "rod reference" | "body proportion" | null,
  "legalSizeNT": "55cm minimum",
  "bagLimitNT": "5 per person per day",
  "legalStatus": "keep" | "release" | "protected" | "measure",
  "legalNote": "one-sentence note about slot limits or special rules if applicable",
  "features": ["feature 1", "feature 2", "feature 3"],
  "handling": "handling advice for this specific species",
  "releaseTip": "release method if applicable, else null",
  "isProtected": false,
  "habitat": "brief WA/Kimberley habitat description",
  "season": "peak season note for WA/Kimberley",
  "funFact": "one interesting fact about this species in WA/Kimberley"
}`;

function detectMimeType(b64: string): string {
  const prefix = b64.slice(0, 12);
  if (prefix.startsWith("iVBORw0")) return "image/png";
  if (prefix.startsWith("UklGR"))   return "image/webp";
  return "image/jpeg";
}

router.post("/fish-id", async (req, res) => {
  const { imageBase64 } = req.body as { imageBase64?: string };
  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 required" });
    return;
  }

  try {
    const mimeType = detectMimeType(imageBase64);
    const response = await openai.chat.completions.create({
      model: getModel("mid"),
      max_completion_tokens: 400,
      stream: false,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: "low" },
            },
            {
              type: "text",
              text: "Identify this fish. Assess legal status for WA Fisheries. Return JSON only.",
            },
          ],
        },
      ],
    }, { signal: AbortSignal.timeout(30_000) });

    const raw = response.choices[0]?.message?.content ?? "{}";

    // Strip markdown fences if GPT wraps it anyway
    const clean = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(clean);
    } catch {
      res.status(500).json({ error: "AI response parse error", raw });
      return;
    }

    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: "Fish ID failed", detail: String(err) });
  }
});

export default router;
