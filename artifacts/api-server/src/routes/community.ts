import { Router } from "express";
import { desc, sql } from "drizzle-orm";
import { db, communityReports, communityInsights } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger.js";

const router = Router();

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

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

    const reports = await db
      .select()
      .from(communityReports)
      .orderBy(desc(communityReports.submittedAt))
      .limit(200);

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

    const dataBlob = reports.map((r) => ({
      species:   r.species,
      fishCount: r.fishCount,
      depth:     r.depth,
      location:  r.locationName,
      lure:      r.lureSuggestion,
      time:      r.submittedAt,
    }));

    const prompt = `You are the HookVision community intelligence engine for NT Australia fishing.
Analyze these ${reports.length} anonymous sonar scan reports from HookVision users across the NT.

RAW DATA:
${JSON.stringify(dataBlob, null, 2)}

Produce a JSON object with these exact fields:
- hotSpecies: array of up to 5 objects { species: string, count: number, trend: "rising"|"stable"|"falling" }
- hotDepths: array of up to 4 objects { range: string, count: number, notes: string }
- hotTimes: array of up to 4 objects { period: string, activity: "high"|"medium"|"low", notes: string }
- hotLocations: array of up to 5 strings (location names from reports)
- tips: array of 4-6 actionable fishing tips derived from patterns in the data
- summary: a 2-3 sentence plain-English summary of current NT fishing conditions

Rules:
- Base everything strictly on the data provided
- For hotTimes, group by morning/midday/afternoon/evening/night from timestamps
- For trend, compare first half vs second half of the dataset (newest = end)
- Keep tips specific and NT-relevant (barramundi, bream, trevally, threadfin etc)
- Respond ONLY with valid JSON, no markdown

JSON:`;

    const completion = await openai.chat.completions.create({
      model:  "gpt-4.1",
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 800,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    const insight = await db
      .insert(communityInsights)
      .values({
        reportCount:  reports.length,
        hotSpecies:   parsed.hotSpecies   ?? [],
        hotDepths:    parsed.hotDepths    ?? [],
        hotTimes:     parsed.hotTimes     ?? [],
        hotLocations: parsed.hotLocations ?? [],
        tips:         parsed.tips         ?? [],
        summary: typeof parsed.summary === "string" ? parsed.summary : "",
      })
      .returning();

    logger.info({ reportCount: reports.length }, "Community insights refreshed");
    res.json(insight[0]);
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
      model: "gpt-4.1",
      max_completion_tokens: 250,
      messages: [
        {
          role: "system",
          content:
            "You are an expert fishfinder sonar analyst for Northern Territory Australian tropical waters. " +
            "Explain in 2-3 short sentences how the sonar signatures of two fish species differ, " +
            "so an angler understands why AI detection can vary between them. Keep it practical and plain.",
        },
        {
          role: "user",
          content: `Compare the sonar signatures of ${a} vs ${b}. Why might a sonar AI identify one when the other is expected?`,
        },
      ],
    });
    const explanation = completion.choices[0]?.message?.content?.trim() ?? "";
    res.json({ explanation });
  } catch (err) {
    logger.error({ err }, "Failed to compare species");
    res.status(500).json({ error: "Failed to generate comparison" });
  }
});

export default router;
