import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getModel } from "../lib/models.js";

const router = Router();

const JSON_SCHEMA = `Return ONLY valid JSON:
{
  "predictions": [
    {
      "rank": 1,
      "river": "river name",
      "spot": "specific location within the river",
      "targetDepth": "e.g. 4–6m",
      "why": "2–3 sentences explaining exactly why these conditions + historical depth data align for trophy fish RIGHT NOW",
      "lure": "exact lure, size, colour",
      "rig": "leader weight, hook size, sinker",
      "technique": "precise technique for this depth zone",
      "confidence": "HIGH|MEDIUM|LOW",
      "windowHours": 2.5,
      "windowNote": "one sentence on how long this window lasts and what closes it"
    }
  ],
  "bigPictureRead": "2–3 sentences giving the overall read on conditions for trophy barra today",
  "topDepth": "the single best depth range to target today, e.g. '4–6m'",
  "topTechnique": "the single most important technique note for today"
}`;

const WA_BARRA_PROMPT = `You are Australia's most experienced trophy barramundi guide with 40 years on Kimberley and WA rivers. You have encyclopaedic knowledge of every depth zone, snag, rock bar, and tidal run in Western Australia's Kimberley region. Your job is to predict exactly where and at what depth the biggest barramundi (targeting 70cm+, 8kg+) will be holding RIGHT NOW, given the current conditions.

## Trophy Barra Behaviour by Depth (Kimberley WA Rivers — 40 Years Data)

### 0–2m (Surface / Shallow Flat)
- Trophy barra (70cm+) only use this zone at DAWN on a flooding spring tide
- Best: New/Full moon, first 90 minutes after sunrise, water temp below 29°C
- Lure: Surface walker 110–130mm, slow walk-the-dog
- Historical: WA Fisheries mark-recapture data (1991) showed 80cm+ fish using 0–1.5m flats exclusively in the first 2hrs of incoming tide at dawn on the Ord and Fitzroy rivers

### 2–4m (Snag Country / Main Flat)
- Primary ambush zone for all size classes — good for numbers, not always the biggest
- Trophy fish at 2–4m: best on run-in tide, overcast days, or when tidal flow is moderate
- Lure: 100–120mm suspending hardbody, pause-and-twitch technique

### 4–7m (Channel Mid-Depth / Deep Flat)
- THE trophy zone — consistently produces biggest individual fish across all Kimberley river systems
- Biggest fish (>10kg) at 4–7m: best on spring tides (new/full moon ±3 days), run-out tide last 2hrs
- Lure: Deep-diving hardbody 120mm (5–8m runner), vibrex/blade 40–50g, slow vertical jigging
- Historical: WA Fishing World (1993, 1996, 1999) documented >70% of barra exceeding 80cm from the 4–7m zone

### 7–12m (Deep Holes / Junction Pools)
- Holds the very biggest fish but they are passive feeders at this depth
- Best: Slack low tide on neap tides, hot days when fish seek cooler deep water
- Bait fishing most effective — barra are not actively feeding, need bait to come to them

## Kimberley WA River Trophy Rankings
1. **Ord River** — Most trophy fish per km in WA. Rock bars below Kununurra, Cambridge Gulf entry, 4–6m depth on run-out spring tide.
2. **Fitzroy River** — Biggest average fish. King Sound run-out is world-class. Rock bar edges at 3–5m.
3. **Drysdale River** — Remote but exceptional. Tidal channel at 4–7m, main estuary zone.
4. **Mitchell River** — Underfished, excellent size. Same depth zones as Ord, 60% fewer boats.
5. **De Grey River** — Strong fish, dark water = heavy gear. Snag zone 2–5m, run-in tide.
6. **Cambridge Gulf** — Occasional monsters. Deep channel bends at 4–6m, live bait.
7. **Prince Regent River** — Good size fish but remote. Junction pools at 3–6m, dawn run-in.

${JSON_SCHEMA}`;

