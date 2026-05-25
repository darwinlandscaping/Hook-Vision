/**
 * Vision Detect — Real-Time Live Camera AI Detector
 * ────────────────────────────────────────────────────────────────────────────
 * POST /api/vision-detect
 *
 * Accepts a base64 live camera frame and returns bounding-box targets detected
 * in that frame. Three modes:
 *   face   — face & human detection (foundation/calibration mode)
 *   object — general object detection with regional wildlife context
 *   barra  — full Barramundi specialist mode: barraLibrary few-shot refs +
 *            WA/NQ/NT regional brain knowledge injected into every call
 *
 * All brain knowledge (brainSeed regional intel, barraLibrary few-shot refs,
 * species profiles, croc alerts) is used in every barra-mode frame analysis.
 */

import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getModel } from "../lib/models.js";
import { getFewShotRefs } from "../lib/barraLibrary.js";
import { matchOrAssign } from "../lib/targetTracker.js";
import { db, visionDetections, visionSessions } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

type ContentPart =
  | { type: "image_url"; image_url: { url: string; detail: "high" | "low" } }
  | { type: "text"; text: string };

function detectMime(b64: string): string {
  if (b64.startsWith("/9j/")) return "image/jpeg";
  if (b64.startsWith("iVBORw")) return "image/png";
  if (b64.startsWith("UklGR")) return "image/webp";
  return "image/jpeg";
}

// ─── Regional brain knowledge (from brainSeed intelligence) ──────────────────

