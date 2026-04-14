/**
 * /api/barra-check
 * Stage-1 fast barramundi detector — uses gpt-4.1-mini with low image detail
 * so the model can return a verdict in ~400 ms.
 *
 * Analogous to a face-detection cascade: a lightweight, focused pass that just
 * answers "is this a barra?" before the full species analyser runs.
 */
import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

// ─── Barramundi anatomy cheat-sheet (all 9 hallmark features) ──────────────
const BARRA_SYSTEM = `You are a specialist barramundi (Lates calcarifer) detection AI.

Your ONLY job: examine this photograph and determine whether the fish shown is a barramundi.
You do NOT need to identify other species — just confirm or deny barramundi.

BARRAMUNDI HALLMARK FEATURES (check each one):
1. FOREHEAD PROFILE — distinctive concave dip between the eyes and snout ("ski-jump" forehead). Most reliable single feature.
2. JAW — strongly prognathous (lower jaw shorter than upper), large gape.
3. EYE — large, golden/orange iris, high on the head.
4. SCALES — large ctenoid scales, silvery-grey on flanks, white/cream belly. May show bronze/gold iridescence in clean water.
5. BODY SHAPE — elongated, laterally compressed. Deep through the shoulder, tapering to a narrow caudal peduncle.
6. DORSAL FIN — single long dorsal fin with a deep notch between the spiny anterior section and the soft posterior section.
7. CAUDAL FIN — rounded, slightly convex, often with a thin dark posterior margin.
8. PECTORAL FIN — large, rounded pectoral fin.
9. LATERAL LINE — strongly arched over the pectoral fin, then runs straight to the caudal.

OFTEN CONFUSED WITH:
• Mangrove Jack — deeper red/pink body, pointed snout, no concave forehead
• Threadfin Salmon — distinctive free-hanging pectoral fin rays like fingers
• Fingermark/Golden Snapper — smaller scales, more reddish, downturned jaw
• Saratoga — larger scales with spots, completely different jaw

TASK: Carefully check how many hallmark features you can see. A real barra will match ≥5 of the 9 features.

OUTPUT — return ONLY this JSON, no markdown, no explanation:
{
  "isBarra": true | false,
  "confidence": 0-100,
  "featuresDetected": ["feature name", ...],  // hallmark features clearly visible
  "featuresMissing": ["feature name", ...],   // hallmarks you cannot confirm
  "keyEvidence": "one sentence: the single strongest visual proof for your verdict",
  "slotWarning": null | "SLOT LIMIT — Fog Bay/Darwin Harbour: must release fish over 80cm",
  "sizeHint": "~55cm" | null
}`;

function detectMime(b64: string): string {
  const p = b64.slice(0, 12);
  if (p.startsWith("iVBORw0")) return "image/png";
  if (p.startsWith("UklGR"))   return "image/webp";
  return "image/jpeg";
}

router.post("/barra-check", async (req, res) => {
  const { imageBase64 } = req.body as { imageBase64?: string };
  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 required" });
    return;
  }

  try {
    const mime = detectMime(imageBase64);
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      max_completion_tokens: 350,
      stream: false,
      messages: [
        { role: "system", content: BARRA_SYSTEM },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              // "low" detail = 85-token flat cost, much faster
              image_url: { url: `data:${mime};base64,${imageBase64}`, detail: "low" },
            },
            { type: "text", text: "Is this a barramundi? Return JSON only." },
          ],
        },
      ],
    });

    const raw   = response.choices[0]?.message?.content ?? "{}";
    const clean = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(clean); }
    catch { res.status(500).json({ error: "Parse error", raw }); return; }

    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: "Barra check failed", detail: String(err) });
  }
});

export default router;
