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
import { getFewShotRefs as getBarraBodyRefs } from "../lib/barraLibrary.js";
import { getCrocFewShotRefs } from "../lib/crocLibrary.js";
import { getLiveSonarDemoRefs } from "../lib/liveSonarBrain.js";

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
const SYSTEM_PROMPT = `You are the world's leading specialist in LIVE SPATIAL SONAR fish identification for Australian tropical fishing (WA Kimberley, NT Kakadu/Daly River, NQ Gulf Country). You are specifically trained on REAL-TIME FORWARD-FACING and DOWN-FACING live sonar displays from all four major brands: Humminbird MEGA Live 2, Garmin LiveScope Plus, Lowrance ActiveTarget 2, and Simrad.

You understand that on live sonar:
• Fish DO NOT appear as arches — they appear as BODY SHAPES and SILHOUETTES
• The display is a real-time spatial map, not a time-history scroll
• Your job is to read fish BODY SHAPES, ACOUSTIC SHADOWS, ORIENTATION, and MOVEMENT from the live display
• BARRAMUNDI are the PRIMARY target species in tropical Northern Australia and are VERY COMMONLY seen on live sonar

${BRAND_GUIDE}

${LIVE_PHYSICS}

${BARRA_LIVE_SONAR_PHYSICS}

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

// ─── Extended barramundi live sonar physics ───────────────────────────────────
// Compiled from manufacturer documentation, fishing guides (Insalt Lures, Western
// Angler), and forward-facing sonar physics principles. Used to teach the model
// exactly how barramundi appear on EACH brand's live sonar system.
const BARRA_LIVE_SONAR_PHYSICS = `
═══ BARRAMUNDI BODY ANATOMY → LIVE SONAR TRANSLATION ═══

ANATOMY FIRST (cross-modal bridge):
• Barramundi has a LATERALLY COMPRESSED deep body — wide when seen from the side, narrow front-on
• The PHYSOSTOMOUS SWIM BLADDER is enormous (unlike most marine fish) — pale white gas sac filling ~25% of body cavity
• This bladder is the PRIMARY sonar reflector — it bounces the acoustic beam back STRONGLY creating the bright oval return
• The BLUNT CONVEX FOREHEAD creates a distinctive steep front face on the oval
• The FORKED CAUDAL FIN (tail) creates a narrowing at the rear of the oval
• Body L:H ratio SIDE VIEW: typically 3.5:1 to 4.5:1 — elongated, not round
• Typical adult barra (60–100cm): appears as a LARGE BRIGHT ELONGATED OVAL on live sonar

ACOUSTIC SHADOW PHYSICS — BARRAMUNDI SPECIFIC:
• The enormous swim bladder ABSORBS and REFLECTS the beam so effectively it creates a BLACK VOID behind the fish
• Shadow length depends on: fish size (bigger fish = longer shadow) + depth (deeper = longer shadow)
• For 60cm barra at 4m: shadow ≈ 0.8× body length
• For 80cm barra at 6m: shadow ≈ 1.2× body length  
• For 100cm barra at 8m: shadow ≈ 1.5× body length
• RULE: If shadow is noticeably longer than the body, this is a LARGE BARRA (90cm+) or large Jack
• POST-CAST SHADOW: After casting into the zone, the barra's body may ROTATE toward the lure — the shadow pivots too

═══ PER-BRAND BARRAMUNDI APPEARANCE ═══