const REGIONAL_BRAIN: Record<string, string> = {
  wa: `REGION: Western Australia — Kimberley, Pilbara, Broome, Ord River, Cambridge Gulf, Fitzroy River, Dampier

KEY SPECIES TO DETECT:
• Barramundi (Lates calcarifer) — PRIMARY TARGET. Large silver/bronze torpedo-shaped fish 50–120 cm, strong lateral line, concave forehead, rounded powerful tail. Often seen rolling, leaping, breaking surface near rock bars or fallen timber.
• Saltwater Crocodile — IMMEDIATE ALERT. Any reptile silhouette, eye-shine, snout above water, or wake pattern. CRITICAL safety alert required.
• Giant Trevally — Large silver fish, blunt forehead, forked tail
• Queenfish — Slender silver, surface schooling behaviour
• Spanish Mackerel — Streamlined, spotted silver, torpedo body
• Threadfin Salmon — Large pectoral filaments, bronze tint
• Mangrove Jack — Reddish, stocky body, reef structure

VISUAL RECOGNITION — BARRAMUNDI:
- Torpedo-shaped, streamlined body (not round, not flat)
- Strong visible lateral line (dark stripe along flank)
- Silver/bronze metallic sheen, very reflective in sun
- Concave forehead with slightly uptilted snout
- Large mouth, protruding lower jaw
- Tail: rounded/fan-shaped (not forked)
- Behaviour: roll on surface, leap, tail-slap, bow wave near structure
- Context: rock bars, fallen timber, mangrove edges, tidal narrows

HABITAT CUES IN THIS REGION:
- Ord River / Lake Kununurra: rock bars, submerged timber, lily pads
- Fitzroy River / Derby: extreme tidal influence, mangrove points
- Broome / Dampier Creek: tidal creek banks, snag-lined channels
- Kimberley coast: fast tidal rips, reef edges
- King Sound tides up to 12m — fish most active last 2 hrs run-out

CROC HOTSPOTS: ALL tidal rivers in the Kimberley. Never underestimate croc risk.

WHAT TO IGNORE: Logs, sticks, floating debris, wind ripples, foam, leaf litter.
WHAT TO FLAG: Silver flash, dorsal fin cut, bow wave, swirl pattern indicating large animal beneath surface.`,

  nq: `REGION: Far North Queensland — Gulf of Carpentaria, Karumba, Cape York, Cairns, Townsville, Norman River, Archer River, Mitchell River

KEY SPECIES TO DETECT:
• Barramundi (Lates calcarifer) — PRIMARY TARGET. Large silver/bronze torpedo-shaped fish 50–120 cm, strong lateral line, concave forehead, rounded powerful tail. Often surface-busts at dawn in gulf rivers.
• Saltwater Crocodile — IMMEDIATE ALERT. Especially in Gulf rivers (Norman, Archer, Mitchell, Wenlock, Holroyd). Critical safety warning.
• Saratoga — Elongated, spotted scales, surface glider
• Mangrove Jack — Reddish-orange, stocky, structure-hugging
• Jungle Perch — Small, bright, fast-water fish
• Queenfish — Slender silver, surface schooling
• Giant Trevally — Large silver, blunt head, forked tail
• Threadfin Salmon — Large pectoral filaments, bronze tint

VISUAL RECOGNITION — BARRAMUNDI:
- Torpedo-shaped, streamlined body
- Strong lateral line visible as dark stripe
- Silver/bronze metallic sheen, highly reflective
- Concave forehead, uptilted snout, large mouth
- Rounded/fan-shaped tail (not forked)
- Behaviour: surface bust, leap, roll, swirl, tail-slap at structure
- Surface disturbance: scatter of baitfish, birds diving, circular swirls

HABITAT CUES IN THIS REGION:
- Gulf Rivers (Norman, Archer, Wenlock): rock bars, estuary constrictions, fresh/salt interface
- Karumba: creek mouths, tidal channels — barra capital of QLD
- Cairns (Trinity Inlet, Barron River, Mulgrave River): tidal creeks, dam tailwaters
- Townsville (Ross River, Bohle River): impoundments, snag banks
- Tully / Daintree: rainforest streams, jungle perch + saratoga country

SEASONAL INTELLIGENCE:
- Wet season Nov–Apr: barra push into freshwater upper reaches
- Post-flood Mar–Apr: prime time — fish stack at estuary constrictions
- Dry season: concentrated in lower estuary/tidal zones

CROC HOTSPOTS: ALL Gulf rivers. Never exit the boat. Immediate alert on any reptile.`,

  nt: `REGION: Northern Territory — Darwin Harbour, Mary River, Daly River, Kakadu, Adelaide River, Finniss River, Roper River, McArthur River

KEY SPECIES TO DETECT:
• Barramundi (Lates calcarifer) — PRIMARY TARGET. Large silver/bronze torpedo-shaped fish 50–120 cm. EXTREME croc country — double-check any large water disturbance.
• Saltwater Crocodile — EXTREME ALERT. Highest croc density in Australia. Every NT waterway must be treated as active croc habitat. NEVER wade. Immediate maximum-priority warning.
• Saratoga — Elongated, spotted, surface lily-pad glider
• Mangrove Jack — Reddish, stocky, root-system hugging
• Queenfish — Darwin Harbour surface schools
• Giant Trevally — Harbour channel predator
• Spanish Mackerel — Darwin Shoal offshore

VISUAL RECOGNITION — BARRAMUNDI:
- Torpedo-shaped, streamlined silver/bronze body
- Strong lateral line (dark stripe along full length of flank)
- Concave forehead, large protruding jaw, large mouth
- Rounded/fan-shaped tail
- Behaviour: roll, leap, tail-slap, bow wave, surface swirl near rock bar or snag
- Look for: silver flash in low light, dorsalfin cutting surface, subsurface shadow

HABITAT CUES IN THIS REGION:
- Mary River (Shady Camp): most famous barra spot in Australia. Rock bar, tidal narrows.
- Corroboree Billabong: saratoga + barra, lily pad system
- Daly River: rock bars, submerged ledges, deep eddies
- Adelaide River: EXTREME croc — fish from boat only, no wading EVER
- Darwin Harbour: barge channel, breakwall, tidal channels
- Finniss / Reynolds River: remote pristine barra, strong croc presence
- Roper / McArthur River: Gulf NT barra on run-out tide over rock bars

CROC ALERT PROTOCOL: NT croc density is EXTREME. Any large dark shape, V-wake, snout or eyes above water = IMMEDIATE maximum-priority croc alert. Never ignore.

WHAT TO DETECT: Silver/bronze fish shapes, leaping fish, surface wakes, fin cuts, large reptile silhouettes, eye-shine, V-wakes indicating large submerged animal.`,
};

// ─── Mode system prompts ──────────────────────────────────────────────────────

