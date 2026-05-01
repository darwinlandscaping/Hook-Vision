/**
 * Bird Reference Library (Pipeline 1 — Surface Detect)
 * ────────────────────────────────────────────────────────────────────────────
 * Syncs research-grade photos of WA/Kimberley fishing indicator birds from
 * iNaturalist and stores them in the bird_references DB table.
 *
 * At runtime, up to 3 bird reference photos are injected as few-shot images
 * into every /api/insta360/surface-detect call so the vision model can
 * recognise each species in real-world Insta360 camera frames.
 *
 * Target species (WA/Kimberley waters — Roebuck Bay, King Sound, Cambridge Gulf,
 * Ord River, Fitzroy River, Exmouth Gulf):
 *
 *   Frigatebird     — Fregata ariel / Fregata minor
 *   Crested Tern    — Thalasseus bergii
 *   Little Tern     — Sternula albifrons
 *   Brown Booby     — Sula leucogaster
 *   Masked Booby    — Sula dactylatra
 *   Australian Pelican — Pelecanus conspicillatus
 *   Osprey          — Pandion haliaetus
 *   Brahminy Kite   — Haliastur indus
 *
 * Total target: 500 photos (varies by species availability on iNat).
 * Pages per species: ~3–4 × 50 per page.
 *
 * Pose classification (AI — gpt-4.1-mini):
 *   "diving"   — steep plunge dive towards water (best indicator)
 *   "aerial"   — bird in flight, circling / wheeling
 *   "perched"  — sitting on structure/shoreline (low indicator value)
 *   "water"    — floating on the surface
 */

import { db, birdReferences } from "@workspace/db";
import { eq, desc, sql, and, inArray } from "drizzle-orm";
import { logger } from "./logger.js";
import { makeThumbnailFromUrl } from "./imageUtils.js";
import { openai } from "@workspace/integrations-openai-ai-server";

// ─── iNaturalist API types ────────────────────────────────────────────────────
interface InatPhoto {
  id:          number;
  url:         string;
  attribution: string;
}
interface InatObservation {
  id:            number;
  quality_grade: string;
  faves_count:   number;
  place_guess:   string | null;
  photos:        InatPhoto[];
  description:   string | null;
}
interface InatResponse {
  results:       InatObservation[];
  total_results: number;
}

// ─── Target species ───────────────────────────────────────────────────────────
interface BirdSpecies {
  commonName:  string;
  taxonName:   string;
  taxonId:     number;  // iNaturalist taxon ID
  pages:       number;  // iNat pages to fetch (50/page)
}

const NT_BIRD_SPECIES: BirdSpecies[] = [
  { commonName: "Lesser Frigatebird",     taxonName: "Fregata ariel",            taxonId: 4671,   pages: 4 },
  { commonName: "Great Frigatebird",      taxonName: "Fregata minor",            taxonId: 4672,   pages: 3 },
  { commonName: "Crested Tern",           taxonName: "Thalasseus bergii",        taxonId: 4817,   pages: 4 },
  { commonName: "Little Tern",            taxonName: "Sternula albifrons",       taxonId: 4840,   pages: 3 },
  { commonName: "Brown Booby",            taxonName: "Sula leucogaster",         taxonId: 4689,   pages: 4 },
  { commonName: "Masked Booby",           taxonName: "Sula dactylatra",          taxonId: 4691,   pages: 3 },
  { commonName: "Australian Pelican",     taxonName: "Pelecanus conspicillatus", taxonId: 4741,   pages: 4 },
  { commonName: "Osprey",                 taxonName: "Pandion haliaetus",        taxonId: 5305,   pages: 4 },
  { commonName: "Brahminy Kite",          taxonName: "Haliastur indus",          taxonId: 5342,   pages: 3 },
  { commonName: "Little Black Cormorant", taxonName: "Phalacrocorax sulcirostris", taxonId: 5067, pages: 2 },
];

// ─── In-memory cache ──────────────────────────────────────────────────────────
export interface BirdCachedRef {
  photoUrl:    string;
  species:     string;
  location:    string;
  votes:       number;
  thumbBase64?: string;
  poseType?:   "diving" | "aerial" | "perched" | "water";
}

