/**
 * Contrast Species Library
 * ────────────────────────────────────────────────────────────────────────────
 * Fetches reference photos of species commonly confused with barramundi:
 *   • Mangrove Jack  (Lutjanus argentimaculatus) — 1,652+ iNat records
 *   • Fingermark     (Lutjanus johnii)           — 239+ iNat records
 *   • Threadfin Salmon (Polydactylus macrochir)  — 21+ iNat records
 *
 * These photos feed into the cross-modal AI reference system:
 * sonar-barra-check and analyze.ts show the model what these species look
 * like physically (body shape, fin profile, colouration) so it can connect
 * body anatomy → expected sonar arch shape → better species discrimination.
 *
 * Stored in `contrast_references` DB table, separate from barra_references.
 */
import { db, contrastReferences } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { logger } from "./logger.js";
import { makeThumbnailFromUrl } from "./imageUtils.js";

interface InatPhoto { id: number; url: string; attribution: string; }
interface InatObs { id: number; quality_grade: string; faves_count: number; place_guess: string | null; photos: InatPhoto[]; }
interface InatResp { results: InatObs[]; total_results: number; }

function largeUrl(u: string) { return u.replace("/medium.", "/large.").replace("?size=medium", "?size=large"); }
function smallUrl(u: string) { return u.replace("/medium.", "/small.").replace("?size=medium", "?size=small"); }

const SPECIES = [
  {
    key:      "mangrove_jack" as const,
    name:     "Lutjanus argentimaculatus",
    common:   "Mangrove Jack",
    pages:    8,   // ~1,600 available — grab 8 pages × 200 = 1,600
  },
  {
    key:      "fingermark" as const,
    name:     "Lutjanus johnii",
    common:   "Fingermark / Golden Snapper",
    pages:    2,   // ~239 available — grab 2 pages × 200
  },
  {
    key:      "threadfin_salmon" as const,
    name:     "Polydactylus macrochir",
    common:   "Threadfin Salmon",
    pages:    1,   // ~21 available
  },
];

