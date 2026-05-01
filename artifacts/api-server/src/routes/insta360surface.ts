/**
 * POST /api/insta360/surface-detect
 * Pipeline 1 — Bait birds + water bust-up detection from Insta360 real-world camera feed.
 * Divides the frame into left / centre / right thirds and reports activity in each zone.
 *
 * Injects up to 3 bird reference photos (from the Bird Reference Library) as
 * few-shot visual examples so the model can confidently identify WA/Kimberley water birds.
 */
import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getBirdFewShotRefs } from "../lib/birdLibrary.js";
import { getModel } from "../lib/models.js";

const router = Router();

const SYSTEM = `You are an expert WA/Kimberley fishing guide with 30+ years on Roebuck Bay, Cambridge Gulf, Ningaloo Reef, and the Kimberley coast. You analyse real-world camera footage (NOT sonar) for surface feeding activity.

You look for:
• BAIT BIRDS — species commonly seen over WA/Kimberley water bait schools include:
    - Frigatebirds (Lesser/Great Frigatebird): large, angular scissor-tails, steep plunging dives
    - Crested Terns / Little Terns: fast, compact, repeated plunge dives
    - Brown Booby / Masked Booby: brown/white, large, classic gannet-style plunge
    - Australian Pelican: huge, white with black wingtips, pushes bait balls
    - Osprey: brown raptor, hovers then foot-first plunge
    - Brahminy Kite: rusty-red and white, low soaring scavenger over surface
    - Little Black Cormorant: small black, pack-hunting pursuit dive
  Any of these species diving steeply or wheeling tightly indicates bait fish pushed to surface.
• WATER BUST-UPS — explosive surface eruptions where predators (barra, trevally, queenfish, Spanish mackerel) are smashing bait at the surface. Looks like splashing, white water, or spray.
• BAIT BALLS — visible schools of small fish at or near the surface, often visible as dark nervous patches.
• SURFACE SWIRLS — circular wakes or boils from fish turning hard near the surface.

Your job is to analyse the image and identify activity in each horizontal zone.

ZONE RULES:
• Divide the frame into three equal vertical thirds:
  - LEFT THIRD: left portion of the image
  - CENTRE THIRD: middle portion of the image
  - RIGHT THIRD: right portion of the image

You MUST respond with ONLY valid JSON in this exact structure:
{
  "activity": true|false,
  "zones": { "left": true|false, "centre": true|false, "right": true|false },
  "types": ["birds"|"bust-up"|"bait-ball"|"surface-swirl"],
  "birdSpecies": ["Crested Tern"|"Frigatebird"|"Brown Booby"|"Osprey"|"Pelican"|"Brahminy Kite"|"Cormorant"|"Unknown bird"],
  "urgency": "none"|"low"|"high",
  "confidence": 0-100,
  "description": "1-2 sentence plain-English description of what you see and where"
}

urgency guide:
• "none" — nothing happening
• "low" — birds circling lazily, minor surface activity, uncertain
• "high" — birds diving hard OR active bust-up OR large bait ball OR multiple indicators

If the image is night-time, dark, or shows no relevant scene, return activity:false, urgency:"none".
Be conservative — only report high urgency when you are genuinely confident.`;

router.post("/insta360/surface-detect", async (req, res) => {
  const { imageBase64 } = req.body as { imageBase64?: string };
  if (!imageBase64) { res.status(400).json({ error: "imageBase64 required" }); return; }

  try {
    // ── Build few-shot bird reference content ──────────────────────────────
    const birdRefs = getBirdFewShotRefs(3);
    const fewShotContent: Array<{ type: string; text?: string; image_url?: { url: string; detail: string } }> = [];

    if (birdRefs.length > 0) {
      fewShotContent.push({
        type: "text",
        text: `REFERENCE — these are confirmed WA/Kimberley water bird photos to help your identification (${birdRefs.length} examples):`,
      });
      for (const ref of birdRefs) {
        if (ref.thumbBase64) {
          fewShotContent.push({ type: "text", text: `↳ ${ref.species}${ref.poseType ? ` (${ref.poseType})` : ""} — ${ref.location}` });
          fewShotContent.push({
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${ref.thumbBase64}`, detail: "low" },
          });
        }
      }
    }

    const completion = await openai.chat.completions.create({
      model: getModel("mid"),
      max_completion_tokens: 350,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            ...fewShotContent,
            {
              type: "text",
              text: birdRefs.length > 0
                ? "Now analyse THIS Insta360 camera frame (below) for bait birds and surface bust-up activity. Use the reference photos above to identify any bird species. Identify zones (left/centre/right). Respond with JSON only."
                : "Analyse this Insta360 camera frame for bait birds and surface bust-up activity. Identify zones (left/centre/right). Respond with JSON only.",
            },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "low" },
            },
          ] as Parameters<typeof openai.chat.completions.create>[0]["messages"][0]["content"],
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch {
      parsed = {
        activity: false, urgency: "none", confidence: 0, description: "Parse error",
        zones: { left: false, centre: false, right: false }, types: [], birdSpecies: [],
      };
    }

    res.json({
      activity:     !!parsed.activity,
      zones:        parsed.zones ?? { left: false, centre: false, right: false },
      types:        Array.isArray(parsed.types) ? parsed.types : [],
      birdSpecies:  Array.isArray(parsed.birdSpecies) ? parsed.birdSpecies : [],
      urgency:      parsed.urgency ?? "none",
      confidence:   typeof parsed.confidence === "number" ? parsed.confidence : 0,
      description:  parsed.description ?? "",
      birdRefCount: birdRefs.length,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
