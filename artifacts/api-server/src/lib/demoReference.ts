/**
 * Demo Reference Library
 *
 * Loads the 5 labeled demo sonar images at server startup.
 * Each image is loaded TWICE:
 *   • base64      — full quality PNG (for CV analysis and zoom crops)
 *   • thumbBase64 — compressed 512px JPEG, ~30–50KB each (for few-shot prompting)
 *
 * The thumbnail is used for all OpenAI "low" detail reference injections.
 * At "low" detail OpenAI rescales to 512×512 anyway, so sending a 30KB JPEG
 * is identical in quality to sending a 2MB PNG — 50–100× less upload overhead.
 *
 * Compression: PNG → nearest-neighbour downscale to ≤512px → JPEG q65
 * Uses the already-installed jpeg-js + pngjs packages.
 */

import * as fs   from "node:fs";
import * as path from "node:path";
import { logger } from "./logger";
import { makeThumbnailFromBuf } from "./imageUtils.js";

export interface DemoRef {
  num:         number;
  base64:      string;   // full quality PNG base64 (for CV)
  thumbBase64: string;   // compressed JPEG thumbnail base64 (for OpenAI low-detail refs)
  label:       string;
  brand:       string;
  model:       string;
}

let _demoRefs: DemoRef[] = [];

/** Detailed visual ground-truth labels for each demo image */
const DEMO_LABELS: Record<number, { brand: string; model: string; label: string; mimeType?: string }> = {
  1: {
    brand: "Lowrance",
    model: "HDS Live",
    label: `DEMO 1 — LOWRANCE HDS LIVE — ANSWER: 3 BARRAMUNDI at 5.2m depth.

WHAT TO SEE IN THIS IMAGE:
• 3 distinct THICK, BRIGHT arch marks — red/orange on Lowrance palette — positioned at ~5.2m depth
• All 3 arches sit DIRECTLY ON or within 0.5m of the hard bottom echo — classic barra position
• Bottom echo is THICK and BRIGHT (hard substrate — rock bar or riprap)
• Each arch is separated from the others — individual fish, not a bait school blob
• Arch thickness (vertical height) indicates legal-size fish 55–80cm
• Small gap between each arch and the bottom line = fish in moderate feeding posture
• The UI shows Lowrance dark grey bezel, teal button accents, depth scale on right side
• Fish are on hard structure, NOT mid-column — rules out threadfin
• Arch is complete U-shape — rules out mangrove jack (which shows half-arch embedded in structure)
SPECIES CONFIRMATION: Barramundi (Lates calcarifer). Confidence should be 85%+.`,
  },
  2: {
    brand: "Garmin",
    model: "ECHOMAP UHD",
    label: `DEMO 2 — GARMIN ECHOMAP UHD — ANSWER: THREADFIN SALMON SCHOOL at 3.1m depth.

WHAT TO SEE IN THIS IMAGE:
• Multiple bright arches at ~3.1m depth — aqua/blue-white on Garmin palette
• CRITICAL: Arches are positioned in the MID-WATER COLUMN — NOT attached to or touching hard structure
• Bottom echo is THIN and relatively DIM — soft muddy/sandy substrate, NOT hard rock
• Multiple fish at same depth = school behaviour — threadfin commonly school
• NO hard structure visible — no snag, no rock bar — soft bottom habitat
• Fish appear to be hovering 1–2m off the soft bottom — threadfin feeding posture
• Garmin UI: black bezel, aqua/white colour palette on screen, depth displayed top-left
• The muddy soft bottom + mid-column position + multiple fish = threadfin, not barra
• Barra would be ON structure. These fish are floating free over soft substrate.
SPECIES CONFIRMATION: Threadfin Salmon (King Threadfin / Polydactylus macrochir). School of 4–8 fish. Confidence should be 80%+.`,
  },
  3: {
    brand: "Humminbird",
    model: "HELIX 10",
    label: `DEMO 3 — HUMMINBIRD HELIX 10 — ANSWER: FINGERMARK / GOLDEN SNAPPER (Lutjanus johnii) at 8m depth over hard rocky reef structure.

WHAT TO SEE IN THIS IMAGE:
• ONE clean, well-defined ARCH at ~8m depth
• Arch sits JUST ABOVE the hard bottom echo — not embedded inside it — classic fingermark feeding posture (lifted 0.5–2m off the rocky bottom to feed)
• Hard, ragged, IRREGULAR bottom line visible — rocky reef/rubble substrate — THE KEY FINGERMARK HABITAT TELL
• Humminbird orange-brown palette — the arch is bright orange/amber = good return from a sizeable swim bladder
• Arch shape is clean U-curve — fingermark produce clean, well-defined arches unlike mangrove jack (half-arch embedded in structure) or barra (arch right ON snag)
• Depth of 8m over rocky reef = textbook fingermark zone (fingermark: 5–30m on rock/rubble/reef)
• Environment is coastal rocky reef, NOT an estuarine tidal creek — this rules out barramundi (barra live in tidal estuaries on timber/riprap, not coastal rock reef)
• NO snag, timber, or mangrove structure visible — rules out barra and mangrove jack
• Humminbird UI: orange logo, high-contrast display, depth at top

⚠️ WHY THIS IS NOT BARRAMUNDI:
• Barra prefer ESTUARINE habitat — tidal creeks, river mouths, riprap walls, submerged timber, bridge pylons
• Barra arches sit ON hard structure (the arch merges with or sits right on the snag/rock return)
• THIS arch is ABOVE a rocky reef bottom, not on an estuarine snag — fingermark habitat
• Barra are rare on open coastal rock reef at 8m; fingermark are extremely common there

KEY DISTINCTION — FINGERMARK vs BARRA:
• Barra = estuarine snag/pylon/riprap at 2–12m with arch ON the structure echo
• Fingermark = coastal rock reef/rubble at 8–30m with arch FLOATING 0.5–2m ABOVE the reef echo
• This image = rocky reef substrate + arch above bottom = FINGERMARK, NOT barra

SPECIES CONFIRMATION: Fingermark / Golden Snapper (Lutjanus johnii). Confidence should be 85%+.`,
  },
  4: {
    brand: "Simrad",
    model: "GO9 XSE",
    label: `DEMO 4 — SIMRAD GO9 XSE — ANSWER: DUAL-LAYER MULTI-SPECIES — two distinct depth layers.

WHAT TO SEE IN THIS IMAGE:
• TWO clearly separate horizontal layers of fish marks at different depths (~7m top layer, deeper bottom layer)
• Layer 1 (shallower, ~3–5m): Multiple small arches — baitfish or smaller schooling species
• Layer 2 (deeper, ~7–9m): Larger, brighter individual arches — predator species near structure
• Simrad uses the Navico palette (similar to Lowrance) — orange/red = strong return
• The dual-layer pattern indicates multi-species situation: baitfish school above, predators below/beside
• Bottom structure is visible — hard substrate
• The larger arches in the deeper layer are bright and thick — could be barra or fingermark near structure
• Simrad GO9 UI: Simrad blue/grey branding, clean chart-plotter interface, depth and speed displayed
• When you see layers: upper layer = baitfish/smaller fish. Lower layer with big bright arches = predators.
• The predator arches in the deeper layer are on or near hard structure = barra most likely
SPECIES CONFIRMATION: Multi-species — Baitfish school (upper layer) + Barramundi or Fingermark (lower layer near structure). Report both layers. Confidence 75%+ for multi-species scenario.`,
  },
  5: {
    brand: "Humminbird",
    model: "HELIX / SOLIX Split-Screen",
    label: `DEMO 5 — HUMMINBIRD SPLIT-SCREEN (FLASHER + 2D SONAR) — ANSWER: MULTIPLE BARRAMUNDI, 5–6 FISH, open water mid-column, ~34.5ft (10.5m) total depth.

THIS IS THE MOST IMPORTANT REFERENCE IMAGE. Study it carefully.

LAYOUT OF THIS SCREEN (Humminbird split-screen):
• LEFT SIDE: Circular "flasher" wheel — a round sonar display showing current depth in real-time. The wheel has concentric colour rings (yellow/red/blue). Multiple sharp SPIKE RETURNS appear as tall orange/red/yellow vertical bars pointing outward from the wheel centre — each spike = a fish.
• RIGHT SIDE: Traditional 2D scroll sonar. The depth scale is shown on the RIGHT edge of the sonar panel (60ft, 30ft, 20ft, 40ft, 50ft, 40ft — dual scale showing depth history). Water temp shown top-right: 68.2°F. Total depth shown top-centre: 34,5 FT (34.5 feet = 10.5m).

WHAT THE FISH ARCHES LOOK LIKE (RIGHT PANEL):
• 5–6 ENORMOUS THICK BRIGHT ARCHES arranged at various depths throughout the water column
• Arch shape: wide, full U-shaped curve — very tall vertically (thick = BIG FISH)
• Arch colour: DEEP ORANGE/RED core with bright YELLOW halo — maximum signal strength — very large swim bladder
• The arches fill the water column from shallow to near-bottom (~5ft down to ~28ft)
• These are INDIVIDUAL FISH ARCHES, not a school blob — each arch is a single large fish
• Arches are NOT touching hard structure — fish are suspended/free-swimming mid-column or slightly above soft bottom
• Bottom echo visible at ~34ft: relatively thin orange line — soft/sandy substrate (NOT hard rock)

⚠️ SHADOW DETECTION — CRITICAL FEATURE OF THIS IMAGE:
• Look DIRECTLY BELOW each orange arch — you will see a DARKER BLUE/VOID ZONE beneath each arch
• This darker zone is the SONAR ACOUSTIC SHADOW — created because each barramundi's large body and massive physostomous swim bladder ABSORBS and REFLECTS the sonar beam, preventing it from passing below the fish
• The shadow appears as: a noticeably darker (deeper blue or near-black) region directly beneath the peak of each orange arch, before the next arch or the bottom echo
• The shadows in this image are LARGE and CLEARLY VISIBLE — matching the size of the fish (65–90cm barra)
• RULE: If you see a bright orange/red arch WITH a dark shadow zone beneath it on Humminbird = BARRAMUNDI. 90%+ confidence.

SPECIES CONFIRMATION: Barramundi (Lates calcarifer) — 5 to 6 fish at 5–28ft depth in open water over soft bottom. All fish are legal size 65–90cm based on arch thickness. Confidence should be 90%+.`,
  },
};

