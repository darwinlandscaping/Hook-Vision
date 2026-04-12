import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getConditionsContext } from "../lib/dailyBriefing";
import { getDemoRefs } from "../lib/demoReference";

const router = Router();

const SYSTEM_PROMPT = `You are an expert NT Australia fishing guide and sonar analyst. Identify fish species from sonar screenshots with precision using these rules in strict priority order.

## ARCH PHYSICS
- Arch THICKNESS (vertical height) = fish SIZE. Fat tall arch = big fish. Thin hairline = small fish.
- Arch COLOR = echo strength. Deep red/orange/white = large physostomous swim bladder. Yellow/green = medium. Blue = weak.
- SHADOW beneath arch = dark void directly below = acoustic shadow from swim bladder = large predator confirmed.
- Arch ON hard bottom = structure-hugging species. Arch mid-column WITH shadow = barra chasing bait.

## SWIM BLADDER TIER — PRIMARY ID STEP
Tier 1 PHYSOSTOMOUS (brightest red/orange): Barramundi, Jewfish/Mulloway, Threadfin Salmon, Mangrove Jack, Fingermark
Tier 2 PHYSOCLISTOUS (medium yellow/green): Rock Cod, Coral Trout, Estuary Cod, Queenfish
Tier 3 NONE/POOR (dim/faint/invisible): Giant Trevally, Spanish Mackerel, Flathead
Rule: dim arch = Tier 3 only; bright arch = Tier 1-2 only. Eliminates most wrong IDs immediately.

## DEPTH ZONE — SECONDARY ID STEP
0-5m: Barra, GT, Thready, Jack
5-12m: Barra (estuarine snags), Fingermark (rocky reef), Thready (turbid), Jack
12-25m: Fingermark (rocky reef), Jewfish, Rock Cod
25m+: Fingermark, Red Emperor, Rock Cod
Eliminate any species outside their depth zone.

## SPECIES RULES

BARRAMUNDI (Lates calcarifer) — Tier 1
Thick bright orange/red arch ON hard bottom structure (snags, pylons, rock bars, riprap), OR mid-column arches with CLEARLY VISIBLE dark shadow beneath each arch.
Depth: 1-15m estuarine. Schools 2-5 fish on snag.
Confidence rule: Thick arch + ON hard structure = 85%+. Arch + shadow mid-column = 90%+.
Lures: Halco Roosta 135, Storm 3D Barra 120mm, Zerek Smelt 70mm. Slow roll to structure.

FINGERMARK / GOLDEN SNAPPER (Lutjanus johnii) — Tier 1
ALWAYS schools 3-15 arches floating 1-3m ABOVE hard rubble/reef (never embedded in bottom).
Primary depth 8-15m rocky reef. Also deep estuarine holes.
Two states: resting = invisible at bottom; feeding = school rises 1-3m off rubble.
Lures: Vertical jigs 40-80g, pilchards, live prawns. NT: Fog Bay, Dundee Beach, Bynoe Harbour.

MANGROVE JACK (Lutjanus argentimaculatus) — Tier 1
Half-arch EMBEDDED inside structure echo, not floating above it.
Depth: 1-12m estuarine/mangrove, very tight to snags.
Lures: 60-80mm suspending hardbodies, live mullet.

THREADFIN SALMON (Polydactylus sheridani) — Tier 1
Mid-column schools over SOFT muddy bottom, NOT on structure.
Depth: 2-8m turbid estuaries. Multiple bright arches.
Lures: White soft plastics, mullet-pattern slugs, jig heads 10-20g.

GIANT TREVALLY (Caranx ignobilis) — Tier 3
Near-invisible or very faint arc (no bladder). Near surface/reef edges, fast-moving.
Lures: Large poppers, stickbaits, chrome slugs 40-60g.

JEWFISH / MULLOWAY (Argyrosomus japonicus) — Tier 1
Large bright arches, deeper than barra, tidal channels and deep holes.
Depth: 10-25m. Soft bottom.
Lures: Large soft plastics 5-6 inch, whole pilchards, jig heads 40-60g.

## CROC DETECTION
crocAlert = true ONLY if ALL FOUR are true:
1. SOLID FILLED horizontal blob, NOT an arch, NOT curved
2. ELONGATED like a cigar/torpedo
3. Depth 0-3m
4. Maximum brightness
DEFAULT = false. A large bright barra arch is NEVER a croc. Any arch/U-shape = fish = false.

## SONAR BRANDS
Lowrance: dark grey UI, teal buttons, orange/red = strongest.
Garmin: black bezel, aqua palette, white/blue = strongest.
Humminbird: orange logo, brown/orange scale. Split-screen = circular flasher wheel on LEFT.
Simrad: blue/grey branding, similar to Lowrance.
Raymarine: lighthouse orange logo, navy UI.
Deeper: phone app, blue UI, fish icons with depth tags.

## RESPONSE — return ONLY this JSON, no markdown, no explanation:
{
  "species": "string",
  "confidence": 0,
  "fishCount": 0,
  "depth": "string",
  "bottomType": "string",
  "sonarBrand": "string or null",
  "sonarModel": "string or null",
  "archType": "single|multiple|school|bait cloud",
  "archDepth": null,
  "archXFrac": null,
  "archYFrac": null,
  "suggestion": "string",
  "lure": "string",
  "technique": "string",
  "rig": "string",
  "tidal": "string",
  "turbidity": "string",
  "structure": "string",
  "crocAlert": false,
  "crocWarning": null,
  "archReasoning": "3 sentences: (1) brightness tier observed + species included/excluded, (2) depth zone match/exclusion, (3) habitat/schooling confirmation + final ID"
}`;

