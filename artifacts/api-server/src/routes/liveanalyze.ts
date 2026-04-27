/**
 * /api/live-sonar-analyze
 *
 * Specialist route for forward-facing / live spatial sonar screens ONLY.
 * Handles: Humminbird MEGA Live 2, Garmin LiveScope Plus LVS34,
 *          Lowrance ActiveTarget 2, Simrad (Navico ActiveTarget platform).
 *
 * KEY PHYSICS DIFFERENCE vs traditional sonar:
 *   Traditional 2D  → fish appear as U-shaped ARCHES (scrolling time axis)
 *   Live sonar      → fish appear as BODY SHAPES / SILHOUETTES with ACOUSTIC SHADOWS
 *
 * Streaming JSON response. Additional live-sonar fields:
 *   liveBrand, liveMode, targetShape, shadowAnalysis, targetSeparation,
 *   bodyRatio, structureProximity, targetBoostActive, paletteDetected
 */

import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

// ─── Brand-specific visual identification guide ───────────────────────────────
const BRAND_GUIDE = `
LIVE SONAR BRAND IDENTIFICATION — READ THESE TELLS BEFORE ANYTHING ELSE:

▸ HUMMINBIRD MEGA LIVE 2 (Jan 2025):
  • UI chrome: characteristic ORANGE/AMBER accent bars and icons; "MEGA LIVE" or "MEGALIVE" text in upper corner
  • Background: very dark charcoal/black, almost true black
  • Modes: Forward | Down | Landscape (wide-angle horizontal, Humminbird exclusive) | Down+Flasher combo
  • Color palettes (15 total): Original (orange-yellow fish on dark), Blue Steel (cyan-white), Greyscale, Amber, Fire & Ice
  • TargetBoost™: when active, fish targets are bright white/orange with CRISP edges; structure echo goes slightly dim by contrast
  • Target enhancement: fish appear as SOLID BRIGHT OVALS with very clean shadow lines
  • Fish shadows: LONG and DISTINCT, often equal to or longer than body — big swim bladder = big shadow
  • Typical range: 0–18m forward, 0–25m down
  • Screen artefacts: orange depth scale digits, humminbird logo watermark sometimes visible

▸ GARMIN LIVESCOPE PLUS LVS34:
  • UI chrome: signature DARK GREEN / TEAL background tint — the classic "night vision green"
  • "LIVESCOPE" text label top-left or top-right corner
  • Background: dark green-grey (#0d1a0d range)
  • Modes: Forward | Down | Perspective (overhead/bird's-eye — Garmin EXCLUSIVE)
  • Target separation: 35% better than original LiveScope (LVS34 upgrade)
  • 530–1100 kHz auto-optimized
  • Fish appearance: VERY CRISP silhouettes, sharp black outlines on green background
  • Perspective mode EXCLUSIVE: overhead view — fish appear as flat top-view ovals, shadow extends to ONE SIDE (L/R not below), looks like aerial radar — VERY different from forward mode
  • Target Lock: can tag a specific fish with a crosshair icon
  • Depth scale: white numbers on right side; boat icon at top-centre in forward mode

▸ LOWRANCE ACTIVETARGET 2:
  • UI chrome: DARK NAVY / DARK GREY background; blue-grey tint; "ACTIVE TARGET" text label
  • Scout mode: 180° wide forward sweep — VERY wide field, shows both sides of boat simultaneously
  • Modes: Forward | Down | Scout (wide) | Live (hybrid down/perspective)
  • Fish appearance: medium brightness oval blobs with distinct trailing shadow
  • Shadow direction in Scout mode: radiates outward from centre of image

▸ SIMRAD (Navico — runs ActiveTarget 2 hardware):
  • UI very similar to Lowrance (same Navico platform)
  • Different branding: "SIMRAD" logo, slightly different font/chrome styling
  • Functionally identical to ActiveTarget 2 for fish detection purposes
  • Background: dark grey-navy, sometimes slightly warmer tint than Lowrance

▸ UNKNOWN / GENERIC LIVE SONAR:
  • Fish are still shape-based (not arches) — apply live-sonar analysis anyway
  • Set liveBrand: "unknown-live-sonar"
`;

