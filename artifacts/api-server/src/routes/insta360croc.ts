/**
 * POST /api/insta360/croc-vision
 * Pipeline 2 — Crocodile visual detection from Insta360 camera feed.
 * Detects snout, eyes, head, tail visible above/at waterline.
 * Designed to MERGE with existing sonar croc-brain data for combined alert.
 */
import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const SYSTEM = `You are an NT Australia crocodile safety expert and wildlife ranger. You analyse real-world camera footage (NOT sonar) for saltwater crocodile (Crocodylus porosus) presence at or near the water surface.

WHAT TO LOOK FOR:
• SNOUT — narrow elongated tip of the jaw breaking the waterline, often all that's visible
• EYES — small raised bumps / orbs at the waterline, often with a faint ridge behind them (the back of the skull)
• HEAD — broader flat skull section visible above water
• TAIL — thick tapered tail section moving at or below surface, often creates a V-wake
• BODY — partial body outline, typically dark grey/olive/brown, patterned skin

IMPORTANT CONTEXT — NT environment:
• Water is murky in wet season, clearer in dry
• Crocs can be almost completely submerged with only eyes/nostrils showing
• Eyes reflect light — watch for paired glints at waterline
• They can remain motionless for very long periods
• Do NOT confuse logs/debris, rocks, or stick-up roots for crocs — be conservative

ZONE RULES — divide the frame into three equal vertical thirds:
• LEFT THIRD: left side of image
• CENTRE THIRD: middle of image
• RIGHT THIRD: right side of image

Respond with ONLY valid JSON in this exact structure:
{
  "detected": true|false,
  "zones": { "left": true|false, "centre": true|false, "right": true|false },
  "parts": ["snout"|"eyes"|"head"|"tail"|"body"],
  "alertLevel": "none"|"possible"|"confirmed",
  "confidence": 0-100,
  "description": "1-2 sentence plain-English description of what you see and exactly where",
  "safetyNote": "brief safety action if detected, empty string if none"
}

alertLevel guide:
• "none" — nothing croc-like detected
• "possible" — something could be a croc but uncertain (log-shaped object, possible snout, ambiguous)
• "confirmed" — you are confident a croc or croc body part is visible

Err strongly on the side of caution — if there is any realistic possibility of a croc, report "possible".
If the image is too dark, blurry, or doesn't show water, return detected:false, alertLevel:"none".`;

router.post("/insta360/croc-vision", async (req, res) => {
  const {
    imageBase64,
    sonarCrocAlert,    // boolean — was sonar croc brain triggered?
    sonarCrocWarning,  // string — sonar croc warning text if any
  } = req.body as {
    imageBase64?: string;
    sonarCrocAlert?: boolean;
    sonarCrocWarning?: string;
  };

  if (!imageBase64) { res.status(400).json({ error: "imageBase64 required" }); return; }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      max_tokens: 350,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "high" },
            },
            {
              type: "text",
              text: [
                "Analyse this Insta360 camera frame for saltwater crocodile presence at or near the waterline.",
                sonarCrocAlert
                  ? `⚠️ CONTEXT: The boat's sonar has ALREADY detected a possible crocodile signature underwater near this location (${sonarCrocWarning ?? "croc-shaped sonar return"}). Treat any suspicious shapes with ELEVATED suspicion.`
                  : "No sonar croc alert active — apply standard caution.",
                "Identify which zones (left/centre/right) show any croc body parts. Respond with JSON only.",
              ].join("\n"),
            },
          ],
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch {
      parsed = { detected: false, alertLevel: "none", confidence: 0, description: "Parse error", zones: { left: false, centre: false, right: false }, parts: [], safetyNote: "" };
    }

    // ── Merge sonar + vision alert levels ─────────────────────────────────────
    // If sonar flagged AND vision sees something → escalate
    const visionLevel  = parsed.alertLevel ?? "none";
    let mergedLevel    = visionLevel;
    if (sonarCrocAlert && visionLevel === "possible") mergedLevel = "confirmed";
    if (sonarCrocAlert && visionLevel === "none")     mergedLevel = "possible";

    res.json({
      detected:        !!parsed.detected || (sonarCrocAlert && visionLevel !== "none"),
      zones:           parsed.zones ?? { left: false, centre: false, right: false },
      parts:           Array.isArray(parsed.parts) ? parsed.parts : [],
      alertLevel:      mergedLevel,
      visionOnly:      visionLevel,
      confidence:      typeof parsed.confidence === "number" ? parsed.confidence : 0,
      description:     parsed.description ?? "",
      safetyNote:      parsed.safetyNote ?? "",
      sonarContributed: !!sonarCrocAlert,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
