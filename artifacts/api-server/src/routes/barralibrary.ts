/**
 * /api/barra-library/status  — Brain photo library stats
 * /api/barra-library/confirm — Mark a photo as confirmed barra (community learning)
 * /api/barra-library/expand  — Trigger full multi-source expansion (GBIF + ALA + geo iNat + contrast species)
 * /api/barra-library/contrast — Contrast species stats (Jack, Threadfin, Fingermark)
 */
import { Router } from "express";
import { getLibraryStats, addCommunityReference, expandBarraLibrary } from "../lib/barraLibrary.js";
import { syncContrastSpecies, getContrastStats } from "../lib/contrastLibrary.js";

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

router.post("/barra-library/expand", async (_req, res) => {
  // Kick off expansion in background — return immediately so connection doesn't hang
  res.json({ ok: true, message: "Expansion started in background — check /api/barra-library/status in a few minutes" });
  try {
    const [barraResult] = await Promise.allSettled([
      expandBarraLibrary(),
    ]);
    syncContrastSpecies().catch(() => {});
    const barra = barraResult.status === "fulfilled" ? barraResult.value : { gbif: 0, ala: 0, geographic: 0, total: 0 };
    _req.log?.info({ barra }, "Barra library expansion background complete");
  } catch (err) {
    _req.log?.warn({ err: String(err) }, "Barra library expansion background failed");
  }
});

router.get("/barra-library/contrast", async (_req, res) => {
  try {
    const stats = await getContrastStats();
    res.json({
      ok:      true,
      message: "Contrast species reference library stats",
      stats,
      total:   Object.values(stats).reduce((a, b) => a + b, 0),
      purpose: "Photos of Mangrove Jack, Threadfin Salmon, and Fingermark — injected into AI prompts so the model knows what NOT to call a barramundi",
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
