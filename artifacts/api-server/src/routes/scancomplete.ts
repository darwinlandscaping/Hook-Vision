import { Router } from "express";
import { db, brainVideos, communityReports } from "@workspace/db";
import { applyHudUpdate } from "./hud.js";
import { addCommunityBarraArch } from "../lib/sonarBrain.js";
import { logger } from "../lib/logger.js";

const router = Router();

interface BrainSonarPayload {
  title?: string;
  imageUri?: string | null;
  species?: string;
  depth?: string | null;
  aiSummary?: string;
  tips?: string[];
  location?: string | null;
  fishCount?: number;
}

interface SonarBrainPayload {
  imageBase64?: string;
  brand?: string;
  depth?: string | null;
  fishCount?: number;
  description?: string;
}

interface CommunityReportPayload {
  species?: string;
  fishCount?: number;
  depth?: string;
  lureSuggestion?: string;
  rawAnalysis?: Record<string, unknown> | null;
  locationName?: string | null;
}

interface HudPayload {
  species?: string;
  fishCount?: number;
  depth?: string;
  confidence?: number;
  suggestion?: string;
  archCount?: number;
  archShape?: string | null;
  sonarMode?: string | null;
  waterTemp?: string;
  bottomType?: string;
  lure?: string;
  crocAlert?: boolean;
  crocWarning?: string | null;
  birdAlert?: string | null;
  birdActivity?: string | null;
  barraPct?: number | null;
  baitSchool?: boolean | null;
  waterClarity?: string | null;
  region?: "wa" | "nt" | "nq" | null;
  source?: "live" | "boat" | "cam2";
}

function sanitiseAnalysis(a: Record<string, unknown>) {
  const allowed = ["species","fishCount","depth","confidence","behaviourNotes",
    "suggestion","crocAlert","archCount","archXFrac","archYFrac","waterTemp","bottomType"];
  return Object.fromEntries(
    Object.entries(a).filter(([k]) => allowed.includes(k))
  );
}

function sanitiseReport(body: CommunityReportPayload) {
  return {
    species:       typeof body.species === "string"  ? body.species.slice(0, 255) : null,
    fishCount:     typeof body.fishCount === "number" ? body.fishCount : null,
    depth:         typeof body.depth === "string"    ? body.depth.slice(0, 64)   : null,
    locationName:  typeof body.locationName === "string" ? body.locationName.slice(0, 255) : null,
    lureSuggestion: typeof body.lureSuggestion === "string" ? body.lureSuggestion.slice(0, 500) : null,
    rawAnalysis: body.rawAnalysis ? sanitiseAnalysis(body.rawAnalysis) : null,
    deviceId: null,
    lat: null,
    lng: null,
  };
}

async function storeBrainSonarEntry(body: BrainSonarPayload) {
  const title = body.title ?? "Sonar Scan";
  const species = body.species ?? "Unknown";
  const depth = body.depth ?? null;
  const aiSummary = body.aiSummary ?? "";
  const fishCount = body.fishCount ?? 0;
  const desc = [
    body.location ? `Location: ${body.location}` : null,
    fishCount ? `Fish: ${fishCount} detected` : null,
    aiSummary ? aiSummary.slice(0, 300) : null,
  ].filter(Boolean).join(" - ");

  await db.insert(brainVideos).values({
    title:           title.slice(0, 255),
    description:     desc || null,
    durationSecs:    null,
    frameCount:      1,
    videoUri:        body.imageUri ?? null,
    status:          "done",
    brainInsight:    aiSummary || null,
    detectedSpecies: species ? [species] : [],
    depthRanges:     depth ? [depth] : [],
    aiTips:          Array.isArray(body.tips) ? body.tips.slice(0, 5) : [],
    processedAt:     new Date(),
  });
}

router.post("/scan/complete", (req, res) => {
  const {
    brainSonar,
    sonarBrain,
    communityReport,
    hud,
  } = req.body as {
    brainSonar?: BrainSonarPayload;
    sonarBrain?: SonarBrainPayload;
    communityReport?: CommunityReportPayload;
    hud?: HudPayload;
  };

  res.json({ ok: true });

  void Promise.allSettled([
    brainSonar ? storeBrainSonarEntry(brainSonar) : Promise.resolve(),
    sonarBrain?.imageBase64 ? addCommunityBarraArch({
      imageBase64: sonarBrain.imageBase64,
      brand: sonarBrain.brand,
      depth: sonarBrain.depth,
      fishCount: sonarBrain.fishCount,
      description: sonarBrain.description,
    }) : Promise.resolve(),
    communityReport ? db.insert(communityReports).values(sanitiseReport(communityReport)) : Promise.resolve(),
    hud ? Promise.resolve(applyHudUpdate(hud)) : Promise.resolve(),
  ]).then((results) => {
    const rejected = results.filter((result) => result.status === "rejected");
    if (rejected.length > 0) {
      logger.warn({ failures: rejected.length }, "Scan completion batched with partial failures");
    }
  }).catch((err) => {
    logger.error({ err }, "Scan completion batch failed");
  });
});

export default router;
