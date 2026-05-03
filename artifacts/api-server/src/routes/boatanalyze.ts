import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getModel } from "../lib/models.js";
import { getSonarFewShotRefs } from "../lib/sonarBrain.js";
import { getFewShotRefs } from "../lib/barraLibrary.js";

const router = Router();

type ContentItem =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail: "low" } };

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

const CYCLE_SYS = `You are an expert sonar fish analyst specialising in barramundi (Lates calcarifer) in tropical Australian waters. You receive sequential sonar frames captured 2 seconds apart — oldest first, newest last.

GRID: columns A(left)→D(right), rows 1(surface)→4(deep). 16 zones: A1 A2 A3 A4  B1 B2 B3 B4  C1 C2 C3 C4  D1 D2 D3 D4.

══════════════════════════════════════════════
SONAR TYPE — IDENTIFY FIRST FROM DISPLAY LAYOUT:
══════════════════════════════════════════════

2D / CHIRP (traditional scrolling sonar):
• Display scrolls horizontally. New echoes enter from the RIGHT. Time axis runs left (oldest) → right (newest).
• Fish = ARCH shape (∩ curve). Arch forms because the conical beam hits fish leading edge first, then centre, then trailing edge as the boat passes over.
• THICK arch (tall vertical height, >5% screen height) = large fish: barramundi 55cm+, GT, jewfish, croc.
• THIN arch = small fish or baitfish.
• Bottom return = bright continuous HORIZONTAL BAND near the bottom — NOT a fish. NEVER report bottom band as a zone.
• Acoustic SHADOW VOID = dark area directly BELOW an arch = fish blocked the sonar beam = large physostomous swim bladder = BARRAMUNDI or jewfish signature.
• Across 5 frames in 2D: arches drift LEFTWARD as sonar scrolls. Extra leftward drift = fish swimming away. Rightward = fish swimming toward boat.

DOWN IMAGING / DOWN SCAN (Lowrance StructureScan, Humminbird DI, Garmin DownVü):
• Very narrow beam pointing STRAIGHT DOWN, photographic-quality image.
• Fish do NOT appear as arches. Fish appear as bright WHITE DOTS or short horizontal WHITE STREAKS with a dark shadow extending SIDEWAYS beneath them.
• Structure (tree limbs, rocks, snags) shows photographic detail — individual branches visible.
• Barramundi in DI: LARGE bright oval dot or short streak, often adjacent to structure. No arch shape.
• Bottom = bright white horizontal band. Do NOT report structure detail as fish zones.

SIDE IMAGING (Lowrance StructureScan, Humminbird SI, Garmin SideVü):
• TWO horizontal panels: port side (top half) and starboard (bottom half) scanning SIDEWAYS from the boat.
• Fish appear as bright WHITE COMMA or TEARDROP shapes with a dark SHADOW extending away from the keel line.
• Shadow length = object height (long shadow = big object off the bottom).
• Barramundi in SI: large bright comma/teardrop near structure, isolated or small group.

LIVE SONAR / FORWARD SCAN (Garmin LiveScope, Lowrance ActiveTarget, Humminbird MEGA Live):
• Real-time beam pointing FORWARD (0–45° ahead) or straight down. Does NOT scroll.
• Shows the CURRENT MOMENT — each frame is a live snapshot. Fish appear as DISTINCT MOVING BLOBS.
• Bottom shows as a curved arc at the bottom of the display. Everything above = water column.
• Barramundi in live sonar: LARGE elongated oval blob (4:1 to 5:1 length:height ratio), near structure or bottom, often stationary or slow-moving (barra are ambush predators), high brightness.
• Crocodile: VERY LARGE near-surface blob (wider than barra, depth 0–2m), irregular/wide profile.
• In 5 frames of live sonar: blobs that MOVE position = active fish. Same position all 5 frames = structure.

MEGA 360 / PANOPTIX 360:
• Circular radar-like display centred on boat. Fish = isolated bright dots or short arcs at radial distance.
• Barramundi: isolated bright dot near structure at bearing/range.

BRAND COLOUR GUIDE (for return-strength interpretation):
• Lowrance (HDS/Elite/Hook): Orange/red = Tier 1 strongest. Yellow = medium. Green = weak.
• Humminbird (HELIX/SOLIX): White/orange = Tier 1. Yellow = medium. Green = weak.
• Garmin (Echomap/Striker): White/cyan = Tier 1. Green = medium. Dim = weak.
• Simrad (GO/NSS): Same as Lowrance — orange/red = Tier 1.

══════════════════════════════════════════════
MOVEMENT DETECTION — PRIMARY FISH INDICATOR ACROSS 5 FRAMES:
══════════════════════════════════════════════

KEY INSIGHT: Trees, logs, rocks, and the bottom do NOT move between frames.
ANYTHING that shifts grid zone between consecutive frames IS ALIVE (fish, crocodile, or turtle).

• STATIC ZONES: zones present in 4+ of 5 frames = permanent structure, bottom, log, rock. NOT fish.
• MOVING ZONES: zones present in only 1–3 of 5 frames, or zones that SHIFT POSITION between frames = fish.
• DELTA: if zone X appears in frame 3 but NOT in frames 1, 2, 4, 5 = something passed through zone X = fish.
• PATH TRACKING: A2 in frame 1 → B2 in frame 2 → C2 in frame 3 = one fish swimming left = 1 moving target.
• Even ONE zone that appears briefly (1–2 frames) out of 5 = fish passing through. Report as movingZones.
• DO NOT include bottom-row zones (row 4) as movingZones unless you see clear distinct object movement there.

Report movingZones and staticZones separately — the app highlights fish zones in GREEN and structure in grey.

══════════════════════════════════════════════
BARRAMUNDI BODY → SONAR PHYSICS (cross-modal bridge):
══════════════════════════════════════════════
• Barra have a LARGE PHYSOSTOMOUS SWIM BLADDER (gas-filled sac in upper body cavity).
• This bladder is the #1 sonar reflector → THICK BRIGHT ARCH + ACOUSTIC SHADOW VOID below the fish.
• Deep laterally-compressed body (3:1 length:height ratio) → TALLER arch than threadfin.
• Barra are AMBUSH PREDATORS: hold near structure (snags, rocks, pylons, ledges). Rarely mid-column.
• Large barra 80cm+: arch 5–8% screen height, always Tier 1 bright, strong shadow void.
• Legal barra 55–80cm: arch 3–5% screen height, Tier 1 bright, clear shadow void.

SPECIES DISTINCTIONS:
• BARRAMUNDI: thick bright arch on/near structure, shadow void below, slow-moving to stationary.
• THREADFIN SALMON: thin arches in SCHOOLS (5–30) at same depth over soft bottom, mid-column, NO shadow void.
• CROCODILE: ENORMOUS arch 0.5–3m depth, much thicker than any fish arch — FLAG crocAlert immediately.
• GIANT TREVALLY: thick bright arch mid-water, paired/small group, no structure attachment, aggressive movement.
• JEWFISH / BLACK JEWFISH: single very large thick arch, deep 5–20m, near bottom structure, strong shadow void.

YOUR TASK:
1. Identify sonarType from display layout (first decision).
2. For EACH frame, list which zones contain fish-indicator returns (arches, blobs, dots) — NOT static bottom/structure.
3. Track changes: which zones appeared or disappeared between consecutive frames?
4. Identify movingZones (fish — zones that shift or appear briefly) vs staticZones (zones constant across most frames).
5. Assess if detected targets match barramundi signature using references shown above.

Return JSON only — no markdown, no prose.`;

