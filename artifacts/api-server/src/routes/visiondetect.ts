/**
 * Vision Detect — Real-Time Live Camera AI Detector
 * ────────────────────────────────────────────────────────────────────────────
 * POST /api/vision-detect
 *
 * Accepts a base64 live camera frame and returns bounding-box targets detected
 * in that frame. Three modes:
 *   face   — face & human detection (foundation/calibration mode)
 *   object — general object detection with regional wildlife context
 *   barra  — full Barramundi specialist mode: barraLibrary few-shot refs +
 *            WA/NQ/NT regional brain knowledge injected into every call
 *
 * All brain knowledge (brainSeed regional intel, barraLibrary few-shot refs,
 * species profiles, croc alerts) is used in every barra-mode frame analysis.
 */

import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getModel } from "../lib/models.js";
import { getFewShotRefs } from "../lib/barraLibrary.js";

const router = Router();

type ContentPart =
  | { type: "image_url"; image_url: { url: string; detail: "high" | "low" } }
  | { type: "text"; text: string };

function detectMime(b64: string): string {
  if (b64.startsWith("/9j/")) return "image/jpeg";
  if (b64.startsWith("iVBORw")) return "image/png";
  if (b64.startsWith("UklGR")) return "image/webp";
  return "image/jpeg";
}

// ─── Regional brain knowledge (from brainSeed intelligence) ──────────────────

const REGIONAL_BRAIN: Record<string, string> = {
  wa: `REGION: Western Australia — Kimberley, Pilbara, Broome, Ord River, Cambridge Gulf, Fitzroy River, Dampier

KEY SPECIES TO DETECT:
• Barramundi (Lates calcarifer) — PRIMARY TARGET. Large silver/bronze torpedo-shaped fish 50–120 cm, strong lateral line, concave forehead, rounded powerful tail. Often seen rolling, leaping, breaking surface near rock bars or fallen timber.
• Saltwater Crocodile — IMMEDIATE ALERT. Any reptile silhouette, eye-shine, snout above water, or wake pattern. CRITICAL safety alert required.
• Giant Trevally — Large silver fish, blunt forehead, forked tail
• Queenfish — Slender silver, surface schooling behaviour
• Spanish Mackerel — Streamlined, spotted silver, torpedo body
• Threadfin Salmon — Large pectoral filaments, bronze tint
• Mangrove Jack — Reddish, stocky body, reef structure

VISUAL RECOGNITION — BARRAMUNDI:
- Torpedo-shaped, streamlined body (not round, not flat)
- Strong visible lateral line (dark stripe along flank)
- Silver/bronze metallic sheen, very reflective in sun
- Concave forehead with slightly uptilted snout
- Large mouth, protruding lower jaw
- Tail: rounded/fan-shaped (not forked)
- Behaviour: roll on surface, leap, tail-slap, bow wave near structure
- Context: rock bars, fallen timber, mangrove edges, tidal narrows

HABITAT CUES IN THIS REGION:
- Ord River / Lake Kununurra: rock bars, submerged timber, lily pads
- Fitzroy River / Derby: extreme tidal influence, mangrove points
- Broome / Dampier Creek: tidal creek banks, snag-lined channels
- Kimberley coast: fast tidal rips, reef edges
- King Sound tides up to 12m — fish most active last 2 hrs run-out

CROC HOTSPOTS: ALL tidal rivers in the Kimberley. Never underestimate croc risk.

WHAT TO IGNORE: Logs, sticks, floating debris, wind ripples, foam, leaf litter.
WHAT TO FLAG: Silver flash, dorsal fin cut, bow wave, swirl pattern indicating large animal beneath surface.`,

  nq: `REGION: Far North Queensland — Gulf of Carpentaria, Karumba, Cape York, Cairns, Townsville, Norman River, Archer River, Mitchell River

KEY SPECIES TO DETECT:
• Barramundi (Lates calcarifer) — PRIMARY TARGET. Large silver/bronze torpedo-shaped fish 50–120 cm, strong lateral line, concave forehead, rounded powerful tail. Often surface-busts at dawn in gulf rivers.
• Saltwater Crocodile — IMMEDIATE ALERT. Especially in Gulf rivers (Norman, Archer, Mitchell, Wenlock, Holroyd). Critical safety warning.
• Saratoga — Elongated, spotted scales, surface glider
• Mangrove Jack — Reddish-orange, stocky, structure-hugging
• Jungle Perch — Small, bright, fast-water fish
• Queenfish — Slender silver, surface schooling
• Giant Trevally — Large silver, blunt head, forked tail
• Threadfin Salmon — Large pectoral filaments, bronze tint

VISUAL RECOGNITION — BARRAMUNDI:
- Torpedo-shaped, streamlined body
- Strong lateral line visible as dark stripe
- Silver/bronze metallic sheen, highly reflective
- Concave forehead, uptilted snout, large mouth
- Rounded/fan-shaped tail (not forked)
- Behaviour: surface bust, leap, roll, swirl, tail-slap at structure
- Surface disturbance: scatter of baitfish, birds diving, circular swirls

HABITAT CUES IN THIS REGION:
- Gulf Rivers (Norman, Archer, Wenlock): rock bars, estuary constrictions, fresh/salt interface
- Karumba: creek mouths, tidal channels — barra capital of QLD
- Cairns (Trinity Inlet, Barron River, Mulgrave River): tidal creeks, dam tailwaters
- Townsville (Ross River, Bohle River): impoundments, snag banks
- Tully / Daintree: rainforest streams, jungle perch + saratoga country

SEASONAL INTELLIGENCE:
- Wet season Nov–Apr: barra push into freshwater upper reaches
- Post-flood Mar–Apr: prime time — fish stack at estuary constrictions
- Dry season: concentrated in lower estuary/tidal zones

CROC HOTSPOTS: ALL Gulf rivers. Never exit the boat. Immediate alert on any reptile.`,

  nt: `REGION: Northern Territory — Darwin Harbour, Mary River, Daly River, Kakadu, Adelaide River, Finniss River, Roper River, McArthur River

KEY SPECIES TO DETECT:
• Barramundi (Lates calcarifer) — PRIMARY TARGET. Large silver/bronze torpedo-shaped fish 50–120 cm. EXTREME croc country — double-check any large water disturbance.
• Saltwater Crocodile — EXTREME ALERT. Highest croc density in Australia. Every NT waterway must be treated as active croc habitat. NEVER wade. Immediate maximum-priority warning.
• Saratoga — Elongated, spotted, surface lily-pad glider
• Mangrove Jack — Reddish, stocky, root-system hugging
• Queenfish — Darwin Harbour surface schools
• Giant Trevally — Harbour channel predator
• Spanish Mackerel — Darwin Shoal offshore

VISUAL RECOGNITION — BARRAMUNDI:
- Torpedo-shaped, streamlined silver/bronze body
- Strong lateral line (dark stripe along full length of flank)
- Concave forehead, large protruding jaw, large mouth
- Rounded/fan-shaped tail
- Behaviour: roll, leap, tail-slap, bow wave, surface swirl near rock bar or snag
- Look for: silver flash in low light, dorsalfin cutting surface, subsurface shadow

HABITAT CUES IN THIS REGION:
- Mary River (Shady Camp): most famous barra spot in Australia. Rock bar, tidal narrows.
- Corroboree Billabong: saratoga + barra, lily pad system
- Daly River: rock bars, submerged ledges, deep eddies
- Adelaide River: EXTREME croc — fish from boat only, no wading EVER
- Darwin Harbour: barge channel, breakwall, tidal channels
- Finniss / Reynolds River: remote pristine barra, strong croc presence
- Roper / McArthur River: Gulf NT barra on run-out tide over rock bars

CROC ALERT PROTOCOL: NT croc density is EXTREME. Any large dark shape, V-wake, snout or eyes above water = IMMEDIATE maximum-priority croc alert. Never ignore.

WHAT TO DETECT: Silver/bronze fish shapes, leaping fish, surface wakes, fin cuts, large reptile silhouettes, eye-shine, V-wakes indicating large submerged animal.`,
};

