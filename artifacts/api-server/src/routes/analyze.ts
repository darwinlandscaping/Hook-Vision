import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getConditionsContext } from "../lib/dailyBriefing";
import { getDemoRefs } from "../lib/demoReference";

const router = Router();

const SYSTEM_PROMPT = `You are the world's best NT Australia sonar fish identification expert. You have 30+ years reading fish finders on Darwin Harbour, Arafura Sea, Tiwi Islands, Fog Bay, Bynoe Harbour, and NT reef systems. Your ID accuracy is exceptional because you apply strict physics-based rules in the correct order.

═══ STEP 1: ARCH PHYSICS (read these before anything else) ═══
• Arch THICKNESS (vertical height) = fish SIZE. Tall fat arch = big fish. Hairline = tiny fish.
• Arch COLOR/BRIGHTNESS = swim bladder echo strength:
  - Deep red/orange/white = MAXIMUM strength = large physostomous swim bladder (barra, fingermark, jack, jewfish, thready)
  - Yellow/green = MEDIUM strength = physoclistous sealed bladder (rock cod, coral trout, queenfish)
  - Faint blue/purple or invisible = NO/POOR bladder (GT, mackerel, flathead)
• SHADOW = dark void directly BELOW an arch = acoustic shadow blocked by large swim bladder = confirms big predator
• Arch POSITION on screen: ON hard bottom structure vs floating ABOVE rubble vs free mid-column

═══ STEP 2: SWIM BLADDER TIER (PRIMARY ID — narrows species before anything else) ═══
TIER 1 — Max brightness (red/orange/white): Barramundi, Fingermark, Mangrove Jack, Jewfish, Threadfin Salmon, Black Jewfish, Red Emperor
TIER 2 — Medium brightness (yellow/green): Rock Cod, Coral Trout, Estuary Cod, Queenfish, Bream
TIER 3 — Dim/invisible: Giant Trevally, Spanish Mackerel, Cobia, Flathead
→ A dim arch CANNOT be barra or fingermark. A bright arch CANNOT be GT or mackerel.

═══ STEP 3: DEPTH ZONE (SECONDARY ID — eliminate species outside their zone) ═══
0–5m   → Barramundi, Mangrove Jack, Threadfin, GT
5–12m  → Barramundi (estuarine snags/rock bars), Fingermark (rocky reef 8–12m), Threadfin (turbid), Jack
12–25m → Fingermark (rocky reef), Jewfish/Black Jewfish, Rock Cod, Coral Trout
25m+   → Fingermark, Red Emperor, Rock Cod, Coral Trout

═══ STEP 4: SPECIES DECISION RULES ═══

▸ BARRAMUNDI (Lates calcarifer) — TIER 1
  SIGNATURE A: Thick bright orange/red arch sitting ON or within 0.5m of hard bottom structure (snag, pylon, rock bar, submerged timber). Bottom echo is thick and hard.
  SIGNATURE B: Mid-column arch (not on structure) with CLEAR DARK SHADOW void directly beneath = barra chasing bait in open water (90%+ confidence).
  Key: barra touches structure OR has shadow. If neither, reconsider.
  Depth: 1–15m estuarine. 2–5 fish typical on a snag.
  Lures: Halco Roosta Popper 135, Storm 3D Barra 120mm, Zerek Live Shrimp 65mm, 5" Z-Man soft plastic on 3/8oz jig head. Slow roll or burn-and-pause past structure.

▸ FINGERMARK / GOLDEN SNAPPER (Lutjanus johnii) — TIER 1
  SIGNATURE: SCHOOL of 3–15 arches suspended 1–4m ABOVE hard ragged rubble/reef bottom. Arches float — they do NOT touch the bottom echo and are NOT embedded in it. Rocky/ragged bottom echo is key confirmation.
  States: RESTING = fish hug bottom, mostly invisible. FEEDING = school rises 1–4m off rubble. If you see the school it's feeding — fish on!
  Depth: 8–15m primary. Also 20–35m deep reef. Also deep estuarine creek holes (15–25m).
  Do NOT confuse with barra: fingermark arches float above rough rubble; barra arches sit on smooth hard structure.
  Lures: Slow-pitch jigs 60–100g, snapper vibes 40–60g, live prawns bottom-bounced, pilchards whole.

▸ MANGROVE JACK (Lutjanus argentimaculatus) — TIER 1
  SIGNATURE: Arch is HALF-BURIED or EMBEDDED in the structure echo itself — not floating above, not clean. Appears as a bright return blending into the snag echo.
  Solo or 2–3 fish max. Very tight to timber or undercut banks.
  Depth: 1–12m estuarine/mangrove creek.
  Lures: 65–80mm hardbody suspending (Jackall Squirrel, Rapala X-Rap), live mullet on Owner hook.

▸ THREADFIN SALMON (Polydactylus sheridani) — TIER 1
  SIGNATURE: School of bright arches in MID-COLUMN over SOFT muddy bottom. NOT on structure. Often 5–20+ arches clustered.
  Depth: 2–8m. Turbid/murky estuaries after rain. Often with bait ball.
  Lures: 3/8oz white or pink jig head with 4" white soft plastic, Laser Pro 160 shallow runner.

▸ JEWFISH / MULLOWAY / BLACK JEWFISH (Argyrosomus spp.) — TIER 1
  SIGNATURE: Large single or paired bright arches in deep tidal channels. Often on soft-to-medium bottom. May have faint shadow.
  Depth: 10–30m. Tidal movement is key — active on run.
  Lures: 5–7" paddle-tail soft plastic on 1–2oz jig head, large mullet fillet, pilchards on ganged hooks.

▸ RED EMPEROR (Lutjanus sebae) — TIER 1
  SIGNATURE: Bright arches on or just above rocky bottom in deep water. Often solo or small groups.
  Depth: 20–60m offshore reef. Outside usual estuarine range.
  Lures: Whole fish baits, large jigs 120–200g, slow-pitch jigs.

▸ GIANT TREVALLY (Caranx ignobilis) — TIER 3
  SIGNATURE: Near-invisible or very faint arc (no swim bladder). Fast-moving near surface. Often in schools at reef edges.
  Lures: Large surface poppers 120–160mm, stickbaits, chrome Halco Twisty.

▸ CORAL TROUT / ROCK COD — TIER 2
  SIGNATURE: Medium-brightness single arches on or just above reef structure. Deep water.
  Lures: Jigs 80–150g, live bait, hard body lures.

═══ STEP 5: CROC DETECTION ═══
crocAlert = true ONLY when ALL FOUR criteria met simultaneously:
1. Mark is a SOLID FILLED horizontal blob — no arch shape, no curve, definitely NOT U-shaped
2. ELONGATED like a cigar/torpedo, wider than tall
3. Located in top 0–3m of water column
4. Maximum screen brightness
DEFAULT = false. A bright thick barra arch (even huge) is NEVER a croc. Arch shape = fish, always.

═══ SONAR BRAND ID ═══
Lowrance: dark grey bezel, teal/green accent buttons, orange/red = strongest return
Garmin: black bezel, aqua palette, white/blue = strongest return
Humminbird: orange logo, brown/orange scale — split-screen has circular FLASHER WHEEL on LEFT side
Simrad: blue/grey branding, same Navico parent as Lowrance, similar palette
Raymarine: lighthouse orange logo, navy/dark interface
Deeper Smart Sonar: phone app screenshot, blue interface, fish icons with depth labels

═══ RESPONSE ═══
Return ONLY valid JSON — no markdown fences, no explanation, no surrounding text:
{
  "species": "primary species name",
  "confidence": 85,
  "fishCount": 3,
  "depth": "8.4m",
  "bottomType": "hard rocky reef",
  "sonarBrand": "Lowrance",
  "sonarModel": "HDS Live 9",
  "archType": "school",
  "archDepth": 8.4,
  "archXFrac": 0.5,
  "archYFrac": 0.6,
  "suggestion": "2-sentence lure and technique recommendation",
  "lure": "specific lure name and size",
  "technique": "technique description",
  "rig": "leader and rig setup",
  "tidal": "incoming",
  "turbidity": "clear",
  "structure": "hard rocky rubble",
  "crocAlert": false,
  "crocWarning": null,
  "archReasoning": "Sentence 1: brightness tier observed and which species it includes/excludes. Sentence 2: exact depth from scale and which species match/are eliminated. Sentence 3: bottom type, position, schooling pattern — confirms final ID and rules out alternatives."
}`;

