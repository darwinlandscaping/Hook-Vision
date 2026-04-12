/**
 * Demo Reference Library
 *
 * Loads the 5 labeled demo sonar images at server startup.
 * These are injected into every analyze call as visual ground-truth references,
 * so the AI can compare the unknown scan against known labeled examples.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { logger } from "./logger";

export interface DemoRef {
  num: number;
  base64: string;
  label: string;
  brand: string;
  model: string;
}

let _demoRefs: DemoRef[] = [];

/** Detailed visual ground-truth labels for each demo image */
const DEMO_LABELS: Record<number, { brand: string; model: string; label: string }> = {
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

SPECIES CONFIRMATION: Fingermark / Golden Snapper (Lutjanus johnii). Confidence should be 85%+. Size: 45–65cm based on arch brightness and thickness. This is a legal-size fish over the NT minimum.`,
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
• Small fish and baitfish produce NO visible shadow. Threadfin produce only a faint partial shadow. THESE shadows (large and dark) = trophy-class barra.

IDENTIFYING FEATURES OF THIS SONAR STYLE:
• The Humminbird circular flasher on the left is UNIQUE — no other brand does this split-screen
• The dual-scale on the right side of the sonar panel is a Humminbird trademark
• The colour palette: deep orange/amber tones for strong returns, fading to blue/teal for water
• Water background on the right panel: gradient from teal (shallow) to blue/dark blue (deep) — typical Humminbird

SPECIES CONFIRMATION — WHY THESE ARE BARRAMUNDI:
• Arch thickness (vertical height): VERY THICK = large fish 65cm+ (barramundi size)
• Arch brightness: Maximum orange-red return = large swim bladder = barra (threadfin would be smaller/thinner arches)
• Number: 5–6 individual large fish arches = a small aggregation, not a tight school
• Depth: 5–28ft in a 34.5ft water column — barra often suspend in the water column when chasing bait
• Temperature 68.2°F (20°C): cool for barra — suggests they may be slightly lethargic, holding mid-column
• Soft bottom beneath them — open water or sand flat habitat, barra over bait on sand
• The flasher spikes on the LEFT match the arch count on the RIGHT — 5+ strong returns = 5+ big fish
• NOT threadfin: too large (arches too thick/tall), threadfin would show thinner, more compressed arches
• NOT baitfish school: individual separated arches, not a cloud/blob
SPECIES CONFIRMATION: Barramundi (Lates calcarifer) — 5 to 6 fish at 5–28ft depth in open water over soft bottom. All fish are legal size 65–90cm based on arch thickness. Confidence should be 90%+.

TECHNIQUE FOR THIS SITUATION: Fish are mid-column/open water — use a mid-water lure or livebait suspended at the fish depth. Try 50g vibes or deep-diving hardbodies at 8–15ft. If fish are slightly lethargic (68°F is cool), slow down the retrieve.`,
  },
};

/** Load all demo images from disk into memory as base64 */
export function loadDemoReferences(): void {
  const demosDir = path.join(process.cwd(), "public", "demos");

  for (let i = 1; i <= 5; i++) {
    const filePath = path.join(demosDir, `sonar-demo-${i}.png`);
    try {
      const buf = fs.readFileSync(filePath);
      const base64 = buf.toString("base64");
      const meta = DEMO_LABELS[i]!;
      _demoRefs.push({
        num: i,
        base64,
        label: meta.label,
        brand: meta.brand,
        model: meta.model,
      });
      logger.info({ demo: i, brand: meta.brand, sizeKb: Math.round(base64.length / 1024) }, "Demo reference loaded");
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
