/**
 * /api/barra-library/status  — Brain photo library stats
 * /api/barra-library/confirm — Mark a photo as confirmed barra (community learning)
 */
import { Router } from "express";
import { getLibraryStats, addCommunityReference } from "../lib/barraLibrary.js";

const router = Router();

router.get("/barra-library/status", async (_req, res) => {
  try {
    const stats = await getLibraryStats();
    res.json({
      ok:          true,
      message:     `Brain loaded with ${stats.total.toLocaleString()} verified barramundi reference photos`,
      total:       stats.total,
      inat:        stats.inat,
      community:   stats.community,
      cacheSize:   stats.cacheSize,
      lastRefresh: stats.lastRefresh,
      refsPerCall: 3,
      description: "Research-grade iNaturalist observations + community-confirmed catches. Each detection call uses 3 rotating reference specimens for few-shot visual comparison.",
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/barra-library/confirm", async (req, res) => {
  const { photoUrl, location, base64Thumb, viewingAngle } = req.body as {
    photoUrl?:     string;
    location?:     string;
    base64Thumb?:  string;
    viewingAngle?: "top" | "side" | "angled";
  };
  if (!base64Thumb && !photoUrl) {
    res.status(400).json({ error: "base64Thumb or photoUrl required" });
    return;
  }
  try {
    await addCommunityReference({
      base64Thumb:  base64Thumb ?? "",
      photoUrl:     photoUrl ?? "community",
      location:     location ?? "Australia",
      viewingAngle,
    });
    res.json({ ok: true, message: "Photo added to barra reference library — the brain just got smarter!" });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
