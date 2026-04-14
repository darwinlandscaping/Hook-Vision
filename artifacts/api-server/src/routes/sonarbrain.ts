/**
 * /api/sonar-brain/status  — Sonar arch brain stats
 * /api/sonar-brain/submit  — Submit a community-confirmed barra arch scan
 */
import { Router } from "express";
import { getSonarBrainStats, addCommunityBarraArch } from "../lib/sonarBrain.js";

const router = Router();

router.get("/sonar-brain/status", async (_req, res) => {
  try {
    const stats = await getSonarBrainStats();
    res.json({
      ok:           true,
      message:      `Sonar Brain: ${stats.totalRefs} reference sonar scans loaded (${stats.demosLoaded} expert demos + ${stats.community} community)`,
      demosLoaded:  stats.demosLoaded,
      community:    stats.community,
      totalRefs:    stats.totalRefs,
      refsPerCall:  stats.refsPerCall,
      brands:       stats.brands,
      description:  "Expert-labeled sonar demos + community-confirmed barra arch scans. Each analysis call injects reference images so the AI compares against known barra arch patterns.",
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/sonar-brain/submit", async (req, res) => {
  const { imageBase64, brand, depth, fishCount, description } = req.body as {
    imageBase64?:  string;
    brand?:        string;
    depth?:        string;
    fishCount?:    number;
    description?:  string;
  };

  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 required" });
    return;
  }
  if (imageBase64.length > 800_000) {
    res.status(400).json({ error: "Image too large — please compress to < 600KB before submitting" });
    return;
  }

  try {
    await addCommunityBarraArch({ imageBase64, brand, depth, fishCount, description });
    res.json({ ok: true, message: "Sonar scan added to Barra Arch Brain — the brain just got smarter!" });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
