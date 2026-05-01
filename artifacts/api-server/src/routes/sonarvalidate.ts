/**
 * /api/sonar-validate
 *
 * Ultra-fast gate (gpt-4.1-mini, ~400ms) that:
 *   1. Confirms the image is a fish finder / marine echosounder screen.
 *   2. Classifies the sonar type so the app can route to the correct specialist.
 *
 * Returns:
 *   { isSonar: true,  sonarType: "arch-2d" | "live-sonar" | "side-imaging" | "overhead" }
 *   { isSonar: false, reason: "..." }
 */
import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getModel } from "../lib/models.js";

const router = Router();

const SYSTEM = `You are a sonar screen image classifier for a fishing app.

Your job: confirm the image is a fish finder / echosounder screen AND classify its type.

SONAR TYPES — pick the best match:

"arch-2d"
  Traditional 2D down-imaging sonar. Fish appear as U-shaped ARCHES on a scrolling
  time-axis display. Clear bottom echo line. Depth scale on left or right edge.
  Examples: Lowrance HDS, Garmin ECHOMAP, Humminbird Helix in standard 2D or DI mode.
  Also use for split-screen views where the primary panel is traditional 2D/DI.

"live-sonar"
  Forward-facing or live spatial sonar. Fish appear as SOLID BODY SHAPES / SILHOUETTES
  with ACOUSTIC SHADOWS below them — NOT arches. Display is a real-time spatial map,
  NOT a scrolling time display. Boat icon often shown at top.
  Key brand tells:
    • Garmin LiveScope / LiveScope Plus — dark GREEN background tint
    • Humminbird MEGA Live / MEGA Live 2 — ORANGE/AMBER UI chrome and icons
    • Lowrance ActiveTarget / ActiveTarget 2 — dark NAVY/grey background
    • Simrad (Navico platform, looks like Lowrance)

"side-imaging"
  Side-scanning sonar. Shows a mirrored pair of channels (port and starboard) fanning
  out from the boat's track line down the centre. Structure echoes look like shadows
  across a flat plain. Examples: Humminbird Side Imaging, Lowrance StructureScan.

"overhead"
  Top-down / 360 circular display. Humminbird MEGA 360, Panoptix PS360 or similar.
  Circular sweep pattern, boat at centre.

NOT SONAR — reject these:
  Fish photos (underwater, on deck, in hand, in landing net), landscape / water surface
  photos, maps, charts, tide tables (unless part of an active sonar panel),
  blank screens, coloured solid backgrounds, abstract images.

Reply with ONLY valid JSON — no markdown, no explanation:
{"isSonar":true,"sonarType":"arch-2d"}
{"isSonar":true,"sonarType":"live-sonar"}
{"isSonar":true,"sonarType":"side-imaging"}
{"isSonar":true,"sonarType":"overhead"}
{"isSonar":false,"reason":"<one short sentence>"}`;

function detectMime(b64: string): string {
  const p = b64.slice(0, 12);
  if (p.startsWith("iVBORw0")) return "image/png";
  if (p.startsWith("UklGR"))   return "image/webp";
  return "image/jpeg";
}

router.post("/sonar-validate", async (req, res) => {
  const { imageBase64 } = req.body as { imageBase64?: string };
  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 required" });
    return;
  }

  try {
    const mime = detectMime(imageBase64);
    const completion = await openai.chat.completions.create({
      model:                 getModel("mid"),
      max_completion_tokens: 80,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:${mime};base64,${imageBase64}`, detail: "low" },
            },
            { type: "text", text: "Classify this sonar screen. JSON only." },
          ],
        },
      ],
    });

    const raw   = completion.choices[0]?.message?.content ?? "{}";
    const clean = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

    try {
      const parsed = JSON.parse(clean);
      if (!parsed.isSonar) {
        res.json({ isSonar: false, reason: parsed.reason ?? null });
      } else {
        res.json({
          isSonar:   true,
          sonarType: parsed.sonarType ?? "arch-2d",
          reason:    null,
        });
      }
    } catch {
      // Parse failure — fail open (let the image through as arch-2d)
      res.json({ isSonar: true, sonarType: "arch-2d", reason: null });
    }
  } catch (err) {
    // Network/OpenAI error — fail open
    res.json({ isSonar: true, sonarType: "arch-2d", reason: null });
  }
});

export default router;
