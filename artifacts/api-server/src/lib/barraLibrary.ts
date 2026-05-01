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
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { logger } from "./logger.js";
import { makeThumbnailFromUrl } from "./imageUtils.js";
import { openai } from "@workspace/integrations-openai-ai-server";

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
export interface CachedRef {
  photoUrl:      string;
  location:      string;
  votes:         number;
  thumbBase64?:  string;                          // pre-compressed 512px JPEG
  viewingAngle?: "top" | "side" | "angled";       // classified at startup by gpt-4.1-mini
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
    headers: { "User-Agent": "HookVision/1.0 (fishing app; WA Australia)" },
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
      photoUrl:     barraReferences.photoUrl,
      location:     barraReferences.location,
      votes:        barraReferences.votes,
      thumbBase64:  barraReferences.thumbBase64,
      viewingAngle: barraReferences.viewingAngle,
    })
    .from(barraReferences)
    .where(eq(barraReferences.active, true))
    .orderBy(desc(barraReferences.votes))
    .limit(500);   // top 500 in memory

  cache = rows.map(r => ({
    photoUrl:     r.photoUrl ?? "",
    location:     r.location ?? "Australia",
    votes:        r.votes ?? 0,
    thumbBase64:  r.thumbBase64 ?? undefined,
    viewingAngle: (r.viewingAngle as CachedRef["viewingAngle"]) ?? undefined,
    // Community refs use "community" as photoUrl sentinel — still valid as long as thumbBase64 is set
  })).filter(r => r.photoUrl.length > 0 || !!r.thumbBase64);

  lastFetch = Date.now();
  logger.info(
    { count: cache.length, withThumb: cache.filter(r => r.thumbBase64).length },
    "Barra reference library cache rebuilt"
  );

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

  // After compression, classify each thumbnail by viewing angle (one batch call)
  classifyAngles().catch(() => {});
}

/**
 * Send all pre-warmed thumbnails to gpt-4.1-mini in ONE batch call and tag
 * each CachedRef with its viewingAngle ("top" | "side" | "angled").
 *
 * Top-view refs are then prioritised in getFewShotRefs() so the model always
 * has at least one dorsal-view example when the user submits a top-view photo.
 */