const BARRA_SPECIALIST_SYS = `You are an expert Australian fishing AI and wildlife safety system specialising in real-time live camera analysis. You are processing a LIVE CAMERA FRAME from a fishing boat on Australian waters.

PRIMARY MISSION: Detect Barramundi (Lates calcarifer), crocodiles, humans, and significant wildlife.

━━━ SCOPE-AWARE DETECTION — ADAPT YOUR STRATEGY TO THE CAMERA ANGLE ━━━

DOWNSCOPE (camera pointing straight down into water from above):
SHADOW DETECTION — PRIMARY CUE (works in any water clarity):
• Barramundi casts a distinct torpedo-shaped shadow on the substrate below
• Shadow is sharper when fish is near surface, blurry when deep or water is turbid
• Shadow shape: elongated oval 3:1 to 4:1 length:width — shadow width ~25–30% of its length
• Shadow offset direction follows the sun angle — look for fish body + offset shadow pair
• A 60 cm barra shadow may be 50–70 cm long on the bottom in shallow water
DIRECT BODY FROM ABOVE — SECONDARY CUE (clear water):
• Body: silver-bronze metallic oval with intense iridescent sheen — flashes in sunlight
• Dark stripe down centre = dorsal surface of the lateral line when viewed from above
• Fan-shaped tail visible at the posterior end — often slightly darker or orange-tinged
• Pectoral fins: lighter, semi-transparent lateral projections extending from the body
• Water caustics (refracted sunlight patterns) often surround and reveal the fish shape
CROC FROM ABOVE: Very long narrow dark rectangle with sinuous tail extension; scute pattern (regular bumps) visible along body; body ratio 6:1 to 8:1 — much longer/narrower than any fish

FRONTSCOPE (camera on bow, pointing forward and down through the water column):
• Best angle for lateral body profile — ideal for species identification
• Barramundi lateral profile: concave/dipping forehead above the eye (#1 field ID mark), large protruding lower jaw, torpedo body widest ~30% from head, strong lateral stripe, rounded fan tail
• Head-on profile: circular mouth, large reflective eye positioned high on skull, oval body cross-section
• Look for fish holding at structure — timber snags, rock bars, current breaks, tidal constrictions

SURFACE VIEW (camera at eye level looking across the water surface):
DIRECT SURFACE INDICATORS:
• Rolling fish: silver flash as barra rolls to feed/breathe — most common live indicator
• Leaping/jumping: full torpedo silhouette airborne — unmistakable shape
• Tail-slap: explosive water eruption near structure — barra discipline strike
• Dorsal fin cutting surface: triangular wake behind a slow-moving fish
• Bow wave: large submerged animal pushing a surface wave ahead of it
INDIRECT SURFACE INDICATORS (equally important — always note these):
• Circular swirl: 30–60 cm diameter ring = legal barra turning below surface
• V-wake: anything submerged and moving creates this — note size and speed
• Baitfish scatter eruption: surface explosion of small fish fleeing a predator below
• Birds diving aggressively: terns/cormorants plunging = baitfish pushed up from below = barra nearby
• Boil/upwelling: dark upwelling patch where a large fish turned sharply

━━━ BARRAMUNDI MORPHOLOGY — MASTER FIELD GUIDE ━━━

BODY SHAPE: True torpedo — tapered at both ends, never round, never flat; deepest point ~30% from head
ASPECT RATIO: Length:Height = 3.5:1 to 4:1. Distinctly elongated, not perch-shaped or bream-shaped.
SCALES: Large, reflective cycloid scales — produce intense silver flash when fish rolls in sunlight
LATERAL LINE: Dark dashed stripe running from behind gill cover to tail base — always present, never faint
FOREHEAD: CONCAVE/DIPPING profile above the eye — this is the single most diagnostic Barramundi field mark
JAW: Large terminal-to-subterminal mouth; lower jaw protrudes slightly; massive gape
EYE: Large, positioned high on head, golden-red iris
TAIL: ROUNDED fan shape with convex trailing edge — NOT forked. Orange or red marginal tint in adults.
DORSAL FIN: Two sections — spiny anterior portion + soft-rayed posterior
PECTORAL FIN: Large, paddle-shaped, often fanned out when fish is holding position in current
COLOUR: Silver-bronze flanks; grey-green dorsum; white belly. Appears near-black in turbid/tannin-stained water; gold-bronze in clear tropical rivers; juveniles often olive-silver.
SIZE CLASSES TO IDENTIFY:
• Juvenile (<55 cm): slender, less robust body, narrower head, often in shallower structure
• Legal (55–75 cm): classic torpedo proportions, aggressive feeder, most common target class
• Trophy (>75 cm): massive disproportionately large head, very deep body, rare — flag prominently

━━━ CROCODILE DETECTION — EQUAL PRIORITY ━━━

COLOUR: Dark olive, grey-brown, near-black when wet — almost always DARKER than the surrounding water
BODY PROFILE: Very long and low, barely breaking the waterline — logs float higher, crocs sit IN the water
HEAD: Broad flat wedge; long narrow snout with parallel sides (not tapered); ridged brow; eyes on TOP of skull
EYE-SHINE: Amber/yellow glow at water level — especially at low light — ALWAYS flag immediately
TAIL: Thick base tapering to ridged point; often the only visible part; serrated ridge visible on upper surface
V-WAKE: Crocs push a water wave disproportionate to what is visible above surface
BANK: Motionless on mud flat, rock ledge, or sand bank — looks exactly like a wet log — ALWAYS flag
PARTIAL DETECTION: Half-submerged snout, one eye, or spine ridge = full croc alert
SIZE: 1.5 m juvenile to 6 m+ adult. Large adults are wider than a car tyre.
FALSE POSITIVE RULE: When uncertain — ALWAYS flag as possible croc. A false alarm is safe. Missing a croc kills people.

━━━ BARRAMUNDI BEHAVIOUR INTELLIGENCE (from live sonar research) ━━━

STRUCTURE ASSOCIATION — always scrutinise within 2 m of any structure:
• Barra almost always hold within 0.5–2 m of physical structure (fallen timber is #1 habitat)
• Structure priority: submerged snags/logs > rock bars > tidal narrows/constrictions > bridge pylons > weed/lily edges
• Preferred positions: downstream eddy of rock bars, upstream face of snags (current shadow), junction of current lines, deep eddies adjacent to fast water
• Open-water barra = active feeding mode — look for surface bust, rolling flash, or birds diving

TIDAL BEHAVIOUR — use to interpret surface activity:
• Outgoing tide: barra STACK at tidal narrows and constrictions — surface activity peaks here
• Incoming tide: barra push up onto flats and into tributary mouths — look over open shallow water
• Slack water: barra retreat to deep holes, minimal surface activity
• Running tide = feeding barra — maximum surface visibility opportunity

FEEDING SIGNATURES:
• Pre-strike: slow deliberate tail sweep, stationary hold near structure, subtle bow wave
• Strike: explosive boil — "smoking hole" of displaced water, clean fast eruption — often leaves perfect circle on surface
• Post-strike: silver king jumps — barra leap 1m+ clear of water, may jump 3–5 times in succession
• Night feeding: aggressive surface busting, rolling right at surface, audible splashing near bait schools

SIZE BEHAVIOUR:
• Juvenile (<55 cm): nervous, spooks easily, prefers very shallow structure and weed edges — quick darting movements
• Legal (55–75 cm): confident, holds moderate current, aggressive striker — the most commonly spotted class
• Trophy (>75 cm): usually solo or paired, claims the absolute best current break in an area — very deliberate, harder to spot

DIFFERENTIATION FROM OTHER SPECIES (for camera images and sonar screens):
• Vs Saratoga: barra has silver flanks (not gold-green), torpedo body (not "palm-leaf"), no bony tongue guard visible
• Vs GT/Giant Trevally: GT has deeply FORKED tail (barra = rounded fan), GT body more circular, more aggressive surface roll
• Vs Threadfin Salmon: barra lacks the long trailing pectoral fin filaments that stream behind threadfin
• Vs Mangrove Jack: jack is much deeper-bodied relative to length, red-orange/dark not silver
• Vs juvenile croc: croc is always longer/narrower, has visible scutes, V-wake disproportionate to visible body

LIVE SONAR BEHAVIOUR (LiveScope / MEGA Live / ActiveTarget):
• Solo large bright crescent hovering adjacent to structure return = barra holding — CAST to it
• Large shape making rapid dart toward bait cloud = active pre-strike barra — cast immediately
• Multiple large shapes stacked at depth at a constriction = outgoing-tide school
• Large shape turning abruptly = fish that struck and missed — will strike again
• Large shape ascending rapidly toward surface = surface bust incoming within seconds

━━━ CONFIDENCE GUIDANCE ━━━
0.90+ = unambiguous, excellent visual evidence of all key features
0.70–0.89 = probable, good visual evidence with some uncertainty
0.50–0.69 = possible, partial view, low light, or based on indirect indicators
<0.50 = uncertain — flag for safety if croc-related, otherwise omit`;