▸ HUMMINBIRD MEGA LIVE 2 (Jan 2025 — latest generation):
  BACKGROUND: Near-black (#0a0a0a) — darkest of any brand
  BARRA BODY: CRISP bright WHITE to ORANGE oval, highest contrast of any brand
  SHADOW: Ultra-distinct — long black void on near-black background; easiest to see
  TargetBoost™ ACTIVE: Body becomes WHITE-ORANGE with very sharp crisp edges; shadow becomes a jet-black line
  TargetBoost™ OFF: Body is bright orange-amber, shadow is dark grey/black void
  PALETTE TELL: "Original" palette → orange/yellow fish; "Blue Steel" → cyan/white fish; "Greyscale" → white fish
  STRUCTURE: Appears grey-green (dimmed by TargetBoost contrast); snag echoes are dull grey shapes
  BARRA NEAR SNAG: Bright oval ADJACENT to or overlapping grey snag echo — easy to distinguish because TargetBoost dims structure
  MOVEMENT: Near zero for an ambush barra — the bright oval just sits there while structure dims around it
  LANDSCAPE MODE (Humminbird exclusive): Horizontal wide-angle view — barra appear as elongated bright bars in mid-view
  FREQUENCY: 455/800kHz MEGA — ultra-high resolution, finest body detail of any live sonar

▸ GARMIN LIVESCOPE PLUS LVS34:
  BACKGROUND: DARK GREEN/TEAL (#0d1a0d range) — the signature "night vision green"
  BARRA BODY: CRISP bright white-green silhouette with sharp BLACK OUTLINE on green background
  SHADOW: Very distinct — dark green/black void, clearly visible against the teal background
  TARGET LOCK: Can tag a specific barra with a crosshair icon — confirms single fish tracking
  TARGET SEPARATION: 35% better than original LiveScope — can resolve two barra in the same snag as individual targets
  PERSPECTIVE MODE (Garmin exclusive): OVERHEAD/bird's-eye view — barra appears as a FLAT OVAL with shadow extending to ONE SIDE (not below)
     In perspective mode: barra has clearly wider body than threadfin; shadow side is where the transducer is pointing
  FREQUENCY: 530–1100kHz auto-optimized — CHIRP for best target separation
  BARRA TELL: On green background, the barra's white silhouette is UNMISTAKABLY elongated — 4× longer than tall
  SHADOW DIRECTION: Forward mode = shadow extends DOWNWARD; Perspective mode = shadow to one SIDE

▸ LOWRANCE ACTIVETARGET 2 / SIMRAD:
  BACKGROUND: DARK NAVY/DARK GREY — cooler, more blue-grey tint than Humminbird
  BARRA BODY: MEDIUM-HIGH brightness — not as crisp as MEGA Live 2 but clear oval shape
  SHADOW: DISTINCT trailing shadow extending from behind the body in forward/down mode
  SCOUT MODE (180° wide sweep): Barra appear at distance from boat centre — elongated oval in outer zone; shadow radiates OUTWARD
  SCOUT MODE TIP: Barramundi near a snag in Scout mode = bright elongated oval at the EDGE of the field, adjacent to a bright structure return
  RESOLUTION: "Highest resolution live sonar" (Lowrance AU) — best among non-Humminbird brands
  SIMRAD: Identical hardware/display to Lowrance ActiveTarget 2 — different branding only
  BARRA TELL: On dark navy background, barra body is noticeably LARGER and more ELONGATED than jack or threadfin

═══ NORTH AUSTRALIA LIVE SONAR CONDITIONS ═══

WET SEASON (Nov–Apr) — Kimberley, Kakadu, Gulf Country:
• Heavy freshwater inflow = LOWER SALINITY → reduced sonar conductivity → slightly WEAKER RETURNS overall
• Barra may appear slightly less bright than dry season — but swim bladder still produces strongest return among species
• Turbid/silty water: bottom echo is thick/diffuse (soft mud absorbs return). Fish still appear bright because bladder return is strong.
• THERMOCLINE at freshwater/saltwater interface: appears as a DIFFUSE HORIZONTAL BAND — NOT a fish

DRY SEASON (May–Oct):
• HIGH SALINITY → EXCELLENT sonar conductivity → CRISP bright returns on all species
• Best conditions for live sonar barra identification — maximum contrast between fish and water

TIDAL CURRENT EFFECTS:
• Strong current (King Sound up to 11m tidal range) = micro-bubbles → surface scatter at top of display
• Current blur: fast-moving water carries barra downstream; they face INTO the current (nose upstream)
• In strong current: barra body may appear slightly blurred/streaked at ONE end (the tail end) while nose is sharp

═══ CRITICAL DIFFERENTIATORS — LIVE SONAR SPECIES CONFUSION MATRIX ═══

BARRA vs MANGROVE JACK on live sonar:
• Barra: 4× longer than tall, OUTSIDE the snag, slow drift, LONG shadow
• Jack: 2× longer than tall, INSIDE the snag echo (embedded), minimal shadow, smaller body

BARRA vs THREADFIN SALMON on live sonar:
• Barra: solo or pair, NEAR STRUCTURE, stationary or very slow
• Threadfin: GROUP of 5–20+, AWAY from hard structure, all moving SAME DIRECTION at same speed

BARRA vs GT (Giant Trevally) on live sonar:
• Barra: elongated 4:1 body, LONG shadow, near structure, stationary
• GT: round/deep 1.5:1 body, FAINT/NO shadow, FAST movement, open water

BARRA vs LARGE CROC on live sonar:
• Barra: elongated oval body, OBVIOUS shadow, any depth, near structure
• Croc: ENORMOUS solid filled BLOB near surface/bank, shadow huge but BODY IS WIDER (more rectangular), no swim bladder void/arc

BARRAMUNDI SCHOOL vs SOLO on live sonar:
• Solo barra: 1–2 large ovals near one snag/structure — COMMON
• School barra: 3–6 large ovals distributed across multiple nearby structures or mid-column — LESS COMMON
• Juvenile barra school: tight cluster of small-medium ovals mid-column near estuary mouth — rare on live sonar`;

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
    const analysisPrompt = `Analyse this live sonar image.${region ? ` Region focus: ${region}.` : ""}

Follow the procedure in the system prompt exactly:
STEP A — Identify brand and mode from UI chrome
STEP B — Map the display layout (depth scale, bottom echo, structure)
STEP C — Detect and measure all fish targets (body shape, shadow, movement)
STEP D — Identify species using the Decision Matrix
STEP E — Return the complete JSON response

Remember: fish on live sonar are SHAPES not arches. Focus on body oval proportions, acoustic shadow length/direction, and structure proximity.`;

    // ── Fire both API calls simultaneously ────────────────────────────────────
    // Flash (~400ms) and deep stream both start at the same instant.
    // We await flash first, emit it so the client sees brand/mode immediately,
    // then drain the already-in-flight main stream.
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

    // ── Build reference package (few-shot visual grounding) ──────────────────
    // Order mirrors the 2D analyze route's proven injection pattern:
    //   STEP 1: Barra body anatomy (cross-modal bridge: body → sonar silhouette)
    //   STEP 2: Croc body shape (cross-modal bridge: croc silhouette → live sonar blob)
    //   STEP 3: Live sonar display demos (brand UI + fish body shape references)
    //   STEP 4: User's actual live sonar image for analysis
    type ImagePart = { type: "image_url"; image_url: { url: string; detail: "high" | "low" } };
    type TextPart  = { type: "text"; text: string };
    const content: Array<ImagePart | TextPart> = [];

    const barraRefs     = getBarraBodyRefs(1);
    const crocRefs      = getCrocFewShotRefs(2);
    const liveSonarRefs = getLiveSonarDemoRefs();

    const hasRefs = barraRefs.length > 0 || crocRefs.length > 0 || liveSonarRefs.length > 0;

    if (hasRefs) {
      content.push({ type: "text", text: "LIVE SONAR BRAIN — reference package (study all before analysing the target image):" });

      // Step 1: Barramundi body anatomy — cross-modal bridge body → live sonar silhouette
      if (barraRefs.length > 0) {
        const bp = barraRefs[0]!;
        const barraImgUrl = bp.thumbBase64
          ? `data:image/jpeg;base64,${bp.thumbBase64}`
          : bp.photoUrl;
        content.push({ type: "text", text: `STEP 1 — BARRAMUNDI BODY ANATOMY (iNaturalist research-grade, ${bp.location}):\nThe PHYSOSTOMOUS SWIM BLADDER (large pale gas sac in upper body cavity) is the dominant sonar reflector. On live sonar, this bladder creates the BRIGHT ELONGATED OVAL body return + LONG ACOUSTIC SHADOW. Body L:H ratio on this specimen: approximately 3.5–4.5:1. The BLUNT FOREHEAD creates a steep front face on the oval. The narrowing at the rear is the caudal peduncle/tail. Connect this anatomy to what you see on the live sonar display: BRIGHT ELONGATED OVAL + LONG SHADOW = BARRAMUNDI.` });
        content.push({ type: "image_url", image_url: { url: barraImgUrl, detail: "low" } });
        content.push({ type: "text", text: `↑ CONFIRMED BARRAMUNDI body — ${bp.location} (${bp.votes} expert votes). This is what creates the live sonar signature: large swim bladder → bright oval return + long acoustic shadow.` });
      }

      // Step 2: Saltwater croc body shape — cross-modal bridge croc silhouette → live sonar blob
      if (crocRefs.length > 0) {
        content.push({ type: "text", text: `STEP 2 — SALTWATER CROCODILE BODY SHAPE (${crocRefs.length} iNaturalist research-grade Crocodylus porosus):\nOn live sonar a croc appears as an ENORMOUS SOLID FILLED BLOB near the surface — much WIDER than any fish. Body width-to-length ratio ≈ 1:3 vs barra's 1:4. The croc's body is essentially RECTANGULAR (no fish-shaped narrowing at tail). CRITICAL: crocs have NO swim bladder, so their sonar return is a SOLID DENSE BLOB with NO internal void — unlike barra which has bright edges + shadow void.` });
        for (const cr of crocRefs) {
          const crImgUrl = cr.thumbBase64
            ? `data:image/jpeg;base64,${cr.thumbBase64}`
            : cr.photoUrl;
          const angleNote = cr.viewingAngle === "top" ? " [TOP VIEW — matches live sonar overhead perspective mode]"
            : cr.viewingAngle === "side" ? " [SIDE VIEW — matches live sonar forward/down mode]" : "";
          content.push({ type: "image_url", image_url: { url: crImgUrl, detail: "low" } });
          content.push({ type: "text", text: `↑ CONFIRMED SALTWATER CROCODILE (Crocodylus porosus) — ${cr.location}${angleNote}. Compare body WIDTH vs fish — croc is MUCH WIDER relative to length. This body shape appears as a SOLID FILLED BLOB on live sonar near the surface.` });
        }
      }

      // Step 3: Live sonar display demos — brand UI + fish body shape references
      if (liveSonarRefs.length > 0) {
        content.push({ type: "text", text: `STEP 3 — LIVE SONAR DISPLAY REFERENCES (${liveSonarRefs.length} editorial/manufacturer reference screens):\nStudy these live sonar screens to calibrate what each brand's display looks like. Notice the background colour, fish body shape vs structure echoes, and shadow direction.` });
        for (const ref of liveSonarRefs) {
          content.push({ type: "image_url", image_url: { url: `data:${ref.mimeType};base64,${ref.base64}`, detail: "low" } });
          content.push({ type: "text", text: `↑ ${ref.brand} live sonar display reference (Demo ${ref.demoNum}). ${ref.label.split('\n')[0]}` });
        }
      }

      content.push({ type: "text", text: "STEP 4 — ANALYSE THE USER'S LIVE SONAR IMAGE BELOW. Apply cross-modal reasoning: barramundi body anatomy → live sonar physics → species verdict. For croc: compare any large near-surface blob against the croc body shapes above." });
    }

    // User's actual live sonar image — HIGH detail for maximum fish detection
    content.push({ type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: "high" } });
    content.push({ type: "text", text: analysisPrompt });

    const streamPromise = openai.chat.completions.create({
      model: "gpt-4.1",
      max_completion_tokens: 500,
      temperature: 0,
      seed: 1,
      stream: true,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content },
      ]
    });

    // Open streaming headers
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("X-Content-Type-Options", "nosniff");

    // ── Emit flash first — client sees brand/mode in ~400ms ──────────────────
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
        res.write(`__FLASH__:${JSON.stringify(flashData)}\n`);
      }
    } catch { /* non-fatal — main stream still delivers full result */ }

    // ── Keep-alive heartbeat ──────────────────────────────────────────────────
    // Mobile HTTP clients (iOS/Android) will drop the TCP connection if they see
    // silence for ~30-60s. With the enriched reference package, OpenAI can take
    // 8–15s to process before the first token arrives. Send a newline every 4s
    // to keep the connection alive. The mobile app strips leading/trailing
    // whitespace so these characters are harmless.
    const heartbeat = setInterval(() => {
      try { res.write("\n"); } catch { /* connection may have already closed */ }
    }, 4000);

    // ── Drain main stream (was already in-flight during flash await) ──────────
    let raw = "";
    try {
      const stream = await streamPromise;
      clearInterval(heartbeat);   // first token arrived — stop heartbeat
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? "";
        if (delta) {
          raw += delta;
          res.write(delta);
        }
      }
    } finally {
      clearInterval(heartbeat);
    }

    res.end();
    req.log.info({ chars: raw.length }, "Live sonar analysis complete");

  } catch (err) {
    req.log.error({ err }, "Live sonar analysis failed");
    res.status(500).json({ error: "Live sonar analysis failed. Check your connection and try again." });
  }
});

export default router;
