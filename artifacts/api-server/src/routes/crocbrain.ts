/**
 * /api/croc-brain/status  — Croc reference library stats
 * /api/croc-brain/refresh — Manually trigger iNaturalist re-sync
 */
import { Router } from "express";
import { getCrocLibraryStats, refreshCrocLibrary } from "../lib/crocLibrary.js";

const router = Router();

router.get("/croc-brain/status", async (_req, res) => {
  try {
    const stats = await getCrocLibraryStats();
    res.json({
      ok:          true,
      message:     `Croc Brain: ${stats.total} saltwater croc reference photos (${stats.warmed} pre-warmed, ${stats.topView} top-view, ${stats.sideView} side-view)`,
      total:       stats.total,
      warmed:      stats.warmed,
      topView:     stats.topView,
      sideView:    stats.sideView,
      lastSyncAgo: stats.lastSyncAgo,
      description: "iNaturalist research-grade Crocodylus porosus photos (out-of-water body shapes). Injected into sonar analysis as cross-modal shape references — AI compares sonar blob silhouettes against confirmed croc body outlines to detect crocs near-surface.",
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/croc-brain/refresh", async (_req, res) => {
  try {
    refreshCrocLibrary().catch(() => {});
    res.json({ ok: true, message: "Croc library refresh triggered (runs in background)" });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