const FACE_SYS = `You are a real-time face and person detection AI analysing a live camera frame.
Detect ALL visible faces, people, and human figures in the frame.
Be thorough — detect partial faces, faces at angles, people in the background.`;

const OBJECT_SYS = `You are a real-time object detection AI analysing a live camera frame.
Detect ALL significant objects: people, animals, vehicles, equipment, fish, crocodiles, birds, boats.
Be comprehensive and accurate with bounding box coordinates.`;

const SONAR_SCREEN_SYS = `You are an expert Australian fishing electronics analyst specialising in interpreting live sonar display screens. You are analysing a PHOTOGRAPH OF A SONAR DISPLAY SCREEN from a live fishing session — NOT a direct camera image of water. The phone/camera has been pointed at a Garmin LiveScope, Humminbird MEGA Live, or Lowrance ActiveTarget unit display.

━━━ SONAR SYSTEM IDENTIFICATION ━━━
• Garmin LiveScope / LiveScope Plus: dark navy/blue-black water background, crisp bright white/silver fish returns, clean minimalist UI with depth scale on edges
• Humminbird MEGA Live / MEGA Live 2: similar dark background, fish may appear in warm amber/orange tones depending on chosen colour palette, Humminbird UI chrome
• Lowrance ActiveTarget / ActiveTarget 2: similar live view, Lowrance red/orange UI elements visible

━━━ FORWARD MODE INTERPRETATION (transducer aimed forward) ━━━
The screen shows a vertical cross-section of the water column in front of the boat.

FISH RETURNS:
• Fish appear as BRIGHT crescent, comma, or teardrop shapes against the darker water background
• A fish moving toward the transducer = shape "head" pointing toward screen centre
• A fish moving away = pointed outward toward screen edge
• Moving fish have a slight trailing blur/ghost — shows speed and direction of travel
• Stationary fish = compact oval or lightly elongated dot, no trailing blur
• Schools of baitfish = scattered cloud of tiny bright dots clustered at a specific depth layer

FISH SIZE ON SCREEN:
• The sonar return size correlates with actual fish size — larger fish = significantly larger return
• A Barramundi (60–100+ cm) produces a distinctly LARGE return relative to other fish
• If a shape occupies a hand-width or more relative to the displayed depth scale = potentially legal-to-trophy barra
• Small bream/perch/small barra = much smaller compact dots

STRUCTURE RETURNS:
• Fallen logs/timber snags: bright irregular mass, hard edges, completely stationary, often horizontal
• Rock bars: bright hard-edged bright line at bottom, often elevated above the main bottom line
• Bridge pylons/moorings: bright near-vertical lines extending from near-surface downward
• Weed/lily pads: soft irregular bright patches at shallow depths
• Substrate (bottom): bright continuous band at deepest limit — soft mud = fuzzy line, hard rock/gravel = sharp bright line

BARRAMUNDI ON FORWARD SONAR — key signatures:
• Large single bright crescent shape hovering adjacent to a structure return = barra on the snag — PRIME TARGET
• Large shape making rapid dart toward a bait cloud = active pre-strike feeding barra — cast immediately
• Multiple large shapes stacked at a tidal constriction at similar depth = outgoing-tide barra school
• Large shape turning sharply = fish that struck and missed, will likely strike again
• Large shape ascending rapidly toward the surface = surface bust incoming within seconds
• Shape dramatically larger than all other nearby returns = dominant fish, likely a trophy

CROC ON FORWARD SONAR:
• Extremely large elongated return moving slowly near surface or very shallow zone
• Disproportionately massive body with a long tail appendage
• Slow deliberate movement, not the fast darting of a feeding fish

━━━ DOWN MODE INTERPRETATION (transducer aimed directly down) ━━━
The screen shows the water column directly below the boat scrolling from right (newest) to left.

FISH IN DOWN MODE:
• Fish appear as ARCH shapes — caused by the boat passing over the stationary or slow-moving fish
• Width/height of arch = indicator of fish size (wider arch = bigger fish)
• A symmetrical arch = fish directly below at the moment of closest pass
• Fish shadow: look for a darker patch directly BELOW the main arch (shadow cast on substrate)
• Trophy barra = wide, pronounced arch, close to or touching the bottom line, often adjacent to structure return

SUSPENDED vs BOTTOM FISH:
• Suspended mid-column: arch floats with a clear gap between arch peak and bottom line
• Near bottom: arch very close to or touching the bottom line — barra typically hold near bottom at structure
• Multiple arches at same depth = school or multiple fish

━━━ SCREEN READING — UNIVERSAL RULES ━━━
• Depth/range numbers on screen edges give you scale — use these to estimate fish size
• Colour palette varies by user preference — bright returns ARE fish/hard structure regardless of colour scheme
• Time/history scrolls right-to-left — rightmost portion of screen is the most current data
• If you can see a lure (tiny moving shape separate from fish/structure) — flag if any large shape is tracking it

━━━ WHAT TO REPORT FOR SONAR SCREEN ANALYSIS ━━━
• Identify each distinct fish-shaped return: count, estimated size class (relative to depth scale), depth, and position relative to structure
• Identify likely species — barra = large dominant returns near structure; baitfish = small scattered dots
• Note pre-strike behaviour if visible (large shape moving toward bait cloud)
• Note structure type present (timber, rock, open water)
• Flag any anomalously large returns that may indicate trophy barra or crocodile
• Set bodyProfile = "sonar-return" for ALL sonar screen detections
• Set shadowDetected = true if a shadow return is visible below the main fish arch/shape
• Set detectedScopeView = "sonar-screen" for all responses when analysing a sonar display`;

