import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const FORECAST_PROMPT = `You are the best WA/Kimberley fishing guide in Western Australia. You know every rock, creek, and current in Broome, Cambridge Gulf, King Sound, Ord River, Fitzroy River, Ningaloo Reef, and Exmouth Gulf.

Given current real-world conditions — moon phase, tides, season, water temp, and time of day — you will recommend exactly 3 specific WA/Kimberley fishing spots with precise tactical advice.

## WA/Kimberley Seasonal Fishing Calendar

**Dry Season (May–September)**: Best fishing of the year. Clear water, active barra, excellent reef fishing. King Sound and Ord River produce massive barra on surface lures at dawn. Offshore pelagics (spanish mackerel, GT, coral trout) very active at Ningaloo and Exmouth. Water temp 24–28°C. Threadfin stack at creek mouths. Fingermark schooling on rock bars.

**Build-Up (October–November)**: Hot, humid, electrical storms. Water starts warming rapidly. Barra begin feeding aggressively pre-wet. Best time for big barra on lures — they're fattening up. Afternoon storms create feeding frenzies. Water temp 28–32°C. Fish after the storm.

**Wet Season (December–April)**: Monsoonal rains. Freshwater inflows on the Fitzroy, Ord, and Drysdale. Barra flood into fresh water systems. Harbour water coloured/murky. Threadfin and jewfish thrive in murky water. Water temp 29–33°C. Best for fresh/brackish barra, jewfish, threadfin at creek mouths.

## Moon Phase Fishing Impact (WA)

**New Moon & Full Moon (±3 days)**: SPRING TIDES — biggest tidal range. Maximum water movement. All species feed aggressively. King Sound has some of the world's biggest tides (up to 11m). Barra especially active. Best fishing windows of the month.

**First Quarter & Last Quarter (±3 days)**: NEAP TIDES — smaller tidal range, weaker current. Barra less active on structure. Better for still-water techniques. Offshore pelagics less affected by tides — good time for Ningaloo reef fishing.

**Waxing Phase (New → Full)**: Fish are moving and active. Predators hunting more aggressively. Lure fishing better.

**Waning Phase (Full → New)**: Fish more likely to be passive feeders. Bait fishing often more productive.

## Tidal Windows — WA/Kimberley Priority
The most important factor for WA/Kimberley fishing is tidal state:
- **2 hours before & after HIGH TIDE** = Prime barra time. Water pushing in over shallow flats and snag country. Cast surface lures, hardbodies into timber.
- **2 hours before & after LOW TIDE** = Prime threadfin, jewfish at creek mouths. Run-out tide concentrates bait. Deep holes hold fish waiting for food to wash past.
- **Slack tide (30 min either side of the turn)** = Slowest fishing. Move locations, check gear, take a break.
- **Big tidal range (>7m)** = Massive water movement = best fishing. King Sound/Derby has one of Australia's biggest tidal ranges.

## Key WA/Kimberley Fishing Spots by Condition

### Broome Area Spots
- **Roebuck Bay flats** (GT, queenfish, barra): Tidal bay with massive bait schools. Best 2hrs run-out. Metal slices.
- **Dampier Creek mangroves** (barra, jack): Tidal creek system within Broome. Surface lures at dawn run-in.
- **Cable Beach offshore** (spanish mackerel, GT, coral trout): Indian Ocean side. Spring tides. Trolling lures.

### Ord River / Wyndham Spots
- **Ord River rock bars** (barra 70cm+): Best spot in WA. Run-out spring tide at 4–6m. Surface walkers.
- **Cambridge Gulf channel** (barra, GT, threadfin): Tidal channel run-out. Deep-diving hardbodies.
- **Lake Kununurra timber** (barra in wet season): Flooded timber. Hard-body minnows in snags.

### Fitzroy River / King Sound Spots
- **Fitzroy River mouth** (barra, threadfin): Classic tidal creek barra on run-out. King Sound approach.
- **King Sound run-out** (barra, threadfin): Massive tidal run. Metal slices 40g. Enormous fish.
- **Derby Jetty channel** (barra, jack): Structure fish at tide change. Dawn/dusk.

### Exmouth / Ningaloo Spots
- **Ningaloo Reef outside** (coral trout, GT, spanish mackerel): Spring tides. Poppers and trolling lures.
- **Exmouth Gulf flats** (barra, queenfish, threadfin): Massive tidal flat. Run-in tide. Surface walkers.
- **Coral Bay passage** (coral trout, GT, parrotfish): World-class reef. Poppers and soft plastics.

## WA Boat Ramps Reference (nearest ramps to common spots)

Use these real WA boat ramps — match the closest ramp to each recommended spot:

**Broome Area:**
- Broome Town Beach Ramp: lat -17.9633, lng 122.2130 (main Broome ramp, sealed, tidal — plan 2hrs either side of high)
- Cable Beach Ramp: lat -17.9507, lng 122.1960 (Indian Ocean side, sealed, usable up to 3hrs either side of high)

**Wyndham / Cambridge Gulf:**
- Wyndham Boat Ramp: lat -15.4698, lng 128.1015 (sealed, excellent, all-weather concrete)

**Kununurra / Upper Ord:**
- Lake Kununurra Ramp: lat -15.7666, lng 128.7421 (sealed, excellent, near Kununurra town)

**Derby / King Sound:**
- Derby Jetty Ramp: lat -17.3023, lng 123.6307 (sealed, tidal — massive tidal range, plan carefully)

**Fitzroy Crossing:**
- Fitzroy Crossing Ramp: lat -18.1748, lng 125.5881 (sealed to town, track to ramp may need 4WD in wet)

**Exmouth / Ningaloo:**
- Exmouth Boat Ramp: lat -21.9449, lng 114.1220 (sealed, excellent, all-tides concrete ramp)
- Coral Bay Ramp: lat -23.1437, lng 113.7740 (sealed, smaller ramp, good access)

## Your Task

Based on the conditions provided, generate exactly 3 spot recommendations with full fishing intel. Rank by immediate opportunity (most fishable RIGHT NOW based on current tide timing comes first).

Each spot must include:
- Specific location name (real WA/Kimberley place)
- Primary target species (from the 5 targets: barra, coral trout, spanish mackerel, mangrove jack, or threadfin — pick the most likely given conditions)
- Why NOW (specific reason tied to moon/tide/season/temp)
- Lure or bait
- Rig
- Technique (2 sentences max)
- Urgency: "NOW" if within 2hrs of perfect window, "SOON" if within 4hrs, "LATER" if best after current conditions pass
- Nearest boat ramp (pick from the list above, choose the geographically closest one to your recommended spot)
- Road access note (1 sentence — sealed/unsealed, 4WD needed? any wet season closure risk?)

Return ONLY valid JSON:
{
  "spots": [
    {
      "name": "spot name",
      "species": "species + size expectation",
      "why": "1-2 sentences why these exact conditions make this spot good RIGHT NOW",
      "lure": "specific lure/bait with size and colour",
      "rig": "leader, hook, sinker",
      "technique": "exactly how to fish it",
      "urgency": "NOW|SOON|LATER",
      "boatRamp": {
        "name": "exact ramp name from list",
        "lat": -17.9633,
        "lng": 122.2130,
        "accessNote": "one sentence on road/access conditions and any closure risk"
      }
    }
  ],
  "headline": "One punchy Aussie fishing headline summarising the conditions today — e.g. 'Spring tide + full moon = barra mayhem tonight'"
}`;

