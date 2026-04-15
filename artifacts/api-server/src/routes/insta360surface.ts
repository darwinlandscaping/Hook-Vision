/**
 * POST /api/insta360/surface-detect
 * Pipeline 1 — Bait birds + water bust-up detection from Insta360 real-world camera feed.
 * Divides the frame into left / centre / right thirds and reports activity in each zone.
 */
import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const SYSTEM = `You are an expert NT Australia fishing guide with 30+ years on Darwin Harbour, Arafura Sea, and Tiwi Islands. You analyse real-world camera footage (NOT sonar) for surface feeding activity.

You look for:
• BAIT BIRDS — frigate birds, terns, boobies, or pelicans diving steeply or wheeling tightly over a spot. Indicates bait fish pushed to surface.
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
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      max_tokens: 300,
      temperature: 0.15,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "low" },
            },
            {
              type: "text",
              text: "Analyse this Insta360 camera frame for bait birds and surface bust-up activity. Identify zones (left/centre/right). Respond with JSON only.",
            },
          ],
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { parsed = { activity: false, urgency: "none", confidence: 0, description: "Parse error", zones: { left: false, centre: false, right: false }, types: [] }; }

    res.json({
      activity:    !!parsed.activity,
      zones:       parsed.zones ?? { left: false, centre: false, right: false },
      types:       Array.isArray(parsed.types) ? parsed.types : [],
      urgency:     parsed.urgency ?? "none",
      confidence:  typeof parsed.confidence === "number" ? parsed.confidence : 0,
      description: parsed.description ?? "",
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
