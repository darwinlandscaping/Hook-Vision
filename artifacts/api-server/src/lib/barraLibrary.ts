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
import { getModel } from "./models.js";

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
const THUMB_PREWARM_COUNT = 5;   // keep low — sequential downloads, not concurrent

// ─── Convert iNat medium URL → square thumb ───────────────────────────────────
function thumbUrl(medUrl: string): string {
  // iNat: replace /medium/ or ?size=medium with /small/
  return medUrl.replace("/medium.", "/small.").replace("?size=medium", "?size=small");
}
function largeUrl(medUrl: string): string {
  return medUrl.replace("/medium.", "/large.").replace("?size=medium", "?size=large");
}

// ─── Fetch from iNaturalist ───────────────────────────────────────────────────
async function fetchInat(
  page = 1,
  perPage = 200,
  taxonName = "Lates calcarifer",
  placeId?: string,
): Promise<InatObservation[]> {
  const params = new URLSearchParams({
    taxon_name: taxonName,
    photos:     "true",
    per_page:   String(perPage),
    page:       String(page),
    order:      "votes",
    order_by:   "votes",
  });
  // No quality_grade filter — collect research + needs_id + casual for maximum volume
  // No place_id filter by default — collect globally
  if (placeId) params.set("place_id", placeId);
  const url = `https://api.inaturalist.org/v1/observations?${params}`;
  const resp = await fetch(url, {
    headers: { "User-Agent": "HookVision/1.0 (fishing app; WA Australia)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!resp.ok) throw new Error(`iNat API ${resp.status}`);
  const data = await resp.json() as InatResponse;
  return data.results;
}

// ─── Upsert a batch of observations into DB ───────────────────────────────────
async function upsertObservations(
  obs: InatObservation[],
  source = "inat",
): Promise<number> {
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
          source,
          photoUrl:      large,
          thumbUrl:      thumb,
          observationId: obsId,
          location:      o.place_guess ?? "Global",
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
    .limit(80);    // 80 in memory — more than enough for rotation

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

  // Sequential — not concurrent — to avoid OOM (exit 137) from parallel image downloads
  for (const ref of toWarm) {
    const thumb = await makeThumbnailFromUrl(ref.photoUrl, 512, 65, 8_000);
    if (thumb) { ref.thumbBase64 = thumb; ok++; }
    else        { fail++; }
  }

  logger.info({ ok, fail }, "Barra thumbnail pre-warm complete");

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
      model:       getModel("mid"),
      temperature: 0.2,
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

// ─── Wikimedia Commons fetcher ────────────────────────────────────────────────
// Fetches photo URLs from Wikimedia Commons categories for Lates species.
// Free, no API key, CC-licensed — good complement to iNaturalist.

interface WikiPage {
  title: string;
  ns:    number;
}
interface WikiCatResponse {
  continue?: { cmcontinue: string };
  query: { categorymembers: WikiPage[] };
}
interface WikiImageInfo {
  url:           string;
  descriptionurl: string;
  width:         number;
  height:        number;
}
interface WikiImageInfoResponse {
  query: { pages: Record<string, { title: string; imageinfo?: WikiImageInfo[] }> };
}

async function fetchWikimediaCategory(
  category: string,
  maxItems = 500,
): Promise<string[]> {
  const titles: string[] = [];
  let cmcontinue: string | undefined;

  do {
    const params = new URLSearchParams({
      action:  "query",
      list:    "categorymembers",
      cmtitle: `Category:${category}`,
      cmtype:  "file",
      cmlimit: "500",
      format:  "json",
      origin:  "*",
    });
    if (cmcontinue) params.set("cmcontinue", cmcontinue);

    const resp = await fetch(
      `https://commons.wikimedia.org/w/api.php?${params}`,
      { signal: AbortSignal.timeout(12_000) },
    );
    if (!resp.ok) break;
    const data = await resp.json() as WikiCatResponse;
    for (const m of data.query.categorymembers) titles.push(m.title);
    cmcontinue = data.continue?.cmcontinue;
  } while (cmcontinue && titles.length < maxItems);

  return titles.slice(0, maxItems);
}

async function wikimediaTitlesToUrls(titles: string[]): Promise<Array<{ url: string; title: string }>> {
  const results: Array<{ url: string; title: string }> = [];
  // Batch: 50 titles per request (Wikimedia API limit)
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    try {
      const params = new URLSearchParams({
        action:    "query",
        titles:    batch.join("|"),
        prop:      "imageinfo",
        iiprop:    "url|dimensions",
        iiurlwidth:"800",
        format:    "json",
        origin:    "*",
      });
      const resp = await fetch(
        `https://commons.wikimedia.org/w/api.php?${params}`,
        { signal: AbortSignal.timeout(12_000) },
      );
      if (!resp.ok) continue;
      const data = await resp.json() as WikiImageInfoResponse;
      for (const page of Object.values(data.query.pages)) {
        const info = page.imageinfo?.[0];
        if (info?.url && (info.url.endsWith(".jpg") || info.url.endsWith(".jpeg") || info.url.endsWith(".png"))) {
          results.push({ url: info.url, title: page.title });
        }
      }
    } catch {
      /* skip batch on error */
    }
    await new Promise(r => setTimeout(r, 300)); // polite rate limit
  }
  return results;
}

async function upsertWikimediaPhotos(
  photos: Array<{ url: string; title: string }>,
  species: string,
  location: string,
): Promise<number> {
  let added = 0;
  for (const { url, title } of photos) {
    // Use title as a stable dedup key via observationId field
    const obsId = `wikimedia:${title}`;
    const existing = await db
      .select({ id: barraReferences.id })
      .from(barraReferences)
      .where(eq(barraReferences.observationId, obsId))
      .limit(1);
    if (existing.length > 0) continue;
    try {
      await db.insert(barraReferences).values({
        source:        `wikimedia_${species}`,
        photoUrl:      url,
        thumbUrl:      url,   // same URL — Wikimedia auto-resizes via ?width=
        observationId: obsId,
        location,
        qualityGrade:  "research",  // Wikimedia commons = curated
        description:   title.replace(/^File:/, ""),
        votes:         3,
        active:        true,
      });
      added++;
    } catch { /* ignore duplicate */ }
  }
  return added;
}

/**
 * Run all Wikimedia Commons collection for Lates species.
 * Designed to run as a background job after server startup.
 */
export async function collectWikimediaLates(): Promise<void> {
  // ── DB-first: skip if we already have sufficient barra photos ──
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(barraReferences)
    .where(eq(barraReferences.active, true));
  if ((row?.n ?? 0) >= 500) {
    logger.info({ existing: row?.n }, "Wikimedia Lates: DB sufficient — skipping collection");
    return;
  }

  logger.info("Wikimedia Lates collector: starting…");
  let total = 0;

  // Barramundi / Lates calcarifer — multiple categories
  const barraCats = [
    "Lates_calcarifer",
    "Barramundi",
  ];
  for (const cat of barraCats) {
    try {
      const titles = await fetchWikimediaCategory(cat, 300);
      logger.info({ cat, found: titles.length }, "Wikimedia category fetched");
      const photos = await wikimediaTitlesToUrls(titles);
      const added = await upsertWikimediaPhotos(photos, "calcarifer", "Wikimedia Commons");
      total += added;
      logger.info({ cat, photos: photos.length, added }, "Wikimedia barra photos stored");
    } catch (err) {
      logger.warn({ cat, err: String(err) }, "Wikimedia barra cat failed");
    }
    await new Promise(r => setTimeout(r, 500));
  }

  // Nile Perch / Lates niloticus — multiple categories
  const nileCats = [
    "Lates_niloticus",
    "Nile_perch",
  ];
  for (const cat of nileCats) {
    try {
      const titles = await fetchWikimediaCategory(cat, 300);
      logger.info({ cat, found: titles.length }, "Wikimedia category fetched");
      const photos = await wikimediaTitlesToUrls(titles);
      const added = await upsertWikimediaPhotos(photos, "niloticus", "Africa (Wikimedia)");
      total += added;
      logger.info({ cat, photos: photos.length, added }, "Wikimedia Nile perch photos stored");
    } catch (err) {
      logger.warn({ cat, err: String(err) }, "Wikimedia Nile perch cat failed");
    }
    await new Promise(r => setTimeout(r, 500));
  }

  logger.info({ total }, "Wikimedia Lates collection complete");
}

// ─── Main public API ─────────────────────────────────────────────────────────

/**
 * Initialise library on server startup.
 * - Fetches ALL available Lates calcarifer globally (all quality, ~700 max)
 * - Fetches ALL available Lates niloticus globally (~100 max)
 * - Stores new observations in DB; rebuilds the in-memory cache
 * - Wikimedia collection runs separately via collectWikimediaLates()
 */
export async function initBarraLibrary(): Promise<void> {
  // ── DB-first: if we already have enough photos, skip iNat and load from DB ──
  // The 6-hour daily refreshBarraLibrary() timer keeps the DB up-to-date.
  // This prevents 10+ HTTP requests + thousands of DB row-checks on every restart.
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(barraReferences)
    .where(eq(barraReferences.active, true));
  if ((row?.n ?? 0) >= 500) {
    logger.info({ existing: row?.n }, "Barra library: DB sufficient — loading from DB, skipping iNat sync");
    await rebuildCache();
    return;
  }

  logger.info("Barra reference library: DB empty/low — starting first-run iNaturalist sync…");

  // ── Lates calcarifer (barramundi / Asian sea bass) — global, all quality ──
  try {
    let calcarifer = 0;
    for (let page = 1; page <= 4; page++) {  // 4 × 200 covers all ~712 available
      try {
        const obs = await fetchInat(page, 200, "Lates calcarifer");
        if (obs.length === 0) break;
        const added = await upsertObservations(obs, "inat_calcarifer");
        calcarifer += added;
        logger.info({ page, fetched: obs.length, added }, "iNat Lates calcarifer page synced");
        if (obs.length < 200) break;  // last page
        await new Promise(r => setTimeout(r, 600));
      } catch (pageErr) {
        logger.warn({ page, err: String(pageErr) }, "iNat calcarifer page failed");
      }
    }
    logger.info({ calcarifer }, "iNat Lates calcarifer sync complete");
  } catch (err) {
    logger.warn({ err: String(err) }, "iNat calcarifer sync failed");
  }

  // ── Lates niloticus (Nile perch) — global, all quality ──
  try {
    let niloticus = 0;
    for (let page = 1; page <= 2; page++) {
      try {
        const obs = await fetchInat(page, 200, "Lates niloticus");
        if (obs.length === 0) break;
        const added = await upsertObservations(obs, "inat_niloticus");
        niloticus += added;
        logger.info({ page, fetched: obs.length, added }, "iNat Lates niloticus page synced");
        if (obs.length < 200) break;
        await new Promise(r => setTimeout(r, 600));
      } catch (pageErr) {
        logger.warn({ page, err: String(pageErr) }, "iNat niloticus page failed");
      }
    }
    logger.info({ niloticus }, "iNat Lates niloticus sync complete");
  } catch (err) {
    logger.warn({ err: String(err) }, "iNat niloticus sync failed");
  }

  await rebuildCache();
}

// ─── GBIF fetcher ─────────────────────────────────────────────────────────────
// GBIF taxon key 2393172 = Lates calcarifer.  Free, open CC license.
// Returns records with StillImage media — direct photo URLs.
interface GBIFMedia { identifier?: string; type?: string; format?: string; }
interface GBIFOccurrence {
  key:           number;
  media:         GBIFMedia[];
  stateProvince: string | null;
  country:       string | null;
  locality:      string | null;
}
interface GBIFResp { results: GBIFOccurrence[]; count: number; endOfRecords: boolean; }

async function fetchGBIF(offset = 0, limit = 300, country = "AU"): Promise<GBIFOccurrence[]> {
  const params = new URLSearchParams({
    taxonKey:  "2393172",
    mediaType: "StillImage",
    limit:     String(limit),
    offset:    String(offset),
    country,
  });
  const resp = await fetch(`https://api.gbif.org/v1/occurrence/search?${params}`, {
    headers: { "User-Agent": "HookVision/1.0 (fishing app; WA Australia)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!resp.ok) throw new Error(`GBIF ${resp.status}`);
  const d = await resp.json() as GBIFResp;
  return d.results;
}

async function upsertGBIF(occs: GBIFOccurrence[]): Promise<number> {
  let added = 0;
  for (const occ of occs) {
    for (const media of occ.media) {
      if (!media.identifier) continue;
      if (!media.identifier.match(/\.(jpg|jpeg|png|webp)/i)) continue;
      const obsId = `gbif:${occ.key}`;
      const loc = [occ.locality, occ.stateProvince, occ.country].filter(Boolean).join(", ");
      const existing = await db.select({ id: barraReferences.id })
        .from(barraReferences).where(eq(barraReferences.observationId, obsId)).limit(1);
      if (existing.length > 0) continue;
      try {
        await db.insert(barraReferences).values({
          source:        "gbif",
          photoUrl:      media.identifier,
          thumbUrl:      media.identifier,
          observationId: obsId,
          location:      loc || "Australia",
          qualityGrade:  "research",
          votes:         2,
          active:        true,
        });
        added++;
      } catch { /* duplicate */ }
    }
  }
  return added;
}

/**
 * Fetch barramundi photos from GBIF (Global Biodiversity Information Facility).
 * 393 total globally, 216 AU. Separate dataset from iNaturalist — genuine additions.
 */
export async function fetchGBIFBarramundi(): Promise<number> {
  logger.info("GBIF barramundi sync: starting (AU + global)…");
  let total = 0;

  // AU records first (~216)
  for (let offset = 0; offset < 400; offset += 300) {
    try {
      const occs = await fetchGBIF(offset, 300, "AU");
      if (occs.length === 0) break;
      const added = await upsertGBIF(occs);
      total += added;
      logger.info({ offset, fetched: occs.length, added }, "GBIF AU page synced");
      await new Promise(r => setTimeout(r, 800));
      if (occs.length < 300) break;
    } catch (err) {
      logger.warn({ offset, err: String(err) }, "GBIF AU page failed");
      break;
    }
  }

  logger.info({ total }, "GBIF barramundi sync complete");
  return total;
}

// ─── ALA fetcher ──────────────────────────────────────────────────────────────
// Atlas of Living Australia — 251 barra records with images.  Free, CC license.
// Image UUIDs → https://images.ala.org.au/image/{uuid}/original
interface ALAOccurrence { uuid: string; images?: string[]; stateProvince?: string; locality?: string; }
interface ALAResp { occurrences: ALAOccurrence[]; totalRecords: number; }

async function fetchALA(start = 0, pageSize = 100): Promise<ALAOccurrence[]> {
  const params = new URLSearchParams({
    q:         `taxon_name:"Lates calcarifer"`,
    fq:        "multimedia:Image",
    pageSize:  String(pageSize),
    start:     String(start),
    fl:        "uuid,images,stateProvince,locality",
  });
  const resp = await fetch(`https://biocache-ws.ala.org.au/ws/occurrences/search?${params}`, {
    headers: { "User-Agent": "HookVision/1.0 (fishing app; WA Australia)" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!resp.ok) throw new Error(`ALA ${resp.status}`);
  const d = await resp.json() as ALAResp;
  return d.occurrences ?? [];
}

async function upsertALA(occs: ALAOccurrence[]): Promise<number> {
  let added = 0;
  for (const occ of occs) {
    const imageUuids = occ.images ?? [];
    for (const uuid of imageUuids) {
      const obsId = `ala:${uuid}`;
      const existing = await db.select({ id: barraReferences.id })
        .from(barraReferences).where(eq(barraReferences.observationId, obsId)).limit(1);
      if (existing.length > 0) continue;
      const photoUrl = `https://images.ala.org.au/image/${uuid}/original`;
      const thumbUrl = `https://images.ala.org.au/image/${uuid}/thumbnail`;
      const loc = [occ.locality, occ.stateProvince, "Australia"].filter(Boolean).join(", ");
      try {
        await db.insert(barraReferences).values({
          source:        "ala",
          photoUrl,
          thumbUrl,
          observationId: obsId,
          location:      loc,
          qualityGrade:  "research",
          votes:         2,
          active:        true,
        });
        added++;
      } catch { /* duplicate */ }
    }
  }
  return added;
}

/**
 * Fetch barramundi photos from the Atlas of Living Australia.
 * 251 records with images — Australian-specific, genuine new additions.
 */
export async function fetchALABarramundi(): Promise<number> {
  logger.info("ALA barramundi sync: starting (251 expected)…");
  let total = 0;

  for (let start = 0; start < 400; start += 100) {
    try {
      const occs = await fetchALA(start, 100);
      if (occs.length === 0) break;
      const added = await upsertALA(occs);
      total += added;
      logger.info({ start, fetched: occs.length, added }, "ALA page synced");
      await new Promise(r => setTimeout(r, 800));
      if (occs.length < 100) break;
    } catch (err) {
      logger.warn({ start, err: String(err) }, "ALA page failed");
      break;
    }
  }

  logger.info({ total }, "ALA barramundi sync complete");
  return total;
}

/**
 * Full expansion sync — runs all available sources:
 * GBIF (393 global) + ALA (251 AU) + geographic iNat searches.
 * Called by POST /api/barra-library/expand.
 */
export async function expandBarraLibrary(): Promise<{ gbif: number; ala: number; geographic: number; total: number }> {
  logger.info("Barra library expansion: starting all sources…");

  const [gbif, ala] = await Promise.allSettled([
    fetchGBIFBarramundi(),
    fetchALABarramundi(),
  ]);

  const gbifCount    = gbif.status    === "fulfilled" ? gbif.value    : 0;
  const alaCount     = ala.status     === "fulfilled" ? ala.value     : 0;

  // Geographic iNat: search AU states by bounding box with created_at sort
  // to pick up observations not captured by the default votes sort
  let geoCount = 0;
  const geoBounds = [
    { name: "NT",     swlat: -25.9, swlng: 129.0, nelat: -10.9, nelng: 137.99 },
    { name: "QLD",    swlat: -28.9, swlng: 138.0, nelat: -10.4, nelng: 153.6  },
    { name: "WA",     swlat: -35.1, swlng: 113.1, nelat: -13.7, nelng: 129.0  },
    { name: "Kakadu", swlat: -14.0, swlng: 131.5, nelat: -12.0, nelng: 133.0  },
  ];
  for (const bounds of geoBounds) {
    for (let page = 1; page <= 3; page++) {
      try {
        const params = new URLSearchParams({
          taxon_name: "Lates calcarifer",
          photos:     "true",
          per_page:   "200",
          page:       String(page),
          order_by:   "created_at",
          order:      "desc",
          swlat:      String(bounds.swlat),
          swlng:      String(bounds.swlng),
          nelat:      String(bounds.nelat),
          nelng:      String(bounds.nelng),
        });
        const resp = await fetch(`https://api.inaturalist.org/v1/observations?${params}`, {
          headers: { "User-Agent": "HookVision/1.0" },
          signal: AbortSignal.timeout(15_000),
        });
        if (!resp.ok) break;
        const data = await resp.json() as { results: InatObservation[] };
        if (!data.results?.length) break;
        const added = await upsertObservations(data.results, `inat_geo_${bounds.name.toLowerCase()}`);
        geoCount += added;
        logger.info({ region: bounds.name, page, fetched: data.results.length, added }, "iNat geographic page synced");
        if (data.results.length < 200) break;
        await new Promise(r => setTimeout(r, 700));
      } catch (err) {
        logger.warn({ region: bounds.name, page, err: String(err) }, "iNat geographic page failed");
        break;
      }
    }
    await new Promise(r => setTimeout(r, 500));
  }

  const total = gbifCount + alaCount + geoCount;
  logger.info({ gbif: gbifCount, ala: alaCount, geographic: geoCount, total }, "Barra library expansion complete");

  await rebuildCache();
  return { gbif: gbifCount, ala: alaCount, geographic: geoCount, total };
}

/**
 * Scheduled daily refresh — call this once per day.
 * Refreshes page 1 of both species and any new Wikimedia additions.
 */
export async function refreshBarraLibrary(): Promise<void> {
  try {
    const calcObs = await fetchInat(1, 200, "Lates calcarifer");
    await upsertObservations(calcObs, "inat_calcarifer");
    const nileObs = await fetchInat(1, 200, "Lates niloticus");
    await upsertObservations(nileObs, "inat_niloticus");
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
