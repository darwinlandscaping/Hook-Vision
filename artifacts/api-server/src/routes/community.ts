import { Router } from "express";
import { desc, sql } from "drizzle-orm";
import { db, communityReports, communityInsights } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger.js";
import { getModel } from "../lib/models.js";

const router = Router();

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

let _insightsRegenerating = false;

// ─── Depth bucketing helper ──────────────────────────────────────────────────
function depthBucket(depthStr: string): string {
  const match = depthStr.match(/(\d+(?:\.\d+)?)/);
  if (!match) return "Unknown";
  const d = parseFloat(match[1]);
  if (d <= 2)  return "0-2m (shallow)";
  if (d <= 5)  return "2-5m (mid-water)";
  if (d <= 10) return "5-10m (deep)";
  if (d <= 20) return "10-20m (reef)";
  return "20m+ (deep reef)";
}

// ─── PRIVACY: strip all identifying fields before storage ───────────────────
function sanitiseReport(body: Record<string, unknown>) {
  return {
    species:       typeof body.species === "string"  ? body.species.slice(0, 255) : null,
    fishCount:     typeof body.fishCount === "number" ? body.fishCount : null,
    depth:         typeof body.depth === "string"    ? body.depth.slice(0, 64)   : null,
    locationName:  typeof body.locationName === "string" ? body.locationName.slice(0, 255) : null,
    lureSuggestion: typeof body.lureSuggestion === "string" ? body.lureSuggestion.slice(0, 500) : null,
    // rawAnalysis: strip any potential PII fields before storage
    rawAnalysis: body.rawAnalysis
      ? sanitiseAnalysis(body.rawAnalysis as Record<string, unknown>)
      : null,
    // NEVER stored: deviceId, lat, lng, ip address, user agent
    deviceId:      null,
    lat:           null,
    lng:           null,
  };
}

function sanitiseAnalysis(a: Record<string, unknown>) {
  // Keep only the fishing data fields, drop anything else
  const allowed = ["species","fishCount","depth","confidence","behaviourNotes",
    "suggestion","crocAlert","archCount","archXFrac","archYFrac","waterTemp","bottomType"];
  return Object.fromEntries(
    Object.entries(a).filter(([k]) => allowed.includes(k))
  );
}

// ─── POST /api/community/report ─────────────────────────────────────────────
router.post("/community/report", async (req, res) => {
  try {
    const safe = sanitiseReport(req.body as Record<string, unknown>);

    await db.insert(communityReports).values(safe);

    logger.info({ species: safe.species, fishCount: safe.fishCount, depth: safe.depth },
      "Community report stored (anonymous)");
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to store community report");
    res.status(500).json({ error: "Failed to store report" });
  }
});

// ─── GET /api/community/feed  (real-time live feed, last N reports) ──────────
router.get("/community/feed", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const since = req.query.since ? new Date(String(req.query.since)) : null;

    const rows = await db
      .select({
        id:           communityReports.id,
        species:      communityReports.species,
        fishCount:    communityReports.fishCount,
        depth:        communityReports.depth,
        locationName: communityReports.locationName,
        lureSuggestion: communityReports.lureSuggestion,
        submittedAt:  communityReports.submittedAt,
      })
      .from(communityReports)
      .orderBy(desc(communityReports.submittedAt))
      .limit(limit);

    // Filter by since client-side (simple and avoids drizzle gt() complexity)
    const filtered = since
      ? rows.filter((r) => new Date(r.submittedAt) > since)
      : rows;

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(communityReports);

    res.json({ reports: filtered, total });
  } catch (err) {
    logger.error({ err }, "Failed to get community feed");
    res.status(500).json({ error: "Failed to get feed" });
  }
});

