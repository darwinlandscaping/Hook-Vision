import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getModel } from "../lib/models.js";

const router = Router();

function detectMimeType(b64: string): string {
  const p = b64.slice(0, 12);
  if (p.startsWith("/9j/")) return "image/jpeg";
  if (p.startsWith("iVBORw0")) return "image/png";
  if (p.startsWith("UklGR")) return "image/webp";
  return "image/jpeg";
}

const SYS = `Expert barramundi sonar AI. Return JSON only.
Identify fish in sonar images. Use LIVE SONAR tell-signs: dark background, fish=solid bright bodies.
Return concise JSON with all required fields.`;

const OUT = `{"species":"string","fishCount":int,"confidence":float 0-1,"depth":"string","distance":"string","suggestion":"≤20 words","lure":"string","lureType":"string","technique":"string","crocAlert":bool,"crocWarning":string|null,"birdAlert":string|null,"barraPct":float|null,"archCount":int|null,"waterTemp":"string","bottomType":"string","detectedZones":["string"]}`;

router.post("/boat-analyze", async (req, res) => {
  const { imageBase64 } = req.body as { imageBase64?: string };
  if (!imageBase64) { res.status(400).json({ error: "imageBase64 required" }); return; }

  try {
    const mime = detectMimeType(imageBase64);
    const img = { type: "image_url" as const, image_url: { url: `data:${mime};base64,${imageBase64}`, detail: "low" as const } };

    const completion = await openai.chat.completions.create({
      model: getModel("fast"),
      max_completion_tokens: 150,
      stream: false,
      messages: [
        { role: "system", content: SYS },
        { role: "user", content: [img, { type: "text", text: `Analyse this sonar image for fish. Return JSON matching this schema exactly: ${OUT}` }] },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const clean = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const m = clean.match(/\{[\s\S]*\}/);
    const d = m ? JSON.parse(m[0]) : {};

    res.json({
      species:      d.species      ?? "Unknown",
      fishCount:    d.fishCount    ?? 0,
      confidence:   d.confidence   ?? 0,
      depth:        d.depth        ?? "unknown",
      distance:     d.distance     ?? "unknown",
      suggestion:   d.suggestion   ?? "",
      lure:         d.lure         ?? "",
      lureType:     d.lureType     ?? "",
      technique:    d.technique    ?? "",
      crocAlert:    d.crocAlert    ?? false,
      crocWarning:  d.crocWarning  ?? null,
      birdAlert:    d.birdAlert    ?? null,
      barraPct:     d.barraPct     ?? null,
      archCount:    d.archCount    ?? null,
      waterTemp:    d.waterTemp    ?? "",
      bottomType:   d.bottomType   ?? "",
      detectedZones: Array.isArray(d.detectedZones) ? d.detectedZones : [],
    });

    req.log.info({ species: d.species, fishCount: d.fishCount, confidence: d.confidence }, "Boat-analyze complete");
  } catch (err) {
    req.log.error({ err }, "Boat-analyze failed");
    res.status(500).json({ error: "Analysis failed" });
  }
});

export default router;