const ANALYSIS_STEP_PROMPT = `Apply this 5-step reasoning before returning JSON:
1. BRIGHTNESS TIER: How bright are the arches? Assign Tier 1/2/3. Eliminate impossible species.
2. DEPTH ZONE: Read depth scale carefully. What depth are arches at? Eliminate species outside that zone.
3. SHADOW CHECK: Is there a dark void beneath any arch? Shadow = large physostomous fish = barra/jewfish.
4. POSITION: Are arches ON hard structure, above rubble, or mid-column? Match to species rules.
5. SCHOOLING: Single arch vs multiple vs school? Fingermark always in schools above reef.

Then output ONLY the JSON. No markdown. No explanation.`;

router.post("/analyze", async (req, res) => {
  const { imageBase64 } = req.body as { imageBase64?: string };

  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 is required" });
    return;
  }

  try {
    // Build reference image content blocks from the preloaded demo library.
    // These let GPT directly compare the unknown scan against known labeled examples.
    const demoRefs = getDemoRefs();
    type ContentBlock =
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string; detail: "high" | "low" | "auto" } };

    // Send only the 3 most critical calibration demos (1=barra estuarine,
    // 3=fingermark rocky reef, 5=barra mid-water with shadows).
    // Use detail:"low" — 85 tokens/image vs ~1100 tokens/image at "high".
    // This cuts reference-image token cost from ~5500 to ~255 tokens.
    const KEY_DEMOS = [1, 3, 5];
    const keyRefs = demoRefs.filter((r) => KEY_DEMOS.includes(r.num));

    const referenceBlocks: ContentBlock[] = [];
    if (keyRefs.length > 0) {
      referenceBlocks.push({
        type: "text",
        text: `VISUAL REFERENCE LIBRARY — ${keyRefs.length} KEY CALIBRATION EXAMPLES
Study each labeled image then analyse the unknown scan below.`,
      });
      for (const ref of keyRefs) {
        referenceBlocks.push(
          {
            type: "image_url",
            image_url: {
              url: `data:image/png;base64,${ref.base64}`,
              detail: "low",           // ← was "high" — 13× fewer tokens
            },
          },
          { type: "text", text: ref.label }
        );
      }
      referenceBlocks.push({
        type: "text",
        text: `END OF REFERENCES. Now analyse the UNKNOWN IMAGE below.`,
      });
    }

    const condCtx = getConditionsContext();
    const analysisPrompt = `${condCtx ? condCtx + "\n\n" : ""}${ANALYSIS_STEP_PROMPT}`;

    // ── Streaming OpenAI call ─────────────────────────────────────────────
    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      max_completion_tokens: 700,
      stream: true,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...(referenceBlocks.length > 0
          ? [
              { role: 'user' as const, content: referenceBlocks },
              {
                role: 'assistant' as const,
                content:
                  'Reference library received. Demo 1 (Lowrance HDS Live) = 3 Barramundi at 5.2m, thick bright arches ON hard bottom. Demo 3 (Humminbird HELIX 10) = Fingermark at 8m, clean arch ABOVE rocky rubble. Demo 5 (Humminbird split-screen) = 5-6 Barramundi mid-column, each arch has clear DARK SHADOW beneath it. Key: thick arch ON hard estuarine structure = barra; school of medium arches above rocky rubble = fingermark; arch with shadow mid-column = barra chasing bait.',
              },
            ]
          : []),
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'auto' },
            },
            { type: 'text', text: analysisPrompt },
          ],
        },
      ],
    });

    // Stream each chunk directly to the HTTP response — client sees first byte in ~1s
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    let raw = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      if (delta) {
        raw += delta;
        res.write(delta);
      }
    }
    res.end();

    // Server-side log only — client already parsed the streamed JSON
    req.log.info({ chars: raw.length }, 'Streaming analysis complete');
  } catch (err) {
    req.log.error({ err }, 'OpenAI analyze request failed');
    res.status(500).json({ error: 'Analysis failed. Check your connection and try again.' });
  }
});

export default router;
