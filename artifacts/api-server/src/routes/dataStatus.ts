import { Router } from "express";
import { getDailyConditions, refreshDailyConditions } from "../lib/dailyBriefing";

const router = Router();

/** GET /api/daily-conditions — returns today's cached NT fishing conditions */
router.get("/daily-conditions", (_req, res) => {
  const conditions = getDailyConditions();
  if (!conditions) {
    res.status(503).json({ error: "Daily conditions not yet loaded. Try again in a moment." });
    return;
  }
  res.json(conditions);
});

/** POST /api/daily-conditions/refresh — manually trigger a refresh (admin use) */
router.post("/daily-conditions/refresh", async (_req, res) => {
  try {
    await refreshDailyConditions();
    res.json({ ok: true, conditions: getDailyConditions() });
  } catch (err) {
    res.status(500).json({ error: "Refresh failed", detail: String(err) });
  }
});

export default router;