const CYCLE_SCHEMA = `{
  "sonarType": "2d|down_imaging|side_imaging|live_sonar|mega360|unknown",
  "frameZones": [["A2"],["A2","B2"],["B2","C2"],["C2"],["C2","D2"]],
  "activeZones": ["A2","B2","C2","D2"],
  "movingZones": ["B2","C2"],
  "staticZones": ["A4","B4","C4","D4"],
  "movingTargetCount": 1,
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
    // ── Reference images: sonar brain refs + barra body (cross-modal) ────────
    const sonarRefs = getSonarFewShotRefs();
    const barraPhotos = getFewShotRefs(2);
    const refContent: ContentItem[] = [];

    // 1. Barra body anatomy (cross-modal bridge: body shape → sonar return)
    const bodyRef = barraPhotos.find(r => r.thumbBase64);
    if (bodyRef?.thumbBase64) {
      refContent.push({ type: "text", text: "BARRAMUNDI BODY ANATOMY (cross-modal — connect body shape to expected sonar return):" });
      refContent.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${bodyRef.thumbBase64}`, detail: "low" } });
      refContent.push({ type: "text", text: `↑ Confirmed barramundi — ${bodyRef.location}. Note the deep laterally-compressed body and large swim bladder position → thick bright arch + acoustic shadow void on sonar.` });
    }

    // 2. Confirmed barra sonar arch references (positive examples)
    const positiveRefs = sonarRefs.filter(r => r.isPositive).slice(0, 2);
    if (positiveRefs.length > 0) {
      refContent.push({ type: "text", text: `CONFIRMED BARRAMUNDI SONAR ARCH REFERENCES (${positiveRefs.length} expert-labeled images — study arch shape, thickness, shadow void):` });
      for (const ref of positiveRefs) {
        refContent.push({ type: "image_url", image_url: { url: `data:${ref.mimeType};base64,${ref.base64}`, detail: "low" } });
        refContent.push({ type: "text", text: `↑ ${ref.brand} — ${ref.label.split("\n")[0]}` });
      }
    }

    // 3. One contrast reference (NOT barra — shows threadfin/other false-positive)
    const negativeRef = sonarRefs.find(r => !r.isPositive);
    if (negativeRef) {
      refContent.push({ type: "text", text: "CONTRAST — NOT BARRAMUNDI (study the differences vs confirmed barra above):" });
      refContent.push({ type: "image_url", image_url: { url: `data:${negativeRef.mimeType};base64,${negativeRef.base64}`, detail: "low" } });
      refContent.push({ type: "text", text: `↑ ${negativeRef.brand} — ${negativeRef.label.split("\n")[0]}` });
    }

    if (refContent.length > 0) {
      refContent.push({ type: "text", text: `── END REFERENCES. Now analyse the ${clipped.length} sequential sonar frames below (oldest first):` });
    }

    // ── Frame images ──────────────────────────────────────────────────────────
    const imgContent: ContentItem[] = clipped.flatMap((b64, i) => ([
      { type: "text" as const, text: `Frame ${i + 1} of ${clipped.length}:` },
      { type: "image_url" as const, image_url: { url: `data:${detectMimeType(b64)};base64,${b64}`, detail: "low" as const } },
    ]));

    const completion = await openai.chat.completions.create({
      model: getModel("mid"),
      max_completion_tokens: 600,
      stream: false,
      messages: [
        { role: "system", content: CYCLE_SYS },
        {
          role: "user" as const,
          content: [...refContent, ...imgContent, { type: "text" as const, text: `Identify sonar type, detect movement, report movingZones vs staticZones across ${clipped.length} frames. Return JSON matching schema:\n${CYCLE_SCHEMA}` }] as any,
        },
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
    const staticThreshold = Math.max(4, nFrames - 1);  // present in 4+/5 frames = static structure

    const serverStaticZones = [...zoneFreq.entries()]
      .filter(([, c]) => c >= staticThreshold)
      .map(([z]) => z);
    const serverMovingZones = [...zoneFreq.entries()]
      .filter(([, c]) => c > 0 && c < staticThreshold)
      .map(([z]) => z);

    // Merge AI-reported with server-computed; server-computed static zones override AI moving zones
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
      archCount:        d.archCount       ?? null,
      archType:         d.archType        ?? "none",
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
      { sonarType: d.sonarType, movingTargetCount, movingZones: movingZones.length, staticZones: staticZones.length, archCount: d.archCount, archType: d.archType, fishCount: d.fishCount },
      "Boat-cycle complete"
    );
  } catch (err) {
    req.log.error({ err }, "Boat-cycle failed");
    res.status(500).json({ error: "Cycle analysis failed" });
  }
});

export default router;