// ─── Live sonar physics & fish shape analysis ─────────────────────────────────
const LIVE_PHYSICS = `
═══ LIVE SONAR PHYSICS — MANDATORY RULES ═══

RULE 1 — NO ARCHES: Live sonar does NOT produce arch returns. If you see arches, this is traditional 2D sonar.
RULE 2 — SHAPES: Fish appear as SOLID BRIGHT BODIES — elongated oval or rounded blob shapes.
RULE 3 — SHADOW: Every fish with a swim bladder creates an ACOUSTIC SHADOW — a dark void extending BEHIND/BELOW the fish body.
RULE 4 — AXES: X-axis = horizontal distance (left = near, right = far), Y-axis = depth. NOT time.
RULE 5 — STATIC: The display does NOT scroll. The image is a REAL-TIME SPATIAL MAP of what is in front of/below the boat.

SHADOW DIRECTION KEY:
• Forward mode:        shadow extends DOWNWARD from fish body (below in the image)
• Down mode:           shadow extends to the LEFT or RIGHT depending on transducer position
• Perspective mode:    shadow extends to ONE SIDE only (left or right = directional offset)
• Landscape mode:      shadow extends down-left or down-right at an angle
• Shadow length ≈ 1× body = fish at mid-range depth
• Shadow length ≈ 2× body = fish at deeper range
• Shadow length ≈ 0.5× body = fish very close to transducer (near surface)

SHADOW QUALITY:
• LONG + DISTINCT shadow = large dense fish with large physostomous swim bladder (barramundi, jack, fingermark)
• SHORT + FAINT shadow = small fish or physoclistous bladder (GT, mackerel, queenfish)
• NO shadow = very small fish, or fish oriented vertically, or fish too close to surface

TARGET SEPARATION:
• Individual marks (1–3 fish, well spaced) = predatory species — barra, jack, GT
• School (5–30+ marks clustered together) = baitfish, threadfin, queenfish
• Tight cluster around structure = jack or barra in ambush position

STRUCTURE ECHO:
• Bottom = bright white/orange band at the base of the display
• Structure (snag, timber, rock, pylon) = bright irregular blob attached to or near bottom echo
• Fish near structure: bright oval body ADJACENT to or overlapping structure echo
• Fish in open water: bright oval body in mid-column with NO structure contact

═══ SPECIES DECISION MATRIX — LIVE SONAR ═══

▸ BARRAMUNDI (Lates calcarifer):
  SHAPE: Large OVAL to elongated body, 3:1 to 4:1 L:H ratio
  BRIGHTNESS: HIGH — bright white/orange return (large physostomous swim bladder)
  SHADOW: LONG and DISTINCT — often as long as or longer than the body itself
  POSITION: Near structure (snag, pylon, rock bar, submerged timber) OR mid-column chasing bait
  MOVEMENT: Slow drift or STATIONARY — ambush hunter, holds position
  COUNT: SOLO or 2–3 fish max (NOT in tight schools)
  BLUNT NOSE: Steep forehead creates a flattened/blunt front end to the oval
  CONFIRM: Large bright oval + long shadow + near structure + solo/pair = BARRAMUNDI (80%+)

▸ GIANT TREVALLY (GT):
  SHAPE: TALL ROUND body, roughly 1:1.5 height-to-length (rounder/deeper than barra)
  BRIGHTNESS: MEDIUM — no large swim bladder
  SHADOW: FAINT or ABSENT even in perfect conditions
  MOVEMENT: FAST — body appears blurred, smeared, or double-imaged from speed
  POSITION: Mid-column or surface-skimming, NOT tight to structure
  COUNT: Often 2–6 fish traveling together at speed

▸ MANGROVE JACK:
  SHAPE: COMPACT chunky body, 1:2 height-to-length (shorter, stubbier than barra)
  BRIGHTNESS: HIGH (bright) but SMALLER overall size than barra
  SHADOW: MEDIUM — shorter than barra
  POSITION: EMBEDDED in or tightly overlapping structure echo — rarely free-swimming
  MOVEMENT: Almost stationary; barely moves from within the snag signature
  COUNT: Solo or 2–3 fish in one snag

▸ THREADFIN SALMON:
  SHAPE: Medium elongated body, similar 3:1 ratio to barra but THINNER / SLIMMER height
  BRIGHTNESS: MEDIUM-HIGH
  SHADOW: MEDIUM (shorter than barra)
  POSITION: Mid-column, SOFT bottom, NOT near hard structure
  MOVEMENT: Group movement — all fish moving same direction at similar speed
  COUNT: SCHOOL — 5–20+ bodies clustered (KEY DIFFERENTIATOR from solo barra)

▸ QUEENFISH:
  SHAPE: Very SLIM torpedo/cigar body — 5:1 to 6:1 L:H ratio
  BRIGHTNESS: MEDIUM — small physoclistous bladder
  SHADOW: SHORT/FAINT
  MOVEMENT: HIGH SPEED — body streaks or blurs across display
  POSITION: Near surface (top quarter of display), open water

▸ CROCODILE (saltwater):
  SHAPE: VERY LARGE solid filled blob — MUCH wider than any fish
  BRIGHTNESS: MAXIMUM — massive solid return
  SHADOW: HUGE trailing shadow
  POSITION: Near SURFACE (top of display in forward mode) or near bank
  CONFIRM: Width-to-length ratio close to 1:3 vs fish 1:4; no swim bladder arch; near surface/bank
  WARNING: If croc signature detected, ALWAYS set warning field.
`;