async function fetchInat(taxonName: string, page: number, perPage = 200): Promise<InatObs[]> {
  const params = new URLSearchParams({
    taxon_name: taxonName,
    photos:     "true",
    per_page:   String(perPage),
    page:       String(page),
    order:      "votes",
    order_by:   "votes",
  });
  const resp = await fetch(`https://api.inaturalist.org/v1/observations?${params}`, {
    headers: { "User-Agent": "HookVision/1.0 (fishing app; WA Australia)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!resp.ok) throw new Error(`iNat ${resp.status}`);
  const d = await resp.json() as InatResp;
  return d.results;
}

async function upsertObs(obs: InatObs[], speciesKey: string, scientificName: string): Promise<number> {
  let added = 0;
  for (const o of obs) {
    for (const photo of o.photos) {
      if (!photo.url) continue;
      const obsId = `inat:${o.id}`;
      const existing = await db
        .select({ id: contrastReferences.id })
        .from(contrastReferences)
        .where(and(eq(contrastReferences.observationId, obsId), eq(contrastReferences.species, speciesKey)))
        .limit(1);
      if (existing.length > 0) continue;
      try {
        await db.insert(contrastReferences).values({
          species:        speciesKey,
          scientificName,
          source:         "inat",
          photoUrl:       largeUrl(photo.url),
          thumbUrl:       smallUrl(photo.url),
          observationId:  obsId,
          location:       o.place_guess ?? "Global",
          qualityGrade:   o.quality_grade,
          votes:          o.faves_count,
          active:         true,
        });
        added++;
      } catch { /* ignore duplicate */ }
    }
  }
  return added;
}

// ─── In-memory cache ──────────────────────────────────────────────────────────
interface CachedContrastRef { photoUrl: string; species: string; location: string; thumbBase64?: string; }
const cache: Record<string, CachedContrastRef[]> = {
  mangrove_jack:   [],
  fingermark:      [],
  threadfin_salmon:[],
};
let cacheBuilt = false;

async function buildCache(): Promise<void> {
  for (const speciesKey of Object.keys(cache)) {
    const rows = await db
      .select({ photoUrl: contrastReferences.photoUrl, species: contrastReferences.species, location: contrastReferences.location, thumbBase64: contrastReferences.thumbBase64 })
      .from(contrastReferences)
      .where(and(eq(contrastReferences.species, speciesKey), eq(contrastReferences.active, true)))
      .orderBy(desc(contrastReferences.votes))
      .limit(200);
    cache[speciesKey] = rows.map(r => ({
      photoUrl:    r.photoUrl,
      species:     r.species,
      location:    r.location ?? "Australia",
      thumbBase64: r.thumbBase64 ?? undefined,
    }));
  }
  cacheBuilt = true;
  logger.info(
    { jack: cache.mangrove_jack.length, fingermark: cache.fingermark.length, threadfin: cache.threadfin_salmon.length },
    "Contrast species cache built"
  );

  // Pre-warm thumbnails for top refs
  prewarmThumbs().catch(() => {});
}

async function prewarmThumbs(): Promise<void> {
  const toWarm: CachedContrastRef[] = [];
  for (const refs of Object.values(cache)) {
    toWarm.push(...refs.slice(0, 3).filter(r => !r.thumbBase64));
  }
  if (toWarm.length === 0) return;

  await Promise.allSettled(toWarm.map(async (ref) => {
    const b64 = await makeThumbnailFromUrl(ref.photoUrl, 512, 65, 8_000);
    if (b64) {
      ref.thumbBase64 = b64;
      // Persist to DB
      await db.update(contrastReferences)
        .set({ thumbBase64: b64 })
        .where(eq(contrastReferences.photoUrl, ref.photoUrl))
        .catch(() => {});
    }
  }));
  logger.info({ warmed: toWarm.length }, "Contrast species thumbnails pre-warmed");
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Sync all contrast species from iNaturalist into the DB.
 * Runs as a background job after server startup.
 */
export async function syncContrastSpecies(): Promise<void> {
  logger.info("Contrast species sync: starting (Jack + Fingermark + Threadfin)…");
  let grandTotal = 0;

  for (const sp of SPECIES) {
    let spTotal = 0;
    for (let page = 1; page <= sp.pages; page++) {
      try {
        const obs = await fetchInat(sp.name, page);
        if (obs.length === 0) break;
        const added = await upsertObs(obs, sp.key, sp.name);
        spTotal += added;
        logger.info({ species: sp.common, page, fetched: obs.length, added }, "Contrast species page synced");
        if (obs.length < 200) break;
        await new Promise(r => setTimeout(r, 800));
      } catch (err) {
        logger.warn({ species: sp.common, page, err: String(err) }, "Contrast species page failed");
      }
    }
    logger.info({ species: sp.common, added: spTotal }, "Contrast species sync complete");
    grandTotal += spTotal;
    await new Promise(r => setTimeout(r, 1_000));
  }

  logger.info({ grandTotal }, "All contrast species synced");
  await buildCache();
}

/**
 * Initialise cache from DB on startup (fast — no network calls).
 */
export async function initContrastLibrary(): Promise<void> {
  try {
    await buildCache();
  } catch (err) {
    logger.warn({ err: String(err) }, "Contrast library init failed — will retry on first use");
  }
}

/**
 * Return N contrast photos for a given species (with pre-warmed base64 preferred).
 */
export function getContrastRefs(speciesKey: string, n = 2): CachedContrastRef[] {
  const refs = cache[speciesKey] ?? [];
  // Prefer pre-warmed (have base64 thumbs)
  const warmed = refs.filter(r => r.thumbBase64).slice(0, n);
  if (warmed.length >= n) return warmed;
  return refs.slice(0, n);
}

/**
 * Stats for status endpoint.
 */
export async function getContrastStats(): Promise<Record<string, number>> {
  const rows = await db
    .select({ species: contrastReferences.species, count: sql<number>`count(*)::int` })
    .from(contrastReferences)
    .where(eq(contrastReferences.active, true))
    .groupBy(contrastReferences.species);
  return Object.fromEntries(rows.map(r => [r.species, r.count]));
}