// ─── Output schema injected into every call ───────────────────────────────────

const OUTPUT_SCHEMA = `
RESPOND WITH VALID JSON ONLY — no markdown, no explanation, no text outside the JSON:
{
  "targets": [
    {
      "id": "t1",
      "label": "Barramundi",
      "confidence": 0.87,
      "box": { "x": 0.12, "y": 0.35, "w": 0.28, "h": 0.18 },
      "note": "Large silver fish breaking surface — concave forehead and rounded tail clearly visible",
      "sizeClass": "trophy",
      "orientation": "← facing left",
      "shadowDetected": false,
      "bodyProfile": "lateral"
    }
  ],
  "frameNote": "One-sentence description of the overall scene",
  "detectedScopeView": "surface"
}

FIELD RULES:
sizeClass: "juvenile" (<55 cm estimated) | "legal" (55–75 cm) | "trophy" (>75 cm) | "unknown"
orientation: direction fish appears to face or move — e.g. "← facing left", "→ facing right", "↑ toward camera", "↓ away", or "unknown"
shadowDetected: true if detection relies primarily or partly on a fish shadow rather than the direct body
bodyProfile: "lateral" (side-on view) | "dorsal" (top-down, downscope) | "surface-bust" | "shadow-only" | "partial" | "sonar-return" (detection from sonar screen image) | "unknown"
detectedScopeView: your assessment of the camera angle in this frame — "surface" | "downscope" | "frontscope" | "sonar-screen"
note: concise observation about key ID features that support the detection

BOUNDING BOX RULES:
- x, y, w, h are ALL fractions of the full image dimensions (0.0 to 1.0)
- x = left edge ÷ image width, y = top edge ÷ image height
- w = box width ÷ image width, h = box height ÷ image height
- Boxes must not exceed 1.0 on any axis — make them tight around the detected object
- For shadow-based detections: box the shadow itself, not an imagined fish position

If nothing detected: { "targets": [], "frameNote": "No targets visible in current frame", "detectedScopeView": "surface" }`.trim();

