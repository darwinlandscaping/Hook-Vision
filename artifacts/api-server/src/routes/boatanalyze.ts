import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getModel } from "../lib/models.js";
import { getLiveSonarDemoRefs } from "../lib/liveSonarBrain.js";
import {
  MODE_IDENTIFICATION,
  VISUAL_APPEARANCE,
  MOVEMENT_GUIDE,
  CROC_GUIDE,
  SPECIES_QUICK_REF,
} from "../lib/liveSonarKnowledge.js";

const router = Router();

// Structural content-part types compatible with the OpenAI SDK (matches liveanalyze.ts pattern)
type ImagePart = { type: "image_url"; image_url: { url: string; detail: "high" | "low" } };
type TextPart  = { type: "text"; text: string };
type ContentPart = ImagePart | TextPart;

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
    const content: ContentPart[] = [
      { type: "image_url", image_url: { url: `data:${mime};base64,${imageBase64}`, detail: "low" } },
      { type: "text", text: `Analyse sonar for fish arches. JSON: ${SINGLE_OUT}` },
    ];

    const completion = await openai.chat.completions.create({
      model: getModel("fast"),
      temperature: 0.4,
      max_completion_tokens: 160,
      stream: false,
      messages: [
        { role: "system", content: SINGLE_SYS },
        { role: "user", content },
      ],
    }, { signal: AbortSignal.timeout(20_000) });

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

// ── Multi-frame fish movement analysis ───────────────────────────────────────
// CYCLE_SYS is built from the shared liveSonarKnowledge module so that
// mode-specific interpretation, croc detection, species identification, and
// visual appearance guidance are all consistent with the single-frame route.

const CYCLE_SYS = [
  `You are analysing sequential sonar frames from a fishing boat in tropical Australia (oldest frame first, newest last).`,
  `You are an expert sonar reader fluent in BOTH traditional 2D arch-based sonar AND live sonar (blob-based) displays.`,
  ``,
  `══ STEP 1 — IDENTIFY SONAR TYPE (do this first for every frame) ══`,
  `TRADITIONAL 2D: fish appear as U-shaped ARCH returns (∩), horizontal scrolling time axis, continuous bottom return line, coloured depth bands.`,
  `LIVE SONAR: dark/near-black background, fish = SOLID BRIGHT OVAL BODIES (not arches), acoustic shadow below each body, NO scrolling time axis.`,
  `Set sonarType accordingly: "2d" for traditional arch sonar, "live_sonar" for live sonar displays.`,
  ``,
  `══ TRADITIONAL 2D ARCH RULES (apply when frames show U-shaped arches) ══`,
  `Arch brightness: Tier1 red/orange/white=Barra/Fingermark/Jack/Threadfin/Jewfish · Tier2 yellow/green=Coral Trout/Queenfish · Tier3 faint=GT/Mackerel/Flathead.`,
  `SHADOW VOID (dark zone directly below arch) = large dense swim bladder = Barra/Jewfish. Confidence 85%+. Threadfin bladder smaller → weak/no void.`,
  `BARRA vs THREADFIN: Barra=thick arch ON hard structure solo+shadow void; Threadfin=thinner arch MID-COLUMN SCHOOL over soft bottom same depth no void.`,
  `BARRA vs JACK: Jack=arch BURIED INSIDE or EMERGING FROM structure echo (half-arch). Barra=COMPLETE arch ON TOP of or beside structure — clear fish/structure separation.`,
  `FINGERMARK: deep-bodied arch L:H 2.5-3:1, 1-4m ABOVE rubble/reef bottom, loose group 2-8 fish, 5-25m depth.`,
  `LONE ARCH: 1-2 arches = RAISE confidence. Lone+hard structure=70%; lone+shadow void=85%+.`,
  `MULTI-FRAME 2D MOVEMENT: an arch that shifts zone between frames = moving fish. Same zone all frames = fish holding position or structure — still report it.`,
  `NEVER return fishCount=0 when U-shaped arch returns are clearly visible.`,
  ``,
  `YOUR JOBS FOR MULTI-FRAME ANALYSIS — IN STRICT PRIORITY ORDER:`,
  ``,
  `JOB 1 (PRIMARY) — DETECT FISH IN EVERY FRAME:`,
  `For 2D frames: find every arch (∩ shape), report its zone, brightness tier, shadow void presence.`,
  `For live sonar frames: find every bright oval/blob body, report its zone.`,
  `Report returns AGGRESSIVELY — false positive is fine; missed fish is failure.`,
  ``,
  `JOB 2 (PRIMARY) — TRACK MOVEMENT BETWEEN FRAMES:`,
  `Compare every frame to the one before it.`,
  `- ANY arch/blob that shifts even 1 grid zone between frames = MOVING TARGET — add to movingZones.`,
  `- A return visible in only 1-2 of 5 frames = fish passing through — add to movingZones.`,
  `- A zone stable in ALL 5 frames = static structure — staticZones only.`,
  `- movingTargetCount = estimate of distinct moving objects (1 per ~2 adjacent moving zones).`,
  ``,
  `JOB 3 — CROCODILE ALERT (SAFETY CRITICAL — full guide below).`,
  ``,
  `GRID: 8 columns A(left)→H(right), 8 rows 1(surface/near)→8(deep/far). 64 zones: A1-H8.`,
  `Bottom band rows 7-8 = static structure unless an isolated return is clearly separate from the continuous bottom.`,
  ``,
  `SCAN EVERY FRAME COMPLETELY: Report every zone with ANY return brighter than background.`,
  `Do not skip small returns. Do not skip faint returns.`,
  ``,
  `══ LIVE SONAR RULES (apply only when frames show dark background + solid blob bodies) ══`,
  MODE_IDENTIFICATION,
  VISUAL_APPEARANCE,
  MOVEMENT_GUIDE,
  CROC_GUIDE,
  SPECIES_QUICK_REF,
  `Return JSON only — no markdown, no prose.`,
].join("\n");

