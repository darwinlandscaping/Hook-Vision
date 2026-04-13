/**
 * Brain Video Library routes
 *
 * POST /api/brain/video        — Submit video frames for CV analysis
 * GET  /api/brain/videos       — List the video library with status + results
 * POST /api/brain/video/:id/reanalyze — Retrigger analysis on an existing entry
 *
 * Flow:
 *  1. Mobile extracts N frames from a video using expo-video-thumbnails
 *  2. POSTs frame array (base64 JPEG) + title + duration to this endpoint
 *  3. Server runs analyzeSonarImage() from the vision lib on every frame
 *  4. Aggregates CV results: species distribution, depth ranges, echo profile
 *  5. GPT-4.1 synthesises findings into plain-English brain intelligence
 *  6. Stores in brain_videos + back-fills community_reports for hotspot tracking
 */

import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { db, brainVideos, communityReports } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { analyzeSonarImage, type SonarScan } from "../lib/vision.js";
import { logger } from "../lib/logger.js";

const router = Router();

// ─── POST /api/brain/video ─────────────────────────────────────────────────

router.post("/brain/video", async (req, res) => {
  const {
    title        = "Untitled Video",
    description  = "",
    durationSecs = null,
    videoUri     = null,
    frames       = [],            // base64 JPEG strings, up to 30
  } = req.body as {
    title?: string;
    description?: string;
    durationSecs?: number | null;
    videoUri?: string | null;
    frames?: string[];
  };

  if (!Array.isArray(frames) || frames.length === 0) {
    res.status(400).json({ error: "At least one frame is required" });
    return;
  }

  // Cap to 30 frames to keep processing time under ~3 seconds
  const cappedFrames = frames.slice(0, 30);

  try {
    // ── 1. Create queued entry ────────────────────────────────────────────
    const [entry] = await db.insert(brainVideos).values({
      title:        title.slice(0, 255),
      description:  description.slice(0, 1000),
      durationSecs: durationSecs ?? null,
      frameCount:   cappedFrames.length,
      videoUri:     videoUri ?? null,
      status:       "processing",
    }).returning();

    res.json({ id: entry.id, status: "processing" });

    // ── 2. Run CV pipeline on each frame (background) ─────────────────────
    processVideoAsync(entry.id, cappedFrames).catch((err) => {
      logger.error({ err, videoId: entry.id }, "Brain video processing failed");
    });

  } catch (err) {
    logger.error({ err }, "Failed to create brain video entry");
    res.status(500).json({ error: "Failed to submit video" });
  }
});

// ─── GET /api/brain/videos ─────────────────────────────────────────────────

router.get("/brain/videos", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(brainVideos)
      .orderBy(desc(brainVideos.submittedAt))
      .limit(500);
    res.json({ videos: rows });
  } catch (err) {
    logger.error({ err }, "Failed to list brain videos");
    res.status(500).json({ error: "Failed to list videos" });
  }
});

// ─── POST /api/brain/sonar ─────────────────────────────────────────────────
// Auto-save a single analysed sonar image from the Analyze tab