// ─── Insights regeneration (extracted for async fire-and-forget) ──────────────
async function regenerateInsights() {
  const reports = await db
    .select()
    .from(communityReports)
    .orderBy(desc(communityReports.submittedAt))
    .limit(300);

  if (reports.length === 0) return;

  const speciesCounts: Record<string, number> = {};
  const depthCounts:   Record<string, number> = {};
  const locationSet:   Set<string>            = new Set();
  const lureSnippets:  string[]               = [];

  for (const r of reports) {
    if (r.species && r.species !== "No fish detected") {
      const sp = r.species.toLowerCase().replace(/^\w/, c => c.toUpperCase());
      speciesCounts[sp] = (speciesCounts[sp] ?? 0) + 1;
    }
    if (r.depth) {
      const bucket = depthBucket(r.depth);
      depthCounts[bucket] = (depthCounts[bucket] ?? 0) + 1;
    }
    if (r.locationName) locationSet.add(r.locationName);
    if (r.lureSuggestion && lureSnippets.length < 20) {
      lureSnippets.push(r.lureSuggestion.slice(0, 120));
    }
  }

  const topSpecies = Object.entries(speciesCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([sp, count]) => `${sp} (${count} reports)`);

  const topDepths = Object.entries(depthCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([range, count]) => `${range}: ${count} reports`);

  const topLocations = [...locationSet].slice(0, 15);

  const prompt = `You are the HookVision Brain — the AI intelligence engine for WA (Kimberley/Pilbara), NQ (Far North Queensland) and NT (Top End) fishing.

Analyse this aggregated fishing intelligence from ${reports.length} HookVision community scans and expert knowledge entries:

SPECIES ACTIVITY (most reported → least):
${topSpecies.join(", ")}

DEPTH PATTERNS:
${topDepths.join(" | ")}

ACTIVE LOCATIONS:
${topLocations.join(", ")}

SAMPLE LURE & TECHNIQUE INTELLIGENCE (first 20 entries):
${lureSnippets.map((l, i) => `${i + 1}. ${l}`).join("\n")}

Based on this intelligence, produce a JSON object:
{
  "hotSpecies": [up to 5 objects: { "species": string, "count": number, "trend": "rising"|"stable"|"falling" }],
  "hotDepths": [up to 4 objects: { "range": string, "count": number, "notes": string }],
  "hotTimes": [up to 3 objects: { "period": string, "activity": "high"|"medium"|"low", "notes": string }],
  "hotLocations": [up to 6 strings — location names from the data above],
  "tips": [5-6 specific, actionable fishing tips for WA/NQ/NT anglers],
  "summary": "2-3 sentence plain-English summary of current fishing conditions across WA, NQ and NT"
}

Rules:
- hotSpecies counts come directly from the SPECIES ACTIVITY counts above
- hotDepths use the DEPTH PATTERNS data above
- hotLocations must be real names from ACTIVE LOCATIONS list
- tips must be specific: name the species, location type, lure, and technique
- Respond ONLY with valid JSON — no markdown, no explanation`;

  const completion = await openai.chat.completions.create({
    model:  getModel("mid"),
    temperature: 0.7,
    messages: [{ role: "user", content: prompt }],
    max_completion_tokens: 1200,
    response_format: { type: "json_object" },
  }, { signal: AbortSignal.timeout(40_000) });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(raw); } catch { parsed = {}; }

  await db
    .insert(communityInsights)
    .values({
      reportCount:  reports.length,
      hotSpecies:   parsed.hotSpecies   ?? [],
      hotDepths:    parsed.hotDepths    ?? [],
      hotTimes:     parsed.hotTimes     ?? [],
      hotLocations: parsed.hotLocations ?? [],
      tips:         parsed.tips         ?? [],
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
    });

  logger.info({ reportCount: reports.length }, "Community insights refreshed");
}

