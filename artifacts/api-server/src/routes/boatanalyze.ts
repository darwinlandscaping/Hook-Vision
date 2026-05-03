import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getModel } from "../lib/models.js";

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
      max_completion_tokens: 160,
      stream: false,
      messages: [
        { role: "system", content: SINGLE_SYS },
        { role: "user", content },
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

// ── Multi-frame fish movement analysis ───────────────────────────────────────

const CYCLE_SYS = `You are an expert sonar fish analyst for tropical Australian waters. You receive sequential sonar frames (oldest first, newest last). Your single most important job: DETECT AND TRACK EVERY RETURN THAT MOVES.

GRID: 8 columns A(left)→H(right), 8 rows 1(surface)→8(deep). 64 zones: A1…H8.
Bottom band sits in rows 7–8 — static structure. Do NOT report rows 7–8 as movingZones unless a clearly distinct isolated object is separate from the continuous bottom return.

════════════════════════════
STEP 1 — IDENTIFY SONAR TYPE FROM THE DISPLAY LAYOUT:
• 2D/CHIRP: horizontally scrolling image, newest returns enter from the RIGHT edge.
• Down Imaging (DI): photographic-quality downward beam, branches/rocks render in detail.
• Side Imaging (SI): two mirrored horizontal panels — port (top) and starboard (bottom) — scanning sideways.
• Live Sonar (LiveScope / ActiveTarget / MEGA Live): real-time snapshot that does NOT scroll. Shows the live water column directly ahead of or below the transducer.
• MEGA 360 / Panoptix 360: circular radar-style display centred on the boat.

════════════════════════════
STEP 2 — USE THE CORRECT DETECTION VOCABULARY FOR YOUR IDENTIFIED TYPE:

2D/CHIRP — fish appear as ARCHES (∩ shape):
• Thick arch (tall vertical height, >5% screen) = large fish: barra 55cm+, GT, jewfish, croc.
• Thin arch = small fish or baitfish. Schools of thin arches = threadfin salmon.
• Acoustic SHADOW VOID directly BELOW an arch = large swim bladder = barramundi or jewfish.
• targetType for 2D: "thin" | "thick" | "mixed"

Down Imaging (DI) — fish appear as BRIGHT WHITE DOTS or short STREAKS:
• Dark shadow extends SIDEWAYS (not downward) beneath each dot/streak. Shadow length ∝ fish size.
• Photographic structural detail (branches, rocks) is NOT fish — ignore it unless a dot/streak sits apart.
• Barra in DI: large oval bright dot near structure with clear sideways shadow. No arch shape.
• targetType for DI: "dot" | "streak"

Side Imaging (SI) — fish appear as BRIGHT COMMA or TEARDROP shapes:
• Shadow extends AWAY from the keel centreline. Long shadow = tall object off the bottom.
• Barra in SI: large comma/teardrop near structure, isolated or small group.
• targetType for SI: "comma" | "streak"

Live Sonar (LiveScope / ActiveTarget / MEGA Live) — fish appear as BLOBS and SHAPES:
• NEVER arches on live sonar. Fish are distinct floating blobs visible in the water column.
• Each frame is a live moment — blobs that SHIFT POSITION between frames = active fish.
• Bottom shows as a curved arc at the bottom edge — everything above = water column.
• Barra on live sonar: LARGE elongated blob (4:1 to 5:1 length:height ratio), near bottom or structure. Typically slow-moving or stationary (ambush predator). High brightness, well-defined edges.
• Croc on live sonar: VERY LARGE irregular blob near surface (rows 1–2), wider than any fish — set crocAlert: true immediately.
• Threadfin/bream: smaller rounder blobs, often loosely grouped in the mid-column.
• Structure (logs, rocks): blobs in same zone across ALL frames = staticZones, NOT fish.
• targetType for Live: "blob" | "shape"

MEGA 360 / Panoptix 360 — fish appear as isolated BRIGHT DOTS at radial distance:
• Barra: isolated bright dot near structure at bearing/range from centre.
• targetType for MEGA360: "dot"

════════════════════════════
STEP 3 — MOVEMENT IS THE PRIMARY FISH SIGNAL:
• Trees, logs, rocks, bottom: NEVER shift zone between frames. Zone stable in ALL 5 frames = structure (staticZones).
• Fish: appear in DIFFERENT zones across frames, OR appear briefly in only 1–3 of 5 frames.
• PATH: B3 frame1 → C3 frame2 → D3 frame3 = one fish swimming right = 1 moving target.
• BRIEF: a return visible in only 1 or 2 frames = fish passing through — report that zone in movingZones.
• Even a single-frame return = fish. Include it. Do NOT filter it out.

════════════════════════════
STEP 4 — SCAN EVERY FRAME COMPLETELY:
For each frame scan every part of the image for ANY return brighter than background — blob, dot, streak, comma, shape, flash (or arch if 2D only). Report its zone. Do not skip small returns.

CRITICAL DETECTION RULE: If you can see it, report it. False positive = fine. Missed fish = not acceptable.

Return JSON only — no markdown, no prose.`;

const CYCLE_SCHEMA = `{
  "sonarType": "2d|down_imaging|side_imaging|live_sonar|mega360|unknown",
  "frameZones": [["C3"],["C3","D3"],["D3","E3"],["E3"],["E3","F3"]],
  "activeZones": ["C3","D3","E3","F3"],
  "movingZones": ["D3","E3","F3"],
  "staticZones": ["B7","C7","D7","E7","F7","G7"],
  "movingTargetCount": 1,
  "movementVector": "left",
  "targetCount": 2,
  "targetType": "blob|shape|dot|streak|comma|thin|thick|mixed|none",
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
    // ── Frame images only — no reference injection (arch refs confuse live sonar) ──
    const content: ContentPart[] = [];

    for (let i = 0; i < clipped.length; i++) {
      const b64 = clipped[i]!;
      content.push({ type: "text", text: `Frame ${i + 1} of ${clipped.length}:` });
      content.push({ type: "image_url", image_url: { url: `data:${detectMimeType(b64)};base64,${b64}`, detail: "low" } });
    }

    content.push({ type: "text", text: `Report ALL zones containing ANY sonar return in each frame. Identify movement (zones that shift or appear briefly = fish). Return JSON matching schema:\n${CYCLE_SCHEMA}` });

    const completion = await openai.chat.completions.create({
      model: getModel("top"),
      max_completion_tokens: 800,
      stream: false,
      messages: [
        { role: "system", content: CYCLE_SYS },
        { role: "user", content },
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
      { sonarType: d.sonarType, movingTargetCount, movingZones: movingZones.length, staticZones: staticZones.length, targetCount: d.targetCount, targetType: d.targetType, fishCount: d.fishCount },
      "Boat-cycle complete"
    );
  } catch (err) {
    req.log.error({ err }, "Boat-cycle failed");
    res.status(500).json({ error: "Cycle analysis failed" });
  }
});

export default router;