const CYCLE_SCHEMA = `{
  "sonarType": "live_sonar|2d|down_imaging|side_imaging|mega360|unknown",
  "frameZones": [["C3"],["C3","D3"],["D3","E3"],["E3"],["E3","F3"]],
  "activeZones": ["C3","D3","E3","F3"],
  "movingZones": ["D3","E3","F3"],
  "staticZones": ["B7","C7","D7","E7","F7","G7"],
  "movingTargetCount": 1,
  "movementVector": "left|right|toward|away|stationary|unknown",
  "targetCount": 2,
  "targetType": "blob|shape|dot|streak|comma|thin|thick|mixed|none",
  "depthRange": "3-6m",
  "fishCount": 2,
  "confidence": 0.8,
  "species": "barramundi",
  "barraPct": 0.7,
  "suggestion": "20 words tactical advice",
  "lure": "string",
  "lureType": "hard|soft|fly|jig|surface",
  "technique": "string",
  "crocAlert": false,
  "crocWarning": null,
  "birdAlert": null,
  "waterTemp": "",
  "bottomType": ""
}`;

// Short visual captions injected with each demo — focused on what matters for boat-cycle
const DEMO_CAPTIONS: Record<number, string> = {
  6: "LIVE SONAR REF (MEGA Live 2): dark background, fish = bright oval/elliptical blobs, acoustic shadow below each fish. Barra = large elongated oval near structure.",
  7: "LIVE SONAR REF (ActiveTarget): dark navy background, fish = oval blobs with trailing shadows. Barra = elongated torpedo blob near structure.",
  8: "LIVE SONAR REF (ActiveTarget): croc on live sonar = VERY LARGE solid filled blob near surface, enormous width vs length, no swim bladder shadow void.",
  9: "LIVE SONAR REF (ActiveTarget close-up): barra = elongated torpedo 4x longer than tall; croc = extreme width + minimal shadow, near surface.",
};

