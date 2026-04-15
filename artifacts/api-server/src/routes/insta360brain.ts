/**
 * POST /api/insta360/brain
 *
 * Insta360 Brain — comprehensive 360° fishing intelligence.
 * Analyses a real-world camera frame (or answers a text query) with deep
 * WA/Kimberley fishing expertise: bird activity, surface busts, spot assessment,
 * water conditions, recommended tactics + gear, croc risk, weather read.
 *
 * Injects bird + croc library refs for grounded visual identification.
 */
import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getBirdFewShotRefs } from "../lib/birdLibrary.js";
import { getCrocFewShotRefs } from "../lib/crocLibrary.js";

const router = Router();

// ─── System prompt ─────────────────────────────────────────────────────────
const SYSTEM = `You are the Insta360 Brain — the world's most advanced WA/Kimberley fishing AI assistant embedded in the HookVision app.

You have 30+ years of lived experience fishing Broome, Roebuck Bay, Cambridge Gulf, Ord River, Fitzroy River, Drysdale River, King Sound, Ningaloo Reef, and the WA Kimberley coastline.

When given a 360° camera image from the boat, you analyse it comprehensively and deliver actionable fishing intelligence. When given a text query about the Insta360 camera or connection, you troubleshoot it precisely.

## IMAGE ANALYSIS — what you look for:

### BIRDS + SURFACE ACTIVITY
- Bait birds (frigatebirds, terns, boobies, ospreys, brahminy kites, cormorants) diving = bait fish below = predators below
- Surface bust-ups: white water, spray, splashing = barra/trevally/mackerel smashing bait
- Bait balls: dark nervous patches at surface, birds wheeling tight above

### WATER CONDITIONS
- Colour: green (clear, good for surface lures) / brown (murky, go subsurface 2–5m) / tannin (freshwater runoff)
- Chop/swell: calm flat = bait schools visible on sonar; choppy = move to protected ground
- Tide rip: current edges, foam lines = ambush feeding zones for barra + GT
- Shadow/light: afternoon shadow on banks = ambush points

### LOCATION FEATURES
- Structure visible: rock bars, fallen timber, mangrove edges, sandbanks, channel edges
- Boat position relative to structure
- Any anchor markers or buoys indicating known spots

### CROC RISK
- Eyes at waterline (paired amber glints), snout, V-wake, floating log silhouette
- Brown murky water + tall wet season grass = HIGH croc risk
- Kimberley tidal rivers and estuaries = always assume croc presence

### WEATHER READ
- Cloud cover: shade = fish less spooky, better surface bite
- Wind direction from water ripple direction
- Lightning/storm risk on horizon

### RECOMMENDED TACTICS
- Based on conditions seen: specific lure/bait + retrieval technique for the scene
- Cast direction: which zone (left/centre/right) shows most activity
- Depth advice based on water clarity and bird activity
- Time-of-day recommendation if determinable

## TEXT QUERY MODE
If no image is provided or a text query is given, answer as an expert on:
- Insta360 camera WiFi connection (192.168.42.1, LIVE-xxxxxx hotspot)
- Android/Samsung connectivity fixes
- Camera settings for fishing (HDR off for motion, resolution 4K, stabilisation ON)
- Shot composition for fishing content
- Best practices for 360° fishing footage

## RESPONSE FORMAT
Respond ONLY with valid JSON:
{
  "mode": "image" | "text",
  "summary": "one punchy sentence — what the brain sees overall",
  "activityLevel": "none" | "low" | "medium" | "high",
  "castZone": "left" | "centre" | "right" | "all" | "none",
  "birds": {
    "detected": boolean,
    "species": ["species name"],
    "urgency": "none" | "low" | "high",
    "description": "what they're doing"
  },
  "surface": {
    "bustUp": boolean,
    "baitBall": boolean,
    "description": "what's happening at the surface"
  },
  "water": {
    "colour": "green" | "brown" | "tannin" | "blue" | "murky" | "clear",
    "conditions": "calm" | "choppy" | "rip" | "glassy",
    "visibility": "good" | "poor" | "unknown"
  },
  "crocRisk": "none" | "low" | "medium" | "high",
  "crocDetail": "description if croc signs present, else empty string",
  "structure": "description of any visible structure or fishing features",
  "tactics": {
    "lure": "specific lure recommendation",
    "technique": "how to fish it",
    "depth": "target depth range",
    "priority": "what to do RIGHT NOW"
  },
  "weatherRead": "brief weather/conditions read from the frame",
  "confidence": number (0–100),
  "birdRefCount": number,
  "crocRefCount": number,
  "textAnswer": "only populated in text mode — expert answer to the query"
}`;

