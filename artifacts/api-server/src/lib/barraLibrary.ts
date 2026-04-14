/**
 * Barra Reference Library
 * ────────────────────────────────────────────────────────────────────────────
 * Fetches research-grade barramundi photos from iNaturalist and stores them
 * in the database.  At runtime these photos are injected into every
 * /api/barra-check call as few-shot visual examples, so the vision model
 * compares the user's fish directly against confirmed specimens.
 *
 * Few-shot visual prompting is the most effective technique for improving
 * vision model accuracy without fine-tuning.  Including 3 reference images
 * in context is proven to significantly reduce false-positives/negatives.
 *
 * Sources:
 *   1. iNaturalist research-grade observations  (auto, on startup)
 *   2. Community-confirmed catches submitted by HookVision users
 *
 * The library grows automatically: iNaturalist is re-fetched daily and any
 * new high-quality observations are added to the pool.
 */
import { db, barraReferences } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { logger } from "./logger.js";
import { makeThumbnailFromUrl } from "./imageUtils.js";

// ─── iNaturalist API types (minimal) ─────────────────────────────────────────
interface InatPhoto {
  id:          number;
  url:         string;  // medium size — e.g. https://inaturalist-open-data.s3.amazonaws.com/...
  attribution: string;
}
interface InatObservation {
  id:           number;
  quality_grade:string;
  faves_count:  number;
  place_guess:  string | null;
  photos:       InatPhoto[];
  description:  string | null;
}
interface InatResponse {
  results: InatObservation[];
  total_results: number;
}

// ─── In-memory cache (avoids hitting DB on every request) ────────────────────
interface CachedRef {
  photoUrl:     string;
  location:     string;
  votes:        number;
  thumbBase64?: string;   // pre-compressed 512px JPEG — avoids OpenAI fetching the URL
}
let cache: CachedRef[] = [];
let lastFetch = 0;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;   // 6 hours

// How many top photos to pre-fetch and compress at startup
const THUMB_PREWARM_COUNT = 12;

// ─── Convert iNat medium URL → square thumb ───────────────────────────────────
function thumbUrl(medUrl: string): string {
  // iNat: replace /medium/ or ?size=medium with /small/
  return medUrl.replace("/medium.", "/small.").replace("?size=medium", "?size=small");
}
function largeUrl(medUrl: string): string {
  return medUrl.replace("/medium.", "/large.").replace("?size=medium", "?size=large");
}

