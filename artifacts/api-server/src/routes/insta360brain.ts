/**
 * POST /api/insta360/brain        — standard JSON (single or multi-image)
 * POST /api/insta360/brain/stream — SSE streaming (single or multi-image)
 * GET  /api/visual/log            — recent brain visual sessions
 *
 * All images (Insta360, GoPro, DJI, SmartLife, pipeline snapshots) are sent
 * here as an `images[]` array. Each image gets its own label in the prompt.
 * Every brain call is logged to visual_logs in the DB (fire-and-forget).
 */
import { Router } from "express";
import { randomUUID } from "crypto";
import { desc } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, visualLogs } from "@workspace/db";
import { getModel } from "../lib/models.js";

const router = Router();

// Ultra-compact system prompt
const SYSTEM = `WA fishing AI. Respond ONLY with this JSON (no fences):
{"summary":"1 sentence","activityLevel":"none|low|medium|high","castZone":"left|centre|right|all|none","birds":{"detected":false,"species":[],"urgency":"none|low|high","description":""},"surface":{"bustUp":false,"baitBall":false,"description":""},"water":{"colour":"green|brown|tannin|blue|murky|clear","conditions":"calm|choppy|rip|glassy","visibility":"good|poor|unknown"},"crocRisk":"none|low|medium|high","crocDetail":"","structure":"","tactics":{"lure":"","technique":"","depth":"","priority":""},"confidence":0}`;

// ─── Normalise request images ─────────────────────────────────────────────────
// Accepts legacy single imageBase64 OR new images[] array.
function normaliseImages(
  imageBase64?: string,
  images?: Array<{ base64: string; label: string }>,
): Array<{ base64: string; label: string }> {
  if (images && images.length > 0) return images;
  if (typeof imageBase64 === "string" && imageBase64.length > 100) {
    return [{ base64: imageBase64, label: "camera_frame" }];
  }
  return [];
}

// ─── Build message content ────────────────────────────────────────────────────
// Supports zero, one, or multiple images — all sent in a single user message.
function buildContent(
  images: Array<{ base64: string; label: string }>,
  query: string,
  sonarContext: unknown,
): string | Array<{ type: string; [k: string]: unknown }> {
  const hasImages = images.length > 0;
  const hasQuery  = typeof query === "string" && query.trim().length > 0;

  let text = hasImages
    ? `Analyse ${images.length === 1 ? "this camera frame" : `these ${images.length} camera frames`} (${images.map(i => i.label).join(", ")}).`
    : "";
  if (hasQuery) text += (text ? " Also: " : "") + query.trim();

  if (sonarContext && typeof sonarContext === "object") {
    const s = sonarContext as Record<string, unknown>;
    const parts: string[] = [];
    if (s.region)                   parts.push(`region=${s.region}`);
    if (s.species)                  parts.push(`species=${s.species}`);
    if (s.depth)                    parts.push(`depth=${s.depth}`);
    if (s.fishCount !== undefined)  parts.push(`fish=${s.fishCount}`);
    if (s.archCount !== undefined)  parts.push(`arches=${s.archCount}`);
    if (s.barraPct  !== undefined)  parts.push(`barraPct=${s.barraPct}%`);
    if (s.waterTemp)                parts.push(`waterTemp=${s.waterTemp}`);
    if (s.bottomType)               parts.push(`bottom=${s.bottomType}`);
    if (s.waterColour)              parts.push(`waterColour=${s.waterColour}`);
    if (s.waterClarity)             parts.push(`clarity=${s.waterClarity}`);
    if (s.tidePhase)                parts.push(`tide=${s.tidePhase}`);
    if (s.birdAlert)                parts.push(`birdAlert=YES`);
    if (s.crocAlert)                parts.push(`crocAlert=YES`);
    if (s.crocWarning)              parts.push(`crocWarning=${s.crocWarning}`);
    if (s.lure)                     parts.push(`lastLure=${s.lure}`);
    if (s.confidence !== undefined) parts.push(`sonarConfidence=${s.confidence}%`);
    if (s.suggestion)               parts.push(`sonarSuggestion=${s.suggestion}`);
    if (parts.length > 0) text += ` Sonar context: ${parts.join(", ")}.`;
  }

  if (!hasImages) return text || "Analyse fishing conditions.";

  // Build multi-image content array — each image gets a label then its frame
  const content: Array<{ type: string; [k: string]: unknown }> = [];
  for (const img of images) {
    content.push({ type: "text", text: `[Camera: ${img.label}]` });
    content.push({
      type:      "image_url",
      image_url: { url: `data:image/jpeg;base64,${img.base64}`, detail: "low" },
    });
  }
  content.push({ type: "text", text: text || "Analyse fishing conditions from all camera frames." });
  return content;
}