let cache:      BirdCachedRef[] = [];
let lastFetch   = 0;
const CACHE_TTL = 6 * 60 * 60 * 1000;   // 6 hours
const PREWARM   = 30;                     // pre-compress top 30 for fast injection

// ─── URL helpers ──────────────────────────────────────────────────────────────
function thumbUrl(medUrl: string): string {
  return medUrl.replace("/medium.", "/small.").replace("?size=medium", "?size=small");
}
function largeUrl(medUrl: string): string {
  return medUrl.replace("/medium.", "/large.").replace("?size=medium", "?size=large");
}

// ─── iNaturalist fetch (one species, one page) ────────────────────────────────
async function fetchInat(taxonId: number, page: number): Promise<InatObservation[]> {
  const params = new URLSearchParams({
    taxon_id:      String(taxonId),
    quality_grade: "research",
    photos:        "true",
    per_page:      "50",
    page:          String(page),
    order:         "votes",
    order_by:      "votes",
    // No place_id so we get global best-voted; many are Australia/Pacific
  });
  const url = `https://api.inaturalist.org/v1/observations?${params}`;
  const resp = await fetch(url, {
    headers: { "User-Agent": "HookVision/1.0 (WA Australia fishing app)" },
    signal:  AbortSignal.timeout(15_000),
  });
  if (!resp.ok) throw new Error(`iNat ${resp.status}`);
  const data: InatResponse = await resp.json();
  return data.results;
}

// ─── Upsert into DB ───────────────────────────────────────────────────────────
async function upsertObservations(
  obs: InatObservation[],
  species: BirdSpecies,
): Promise<number> {
  let added = 0;
  for (const o of obs) {
    for (const photo of o.photos) {
      if (!photo.url) continue;
      const obsId = String(o.id);

      const existing = await db
        .select({ id: birdReferences.id })
        .from(birdReferences)
        .where(eq(birdReferences.observationId, obsId))
        .limit(1);

      if (existing.length > 0) {
        await db.update(birdReferences)
          .set({ votes: o.faves_count })
          .where(eq(birdReferences.observationId, obsId));
      } else {
        await db.insert(birdReferences).values({
          source:        "inat",
          species:       species.commonName,
          taxonName:     species.taxonName,
          photoUrl:      largeUrl(photo.url),
          thumbUrl:      thumbUrl(photo.url),
          observationId: obsId,
          location:      o.place_guess ?? "Kimberley, Western Australia",
          qualityGrade:  o.quality_grade,
          description:   o.description ? o.description.slice(0, 500) : null,
          votes:         o.faves_count,
          active:        true,
        });
        added++;
      }
    }
  }
  return added;
}

// ─── Rebuild in-memory cache ─────────────────────────────────────────────────
async function rebuildCache(): Promise<void> {
  const rows = await db
    .select({
      photoUrl:    birdReferences.photoUrl,
      species:     birdReferences.species,
      location:    birdReferences.location,
      votes:       birdReferences.votes,
      thumbBase64: birdReferences.thumbBase64,
      poseType:    birdReferences.poseType,
    })
    .from(birdReferences)
    .where(eq(birdReferences.active, true))
    .orderBy(desc(birdReferences.votes))
    .limit(500);

  cache = rows.map(r => ({
    photoUrl:    r.photoUrl,
    species:     r.species ?? "Unknown bird",
    location:    r.location ?? "WA, Australia",
    votes:       r.votes ?? 0,
    thumbBase64: r.thumbBase64 ?? undefined,
    poseType:    (r.poseType as BirdCachedRef["poseType"]) ?? undefined,
  })).filter(r => r.photoUrl.length > 0 || !!r.thumbBase64);

  lastFetch = Date.now();
  logger.info(
    { count: cache.length, withThumb: cache.filter(r => r.thumbBase64).length },
    "Bird reference library cache rebuilt"
  );

  prewarmThumbnails().catch(() => {});
}