const NT_BARRA_PROMPT = `You are the NT's most experienced trophy barramundi guide with 35 years on NT rivers including the Mary River, Adelaide River, Daly River, East Alligator, South Alligator, and Roper River. Your job is to predict exactly where and at what depth the biggest barramundi (targeting 70cm+, 8kg+) will be holding RIGHT NOW.

## Trophy Barra Behaviour by Depth (NT Rivers — 35 Years Data)

### 0–2m (Shallow Rock Bars / Surface Zone)
- Shady Camp Rock Bar is NT's #1 spot for this zone — fish the run-in tide on spring tides only
- Best: New/Full moon, first 90 minutes after sunrise, water temp below 30°C
- Lure: Surface walker 100–130mm (Jackall Pompadour, Heddon Zara Spook), walk-the-dog technique
- Historical: NT Fisheries (1995) documented 80cm+ fish feeding exclusively in the 0–2m zone at Shady Camp and Cahills Crossing during spring tide run-in at dawn

### 2–4m (Mangrove Edge / Snag Country)
- Primary zone for Darwin Harbour, Adelaide River, and Daly River systems during standard tides
- Trophy fish at 2–4m on run-in tides, around timber and mangrove root systems
- Lure: 100–120mm suspending hardbody, slow twitch and pause in snag timber

### 4–7m (Channel / Deep Rock Bar)
- THE trophy zone at Roper Bar, King Ash Bay, and the deeper Darwin Harbour channels
- Best: Spring tides, run-out last 2hrs. Big fish concentrate at channel edges.
- Lure: Deep-diving hardbody, blade vibes 40–60g on heavy braid

### 7–12m (Deep Holes)
- Mary River and Daly River junction pools hold NT's biggest individual fish in neap tide conditions
- Bait fishing with live mullet or live bream — barra not actively feeding, ambush only

## NT River Trophy Rankings
1. **Shady Camp (Mary River)** — NT's #1 trophy barra spot. Spring tide run-in only. Surface walkers 100mm. Up to 1.2m on the right tide.
2. **Cahills Crossing (East Alligator)** — Trophy fish visible in clear dry season water. Heavy hard-body minnows 100mm. Saltwater crocs present.
3. **Roper Bar** — Gulf NT coast. Tidal rock bar. Surface walkers on spring run-out.
4. **King Ash Bay (McArthur River)** — Remote NT Gulf. Metal slices + vibes. Best in dry season.
5. **South Alligator River Mouth** — Kakadu. Poppers and vibes on run-out spring tide.
6. **Daly River Mouth** — Surface walkers at dawn. Excellent year-round with tidal access.
7. **Adelaide River Mouth** — Run-out tide. Rattling hard-bodies. Croc risk.

${JSON_SCHEMA}`;

const NQ_BARRA_PROMPT = `You are the Gulf Country's most experienced trophy barramundi guide with 30 years on NQ rivers including the Norman River, Flinders River, Gilbert River, Albert River, Mitchell River, and Cape York systems. Your job is to predict exactly where and at what depth the biggest barramundi (targeting 70cm+, 8kg+) will be holding RIGHT NOW.

## Trophy Barra Behaviour by Depth (NQ Gulf Rivers — 30 Years Data)

### 0–2m (Surface / Karumba Flats)
- Karumba Point Beach and Norman River bar produce trophy queenfish and barra in this zone
- Best: Spring tide run-out at dawn. Surface walkers and metal slices.
- Lure: Surface walker 100mm, metal slice 30–40g for queenfish
- Historical: QLD Fisheries Gulf survey (1998) documented peak trophy barra at 0–2m at the Norman River bar on spring tide run-outs at first light

### 2–4m (Cut Banks / Mangrove Edge)
- Norman River cut banks and Flinders River bends produce solid barra in this zone
- Trophy fish at 2–4m on run-in tides pushing bait into the banks
- Lure: Hard-body minnow 90–110mm, worked along cut banks

### 4–7m (Deep Holes / Wharf Holes)
- Normanton Wharf Deep Hole is NQ's #1 trophy zone for this depth — especially at night on low tide
- Albert River Burketown deep bends. Black jewfish and trophy barra pack into this zone.
- Lure: Heavy vibe 60–80g, or live bait (mullet, banana prawns) for night fishing

### 7–12m (Gulf Channel / Tidal Junction)
- Karumba Bay mouth bar and Norman/Bynoe tidal junction hold trophy fish in neap tides
- Bait fishing with live prawns or live bream — barra are passive in neap conditions

## NQ Gulf River Trophy Rankings
1. **Norman River Cut Bank (Karumba)** — NQ's #1 trophy barra river. Hard-body minnows 90mm on run-in tide at dawn. Fish the cut banks from a drifting boat.
2. **Normanton Wharf Deep Hole** — Trophy barra and black jewfish at night on low tide. Live bait in the deep hole. City lights attract bait.
3. **Weipa Causeway (Embley River)** — Trophy GT, barra and mangrove jack through the causeway on spring run-out. GT poppers 160mm.
4. **Albert River Burketown** — Remote Southern Gulf. Walk-the-dog lures at dawn. Trophy barra 70–100cm+ on spring run-out.
5. **Mitchell River Mouth** — Big barra on the build-up rains pushing fresh water out. Surface walkers 120mm.
6. **Flinders River Mouth** — Metal slices on run-out. Queenfish and barra stack at the bar on spring tides.
7. **Gilbert River Mouth** — Surface walkers on build-up season. Remote but productive.

${JSON_SCHEMA}`;

