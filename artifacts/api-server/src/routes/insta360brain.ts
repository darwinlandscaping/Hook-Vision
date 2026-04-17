/**
 * POST /api/insta360/brain
 * POST /api/insta360/brain/stream  (SSE — fastest mode)
 *
 * Insta360 Brain — 360° fishing intelligence at maximum speed.
 * Uses gpt-4.1-mini (fastest vision model) + detail:low + streaming SSE.
 * Parallel ref loading. Compact prompt. 500-token cap.
 */
import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getBirdFewShotRefs } from "../lib/birdLibrary.js";
import { getCrocFewShotRefs } from "../lib/crocLibrary.js";

const router = Router();

// ─── Compact system prompt (fewer tokens = faster processing) ─────────────────
const SYSTEM = `You are HookVision Brain — elite WA/Kimberley fishing AI, 30+ years Broome/Ord/Fitzroy/Cambridge Gulf experience.

Analyse the 360° boat frame and respond ONLY with this exact JSON:
{
  "summary": "one punchy sentence",
  "activityLevel": "none"|"low"|"medium"|"high",
  "castZone": "left"|"centre"|"right"|"all"|"none",
  "birds": {"detected":bool,"species":["name"],"urgency":"none"|"low"|"high","description":"what doing"},
  "surface": {"bustUp":bool,"baitBall":bool,"description":"surface activity"},
  "water": {"colour":"green"|"brown"|"tannin"|"blue"|"murky"|"clear","conditions":"calm"|"choppy"|"rip"|"glassy","visibility":"good"|"poor"|"unknown"},
  "crocRisk": "none"|"low"|"medium"|"high",
  "crocDetail": "croc signs or empty",
  "structure": "visible structure / features",
  "tactics": {"lure":"specific lure","technique":"how to fish","depth":"depth range","priority":"do THIS now"},
  "weatherRead": "conditions read",
  "confidence": 0-100,
  "birdRefCount": 0,
  "crocRefCount": 0,
  "textAnswer": ""
}

Look for: bait birds diving (ospreys/terns/frigatebirds) = fish below; surface busts; croc eyes/snout/wake; water colour; structure. JSON only — no markdown fences.`;

// ─── Shared content builder ───────────────────────────────────────────────────
async function buildContent(
  imageBase64: string | undefined,
  query: string,
  sonarContext: any,
): Promise<{ content: any[]; birdCount: number; crocCount: number }> {

  // Parallel ref loading — 1 each (speed: fewer image tokens)
  const [birdRefs, crocRefs] = await Promise.all([
    getBirdFewShotRefs(1),
    getCrocFewShotRefs(1),
  ]);

  const content: any[] = [];
  const hasImage = typeof imageBase64 === "string" && imageBase64.length > 100;
  const hasQuery = typeof query === "string" && query.trim().length > 0;

  // Main frame — detail:low = 85 flat tokens (vs 1000+ for detail:high)
  if (hasImage) {
    content.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "low" },
    });
  }

  // Text prompt
  let textPrompt = hasImage
    ? "Analyse this 360° fishing frame. Give max speed JSON."
    : `Text query: ${query.trim()}`;
  if (hasQuery && hasImage) textPrompt += `\nAlso: ${query.trim()}`;
  if (sonarContext) {
    textPrompt += `\nSonar context: depth=${sonarContext.depth ?? "?"}, fish=${sonarContext.fishCount ?? 0}, crocAlert=${sonarContext.crocAlert ? "YES" : "no"}.`;
  }

  // 1 bird ref (low detail)
  if (birdRefs[0]?.thumbBase64) {
    textPrompt += "\nBird ref (iNaturalist):";
    content.push({ type: "text", text: textPrompt });
    content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${birdRefs[0].thumbBase64}`, detail: "low" } });
    content.push({ type: "text", text: `Bird: ${birdRefs[0].species ?? "WA water bird"}` });
  } else {
    content.push({ type: "text", text: textPrompt });
  }

  // 1 croc ref (low detail)
  if (crocRefs[0]?.thumbBase64) {
    content.push({ type: "text", text: "Croc ref (iNaturalist):" });
    content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${crocRefs[0].thumbBase64}`, detail: "low" } });
    content.push({ type: "text", text: `Croc: ${crocRefs[0].species ?? "Crocodylus porosus"}` });
  }

  return {
    content: hasImage ? content : (hasQuery ? query.trim() : "Analyse conditions."),
    birdCount: birdRefs.length,
    crocCount: crocRefs.length,
  };
}

// ─── SSE streaming endpoint (fastest — first token ~400ms) ───────────────────
router.post("/insta360/brain/stream", async (req, res) => {
  const { imageBase64, query = "", sonarContext } = req.body as {
    imageBase64?: string;
    query?: string;
    sonarContext?: { species?: string; fishCount?: number; depth?: string; crocAlert?: boolean };
  };

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  try {
    const { content } = await buildContent(imageBase64, query, sonarContext);
    const t0 = Date.now();

    const stream = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      max_tokens: 500,
      temperature: 0.2,
      stream: true,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content },
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

    // Parse and send final structured result
    const cleaned = full.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
    let result: any = {};
    try { result = JSON.parse(cleaned); } catch { result = { summary: full.slice(0, 120), confidence: 50 }; }

    res.write(`data: ${JSON.stringify({ done: true, result, totalMs: Date.now() - t0, totalTokens: tokenCount })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("[insta360/brain/stream]", err);
    res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

// ─── Standard JSON endpoint (kept for compatibility) ─────────────────────────
router.post("/insta360/brain", async (req, res) => {
  const { imageBase64, query = "", sonarContext } = req.body as {
    imageBase64?: string;
    query?: string;
    sonarContext?: { species?: string; fishCount?: number; depth?: string; crocAlert?: boolean };
  };

  const hasImage = typeof imageBase64 === "string" && imageBase64.length > 100;
  const hasQuery = typeof query === "string" && query.trim().length > 0;

  if (!hasImage && !hasQuery) {
    res.status(400).json({ error: "Provide imageBase64 or query" });
    return;
  }

  try {
    const t0 = Date.now();
    const { content, birdCount, crocCount } = await buildContent(imageBase64, query, sonarContext);

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      max_tokens: 500,
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");

    let result: any;
    try {
      result = JSON.parse(cleaned);
    } catch {
      res.status(500).json({ error: "Invalid JSON from model", raw });
      return;
    }

    res.json({
      ...result,
      birdRefCount: result.birdRefCount ?? birdCount,
      crocRefCount: result.crocRefCount ?? crocCount,
      _ms: Date.now() - t0,
    });
  } catch (err) {
    console.error("[insta360/brain]", err);
    res.status(500).json({ error: String(err) });
  }
});

export default router;
