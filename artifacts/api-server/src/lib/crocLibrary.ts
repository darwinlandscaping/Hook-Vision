/**
 * Croc Reference Library
 * ────────────────────────────────────────────────────────────────────────────
 * Fetches research-grade Crocodylus porosus (saltwater crocodile) photos
 * from iNaturalist and stores them in the croc_references DB table.
 *
 * AT RUNTIME these are injected into every /api/analyze call as cross-modal
 * shape references so the vision model can compare a sonar blob shape against
 * confirmed saltwater croc body outlines (out-of-water, side/top views).
 *
 * Cross-modal reasoning:
 *   Body photo → shows how large a croc silhouette is relative to any fish
 *   Sonar image → look for a LARGE SOLID FILLED BLOB near surface (NOT an arch)
 *                 that matches the body width/length ratio of the reference croc.
 *
 * iNaturalist taxon: Crocodylus porosus (taxon_id 26111)
 * We target Australia + SE Asia (the species' full range)
 * Target: 1,000 research-grade photos (10 pages × 100)
 */

import { db, crocReferences } from "@workspace/db";
import { eq, desc, sql, inArray } from "drizzle-orm";
import { logger } from "./logger.js";
import { makeThumbnailFromUrl } from "./imageUtils.js";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getModel } from "./models.js";

// ─── iNaturalist API types ────────────────────────────────────────────────────
interface InatPhoto {
  id:          number;
  url:         string;
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
  results:       InatObservation[];
  total_results: number;
}

// ─── In-memory cache ──────────────────────────────────────────────────────────
export interface CrocCachedRef {
  photoUrl:      string;
  location:      string;
  votes:         number;
  thumbBase64?:  string;
  viewingAngle?: "top" | "side" | "angled";
}

let cache: CrocCachedRef[]  = [];
let lastFetch                = 0;
const CACHE_TTL_MS           = 6 * 60 * 60 * 1000;   // 6 hours
const THUMB_PREWARM_COUNT    = 20;                     // pre-compress top 20 for fast injection

// ─── URL helpers ──────────────────────────────────────────────────────────────
function thumbUrl(medUrl: string): string {
  return medUrl.replace("/medium.", "/small.").replace("?size=medium", "?size=small");
}
function largeUrl(medUrl: string): string {
  return medUrl.replace("/medium.", "/large.").replace("?size=medium", "?size=large");
}