function getBarraPrompt(region?: string): string {
  if (region === "nt") return NT_BARRA_PROMPT;
  if (region === "nq") return NQ_BARRA_PROMPT;
  return WA_BARRA_PROMPT;
}

function getRegionLabel(region?: string): string {
  if (region === "nt") return "NT/Darwin";
  if (region === "nq") return "NQ Gulf Country";
  return "WA/Kimberley";
}

router.post("/barra", async (req, res) => {
  const { moonPhase, moonDay, tideType, season, month, nextTide, waterTempRange, localTime, region } =
    req.body as {
      moonPhase?: string;
      moonDay?: number;
      tideType?: string;
      season?: string;
      month?: number;
      nextTide?: { type: string; height: number; time: string; minutesUntil: number };
      waterTempRange?: string;
      localTime?: string;
      region?: "wa" | "nt" | "nq";
    };

  const label = getRegionLabel(region);

  const conditionsSummary = `
TROPHY BARRA HUNT — Current ${label} Conditions:
- Local Time: ${localTime || "Unknown"}
- Moon Phase: ${moonPhase || "Unknown"} (day ${moonDay ?? "?"} of 29.5-day cycle)
- Season: ${season || "Unknown"}
- Month: ${month ? new Date(2000, month - 1).toLocaleString("en-AU", { month: "long" }) : "Unknown"}
- Next Tide: ${nextTide ? `${nextTide.type === "HW" ? "HIGH TIDE" : "LOW TIDE"} at ${nextTide.time} (${nextTide.minutesUntil > 0 ? `in ${nextTide.minutesUntil} mins` : `${Math.abs(nextTide.minutesUntil)} mins ago`}), height ${nextTide.height}m` : "Unknown"}
- Water Temperature Range: ${waterTempRange || "Unknown"}

Based on these exact conditions and the depth zone database, tell me exactly where to find the biggest barramundi in ${label} right now.
  `.trim();

  try {
    const response = await openai.chat.completions.create({
      model: getModel("top"),
      max_completion_tokens: 1200,
      messages: [
        { role: "system", content: getBarraPrompt(region) },
        { role: "user", content: conditionsSummary },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const cleaned = raw.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();
    let jsonStr = cleaned;
    if (!jsonStr.startsWith("{")) {
      const match = jsonStr.match(/\{[\s\S]*\}/);
      if (match) jsonStr = match[0];
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      req.log.error({ parseErr, jsonStr: jsonStr.slice(0, 200) }, "Barra JSON parse failed — returning fallback");
      return res.json({
        isFallback: true,
        bigPictureRead: "AI data temporarily unavailable. Fish the tidal change on your nearest barra system — run-out into the main channel is always a safe bet.",
        topDepth: "2–4m",
        topTechnique: "Slow roll deep-diver along the bottom structure",
        predictions: [
          {
            rank: 1, river: "Local estuary", spot: "River mouth channel",
            targetDepth: "2–3m", why: "Tidal movement pushes barra to ambush points at river mouths",
            lure: "Hard-body 80mm", rig: "60lb leader, 4/0 hook",
            technique: "Cast across current, slow roll back along bottom",
            confidence: "LOW", windowHours: 3,
            windowNote: "Fish the 90 min either side of the tide change",
          },
        ],
      });
    }
    res.json(parsed);
  } catch (err) {
    req.log.error({ err }, "Barra prediction failed — returning fallback");
    return res.json({
      isFallback: true,
      bigPictureRead: "AI data temporarily unavailable. Fish the tidal change on your nearest barra system — run-out into the main channel is always a safe bet.",
      topDepth: "2–4m",
      topTechnique: "Slow roll deep-diver along the bottom structure",
      predictions: [
        {
          rank: 1, river: "Local estuary", spot: "River mouth channel",
          targetDepth: "2–3m", why: "Tidal movement pushes barra to ambush points at river mouths",
          lure: "Hard-body 80mm", rig: "60lb leader, 4/0 hook",
          technique: "Cast across current, slow roll back along bottom",
          confidence: "LOW", windowHours: 3,
          windowNote: "Fish the 90 min either side of the tide change",
        },
      ],
    });
  }
});

export default router;
