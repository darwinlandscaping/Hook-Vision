/**
 * Sonar Brain — Barramundi Arch Reference Library
 * ────────────────────────────────────────────────────────────────────────────
 * Exactly the same pattern as barraLibrary.ts, applied to sonar imagery.
 *
 * PRIMARY POOL: The 5 labelled demo sonar images loaded from disk at startup.
 *   These are the highest-quality references we have — confirmed species, full
 *   labels, multiple brands. They are already in memory via demoReference.ts.
 *
 * SECONDARY POOL: Community-confirmed sonar scans submitted by HookVision users
 *   (stored in the `sonar_references` DB table, fetched and cached here).
 *
 * USAGE: At call time, getSonarFewShotRefs() returns:
 *   • 2 positive barra arch references (demo 1 + demo 5 — both confirmed barra)
 *   • 1 negative contrast reference (demo 2 — threadfin, the #1 false-positive)
 *   • Up to 1 community barra arch ref (if available)
 *
 * These are prepended to every /api/analyze call and every /api/sonar-barra-check
 * call so the model sees confirmed patterns before looking at the user's image.
 *
 * This is equivalent to training on sonar arch photos — done in-context rather
 * than via weight updates (few-shot visual prompting).
 */
import { db, sonarReferences } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { getDemoRefs, type DemoRef } from "./demoReference.js";
import { logger } from "./logger.js";

// ─── Reference descriptor ─────────────────────────────────────────────────────
export interface SonarFewShotRef {
  base64:      string;
  mimeType:    string;
  label:       string;
  brand:       string;
  isPositive:  boolean;   // true = confirmed barra arch; false = negative/contrast
  source:      "demo" | "community";
}

// ─── In-memory cache for community refs ──────────────────────────────────────
let communityCache: SonarFewShotRef[] = [];
let lastCacheTime = 0;
const CACHE_TTL   = 4 * 60 * 60 * 1000;   // 4 hours

// ─── Demo indices to use for sonar brain ─────────────────────────────────────
// Demo 1:  Lowrance HDS Live   — confirmed 3 BARRA ON STRUCTURE              (positive)
// Demo 4:  Simrad GO9 XSE      — confirmed BARRA in lower layer + baitfish   (positive — multi-species)
// Demo 5:  Humminbird split    — confirmed 5-6 BARRA MID-COLUMN shadow voids  (positive)
// Demo 11: Lowrance HDS Carbon — 3 BARRA complete arches ON structure        (positive — extra barra ref)
// Demo 2:  Garmin Echomap UHD  — THREADFIN school (most confused with barra)  (negative)
// Demo 3:  Humminbird HELIX 10 — LONE FINGERMARK arch above rocky reef        (negative — lone arch)
// Demo 10: Lowrance HDS Live   — MANGROVE JACK half-arch buried in structure  (negative — CRITICAL: most confused with barra)
// Demo 12: Garmin Echomap UHD  — THREADFIN SALMON school 8 arches same depth (negative — additional threadfin)
const POSITIVE_DEMO_NUMS = [1, 4, 5, 11];
const NEGATIVE_DEMO_NUMS = [10, 2, 3, 12];

// ─── Build reference from a DemoRef — use compressed thumbnail ───────────────
// thumbBase64 is a 512px JPEG (~30–50KB) vs the full PNG (1.4–2.3MB).
// OpenAI "low" detail mode rescales to 512×512 anyway — zero quality difference.
function demoToRef(d: DemoRef, isPositive: boolean): SonarFewShotRef {
  return {
    base64:     d.thumbBase64,  // compressed thumbnail, not the full PNG
    mimeType:   "image/jpeg",
    label:      d.label,
    brand:      d.brand,
    isPositive,
    source:     "demo",
  };
}