// ─── Full specialist system prompt ───────────────────────────────────────────
const SYSTEM_PROMPT = `You are the world's leading specialist in LIVE SPATIAL SONAR fish identification for Australian tropical fishing (WA Kimberley, NT Kakadu/Daly River, NQ Gulf Country). You are specifically trained on REAL-TIME FORWARD-FACING and DOWN-FACING live sonar displays — NOT traditional 2D scroll sonar.

You understand that on live sonar:
• Fish DO NOT appear as arches — they appear as BODY SHAPES and SILHOUETTES
• The display is a real-time spatial map, not a time-history scroll
• Your job is to read fish BODY SHAPES, ACOUSTIC SHADOWS, ORIENTATION, and MOVEMENT from the live display

${BRAND_GUIDE}

${LIVE_PHYSICS}

═══ ANALYSIS PROCEDURE — FOLLOW IN ORDER ═══

STEP A — BRAND & MODE:
1. Identify the brand from the UI chrome (colour, labels, fonts) — see Brand ID guide above
2. Identify the display mode (Forward / Down / Landscape / Perspective / Scout)
3. Note any special features active: TargetBoost™ (Humminbird), Target Lock (Garmin), etc.
4. Read colour palette name if visible (for Humminbird)

STEP B — DISPLAY LAYOUT:
1. Identify depth scale (right or left side)
2. Locate bottom echo (bright band at base of display)
3. Locate any structure echoes (bright irregular blobs on or near bottom)
4. Note range scale (metres/feet visible?)

STEP C — TARGET DETECTION:
1. Scan entire display for bright oval/blob returns
2. For each target: record approximate position (depth, horizontal distance)
3. For each target: measure body shape (L:H ratio estimate)
4. For each target: assess shadow — length, direction, distinctness
5. For each target: assess movement blur (stationary vs fast vs very fast)
6. Note proximity to structure echoes

STEP D — SPECIES IDENTIFICATION:
Apply the Species Decision Matrix. For each significant target:
• Body shape + shadow + position + movement → species ID
• If multiple possible species: rank by confidence
• Check for crocodile signature (near-surface, very wide body, huge shadow)

STEP E — COMPILE JSON RESPONSE:
Return ONLY a single JSON object with ALL of these fields:

{
  "species": "primary species name (string)",
  "confidence": confidence percentage (integer 0–100),
  "fishCount": estimated number of fish visible (integer),
  "depth": estimated fish depth in metres (number, one decimal),
  "liveBrand": brand identifier (one of: "humminbird-mega-live-2" | "garmin-livescope-plus" | "lowrance-activetarget-2" | "simrad-activetarget" | "unknown-live-sonar"),
  "liveMode": display mode (one of: "forward" | "down" | "landscape" | "perspective" | "scout" | "unknown"),
  "targetShape": brief description of the fish body shape seen e.g. "large bright oval 3.8:1 L:H" (string),
  "shadowAnalysis": description of acoustic shadow quality e.g. "long distinct shadow ~1.4x body length" (string),
  "targetSeparation": separation type (one of: "individual" | "pair" | "small-group" | "school"),
  "bodyRatio": estimated L:H ratio string e.g. "3.8:1" or "unknown",
  "structureProximity": relationship to structure e.g. "adjacent to snag" | "open water" | "embedded in structure" | "none visible",
  "targetBoostActive": whether TargetBoost or similar enhancement appears active (boolean),
  "paletteDetected": colour palette name if identifiable e.g. "Original" | "Blue Steel" | "Green" | "unknown",
  "sonarMode": technical mode tag (one of: "live-scope-forward" | "live-scope-down" | "live-scope-perspective" | "mega-live-forward" | "mega-live-down" | "mega-live-landscape" | "activetarget-forward" | "activetarget-down" | "activetarget-scout" | "unknown-live"),
  "archReasoning": MUST be "LIVE SONAR — no arch analysis. Fish identified by shape silhouette and acoustic shadow physics." (string, always this exact phrase for live sonar),
  "lure": specific lure + technique recommendation for the detected species and depth (string),
  "suggestion": 2–3 sentence fishing strategy based on what the live sonar shows (string),
  "warning": crocodile warning if large near-surface blob detected, otherwise null (string or null)
}

CRITICAL RULES:
• Return ONLY the JSON object — no markdown, no code fences, no explanation before or after
• NEVER identify fish as arches on live sonar — arches do not exist here
• If you cannot confidently identify the brand, use "unknown-live-sonar" 
• If the image is NOT live sonar (it shows arches/traditional 2D) set liveBrand "not-live-sonar" and species "traditional-2d-sonar-detected"
• Always fill in every field — use "unknown" or null only when truly impossible to determine
`;