// ─── Pre-warm thumbnails ──────────────────────────────────────────────────────
async function prewarmThumbnails(): Promise<void> {
  const toWarm = cache.slice(0, PREWARM).filter(r => !r.thumbBase64);
  if (toWarm.length === 0) return;

  logger.info({ count: toWarm.length }, "Pre-warming bird thumbnail cache…");
  let ok = 0, fail = 0;

  await Promise.allSettled(
    toWarm.map(async (ref) => {
      const thumb = await makeThumbnailFromUrl(ref.photoUrl, 512, 65, 8_000);
      if (thumb) { ref.thumbBase64 = thumb; ok++; }
      else        { fail++; }
    })
  );

  logger.info({ ok, fail }, "Bird thumbnail pre-warm complete");
  classifyPoses().catch(() => {});
}

// ─── AI pose classification (batches of 5 to isolate content-policy blocks) ──
const VALID_POSES = ["diving", "aerial", "water", "perched"] as const;
const CLASSIFY_BATCH = 5;

async function classifyBatch(
  batch: BirdCachedRef[],
  offset: number,
): Promise<Array<{ idx: number; pose: string }>> {
  const content: Array<{ type: string; text?: string; image_url?: { url: string; detail: string } }> = [
    {
      type: "text",
      text: [
        "Classify each bird photo by the bird's POSE / ACTIVITY. Pick one label:",
        "  'diving'  — steep plunge-dive towards water surface",
        "  'aerial'  — in flight, circling, wheeling, soaring",
        "  'water'   — swimming or floating on the water",
        "  'perched' — sitting on structure, branch, or shoreline",
        `There are ${batch.length} images numbered 0 to ${batch.length - 1}.`,
        "Return ONLY valid JSON array: [{\"idx\":0,\"pose\":\"aerial\"},...]",
        "No explanation.",
      ].join("\n"),
    },
  ];
  batch.forEach((ref, i) => {
    content.push({ type: "text", text: `Image ${i} (${ref.species}):` });
    content.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${ref.thumbBase64}`, detail: "low" },
    });
  });

  const resp = await openai.chat.completions.create({
    model:       "gpt-5-mini",
    max_completion_tokens:  100,
    messages:    [{ role: "user", content: content as Parameters<typeof openai.chat.completions.create>[0]["messages"][0]["content"] }],
  });
  const raw       = resp.choices[0]?.message?.content?.trim() ?? "[]";
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];
  const results: Array<{ idx: number; pose: string }> = JSON.parse(jsonMatch[0]);
  return results.map(r => ({ idx: r.idx + offset, pose: r.pose }));
}

async function classifyPoses(): Promise<void> {
  const unclassified = cache.filter(r => r.thumbBase64 && !r.poseType);
  if (unclassified.length === 0) return;

  logger.info({ count: unclassified.length }, "Classifying bird ref poses (batches of 5)…");

  const allResults: Array<{ idx: number; pose: string }> = [];
  let divingCount = 0;

  for (let i = 0; i < unclassified.length; i += CLASSIFY_BATCH) {
    const batch = unclassified.slice(i, i + CLASSIFY_BATCH);
    try {
      const results = await classifyBatch(batch, i);
      allResults.push(...results);
      for (const { idx, pose } of results) {
        const ref = unclassified[idx];
        if (!ref) continue;
        if (VALID_POSES.includes(pose as any)) {
          ref.poseType = pose as BirdCachedRef["poseType"];
          if (pose === "diving") divingCount++;
        }
      }
    } catch (err) {
      logger.warn({ batchStart: i, err: String(err) }, "Bird pose batch classification failed, skipping batch");
    }
  }

  logger.info({ classified: allResults.length, diving: divingCount }, "Bird pose classification complete");

  // Persist to DB
  const byPose: Record<string, string[]> = {};
  for (const { idx, pose } of allResults) {
    const ref = unclassified[idx];
    if (!ref?.photoUrl) continue;
    if (VALID_POSES.includes(pose as any)) {
      (byPose[pose] ??= []).push(ref.photoUrl);
    }
  }
  for (const [pose, urls] of Object.entries(byPose)) {
    if (urls.length === 0) continue;
    await db
      .update(birdReferences)
      .set({ poseType: pose })
      .where(inArray(birdReferences.photoUrl, urls))
      .catch(() => {});
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialise on server startup.
 * Fetches up to 500 research-grade bird photos across 10 WA/Kimberley target species.
 */
export async function initBirdLibrary(): Promise<void> {
  logger.info("Bird reference library: starting iNaturalist sync (target: 500 photos across 10 WA/Kimberley species)…");
  let totalAdded = 0;

  for (const species of NT_BIRD_SPECIES) {
    for (let page = 1; page <= species.pages; page++) {
      try {
        const obs = await fetchInat(species.taxonId, page);
        if (obs.length === 0) break;
        const added = await upsertObservations(obs, species);
        totalAdded += added;
        logger.info({ species: species.commonName, page, fetched: obs.length, added }, "Bird iNat page synced");
      } catch (err) {
        logger.warn({ species: species.commonName, page, err: String(err) }, "Bird iNat page failed, skipping");
      }
    }
  }

  logger.info({ totalAdded }, "Bird iNaturalist sync complete");
  await rebuildCache();
}

/**
 * Daily refresh — re-fetches page 1 for each species.
 */
export async function refreshBirdLibrary(): Promise<void> {
  for (const species of NT_BIRD_SPECIES) {
    try {
      const obs = await fetchInat(species.taxonId, 1);
      await upsertObservations(obs, species);
    } catch { /* ignore per-species errors */ }
  }
  await rebuildCache();
}

/**
 * Return N bird reference photos for few-shot visual prompting.
 *
 * Preference order:
 *   1. Diving-pose refs with thumbBase64 (most diagnostic — steep dive = active bait ball)
 *   2. Aerial refs with thumbBase64 (wheeling = birds working a spot)
 *   3. Any warmed ref
 */
export function getBirdFewShotRefs(count = 3): BirdCachedRef[] {
  if (Date.now() - lastFetch > CACHE_TTL && cache.length === 0) {
    rebuildCache().catch(() => {});
    return [];
  }

  const warmed  = cache.filter(r => r.thumbBase64);
  const diving  = warmed.filter(r => r.poseType === "diving");
  const aerial  = warmed.filter(r => r.poseType === "aerial");
  const other   = warmed.filter(r => !r.poseType || r.poseType === "water" || r.poseType === "perched");

  const result: BirdCachedRef[] = [];

  // Prioritise diving — 1+ diving if available
  if (diving.length > 0) {
    result.push(diving[Math.floor(Math.random() * Math.min(4, diving.length))]);
  }

  // Fill with aerial
  const pool = [...aerial, ...other].filter(r => !result.includes(r));
  for (let i = 0; i < count - result.length && i < pool.length; i++) {
    const pick = pool[Math.floor(Math.random() * Math.min(6, pool.length - i))];
    if (pick && !result.includes(pick)) result.push(pick);
  }

  // Fallback — unwarmed
  if (result.length < count && cache.length > 0) {
    const fallback = cache.find(r => !result.includes(r));
    if (fallback) result.push(fallback);
  }

  return result.slice(0, count);
}

/**
 * Library stats for diagnostics.
 */
export async function getBirdLibraryStats(): Promise<{
  total:       number;
  warmed:      number;
  diving:      number;
  aerial:      number;
  lastSyncAgo: string;
}> {
  let total = 0;
  try {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(birdReferences)
      .where(eq(birdReferences.active, true));
    total = row?.count ?? 0;
  } catch { /* ignore */ }

  const warmed  = cache.filter(r => r.thumbBase64).length;
  const diving  = cache.filter(r => r.poseType === "diving").length;
  const aerial  = cache.filter(r => r.poseType === "aerial").length;
  const ago     = lastFetch > 0
    ? `${Math.round((Date.now() - lastFetch) / 60_000)} min ago`
    : "never";

  return { total, warmed, diving, aerial, lastSyncAgo: ago };
}
