import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getModel } from "../lib/models.js";
import { getSonarFewShotRefs } from "../lib/sonarBrain.js";

const router = Router();

// ─── SYSTEM PROMPT (~200 tokens) ─────────────────────────────────────────────
const SYS = `Expert sonar fish-ID AI. Rules in strict order:

TOP-VIEW: No time axis, fish as ovals/dots, shadow to side → top-view mode. Large oval+wings+side-shadow=Barra. Skip arch steps.

ARCH BRIGHTNESS:
• Tier1 red/orange/white = Barra, Fingermark, Jack, Threadfin, Jewfish (big swim bladder)
• Tier2 yellow/green = Coral Trout, Queenfish
• Tier3 faint = GT, Mackerel, Flathead
Faint arch ≠ barra. Bright arch ≠ GT/mackerel.

SHADOW VOID: Dark void directly BELOW arch = large dense swim bladder = Barra/Jewfish/big predator. Confidence 85%+.
• Threadfin have a physostomous bladder but it is SMALLER → weak or NO shadow void. If arches are Tier1 bright but shadow void is absent, lean Threadfin not Barra.

BARRA vs THREADFIN SALMON — critical separation (they co-habit and feed together):
• BARRA: Thick arch, ON or within 1m of hard structure (snag/rock/pylon), SOLO or 2-3 max, strong shadow void below, stationary/slow.
• THREADFIN: Thinner arch, MID-COLUMN floating over SOFT BOTTOM (mud/sand/tidal flat), SCHOOL of 5-30+ arches all at SAME DEPTH, weak/no shadow void, all drifting same direction.
• Same depth band (2-8m) so depth alone cannot separate them — use structure attachment + school count + shadow void.
• SAME-DEPTH HORIZONTAL BAND of multiple arches = schooling species (Threadfin, not Barra aggregation).
• 6 arches mid-column over mud = Threadfin school. 6 arches ON structure with shadow voids = Barra aggregation.

MANGROVE JACK (Lutjanus argentimaculatus) — critical separation from Barra:
• JACK: Arch is BURIED INSIDE or EMERGING FROM the structure echo — the bottom half of the arch merges with the structure/bottom return. Often only the TOP CURVE of the arch is visible above the structure echo.
• BARRA vs JACK: Both are Tier 1 bright, both tight to hard structure. The ONLY reliable separator is arch position within the structure echo.
  - Barra: COMPLETE full arch sitting ON TOP of or beside the structure echo. Clear separation between fish and structure.
  - Jack: HALF-ARCH or PARTIAL arch — the arch begins inside the structure echo and only the top portion protrudes. Fish is literally inside the snag/crevice/overhang.
• Jack body plan: Stocky, compact (L:H ~2:1) — almost square compared to Barra's elongated shape.
• Jack habitat: Mangrove root snags, submerged timber, bridge pylons, rock overhangs, undercut banks.
• Movement: Near-zero — true ambush predator. If the arch position in the structure echo is completely static across multiple sonar sweeps = Jack.
• Count: Solo or 2-3 fish max, always within one piece of structure (not spread out).
• Depth: 0-12m, most common 2-8m — same depth band as Barra, so depth cannot separate them.
• Shadow void: Often absent or obscured because the surrounding structure echo swallows it.

FINGERMARK (Lutjanus johnii — Golden Snapper) — critical separation:
• FINGERMARK: Deep-bodied arch (L:H ~2.5-3:1, rounder/taller than barra's elongated arch), hovering 1-4m ABOVE rubble/rock/reef bottom, LOOSE GROUP of 2-8 fish, moderate shadow void, deeper water 5-25m.
• KEY TELL: Fish arches floating in mid-lower column with ROUGH RUBBLE/ROCKY BOTTOM ECHO clearly visible below them. Gap between fish and bottom = fingermark hover zone.
• BARRA vs FINGERMARK: Barra ON structure (touching); Fingermark ABOVE it with clear water gap. Barra = snags/pylons; Fingermark = rubble/reef patches.
• DEPTH CLUE: 5-12m over rubble = Fingermark likely. 12-25m deep reef = strongly Fingermark/Jewfish. Under 5m on snag = strongly Barra.
• Fingermark arch is DEEP-BODIED (shorter/rounder shape) vs Barra's elongated arch — reflects their snapper body plan.
• Shadow void: PRESENT but smaller than Barra (physostomous bladder, smaller fish).

ARCH POSITION:
• ON hard structure (snag/pylon), complete full arch, solo + shadow void = Barra (85%+)
• ON hard structure, complete full arch, solo, no void = Barra (70%)
• HALF-ARCH or arch STARTING INSIDE structure echo = Mangrove Jack
• 1-4m ABOVE rubble/reef, loose group 2-8, 5-25m depth = Fingermark
• Mid-column, school 5-30+, same depth, soft bottom = Threadfin Salmon
• Deep tidal channel, lone, 15m+ = Jewfish

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
    // Flash uses low detail (fast, cheap — just a quick read)
    const imgLow  = { type: "image_url" as const, image_url: { url: `data:${mime};base64,${imageBase64}`, detail: "low"  as const } };
    // Turbo uses high detail so small fish arches are visible in the tile grid
    const imgHigh = { type: "image_url" as const, image_url: { url: `data:${mime};base64,${imageBase64}`, detail: "high" as const } };

    // ── FIRE BOTH SIMULTANEOUSLY — flash and turbo start at time 0 ────────
    // Flash: nano + low detail, 60 tokens, non-streaming.  Arrives ~400-600ms.
    const flashPromise = openai.chat.completions.create({
      model: getModel("fast"),
      max_completion_tokens: 60,
      stream: false,
      messages: [
        { role: "system", content: 'Sonar detector. JSON only: {"species":"string","fishCount":int,"confidence":float 0-1,"quickRead":"≤10 words"}' },
        { role: "user", content: [imgLow, { type: "text", text: "Quick read." }] },
      ],
    });

    // Build few-shot reference blocks — inject confirmed reference images before user's sonar image
    // so the model has visual examples of barra (positive), jack (negative), threadfin (negative) etc.
    // This is the most critical fix for Barra vs Jack confusion — previously ZERO references were sent.
    const refs = getSonarFewShotRefs();
    const refBlocks: object[] = [];
    if (refs.length > 0) {
      const positives = refs.filter(r => r.isPositive);
      const negatives = refs.filter(r => !r.isPositive);
      if (positives.length > 0) {
        refBlocks.push({ type: "text", text: `REFERENCE IMAGES — CONFIRMED SPECIES (${positives.length} images). Study these FIRST before evaluating the user's sonar:` });
        for (const ref of positives) {
          refBlocks.push({ type: "image_url", image_url: { url: `data:${ref.mimeType};base64,${ref.base64}`, detail: "low" } });
          refBlocks.push({ type: "text", text: `↑ POSITIVE: ${ref.brand} — ${ref.label.split("\n")[0]}` });
        }
      }
      if (negatives.length > 0) {
        refBlocks.push({ type: "text", text: `CONTRAST REFERENCES — NOT BARRAMUNDI (${negatives.length} images — study what these look like so you do NOT misidentify them):` });
        for (const ref of negatives) {
          refBlocks.push({ type: "image_url", image_url: { url: `data:${ref.mimeType};base64,${ref.base64}`, detail: "low" } });
          refBlocks.push({ type: "text", text: `↑ NEGATIVE (${ref.label.split("—")[1]?.trim().split(" ")[0] ?? "Not barra"}): ${ref.brand} — ${ref.label.split("\n")[0]}` });
        }
      }
      refBlocks.push({ type: "text", text: "NOW EVALUATE THE USER'S SONAR IMAGE below. Compare arch shape (complete vs half-arch), position (on structure vs mid-column vs buried in structure), shadow voids, and arch thickness against the references above." });
    }

    // Turbo: mini + high detail — drives the master confidence score.
    // High detail lets the model see fish arch shapes, brightness tiers, and shadow voids clearly.
    const turboPromise = openai.chat.completions.create({
      model: getModel("mid"),
      max_completion_tokens: 600,
      stream: true,
      messages: [
        { role: "system", content: SYS },
        { role: "user", content: [...refBlocks, imgHigh, { type: "text", text: OUT }] as any },
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