async function classifyAngles(): Promise<void> {
  // Only classify refs that have a base64 thumb and haven't been classified yet
  const unclassified = cache.filter(r => r.thumbBase64 && !r.viewingAngle);
  if (unclassified.length === 0) return;

  logger.info({ count: unclassified.length }, "Classifying barra ref viewing angles…");

  // Build content array: one numbered text label + one image per ref
  const content: Array<{type: string; text?: string; image_url?: {url: string; detail: string}}> = [
    {
      type: "text",
      text: [
        "You are classifying barramundi fish photos by camera angle.",
        "For each numbered image below, determine the camera perspective:",
        "  'top'    — camera is directly above the fish, showing dorsal (back) surface",
        "  'side'   — classic lateral profile view",
        "  'angled' — somewhere in-between / oblique",
        "",
        `There are ${unclassified.length} images numbered 0 to ${unclassified.length - 1}.`,
        "Return ONLY valid JSON: [{\"idx\":0,\"angle\":\"side\"},{\"idx\":1,\"angle\":\"top\"},...]",
        "No explanation, no markdown.",
      ].join("\n"),
    },
  ];

  unclassified.forEach((ref, idx) => {
    content.push({
      type: "text",
      text: `Image ${idx}:`,
    } as {type: string; text: string});
    content.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${ref.thumbBase64}`, detail: "low" },
    } as {type: string; image_url: {url: string; detail: string}});
  });

  try {
    const resp = await openai.chat.completions.create({
      model:       "gpt-5-mini",
      max_completion_tokens:  300,
      messages: [{ role: "user", content: content as Parameters<typeof openai.chat.completions.create>[0]["messages"][0]["content"] }],
    });

    const raw = resp.choices[0]?.message?.content?.trim() ?? "[]";
    // Extract JSON array from response (may have markdown wrapper)
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array in response");

    const results: Array<{ idx: number; angle: string }> = JSON.parse(jsonMatch[0]);
    let topCount = 0;
    for (const { idx, angle } of results) {
      const ref = unclassified[idx];
      if (!ref) continue;
      if (angle === "top" || angle === "side" || angle === "angled") {
        ref.viewingAngle = angle;
        if (angle === "top") topCount++;
      }
    }
    logger.info(
      { classified: results.length, topView: topCount, sideView: results.length - topCount },
      "Barra ref angle classification complete"
    );

    // Persist classifications to DB so they survive restarts
    // Group by angle to do bulk updates
    const byAngle: Record<string, string[]> = {};
    for (const { idx, angle } of results) {
      const ref = unclassified[idx];
      if (!ref?.photoUrl || ref.photoUrl === "community") continue;
      if (angle === "top" || angle === "side" || angle === "angled") {
        (byAngle[angle] ??= []).push(ref.photoUrl);
      }
    }
    for (const [angle, urls] of Object.entries(byAngle)) {
      if (urls.length === 0) continue;
      await db
        .update(barraReferences)
        .set({ viewingAngle: angle })
        .where(inArray(barraReferences.photoUrl, urls))
        .catch(() => {});
    }
  } catch (err) {
    logger.warn({ err }, "Angle classification failed — refs will be used without angle tags");
  }
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
 *
 * Called when a HookVision user confirms "yes, this is a barra".
 * The compressed base64 thumbnail is stored directly in the DB
 * (~3 KB per record — no external storage needed) and is immediately
 * injected into the in-memory cache so the very next scan benefits.
 *
 * @param opts.base64Thumb  - compressed JPEG base64 (~3 KB)
 * @param opts.photoUrl     - original photo URL if available (falls back to "community")
 * @param opts.location     - where the fish was caught
 * @param opts.viewingAngle - "top" | "side" | "angled" if known
 */
export async function addCommunityReference({
  base64Thumb,
  photoUrl = "community",
  location = "WA, Australia",
  viewingAngle,
}: {
  base64Thumb: string;
  photoUrl?:     string;
  location?:     string;
  viewingAngle?: "top" | "side" | "angled";
}): Promise<void> {
  try {
    await db.insert(barraReferences).values({
      source:       "community",
      photoUrl,
      thumbBase64:  base64Thumb,
      qualityGrade: "confirmed",
      location,
      viewingAngle: viewingAngle ?? null,
      votes:        5,   // start community refs with 5 votes — confirmed > iNat speculative
      active:       true,
    });

    // Immediately inject into the live cache so the next scan already benefits.
    // Put community refs at the TOP of the cache (highest votes).
    const ref: CachedRef = {
      photoUrl,
      location,
      votes:        5,
      thumbBase64:  base64Thumb,
      viewingAngle: viewingAngle ?? undefined,
    };
    cache.unshift(ref);   // insert at front — highest priority
    logger.info({ location, angle: viewingAngle ?? "unknown" }, "Community barra reference added to brain");
  } catch (err) {
    logger.warn({ err: String(err) }, "Failed to add community barra reference");
  }
}

/**
 * Return N reference images for few-shot prompting.
 *
 * When preferTop=true (caller knows the user's photo is top-view):
 *   Returns as many top-view refs as possible, padded with side-view if needed.
 *
 * Default (preferTop=false):
 *   Returns a smart mix — always includes 1 top-view ref if one exists, so
 *   the model has a dorsal example on every call even for unknown angles.
 *
 * Refs with pre-compressed base64 thumbs are preferred over URL-only refs.
 */
export function getFewShotRefs(n = 3, preferTop = false): CachedRef[] {
  // Refresh cache from DB if stale
  if (Date.now() - lastFetch > CACHE_TTL_MS) {
    rebuildCache().catch(() => {});
  }
  if (cache.length === 0) return [];

  // Split into pools (base64 refs are far more reliable for the model)
  const withThumb  = cache.filter(r => r.thumbBase64);
  const pool       = withThumb.length >= n ? withThumb : cache;

  const topPool    = pool.filter(r => r.viewingAngle === "top");
  const sidePool   = pool.filter(r => r.viewingAngle !== "top");

  if (preferTop) {
    // All-top-view if we have enough, otherwise pad with side-view
    const topSlice  = topPool.slice(0, n);
    const padNeeded = n - topSlice.length;
    const sideSlice = sidePool.slice(0, padNeeded);
    const result    = [...topSlice, ...sideSlice];
    if (result.length > 0) return result;
  }

  // Default: inject 1 top-view ref (if any) + (n-1) side/unclassified refs
  const topAnchor  = topPool.length > 0 ? topPool[Math.floor(Math.random() * topPool.length)] : null;
  const fillPool   = topAnchor ? pool.filter(r => r !== topAnchor) : pool;
  const topHalf    = fillPool.slice(0, Math.max(n, Math.floor(fillPool.length / 2)));
  const fillCount  = topAnchor ? n - 1 : n;
  const start      = Math.floor(Math.random() * Math.max(1, topHalf.length - fillCount));
  const fillRefs   = topHalf.slice(start, start + fillCount);
  return topAnchor ? [topAnchor, ...fillRefs] : fillRefs;
}

/**
 * Convenience: return only top-view classified refs (for status/debug).
 */
export function getTopViewRefCount(): number {
  return cache.filter(r => r.viewingAngle === "top").length;
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
