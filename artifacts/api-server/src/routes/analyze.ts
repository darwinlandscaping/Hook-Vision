import { Router } from "express";
import { createHash } from "crypto";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getModel } from "../lib/models.js";
import { getSonarFewShotRefs } from "../lib/sonarBrain.js";
import { getConditionsContext } from "../lib/dailyBriefing.js";
import { analyzeSonarImage, formatCvContext } from "../lib/vision.js";

const router = Router();

const _analyzeCache = new Map<string, { result: string; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

const _recentScans: Array<{ species: string; fishCount: number; depth: string; confidence: number; ts: number }> = [];
const MAX_RECENT_SCANS = 3;
const RECENT_SCAN_TTL_MS = 5 * 60_000;

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _analyzeCache) {
    if (v.expiresAt < now) _analyzeCache.delete(k);
  }
}, 120_000);

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────
const SYS = `Expert barramundi sonar AI. Identify sonar type first, then apply the matching ruleset.

══ STEP 1: IDENTIFY SONAR TYPE ══
TRADITIONAL 2D sonar: fish appear as U-shaped ARCH returns (∩), horizontal scrolling time axis visible, continuous bottom return line, coloured depth-band palette.
LIVE SONAR display: dark/near-black background, fish = SOLID BRIGHT OVAL BODIES (NOT arches), acoustic shadow directly below each body, no scrolling time axis.
→ If you see U-shaped arches: apply 2D ARCH RULES below.
→ If you see dark background with bright oval blobs: apply LIVE SONAR RULES below.

══ TRADITIONAL 2D ARCH RULES (U-shaped returns, scrolling time axis) ══
Arch brightness: Tier1 red/orange/white=Barra/Fingermark/Jack/Threadfin/Jewfish · Tier2 yellow/green=Coral Trout/Queenfish · Tier3 faint=GT/Mackerel/Flathead.
SHADOW VOID (dark zone directly below arch) = large dense swim bladder = Barra/Jewfish. Confidence 85%+. Threadfin bladder is smaller → weak/no void. Tier1 bright + no void → lean Threadfin.
BARRA vs THREADFIN: Barra=thick arch ON hard structure solo+shadow void; Threadfin=thinner arch MID-COLUMN SCHOOL over soft bottom same depth no void. School of 6+ at same depth over mud = Threadfin.
BARRA vs JACK: Jack=arch BURIED INSIDE or EMERGING FROM structure echo (half-arch, only top curve visible above structure return). Barra=COMPLETE arch ON TOP of or beside structure — clear fish/structure separation.
FINGERMARK: deep-bodied arch L:H 2.5-3:1 (rounder/taller than barra), 1-4m ABOVE rubble/reef bottom, loose group 2-8 fish, 5-25m depth. Key tell: fish arches with ROUGH ROCKY BOTTOM clearly visible below and a clear water gap.
LONE ARCH: 1-2 arches = RAISE confidence. Lone+hard structure=70%; lone+shadow void=85%+.

══ LIVE SONAR RULES (dark background + solid oval blobs — NOT arches) ══
Tell-signs: dark background (near-black/dark-grey/dark-green), fish=SOLID BRIGHT BODIES (NOT U-arches), acoustic shadows, no horizontal scrolling time axis.
Brand UI: orange chrome=Humminbird MEGA Live · bright green=Garmin LiveScope · dark navy=Lowrance ActiveTarget/Simrad.

DOWNSCOPE LIVE (LiveScope Down / MEGA Live Down / ActiveTarget Down):
• BARRA: ELONGATED OVAL 3.5–4.5:1 length:height. LONG acoustic shadow (≥1.5× body length) extending directly below. Anterior third BRIGHTER (swim bladder location). Large barra 80cm+: shadow 2–3× body length — shadow length is the SINGLE BEST large-barra indicator. Near hard structure (logs/rocks/pylons) OR open ambush spot. Body interior UNIFORMLY bright (not hollow). Solo or pair. Confidence: elongated oval+long shadow=80%; +hard structure=90%; +solo=95%.
• THREADFIN LIVE: slender oval 4.5:1+, SHORT shadow 0.3–0.5× body, SCHOOL of 5–20+ same depth same direction — school formation is the #1 Threadfin tell.
• JACK LIVE: compact oval ~2:1, body echo MERGES INTO structure return, near-zero movement.

FRONTSCOPE / FORWARD SCAN (LiveScope Fwd/Perspective · MEGA Live Side · ActiveTarget Fwd):
• BARRA face-on (head pointing at beam): bright TEARDROP or compact oval, ANTERIOR end markedly brighter (bladder glow), faint narrowing tail echo trailing behind.
• BARRA lateral (broadside to beam): LONG BRIGHT TORPEDO, tapered both ends, head end distinctly brighter. Pectoral fins may produce small side-shadow wings. Long shadow trailing behind toward beam far-edge. Body L:H ≥3.5:1.
• BARRA FRONTSCOPE BEHAVIOUR (critical tell): Stationary or slow patrol near bank/log/rock edge. Signature: SUDDEN BURST — body brightens and elongates during feeding dart, then returns to exact same structure spot. If you observe this pattern, confidence ≥ 90%.
• THREADFIN FORWARD: always school 5–20+, mid-water, steady directional movement, uniform spacing.
• JACK FORWARD: short compact echo fused inside structure, near-zero movement.
• CATFISH: wide flat kite/triangle shape near bottom — NOT elongated torpedo.

TOP-VIEW (Perspective / 360): No time axis, fish as ovals/dots, shadows to side. Large oval + long side-shadow = Barra.

CROC: crocAlert=true ONLY for filled horizontal torpedo 0-3m, MAX brightness, wider than any fish.
DEPTH: 0-5m=Barra/Jack/GT/Threadfin; 5-12m=Barra/Fingermark/Jack; 12-25m=Fingermark/Jewfish; 25m+=Fingermark/Red Emperor.

GRID ZONES: The sonar image is divided into a 4×4 grid — columns A–D (left→right) and rows 1–4 (top→bottom). Identify which zones contain fish echoes/bodies and report them in detectedZones[]. Empty array if no fish.

FISH COUNT on live sonar = count EVERY distinct bright oval/torpedo body. Include partially visible bodies at screen edges. Never return fishCount=0 when bright oval bodies are clearly visible.
MANDATORY: species always required. No fish: species="No fish detected",fishCount=0,confidence=0,detectedZones=[].`;