// ─── Live sonar demo labels (demos 6–9) ───────────────────────────────────────
// These are editorial/manufacturer published images of live sonar displays,
// used as visual grounding references for the live sonar analysis route.
// They show the display UI and fish body shapes on live sonar screens.
Object.assign(DEMO_LABELS, {
  6: {
    brand: "Humminbird MEGA Live 2",
    model: "MEGA Live 2",
    mimeType: "image/jpeg",
    label: `LIVE SONAR DEMO 6 — HUMMINBIRD MEGA LIVE 2 — DISPLAY REFERENCE.

WHAT THIS IMAGE SHOWS:
• MEGA Live 2 live sonar display — real-time forward-facing or down-mode view
• UI chrome: dark almost-black background; ORANGE/AMBER accent colour bars/icons typical of Humminbird
• Fish appear as BRIGHT OVAL or ELLIPTICAL bodies — NOT U-shaped arches
• TargetBoost™: when active, target fish appear with crisp bright white-orange edges against dimmed structure
• Acoustic shadow: look for a DARK VOID extending BELOW or BEHIND each fish body
• Structure echoes: dimmer, irregular shapes compared to crisp fish bodies
• Depth scale: orange/amber digits on right side

BARRAMUNDI IDENTIFICATION ON MEGA LIVE 2:
• Large elongated oval body — L:H ratio typically 3.5:1 to 5:1 (much more elongated than GT or jack)
• VERY DISTINCT long acoustic shadow — often equal to or longer than the body itself
• Positioned near or touching structure (snag, submerged timber, rock)
• Minimal movement — barramundi are ambush predators, often stationary
• In TargetBoost mode: bright white-orange crisp target with shadow line clearly visible
• Body brightness: TIER 1 (brightest) due to enormous physostomous swim bladder

THIS IS A LIVE SONAR IMAGE — no arches, only body shapes. Fish identified by silhouette + shadow.`,
  },
  7: {
    brand: "Lowrance ActiveTarget",
    model: "ActiveTarget / HDS Live",
    mimeType: "image/jpeg",
    label: `LIVE SONAR DEMO 7 — LOWRANCE ACTIVETARGET — STREAMING DISPLAY REFERENCE.

WHAT THIS IMAGE SHOWS:
• Lowrance live sonar streaming display — real-time fish visualization
• UI chrome: DARK NAVY / DARK GREY background; "ACTIVE TARGET" text label typical of Lowrance
• Background tint is blue-grey, cooler than Humminbird's warm dark
• Fish appear as medium-brightness oval blobs with distinct trailing acoustic shadows
• Scout mode shows 180° wide forward sweep — very wide field, both sides of boat visible simultaneously

BARRAMUNDI IDENTIFICATION ON ACTIVETARGET:
• Large elongated oval body — L:H ratio 3.5:1 to 4.5:1
• Acoustic shadow extends behind or below the fish body
• Near structure (snags, mangrove roots, rocky ledges)
• Scout mode: barramundi appear at outer edges near structure
• Forward/Down mode: elongated bright blob near bottom structure with clear shadow trailing downward

THIS IS A LIVE SONAR IMAGE — no arches, only real-time body shapes. UI colour palette key: Lowrance = dark navy/grey background.`,
  },
  8: {
    brand: "Lowrance ActiveTarget",
    model: "ActiveTarget Live Sonar",
    mimeType: "image/jpeg",
    label: `LIVE SONAR DEMO 8 — LOWRANCE ACTIVETARGET — FISH DISPLAY REFERENCE.

WHAT THIS IMAGE SHOWS:
• Lowrance ActiveTarget live sonar display showing fish body shapes in real-time
• Dark navy/grey background — Lowrance Navico platform visual style
• Fish visible as distinct OVAL BODIES with acoustic shadows
• Forward mode: fish at various depths in front of the boat
• Shadow direction: downward in forward mode, lateral in scout mode

FISH SHAPE COMPARISON ON THIS DISPLAY:
• Large elongated ovals near structure = BARRAMUNDI (L:H > 3:1, long shadow, stationary, near snag)
• Tall/compact round body, fast movement = Giant Trevally (no shadow, open water)
• Multiple slim bodies in group, mid-column = Threadfin Salmon (school behaviour, shorter shadow)
• Very large solid filled blob near surface = CROCODILE (no swim bladder void, enormous width vs length)
• Small bright dots = baitfish or small species

LIVE SONAR KEY RULE: Identify by BODY SHAPE + SHADOW PHYSICS, not by arch patterns (arches don't exist on live sonar).`,
  },
  9: {
    brand: "Lowrance ActiveTarget",
    model: "ActiveTarget Live Sonar",
    mimeType: "image/jpeg",
    label: `LIVE SONAR DEMO 9 — LOWRANCE ACTIVETARGET — CLOSE-UP FISH BODY REFERENCE.

WHAT THIS IMAGE SHOWS:
• Lowrance ActiveTarget close-up view of fish body shapes on live sonar
• Shows how fish appear at different scales/depths on the display
• Close proximity targets: individual fish bodies clearly distinguishable
• Shadow quality visible: distinct shadow voids behind each target

BARRAMUNDI-SPECIFIC BODY SHAPE CUES ON ACTIVETARGET:
• Horizontal elongation: barramundi body is 4× longer than it is tall — sausage or torpedo shape
• Post-cast shadow: when you have cast into the area, watch for the fish body to ORIENT toward your lure
• Stationary ambush pose: barra often sit perfectly still — a motionless large oval near structure = HIGH CONFIDENCE barra
• Shadow length: long shadow (≥ body length) = large swim bladder = high swim bladder efficiency = BARRAMUNDI or large jack
• Near-surface large blob with EVEN longer shadow = large GT or school barra; EXTREME width + minimal shadow = CROC

THIS IS A LIVE SONAR IMAGE — species identified purely by body shape proportion, shadow physics, movement pattern, and structure proximity.`,
  },
});