// ─── Mode system prompts ──────────────────────────────────────────────────────

const BARRA_SPECIALIST_SYS = `You are an expert Australian fishing AI and wildlife safety system specialising in real-time live camera analysis.
You are processing a LIVE CAMERA FRAME from a fishing boat on Australian waters.

PRIMARY MISSION: Detect Barramundi fish, crocodiles, humans, and significant wildlife in the frame.
SECONDARY: Detect any other notable objects (boats, gear, birds diving = fish below).

BARRAMUNDI DETECTION RULES:
- Look for torpedo-shaped silver/bronze fish at or near the water surface
- Surface disturbance patterns: circular swirl, V-wake, bow wave, baitfish scatter
- Leaping or rolling fish silhouettes — even partial glimpse = flag it
- Subsurface silver shadow or shadow shape consistent with large fish
- Birds diving aggressively = likely baitfish below = likely barra nearby

CROCODILE DETECTION RULES:
- Any reptile silhouette, eye-shine, snout, or tail above water = IMMEDIATE ALERT
- V-wake without visible surface animal = possible submerged croc
- Dark elongated shape near bank or in shallows = flag as possible croc
- When in doubt, flag it — false positives are safer than false negatives

CONFIDENCE GUIDANCE:
- 0.9+ = very clear, unambiguous detection
- 0.7–0.9 = probable, good visual evidence
- 0.5–0.7 = possible, some evidence, low light or partial view
- Below 0.5 = uncertain — still report if worth flagging for safety`;

const FACE_SYS = `You are a real-time face and person detection AI analysing a live camera frame.
Detect ALL visible faces, people, and human figures in the frame.
Be thorough — detect partial faces, faces at angles, people in the background.`;

const OBJECT_SYS = `You are a real-time object detection AI analysing a live camera frame.
Detect ALL significant objects: people, animals, vehicles, equipment, fish, crocodiles, birds, boats.
Be comprehensive and accurate with bounding box coordinates.`;