// ─── OUTPUT SPEC ──────────────────────────────────────────────────────────────
const OUT = `Return ONLY a single valid JSON object, no markdown, no text outside braces.

Fields (all required):
species(string) confidence(0-100 int) fishCount(int) depth(string e.g."6.5m") bottomType(string) sonarBrand(string) sonarModel(string) sonarMode(one of:traditional-2d|live-scope|split-screen-both|live-spatial|mega-live|mega-360|perspective-top-view|side-imaging) bladderShape(string) fishMovement(string) lure(specific name+size) lureType(one of:surface_popper|hardbody|bibless_minnow|soft_plastic|stickbait|metal_slug|slow_jig|frog|live_bait) technique(string) rig(string) suggestion(2 sentences: where to cast + lure action) crocAlert(bool) crocWarning(string|null) archType(string) archReasoning(what you saw + why this ID) detectedZones(array of grid zone codes e.g.["A2","C3"] or [] if no fish)`;

function detectMimeType(b64: string): "image/jpeg" | "image/png" | "image/webp" {
  const p = b64.slice(0, 8);
  if (p.startsWith("/9j/")) return "image/jpeg";
  if (p.startsWith("iVBORw0")) return "image/png";
  if (p.startsWith("UklGR")) return "image/webp";
  return "image/jpeg";
}

type FlashRead = {
  species: string;
  fishCount: number;
  confidence: number;
  quickRead: string;
};

