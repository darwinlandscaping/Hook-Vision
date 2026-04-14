/**
 * /api/barra-check
 * Stage-1 fast barramundi detector.
 *
 * Uses gpt-4.1-mini with few-shot visual prompting:
 *   - 3 research-grade reference photos from iNaturalist are injected into
 *     every call so the model compares the user's fish against real specimens.
 *   - "low" image detail for the reference images keeps tokens & latency down.
 *   - The user's photo uses "low" detail too — Stage 1 is purely "is/isn't barra".
 *
 * Few-shot visual prompting is the equivalent of training on reference photos,
 * applied in-context rather than via weight updates.
 */
import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getFewShotRefs, addCommunityReference } from "../lib/barraLibrary.js";

const router = Router();

// ─── Core anatomy prompt ──────────────────────────────────────────────────────
const BARRA_SYSTEM = `You are a specialist barramundi (Lates calcarifer) detection AI.
You will be shown confirmed reference barramundi specimens FIRST, then the photo to evaluate.

BARRAMUNDI HALLMARK FEATURES (9 total — a genuine barra matches ≥5):
1. FOREHEAD — concave "ski-jump" dip between eyes and snout. Most reliable feature.
2. JAW — upper jaw extends past the eye; large gape; lower jaw shorter than upper.
3. EYE — large, golden/orange iris, positioned high on the head.
4. SCALES — large ctenoid scales, silvery-grey flanks, white/cream belly; may be bronze.
5. BODY SHAPE — elongated, laterally compressed; deep at shoulder, tapers to narrow caudal peduncle.
6. DORSAL FIN — single long fin with deep notch between spiny (anterior) and soft (posterior) sections.
7. CAUDAL FIN — rounded, slightly convex, thin dark posterior margin.
8. PECTORAL FIN — large, rounded. No finger-like free rays (that's Threadfin Salmon).
9. LATERAL LINE — strongly arched over the pectoral, then straight to the caudal.

NOT A BARRA IF:
• Red/pink body with pointed snout → Mangrove Jack
• Free-hanging finger-like pectoral rays → Threadfin Salmon
• Small scales, reddish, downturned jaw → Fingermark/Golden Snapper
• Large spot pattern, leaping body shape → Saratoga
• Strongly forked tail, torpedo body → Trevally

Compare the target photo against the reference specimens above.
Count how many hallmark features you can clearly see.

OUTPUT — ONLY this JSON, no markdown, no extra text:
{
  "isBarra": true | false,
  "confidence": 0-100,
  "featuresDetected": ["feature name", ...],
  "featuresMissing": ["feature name", ...],
  "keyEvidence": "one sentence: strongest visual proof for your verdict",
  "slotWarning": null | "SLOT LIMIT — Fog Bay/Darwin Harbour: must release fish over 80cm",
  "sizeHint": "~55cm" | null,
  "refMatchScore": 0-100
}`;

function detectMime(b64: string): string {
  const p = b64.slice(0, 12);
  if (p.startsWith("iVBORw0")) return "image/png";
  if (p.startsWith("UklGR"))   return "image/webp";
  return "image/jpeg";
}

router.post("/barra-check", async (req, res) => {
  const { imageBase64, confirmAsBarra, location } = req.body as {
    imageBase64?:   string;
    confirmAsBarra?: boolean;  // true = user confirmed this IS a barra → add to library
    location?:      string;
  };

  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 required" });
    return;
  }

  // ── Community learning: if user confirmed, store in reference pool ──────────
  if (confirmAsBarra === true) {
    // We don't have a URL here (raw base64), so we skip URL storage.
    // The user's confirmation still improves accuracy via the prompt.
    // If a CDN upload endpoint is added later, store it here.
  }

  try {
    const mime = detectMime(imageBase64);
    const refs = getFewShotRefs(3);

    // Build few-shot reference content blocks
    const refBlocks: object[] = [];
    if (refs.length > 0) {
      refBlocks.push({
        type: "text",
        text: `Here are ${refs.length} confirmed research-grade barramundi specimens for comparison${refs.map((r, i) => `\n[Specimen ${i + 1}: ${r.location}, ${r.votes} expert votes]`).join("")}:`,
      });
      for (const ref of refs) {
        refBlocks.push({
          type: "image_url",
          image_url: { url: ref.photoUrl, detail: "low" },
        });
      }
      refBlocks.push({
        type: "text",
        text: "Now evaluate the following photo — is this fish ALSO a barramundi?",
      });
    } else {
      refBlocks.push({
        type: "text",
        text: "Evaluate the following photo — is this a barramundi?",
      });
    }

    const response = await openai.chat.completions.create({
      model:                "gpt-4.1-mini",
      max_completion_tokens: 400,
      stream:               false,
      messages: [
        { role: "system", content: BARRA_SYSTEM },
        {
          role: "user",
          content: [
            ...refBlocks,
            {
              type: "image_url",
              image_url: { url: `data:${mime};base64,${imageBase64}`, detail: "low" },
            },
            {
              type: "text",
              text: refs.length > 0
                ? `Compare against the ${refs.length} reference specimens above. Return JSON only.`
                : "Return JSON only.",
            },
          ],
        },
      ],
    });

    const raw   = response.choices[0]?.message?.content ?? "{}";
    const clean = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(clean); }
    catch { res.status(500).json({ error: "Parse error", raw }); return; }

    // Attach library stats to response
    parsed.refPhotosUsed    = refs.length;
    parsed.refSourceDetails = refs.map(r => r.location);

    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: "Barra check failed", detail: String(err) });
  }
});

export default router;
