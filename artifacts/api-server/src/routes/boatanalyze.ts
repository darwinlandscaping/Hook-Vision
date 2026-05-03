import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getModel } from "../lib/models.js";
import { getSonarFewShotRefs } from "../lib/sonarBrain.js";
import { getFewShotRefs } from "../lib/barraLibrary.js";

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

// ── Multi-frame arch-movement analysis ───────────────────────────────────────

const CYCLE_SYS = `You are an expert sonar fish analyst for tropical Australian waters. You receive sequential sonar frames (oldest first, newest last). Your single most important job: DETECT AND TRACK EVERY RETURN THAT MOVES.

GRID: 8 columns A(left)→H(right), 8 rows 1(surface)→8(deep). 64 zones: A1…H8.
Bottom band sits in rows 7–8 — it is static structure. Do NOT report row 7–8 as movingZones unless a distinct isolated object is clearly separate from the continuous bottom return.

════════════════════════════
SONAR TYPE — identify from display layout FIRST:
• 2D/CHIRP: horizontal scrolling image, new echoes enter from RIGHT. Fish = ARCH (∩ shape). Thick arch = large fish (barra/croc/GT). Thin = small fish.
• Down Imaging (DI): photographic downward beam. Fish = bright WHITE DOTS or short streaks + dark sideways shadow beneath.
• Side Imaging (SI): two mirrored horizontal panels. Fish = bright COMMA or TEARDROP shapes + shadow extending away from centre line.
• Live Sonar (LiveScope / ActiveTarget / MEGA Live): real-time snapshot — does NOT scroll. Fish = distinct BLOBS separate from background. Each frame is a live moment.
• MEGA 360 / Panoptix 360: circular radar display. Fish = isolated bright dots at radial distance from centre.

════════════════════════════
MOVEMENT IS THE PRIMARY FISH SIGNAL:
• Trees, logs, rocks, bottom: NEVER shift zone between frames. Zone stable in ALL 5 frames = structure (staticZones).
• Fish: appear in DIFFERENT zones across frames, OR appear briefly in only 1–3 of 5 frames.
• PATH: B3 frame1 → C3 frame2 → D3 frame3 = one fish swimming right — that is 1 moving target.
• BRIEF: a return visible in only 1 or 2 frames = fish passing through — report that zone in movingZones.
• Even a single-frame return that wasn't there before = fish. Include it. Do NOT filter it out.

════════════════════════════
SCAN EVERY FRAME COMPLETELY:
For each frame scan every part of the image for ANY return brighter than background — arch, blob, dot, streak, flash. Report its zone. Do not skip small returns. Do not dismiss faint returns.

CRITICAL DETECTION RULE: If you can see it, report it. Prefer sensitivity over precision — a false positive is fine, a missed fish is not. The app will cross-reference across frames to confirm.

════════════════════════════
SPECIES GUIDE:
• BARRAMUNDI: thick bright arch near structure (snag/rock/pylon) + acoustic shadow void BELOW the arch = large swim bladder. Slow-moving or stationary. Legal size arch = 3–5% screen height.
• THREADFIN: thin arches in schools (5–30), same depth, soft bottom, no shadow void.
• CROCODILE: enormous arch rows 1–2 (0–3m depth), wider than any fish — set crocAlert: true immediately.
• GIANT TREVALLY: thick bright arch mid-water, small group, no structure attachment.

Return JSON only — no markdown, no prose.`;

const CYCLE_SCHEMA = `{
  "sonarType": "2d|down_imaging|side_imaging|live_sonar|mega360|unknown",
  "frameZones": [["C3"],["C3","D3"],["D3","E3"],["E3"],["E3","F3"]],
  "activeZones": ["C3","D3","E3","F3"],
  "movingZones": ["D3","E3","F3"],
  "staticZones": ["B7","C7","D7","E7","F7","G7"],
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

    // Build content array using liveanalyze.ts pattern — no cast needed
    const content: ContentPart[] = [];

    // 1. Barra body anatomy (cross-modal bridge: body shape → sonar return)
    const bodyRef = barraPhotos.find(r => r.thumbBase64);
    if (bodyRef?.thumbBase64) {
      content.push({ type: "text", text: "BARRAMUNDI BODY ANATOMY (cross-modal — connect body shape to expected sonar return):" });
      content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${bodyRef.thumbBase64}`, detail: "low" } });
      content.push({ type: "text", text: `↑ Confirmed barramundi — ${bodyRef.location}. Note the deep laterally-compressed body and large swim bladder position → thick bright arch + acoustic shadow void on sonar.` });
    }

    // 2. Confirmed barra sonar arch references (positive examples)
    const positiveRefs = sonarRefs.filter(r => r.isPositive).slice(0, 2);
    if (positiveRefs.length > 0) {
      content.push({ type: "text", text: `CONFIRMED BARRAMUNDI SONAR ARCH REFERENCES (${positiveRefs.length} expert-labeled images — study arch shape, thickness, shadow void):` });
      for (const ref of positiveRefs) {
        content.push({ type: "image_url", image_url: { url: `data:${ref.mimeType};base64,${ref.base64}`, detail: "low" } });
        content.push({ type: "text", text: `↑ ${ref.brand} — ${ref.label.split("\n")[0]}` });
      }
    }

    // 3. One contrast reference (NOT barra — shows threadfin/other false-positive)
    const negativeRef = sonarRefs.find(r => !r.isPositive);
    if (negativeRef) {
      content.push({ type: "text", text: "CONTRAST — NOT BARRAMUNDI (study the differences vs confirmed barra above):" });
      content.push({ type: "image_url", image_url: { url: `data:${negativeRef.mimeType};base64,${negativeRef.base64}`, detail: "low" } });
      content.push({ type: "text", text: `↑ ${negativeRef.brand} — ${negativeRef.label.split("\n")[0]}` });
    }

    if (content.length > 0) {
      content.push({ type: "text", text: `── END REFERENCES. Now analyse the ${clipped.length} sequential sonar frames below (oldest first):` });
    }

    // ── Frame images (oldest → newest, last frame at full resolution) ─────────
    for (let i = 0; i < clipped.length; i++) {
      const b64 = clipped[i]!;
      const isLast = i === clipped.length - 1;
      const detail: "high" | "low" = isLast ? "high" : "low";
      content.push({ type: "text", text: `Frame ${i + 1} of ${clipped.length}${isLast ? " [FULL RESOLUTION — scan every pixel for returns]" : ""}:` });
      content.push({ type: "image_url", image_url: { url: `data:${detectMimeType(b64)};base64,${b64}`, detail } });
    }

    content.push({ type: "text", text: `Report ALL zones containing ANY sonar return in each frame. Identify movement (zones that shift or appear briefly = fish). Return JSON matching schema:\n${CYCLE_SCHEMA}` });

    const completion = await openai.chat.completions.create({
      model: getModel("mid"),
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