// ─── Output schema injected into every call ───────────────────────────────────

const OUTPUT_SCHEMA = `
RESPOND WITH VALID JSON ONLY — no markdown, no explanation, no text outside the JSON:
{
  "targets": [
    {
      "id": "t1",
      "label": "Barramundi",
      "confidence": 0.87,
      "box": { "x": 0.12, "y": 0.35, "w": 0.28, "h": 0.18 },
      "note": "Large silver fish breaking surface near right bank — strong lateral line visible"
    }
  ],
  "frameNote": "One-sentence description of the whole scene"
}

BOUNDING BOX RULES:
- x, y, w, h are ALL fractions of the full image dimensions (0.0 to 1.0)
- x = left edge of box ÷ image width
- y = top edge of box ÷ image height
- w = box width ÷ image width
- h = box height ÷ image height
- Boxes must not exceed 1.0 on any axis
- Make boxes tight around the actual detected object

If nothing detected: { "targets": [], "frameNote": "No targets visible in current frame" }`.trim();

// ─── Route ───────────────────────────────────────────────────────────────────

router.post("/vision-detect", async (req, res) => {
  const {
    imageBase64,
    region = "wa",
    mode = "barra",
  } = req.body as {
    imageBase64?: string;
    region?: string;
    mode?: "face" | "object" | "barra";
  };

  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 required" });
    return;
  }

  try {
    const mime = detectMime(imageBase64);
    const regionKey = (["wa", "nq", "nt"].includes(region) ? region : "wa") as keyof typeof REGIONAL_BRAIN;
    const regionalBrain = REGIONAL_BRAIN[regionKey];

    // ── Build system prompt ─────────────────────────────────────────────────
    let systemContent: string;
    if (mode === "face") {
      systemContent = `${FACE_SYS}\n\n${OUTPUT_SCHEMA}`;
    } else if (mode === "object") {
      systemContent = `${OBJECT_SYS}\n\nREGIONAL CONTEXT:\n${regionalBrain}\n\n${OUTPUT_SCHEMA}`;
    } else {
      // Full barra mode — inject all brain knowledge
      systemContent = `${BARRA_SPECIALIST_SYS}\n\nREGIONAL BRAIN KNOWLEDGE:\n${regionalBrain}\n\n${OUTPUT_SCHEMA}`;
    }

    // ── Build user message content ──────────────────────────────────────────
    const content: ContentPart[] = [];

    // Inject barraLibrary few-shot references for barra mode
    if (mode === "barra") {
      const refs = getFewShotRefs(2, false);
      const refsWithThumb = refs.filter((r) => r.thumbBase64);

      if (refsWithThumb.length > 0) {
        content.push({
          type: "text",
          text: "REFERENCE IMAGES — confirmed research-grade Barramundi specimens (iNaturalist) for visual comparison:",
        });
        for (const ref of refsWithThumb.slice(0, 2)) {
          content.push({
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${ref.thumbBase64}`, detail: "low" },
          });
          content.push({
            type: "text",
            text: `✓ Confirmed Barramundi — ${ref.location}. Note: torpedo body, lateral line, rounded tail.`,
          });
        }
        content.push({ type: "text", text: "━━━ NOW ANALYSE THIS LIVE CAMERA FRAME ━━━" });
      }
    }

    // The live frame itself — use "low" detail for speed (live frames are fast-moving,
    // high detail adds 10-15s latency with no meaningful gain for fish/croc detection)
    content.push({
      type: "image_url",
      image_url: { url: `data:${mime};base64,${imageBase64}`, detail: "low" },
    });

    // Final instruction
    const instruction =
      mode === "barra"
        ? `Analyse this live camera frame from ${regionKey.toUpperCase()} Australia. Detect all Barramundi, crocodiles, people, and significant wildlife. Use the regional brain knowledge and reference images above. Return JSON targets with precise bounding boxes.`
        : mode === "face"
        ? "Detect all faces and people in this frame. Return JSON targets with precise bounding boxes."
        : `Detect all significant objects in this frame from ${regionKey.toUpperCase()} Australia. Return JSON targets with precise bounding boxes.`;

    content.push({ type: "text", text: instruction });

    // ── Call GPT-4.1 Vision ─────────────────────────────────────────────────
    const completion = await openai.chat.completions.create({
      model: getModel("top"),
      max_completion_tokens: 400,
      stream: false,
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const clean = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const match = clean.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : { targets: [], frameNote: "Parse error" };

    res.json({
      targets: Array.isArray(parsed.targets) ? parsed.targets : [],
      frameNote: parsed.frameNote ?? "",
      region: regionKey,
      mode,
    });

    req.log.info(
      { mode, region: regionKey, targetCount: parsed.targets?.length ?? 0 },
      "vision-detect complete"
    );
  } catch (err) {
    req.log.error({ err }, "vision-detect failed");
    res.status(500).json({ error: "Detection failed", targets: [], frameNote: "" });
  }
});

export default router;