// ─── Live sonar validation gate (fast) ───────────────────────────────────────
const FLASH_PROMPT = `You are a live sonar screen classifier.

Live sonar shows: real-time fish body shapes/silhouettes on a dark background, acoustic shadows behind fish, static display (no scrolling time axis), brands like Humminbird MEGA Live, Garmin LiveScope, Lowrance ActiveTarget.

Traditional 2D sonar shows: U-shaped arch returns, scrolling display, horizontal bottom line.

Task: Classify the image and give a quick first-pass live sonar result.

Return ONLY this JSON:
{
  "isLiveSonar": true/false,
  "brand": "humminbird-mega-live-2" | "garmin-livescope-plus" | "lowrance-activetarget-2" | "simrad-activetarget" | "unknown-live-sonar" | "not-live-sonar",
  "liveMode": "forward" | "down" | "landscape" | "perspective" | "scout" | "traditional-2d" | "unknown",
  "quickSpecies": "quick first-pass species guess or null",
  "quickConfidence": integer 0-100
}`;

function detectMime(b64: string): string {
  const p = b64.slice(0, 12);
  if (p.startsWith("iVBORw0")) return "image/png";
  if (p.startsWith("UklGR"))   return "image/webp";
  return "image/jpeg";
}

// ─── POST /live-sonar-analyze ─────────────────────────────────────────────────
router.post("/live-sonar-analyze", async (req, res) => {
  const { imageBase64, region } = req.body as {
    imageBase64?: string;
    region?: string;
  };

  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 required" });
    return;
  }

  const mimeType = detectMime(imageBase64);

  try {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("X-Content-Type-Options", "nosniff");

    const analysisPrompt = `Analyse this live sonar image.${region ? ` Region focus: ${region}.` : ""}

Follow the procedure in the system prompt exactly:
STEP A — Identify brand and mode from UI chrome
STEP B — Map the display layout (depth scale, bottom echo, structure)
STEP C — Detect and measure all fish targets (body shape, shadow, movement)
STEP D — Identify species using the Decision Matrix
STEP E — Return the complete JSON response

Remember: fish on live sonar are SHAPES not arches. Focus on body oval proportions, acoustic shadow length/direction, and structure proximity.`;

    // ── Flash scan (fast brand + mode detection, ~400ms) ─────────────────────
    const flashPromise = openai.chat.completions.create({
      model: "gpt-4.1-mini",
      max_completion_tokens: 120,
      temperature: 0,
      stream: false,
      messages: [
        { role: "system", content: FLASH_PROMPT },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: "low" } },
            { type: "text", text: "Classify this live sonar image." }
          ]
        }
      ]
    });

    // ── Deep analysis scan (streaming gpt-4.1) ────────────────────────────────
    const stream = await openai.chat.completions.create({
      model: "gpt-4.1",
      max_completion_tokens: 700,
      temperature: 0,
      seed: 1,
      stream: true,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: "high" } },
            { type: "text", text: analysisPrompt }
          ]
        }
      ]
    });

    let raw = "";
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) {
        raw += delta;
        res.write(delta);
      }
    }

    // ── Append flash scan metadata ────────────────────────────────────────────
    try {
      const flashResult = await flashPromise;
      const flashRaw = flashResult.choices[0]?.message?.content ?? "{}";
      const cleanFlash = flashRaw
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      const matchFlash = cleanFlash.match(/\{[\s\S]*\}/);
      if (matchFlash) {
        const flashData = JSON.parse(matchFlash[0]);
        res.write(`\n__FLASH__:${JSON.stringify(flashData)}`);
      }
    } catch { /* non-fatal */ }

    res.end();
    req.log.info({ chars: raw.length }, "Live sonar analysis complete");

  } catch (err) {
    req.log.error({ err }, "Live sonar analysis failed");
    res.status(500).json({ error: "Live sonar analysis failed. Check your connection and try again." });
  }
});

export default router;