// ─── iNaturalist fetch ────────────────────────────────────────────────────────
async function fetchInat(
  page = 1,
  perPage = 100,
  taxonName = "Crocodylus porosus",
): Promise<InatObservation[]> {
  const params = new URLSearchParams({
    taxon_name:    taxonName,
    quality_grade: "research",
    photos:        "true",
    per_page:      String(perPage),
    page:          String(page),
    order:         "votes",
    order_by:      "votes",
  });
  const url = `https://api.inaturalist.org/v1/observations?${params}`;
  const resp = await fetch(url, {
    headers: { "User-Agent": "HookVision/1.0 (WA Australia fishing safety app)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!resp.ok) throw new Error(`iNat API ${resp.status}`);
  const data: InatResponse = await resp.json();
  return data.results;
}

// ─── Upsert observations into DB ─────────────────────────────────────────────
async function upsertObservations(obs: InatObservation[]): Promise<number> {
  let added = 0;
  for (const o of obs) {
    for (const photo of o.photos) {
      if (!photo.url) continue;
      const large = largeUrl(photo.url);
      const thumb = thumbUrl(photo.url);
      const obsId = String(o.id);

      const existing = await db
        .select({ id: crocReferences.id })
        .from(crocReferences)
        .where(eq(crocReferences.observationId, obsId))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(crocReferences)
          .set({ votes: o.faves_count })
          .where(eq(crocReferences.observationId, obsId));
      } else {
        await db.insert(crocReferences).values({
          source:        "inat",
          photoUrl:      large,
          thumbUrl:      thumb,
          observationId: obsId,
          location:      o.place_guess ?? "Kimberley, Western Australia",
          qualityGrade:  o.quality_grade,
          description:   o.description ? o.description.slice(0, 500) : null,
          votes:         o.faves_count,
          outOfWater:    true,   // assume iNat research photos show full body
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
      photoUrl:     crocReferences.photoUrl,
      location:     crocReferences.location,
      votes:        crocReferences.votes,
      thumbBase64:  crocReferences.thumbBase64,
      viewingAngle: crocReferences.viewingAngle,
    })
    .from(crocReferences)
    .where(eq(crocReferences.active, true))
    .orderBy(desc(crocReferences.votes))
    .limit(500);

  cache = rows.map(r => ({
    photoUrl:     r.photoUrl ?? "",
    location:     r.location ?? "Australia",
    votes:        r.votes ?? 0,
    thumbBase64:  r.thumbBase64 ?? undefined,
    viewingAngle: (r.viewingAngle as CrocCachedRef["viewingAngle"]) ?? undefined,
  })).filter(r => r.photoUrl.length > 0 || !!r.thumbBase64);

  lastFetch = Date.now();
  logger.info(
    { count: cache.length, withThumb: cache.filter(r => r.thumbBase64).length },
    "Croc reference library cache rebuilt"
  );

  prewarmThumbnails().catch(() => {});
}

// ─── Pre-warm thumbnails (base64 compress top N) ──────────────────────────────
async function prewarmThumbnails(): Promise<void> {
  const toWarm = cache.slice(0, THUMB_PREWARM_COUNT).filter(r => !r.thumbBase64);
  if (toWarm.length === 0) return;

  logger.info({ count: toWarm.length }, "Pre-warming croc thumbnail cache…");
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

  logger.info({ ok, fail }, "Croc thumbnail pre-warm complete");

  // Classify viewing angles for shape matching
  classifyAngles().catch(() => {});
}

// ─── Classify viewing angles ──────────────────────────────────────────────────
async function classifyAngles(): Promise<void> {
  const unclassified = cache.filter(r => r.thumbBase64 && !r.viewingAngle);
  if (unclassified.length === 0) return;

  logger.info({ count: unclassified.length }, "Classifying croc ref viewing angles…");

  const content: Array<{ type: string; text?: string; image_url?: { url: string; detail: string } }> = [
    {
      type: "text",
      text: [
        "You are classifying SALTWATER CROCODILE (Crocodylus porosus) photos by camera angle.",
        "For each numbered image, determine the camera perspective:",
        "  'top'    — camera directly above the croc, showing full dorsal/back silhouette (ideal for sonar shape matching)",
        "  'side'   — lateral profile showing full body length",
        "  'angled' — oblique view",
        "",
        `There are ${unclassified.length} images numbered 0 to ${unclassified.length - 1}.`,
        "Return ONLY valid JSON: [{\"idx\":0,\"angle\":\"side\"},{\"idx\":1,\"angle\":\"top\"},...]",
        "No explanation, no markdown.",
      ].join("\n"),
    },
  ];

  unclassified.forEach((ref, idx) => {
    content.push({ type: "text", text: `Image ${idx}:` });
    content.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${ref.thumbBase64}`, detail: "low" },
    });
  });

  try {
    const resp = await openai.chat.completions.create({
      model:       getModel("mid"),
      max_completion_tokens:  300,
      messages:    [{ role: "user", content: content as Parameters<typeof openai.chat.completions.create>[0]["messages"][0]["content"] }],
    });

    const raw        = resp.choices[0]?.message?.content?.trim() ?? "[]";
    const jsonMatch  = raw.match(/\[[\s\S]*\]/);
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
      { classified: results.length, topView: topCount },
      "Croc ref angle classification complete"
    );

    // Persist to DB
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
        .update(crocReferences)
        .set({ viewingAngle: angle })
        .where(inArray(crocReferences.photoUrl, urls))
        .catch(() => {});
    }
  } catch (err) {
    logger.warn({ err }, "Croc angle classification failed");
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialise on server startup.
 * Fetches up to 10 pages × 100 = 1,000 research-grade Crocodylus porosus photos.
 * Also fetches page 1 of Crocodylus johnstoni (freshwater croc) for WA/Kimberley river coverage.
 */
export async function initCrocLibrary(): Promise<void> {
  logger.info("Croc reference library: starting iNaturalist sync (target: 1,000 photos)…");
  try {
    let totalAdded = 0;
    for (let page = 1; page <= 10; page++) {
      try {
        const obs = await fetchInat(page, 100);
        if (obs.length === 0) break;
        const added = await upsertObservations(obs);
        totalAdded += added;
        logger.info({ page, fetched: obs.length, added }, "Croc iNat page synced");
      } catch (pageErr) {
        logger.warn({ page, err: String(pageErr) }, "Croc iNat page fetch failed, skipping");
      }
    }
    // Freshwater croc (Crocodylus johnstoni) — WA/Kimberley rivers + estuaries
    for (let page = 1; page <= 2; page++) {
      try {
        const obs = await fetchInat(page, 100, "Crocodylus johnstoni");
        if (obs.length === 0) break;
        const added = await upsertObservations(obs);
        totalAdded += added;
        logger.info({ page, fetched: obs.length, added }, "Freshwater croc iNat page synced");
      } catch (pageErr) {
        logger.warn({ page, err: String(pageErr) }, "Freshwater croc iNat page failed, skipping");
      }
    }

    logger.info({ totalAdded }, "Croc iNaturalist sync complete");
  } catch (err) {
    logger.warn({ err: String(err) }, "Croc iNat sync failed — will use DB cache only");
  }
  await rebuildCache();
}

/**
 * Daily refresh — re-fetches page 1 only.
 */
export async function refreshCrocLibrary(): Promise<void> {
  try {
    const obs = await fetchInat(1, 100);
    await upsertObservations(obs);
    await rebuildCache();
  } catch (err) {
    logger.warn({ err: String(err) }, "Daily croc library refresh failed");
  }
}

/**
 * Return N croc reference photos for few-shot cross-modal prompting.
 *
 * Preference order:
 *   1. Top-view refs with thumbBase64 (best for sonar blob shape matching)
 *   2. Side-view refs with thumbBase64
 *   3. Any ref with thumbBase64
 */
export function getCrocFewShotRefs(count = 2): CrocCachedRef[] {
  if (Date.now() - lastFetch > CACHE_TTL_MS && cache.length === 0) {
    rebuildCache().catch(() => {});
    return [];
  }

  const warmed    = cache.filter(r => r.thumbBase64);
  const topViews  = warmed.filter(r => r.viewingAngle === "top");
  const sideViews = warmed.filter(r => r.viewingAngle === "side");
  const rest      = warmed.filter(r => !r.viewingAngle || r.viewingAngle === "angled");

  const result: CrocCachedRef[] = [];

  // Always try to include 1 top-view (dorsal matches sonar overhead view)
  if (topViews.length > 0) {
    result.push(topViews[Math.floor(Math.random() * Math.min(3, topViews.length))]);
  }

  // Fill remaining slots with side views, then any
  const remaining = count - result.length;
  const pool      = [...sideViews, ...rest].filter(r => !result.includes(r));
  for (let i = 0; i < remaining && i < pool.length; i++) {
    const pick = pool[Math.floor(Math.random() * Math.min(5, pool.length - i))];
    if (pick && !result.includes(pick)) result.push(pick);
  }

  // Fallback: any unwarmed ref
  if (result.length < count && cache.length > 0) {
    const fallback = cache.find(r => !result.includes(r));
    if (fallback) result.push(fallback);
  }

  return result.slice(0, count);
}

/**
 * Library stats for /api/croc-brain/status.
 */
export async function getCrocLibraryStats(): Promise<{
  total:       number;
  warmed:      number;
  topView:     number;
  sideView:    number;
  lastSyncAgo: string;
}> {
  let total = 0;
  try {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(crocReferences)
      .where(eq(crocReferences.active, true));
    total = row?.count ?? 0;
  } catch { /* ignore */ }

  const warmed   = cache.filter(r => r.thumbBase64).length;
  const topView  = cache.filter(r => r.viewingAngle === "top").length;
  const sideView = cache.filter(r => r.viewingAngle === "side").length;
  const ago      = lastFetch > 0
    ? `${Math.round((Date.now() - lastFetch) / 60_000)} min ago`
    : "never";

  return { total, warmed, topView, sideView, lastSyncAgo: ago };
}
