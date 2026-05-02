/**
 * POST /api/insta360/brain
 * POST /api/insta360/brain/stream  (SSE — TURBO mode)
 *
 * Maximum speed: gpt-4.1-nano + detail:low + no refs + 200 token cap + temp 0.
 * First token arrives in ~300ms. Full result in ~700ms.
 */
import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getModel } from "../lib/models.js";

const router = Router();

// Ultra-compact prompt — every word costs time
const SYSTEM = `WA fishing AI. Respond ONLY with this JSON (no fences):
{"summary":"1 sentence","activityLevel":"none|low|medium|high","castZone":"left|centre|right|all|none","birds":{"detected":false,"species":[],"urgency":"none|low|high","description":""},"surface":{"bustUp":false,"baitBall":false,"description":""},"water":{"colour":"green|brown|tannin|blue|murky|clear","conditions":"calm|choppy|rip|glassy","visibility":"good|poor|unknown"},"crocRisk":"none|low|medium|high","crocDetail":"","structure":"","tactics":{"lure":"","technique":"","depth":"","priority":""},"confidence":0}`;

// ─── Build message content ────────────────────────────────────────────────────
function buildContent(
  imageBase64: string | undefined,
  query: string,
  sonarContext: unknown,
): string | { type: string; [k: string]: unknown }[] {
  const hasImage = typeof imageBase64 === "string" && imageBase64.length > 100;
  const hasQuery = typeof query === "string" && query.trim().length > 0;

  let text = hasImage ? "Analyse this 360° frame." : "";
  if (hasQuery) text += (text ? " Also: " : "") + query.trim();
  if (sonarContext && typeof sonarContext === "object") {
    const s = sonarContext as Record<string, unknown>;
    const parts: string[] = [];
    if (s.region)                  parts.push(`region=${s.region}`);
    if (s.species)                 parts.push(`species=${s.species}`);
    if (s.depth)                   parts.push(`depth=${s.depth}`);
    if (s.fishCount !== undefined) parts.push(`fish=${s.fishCount}`);
    if (s.archCount !== undefined) parts.push(`arches=${s.archCount}`);
    if (s.barraPct  !== undefined) parts.push(`barraPct=${s.barraPct}%`);
    if (s.waterTemp)               parts.push(`waterTemp=${s.waterTemp}`);
    if (s.bottomType)              parts.push(`bottom=${s.bottomType}`);
    if (s.waterColour)             parts.push(`waterColour=${s.waterColour}`);
    if (s.waterClarity)            parts.push(`clarity=${s.waterClarity}`);
    if (s.tidePhase)               parts.push(`tide=${s.tidePhase}`);
    if (s.birdAlert)               parts.push(`birdAlert=YES`);
    if (s.crocAlert)               parts.push(`crocAlert=YES`);
    if (s.crocWarning)             parts.push(`crocWarning=${s.crocWarning}`);
    if (s.lure)                    parts.push(`lastLure=${s.lure}`);
    if (s.confidence !== undefined) parts.push(`sonarConfidence=${s.confidence}%`);
    if (s.suggestion)              parts.push(`sonarSuggestion=${s.suggestion}`);
    if (parts.length > 0) text += ` Sonar context: ${parts.join(", ")}.`;
  }

  if (!hasImage) return text || "Analyse fishing conditions.";

  return [
    { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "low" } },
    { type: "text", text },
  ];
}

// ─── SSE streaming endpoint — first token ~300ms ──────────────────────────────
router.post("/insta360/brain/stream", async (req, res) => {
  const { imageBase64, query = "", sonarContext } = req.body as {
    imageBase64?: string; query?: string; sonarContext?: unknown;
  };

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  const t0 = Date.now();
  try {
    const content = buildContent(imageBase64, query, sonarContext);
    const stream  = await openai.chat.completions.create({
      model:       getModel("fast"),
      max_completion_tokens:  200,
      stream:      true,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user",   content },
      ],
    });

    let full = "";
    let tokenCount = 0;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) {
        full += delta;
        tokenCount++;
        res.write(`data: ${JSON.stringify({ delta, tokens: tokenCount, ms: Date.now() - t0 })}\n\n`);
      }
      if (chunk.choices[0]?.finish_reason === "stop") break;
    }

    let result: Record<string, unknown> = {};
    try {
      result = JSON.parse(full.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, ""));
    } catch {
      result = { summary: full.slice(0, 120), confidence: 50 };
    }

    res.write(`data: ${JSON.stringify({ done: true, result, totalMs: Date.now() - t0, totalTokens: tokenCount, model: getModel("fast") })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("[insta360/brain/stream]", err);
    res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

// ─── Standard JSON endpoint ───────────────────────────────────────────────────
router.post("/insta360/brain", async (req, res) => {
  const { imageBase64, query = "", sonarContext } = req.body as {
    imageBase64?: string; query?: string; sonarContext?: unknown;
  };

  const hasImage = typeof imageBase64 === "string" && imageBase64.length > 100;
  const hasQuery = typeof query  === "string" && query.trim().length > 0;

  if (!hasImage && !hasQuery) {
    res.status(400).json({ error: "Provide imageBase64 or query" });
    return;
  }

  const t0 = Date.now();
  try {
    const content    = buildContent(imageBase64, query, sonarContext);
    const completion = await openai.chat.completions.create({
      model:       getModel("fast"),
      max_completion_tokens:  200,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user",   content },
      ],
    });

    const raw     = completion.choices[0]?.message?.content?.trim() ?? "{}";
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");

    let result: Record<string, unknown>;
    try {
      result = JSON.parse(cleaned);
    } catch {
      res.status(500).json({ error: "Invalid JSON from model", raw });
      return;
    }

    res.json({ ...result, _ms: Date.now() - t0, _model: getModel("fast") });
  } catch (err) {
    console.error("[insta360/brain]", err);
    res.status(500).json({ error: String(err) });
  }
});

export default router;
