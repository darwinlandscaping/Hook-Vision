import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

// ─── NT Fish Regulations Reference ────────────────────────────────────────────
const NT_REGULATIONS = `
NT FISHING REGULATIONS (Recreational, current as of 2025):
BARRAMUNDI: Min 55cm. Bag limit 5/person/day. Fog Bay & Darwin Harbour: slot limit 55–80cm (fish 80cm+ must be released). Season open year-round but check closures.
MANGROVE JACK: Min 35cm. Bag limit 10/person/day.
FINGERMARK (Golden Snapper): Min 41cm. Bag limit 5/person/day.
THREADFIN SALMON (Blue Salmon): Min 40cm. Bag limit 10/person/day.
GIANT TREVALLY (GT): No minimum size. No bag limit currently in NT.
QUEENFISH: No minimum. No bag limit.
GOLDEN TREVALLY: No minimum. No bag limit.
BLACK JEWFISH (Mulloway): Min 60cm. Bag limit 2/person/day.
SPANISH MACKEREL: Min 75cm. Bag limit 5/person/day.
GOLDEN SNAPPER: same as Fingermark above.
CORAL TROUT: No NT minimum (reef rules apply offshore). Bag limit 10 combined reef fish.
SADDLETAIL SNAPPER: Min 35cm.
BLUE-BONED (Yellowfin Bream): Min 25cm. Bag limit 20/person/day.
SOOTY GRUNTER: Min 25cm. Bag limit 10/person/day.
FRESHWATER SAWFISH: PROTECTED — must release immediately, do not remove from water.
NORTHERN RIVER SHARK: PROTECTED — release immediately.
SPEARTOOTH SHARK: PROTECTED — release immediately.
SAWFISHES (all): PROTECTED — release immediately.
GENERAL: Keep fish alive until filleting; return undersized fish carefully; use circle hooks near structured habitat to reduce gut hooking; wet hands before handling for release.
`;

const SYSTEM_PROMPT = `You are an expert fish identification specialist for Northern Territory Australia. You identify fish from photographs — a caught fish being held, lying on a surface, in a bucket, or photographed in water.

Your knowledge covers:
• All NT species visual features: lateral line pattern, fin shape/position, jaw profile, body depth, scale size, colour pattern, eye colour, caudal fin shape
• Size estimation from hand/arm/rod references in the photo (average adult male hand span ~22cm, forearm ~45cm, standard barra rod ~2.1m)
• NT fishing regulations — bag limits, size limits, protected species
• Catch-and-release handling best practice for NT tropical species

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
• "release": fish appears below minimum size OR above upper slot limit (barra in Fog Bay/Darwin Harbour >80cm)
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
  "habitat": "brief NT habitat description",
  "season": "peak season note for NT",
  "funFact": "one interesting fact about this species in NT"
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
      model: "gpt-4.1-mini",
      max_completion_tokens: 400,
      temperature: 0,
      seed: 42,
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
              text: "Identify this fish. Assess legal status for NT. Return JSON only.",
            },
          ],
        },
      ],
    });

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