router.post("/brain/sonar", async (req, res) => {
  const {
    title       = "Sonar Scan",
    imageUri    = null,
    species     = "Unknown",
    depth       = null,
    aiSummary   = "",
    tips        = [],
    location    = null,
    fishCount   = 0,
  } = req.body as {
    title?: string; imageUri?: string | null; species?: string;
    depth?: string | null; aiSummary?: string; tips?: string[];
    location?: string | null; fishCount?: number;
  };

  try {
    const desc = [
      location ? `📍 ${location}` : null,
      fishCount ? `🐟 ${fishCount} fish detected` : null,
      aiSummary ? aiSummary.slice(0, 300) : null,
    ].filter(Boolean).join("  •  ");

    const [entry] = await db.insert(brainVideos).values({
      title:           title.slice(0, 255),
      description:     desc || null,
      durationSecs:    null,
      frameCount:      1,
      videoUri:        imageUri ?? null,
      status:          "done",
      brainInsight:    aiSummary || null,
      detectedSpecies: species ? [species] : [],
      depthRanges:     depth ? [depth] : [],
      aiTips:          Array.isArray(tips) ? tips.slice(0, 5) : [],
      processedAt:     new Date(),
    }).returning();

    logger.info({ id: entry.id, species, depth }, "Sonar scan saved to library");
    res.json({ id: entry.id, ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to save sonar scan");
    res.status(500).json({ error: "Failed to save sonar scan" });
  }
});

// ─── DELETE /api/brain/video/:id ───────────────────────────────────────────
// Permanently remove a brain video entry from the library

router.delete("/brain/video/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const deleted = await db.delete(brainVideos).where(eq(brainVideos.id, id)).returning();
    if (deleted.length === 0) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ok: true, id });
  } catch (err) {
    logger.error({ err }, "Failed to delete brain video");
    res.status(500).json({ error: "Delete failed" });
  }
});

// ─── PATCH /api/brain/video/:id ────────────────────────────────────────────
// Save (or update) the local device videoUri for an existing entry

router.patch("/brain/video/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { videoUri } = req.body as { videoUri?: string };
  if (!videoUri) { res.status(400).json({ error: "videoUri required" }); return; }
  try {
    await db.update(brainVideos).set({ videoUri }).where(eq(brainVideos.id, id));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to update videoUri");
    res.status(500).json({ error: "Update failed" });
  }
});

// ─── POST /api/brain/video/:id/reanalyze ───────────────────────────────────
// (requires frames to be re-sent — just resets status for now)
router.post("/brain/video/:id/reanalyze", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { frames = [] } = req.body as { frames?: string[] };
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  try {
    await db.update(brainVideos)
      .set({ status: "processing", brainInsight: null, cvSummary: null })
      .where(eq(brainVideos.id, id));

    if (Array.isArray(frames) && frames.length > 0) {
      processVideoAsync(id, frames.slice(0, 30)).catch(() => {});
    }

    res.json({ ok: true, id });
  } catch (err) {
    logger.error({ err }, "Failed to reanalyze brain video");
    res.status(500).json({ error: "Failed to reanalyze" });
  }
});

// ─── Async processing pipeline ─────────────────────────────────────────────

