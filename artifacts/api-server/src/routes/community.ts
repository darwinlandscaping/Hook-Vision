import { Router } from "express";
import { desc, sql } from "drizzle-orm";
import { db, communityReports, communityInsights } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger.js";

const router = Router();

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

router.post("/community/report", async (req, res) => {
  try {
    const {
      deviceId,
      species,
      fishCount,
      depth,
      locationName,
      lat,
      lng,
      conditions,
      lureSuggestion,
      rawAnalysis,
    } = req.body;

    await db.insert(communityReports).values({
      deviceId: deviceId ?? null,
      species: species ?? null,
      fishCount: typeof fishCount === "number" ? fishCount : null,
      depth: depth ?? null,
      locationName: locationName ?? null,
      lat: typeof lat === "number" ? lat : null,
      lng: typeof lng === "number" ? lng : null,
      conditions: conditions ?? null,
      lureSuggestion: lureSuggestion ?? null,
      rawAnalysis: rawAnalysis ?? null,
    });

    logger.info({ species, fishCount, depth }, "Community report submitted");
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to store community report");
    res.status(500).json({ error: "Failed to store report" });
  }
});

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
        hotSpecies: [],
        hotDepths: [],
        hotTimes: [],
        hotLocations: [],
        tips: ["Be the first to submit a scan and build the community brain!"],
        summary: "No community data yet. Start scanning to contribute!",
        generatedAt: new Date().toISOString(),
      });
      return;
    }

    const dataBlob = reports.map((r) => ({
      species: r.species,
      fishCount: r.fishCount,
      depth: r.depth,
      location: r.locationName,
      lure: r.lureSuggestion,
      time: r.submittedAt,
      conditions: r.conditions,
    }));

    const prompt = `You are the HookVision community intelligence engine for NT Australia fishing.
Analyze these ${reports.length} recent sonar scan reports from HookVision users across the NT.

RAW DATA:
${JSON.stringify(dataBlob, null, 2)}

Produce a JSON object with these exact fields:
- hotSpecies: array of up to 5 objects { species: string, count: number, trend: "rising"|"stable"|"falling" }
- hotDepths: array of up to 4 objects { range: string, count: number, notes: string }
- hotTimes: array of up to 4 objects { period: string, activity: "high"|"medium"|"low", notes: string }
- hotLocations: array of up to 5 strings (location names from reports, or "Unknown" areas if none)
- tips: array of 4-6 actionable fishing tips derived from patterns in the data
- summary: a 2-3 sentence plain-English summary of current NT fishing conditions based on the data

Rules:
- Base everything strictly on the data provided
- For hotTimes, group by morning/midday/afternoon/evening/night from timestamps
- For trend, compare first half vs second half of the dataset (newest data = end)
- Keep tips specific and NT-relevant (barramundi, bream, trevally, threadfin etc)
- Respond ONLY with valid JSON, no markdown

JSON:`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 800,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }

    const insight = await db
      .insert(communityInsights)
      .values({
        reportCount: reports.length,
        hotSpecies: parsed.hotSpecies ?? [],
        hotDepths: parsed.hotDepths ?? [],
        hotTimes: parsed.hotTimes ?? [],
        hotLocations: parsed.hotLocations ?? [],
        tips: parsed.tips ?? [],
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

router.get("/community/stats", async (_req, res) => {
  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(communityReports);

    const topSpecies = await db
      .select({
        species: communityReports.species,
        count: sql<number>`count(*)::int`,
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

export default router;