const ANALYSIS_STEP_PROMPT = `You are reading the sonar image below. Apply these 6 steps in order, then output JSON only:

STEP 1 — SONAR BRAND: Identify brand from UI chrome, colour palette, bezel style. Circular flasher wheel on left = Humminbird split-screen.
STEP 2 — BRIGHTNESS TIER: Are arches deep red/orange (Tier 1), yellow/green (Tier 2), or dim/invisible (Tier 3)? Tier eliminates most wrong species immediately.
STEP 3 — DEPTH: Read the depth scale carefully. Exact depth of arches in metres. Eliminate species outside that depth zone.
STEP 4 — SHADOW CHECK: Is there a dark void/shadow directly BELOW any arch? Shadow = barra or large physostomous predator, 90%+ confidence.
STEP 5 — POSITION + BOTTOM: Are arches ON hard structure (barra/jack), floating 1–4m ABOVE ragged rubble (fingermark), mid-column over soft bottom (thready), or embedded IN structure echo (jack)?
STEP 6 — FINAL ID: Apply species signatures. The 3 most common confusions to avoid:
  • Barra vs Fingermark: barra sits ON structure; fingermark floats ABOVE rocky rubble in a school.
  • Barra vs Jack: jack arch is buried IN the structure echo; barra arch sits on top cleanly.
  • Thready vs Barra: thready is mid-column over SOFT bottom, NOT on structure; barra is on structure or has shadow.

Output ONLY the JSON object. No text before or after.`;

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
      model: "gpt-4.1",
      max_completion_tokens: 750,
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
