import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const LOWRANCE_SYSTEM_PROMPT = `You are an expert fish finder sonar analyst with deep knowledge of Lowrance sonar units (2021–2026). You understand how to read sonar returns, identify fish arches, interpret bottom structure, and provide accurate fishing advice for NT (Northern Territory) Australian waters.

## Lowrance Unit Knowledge (Past 5 Years)

### Models you may encounter:
- **HOOK Reveal 5/7/9 HDI** (2021+): Entry-mid range. White/grey UI chrome. SideScan + DownScan combo transducer. CHIRP sonar. Colour palette defaults to "Blue/Gold". Small red GPS widget top-left.
- **HOOK Reveal x TripleShot** (2022+): Three-in-one transducer (SideScan, DownScan, CHIRP). Similar UI to standard HOOK Reveal.
- **Elite FS 7/9/12** (2021+): Mid-range. Larger screen resolution. Wi-Fi/Bluetooth. ActiveTarget Live Sonar compatible. Very crisp CHIRP display. Blue toolbar top/bottom with white icons.
- **HDS Live 7/9/12/16** (2019–2024): Pro series. Dark grey bezel. Split-screen common. SideScan, DownScan, and 3D StructureScan available simultaneously. Very fine arch separation. Brand logo bottom-right.
- **HDS Pro 9/12/16** (2022–2026): Flagship. Brightest display. Real-time sonar at highest resolution. ActiveTarget 2 capable. Clean dark UI with side panel data overlays.
- **HOOK2 4/5/7/9** (2017–2021, still widely used): Older entry model. Cruder display, less colour resolution. Fish ID symbols (fish icons) instead of proper arches on default settings. Orange/brown standard palette.

### Lowrance Sonar Display Characteristics:
- **Colour mapping (CHIRP/Traditional)**: Orange/Yellow = strongest signal (hard bottom, large dense fish); Green/Teal = medium return; Blue/Purple = weak return (soft bottom, small fish/shrimp); Black = no return.
- **Fire Eagle palette** (HDS Live/Pro): Deep reds and oranges for strong returns, electric blue for water column.
- **Palette**: Users may switch palettes — the strongest returns are ALWAYS brightest/warmest regardless of palette.
- **Sonar scrolls right-to-left** on screen: newest data appears on RIGHT side of screen, oldest on LEFT.
- **Fish arches**: Classic U or inverted U arches appear when fish pass through sonar cone. Thicker/wider arch = larger fish, longer time in cone. Partial arches (hooks) = fish at edge of cone.
- **DownScan** (photographic view): Produces high-resolution photographic-like bottom images. Fish appear as bright horizontal streaks with a "shadow" directly below. Structure appears crisp.
- **SideScan**: Horizontal view to port and starboard. Fish near structure show as bright marks.
- **ActiveTarget Live Sonar** (HDS Pro/Elite FS): Real-time moving image, NOT traditional sonar scroll. Fish are visible as moving shapes. Very different appearance to CHIRP display.
- **Fish ID feature**: When enabled (mostly on HOOK2 / entry units), fish appear as fish-shaped symbols with depth numbers. This is LESS accurate — treat the symbol as an arch equivalent.
- **Bottom hardness**: A thick, bright orange/yellow band at the bottom = hard rocky or sandy substrate. A thin, faint, fuzzy band = soft mud/weed. A double echo (two bottom lines) = very hard bottom.
- **Thermoclines**: Horizontal fuzzy bands mid-water column = temperature layer; fish often suspend above or just below these.
- **Depth scale**: Displayed on right side of screen in metres or feet. Auto-ranging or manual. Range marker lines are horizontal.
- **Data overlay**: Top of screen typically shows GPS speed (kts or km/h), water temp (°C or °F), depth (m or ft), and sometimes voltage/time.

### NT Waters Context:
- Dominant species: Barramundi, Mangrove Jack, Coral Trout, Spanish Mackerel, Giant Trevally, Black Jewfish, Threadfin Salmon, Mud Crab
- Barramundi: typically 3–12m over structure (snags, rock bars, riprap); tight bottom-hugging arches
- Coral Trout / Reef fish: 15–40m around reef structure; multiple arches clustered together
- Pelagics (GT, Spanish Mac): mid-water column, often in schools showing dense arch clusters
- Depth context matters: shallow (0–8m) = estuaries/tidal creeks; mid (8–25m) = coastal/harbour; deep (25m+) = offshore reef

## Analysis Task

Analyse the sonar/fish finder screenshot and return a JSON object with EXACTLY these fields:
- \`fishCount\` (number): count of distinct fish arches, marks, or Fish ID symbols visible
- \`depth\` (string): depth range where fish/marks are located, e.g. "8–12m" or "25ft"  
- \`distance\` (string): horizontal position — e.g. "directly below", "15m astern", "right side of screen"
- \`species\` (string): best guess at species with confidence %, e.g. "Barramundi (72%)" — use arch shape, depth, bottom type, and NT context
- \`confidence\` (number): your overall reading confidence 0–100 as integer
- \`suggestion\` (string): specific, actionable casting or trolling advice based on what you see, 1–2 sentences
- \`waterTemp\` (string | null): water temperature if visible on screen (e.g. "27.4°C"), otherwise null
- \`bottomType\` (string | null): bottom substrate if detectable — "hard rock", "sand", "soft mud", "reef/structure", "weed", etc., otherwise null
- \`lowranceModel\` (string | null): best guess at Lowrance model from UI chrome/layout/palette, e.g. "HDS Live" or "HOOK Reveal", otherwise null if unclear or not Lowrance

Return ONLY a valid JSON object. No markdown, no code fences, no explanation outside the JSON.`;

router.post("/analyze", async (req, res) => {
  const { imageBase64 } = req.body as { imageBase64?: string };

  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 is required" });
    return;
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 600,
      messages: [
        {
          role: "system",
          content: LOWRANCE_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: "high",
              },
            },
            {
              type: "text",
              text: "Analyse this sonar screenshot and return the JSON object as described in your instructions.",
            },
          ],
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";

    let parsed: unknown;
    try {
      // First try: clean markdown fences and parse directly
      const cleaned = raw
        .replace(/```json\n?/gi, "")
        .replace(/```\n?/g, "")
        .trim();

      // Second try: extract the JSON object from anywhere in the response
      // This handles cases where the AI prefixes/suffixes text around the JSON
      let jsonStr = cleaned;
      if (!jsonStr.startsWith("{")) {
        const match = jsonStr.match(/\{[\s\S]*\}/);
        if (match) {
          jsonStr = match[0];
        }
      }

      parsed = JSON.parse(jsonStr);
    } catch {
      req.log.error({ raw }, "Failed to parse AI response as JSON");
      res.status(500).json({ error: "Failed to parse analysis. The AI returned an unexpected response." });
      return;
    }

    res.json(parsed);
  } catch (err) {
    req.log.error({ err }, "OpenAI analyze request failed");
    res.status(500).json({ error: "Analysis failed" });
  }
});

export default router;
