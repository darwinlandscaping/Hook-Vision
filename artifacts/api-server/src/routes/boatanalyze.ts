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

// ── Single-frame scan (backward-compat fallback) ─────────────────────────────

const SINGLE_SYS = `Expert sonar fish analyst. Return JSON only.
Grid: columns A(left)→D(right), rows 1(surface)→4(deep). Zones A1…D4.
Fish = arch (∩ shape). Thick arch = large fish (>40 cm). Thin = small.
Bottom return line is NOT a fish. Report which grid zones contain arches.`;

const SINGLE_OUT = `{"species":"string","fishCount":int,"confidence":float,"depth":"string","distance":"string","suggestion":"≤20 words","lure":"string","lureType":"string","technique":"string","crocAlert":bool,"crocWarning":string|null,"birdAlert":string|null,"barraPct":float|null,"archCount":int|null,"archType":"none|thin|thick|mixed","waterTemp":"string","bottomType":"string","detectedZones":["zone"]}`;

router.post("/boat-analyze", async (req, res) => {
  const { imageBase64 } = req.body as { imageBase64?: string };
  if (!imageBase64) { res.status(400).json({ error: "imageBase64 required" }); return; }

  try {
    const mime = detectMimeType(imageBase64);
    const img = { type: "image_url" as const, image_url: { url: `data:${mime};base64,${imageBase64}`, detail: "low" as const } };

    const completion = await openai.chat.completions.create({
      model: getModel("fast"),
      max_completion_tokens: 160,
      stream: false,
      messages: [
        { role: "system", content: SINGLE_SYS },
        { role: "user", content: [img, { type: "text", text: `Analyse sonar for fish arches. JSON: ${SINGLE_OUT}` }] },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const clean = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const m = clean.match(/\{[\s\S]*\}/);
    const d = m ? JSON.parse(m[0]) : {};

    res.json({
      species: d.species ?? "Unknown", fishCount: d.fishCount ?? 0, confidence: d.confidence ?? 0,
      depth: d.depth ?? "unknown", distance: d.distance ?? "unknown", suggestion: d.suggestion ?? "",
      lure: d.lure ?? "", lureType: d.lureType ?? "", technique: d.technique ?? "",
      crocAlert: d.crocAlert ?? false, crocWarning: d.crocWarning ?? null, birdAlert: d.birdAlert ?? null,
      barraPct: d.barraPct ?? null, archCount: d.archCount ?? null, archType: d.archType ?? "none",
      waterTemp: d.waterTemp ?? "", bottomType: d.bottomType ?? "",
      detectedZones: Array.isArray(d.detectedZones) ? d.detectedZones : [],
    });

    req.log.info({ species: d.species, fishCount: d.fishCount }, "Boat-analyze complete");
  } catch (err) {
    req.log.error({ err }, "Boat-analyze failed");
    res.status(500).json({ error: "Analysis failed" });
  }
});

// ── Multi-frame arch-movement analysis ───────────────────────────────────────

const CYCLE_SYS = `You are a sonar fish-arch analyst. You receive sequential sonar frames captured 2 s apart — oldest first, newest last.

GRID: columns A(left) → D(right), rows 1(surface) → 4(deep). 16 zones: A1 A2 A3 A4  B1 B2 B3 B4  C1 C2 C3 C4  D1 D2 D3 D4.

SONAR PHYSICS:
• Fish appear as ARCHES (∩ curves). THICK arch (>10% frame height) = large fish (barramundi, trevally, croc). THIN arch = small fish.
• Sonar scrolls: new echoes enter from the RIGHT. So across frames, arches drift LEFT as a baseline. Faster leftward movement than scroll = fish swimming away. Rightward or stationary = fish swimming toward boat.
• Bottom return = bright continuous horizontal band near the bottom — NOT a fish.
• Same arch at the same depth across multiple frames = confirmed fish.
• Multiple arches at the same depth in the same zone = school.

YOUR TASK:
1. For each frame, list which grid zones contain distinct arch shapes.
2. Track arch position changes across frames 1→5.
3. Determine dominant movementVector: left | right | deeper | shallower | stationary | unknown.
4. archType: none | thin | thick | mixed.

Return JSON only — no markdown, no prose.`;

const CYCLE_SCHEMA = `{
  "frameZones": [["A2"],["A2","B2"],["B2","C2"],["C2"],["C2","D2"]],
  "activeZones": ["A2","B2","C2","D2"],
  "movementVector": "left",
  "archCount": 2,
  "archType": "thick",
  "depthRange": "3-6m",
  "fishCount": 2,
  "confidence": 0.8,
  "species": "barramundi",
  "barraPct": 0.7,
  "suggestion": "≤20 words tactical advice",
  "lure": "string",
  "lureType": "hard|soft|fly|jig|surface",
  "technique": "string",
  "crocAlert": false,
  "crocWarning": null,
  "birdAlert": null,
  "waterTemp": "",
  "bottomType": ""
}`;

router.post("/boat-cycle", async (req, res) => {
  const { frames } = req.body as { frames?: string[] };
  if (!Array.isArray(frames) || frames.length === 0) {
    res.status(400).json({ error: "frames array required" }); return;
  }

  const clipped = frames.slice(0, 5);

  try {
    const imgContent = clipped.flatMap((b64, i) => ([
      { type: "text" as const, text: `Frame ${i + 1} of ${clipped.length}:` },
      { type: "image_url" as const, image_url: { url: `data:${detectMimeType(b64)};base64,${b64}`, detail: "low" as const } },
    ]));

    const completion = await openai.chat.completions.create({
      model: getModel("mid"),
      max_completion_tokens: 450,
      stream: false,
      messages: [
        { role: "system", content: CYCLE_SYS },
        { role: "user", content: [
          ...imgContent,
          { type: "text", text: `Analyse these ${clipped.length} sonar frames for arch shapes and movement across the 4×4 grid. Return JSON matching this schema:\n${CYCLE_SCHEMA}` },
        ]},
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const clean = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const parsed = clean.match(/\{[\s\S]*\}/);
    const d = parsed ? JSON.parse(parsed[0]) : {};

    const frameZones: string[][] = Array.isArray(d.frameZones)
      ? d.frameZones.map((z: unknown) => (Array.isArray(z) ? z.filter((s: unknown) => typeof s === "string") : []))
      : [];
    const activeZones: string[] = Array.isArray(d.activeZones)
      ? d.activeZones.filter((s: unknown) => typeof s === "string")
      : [...new Set(frameZones.flat())];

    res.json({
      frameZones,
      activeZones,
      movementVector: d.movementVector ?? "unknown",
      archCount:      d.archCount ?? null,
      archType:       d.archType  ?? "none",
      depthRange:     d.depthRange ?? "unknown",
      fishCount:      d.fishCount  ?? 0,
      confidence:     d.confidence ?? 0,
      species:        d.species    ?? "Unknown",
      barraPct:       d.barraPct   ?? null,
      suggestion:     d.suggestion ?? "",
      lure:           d.lure       ?? "",
      lureType:       d.lureType   ?? "",
      technique:      d.technique  ?? "",
      crocAlert:      d.crocAlert  ?? false,
      crocWarning:    d.crocWarning ?? null,
      birdAlert:      d.birdAlert  ?? null,
      waterTemp:      d.waterTemp  ?? "",
      bottomType:     d.bottomType ?? "",
    });

    req.log.info({ archCount: d.archCount, archType: d.archType, movementVector: d.movementVector, fishCount: d.fishCount }, "Boat-cycle complete");
  } catch (err) {
    req.log.error({ err }, "Boat-cycle failed");
    res.status(500).json({ error: "Cycle analysis failed" });
  }
});

export default router;
