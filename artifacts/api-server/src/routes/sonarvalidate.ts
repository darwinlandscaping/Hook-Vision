/**
 * /api/sonar-validate
 *
 * Ultra-fast gate (gpt-4.1-mini, ~400ms) that checks whether an image
 * is actually a fish finder / marine echosounder screen before we spend
 * a full GPT-4.1 analysis call on it.
 *
 * Returns { isSonar: true } or { isSonar: false, reason: "..." }
 */
import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const SYSTEM = `You are a sonar screen image classifier for a fishing app.

Your ONLY job: decide if the submitted image shows a FISH FINDER / MARINE ECHOSOUNDER / SONAR DISPLAY screen.

SONAR SCREENS include:
- Traditional 2D down-imaging (scrolling depth display, fish arches, bottom echo line, depth scale)
- Side-imaging sonar (Humminbird, Lowrance, Simrad — side channels visible)
- Live sonar / forward-facing (Garmin LiveScope, Humminbird MEGA Live, Lowrance ActiveTarget)
- Overhead / 360 sonar (Humminbird MEGA 360 circular display)
- Combination views with sonar panel visible
- Sonar screenshots from phones/tablets showing a fish finder app
- Magazine or printed sonar images held up to a camera

NOT SONAR (reject these):
- Fish photos (underwater, on deck, in hand, in landing net)
- Landscape / water surface photos
- People / faces / hands without a sonar display
- Maps, charts, tide tables (unless they are part of a sonar display with a sonar panel)
- Blank screens, coloured solid backgrounds, abstract images

Reply with ONLY this JSON, no markdown:
{"isSonar":true}
OR
{"isSonar":false,"reason":"<one short sentence explaining what the image actually shows>"}`;

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
      model:                 "gpt-4.1-mini",
      max_completion_tokens: 60,
      temperature:           0,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:${mime};base64,${imageBase64}`, detail: "low" },
            },
            { type: "text", text: "Is this a sonar / fish finder screen? JSON only." },
          ],
        },
      ],
    });

    const raw   = completion.choices[0]?.message?.content ?? "{}";
    const clean = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

    try {
      const parsed = JSON.parse(clean);
      res.json({ isSonar: !!parsed.isSonar, reason: parsed.reason ?? null });
    } catch {
      // Parse failure — fail open (allow the image through rather than blocking genuine scans)
      res.json({ isSonar: true, reason: null });
    }
  } catch (err) {
    // Network/OpenAI error — fail open
    res.json({ isSonar: true, reason: null });
  }
});

export default router;
