/**
 * Live Sonar Brain
 * ────────────────────────────────────────────────────────────────────────────
 * Manages few-shot reference images specifically for the /api/live-sonar-analyze
 * route. Unlike the 2D sonar brain (which uses arch demos), this brain provides:
 *
 *   1. LIVE SONAR DISPLAY REFERENCES (demos 6–9):
 *      Editorial/manufacturer images showing what live sonar screens look like
 *      for each brand (MEGA Live 2, ActiveTarget). Visual grounding for the
 *      brand identification and display layout steps.
 *
 *   2. BARRAMUNDI BODY SHAPE REFS (from barraLibrary):
 *      iNaturalist research-grade barra body photos — same cross-modal bridge
 *      used in the 2D route: body anatomy → sonar silhouette physics.
 *
 *   3. CROCODILE BODY SHAPE REFS (from crocLibrary):
 *      iNaturalist research-grade croc body photos — essential for the large
 *      near-surface blob vs. barramundi body check.
 *
 * Usage: getLiveSonarDemoRefs() returns demo refs 6–9 for injection into
 * the live sonar analysis OpenAI message content.
 */

import { getDemoRefs, type DemoRef } from "./demoReference.js";
import { logger } from "./logger.js";

// ─── Reference descriptor ─────────────────────────────────────────────────────
export interface LiveSonarDemoRef {
  base64:      string;
  mimeType:    string;
  label:       string;
  brand:       string;
  demoNum:     number;
}

// Demo numbers that are live sonar display references (6–9)
const LIVE_SONAR_DEMO_NUMS = [6, 7, 8, 9];

/**
 * Return all loaded live sonar demo references (demos 6–9).
 * These are used as visual grounding in the live sonar analysis route.
 */
export function getLiveSonarDemoRefs(): LiveSonarDemoRef[] {
  const demos = getDemoRefs();
  const refs: LiveSonarDemoRef[] = [];

  for (const num of LIVE_SONAR_DEMO_NUMS) {
    const d = demos.find(x => x.num === num);
    if (d) {
      refs.push({
        base64:  d.thumbBase64,
        mimeType: "image/jpeg",
        label:   d.label,
        brand:   d.brand,
        demoNum: d.num,
      });
    }
  }

  if (refs.length > 0) {
    logger.debug({ count: refs.length }, "Live sonar demo refs ready for injection");
  } else {
    logger.warn("No live sonar demo refs loaded — live sonar accuracy may be reduced");
  }

  return refs;
}

/**
 * Stats about the live sonar brain for monitoring.
 */
export function getLiveSonarBrainStats(): { demosLoaded: number; brands: string[] } {
  const refs = getLiveSonarDemoRefs();
  return {
    demosLoaded: refs.length,
    brands: [...new Set(refs.map(r => r.brand))],
  };
}