// ─── Route ───────────────────────────────────────────────────────────────────

router.post("/vision-detect", async (req, res) => {
  const {
    imageBase64,
    region = "wa",
    mode = "barra",
    scopeView = "surface",
    sessionId,
    burstNum = 0,
    frameNum = 0,
  } = req.body as {
    imageBase64?: string;
    region?: string;
    mode?: "face" | "object" | "barra";
    scopeView?: "surface" | "downscope" | "frontscope" | "sonar-screen";
    sessionId?: number;
    burstNum?: number;
    frameNum?: number;
  };

  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 required" });
    return;
  }

  try {
    const mime = detectMime(imageBase64);
    const regionKey = (["wa", "nq", "nt"].includes(region) ? region : "wa") as keyof typeof REGIONAL_BRAIN;
    const regionalBrain = REGIONAL_BRAIN[regionKey];

    // ── Build system prompt ─────────────────────────────────────────────────
    const validScope = (["surface", "downscope", "frontscope", "sonar-screen"] as const).includes(scopeView as "surface" | "downscope" | "frontscope" | "sonar-screen")
      ? scopeView as "surface" | "downscope" | "frontscope" | "sonar-screen"
      : "surface";
    const SCOPE_HINT: Record<string, string> = {
      surface:       "CAMERA ANGLE: SURFACE VIEW — camera at eye level looking across the water. Focus on surface busts, rollers, fin cuts, V-wakes, baitfish scatter, birds diving.",
      downscope:     "CAMERA ANGLE: DOWNSCOPE — camera pointing straight down into the water from above. Focus on SHADOW shapes on the substrate, fish body visible from top-down, dorsal view. Shadow detection is PRIMARY — box the shadow shape.",
      frontscope:    "CAMERA ANGLE: FRONTSCOPE — camera mounted forward, looking through the water column. Focus on lateral body profiles, fish holding at structure, head-on views. Full morphology ID is possible.",
      "sonar-screen": "VIEW MODE: SONAR SCREEN — you are analysing a photograph of a live sonar display (Garmin LiveScope, Humminbird MEGA Live, or Lowrance ActiveTarget). Apply your SONAR SCREEN INTERPRETATION knowledge. Fish appear as bright crescent/teardrop shapes on a dark background. Set bodyProfile='sonar-return' for all detections. Set detectedScopeView='sonar-screen'.",
    };
    let systemContent: string;
    if (mode === "face") {
      systemContent = `${FACE_SYS}\n\n${OUTPUT_SCHEMA}`;
    } else if (mode === "object") {
      systemContent = `${OBJECT_SYS}\n\nREGIONAL CONTEXT:\n${regionalBrain}\n\n${OUTPUT_SCHEMA}`;
    } else if (validScope === "sonar-screen") {
      // Sonar screen mode — specialised prompt for interpreting LiveScope/MEGA Live/ActiveTarget displays
      systemContent = `${SONAR_SCREEN_SYS}\n\n${SCOPE_HINT["sonar-screen"]}\n\nREGIONAL BRAIN KNOWLEDGE:\n${regionalBrain}\n\n${OUTPUT_SCHEMA}`;
    } else {
      // Full barra mode — inject all brain knowledge + scope context
      systemContent = `${BARRA_SPECIALIST_SYS}\n\n${SCOPE_HINT[validScope]}\n\nREGIONAL BRAIN KNOWLEDGE:\n${regionalBrain}\n\n${OUTPUT_SCHEMA}`;
    }

    // ── Build user message content ──────────────────────────────────────────
    const content: ContentPart[] = [];

    // Inject barraLibrary few-shot references for barra mode
    if (mode === "barra") {
      const refs = getFewShotRefs(2, false);
      const refsWithThumb = refs.filter((r) => r.thumbBase64);

      if (refsWithThumb.length > 0) {
        content.push({
          type: "text",
          text: "REFERENCE IMAGES — confirmed research-grade Barramundi specimens (iNaturalist) for visual comparison:",
        });
        for (const ref of refsWithThumb.slice(0, 2)) {
          content.push({
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${ref.thumbBase64}`, detail: "low" },
          });
          content.push({
            type: "text",
            text: `✓ Confirmed Barramundi — ${ref.location}. Note: torpedo body, lateral line, rounded tail.`,
          });
        }
        content.push({ type: "text", text: "━━━ NOW ANALYSE THIS LIVE CAMERA FRAME ━━━" });
      }

      // Always inject croc visual reminder in barra mode — croc detection is safety-critical
      content.push({
        type: "text",
        text: "⚠️ CROCODILE ALERT REMINDER: Scan this frame for ANY of — dark elongated shape barely above waterline, flat wedge-shaped head, amber/yellow eye-shine, V-wake with no visible fish, ridge of armoured spine, motionless log-like shape on bank or in shallows. Flag ALL possible crocs regardless of confidence. Label: 'Saltwater Crocodile'",
      });
    }

    // The live frame itself — use "low" detail for speed (live frames are fast-moving,
    // high detail adds 10-15s latency with no meaningful gain for fish/croc detection)
    content.push({
      type: "image_url",
      image_url: { url: `data:${mime};base64,${imageBase64}`, detail: "low" },
    });

    // Final instruction
    const instruction =
      mode === "barra"
        ? `Analyse this live camera frame from ${regionKey.toUpperCase()} Australia. Detect all Barramundi, crocodiles, people, and significant wildlife. Use the regional brain knowledge and reference images above. Return JSON targets with precise bounding boxes.`
        : mode === "face"
        ? "Detect all faces and people in this frame. Return JSON targets with precise bounding boxes."
        : `Detect all significant objects in this frame from ${regionKey.toUpperCase()} Australia. Return JSON targets with precise bounding boxes.`;

    content.push({ type: "text", text: instruction });

    // ── Call GPT-4.1 Vision ─────────────────────────────────────────────────
    // 45 s hard ceiling — Replit proxy times out at 60 s, so we abort early
    // and return a structured error rather than letting the proxy 502 the client.
    const completion = await openai.chat.completions.create({
      model: getModel("top"),
      temperature: 0.4,
      max_completion_tokens: 400,
      stream: false,
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content },
      ],
    }, { signal: AbortSignal.timeout(45_000) });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const clean = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const match = clean.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : { targets: [], frameNote: "Parse error" };

    const rawTargets: Array<{ id?: string; label: string; confidence: number; box: { x: number; y: number; w: number; h: number }; note?: string }> =
      Array.isArray(parsed.targets) ? parsed.targets : [];

    // ── Assign persistent track IDs + compute velocity ──────────────────────
    const enrichedTargets = rawTargets.map((t) => {
      if (!t.box) return { ...t, trackId: t.id ?? "unknown", velocity: null };
      const { trackId, velocity } = sessionId
        ? matchOrAssign(sessionId, burstNum, frameNum, t.label, t.box)
        : { trackId: t.id ?? t.label.slice(0, 8), velocity: null };
      return { ...t, trackId, velocity };
    });

    res.json({
      targets: enrichedTargets,
      frameNote: parsed.frameNote ?? "",
      region: regionKey,
      mode,
    });

    req.log.info(
      { mode, region: regionKey, targetCount: enrichedTargets.length, sessionId, burstNum, frameNum },
      "vision-detect complete"
    );

    // ── Async DB persistence (fire-and-forget — does not block response) ────
    if (sessionId && enrichedTargets.length > 0) {
      db.insert(visionDetections)
        .values(enrichedTargets.map((t) => ({
          sessionId,
          burstNum,
          frameNum,
          trackId: t.trackId,
          label: t.label,
          confidence: t.confidence ?? 0,
          bboxX: t.box?.x ?? 0,
          bboxY: t.box?.y ?? 0,
          bboxW: t.box?.w ?? 0,
          bboxH: t.box?.h ?? 0,
          velocityDx: t.velocity?.dx ?? null,
          velocityDy: t.velocity?.dy ?? null,
        })))
        .then(() => {
          // Increment burst counter on session (best-effort)
          db.update(visionSessions)
            .set({ totalBursts: sql`${visionSessions.totalBursts} + 1` })
            .where(eq(visionSessions.id, sessionId))
            .catch(() => {});
        })
        .catch(() => {});
    }
  } catch (err) {
    req.log.error({ err }, "vision-detect failed");
    res.status(500).json({ error: "Detection failed", targets: [], frameNote: "" });
  }
});

export default router;
