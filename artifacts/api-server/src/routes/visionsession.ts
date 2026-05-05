/**
 * Vision Session — start / end / query fishing sessions
 *
 * POST /api/vision-session/start  { region }        → { sessionId }
 * POST /api/vision-session/end    { sessionId }      → { ok: true }
 * GET  /api/vision-session/:id                       → VisionSession row
 */
import { Router } from "express";
import { db, visionSessions, visionDetections } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { endSession } from "../lib/targetTracker.js";

const router = Router();

router.post("/vision-session/start", async (req, res) => {
  const { region = "wa" } = req.body as { region?: string };
  const validRegion = ["wa", "nq", "nt"].includes(region) ? region : "wa";
  try {
    const [session] = await db
      .insert(visionSessions)
      .values({ region: validRegion })
      .returning();
    req.log.info({ sessionId: session.id, region: validRegion }, "vision session started");
    res.json({ sessionId: session.id });
  } catch (err) {
    req.log.error({ err }, "vision-session/start failed");
    res.status(500).json({ error: "Failed to start session" });
  }
});

router.post("/vision-session/end", async (req, res) => {
  const { sessionId } = req.body as { sessionId?: number };
  if (!sessionId) { res.status(400).json({ error: "sessionId required" }); return; }
  try {
    const detectionCount = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(visionDetections)
      .where(eq(visionDetections.sessionId, sessionId));

    await db
      .update(visionSessions)
      .set({
        endedAt: new Date(),
        totalDetections: detectionCount[0]?.count ?? 0,
      })
      .where(eq(visionSessions.id, sessionId));

    endSession(sessionId);
    req.log.info({ sessionId }, "vision session ended");
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "vision-session/end failed");
    res.status(500).json({ error: "Failed to end session" });
  }
});

router.get("/vision-session/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "invalid id" }); return; }
  try {
    const [session] = await db
      .select()
      .from(visionSessions)
      .where(eq(visionSessions.id, id));
    if (!session) { res.status(404).json({ error: "not found" }); return; }
    res.json(session);
  } catch (err) {
    req.log.error({ err }, "vision-session/get failed");
    res.status(500).json({ error: "Failed to fetch session" });
  }
});

export default router;
