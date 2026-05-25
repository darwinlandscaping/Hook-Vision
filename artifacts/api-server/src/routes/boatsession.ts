/**
 * POST /api/boat-session
 *
 * Synthesises a full verbal fishing intelligence briefing from a completed
 * 10-snapshot boat mode session, then feeds a community report to the brain.
 *
 * Body: { scans: FishAnalysis[], region: "wa" | "nq" | "nt" }
 * Returns: { narration, topSpecies, avgFish, maxFish, avgConf, scanCount }
 */

import { Router } from "express";
import { db, communityReports } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getModel } from "../lib/models.js";
import { logger } from "../lib/logger.js";

interface ScanResult {
  fishCount:   number;
  depth:       string;
  distance:    string;
  species:     string;
  confidence:  number;
  suggestion?: string;
  lure?:       string;
  lureType?:   string;
  technique?:  string;
  archCount?:  number;
  barraPct?:   number;
  waterTemp?:  string;
  bottomType?: string;
  crocAlert?:  boolean;
  crocWarning?: string | null;
  birdAlert?:  string | null;
}

const router = Router();

router.post("/boat-session", async (req, res) => {
  const { scans = [], region = "wa" } = req.body as {
    scans?: ScanResult[];
    region?: string;
  };

  const cappedScans = Array.isArray(scans) ? scans.slice(0, 10) : [];
  const noData      = cappedScans.length === 0;

  // ── Aggregate stats across all scans ──────────────────────────────────────
  const totalFish = cappedScans.reduce((s, r) => s + (r.fishCount ?? 0), 0);
  const avgFish   = noData ? 0 : Math.round(totalFish / cappedScans.length);
  const maxFish   = noData ? 0 : Math.max(...cappedScans.map(r => r.fishCount ?? 0));
  const avgConf   = noData ? 0 : Math.round(
    cappedScans.reduce((s, r) => s + (r.confidence ?? 0), 0) / cappedScans.length
  );

  const speciesCounts: Record<string, number> = {};
  cappedScans.forEach(r => {
    speciesCounts[r.species] = (speciesCounts[r.species] ?? 0) + 1;
  });
  const topSpecies = Object.entries(speciesCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([s]) => s);

  const lures      = [...new Set(cappedScans.map(r => r.lure).filter(Boolean))];
  const depths     = cappedScans.map(r => r.depth).filter(Boolean);
  const techniques = [...new Set(cappedScans.map(r => r.technique).filter(Boolean))];
  const anyCroc    = cappedScans.some(r => r.crocAlert);
  const crocWarning = cappedScans.find(r => r.crocWarning)?.crocWarning ?? null;
  const birdAlert   = cappedScans.find(r => r.birdAlert)?.birdAlert ?? null;
  const avgBarra    = noData ? 0 : cappedScans.reduce((s, r) => s + (r.barraPct ?? 0), 0) / cappedScans.length;

  const sessionSummary = noData
    ? `Session: 10 frames captured, region ${region.toUpperCase()}. No AI analysis data returned — camera may be obscured or water too turbid. No fish detected.`
    : [
        `Session: ${cappedScans.length} sonar scans, region ${region.toUpperCase()}.`,
        `Fish counts per scan: ${cappedScans.map(r => r.fishCount).join(", ")}.`,
        `Average fish: ${avgFish}, peak: ${maxFish}, overall confidence: ${avgConf}%.`,
        `Species detected: ${topSpecies.join(", ")}.`,
        `Depth readings: ${depths.join(", ")}.`,
        `Barramundi probability average: ${Math.round(avgBarra)}%.`,
        lures.length      ? `Lures suggested: ${lures.join(", ")}.`   : "",
        techniques.length ? `Techniques: ${techniques.join(", ")}.`    : "",
        anyCroc           ? `⚠️ CROC ALERT detected. ${crocWarning ?? "Stay alert."}` : "No croc activity detected.",
        birdAlert         ? `Bird activity: ${birdAlert}.`             : "No bird alerts.",
        `Individual scans: ${cappedScans.map((r, i) => `#${i + 1}: ${r.fishCount} fish at ${r.depth} (${r.species})`).join("; ")}.`,
      ].filter(Boolean).join("\n");

  try {
    const model = getModel("top");

    const userPrompt = noData
      ? `Ten sonar frames were captured in ${region.toUpperCase()} but none returned fish analysis data. ` +
        `Deliver a short, calm spoken-word update for the angler: acknowledge that this pass came up blank, ` +
        `suggest possible reasons (turbid water, camera angle, sonar off-target), and encourage them to keep scanning. ` +
        `Under 100 words. Speak directly to the angler.`
      : `Here is the complete data from a ${cappedScans.length}-scan boat mode sonar session:\n\n` +
        `${sessionSummary}\n\n` +
        `Deliver a comprehensive fishing intelligence briefing: what's consistently on the sonar, ` +
        `best depth to target, dominant species, recommended lure and technique, croc/bird alerts, ` +
        `and your overall verdict. Make it punchy and immediately actionable.`;

    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.4,
      max_tokens: 350,
      messages: [
        {
          role: "system",
          content:
            "You are an expert barramundi fishing guide AI narrating through a fisherman's earphones. " +
            "Synthesise sonar session data into a punchy, actionable spoken-word briefing. " +
            "Be specific, confident, and exciting. Under 280 words. Speak directly to the angler.",
        },
        { role: "user", content: userPrompt },
      ],
    }, { signal: AbortSignal.timeout(45_000) });

    const narration =
      completion.choices[0]?.message?.content ??
      "Session analysed. Strong fish marks across all ten scans. Continue working this spot.";

    // ── Feed to brain (community reports for hotspot tracking) ──────────────
    const topSpeciesName = topSpecies[0] ?? "Unknown";
    try {
      await db.insert(communityReports).values({
        species:        topSpeciesName,
        fishCount:      avgFish,
        depth:          depths[0] ?? null,
        lureSuggestion: lures[0] ?? null,
        locationName:   null,
        rawAnalysis: {
          sourceType:  "boat_session",
          region,
          scanCount:   cappedScans.length,
          maxFish,
          avgConf,
          topSpecies,
          narration,
        } as any,
      });
    } catch (dbErr) {
      logger.warn({ dbErr }, "boat-session: community_reports insert skipped");
    }

    logger.info({ region, scans: cappedScans.length, avgFish, topSpecies }, "boat-session analysis complete");

    res.json({
      narration,
      scanCount: cappedScans.length,
      topSpecies,
      avgFish,
      maxFish,
      avgConf,
    });

  } catch (err) {
    logger.error({ err }, "boat-session: GPT synthesis failed");
    res.status(500).json({ error: "Failed to synthesise session" });
  }
});

export default router;
