/**
 * POST /api/insta360/croc-vision
 * Pipeline 2 — Crocodile visual detection from Insta360 camera feed.
 * Detects snout, eyes, head, tail visible above/at waterline.
 * Designed to MERGE with existing sonar croc-brain data for combined alert.
 *
 * Injects up to 3 croc reference photos (from the Croc Reference Library) as
 * few-shot visual examples drawn from 1,000 iNaturalist research observations.
 * Also injects freshwater croc (Crocodylus johnstoni) awareness for WA/Kimberley rivers.
 */
import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getCrocFewShotRefs } from "../lib/crocLibrary.js";

const router = Router();

const SYSTEM = `You are a WA/Kimberley crocodile safety expert and wildlife ranger with field experience across Broome, Roebuck Bay, Cambridge Gulf, Ord River, Fitzroy River, Drysdale River, and King Sound. You analyse real-world camera footage (NOT sonar) for saltwater AND freshwater crocodile presence.

SPECIES TO IDENTIFY:
• Saltwater Crocodile (Crocodylus porosus) — "salty":
  - Can exceed 6m. Dark olive/grey, heavily armoured back
  - Found in all WA Kimberley coastal waters, estuaries, rivers, and up to 100km inland
  - Often completely submerged — only eyes + nostrils visible (like 2 small bumps at waterline)
  - Eyes: amber/yellow, highly reflective at waterline, paired tiny glints
  - Snout: narrow, elongated jaw tip — pointed
  - Tail: heavy, tapered, creates a V-wake when moving
  - Skin pattern: irregular raised scutes on dorsal surface
  - Danger: EXTREME

• Freshwater Crocodile (Crocodylus johnstoni) — "freshie":
  - Smaller (max ~3m). Slender build, lighter brown/olive colouration
  - Long narrow snout (longer than salty)
  - Found in WA/Kimberley rivers, billabongs, freshwater creeks
  - Less dangerous but still capable of biting
  - Danger: MODERATE

IMPORTANT WA/KIMBERLEY ENVIRONMENTAL CONTEXT:
• WET SEASON (Nov–Apr): Water is brown/murky with tannins and runoff sediment — crocs almost invisible
• DRY SEASON (May–Oct): Water clearer but crocs more concentrated as water levels drop
• Saltwater crocs are abundant in Roebuck Bay, Cambridge Gulf, Ord River, Fitzroy River, Drysdale River, King Sound
• They can appear completely as logs — motionless for hours, incredibly well camouflaged
• Watch for: V-wakes with no boat/fish cause, subtle movement in still water, paired eye-glints
• Do NOT confuse: floating logs (no paired eyes, irregular cross-section), submerged rocks, debris

WHAT TO LOOK FOR:
• SNOUT — narrow elongated tip of the jaw breaking the waterline, often all that's visible
• EYES — small raised bumps / orbs at the waterline, often with a faint ridge behind (back of skull); amber/reflective
• HEAD — broader flat skull section visible above water
• TAIL — thick tapered tail section; creates V-wake when moving
• BODY — partial body outline, dark grey/olive/brown, patterned skin; crocs float very low

ZONE RULES — divide the frame into three equal vertical thirds:
• LEFT THIRD: left side of image
• CENTRE THIRD: middle of image
• RIGHT THIRD: right side of image

Respond with ONLY valid JSON in this exact structure:
{
  "detected": true|false,
  "zones": { "left": true|false, "centre": true|false, "right": true|false },
  "parts": ["snout"|"eyes"|"head"|"tail"|"body"],
  "species": "salty"|"freshie"|"unknown"|"none",
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
    // ── Build few-shot croc reference content ──────────────────────────────
    const crocRefs = getCrocFewShotRefs(3);
    const fewShotContent: Array<{ type: string; text?: string; image_url?: { url: string; detail: string } }> = [];

    if (crocRefs.length > 0) {
      fewShotContent.push({
        type: "text",
        text: `REFERENCE — confirmed Crocodylus porosus / johnstoni photos from 1,000+ iNaturalist research records to help your identification (${crocRefs.length} examples):`,
      });
      for (const ref of crocRefs) {
        if (ref.thumbBase64) {
          const angleLabel = ref.viewingAngle ? ` — ${ref.viewingAngle} view` : "";
          fewShotContent.push({ type: "text", text: `↳ Saltwater crocodile${angleLabel}, ${ref.location}` });
          fewShotContent.push({
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${ref.thumbBase64}`, detail: "low" },
          });
        }
      }
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      max_tokens: 400,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            ...fewShotContent,
            {
              type: "text",
              text: [
                crocRefs.length > 0
                  ? "Now analyse THIS Insta360 camera frame (below) for saltwater or freshwater crocodile presence. Use the reference photos above for visual comparison."
                  : "Analyse this Insta360 camera frame for crocodile presence at or near the waterline.",
                sonarCrocAlert
                  ? `⚠️ SONAR ALERT: The boat's sonar has ALREADY detected a possible crocodile signature underwater near this location (${sonarCrocWarning ?? "croc-shaped sonar return"}). Treat any suspicious shapes with ELEVATED suspicion.`
                  : "No sonar croc alert active — apply standard WA/Kimberley croc safety caution.",
                "Identify which zones (left/centre/right) show any croc body parts. Include species estimate (salty vs freshie). Respond with JSON only.",
              ].join("\n"),
            },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "high" },
            },
          ] as Parameters<typeof openai.chat.completions.create>[0]["messages"][0]["content"],
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch {
      parsed = {
        detected: false, alertLevel: "none", confidence: 0,
        description: "Parse error",
        zones: { left: false, centre: false, right: false },
        parts: [], species: "none", safetyNote: "",
      };
    }

    // ── Merge sonar + vision alert levels ─────────────────────────────────────
    // If sonar flagged AND vision sees something → escalate
    const visionLevel = parsed.alertLevel ?? "none";
    let mergedLevel   = visionLevel;
    if (sonarCrocAlert && visionLevel === "possible") mergedLevel = "confirmed";
    if (sonarCrocAlert && visionLevel === "none")     mergedLevel = "possible";

    res.json({
      detected:         !!parsed.detected || (sonarCrocAlert && visionLevel !== "none"),
      zones:            parsed.zones ?? { left: false, centre: false, right: false },
      parts:            Array.isArray(parsed.parts) ? parsed.parts : [],
      species:          parsed.species ?? "none",
      alertLevel:       mergedLevel,
      visionOnly:       visionLevel,
      confidence:       typeof parsed.confidence === "number" ? parsed.confidence : 0,
      description:      parsed.description ?? "",
      safetyNote:       parsed.safetyNote ?? "",
      sonarContributed: !!sonarCrocAlert,
      crocRefCount:     crocRefs.length,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