// ─── Fetch from iNaturalist ───────────────────────────────────────────────────
async function fetchInat(page = 1, perPage = 200): Promise<InatObservation[]> {
  const params = new URLSearchParams({
    taxon_name:    "Lates calcarifer",
    quality_grade: "research",
    photos:        "true",
    per_page:      String(perPage),
    page:          String(page),
    order:         "votes",
    order_by:      "votes",
    place_id:      "6744",   // Australia
  });
  const url = `https://api.inaturalist.org/v1/observations?${params}`;
  const resp = await fetch(url, {
    headers: { "User-Agent": "HookVision/1.0 (fishing app; NT Australia)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!resp.ok) throw new Error(`iNat API ${resp.status}`);
  const data: InatResponse = await resp.json();
  return data.results;
}

// ─── Upsert a batch of observations into DB ───────────────────────────────────
async function upsertObservations(obs: InatObservation[]): Promise<number> {
  let added = 0;
  for (const o of obs) {
    for (const photo of o.photos) {
      if (!photo.url) continue;
      const large = largeUrl(photo.url);
      const thumb = thumbUrl(photo.url);
      const obsId = String(o.id);

      // Check if already stored
      const existing = await db
        .select({ id: barraReferences.id })
        .from(barraReferences)
        .where(eq(barraReferences.observationId, obsId))
        .limit(1);

      if (existing.length > 0) {
        // Update vote count
        await db
          .update(barraReferences)
          .set({ votes: o.faves_count })
          .where(eq(barraReferences.observationId, obsId));
      } else {
        await db.insert(barraReferences).values({
          source:        "inat",
          photoUrl:      large,
          thumbUrl:      thumb,
          observationId: obsId,
          location:      o.place_guess ?? "Australia",
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

// ─── Rebuild the in-memory cache from DB ─────────────────────────────────────
async function rebuildCache(): Promise<void> {
  const rows = await db
    .select({
      photoUrl: barraReferences.photoUrl,
      location: barraReferences.location,
      votes:    barraReferences.votes,
    })
    .from(barraReferences)
    .where(eq(barraReferences.active, true))
    .orderBy(desc(barraReferences.votes))
    .limit(500);   // top 500 in memory

  cache = rows.map(r => ({
    photoUrl: r.photoUrl ?? "",
    location: r.location ?? "Australia",
    votes:    r.votes ?? 0,
  })).filter(r => r.photoUrl.length > 0);

  lastFetch = Date.now();
  logger.info({ count: cache.length }, "Barra reference library cache rebuilt");

  // Fire-and-forget thumbnail pre-warming — compress top photos into base64
  // so OpenAI doesn't have to fetch them from iNaturalist on every call.
  prewarmThumbnails().catch(() => {});
}

/**
 * Pre-fetch and compress the top THUMB_PREWARM_COUNT barra photos.
 * Stores thumbBase64 in the in-memory cache entries so future calls
 * pass base64 data instead of URLs (eliminates OpenAI → iNat HTTP fetches).
 */
async function prewarmThumbnails(): Promise<void> {
  const toWarm = cache.slice(0, THUMB_PREWARM_COUNT).filter(r => !r.thumbBase64);
  if (toWarm.length === 0) return;

  logger.info({ count: toWarm.length }, "Pre-warming barra thumbnail cache…");
  let ok = 0;
  let fail = 0;

  await Promise.allSettled(
    toWarm.map(async (ref) => {
      const thumb = await makeThumbnailFromUrl(ref.photoUrl, 512, 65, 8_000);
      if (thumb) {
        ref.thumbBase64 = thumb;
        ok++;
      } else {
        fail++;
      }
    })
  );

  logger.info(
    { ok, fail, thumbKbAvg: Math.round(
        cache.slice(0, ok).reduce((s, r) => s + (r.thumbBase64?.length ?? 0), 0)
          / Math.max(1, ok) / 1024
      ) },
    "Barra thumbnail pre-warm complete"
  );
}

// ─── Main public API ─────────────────────────────────────────────────────────

/**
 * Initialise library on server startup.
 * - Fetches multiple pages from iNaturalist (up to ~600 photos)
 * - Stores all new research-grade observations in DB
 * - Rebuilds the in-memory cache
 */
export async function initBarraLibrary(): Promise<void> {
  logger.info("Barra reference library: starting iNaturalist sync…");
  try {
    let totalAdded = 0;
    // Fetch 3 pages (600 observations) at startup — spread the load
    for (let page = 1; page <= 3; page++) {
      try {
        const obs = await fetchInat(page, 200);
        if (obs.length === 0) break;
        const added = await upsertObservations(obs);
        totalAdded += added;
        logger.info({ page, fetched: obs.length, added }, "iNat page synced");
      } catch (pageErr) {
        logger.warn({ page, err: String(pageErr) }, "iNat page fetch failed, skipping");
      }
    }
    logger.info({ totalAdded }, "iNaturalist sync complete");
  } catch (err) {
    logger.warn({ err: String(err) }, "iNat sync failed — will use DB cache only");
  }
  await rebuildCache();
}

/**
 * Scheduled daily refresh — call this once per day.
 * Only fetches the first page (newest/highest voted) and upserts.
 */
export async function refreshBarraLibrary(): Promise<void> {
  try {
    const obs = await fetchInat(1, 200);
    await upsertObservations(obs);
    await rebuildCache();
  } catch (err) {
    logger.warn({ err: String(err) }, "Daily barra library refresh failed");
  }
}

/**
 * Add a community-confirmed catch to the reference pool.
 * Called when a HookVision user confirms "yes, this is a barra".
 */
export async function addCommunityReference(photoUrl: string, location?: string): Promise<void> {
  try {
    await db.insert(barraReferences).values({
      source:       "community",
      photoUrl,
      qualityGrade: "confirmed",
      location:     location ?? "NT, Australia",
      votes:        1,
      active:       true,
    });
    // Invalidate cache so it picks up on next request
    lastFetch = 0;
  } catch (err) {
    logger.warn({ err: String(err) }, "Failed to add community barra reference");
  }
}

/**
 * Return N reference image URLs for use as few-shot examples.
 * Rotates through the pool so different images are used each time.
 * Returns highest-voted images first (most reliable specimens).
 */
export function getFewShotRefs(n = 3): CachedRef[] {
  // Refresh cache from DB if stale
  if (Date.now() - lastFetch > CACHE_TTL_MS) {
    rebuildCache().catch(() => {});   // fire-and-forget; stale cache still works
  }
  if (cache.length === 0) return [];

  // Pick from the top 50% (highest voted) with a random offset for variety
  const topHalf = cache.slice(0, Math.max(n, Math.floor(cache.length / 2)));
  const start   = Math.floor(Math.random() * Math.max(1, topHalf.length - n));
  return topHalf.slice(start, start + n);
}

/**
 * Library status for the /api/barra-library/status endpoint.
 */
export async function getLibraryStats(): Promise<{
  total: number;
  inat: number;
  community: number;
  cacheSize: number;
  lastRefresh: string;
}> {
  const [totRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(barraReferences)
    .where(eq(barraReferences.active, true));

  const [inatRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(barraReferences)
    .where(and(eq(barraReferences.source, "inat"), eq(barraReferences.active, true)));

  const [commRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(barraReferences)
    .where(and(eq(barraReferences.source, "community"), eq(barraReferences.active, true)));

  return {
    total:       totRow?.count  ?? 0,
    inat:        inatRow?.count ?? 0,
    community:   commRow?.count ?? 0,
    cacheSize:   cache.length,
    lastRefresh: lastFetch > 0 ? new Date(lastFetch).toISOString() : "never",
  };
}