// ─── Rebuild community cache from DB ─────────────────────────────────────────
async function rebuildCommunityCache(): Promise<void> {
  try {
    const rows = await db
      .select()
      .from(sonarReferences)
      .where(and(eq(sonarReferences.active, true), eq(sonarReferences.archType, "barra_arch")))
      .orderBy(desc(sonarReferences.confirmedCount))
      .limit(20);

    communityCache = rows
      .filter(r => r.imageBase64 && r.imageBase64.length > 0)
      .map(r => ({
        base64:     r.imageBase64,
        mimeType:   "image/jpeg",
        label:      r.description
          ?? `Community-confirmed barramundi arch — ${r.brand ?? "unknown brand"}, ${r.depth ?? "unknown depth"}, ${r.fishCount ?? "?"} fish`,
        brand:      r.brand ?? "unknown",
        isPositive: true,
        source:     "community" as const,
      }));

    lastCacheTime = Date.now();
    logger.info({ count: communityCache.length }, "Sonar brain community cache rebuilt");
  } catch (err) {
    logger.warn({ err: String(err) }, "Sonar brain community cache rebuild failed");
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Initialise the sonar brain on server startup.
 * Demo refs are already in memory — just kick off the community cache build.
 */
export async function initSonarBrain(): Promise<void> {
  logger.info("Sonar brain: loading demo refs + community cache…");
  await rebuildCommunityCache();
  const demos = getDemoRefs();
  logger.info(
    { demosAvailable: demos.length, communityRefs: communityCache.length },
    "Sonar brain ready"
  );
}

/**
 * Return few-shot reference images for injection into a sonar analysis call.
 * Always returns demo-based refs first (highest quality), then community.
 *
 * Positives (confirmed Barramundi arches):
 *   Demo 1  — Lowrance HDS Live   — 3 BARRA ON STRUCTURE (real screenshot)
 *   Demo 4  — Simrad GO9 XSE      — BARRA lower layer + baitfish (real)
 *   Demo 5  — Humminbird split    — 5-6 BARRA shadow voids (real)
 *   Demo 11 — Lowrance HDS Carbon — 3 BARRA complete full arches ON structure (synthetic)
 *
 * Negatives (confirmed NOT Barramundi — contrast references):
 *   Demo 10 — Lowrance HDS Live   — MANGROVE JACK: half-arch BURIED IN structure (synthetic)
 *   Demo 2  — Garmin Echomap UHD  — THREADFIN school mid-column soft bottom (real)
 *   Demo 3  — Humminbird HELIX 10 — LONE FINGERMARK above rocky reef (real)
 *   Demo 12 — Garmin Echomap UHD  — THREADFIN SALMON school 8 same-depth arches (synthetic)
 *
 * Community refs appended if available (confirmed by users).
 */
export function getSonarFewShotRefs(): SonarFewShotRef[] {
  const demos = getDemoRefs();
  const refs: SonarFewShotRef[] = [];

  for (const num of POSITIVE_DEMO_NUMS) {
    const d = demos.find(x => x.num === num);
    if (d) refs.push(demoToRef(d, true));
  }
  for (const num of NEGATIVE_DEMO_NUMS) {
    const d = demos.find(x => x.num === num);
    if (d) refs.push(demoToRef(d, false));
  }

  // Refresh community cache if stale
  if (Date.now() - lastCacheTime > CACHE_TTL) {
    rebuildCommunityCache().catch(() => {});
  }

  // Add up to 2 community refs (highest confirmed count) — randomised from top 5
  if (communityCache.length > 0) {
    const pool    = communityCache.slice(0, Math.min(5, communityCache.length));
    const pickIdx = Math.floor(Math.random() * pool.length);
    refs.push(pool[pickIdx]!);

    // Second community ref — different from the first
    if (pool.length > 1) {
      const secondIdx = (pickIdx + 1) % pool.length;
      refs.push(pool[secondIdx]!);
    }
  }

  return refs;
}

/**
 * Store a community-confirmed barramundi arch sonar scan.
 * The imageBase64 should be a JPEG compressed to ≤ 300KB before calling this.
 */
export async function addCommunityBarraArch(params: {
  imageBase64: string;
  brand?:      string;
  depth?:      string;
  fishCount?:  number;
  description?:string;
}): Promise<void> {
  await db.insert(sonarReferences).values({
    source:       "community",
    imageBase64:  params.imageBase64,
    brand:        params.brand ?? null,
    archType:     "barra_arch",
    description:  params.description ?? null,
    depth:        params.depth ?? null,
    fishCount:    params.fishCount ?? null,
    confirmedCount: 1,
    active:       true,
  });
  lastCacheTime = 0;   // force cache rebuild on next request
  logger.info({ brand: params.brand }, "Community sonar barra arch added to brain");
}

/**
 * Stats for the /api/sonar-brain/status endpoint.
 */
export async function getSonarBrainStats(): Promise<{
  demosLoaded:  number;
  community:    number;
  totalRefs:    number;
  refsPerCall:  number;
  brands:       string[];
}> {
  const demos = getDemoRefs();

  let community = 0;
  try {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sonarReferences)
      .where(eq(sonarReferences.active, true));
    community = row?.count ?? 0;
  } catch { /* ignore */ }

  return {
    demosLoaded: demos.length,
    community,
    totalRefs:   demos.length + community,
    refsPerCall: POSITIVE_DEMO_NUMS.length + NEGATIVE_DEMO_NUMS.length + Math.min(2, communityCache.length),
    brands:      [...new Set(demos.map(d => d.brand))],
  };
}