// ─── Public API ───────────────────────────────────────────────────────────────

/** Load all demo images from disk, store full base64 + compressed thumbnail */
export async function loadDemoReferences(): Promise<void> {
  const demosDir = path.join(process.cwd(), "public", "demos");

  // Demos 1–5 are PNG; demos 6–9 are JPEG (live sonar references)
  const demoFiles: Record<number, string> = {
    1: "sonar-demo-1.png",
    2: "sonar-demo-2.png",
    3: "sonar-demo-3.png",
    4: "sonar-demo-4.png",
    5: "sonar-demo-5.png",
    6: "sonar-demo-6.jpg",
    7: "sonar-demo-7.jpg",
    8: "sonar-demo-8.jpg",
    9: "sonar-demo-9.jpg",
  };

  for (const [numStr, fileName] of Object.entries(demoFiles)) {
    const i = Number(numStr);
    const filePath = path.join(demosDir, fileName);
    try {
      const buf       = fs.readFileSync(filePath);
      const base64    = buf.toString("base64");
      const meta      = DEMO_LABELS[i]!;

      // Compress to thumbnail for fast reference injection (~37× smaller)
      let thumbBase64 = base64;   // fallback: full quality if compression fails
      try {
        thumbBase64 = await makeThumbnailFromBuf(buf, 512, 65);
        logger.info(
          {
            demo:     i,
            brand:    meta.brand,
            fullKb:   Math.round(base64.length    / 1024),
            thumbKb:  Math.round(thumbBase64.length / 1024),
            ratio:    `${Math.round(base64.length / thumbBase64.length)}×`,
          },
          "Demo reference loaded + thumbnail compressed"
        );
      } catch (compErr) {
        logger.warn({ err: compErr, demo: i }, "Thumbnail compression failed — using full PNG");
      }

      _demoRefs.push({ num: i, base64, thumbBase64, label: meta.label, brand: meta.brand, model: meta.model });
    } catch (err) {
      logger.warn({ err, demo: i, filePath }, "Failed to load demo reference image — ID accuracy will be reduced");
    }
  }

  logger.info({ count: _demoRefs.length }, "Demo reference library ready");
}

/** Returns all loaded demo references */
export function getDemoRefs(): DemoRef[] {
  return _demoRefs;
}