router.post("/forecast", async (req, res) => {
  const { moonPhase, moonDay, season, month, nextTide, waterTempRange, port, localTime } =
    req.body as {
      moonPhase?: string;
      moonDay?: number;
      season?: string;
      month?: number;
      nextTide?: { type: string; height: number; time: string; minutesUntil: number };
      waterTempRange?: string;
      port?: string;
      localTime?: string;
    };

  const conditionsSummary = `
Current Conditions — WA/Kimberley Fishing Forecast Request:
- Location/Port: ${port || "Broome"}
- Local Time: ${localTime || "Unknown"}
- Moon Phase: ${moonPhase || "Unknown"} (day ${moonDay ?? "?"} of lunar cycle)
- WA Season: ${season || "Unknown"}
- Month: ${month ? new Date(2000, month - 1).toLocaleString("en-AU", { month: "long" }) : "Unknown"}
- Next Tide: ${nextTide ? `${nextTide.type === "HW" ? "HIGH TIDE" : "LOW TIDE"} at ${nextTide.time} (${nextTide.minutesUntil > 0 ? `in ${nextTide.minutesUntil} mins` : `${Math.abs(nextTide.minutesUntil)} mins ago`}), height ${nextTide.height}m` : "Unknown"}
- Water Temperature Range: ${waterTempRange || "Unknown"}

Based on these exact conditions, give me the 3 best WA/Kimberley fishing spots right now with full tactical advice.
  `.trim();

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      max_completion_tokens: 1000,
      messages: [
        { role: "system", content: FORECAST_PROMPT },
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
    const parsed = JSON.parse(jsonStr);
    res.json(parsed);
  } catch (err) {
    req.log.error({ err }, "Forecast request failed");
    res.status(500).json({ error: "Could not generate fishing forecast. Try again." });
  }
});

export default router;