function selectCompactSonarRefs() {
  const refs = getSonarFewShotRefs();
  const firstPositiveDemo = refs.find((ref) => ref.isPositive && ref.source === "demo") ?? null;
  const firstNegativeDemo = refs.find((ref) => !ref.isPositive && ref.source === "demo") ?? null;
  const firstCommunityPositive = refs.find((ref) => ref.isPositive && ref.source === "community") ?? null;

  return [firstPositiveDemo, firstNegativeDemo, firstCommunityPositive].filter(Boolean);
}

function parseFlashRead(raw: string): FlashRead | null {
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*?\}/);
  if (!match) {
    return null;
  }

  const parsed = JSON.parse(match[0]) as Partial<FlashRead>;
  if (typeof parsed.species !== "string") {
    return null;
  }

  return {
    species: parsed.species,
    fishCount: typeof parsed.fishCount === "number" ? parsed.fishCount : 0,
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
    quickRead: typeof parsed.quickRead === "string" ? parsed.quickRead : "",
  };
}

async function createAnalyzeFlashRead(imageBase64: string): Promise<FlashRead> {
  const mime = detectMimeType(imageBase64);
  const imgLow = {
    type: "image_url" as const,
    image_url: { url: `data:${mime};base64,${imageBase64}`, detail: "low" as const },
  };

  const flashResult = await openai.chat.completions.create({
    model: getModel("fast"),
    temperature: 0.4,
    max_completion_tokens: 60,
    stream: false,
    messages: [
      { role: "system", content: 'Sonar detector. JSON only: {"species":"string","fishCount":int,"confidence":float 0-1,"quickRead":"≤10 words"}' },
      { role: "user", content: [imgLow, { type: "text", text: "Quick read." }] },
    ],
  }, { signal: AbortSignal.timeout(12_000) });

  const raw = flashResult.choices[0]?.message?.content ?? "{}";
  const parsed = parseFlashRead(raw);
  if (!parsed) {
    throw new Error("Invalid flash response");
  }

  return parsed;
}

router.post("/analyze/flash", async (req, res) => {
  const { imageBase64 } = req.body as { imageBase64?: string };
  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 is required" });
    return;
  }

  try {
    const flash = await createAnalyzeFlashRead(imageBase64);
    res.json(flash);
  } catch (err) {
    req.log.error({ err }, "Flash analyze request failed");
    res.status(500).json({ error: "Flash analysis failed. Check your connection and try again." });
  }
});