router.post("/boat-cycle", async (req, res) => {
  const { frames } = req.body as { frames?: string[] };
  if (!Array.isArray(frames) || frames.length === 0) {
    res.status(400).json({ error: "frames array required" }); return;
  }

  const clipped = frames.slice(0, 5);

  try {
    const content: ContentPart[] = [];

    // ── Inject live sonar display references (demos 6-9) ─────────────────────
    // Actual manufacturer live sonar screenshots: visual grounding for what
    // the screen looks like (dark background, blobs, croc appearance).
    // Demo 8 specifically shows croc visual signature on ActiveTarget.
    // Thumbnails ~30-80KB each; "low" detail = minimal token cost.
    const liveDemoRefs = getLiveSonarDemoRefs();
    if (liveDemoRefs.length > 0) {
      content.push({ type: "text", text: "LIVE SONAR DISPLAY REFERENCES (examples of what live sonar looks like):" });
      for (const ref of liveDemoRefs) {
        const caption = DEMO_CAPTIONS[ref.demoNum] ?? `Live sonar reference — ${ref.brand}`;
        content.push({ type: "text", text: caption });
        content.push({ type: "image_url", image_url: { url: `data:${ref.mimeType};base64,${ref.base64}`, detail: "low" } });
      }
      content.push({ type: "text", text: "─────────────────────────────\nNOW ANALYSE THE FOLLOWING SONAR FRAMES FROM THIS FISHING SESSION:" });
    }

    // ── User frames ───────────────────────────────────────────────────────────
    for (let i = 0; i < clipped.length; i++) {
      const b64 = clipped[i]!;
      content.push({ type: "text", text: `Frame ${i + 1} of ${clipped.length}:` });
      content.push({ type: "image_url", image_url: { url: `data:${detectMimeType(b64)};base64,${b64}`, detail: "low" } });
    }

    content.push({ type: "text", text: `Scan every zone in every frame. Report ALL returns. Track movement between frames. Flag any near-surface large blob as crocAlert. Return JSON matching schema:\n${CYCLE_SCHEMA}` });

    const completion = await openai.chat.completions.create({
      model: getModel("top"),
      temperature: 0.4,
      max_completion_tokens: 1200,
      stream: false,
      messages: [
        { role: "system", content: CYCLE_SYS },
        { role: "user", content },
      ],
    }, { signal: AbortSignal.timeout(50_000) });

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

    // ── Server-side movement analysis (pure logic, zero AI cost) ─────────────
    // Count how many frames each zone appeared in
    const zoneFreq = new Map<string, number>();
    for (const zones of frameZones) {
      for (const z of zones) zoneFreq.set(z, (zoneFreq.get(z) ?? 0) + 1);
    }
    const nFrames = Math.max(frameZones.length, 1);
    const staticThreshold = Math.max(4, nFrames - 1);  // 4+/5 frames = static structure

    const serverStaticZones = [...zoneFreq.entries()]
      .filter(([, c]) => c >= staticThreshold)
      .map(([z]) => z);
    const serverMovingZones = [...zoneFreq.entries()]
      .filter(([, c]) => c > 0 && c < staticThreshold)
      .map(([z]) => z);

    // Merge AI-reported with server-computed; server-static overrides AI-moving
    const aiMovingZones = Array.isArray(d.movingZones)
      ? (d.movingZones as unknown[]).filter((s): s is string => typeof s === "string")
      : [];
    const aiStaticZones = Array.isArray(d.staticZones)
      ? (d.staticZones as unknown[]).filter((s): s is string => typeof s === "string")
      : [];

    const staticSet = new Set([...serverStaticZones, ...aiStaticZones]);
    const movingZones = [...new Set([...serverMovingZones, ...aiMovingZones])].filter(z => !staticSet.has(z));
    const staticZones = [...staticSet];

    // Rough moving-target count: cluster adjacent zones (divide by 2 as a simple estimate)
    const movingTargetCount = movingZones.length > 0
      ? Math.max(1, Math.ceil(movingZones.length / 2))
      : 0;

    res.json({
      sonarType:        d.sonarType       ?? "unknown",
      frameZones,
      activeZones,
      movingZones,
      staticZones,
      movingTargetCount,
      movementVector:   d.movementVector  ?? "unknown",
      targetCount:      d.targetCount     ?? null,
      targetType:       d.targetType      ?? "none",
      depthRange:       d.depthRange      ?? "unknown",
      fishCount:        d.fishCount       ?? 0,
      confidence:       d.confidence      ?? 0,
      species:          d.species         ?? "Unknown",
      barraPct:         d.barraPct        ?? null,
      suggestion:       d.suggestion      ?? "",
      lure:             d.lure            ?? "",
      lureType:         d.lureType        ?? "",
      technique:        d.technique       ?? "",
      crocAlert:        d.crocAlert       ?? false,
      crocWarning:      d.crocWarning     ?? null,
      birdAlert:        d.birdAlert       ?? null,
      waterTemp:        d.waterTemp       ?? "",
      bottomType:       d.bottomType      ?? "",
    });

    req.log.info(
      { sonarType: d.sonarType, movingTargetCount, movingZones: movingZones.length, staticZones: staticZones.length, targetCount: d.targetCount, targetType: d.targetType, fishCount: d.fishCount, crocAlert: d.crocAlert ?? false, liveDemoRefsInjected: liveDemoRefs.length },
      "Boat-cycle complete"
    );
  } catch (err) {
    req.log.error({ err }, "Boat-cycle failed");
    res.status(500).json({ error: "Cycle analysis failed" });
  }
});

export default router;