// ─── GET /api/community/insights  (AI analysis, cached 6 hours) ──────────────
router.get("/community/insights", async (req, res) => {
  try {
    const latest = await db
      .select()
      .from(communityInsights)
      .orderBy(desc(communityInsights.generatedAt))
      .limit(1);

    const now = Date.now();
    const isStale =
      latest.length === 0 ||
      now - new Date(latest[0].generatedAt).getTime() > SIX_HOURS_MS;

    if (!isStale) {
      res.json(latest[0]);
      return;
    }

    if (isStale && latest.length > 0 && !_insightsRegenerating) {
      _insightsRegenerating = true;
      regenerateInsights().finally(() => { _insightsRegenerating = false; });
      res.json(latest[0]);
      return;
    }

    const reports = await db
      .select()
      .from(communityReports)
      .orderBy(desc(communityReports.submittedAt))
      .limit(300);

    if (reports.length === 0) {
      res.json({
        reportCount: 0,
        hotSpecies:  [],
        hotDepths:   [],
        hotTimes:    [],
        hotLocations: [],
        tips: ["Be the first to submit a scan and build the community brain!"],
        summary: "No community data yet. Start scanning to contribute!",
        generatedAt: new Date().toISOString(),
      });
      return;
    }

    const insight = await regenerateInsights().then(async () => {
      const rows = await db
        .select()
        .from(communityInsights)
        .orderBy(desc(communityInsights.generatedAt))
        .limit(1);
      return rows[0] ?? null;
    });

    if (insight) {
      res.json(insight);
    } else {
      res.json({
        reportCount: 0,
        hotSpecies:  [],
        hotDepths:   [],
        hotTimes:    [],
        hotLocations: [],
        tips: ["Be the first to submit a scan and build the community brain!"],
        summary: "No community data yet. Start scanning to contribute!",
        generatedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    logger.error({ err }, "Failed to generate community insights");
    res.status(500).json({ error: "Failed to generate insights" });
  }
});

// ─── GET /api/community/stats ────────────────────────────────────────────────
router.get("/community/stats", async (_req, res) => {
  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(communityReports);

    const topSpecies = await db
      .select({
        species: communityReports.species,
        count:   sql<number>`count(*)::int`,
      })
      .from(communityReports)
      .groupBy(communityReports.species)
      .orderBy(desc(sql`count(*)`))
      .limit(5);

    res.json({ totalReports: count, topSpecies });
  } catch (err) {
    logger.error({ err }, "Failed to get community stats");
    res.status(500).json({ error: "Failed to get stats" });
  }
});

// ─── GET /api/community/hotspots ─────────────────────────────────────────────
// Returns top fishing locations scored by activity, fish count & species variety.
// "heat" field: "firing" = 2+ scans in last 2h, "hot" = 1 scan in last 2h, "warm" otherwise.
router.get("/community/hotspots", async (_req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        location_name                                                          AS "locationName",
        COUNT(*)::int                                                          AS report_count,
        ROUND(AVG(fish_count)::numeric, 1)                                    AS avg_fish_count,
        COUNT(DISTINCT species)::int                                          AS species_count,
        SUM(CASE WHEN submitted_at > NOW() - INTERVAL '2 hours'  THEN 1 ELSE 0 END)::int AS recent_2h,
        SUM(CASE WHEN submitted_at > NOW() - INTERVAL '6 hours'  THEN 1 ELSE 0 END)::int AS recent_6h,
        MAX(submitted_at)                                                      AS latest_at,
        -- Most common species at this location
        (SELECT species FROM community_reports r2
          WHERE r2.location_name = community_reports.location_name
            AND r2.submitted_at  > NOW() - INTERVAL '24 hours'
          GROUP BY species ORDER BY COUNT(*) DESC LIMIT 1)                    AS top_species
      FROM community_reports
      WHERE location_name IS NOT NULL
        AND submitted_at > NOW() - INTERVAL '24 hours'
      GROUP BY location_name
      HAVING COUNT(*) >= 1
      ORDER BY (
        COUNT(*) * GREATEST(COALESCE(AVG(fish_count), 1), 1) +
        COUNT(DISTINCT species) * 2 +
        SUM(CASE WHEN submitted_at > NOW() - INTERVAL '2 hours' THEN 5 ELSE 0 END)
      ) DESC
      LIMIT 8
    `);

    const hotspots = (rows.rows as any[]).map((r) => {
      const recent2h = Number(r.recent_2h ?? 0);
      const recent6h = Number(r.recent_6h ?? 0);
      const heat: "firing" | "hot" | "warm" =
        recent2h >= 2 ? "firing" :
        recent2h >= 1 || recent6h >= 3 ? "hot" : "warm";
      return {
        locationName: r.locationName as string,
        reportCount:  Number(r.report_count),
        avgFishCount: parseFloat(r.avg_fish_count ?? "0"),
        speciesCount: Number(r.species_count),
        topSpecies:   (r.top_species as string | null) ?? null,
        recent2h,
        recent6h,
        heat,
        latestAt: r.latest_at,
      };
    });

    const firingSpots = hotspots.filter((h) => h.heat === "firing");
    res.json({ hotspots, firingCount: firingSpots.length });
  } catch (err) {
    logger.error({ err }, "Failed to get hotspots");
    res.status(500).json({ error: "Failed to get hotspots" });
  }
});

// ─── GET /api/community/compare ──────────────────────────────────────────────
// Explains the sonar differences between two fish species so the user
// understands why the AI detected a different species than expected.
router.get("/community/compare", async (req, res) => {
  const a = String(req.query.a ?? "").slice(0, 100).trim();
  const b = String(req.query.b ?? "").slice(0, 100).trim();
  if (!a || !b) {
    return res.status(400).json({ error: "Query params a and b are required" });
  }
  try {
    const completion = await openai.chat.completions.create({
      model: getModel("top"),
      temperature: 0.7,
      max_completion_tokens: 250,
      messages: [
        {
          role: "system",
          content:
            "You are an expert fishfinder sonar analyst for Western Australia and Kimberley tropical waters. " +
            "Explain in 2-3 short sentences how the sonar signatures of two fish species differ, " +
            "so an angler understands why AI detection can vary between them. Keep it practical and plain.",
        },
        {
          role: "user",
          content: `Compare the sonar signatures of ${a} vs ${b}. Why might a sonar AI identify one when the other is expected?`,
        },
      ],
    }, { signal: AbortSignal.timeout(30_000) });
    const explanation = completion.choices[0]?.message?.content?.trim() ?? "";
    res.json({ explanation });
  } catch (err) {
    logger.error({ err }, "Failed to compare species");
    res.status(500).json({ error: "Failed to generate comparison" });
  }
});

export default router;