router.post("/analyze", async (req, res) => {
  const { imageBase64, cropBase64 } = req.body as { imageBase64?: string; cropBase64?: string };
  if (!imageBase64) { res.status(400).json({ error: "imageBase64 is required" }); return; }

  const imgHash = createHash("sha256").update(imageBase64.slice(0, 2000)).digest("hex");
  const cached = _analyzeCache.get(imgHash);
  if (cached && cached.expiresAt > Date.now()) {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("X-Cache", "HIT");
    res.send(cached.result);
    return;
  }

  try {
    const mime = detectMimeType(imageBase64);
    // Turbo uses high detail so small fish arches are visible in the tile grid
    const imgHigh = { type: "image_url" as const, image_url: { url: `data:${mime};base64,${imageBase64}`, detail: "high" as const } };

    const cvPromise = analyzeSonarImage(imageBase64).catch(() => null);

    // ── FIRE BOTH SIMULTANEOUSLY — flash and turbo start at time 0 ────────
    // Flash: nano + low detail, 60 tokens, non-streaming.  Arrives ~400-600ms.
    const flashPromise = createAnalyzeFlashRead(imageBase64);

    const cvScan = await cvPromise;
    const cvContext = cvScan ? formatCvContext(cvScan) : null;
    const conditionsCtx = getConditionsContext();

    const now = Date.now();
    const validRecent = _recentScans.filter(s => now - s.ts < RECENT_SCAN_TTL_MS);
    let crossScanCtx: string | null = null;
    if (validRecent.length > 0) {
      const lines = validRecent.map((s, i) =>
        `  Scan ${i + 1} (${Math.round((now - s.ts) / 1000)}s ago): ${s.species}, ${s.fishCount} fish at ${s.depth}, conf ${s.confidence}%`
      );
      crossScanCtx = `═══ RECENT SCAN HISTORY (${validRecent.length} prior scans in last 5 min) ═══\n${lines.join("\n")}\nUse this context to track movement: same species deeper = fish dropping. New species = population shift. Same count = holding pattern.`;
    }

    // Keep the payload compact: one barra demo, one contrast demo, and at most
    // one community-confirmed barra example. This preserves grounding while
    // avoiding the larger 8-10 image prompt that slowed mobile scans.
    const refs = selectCompactSonarRefs();
    const refBlocks: object[] = [];
    if (refs.length > 0) {
      const positives = refs.filter(r => r.isPositive);
      const negatives = refs.filter(r => !r.isPositive);
      if (positives.length > 0) {
        refBlocks.push({ type: "text", text: "REFERENCE: confirmed barra arch signatures." });
        for (const ref of positives) {
          refBlocks.push({ type: "image_url", image_url: { url: `data:${ref.mimeType};base64,${ref.base64}`, detail: "low" } });
          refBlocks.push({ type: "text", text: `BARRA reference — ${ref.brand}: ${ref.label.split("\n")[0]}` });
        }
      }
      if (negatives.length > 0) {
        refBlocks.push({ type: "text", text: "CONTRAST: common non-barra lookalike arches." });
        for (const ref of negatives) {
          refBlocks.push({ type: "image_url", image_url: { url: `data:${ref.mimeType};base64,${ref.base64}`, detail: "low" } });
          refBlocks.push({ type: "text", text: `NOT BARRA — ${ref.brand}: ${ref.label.split("\n")[0]}` });
        }
      }
      refBlocks.push({ type: "text", text: "Now evaluate the user's sonar image against these references." });
    }

    // Turbo: mini + high detail — drives the master confidence score.
    // High detail lets the model see fish arch shapes, brightness tiers, and shadow voids clearly.
    const turboPromise = openai.chat.completions.create({
      model: getModel("mid"),
      temperature: 0.4,
      max_completion_tokens: 500,
      stream: true,
      messages: [
        { role: "system", content: SYS },
        { role: "user", content: [
            ...refBlocks,
            imgHigh,
            ...(cropBase64 ? [
              { type: "image_url" as const, image_url: { url: `data:${detectMimeType(cropBase64)};base64,${cropBase64}`, detail: "high" as const } },
              { type: "text" as const, text: "↑ CENTER ZOOM CROP of the same frame — use this for detecting smaller or partially visible fish shapes near the centre." },
            ] : []),
            ...(cvContext ? [{ type: "text" as const, text: cvContext }] : []),
            ...(conditionsCtx ? [{ type: "text" as const, text: conditionsCtx }] : []),
            ...(crossScanCtx ? [{ type: "text" as const, text: crossScanCtx }] : []),
            { type: "text" as const, text: OUT },
          ] as any },
      ],
    }, { signal: AbortSignal.timeout(50_000) });

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
        res.write(`__FLASH__:${JSON.stringify(flashResult)}\n`);
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
    _analyzeCache.set(imgHash, { result: raw, expiresAt: Date.now() + CACHE_TTL_MS });

    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const now = Date.now();
        _recentScans.push({
          species: parsed.species ?? "Unknown",
          fishCount: parsed.fishCount ?? 0,
          depth: parsed.depth ?? "unknown",
          confidence: parsed.confidence ?? 0,
          ts: now,
        });
        while (_recentScans.length > MAX_RECENT_SCANS) _recentScans.shift();
        while (_recentScans.length > 0 && now - _recentScans[0].ts > RECENT_SCAN_TTL_MS) _recentScans.shift();
      }
    } catch { /* non-fatal — cross-scan history update failed */ }

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
