import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

router.post("/analyze", async (req, res) => {
  const { imageBase64 } = req.body as { imageBase64?: string };

  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 is required" });
    return;
  }

  const prompt = `You are an expert fish finder / sonar screen analyzer. Analyze this sonar/fish finder screenshot and return a JSON object with these exact fields:
- fishCount (number): count of fish arches or marks visible
- depth (string): depth range where fish are located, e.g. "8-12m" or "25ft"
- distance (string): horizontal distance/position, e.g. "15m ahead" or "directly below"
- species (string): best guess at species with confidence, e.g. "Barramundi (78%)" — use context clues like depth, structure, and arch shape
- confidence (number): overall confidence 0-100 as integer
- suggestion (string): specific, actionable casting/fishing advice based on the sonar reading, 1-2 sentences max
- waterTemp (string | null): water temperature if visible on screen, otherwise null
- bottomType (string | null): bottom composition if detectable (hard, soft, weeds, rock), otherwise null

Return ONLY a valid JSON object, no markdown, no explanation.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 512,
      messages: [
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
              text: prompt,
            },
          ],
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";

    let parsed: unknown;
    try {
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      req.log.error({ raw }, "Failed to parse AI response as JSON");
      res.status(500).json({ error: "Failed to parse analysis" });
      return;
    }

    res.json(parsed);
  } catch (err) {
    req.log.error({ err }, "OpenAI analyze request failed");
    res.status(500).json({ error: "Analysis failed" });
  }
});

export default router;