// ─── POST /api/insta360/brain ───────────────────────────────────────────────
router.post("/insta360/brain", async (req, res) => {
  const {
    imageBase64,
    query = "",
    sonarContext,
  } = req.body as {
    imageBase64?: string;
    query?: string;
    sonarContext?: {
      species?: string;
      fishCount?: number;
      depth?: string;
      crocAlert?: boolean;
    };
  };

  const hasImage = typeof imageBase64 === "string" && imageBase64.length > 100;
  const hasQuery = typeof query === "string" && query.trim().length > 0;

  if (!hasImage && !hasQuery) {
    res.status(400).json({ error: "Provide imageBase64 or query" });
    return;
  }

  // Inject library refs for grounding
  const birdRefs = getBirdFewShotRefs(3);
  const crocRefs = getCrocFewShotRefs(3);

  // Build user message content
  const content: any[] = [];

  if (hasImage) {
    content.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "high" },
    });
  }

  // Build text prompt
  let textPrompt = hasImage
    ? "Analyse this 360° camera frame from my fishing boat on WA/Kimberley waters."
    : `Text query: ${query.trim()}`;

  if (hasQuery && hasImage) {
    textPrompt += `\n\nAdditional question: ${query.trim()}`;
  }

  if (sonarContext) {
    textPrompt += `\n\nCurrent sonar data for context: species=${sonarContext.species ?? "unknown"}, fish count=${sonarContext.fishCount ?? 0}, depth=${sonarContext.depth ?? "unknown"}, croc alert=${sonarContext.crocAlert ? "YES" : "no"}.`;
  }

  // Inject bird refs
  if (birdRefs.length > 0) {
    textPrompt += `\n\nNT bird reference photos (${birdRefs.length} examples from iNaturalist research library) — use these to identify bait bird species in the frame:`;
    content.push({ type: "text", text: textPrompt });
    for (const ref of birdRefs) {
      if (ref.thumbBase64) {
        content.push({
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${ref.thumbBase64}`, detail: "low" },
        });
        content.push({ type: "text", text: `Bird ref: ${ref.species ?? "WA/Kimberley water bird"} (iNaturalist)` });
      }
    }
  } else {
    content.push({ type: "text", text: textPrompt });
  }

  // Inject croc refs
  if (crocRefs.length > 0) {
    content.push({ type: "text", text: `WA/Kimberley crocodile reference photos (${crocRefs.length} examples from iNaturalist research library) — use to detect croc presence:` });
    for (const ref of crocRefs) {
      if (ref.thumbBase64) {
        content.push({
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${ref.thumbBase64}`, detail: "low" },
        });
        content.push({ type: "text", text: `Croc ref: ${ref.species ?? "Crocodylus porosus"} (iNaturalist)` });
      }
    }
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      max_tokens: 900,
      temperature: 0.25,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: hasImage ? content : (hasQuery ? query.trim() : "Analyse conditions."),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";

    // Strip markdown fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");

    let result: any;
    try {
      result = JSON.parse(cleaned);
    } catch {
      res.status(500).json({ error: "Invalid JSON from model", raw });
      return;
    }

    res.json({
      ...result,
      birdRefCount: result.birdRefCount ?? birdRefs.length,
      crocRefCount: result.crocRefCount ?? crocRefs.length,
    });
  } catch (err) {
    console.error("[insta360/brain]", err);
    res.status(500).json({ error: String(err) });
  }
});

export default router;