// ─── Visual log (fire-and-forget) ─────────────────────────────────────────────
function logVisualSession(
  sessionId: string,
  sources:   string[],
  imageCount: number,
  sonarContext: unknown,
  brainResult: unknown,
): void {
  db.insert(visualLogs).values({
    sessionId,
    sources:      sources as any,
    imageCount,
    sonarContext: sonarContext as any,
    brainResult:  brainResult  as any,
  }).catch(() => {});
}

// ─── SSE streaming endpoint — first token ~300ms ──────────────────────────────
router.post("/insta360/brain/stream", async (req, res) => {
  const {
    imageBase64, images: rawImages, query = "", sonarContext,
  } = req.body as {
    imageBase64?: string;
    images?:      Array<{ base64: string; label: string }>;
    query?:       string;
    sonarContext?: unknown;
  };

  const images    = normaliseImages(imageBase64, rawImages);
  const sessionId = randomUUID();

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  const t0 = Date.now();
  try {
    const content = buildContent(images, query, sonarContext);
    const stream  = await openai.chat.completions.create({
      model:                 getModel("fast"),
      temperature:           0.4,
      max_completion_tokens: 250,
      stream:                true,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user",   content },
      ],
    }, { signal: AbortSignal.timeout(25_000) });

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

    res.write(`data: ${JSON.stringify({
      done:        true,
      result,
      totalMs:     Date.now() - t0,
      totalTokens: tokenCount,
      model:       getModel("fast"),
      imageCount:  images.length,
    })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();

    logVisualSession(sessionId, images.map(i => i.label), images.length, sonarContext, result);
  } catch (err) {
    console.error("[insta360/brain/stream]", err);
    res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

// ─── Standard JSON endpoint ───────────────────────────────────────────────────
router.post("/insta360/brain", async (req, res) => {
  const {
    imageBase64, images: rawImages, query = "", sonarContext,
  } = req.body as {
    imageBase64?: string;
    images?:      Array<{ base64: string; label: string }>;
    query?:       string;
    sonarContext?: unknown;
  };

  const images   = normaliseImages(imageBase64, rawImages);
  const hasQuery = typeof query === "string" && query.trim().length > 0;

  if (images.length === 0 && !hasQuery) {
    res.status(400).json({ error: "Provide imageBase64, images[], or query" });
    return;
  }

  const t0        = Date.now();
  const sessionId = randomUUID();
  try {
    const content    = buildContent(images, query, sonarContext);
    const completion = await openai.chat.completions.create({
      model:                 getModel("fast"),
      temperature:           0.4,
      max_completion_tokens: 250,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user",   content },
      ],
    }, { signal: AbortSignal.timeout(25_000) });

    const raw     = completion.choices[0]?.message?.content?.trim() ?? "{}";
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");

    let result: Record<string, unknown>;
    try {
      result = JSON.parse(cleaned);
    } catch {
      res.status(500).json({ error: "Invalid JSON from model", raw });
      return;
    }

    res.json({ ...result, _ms: Date.now() - t0, _model: getModel("fast"), _imageCount: images.length });
    logVisualSession(sessionId, images.map(i => i.label), images.length, sonarContext, result);
  } catch (err) {
    console.error("[insta360/brain]", err);
    res.status(500).json({ error: String(err) });
  }
});

// ─── GET /api/visual/log — 50 most recent brain sessions ─────────────────────
router.get("/visual/log", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(visualLogs)
      .orderBy(desc(visualLogs.createdAt))
      .limit(50);

    res.json({
      ok:       true,
      total:    rows.length,
      sessions: rows.map(r => ({
        id:          r.id,
        sessionId:   r.sessionId,
        sources:     r.sources,
        imageCount:  r.imageCount,
        brainResult: r.brainResult,
        createdAt:   r.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
