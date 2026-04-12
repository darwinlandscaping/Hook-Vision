/**
 * Demo Reference Library
 *
 * Loads the 4 labeled demo sonar images at server startup.
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
    label: `DEMO 3 — HUMMINBIRD HELIX 10 — ANSWER: SINGLE TROPHY BARRAMUNDI at 8m depth.

WHAT TO SEE IN THIS IMAGE:
• ONE very large, THICK, BRIGHT ISOLATED arch at ~8m depth
• Arch is significantly thicker (taller vertical height) than a typical small fish — indicates 70cm+ fish
• Humminbird orange-brown palette — deep orange/red = strongest return = big swim bladder
• The arch sits right ON the bottom echo or within 1m of it — classic barra position on structure
• Hard, thick bottom line visible — structure substrate (rock bar / snag)
• This is a SINGLE large fish, not a school — the solitary nature + large arch = trophy barra
• On Humminbird, the UI shows the orange logo, deeper contrast, depth displayed at top
• The massive arch size on the vertical axis = very large fish. Thin arches = small fish. This arch is FAT.
• 8m depth + hard structure + single massive arch = trophy barra, NOT threadfin (too deep, wrong bottom), NOT jewfish (jewfish would be in harbour water, more turbid)
SPECIES CONFIRMATION: Barramundi (Lates calcarifer) — single trophy fish 70cm+. Confidence should be 85%+.`,
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
};

/** Load all demo images from disk into memory as base64 */
export function loadDemoReferences(): void {
  const demosDir = path.join(process.cwd(), "public", "demos");

  for (let i = 1; i <= 4; i++) {
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