async function processVideoAsync(videoId: number, frames: string[]) {
  try {
    // ── Step A: Run CV on every frame ─────────────────────────────────────
    const scanResults: Array<SonarScan & { frameIdx: number }> = [];

    for (let i = 0; i < frames.length; i++) {
      const scan = await analyzeSonarImage(frames[i]);
      if (scan) {
        scanResults.push({ ...scan, frameIdx: i });
      }
    }

    if (scanResults.length === 0) {
      await db.update(brainVideos)
        .set({ status: "failed", processedAt: new Date() })
        .where(eq(brainVideos.id, videoId));
      return;
    }

    // ── Step B: Aggregate CV results ──────────────────────────────────────
    const avgBrightness  = avg(scanResults.map((s) => s.meanBrightness));
    const avgBrightPct   = avg(scanResults.map((s) => s.brightPixelPct));
    const paletteCounts  = countValues(scanResults.map((s) => s.sonarPaletteCue));
    const echoCounts     = countValues(scanResults.map((s) => s.echoStrength));
    const totalBlobs     = scanResults.reduce((acc, s) => acc + s.candidateArchCount, 0);

    const cvSummary = {
      framesAnalysed: scanResults.length,
      avgBrightness:  +avgBrightness.toFixed(1),
      avgBrightPct:   +avgBrightPct.toFixed(2),
      dominantPalette: topKey(paletteCounts),
      echoProfile:     echoCounts,
      totalBlobsDetected: totalBlobs,
      avgBlobsPerFrame: +(totalBlobs / scanResults.length).toFixed(1),
    };

    // ── Step C: GPT-4.1 brain synthesis ───────────────────────────────────
    const cvContext = `
CV Pipeline Results (TF.js + OpenCV, ${scanResults.length} frames):
• Average image brightness: ${cvSummary.avgBrightness}/255
• Strong-echo pixel coverage: ${cvSummary.avgBrightPct}% per frame
• Dominant sonar palette: ${cvSummary.dominantPalette}
• Echo strength profile: ${JSON.stringify(echoCounts)}
• Total bright arch blobs detected across all frames: ${totalBlobs}
• Average arch blobs per frame: ${cvSummary.avgBlobsPerFrame}
    `.trim();

    const prompt = `You are the HookVision Community Brain — an AI that learns from fishing video content to help NT Australia anglers find fish.

${cvContext}

Based on these computer vision measurements of the fishing video frames, synthesise brain intelligence in JSON:
{
  "brainInsight": "2-3 plain English sentences summarising what this video teaches the brain about fishing conditions, species patterns or sonar signatures",
  "detectedSpecies": ["species likely visible based on echo signatures"],
  "depthRanges": ["estimated depth ranges based on arch positions and brightness"],
  "aiTips": ["3-4 actionable fishing tips derived from the CV data for NT anglers"]
}

Rules:
- Base everything on the CV measurements above
- warm-red palette = Lowrance sonar; cool-blue = Garmin/Deeper; teal-green = Humminbird
- Strong echo (>140 brightness) + large blobs = active fish, likely Tier 1 (barra/fingermark)
- Low echo coverage with few blobs = sparse or deep targets
- Respond ONLY with valid JSON, no markdown`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      max_completion_tokens: 500,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });

    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}"); } catch {}

    const detectedSpecies: string[] = Array.isArray(parsed.detectedSpecies)
      ? (parsed.detectedSpecies as string[]).slice(0, 5)
      : [];
    const depthRanges: string[] = Array.isArray(parsed.depthRanges)
      ? (parsed.depthRanges as string[]).slice(0, 4)
      : [];
    const aiTips: string[] = Array.isArray(parsed.aiTips)
      ? (parsed.aiTips as string[]).slice(0, 6)
      : [];
    const brainInsight = typeof parsed.brainInsight === "string"
      ? parsed.brainInsight
      : "";

    // ── Step D: Store results ─────────────────────────────────────────────
    await db.update(brainVideos)
      .set({
        status:          "done",
        cvSummary,
        brainInsight,
        detectedSpecies,
        depthRanges,
        aiTips,
        processedAt:     new Date(),
      })
      .where(eq(brainVideos.id, videoId));

    // ── Step E: Back-fill community reports for each detected species ──────
    // This makes video intelligence visible in hotspot tracking + live feed
    for (const species of detectedSpecies.slice(0, 3)) {
      await db.insert(communityReports).values({
        species,
        fishCount:      Math.round(cvSummary.avgBlobsPerFrame),
        depth:          depthRanges[0] ?? null,
        lureSuggestion: aiTips[0] ?? null,
        locationName:   null,
        rawAnalysis:    {
          sourceType:     "video_brain",
          videoId,
          cvSummary,
          brainInsight,
        } as any,
      });
    }

    logger.info({ videoId, frames: scanResults.length, species: detectedSpecies },
      "Brain video analysis complete");

  } catch (err) {
    logger.error({ err, videoId }, "processVideoAsync failed");
    await db.update(brainVideos)
      .set({ status: "failed", processedAt: new Date() })
      .where(eq(brainVideos.id, videoId))
      .catch(() => {});
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function avg(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / (nums.length || 1);
}

function countValues(arr: string[]): Record<string, number> {
  return arr.reduce<Record<string, number>>((acc, v) => {
    acc[v] = (acc[v] ?? 0) + 1;
    return acc;
  }, {});
}

function topKey(obj: Record<string, number>): string {
  return Object.entries(obj).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";
}

export default router;
