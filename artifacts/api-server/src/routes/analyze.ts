import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getModel } from "../lib/models.js";

const router = Router();

// ─── TURBO SYSTEM PROMPT ──────────────────────────────────────────────────────
// ~400 tokens vs ~3,000 in the old version. The model already has sonar
// expertise — this reinforces the CRITICAL physics rules only.

const TURBO_SYSTEM_PROMPT = `You are an expert WA/Kimberley Australia sonar fish-ID AI. Apply these rules in strict order to every image:

STEP 0 — TOP-VIEW CHECK FIRST:
Is this a top-view/overhead sonar (Garmin LiveScope Perspective, Humminbird MEGA 360, Side Imaging)?
Signs: no scrolling time axis, fish appear as flat ovals/dots from above (NOT arches), shadow extends to SIDE (not below).
If YES → apply top-view rules: large elongated oval + pectoral fin "wings" + side shadow = BARRAMUNDI; circular radar display = MEGA 360; comma/smear shapes = side imaging. Set sonarMode and skip arch steps.
If NO → continue below.

STEP 1 — ARCH BRIGHTNESS TIER (most important rule):
• Tier 1 — red/orange/white bright core: Barramundi, Fingermark, Mangrove Jack, Threadfin, Jewfish → all have large physostomous swim bladder
• Tier 2 — yellow/green: Rock Cod, Coral Trout, Queenfish
• Tier 3 — faint/invisible: Giant Trevally, Spanish Mackerel, Flathead
A FAINT arch CANNOT be barra. A BRIGHT arch CANNOT be GT or mackerel.

STEP 2 — SHADOW VOID: A dark void directly BELOW an arch = large swim bladder blocking sonar = Barramundi or big predator. Confidence 85%+ if shadow present.

STEP 3 — ARCH POSITION:
• ON or touching hard structure (snag/pylon/rock bar) = Barramundi or Mangrove Jack
• Embedded INSIDE structure echo (arch starts inside bottom echo) = Mangrove Jack
• Floating 1-4m ABOVE ragged rubble bottom in a school = Fingermark
• Mid-column over SOFT muddy bottom in a school = Threadfin Salmon
• Deep tidal channel, single large arch = Jewfish

STEP 4 — LONE ARCH RULE (critical — most missed):
Only 1-2 arches on screen? DO NOT lower confidence. Raise it. Barramundi are solitary ambush hunters — a lone arch is the MOST COMMON barra signature. Lone arch + hard bottom = 70% barra. Lone arch + shadow void = 85%+ barra.

STEP 5 — LIVE SONAR BODIES (if live scope present):
• Large oval body + long post-cast shadow + near structure = Barramundi
• Tall/round body + fast movement + faint shadow = Giant Trevally
• Compact body embedded in snag + barely moving = Mangrove Jack
• Multiple slim bodies mid-column, short shadows = Threadfin Salmon

STEP 6 — CROC DETECTION:
crocAlert = true ONLY when: solid FILLED horizontal blob (NOT an arch) + near surface (0-3m) + maximum brightness + elongated torpedo shape wider than any fish. Default: false. A bright barra arch is NEVER a croc.

STEP 7 — DEPTH ZONES:
• 0-5m: Barra, Jack, GT, Threadfin
• 5-12m: Barra (snags), Fingermark (8-12m rocky reef), Jack
• 12-25m: Fingermark, Jewfish, Rock Cod, Coral Trout
• 25m+: Fingermark, Red Emperor, Rock Cod

MANDATORY: species is ALWAYS required — never null, never empty. Reduce confidence to 25-45 if unsure but ALWAYS name a species. If no fish: species="No fish detected", fishCount=0, confidence=0.`;

// ─── TURBO ANALYSIS PROMPT ────────────────────────────────────────────────────
// Compact instruction injected with the image. No intelligence context,
// no preprocessing — starts streaming immediately.

