import { Router } from "express";
import {
  getDailyConditions,
  refreshDailyConditions,
  getLiveWeather,
  getLiveWeatherNT,
  getLiveWeatherNQ,
  computeMoonNow,
} from "../lib/dailyBriefing";

const router = Router();

/**
 * GET /api/daily-conditions
 *
 * Returns live WA/Kimberley fishing conditions. Every request:
 *   - Moon phase: recomputed from current WA time (free math, no API)
 *   - Weather: served from a 20-minute BOM cache (fresh within 20min always)
 *   - Barra activity: recomputed from fresh moon + weather
 *   - AI briefing, sonar tip, season: served from the daily cache (refreshes midnight AWST)
 *   - lastRefreshed: set to NOW so the client shows the correct fetch time
 */
router.get("/daily-conditions", async (req, res) => {
  const base = getDailyConditions();
  if (!base) {
    res.status(503).json({ error: "Daily conditions not yet loaded. Try again in a moment." });
    return;
  }

  // Recompute moon from current WA time — pure math, instant
  const moon = computeMoonNow();

  // Fetch region-appropriate BOM weather (cached max 20min per region)
  const region = ((req.query["region"] as string) || "wa").toLowerCase();
  const weather = region === "nt"
    ? await getLiveWeatherNT()
    : region === "nq"
      ? await getLiveWeatherNQ()
      : await getLiveWeather();

  // Recompute barra activity with fresh moon + weather
  let score = 50;
  if (moon.name === "New Moon" || moon.name === "Full Moon") score += 25;
  else if (moon.name === "First Quarter" || moon.name === "Last Quarter") score += 20;
  else if (moon.name.includes("Crescent")) score += 10;
  else score += 15;

  if (base.season.name === "Run-off") score += 20;
  else if (base.season.name === "Build-up") score += 15;
  else if (base.season.name === "Wet Season") score += 10;
  else score += 5;

  if (weather) {
    if (weather.pressureTrend === "falling") score += 15;
    if (weather.pressureHpa < 1005) score += 10;
    if (weather.pressureTrend === "rising") score += 5;
    if (weather.windSpeedKmh > 25) score -= 10;
  }
  score = Math.min(99, Math.max(20, score));

  let barraActivity: string;
  if (score >= 85) barraActivity = `🔥 EXCEPTIONAL (${score}/100) — Multiple feeding windows. Fish are active and aggressive.`;
  else if (score >= 70) barraActivity = `✅ VERY GOOD (${score}/100) — Strong feeding windows. Worth an early start.`;
  else if (score >= 55) barraActivity = `👍 GOOD (${score}/100) — Standard conditions. Fish on the right tide phase.`;
  else if (score >= 40) barraActivity = `⚠️ MODERATE (${score}/100) — Selective. Focus on structure. Live bait may outperform lures.`;
  else barraActivity = `🌀 TOUGH (${score}/100) — Difficult conditions. Target deep holes and sheltered water. Patience required.`;

  res.json({
    ...base,
    moon,
    weather,
    barraActivity,
    lastRefreshed: new Date().toISOString(),
  });
});

/** POST /api/daily-conditions/refresh — manually trigger a full daily refresh (admin use) */
router.post("/daily-conditions/refresh", async (_req, res) => {
  try {
    await refreshDailyConditions();
    res.json({ ok: true, conditions: getDailyConditions() });
  } catch (err) {
    res.status(500).json({ error: "Refresh failed", detail: String(err) });
  }
});

export default router;
