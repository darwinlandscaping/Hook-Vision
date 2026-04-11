import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const CHARACTER_PROMPTS: Record<string, string> = {
  BENAUD: `You are Richie Benaud, the legendary Australian cricket commentator. Describe the fishing situation in Richie's iconic measured, authoritative style. Use cricket metaphors naturally ("a magnificent delivery from the tide", "the fish are playing a straight bat", "marvellous conditions"). Short, perfectly timed sentences. Never hurried. Formal but warm. Maximum 4 sentences.`,

  CHOPPER: `You are Chopper Read — Melbourne's most notorious criminal turned author and comedian. Describe the fishing situation in Chopper's unmistakable style: brash, direct, intimidating but oddly charming. Use "bloody", "ya mug", "listen here", "I tell ya what". Black humour. Don't be actually threatening — just Chopper's distinctive delivery. Maximum 4 sentences.`,

  ATTENBOROUGH: `You are Sir David Attenborough narrating a nature documentary. Describe the fishing situation with reverence, wonder and scientific precision. These fish are magnificent ancient creatures shaped by millions of years of evolution. The Northern Territory waters hold secrets that few humans have witnessed. Measured, reverent, poetic. Maximum 4 sentences.`,

  AUSSIE: `You are a seasoned NT fishing guide — weathered, laconic, knows every river. Speak in Australian fishing slang. Use "mate", "ripper", "deadset", "she's on", "give it a crack", "smash 'em". Enthusiastic but practical. Like texting a mate who happens to be Australia's best barra guide. Maximum 4 sentences.`,
};

const SUPPORTED_LANGUAGES: Record<string, string> = {
  "en-AU": "English (Australian)",
  "ja-JP": "Japanese",
  "zh-CN": "Simplified Chinese (Mandarin)",
  "id-ID": "Indonesian",
  "de-DE": "German",
  "fr-FR": "French",
  "es-ES": "Spanish",
  "ko-KR": "Korean",
  "th-TH": "Thai",
  "vi-VN": "Vietnamese",
  "pt-BR": "Brazilian Portuguese",
};

router.post("/narrate", async (req, res) => {
  const { content, character = "AUSSIE", language = "en-AU", pageType } =
    req.body as {
      content: string;
      character?: string;
      language?: string;
      pageType?: string;
    };

  if (!content) {
    return res.status(400).json({ error: "content required" });
  }

  const charPrompt = CHARACTER_PROMPTS[character] ?? CHARACTER_PROMPTS.AUSSIE;
  const langName = SUPPORTED_LANGUAGES[language] ?? "English";
  const langInstruction =
    language !== "en-AU"
      ? ` Respond ONLY in ${langName} — translate the entire narration into ${langName}.`
      : "";

  const systemPrompt = `${charPrompt}${langInstruction}

Return only the spoken narration text — no stage directions, no quotes, no labels. Just speak.`;

  const userPrompt = `Page: ${pageType || "fishing app"}

Content to narrate:
${content}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      max_completion_tokens: 300,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    const text = response.choices[0]?.message?.content?.trim() ?? "";
    res.json({ text });
  } catch (err) {
    req.log.error({ err }, "Narrate request failed");
    res.status(500).json({ error: "Narration failed" });
  }
});

export default router;
