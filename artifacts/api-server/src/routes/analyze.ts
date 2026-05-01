import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getModel } from "../lib/models.js";

const router = Router();

// ─── SYSTEM PROMPT (~200 tokens) ─────────────────────────────────────────────
const SYS = `Expert sonar fish-ID AI. Rules in strict order:

TOP-VIEW: No time axis, fish as ovals/dots, shadow to side → top-view mode. Large oval+wings+side-shadow=Barra. Skip arch steps.

ARCH BRIGHTNESS:
• Tier1 red/orange/white = Barra, Fingermark, Jack, Threadfin, Jewfish (big swim bladder)
• Tier2 yellow/green = Coral Trout, Queenfish
• Tier3 faint = GT, Mackerel, Flathead
Faint arch ≠ barra. Bright arch ≠ GT/mackerel.

SHADOW VOID: Dark void directly BELOW arch = large bladder = Barra/big predator. Confidence 85%+.

ARCH POSITION:
• ON hard structure = Barra or Jack
• INSIDE structure echo = Jack
• 1-4m above rubble, school = Fingermark
• Mid-column soft bottom school = Threadfin
• Deep tidal channel lone = Jewfish

LONE ARCH: 1-2 arches = RAISE confidence. Barra are solitary. Lone+hard bottom=70%, lone+shadow=85%+.

CROC: crocAlert=true ONLY if filled horizontal torpedo blob 0-3m, max brightness, wider than any fish. Never confuse bright barra arch for croc.

DEPTH: 0-5m=Barra/Jack/GT/Threadfin; 5-12m=Barra/Fingermark/Jack; 12-25m=Fingermark/Jewfish; 25m+=Fingermark/Red Emperor.

MANDATORY: species always required. If no fish: species="No fish detected",fishCount=0,confidence=0.`;

// ─── OUTPUT SPEC (~160 tokens — only fields the app reads) ────────────────
const OUT = `Return ONLY a single valid JSON object, no markdown, nothing outside braces.

Fields (all required):
species(string) confidence(0-100 int) fishCount(int) depth(string e.g."6.5m") bottomType(string) sonarBrand(string) sonarModel(string) sonarMode(one of:traditional-2d|live-scope|split-screen-both|live-spatial|mega-live|mega-360|perspective-top-view|side-imaging) bladderShape(string) fishMovement(string) lure(specific name+size) lureType(one of:surface_popper|hardbody|bibless_minnow|soft_plastic|stickbait|metal_slug|slow_jig|frog|live_bait) technique(string) rig(string) suggestion(2 sentences: where to cast + lure action) crocAlert(bool) crocWarning(string|null) archType(string) archReasoning(what you saw + why this ID)`;

function detectMimeType(b64: string): "image/jpeg" | "image/png" | "image/webp" {
  const p = b64.slice(0, 8);
  if (p.startsWith("/9j/")) return "image/jpeg";
  if (p.startsWith("iVBORw0")) return "image/png";
  if (p.startsWith("UklGR")) return "image/webp";
  return "image/jpeg";
}

router.post("/analyze", async (req, res) => {
  const { imageBase64 } = req.body as { imageBase64?: string };
  if (!imageBase64) { res.status(400).json({ error: "imageBase64 is required" }); return; }

  try {
    const mime = detectMimeType(imageBase64);
    const imgMsg = { type: "image_url" as const, image_url: { url: `data:${mime};base64,${imageBase64}`, detail: "low" as const } };

    // ── FIRE BOTH SIMULTANEOUSLY — flash and turbo start at time 0 ────────
    // Flash: nano, 60 tokens, non-streaming.  Arrives ~400-600ms.
    const flashPromise = openai.chat.completions.create({
      model: getModel("fast"),
      max_completion_tokens: 60,
      stream: false,
      messages: [
        { role: "system", content: 'Sonar detector. JSON only: {"species":"string","fishCount":int,"confidence":float 0-1,"quickRead":"≤10 words"}' },
        { role: "user", content: [imgMsg, { type: "text", text: "Quick read." }] },
      ],
    });

    // Turbo: nano, streaming, starts opening connection immediately.
    // Promise resolves when the stream connection is established (before first token).
    const turboPromise = openai.chat.completions.create({
      model: getModel("fast"),
      max_completion_tokens: 520,
      stream: true,
      messages: [
        { role: "system", content: SYS },
        { role: "user", content: [imgMsg, { type: "text", text: OUT }] },
      ],
    });

    // ── Wait for both to be ready (flash done + stream connection open) ────
    // This guarantees flash is written BEFORE any turbo content.
    // Typical wait: max(flash_latency, stream_connect_latency) ≈ 600-900ms.
    const [flashResult, stream] = await Promise.all([
      flashPromise.catch(() => null),   // flash failure is non-fatal
      turboPromise,                     // turbo failure IS fatal
    ]);

    // ── Open streaming headers ────────────────────────────────────────────
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    // ── Write flash line first (always before any turbo content) ─────────
    if (flashResult) {
      try {
        const raw = flashResult.choices[0]?.message?.content ?? "{}";
        const clean = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
        const m = clean.match(/\{[\s\S]*?\}/);
        if (m) res.write(`__FLASH__:${m[0]}\n`);
      } catch { /* non-fatal */ }
    }

    // ── Stream turbo result to client ─────────────────────────────────────
    let raw = "";
    const heartbeat = setInterval(() => { try { res.write("\n"); } catch { /* closed */ } }, 3000);
    try {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? "";
        if (delta) {
          if (raw === "") clearInterval(heartbeat);
          raw += delta;
          res.write(delta);
        }
      }
    } finally {
      clearInterval(heartbeat);
    }

    res.end();
    req.log.info({ chars: raw.length }, "Turbo analysis complete");
  } catch (err) {
    req.log.error({ err }, "OpenAI analyze request failed");
    if (res.headersSent) {
      try { res.write("\n__ERROR__:Analysis failed. Check your connection and try again."); } catch { /* ignore */ }
      res.end();
    } else {
      res.status(500).json({ error: "Analysis failed. Check your connection and try again." });
    }
  }
});

export default router;
