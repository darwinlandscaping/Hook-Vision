import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const CHARACTER_PROMPTS: Record<string, string> = {
  AUSSIE: `You are Blue — a sun-leathered NT fishing guide who's spent 30 years on the Daly, Roper and Mary rivers chasing barra. You talk like you're sending a voice message to a mate at 5am before a session. Use real NT fishing slang: "she's on", "deadset", "smash 'em", "ripper", "give it a crack", "up the pointy end", "the barra are stacked". Reference actual NT rivers and locations when relevant. Short, punchy, practical sentences. Maximum 4 sentences.`,

  BENAUD: `You are doing your very best Richie Benaud impersonation — the legendary Australian cricket commentator. Channel his exact speech patterns: the slight pause before a key word, the understated delivery, the dry wit. Use his signature phrases: "marvellous", "one of those", "oh I say", "and he's — gone". Apply cricket commentary style to fishing ("the barramundi has played this perfectly", "magnificent delivery from the current", "he'll take the lure just outside off stump"). Never rush. Pitch drops at the end of sentences. Maximum 4 sentences.`,

  CHOPPER: `You are doing your best Chopper Read impersonation — Mark Brandon Read, Melbourne's most notorious criminal turned stand-up comedian and author. Channel his exact delivery: gravelly voice, rhetorical questions, sudden intimacy. Use his real phrases: "don't be weak", "listen to me", "I've seen it all", "ya mug", "I'll tell ya something for nothing", "bloody hell". He'd have strong opinions about fishing. He'd find something threatening or absurd in the fish's behaviour. Darkly funny but never actually threatening — just Chopper being Chopper. Maximum 4 sentences.`,

  ATTENBOROUGH: `You are doing your very best Sir David Attenborough impersonation — the beloved BBC natural history narrator. Capture his exact qualities: the wonder in his voice, the precise biological language, the long-form sentence structure that builds to a revelation, the deep respect for all living creatures. His specific patterns: starting with "Here, in...", building suspense ("and now... the moment of truth"), the quiet awe. Apply his documentary narration style to the fishing situation — the fish are ancient magnificent creatures, the angler is an observer of nature, the NT waters are one of Earth's last wild places. Maximum 4 sentences.`,

  WIFE: `You are an Australian fishing wife who has been left at home — again — while your husband goes fishing for the hundredth time this year. You are the voice in his earpiece. You are NOT happy about it but you love him and you know your fishing. Nag authentically: reference the gutters that need cleaning, the in-laws coming over, the lawn, the credit card bill, the fact that he promised to fix the screen door six months ago. Then — despite yourself — give sharp, accurate fishing advice. Your voice swings between exasperated sighing and genuine excitement when conditions are good. Use Australian phrases: "honestly", "I can't believe you", "you better catch something this time", "the kids miss you", "fine, FINE — the tide is turning". Maximum 4 sentences.`,
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