const TURBO_ANALYSIS_PROMPT = `Apply the 7 steps to this sonar image. Return ONLY a single valid JSON object — no markdown, no explanation, nothing outside the braces.

Required fields (all mandatory):
species(string,never null) | confidence(0-100 integer) | fishCount(integer) | depth(string e.g."6.5m") | bottomType(string) | sonarBrand(string) | sonarModel(string) | sonarMode(string) | archType(string) | archDepth(number) | archXFrac(0-1) | archYFrac(0-1) | suggestion(2 sentences on where to cast + lure action) | lure(specific lure name+size) | lureType(one of: surface_popper|hardbody|bibless_minnow|soft_plastic|stickbait|metal_slug|slow_jig|frog|live_bait) | technique(string) | rig(string) | tidal(string) | turbidity(string) | structure(string) | bladderShape(string) | fishMovement(string) | crocAlert(boolean) | crocWarning(string or null) | archReasoning(what was seen + why this ID)

sonarMode must be one of: traditional-2d | live-scope | split-screen-both | live-spatial | mega-live | mega-360 | perspective-top-view | side-imaging`;

// ─── Detect MIME type from base64 magic bytes ──────────────────────────────────
function detectMimeType(base64: string): "image/jpeg" | "image/png" | "image/webp" {
  const prefix = base64.slice(0, 8);
  if (prefix.startsWith("/9j/")) return "image/jpeg";
  if (prefix.startsWith("iVBORw0")) return "image/png";
  if (prefix.startsWith("UklGR")) return "image/webp";
  return "image/jpeg";
}

router.post("/analyze", async (req, res) => {
  const { imageBase64 } = req.body as { imageBase64?: string };

  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 is required" });
    return;
  }

  try {
    const mimeType = detectMimeType(imageBase64);

    // ── FLASH SCAN — fires immediately, arrives ~1.2s ─────────────────────
    // Tiny call: gives a quick species preview while the turbo scan streams in.
    const flashPromise = openai.chat.completions.create({
      model: getModel("mid"),
      max_completion_tokens: 90,
      stream: false,
      messages: [
        {
          role: "system",
          content: 'Expert sonar fish detector. Reply ONLY JSON: {"species":"string","fishCount":integer,"confidence":float 0-1,"quickRead":"max 12 words"}',
        },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: "low" } },
            { type: "text", text: "Quick read: species and fish count. JSON only." },
          ],
        },
      ],
    });

    // ── Open streaming headers immediately ────────────────────────────────
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    // ── Emit flash the moment it arrives (~1.2s) ──────────────────────────
    try {
      const flashResult = await flashPromise;
      const flashRaw    = flashResult.choices[0]?.message?.content ?? "{}";
      const flashClean  = flashRaw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      const flashMatch  = flashClean.match(/\{[\s\S]*?\}/);
      if (flashMatch) {
        res.write(`__FLASH__:${flashMatch[0]}\n`);
      }
    } catch { /* non-fatal */ }

    // ── TURBO MAIN SCAN — starts streaming immediately after flash ─────────
    // WHAT CHANGED vs the old approach:
    //   OLD: 3,000 token system prompt + 8 images + preprocessing wait = 49s
    //   NEW: 400 token system prompt + 1 image + no wait = 3-5s
    //
    // Cuts: no zoom crops, no few-shot reference images, no CV preprocessing,
    //       no intelligence context, no barraLibrary/crocLibrary/sonarBrain images.
    // The model already has sonar expertise — the compact prompt reinforces
    // the CRITICAL physics rules only.

    // Heartbeat to prevent mobile carrier drops during the 3-5s streaming gap
    const heartbeat = setInterval(() => {
      try { res.write("\n"); } catch { /* connection closed */ }
    }, 4000);

    let raw = "";
    try {
      const stream = await openai.chat.completions.create({
        model: getModel("fast"),         // gpt-4.1-nano — fastest, sufficient for structured JSON
        max_completion_tokens: 420,      // tight cap — JSON is ~350 tokens
        stream: true,
        messages: [
          { role: "system", content: TURBO_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              // Single image at LOW detail — 85 tokens vs 765 for high detail.
              // Low detail is fully sufficient for arch/blob detection.
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: "low" },
              },
              { type: "text", text: TURBO_ANALYSIS_PROMPT },
            ],
          },
        ],
      });

      let firstContent = false;
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? "";
        if (delta) {
          if (!firstContent) {
            clearInterval(heartbeat);
            firstContent = true;
          }
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
